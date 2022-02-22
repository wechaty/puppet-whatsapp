/* eslint-disable no-case-declarations */
/* eslint-disable import/no-duplicates */
import { EventEmitter as EE } from 'ee-ts'
import { WA_ERROR_TYPE } from '../exceptions/error-type.js'
import WAError from '../exceptions/whatsapp-error.js'
import type { ManagerEvents } from '../manager-event.js'
import type { Manager } from '../manager.js'

export default class WhatsAppBase extends EE<ManagerEvents> {

  protected botId?: string
  protected pendingLogoutEmitTimer?: NodeJS.Timeout

  constructor (protected manager: Manager) {
    super()
  }

  public clearWhatsAppRelatedData () {
    this.botId = undefined
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

}
