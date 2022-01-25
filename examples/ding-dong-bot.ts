/**
 *   Wechaty - https://github.com/chatie/wechaty
 *
 *   @copyright 2016-2018 Huan LI <zixia@zixia.net>
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 *
 */
import type * as PUPPET from 'wechaty-puppet'

import qrTerm from 'qrcode-terminal'

import { PuppetWhatsapp } from '../src/mod.js'
import { MemoryCard } from 'wechaty-puppet'
import { MEMORY_SLOT } from '../src/config.js'

/**
 *
 * 1. Declare your Bot!
 *
 */
const WHATSAPP_PUPPET_PROXY = process.env['WHATSAPP_PUPPET_PROXY']
const memoryCard = new MemoryCard({
  name: 'session-file',
  storageOptions: { type: 'file' },
})
await memoryCard.load()
console.info(memoryCard.get(MEMORY_SLOT))
const puppet = new PuppetWhatsapp(
  {
    memory: memoryCard,
    puppeteerOptions: {
      // clientId: '',
      puppeteer:{
        args: WHATSAPP_PUPPET_PROXY ? [`--proxy-server=${WHATSAPP_PUPPET_PROXY}`] : [],
        headless: false,
      },
    },
  },
)

/**
 *
 * 2. Register event handlers for Bot
 *
 */
puppet
  .on('logout', onLogout)
  .on('login',  onLogin)
  .on('scan',   onScan)
  .on('error',  onError)
  .on('message', onMessage)

/**
 *
 * 3. Start the bot!
 *
 */
puppet.start()
  .catch(async e => {
    console.error('Bot start() fail:', e)
    await puppet.stop()
    process.exit(-1)
  })

/**
 *
 * 4. You are all set. ;-]
 *
 */

/**
 *
 * 5. Define Event Handler Functions for:
 *  `scan`, `login`, `logout`, `error`, and `message`
 *
 */
function onScan (payload: PUPPET.EventScanPayload) {
  if (payload.qrcode) {
    qrTerm.generate(payload.qrcode, { small: true })

    const qrcodeImageUrl = [
      'https://wechaty.js.org/qrcode/',
      payload.qrcode,
    ].join('')
    console.info(`[${payload.status}] ${qrcodeImageUrl}\nScan QR Code above to log in: `)
  } else {
    console.info(`[${payload.status}]`)
  }
}

function onLogin (payload: PUPPET.EventLoginPayload) {
  console.info(`${payload.contactId} login`)
}

function onLogout (payload: PUPPET.EventLogoutPayload) {
  console.info(`${payload.contactId} logouted`)
}

function onError (payload: PUPPET.EventErrorPayload) {
  console.error('Bot error:', payload.data)
  /*
  if (bot.logonoff()) {
    bot.say('Wechaty error: ' + e.message).catch(console.error)
  }
  */
}

/**
 *
 * 6. The most important handler is for:
 *    dealing with Messages.
 *
 */
async function onMessage (payload: PUPPET.EventMessagePayload): Promise<void> {
  const msgPayload = await puppet.messagePayload(payload.messageId)
  console.info(`
  =========================================
  Message type: ${msgPayload.type}
  text: ${msgPayload.text}
  from: ${msgPayload.fromId}
  to: ${msgPayload.toId}
  =========================================
  `)
  if ((/ding/i.test(msgPayload.text || ''))) {
    const messageId = await puppet.messageSendText(msgPayload.fromId!, 'dong')
    console.info(`messageId: ${messageId}`)
  }
}

/**
 *
 * 7. Output the Welcome Message
 *
 */
const welcome = `
Puppet Version: ${puppet.version()}

Please wait... I'm trying to login in...

`
console.info(welcome)
