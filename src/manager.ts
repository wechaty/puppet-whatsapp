/* eslint-disable import/no-duplicates */
import { EventEmitter } from 'events'
import {
  distinctUntilKeyChanged,
  fromEvent,
  map,
  merge,
} from 'rxjs'
import * as PUPPET from 'wechaty-puppet'
import pLimit from 'p-limit'
import { RequestManager } from './request/requestManager.js'
import { CacheManager } from './data-manager/cache-manager.js'
import { MEMORY_SLOT } from './config.js'
import { WA_ERROR_TYPE } from './exceptions/error-type.js'
import WAError from './exceptions/whatsapp-error.js'
import { getWhatsApp } from './whatsapp.js'
import type { PuppetWhatsAppOptions } from './puppet-whatsapp.js'
import type {  Contact, InviteV4Data, Message, MessageContent, MessageSendOptions, GroupNotification, ClientSession, GroupChat, BatteryInfo, WAState } from './schema/index.js'
import { Client as WhatsApp, WhatsAppMessageType, GroupNotificationTypes } from './schema/index.js'
import { logger } from './logger/index.js'
import { sleep } from './utils.js'
import { env } from 'process'

const InviteLinkRegex = /^(https?:\/\/)?chat\.whatsapp\.com\/(?:invite\/)?([a-zA-Z0-9_-]{22})$/
type ManagerEvents = 'message'
                   | 'room-join'
                   | 'room-leave'
                   | 'room-topic'
                   | 'room-invite'
                   | 'reset'
                   | 'friendship'
                   | 'ready'
                   | 'error'
                   | 'heartbeat'
                   | 'scan'
                   | 'login'
                   | 'logout'
                   | 'dirty'

export class Manager extends EventEmitter {

  whatsapp?: WhatsApp
  requestManager?: RequestManager
  cacheManager?: CacheManager
  botId?: string

  constructor (private options: PuppetWhatsAppOptions) {
    super()
    this.options = options
  }

  public override emit (event: 'message', payload: PUPPET.EventMessagePayload): boolean
  public override emit (event: 'room-join', payload: PUPPET.EventRoomJoinPayload): boolean
  public override emit (event: 'room-leave', payload: PUPPET.EventRoomLeavePayload): boolean
  public override emit (event: 'room-topic', payload: PUPPET.EventRoomTopicPayload): boolean
  public override emit (event: 'room-invite', payload: PUPPET.EventRoomInvitePayload): boolean
  public override emit (event: 'scan', status: PUPPET.ScanStatus, url?: string): boolean
  public override emit (event: 'login', userId: string): boolean
  public override emit (event: 'logout', userId: string, message: string): boolean
  public override emit (event: 'friendship', id: string): boolean
  public override emit (event: 'reset', reason: string): boolean
  public override emit (event: 'error', error: string): boolean
  public override emit (event: 'heartbeat', data: string): boolean
  public override emit (event: 'ready'): boolean
  public override emit (event: 'dirty', payload: PUPPET.EventDirtyPayload): boolean
  public override emit (event: never, ...args: never[]): never
  public override emit (event: ManagerEvents, ...args: any[]): boolean {
    return super.emit(event, ...args)
  }

  public override on (event: 'message', listener: (payload: PUPPET.EventMessagePayload) => any): this
  public override on (event: 'room-join', listener: (payload: PUPPET.EventRoomJoinPayload) => any): this
  public override on (event: 'room-leave', listener: (payload: PUPPET.EventRoomLeavePayload) => any): this
  public override on (event: 'room-topic', listener: (payload: PUPPET.EventRoomTopicPayload) => any): this
  public override on (event: 'room-invite', listener: (payload: PUPPET.EventRoomInvitePayload) => any): this
  public override on (event: 'scan', listener: (status: PUPPET.ScanStatus, url?: string) => any): this
  public override on (event: 'login', listener: (userId: string) => any): this
  public override on (event: 'logout', listener: (userId: string, message: string) => any): this
  public override on (event: 'friendship', listener: (id: string) => any): this
  public override on (event: 'reset', listener: (reason: string) => any): this
  public override on (event: 'error', listener: (error: string) => any): this
  public override on (event: 'heartbeat', listener: (data: string) => any): this
  public override on (event: 'ready', listener: () => any): this
  public override on (event: 'dirty', listener: (payload: PUPPET.EventDirtyPayload) => void): this
  public override on (event: never, listener: never): never
  public override on (event: ManagerEvents, listener : (...args: any[]) => any): this {
    super.on(event, listener)
    return this
  }

  public async start (session?: ClientSession) {
    logger.info('start()')
    this.whatsapp = await getWhatsApp(this.options['puppeteerOptions'], session)
    this.whatsapp
      .initialize()
      .then(() => logger.verbose('start() whatsapp.initialize() done.'))
      .catch(async e => {
        logger.error('start() whatsapp.initialize() rejection: %s', e)
        if (env['NODE_ENV'] !== 'test') {
          await sleep(2 * 1000)
          await this.start(session)
        }
      })

    this.requestManager = new RequestManager(this.whatsapp)
    await this.initWhatsAppEvents(this.whatsapp)
    return this.whatsapp
  }

  public async stop () {
    logger.info('stop()')
    if (this.whatsapp) {
      await this.whatsapp.destroy()
      this.whatsapp = undefined
    }
    await this.releaseCache()
    this.requestManager = undefined
    this.botId = undefined
  }

  private async onAuthenticated (session: ClientSession) {
    logger.info(`onAuthenticated(${JSON.stringify(session)})`)
    try {
      await this.options.memory?.set(MEMORY_SLOT, session)
      await this.options.memory?.save()
    } catch (e) {
      console.error(e)
      logger.error('getClient() whatsapp.on(authenticated) rejection: %s', e)
    }
  }

  private async onAuthFailure (message: string) {
    logger.warn('auth_failure: %s, then restart no use exist session', message)
    // msg -> auth_failure message
    // auth_failure due to session invalidation
    // clear sessionData -> reinit
    await this.options.memory?.delete(MEMORY_SLOT)
    await this.options.memory?.save()
  }

  private async onWhatsAppReady () {
    const whatsapp = this.getWhatsApp()
    this.botId = whatsapp.info.wid._serialized
    const contactList: Contact[] = await whatsapp.getContacts()
    const contactOrRoomList = contactList.filter(c => c.id.server !== 'broadcast')

    await this.onLogin(contactOrRoomList)
    await this.onReady(contactOrRoomList)
  }

  private async onLogin (contactOrRoomList: Contact[]) {
    if (!this.botId) {
      throw new WAError(WA_ERROR_TYPE.ERR_INIT, 'No login bot id.')
    }

    await this.initCache(this.botId)
    const cacheManager = await this.getCacheManager()

    const limit = pLimit(500)
    const all = contactOrRoomList.map((contact) => {
      return limit(async () => {
        const contactInCache = await cacheManager.getContactOrRoomRawPayload(contact.id._serialized)
        if (contactInCache) {
          return
        }
        const contactWithAvatar = Object.assign(contact, { avatar: '' })
        await cacheManager.setContactOrRoomRawPayload(contact.id._serialized, contactWithAvatar)
      })
    })
    await Promise.all(all)

    const botSelfInCache = await cacheManager.getContactOrRoomRawPayload(this.botId)
    if (!botSelfInCache) {
      const botSelf = await this.getContactById(this.botId)
      await cacheManager.setContactOrRoomRawPayload(this.botId, {
        ...botSelf,
        avatar: await this.getAvatarUrl(this.botId),
      })
    }

    this.emit('login', this.botId)
    logger.info(`onLogin(${this.botId}})`)
  }

  private async onReady (contactOrRoomList: Contact[]) {
    const cacheManager = await this.getCacheManager()
    const limitForAvatar = pLimit(100)
    let friendCount = 0
    let contactCount = 0
    let roomCount = 0
    const allForAvatar = contactOrRoomList.map((contact) => {
      return limitForAvatar(async () => {
        const avatar = await contact.getProfilePicUrl()
        const contactWithAvatar = Object.assign(contact, { avatar })
        await cacheManager.setContactOrRoomRawPayload(contact.id._serialized, contactWithAvatar)
        if (contact.isGroup) {
          roomCount++
        } else {
          contactCount++
          if (contact.isMyContact) {
            friendCount++
          }
        }
      })
    })
    await Promise.all(allForAvatar)
    logger.info(`onReady() all contacts and rooms are ready, friendCount: ${friendCount} contactCount: ${contactCount} roomCount: ${roomCount}`)
    this.emit('ready')
  }

  private async onLogout (reason: string = '退出登录') {
    logger.info(`onLogout(${reason})`)
    await this.options.memory?.delete(MEMORY_SLOT)
    await this.options.memory?.save()
    const whatsapp = this.getWhatsApp()
    this.emit('logout', whatsapp.info.wid._serialized, reason as string)
  }

  private async onMessage (msg: Message) {
    logger.info(`onMessage(${JSON.stringify(msg)})`)
    // @ts-ignore
    if (msg.type === 'e2e_notification') {
      if (msg.body === '' && msg.author === undefined) {
        // match group join message pattern
        return
      }
    }
    const messageId = msg.id.id
    const cacheManager = await this.getCacheManager()
    const messageInCache = await cacheManager.getMessageRawPayload(messageId)
    if (messageInCache) {
      return
    }
    await cacheManager.setMessageRawPayload(messageId, msg)

    const contactId = msg.from
    const contact = await this.getContactById(contactId)
    if (contact.isMyContact) {
      /*
       * TODO: 也许可以将非好友发来的消息作为好友事件
       * 优点：可以在秒回端复用一些好友逻辑
       * 缺点：1、可能非好友连续发多条消息导致反复推送好友事件（例如：你好？在吗？在吗？在吗）
       *      2、whatsapp并非真正的好友关系，如果手机卡换了一个手机，通讯录没有他，则相当于非好友了，与传统好友的运作逻辑不符
      */
    }
    if (msg.type !== WhatsAppMessageType.GROUP_INVITE) {
      if (msg.links.length === 1 && InviteLinkRegex.test(msg.links[0]!.link)) {
        const matched = msg.links[0]!.link.match(InviteLinkRegex)
        if (matched) {
          if (matched.length === 3) {
            const inviteCode = matched[2]!
            const roomInvitationPayload: PUPPET.EventRoomInvitePayload = {
              roomInvitationId: inviteCode,
            }
            const rawData: Partial<InviteV4Data> = {
              inviteCode,
            }
            await cacheManager.setRoomInvitationRawPayload(inviteCode, rawData)
            this.emit('room-invite', roomInvitationPayload)
          } else {
            // TODO:
          }
        } else {
          this.emit('message', { messageId: msg.id.id })
        }
      } else {
        this.emit('message', { messageId: msg.id.id })
      }

    } else {
      const info = msg.inviteV4
      if (info) {
        const roomInvitationPayload: PUPPET.EventRoomInvitePayload = {
          roomInvitationId: info.inviteCode,
        }
        await cacheManager.setRoomInvitationRawPayload(info.inviteCode, info)
        this.emit('room-invite', roomInvitationPayload)
      } else {
        // TODO:
      }
    }
  }

  private onQRCode (qr: string) {
    logger.info(`onQRCode(${qr})`)
    // NOTE: This event will not be fired if a session is specified.
    this.emit('scan', PUPPET.ScanStatus.Waiting, qr)
  }

  private async onRoomJoin (notification: GroupNotification) {
    logger.info(`onRoomJoin(${JSON.stringify(notification)})`)
    const roomJoinPayload: PUPPET.EventRoomJoinPayload = {
      inviteeIdList: notification.recipientIds,
      inviterId: notification.author,
      roomId: notification.chatId,
      timestamp: notification.timestamp,
    }
    this.emit('room-join', roomJoinPayload)
  }

  private async onRoomLeave (notification: GroupNotification) {
    logger.info(`onRoomLeave(${JSON.stringify(notification)})`)
    const roomJoinPayload: PUPPET.EventRoomLeavePayload = {
      removeeIdList: notification.recipientIds,
      removerId: notification.author,
      roomId: notification.chatId,
      timestamp: notification.timestamp,
    }
    this.emit('room-leave', roomJoinPayload)
  }

  private async onRoomUpdate (notification: GroupNotification) {
    logger.info(`onRoomUpdate(${JSON.stringify(notification)})`)
    const cacheManager = await this.getCacheManager()
    const roomInCache = await cacheManager.getContactOrRoomRawPayload(notification.chatId)

    if (!roomInCache) {
      const rawRoom = await this.getContactById(notification.chatId)
      const avatar = await rawRoom.getProfilePicUrl()
      const room = Object.assign(rawRoom, { avatar })
      await cacheManager.setContactOrRoomRawPayload(notification.chatId, room)
    }
    if (notification.type === GroupNotificationTypes.SUBJECT) {
      const roomJoinPayload: PUPPET.EventRoomTopicPayload = {
        changerId: notification.author,
        newTopic: notification.body,
        oldTopic: roomInCache?.name || '',
        roomId: notification.chatId,
        timestamp: notification.timestamp,
      }
      this.emit('room-topic', roomJoinPayload)
    }
    if (notification.type === GroupNotificationTypes.CREATE) {
      // FIXME: how to reuse roomMemberList from room-mixin
      const roomId = (notification.id as any).remote
      const roomChat = await this.getChatById(roomId) as GroupChat
      const members = roomChat.participants.map(participant => participant.id._serialized)

      const roomJoinPayload: PUPPET.EventRoomJoinPayload = {
        inviteeIdList: members,
        inviterId: notification.author,
        roomId: notification.chatId,
        timestamp: notification.timestamp,
      }
      this.emit('room-join', roomJoinPayload)
    }
  }

  /**
   * unsupported events
   * leave logs to for further dev
  */
  private async onChangeBattery (batteryInfo: BatteryInfo) {
    logger.silly(`onChangeBattery(${JSON.stringify(batteryInfo)})`)
  }

  private async onChangeState (state: WAState) {
    logger.silly(`onChangeState(${JSON.stringify(state)})`)
  }

  private async onIncomingCall (...args: any[]) { // it is a any[] argument
    logger.silly(`onIncomingCall(${JSON.stringify(args)})`)
  }

  private async onMediaUploaded (message: Message) {
    logger.silly(`onMediaUploaded(${JSON.stringify(message)})`)
  }

  private async onMessageAck (message: Message) {
    logger.silly(`onMessageAck(${JSON.stringify(message)})`)
    if (message.id.fromMe && message.ack >= 0) {
      const messageId = message.id.id
      const cacheManager = await this.getCacheManager()
      const messageInCache = await cacheManager.getMessageRawPayload(messageId)
      if (messageInCache) {
        return
      }
      await cacheManager.setMessageRawPayload(messageId, message)
      this.emit('message', { messageId })
    }
  }

  private async onMessageCreate (message: Message) {
    logger.silly(`onMessageCreate(${JSON.stringify(message)})`)
    if (message.id.fromMe && message.ack >= 0) {
      const messageId = message.id.id
      const cacheManager = await this.getCacheManager()
      const messageInCache = await cacheManager.getMessageRawPayload(messageId)
      if (messageInCache) {
        return
      }
      await cacheManager.setMessageRawPayload(messageId, message)
      this.emit('message', { messageId })
    }
  }

  private async onMessageRevokeEveryone (message: Message, revokedMsg?: Message | null | undefined) {
    logger.silly(`onMessageRevokeEveryone(${JSON.stringify(message)}), ${JSON.stringify(revokedMsg)}`)
  }

  private async onMessageRevokeMe (message: Message) {
    logger.silly(`onMessageRevokeMe(${JSON.stringify(message)})`)
  }

  public async initWhatsAppEvents (
    whatsapp: WhatsApp,
  ): Promise<void> {
    logger.verbose('initWhatsAppEvents()')

    whatsapp.on('authenticated', this.onAuthenticated.bind(this))
    /**
     * There is only one situation that will cause this event, invalid session causing timeout
     * https://github.com/pedroslopez/whatsapp-web.js/blob/d86c39de3ca5699a50db98ee93e264ab8c4f25a3/src/Client.js#L116-L129
     */
    whatsapp.on('auth_failure', this.onAuthFailure.bind(this))

    whatsapp.on('ready', this.onWhatsAppReady.bind(this))

    whatsapp.on('message', this.onMessage.bind(this))

    whatsapp.on('qr', this.onQRCode.bind(this))

    whatsapp.on('group_join', this.onRoomJoin.bind(this))

    whatsapp.on('group_leave', this.onRoomLeave.bind(this))

    whatsapp.on('group_update', this.onRoomUpdate.bind(this))

    // unsupported events
    whatsapp.on('change_battery', this.onChangeBattery.bind(this))
    whatsapp.on('change_state', this.onChangeState.bind(this))
    whatsapp.on('incoming_call', this.onIncomingCall.bind(this))
    whatsapp.on('media_uploaded', this.onMediaUploaded.bind(this))
    whatsapp.on('message_ack', this.onMessageAck.bind(this))
    whatsapp.on('message_create', this.onMessageCreate.bind(this))
    whatsapp.on('message_revoke_everyone', this.onMessageRevokeEveryone.bind(this))
    whatsapp.on('message_revoke_me', this.onMessageRevokeMe.bind(this))

    const events = [
      'authenticated',
      'ready',
      'disconnected',
    ]
    const eventStreams = events.map((event) => fromEvent(whatsapp, event).pipe(map((value: any) => ({ event, value }))))
    const allEvents$ = merge(...eventStreams)
    allEvents$.pipe(distinctUntilKeyChanged('event')).subscribe(({ event, value }: { event: string, value: any }) => {
      logger.info(`event: ${JSON.stringify(event)}, value: ${JSON.stringify(value)}`)
      if (event === 'disconnected' && value as string === 'NAVIGATION') {
        if (value === 'NAVIGATION') {
          void this.onLogout('已退出登录')
        } else if (value === 'CONFLICT') {
          void this.onLogout('已在其他设备上登录')
        }
      }
    })
  }

  public async getCacheManager () {
    if (!this.cacheManager) {
      throw new WAError(WA_ERROR_TYPE.ERR_INIT, 'no cache manager')
    }
    return this.cacheManager
  }

  public async initCache (userId: string) {
    logger.info(`initCache(${userId})`)
    if (this.cacheManager) {
      logger.warn('initCache() already initialized, skip the init...')
      return
    }
    await CacheManager.init(userId)
    this.cacheManager = CacheManager.Instance
  }

  public async releaseCache () {
    logger.info('releaseCache()')
    if (this.cacheManager) {
      logger.warn('releaseCache() already initialized, skip the init...')
      return
    }
    await CacheManager.release()
  }

  private getRequestManager () {
    if (!this.requestManager) {
      throw new WAError(WA_ERROR_TYPE.ERR_INIT, 'No request manager')
    }
    return this.requestManager
  }

  /**
   * LOGIC METHODS
   */

  public logout () {
    const requestManager = this.getRequestManager()
    return requestManager.logout()
  }

  public acceptPrivateRoomInvite (invitation: InviteV4Data) {
    const requestManager = this.getRequestManager()
    return requestManager.acceptPrivateRoomInvite(invitation)
  }

  public acceptRoomInvite (inviteCode: string) {
    const requestManager = this.getRequestManager()
    return requestManager.acceptRoomInvite(inviteCode)
  }

  public archiveChat (chatId: string) {
    const requestManager = this.getRequestManager()
    return requestManager.archiveChat(chatId)
  }

  public unarchiveChat (chatId: string) {
    const requestManager = this.getRequestManager()
    return requestManager.unarchiveChat(chatId)
  }

  public createRoom (name: string, participants: Contact[] | string[]) {
    const requestManager = this.getRequestManager()
    return requestManager.createRoom(name, participants)
  }

  public destroy () {
    const requestManager = this.getRequestManager()
    return requestManager.destroy()
  }

  public getBLockedContacts () {
    const requestManager = this.getRequestManager()
    return requestManager.getBLockedContacts()
  }

  public getChatById (chatId: string) {
    const requestManager = this.getRequestManager()
    return requestManager.getChatById(chatId)
  }

  public getChatLabels (chatId: string) {
    const requestManager = this.getRequestManager()
    return requestManager.getChatLabels(chatId)
  }

  public getChats () {
    const requestManager = this.getRequestManager()
    return requestManager.getChats()
  }

  public getChatsByLabelId (labelId: string) {
    const requestManager = this.getRequestManager()
    return requestManager.getChatsByLabelId(labelId)
  }

  public getContactById (contactId: string) {
    const requestManager = this.getRequestManager()
    return requestManager.getContactById(contactId)
  }

  public getContacts () {
    const requestManager = this.getRequestManager()
    return requestManager.getContacts()
  }

  public getCountryCode (whatsappId: string) {
    const requestManager = this.getRequestManager()
    return requestManager.getCountryCode(whatsappId)
  }

  public getFormattedNumber (whatsappId: string) {
    const requestManager = this.getRequestManager()
    return requestManager.getFormattedNumber(whatsappId)
  }

  public getInviteInfo (inviteId: string) {
    const requestManager = this.getRequestManager()
    return requestManager.getInviteInfo(inviteId)
  }

  public getLabelById (labelId: string) {
    const requestManager = this.getRequestManager()
    return requestManager.getLabelById(labelId)
  }

  public getLabels () {
    const requestManager = this.getRequestManager()
    return requestManager.getLabels()
  }

  public getWhatsappIdByNumber (number: string) {
    const requestManager = this.getRequestManager()
    return requestManager.getWhatsappIdByNumber(number)
  }

  public getAvatarUrl (contactId: string) {
    const requestManager = this.getRequestManager()
    return requestManager.getAvatarUrl(contactId)
  }

  public getState () {
    const requestManager = this.getRequestManager()
    return requestManager.getState()
  }

  public getWhatsAppVersion () {
    const requestManager = this.getRequestManager()
    return requestManager.getWhatsAppVersion()
  }

  public init () {
    const requestManager = this.getRequestManager()
    return requestManager.init()
  }

  public isWhatsappUser (contactId: string) {
    const requestManager = this.getRequestManager()
    return requestManager.isWhatsappUser(contactId)
  }

  public markChatUnread (chatId: string) {
    const requestManager = this.getRequestManager()
    return requestManager.markChatUnread(chatId)
  }

  public muteChat (chatId: string) {
    const requestManager = this.getRequestManager()
    return requestManager.muteChat(chatId)
  }

  public unmuteChat (chatId: string) {
    const requestManager = this.getRequestManager()
    return requestManager.unmuteChat(chatId)
  }

  public pinChat (chatId: string) {
    const requestManager = this.getRequestManager()
    return requestManager.pinChat(chatId)
  }

  public unpinChat (chatId: string) {
    const requestManager = this.getRequestManager()
    return requestManager.unpinChat(chatId)
  }

  public resetConnection () {
    const requestManager = this.getRequestManager()
    return requestManager.resetConnection()
  }

  public searchMessage (query: string, options?: { chatId?: string, page?: number, limit?: number }) {
    const requestManager = this.getRequestManager()
    return requestManager.searchMessage(query, options)
  }

  public sendMessage (chatId: string, content: MessageContent, options?: MessageSendOptions) {
    const requestManager = this.getRequestManager()
    return requestManager.sendMessage(chatId, content, options)
  }

  public sendPresenceAvailable () {
    const requestManager = this.getRequestManager()
    return requestManager.sendPresenceAvailable()
  }

  public markChatRead (chatId: string) {
    const requestManager = this.getRequestManager()
    return requestManager.markChatRead(chatId)
  }

  public async setNickname (nickname: string) {
    const requestManager = this.getRequestManager()
    return requestManager.setNickname(nickname)
  }

  public async setStatusMessage (nickname: string) {
    const requestManager = this.getRequestManager()
    return requestManager.setStatusMessage(nickname)
  }

  private getWhatsApp () {
    if (!this.whatsapp) {
      throw new WAError(WA_ERROR_TYPE.ERR_INIT, 'Not init whatsapp')
    }
    return this.whatsapp
  }

}
