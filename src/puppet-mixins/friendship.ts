import * as PUPPET from 'wechaty-puppet'
import {WA_ERROR_TYPE} from '../exceptions/error-type.js'
import WAError from '../exceptions/whatsapp-error.js'
import { logger } from '../logger/index.js'
import type PuppetWhatsapp from '../puppet-whatsapp.js'
import type { MessagePayload } from '../schema/index.js'

export type FriendshipRawPayload = MessagePayload

export async function friendshipRawPayload (this: PuppetWhatsapp, id: string): Promise<FriendshipRawPayload> {
  const cache = await this.manager.getCacheManager()
  const message = await cache.getMessageRawPayload(id)
  if (!message) {
    throw new WAError(WA_ERROR_TYPE.ERR_MSG_NOT_FOUND, 'Message not found', `messageId: ${id}`)
  }
  return message
}

export async function friendshipRawPayloadParser (rawPayload: MessagePayload): Promise<PUPPET.FriendshipPayload> {
  return {
    contactId: rawPayload.from,
    hello: rawPayload.body,
    id: rawPayload.id.id,
    timestamp: rawPayload.timestamp,
    type: PUPPET.FriendshipType.Confirm,
  }
}

export async function friendshipSearchPhone (
  this: PuppetWhatsapp,
  phone: string,
): Promise<null | string> {
  logger.verbose('friendshipSearchPhone(%s)', phone)
  const user = await this.manager.getContactById(phone)
  if (user.isWAContact) {
    return user.id._serialized
  } else {
    return null
  }
}

export async function friendshipSearchWeixin (
  weixin: string,
): Promise<null | string> {
  logger.verbose('friendshipSearchWeixin(%s)', weixin)
  return PUPPET.throwUnsupportedError()
}

export async function friendshipAdd (
  this: PuppetWhatsapp,
  contactId: string,
  hello: string,
): Promise<void> {
  logger.verbose('friendshipAdd(%s, %s)', contactId, hello)
  const isUser = await this.manager.isWhatsappUser(contactId)
  if (!isUser) {
    throw new WAError(WA_ERROR_TYPE.ERR_CONTACT_NOT_FOUND, 'Not a registered user on WhatsApp.', `contactId: ${contactId}`)
  }

  await this.contactRawPayload(contactId)

  await this.messageSendText(contactId, hello)
}

export async function friendshipAccept (
  friendshipId: string,
): Promise<void> {
  logger.verbose('friendshipAccept(%s)', friendshipId)
  return PUPPET.throwUnsupportedError()
}
