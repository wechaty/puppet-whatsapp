/**
 *   Wechaty - https://github.com/chatie/wechaty
 *
 *   @copyright 2016-2018 Huan LI <zixia@zixia.net>
 *
 *   Licensed under the Apache License, Version 2.0 (the "License");
 *   you may not use this file except in compliance with the License.
 *   You may obtain a copy of the License at
 *
 *       http://www.apache.org/licenses/LICENSE-2.0
 *
 *   Unless required by applicable law or agreed to in writing, software
 *   distributed under the License is distributed on an "AS IS" BASIS,
 *   WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 *   See the License for the specific language governing permissions and
 *   limitations under the License.
 *
 */
import * as PUPPET from 'wechaty-puppet-1.0-migration'
import type { MemoryCard } from 'memory-card'

import {
  MEMORY_SLOT,
  VERSION,
} from './config.js'
import { logger } from './logger/index.js'
import { contactSelfName, contactSelfQRCode, contactSelfSignature } from './puppet-mixins/contact-self.js'
import { contactAlias, contactAvatar, contactCorporationRemark, contactDescription, contactList, contactPhone, contactRawPayload, contactRawPayloadParser } from './puppet-mixins/contact.js'
import { conversationReadMark } from './puppet-mixins/conversation.js'
import { messageContact, messageImage, messageRecall, messageFile, messageUrl, messageMiniProgram, messageSendText, messageSendFile, messageSendContact, messageSendMiniProgram, messageForward, messageRawPayload, messageSendUrl } from './puppet-mixins/message.js'
import { messageRawPayloadParser } from './pure-function-helpers/message-raw-payload-parse.js'
import { roomRawPayloadParser, roomRawPayload, roomList, roomDel, roomAvatar, roomAdd, roomTopic, roomCreate, roomQuit, roomQRCode, roomMemberList, roomMemberRawPayload, roomMemberRawPayloadParser, roomAnnounce, roomInvitationAccept, roomInvitationRawPayload, roomInvitationRawPayloadParser } from './puppet-mixins/room.js'
import { friendshipRawPayload, friendshipRawPayloadParser, friendshipSearchPhone, friendshipSearchWeixin, friendshipAdd, friendshipAccept } from './puppet-mixins/friendship.js'
import { tagContactAdd, tagContactRemove, tagContactDelete, tagContactList } from './puppet-mixins/tag.js'

import { Manager } from './manager.js'
import { WA_ERROR_TYPE } from './exceptions/error-type.js'
import WAError from './exceptions/whatsapp-error.js'
import { ClientOptions, EventName } from './schema/index.js'
import type { WhatsApp } from './whatsapp.js'

process.on('uncaughtException', (e) => {
  console.error('process error is:', e.message)
})

export type PuppetWhatsAppOptions = PUPPET.PuppetOptions & {
  memory?: MemoryCard
  puppeteerOptions?: ClientOptions
}

const EVENT_LOG_PRE = 'EVENT_LOG'
class PuppetWhatsapp extends PUPPET.Puppet {

  static override readonly VERSION = VERSION

  public manager: Manager

  constructor (
    override options: PuppetWhatsAppOptions = {},
  ) {
    super(options)
    this.manager = new Manager(this.options)
  }

  override async onStart (): Promise<void> {
    logger.info('onStart()')
    if (this.state.active()) {
      return
    }

    this.state.active('pending')
    let whatsapp: WhatsApp

    try {
      whatsapp = await this.startManager(this.manager)
    } catch (err) {
      logger.error(`Can not start whatsapp, error: ${(err as Error).message}`)
      throw new WAError(WA_ERROR_TYPE.ERR_INIT, `Can not start whatsapp, error: ${(err as Error).message}`)
    }

    /**
     * Huan(202102): Wait for Puppeteer to be inited before resolve start() for robust state management
     */
    const { state } = this
    const future = new Promise<void>(resolve => {
      function check () {
        if (whatsapp.pupBrowser) {
          resolve(state.active(true))
        } else {
          setTimeout(check, 100)
        }
      }

      check()
    })

    return future
  }

  private async startManager (manager: Manager) {
    manager
      .on('heartbeat', data => this.emit('heartbeat', { data }))
      .on('error',     this.onError.bind(this))
      .on('scan',      this.onScan.bind(this))
      .on('reset',     this.onReset.bind(this))
      .on('login',     this.onLogin.bind(this))
      .on('logout',    this.onLogout.bind(this))
      .on('message',   this.onMessage.bind(this))
      .on('friendship',  this.onFriendship.bind(this))
      .on('room-join',  this.onRoomJoin.bind(this))
      .on('room-leave', this.onRoomLeave.bind(this))
      .on('room-topic', this.onRoomTopic.bind(this))
      .on('room-invite', this.onRoomInvite.bind(this))
      .on('ready',      this.onReady.bind(this))
      .on('dirty', this.onDirty.bind(this))

    const session = await this.memory.get(MEMORY_SLOT)
    const whatsapp = await manager.start(session)
    return whatsapp
  }

  override async onStop (): Promise<void> {
    logger.info('onStop()')
    if (this.state.inactive()) {
      return
    }
    this.state.inactive('pending')
    try {
      await this.stopManager()
    } catch (err) {
      logger.error(`Can not stop, error: ${(err as Error).message}`)
    }
    this.state.inactive(true)
  }

  private async stopManager () {
    this.manager.removeAllListeners()
    await this.manager.stop()
  }

  /**
   *
   * Event section: onXXX
   *
   */
  private async onLogin (wxid: string): Promise<void> {
    logger.info('onLogin(%s)', wxid)

    if (this.logonoff()) {
      logger.warn('onLogin(%s) already login? NOOP', wxid)
      return
    }
    logger.info(EVENT_LOG_PRE, `${EventName.LOGIN}, ${wxid}`)
    if (!this.selfId()) {
      await super.login(this.id)
    } else {
      this.emit('login', { contactId: this.id })
    }
  }

  private async onLogout (wxid: string, message: string): Promise<void> {
    logger.info('onLogout(%s, %s)', wxid, message)

    if (!this.logonoff()) {
      logger.warn('onLogout(%s) already logged out?', wxid)
    }
    logger.info(EVENT_LOG_PRE, `${EventName.LOGOUT}, ${wxid}`)
    this.__currentUserId = undefined
    this.emit('logout', { contactId: wxid, data: message })
  }

  private async onMessage (message: PUPPET.EventMessagePayload): Promise<void> {
    logger.info('onMessage(%s)', JSON.stringify(message))
    this.emit('message', message)
  }

  private async onScan (status: PUPPET.ScanStatus, qrcode?: string): Promise<void> {
    logger.info('onScan(%s, %s)', status, qrcode)

    logger.info(EVENT_LOG_PRE, `${EventName.SCAN}`)
    this.emit('scan', { qrcode, status })
  }

  private async onError (e: string) {
    logger.info(EVENT_LOG_PRE, `${EventName.ERROR}, ${e}`)
    this.emit('error', {
      data: e,
    })
  }

  private async onReset (reason: string) {
    logger.info(EVENT_LOG_PRE, `${EventName.RESET}, ${reason}`)
    this.emit('reset', { data: reason } as PUPPET.EventResetPayload)
  }

  private async onFriendship (id: string): Promise<void> {

  }

  private async onRoomJoin (payload: PUPPET.EventRoomJoinPayload) {
    const roomId = payload.roomId
    await this.dirtyPayload(PUPPET.PayloadType.Room, roomId)
    this.emit('room-join', payload)
  }

  private async onRoomLeave (payload: PUPPET.EventRoomLeavePayload) {
    const roomId = payload.roomId
    await this.dirtyPayload(PUPPET.PayloadType.Room, roomId)
    this.emit('room-leave', payload)
  }

  private async onRoomTopic (payload: PUPPET.EventRoomTopicPayload) {
    const roomId = payload.roomId
    await this.dirtyPayload(PUPPET.PayloadType.Room, roomId)
    this.emit('room-topic', payload)
  }

  private async onRoomInvite (payload: PUPPET.EventRoomInvitePayload) {
    this.emit('room-invite', payload)
  }

  private async onReady () {
    logger.info('onReady()')

    logger.info(EVENT_LOG_PRE, `${EventName.READY}`)
    this.emit('ready', { data: 'ready' })
  }

  private override async onDirty (payload: PUPPET.EventDirtyPayload) {
    this.emit('dirty', payload)
  }

  override ding (data?: string): void {
    logger.silly('ding(%s)', data || '')
    setTimeout(() => this.emit('dong', { data: data || '' }), 1000)
  }

  /**
   * ContactSelf
   */
  override contactSelfQRCode = contactSelfQRCode
  override contactSelfName = contactSelfName
  override contactSelfSignature = contactSelfSignature

  /**
   * Contact
   */
  override contactAlias = contactAlias
  override contactPhone = contactPhone
  override contactCorporationRemark = contactCorporationRemark
  override contactDescription = contactDescription
  override contactList = contactList
  override contactAvatar = contactAvatar
  override contactRawPayloadParser = contactRawPayloadParser
  override contactRawPayload = contactRawPayload

  /**
   * Conversation
   */
  override conversationReadMark = conversationReadMark

  /**
   * Message
   */
  override messageContact = messageContact
  override messageImage = messageImage
  override messageRecall = messageRecall
  override messageFile = messageFile
  override messageUrl = messageUrl
  override messageMiniProgram = messageMiniProgram
  override messageSendText = messageSendText
  override messageSendFile = messageSendFile
  override messageSendContact = messageSendContact
  override messageSendUrl = messageSendUrl
  override messageSendMiniProgram = messageSendMiniProgram
  override messageForward = messageForward
  // @ts-ignore
  messageRawPayloadParser = messageRawPayloadParser
  override messageRawPayload = messageRawPayload

  /**
    * Room
    */
  override roomRawPayloadParser = roomRawPayloadParser
  override roomRawPayload = roomRawPayload
  override roomList = roomList
  override roomDel = roomDel
  override roomAvatar = roomAvatar
  override roomAdd = roomAdd
  override roomTopic = roomTopic
  override roomCreate = roomCreate
  override roomQuit = roomQuit
  override roomQRCode = roomQRCode
  override roomMemberList = roomMemberList
  override roomMemberRawPayload = roomMemberRawPayload
  override roomMemberRawPayloadParser = roomMemberRawPayloadParser
  override roomAnnounce = roomAnnounce
  override roomInvitationAccept = roomInvitationAccept
  override roomInvitationRawPayload =  roomInvitationRawPayload
  override roomInvitationRawPayloadParser = roomInvitationRawPayloadParser

  /**
    * Friendship
    */
  override friendshipRawPayload = friendshipRawPayload
  override friendshipRawPayloadParser = friendshipRawPayloadParser
  override friendshipSearchPhone = friendshipSearchPhone
  override friendshipSearchWeixin = friendshipSearchWeixin
  override friendshipAdd = friendshipAdd
  override friendshipAccept = friendshipAccept

  /**
    * Tag
    */
  override tagContactAdd = tagContactAdd
  override tagContactRemove = tagContactRemove
  override tagContactDelete = tagContactDelete
  override tagContactList = tagContactList

}

export { PuppetWhatsapp }
export default PuppetWhatsapp
