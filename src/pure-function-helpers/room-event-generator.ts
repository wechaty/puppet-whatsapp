import type * as PUPPET from 'wechaty-puppet'
import type {  } from '@juzi.bot/whatsapp-web.js'
import type {
  GroupNotification,
  WhatsAppContactPayload,
} from '../schema/whatsapp-type.js'
import {
  MessageTypes as WhatsAppMessageType,
} from '../schema/whatsapp-interface.js'

export function genRoomTopicEvent (notification: GroupNotification, roomPayload: WhatsAppContactPayload) {
  const roomIdObj = notification.id
  const roomId = roomIdObj.remote
  const roomTopicPayload: PUPPET.EventRoomTopicPayload = {
    changerId: notification.author,
    newTopic: notification.body,
    oldTopic: roomPayload.name || '',
    roomId,
    timestamp: notification.timestamp,
  }
  return roomTopicPayload
}

export function genRoomJoinEvent (notification: GroupNotification, members: string[]) {
  const roomIdObj = notification.id
  const roomId = roomIdObj.remote
  const roomJoinPayload: PUPPET.EventRoomJoinPayload = {
    inviteeIdList: members,
    inviterId: notification.author,
    roomId,
    timestamp: notification.timestamp,
  }
  return roomJoinPayload
}

export function genRoomAnnounce (notification: GroupNotification, description: string) {
  const roomIdObj = notification.id
  const roomId = roomIdObj.remote
  const genMessagePayload = {
    ack: 2,
    author: notification.author,
    body: description,
    broadcast: false,
    forwardingScore: 0,
    from: roomIdObj.participant || '',
    fromMe: roomIdObj.fromMe,
    hasMedia: false,
    hasQuotedMsg: false,
    id: notification.id,
    isEphemeral: false,
    isForwarded: false,
    isGif: false,
    isStarred: false,
    isStatus: false,
    links: [],
    mentionedIds: [],
    timestamp: Date.now(),
    to: roomId,
    type: WhatsAppMessageType.TEXT,
    vCards: [],
  }
  return genMessagePayload
}
