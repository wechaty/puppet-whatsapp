#!/usr/bin/env node --no-warnings --loader ts-node/esm

import { test } from 'tstest'
import { WA_ERROR_TYPE } from './error-type.js'

import WAError from './whatsapp-error.js'

function throwError () {
  throw new WAError(WA_ERROR_TYPE.ERR_INIT, 'no cache manager')
}
test('WAError should throw', async t => {
  t.throws(throwError, WAError)
})
