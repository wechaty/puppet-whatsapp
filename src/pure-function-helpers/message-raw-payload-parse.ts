import type { Message } from 'whatsapp-web.js'
import { silly } from '../logger/index.js'

interface MessagePayload {
  id: string
} // FIXME: need import MessagePayload from wechaty-puppet

export async function messageRawPayloadParser (
  rawPayload: Message,
): Promise<MessagePayload> {
  silly(`messageRawPayloadParser(${rawPayload.id})`)

  return {} as MessagePayload
}
