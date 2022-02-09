import type { Class, SetOptional } from 'type-fest'
import WhatsApp from '@juzi.bot/whatsapp-web.js'

import WAWebJS, { Contact, Message, GroupChat as _GroupChat } from '@juzi.bot/whatsapp-web.js'

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
export const ContactClass = WAWebJS.Contact as Class<Contact>
// @ts-ignore
export const MessageClass = WAWebJS.Message as Class<Message>

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
  MessageAck as MessageAckType,
  MessageTypes,
  Status,
  WAState as WAStateType,
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
} from '@juzi.bot/whatsapp-web.js'

export const {
  WAState,
  MessageAck,
} = WhatsApp

export type ContactPayload = {
  avatar: string
} & Omit<Contact, 'getProfilePicUrl' | 'getChat' | 'getCountryCode' | 'getFormattedNumber' | 'block' | 'unblock' | 'getAbout'>
export type MessagePayload = Omit<Message, 'acceptGroupV4Invite' | 'delete' | 'downloadMedia' | 'getChat' | 'getContact' | 'getMentions' | 'getQuotedMessage' | 'reply' | 'forward' | 'star' | 'unstar' | 'getInfo' | 'getOrder' | 'getPayment'>

export type GroupChat = SetOptional<_GroupChat, 'owner'>

export * from './event-name.js'

export default WAWebJS
