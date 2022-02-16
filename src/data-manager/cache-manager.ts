import * as path from 'path'
import * as fs from 'fs-extra'
import * as os from 'os'
import { FlashStore } from 'flash-store'

import { withPrefix } from '../logger/index.js'
import { WA_ERROR_TYPE } from '../exceptions/error-type.js'
import WAError from '../exceptions/whatsapp-error.js'

import type {
  WhatsAppContactPayload,
  InviteV4Data,
  WhatsAppMessagePayload,
} from '../schema/whatsapp-type.js'
import { PRE } from '../config.js'

const logger = withPrefix(`${PRE} CacheManager`)

export class CacheManager {

  /**
   * ************************************************************************
   *                Static Methods
   * ************************************************************************
   */
  private static _instance?: CacheManager

  public static get Instance () {
    if (!this._instance) {
      throw WAError(WA_ERROR_TYPE.ERR_NO_CACHE, 'no instance')
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
  private cacheMessageRawPayload?: FlashStore<string, WhatsAppMessagePayload>
  private cacheContactOrRoomRawPayload?: FlashStore<string, WhatsAppContactPayload>
  private cacheRoomMemberIdList?: FlashStore<string, string[]>
  private cacheRoomInvitationRawPayload?: FlashStore<string, Partial<InviteV4Data>>
  private cacheLatestMessageTimestampForChat?: FlashStore<string, number>

  /**
   * -------------------------------
   * Message Cache Section
   * --------------------------------
   */
  public async getMessageRawPayload (id: string) {
    const cache = this.getMessageCache()
    return cache.get(id)
  }

  public async setMessageRawPayload (id: string, payload: WhatsAppMessagePayload): Promise<void> {
    const cache = this.getMessageCache()
    // @ts-ignore client is in implementation but not in interface
    const { client, ...rest } = payload
    await cache.set(id, rest)
  }

  public deleteMessage (id: string) {
    const cache = this.getMessageCache()
    return cache.delete(id)
  }

  private getMessageCache () {
    if (!this.cacheMessageRawPayload) {
      throw WAError(WA_ERROR_TYPE.ERR_NO_CACHE, 'getMessageCache() has no cache')
    }
    return this.cacheMessageRawPayload
  }

  /**
   * -------------------------------
   * Contact And Room Cache Section
   * --------------------------------
   */
  public async getContactOrRoomRawPayload (id: string) {
    const cache = this.getContactOrRoomCache()
    return cache.get(id)
  }

  public async setContactOrRoomRawPayload (id: string, payload: WhatsAppContactPayload): Promise<void> {
    const cache = this.getContactOrRoomCache()
    // @ts-ignore client is in implementation but not in interface
    const { client, ...rest } = payload
    await cache.set(id, rest)
  }

  public deleteContactOrRoom (id: string) {
    const cache = this.getContactOrRoomCache()
    return cache.delete(id)
  }

  private getContactOrRoomCache () {
    if (!this.cacheContactOrRoomRawPayload) {
      throw WAError(WA_ERROR_TYPE.ERR_NO_CACHE, 'getContactOrRoomCache() has no cache')
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
      if (!value.isGroup && value.id._serialized) {
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
      if (value.isGroup && value.id._serialized) {
        list.push(value.id._serialized)
      }
    }
    return list
  }

  /**
   * -------------------------------
   * Room Member Cache Section
   * --------------------------------
   */
  public async getRoomMemberIdList (roomId: string) {
    const cache = this.getRoomMemberCache()
    const memberIdList = await cache.get(roomId)
    return memberIdList || []
  }

  public async setRoomMemberIdList (roomId: string, list: string[]): Promise<void> {
    const cache = this.getRoomMemberCache()
    await cache.set(roomId, list)
  }

  public async addRoomMemberToList (roomId: string, memberIds: string | string[]): Promise<void> {
    const memberIdListInCache = await this.getRoomMemberIdList(roomId)
    if (Array.isArray(memberIds)) {
      memberIds.forEach(memberId => !memberIdListInCache.includes(memberId) && memberIdListInCache.push(memberId))
      await this.setRoomMemberIdList(roomId, memberIdListInCache)
    } else {
      !memberIdListInCache.includes(memberIds) && memberIdListInCache.push(memberIds)
      await this.setRoomMemberIdList(roomId, memberIdListInCache)
    }
  }

  public async removeRoomMemberFromList (roomId: string, memberIds: string | string[]): Promise<void> {
    const memberIdListInCache = await this.getRoomMemberIdList(roomId)
    if (Array.isArray(memberIds)) {
      const memberIdList = memberIdListInCache.filter(id => !memberIds.includes(id))
      await this.setRoomMemberIdList(roomId, memberIdList)
    } else {
      if (memberIdListInCache.includes(memberIds)) {
        const memberIdList = memberIdListInCache.filter(id => id !== memberIds)
        await this.setRoomMemberIdList(roomId, memberIdList)
      }
    }
  }

  public async deleteRoomMemberIdList (roomId: string) {
    const cache = this.getRoomMemberCache()
    await cache.delete(roomId)
  }

  private getRoomMemberCache () {
    if (!this.cacheRoomMemberIdList) {
      throw WAError(WA_ERROR_TYPE.ERR_NO_CACHE, 'getRoomMemberCache() has no cache')
    }
    return this.cacheRoomMemberIdList
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
      throw WAError(WA_ERROR_TYPE.ERR_NO_CACHE, 'getRoomInvitationCache() has no cache')
    }
    return this.cacheRoomInvitationRawPayload
  }

  /**
   * -------------------------------
   * Message Cache Section
   * --------------------------------
   */
  public async getLatestMessageTimestampForChat (id: string) {
    const cache = this.getLatestMessageTimestampForChatCache()
    return cache.get(id)
  }

  public async setLatestMessageTimestampForChat (id: string, num: number): Promise<void> {
    const cache = this.getLatestMessageTimestampForChatCache()
    await cache.set(id, num)
  }

  private getLatestMessageTimestampForChatCache () {
    if (!this.cacheLatestMessageTimestampForChat) {
      throw WAError(WA_ERROR_TYPE.ERR_NO_CACHE, 'getLatestMessageTimestampForChatCache() has no cache')
    }
    return this.cacheLatestMessageTimestampForChat
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
      throw WAError(WA_ERROR_TYPE.ERR_INIT, 'cacheMessageRawPayload does not exist.')
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
    this.cacheRoomMemberIdList = new FlashStore(path.join(baseDir, 'room-member'))
    this.cacheLatestMessageTimestampForChat = new FlashStore(path.join(baseDir, 'latest-message-timestamp-for-chat'))

    const messageTotal = await this.cacheMessageRawPayload.size

    logger.info(`initCache() inited Messages: ${messageTotal} cacheDir="${baseDir}"`)
  }

  private async releaseCache () {
    logger.verbose('releaseCache()')

    if (this.cacheMessageRawPayload
        && this.cacheContactOrRoomRawPayload
        && this.cacheRoomInvitationRawPayload
        && this.cacheRoomMemberIdList
        && this.cacheLatestMessageTimestampForChat
    ) {
      logger.silly('releaseCache() closing caches ...')

      await Promise.all([
        this.cacheMessageRawPayload.close(),
        this.cacheContactOrRoomRawPayload.close(),
        this.cacheRoomInvitationRawPayload.close(),
        this.cacheRoomMemberIdList.close(),
        this.cacheLatestMessageTimestampForChat.close(),
      ])

      this.cacheMessageRawPayload = undefined
      this.cacheContactOrRoomRawPayload = undefined
      this.cacheRoomInvitationRawPayload = undefined
      this.cacheRoomMemberIdList = undefined
      this.cacheLatestMessageTimestampForChat = undefined

      logger.silly('releaseCache() cache closed.')
    } else {
      logger.verbose('releaseCache() cache not exist.')
    }
  }

}
