import type { SetOptional } from 'type-fest'
import type {  Contact, MessageMedia, Client as _Client } from '@juzi.bot/whatsapp-web.js'
declare module '@juzi.bot/whatsapp-web.js' {
  declare namespace WAWebJS {
    export type CreateGroupResult = {
      gid: {
        server: string
        user: string
        _serialized: string
      }
      missingParticipants: Record<string, string>
    }

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

    /** Message type buttons */
    export class Buttons {

      body: string | MessageMedia
      buttons: Array<{ body: string}>
      title?: string | null
      footer?: string | null

      constructor(body: string, buttons: Array<{ body: string}>, title?: string | null, footer?: string | null)

    }
    export interface Row {

      title: string
      description?: string
    }
    export interface Section {

      title: string
      rows: Row []
    }

    /** Message type List */
    export class List {

      body: string
      buttonText: string
      sections: Row []
      title?: string | null
      footer?: string | null
      constructor(body: string, buttonText: string, sections: Array<any>, title?: string | null, footer?: string | null)

    }

  }
  export = WAWebJS
}
