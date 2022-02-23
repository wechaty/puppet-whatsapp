import * as PUPPET from 'wechaty-puppet'
import { log } from '../config.js'
import type PuppetWhatsApp from '../puppet-whatsapp'

const PRE = 'contact-self'

export async function contactSelfQRCode (this: PuppetWhatsApp): Promise<string> {
  log.verbose(PRE, 'contactSelfQRCode()')
  return PUPPET.throwUnsupportedError()
}

export async function contactSelfName (this: PuppetWhatsApp, name: string): Promise<void> {
  log.verbose(PRE, 'contactSelfName(%s)', name)
  await this.manager.setNickname(name)
}

export async function contactSelfSignature (this: PuppetWhatsApp, signature: string): Promise<void> {
  log.verbose(PRE, 'contactSelfSignature(%s)', signature)
  await this.manager.setStatusMessage(signature)
}
