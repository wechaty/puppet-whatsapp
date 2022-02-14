/* eslint-disable sort-keys */
import {
  test,
} from 'tstest'

import {
  MessageTypes as WhatsAppMessageType,
} from '../schema/whatsapp-interface.js'

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
      participant: '8613126768525@c.us',
      _serialized: 'false_120363037070043803@g.us_3AA08D567DC17E203763_8613126768525@c.us',
    },
    body: 'wechaty puppet whatsapp room topic',
    type: 'subject',
    timestamp: 1644839917,
    chatId: '8613126768525@c.us',
    author: '8613126768525@c.us',
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
  t.ok(
    roomTopicEvent.newTopic === roomUpdateForTopic.body
    && roomTopicEvent.oldTopic === roomPayload.name
    && roomTopicEvent.changerId === roomUpdateForTopic.author
    && roomTopicEvent.roomId === roomUpdateForTopic.id.remote,
  )
})

test('generate room join event', async t => {
  const roomUpdateForJoin = {
    id: {
      fromMe: false,
      remote: '120363043127306839@g.us',
      id: '3AC7E4A87767BD63D328',
      participant: '8613126768525@c.us',
      _serialized: 'false_120363043127306839@g.us_3AC7E4A87767BD63D328_8613126768525@c.us',
    },
    body: '测试新建群聊',
    type: 'create',
    timestamp: 1644842251,
    chatId: '8613126768525@c.us',
    author: '8613126768525@c.us',
    recipientIds: [],
  } as any
  const members = ['8618710175700@c.us', '8617316842524@c.us', '8618500946096@c.us', '8613240330438@c.us', '8613126768525@c.us']
  const roomJoinEvent = genRoomJoinEvent(roomUpdateForJoin, members)
  t.ok(
    roomJoinEvent.inviteeIdList === members
    && roomJoinEvent.inviterId === roomUpdateForJoin.author
    && roomJoinEvent.roomId === roomUpdateForJoin.id.remote,
  )
})

test('generate room announce message', async t => {
  const roomUpdateForDescription = {
    id: {
      fromMe: false,
      remote: '120363037070043803@g.us',
      id: '3A1D56DE1A988011D635',
      participant: '8613126768525@c.us',
      _serialized: 'false_120363037070043803@g.us_3A1D56DE1A988011D635_8613126768525@c.us',
    },
    body: '',
    type: 'description',
    timestamp: 1644842154,
    chatId: '8613126768525@c.us',
    author: '8613126768525@c.us',
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
})
