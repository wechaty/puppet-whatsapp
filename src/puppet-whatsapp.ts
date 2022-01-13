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
import { log, FileBox } from 'wechaty-puppet'
import type { MemoryCard } from 'memory-card'
import { distinctUntilKeyChanged, fromEvent, map, merge } from 'rxjs'
import {
  avatarForGroup,
  MEMORY_SLOT,
  VERSION,
}                                     from './config.js'

import {
  getWhatsApp,
  WhatsApp,
  WhatsappContact,
  WhatsappMessage,
}                   from './whatsapp.js'
import WAWebJS, { ClientOptions, GroupChat  } from 'whatsapp-web.js'
import { Manager } from './work/manager.js'
// @ts-ignore
// import { MessageTypes } from 'whatsapp-web.js'
// import { Attachment } from './mock/user/types'

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

  override async start (): Promise<void> {
    log.verbose('PuppetWhatsApp', 'onStart()')
    if (this.state.on()) {
      await this.state.ready('on')
      return
    }
    const session = await this.memory.get(MEMORY_SLOT)
    const whatsapp = await getWhatsApp(this.options['puppeteerOptions'] as ClientOptions, session)
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
          // Puppet is stoping...
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
          // process.stdout.write('.')
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

    whatsapp.on('ready', () => {
      (async () => {
        // this.id = whatsapp.info.wid.user
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
        // this.emit('login', { contactId: whatsapp.info.wid._serialized })
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
      // console.log('QR RECEIVED', qr);
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

    /**
     * 1. set
     */
    if (file) {
      return
    }

    /**
     * 2. get
     */
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
  override async messageContact (
    messageId: string,
  ): Promise<string> {
    log.verbose('PuppetWhatsApp', 'messageContact(%s)', messageId)
    // const attachment = this.mocker.MockMessage.loadAttachment(messageId)
    // if (attachment instanceof ContactMock) {
    //   return attachment.id
    // }
    return ''
  }

  override async messageImage (
    messageId: string,
    imageType: PUPPET.ImageType,
  ) : Promise<FileBox> {
    log.verbose('PuppetWhatsApp', 'messageImage(%s, %s[%s])',
      messageId,
      imageType,
      PUPPET.ImageType[imageType],
    )
    // const attachment = this.mocker.MockMessage.loadAttachment(messageId)
    // if (attachment instanceof FileBox) {
    //   return attachment
    // }
    return FileBox.fromQRCode('fake-qrcode')
  }

  override async messageRecall (
    messageId: string,
  ): Promise<boolean> {
    log.verbose('PuppetWhatsApp', 'messageRecall(%s)', messageId)
    return false
  }

  override async messageFile (id: string): Promise<FileBox> {
    // const attachment = this.mocker.MockMessage.loadAttachment(id)
    // if (attachment instanceof FileBox) {
    //   return attachment
    // }
    return FileBox.fromBase64(
      'cRH9qeL3XyVnaXJkppBuH20tf5JlcG9uFX1lL2IvdHRRRS9kMMQxOPLKNYIzQQ==',
      'mock-file' + id + '.txt',
    )
  }

  override async messageUrl (messageId: string)  : Promise<PUPPET.UrlLinkPayload> {
    log.verbose('PuppetWhatsApp', 'messageUrl(%s)', messageId)
    // const attachment = this.mocker.MockMessage.loadAttachment(messageId)
    // if (attachment instanceof UrlLink) {
    //   return attachment.payload
    // }
    return {
      title : 'mock title for ' + messageId,
      url   : 'https://mock.url',
    }
  }

  override async messageMiniProgram (messageId: string): Promise<PUPPET.MiniProgramPayload> {
    log.verbose('PuppetWhatsApp', 'messageMiniProgram(%s)', messageId)
    // const attachment = this.mocker.MockMessage.loadAttachment(messageId)
    // if (attachment instanceof MiniProgram) {
    //   return attachment.payload
    // }
    return {
      title : 'mock title for ' + messageId,
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

  private async messageSend (
    conversationId: string,
    something: string | FileBox, // | Attachment
  ): Promise<string | void> {
    log.verbose('PuppetWhatsApp', 'messageSend(%s, %s)', conversationId, something)

    if (typeof something !== 'string') {
      return
    }

    if (!this.whatsapp) {
      log.warn('PuppetWhatsApp', 'messageSend() this.client not found')
      return
    }

    const msgSent = await this.whatsapp.sendMessage(conversationId, something)
    return msgSent.id._serialized
  }

  override async messageSendText (
    conversationId: string,
    text     : string,
  ): Promise<string | void> {
    return this.messageSend(conversationId, text)
  }

  override async messageSendFile (
    conversationId: string,
    file     : FileBox,
  ): Promise<string | void> {
    return this.messageSend(conversationId, file)
  }

  override async messageSendContact (
    conversationId: string,
    contactId : string,
  ): Promise<void> {
    log.verbose('PuppetWhatsApp', 'messageSendUrl(%s, %s)', conversationId, contactId)

    // const contact = this.mocker.MockContact.load(contactId)
    // return this.messageSend(conversationId, contact)
  }

  override async messageSendUrl (
    conversationId: string,
    urlLinkPayload: PUPPET.UrlLinkPayload,
  ) : Promise<void> {
    log.verbose('PuppetWhatsApp', 'messageSendUrl(%s, %s)', conversationId, JSON.stringify(urlLinkPayload))

    // const url = new UrlLink(urlLinkPayload)
    // return this.messageSend(conversationId, url)
  }

  override async messageSendMiniProgram (
    conversationId: string,
    miniProgramPayload: PUPPET.MiniProgramPayload,
  ): Promise<void> {
    log.verbose('PuppetWhatsApp', 'messageSendMiniProgram(%s, %s)', conversationId, JSON.stringify(miniProgramPayload))
    // const miniProgram = new MiniProgram(miniProgramPayload)
    // return this.messageSend(conversationId, miniProgram)
  }

  override async messageForward (
    conversationId: string,
    messageId : string,
  ): Promise<void> {
    log.verbose('PuppetWhatsApp', 'messageForward(%s, %s)',
      conversationId,
      messageId,
    )
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
      throw new Error('An error occurred while creating the group!')
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
    if (text) {
      return
    }
    return 'mock announcement for ' + roomId
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
