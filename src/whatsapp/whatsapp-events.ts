/* eslint-disable no-case-declarations */
/* eslint-disable import/no-duplicates */
import { EventEmitter as EE } from 'ee-ts'
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
  DEFAULT_TIMEOUT,
  MessageMediaTypeList,
  PRE,
} from '../config.js'
import { WA_ERROR_TYPE } from '../exceptions/error-type.js'
import WAError from '../exceptions/whatsapp-error.js'
import {
  MessageTypes as WhatsAppMessageType,
  GroupNotificationTypes,
  WAState,
  MessageAck,
} from '../schema/whatsapp-interface.js'
import {
  batchProcess,
  getInviteCode,
  isContactId,
  isInviteLink,
  isRoomId,
} from '../utils.js'

import type {
  WhatsAppClientType,
  WhatsAppContact,
  WhatsAppMessage,
  GroupNotification,
  ClientSession,
  BatteryInfo,
  WAStateType,
  WhatsAppMessagePayload,
} from '../schema/whatsapp-type.js'
import {
  genRoomAnnounce,
  genRoomJoinEvent,
  genRoomTopicEvent,
} from '../pure-function-helpers/room-event-generator.js'
import { RequestPool } from '../request/requestPool.js'
import type { ManagerEvents } from '../manager-event.js'
import type { Manager } from '../manager.js'
import { withPrefix } from '../logger/index.js'

const logger = withPrefix(`${PRE} WhatsAppEvent`)

export default class WhatsAppEvent extends EE<ManagerEvents> {

  private botId?: string
  private loadingData: boolean = false

  private pendingLogoutEmitTimer?: NodeJS.Timeout

  constructor (private manager: Manager) {
    super()
  }

  public async initWhatsAppEvents (
    whatsapp: WhatsAppClientType,
  ): Promise<void> {
    logger.verbose('initWhatsAppEvents()')

    whatsapp.on('qr', this.onQRCode.bind(this))
    whatsapp.on('authenticated', this.onAuthenticated.bind(this))
    /**
     * There is only one situation that will cause this event, invalid session causing timeout
     * https://github.com/pedroslopez/whatsapp-web.js/blob/d86c39de3ca5699a50db98ee93e264ab8c4f25a3/src/Client.js#L116-L129
     */
    whatsapp.on('auth_failure', this.onAuthFailure.bind(this))
    whatsapp.on('ready', this.onWhatsAppReady.bind(this))
    whatsapp.on('change_state', this.onChangeState.bind(this))
    whatsapp.on('change_battery', this.onChangeBattery.bind(this))

    whatsapp.on('message', this.onMessage.bind(this))
    whatsapp.on('message_ack', this.onMessageAck.bind(this))
    whatsapp.on('message_create', this.onMessageCreate.bind(this))
    whatsapp.on('message_revoke_everyone', this.onMessageRevokeEveryone.bind(this))
    whatsapp.on('message_revoke_me', this.onMessageRevokeMe.bind(this))
    whatsapp.on('media_uploaded', this.onMediaUploaded.bind(this))
    whatsapp.on('incoming_call', this.onIncomingCall.bind(this))

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

  /**
   * ================================
   * QRCODE, LOGIN AND LOGOUT SECTION
   * ================================
   */

  private onQRCode (qr: string) {
    logger.info(`onQRCode(${qr})`)
    // NOTE: This event will not be fired if a session is specified.
    this.emit('scan', PUPPET.ScanStatus.Waiting, qr)
  }

  private async onAuthenticated (session: ClientSession) {
    logger.info(`onAuthenticated(${JSON.stringify(session)})`)
    await this.setSession(session)
  }

  private async onAuthFailure (message: string) {
    logger.warn('auth_failure: %s', message)
    // avoid reuse invalid session data
    await this.clearSession()
  }

  private async onWhatsAppReady () {
    logger.info('onWhatsAppReady()')
    const contactOrRoomList = await this.manager.syncContactOrRoomList()
    await this.onLogin(contactOrRoomList)
    await this.onReady(contactOrRoomList)
    this.manager.startSchedule()
  }

  private async onLogin (contactOrRoomList: WhatsAppContact[]) {
    logger.info('onLogin()')
    const whatsapp = this.manager.getWhatsApp()
    try {
      this.botId = whatsapp.info.wid._serialized
    } catch (error) {
      throw WAError(WA_ERROR_TYPE.ERR_INIT, `Can not get bot id from WhatsApp client, current state: ${await whatsapp.getState()}`, JSON.stringify(error))
    }
    logger.info(`WhatsApp Client Info: ${JSON.stringify(whatsapp.info)}`)

    await this.manager.initCache(this.botId)
    const cacheManager = await this.manager.getCacheManager()

    const botSelf = await this.manager.requestManger.getContactById(this.botId)
    await cacheManager.setContactOrRoomRawPayload(this.botId, {
      ...botSelf,
      avatar: await this.manager.requestManger.getAvatarUrl(this.botId),
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
      logger.info('onReady() loading data are under process.')
      return
    }
    this.loadingData = true
    let friendCount = 0
    let contactCount = 0
    let roomCount = 0

    const cacheManager = await this.manager.getCacheManager()
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
        const memberList = await this.manager.syncRoomMemberList(contactOrRoomId)
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
      await this.manager.fetchMessages(contactOrRoom)
    })

    logger.info(`onReady() all contacts and rooms are ready, friendCount: ${friendCount} contactCount: ${contactCount} roomCount: ${roomCount}`)
    this.emit('ready')
    this.loadingData = false
  }

  private async onLogout (reason: string = LOGOUT_REASON.DEFAULT) {
    logger.info(`onLogout(${reason})`)
    await this.clearSession()
    this.manager.stopSchedule()
    this.clearPendingLogoutEmitTimer()
    this.emit('logout', this.getBotId(), reason as string)
    this.resetAllVarInMemory()
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
        const contactOrRoomList = await this.manager.syncContactOrRoomList()
        await this.onReady(contactOrRoomList)
        break
      default:
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

  /**
   * ================================
   * MESSAGE SECTION
   * ================================
   */

  public async onMessage (message: WhatsAppMessage | WhatsAppMessagePayload) {
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
    const cacheManager = await this.manager.getCacheManager()
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

  /**
   * This event only for the message which sent by bot (web / phone) and to the bot self
   * @param {WhatsAppMessage} message message detail info
   * @returns
   */
  private async onMessageCreate (message: WhatsAppMessage) {
    logger.silly(`onMessageCreate(${JSON.stringify(message)})`)
    if (message.id.fromMe && message.to === this.getBotId()) {
      const messageId = message.id.id
      const cacheManager = await this.manager.getCacheManager()
      await cacheManager.setMessageRawPayload(messageId, message)
      this.emit('message', { messageId })
    }
  }

  private async processMessageFromBot (message: WhatsAppMessage) {
    const messageId = message.id.id
    const cacheManager = await this.manager.getCacheManager()
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

  private async convertInviteLinkMessageToEvent (message: WhatsAppMessage | WhatsAppMessagePayload): Promise<boolean> {
    const cacheManager = await this.manager.getCacheManager()
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
      const cacheManager = await this.manager.getCacheManager()
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
    const cacheManager = await this.manager.getCacheManager()
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
    const cacheManager = await this.manager.getCacheManager()
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

  /**
   * ================================
   * ROOM SECTION
   * ================================
   */

  private async onRoomJoin (notification: GroupNotification) {
    logger.info(`onRoomJoin(${JSON.stringify(notification)})`)
    const roomId = notification.id.remote
    const roomJoinPayload: PUPPET.EventRoomJoinPayload = {
      inviteeIdList: notification.recipientIds,
      inviterId: notification.author,
      roomId,
      timestamp: notification.timestamp,
    }
    const cacheManager = await this.manager.getCacheManager()
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
    const cacheManager = await this.manager.getCacheManager()
    await cacheManager.removeRoomMemberFromList(roomId, notification.recipientIds)
    this.emit('room-leave', roomLeavePayload)
  }

  private async onRoomUpdate (notification: GroupNotification) {
    logger.info(`onRoomUpdate(${JSON.stringify(notification)})`)
    const roomId = notification.id.remote
    const cacheManager = await this.manager.getCacheManager()
    let roomPayload = await cacheManager.getContactOrRoomRawPayload(roomId)

    if (!roomPayload) {
      const rawRoom = await this.manager.requestManger.getContactById(roomId)
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
        const roomChat = await this.manager.getRoomChatById(roomId)
        const roomMetadata = roomChat.groupMetadata
        const description = roomMetadata.desc
        const msgPayload = genRoomAnnounce(notification, description)
        await this.onMessage(msgPayload)
        break
      case GroupNotificationTypes.CREATE:
        const members = await this.manager.syncRoomMemberList(roomId)
        const roomJoinPayload = genRoomJoinEvent(notification, members)
        this.emit('room-join', roomJoinPayload)
        break
      case GroupNotificationTypes.PICTURE:
        const rawRoom = await this.manager.requestManger.getContactById(roomId)
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
   * ================================
   * OTHER SECTION
   * ================================
   */

  public getBotId () {
    if (!this.botId) {
      throw WAError(WA_ERROR_TYPE.ERR_INIT, 'This bot is not login')
    }
    return this.botId
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
  }

  /**
   * MemoryCard Session Section
   */

  private async setSession (session: ClientSession) {
    const memoryCard = this.manager.getOptions().memory
    if (memoryCard) {
      await memoryCard.set(MEMORY_SLOT, session)
      await memoryCard.save()
    }
  }

  private async clearSession () {
    const memoryCard = this.manager.getOptions().memory
    if (memoryCard) {
      await memoryCard.delete(MEMORY_SLOT)
      await memoryCard.save()
    }
  }

}
