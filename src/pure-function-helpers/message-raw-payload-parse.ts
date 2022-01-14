import { log } from 'flash-store'
import type { Message } from 'whatsapp-web.js'

interface MessagePayload {
  id: string
} // FIXME: need import MessagePayload from wechaty-puppet

export async function messageRawPayloadParser (
  rawPayload: Message,
): Promise<MessagePayload> {
  log.silly(`messageRawPayloadParser(${rawPayload.id})`)

  return {} as MessagePayload
}
