/* eslint-disable no-redeclare */
import * as PUPPET from 'wechaty-puppet'

import {
  FileBox,
} from '../compact/index.js'
import { verbose } from '../logger/index.js'
import type { PuppetWhatsapp } from '../puppet-whatsapp.js'
import type { Contact } from '../schema'

async function contactAlias (this: PuppetWhatsapp, contactId: string)                       : Promise<string>;
async function contactAlias (this: PuppetWhatsapp, contactId: string, alias: string | null) : Promise<void>;
async function contactAlias (this: PuppetWhatsapp, contactId: string, alias?: string | null): Promise<void | string> {
  verbose('contactAlias(%s, %s)', contactId, alias)
  return PUPPET.throwUnsupportedError()
}

async function contactPhone (this: PuppetWhatsapp, contactId: string): Promise<string[]>
async function contactPhone (this: PuppetWhatsapp, contactId: string, phoneList: string[]): Promise<void>

async function contactPhone (this: PuppetWhatsapp, contactId: string, phoneList?: string[]): Promise<string[] | void> {
  verbose('contactPhone(%s, %s)', contactId, phoneList)
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

async function  contactCorporationRemark (this: PuppetWhatsapp, contactId: string, corporationRemark: string) {
  verbose('contactCorporationRemark(%s, %s)', contactId, corporationRemark)
  return PUPPET.throwUnsupportedError()
}

async function  contactDescription (this: PuppetWhatsapp, contactId: string, description: string) {
  verbose('contactDescription(%s, %s)', contactId, description)
  return PUPPET.throwUnsupportedError()
}

async function  contactList (this: PuppetWhatsapp): Promise<string[]> {
  verbose('contactList()')
  const cacheManager = await this.manager.getCacheManager()
  const contactIdList = await cacheManager.getContactIdList()
  return contactIdList
}

async function contactAvatar (this: PuppetWhatsapp, contactId: string)                : Promise<FileBox>
async function contactAvatar (this: PuppetWhatsapp, contactId: string, file: FileBox) : Promise<void>

async function contactAvatar (this: PuppetWhatsapp, contactId: string, file?: FileBox): Promise<void | FileBox> {
  verbose('contactAvatar(%s)', contactId)

  if (file) {
    return PUPPET.throwUnsupportedError()
  }

  const con = await this.manager.getContactById(contactId)
  const avatar = await con.getProfilePicUrl()
  return FileBox.fromUrl(avatar)
}

async function contactRawPayloadParser (this: PuppetWhatsapp, whatsAppPayload: Contact): Promise<PUPPET.ContactPayload> {
  let type
  if (whatsAppPayload.isUser) {
    type = PUPPET.ContactType.Individual
  } else if (whatsAppPayload.isEnterprise) {
    type = PUPPET.ContactType.Corporation
  } else {
    type = PUPPET.ContactType.Unknown
  }

  return {
    avatar: await whatsAppPayload.getProfilePicUrl(),
    friend: whatsAppPayload.isWAContact && whatsAppPayload.isUser && !whatsAppPayload.isMe,
    gender: PUPPET.ContactGender.Unknown,
    id: whatsAppPayload.id._serialized,
    name: !whatsAppPayload.isMe ? whatsAppPayload.pushname : whatsAppPayload.pushname || this.manager.whatsapp?.info.pushname || '',
    phone: [whatsAppPayload.number],
    type: type,
    weixin: whatsAppPayload.number,
  }
}

async function contactRawPayload (this: PuppetWhatsapp, id: string): Promise<Contact> {
  verbose('contactRawPayload(%s)', id)
  const cacheManager = await this.manager.getCacheManager()
  const contact = await cacheManager.getContactOrRoomRawPayload(id)
  if (contact) {
    return contact
  } else {
    const rawContact = await this.manager.getContactById(id)
    await cacheManager.setContactOrRoomRawPayload(id, rawContact)
    return rawContact
  }
}

export {
  contactAlias,
  contactPhone,
  contactCorporationRemark,
  contactDescription,
  contactList,
  contactAvatar,
  contactRawPayloadParser,
  contactRawPayload,
}
