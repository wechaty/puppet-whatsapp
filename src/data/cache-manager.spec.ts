import { CacheManager } from './cache-manager.js'
import { test } from 'tstest'

test('cacheManager start and stop test', async t => {
  try {
    await CacheManager.init('test')
    t.ok('cacheManager init success')

    await CacheManager.release()
    t.ok('cacheManager release success')
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

    if (timeStamp === testTimestamp) {
      t.ok('set and get test pass')
    } else {
      t.fail('did not get the same timestamp')
    }

    await CacheManager.release()
  } catch (e) {
    t.fail(e as any)
  }
})
