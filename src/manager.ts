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
import type {  ClientOptions, Contact, InviteV4Data, Message, MessageContent, MessageSendOptions, GroupNotification, ClientSession } from './schema/index.js'
import { Client as WhatsApp, MessageType, GroupNotificationType } from './schema/index.js'
import { logger } from './logger/index.js'
import { saveSession } from './session-file.js'

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

  options: PuppetWhatsAppOptions
  whatsapp?: WhatsApp
  requestManager?: RequestManager
  cacheManager?: CacheManager

  constructor (options: PuppetWhatsAppOptions) {
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

  public async start (session: any) {
    logger.info('start()')
    this.whatsapp = await getWhatsApp(this.options['puppeteerOptions'] as ClientOptions, session)
    this.whatsapp
      .initialize()
      .then(() => logger.verbose('start() whatsapp.initialize() done'))
      .catch(e => {
        logger.error('start() whatsapp.initialize() rejection: %s', e)
      })

    this.requestManager = new RequestManager(this.whatsapp)
    await this.initWhatsAppEvents(this.whatsapp)
    return this.whatsapp
  }

  public async stop () {
    logger.info('stop()')
    if (this.whatsapp) {
      await this.whatsapp.destroy()
      await this.releaseCache()
      this.whatsapp = undefined
    }
  }

  private async onAuthenticated (session: ClientSession) {
    logger.info(`onAuthenticated(${JSON.stringify(session)})`)
    await saveSession(session)
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
    // session tmp add
    await this.start(null) // FIXME: need to restart
  }

  private async onReady () {
    await this.initCache(this.whatsapp!.info.wid._serialized)
    logger.info('onReady()')
    const contacts: Contact[] = await this.whatsapp!.getContacts()
    const nonBroadcast = contacts.filter(c => c.id.server !== 'broadcast')
    const cacheManager = await this.getCacheManager()
    const limit = pLimit(100)
    const all = nonBroadcast.map((contact) => {
      return limit(async () => {
        const avatar = await contact.getProfilePicUrl()
        const contactWithAvatar = Object.assign(contact, { avatar })
        await cacheManager.setContactOrRoomRawPayload(contact.id._serialized, contactWithAvatar)
      })
    })
    await Promise.all(all)
    this.emit('login', this.whatsapp!.info.wid._serialized)
  }

  private async onMessage (msg: Message) {
    logger.info(`onMessage(${msg.id.id})`)
    // @ts-ignore
    if (msg.type === 'e2e_notification') {
      if (msg.body === '' && msg.author === undefined) {
        // match group join message pattern
        return
      }
    }
    const id = msg.id.id
    const cacheManager = await this.getCacheManager()
    await cacheManager.setMessageRawPayload(id, msg)
    if (msg.type !== MessageType.GROUP_INVITE) {
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
    if (notification.type === GroupNotificationType.SUBJECT) {
      const cacheManager = await this.getCacheManager()
      const roomInCache = await cacheManager.getContactOrRoomRawPayload(notification.chatId)
      const roomJoinPayload: PUPPET.EventRoomTopicPayload = {
        changerId: notification.author,
        newTopic: notification.body,
        oldTopic: roomInCache?.name || '',
        roomId: notification.chatId,
        timestamp: notification.timestamp,
      }
      this.emit('room-topic', roomJoinPayload)
    }
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

    whatsapp.on('ready', this.onReady.bind(this))

    whatsapp.on('message', this.onMessage.bind(this))

    whatsapp.on('qr', this.onQRCode.bind(this))

    whatsapp.on('group_join', this.onRoomJoin.bind(this))

    whatsapp.on('group_leave', this.onRoomLeave.bind(this))

    whatsapp.on('group_update', this.onRoomUpdate.bind(this))

    const events = [
      'authenticated',
      'ready',
      'disconnected',
    ]
    const eventStreams = events.map((event) => fromEvent(whatsapp, event).pipe(map((value: any) => ({ event, value }))))
    const allEvents$ = merge(...eventStreams)
    allEvents$.pipe(distinctUntilKeyChanged('event')).subscribe(({ event, value }: { event: string, value: any }) => {
      if (event === 'disconnected' && value as string === 'NAVIGATION') {
        this.emit('logout', this.whatsapp!.info.wid._serialized, value as string)
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

}
