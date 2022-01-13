import type WhatsAppRaw from './index'

declare namespace WhatsAppRawFix {
  /** Message type buttons */
  export class Buttons {

    body: string | WhatsAppRaw.MessageMedia
    buttons: Array<{ body: string}>
    title?: string | null
    footer?: string | null

    constructor(body: string, buttons: Array<{ body: string}>, title?: string | null, footer?: string | null)

  }
}

export default WhatsAppRawFix
