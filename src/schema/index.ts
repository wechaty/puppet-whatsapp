import type { Class, SetOptional } from 'type-fest'

import WAWebJS, { Client as _Client, Contact, Message, GroupChat as _GroupChat } from '@juzibot/whatsapp-web.js'

export const WhatsWebURL = WAWebJS.WhatsWebURL
export const DefaultOptions = WAWebJS.DefaultOptions
export const WhatsAppMessageType = WAWebJS.MessageTypes
export enum GroupNotificationTypes {
  ADD = 'add',
  INVITE = 'invite',
  REMOVE = 'remove',
  LEAVE = 'leave',
  SUBJECT = 'subject',
  DESCRIPTION = 'description',
  PICTURE = 'picture',
  ANNOUNCE = 'announce',
  RESTRICT = 'restrict',
  CREATE = 'create',
}

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
  // GroupChat,
  ProductMetadata,
  Product,
  Order,
  Payment,
  Call,
  Buttons,
  Row,
  List,
} from '@juzibot/whatsapp-web.js'

export type ContactPayload = {
  avatar: string
} & Omit<Contact, 'getProfilePicUrl' | 'getChat' | 'getCountryCode' | 'getFormattedNumber' | 'block' | 'unblock' | 'getAbout'>
export type MessagePayload = Omit<Message, 'acceptGroupV4Invite' | 'delete' | 'downloadMedia' | 'getChat' | 'getContact' | 'getMentions' | 'getQuotedMessage' | 'reply' | 'forward' | 'star' | 'unstar' | 'getInfo' | 'getOrder' | 'getPayment'>

export function restoreContact(client: _Client, payload: ContactPayload): Contact {
  const contactIns = new ContactCls(client)
  Object.assign(contactIns, payload)
  return contactIns;
}

export function restoreMessage(client: _Client, payload: MessagePayload): Message{
  const msgIns = new MessageCls(client)
  Object.assign(msgIns, payload)
  return msgIns
}

export type GroupChat = SetOptional<_GroupChat, 'owner'>

export * from './event-name.js'

export default WAWebJS
