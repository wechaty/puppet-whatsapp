import type { FriendshipPayload } from 'wechaty-puppet-1.0-migration'
import { log } from 'wechaty-puppet-1.0-migration'
import { PRE } from '../config.js'

export async function friendshipRawPayload (id: string): Promise<any> {
  return PUPPET.throwUnsupportedError()
}

export async function friendshipRawPayloadParser (rawPayload: any): Promise<PUPPET.FriendshipPayload> {
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
