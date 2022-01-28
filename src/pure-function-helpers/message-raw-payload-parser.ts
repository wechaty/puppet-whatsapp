import * as PUPPET from 'wechaty-puppet'
import { WA_ERROR_TYPE } from '../exceptions/error-type.js'
import WAError from '../exceptions/whatsapp-error.js'
import { isRoomId } from '../utils.js'
import { MessagePayload, WhatsAppMessageType } from '../schema/index.js'

export function parserMessageRawPayload (messagePayload: MessagePayload) {

  const fromId = messagePayload.author || messagePayload.from
  const toId = isRoomId(messagePayload.id.remote) ? undefined : messagePayload.to
  const roomId = isRoomId(messagePayload.id.remote) ? messagePayload.id.remote : undefined

  if (!fromId) {
    throw new WAError(WA_ERROR_TYPE.ERR_MSG_NOT_FOUND, 'empty fromId!')
  }

  if (!roomId && !toId) {
    throw new WAError(WA_ERROR_TYPE.ERR_MSG_NOT_FOUND, 'empty roomId and empty toId!')
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

function getMessageType (messagePayload: MessagePayload): PUPPET.MessageType {
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
  }
  return type
}
