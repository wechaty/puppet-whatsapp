/* eslint-disable no-case-declarations */
/* eslint-disable import/no-duplicates */
import { EventEmitter as EE } from 'ee-ts'
import {
  PRE,
  MAX_HEARTBEAT_MISSED,
} from './config.js'
import { WA_ERROR_TYPE } from './exceptions/error-type.js'
import WAError from './exceptions/whatsapp-error.js'
import {
  MessageAck,
} from './schema/whatsapp-interface.js'
import { withPrefix } from './logger/index.js'
import {
  batchProcess,
  getMaxTimestampForLoadHistoryMessages,
  isContactId,
  isRoomId,
  sleep,
} from './utils.js'
import { RequestManager } from './request/requestManager.js'
import { CacheManager } from './data-manager/cache-manager.js'
import { getWhatsApp } from './whatsapp/whatsapp.js'

import type { PuppetWhatsAppOptions } from './puppet-whatsapp.js'
import type {
  WhatsAppClientType,
  WhatsAppContact,
  WhatsAppMessage,
  InviteV4Data,
  MessageContent,
  MessageSendOptions,
  ClientSession,
  GroupChat,
  PrivateChat,
} from './schema/whatsapp-type.js'
import ScheduleManager from './schedule/schedule-manager.js'
import type { ManagerEvents } from './manager-event.js'
import WhatsAppEvent from './whatsapp/whatsapp-events.js'

const logger = withPrefix(`${PRE} Manager`)
export class Manager extends EE<ManagerEvents> {

  whatsAppClient?: WhatsAppClientType
  whatsAppEvent: WhatsAppEvent
  requestManager?: RequestManager
  cacheManager?: CacheManager
  scheduleManager: ScheduleManager
  botId?: string
  fetchingMessages: boolean = false
  loadingData: boolean = false

  constructor (private options: PuppetWhatsAppOptions) {
    super()
    this.scheduleManager = new ScheduleManager(this)
    this.whatsAppEvent = new WhatsAppEvent(this)
  }

  public getOptions () {
    return this.options
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
    await this.whatsAppEvent.initWhatsAppEvents(this.whatsAppClient)

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

  public async syncContactOrRoomList () {
    const whatsapp = this.getWhatsApp()
    const contactList: WhatsAppContact[] = await whatsapp.getContacts()
    const contactOrRoomList = contactList.filter(c => c.id.server !== 'broadcast' && c.id._serialized !== '0@c.us')
    return contactOrRoomList
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
          await this.whatsAppEvent.onMessage(message)
        }
      })
    } catch (error) {
      logger.error(`fetchMessages error: ${(error as Error).message}`)
    }
    this.fetchingMessages = false
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

    /**
     * puppteer.isConnected behaviour: (in MacOs)
     * it will still return true if the Chromium window is closed with command + w
     * it will not return true if the Chromium process is terminated with command + q
     */

    const alive = this.getWhatsApp().pupBrowser?.isConnected()
    if (alive) {
      this.asystoleCount = 0
      this.emit('heartbeat', 'puppeteer still connected')
    } else {
      this.asystoleCount += 1
      logger.warn(`asystole count: ${this.asystoleCount}`)
      if (this.asystoleCount > MAX_HEARTBEAT_MISSED) {
        logger.error('max asystole reached, restarting...')
        await this.stop()
        await this.start()
        this.asystoleCount = 0
      }
    }
  }

  public startSchedule () {
    this.scheduleManager.startSyncMissedMessagesSchedule()
  }

  public stopSchedule () {
    this.scheduleManager.stopSyncMissedMessagesSchedule()
  }

}
