import { Client } from 'whatsapp-web.js'
import { RequestManager } from './request/requestManager.js'

export class Manager {

  client: Client
  requestManager: RequestManager

  constructor () {

    this.client = new Client({})
    void this.client.initialize()
    this.requestManager = new RequestManager(this.client)
  }

}
