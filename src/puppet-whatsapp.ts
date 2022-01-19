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
  distinctUntilKeyChanged,
  fromEvent,
  map,
  merge,
} from 'rxjs'
import {
  log,
  MEMORY_SLOT,
  VERSION,
} from './config.js'

import {
  getWhatsApp,
  WhatsApp,
  WhatsappContact,
  WhatsappMessage,
} from './whatsapp.js'
import WAWebJS, { ClientOptions } from './schema/index.js'
import { Manager } from './manager.js'
import WAError from './pure-function-helpers/error-type.js'
import { WA_ERROR_TYPE } from './schema/error-type.js'
import { contactSelfName, contactSelfQRCode, contactSelfSignature } from './puppet-mixins/contact-self.js'
import { contactAlias, contactAvatar, contactCorporationRemark, contactDescription, contactList, contactPhone, contactRawPayload, contactRawPayloadParser } from './puppet-mixins/contact.js'
import { conversationReadMark } from './puppet-mixins/conversation.js'
import { messageContact, messageImage, messageRecall, messageFile, messageUrl, messageMiniProgram, messageSendText, messageSendFile, messageSendContact, messageSendMiniProgram, messageForward, messageRawPayload, messageSendUrl } from './puppet-mixins/message.js'
import { messageRawPayloadParser } from './pure-function-helpers/message-raw-payload-parse.js'
import { roomRawPayloadParser, roomRawPayload, roomList, roomDel, roomAvatar, roomAdd, roomTopic, roomCreate, roomQuit, roomQRCode, roomMemberList, roomMemberRawPayload, roomMemberRawPayloadParser, roomAnnounce, roomInvitationAccept, roomInvitationRawPayload, roomInvitationRawPayloadParser } from './puppet-mixins/room.js'
import { friendshipRawPayload, friendshipRawPayloadParser, friendshipSearchPhone, friendshipSearchWeixin, friendshipAdd, friendshipAccept } from './puppet-mixins/friendship.js'
import { tagContactAdd, tagContactRemove, tagContactDelete, tagContactList } from './puppet-mixins/tag.js'

process.on('uncaughtException', (e) => {
  console.error('process error is:', e.message)
})

export type PuppetWhatsAppOptions = PUPPET.PuppetOptions & {
  memory?: MemoryCard
  puppeteerOptions?: ClientOptions
}

const PRE = 'PuppetWhatsApp'

const InviteLinkRegex = /^(https?:\/\/)?chat\.whatsapp\.com\/(?:invite\/)?([a-zA-Z0-9_-]{22})$/
class PuppetWhatsapp extends PUPPET.Puppet {

  static override readonly VERSION = VERSION

  private whatsapp: undefined | WhatsApp
  private manager?: Manager

  constructor (
    override options: PuppetWhatsAppOptions = {},
  ) {
    super(options)
  }

  getWhatsapp () {
    return this.whatsapp
  }

  override async start (): Promise<void> {
    log.verbose(PRE, 'onStart()')
    if (this.state.on()) {
      await this.state.ready('on')
      return
    }
    this.state.on('pending')
    const session = await this.memory.get(MEMORY_SLOT)
    const whatsapp = await getWhatsApp(this.options['puppeteerOptions'] as ClientOptions, session)
    this.whatsapp = whatsapp
    try {
      this.manager = new Manager(whatsapp) // FIXME: need move some logic to manager from puppet-whatsapp
      await this.initWhatsAppEvents(whatsapp)
    } catch (error) {
      log.error(PRE, `Can not start whatsapp, error: ${(error as Error).message}`)
    }
    /**
     * Huan(202102): initialize() will rot be resolved not before bot log in
     */
    whatsapp
      .initialize()
      .then(() => log.verbose(PRE, 'start() whatsapp.initialize() done'))
      .catch(e => {
        if (this.state.on()) {
          log.error(PRE, 'start() whatsapp.initialize() rejection: %s', e)
        } else {
          log.error(PRE, 'start() whatsapp.initialize() rejected on a stopped puppet. %s', e)
        }
      })

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

  override async stop (): Promise<void> {
    log.verbose(PRE, 'onStop()')
    if (this.state.off()) {
      await this.state.ready('off')
      return
    }
    if (!this.whatsapp) {
      log.error(PRE, 'stop() this.whatsapp is undefined!')
      return
    }
    this.state.off('pending')
    try {
      await this.manager?.stop()
      await this.whatsapp.destroy()
      this.whatsapp = undefined
    } catch (error) {
      log.error(PRE, `Can not stop, error: ${(error as Error).message}`)
    }
    this.state.off(true)
  }

  async getCacheManager () {
    if (!this.manager) {
      throw new WAError(WA_ERROR_TYPE.ERR_INIT, 'No manager')
    }

    const cacheManager = await this.manager.getCacheManager()
    return cacheManager
  }

  private async initWhatsAppEvents (
    whatsapp: WhatsApp,
  ): Promise<void> {
    log.verbose('PuppetwhatsApp', 'initWhatsAppEvents()')

    const cacheManager = await this.getCacheManager()
    whatsapp.on('authenticated', session => {
      (async () => {
        try {
          // save session file
          await this.memory.set(MEMORY_SLOT, session)
          await this.memory.save()
          await this.manager!.initCache(session.WABrowserId)
        } catch (e) {
          console.error(e)
          log.error(PRE, 'getClient() whatsapp.on(authenticated) rejection: %s', e)
        }
      })().catch(console.error)
    })

    /**
     * There is only one situation that will cause this event, invalid session causing timeout
     * https://github.com/pedroslopez/whatsapp-web.js/blob/d86c39de3ca5699a50db98ee93e264ab8c4f25a3/src/Client.js#L116-L129
     */
    whatsapp.on('auth_failure', async (msg) => {
      log.warn(PRE, 'auth_failure: %s, then restart no use exist session', msg)
      // msg -> auth_failure message
      // auth_failure due to session invalidation
      // clear sessionData -> reinit
      this.state.off(true)
      await this.memory.delete(MEMORY_SLOT)
      await this.start()
    })

    whatsapp.on('ready', () => {
      (async () => {
        // await this.state.on(true)
        const contacts: WhatsappContact[] = await whatsapp.getContacts()
        const nonBroadcast = contacts.filter(c => c.id.server !== 'broadcast')
        for (const contact of nonBroadcast) {
          await cacheManager.setContactOrRoomRawPayload(contact.id._serialized, contact)
        }
        await this.login(whatsapp.info.wid._serialized)
      })().catch(console.error)
    })

    whatsapp.on('message', async (msg: WhatsappMessage) => {
      // @ts-ignore
      if (msg.type === 'e2e_notification') {
        if (msg.body === '' && msg.author === undefined) {
          // match group join message pattern
          return
        }
      }
      const id = msg.id.id
      await cacheManager.setMessageRawPayload(id, msg)
      if (msg.type !== WAWebJS.MessageTypes.GROUP_INVITE) {
        if (msg.links.length === 1 && InviteLinkRegex.test(msg.links[0]!.link)) {
          const matched = msg.links[0]!.link.match(InviteLinkRegex)
          if (matched) {
            if (matched.length === 3) {
              const inviteCode = matched[2]!
              const roomInvitationPayload: PUPPET.EventRoomInvitePayload = {
                roomInvitationId: inviteCode,
              }
              const rawData: Partial<WAWebJS.InviteV4Data> = {
                inviteCode,
              }
              await cacheManager.setRoomInvitationRawPayload(inviteCode, rawData)
              this.emit('room-invite', roomInvitationPayload)
            } else {
              // TODO:
            }
          } else {
            this.emit('message', { messageId: msg.id.id })
          }
        } else {
          this.emit('message', { messageId: msg.id.id })
        }

      } else {
        (async () => {
          const info = msg.inviteV4
          if (info) {
            const roomInvitationPayload: PUPPET.EventRoomInvitePayload = {
              roomInvitationId: info.inviteCode,
            }
            await cacheManager.setRoomInvitationRawPayload(info.inviteCode, info)
            this.emit('room-invite', roomInvitationPayload)
          } else {
            // TODO:
          }
        })().catch(console.error)
      }

    })

    whatsapp.on('qr', (qr) => {
      // NOTE: This event will not be fired if a session is specified.
      this.emit('scan', { qrcode: qr, status: PUPPET.ScanStatus.Waiting })
    })

    whatsapp.on('group_join', noti => {
      (async () => {
        const roomJoinPayload: PUPPET.EventRoomJoinPayload = {
          inviteeIdList: noti.recipientIds,
          inviterId: noti.author,
          roomId: noti.chatId,
          timestamp: noti.timestamp,
        }
        this.emit('room-join', roomJoinPayload)
      })().catch(console.error)
    })

    whatsapp.on('group_leave', noti => {
      (async () => {
        const roomJoinPayload: PUPPET.EventRoomLeavePayload = {
          removeeIdList: noti.recipientIds,
          removerId: noti.author,
          roomId: noti.chatId,
          timestamp: noti.timestamp,
        }
        this.emit('room-leave', roomJoinPayload)
      })().catch(console.error)
    })

    whatsapp.on('group_update', noti => {
      (async () => {
        if (noti.type === WAWebJS.GroupNotificationTypes.SUBJECT) {
          const roomInCache = await cacheManager.getContactOrRoomRawPayload(noti.chatId)
          const roomJoinPayload: PUPPET.EventRoomTopicPayload = {
            changerId: noti.author,
            newTopic: noti.body,
            oldTopic: roomInCache?.name || '',
            roomId: noti.chatId,
            timestamp: noti.timestamp,
          }
          this.emit('room-topic', roomJoinPayload)
        }
      })().catch(console.error)
    })

    const events = [
      'authenticated',
      'ready',
      'disconnected',
    ]

    const eventStreams = events.map((event) => fromEvent(whatsapp, event).pipe(map((value: any) => ({ event, value }))))
    const allEvents$ = merge(...eventStreams)

    allEvents$.pipe(distinctUntilKeyChanged('event')).subscribe(({ event, value }: { event: string, value: any }) => {
      if (event === 'disconnected' && value as string === 'NAVIGATION') {
        void this.logout(value as string)
      }
    })
  }

  override ding (data?: string): void {
    log.silly(PRE, 'ding(%s)', data || '')
    setTimeout(() => this.emit('dong', { data: data || '' }), 1000)
  }

  public getManager () {
    return this.manager
  }

  /**
   *
   * ContactSelf
   *
   */
  contactSelfQRCode = contactSelfQRCode
  contactSelfName = contactSelfName
  contactSelfSignature = contactSelfSignature

  /**
   *
   * Contact
   *
   */
  contactAlias = contactAlias
  contactPhone = contactPhone
  contactCorporationRemark = contactCorporationRemark
  contactDescription = contactDescription
  contactList = contactList
  contactAvatar = contactAvatar
  contactRawPayloadParser = contactRawPayloadParser
  contactRawPayload = contactRawPayload

  /**
   *
   * Conversation
   *
   */
  conversationReadMark = conversationReadMark

  /**
   *
   * Message
   *
   */
  messageContact = messageContact
  messageImage = messageImage
  messageRecall = messageRecall
  messageFile = messageFile
  messageUrl = messageUrl
  messageMiniProgram = messageMiniProgram
  messageSendText = messageSendText
  messageSendFile = messageSendFile
  messageSendContact = messageSendContact
  messageSendUrl = messageSendUrl
  messageSendMiniProgram = messageSendMiniProgram
  messageForward = messageForward
  // @ts-ignore
  messageRawPayloadParser = messageRawPayloadParser
  messageRawPayload = messageRawPayload
  /**
    *
    * Room
    *
    */
  roomRawPayloadParser = roomRawPayloadParser
  roomRawPayload = roomRawPayload
  roomList = roomList
  roomDel = roomDel
  roomAvatar = roomAvatar
  roomAdd = roomAdd
  roomTopic = roomTopic
  roomCreate = roomCreate
  roomQuit = roomQuit
  roomQRCode = roomQRCode
  roomMemberList = roomMemberList
  roomMemberRawPayload = roomMemberRawPayload
  roomMemberRawPayloadParser = roomMemberRawPayloadParser
  roomAnnounce = roomAnnounce
  roomInvitationAccept = roomInvitationAccept
  roomInvitationRawPayload =  roomInvitationRawPayload
  roomInvitationRawPayloadParser = roomInvitationRawPayloadParser
  /**
    *
    * Friendship
    *
    */
  friendshipRawPayload = friendshipRawPayload
  friendshipRawPayloadParser = friendshipRawPayloadParser
  friendshipSearchPhone = friendshipSearchPhone
  friendshipSearchWeixin = friendshipSearchWeixin
  friendshipAdd = friendshipAdd
  friendshipAccept = friendshipAccept
  /**
    *
    * Tag
    *
    */
  tagContactAdd = tagContactAdd
  tagContactRemove = tagContactRemove
  tagContactDelete = tagContactDelete
  tagContactList = tagContactList

}

export { PuppetWhatsapp }
export default PuppetWhatsapp
