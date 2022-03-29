import { withPrefix } from './logger/index.js'
import {
  LocalAuth,
  Client as WhatsApp,
} from './schema/whatsapp-interface.js'

import type {
  WhatsAppClientType,
  WhatsAppContact,
  WhatsAppMessage,
  ClientOptions,
} from './schema/whatsapp-type.js'
import type {
  LaunchOptions,
  BrowserConnectOptions,
  BrowserLaunchArgumentOptions,
} from 'puppeteer'
import { PRE } from './config.js'

const logger = withPrefix(`${PRE} whatsapp`)

async function getWhatsApp (
  options: ClientOptions = {
    // clientId: '',
  },
  session: string = 'default-client',
): Promise<WhatsAppClientType> {
  logger.verbose('getWhatsApp()')
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

  const whatsapp = new WhatsApp({
    authStrategy: new LocalAuth({ clientId: session }),
    puppeteer: puppeteerOptions,
    // can no loger customize refresh interval
    // refresh time gap is set to 15 seconds
    restartOnAuthFail: true,
    ...restOptions,
  })
  return whatsapp
}

export type {
  WhatsAppContact as WhatsappContact,
  WhatsAppMessage as WhatsappMessage,
}
export {
  WhatsApp,
  getWhatsApp,
}
