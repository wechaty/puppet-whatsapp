import * as PUPPET from 'wechaty-puppet'
import { LANGUAGE, log, STRINGS } from '../config.js'
import { WA_ERROR_TYPE } from '../exception/error-type.js'
import WAError from '../exception/whatsapp-error.js'
import type PuppetWhatsApp from '../puppet-whatsapp.js'
import type { WhatsAppMessagePayload } from '../schema/whatsapp-type.js'

const PRE = 'MIXIN_FRIENDSHIP'

export type FriendshipRawPayload = WhatsAppMessagePayload

export async function friendshipRawPayload (this: PuppetWhatsApp, id: string): Promise<FriendshipRawPayload> {
  const cache = await this.manager.getCacheManager()
  const message = await cache.getMessageRawPayload(id)
  if (!message) {
    throw WAError(WA_ERROR_TYPE.ERR_MSG_NOT_FOUND, 'Message not found', `messageId: ${id}`)
  }
  return message
}

export async function friendshipRawPayloadParser (rawPayload: FriendshipRawPayload): Promise<PUPPET.payloads.Friendship> {
  return {
    contactId: rawPayload.from,
    hello: rawPayload.body,
    id: rawPayload.id.id,
    timestamp: rawPayload.timestamp,
    type: PUPPET.types.Friendship.Confirm,
  }
}

export async function friendshipSearchPhone (
  this: PuppetWhatsApp,
  phone: string,
): Promise<null | string> {
  log.verbose(PRE, 'friendshipSearchPhone(%s)', phone)
  const contactId = `${phone}@c.us`
  const isUser = await this.manager.isWhatsappUser(contactId)
  if (!isUser) {
    throw WAError(WA_ERROR_TYPE.ERR_CONTACT_NOT_FOUND, 'Not a registered user on WhatsApp.', `contactId: ${contactId}`)
  }
  return contactId
}

export async function friendshipSearchWeixin (
  weixin: string,
): Promise<null | string> {
  log.verbose(PRE, 'friendshipSearchWeixin(%s)', weixin)
  return PUPPET.throwUnsupportedError()
}

export async function friendshipAdd (
  this: PuppetWhatsApp,
  contactId: string,
  option?: PUPPET.types.FriendshipAddOptions,
): Promise<void> {
  let hello: string = ''
  if (typeof (option) === 'object') {
    hello = option.hello || ''
  } else {
    hello = option || ''
  }
  if (hello.length === 0) {
    hello = STRINGS[LANGUAGE].DEFAULT_HELLO_MESSAGE
  }
  log.verbose(PRE, 'friendshipAdd(%s, %s)', contactId, JSON.stringify(option))
  const isUser = await this.manager.isWhatsappUser(contactId)
  if (!isUser) {
    throw WAError(WA_ERROR_TYPE.ERR_CONTACT_NOT_FOUND, 'Not a registered user on WhatsApp.', `contactId: ${contactId}`)
  }

  await this.contactRawPayload(contactId)

  await this.messageSendText(contactId, hello)
}

export async function friendshipAccept (
  friendshipId: string,
): Promise<void> {
  log.verbose(PRE, 'friendshipAccept(%s)', friendshipId)
  return PUPPET.throwUnsupportedError()
}
