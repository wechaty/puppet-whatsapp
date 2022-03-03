import { PuppetWhatsapp } from '../src/mod.js'

import { test } from 'tstest'
import { MemoryCard } from 'memory-card'

test('memory test', async t => {
  const memory = new MemoryCard('test-MC')
  const puppet = new PuppetWhatsapp({
    memory,
  })

  puppet.on('scan', () => {
    void puppet.stop()
  })

  await puppet.start()
    .then(() => {
      t.ok((puppet.memory as any).payload !== undefined, 'memory is loaded')
      t.pass('memory test pass')
      return null
    })
    .catch(async e => {
      await puppet.stop()
      t.fail(`cannot start puppet due to ${e as any}`)
    })

})
