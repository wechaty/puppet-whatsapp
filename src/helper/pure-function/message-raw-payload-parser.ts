import * as PUPPET from 'wechaty-puppet'
import { WA_ERROR_TYPE } from '../../exception/error-type.js'
import WAError from '../../exception/whatsapp-error.js'
import { isRoomId } from '../miscellaneous.js'

import {
  MessageTypes as WhatsAppMessageType,
} from '../../schema/whatsapp-interface.js'

import type {
  WhatsAppMessagePayload,
} from '../../schema/whatsapp-type.js'

export function parserMessageRawPayload (messagePayload: WhatsAppMessagePayload): PUPPET.payloads.Message {
  const talkerId = messagePayload.author || messagePayload.from
  let listenerId: string | undefined
  let roomId: string | undefined

  if (typeof messagePayload.id.remote === 'object') {
    const { _serialized } = messagePayload.id.remote
    roomId = isRoomId(_serialized) ? _serialized : undefined
    listenerId = isRoomId(_serialized) ? undefined : messagePayload.to
  } else {
    roomId = isRoomId(messagePayload.id.remote) ? messagePayload.id.remote : undefined
    listenerId = isRoomId(messagePayload.id.remote) ? undefined : messagePayload.to
  }

  if (!talkerId) {
    throw WAError(WA_ERROR_TYPE.ERR_MSG_NOT_FOUND, 'empty talkerIdId!')
  }

  if (!roomId && !listenerId) {
    throw WAError(WA_ERROR_TYPE.ERR_MSG_NOT_FOUND, 'empty roomId and empty listenerId!')
  }

  return {
    /**
     * @deprecated `fromId` is deprecated, use `talkerId` instead.
     *  `fromId` will be removed in v2.0
     */
    fromId: talkerId,
    talkerId,
    // eslint-disable-next-line sort-keys
    id: messagePayload.id.id,
    mentionIdList: messagePayload.mentionedIds,
    roomId,
    text: messagePayload.body,
    timestamp: messagePayload.timestamp,
    /**
     * @deprecated `toId` is deprecated, use `listenerId` instead.
     *  `toId` will be removed in v2.0
     */
    toId: listenerId,
    // eslint-disable-next-line sort-keys
    listenerId,

    type: getMessageType(messagePayload),
  } as any

}

function getMessageType (messagePayload: WhatsAppMessagePayload): PUPPET.types.Message {
  let type: PUPPET.types.Message = PUPPET.types.Message.Unknown

  // @ts-ignore
  if (messagePayload.type === 'notification') {
    type = PUPPET.types.Message.Text
  }

  switch (messagePayload.type) {
    case WhatsAppMessageType.TEXT:
      if (messagePayload.title || messagePayload.description) {
        type = PUPPET.types.Message.Url
      } else if (messagePayload.isStatus) {
        type = PUPPET.types.Message.Post
      } else {
        type = PUPPET.types.Message.Text
      }
      break
    case WhatsAppMessageType.STICKER:
      type = PUPPET.types.Message.Emoticon
      break
    case WhatsAppMessageType.VOICE:
      type = PUPPET.types.Message.Audio
      break
    case WhatsAppMessageType.IMAGE:
      if (messagePayload.isStatus) {
        type = PUPPET.types.Message.Post
      } else {
        type = PUPPET.types.Message.Image
      }
      break
    case WhatsAppMessageType.AUDIO:
      type = PUPPET.types.Message.Audio
      break
    case WhatsAppMessageType.VIDEO:
      if (messagePayload.isStatus) {
        type = PUPPET.types.Message.Post
      } else {
        type = PUPPET.types.Message.Video
      }
      break
    case WhatsAppMessageType.CONTACT_CARD:
      type = PUPPET.types.Message.Contact
      break
    case WhatsAppMessageType.DOCUMENT:
      type = PUPPET.types.Message.Attachment
      break
    case WhatsAppMessageType.LOCATION:
      type = PUPPET.types.Message.Location
      break
    case WhatsAppMessageType.REVOKED:
      type = PUPPET.types.Message.Recalled
      break
  }
  return type
}
