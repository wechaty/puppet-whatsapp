import { EventEmitter as EE } from 'ee-ts'
import { MEMORY_SLOT } from '../config.js'
import { WA_ERROR_TYPE } from '../exception/error-type.js'
import WAError from '../exception/whatsapp-error.js'
import type { ManagerEvents } from '../manager-event.js'
import type Manager from '../manager.js'
import type { WhatsAppClientType } from '../schema/whatsapp-type.js'

export default class WhatsAppBase extends EE<ManagerEvents> {

  private static _botId?: string
  private static _whatsAppClient?: WhatsAppClientType
  protected pendingLogoutEmitTimer?: NodeJS.Timer

  public get botId () {
    return WhatsAppBase._botId
  }

  public set botId (value: string | undefined) {
    WhatsAppBase._botId = value
  }

  public get whatsAppClient () {
    return WhatsAppBase._whatsAppClient
  }

  public set whatsAppClient (value: WhatsAppClientType | undefined) {
    WhatsAppBase._whatsAppClient = value
  }

  constructor (protected manager: Manager) {
    super()
  }

  protected baseStop () {
    this.botId = undefined
    this.whatsAppClient = undefined
    this.clearPendingLogoutEmitTimer()
  }

  public getBotId () {
    if (!this.botId) {
      throw WAError(WA_ERROR_TYPE.ERR_INIT, 'This bot is not login')
    }
    return this.botId
  }

  public clearPendingLogoutEmitTimer () {
    if (this.pendingLogoutEmitTimer) {
      clearTimeout(this.pendingLogoutEmitTimer)
      this.pendingLogoutEmitTimer = undefined
    }
  }

  public getWhatsAppClient () {
    if (!this.whatsAppClient) {
      throw WAError(WA_ERROR_TYPE.ERR_INIT, 'Not init whatsapp')
    }
    return this.whatsAppClient
  }

  /**
   * MemoryCard Session Section
   */

  public async setSession (session: string) {
    const memoryCard = this.manager.getMemory()
    await memoryCard.set(MEMORY_SLOT, session)
    await memoryCard.save()
  }

  public async clearSession () {
    const memoryCard = this.manager.getMemory()
    await memoryCard.delete(MEMORY_SLOT)
    await memoryCard.save()
  }

}
