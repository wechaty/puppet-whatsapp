import * as PUPPET from 'wechaty-puppet'
import { LANGUAGE, PRE, STRINGS } from '../config.js'
import { WA_ERROR_TYPE } from '../exceptions/error-type.js'
import WAError from '../exceptions/whatsapp-error.js'
import { withPrefix } from '../logger/index.js'
import type PuppetWhatsApp from '../puppet-whatsapp.js'
import type { WhatsAppMessagePayload } from '../schema/whatsapp-type.js'

const logger = withPrefix(`${PRE} friendship`)

export type FriendshipRawPayload = WhatsAppMessagePayload

export async function friendshipRawPayload (this: PuppetWhatsApp, id: string): Promise<FriendshipRawPayload> {
  const cache = await this.manager.getCacheManager()
  const message = await cache.getMessageRawPayload(id)
  if (!message) {
    throw new WAError(WA_ERROR_TYPE.ERR_MSG_NOT_FOUND, 'Message not found', `messageId: ${id}`)
  }
  return message
}

export async function friendshipRawPayloadParser (rawPayload: FriendshipRawPayload): Promise<PUPPET.FriendshipPayload> {
  return {
    contactId: rawPayload.from,
    hello: rawPayload.body,
    id: rawPayload.id.id,
    timestamp: rawPayload.timestamp,
    type: PUPPET.FriendshipType.Confirm,
  }
}

export async function friendshipSearchPhone (
  this: PuppetWhatsApp,
  phone: string,
): Promise<null | string> {
  logger.verbose('friendshipSearchPhone(%s)', phone)
  return `${phone}@c.us`
}

export async function friendshipSearchWeixin (
  weixin: string,
): Promise<null | string> {
  logger.verbose('friendshipSearchWeixin(%s)', weixin)
  return PUPPET.throwUnsupportedError()
}

export async function friendshipAdd (
  this: PuppetWhatsApp,
  contactId: string,
  option?: PUPPET.FriendshipAddOptions,
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
  logger.verbose('friendshipAdd(%s, %s)', contactId, JSON.stringify(option))
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
