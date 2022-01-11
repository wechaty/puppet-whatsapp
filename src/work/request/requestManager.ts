import type { Client } from 'whatsapp-web.js'
import { RateManager } from './rateManager.js'

export class RequestManager {

  private client: Client
  private rateManager: RateManager

  constructor (client: Client) {
    this.client = client
    this.rateManager = new RateManager()
  }

  public async exec (method: keyof Client, ...args: any[]) {
    return this.rateManager.exec(async () => {
      if (method in this.client && typeof (this.client[method]) === 'function') {
        return (this.client[method] as Function)(...args)
      } else {
        throw new Error(`wrong key called on client: ${method}`)
      }
    }, { queueId: method })
  }

}
