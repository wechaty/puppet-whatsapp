import { RequestManager } from './request/requestManager.js'
import type { Client as WhatsApp } from 'whatsapp-web.js'

export class Manager {

  whatsapp: WhatsApp
  requestManager: RequestManager

  constructor (whatsapp: WhatsApp) {

    this.whatsapp = whatsapp
    void this.whatsapp.initialize()
    this.requestManager = new RequestManager(this.whatsapp)
  }

  setNickname (nickname: string) {
    return this.requestManager.setNickname(nickname)
  }

}
