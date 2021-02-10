#!/usr/bin/env ts-node

import test  from 'blue-tape'

import {
  getWhatsApp,
}                 from './whatsapp'

test('getWhatsApp() QR Code & Destroy', async (t) => {
  const whatsapp = await getWhatsApp()

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
    await whatsapp.destroy()

  } catch (e) {
    t.fail(e)
  }
})
