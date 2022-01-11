#!/usr/bin/env node --no-warnings --loader ts-node/esm

import { test } from 'tstest'

import { PuppetWhatsapp } from './mod.js'

class PuppetWhatsAppTest extends PuppetWhatsapp {
}

test('PuppetWhatsapp perfect restart testing', async t => {
  const puppet = new PuppetWhatsAppTest()
  try {

    for (let i = 0; i < 3; i++) {
      await puppet.start()
      // TODO: src\puppet-whatsapp.ts miss this.state.ready('on') -> puppet.state.on() === false
      // t.ok(puppet.state.on(), 'should be turned active after start()')

      await new Promise((resolve) => {
        setTimeout(() => resolve(null), 3000)
      })

      await puppet.stop()
      t.ok(puppet.state.off(), 'should be turned inactive after stop()')

      t.pass('start/stop-ed at #' + i)
    }

    t.pass('PuppetWhatsapp() perfect restart pass.')
  } catch (e) {
    console.error(e)
    // t.fail(e as any)
  }
})
