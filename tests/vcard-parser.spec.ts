import { test } from 'tstest'
import path from 'path'
import fs from 'fs-extra'
import { parseVcard } from '../src/pure-function-helpers/vcard-parser.js'

test('vcard parser parse wa data', async t => {
  const filePath = path.join('tests', 'fixtures', 'wacard.vcf')
  const content = await fs.readFile(filePath, 'utf-8')
  const card = parseVcard(content)
  t.ok(card.version === '3.0')
  t.ok(card.FN === 'socialbear')
})
