import { EventEmitter as EE } from 'ee-ts'
import { log } from './config.js'
import { CacheManager } from './data/cache-manager.js'
import { WA_ERROR_TYPE } from './exception/error-type.js'
import WAError from './exception/whatsapp-error.js'
import ScheduleManager from './helper/schedule/schedule-manager.js'
import type { ManagerEvents } from './manager-event.js'
import type { PuppetWhatsAppOptions } from './puppet-whatsapp.js'

const PRE = 'manager'

export default class Manager extends EE<ManagerEvents> {

  private cacheManager?: CacheManager

  constructor (private options: PuppetWhatsAppOptions) {
    super()
  }

  /**
   * Lifecycle
   */

  public async start () {
    log.info(PRE, 'start()')
  }

  public async stop () {
    log.info(PRE, 'stop()')

    await this.releaseCache()
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

}
