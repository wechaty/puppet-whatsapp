#!/usr/bin/env node --no-warnings --loader ts-node/esm

import { test } from 'tstest'
import Manager from './manager.js'

function genTimestamp () {
  return Math.floor(Date.now() / 1000) - 2 * 24 * 3600 - Math.floor(Math.random() * 10000)
}

const fakeMsgListWithin3Days = [
  { timestamp: genTimestamp() },
  { timestamp: genTimestamp() },
  { timestamp: genTimestamp() },
  { timestamp: genTimestamp() },
  { timestamp: genTimestamp() },
  { timestamp: genTimestamp() },
  { timestamp: genTimestamp() },
  { timestamp: genTimestamp() },
  { timestamp: genTimestamp() },
  { timestamp: genTimestamp() },
] as any

const fakeMsgListWithin5Days = [
  { timestamp: 1644823352 },
  { timestamp: 1644823353 },
  { timestamp: 1644823354 },
  { timestamp: 1644823355 },
  ...fakeMsgListWithin3Days,
] as any

const contactId = 'fake_contact_id'

class ManagerTest extends Manager {
}

test('filterFetchedMessages within 3 days', async t => {
  const manager = new ManagerTest({})
  await manager.initCache(contactId)
  // @ts-ignore
  const list = await manager.filterFetchedMessages(contactId, fakeMsgListWithin3Days)
  t.ok(list.length === fakeMsgListWithin3Days.length)
  await manager.releaseCache()
})

test('filterFetchedMessages within 5 days', async t => {
  const manager = new ManagerTest({})
  await manager.initCache(contactId)
  // @ts-ignore
  const list = await manager.filterFetchedMessages(contactId, fakeMsgListWithin5Days)
  t.ok(list.length === fakeMsgListWithin3Days.length)
  await manager.releaseCache()
})
