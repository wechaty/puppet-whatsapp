
import type {
  LaunchOptions,
  BrowserConnectOptions,
  BrowserLaunchArgumentOptions,
} from 'puppeteer'

import type {
  WhatsAppClientType,
  ClientSession,
  ClientOptions,
} from '../schema/whatsapp-type.js'
import {
  Client as WhatsApp,
} from '../schema/whatsapp-interface.js'
import WhatsAppBase from './whatsapp-base.js'
import type Manager from '../manager.js'
import { log } from '../config.js'

export default class WhatsAppManager extends WhatsAppBase {

  constructor (manager: Manager) {
    super(manager)
  }

  public async genWhatsAppClient (
    options: ClientOptions = {},
    session?: ClientSession,
  ): Promise<WhatsAppClientType> {
    log.verbose('initWhatsAppClient()')
    const { puppeteer = {}, ...restOptions } = options
    const { args, ...restPuppeteerOptions } = puppeteer
    const puppeteerOptions: LaunchOptions & BrowserLaunchArgumentOptions & BrowserConnectOptions = {
      /**
       * No usable sandbox!
       *  https://github.com/pedroslopez/whatsapp-web.js/issues/344#issuecomment-691570764
       */
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        ...(puppeteer.args || []),
      ],
      headless: true,
      ...restPuppeteerOptions,
    }

    this.whatsAppClient = new WhatsApp({
      puppeteer: puppeteerOptions,
      qrRefreshIntervalMs: 10 * 1000,
      restartOnAuthFail: true,
      session,
      ...restOptions,
    })
    return this.whatsAppClient
  }

  public async initWhatsAppClient (): Promise<void> {
    const whatsAppClient = this.getWhatsAppClient()
    whatsAppClient
      .initialize()
      .then(() => log.verbose('start() whatsapp.initialize() done.'))
      .catch(async e => {
        log.error('start() whatsapp.initialize() rejection: %s', e)
      })
  }

  public async initWhatsAppEvents (): Promise<void> {
    log.verbose('initWhatsAppEvents()')
  }

}
