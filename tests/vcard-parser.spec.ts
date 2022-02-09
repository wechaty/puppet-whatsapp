import { test } from 'tstest'
import { WA_ERROR_TYPE } from '../src/exceptions/error-type.js'
import WAError from '../src/exceptions/whatsapp-error.js'
import { parseVcard } from '../src/pure-function-helpers/vcard-parser.js'
const contentFromAndroid = 'BEGIN:VCARD\nVERSION:3.0\nN:康;龙;;;\nFN:康龙\nitem1.TEL;waid=8613240330438:+86 132 4033 0438\nitem1.X-ABLabel:手机\nEND:VCARD'
const contentFromIOS = 'BEGIN:VCARD\nVERSION:3.0\nN:🐉;socialbear;;;\nFN:socialbear 🐉\nTEL;type=CELL;type=VOICE;waid=8613240330438:+86 132 4033 0438\nEND:VCARD'

const contentContainMultiPhones = 'BEGIN:VCARD\nVERSION:3.0\nN:测试企业9Group;Chatie多人通话;;;\nFN:Chatie多人通话\nitem1.TEL:+86 24 6278 1276\nitem1.X-ABLabel:公费电话\nitem2.TEL:+52 729739\nitem2.X-ABLabel:公费电话\nEND:VCARD'

test('vcard parser for only one phone of contact from ANDROID', async t => {
  const card = parseVcard(contentFromAndroid)
  t.ok(card.TEL![0]!.waid === '8613240330438@c.us')
})

test('vcard parser for only one phone of contact from IOS', async t => {
  const card = parseVcard(contentFromIOS)
  t.ok(card.TEL![0]!.waid === '8613240330438@c.us')
})

test('vcard parser for multi phones of contact', async t => {
  const fn = () => parseVcard(contentContainMultiPhones)
  const data = [{ phone:'+86 24 6278 1276', waid:'862462781276@c.us' }, { phone:'+52 729739', waid:'52729739@c.us' }]
  t.throws(fn, WAError, new WAError(WA_ERROR_TYPE.ERR_MSG_CONTACT, `This card contains more than 1 phone number, detail: ${JSON.stringify(data)}`))
})
