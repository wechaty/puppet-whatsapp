import { EventEmitter as EE } from 'ee-ts'
import { log } from './config.js'
import { CacheManager } from './data/cache-manager.js'
import { WA_ERROR_TYPE } from './exception/error-type.js'
import WAError from './exception/whatsapp-error.js'
import { sleep } from './helper/miscellaneous.js'
import ScheduleManager from './helper/schedule/schedule-manager.js'
import type { ManagerEvents } from './manager-event.js'
import type { PuppetWhatsAppOptions } from './puppet-whatsapp.js'
import { RequestManager } from './request/request-manager.js'
import type { ClientSession } from './schema/whatsapp-type.js'
import WhatsAppManager from './whatsapp/whatsapp-manager.js'

const PRE = 'manager'

export default class Manager extends EE<ManagerEvents> {

  private whatsAppManager: WhatsAppManager
  private cacheManager?: CacheManager
  private _requestManager?: RequestManager

  constructor (private options: PuppetWhatsAppOptions) {
    super()
    this.whatsAppManager = new WhatsAppManager(this)
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
  }

  public stopSchedule () {
    ScheduleManager.Instance.clearAllTasks()
  }

  /**
   * Heatbeat
   */
  private startHeartbeat () {

  }

  private stopHeartbeat () {

  }

}
