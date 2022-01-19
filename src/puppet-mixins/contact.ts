/* eslint-disable no-redeclare */
import {
  log,
} from '../config.js'
import type { PuppetWhatsapp } from '../puppet-whatsapp.js'

const PRE = 'PuppetWhatsApp'

async function contactAlias (this:PuppetWhatsapp, contactId: string)                       : Promise<string>;
async function contactAlias (this:PuppetWhatsapp, contactId: string, alias: string | null) : Promise<void>;
async function contactAlias (this:PuppetWhatsapp, contactId: string, alias?: string | null): Promise<void | string> {
  log.verbose(PRE, 'contactAlias(%s, %s)', contactId, alias)

  if (typeof alias === 'undefined') {
    return 'mock alias'
  }
}

export {
  contactAlias,
}
