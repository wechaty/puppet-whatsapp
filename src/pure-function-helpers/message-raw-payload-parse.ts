import { log } from 'flash-store'

import type { WhatsAppMessagePayload } from '../schema/message'

interface MessagePayload {
  id: string
} // FIXME: need import MessagePayload from wechaty-puppet

export async function messageRawPayloadParser (
  rawPayload: WhatsAppMessagePayload,
): Promise<MessagePayload> {
  log.silly(`messageRawPayloadParser(${rawPayload.id})`)

  return {} as MessagePayload
}
