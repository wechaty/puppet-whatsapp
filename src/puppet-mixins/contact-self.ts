import * as PUPPET from 'wechaty-puppet'
import { PRE } from '../config.js'
import { withPrefix } from '../logger/index.js'
import type PuppetWhatsApp from '../puppet-whatsapp'

const logger = withPrefix(`${PRE} contact-self`)

export async function  contactSelfQRCode (this: PuppetWhatsApp): Promise<string> {
  logger.verbose('contactSelfQRCode()')
  return PUPPET.throwUnsupportedError()
}

export async function contactSelfName (this: PuppetWhatsApp, name: string): Promise<void> {
  logger.verbose('contactSelfName(%s)', name)
  await this.manager.setNickname(name)
}

export async function contactSelfSignature (this: PuppetWhatsApp, signature: string): Promise<void> {
  logger.verbose('contactSelfSignature(%s)', signature)
  await this.manager.setStatusMessage(signature)
}
