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
import path from 'path'

import {
  ContactPayload,
  FileBox,
  FriendshipPayload,
  ImageType,
  MemoryCard,
  MessagePayload,
  MessageType,
  ContactType,
  ContactGender,
  MiniProgramPayload,
  PayloadType,
  Puppet,
  PuppetOptions,
  RoomInvitationPayload,
  RoomMemberPayload,
  RoomPayload,
  ScanStatus,
  UrlLinkPayload,

  log,
  throwUnsupportedError,
}                           from 'wechaty-puppet'

import {
  CHATIE_OFFICIAL_ACCOUNT_QRCODE,
  MEMORY_SLOT,
  qrCodeForChatie,
  VERSION,
}                                     from './config.js'

import {
  getWhatsApp,
  WhatsApp,
  WhatsappContact,
  WhatsappMessage,
}                   from './whatsapp.js'

// import { Attachment } from './mock/user/types'
// import { UrlLink, MiniProgram } from 'wechaty'

export type PuppetWhatsAppOptions = PuppetOptions & {
  memory?: MemoryCard
}

class PuppetWhatsapp extends Puppet {

  static override readonly VERSION = VERSION

  private loopTimer?: ReturnType<typeof setInterval>

  private messageStore: { [id: string]: WhatsappMessage }
  private contactStore: { [id: string]: WhatsappContact }
  private whatsapp: undefined | WhatsApp

  constructor (
    public override options: PuppetWhatsAppOptions = {},
  ) {
    super(options)
    log.verbose('PuppetWhatsApp', 'constructor()')

    this.messageStore = {}
    this.contactStore = {}
  }

  override async start (): Promise<void> {
    log.verbose('PuppetWhatsApp', 'start()')

    if (this.state.on()) {
      log.warn('PuppetWhatsApp', 'start() is called on a ON puppet. await ready(on) and return.')
      await this.state.ready('on')
      return
    }

    this.state.on('pending')

    const session = await this.memory.get(MEMORY_SLOT)
    const whatsapp = await getWhatsApp(session)
    this.whatsapp = whatsapp

    this.initWhatsAppEvents(whatsapp)

    /**
     * Huan(202102): initialize() will rot be resolved not before bot log in
     */
    whatsapp
      .initialize()
      .then(() => log.verbose('PuppetWhatsApp', 'start() whatsapp.initialize() done'))
      .catch(e => {
        if (this.state.on()) {
          console.error(e)
          log.error('PuppetWhatsApp', 'start() whatsapp.initialize() rejection: %s', e)
        } else {
          // Puppet is stoping...
          log.verbose('PuppetWhatsApp', 'start() whatsapp.initialize() rejected on a stopped puppet.')
        }
      })

    await super.start()

    /**
     * Huan(202102): Wait for Puppeteer to be inited before resolve start() for robust state management
     */
    const future = new Promise<void>(resolve => {
      function check () {
        if (whatsapp.pupBrowser) {
          resolve()
        } else {
          // process.stdout.write('.')
          setTimeout(check, 100)
        }
      }

      check()
    })

    await Promise.race([
      future,
      this.state.ready('off'),
    ])
  }

  override async stop (): Promise<void> {
    log.verbose('PuppetWhatsApp', 'stop()')

    if (this.state.off()) {
      log.warn('PuppetWhatsApp', 'stop() is called on a OFF puppet. await ready(off) and return.')
      await this.state.ready('off')
      return
    }

    if (!this.whatsapp) {
      log.error('PuppetWhatsApp', 'stop() this.whatsapp is undefined!')
      return
    }

    this.state.off('pending')

    if (this.loopTimer) {
      clearInterval(this.loopTimer)
    }

    try {
      if (this.logonoff()) {
        await this.logout()
      }

      await this.whatsapp.destroy()

      await super.stop()

    } finally {
      this.whatsapp = undefined
      this.state.off(true)
    }

  }

  private initWhatsAppEvents (
    whatsapp: WhatsApp,
  ): void {
    log.verbose('PuppetwhatsApp', 'initWhatsAppEvents()')

    whatsapp.on('authenticated', async (session) => {
      try {
        // save session file
        await this.memory.set(MEMORY_SLOT, session)
        await this.memory.save()
      } catch (e) {
        console.error(e)
        log.error('PuppetWhatsApp', 'getClient() whatsapp.on(authenticated) rejection: %s', e)
      }
    })

    whatsapp.on('ready', async () => {
      this.id = whatsapp.info.wid.user
      this.state.on(true)
      const contacts: WhatsappContact[] = await whatsapp.getContacts()
      for (const contact of contacts) {
        this.contactStore[contact.id._serialized] = contact
      }
      this.emit('login', { contactId: whatsapp.info.wid._serialized })
    })

    whatsapp.on('message', (msg: WhatsappMessage) => {
      const id = msg.id.id
      this.messageStore[id] = msg
      this.emit('message', { messageId : msg.id.id })
    })

    whatsapp.on('qr', (qr) => {
      // NOTE: This event will not be fired if a session is specified.
      // console.log('QR RECEIVED', qr);
      this.emit('scan', { qrcode : qr, status : ScanStatus.Waiting })
    })
  }

  // login (contactId: string): Promise<void> {
  //   log.verbose('PuppetWhatsApp', 'login()')
  //   return super.login(contactId)
  // }

  // async logout (): Promise<void> {
  //   log.verbose('PuppetWhatsApp', 'logout()')

  //   if (!this.id) {
  //     throw new Error('logout before login?')
  //   }

  //   this.emit('logout', { contactId: this.id, data: 'test' }) // before we will throw above by logonoff() when this.user===undefined
  //   this.id = undefined

  //   // TODO: do the logout job
  // }

  ding (data?: string): void {
    log.silly('PuppetWhatsApp', 'ding(%s)', data || '')
    setTimeout(() => this.emit('dong', { data: data || '' }), 1000)
  }

  override unref (): void {
    log.verbose('PuppetWhatsApp', 'unref()')
    super.unref()
    if (this.loopTimer) {
      this.loopTimer.unref()
    }
  }

  /**
   *
   * ContactSelf
   *
   *
   */
  async contactSelfQRCode (): Promise<string> {
    log.verbose('PuppetWhatsApp', 'contactSelfQRCode()')
    return CHATIE_OFFICIAL_ACCOUNT_QRCODE
  }

  async contactSelfName (name: string): Promise<void> {
    log.verbose('PuppetWhatsApp', 'contactSelfName(%s)', name)
  }

  async contactSelfSignature (signature: string): Promise<void> {
    log.verbose('PuppetWhatsApp', 'contactSelfSignature(%s)', signature)
  }

  /**
   *
   * Contact
   *
   */
  contactAlias (contactId: string)                      : Promise<string>
  contactAlias (contactId: string, alias: string | null): Promise<void>

  async contactAlias (contactId: string, alias?: string | null): Promise<void | string> {
    log.verbose('PuppetWhatsApp', 'contactAlias(%s, %s)', contactId, alias)

    if (typeof alias === 'undefined') {
      return 'mock alias'
    }
  }

  public async contactPhone (contactId: string): Promise<string[]>
  public async contactPhone (contactId: string, phoneList: string[]): Promise<void>

  public async contactPhone (contactId: string, phoneList?: string[]): Promise<string[] | void> {
    log.verbose('PuppetWhatsApp', 'contactPhone(%s, %s)', contactId, phoneList)
    if (typeof phoneList === 'undefined') {
      return []
    }
  }

  public async contactCorporationRemark (contactId: string, corporationRemark: string) {
    log.verbose('PuppetWhatsApp', 'contactCorporationRemark(%s, %s)', contactId, corporationRemark)
  }

  public async contactDescription (contactId: string, description: string) {
    log.verbose('PuppetWhatsApp', 'contactDescription(%s, %s)', contactId, description)
  }

  public async contactList (): Promise<string[]> {
    log.verbose('PuppetWhatsApp', 'contactList()')
    return []
  }

  async contactQRCode (contactId: string): Promise<string> {
    log.verbose('PuppetWhatsApp', 'contactQRCode(%s)', contactId)
    if (contactId !== this.selfId()) {
      throw new Error('can not set avatar for others')
    }

    throw new Error('not supported')
    // return await this.bridge.WXqr
  }

  async contactAvatar (contactId: string)                : Promise<FileBox>
  async contactAvatar (contactId: string, file: FileBox) : Promise<void>

  async contactAvatar (contactId: string, file?: FileBox): Promise<void | FileBox> {
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
    const WECHATY_ICON_PNG = path.resolve('../../docs/images/wechaty-icon.png')
    return FileBox.fromFile(WECHATY_ICON_PNG)
  }

  async contactRawPayloadParser (whatsAppPayload: WhatsappContact): Promise<ContactPayload> {
    let type, name
    if (whatsAppPayload.isUser) {
      type = ContactType.Individual
    } else if (whatsAppPayload.isEnterprise) {
      type = ContactType.Corporation
    } else {
      type = ContactType.Unknown
    }

    if (whatsAppPayload.name === undefined) {
      name = ''
    } else {
      name = whatsAppPayload.name
    }
    return {
      avatar : await whatsAppPayload.getProfilePicUrl(),
      gender : ContactGender.Unknown,
      id     : whatsAppPayload.id.user,
      name   : name,
      phone : [whatsAppPayload.number],
      type   : type,
    }
  }

  async contactRawPayload (id: string): Promise<WhatsappContact> {
    log.verbose('PuppetWhatsApp', 'contactRawPayload(%s)', id)
    return this.contactStore[id]!
  }

  /**
   *
   * Conversation
   *
   */
  async conversationReadMark (
    conversationId: string,
    hasRead?: boolean,
  ) : Promise<void | boolean> {
    log.verbose('PuppetWhatsApp', 'conversationReadMark(%s, %s)', conversationId, hasRead)
    return throwUnsupportedError()
  }

  /**
   *
   * Message
   *
   */
  async messageContact (
    messageId: string,
  ): Promise<string> {
    log.verbose('PuppetWhatsApp', 'messageContact(%s)', messageId)
    // const attachment = this.mocker.MockMessage.loadAttachment(messageId)
    // if (attachment instanceof ContactMock) {
    //   return attachment.id
    // }
    return ''
  }

  async messageImage (
    messageId: string,
    imageType: ImageType,
  ) : Promise<FileBox> {
    log.verbose('PuppetWhatsApp', 'messageImage(%s, %s[%s])',
      messageId,
      imageType,
      ImageType[imageType],
    )
    // const attachment = this.mocker.MockMessage.loadAttachment(messageId)
    // if (attachment instanceof FileBox) {
    //   return attachment
    // }
    return FileBox.fromQRCode('fake-qrcode')
  }

  async messageRecall (
    messageId: string,
  ): Promise<boolean> {
    log.verbose('PuppetWhatsApp', 'messageRecall(%s)', messageId)
    return false
  }

  async messageFile (id: string): Promise<FileBox> {
    // const attachment = this.mocker.MockMessage.loadAttachment(id)
    // if (attachment instanceof FileBox) {
    //   return attachment
    // }
    return FileBox.fromBase64(
      'cRH9qeL3XyVnaXJkppBuH20tf5JlcG9uFX1lL2IvdHRRRS9kMMQxOPLKNYIzQQ==',
      'mock-file' + id + '.txt',
    )
  }

  async messageUrl (messageId: string)  : Promise<UrlLinkPayload> {
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

  async messageMiniProgram (messageId: string): Promise<MiniProgramPayload> {
    log.verbose('PuppetWhatsApp', 'messageMiniProgram(%s)', messageId)
    // const attachment = this.mocker.MockMessage.loadAttachment(messageId)
    // if (attachment instanceof MiniProgram) {
    //   return attachment.payload
    // }
    return {
      title : 'mock title for ' + messageId,
    }
  }

  async messageRawPayloadParser (whatsAppPayload: WhatsappMessage): Promise<MessagePayload> {
    return {
      fromId        : whatsAppPayload.from,
      id            : whatsAppPayload.id.id,
      mentionIdList : whatsAppPayload.mentionedIds,
      text          : whatsAppPayload.body,
      timestamp     : Date.now(),
      toId          : whatsAppPayload.to,
      type          : MessageType.Text,
    }
  }

  async messageRawPayload (id: string): Promise<WhatsappMessage> {
    log.verbose('PuppetWhatsApp', 'messageRawPayload(%s)', id)
    return this.messageStore[id]!
  }

  private async messageSend (
    conversationId: string,
    something: string | FileBox, // | Attachment
  ): Promise<void> {
    log.verbose('PuppetWhatsApp', 'messageSend(%s, %s)', conversationId, something)
    if (!this.id) {
      throw new Error('no this.id')
    }

    if (typeof something !== 'string') {
      return
    }

    if (!this.whatsapp) {
      log.warn('PuppetWhatsApp', 'messageSend() this.client not found')
      return
    }

    await this.whatsapp.sendMessage(conversationId, something)
    // const user = this.mocker.ContactMock.load(this.id)
    // let conversation

    // if (/@/.test(conversationId)) {
    //   // FIXME: extend a new puppet method messageRoomSendText, etc, for Room message?
    //   conversation = this.mocker.RoomMock.load(conversationId)
    // } else {
    //   conversation = this.mocker.ContactMock.load(conversationId)
    // }
    // user.say(something).to(conversation)
  }

  async messageSendText (
    conversationId: string,
    text     : string,
  ): Promise<void> {
    return this.messageSend(conversationId, text)
  }

  async messageSendFile (
    conversationId: string,
    file     : FileBox,
  ): Promise<void> {
    return this.messageSend(conversationId, file)
  }

  async messageSendContact (
    conversationId: string,
    contactId : string,
  ): Promise<void> {
    log.verbose('PuppetWhatsApp', 'messageSendUrl(%s, %s)', conversationId, contactId)

    // const contact = this.mocker.MockContact.load(contactId)
    // return this.messageSend(conversationId, contact)
  }

  async messageSendUrl (
    conversationId: string,
    urlLinkPayload: UrlLinkPayload,
  ) : Promise<void> {
    log.verbose('PuppetWhatsApp', 'messageSendUrl(%s, %s)', conversationId, JSON.stringify(urlLinkPayload))

    // const url = new UrlLink(urlLinkPayload)
    // return this.messageSend(conversationId, url)
  }

  async messageSendMiniProgram (
    conversationId: string,
    miniProgramPayload: MiniProgramPayload,
  ): Promise<void> {
    log.verbose('PuppetWhatsApp', 'messageSendMiniProgram(%s, %s)', conversationId, JSON.stringify(miniProgramPayload))
    // const miniProgram = new MiniProgram(miniProgramPayload)
    // return this.messageSend(conversationId, miniProgram)
  }

  async messageForward (
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
  async roomRawPayloadParser (payload: RoomPayload) { return payload }
  async roomRawPayload (id: string): Promise<RoomPayload> {
    log.verbose('PuppetWhatsApp', 'roomRawPayload(%s)', id)
    return {} as any
  }

  async roomList (): Promise<string[]> {
    log.verbose('PuppetWhatsApp', 'roomList()')
    return []
  }

  async roomDel (
    roomId    : string,
    contactId : string,
  ): Promise<void> {
    log.verbose('PuppetWhatsApp', 'roomDel(%s, %s)', roomId, contactId)
  }

  async roomAvatar (roomId: string): Promise<FileBox> {
    log.verbose('PuppetWhatsApp', 'roomAvatar(%s)', roomId)

    const payload = await this.roomPayload(roomId)

    if (payload.avatar) {
      return FileBox.fromUrl(payload.avatar)
    }
    log.warn('PuppetWhatsApp', 'roomAvatar() avatar not found, use the chatie default.')
    return qrCodeForChatie()
  }

  async roomAdd (
    roomId    : string,
    contactId : string,
  ): Promise<void> {
    log.verbose('PuppetWhatsApp', 'roomAdd(%s, %s)', roomId, contactId)
  }

  async roomTopic (roomId: string)                : Promise<string>
  async roomTopic (roomId: string, topic: string) : Promise<void>

  async roomTopic (
    roomId: string,
    topic?: string,
  ): Promise<void | string> {
    log.verbose('PuppetWhatsApp', 'roomTopic(%s, %s)', roomId, topic)

    if (typeof topic === 'undefined') {
      return 'mock room topic'
    }

    await this.dirtyPayload(PayloadType.Room, roomId)
  }

  async roomCreate (
    contactIdList : string[],
    topic         : string,
  ): Promise<string> {
    log.verbose('PuppetWhatsApp', 'roomCreate(%s, %s)', contactIdList, topic)

    return 'mock_room_id'
  }

  async roomQuit (roomId: string): Promise<void> {
    log.verbose('PuppetWhatsApp', 'roomQuit(%s)', roomId)
  }

  async roomQRCode (roomId: string): Promise<string> {
    log.verbose('PuppetWhatsApp', 'roomQRCode(%s)', roomId)
    return roomId + ' mock qrcode'
  }

  async roomMemberList (roomId: string) : Promise<string[]> {
    log.verbose('PuppetWhatsApp', 'roomMemberList(%s)', roomId)
    return []
  }

  async roomMemberRawPayload (roomId: string, contactId: string): Promise<RoomMemberPayload>  {
    log.verbose('PuppetWhatsApp', 'roomMemberRawPayload(%s, %s)', roomId, contactId)
    return {
      avatar    : 'mock-avatar-data',
      id        : 'xx',
      name      : 'mock-name',
      roomAlias : 'yy',
    }
  }

  async roomMemberRawPayloadParser (rawPayload: RoomMemberPayload): Promise<RoomMemberPayload>  {
    log.verbose('PuppetWhatsApp', 'roomMemberRawPayloadParser(%s)', rawPayload)
    return rawPayload
  }

  async roomAnnounce (roomId: string)                : Promise<string>
  async roomAnnounce (roomId: string, text: string)  : Promise<void>

  async roomAnnounce (roomId: string, text?: string) : Promise<void | string> {
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
  async roomInvitationAccept (roomInvitationId: string): Promise<void> {
    log.verbose('PuppetWhatsApp', 'roomInvitationAccept(%s)', roomInvitationId)
  }

  async roomInvitationRawPayload (roomInvitationId: string): Promise<any> {
    log.verbose('PuppetWhatsApp', 'roomInvitationRawPayload(%s)', roomInvitationId)
  }

  async roomInvitationRawPayloadParser (rawPayload: any): Promise<RoomInvitationPayload> {
    log.verbose('PuppetWhatsApp', 'roomInvitationRawPayloadParser(%s)', JSON.stringify(rawPayload))
    return rawPayload
  }

  /**
   *
   * Friendship
   *
   */
  async friendshipRawPayload (id: string): Promise<any> {
    return { id } as any
  }

  async friendshipRawPayloadParser (rawPayload: any): Promise<FriendshipPayload> {
    return rawPayload
  }

  async friendshipSearchPhone (
    phone: string,
  ): Promise<null | string> {
    log.verbose('PuppetWhatsApp', 'friendshipSearchPhone(%s)', phone)
    return null
  }

  async friendshipSearchWeixin (
    weixin: string,
  ): Promise<null | string> {
    log.verbose('PuppetWhatsApp', 'friendshipSearchWeixin(%s)', weixin)
    return null
  }

  async friendshipAdd (
    contactId : string,
    hello     : string,
  ): Promise<void> {
    log.verbose('PuppetWhatsApp', 'friendshipAdd(%s, %s)', contactId, hello)
  }

  async friendshipAccept (
    friendshipId : string,
  ): Promise<void> {
    log.verbose('PuppetWhatsApp', 'friendshipAccept(%s)', friendshipId)
  }

  /**
   *
   * Tag
   *
   */
  async tagContactAdd (
    tagId: string,
    contactId: string,
  ): Promise<void> {
    log.verbose('PuppetWhatsApp', 'tagContactAdd(%s)', tagId, contactId)
  }

  async tagContactRemove (
    tagId: string,
    contactId: string,
  ): Promise<void> {
    log.verbose('PuppetWhatsApp', 'tagContactRemove(%s)', tagId, contactId)
  }

  async tagContactDelete (
    tagId: string,
  ): Promise<void> {
    log.verbose('PuppetWhatsApp', 'tagContactDelete(%s)', tagId)
  }

  async tagContactList (
    contactId?: string,
  ): Promise<string[]> {
    log.verbose('PuppetWhatsApp', 'tagContactList(%s)', contactId)
    return []
  }

}

export { PuppetWhatsapp }
export default PuppetWhatsapp
