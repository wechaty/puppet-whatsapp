/* eslint-disable no-redeclare */
import * as PUPPET from 'wechaty-puppet'
import { FileBox } from '../compact/index.js'
import { avatarForGroup, PRE } from '../config.js'
import { WA_ERROR_TYPE } from '../exceptions/error-type.js'
import WAError from '../exceptions/whatsapp-error.js'
import { withPrefix } from '../logger/index.js'
import { isRoomId } from '../utils.js'
import { contactRawPayload } from './contact.js'

import type PuppetWhatsApp from '../puppet-whatsapp'
import type {
  WhatsAppContactPayload as RoomPayload,
  InviteV4Data,
} from '../schema/whatsapp-type.js'

const logger = withPrefix(`${PRE} room`)

export async function roomList (this: PuppetWhatsApp): Promise<string[]> {
  logger.verbose('roomList()')
  const cacheManager = await this.manager.getCacheManager()
  const roomIdList = await cacheManager.getRoomIdList()
  return roomIdList
}

/**
 * Filter friend list and non-friend list from member id list
 * @param { PuppetWhatsApp } this
 * @param { string[] } memberIdList
 * @returns { friendsList: string[]; nonFriendsList: string[]; }
 */
async function checkRoomMember (this: PuppetWhatsApp, memberIdList: string[]) {
  const friendsList = []
  const nonFriendsList = []
  for (const memberId of memberIdList) {
    const memberPayload = await this.manager.getContactById(memberId)
    if (memberPayload.isMyContact) {
      friendsList.push(memberId)
    } else {
      nonFriendsList.push(memberId)
    }
  }

  const botId = this.manager.getBotId()
  if (!friendsList.includes(botId)) {
    friendsList.push(botId)
  }

  return {
    friendsList,
    nonFriendsList,
  }
}

async function updateRoomRawPayloadToCache (
  this: PuppetWhatsApp,
  roomId: string,
  params: {
    name?: string,
    avatar?: string,
    memberIdList?: string[],
  },
): Promise<RoomPayload | undefined> {
  const { name, avatar, memberIdList } = params
  const cacheManager = await this.manager.getCacheManager()
  const roomInCache = await cacheManager.getContactOrRoomRawPayload(roomId)
  if (roomInCache) {
    if (name) {
      roomInCache.name = name
    }
    if (avatar) {
      roomInCache.avatar = avatar
    }
    if (memberIdList && memberIdList.length > 0) {
      await cacheManager.setRoomMemberIdList(roomId, memberIdList)
    }
    await cacheManager.setContactOrRoomRawPayload(roomId, roomInCache)
  }
  return roomInCache
}

export async function roomCreate (
  this: PuppetWhatsApp,
  contactIdList: string[],
  topic: string,
): Promise<string> {
  logger.info('roomCreate(%s, %s)', contactIdList, topic)
  const { friendsList, nonFriendsList } = await checkRoomMember.call(this, contactIdList)
  const group = await this.manager.createRoom(topic, friendsList)
  const roomId = group.gid._serialized
  if (roomId) {
    if (nonFriendsList.length > 0) {
      await addMemberListToRoom.call(this, roomId, nonFriendsList)
    }
    await updateRoomRawPayloadToCache.call(this, roomId, {
      memberIdList: contactIdList,
      name: topic,
    })
    return roomId
  } else {
    throw new WAError(WA_ERROR_TYPE.ERR_CREATE_ROOM, `An error occurred while creating the group, detail: ${contactIdList}, topic: ${topic}`)
  }
}

export async function roomAdd (
  this: PuppetWhatsApp,
  roomId: string,
  contactId: string,
): Promise<void> {
  logger.info('roomAdd(%s, %s)', roomId, contactId)
  await addMemberListToRoom.call(this, roomId, contactId)
}

async function addMemberListToRoom (
  this: PuppetWhatsApp,
  roomId: string,
  contactIds: string | string[],
) {
  const roomChat = await this.manager.getRoomChatById(roomId)
  const contactIdList = Array.isArray(contactIds) ? contactIds : [contactIds]
  await roomChat.addParticipants(contactIdList)
  const cacheManager = await this.manager.getCacheManager()
  await cacheManager.addRoomMemberToList(roomId, contactIds)
}

export async function roomDel (
  this: PuppetWhatsApp,
  roomId: string,
  contactId: string,
): Promise<void> {
  logger.info('roomDel(%s, %s)', roomId, contactId)
  const roomChat = await this.manager.getRoomChatById(roomId)
  await roomChat.removeParticipants([contactId])
  const cacheManager = await this.manager.getCacheManager()
  await cacheManager.removeRoomMemberFromList(roomId, contactId)
}

export async function roomQuit (this: PuppetWhatsApp, roomId: string): Promise<void> {
  logger.info('roomQuit(%s)', roomId)
  const roomChat = await this.manager.getRoomChatById(roomId)
  await roomChat.leave()
  const cacheManager = await this.manager.getCacheManager()
  await cacheManager.deleteContactOrRoom(roomId)
  await cacheManager.deleteRoomMemberIdList(roomId)
}

export async function roomAvatar (this: PuppetWhatsApp, roomId: string): Promise<FileBox> {
  logger.info('roomAvatar(%s)', roomId)

  const payload = await this.roomPayload(roomId)

  if (payload.avatar) {
    return FileBox.fromUrl(payload.avatar)
  }
  logger.warn('roomAvatar() avatar not found, use the chatie default.')
  return avatarForGroup()
}

export async function roomTopic(this: PuppetWhatsApp, roomId: string): Promise<string>
export async function roomTopic(this: PuppetWhatsApp, roomId: string, topic: string): Promise<void>

export async function roomTopic (
  this: PuppetWhatsApp,
  roomId: string,
  topic?: string,
): Promise<void | string> {
  logger.info('roomTopic(%s, %s)', roomId, topic)

  if (typeof topic === 'undefined') {
    const payload = await this.roomPayload(roomId)
    return payload.topic
  }
  const roomChat = await this.manager.getRoomChatById(roomId)
  if (roomChat.isGroup) {
    await roomChat.setSubject(topic)
  }
  await this.dirtyPayload(PUPPET.PayloadType.Room, roomId)
}

export async function roomQRCode (this: PuppetWhatsApp, roomId: string): Promise<string> {
  logger.info('roomQRCode(%s)', roomId)
  const roomChat = await this.manager.getRoomChatById(roomId)
  const code = await roomChat.getInviteCode()
  const url = `https://chat.whatsapp.com/${code}`
  return url
}

/**
 * Get member id list from cache
 * @param { PuppetWhatsApp } this whatsapp client
 * @param { string } roomId roomId
 * @returns { string[] } member id list
 */
export async function roomMemberList (this: PuppetWhatsApp, roomId: string): Promise<string[]> {
  logger.info('roomMemberList(%s)', roomId)
  const cacheManager = await this.manager.getCacheManager()
  const memberList = await cacheManager.getRoomMemberIdList(roomId)
  if (memberList.length === 0) {
    return this.manager.roomMemberListSync(roomId)
  }
  return memberList
}

export async function roomMemberRawPayload (this: PuppetWhatsApp, roomId: string, contactId: string): Promise<PUPPET.RoomMemberPayload> {
  logger.verbose('roomMemberRawPayload(%s, %s)', roomId, contactId)
  const member = await contactRawPayload.call(this, contactId)
  return {
    avatar: member.avatar,
    id: member.id._serialized,
    name: member.pushname || member.name || '',
    // roomAlias : contact.name,
  }
}

export async function roomMemberRawPayloadParser (this: PuppetWhatsApp, rawPayload: PUPPET.RoomMemberPayload): Promise<PUPPET.RoomMemberPayload> {
  logger.verbose('roomMemberRawPayloadParser(%O)', rawPayload)
  return rawPayload
}

export async function roomAnnounce(this: PuppetWhatsApp, roomId: string): Promise<string>
export async function roomAnnounce(this: PuppetWhatsApp, roomId: string, text: string): Promise<void>

export async function roomAnnounce (this: PuppetWhatsApp, roomId: string, text?: string): Promise<void | string> {
  if (typeof text === 'undefined') {
    const roomChat = await this.manager.getRoomChatById(roomId)
    return roomChat.description
  }
  const roomChat = await this.manager.getRoomChatById(roomId)
  await roomChat.setDescription(text)
  await this.dirtyPayload(PUPPET.PayloadType.Room, roomId)
}

/**
*
* Room Invitation
*
*/
export async function roomInvitationAccept (this: PuppetWhatsApp, roomInvitationId: string): Promise<void> {
  logger.verbose('roomInvitationAccept(%s)', roomInvitationId)

  const info = await roomInvitationRawPayload.call(this, roomInvitationId)

  if (Object.keys(info).length === 1) {
    await this.manager.acceptRoomInvite(info.inviteCode!)
  } else {
    await this.manager.acceptPrivateRoomInvite(info as InviteV4Data)
  }

}

export async function roomInvitationRawPayload (this: PuppetWhatsApp, roomInvitationId: string): Promise<Partial<InviteV4Data>> {
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
export async function roomInvitationRawPayloadParser (this: PuppetWhatsApp, rawPayload: any): Promise<PUPPET.RoomInvitationPayload> {
  logger.verbose('roomInvitationRawPayloadParser(%s)', JSON.stringify(rawPayload))
  return rawPayload
}

export async function roomRawPayload (this: PuppetWhatsApp, id: string): Promise<RoomPayload> {
  logger.verbose('roomRawPayload(%s)', id)
  if (!isRoomId(id)) {
    throw new WAError(WA_ERROR_TYPE.ERR_ROOM_NOT_FOUND, `please check room id: ${id} again.`)
  }
  const cacheManager = await this.manager.getCacheManager()
  const room = await cacheManager.getContactOrRoomRawPayload(id)
  if (room) {
    return room
  } else {
    try {
      const rawRoom = await this.manager.getContactById(id)
      const avatar = await rawRoom.getProfilePicUrl() || ''
      const room = Object.assign(rawRoom, { avatar })
      await cacheManager.setContactOrRoomRawPayload(id, room)
      return room
    } catch (error) {
      throw new WAError(WA_ERROR_TYPE.ERR_ROOM_NOT_FOUND, `roomRawPayload(${id}) not found.`)
    }
  }
}

export async function roomRawPayloadParser (this: PuppetWhatsApp, roomPayload: RoomPayload): Promise<PUPPET.RoomPayload> {
  const roomId = roomPayload.id._serialized
  try {
    const roomChat = await this.manager.getRoomChatById(roomId)
    if (roomChat.participants.length === 0) {
      throw new WAError(WA_ERROR_TYPE.ERR_ROOM_NOT_FOUND, `roomRawPayloadParser(${roomId}) can not get chat info for this room.`)
    }
    return {
      adminIdList: roomChat.participants.filter(m => m.isAdmin || m.isSuperAdmin).map(m => m.id._serialized),
      avatar: roomPayload.avatar,
      id: roomId,
      memberIdList: roomChat.participants.map(m => m.id._serialized),
      ownerId: roomChat.owner?._serialized,
      topic: roomPayload.name || roomPayload.pushname || '',
    }
  } catch (error) {
    logger.error(`roomRawPayloadParser(${roomId}) failed, error message: ${(error as Error).message}`)
    throw new WAError(WA_ERROR_TYPE.ERR_ROOM_NOT_FOUND, `roomRawPayloadParser(${roomId}) failed, error message: ${(error as Error).message}`)
  }
}
