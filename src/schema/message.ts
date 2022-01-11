export enum MessageAck {
  ACK_ERROR = 'ACK_ERROR',
  ACK_PENDING = 'ACK_PENDING',
  ACK_SERVER = 'ACK_SERVER',
  ACK_DEVICE = 'ACK_DEVICE',
  ACK_READ = 'ACK_READ',
  ACK_PLAYED = 'ACK_PLAYED',
}

export enum MessageTypes {
  TEXT = 'TEXT',
  AUDIO = 'AUDIO',
  VOICE = 'VOICE',
  IMAGE = 'IMAGE',
  VIDEO = 'VIDEO',
  DOCUMENT = 'DOCUMENT',
  STICKER = 'STICKER',
  LOCATION = 'LOCATION',
  CONTACT_CARD = 'CONTACT_CARD',
  CONTACT_CARD_MULTI = 'CONTACT_CARD_MULTI',
  ORDER = 'ORDER',
  REVOKED = 'REVOKED',
  PRODUCT = 'PRODUCT',
  UNKNOWN = 'UNKNOWN',
  GROUP_INVITE = 'GROUP_INVITE',
  LIST = 'LIST',
  BUTTONS_RESPONSE = 'BUTTONS_RESPONSE',
  PAYMENT = 'PAYMENT',
}

export interface WhatsAppMessageLinkRawPayload {
  link: string,
  isSuspicious: boolean
}

export interface WhatsAppMessageLocationRawPayload {
  description?: string, // Name for the location
  latitude: number, // Location latitude
  longitude: number, // Location longitude
}

export interface WhatsAppMessagePayload {
  ack: MessageAck, // ACK status for the message
  author: string, // If the message was sent to a group, this field will contain the user that sent the message.
  body: string, // Message content
  broadcast: boolean, // Indicates if the message was a broadcast
  deviceType: string, // String that represents from which device type the message was sent
  forwardingScore: number, // Indicates how many times the message was forwarded. The maximum value is 127.
  from: string, // ID for the Chat that this message was sent to, except if the message was sent by the current user.
  fromMe: boolean, // Indicates if the message was sent by the current user
  hasMedia: boolean, // Indicates if the message has media available for download
  hasQuotedMsg: boolean, // Indicates if the message was sent as a reply to another message.
  id: object, // ID that represents the message
  inviteV4: object, // Group Invite Data
  isForwarded: boolean, // Indicates if the message was forwarded
  isStarred: boolean, // Indicates if the message was starred
  isStatus: boolean, // Indicates if the message is a status update
  links: WhatsAppMessageLinkRawPayload[] // Links included in the message.
  location: WhatsAppMessageLocationRawPayload, // Location information contained in the message, if the message is type "location"
  mediaKey: string, // MediaKey that represents the sticker 'ID'
  mentionedIds: string[] // Indicates the mentions in the message body.
  orderId: string, // Order ID for message type ORDER
  timestamp: number, // Unix timestamp for when the message was created
  to: string, // ID for who this message is for. If the message is sent by the current user, it will be the Chat to which the message is being sent. If the message is sent by another user, it will be the ID for the current user.
  token: string, // Order Token for message type ORDER
  type: MessageTypes, // Message type
  vCards: string[] // List of vCards contained in the message.
}
