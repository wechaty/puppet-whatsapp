/* eslint-disable no-redeclare */
import * as PUPPET from 'wechaty-puppet'

import {
  FileBox,
} from '../compact/index.js'
import { avatarForContact, PRE } from '../config.js'
import { WA_ERROR_TYPE } from '../exceptions/error-type.js'
import WAError from '../exceptions/whatsapp-error.js'
import { withPrefix } from '../logger/index.js'
import type PuppetWhatsApp from '../puppet-whatsapp.js'
import type { WhatsAppContactPayload } from '../schema/whatsapp-type.js'
import { isContactId } from '../utils.js'

const logger = withPrefix(`${PRE} contact`)

export async function contactAlias (this: PuppetWhatsApp, contactId: string)                       : Promise<string>;
export async function contactAlias (this: PuppetWhatsApp, contactId: string, alias: string | null) : Promise<void>;
export async function contactAlias (this: PuppetWhatsApp, contactId: string, alias?: string | null): Promise<void | string> {
  logger.verbose('contactAlias(%s, %s)', contactId, alias)
  return PUPPET.throwUnsupportedError()
}

export async function contactPhone (this: PuppetWhatsApp, contactId: string): Promise<string[]>
export async function contactPhone (this: PuppetWhatsApp, contactId: string, phoneList: string[]): Promise<void>

export async function contactPhone (this: PuppetWhatsApp, contactId: string, phoneList?: string[]): Promise<string[] | void> {
  logger.info('contactPhone(%s, %s)', contactId, phoneList)
  if (typeof phoneList === 'undefined') {
    const cacheManager = await this.manager.getCacheManager()
    const contact = await cacheManager.getContactOrRoomRawPayload(contactId)
    if (contact) {
      return [contact!.number]
    } else {
      return []
    }
  }
  return PUPPET.throwUnsupportedError()
}

export async function contactCorporationRemark (this: PuppetWhatsApp, contactId: string, corporationRemark: string) {
  logger.verbose('contactCorporationRemark(%s, %s)', contactId, corporationRemark)
  return PUPPET.throwUnsupportedError()
}

export async function contactDescription (this: PuppetWhatsApp, contactId: string, description: string) {
  logger.verbose('contactDescription(%s, %s)', contactId, description)
  return PUPPET.throwUnsupportedError()
}

export async function contactList (this: PuppetWhatsApp): Promise<string[]> {
  logger.info('contactList()')
  const cacheManager = await this.manager.getCacheManager()
  const contactIdList = await cacheManager.getContactIdList()
  return contactIdList
}

export async function contactAvatar (this: PuppetWhatsApp, contactId: string)                : Promise<FileBox>
export async function contactAvatar (this: PuppetWhatsApp, contactId: string, file: FileBox) : Promise<void>

export async function contactAvatar (this: PuppetWhatsApp, contactId: string, file?: FileBox): Promise<void | FileBox> {
  logger.info('contactAvatar(%s)', contactId)

  if (file) {
    return PUPPET.throwUnsupportedError()
  }
  let avatar: string = ''
  const con = await this.manager.getContactById(contactId)
  try {
    avatar = await con.getProfilePicUrl()
  } catch (err) {
    logger.error('contactAvatar(%s) error:%s', contactId, (err as Error).message)
  }
  if (avatar) {
    return FileBox.fromUrl(avatar)
  } else {
    return avatarForContact()
  }

}

export async function contactRawPayload (this: PuppetWhatsApp, id: string): Promise<WhatsAppContactPayload> {
  logger.verbose('contactRawPayload(%s)', id)
  if (!isContactId(id)) {
    throw new WAError(WA_ERROR_TYPE.ERR_CONTACT_NOT_FOUND, `please check contact id: ${id} again.`)
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

export async function contactRawPayloadParser (this: PuppetWhatsApp, contactPayload: WhatsAppContactPayload): Promise<PUPPET.ContactPayload> {
  let type
  if (contactPayload.isUser) {
    type = PUPPET.ContactType.Individual
  } else if (contactPayload.isEnterprise) {
    type = PUPPET.ContactType.Corporation
  } else {
    type = PUPPET.ContactType.Unknown
  }
  let name
  if (contactPayload.isMe) {
    name = contactPayload.pushname || this.manager.getWhatsApp().info.pushname
  } else {
    name = contactPayload.pushname || contactPayload.name
  }
  try {
    return {
      avatar: contactPayload.avatar,
      friend: contactPayload.isWAContact && contactPayload.isUser,
      gender: PUPPET.ContactGender.Unknown,
      id: contactPayload.id._serialized,
      name: name || contactPayload.id._serialized,
      phone: [contactPayload.number],
      type: type,
      weixin: contactPayload.number,
    }
  } catch (error) {
    logger.error(`contactRawPayloadParser(${contactPayload.id._serialized}) failed, error message: ${(error as Error).message}`)
    throw new WAError(WA_ERROR_TYPE.ERR_CONTACT_NOT_FOUND, `contactRawPayloadParser(${contactPayload.id._serialized}) failed, error message: ${(error as Error).message}`)
  }
}
