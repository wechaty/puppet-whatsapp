import type { Class } from 'type-fest'

import WAWebJS, { Client, Contact, Message } from 'whatsapp-web.js'

export const WhatsWebURL = WAWebJS.WhatsWebURL
export const DefaultOptions = WAWebJS.DefaultOptions
export const MessageType = WAWebJS.MessageTypes
export const GroupNotificationType = WAWebJS.GroupNotificationTypes
export const MessageMedia = WAWebJS.MessageMedia
// @ts-ignore
export const ContactCls = WAWebJS.Contact as unknown as Class<Contact>
// @ts-ignore
export const MessageCls = WAWebJS.Message as unknown as Class<Message>
export type {
  Client,
  ClientInfo,
  ClientInfoPhone,
  ClientOptions,
  ClientSession,
  BatteryInfo,
  CreateGroupResult,
  GroupNotification,
  ChatTypes,
  Events,
  GroupNotificationTypes,
  MessageAck,
  MessageTypes,
  Status,
  WAState,
  MessageInfo,
  InviteV4Data,
  Message,
  MessageId,
  Location,
  Label,
  MessageSendOptions,
  MediaFromURLOptions,
  // MessageMedia,
  MessageContent,
  Contact,
  ContactId,
  BusinessContact,
  PrivateContact,
  Chat,
  MessageSearchOptions,
  ChatId,
  PrivateChat,
  GroupParticipant,
  ChangeParticipantsPermisions,
  ChangeGroupParticipants,
  GroupChat,
  ProductMetadata,
  Product,
  Order,
  Payment,
  Call,
  Buttons,
  Row,
  List,
} from 'whatsapp-web.js'

export type ContactPayload = {
  avatar: string
} & Omit<Contact, 'getProfilePicUrl' | 'getChat' | 'getCountryCode' | 'getFormattedNumber' | 'block' | 'unblock' | 'getAbout'>
export type MessagePayload = Omit<Message, 'acceptGroupV4Invite' | 'delete' | 'downloadMedia' | 'getChat' | 'getContact' | 'getMentions' | 'getQuotedMessage' | 'reply' | 'forward' | 'star' | 'unstar' | 'getInfo' | 'getOrder' | 'getPayment'>

export function restoreContact(client: Client, payload: ContactPayload): Contact {
  const contactIns = new ContactCls(client)
  Object.assign(contactIns, payload)
  return contactIns;
}

export function restoreMessage(client: Client, payload: MessagePayload): Message{
  const msgIns = new MessageCls(client)
  Object.assign(msgIns, payload)
  return msgIns
}

export * from './event-name.js'

export default WAWebJS
