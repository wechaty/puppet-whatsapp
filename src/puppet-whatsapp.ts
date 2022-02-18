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
import * as PUPPET from 'wechaty-puppet'
import type { MemoryCard } from 'memory-card'

import {
  MEMORY_SLOT,
  VERSION,
} from './config.js'
import { logger } from './logger/index.js'
import { contactSelfName, contactSelfQRCode, contactSelfSignature } from './puppet-mixins/contact-self.js'
import { contactAlias, contactAvatar, contactCorporationRemark, contactDescription, contactList, contactPhone, contactRawPayload, contactRawPayloadParser } from './puppet-mixins/contact.js'
import { conversationReadMark } from './puppet-mixins/conversation.js'
import { messageContact, messageImage, messageRecall, messageFile, messageUrl, messageMiniProgram, messageSendText, messageSendFile, messageSendContact, messageSendMiniProgram, messageForward, messageRawPayload, messageSendUrl, messageRawPayloadParser } from './puppet-mixins/message.js'
import { roomRawPayloadParser, roomRawPayload, roomList, roomDel, roomAvatar, roomAdd, roomTopic, roomCreate, roomQuit, roomQRCode, roomMemberList, roomMemberRawPayload, roomMemberRawPayloadParser, roomAnnounce, roomInvitationAccept, roomInvitationRawPayload, roomInvitationRawPayloadParser } from './puppet-mixins/room.js'
import { friendshipRawPayload, friendshipRawPayloadParser, friendshipSearchPhone, friendshipSearchWeixin, friendshipAdd, friendshipAccept } from './puppet-mixins/friendship.js'
import { tagContactAdd, tagContactRemove, tagContactDelete, tagContactList } from './puppet-mixins/tag.js'

import { Manager } from './manager.js'
import { WA_ERROR_TYPE } from './exceptions/error-type.js'
import WAError from './exceptions/whatsapp-error.js'
import { EventName } from './schema/index.js'

import type {
  ClientOptions,
  WhatsAppClientType,
} from './schema/whatsapp-type.js'
import { RequestPool } from './request/requestPool.js'

process.on('uncaughtException', (e) => {
  console.error('process error is:', e.message)
})

export type PuppetWhatsAppOptions = PUPPET.PuppetOptions & {
  memory?: MemoryCard
  puppeteerOptions?: ClientOptions
}

// const EVENT_LOG_PRE = 'EVENT_LOG'
class PuppetWhatsApp extends PUPPET.Puppet {

  static override readonly VERSION = VERSION

  public manager: Manager

  constructor (
    override options: PuppetWhatsAppOptions = {},
  ) {
    super(options)
    this.manager = new Manager(this.options)
  }

  override async start (): Promise<void> {
    logger.info('onStart()')
    if (this.state.on()) {
      await this.state.ready('on')
      return
    }
    this.state.on('pending')

    let whatsapp: WhatsAppClientType
    try {
      whatsapp = await this.startManager(this.manager)
    } catch (err) {
      logger.error(`Can not start whatsapp, error: ${(err as Error).message}`)
      throw WAError(WA_ERROR_TYPE.ERR_INIT, `Can not start whatsapp, error: ${(err as Error).message}`)
    }

    /**
     * Huan(202102): Wait for Puppeteer to be inited before resolve start() for robust state management
     */
    const { state } = this
    const future = new Promise<void>(resolve => {
      function check () {
        if (whatsapp.pupBrowser) {
          resolve(state.on(true))
        } else {
          setTimeout(check, 100)
        }
      }

      check()
    })

    return Promise.race([
      future,
      this.state.ready('off'),
    ])
  }

  private async startManager (manager: Manager) {
    manager.on({
      dirty:this.onDirty.bind(this),
      error:    this.onError.bind(this),
      friendship: this.onFriendship.bind(this),
      heartbeat: data => this.emit('heartbeat', { data }),
      login:    this.onLogin.bind(this),
      logout:   this.onLogout.bind(this),
      message:  this.onMessage.bind(this),
      ready:     this.onReady.bind(this),
      reset:    this.onReset.bind(this),
      'room-invite':this.onRoomInvite.bind(this),
      'room-join': this.onRoomJoin.bind(this),
      'room-leave':this.onRoomLeave.bind(this),
      'room-topic':this.onRoomTopic.bind(this),
      scan:     this.onScan.bind(this),
    })

    const session = await this.options.memory?.get(MEMORY_SLOT)
    const whatsapp = await this.manager.start(session)
    return whatsapp
  }

  override async stop (): Promise<void> {
    logger.info('onStop()')
    if (this.state.off()) {
      await this.state.ready('off')
      return
    }
    this.state.off('pending')
    try {
      await this.stopManager()
    } catch (err) {
      logger.error(`Can not stop, error: ${(err as Error).message}`)
    }
    this.state.off(true)
  }

  private async stopManager () {
    this.manager.off('*')
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
    logger.info(`${EventName.LOGIN}, ${wxid}`)
    this.id = wxid
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
    logger.info(`${EventName.LOGOUT}, ${wxid}`)

    this.id = undefined

    const requestPool = RequestPool.Instance
    requestPool.clearPool()

    this.emit('logout', { contactId: wxid, data: message })
  }

  private async onMessage (message: PUPPET.EventMessagePayload): Promise<void> {
    logger.info('onMessage(%s)', JSON.stringify(message))
    this.emit('message', message)
  }

  private async onScan (status: PUPPET.ScanStatus, qrcode?: string): Promise<void> {
    logger.info('onScan(%s, %s)', status, qrcode)

    logger.info(`${EventName.SCAN}`)
    this.emit('scan', { qrcode, status })
  }

  private async onError (e: string) {
    logger.info(`${EventName.ERROR}, ${e}`)
    this.emit('error', {
      data: e,
    })
  }

  private async onReset (reason: string) {
    logger.info(`${EventName.RESET}, ${reason}`)
    this.emit('reset', { data: reason } as PUPPET.EventResetPayload)
  }

  private async onFriendship (payload: PUPPET.EventFriendshipPayload): Promise<void> {
    const contactId = await this.messageContact(payload.friendshipId)
    // NOTE: this function automatically put non-contact into cache
    await this.contactRawPayload(contactId)
    this.emit('friendship', payload)
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

    logger.info(`${EventName.READY}`)
    this.emit('ready', { data: 'ready' })
  }

  private async onDirty (payload: PUPPET.EventDirtyPayload) {
    this.emit('dirty', payload)
  }

  /**
   * Other Methods
   */
  override async logout () {
    await this.manager.logout()
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

  override messageRawPayloadParser = messageRawPayloadParser
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

export default PuppetWhatsApp
