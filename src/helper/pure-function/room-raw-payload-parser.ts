import type * as PUPPET from 'wechaty-puppet'
import { WA_ERROR_TYPE } from '../../exception/error-type.js'
import WAError from '../../exception/whatsapp-error.js'
import type { WhatsAppContactPayload as RoomPayload, GroupChat } from '../../schema/whatsapp-type.js'

export function parserRoomRawPayload (roomChat: GroupChat, roomPayload: RoomPayload): PUPPET.payloads.Room {
  const roomId = roomPayload.id._serialized
  if (roomChat.participants.length === 0) {
    throw WAError(WA_ERROR_TYPE.ERR_ROOM_NOT_FOUND, `roomRawPayloadParser(${roomId}) can not get chat info for this room.`)
  }
  return {
    adminIdList: roomChat.participants.filter(m => m.isAdmin || m.isSuperAdmin).map(m => m.id._serialized),
    avatar: roomPayload.avatar,
    id: roomId,
    memberIdList: roomChat.participants.map(m => m.id._serialized),
    ownerId: roomChat.owner?._serialized,
    topic: roomPayload.name || roomPayload.pushname || '',
  }
}
