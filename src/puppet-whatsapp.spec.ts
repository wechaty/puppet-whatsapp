#!/usr/bin/env node --no-warnings --loader ts-node/esm

import { firstValueFrom, fromEvent } from 'rxjs'
import { test } from 'tstest'
import { EventScanPayload, ScanStatus } from 'wechaty-puppet'

import { PuppetWhatsapp } from './puppet-whatsapp.js'

class PuppetWhatsAppTest extends PuppetWhatsapp {
}

test('PuppetWhatsapp perfect restart testing', async t => {
  const puppet = new PuppetWhatsAppTest()
  try {

    for (let i = 0; i < 3; i++) {
      await puppet.start()
      t.ok(puppet.state.on(), 'should be turned active after start()')

      await puppet.stop()
      t.ok(puppet.state.off(), 'should be turned inactive after stop()')

      t.pass('start/stop-ed at #' + i)
    }

    t.pass('PuppetWhatsapp() perfect restart pass.')

  } catch (e) {
    console.error(e)
    t.fail(e as any)
  }
})

test('PuppetWhatsapp start no use session', async t => {
  const puppet = new PuppetWhatsAppTest()
  await puppet.start(false)
  const event$ = fromEvent(puppet, 'scan')

  const future = firstValueFrom(event$)
  const payload: EventScanPayload = {
    status: ScanStatus.Unknown,
  }
  puppet.emit('scan', payload)
  const result = await future
  t.same(result, payload, 'should get scan payload')
  await new Promise((resolve) => {
    setTimeout(async () => {
      await puppet.stop()
      resolve(null)
    }, 1000)
  })
})

// test('PuppetWhatsapp start use legitimate session', async t => {
//   const puppet = new PuppetWhatsAppTest()
//   // use last generated session
//   await puppet.start(true)
//   const event$ = fromEvent(puppet, 'scan')

//   const future = firstValueFrom(event$)
//   const payload: EventScanPayload = {
//     status: ScanStatus.Unknown,
//   }
//   puppet.emit('scan', payload)
//   const result = await future

//   t.same(result, payload, 'should get scan payload')
//   await new Promise((resolve) => {
//     setTimeout(async () => {
//       await puppet.stop()
//       resolve(null)
//     }, 1000)
//   })
// })

// test('PuppetWhatsapp start use illegal session', async t => {
//   const puppet = new PuppetWhatsAppTest()
//   const session = {
//     WABrowserId: 'invalid',
//     WASecretBundle: 'invalid',
//     WAToken1: 'invalid',
//     WAToken2: 'invalid'
//   }
//   try {
//     await puppet.start(true, session)
//   } catch (error) {
//     console.log(error)
//   }
//   const event$ = fromEvent(puppet, 'scan')

//   const future = firstValueFrom(event$)
//   const payload: EventScanPayload = {
//     status: ScanStatus.Unknown,
//   }
//   puppet.emit('scan', payload)
//   const result = await future

//   t.same(result, payload, 'should get scan payload')
//   await new Promise((resolve) => {
//     setTimeout(async () => {
//       await puppet.stop()
//       resolve(null)
//     }, 1000)
//   })
// })
