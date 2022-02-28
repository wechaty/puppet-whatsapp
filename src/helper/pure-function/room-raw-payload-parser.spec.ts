/* eslint-disable sort-keys */

import { test } from 'tstest'
import { parserRoomRawPayload } from './room-raw-payload-parser.js'

test('parse room info', async t => {
  const roomPayload = {
    id: {
      server: 'g.us',
      user: '120363021332004743',
      _serialized: '120363021332004743@g.us',
    },
    number: null,
    isBusiness: false,
    isEnterprise: false,
    labels: [],
    name: '哈哈哈 测试',
    statusMute: false,
    type: 'in',
    isMe: false,
    isUser: false,
    isGroup: true,
    isWAContact: false,
    isMyContact: false,
    isBlocked: false,
    avatar: 'https://pps.whatsapp.net/v/t61.24694-24/259270979_6900708863337894_342691323244398878_n.jpg?ccb=11-4&oh=ceb59735080411ee0ff36834e5ce688b&oe=6222C441',
  }

  const roomChat = {
    groupMetadata: {
      id: {
        server: 'g.us',
        user: '120363021332004743',
        _serialized: '120363021332004743@g.us',
      },
      creation: 1643116497,
      owner: { server: 'c.us', user: '8613812345678', _serialized: '8613812345678@c.us' },
      restrict: false,
      announce: false,
      noFrequentlyForwarded: false,
      ephemeralDuration: 0,
      support: false,
      suspended: false,
      uniqueShortNameMap: {},
      notAddedByContact: false,
      participants: [{ id: { server: 'c.us', user: '8613812345678', _serialized: '8613812345678@c.us' }, isAdmin: true, isSuperAdmin: true }, { id: { server: 'c.us', user: '8613812345679', _serialized: '8613812345679@c.us' }, isAdmin: false, isSuperAdmin: false }, { id: { server: 'c.us', user: '8613812345670', _serialized: '8613812345670@c.us' }, isAdmin: false, isSuperAdmin: false }, { id: { server: 'c.us', user: '8613812345671', _serialized: '8613812345671@c.us' }, isAdmin: false, isSuperAdmin: false }],
      pendingParticipants: [],
    },
    participants: [{ id: { server: 'c.us', user: '8613812345678', _serialized: '8613812345678@c.us' }, isAdmin: true, isSuperAdmin: true }, { id: { server: 'c.us', user: '8613812345679', _serialized: '8613812345679@c.us' }, isAdmin: false, isSuperAdmin: false }, { id: { server: 'c.us', user: '8613812345670', _serialized: '8613812345670@c.us' }, isAdmin: false, isSuperAdmin: false }, { id: { server: 'c.us', user: '8613812345671', _serialized: '8613812345671@c.us' }, isAdmin: false, isSuperAdmin: false }],
    id: { server: 'g.us', user: '120363021332004743', _serialized: '120363021332004743@g.us' },
    name: '哈哈哈 测试',
    isGroup: true,
    isReadOnly: false,
    unreadCount: 0,
    timestamp: 1645128573,
    archived: false,
    pinned: false,
    isMuted: false,
    muteExpiration: 0,
  }

  const result = parserRoomRawPayload(roomPayload as any, roomChat as any)
  console.info(result)
  t.ok(result.topic === '哈哈哈 测试', 'should get correct room topic')
  t.ok(result.adminIdList[0] === '8613812345678@c.us', 'should get correct admin')
  t.ok(result.memberIdList.length === 4, 'should get correct member count')
  t.ok(result.avatar === 'https://pps.whatsapp.net/v/t61.24694-24/259270979_6900708863337894_342691323244398878_n.jpg?ccb=11-4&oh=ceb59735080411ee0ff36834e5ce688b&oe=6222C441', 'should get correct avatar')

  t.pass('parse self contact info pass')
})
