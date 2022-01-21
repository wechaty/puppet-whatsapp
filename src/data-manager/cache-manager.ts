import * as path from 'path'
import * as fs from 'fs-extra'
import * as os from 'os'

import { FlashStore } from 'flash-store'
import type { Contact, ContactPayload, InviteV4Data, Message, MessagePayload } from '../schema/index.js'
import { logger } from '../logger/index.js'
import { WA_ERROR_TYPE } from '../exceptions/error-type.js'
import WAError from '../exceptions/whatsapp-error.js'

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
  private cacheMessageRawPayload?: FlashStore<string, MessagePayload>
  private cacheContactOrRoomRawPayload?: FlashStore<string, ContactPayload>
  private cacheRoomInvitationRawPayload?: FlashStore<string, Partial<InviteV4Data>>

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
   * Contact Cache Section
   * --------------------------------
   */
  public async getContactOrRoomRawPayload (id: string) {
    const cache = this.getContactOrRoomCache()
    return cache.get(id)
  }

  public async setContactOrRoomRawPayload (id: string, payload: Contact): Promise<void> {
    const cache = this.getContactOrRoomCache()
    await cache.set(id, payload)
  }

  public deleteContactOrRoom (id: string) {
    const cache = this.getContactOrRoomCache()
    return cache.delete(id)
  }

  private getContactOrRoomCache () {
    if (!this.cacheContactOrRoomRawPayload) {
      throw new WAError(WA_ERROR_TYPE.ERR_NO_CACHE, 'getContactOrRoomCache() has no cache')
    }
    return this.cacheContactOrRoomRawPayload
  }

  public async getContactIdList () {
    const cache = this.getContactOrRoomCache()
    const list = []
    for await (const key of cache.keys()) {
      const value = await cache.get(key)
      if (!value) {
        continue
      }
      if (!value.isGroup) {
        list.push(value.id._serialized)
      }
    }
    return list
  }

  public async getRoomIdList () {
    const cache = this.getContactOrRoomCache()
    const list = []
    for await (const key of cache.keys()) {
      const value = await cache.get(key)
      if (!value) {
        continue
      }
      if (value.isGroup) {
        list.push(value.id._serialized)
      }
    }
    return list
  }

  /**
   * -------------------------------
   * Room Invitation Cache Section
   * --------------------------------
   */
  public async getRoomInvitationRawPayload (id: string) {
    const cache = this.getRoomInvitationCache()
    return cache.get(id)
  }

  public async setRoomInvitationRawPayload (id: string, payload: Partial<InviteV4Data>): Promise<void> {
    const cache = this.getRoomInvitationCache()
    await cache.set(id, payload)
  }

  public deleteRoomInvitation (id: string) {
    const cache = this.getRoomInvitationCache()
    return cache.delete(id)
  }

  private getRoomInvitationCache () {
    if (!this.cacheRoomInvitationRawPayload) {
      throw new WAError(WA_ERROR_TYPE.ERR_NO_CACHE, 'getRoomInvitationCache() has no cache')
    }
    return this.cacheRoomInvitationRawPayload
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
      '.wechaty',
      'puppet-whatsapp',
      'flash-store-v0.12',
      userId,
    )

    const baseDirExist = await fs.pathExists(baseDir)

    if (!baseDirExist) {
      await fs.mkdirp(baseDir)
    }

    this.cacheMessageRawPayload = new FlashStore(path.join(baseDir, 'message'))
    this.cacheContactOrRoomRawPayload = new FlashStore(path.join(baseDir, 'contact-or-room'))
    this.cacheRoomInvitationRawPayload = new FlashStore(path.join(baseDir, 'room-invitation'))

    const messageTotal = await this.cacheMessageRawPayload.size

    logger.info(`initCache() inited Messages: ${messageTotal} cacheDir="${baseDir}"`)
  }

  private async releaseCache () {
    logger.verbose('releaseCache()')

    if (this.cacheMessageRawPayload
        && this.cacheContactOrRoomRawPayload
        && this.cacheRoomInvitationRawPayload
    ) {
      logger.silly('releaseCache() closing caches ...')

      await Promise.all([
        this.cacheMessageRawPayload.close(),
        this.cacheContactOrRoomRawPayload.close(),
        this.cacheRoomInvitationRawPayload.close(),
      ])

      this.cacheMessageRawPayload = undefined
      this.cacheContactOrRoomRawPayload = undefined
      this.cacheRoomInvitationRawPayload = undefined

      logger.silly('releaseCache() cache closed.')
    } else {
      logger.verbose('releaseCache() cache not exist.')
    }
  }

}
