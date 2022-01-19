import { test } from 'tstest'
import path from 'path'
import fs from 'fs-extra'
import { fileURLToPath } from 'url'
import { parseVcard } from '../src/pure-function-helpers/vcard-parser.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

test('vcard parser parse wa data', async t => {
  const filePath = path.join(__dirname, 'fixtures', 'wacard.vcf')
  const content = await fs.readFile(filePath, 'utf-8')
  const card = parseVcard(content)
  t.ok(card.version === '3.0')
  t.ok(card.FN === 'socialbear')
})
