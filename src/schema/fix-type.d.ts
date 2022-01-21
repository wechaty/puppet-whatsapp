import type {  Contact, MessageMedia } from 'whatsapp-web.js'

declare module 'whatsapp-web.js' {
  declare namespace WAWebJS {
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
