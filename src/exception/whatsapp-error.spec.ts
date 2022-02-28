#!/usr/bin/env node --no-warnings --loader ts-node/esm

import { test } from 'tstest'
import { WA_ERROR_TYPE } from './error-type.js'

import WAError from './whatsapp-error.js'

function throwError () {
  throw WAError(WA_ERROR_TYPE.ERR_INIT, 'no cache manager')
}
test('WAError should throw', async t => {
  t.throws(throwError, WAError, WAError(WA_ERROR_TYPE.ERR_INIT, 'no cache manager'))
  t.pass('WAError should throw pass')
})

test('WAError instanceof error', async t => {
  const err = WAError(WA_ERROR_TYPE.ERR_INIT, 'no cache manager')
  t.ok(err instanceof Error)
  t.pass('WAError instanceof error pass')
})

test('WAError should has message', async t => {
  const err = WAError(WA_ERROR_TYPE.ERR_INIT, 'no cache manager')
  t.ok(err.message === 'no cache manager')
  t.pass('WAError should has message pass')
})
