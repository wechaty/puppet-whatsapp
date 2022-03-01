import * as PUPPET from 'wechaty-puppet'

import { PuppetWhatsapp } from '../src/mod.js'

import { test } from 'tstest'

test('qrcode test', async t => {
  const puppet = new PuppetWhatsapp()

  let resolver: (value?: unknown) => void

  const promise = new Promise(resolve => {
    resolver = resolve
  })

  async function onScan (payload: PUPPET.payloads.EventScan) {
    t.ok(payload.status === PUPPET.types.ScanStatus.Waiting)
    t.ok(typeof payload.qrcode === 'string')

    t.pass('qrcode test pass')
    resolver()
    await puppet.stop()
  }

  puppet.on('scan', onScan)

  puppet.start()
    .catch(async e => {
      await puppet.stop()
      t.fail(`cannot start puppet due to ${e as any}`)
      resolver()
    })

  await promise
})
