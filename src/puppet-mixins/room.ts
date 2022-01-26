/* eslint-disable no-redeclare */
import * as PUPPET from 'wechaty-puppet'
import { FileBox } from '../compact/index.js'
import { avatarForGroup } from '../config.js'
import { WA_ERROR_TYPE } from '../exceptions/error-type.js'
import WAError from '../exceptions/whatsapp-error.js'
import type { PuppetWhatsapp } from '../puppet-whatsapp'
import type { ContactPayload, InviteV4Data, GroupChat } from '../schema/index.js'
import { logger } from '../logger/index.js'
import { contactRawPayload } from './contact.js'

export async function roomRawPayload (this: PuppetWhatsapp, id: string): Promise<ContactPayload> {
  logger.verbose('roomRawPayload(%s)', id)
  const cacheManager = await this.manager.getCacheManager()
  const room = await cacheManager.getContactOrRoomRawPayload(id)
  if (room) {
    return room
  } else {
    const rawRoom = await this.manager.getContactById(id)
    const avatar = await rawRoom.getProfilePicUrl()
    const room = Object.assign(rawRoom, { avatar })
    await cacheManager.setContactOrRoomRawPayload(id, room)
    return room
  }
}

export async function roomRawPayloadParser (this: PuppetWhatsapp, whatsAppPayload: ContactPayload): Promise<PUPPET.RoomPayload> {
  const chat = await this.manager.getChatById(whatsAppPayload.id._serialized) as GroupChat
  return {
    adminIdList: chat.participants.filter(m => m.isAdmin || m.isSuperAdmin).map(m => m.id._serialized),
    avatar: whatsAppPayload.avatar,
    id: whatsAppPayload.id._serialized,
    memberIdList: chat.participants.map(m => m.id._serialized),
    ownerId: chat.owner._serialized,
    topic: whatsAppPayload.name || whatsAppPayload.pushname || '',
  }
}

export async function roomList (this: PuppetWhatsapp): Promise<string[]> {
  logger.verbose('roomList()')
  const cacheManager = await this.manager.getCacheManager()
  const roomIdList = await cacheManager.getRoomIdList()
  return roomIdList
}

export async function roomDel (
  this: PuppetWhatsapp,
  roomId: string,
  contactId: string,
): Promise<void> {
  logger.info('roomDel(%s, %s)', roomId, contactId)
  const chat = await this.manager.getChatById(roomId) as GroupChat
  await chat.removeParticipants([contactId])
}

export async function roomAvatar (this: PuppetWhatsapp, roomId: string): Promise<FileBox> {
  logger.info('roomAvatar(%s)', roomId)

  const payload = await this.roomPayload(roomId)

  if (payload.avatar) {
    return FileBox.fromUrl(payload.avatar)
  }
  logger.warn('roomAvatar() avatar not found, use the chatie default.')
  return avatarForGroup()
}

export async function roomAdd (
  this: PuppetWhatsapp,
  roomId: string,
  contactId: string,
): Promise<void> {
  logger.info('roomAdd(%s, %s)', roomId, contactId)
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
  logger.info('roomTopic(%s, %s)', roomId, topic)

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
  logger.info('roomCreate(%s, %s)', contactIdList, topic)
  const group = await this.manager.createRoom(topic, contactIdList)
  if (group.gid) {
    return group.gid
  } else {
    throw new WAError(WA_ERROR_TYPE.ERR_CREATE_ROOM, 'An error occurred while creating the group!')
  }
}

export async function roomQuit (this: PuppetWhatsapp, roomId: string): Promise<void> {
  logger.info('roomQuit(%s)', roomId)
  const chat = await this.manager.getChatById(roomId) as GroupChat
  await chat.leave()
}

export async function roomQRCode (this: PuppetWhatsapp, roomId: string): Promise<string> {
  logger.info('roomQRCode(%s)', roomId)
  const con = await this.manager.getChatById(roomId) as GroupChat
  const code = await con.getInviteCode()
  const url = `https://chat.whatsapp.com/${code}`
  return url
}

export async function roomMemberList (this: PuppetWhatsapp, roomId: string): Promise<string[]> {
  logger.info('roomMemberList(%s)', roomId)
  const chat = await this.manager.getChatById(roomId) as GroupChat
  // FIXME: How to deal with pendingParticipants? Maybe we should find which case could has this attribute.
  return chat.participants.map(p => p.id._serialized)
}

export async function roomMemberRawPayload (this: PuppetWhatsapp, roomId: string, contactId: string): Promise<PUPPET.RoomMemberPayload> {
  logger.verbose('roomMemberRawPayload(%s, %s)', roomId, contactId)
  const contact = await contactRawPayload.call(this, contactId)
  return {
    avatar: contact.avatar,
    id: contact.id._serialized,
    name: contact.pushname || contact.name || '',
    // roomAlias : contact.name,
  }
}

export async function roomMemberRawPayloadParser (this: PuppetWhatsapp, rawPayload: PUPPET.RoomMemberPayload): Promise<PUPPET.RoomMemberPayload> {
  logger.verbose('roomMemberRawPayloadParser(%O)', rawPayload)
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
  logger.verbose('roomInvitationAccept(%s)', roomInvitationId)

  const info = await roomInvitationRawPayload.call(this, roomInvitationId)

  if (Object.keys(info).length === 1) {
    await this.manager.acceptRoomInvite(info.inviteCode!)
  } else {
    await this.manager.acceptPrivateRoomInvite(info as InviteV4Data)
  }

}

export async function roomInvitationRawPayload (this: PuppetWhatsapp, roomInvitationId: string): Promise<Partial<InviteV4Data>> {
  logger.verbose('roomInvitationRawPayload(%s)', roomInvitationId)
  const cacheManager = await this.manager.getCacheManager()
  const info = await cacheManager.getRoomInvitationRawPayload(roomInvitationId)
  if (info) {
    return info
  } else {
    return {
      inviteCode: roomInvitationId,
    }
  }
}

/**
 *
 * @param this PuppetWhatsapp
 * @param rawPayload Partial<InviteV4Data>
 * @returns Partial<InviteV4Data>
 * TODO: Here we return Partial<InviteV4Data> for roomInvitationAccept usage, We may need other fields required by RoomInvitationPayload
 */
export async function roomInvitationRawPayloadParser (this: PuppetWhatsapp, rawPayload: any): Promise<PUPPET.RoomInvitationPayload> {
  logger.verbose('roomInvitationRawPayloadParser(%s)', JSON.stringify(rawPayload))
  return rawPayload
}
