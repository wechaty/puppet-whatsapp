import { RequestManager } from './request/requestManager.js'
import type { Client as WhatsApp } from 'whatsapp-web.js'
import { CacheManager } from './data-manager/cache-manager.js'
import { log } from './config.js'
import WAError from './pure-function-helpers/error-type.js'
import { WA_ERROR_TYPE } from './schema/error-type.js'

const PRE = 'WhatsAppManager'

export class Manager {

  whatsapp?: WhatsApp
  requestManager: RequestManager
  cacheManager?: CacheManager

  constructor (whatsapp: WhatsApp) {

    this.whatsapp = whatsapp
    this.requestManager = new RequestManager(this.whatsapp)
  }

  public async start () {
    log.info('start()')
  }

  public async stop () {
    log.info('stop()')
    await this.releaseCache()
    this.whatsapp = undefined
  }

  public async getCacheManager () {
    if (!this.cacheManager) {
      throw new WAError(WA_ERROR_TYPE.ERR_INIT, 'no cache manager')
    }
    return this.cacheManager
  }

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

  public async setNickname (nickname: string) {
    return this.requestManager.setNickname(nickname)
  }

}
