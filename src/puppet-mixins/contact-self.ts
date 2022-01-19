import * as PUPPET from 'wechaty-puppet'
import { verbose } from '../logger/index.js'
import type PuppetWhatsapp from '../puppet-whatsapp'

export async function  contactSelfQRCode (this: PuppetWhatsapp): Promise<string> {
  verbose('contactSelfQRCode()')
  return PUPPET.throwUnsupportedError()
}

export async function contactSelfName (this: PuppetWhatsapp, name: string): Promise<void> {
  verbose('contactSelfName(%s)', name)
  await this.manager.setNickname(name)
}

export async function contactSelfSignature (this: PuppetWhatsapp, signature: string): Promise<void> {
  verbose('contactSelfSignature(%s)', signature)
  await this.manager.setStatusMessage(signature)
}
