import { CacheManager } from './cache-manager.js'
import { test } from 'tstest'

test('cacheManager start and stop test', async t => {
  try {
    await CacheManager.init('test')
    t.ok(CacheManager.Instance instanceof CacheManager)

    await CacheManager.release()
    t.ok('cacheManager release success')
    t.pass('cacheManager start and stop test pass')
  } catch (e) {
    t.fail(e as any)
  }
})

test('cacheManager set and get test', async t => {
  try {
    const testTimestamp = Date.now()
    await CacheManager.init('test')

    const cacheManager = CacheManager.Instance
    await cacheManager.setLatestMessageTimestampForChat('test', testTimestamp)
    const timeStamp = await (cacheManager.getLatestMessageTimestampForChat('test'))

    t.ok(timeStamp === testTimestamp)

    await CacheManager.release()
    t.pass('cacheManager set and get test')
  } catch (e) {
    t.fail(e as any)
  }
})
