import * as PUPPET from 'wechaty-puppet'
import { WA_ERROR_TYPE } from '../exceptions/error-type.js'
import WAError from '../exceptions/whatsapp-error.js'
import { isRoomId } from '../utils.js'

import {
  MessageTypes as WhatsAppMessageType,
} from '../schema/whatsapp-interface.js'

import type {
  WhatsAppMessagePayload,
} from '../schema/whatsapp-type.js'

export function parserMessageRawPayload (messagePayload: WhatsAppMessagePayload): PUPPET.MessagePayload {
  const fromId = messagePayload.author || messagePayload.from
  let toId: string | undefined
  let roomId: string | undefined

  if (typeof messagePayload.id.remote === 'object') {
    const { _serialized } = messagePayload.id.remote
    roomId = isRoomId(_serialized) ? _serialized : undefined
    toId = isRoomId(_serialized) ? undefined : messagePayload.to
  } else {
    roomId = isRoomId(messagePayload.id.remote) ? messagePayload.id.remote : undefined
    toId = isRoomId(messagePayload.id.remote) ? undefined : messagePayload.to
  }

  if (!fromId) {
    throw WAError(WA_ERROR_TYPE.ERR_MSG_NOT_FOUND, 'empty fromId!')
  }

  if (!roomId && !toId) {
    throw WAError(WA_ERROR_TYPE.ERR_MSG_NOT_FOUND, 'empty roomId and empty toId!')
  }

  return {
    fromId,
    id: messagePayload.id.id,
    mentionIdList: messagePayload.mentionedIds,
    roomId,
    text: messagePayload.body,
    timestamp: messagePayload.timestamp,
    toId,
    type: getMessageType(messagePayload),
  } as any

}

function getMessageType (messagePayload: WhatsAppMessagePayload): PUPPET.MessageType {
  let type: PUPPET.MessageType = PUPPET.MessageType.Unknown

  // @ts-ignore
  if (messagePayload.type === 'notification') {
    type = PUPPET.MessageType.Text
  }

  switch (messagePayload.type) {
    case WhatsAppMessageType.TEXT:
      if (messagePayload.title || messagePayload.description) {
        type = PUPPET.MessageType.Url
      } else {
        type = PUPPET.MessageType.Text
      }
      break
    case WhatsAppMessageType.STICKER:
      type = PUPPET.MessageType.Emoticon
      break
    case WhatsAppMessageType.VOICE:
      type = PUPPET.MessageType.Audio
      break
    case WhatsAppMessageType.IMAGE:
      type = PUPPET.MessageType.Image
      break
    case WhatsAppMessageType.AUDIO:
      type = PUPPET.MessageType.Audio
      break
    case WhatsAppMessageType.VIDEO:
      type = PUPPET.MessageType.Video
      break
    case WhatsAppMessageType.CONTACT_CARD:
      type = PUPPET.MessageType.Contact
      break
    case WhatsAppMessageType.DOCUMENT:
      type = PUPPET.MessageType.Attachment
      break
    case WhatsAppMessageType.LOCATION:
      type = PUPPET.MessageType.Location
      break
    case WhatsAppMessageType.REVOKED:
      type = PUPPET.MessageType.Recalled
      break
  }
  return type
}
