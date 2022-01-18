import * as path from 'path'
import * as fs from 'fs-extra'
import * as os from 'os'

import { FlashStore } from 'flash-store'
import type { Message } from '../schema/index.js'

import { log } from '../config.js'
import WAError from '../pure-function-helpers/error-type.js'
import { WA_ERROR_TYPE } from '../schema/error-type.js'

const PRE = 'CacheManager'

export class CacheManager {

  /**
   * ************************************************************************
   *                Static Methods
   * ************************************************************************
   */
  private static _instance?: CacheManager

  public static get Instance () {
    if (!this._instance) {
      throw new WAError(WA_ERROR_TYPE.ERR_NO_CACHE, 'no instance')
    }
    return this._instance
  }

  public static async init (userId: string) {
    if (this._instance) {
      return
    }
    this._instance = new CacheManager()
    await this._instance.initCache(userId)
  }

  public static async release () {
    if (!this._instance) {
      return
    }
    await this._instance.releaseCache()
    this._instance = undefined
  }

  /**
   * ************************************************************************
   *                Instance Methods
   * ************************************************************************
   */
  // Static cache, won't change over time
  private cacheMessageRawPayload?            : FlashStore<string, Message>

  /**
   * -------------------------------
   * Message Cache Section
   * --------------------------------
   */
  public async getMessageRawPayload (id: string) {
    const cache = this.getMessageCache()
    return cache.get(id)
  }

  public async setMessageRawPayload (id: string, payload: Message): Promise<void> {
    const cache = this.getMessageCache()
    await cache.set(id, payload)
  }

  public deleteMessage (id: string) {
    const cache = this.getMessageCache()
    return cache.delete(id)
  }

  private getMessageCache () {
    if (!this.cacheMessageRawPayload) {
      throw new WAError(WA_ERROR_TYPE.ERR_NO_CACHE, 'getMessageCache() has no cache')
    }
    return this.cacheMessageRawPayload
  }

  /**
   * -------------------------------
   * Private Method Section
   * --------------------------------
   */

  private async initCache (
    userId: string,
  ): Promise<void> {

    if (this.cacheMessageRawPayload) {
      throw new WAError(WA_ERROR_TYPE.ERR_INIT, 'cacheMessageRawPayload does not exist.')
    }

    const baseDir = path.join(
      os.homedir(),
      path.sep,
      '.wechaty',
      'puppet-whatsapp',
      path.sep,
      'flash-store-v0.12',
      path.sep,
      userId,
    )

    const baseDirExist = await fs.pathExists(baseDir)

    if (!baseDirExist) {
      await fs.mkdirp(baseDir)
    }

    this.cacheMessageRawPayload            = new FlashStore(path.join(baseDir, 'message'))

    const messageTotal             = await this.cacheMessageRawPayload.size

    log.info(PRE, `initCache() inited Messages: ${messageTotal} cacheDir="${baseDir}"`)
  }

  private async releaseCache () {
    log.verbose(PRE, 'releaseCache()')

    if (this.cacheMessageRawPayload) {
      log.silly(PRE, 'releaseCache() closing caches ...')

      await Promise.all([
        this.cacheMessageRawPayload.close(),
      ])

      this.cacheMessageRawPayload            = undefined

      log.silly(PRE, 'releaseCache() cache closed.')
    } else {
      log.verbose(PRE, 'releaseCache() cache not exist.')
    }
  }

}
