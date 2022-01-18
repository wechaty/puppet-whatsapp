import { RequestManager } from './request/requestManager.js'
import type { Client as WhatsApp } from 'whatsapp-web.js'
import { CacheManager } from './data-manager/cache-manager.js'
import { log } from './config.js'
import WAError from './pure-function-helpers/error-type.js'
import { WA_ERROR_TYPE } from './schema/error-type.js'

const PRE = 'WhatsAppManager'

export class Manager {

  whatsapp: WhatsApp
  requestManager: RequestManager
  cacheManager?: CacheManager

  constructor (whatsapp: WhatsApp) {

    this.whatsapp = whatsapp
    this.requestManager = new RequestManager(this.whatsapp)
  }

  public async start () {
    await this.initCache('fake_user_id') // FIXME: need to get the login user id
  }

  public async getCacheManager () {
    if (!this.cacheManager) {
      throw new WAError(WA_ERROR_TYPE.ERR_INIT, 'no cache manager')
    }
    return this.cacheManager
  }

  private async initCache (userId: string) {
    log.info(PRE, `initCache(${userId})`)
    if (this.cacheManager) {
      log.warn(PRE, 'initCache() already initialized, skip the init...')
      return
    }
    await CacheManager.init(userId)
    this.cacheManager = CacheManager.Instance
  }

  setNickname (nickname: string) {
    return this.requestManager.setNickname(nickname)
  }

}
