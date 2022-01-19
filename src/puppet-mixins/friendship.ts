import type { FriendshipPayload } from 'wechaty-puppet-1.0-migration'
import { log } from 'wechaty-puppet-1.0-migration'
import { PRE } from '../config.js'

export async function friendshipRawPayload (id: string): Promise<any> {
  return { id } as any
}

export async function friendshipRawPayloadParser (rawPayload: any): Promise<FriendshipPayload> {
  return rawPayload
}

export async function friendshipSearchPhone (
  phone: string,
): Promise<null | string> {
  log.verbose(PRE, 'friendshipSearchPhone(%s)', phone)
  return null
}

export async function friendshipSearchWeixin (
  weixin: string,
): Promise<null | string> {
  log.verbose(PRE, 'friendshipSearchWeixin(%s)', weixin)
  return null
}

export async function friendshipAdd (
  contactId: string,
  hello: string,
): Promise<void> {
  log.verbose(PRE, 'friendshipAdd(%s, %s)', contactId, hello)
}

export async function friendshipAccept (
  friendshipId: string,
): Promise<void> {
  log.verbose(PRE, 'friendshipAccept(%s)', friendshipId)
}
