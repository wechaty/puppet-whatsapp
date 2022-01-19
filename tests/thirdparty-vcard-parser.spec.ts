import { test } from 'tstest'
import path from 'path'
import fs from 'fs-extra'
import { fileURLToPath } from 'url'
import { parseVCards } from 'vcard4-ts'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const TEST_FILENAME = 'testCard.vcf'

test('vcard parser parse common data', async t => {
  const filePath = path.join(__dirname, 'fixtures', TEST_FILENAME)
  const content = await fs.readFile(filePath, 'utf-8')
  const cards = parseVCards(content).vCards!
  const card = cards[0]
  t.ok(card.VERSION.value === '3.0')
  t.ok(card.FN[0].value === 'John D Doe')
})

test('vcard parser parse wa data', async t => {
  const filePath = path.join(__dirname, 'fixtures', 'wacard.vcf')
  const content = await fs.readFile(filePath, 'utf-8')
  const cards = parseVCards(content).vCards!
  const card = cards[0]
  t.ok(card.VERSION.value === '3.0')
  t.ok(card.FN[0].value === 'socialbear')
})
