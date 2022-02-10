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
  return new ContactClass(client, payload)
}

export function convertMessagePayloadToClass (client: WhatsAppClientType, payload: WhatsAppMessagePayload): WhatsAppMessage {
  return new MessageClass(client, payload)
}
