import type { FriendshipPayload } from 'wechaty-puppet'
import * as PUPPET from 'wechaty-puppet'
import { PRE, log } from '../config.js'

export async function friendshipRawPayload (id: string): Promise<any> {
  return PUPPET.throwUnsupportedError()
}

export async function friendshipRawPayloadParser (rawPayload: any): Promise<FriendshipPayload> {
  return PUPPET.throwUnsupportedError()
}

export async function friendshipSearchPhone (
  phone: string,
): Promise<null | string> {
  log.verbose(PRE, 'friendshipSearchPhone(%s)', phone)
  return PUPPET.throwUnsupportedError()
}

export async function friendshipSearchWeixin (
  weixin: string,
): Promise<null | string> {
  log.verbose(PRE, 'friendshipSearchWeixin(%s)', weixin)
  return PUPPET.throwUnsupportedError()
}

export async function friendshipAdd (
  contactId: string,
  hello: string,
): Promise<void> {
  log.verbose(PRE, 'friendshipAdd(%s, %s)', contactId, hello)
  return PUPPET.throwUnsupportedError()
}

export async function friendshipAccept (
  friendshipId: string,
): Promise<void> {
  log.verbose(PRE, 'friendshipAccept(%s)', friendshipId)
  return PUPPET.throwUnsupportedError()
}
