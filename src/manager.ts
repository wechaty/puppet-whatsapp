import { EventEmitter as EE } from 'ee-ts'
import { log, MAX_HEARTBEAT_MISSED } from './config.js'
import { CacheManager } from './data/cache-manager.js'
import { WA_ERROR_TYPE } from './exception/error-type.js'
import WAError from './exception/whatsapp-error.js'
import { batchProcess, getMaxTimestampForLoadHistoryMessages, isRoomId, sleep } from './helper/miscellaneous.js'
import ScheduleManager from './helper/schedule/schedule-manager.js'
import type { ManagerEvents } from './manager-event.js'
import type { PuppetWhatsAppOptions } from './puppet-whatsapp.js'
import { RequestManager } from './request/request-manager.js'
import { MessageAck } from './schema/whatsapp-interface.js'
import type { ClientSession, GroupChat, WhatsAppContact, WhatsAppMessage } from './schema/whatsapp-type.js'
import WhatsAppManager from './whatsapp/whatsapp-manager.js'

const PRE = 'manager'

export default class Manager extends EE<ManagerEvents> {

  public whatsAppManager: WhatsAppManager
  private cacheManager?: CacheManager
  private _requestManager?: RequestManager
  private scheduleManager: ScheduleManager

  private fetchingMessages: boolean = false
  private heartbeatTimer?: NodeJS.Timer

  constructor (private options: PuppetWhatsAppOptions) {
    super()
    this.whatsAppManager = new WhatsAppManager(this)
    this.scheduleManager = ScheduleManager.Instance
  }

  public getOptions () {
    return this.options
  }

  public get (target: Manager, prop: keyof Manager & keyof RequestManager) {
    return Object.prototype.hasOwnProperty.call(target, prop) ? target[prop] : target.requestManager[prop]
  }

  /**
   * Lifecycle
   */

  public async start (session?: ClientSession) {
    log.info(PRE, 'start()')
    log.info('start()')
    const whatsAppClient = await this.whatsAppManager.genWhatsAppClient(this.options['puppeteerOptions'], session)
    try {
      await this.whatsAppManager.initWhatsAppClient()
      await this.whatsAppManager.initWhatsAppEvents()
    } catch (error) {
      log.error(`start() error message: ${(error as Error).stack}`)
      await sleep(2 * 1000)
      await this.start(session)
    }

    this._requestManager = new RequestManager(whatsAppClient)
    this.startHeartbeat()
    return whatsAppClient
  }

  public async stop () {
    log.info('stop()')
    await this.getWhatsAppClient().stop()
    await this.releaseCache()
    this._requestManager = undefined
    this.whatsAppManager.clearWhatsAppRelatedData()

    this.stopHeartbeat()
  }

  public get requestManager () {
    if (!this._requestManager) {
      throw WAError(WA_ERROR_TYPE.ERR_INIT, 'No request manager')
    }
    return this._requestManager
  }

  public getWhatsAppClient () {
    return this.whatsAppManager.getWhatsAppClient()
  }

  /**
   * LOGIC METHODS
   */

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
      log.error(`fetchMessages error: ${(error as Error).message}`)
    }
    this.fetchingMessages = false
  }

  public async getRoomChatById (roomId: string) {
    if (isRoomId(roomId)) {
      const roomChat = await this.requestManager.getChatById(roomId)
      return roomChat as GroupChat
    } else {
      throw WAError(WA_ERROR_TYPE.ERR_GROUP_OR_CONTACT_ID, `The roomId: ${roomId} is not right.`)
    }
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

  public async syncContactOrRoomList () {
    const whatsapp = this.getWhatsAppClient()
    const contactList: WhatsAppContact[] = await whatsapp.getContacts()
    const contactOrRoomList = contactList.filter(c => c.id.server !== 'broadcast' && c.id._serialized !== '0@c.us')
    return contactOrRoomList
  }

  public async processMessage (message: WhatsAppMessage) {
    log.silly(`processMessage(${message})`)
    await this.whatsAppManager.getMessageEventHandler().onMessage(message)
  }

  /**
   * Cache Section
   */

  public async initCache (userId: string) {
    log.info(PRE, `initCache(${userId})`)
    if (this.cacheManager) {
      log.warn(PRE, 'initCache() already initialized, skip the init...')
      return
    }
    await CacheManager.init(userId)
    this.cacheManager = CacheManager.Instance
  }

  public async releaseCache () {
    log.info(PRE, 'releaseCache()')
    if (this.cacheManager) {
      log.warn(PRE, 'releaseCache() already initialized, skip the init...')
      return
    }
    await CacheManager.release()
  }

  public async getCacheManager () {
    if (!this.cacheManager) {
      throw WAError(WA_ERROR_TYPE.ERR_INIT, 'no cache manager')
    }
    return this.cacheManager
  }

  /**
   * Schedule
   */

  public startSchedule () {
    this.scheduleManager.addScheduledTask('0 */2 * * * *', async () => {
      log.silly('startSyncMissedMessages')
      const contactOrRoomList = await this.syncContactOrRoomList()
      const batchSize = 100
      await batchProcess(batchSize, contactOrRoomList, async (contactOrRoom: WhatsAppContact) => {
        await this.fetchMessages(contactOrRoom)
      })
      log.silly('startSyncMissedMessages finished')
    })
  }

  public stopSchedule () {
    this.scheduleManager.clearAllTasks()
  }

  /**
   * Heatbeat
   */

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
      log.warn(`asystole count: ${this.asystoleCount}`)
      if (this.asystoleCount > MAX_HEARTBEAT_MISSED) {
        log.error('max asystole reached, restarting...')
        await this.stop()
        await this.start()
        this.asystoleCount = 0
      }
    }
  }

}
