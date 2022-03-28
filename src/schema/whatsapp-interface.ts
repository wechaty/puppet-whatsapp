import WAWebJS from '@juzi/whatsapp-web.js'
import type { Class } from 'type-fest'

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

// @ts-ignore
export const ContactClass = WAWebJS.Contact as Class<WAWebJS.Contact>
// @ts-ignore
export const MessageClass = WAWebJS.Message as Class<WAWebJS.Message>

export const {
  LocalAuth,
  DefaultOptions,
  MessageMedia,
  MessageAck,
  MessageTypes,
  WAState,
  WhatsWebURL,
  Client,
} = WAWebJS
