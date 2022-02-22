/* eslint-disable no-case-declarations */
/* eslint-disable import/no-duplicates */
import { EventEmitter as EE } from 'ee-ts'
import { WA_ERROR_TYPE } from '../exceptions/error-type.js'
import WAError from '../exceptions/whatsapp-error.js'
import type { ManagerEvents } from '../manager-event.js'
import type { Manager } from '../manager.js'
import type { WhatsAppClientType } from '../schema/whatsapp-type.js'

export default class WhatsAppBase extends EE<ManagerEvents> {

  protected botId?: string
  protected pendingLogoutEmitTimer?: NodeJS.Timeout
  protected whatsAppClient?: WhatsAppClientType

  constructor (protected manager: Manager) {
    super()
  }

  public clearWhatsAppRelatedData () {
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

}
