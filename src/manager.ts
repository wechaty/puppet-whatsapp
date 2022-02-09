/* eslint-disable import/no-duplicates */
import { EventEmitter } from 'events'
import {
  distinctUntilKeyChanged,
  fromEvent,
  map,
  merge,
} from 'rxjs'
import * as PUPPET from 'wechaty-puppet'
import { RequestManager } from './request/requestManager.js'
import { CacheManager } from './data-manager/cache-manager.js'
import { LOGOUT_REASON, MEMORY_SLOT, MIN_BATTERY_VALUE_FOR_LOGOUT } from './config.js'
import { WA_ERROR_TYPE } from './exceptions/error-type.js'
import WAError from './exceptions/whatsapp-error.js'
import { getWhatsApp } from './whatsapp.js'
import type { PuppetWhatsAppOptions } from './puppet-whatsapp.js'
import type {  Contact, InviteV4Data, Message, MessageContent, MessageSendOptions, GroupNotification, ClientSession, GroupChat, BatteryInfo, WAStateType } from './schema/index.js'
import { Client as WhatsApp, WhatsAppMessageType, GroupNotificationTypes, WAState } from './schema/index.js'
import { logger } from './logger/index.js'
import { batchProcess, getInviteCode, isContactId, isInviteLink, isRoomId, sleep } from './utils.js'
import { env } from 'process'

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
      await this.whatsapp.stop()
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
    // Unable to log in. Are the session details valid?, then restart no use exist session
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

    const botSelf = await this.getContactById(this.botId)
    await cacheManager.setContactOrRoomRawPayload(this.botId, {
      ...botSelf,
      avatar: await this.getAvatarUrl(this.botId),
    })

    const batchSize = 500
    await batchProcess(batchSize, contactOrRoomList, async (contactOrRoom: Contact) => {
      const contactOrRoomId = contactOrRoom.id._serialized
      const contactInCache = await cacheManager.getContactOrRoomRawPayload(contactOrRoomId)
      if (contactInCache) {
        return
      }
      const contactWithAvatar = Object.assign(contactOrRoom, { avatar: '' })
      await cacheManager.setContactOrRoomRawPayload(contactOrRoomId, contactWithAvatar)
    })

    this.emit('login', this.botId)
    logger.info(`onLogin(${this.botId}})`)
  }

  private async onReady (contactOrRoomList: Contact[]) {
    const cacheManager = await this.getCacheManager()
    let friendCount = 0
    let contactCount = 0
    let roomCount = 0

    const batchSize = 100
    await batchProcess(batchSize, contactOrRoomList, async (contactOrRoom: Contact) => {
      const contactOrRoomId = contactOrRoom.id._serialized
      const avatar = await contactOrRoom.getProfilePicUrl()
      const contactWithAvatar = Object.assign(contactOrRoom, { avatar })
      if (isContactId(contactOrRoomId)) {
        contactCount++
        if (contactOrRoom.isMyContact) {
          friendCount++
        }
        await cacheManager.setContactOrRoomRawPayload(contactOrRoomId, contactWithAvatar)
      } else if (isRoomId(contactOrRoomId)) {
        const chat = await this.getChatById(contactOrRoomId) as GroupChat
        const memberList = chat.participants.map(m => m.id._serialized)
        if (memberList.length > 0) {
          roomCount++
          await cacheManager.setContactOrRoomRawPayload(contactOrRoomId, contactWithAvatar)
          await cacheManager.setRoomMemberIdList(contactOrRoomId, memberList)
        } else {
          await cacheManager.deleteContactOrRoom(contactOrRoomId)
          await cacheManager.deleteRoomMemberIdList(contactOrRoomId)
        }
      } else {
        logger.warn(`Unknown contact type: ${JSON.stringify(contactOrRoom)}`)
      }
    })

    logger.info(`onReady() all contacts and rooms are ready, friendCount: ${friendCount} contactCount: ${contactCount} roomCount: ${roomCount}`)
    this.emit('ready')
  }

  private async onLogout (reason: string = LOGOUT_REASON.DEFAULT) {
    logger.info(`onLogout(${reason})`)
    await this.options.memory?.delete(MEMORY_SLOT)
    await this.options.memory?.save()
    const whatsapp = this.getWhatsApp()
    this.emit('logout', whatsapp.info.wid._serialized, reason as string)
  }

  private async onMessage (message: Message) {
    logger.info(`onMessage(${JSON.stringify(message)})`)
    // @ts-ignore
    if (
      message.type === 'multi_vcard'
      || (message.type === 'e2e_notification'
      && message.body === ''
      && !message.author)
    ) {
      // skip room join notification and multi_vcard message
      return
    }
    const messageId = message.id.id
    const cacheManager = await this.getCacheManager()
    const messageInCache = await cacheManager.getMessageRawPayload(messageId)
    if (messageInCache) {
      return
    }
    await cacheManager.setMessageRawPayload(messageId, message)

    const contactId = message.from
    const contact = await this.getContactById(contactId)
    if (contact.isMyContact) {
      /*
       * TODO: 也许可以将非好友发来的消息作为好友事件
       * 优点：可以在秒回端复用一些好友逻辑
       * 缺点：1、可能非好友连续发多条消息导致反复推送好友事件（例如：你好？在吗？在吗？在吗）
       *      2、whatsapp并非真正的好友关系，如果手机卡换了一个手机，通讯录没有他，则相当于非好友了，与传统好友的运作逻辑不符
      */
    }

    const needEmitMessage = await this.convertInviteLinkMessageToEvent(message)
    if (needEmitMessage) {
      this.emit('message', { messageId })
    }
  }

  private async convertInviteLinkMessageToEvent (message: Message): Promise<boolean> {
    const cacheManager = await this.getCacheManager()
    if (message.type === WhatsAppMessageType.GROUP_INVITE) {
      const inviteCode = message.inviteV4?.inviteCode
      if (inviteCode) {
        const roomInvitationPayload: PUPPET.EventRoomInvitePayload = {
          roomInvitationId: inviteCode,
        }
        await cacheManager.setRoomInvitationRawPayload(inviteCode, { inviteCode })
        this.emit('room-invite', roomInvitationPayload)
      } else {
        logger.warn(`convertInviteLinkMessageToEvent can not get invite code: ${JSON.stringify(message)}`)
      }
      return false
    }

    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (message.type === WhatsAppMessageType.TEXT && message.links && message.links.length === 1 && isInviteLink(message.links[0]!.link)) {
      const inviteCode = getInviteCode(message.links[0]!.link)
      if (inviteCode) {
        const roomInvitationPayload: PUPPET.EventRoomInvitePayload = {
          roomInvitationId: inviteCode,
        }
        await cacheManager.setRoomInvitationRawPayload(inviteCode, { inviteCode })
        this.emit('room-invite', roomInvitationPayload)
        return false
      }
    }
    return true
  }

  private onQRCode (qr: string) {
    logger.info(`onQRCode(${qr})`)
    // NOTE: This event will not be fired if a session is specified.
    this.emit('scan', PUPPET.ScanStatus.Waiting, qr)
  }

  private async onRoomJoin (notification: GroupNotification) {
    logger.info(`onRoomJoin(${JSON.stringify(notification)})`)
    const roomId = (notification.id as any).remote
    const roomJoinPayload: PUPPET.EventRoomJoinPayload = {
      inviteeIdList: notification.recipientIds,
      inviterId: notification.author,
      roomId,
      timestamp: notification.timestamp,
    }
    const cacheManager = await this.getCacheManager()
    await cacheManager.addRoomMemberToList(roomId, notification.recipientIds)
    this.emit('room-join', roomJoinPayload)
  }

  private async onRoomLeave (notification: GroupNotification) {
    logger.info(`onRoomLeave(${JSON.stringify(notification)})`)
    const roomId = (notification.id as any).remote
    const roomJoinPayload: PUPPET.EventRoomLeavePayload = {
      removeeIdList: notification.recipientIds,
      removerId: notification.author,
      roomId,
      timestamp: notification.timestamp,
    }
    const cacheManager = await this.getCacheManager()
    await cacheManager.removeRoomMemberFromList(roomId, notification.recipientIds)
    this.emit('room-leave', roomJoinPayload)
  }

  private async onRoomUpdate (notification: GroupNotification) {
    logger.info(`onRoomUpdate(${JSON.stringify(notification)})`)
    const roomId = (notification.id as any).remote
    const cacheManager = await this.getCacheManager()
    const roomInCache = await cacheManager.getContactOrRoomRawPayload(roomId)

    if (!roomInCache) {
      const rawRoom = await this.getContactById(roomId)
      const avatar = await rawRoom.getProfilePicUrl()
      const room = Object.assign(rawRoom, { avatar })
      await cacheManager.setContactOrRoomRawPayload(roomId, room)
    }
    if (notification.type === GroupNotificationTypes.SUBJECT) {
      const roomJoinPayload: PUPPET.EventRoomTopicPayload = {
        changerId: notification.author,
        newTopic: notification.body,
        oldTopic: roomInCache?.name || '',
        roomId,
        timestamp: notification.timestamp,
      }
      if (roomInCache) {
        roomInCache.name = notification.body
        await cacheManager.setContactOrRoomRawPayload(roomId, roomInCache)
      }
      this.emit('room-topic', roomJoinPayload)
    }
    if (notification.type === GroupNotificationTypes.DESCRIPTION) {
      const roomRawPayload = await this.getChatById(roomId)
      const roomMetadata = (roomRawPayload as any).groupMetadata
      const description = roomMetadata.desc
      logger.info(`GroupNotificationTypes.DESCRIPTION changed: ${description}`)
      const genMessagePayload = {
        ack: 2,
        author: (notification.id as any).author,
        body: description,
        broadcast: false,
        forwardingScore: 0,
        from: (notification.id as any).participant,
        fromMe: (notification.id as any).fromMe,
        hasMedia: false,
        hasQuotedMsg: false,
        id: notification.id,
        isForwarded: false,
        isGif: false,
        isStarred: false,
        isStatus: false,
        mentionedIds: [],
        timestamp: Date.now(),
        to: roomId,
        type: WhatsAppMessageType.TEXT,
        vCards: [],
      } as any
      await this.onMessage(genMessagePayload)
    }
    if (notification.type === GroupNotificationTypes.CREATE) {
      // FIXME: how to reuse roomMemberList from room-mixin
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
    if (!this.botId) {
      throw new WAError(WA_ERROR_TYPE.ERR_INIT, 'No login bot id.')
    }

    if (batteryInfo.battery <= MIN_BATTERY_VALUE_FOR_LOGOUT && !batteryInfo.plugged) {
      this.emit('logout', this.botId, LOGOUT_REASON.BATTERY_LOWER_IN_PHONE)
    }
  }

  private async onChangeState (state: WAStateType) {
    logger.silly(`onChangeState(${JSON.stringify(state)})`)
    if (!this.botId) {
      throw new WAError(WA_ERROR_TYPE.ERR_INIT, 'No login bot id.')
    }

    switch (state) {
      case WAState.TIMEOUT:
        this.emit('logout', this.botId, LOGOUT_REASON.NETWORK_TIMEOUT_IN_PHONE)
        break
      case WAState.CONNECTED:
        this.emit('login', this.botId)
        break
      default:
        break
    }
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

  /**
   * Someone delete message in all devices. Due to they have the same message id so we generate a fake id as flash-store key.
   * see: https://github.com/pedroslopez/whatsapp-web.js/issues/1178
   * @param message revoke message
   * @param revokedMsg original message, sometimes it will be null
   */
  private async onMessageRevokeEveryone (message: Message, revokedMsg?: Message | null | undefined) {
    logger.silly(`onMessageRevokeEveryone(newMsg: ${JSON.stringify(message)}, originalMsg: ${JSON.stringify(revokedMsg)})`)
    const cacheManager = await this.getCacheManager()
    const messageId = message.id.id
    if (revokedMsg) {
      const originalMessageId = revokedMsg.id.id
      const recalledMessageId = this.generateFakeRecallMessageId(originalMessageId)
      message.body = recalledMessageId
      await cacheManager.setMessageRawPayload(recalledMessageId, revokedMsg)
    }
    await cacheManager.setMessageRawPayload(messageId, message)
    this.emit('message', { messageId })
  }

  /**
   * Only delete message in bot phone will trigger this event. But the message type is chat, not revoked any more.
   */
  private async onMessageRevokeMe (message: Message) {
    logger.silly(`onMessageRevokeMe(${JSON.stringify(message)})`)
    const cacheManager = await this.getCacheManager()
    const messageId = message.id.id
    message.type = WhatsAppMessageType.REVOKED
    message.body = messageId
    const recalledMessageId = this.generateFakeRecallMessageId(messageId)
    await cacheManager.setMessageRawPayload(recalledMessageId, message)
    this.emit('message', { messageId: recalledMessageId })
  }

  private generateFakeRecallMessageId (messageId: string) {
    return `${messageId}_revoked`
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
      logger.info(`initWhatsAppEvents: ${JSON.stringify(event)}, value: ${JSON.stringify(value)}`)
      if (event === 'disconnected') {
        switch (value) {
          case 'NAVIGATION':
            void this.onLogout(LOGOUT_REASON.DEFAULT)
            break
          case 'CONFLICT':
            void this.onLogout(LOGOUT_REASON.LOGIN_CONFLICT)
            break
          default:
            void this.onLogout(LOGOUT_REASON.DEFAULT)
            break
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

  public getWhatsApp () {
    if (!this.whatsapp) {
      throw new WAError(WA_ERROR_TYPE.ERR_INIT, 'Not init whatsapp')
    }
    return this.whatsapp
  }

}
