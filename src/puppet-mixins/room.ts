/* eslint-disable no-redeclare */
import * as PUPPET from 'wechaty-puppet-1.0-migration'
import { log, FileBox } from 'wechaty-puppet-1.0-migration'
import type { GroupChat } from 'whatsapp-web.js'
import type WAWebJS from 'whatsapp-web.js'
import { PRE, avatarForGroup, log } from '../config.js'
import { WA_ERROR_TYPE } from '../exceptions/error-type.js'
import WAError from '../exceptions/whatsapp-error.js'
import type { PuppetWhatsapp } from '../puppet-whatsapp'
import type { WhatsappContact } from '../whatsapp'

export async function roomRawPayloadParser (this: PuppetWhatsapp, whatsAppPayload: WhatsappContact): Promise<PUPPET.RoomPayload> {
  const chat = await this.manager.getChatById(whatsAppPayload.id._serialized) as GroupChat
  return {
    adminIdList: chat.participants.filter(p => p.isAdmin || p.isSuperAdmin).map(p => p.id._serialized),
    avatar: await whatsAppPayload.getProfilePicUrl(),
    id: whatsAppPayload.id._serialized,
    memberIdList: chat.participants.map(p => p.id._serialized),
    topic: whatsAppPayload.name || whatsAppPayload.pushname || '',
  }
}

export async function roomRawPayload (this: PuppetWhatsapp, id: string): Promise<WhatsappContact> {
  log.verbose(PRE, 'roomRawPayload(%s)', id)
  const cacheManager = await this.manager.getCacheManager()
  const room = await cacheManager.getContactOrRoomRawPayload(id)
  if (room) {
    return room
  } else {
    const rawRoom = await this.manager.getContactById(id)
    await cacheManager.setContactOrRoomRawPayload(id, rawRoom)
    return rawRoom
  }
}

export async function roomList (this: PuppetWhatsapp): Promise<string[]> {
  log.verbose(PRE, 'roomList()')
  const cacheManager = await this.manager.getCacheManager()
  const roomIdList = await cacheManager.getRoomIdList()
  return roomIdList
}

export async function roomDel (
  this: PuppetWhatsapp,
  roomId: string,
  contactId: string,
): Promise<void> {
  log.verbose(PRE, 'roomDel(%s, %s)', roomId, contactId)
  const chat = await this.manager.getChatById(roomId) as GroupChat
  await chat.removeParticipants([contactId])
}

export async function roomAvatar (this: PuppetWhatsapp, roomId: string): Promise<FileBox> {
  log.verbose(PRE, 'roomAvatar(%s)', roomId)

  const payload = await this.roomPayload(roomId)

  if (payload.avatar) {
    return FileBox.fromUrl(payload.avatar)
  }
  log.warn(PRE, 'roomAvatar() avatar not found, use the chatie default.')
  return avatarForGroup()
}

export async function roomAdd (
  this: PuppetWhatsapp,
  roomId: string,
  contactId: string,
): Promise<void> {
  log.verbose(PRE, 'roomAdd(%s, %s)', roomId, contactId)
  const chat = await this.manager.getChatById(roomId) as GroupChat
  await chat.addParticipants([contactId])
}

export async function roomTopic(this: PuppetWhatsapp, roomId: string): Promise<string>
export async function roomTopic(this: PuppetWhatsapp, roomId: string, topic: string): Promise<void>

export async function roomTopic (
  this: PuppetWhatsapp,
  roomId: string,
  topic?: string,
): Promise<void | string> {
  log.verbose(PRE, 'roomTopic(%s, %s)', roomId, topic)

  if (typeof topic === 'undefined') {
    const cacheManager = await this.manager.getCacheManager()
    const room = await cacheManager.getContactOrRoomRawPayload(roomId)
    if (!room) {
      throw new WAError(WA_ERROR_TYPE.ERR_ROOM_NOT_FOUND, `Can not find this room: ${roomId}`)
    }
    return room.name
  }
  const chat = await this.manager.getChatById(roomId) as GroupChat
  if (chat.isGroup) {
    await chat.setSubject(topic)
  }
  await this.dirtyPayload(PUPPET.PayloadType.Room, roomId)
}

export async function roomCreate (
  this: PuppetWhatsapp,
  contactIdList: string[],
  topic: string,
): Promise<string> {
  log.verbose(PRE, 'roomCreate(%s, %s)', contactIdList, topic)
  const group = await this.manager.createRoom(topic, contactIdList)
  if (group.gid) {
    return group.gid
  } else {
    throw new WAError(WA_ERROR_TYPE.ERR_CREATE_ROOM, 'An error occurred while creating the group!')
  }
}

export async function roomQuit (this: PuppetWhatsapp, roomId: string): Promise<void> {
  log.verbose(PRE, 'roomQuit(%s)', roomId)
  const chat = await this.manager.getChatById(roomId) as GroupChat
  await chat.leave()
}

export async function roomQRCode (this: PuppetWhatsapp, roomId: string): Promise<string> {
  log.verbose(PRE, 'roomQRCode(%s)', roomId)
  const con = await this.manager.getChatById(roomId) as GroupChat
  const code = await con.getInviteCode()
  const url = `https://chat.whatsapp.com/${code}`
  return url
}

export async function roomMemberList (this: PuppetWhatsapp, roomId: string): Promise<string[]> {
  log.verbose(PRE, 'roomMemberList(%s)', roomId)
  const chat = await this.manager.getChatById(roomId) as GroupChat
  return chat.participants.map(p => p.id._serialized)
}

export async function roomMemberRawPayload (this: PuppetWhatsapp, roomId: string, contactId: string): Promise<PUPPET.RoomMemberPayload> {
  log.verbose(PRE, 'roomMemberRawPayload(%s, %s)', roomId, contactId)
  const contact = await this.manager.getContactById(contactId)
  const avatar = await contact.getProfilePicUrl()
  return {
    avatar,
    id: contact.id._serialized,
    name: contact.pushname || contact.name || '',
    // roomAlias : contact.name,
  }
}

export async function roomMemberRawPayloadParser (this: PuppetWhatsapp, rawPayload: PUPPET.RoomMemberPayload): Promise<PUPPET.RoomMemberPayload> {
  log.verbose(PRE, 'roomMemberRawPayloadParser(%O)', rawPayload)
  return rawPayload
}

export async function roomAnnounce(this: PuppetWhatsapp, roomId: string): Promise<string>
export async function roomAnnounce(this: PuppetWhatsapp, roomId: string, text: string): Promise<void>

export async function roomAnnounce (this: PuppetWhatsapp, roomId: string, text?: string): Promise<void | string> {
  return PUPPET.throwUnsupportedError()
}

/**
*
* Room Invitation
*
*/
export async function roomInvitationAccept (this: PuppetWhatsapp, roomInvitationId: string): Promise<void> {
  log.verbose(PRE, 'roomInvitationAccept(%s)', roomInvitationId)
  const cacheManager = await this.manager.getCacheManager()

  const info = await cacheManager.getRoomInvitationRawPayload(roomInvitationId)
  if (info) {
    if (Object.keys(info).length === 1) {
      await this.manager.acceptRoomInvite(info.inviteCode!)
    } else {
      await this.manager.acceptPrivateRoomInvite(info as WAWebJS.InviteV4Data)
    }

  }
}

export async function roomInvitationRawPayload (this: PuppetWhatsapp, roomInvitationId: string): Promise<any> {
  log.verbose(PRE, 'roomInvitationRawPayload(%s)', roomInvitationId)
  return PUPPET.throwUnsupportedError()
}

export async function roomInvitationRawPayloadParser (this: PuppetWhatsapp, rawPayload: any): Promise<PUPPET.RoomInvitationPayload> {
  log.verbose(PRE, 'roomInvitationRawPayloadParser(%s)', JSON.stringify(rawPayload))
  return rawPayload
}
