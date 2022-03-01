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
import { log } from 'wechaty-puppet'
import type { MemoryCard } from 'memory-card'

import {
  MEMORY_SLOT,
  VERSION,
}                                     from './config.js'

import Manager from './manager.js'
import type { RequestManagerAPIs } from './request/request-manager.js'
import type { ClientOptions, WhatsAppClientType } from './schema/whatsapp-type.js'
import WAError from './exception/whatsapp-error.js'
import { WA_ERROR_TYPE } from './exception/error-type.js'
import { EventName } from './schema/event-name.js'
import { RequestPool } from './request/request-pool.js'
import { contactSelfQRCode, contactSelfName, contactSelfSignature } from './puppet-mixin/contact-self.js'
import { contactAlias, contactPhone, contactCorporationRemark, contactDescription, contactList, contactAvatar, contactRawPayloadParser, contactRawPayload } from './puppet-mixin/contact.js'
import { conversationReadMark } from './puppet-mixin/conversation.js'
import { friendshipRawPayload, friendshipRawPayloadParser, friendshipSearchPhone, friendshipSearchWeixin, friendshipAdd, friendshipAccept } from './puppet-mixin/friendship.js'
import { messageContact, messageImage, messageRecall, messageFile, messageUrl, messageMiniProgram, messageSendText, messageSendFile, messageSendContact, messageSendUrl, messageSendMiniProgram, messageForward, messageRawPayloadParser, messageRawPayload } from './puppet-mixin/message.js'
import { roomRawPayloadParser, roomRawPayload, roomList, roomDel, roomAvatar, roomAdd, roomTopic, roomCreate, roomQuit, roomQRCode, roomMemberList, roomMemberRawPayload, roomMemberRawPayloadParser, roomAnnounce, roomInvitationAccept, roomInvitationRawPayload, roomInvitationRawPayloadParser } from './puppet-mixin/room.js'
import { tagContactAdd, tagContactRemove, tagContactDelete, tagContactList } from './puppet-mixin/tag.js'

// import { Attachment } from './mock/user/types'
type ManagerWithRequestManager = Manager & RequestManagerAPIs

export type PuppetWhatsAppOptions = PUPPET.PuppetOptions & {
  memory?: MemoryCard
  puppeteerOptions?: ClientOptions
}

const PRE = 'PuppetWhatsapp'

class PuppetWhatsapp extends PUPPET.Puppet {

  static override readonly VERSION = VERSION

  public manager: ManagerWithRequestManager

  constructor (
    override options: PuppetWhatsAppOptions = {},
  ) {
    super(options)
    log.verbose(PRE, 'constructor()')

    this.manager = new Manager(this.options) as ManagerWithRequestManager
  }

  override version () {
    return VERSION
  }

  override async onStart (): Promise<void> {
    log.verbose(PRE, 'onStart()')

    let whatsapp: WhatsAppClientType
    try {
      whatsapp = await this.startManager(this.manager)
    } catch (err) {
      log.error(PRE, `Can not start whatsapp, error: ${(err as Error).message}`)
      throw WAError(WA_ERROR_TYPE.ERR_INIT, `Can not start whatsapp, error: ${(err as Error).message}`)
    }

    /**
     * Huan(202102): Wait for Puppeteer to be inited before resolve start() for robust state management
     */
    const future = new Promise<void>(resolve => {
      function check () {
        if (whatsapp.pupBrowser) {
          resolve()
        } else {
          setTimeout(check, 100)
        }
      }

      check()
    })

    return Promise.race([
      future,
      this.state.stable('inactive'),
    ])
  }

  private async startManager (manager: Manager) {
    manager.on({
      dirty: this.onDirty.bind(this),
      error: this.onError.bind(this),
      friendship: this.onFriendship.bind(this),
      heartbeat: data => this.emit('heartbeat', {
        data,
      }),
      login: this.onLogin.bind(this),
      logout: this.onLogout.bind(this),
      message: this.onMessage.bind(this),
      ready: this.onReady.bind(this),
      reset: this.onReset.bind(this),
      'room-invite': this.onRoomInvite.bind(this),
      'room-join': this.onRoomJoin.bind(this),
      'room-leave': this.onRoomLeave.bind(this),
      'room-topic': this.onRoomTopic.bind(this),
      scan: this.onScan.bind(this),
    })

    const session = await this.options.memory?.get(MEMORY_SLOT)
    const whatsapp = await this.manager.start(session)
    return whatsapp
  }

  override async onStop (): Promise<void> {
    log.verbose(PRE, 'onStop()')
    try {
      await this.stopManager()
    } catch (err) {
      log.error(PRE, `Can not stop, error: ${(err as Error).message}`)
    }
  }

  private async stopManager () {
    this.manager.off('*')
    await this.manager.stop()
  }

  /**
   * Event section: onXXX
   */
  private async onLogin (wxid: string): Promise<void> {
    log.verbose(PRE, 'onLogin(%s)', wxid)

    if (this.isLoggedIn) {
      log.warn(PRE, 'onLogin(%s) already login? NOOP', wxid)
      return
    }
    log.info(PRE, `${EventName.LOGIN}, ${wxid}`)

    await super.login(wxid)
    // no need to emit login since super.login will do that
    // this.emit('login', { contactId: wxid })
  }

  private async onLogout (wxid: string, message: string): Promise<void> {
    log.verbose(PRE, 'onLogout(%s, %s)', wxid, message)

    if (!this.isLoggedIn) {
      log.warn(PRE, 'onLogout(%s) already logged out?', wxid)
    }
    log.info(PRE, `${EventName.LOGOUT}, ${wxid}`)

    const requestPool = RequestPool.Instance
    requestPool.clearPool()

    this.emit('logout', { contactId: wxid, data: message })
  }

  private async onMessage (message: PUPPET.payloads.EventMessage): Promise<void> {
    log.verbose(PRE, 'onMessage(%s)', JSON.stringify(message))
    this.emit('message', message)
  }

  private async onScan (payload: PUPPET.payloads.EventScan): Promise<void> {
    log.verbose(PRE, 'onScan(%s)', JSON.stringify(payload))

    log.info(PRE, `${EventName.SCAN}`)
    this.emit('scan', payload)
  }

  private async onError (e: string) {
    log.info(PRE, `${EventName.ERROR}, ${e}`)
    this.emit('error', {
      data: e,
    })
  }

  private async onReset (reason: string) {
    log.info(PRE, `${EventName.RESET}, ${reason}`)
    this.emit('reset', { data: reason } as PUPPET.payloads.EventReset)
  }

  private async onFriendship (payload: PUPPET.payloads.EventFriendship): Promise<void> {
    const contactId = await this.messageContact(payload.friendshipId)
    // NOTE: this function automatically put non-contact into cache
    await this.contactRawPayload(contactId)
    this.emit('friendship', payload)
  }

  private async onRoomJoin (payload: PUPPET.payloads.EventRoomJoin) {
    const roomId = payload.roomId
    await this.dirtyPayload(PUPPET.types.Payload.Room, roomId)
    this.emit('room-join', payload)
  }

  private async onRoomLeave (payload: PUPPET.payloads.EventRoomLeave) {
    const roomId = payload.roomId
    await this.dirtyPayload(PUPPET.types.Payload.Room, roomId)
    this.emit('room-leave', payload)
  }

  private async onRoomTopic (payload: PUPPET.payloads.EventRoomTopic) {
    const roomId = payload.roomId
    await this.dirtyPayload(PUPPET.types.Payload.Room, roomId)
    this.emit('room-topic', payload)
  }

  private async onRoomInvite (payload: PUPPET.payloads.EventRoomInvite) {
    this.emit('room-invite', payload)
  }

  private async onReady () {
    log.verbose(PRE, 'onReady()')

    log.info(PRE, `${EventName.READY}`)
    this.emit('ready', { data: 'ready' })
  }

  /**
   * Override Methods
   */

  override async onDirty (payload: PUPPET.payloads.EventDirty) {
    this.emit('dirty', payload)
  }

  override async logout () {
    await super.logout()
    if (!this.isLoggedIn) {
      log.verbose(PRE, 'logout() do nothing')
      return
    }
    return this.manager.logout()
  }

  override ding (data?: string): void {
    log.silly(PRE, 'ding(%s)', data || '')
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

export { PuppetWhatsapp }
export default PuppetWhatsapp
