/* eslint-disable sort-keys */
import { test } from 'tstest'
import { parserMessageRawPayload } from './message-raw-payload-parser.js'
import type {
  WhatsAppMessagePayload,
} from '../schema/whatsapp-type.js'

test('message parser for room message which send from bot by web ', async t => {
  const roomMessageFromBotByWeb = {
    id: {
      fromMe: true,
      remote: '120363039010379837@g.us',
      id: '3EB03A5D078A2D81D10A',
      _serialized: 'true_120363039010379837@g.us_3EB03A5D078A2D81D10A',
    },
    ack: 0,
    hasMedia: false,
    body: 'ding',
    type: 'chat',
    timestamp: 1644563786,
    from: '8613126768525@c.us',
    to: '120363039010379837@g.us',
    deviceType: 'web',
    isForwarded: false,
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
  } as WhatsAppMessagePayload
  const messagePayload = parserMessageRawPayload(roomMessageFromBotByWeb)
  t.ok(
    messagePayload.toId === undefined
    && messagePayload.roomId === '120363039010379837@g.us'
    && messagePayload.fromId === '8613126768525@c.us'
    && messagePayload.text === 'ding',
  )
})

test('message parser for room message which send from bot by api ', async t => {
  const roomMessageFromBotByApi = {
    id: {
      fromMe: true,
      remote: {
        server: 'g.us',
        user: '120363039010379837',
        _serialized: '120363039010379837@g.us',
      },
      id: '9A0E0DB7663CA62AFD57C73290B11248',
      _serialized: 'true_120363039010379837@g.us_9A0E0DB7663CA62AFD57C73290B11248',
    },
    ack: 0,
    hasMedia: false,
    body: 'dong',
    type: 'chat',
    timestamp: 1644563785,
    from: '8613126768525@c.us',
    to: '120363039010379837@g.us',
    deviceType: 'android',
    isForwarded: false,
    forwardingScore: 0,
    isStarred: false,
    fromMe: true,
    hasQuotedMsg: false,
    vCards: [],
    mentionedIds: [],
    isGif: false,
  } as any
  const messagePayload = parserMessageRawPayload(roomMessageFromBotByApi)
  t.ok(
    messagePayload.toId === undefined
    && messagePayload.roomId === '120363039010379837@g.us'
    && messagePayload.fromId === '8613126768525@c.us'
    && messagePayload.text === 'dong',
  )
})

test('message parser for room message which send from other contact ', async t => {
  const roomMessageFromOtherContact = {
    id: {
      fromMe: false,
      remote: '120363039010379837@g.us',
      id: 'CC4B5F84340A87BAEFBC87B0588C78E8',
      participant: '8618500946096@c.us',
      _serialized: 'false_120363039010379837@g.us_CC4B5F84340A87BAEFBC87B0588C78E8_8618500946096@c.us',
    },
    ack: 0,
    hasMedia: false,
    body: 'hello',
    type: 'chat',
    timestamp: 1644565075,
    from: '120363039010379837@g.us',
    to: '8613126768525@c.us',
    author: '8618500946096@c.us',
    deviceType: 'android',
    isForwarded: false,
    forwardingScore: 0,
    isStatus: false,
    isStarred: false,
    broadcast: false,
    fromMe: false,
    hasQuotedMsg: false,
    vCards: [],
    mentionedIds: [],
    isGif: false,
    isEphemeral: false,
    links: [],
  } as WhatsAppMessagePayload
  const messagePayload = parserMessageRawPayload(roomMessageFromOtherContact)
  t.ok(
    messagePayload.toId === undefined
    && messagePayload.roomId === '120363039010379837@g.us'
    && messagePayload.fromId === '8618500946096@c.us'
    && messagePayload.text === 'hello',
  )
})

test('message parser for contact message which send from bot by web ', async t => {
  const contactMessageFromBotByWeb = {
    id: {
      fromMe: true,
      remote: '8618710175700@c.us',
      id: '3EB0B7678EED11EE37FC',
      _serialized: 'true_8618710175700@c.us_3EB0B7678EED11EE37FC',
    },
    ack: 0,
    hasMedia: false,
    body: 'ding',
    type: 'chat',
    timestamp: 1644564200,
    from: '8613126768525@c.us',
    to: '8618710175700@c.us',
    deviceType: 'web',
    isForwarded: false,
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
  } as WhatsAppMessagePayload
  const messagePayload = parserMessageRawPayload(contactMessageFromBotByWeb)
  t.ok(
    messagePayload.toId === '8618710175700@c.us'
    && messagePayload.roomId === undefined
    && messagePayload.fromId === '8613126768525@c.us'
    && messagePayload.text === 'ding',
  )
})

test('message parser for contact message which send from bot by api ', async t => {
  const contactMessageFromBotByApi = {
    id: {
      fromMe: true,
      remote: '8613811286503@c.us',
      id: 'AD99715B4191F82F6E7DB26F5EF883DA',
      _serialized: 'true_8613811286503@c.us_AD99715B4191F82F6E7DB26F5EF883DA',
    },
    ack: 0,
    hasMedia: false,
    body: 'dong',
    type: 'chat',
    timestamp: 1644570007,
    from: '8613126768525@c.us',
    to: '8613811286503@c.us',
    deviceType: 'android',
    isForwarded: false,
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
  } as WhatsAppMessagePayload
  const messagePayload = parserMessageRawPayload(contactMessageFromBotByApi)
  t.ok(
    messagePayload.toId === '8613811286503@c.us'
    && messagePayload.roomId === undefined
    && messagePayload.fromId === '8613126768525@c.us'
    && messagePayload.text === 'dong',
  )
})

test('message parser for contact message which send from other contact', async t => {
  const contactMessageFromOtherContact = {
    id: {
      fromMe: false,
      remote: '8618500946096@c.us',
      id: '157D906AC6B04EA897002C7CCCD7A339',
      _serialized: 'false_8618500946096@c.us_157D906AC6B04EA897002C7CCCD7A339',
    },
    ack: 0,
    hasMedia: false,
    body: 'hola',
    type: 'chat',
    timestamp: 1644565052,
    from: '8618500946096@c.us',
    to: '8613126768525@c.us',
    deviceType: 'android',
    isForwarded: false,
    forwardingScore: 0,
    isStatus: false,
    isStarred: false,
    broadcast: false,
    fromMe: false,
    hasQuotedMsg: false,
    vCards: [],
    mentionedIds: [],
    isGif: false,
    isEphemeral: false,
    links: [],
  } as WhatsAppMessagePayload
  const messagePayload = parserMessageRawPayload(contactMessageFromOtherContact)
  t.ok(
    messagePayload.toId === '8613126768525@c.us'
    && messagePayload.roomId === undefined
    && messagePayload.fromId === '8618500946096@c.us'
    && messagePayload.text === 'hola',
  )
})