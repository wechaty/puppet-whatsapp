import {
  log,
}                       from 'wechaty-puppet'
import {
  Client as WhatsApp,
  Message as WhatsappMessage,
  Contact as WhatsappContact,
  ClientSession,
}                               from 'whatsapp-web.js'

async function getWhatsApp (
  session?: ClientSession,
): Promise<WhatsApp> {
  log.verbose('PuppetWhatsApp', 'getWhatsApp()')
  const puppeteer = {
    /**
     * No usable sandbox!
     *  https://github.com/pedroslopez/whatsapp-web.js/issues/344#issuecomment-691570764
     */
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
    ],
    headless: true,
  }

  const whatsapp = new WhatsApp({
    puppeteer,
    session,
  })

  return whatsapp
}

export {
  WhatsApp,
  WhatsappContact,
  WhatsappMessage,
  getWhatsApp,
}
