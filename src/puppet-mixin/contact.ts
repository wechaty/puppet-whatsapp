/* eslint-disable no-redeclare */
import * as PUPPET from 'wechaty-puppet'

import {
  FileBox,
  log,
} from '../config.js'
import { WA_ERROR_TYPE } from '../exception/error-type.js'
import WAError from '../exception/whatsapp-error.js'
import type PuppetWhatsApp from '../puppet-whatsapp.js'
import type { WhatsAppContactPayload } from '../schema/whatsapp-type.js'
import { isContactId } from '../helper/miscellaneous.js'

import { parserContactRawPayload } from '../helper/pure-function/contact-raw-payload-parser.js'

const PRE = 'MIXIN_CONTACT'

export async function contactAlias(this: PuppetWhatsApp, contactId: string): Promise<string>;
export async function contactAlias(this: PuppetWhatsApp, contactId: string, alias: string | null): Promise<void>;
export async function contactAlias (this: PuppetWhatsApp, contactId: string, alias?: string | null): Promise<void | string> {
  log.verbose(PRE, 'contactAlias(%s, %s)', contactId, alias)
  return PUPPET.throwUnsupportedError()
}

export async function contactPhone(this: PuppetWhatsApp, contactId: string): Promise<string[]>
export async function contactPhone(this: PuppetWhatsApp, contactId: string, phoneList: string[]): Promise<void>

export async function contactPhone (this: PuppetWhatsApp, contactId: string, phoneList?: string[]): Promise<string[] | void> {
  log.verbose(PRE, 'contactPhone(%s, %s)', contactId, phoneList)
  if (typeof phoneList === 'undefined') {
    const cacheManager = await this.manager.getCacheManager()
    const contact = await cacheManager.getContactOrRoomRawPayload(contactId)
    if (contact) {
      return [contact!.number]
    } else {
      return []
    }
  }
}

export async function contactCorporationRemark (this: PuppetWhatsApp, contactId: string, corporationRemark: string) {
  log.verbose(PRE, 'contactCorporationRemark(%s, %s)', contactId, corporationRemark)
  return PUPPET.throwUnsupportedError()
}

export async function contactDescription (this: PuppetWhatsApp, contactId: string, description: string) {
  log.verbose(PRE, 'contactDescription(%s, %s)', contactId, description)
  return PUPPET.throwUnsupportedError()
}

export async function contactList (this: PuppetWhatsApp): Promise<string[]> {
  log.verbose(PRE, 'contactList()')
  const cacheManager = await this.manager.getCacheManager()
  const contactIdList = await cacheManager.getContactIdList()
  return contactIdList
}

export async function contactAvatar(this: PuppetWhatsApp, contactId: string): Promise<FileBox>
export async function contactAvatar(this: PuppetWhatsApp, contactId: string, file: FileBox): Promise<void>

export async function contactAvatar (this: PuppetWhatsApp, contactId: string, file?: FileBox): Promise<void | FileBox> {
  log.verbose(PRE, 'contactAvatar(%s)', contactId)

  if (file) {
    return PUPPET.throwUnsupportedError()
  }
  let avatar: string = ''
  const con = await this.manager.getContactById(contactId)
  try {
    avatar = await con.getProfilePicUrl()
  } catch (err) {
    log.error(PRE, 'contactAvatar(%s) error:%s', contactId, (err as Error).message)
  }
  if (avatar) {
    return FileBox.fromUrl(avatar)
  }
}

export async function contactRawPayload (this: PuppetWhatsApp, id: string): Promise<WhatsAppContactPayload> {
  log.verbose(PRE, 'contactRawPayload(%s)', id)
  if (!isContactId(id)) {
    throw WAError(WA_ERROR_TYPE.ERR_CONTACT_NOT_FOUND, `please check contact id: ${id} again.`)
  }
  const cacheManager = await this.manager.getCacheManager()
  const contact = await cacheManager.getContactOrRoomRawPayload(id)
  if (contact) {
    return contact
  } else {
    const rawContact = await this.manager.getContactById(id)
    const avatar = await rawContact.getProfilePicUrl() || ''
    const contact = Object.assign(rawContact, { avatar })
    await cacheManager.setContactOrRoomRawPayload(id, contact)
    return contact
  }
}

export async function contactRawPayloadParser (this: PuppetWhatsApp, contactPayload: WhatsAppContactPayload): Promise<PUPPET.payloads.Contact> {
  try {
    const userName = this.manager.getWhatsAppClient().info.pushname
    const result = parserContactRawPayload(contactPayload, userName)
    log.verbose(PRE, 'contactRawPayloadParser whatsAppPayload(%s) result(%s)', JSON.stringify(contactPayload), JSON.stringify(result))
    return result
  } catch (error) {
    log.error(PRE, `contactRawPayloadParser(${contactPayload.id._serialized}) failed, error message: ${(error as Error).message}`)
    throw WAError(WA_ERROR_TYPE.ERR_CONTACT_NOT_FOUND, `contactRawPayloadParser(${contactPayload.id._serialized}) failed, error message: ${(error as Error).message}`)
  }
}
