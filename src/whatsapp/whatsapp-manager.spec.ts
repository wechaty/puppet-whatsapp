#!/usr/bin/env node --no-warnings --loader ts-node/esm

import { test } from 'tstest'
import { Manager } from '../manager.js'
import WhatsAppManager from './whatsapp-manager.js'

test('getWhatsApp() QR Code & Destroy', async t => {
  const manager = new Manager({})
  const whatsAppManager = new WhatsAppManager(manager)
  const whatsapp = await whatsAppManager.genWhatsAppClient()

  try {
    const future = new Promise(resolve => whatsapp.once('qr', resolve))
    let closing = false
    whatsapp.initialize()
      .catch(e => {
        if (!closing) {
          t.fail(e)
        }
      })

    const timer = setTimeout(() => t.fail('timeout'), 15 * 1000)
    await future

    clearTimeout(timer)
    t.pass('whatsapp qr code received')

    closing = true
    await whatsapp.stop()

  } catch (e) {
    t.fail(e as any)
  }
})
