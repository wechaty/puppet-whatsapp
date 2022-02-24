import { log } from '../../config.js'
import { WA_ERROR_TYPE } from '../../exception/error-type.js'
import WAError from '../../exception/whatsapp-error.js'

const PRE = 'VCARD_PARSER'
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
const CheckItermTelPattern = /^(item\d\.TEL|TEL;)/i
const TelPatternForContainOnePhoneNumber = /waid=(\d*):([+ \d]*)$/m
const TelPatternForContainMultiPhoneNumbers = /[+ \d]*$/m

/*
# Case 1: One phone number in card body from ANDROID
BEGIN:VCARD
VERSION:3.0
N:;[name];;;
FN:[name]
item1.TEL;waid=[waid]:[phone]
item1.X-ABLabel:‎WhatsApp | 手机 | 公费电话
END:VCARD

# Case 2: One phone number in card body from IOS
BEGIN:VCARD
VERSION:3.0
N:🐉;socialbear;;;
FN:socialbear 🐉
TEL;type=CELL;type=VOICE;waid=8613240330438:+86 132 4033 0438
END:VCARD

# Case 3: Multi phone numbers in card body
BEGIN:VCARD
VERSION:3.0
N:;[name];;;
FN:[name]
item1.TEL;[phone]
item1.X-ABLabel:‎WhatsApp | 手机 | 公费电话
END:VCARD

For more detail, see: https://github.com/wechaty/puppet-whatsapp/issues/136#issuecomment-1032388884
*/

/**
 * parse vcard body
 * @param body vcard body string
 */
export function parseVcard (body: string): IVcard {
  const lines = body.split('\n')
  // vcard body must be at least 3 lines, 'BEGIN', 'VERSION' and 'END'
  if (lines.length < 2) {
    throw WAError(WA_ERROR_TYPE.ERR_MSG_CONTACT, `Invalid Vcard body: invalid length, detail: ${body}`)
  }
  if (lines[0] !== 'BEGIN:VCARD') {
    throw WAError(WA_ERROR_TYPE.ERR_MSG_CONTACT, `Invalid Vcard body: begin not found, detail: ${body}`)
  }

  const versionMatch = VersionPattern.exec(lines[1]!)
  if (!versionMatch) {
    throw WAError(WA_ERROR_TYPE.ERR_MSG_CONTACT, `Invalid Vcard body: version field not found, detail: ${body}`)
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
        log.info(PRE, `match: ${JSON.stringify(match)}`)
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
    log.error(PRE, `This card contains more than 1 phone number, detail: ${JSON.stringify(result.TEL)}`)
    throw WAError(WA_ERROR_TYPE.ERR_MSG_CONTACT, `This card contains more than 1 phone number, detail: ${JSON.stringify(result.TEL)}`)
  }

  return result
}

function extractContactIdFromPhoneNumber (phone: string) {
  return phone.replace(/\+|\s/g, '')
}
