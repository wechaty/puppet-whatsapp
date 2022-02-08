import { WA_ERROR_TYPE } from '../exceptions/error-type.js'
import WAError from '../exceptions/whatsapp-error.js'

export interface IVcard {
  /**
   * VERSION: X.X
   */
  version: string;
  /**
   * N, name
   */
  N?: string[];
  /**
   * FN, Full name
   */
  FN?: string;
  /**
   * item1.TEL field
   */
  TEL?: {
    waid: string;
    phone: string;
  };
  [k: string]: any;
}

/**
 * parse vcard body
 * @param body vcard body string
 */
export function parseVcard (body: string): IVcard {
  /* example vcard body:
   * BEGIN:VCARD
   * VERSION:3.0
   * N:;[name];;;
   * FN:[name]
   * item1.TEL;waid=[waid]:[phone]
   * item1.X-ABLabel:‎WhatsApp
   * END:VCARD
   */

  const lines = body.split('\n')
  // vcard body must be at least 3 lines, 'begin', 'VERSION' and 'end.js'
  if (lines.length < 2) {
    throw new WAError(WA_ERROR_TYPE.ERR_MSG_CONTACT, `Invalid Vcard body: invalid length, detail: ${body}`)
  }
  if (lines[0] !== 'BEGIN:VCARD') {
    throw new WAError(WA_ERROR_TYPE.ERR_MSG_CONTACT, `Invalid Vcard body: begin not found, detail: ${body}`)
  }

  const versionPattern =  /VERSION:(\d+\.\d*)$/m
  const versionMatch = versionPattern.exec(lines[1]!)
  if (!versionMatch) {
    throw new WAError(WA_ERROR_TYPE.ERR_MSG_CONTACT, `Invalid Vcard body: version field not found, detail: ${body}`)
  }
  const result: IVcard = {
    version: versionMatch[1]!,
  }

  for (let i = 2; i < lines.length; i++) {
    const element = lines[i]!

    if (element.startsWith('N:')) {
      result.N = element.replace('N:', '').split(';').filter(v => !!v)
    } else if (element.startsWith('FN:')) {
      result.FN = element.replace('FN:', '')
    } else if (element.startsWith('item1.TEL;')) { // FIXME: vcard info contain a lot of items, e.g. item1, item2, ...
      const TELPattern = /waid=(\d*):([+ \d]*)$/m
      const match = TELPattern.exec(element)
      if (match) {
        result.TEL = {
          phone: match[2]!,
          waid: `${match[1]}@c.us`,
        }
      }

    } else if (element === 'END:VCARD') {
      break
    }
  }

  if (!result.TEL) {
    throw new WAError(WA_ERROR_TYPE.ERR_MSG_NOT_MATCH, `Card detail: ${body} can not parse TEL field`)
  }

  return result
}
