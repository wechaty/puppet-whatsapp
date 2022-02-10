import type WhatsApp from '@juzi.bot/whatsapp-web.js'
import type { SetOptional } from 'type-fest'

export type {
  Client as WhatsAppClientType,
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
  Status,
  WAState as WAStateType,
  MessageInfo,
  InviteV4Data,
  Message as WhatsAppMessage,
  MessageId,
  Location,
  Label,
  MessageSendOptions,
  MediaFromURLOptions,
  // MessageMedia,
  MessageContent,
  Contact as WhatsAppContact,
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

export type WhatsAppContactPayload = {
  avatar: string
} & Omit<WhatsApp.Contact, 'getProfilePicUrl' | 'getChat' | 'getCountryCode' | 'getFormattedNumber' | 'block' | 'unblock' | 'getAbout'>
export type WhatsAppMessagePayload = Omit<WhatsApp.Message, 'acceptGroupV4Invite' | 'delete' | 'downloadMedia' | 'getChat' | 'getContact' | 'getMentions' | 'getQuotedMessage' | 'reply' | 'forward' | 'star' | 'unstar' | 'getInfo' | 'getOrder' | 'getPayment'>

export type GroupChat = SetOptional<WhatsApp.GroupChat, 'owner'>
