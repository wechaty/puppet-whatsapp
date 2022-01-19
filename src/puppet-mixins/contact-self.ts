import {
  log,
} from '../config.js'
import type PuppetWhatsapp from '../puppet-whatsapp'

const PRE = 'PuppetWhatsApp'

export async function  contactSelfQRCode (this:PuppetWhatsapp): Promise<string> {
  log.verbose(PRE, 'contactSelfQRCode()')
  return ''
}

export async function contactSelfName (this:PuppetWhatsapp, name: string): Promise<void> {
  log.verbose(PRE, 'contactSelfName(%s)', name)
  await this.getManager()!.setNickname(name)
}
