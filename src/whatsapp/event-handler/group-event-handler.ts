/* eslint-disable no-case-declarations */
import {
  GroupNotificationTypes,
} from '../../schema/whatsapp-interface.js'
import WhatsAppBase from '../whatsapp-base.js'

import type * as PUPPET from 'wechaty-puppet'
import type {
  GroupNotification,
} from '../../schema/whatsapp-type.js'
import { log } from '../../config.js'
import {
  genRoomTopicEvent,
  genRoomAnnounce,
  genRoomJoinEvent,
} from '../../helper/pure-function/room-event-generator.js'

const PRE = 'GroupEventHandler'

export default class GroupEventHandler extends WhatsAppBase {

  public async onRoomJoin (notification: GroupNotification) {
    log.info(PRE, `onRoomJoin(${JSON.stringify(notification)})`)
    const roomId = notification.id.remote
    const roomJoinPayload: PUPPET.payloads.EventRoomJoin = {
      inviteeIdList: notification.recipientIds,
      inviterId: notification.author,
      roomId,
      timestamp: notification.timestamp,
    }
    const cacheManager = await this.manager.getCacheManager()
    await cacheManager.addRoomMemberToList(roomId, notification.recipientIds)
    this.emit('room-join', roomJoinPayload)
  }

  public async onRoomLeave (notification: GroupNotification) {
    log.info(PRE, `onRoomLeave(${JSON.stringify(notification)})`)
    const { id, recipientIds } = notification
    const roomId = id.remote
    const isLeaveSelf = id.fromMe && recipientIds.length === 1 &&  recipientIds[0] === this.getBotId()
    const roomLeavePayload: PUPPET.payloads.EventRoomLeave = {
      removeeIdList: notification.recipientIds,
      removerId: notification.author || isLeaveSelf ? this.getBotId() : '',
      roomId,
      timestamp: notification.timestamp,
    }
    const cacheManager = await this.manager.getCacheManager()
    await cacheManager.removeRoomMemberFromList(roomId, notification.recipientIds)
    this.emit('room-leave', roomLeavePayload)
  }

  public async onRoomUpdate (notification: GroupNotification) {
    log.info(PRE, `onRoomUpdate(${JSON.stringify(notification)})`)
    const roomId = notification.id.remote
    const cacheManager = await this.manager.getCacheManager()
    let roomPayload = await cacheManager.getContactOrRoomRawPayload(roomId)

    if (!roomPayload) {
      const rawRoom = await this.manager.requestManager.getContactById(roomId)
      const avatar = await rawRoom.getProfilePicUrl()
      roomPayload = Object.assign(rawRoom, { avatar })
      await cacheManager.setContactOrRoomRawPayload(roomId, roomPayload)
    }
    const type = notification.type
    switch (type) {
      case GroupNotificationTypes.SUBJECT:
        const roomTopicPayload = genRoomTopicEvent(notification, roomPayload)
        roomPayload.name = notification.body
        await cacheManager.setContactOrRoomRawPayload(roomId, roomPayload)
        this.emit('room-topic', roomTopicPayload)
        break
      case GroupNotificationTypes.DESCRIPTION:
        const roomChat = await this.manager.getRoomChatById(roomId)
        const roomMetadata = roomChat.groupMetadata
        const description = roomMetadata.desc
        const msgPayload = genRoomAnnounce(notification, description)
        await this.manager.processMessage(msgPayload as any) // FIXME: how to use method of another class which extends from the same base class.
        break
      case GroupNotificationTypes.CREATE:
        const members = await this.manager.syncRoomMemberList(roomId)
        const roomJoinPayload = genRoomJoinEvent(notification, members)
        this.emit('room-join', roomJoinPayload)
        break
      case GroupNotificationTypes.PICTURE:
        const rawRoom = await this.manager.requestManager.getContactById(roomId)
        const avatar = await rawRoom.getProfilePicUrl() || ''
        const roomPayloadInCache = await cacheManager.getContactOrRoomRawPayload(roomId)
        if (roomPayloadInCache) {
          roomPayloadInCache.avatar = avatar
          await cacheManager.setContactOrRoomRawPayload(roomId, roomPayloadInCache)
        }
        break
    }
  }

}
