/* eslint-disable sort-keys */
import {
  test,
} from 'tstest'

import {
  MessageTypes as WhatsAppMessageType,
} from '../../schema/whatsapp-interface.js'

import {
  genRoomTopicEvent,
  genRoomJoinEvent,
  genRoomAnnounce,
} from './room-event-generator.js'

test('generate room topic event', async t => {
  const roomUpdateForTopic = {
    id: {
      fromMe: false,
      remote: '120363037070043803@g.us',
      id: '3AA08D567DC17E203763',
      participant: '8613812345679@c.us',
      _serialized: 'false_120363037070043803@g.us_3AA08D567DC17E203763_8613812345679@c.us',
    },
    body: 'wechaty puppet whatsapp room topic',
    type: 'subject',
    timestamp: 1644839917,
    chatId: '8613812345679@c.us',
    author: '8613812345679@c.us',
    recipientIds: [],
  } as any

  const roomPayload = {
    id: {
      server: 'g.us',
      user: '120363037070043803',
      _serialized: '120363037070043803@g.us',
    },
    number: null,
    isBusiness: false,
    isEnterprise: false,
    labels: [],
    name: 'wechaty puppet whatsapp room old topic',
    statusMute: false,
    type: 'in',
    isMe: false,
    isUser: false,
    isGroup: true,
    isWAContact: false,
    isMyContact: false,
    isBlocked: false,
  } as any
  const roomTopicEvent = genRoomTopicEvent(roomUpdateForTopic, roomPayload)

  t.ok(roomTopicEvent.newTopic === roomUpdateForTopic.body, 'should get correct room topic')
  t.ok(roomTopicEvent.oldTopic === roomPayload.name, 'should get correct previoud room topic')
  t.ok(roomTopicEvent.changerId === roomUpdateForTopic.author, 'shuold get correct event author')
  t.ok(roomTopicEvent.roomId === roomUpdateForTopic.id.remote, 'shuold get correct room id')

  t.pass('generate room topic event pass')
})

test('generate room join event', async t => {
  const roomUpdateForJoin = {
    id: {
      fromMe: false,
      remote: '120363043127306839@g.us',
      id: '3AC7E4A87767BD63D328',
      participant: '8613812345679@c.us',
      _serialized: 'false_120363043127306839@g.us_3AC7E4A87767BD63D328_8613812345679@c.us',
    },
    body: '测试新建群聊',
    type: 'create',
    timestamp: 1644842251,
    chatId: '8613812345679@c.us',
    author: '8613812345679@c.us',
    recipientIds: [],
  } as any
  const members = ['8618710175700@c.us', '8617316842524@c.us', '8613812345678@c.us', '8613240330438@c.us', '8613812345679@c.us']
  const roomJoinEvent = genRoomJoinEvent(roomUpdateForJoin, members)

  t.ok(roomJoinEvent.inviteeIdList === members, 'should get correct invite list')
  t.ok(roomJoinEvent.inviterId === roomUpdateForJoin.author, 'should get correct event author')
  t.ok(roomJoinEvent.roomId === roomUpdateForJoin.id.remote, 'should get correct room id')

  t.pass('generate room join event pass')
})

test('generate room announce message', async t => {
  const roomUpdateForDescription = {
    id: {
      fromMe: false,
      remote: '120363037070043803@g.us',
      id: '3A1D56DE1A988011D635',
      participant: '8613812345679@c.us',
      _serialized: 'false_120363037070043803@g.us_3A1D56DE1A988011D635_8613812345679@c.us',
    },
    body: '',
    type: 'description',
    timestamp: 1644842154,
    chatId: '8613812345679@c.us',
    author: '8613812345679@c.us',
    recipientIds: [],
  } as any
  const description = 'wechaty puppet whatsapp room description for room announce message'
  const messagePayload = genRoomAnnounce(roomUpdateForDescription, description)
  t.ok(
    messagePayload.type === WhatsAppMessageType.TEXT
    && messagePayload.author === roomUpdateForDescription.author
    && messagePayload.body === description
    && messagePayload.to === roomUpdateForDescription.id.remote,
  )

  t.ok(messagePayload.type === WhatsAppMessageType.TEXT, 'should get correct message type')
  t.ok(messagePayload.author === roomUpdateForDescription.author, 'should get correct author')
  t.ok(messagePayload.body === description, 'shuold get correct anouncement content')
  t.ok(messagePayload.to === roomUpdateForDescription.id.remote, 'shuold get correct room id')

  t.pass('generate room announce message pass')
})
