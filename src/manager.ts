/* eslint-disable no-case-declarations */
/* eslint-disable import/no-duplicates */
import { EventEmitter } from 'events'
import * as PUPPET from 'wechaty-puppet'
import {
  distinctUntilKeyChanged,
  fromEvent,
  map,
  merge,
} from 'rxjs'
import {
  LOGOUT_REASON,
  MEMORY_SLOT,
  MIN_BATTERY_VALUE_FOR_LOGOUT,
  PRE,
  DEFAULT_TIMEOUT,
  MessageMediaTypeList,
  MAX_HEARTBEAT_MISSED,
} from './config.js'
import { WA_ERROR_TYPE } from './exceptions/error-type.js'
import WAError from './exceptions/whatsapp-error.js'
import {
  MessageTypes as WhatsAppMessageType,
  GroupNotificationTypes,
  WAState,
  MessageAck,
} from './schema/whatsapp-interface.js'
import { withPrefix } from './logger/index.js'
import {
  batchProcess,
  getInviteCode,
  getMaxTimestampForLoadHistoryMessages,
  isContactId,
  isInviteLink,
  isRoomId,
  sleep,
} from './utils.js'
import { RequestManager } from './request/requestManager.js'
import { CacheManager } from './data-manager/cache-manager.js'
import { getWhatsApp } from './whatsapp.js'

import type { PuppetWhatsAppOptions } from './puppet-whatsapp.js'
import type {
  WhatsAppClientType,
  WhatsAppContact,
  WhatsAppMessage,
  InviteV4Data,
  MessageContent,
  MessageSendOptions,
  GroupNotification,
  ClientSession,
  GroupChat,
  BatteryInfo,
  WAStateType,
  PrivateChat,
  WhatsAppMessagePayload,
} from './schema/whatsapp-type.js'
import {
  genRoomAnnounce,
  genRoomJoinEvent,
  genRoomTopicEvent,
} from './pure-function-helpers/room-event-generator.js'
import ScheduleManager from './schedule/schedule-manager.js'
import { RequestPool } from './request/requestPool.js'

const logger = withPrefix(`${PRE} Manager`)

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

  whatsAppClient?: WhatsAppClientType
  requestManager?: RequestManager
  cacheManager?: CacheManager
  scheduleManager: ScheduleManager
  botId?: string
  fetchingMessages: boolean = false
  loadingData: boolean = false

  private pendingLogoutEmitTimer?: NodeJS.Timeout

  constructor (private options: PuppetWhatsAppOptions) {
    super()
    this.options = options
    this.scheduleManager = new ScheduleManager(this)
  }

  public override emit (event: 'message', payload: PUPPET.EventMessagePayload): boolean
  public override emit (event: 'room-join', payload: PUPPET.EventRoomJoinPayload): boolean
  public override emit (event: 'room-leave', payload: PUPPET.EventRoomLeavePayload): boolean
  public override emit (event: 'room-topic', payload: PUPPET.EventRoomTopicPayload): boolean
  public override emit (event: 'room-invite', payload: PUPPET.EventRoomInvitePayload): boolean
  public override emit (event: 'scan', status: PUPPET.ScanStatus, url?: string): boolean
  public override emit (event: 'login', userId: string): boolean
  public override emit (event: 'logout', userId: string, message: string): boolean
  public override emit (event: 'friendship', payload: PUPPET.EventFriendshipPayload): boolean
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
    this.whatsAppClient = await getWhatsApp(this.options['puppeteerOptions'], session)
    this.whatsAppClient
      .initialize()
      .then(() => logger.verbose('start() whatsapp.initialize() done.'))
      .catch(async e => {
        logger.error('start() whatsapp.initialize() rejection: %s', e)
        if (process.env['NODE_ENV'] !== 'test') {
          await sleep(2 * 1000)
          await this.start(session)
        }
      })

    this.requestManager = new RequestManager(this.whatsAppClient)
    await this.initWhatsAppEvents(this.whatsAppClient)

    this.startHeartbeat()
    return this.whatsAppClient
  }

  public async stop () {
    logger.info('stop()')
    if (this.whatsAppClient) {
      await this.whatsAppClient.stop()
      this.whatsAppClient = undefined
    }
    await this.releaseCache()
    this.requestManager = undefined
    this.resetAllVarInMemory()

    this.stopHeartbeat()
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
    logger.info('onWhatsAppReady()')
    const contactOrRoomList = await this.syncContactOrRoomList()
    await this.onLogin(contactOrRoomList)
    await this.onReady(contactOrRoomList)
    this.scheduleManager.startSyncMissedMessagesSchedule()
  }

  public async syncContactOrRoomList () {
    const whatsapp = this.getWhatsApp()
    const contactList: WhatsAppContact[] = await whatsapp.getContacts()
    const contactOrRoomList = contactList.filter(c => c.id.server !== 'broadcast' && c.id._serialized !== '0@c.us')
    return contactOrRoomList
  }

  private async onLogin (contactOrRoomList: WhatsAppContact[]) {
    const whatsapp = this.getWhatsApp()
    try {
      this.botId = whatsapp.info.wid._serialized
    } catch (error) {
      throw WAError(WA_ERROR_TYPE.ERR_INIT, 'No login bot id.')
    }
    logger.info(`WhatsApp Client Info: ${JSON.stringify(whatsapp.info)}`)

    await this.initCache(this.botId)
    const cacheManager = await this.getCacheManager()

    const botSelf = await this.getContactById(this.botId)
    await cacheManager.setContactOrRoomRawPayload(this.botId, {
      ...botSelf,
      avatar: await this.getAvatarUrl(this.botId),
    })

    const batchSize = 500
    await batchProcess(batchSize, contactOrRoomList, async (contactOrRoom: WhatsAppContact) => {
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

  private async onReady (contactOrRoomList: WhatsAppContact[]) {
    logger.info('onReady()')
    if (this.loadingData) {
      return
    }
    this.loadingData = true
    let friendCount = 0
    let contactCount = 0
    let roomCount = 0

    const cacheManager = await this.getCacheManager()
    const batchSize = 100
    await batchProcess(batchSize, contactOrRoomList, async (contactOrRoom: WhatsAppContact) => {
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
        const memberList = await this.syncRoomMemberList(contactOrRoomId)
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
      await this.fetchMessages(contactOrRoom)
    })

    logger.info(`onReady() all contacts and rooms are ready, friendCount: ${friendCount} contactCount: ${contactCount} roomCount: ${roomCount}`)
    this.emit('ready')
    this.loadingData = false
  }

  /**
   * Fetch all messages of contact or room, and then call onMessage method to emit them or not.
   * @param {WhatsAppContact} contactOrRoom contact or room instance
   */
  public async fetchMessages (contactOrRoom: WhatsAppContact) {
    if (this.fetchingMessages) {
      return
    }
    this.fetchingMessages = true
    if (contactOrRoom.isMe) {
      // can not get chat for bot self
      return
    }
    const contactOrRoomId = contactOrRoom.id._serialized
    const cacheManager = await this.getCacheManager()
    try {
      const chat = await contactOrRoom.getChat()
      let messageList = await chat.fetchMessages({})

      const maxTimestampForLoadHistoryMessages = getMaxTimestampForLoadHistoryMessages()
      const latestTimestampInCache = await cacheManager.getLatestMessageTimestampForChat(contactOrRoomId)
      const minTimestamp = Math.min(latestTimestampInCache, maxTimestampForLoadHistoryMessages)
      messageList = messageList.filter(m => m.timestamp >= minTimestamp)

      const latestMessageTimestamp = messageList[messageList.length - 1]?.timestamp
      if (latestMessageTimestamp) {
        await cacheManager.setLatestMessageTimestampForChat(contactOrRoomId, latestMessageTimestamp)
      }
      const batchSize = 50
      await batchProcess(batchSize, messageList, async (message: WhatsAppMessage) => {
        if (message.ack === MessageAck.ACK_DEVICE || message.ack === MessageAck.ACK_READ) {
          await this.onMessage(message)
        }
      })
    } catch (error) {
      logger.error(`fetchMessages error: ${(error as Error).message}`)
    }
    this.fetchingMessages = false
  }

  private async onLogout (reason: string = LOGOUT_REASON.DEFAULT) {
    logger.info(`onLogout(${reason})`)
    this.resetAllVarInMemory()
    await this.options.memory?.delete(MEMORY_SLOT)
    await this.options.memory?.save()
    this.scheduleManager.stopSyncMissedMessagesSchedule()
    this.clearPendingLogoutEmitTimer()
    this.emit('logout', this.getBotId(), reason as string)
  }

  private async onMessage (message: WhatsAppMessage | WhatsAppMessagePayload) {
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
    if (contactId && isContactId(contactId)) {
      const contactIds = await cacheManager.getContactIdList()
      const notFriend = !contactIds.find(c => c === contactId)
      if (notFriend) {
        this.emit('friendship', { friendshipId: messageId })
      }
    }

    const needEmitMessage = await this.convertInviteLinkMessageToEvent(message)
    if (needEmitMessage) {
      this.emit('message', { messageId })
    }
  }

  /**
   * This event only for the message which sent by bot (web / phone)
   * @param {WhatsAppMessage} message message detail info
   * @returns
   */
  private async onMessageAck (message: WhatsAppMessage) {
    logger.silly(`onMessageAck(${JSON.stringify(message)})`)

    /**
     * if message ack equal MessageAck.ACK_DEVICE, we could regard it as has already send success.
     *
     * FIXME: if the ack is not consecutive, and without MessageAck.ACK_DEVICE, then we could not receive this message.
     *
     * After add sync missed message schedule, if the ack of message has not reach MessageAck.ACK_DEVICE,
     * the schedule will emit these messages with wrong ack (ack = MessageAck.ACK_PENDING or MessageAck.ACK_SERVER),
     * and will make some mistakes (can not get the media of message).
     */
    if (message.id.fromMe) {
      if (MessageMediaTypeList.includes(message.type)) {
        if (message.hasMedia && message.ack === MessageAck.ACK_SERVER) {
          await this.processMessageFromBot(message)
        }
        if (message.ack === MessageAck.ACK_DEVICE || message.ack === MessageAck.ACK_READ) {
          await this.processMessageFromBot(message)
        }
      } else {
        await this.processMessageFromBot(message)
      }
    }
  }

  private async processMessageFromBot (message: WhatsAppMessage) {
    const messageId = message.id.id
    const cacheManager = await this.getCacheManager()
    const messageInCache = await cacheManager.getMessageRawPayload(messageId)
    await cacheManager.setMessageRawPayload(messageId, message) // set message with different message ack
    /**
     * - Non-Media Message
     *   emit only when no cache
     *
     * - Media Message
     *   emit message when no cache or ack of message in cache equal 1
     */
    if (!messageInCache || (MessageMediaTypeList.includes(message.type) && messageInCache.ack === MessageAck.ACK_SERVER)) {
      const requestPool = RequestPool.Instance
      requestPool.resolveRequest(messageId)
      this.emit('message', { messageId })
    }
  }

  /**
   * This event only for the message which sent by bot (web / phone) and to the bot self
   * @param {WhatsAppMessage} message message detail info
   * @returns
   */
  private async onMessageCreate (message: WhatsAppMessage) {
    logger.silly(`onMessageCreate(${JSON.stringify(message)})`)
    if (message.id.fromMe && message.to === this.getBotId()) {
      const messageId = message.id.id
      const cacheManager = await this.getCacheManager()
      await cacheManager.setMessageRawPayload(messageId, message)
      this.emit('message', { messageId })
    }
  }

  private async convertInviteLinkMessageToEvent (message: WhatsAppMessage | WhatsAppMessagePayload): Promise<boolean> {
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
    const roomId = notification.id.remote
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
    const { id, recipientIds } = notification
    const roomId = id.remote
    const isLeaveSelf = id.fromMe && recipientIds.length === 1 &&  recipientIds[0] === this.getBotId()
    const roomLeavePayload: PUPPET.EventRoomLeavePayload = {
      removeeIdList: notification.recipientIds,
      removerId: notification.author || isLeaveSelf ? this.getBotId() : '',
      roomId,
      timestamp: notification.timestamp,
    }
    const cacheManager = await this.getCacheManager()
    await cacheManager.removeRoomMemberFromList(roomId, notification.recipientIds)
    this.emit('room-leave', roomLeavePayload)
  }

  private async onRoomUpdate (notification: GroupNotification) {
    logger.info(`onRoomUpdate(${JSON.stringify(notification)})`)
    const roomId = notification.id.remote
    const cacheManager = await this.getCacheManager()
    let roomPayload = await cacheManager.getContactOrRoomRawPayload(roomId)

    if (!roomPayload) {
      const rawRoom = await this.getContactById(roomId)
      const avatar = await rawRoom.getProfilePicUrl()
      roomPayload = Object.assign(rawRoom, { avatar })
      await cacheManager.setContactOrRoomRawPayload(roomId, roomPayload)
    }
    const type = notification.type
    switch (type) {
      case GroupNotificationTypes.SUBJECT:
        const roomTopicPayload = genRoomTopicEvent(notification, roomPayload)
        roomPayload.name = notification.body
        await cacheManager.setContactOrRoomRawPayload(roomId, roomPayload)
        this.emit('room-topic', roomTopicPayload)
        break
      case GroupNotificationTypes.DESCRIPTION:
        const roomChat = await this.getRoomChatById(roomId)
        const roomMetadata = roomChat.groupMetadata
        const description = roomMetadata.desc
        const msgPayload = genRoomAnnounce(notification, description)
        await this.onMessage(msgPayload)
        break
      case GroupNotificationTypes.CREATE:
        const members = await this.syncRoomMemberList(roomId)
        const roomJoinPayload = genRoomJoinEvent(notification, members)
        this.emit('room-join', roomJoinPayload)
        break
      case GroupNotificationTypes.PICTURE:
        const rawRoom = await this.getContactById(roomId)
        const avatar = await rawRoom.getProfilePicUrl() || ''
        const roomPayloadInCache = await cacheManager.getContactOrRoomRawPayload(roomId)
        if (roomPayloadInCache) {
          roomPayloadInCache.avatar = avatar
          await cacheManager.setContactOrRoomRawPayload(roomId, roomPayloadInCache)
        }
        break
    }
  }

  /**
   * unsupported events
   * leave logs to for further dev
  */
  private async onChangeBattery (batteryInfo: BatteryInfo) {
    logger.silly(`onChangeBattery(${JSON.stringify(batteryInfo)})`)
    if (!this.botId) {
      throw WAError(WA_ERROR_TYPE.ERR_INIT, 'No login bot id.')
    }

    if (batteryInfo.battery <= MIN_BATTERY_VALUE_FOR_LOGOUT && !batteryInfo.plugged) {
      this.emit('logout', this.botId, LOGOUT_REASON.BATTERY_LOWER_IN_PHONE)
    }
  }

  private async onChangeState (state: WAStateType) {
    logger.info(`onChangeState(${JSON.stringify(state)})`)
    if (!this.botId) {
      throw WAError(WA_ERROR_TYPE.ERR_INIT, 'No login bot id.')
    }

    switch (state) {
      case WAState.TIMEOUT:
        this.pendingLogoutEmitTimer = setTimeout(() => {
          this.emit('logout', this.getBotId(), LOGOUT_REASON.NETWORK_TIMEOUT_IN_PHONE)
          this.pendingLogoutEmitTimer = undefined
        }, DEFAULT_TIMEOUT.TIMEOUT_WAIT_CONNECTED)
        break
      case WAState.CONNECTED:
        this.clearPendingLogoutEmitTimer()
        this.emit('login', this.botId)
        const contactOrRoomList = await this.syncContactOrRoomList()
        await this.onReady(contactOrRoomList)
        break
      default:
        break
    }
  }

  private async onIncomingCall (...args: any[]) { // it is a any[] argument
    logger.silly(`onIncomingCall(${JSON.stringify(args)})`)
  }

  private async onMediaUploaded (message: WhatsAppMessage) {
    logger.silly(`onMediaUploaded(${JSON.stringify(message)})`)
    await this.createOrUpdateImageMessage(message)
    if (!message.hasMedia) {
      logger.warn(`onMediaUploaded failed, message id: ${message.id.id}, type: ${message.type}, detail info: ${JSON.stringify(message)}`)
    }
  }

  private async createOrUpdateImageMessage (message: WhatsAppMessage) {
    if (message.type === WhatsAppMessageType.IMAGE) {
      const messageId = message.id.id
      const cacheManager = await this.getCacheManager()
      const messageInCache = await cacheManager.getMessageRawPayload(messageId)
      if (messageInCache) {
        message.body = messageInCache.body || message.body
        await cacheManager.setMessageRawPayload(messageId, message)
        return
      }
      await cacheManager.setMessageRawPayload(messageId, message)
    }
  }

  /**
   * Someone delete message in all devices. Due to they have the same message id so we generate a fake id as flash-store key.
   * see: https://github.com/pedroslopez/whatsapp-web.js/issues/1178
   * @param message revoke message
   * @param revokedMsg original message, sometimes it will be null
   */
  private async onMessageRevokeEveryone (message: WhatsAppMessage, revokedMsg?: WhatsAppMessage | null | undefined) {
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
  private async onMessageRevokeMe (message: WhatsAppMessage) {
    logger.silly(`onMessageRevokeMe(${JSON.stringify(message)})`)
    /*
    if (message.ack === MessageAck.ACK_PENDING) {
      // when the bot logout, it will receive onMessageRevokeMe event, but it's ack is MessageAck.ACK_PENDING, so let's ignore this event.
      return
    }
    const cacheManager = await this.getCacheManager()
    const messageId = message.id.id
    message.type = WhatsAppMessageType.REVOKED
    message.body = messageId
    const recalledMessageId = this.generateFakeRecallMessageId(messageId)
    await cacheManager.setMessageRawPayload(recalledMessageId, message)
    this.emit('message', { messageId: recalledMessageId })
    */
  }

  private generateFakeRecallMessageId (messageId: string) {
    return `${messageId}_revoked`
  }

  public async initWhatsAppEvents (
    whatsapp: WhatsAppClientType,
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
      throw WAError(WA_ERROR_TYPE.ERR_INIT, 'no cache manager')
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
      throw WAError(WA_ERROR_TYPE.ERR_INIT, 'No request manager')
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

  public createRoom (name: string, participants: WhatsAppContact[] | string[]) {
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

  public async getRoomChatById (roomId: string) {
    if (isRoomId(roomId)) {
      const roomChat = await this.getChatById(roomId)
      return roomChat as GroupChat
    } else {
      throw WAError(WA_ERROR_TYPE.ERR_GROUP_OR_CONTACT_ID, `The roomId: ${roomId} is not right.`)
    }
  }

  public async getContactChatById (contactId: string) {
    if (isContactId(contactId)) {
      const roomChat = await this.getChatById(contactId)
      return roomChat as PrivateChat
    } else {
      throw WAError(WA_ERROR_TYPE.ERR_GROUP_OR_CONTACT_ID, `The contactId: ${contactId} is not right.`)
    }
  }

  private async getChatById (chatId: string) {
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
    if (!this.whatsAppClient) {
      throw WAError(WA_ERROR_TYPE.ERR_INIT, 'Not init whatsapp')
    }
    return this.whatsAppClient
  }

  public getBotId () {
    if (!this.botId) {
      throw WAError(WA_ERROR_TYPE.ERR_INIT, 'this bot is not login')
    }
    return this.botId
  }

  /**
   * Get member id list from web api
   * @param { PuppetWhatsApp } this whatsapp client
   * @param { string } roomId roomId
   * @returns { string[] } member id list
   */
  public async syncRoomMemberList (roomId: string): Promise<string[]> {
    const roomChat = await this.getRoomChatById(roomId)
    // FIXME: How to deal with pendingParticipants? Maybe we should find which case could has this attribute.
    return roomChat.participants.map(m => m.id._serialized)
  }

  private clearPendingLogoutEmitTimer () {
    if (this.pendingLogoutEmitTimer) {
      clearTimeout(this.pendingLogoutEmitTimer)
      this.pendingLogoutEmitTimer = undefined
    }
  }

  private resetAllVarInMemory () {
    this.botId = undefined
    this.loadingData = false
    this.fetchingMessages = false
  }

  private heartbeatTimer?: NodeJS.Timer

  private startHeartbeat () {
    if (!this.heartbeatTimer) {
      this.asystoleCount = 0
      this.heartbeatTimer = setInterval(this.heartbeat.bind(this), 15 * 1000)
    }
  }

  private stopHeartbeat () {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer)
      this.heartbeatTimer = undefined
    }
  }

  private asystoleCount = 0
  private async heartbeat () {
    const alive = this.getWhatsApp().pupBrowser?.isConnected()
    if (alive) {
      this.asystoleCount = 0
      this.emit('heartbeat', 'puppeteer still connected')
    } else {
      this.asystoleCount += 1
      if (this.asystoleCount > MAX_HEARTBEAT_MISSED) {
        await this.stop()
        await this.start()
        this.asystoleCount = 0
      }
    }
  }

}
