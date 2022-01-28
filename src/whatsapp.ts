import {
  log,
}                               from 'wechaty-puppet'

import {
  Client as WhatsApp,
  Message as WhatsappMessage,
  Contact as WhatsappContact,
  ClientSession,
  ClientOptions,
}                               from '@juzibot/whatsapp-web.js'
import type {
  LaunchOptions,
  BrowserConnectOptions,
  BrowserLaunchArgumentOptions,
}                               from 'puppeteer'

async function getWhatsApp (
  options: ClientOptions = {
    // clientId: '',
  },
  session?: ClientSession,
): Promise<WhatsApp> {
  log.verbose('PuppetWhatsApp', 'getWhatsApp()')
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
  WhatsappContact,
  WhatsappMessage,
}
export {
  WhatsApp,
  getWhatsApp,
}
