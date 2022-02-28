import { RequestPool } from './request-pool.js'
import { test } from 'tstest'

test('RequestPool request resolve test', async t => {
  try {
    const requestPool = RequestPool.Instance
    t.ok(requestPool instanceof RequestPool)

    const time = Date.now()
    setTimeout(() => {
      requestPool.resolveRequest('testRequest')
    }, 3000)
    // eslint-disable-next-line promise/always-return
    await requestPool.pushRequest('testRequest')
    t.ok(Math.abs(Date.now() - time - 3000) < 20)

    t.pass('RequestPool request resolve test pass')
  } catch (e) {
    t.fail(e as any)
  }
})

test('RequestPool clear test', async t => {
  try {
    const requestPool = RequestPool.Instance
    t.ok(requestPool instanceof RequestPool)

    void requestPool.pushRequest('testRequest')
    requestPool.clearPool()
    // @ts-ignore
    t.ok(Object.getOwnPropertyNames(requestPool.poolMap).length === 0)
    t.pass('testRequest clear test pass')
  } catch (e) {
    t.fail(e as any)
  }
})
