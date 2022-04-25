/* eslint-disable sort-keys */
import { test } from 'tstest'
import { parserMessageRawPayload } from './message-raw-payload-parser.js'
import { MessageTypes } from '../../schema/whatsapp-interface.js'

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
    type: MessageTypes.TEXT,
    timestamp: 1644563786,
    from: '8613812345679@c.us',
    to: '120363039010379837@g.us',
    deviceType: 'web',
    isForwarded: false,
    forwardingScore: 0,
    isStatus: false,
    isStarred: false,
    broadcast: false,
    fromMe: true,
    hasQuotedMsg: false,
    vCards: [],
    mentionedIds: [],
    isGif: false,
    isEphemeral: false,
    links: [],
  }
  const messagePayload = parserMessageRawPayload(roomMessageFromBotByWeb)
  t.ok(messagePayload.listenerId === undefined, 'should get no target id')
  t.ok(messagePayload.roomId === '120363039010379837@g.us', 'should get correct room id')
  t.ok(messagePayload.talkerId === '8613812345679@c.us', 'shuold get correct sender id')
  t.ok(messagePayload.text === 'ding', 'should get correct message content')

  t.pass('message parser for room message which send from bot by web pass')
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
    type: MessageTypes.TEXT,
    timestamp: 1644563785,
    from: '8613812345679@c.us',
    to: '120363039010379837@g.us',
    deviceType: 'android',
    isForwarded: false,
    isStatus: false,
    broadcast: false,
    forwardingScore: 0,
    isStarred: false,
    fromMe: true,
    hasQuotedMsg: false,
    vCards: [],
    mentionedIds: [],
    isGif: false,
    isEphemeral: false,
    links: [],
  }
  const messagePayload = parserMessageRawPayload(roomMessageFromBotByApi)

  t.ok(messagePayload.listenerId === undefined, 'should get no target id')
  t.ok(messagePayload.roomId === '120363039010379837@g.us', 'should get correct room id')
  t.ok(messagePayload.talkerId === '8613812345679@c.us', 'shuold get correct sender id')
  t.ok(messagePayload.text === 'dong', 'should get correct message content')

  t.pass('message parser for room message which send from bot by api pass')
})

test('message parser for room message which send from other contact ', async t => {
  const roomMessageFromOtherContact = {
    id: {
      fromMe: false,
      remote: '120363039010379837@g.us',
      id: 'CC4B5F84340A87BAEFBC87B0588C78E8',
      participant: '8613812345678@c.us',
      _serialized: 'false_120363039010379837@g.us_CC4B5F84340A87BAEFBC87B0588C78E8_8613812345678@c.us',
    },
    ack: 0,
    hasMedia: false,
    body: 'hello',
    type: MessageTypes.TEXT,
    timestamp: 1644565075,
    from: '120363039010379837@g.us',
    to: '8613812345679@c.us',
    author: '8613812345678@c.us',
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
  }
  const messagePayload = parserMessageRawPayload(roomMessageFromOtherContact)

  t.ok(messagePayload.listenerId === undefined, 'should get no target id')
  t.ok(messagePayload.roomId === '120363039010379837@g.us', 'should get correct room id')
  t.ok(messagePayload.talkerId === '8613812345678@c.us', 'shuold get correct sender id')
  t.ok(messagePayload.text === 'hello', 'should get correct message content')

  t.pass('message parser for room message which send from other contact pass')
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
    type: MessageTypes.TEXT,
    timestamp: 1644564200,
    from: '8613812345679@c.us',
    to: '8618710175700@c.us',
    deviceType: 'web',
    isForwarded: false,
    forwardingScore: 0,
    isStatus: false,
    isStarred: false,
    broadcast: false,
    fromMe: true,
    hasQuotedMsg: false,
    vCards: [],
    mentionedIds: [],
    isGif: false,
    isEphemeral: false,
    links: [],
  }
  const messagePayload = parserMessageRawPayload(contactMessageFromBotByWeb)

  t.ok(messagePayload.listenerId === '8618710175700@c.us', 'should get correct target id')
  t.ok(messagePayload.roomId === undefined, 'should get no room id')
  t.ok(messagePayload.talkerId === '8613812345679@c.us', 'shuold get correct sender id')
  t.ok(messagePayload.text === 'ding', 'should get correct message content')

  t.pass('message parser for contact message which send from bot by web pass')
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
    type: MessageTypes.TEXT,
    timestamp: 1644570007,
    from: '8613812345679@c.us',
    to: '8613811286503@c.us',
    deviceType: 'android',
    isForwarded: false,
    forwardingScore: 0,
    isStatus: false,
    isStarred: false,
    broadcast: false,
    fromMe: true,
    hasQuotedMsg: false,
    vCards: [],
    mentionedIds: [],
    isGif: false,
    isEphemeral: false,
    links: [],
  }
  const messagePayload = parserMessageRawPayload(contactMessageFromBotByApi)

  t.ok(messagePayload.listenerId === '8613811286503@c.us', 'should get correct target id')
  t.ok(messagePayload.roomId === undefined, 'should get no room id')
  t.ok(messagePayload.talkerId === '8613812345679@c.us', 'shuold get correct sender id')
  t.ok(messagePayload.text === 'dong', 'should get correct message content')

  t.pass('message parser for contact message which send from bot by api pass')
})

test('message parser for contact message which send from other contact', async t => {
  const contactMessageFromOtherContact = {
    id: {
      fromMe: false,
      remote: '8613812345678@c.us',
      id: '157D906AC6B04EA897002C7CCCD7A339',
      _serialized: 'false_8613812345678@c.us_157D906AC6B04EA897002C7CCCD7A339',
    },
    ack: 0,
    hasMedia: false,
    body: 'hola',
    type: MessageTypes.TEXT,
    timestamp: 1644565052,
    from: '8613812345678@c.us',
    to: '8613812345679@c.us',
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
  }
  const messagePayload = parserMessageRawPayload(contactMessageFromOtherContact)

  t.ok(messagePayload.listenerId === '8613812345679@c.us', 'should get correct target id')
  t.ok(messagePayload.roomId === undefined, 'should get no room id')
  t.ok(messagePayload.talkerId === '8613812345678@c.us', 'shuold get correct sender id')
  t.ok(messagePayload.text === 'hola', 'should get correct message content')

  t.pass('message parser for contact message which send from other contact pass')
})
