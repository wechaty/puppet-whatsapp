import { WA_ERROR_TYPE } from '../exceptions/error-type.js'
import WAError from '../exceptions/whatsapp-error.js'
import { logger } from '../logger/index.js'

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
  }[];
  [k: string]: any;
}

const VersionPattern =  /VERSION:(\d+\.\d*)$/m
const CheckItermTelPattern = /^item\d\.TEL/i
const TelPatternForContainOnePhoneNumber = /waid=(\d*):([+ \d]*)$/m
const TelPatternForContainMultiPhoneNumbers = /[+ \d]*$/m

/**
 * parse vcard body
 * @param body vcard body string
 */
export function parseVcard (body: string): IVcard {
  /**
   * # One phone number in card body
   * BEGIN:VCARD
   * VERSION:3.0
   * N:;[name];;;
   * FN:[name]
   * item1.TEL;waid=[waid]:[phone]
   * item1.X-ABLabel:‎WhatsApp | 手机 | 公费电话
   * END:VCARD
   * # Multi phone numbers in card body
   * BEGIN:VCARD
   * VERSION:3.0
   * N:;[name];;;
   * FN:[name]
   * item1.TEL;[phone]
   * item1.X-ABLabel:‎WhatsApp | 手机 | 公费电话
   * END:VCARD
   *
   * for detail example, see: https://github.com/wechaty/puppet-whatsapp/issues/136#issuecomment-1032388884
   */

  const lines = body.split('\n')
  // vcard body must be at least 3 lines, 'BEGIN', 'VERSION' and 'END'
  if (lines.length < 2) {
    throw new WAError(WA_ERROR_TYPE.ERR_MSG_CONTACT, `Invalid Vcard body: invalid length, detail: ${body}`)
  }
  if (lines[0] !== 'BEGIN:VCARD') {
    throw new WAError(WA_ERROR_TYPE.ERR_MSG_CONTACT, `Invalid Vcard body: begin not found, detail: ${body}`)
  }

  const versionMatch = VersionPattern.exec(lines[1]!)
  if (!versionMatch) {
    throw new WAError(WA_ERROR_TYPE.ERR_MSG_CONTACT, `Invalid Vcard body: version field not found, detail: ${body}`)
  }
  const result: IVcard = {
    TEL: [],
    version: versionMatch[1]!,
  }

  // skip BEGIN and VERSION filed
  for (let i = 2; i < lines.length; i++) {
    const content = lines[i]!
    if (content.startsWith('N:')) {
      result.N = content.replace('N:', '').split(';').filter(v => !!v)
    } else if (content.startsWith('FN:')) {
      result.FN = content.replace('FN:', '')
    } else if (CheckItermTelPattern.test(content)) {
      if (content.includes('waid')) {
        const match = TelPatternForContainOnePhoneNumber.exec(content)
        if (match) {
          result.TEL!.push({
            phone: match[2]!,
            waid: `${match[1]}@c.us`,
          })
        }
      } else {
        const match = TelPatternForContainMultiPhoneNumbers.exec(content)
        logger.info(`match: ${JSON.stringify(match)}`)
        if (match) {
          result.TEL!.push({
            phone: match[0]!,
            waid: `${extractContactIdFromPhoneNumber(match[0]!)}@c.us`,
          })
        }
      }
    } else if (content === 'END:VCARD') {
      break
    }
  }

  if (result.TEL!.length !== 1) {
    logger.error(`This card contains more than 1 phone number, detail: ${JSON.stringify(result.TEL)}`)
    throw new WAError(WA_ERROR_TYPE.ERR_MSG_CONTACT, `This card contains more than 1 phone number, detail: ${JSON.stringify(result.TEL)}`)
  }

  return result
}

function extractContactIdFromPhoneNumber (phone: string) {
  return phone.replace(/\+|\s/g, '')
}
