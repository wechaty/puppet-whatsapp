import * as PUPPET from 'wechaty-puppet'
import { verbose } from '../logger/index.js'

export async function friendshipRawPayload (id: string): Promise<any> {
  return PUPPET.throwUnsupportedError()
}

export async function friendshipRawPayloadParser (rawPayload: any): Promise<PUPPET.FriendshipPayload> {
  return PUPPET.throwUnsupportedError()
}

export async function friendshipSearchPhone (
  phone: string,
): Promise<null | string> {
  verbose('friendshipSearchPhone(%s)', phone)
  return PUPPET.throwUnsupportedError()
}

export async function friendshipSearchWeixin (
  weixin: string,
): Promise<null | string> {
  verbose('friendshipSearchWeixin(%s)', weixin)
  return PUPPET.throwUnsupportedError()
}

export async function friendshipAdd (
  contactId: string,
  hello: string,
): Promise<void> {
  verbose('friendshipAdd(%s, %s)', contactId, hello)
  return PUPPET.throwUnsupportedError()
}

export async function friendshipAccept (
  friendshipId: string,
): Promise<void> {
  verbose('friendshipAccept(%s)', friendshipId)
  return PUPPET.throwUnsupportedError()
}
