import { EventEmitter as EE } from 'ee-ts'
import type { MemoryCard } from 'wechaty-puppet/dist/esm/src/config'
import { log, MAX_HEARTBEAT_MISSED, MEMORY_SLOT } from './config.js'
import { CacheManager } from './data/cache-manager.js'
import { WA_ERROR_TYPE } from './exception/error-type.js'
import WAError from './exception/whatsapp-error.js'
import { batchProcess, getMaxTimestampForLoadHistoryMessages, isRoomId, sleep } from './helper/miscellaneous.js'
import ScheduleManager from './helper/schedule/schedule-manager.js'
import type { ManagerEvents } from './manager-event.js'
import type { PuppetWhatsAppOptions } from './puppet-whatsapp.js'
import { RequestManager, requestManagerKeys } from './request/request-manager.js'
import { MessageAck } from './schema/whatsapp-interface.js'
import type { GroupChat, WhatsAppContact, WhatsAppMessage } from './schema/whatsapp-type.js'
import WhatsAppManager from './whatsapp/whatsapp-manager.js'

const PRE = 'Manager'

export default class Manager extends EE<ManagerEvents> {

  public whatsAppManager: WhatsAppManager
  private cacheManager?: CacheManager
  private _requestManager?: RequestManager
  private scheduleManager: ScheduleManager
  private memory?: MemoryCard

  private fetchingMessages: boolean = false
  private heartbeatTimer?: NodeJS.Timer

  constructor (private options: PuppetWhatsAppOptions) {
    super()
    this.whatsAppManager = new WhatsAppManager(this)
    this.scheduleManager = ScheduleManager.Instance

    this.whatsAppManager.on({
      friendship: data => this.emit('friendship', data),
      login: data => this.emit('login', data),
      logout: (botId, data) => this.emit('logout', botId, data),
      message: data => this.emit('message', data),
      ready: () => this.emit('ready'),
      'room-invite': data => this.emit('room-invite', data),
      'room-join': data => this.emit('room-join', data),
      'room-leave': data => this.emit('room-leave', data),
      'room-topic': data => this.emit('room-topic', data),
      scan: data => this.emit('scan', data),
    })

    return new Proxy(this, {
      get: (target: Manager, prop: keyof Manager & keyof RequestManager) => {
        return requestManagerKeys.indexOf(prop) > -1 ? (target.requestManager[prop] as Function).bind(target.requestManager) : target[prop]
      },
    })
  }

  getMemory (): MemoryCard {
    if (this.memory) {
      return this.memory
    } else {
      throw WAError(WA_ERROR_TYPE.ERR_INIT, 'No Memory')
    }
  }

  /**
   * Lifecycle
   */

  public async start (memory?: MemoryCard) {
    if (memory) {
      this.memory = memory
    }
    const session = await this.getMemory().get(MEMORY_SLOT)
    log.verbose(PRE, 'start()')
    const whatsAppClient = await this.whatsAppManager.genWhatsAppClient(this.options['puppeteerOptions'], session)
    try {
      await this.whatsAppManager.initWhatsAppEvents()
      await this.whatsAppManager.initWhatsAppClient()
    } catch (error) {
      log.error(PRE, `start() error message: ${(error as Error).stack}`)
      await sleep(2 * 1000)
      await this.start(session)
    }

    this._requestManager = new RequestManager(whatsAppClient)
    this.startHeartbeat()
    return whatsAppClient
  }

  public async stop () {
    log.verbose(PRE, 'stop()')
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
   * Fetch history messages of contact or room, and then call onMessage method to emit them or not.
   * @param {WhatsAppContact} contactOrRoom contact or room instance
   */
  public async processHistoryMessages (contactOrRoom: WhatsAppContact) {
    if (this.fetchingMessages) {
      return
    }
    this.fetchingMessages = true
    const fetchedMessageList = await this.fetchMessages(contactOrRoom)
    const filteredMessageList = await this.filterFetchedMessages(contactOrRoom.id._serialized, fetchedMessageList)
    await this.processFetchedMessages(filteredMessageList)
    this.fetchingMessages = false
  }

  private async fetchMessages (contactOrRoom: WhatsAppContact) {
    if (contactOrRoom.isMe) {
      // can not get chat for bot self
      return []
    }
    const chat = await contactOrRoom.getChat()
    const messageList = await chat.fetchMessages({})
    return messageList
  }

  private async filterFetchedMessages (contactOrRoomId: string, messageList: WhatsAppMessage[]) {
    const cacheManager = await this.getCacheManager()
    const maxTimestampForLoadHistoryMessages = getMaxTimestampForLoadHistoryMessages()
    const latestTimestampInCache = await cacheManager.getLatestMessageTimestampForChat(contactOrRoomId)
    const minTimestamp = Math.min(latestTimestampInCache, maxTimestampForLoadHistoryMessages)
    try {
      const _messageList = messageList.filter(m => m.timestamp >= minTimestamp)
      const latestMessageTimestamp = _messageList[_messageList.length - 1]?.timestamp
      if (latestMessageTimestamp) {
        await cacheManager.setLatestMessageTimestampForChat(contactOrRoomId, latestMessageTimestamp)
      }
      return _messageList
    } catch (error) {
      log.error(PRE, `filterFetchedMessages error: ${(error as Error).message}`)
      return []
    }
  }

  private async processFetchedMessages (messageList: WhatsAppMessage[]) {
    const batchSize = 50
    await batchProcess(batchSize, messageList, async (message: WhatsAppMessage) => {
      if (message.ack === MessageAck.ACK_DEVICE || message.ack === MessageAck.ACK_READ) {
        await this.processMessage(message)
      }
    })
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
    const memberIdList = roomChat.participants.map(m => m.id._serialized)
    const cacheManager = await this.getCacheManager()
    await cacheManager.setRoomMemberIdList(roomId, memberIdList)
    return memberIdList
  }

  public async syncContactOrRoomList () {
    const whatsapp = this.getWhatsAppClient()
    const contactList: WhatsAppContact[] = await whatsapp.getContacts()
    const contactOrRoomList = contactList.filter(c => c.id.server !== 'broadcast' && c.id._serialized !== '0@c.us')
    return contactOrRoomList
  }

  public async processMessage (message: WhatsAppMessage) {
    log.silly(PRE, `processMessage(${message})`)
    await this.whatsAppManager.getMessageEventHandler().onMessage(message)
  }

  /**
   * Cache Section
   */

  public async initCache (userId: string) {
    log.verbose(PRE, `initCache(${userId})`)
    if (this.cacheManager) {
      log.warn(PRE, 'initCache() already initialized, skip the init...')
      return
    }
    await CacheManager.init(userId)
    this.cacheManager = CacheManager.Instance
  }

  public async releaseCache () {
    log.verbose(PRE, 'releaseCache()')
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
      log.silly(PRE, 'startSyncMissedMessages')
      const contactOrRoomList = await this.syncContactOrRoomList()
      const batchSize = 100
      await batchProcess(batchSize, contactOrRoomList, async (contactOrRoom: WhatsAppContact) => {
        await this.processHistoryMessages(contactOrRoom)
      })
      log.silly(PRE, 'startSyncMissedMessages finished')
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

    let alive = false
    try {
      alive = !!this.getWhatsAppClient().pupBrowser?.isConnected()
    } catch (e) {
      alive = false
    }
    if (alive) {
      this.asystoleCount = 0
      this.emit('heartbeat', 'puppeteer still connected')
    } else {
      this.asystoleCount += 1
      log.warn(PRE, `asystole count: ${this.asystoleCount}`)
      if (this.asystoleCount > MAX_HEARTBEAT_MISSED) {
        log.error(PRE, 'max asystole reached, restarting...')
        await this.stop()
        await this.start()
        this.asystoleCount = 0
      }
    }
  }

}
