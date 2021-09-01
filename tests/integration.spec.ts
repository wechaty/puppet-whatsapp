#!/usr/bin/env node --no-warnings --loader ts-node/esm

import { test } from 'tstest'

test('tbw', async t => {
  t.pass('tbw')
})
