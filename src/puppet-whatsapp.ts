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
  avatarForGroup,
  log,
  FileBox,
  MEMORY_SLOT,
  VERSION,
} from './config.js'

import {
  getWhatsApp,
  WhatsApp,
  WhatsappContact,
  WhatsappMessage,
}                   from './whatsapp.js'
import WAWebJS, { ClientOptions, GroupChat, MessageContent } from 'whatsapp-web.js'
import { parseVcard } from './pure-function-helpers/vcard-parser.js'
import { Manager } from './work/manager.js'
import WAError from './pure-function-helpers/error-type.js'
import { WXWORK_ERROR_TYPE } from './schema/error-type.js'
import type WhatsAppRaw from './schema/index.js'

process.on('uncaughtException', (e) => {
  console.error('process error is:', e.message)
})

export type PuppetWhatsAppOptions = PUPPET.PuppetOptions & {
  memory?: MemoryCard
  puppeteerOptions?: ClientOptions
}

const InviteLinkRegex = /^(https?:\/\/)?chat\.whatsapp\.com\/(?:invite\/)?([a-zA-Z0-9_-]{22})$/
class PuppetWhatsapp extends PUPPET.Puppet {

  static override readonly VERSION = VERSION

  private messageStore: { [id: string]: WhatsappMessage }
  private contactStore: { [id: string]: WhatsappContact }
  private roomStore: { [id: string]: WhatsappContact }
  private roomInvitationStore: { [id: string]: Partial<WAWebJS.InviteV4Data>}
  private whatsapp: undefined | WhatsApp
  private manager: undefined | Manager

  constructor (
    override options: PuppetWhatsAppOptions = {},
  ) {
    super(options)
    log.verbose('PuppetWhatsApp', 'constructor()')

    this.messageStore = {}
    this.contactStore = {}
    this.roomStore = {}
    this.roomInvitationStore = {}

  }

  override async start (useSession: boolean = true, session?: WhatsAppRaw.ClientSession): Promise<void> {
    log.verbose('PuppetWhatsApp', 'onStart()')
    let whatsapp: WhatsApp
    const clientOptions: ClientOptions = {
      ...this.options['puppeteerOptions'],
      authTimeoutMs: 10000,
    }
    if (useSession && session === undefined) {
      const _session = await this.memory.get(MEMORY_SLOT)
      whatsapp = await getWhatsApp(clientOptions, _session)
    } else if (useSession && session) {
      whatsapp = await getWhatsApp(clientOptions, session)
    } else {
      whatsapp = await getWhatsApp(clientOptions)
    }
    if (this.state.on()) {
      await this.state.ready('on')
      return
    }
    this.whatsapp = whatsapp
    this.manager = new Manager(whatsapp)
    this.state.on('pending')
    this.initWhatsAppEvents(whatsapp)

    /**
     * Huan(202102): initialize() will rot be resolved not before bot log in
     */
    whatsapp
      .initialize()
      .then(() => log.verbose('PuppetWhatsApp', 'start() whatsapp.initialize() done'))
      .catch(e => {
        if (this.state.on()) {
          log.error('PuppetWhatsApp', 'start() whatsapp.initialize() rejection: %s', e)
        } else {
          log.error('PuppetWhatsApp', 'start() whatsapp.initialize() rejected on a stopped puppet. %s', e)
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
    log.verbose('PuppetWhatsApp', 'onStop()')
    if (this.state.off()) {
      await this.state.ready('off')
      return
    }
    if (!this.whatsapp) {
      log.error('PuppetWhatsApp', 'stop() this.whatsapp is undefined!')
      return
    }
    this.state.off('pending')
    const whatsapp = this.whatsapp
    this.whatsapp = undefined
    await whatsapp.destroy()
    this.state.off(true)
  }

  private initWhatsAppEvents (
    whatsapp: WhatsApp,
  ): void {
    log.verbose('PuppetwhatsApp', 'initWhatsAppEvents()')

    whatsapp.on('authenticated', session => {
      (async () => {
        try {
          // save session file
          await this.memory.set(MEMORY_SLOT, session)
          await this.memory.save()
        } catch (e) {
          console.error(e)
          log.error('PuppetWhatsApp', 'getClient() whatsapp.on(authenticated) rejection: %s', e)
        }
      })().catch(console.error)
    })

    /**
     * There is only one situation that will cause this event, invalid session causing timeout
     * https://github.com/pedroslopez/whatsapp-web.js/blob/d86c39de3ca5699a50db98ee93e264ab8c4f25a3/src/Client.js#L116-L129
     */
    whatsapp.on('auth_failure', async (msg) => {
      log.warn('PuppetWhatsApp', 'auth_failure: %s, then restart no use exist session', msg)
      // msg -> auth_failure message
      // auth_failure due to session invalidation
      // clear sessionData -> reinit
      await this.memory.delete(MEMORY_SLOT)
      await this.start(false)
    })

    whatsapp.on('ready', () => {
      (async () => {
        // await this.state.on(true)
        const contacts: WhatsappContact[] = await whatsapp.getContacts()
        const nonBroadcast = contacts.filter(c => c.id.server !== 'broadcast')
        for (const contact of nonBroadcast) {
          if (!contact.isGroup) {
            this.contactStore[contact.id._serialized] = contact
          } else {
            this.roomStore[contact.id._serialized] = contact
          }
        }
        await this.login(whatsapp.info.wid._serialized)
      })().catch(console.error)
    })

    whatsapp.on('message', (msg: WhatsappMessage) => {
      // @ts-ignore
      if (msg.type === 'e2e_notification') {
        if (msg.body === '' && msg.author === undefined) {
          // match group join message pattern
          return
        }
      }
      const id = msg.id.id
      this.messageStore[id] = msg
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
              this.roomInvitationStore[inviteCode] = rawData
              this.emit('room-invite', roomInvitationPayload)
            } else {
              // TODO:
            }
          } else {
            this.emit('message', { messageId : msg.id.id })
          }
        } else {
          this.emit('message', { messageId : msg.id.id })
        }

      } else {
        (async () => {
          const info = msg.inviteV4
          if (info) {
            const roomInvitationPayload: PUPPET.EventRoomInvitePayload = {
              roomInvitationId: info.inviteCode,
            }
            this.roomInvitationStore[info.inviteCode] = info
            this.emit('room-invite', roomInvitationPayload)
          } else {
            // TODO:
          }
        })().catch(console.error)
      }

    })

    whatsapp.on('qr', (qr) => {
      // NOTE: This event will not be fired if a session is specified.
      console.info(`------- ${qr}`)
      this.emit('scan', { qrcode : qr, status : PUPPET.ScanStatus.Waiting })
    })

    whatsapp.on('group_join', noti => {
      (async () => {
        const roomJoinPayload: PUPPET.EventRoomJoinPayload = {
          inviteeIdList : noti.recipientIds,
          inviterId     : noti.author,
          roomId        : noti.chatId,
          timestamp     : noti.timestamp,
        }
        this.emit('room-join', roomJoinPayload)
      })().catch(console.error)
    })

    whatsapp.on('group_leave', noti => {
      (async () => {
        const roomJoinPayload: PUPPET.EventRoomLeavePayload = {
          removeeIdList : noti.recipientIds,
          removerId     : noti.author,
          roomId        : noti.chatId,
          timestamp     : noti.timestamp,
        }
        this.emit('room-leave', roomJoinPayload)
      })().catch(console.error)
    })

    whatsapp.on('group_update', noti => {
      (async () => {
        if (noti.type === WAWebJS.GroupNotificationTypes.SUBJECT) {
          const oldRoom = this.roomStore[noti.chatId]
          const roomJoinPayload: PUPPET.EventRoomTopicPayload = {
            changerId : noti.author,
            newTopic  : noti.body,
            oldTopic  : oldRoom?.name || '',
            roomId    : noti.chatId,
            timestamp : noti.timestamp,
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

    allEvents$.pipe(distinctUntilKeyChanged('event')).subscribe(({ event, value } : {event:string, value:any}) => {
      if (event === 'disconnected' && value as string === 'NAVIGATION') {
        void this.logout(value as string)
      }
    })
  }

  override ding (data?: string): void {
    log.silly('PuppetWhatsApp', 'ding(%s)', data || '')
    setTimeout(() => this.emit('dong', { data: data || '' }), 1000)
  }

  /**
   *
   * ContactSelf
   *
   */
  override async contactSelfQRCode (): Promise<string> {
    log.verbose('PuppetWhatsApp', 'contactSelfQRCode()')
    return ''
  }

  override async contactSelfName (name: string): Promise<void> {
    log.verbose('PuppetWhatsApp', 'contactSelfName(%s)', name)
    await this.manager!.setNickname(name)
  }

  override async contactSelfSignature (signature: string): Promise<void> {
    log.verbose('PuppetWhatsApp', 'contactSelfSignature(%s)', signature)
    await this.whatsapp!.setStatus(signature)
  }

  /**
   *
   * Contact
   *
   */
  override contactAlias (contactId: string)                      : Promise<string>
  override contactAlias (contactId: string, alias: string | null): Promise<void>

  override async contactAlias (contactId: string, alias?: string | null): Promise<void | string> {
    log.verbose('PuppetWhatsApp', 'contactAlias(%s, %s)', contactId, alias)

    if (typeof alias === 'undefined') {
      return 'mock alias'
    }
  }

  override async contactPhone (contactId: string): Promise<string[]>
  override async contactPhone (contactId: string, phoneList: string[]): Promise<void>

  override async contactPhone (contactId: string, phoneList?: string[]): Promise<string[] | void> {
    log.verbose('PuppetWhatsApp', 'contactPhone(%s, %s)', contactId, phoneList)
    if (typeof phoneList === 'undefined') {
      if (this.contactStore[contactId]) {
        return [this.contactStore[contactId]!.number]
      } else {
        return []
      }
    }
  }

  override async contactCorporationRemark (contactId: string, corporationRemark: string) {
    log.verbose('PuppetWhatsApp', 'contactCorporationRemark(%s, %s)', contactId, corporationRemark)
  }

  override async contactDescription (contactId: string, description: string) {
    log.verbose('PuppetWhatsApp', 'contactDescription(%s, %s)', contactId, description)
  }

  override async contactList (): Promise<string[]> {
    log.verbose('PuppetWhatsApp', 'contactList()')
    return Object.keys(this.contactStore)
  }

  override async contactAvatar (contactId: string)                : Promise<FileBox>
  override async contactAvatar (contactId: string, file: FileBox) : Promise<void>

  override async contactAvatar (contactId: string, file?: FileBox): Promise<void | FileBox> {
    log.verbose('PuppetWhatsApp', 'contactAvatar(%s)', contactId)

    if (file) {
      return
    }

    const con = await this.whatsapp!.getContactById(contactId)
    const avatar = await con.getProfilePicUrl()
    return FileBox.fromUrl(avatar)
  }

  override async contactRawPayloadParser (whatsAppPayload: WhatsappContact): Promise<PUPPET.ContactPayload> {
    let type
    if (whatsAppPayload.isUser) {
      type = PUPPET.ContactType.Individual
    } else if (whatsAppPayload.isEnterprise) {
      type = PUPPET.ContactType.Corporation
    } else {
      type = PUPPET.ContactType.Unknown
    }

    return {
      avatar : await whatsAppPayload.getProfilePicUrl(),
      friend: whatsAppPayload.isWAContact && whatsAppPayload.isUser && !whatsAppPayload.isMe,
      gender : PUPPET.ContactGender.Unknown,
      id     : whatsAppPayload.id._serialized,
      name   : !whatsAppPayload.isMe ? whatsAppPayload.pushname : whatsAppPayload.pushname || this.whatsapp?.info.pushname || '',
      phone : [whatsAppPayload.number],
      type   : type,
      weixin : whatsAppPayload.number,
    }
  }

  override async contactRawPayload (id: string): Promise<WhatsappContact> {
    log.verbose('PuppetWhatsApp', 'contactRawPayload(%s)', id)
    if (this.contactStore[id]) {
      return this.contactStore[id]!
    } else {
      const rawContact = await this.whatsapp!.getContactById(id)
      this.contactStore[id] = rawContact
      return rawContact
    }
  }

  /**
   *
   * Conversation
   *
   */
  override async conversationReadMark (
    conversationId: string,
    hasRead?: boolean,
  ) : Promise<void | boolean> {
    log.verbose('PuppetWhatsApp', 'conversationReadMark(%s, %s)', conversationId, hasRead)
    return PUPPET.throwUnsupportedError()
  }

  /**
   *
   * Message
   *
   */
  /**
   * Get contact message
   * @param messageId message Id
   * @returns contact name
   */
  override async messageContact (messageId: string): Promise<string> {
    log.verbose('PuppetWhatsApp', 'messageContact(%s)', messageId)
    const msg = this.messageStore[messageId]
    if (!msg) {
      log.error('Message %s not found', messageId)
      throw new Error('Message not found')
    }
    if (msg.type !== WAWebJS.MessageTypes.CONTACT_CARD) {
      log.error('Message %s is not contact type', messageId)
      throw new Error('Message is not contact type')
    }
    const vcard = parseVcard(msg.vCards[0]!)
    // FIXME: Under current typing configuration, it is not possible to return multiple vcards that WhatsApp allows
    // Therefore sending the first vcard only (for now?)
    if (!vcard.TEL) {
      log.warn('vcard has not TEL field')
    }
    return vcard.TEL ? vcard.TEL.waid : ''
  }

  /**
   * get image from message
   * @param messageId message id
   * @param imageType image size to get (may not apply to WhatsApp)
   * @returns the image
   */
  override async messageImage (messageId: string, imageType: PUPPET.ImageType): Promise<FileBox> {
    log.verbose('PuppetWhatsApp', 'messageImage(%s, %s[%s])', messageId, imageType, PUPPET.ImageType[imageType])
    const msg = this.messageStore[messageId]
    if (!msg) {
      log.error('Message %s not found', messageId)
      throw new Error('Message Not Found')
    }
    if (msg.type !== WAWebJS.MessageTypes.IMAGE || !msg.hasMedia) {
      log.error('Message %s does not contain any media', messageId)
      throw new Error('Message does not contain any media')
    }
    const media = await msg.downloadMedia()
    return FileBox.fromBase64(media.data, media.filename ?? '')
  }

  /**
   * recall the message
   * @param messageId message id
   * @returns success
   */
  override async messageRecall (messageId: string): Promise<boolean> {
    log.verbose('PuppetWhatsApp', 'messageRecall(%s)', messageId)
    const msg = this.messageStore[messageId]
    if (!msg) {
      log.error('Message %s not found', messageId)
      return false
    }
    return true
  }

  /**
   * get the file attached to the message
   * @param id message id
   * @returns the file that attached to the message
   */
  override async messageFile (id: string): Promise<FileBox> {
    log.verbose('PuppetWhatsApp', 'messageFile(%s)', id)
    const msg = this.messageStore[id]
    if (!msg) {
      log.error('Message %s not found', id)
      throw new Error('Message not found')
    }
    if (!msg.hasMedia) {
      log.error('Message %s does not contain any media', id)
      throw new Error('Message does not contain any media')
    }
    const media = await msg.downloadMedia()
    // FIXME: What to do when there is no filename
    return FileBox.fromBase64(media.data, media.filename ?? '')
  }

  /**
   * get url in the message
   * @param messageId message id
   * @returns url in the message
   */
  override async messageUrl (messageId: string): Promise<PUPPET.UrlLinkPayload> {
    log.verbose('PuppetWhatsApp', 'messageUrl(%s)', messageId)
    const msg = this.messageStore[messageId]
    if (!msg) {
      log.error('Message %s not found', messageId)
      throw new Error('Message not found')
    }
    if (msg.links.length === 0) {
      log.error('Message %s is does not contain links', messageId)
      throw new Error('Message does not contain links')
    }
    return {
      // FIXME: Link title not available in WhatsApp
      title: 'N/A',
      url: msg.links[0]!.link,
    }
  }

  /**
   * Not supported for WhatsApp
   * @param messageId message id
   */
  override async messageMiniProgram (messageId: string): Promise<PUPPET.MiniProgramPayload> {
    log.verbose('PuppetWhatsApp', 'messageMiniProgram(%s)', messageId)
    return PUPPET.throwUnsupportedError()
  }

  private async messageSend (conversationId: string, content: MessageContent): Promise<void> {
    log.verbose('PuppetWhatsApp', 'messageSend(%s, %s)', conversationId, typeof content)

    if (!this.whatsapp) {
      log.warn('PuppetWhatsApp', 'messageSend() this.client not found')
      return
    }

    const msg = await this.whatsapp.sendMessage(conversationId, content)
    this.messageStore[msg.id.id] = msg
  }

  override async messageSendText (conversationId: string, text: string): Promise<void> {
    log.verbose('PuppetWhatsApp', 'messageSendText(%s, %s)', conversationId, text)
    return this.messageSend(conversationId, text)
  }

  override async messageSendFile (conversationId: string, file: FileBox): Promise<void> {
    log.verbose('PuppetWhatsApp', 'messageSendFile(%s, %s)', conversationId, file.name)
    const msgContent = new WAWebJS.MessageMedia(file.mimeType!, await file.toBase64(), file.name)
    return this.messageSend(conversationId, msgContent)
  }

  override async messageSendContact (conversationId: string, contactId: string): Promise<void> {
    log.verbose('PuppetWhatsApp', 'messageSendContact(%s, %s)', conversationId, contactId)
    if (!this.whatsapp) {
      log.error('WhatsApp instance is undefined')
      return
    }
    const contact = await this.whatsapp.getContactById(contactId)
    await this.messageSend(conversationId, contact)
  }

  override async messageSendUrl (
    conversationId: string,
    urlLinkPayload: PUPPET.UrlLinkPayload,
  ): Promise<void> {
    log.verbose('PuppetWhatsApp', 'messageSendUrl(%s, %s)', conversationId, JSON.stringify(urlLinkPayload))
    // FIXME: Does WhatsApp really support link messages like wechat? Find out and fix this!
    await this.messageSend(conversationId, urlLinkPayload.url)
  }

  override async messageSendMiniProgram (conversationId: string, miniProgramPayload: PUPPET.MiniProgramPayload): Promise<void> {
    log.verbose(
      'PuppetWhatsApp',
      'messageSendMiniProgram(%s, %s)',
      conversationId,
      JSON.stringify(miniProgramPayload),
    )
    return PUPPET.throwUnsupportedError()
  }

  override async messageForward (conversationId: string, messageId: string): Promise<void> {
    log.verbose('PuppetWhatsApp', 'messageForward(%s, %s)', conversationId, messageId)
    const msg = this.messageStore[messageId]
    if (!msg) {
      log.error('')
    }
  }

  override async messageRawPayloadParser (whatsAppPayload: WhatsappMessage): Promise<PUPPET.MessagePayload> {
    let type: PUPPET.MessageType = PUPPET.MessageType.Unknown
    switch (whatsAppPayload.type) {
      case WAWebJS.MessageTypes.TEXT:
        type = PUPPET.MessageType.Text
        break
      case WAWebJS.MessageTypes.STICKER:
        type = PUPPET.MessageType.Emoticon
        break
      case WAWebJS.MessageTypes.VOICE:
        type = PUPPET.MessageType.Audio
        break
      case WAWebJS.MessageTypes.IMAGE:
        type = PUPPET.MessageType.Image
        break
      case WAWebJS.MessageTypes.AUDIO:
        type = PUPPET.MessageType.Audio
        break
      case WAWebJS.MessageTypes.VIDEO:
        type = PUPPET.MessageType.Video
        break
      case WAWebJS.MessageTypes.CONTACT_CARD:
        type = PUPPET.MessageType.Contact
        break
    }
    return {
      fromId        : whatsAppPayload.from,
      id            : whatsAppPayload.id.id,
      mentionIdList : whatsAppPayload.mentionedIds,
      text          : whatsAppPayload.body,
      timestamp     : Date.now(),
      toId          : whatsAppPayload.to,
      type,
      // filename
    }
  }

  override async messageRawPayload (id: string): Promise<WhatsappMessage> {
    log.verbose('PuppetWhatsApp', 'messageRawPayload(%s)', id)
    return this.messageStore[id]!
  }

  /**
   *
   * Room
   *
   */
  override async roomRawPayloadParser (whatsAppPayload: WhatsappContact): Promise<PUPPET.RoomPayload> {
    const chat = await this.whatsapp?.getChatById(whatsAppPayload.id._serialized) as GroupChat
    return {
      adminIdList:chat.participants.filter(p => p.isAdmin || p.isSuperAdmin).map(p => p.id._serialized),
      avatar : await whatsAppPayload.getProfilePicUrl(),
      id     : whatsAppPayload.id._serialized,
      memberIdList: chat.participants.map(p => p.id._serialized),
      topic   : whatsAppPayload.name || whatsAppPayload.pushname || '',
    }
  }

  override async roomRawPayload (id: string): Promise<WhatsappContact> {
    log.verbose('PuppetWhatsApp', 'roomRawPayload(%s)', id)
    if (this.roomStore[id]) {
      return this.roomStore[id]!
    } else {
      const rawRoom = await this.whatsapp!.getContactById(id)
      this.roomStore[id] = rawRoom
      return rawRoom
    }
  }

  override async roomList (): Promise<string[]> {
    log.verbose('PuppetWhatsApp', 'roomList()')
    return Object.keys(this.roomStore)
  }

  override async roomDel (
    roomId    : string,
    contactId : string,
  ): Promise<void> {
    log.verbose('PuppetWhatsApp', 'roomDel(%s, %s)', roomId, contactId)
    const chat = await this.whatsapp?.getChatById(roomId) as GroupChat
    await chat.removeParticipants([contactId])
  }

  override async roomAvatar (roomId: string): Promise<FileBox> {
    log.verbose('PuppetWhatsApp', 'roomAvatar(%s)', roomId)

    const payload = await this.roomPayload(roomId)

    if (payload.avatar) {
      return FileBox.fromUrl(payload.avatar)
    }
    log.warn('PuppetWhatsApp', 'roomAvatar() avatar not found, use the chatie default.')
    return avatarForGroup()
  }

  override async roomAdd (
    roomId    : string,
    contactId : string,
  ): Promise<void> {
    log.verbose('PuppetWhatsApp', 'roomAdd(%s, %s)', roomId, contactId)
    const chat = await this.whatsapp?.getChatById(roomId) as GroupChat
    await chat.addParticipants([contactId])
  }

  override async roomTopic (roomId: string)                : Promise<string>
  override async roomTopic (roomId: string, topic: string) : Promise<void>

  override async roomTopic (
    roomId: string,
    topic?: string,
  ): Promise<void | string> {
    log.verbose('PuppetWhatsApp', 'roomTopic(%s, %s)', roomId, topic)

    if (typeof topic === 'undefined') {
      return this.roomStore[roomId]?.name
    }
    const chat = await this.whatsapp?.getChatById(roomId) as GroupChat
    if (chat.isGroup) {
      await chat.setSubject(topic)
    }
    await this.dirtyPayload(PUPPET.PayloadType.Room, roomId)
  }

  override async roomCreate (
    contactIdList : string[],
    topic         : string,
  ): Promise<string> {
    log.verbose('PuppetWhatsApp', 'roomCreate(%s, %s)', contactIdList, topic)
    const group = await this.whatsapp?.createGroup(topic, contactIdList)
    if (group) {
      return group.gid
    } else {
      throw new WAError(WXWORK_ERROR_TYPE.ERR_CREATE_ROOM, 'An error occurred while creating the group!')
    }
  }

  override async roomQuit (roomId: string): Promise<void> {
    log.verbose('PuppetWhatsApp', 'roomQuit(%s)', roomId)
    const chat = await this.whatsapp?.getChatById(roomId) as GroupChat
    await chat.leave()
  }

  override async roomQRCode (roomId: string): Promise<string> {
    log.verbose('PuppetWhatsApp', 'roomQRCode(%s)', roomId)
    const con = await this.whatsapp!.getChatById(roomId)as GroupChat
    const code = await con.getInviteCode()
    const url = `https://chat.whatsapp.com/${code}`
    return url
  }

  override async roomMemberList (roomId: string) : Promise<string[]> {
    log.verbose('PuppetWhatsApp', 'roomMemberList(%s)', roomId)
    const chat = await this.whatsapp?.getChatById(roomId) as GroupChat
    return chat.participants.map(p => p.id._serialized)
  }

  override async roomMemberRawPayload (roomId: string, contactId: string): Promise<PUPPET.RoomMemberPayload>  {
    log.verbose('PuppetWhatsApp', 'roomMemberRawPayload(%s, %s)', roomId, contactId)
    const contact = await this.whatsapp!.getContactById(contactId)
    const avatar = await contact.getProfilePicUrl()
    return {
      avatar,
      id        : contact.id._serialized,
      name      : contact.pushname || contact.name || '',
      // roomAlias : contact.name,
    }
  }

  override async roomMemberRawPayloadParser (rawPayload: PUPPET.RoomMemberPayload): Promise<PUPPET.RoomMemberPayload>  {
    log.verbose('PuppetWhatsApp', 'roomMemberRawPayloadParser(%O)', rawPayload)
    return rawPayload
  }

  override async roomAnnounce (roomId: string)                : Promise<string>
  override async roomAnnounce (roomId: string, text: string)  : Promise<void>

  override async roomAnnounce (roomId: string, text?: string) : Promise<void | string> {
    return PUPPET.throwUnsupportedError()
  }

  /**
   *
   * Room Invitation
   *
   */
  override async roomInvitationAccept (roomInvitationId: string): Promise<void> {
    log.verbose('PuppetWhatsApp', 'roomInvitationAccept(%s)', roomInvitationId)
    const info = this.roomInvitationStore[roomInvitationId]
    if (info) {
      if (Object.keys(info).length === 1) {
        this.whatsapp?.acceptInvite(info.inviteCode!)
      } else {
        this.whatsapp?.acceptGroupV4Invite(info as WAWebJS.InviteV4Data)
      }

    }
  }

  override async roomInvitationRawPayload (roomInvitationId: string): Promise<any> {
    log.verbose('PuppetWhatsApp', 'roomInvitationRawPayload(%s)', roomInvitationId)
  }

  override async roomInvitationRawPayloadParser (rawPayload: any): Promise<PUPPET.RoomInvitationPayload> {
    log.verbose('PuppetWhatsApp', 'roomInvitationRawPayloadParser(%s)', JSON.stringify(rawPayload))
    return rawPayload
  }

  /**
   *
   * Friendship
   *
   */
  override async friendshipRawPayload (id: string): Promise<any> {
    return { id } as any
  }

  override async friendshipRawPayloadParser (rawPayload: any): Promise<PUPPET.FriendshipPayload> {
    return rawPayload
  }

  override async friendshipSearchPhone (
    phone: string,
  ): Promise<null | string> {
    log.verbose('PuppetWhatsApp', 'friendshipSearchPhone(%s)', phone)
    return null
  }

  override async friendshipSearchWeixin (
    weixin: string,
  ): Promise<null | string> {
    log.verbose('PuppetWhatsApp', 'friendshipSearchWeixin(%s)', weixin)
    return null
  }

  override async friendshipAdd (
    contactId : string,
    hello     : string,
  ): Promise<void> {
    log.verbose('PuppetWhatsApp', 'friendshipAdd(%s, %s)', contactId, hello)
  }

  override async friendshipAccept (
    friendshipId : string,
  ): Promise<void> {
    log.verbose('PuppetWhatsApp', 'friendshipAccept(%s)', friendshipId)
  }

  /**
   *
   * Tag
   *
   */
  override async tagContactAdd (
    tagId: string,
    contactId: string,
  ): Promise<void> {
    log.verbose('PuppetWhatsApp', 'tagContactAdd(%s)', tagId, contactId)
  }

  override async tagContactRemove (
    tagId: string,
    contactId: string,
  ): Promise<void> {
    log.verbose('PuppetWhatsApp', 'tagContactRemove(%s)', tagId, contactId)
  }

  override async tagContactDelete (
    tagId: string,
  ): Promise<void> {
    log.verbose('PuppetWhatsApp', 'tagContactDelete(%s)', tagId)
  }

  override async tagContactList (
    contactId?: string,
  ): Promise<string[]> {
    log.verbose('PuppetWhatsApp', 'tagContactList(%s)', contactId)
    return []
  }

}

export { PuppetWhatsapp }
export default PuppetWhatsapp
