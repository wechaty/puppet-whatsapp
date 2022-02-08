import type { Client, Contact, Message } from '@juzi.bot/whatsapp-web.js'
import { ContactClass, ContactPayload, MessageClass, MessagePayload } from '../schema/index.js'

export function convertContactPayloadToClass (client: Client, payload: ContactPayload): Contact {
  return new ContactClass(client, payload)
}

export function convertMessagePayloadToClass (client: Client, payload: MessagePayload): Message {
  return new MessageClass(client, payload)
}
