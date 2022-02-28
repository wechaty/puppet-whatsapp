/* eslint-disable sort-keys */

import { test } from 'tstest'
import { parserContactRawPayload } from './contact-raw-payload-parser.js'
import * as PUPPET from 'wechaty-puppet'

test('parse self contact info', async t => {
  const selfContactInfo = {
    id: {
      server: 'c.us',
      user: '8613812345678',
      _serialized: '8613812345678@c.us',
    },
    number: '8613812345678',
    type: 'in',
    isMe: true,
    isUser: true,
    isGroup: false,
    isWAContact: true,
    isMyContact: false,
    isBlocked: false,
    avatar: 'https://pps.whatsapp.net/v/t61.24694-24/260815595_1420796841651457_5795692773524767952_n.jpg?ccb=11-4&oh=01_AVzaQSF48-MYxwWUL9qX9i4f1tBjIvIX1h5xnwS3THYPkA&oe=6222761E',
  }

  const result = parserContactRawPayload(selfContactInfo as any, 'testUserName')
  console.info(result)
  t.ok(result.name === 'testUserName', 'should get correct contact name')
  t.ok(result.type === PUPPET.types.Contact.Individual, 'should get correct contact type')
  t.ok(result.phone[0] === '8613812345678', 'should get correct phone number')
  t.ok(result.id === '8613812345678@c.us', 'should get correct user id')
  t.ok(!result.friend, 'should get correct friendship status')

  t.pass('parse self contact info pass')
})

test('parse individual contact info', async t => {
  const contactInfo = {
    id: {
      server: 'c.us',
      user: '918879481247',
      _serialized: '918879481247@c.us',
    },
    number: '918879481247',
    isBusiness: false,
    isEnterprise: false,
    labels: [],
    pushname: 'Prince Arora',
    statusMute: false,
    type: 'in',
    isMe: false,
    isUser: true,
    isGroup: false,
    isWAContact: true,
    isMyContact: true,
    isBlocked: false,
  }

  const result = parserContactRawPayload(contactInfo as any, 'testUserName')
  console.info(result)
  t.ok(result.name === 'Prince Arora', 'should get correct contact name')
  t.ok(result.type === PUPPET.types.Contact.Individual, 'should get correct contact type')
  t.ok(result.phone[0] === '918879481247', 'should get correct phone number')
  t.ok(result.id === '918879481247@c.us', 'should get correct user id')
  t.ok(result.friend, 'should get correct friendship status')

  t.pass('parse individual contact info pass')
})
