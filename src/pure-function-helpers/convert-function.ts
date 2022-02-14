import {
  ContactClass,
  MessageClass,
} from '../schema/whatsapp-interface.js'

import type {
  WhatsAppClientType,
  WhatsAppContact,
  WhatsAppMessage,
  WhatsAppContactPayload,
  WhatsAppMessagePayload,
} from '../schema/whatsapp-type.js'

export function convertContactPayloadToClass (client: WhatsAppClientType, payload: WhatsAppContactPayload): WhatsAppContact {
  const contactIns = new ContactClass(client)
  Object.assign(contactIns, payload)
  return contactIns
}

export function convertMessagePayloadToClass (client: WhatsAppClientType, payload: WhatsAppMessagePayload): WhatsAppMessage {
  const messageIns = new MessageClass(client)
  Object.assign(messageIns, payload)
  return messageIns
}
