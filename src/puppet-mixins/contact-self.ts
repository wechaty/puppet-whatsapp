import {
  log, PRE,
} from '../config.js'
import type PuppetWhatsapp from '../puppet-whatsapp'

export async function  contactSelfQRCode (this:PuppetWhatsapp): Promise<string> {
  log.verbose(PRE, 'contactSelfQRCode()')
  return ''
}

export async function contactSelfName (this:PuppetWhatsapp, name: string): Promise<void> {
  log.verbose(PRE, 'contactSelfName(%s)', name)
  await this.getManager()!.setNickname(name)
}

export async function contactSelfSignature (this:PuppetWhatsapp, signature: string): Promise<void> {
  log.verbose(PRE, 'contactSelfSignature(%s)', signature)
  await this.getWhatsapp()!.setStatus(signature)
}
