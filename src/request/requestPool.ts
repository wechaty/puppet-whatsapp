import { WA_ERROR_TYPE } from '../exceptions/error-type.js'
import WAError from '../exceptions/whatsapp-error.js'
export class RequestPool {

  private static _instance?: RequestPool
  private poolMap: {[id: string]: Function[]} = {}
  private constructor () {}

  public static get Instance () {
    if (!this._instance) {
      this._instance = new RequestPool()
    }
    return this._instance
  }

  public pushRequest (id: string, timeout: number) {
    const callback = new Promise<void>((resolve, reject) => {
      if (!this.poolMap[id]) {
        this.poolMap[id] = []
      }
      this.poolMap[id]!.push(resolve)
      setTimeout(reject, timeout)
    }).catch(() => {
      delete this.poolMap[id]
      throw WAError(WA_ERROR_TYPE.ERR_REQUEST_TIMEOUT, `TIMEOUT when processing request :${id}`)
    })
    return callback
  }

  public resolveRequest (id: string) {
    const callbacks = this.poolMap[id]
    if (!callbacks || callbacks.length === 0) {
      return
    }
    callbacks.forEach(cb => cb())
    delete this.poolMap[id]
  }

  public clearPool () {
    this.poolMap = {}
  }

}
