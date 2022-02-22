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
import ScheduleManager from './schedule/schedule-manager.js'
import WhatsAppManager from './whatsapp/whatsapp-manager.js'

import type { PuppetWhatsAppOptions } from './puppet-whatsapp.js'
import type {
  WhatsAppContact,
  WhatsAppMessage,
  ClientSession,
  GroupChat,
  PrivateChat,
} from './schema/whatsapp-type.js'
import type { ManagerEvents } from './manager-event.js'

const logger = withPrefix(`${PRE} Manager`)
export class Manager extends EE<ManagerEvents> {

  whatsAppManager: WhatsAppManager
  _requestManager?: RequestManager
  cacheManager?: CacheManager
  scheduleManager: ScheduleManager

  private fetchingMessages: boolean = false
  private heartbeatTimer?: NodeJS.Timer

  constructor (private options: PuppetWhatsAppOptions) {
    super()
    this.scheduleManager = new ScheduleManager(this)
    this.whatsAppManager = new WhatsAppManager(this)
  }

  public getOptions () {
    return this.options
  }

  public get (target: Manager, prop: keyof Manager & keyof RequestManager) {
    return Object.prototype.hasOwnProperty.call(target, prop) ? target[prop] : target.requestManager[prop]
  }

  public async start (session?: ClientSession) {
    logger.info('start()')
    const whatsAppClient = await this.whatsAppManager.initWhatsAppClient(this.options['puppeteerOptions'], session)
    whatsAppClient
      .initialize()
      .then(() => logger.verbose('start() whatsapp.initialize() done.'))
      .catch(async e => {
        logger.error('start() whatsapp.initialize() rejection: %s', e)
        if (process.env['NODE_ENV'] !== 'test') {
          await sleep(2 * 1000)
          await this.start(session)
        }
      })

    this._requestManager = new RequestManager(whatsAppClient)
    await this.whatsAppManager.initWhatsAppEvents(whatsAppClient)

    this.startHeartbeat()
    return whatsAppClient
  }

  public async stop () {
    logger.info('stop()')
    await this.getWhatsAppClient().stop()
    await this.releaseCache()
    this._requestManager = undefined
    this.whatsAppManager.clearWhatsAppRelatedData()

    this.stopHeartbeat()
  }

  public async syncContactOrRoomList () {
    const whatsapp = this.getWhatsAppClient()
    const contactList: WhatsAppContact[] = await whatsapp.getContacts()
    const contactOrRoomList = contactList.filter(c => c.id.server !== 'broadcast' && c.id._serialized !== '0@c.us')
    return contactOrRoomList
  }

  public get requestManager () {
    if (!this._requestManager) {
      throw WAError(WA_ERROR_TYPE.ERR_INIT, 'No request manager')
    }
    return this._requestManager
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
          await this.processMessage(message)
        }
      })
    } catch (error) {
      logger.error(`fetchMessages error: ${(error as Error).message}`)
    }
    this.fetchingMessages = false
  }

  public async processMessage (message: WhatsAppMessage) {
    await this.whatsAppManager.getMessageEventHandler().onMessage(message)
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

  /**
   * LOGIC METHODS
   */

  public async getRoomChatById (roomId: string) {
    if (isRoomId(roomId)) {
      const roomChat = await this.requestManager.getChatById(roomId)
      return roomChat as GroupChat
    } else {
      throw WAError(WA_ERROR_TYPE.ERR_GROUP_OR_CONTACT_ID, `The roomId: ${roomId} is not right.`)
    }
  }

  public async getContactChatById (contactId: string) {
    if (isContactId(contactId)) {
      const roomChat = await this.requestManager.getChatById(contactId)
      return roomChat as PrivateChat
    } else {
      throw WAError(WA_ERROR_TYPE.ERR_GROUP_OR_CONTACT_ID, `The contactId: ${contactId} is not right.`)
    }
  }

  public getWhatsAppClient () {
    return this.whatsAppManager.getWhatsAppClient()
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

    const alive = this.getWhatsAppClient().pupBrowser?.isConnected()
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
