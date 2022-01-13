import { log } from 'flash-store'
import type WhatsAppRaw from '../schema/index'

interface MessagePayload {
  id: string
} // FIXME: need import MessagePayload from wechaty-puppet

export async function messageRawPayloadParser (
  rawPayload: WhatsAppRaw.Message,
): Promise<MessagePayload> {
  log.silly(`messageRawPayloadParser(${rawPayload.id})`)

  return {} as MessagePayload
}
