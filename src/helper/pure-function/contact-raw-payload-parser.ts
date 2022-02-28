import * as PUPPET from 'wechaty-puppet'
import { SPECIAL_BOT_PUSHNAME } from '../../config.js'

import type { WhatsAppContactPayload } from '../../schema/whatsapp-type.js'

export function parserContactRawPayload (contactPayload: WhatsAppContactPayload, userName?: string): PUPPET.payloads.Contact {
  let type
  if (contactPayload.isUser) {
    type = PUPPET.types.Contact.Individual
  } else if (contactPayload.isEnterprise) {
    type = PUPPET.types.Contact.Corporation
  } else {
    type = PUPPET.types.Contact.Unknown
  }
  let name

  if (contactPayload.isMe) {
    name = userName || contactPayload.pushname
    if (name === SPECIAL_BOT_PUSHNAME) {
      name = contactPayload.shortName
    }
  } else {
    name = contactPayload.pushname || contactPayload.name
  }

  return {
    avatar: contactPayload.avatar,
    friend: contactPayload.isMyContact && contactPayload.isUser,
    gender: PUPPET.types.ContactGender.Unknown,
    id: contactPayload.id._serialized,
    name: name || contactPayload.id._serialized,
    phone: [contactPayload.number],
    type: type,
    weixin: contactPayload.number,
  }
}
