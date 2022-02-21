import { withPrefix } from '../logger/index.js'
import {
  Client as WhatsApp,
} from '../schema/whatsapp-interface.js'

import type {
  WhatsAppClientType,
  WhatsAppContact,
  WhatsAppMessage,
  ClientSession,
  ClientOptions,
} from '../schema/whatsapp-type.js'
import type {
  LaunchOptions,
  BrowserConnectOptions,
  BrowserLaunchArgumentOptions,
} from 'puppeteer'
import { PRE } from '../config.js'

const logger = withPrefix(`${PRE} whatsapp`)

async function getWhatsApp (
  options: ClientOptions = {
    // clientId: '',
  },
  session?: ClientSession,
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
    puppeteer: puppeteerOptions,
    qrRefreshIntervalMs: 10 * 1000,
    restartOnAuthFail: true,
    session,
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
