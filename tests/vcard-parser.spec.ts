import { test } from 'tstest'
import { parseVcard } from '../src/pure-function-helpers/vcard-parser.js'
const contentContainOnePhone = 'BEGIN:VCARD\nVERSION:3.0\nN:康;龙;;;\nFN:康龙\nitem1.TEL;waid=8613240330438:+86 132 4033 0438\nitem1.X-ABLabel:手机\nEND:VCARD'

const contentContainMultiPhones = 'BEGIN:VCARD\nVERSION:3.0\nN:测试企业9Group;Chatie多人通话;;;\nFN:Chatie多人通话\nitem1.TEL:+86 24 6278 1276\nitem1.X-ABLabel:公费电话\nitem2.TEL:+52 729739\nitem2.X-ABLabel:公费电话\nEND:VCARD'

test('vcard parser for only one phone of contact', async t => {
  const card = parseVcard(contentContainOnePhone)
  t.ok(card.TEL![0]!.waid === '8613240330438@c.us')
})

test('vcard parser for multi phones of contact', async t => {
  try {
    parseVcard(contentContainMultiPhones)
  } catch (error) {
    t.ok((error as any).code === 2006)
  }
})
