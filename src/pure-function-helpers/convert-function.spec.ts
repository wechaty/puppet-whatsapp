/* eslint-disable sort-keys */
import { test } from 'tstest'
import PuppetWhatsApp from '../puppet-whatsapp.js'
import { convertMessagePayloadToClass } from './convert-function.js'

test('convert message payload from cache to whatsapp message class', async t => {
  const imageMessagePayload = {
    mediaKey: 'ubCGN0sq2CATcpauCTdgcxoegvyw3nHivBtQ9eyBjlk=',
    id: {
      fromMe: true,
      remote: '120363039010379837@g.us',
      id: '3EB09175781FD3911E22',
      _serialized: 'true_120363039010379837@g.us_3EB09175781FD3911E22',
    },
    ack: 1,
    hasMedia: true,
    body: '',
    type: 'image',
    timestamp: 1644583735,
    from: '8613126768525@c.us',
    to: '120363039010379837@g.us',
    deviceType: 'web',
    forwardingScore: 0,
    isStatus: false,
    isStarred: false,
    fromMe: true,
    hasQuotedMsg: false,
    vCards: [],
    mentionedIds: [],
    isGif: false,
    isEphemeral: false,
    links: [],
  } as any
  const convertMessagePayload = convertMessagePayloadToClass(new PuppetWhatsApp().manager.getWhatsApp(), imageMessagePayload)
  t.ok(convertMessagePayload.hasMedia === false)
})
