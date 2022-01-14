import type * as WAWebJS from 'whatsapp-web.js'
import type WhatsAppRawFix from './fix-type'

declare namespace WhatsAppRaw {
  export type Client = WAWebJS.Client
  export type ClientInfo = WAWebJS.ClientInfo
  export type ClientInfoPhone = WAWebJS.ClientInfoPhone
  export type ClientOptions = WAWebJS.ClientOptions
  export type ClientSession = WAWebJS.ClientSession
  export type BatteryInfo = WAWebJS.BatteryInfo
  export type CreateGroupResult = WAWebJS.CreateGroupResult
  export type GroupNotification = WAWebJS.GroupNotification
  export type WhatsWebURL = string
  export type DefaultOptions = WAWebJS.ClientOptions
  export type ChatTypes = WAWebJS.ChatTypes
  export type Events = WAWebJS.Events
  export type GroupNotificationTypes = WAWebJS.GroupNotificationTypes
  export type MessageAck = WAWebJS.MessageAck
  export type MessageTypes = WAWebJS.MessageTypes
  export type Status = WAWebJS.Status
  export type WAState = WAWebJS.WAState
  export type MessageInfo = WAWebJS.MessageInfo
  export type InviteV4Data = WAWebJS.InviteV4Data
  export type Message = WAWebJS.Message
  export type MessageId = WAWebJS.MessageId
  export type Location = WAWebJS.Location
  export type Label = WAWebJS.Label
  export type MessageSendOptions = WAWebJS.MessageSendOptions
  export type MediaFromURLOptions = WAWebJS.MediaFromURLOptions
  export type MessageMedia = WAWebJS.MessageMedia
  export type MessageContent = WAWebJS.MessageContent
  export type Contact = WAWebJS.Contact
  export type ContactId = WAWebJS.ContactId
  export type BusinessContact = WAWebJS.BusinessContact
  export type PrivateContact = WAWebJS.PrivateContact
  export type Chat = WAWebJS.Chat
  export type MessageSearchOptions = WAWebJS.MessageSearchOptions
  export type ChatId = WAWebJS.ChatId
  export type PrivateChat = WAWebJS.PrivateChat
  export type GroupParticipant = WAWebJS.GroupParticipant
  export type ChangeParticipantsPermisions = WAWebJS.ChangeParticipantsPermisions
  export type ChangeGroupParticipants = WAWebJS.ChangeGroupParticipants
  export type GroupChat = WAWebJS.GroupChat
  export type ProductMetadata = WAWebJS.ProductMetadata
  export type Product = WAWebJS.Product
  export type Order = WAWebJS.Order
  export type Payment = WAWebJS.Payment
  export type Call = WAWebJS.Call
  // export type List = WAWebJS.List
  // export type Buttons = WAWebJS.Buttons

  // fix
  export type Buttons = WhatsAppRawFix.Buttons
  export type List = WhatsAppRawFix.List
}

export default WhatsAppRaw
