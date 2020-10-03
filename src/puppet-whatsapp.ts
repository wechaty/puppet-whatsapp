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

import { Client, Message } from 'whatsapp-web.js'
import path  from 'path'

import {
  ContactPayload,
  FileBox,

  FriendshipPayload,

  ImageType,

  MessagePayload,

  Puppet,
  PuppetOptions,

  RoomInvitationPayload,
  RoomMemberPayload,
  RoomPayload,

  UrlLinkPayload,
  MiniProgramPayload,

  log,
  PayloadType,
  MessageType, ScanStatus,
} from 'wechaty-puppet'

import {
  VERSION, CHATIE_OFFICIAL_ACCOUNT_QRCODE, qrCodeForChatie, SESSION_FILE_PATH,
}                                   from './config'

// import { Attachment } from './mock/user/types'

import {
  Mocker,
  // ContactMock,
}                     from './mock/mod'
// import { UrlLink, MiniProgram } from 'wechaty'
import * as fs from 'fs'

export type PuppetWhatsAppOptions = PuppetOptions & {
  mocker?: Mocker,
}

const messageStore: any = {}
let sessionCfg
if (fs.existsSync(SESSION_FILE_PATH)) {
  sessionCfg = require(SESSION_FILE_PATH)
}
const client = new Client(
  {
    puppeteer : {
      headless: true,
    },

    session: sessionCfg,
  }
)

class PuppetWhatsapp extends Puppet {

  static readonly VERSION = VERSION

  private loopTimer?: NodeJS.Timer

  mocker: Mocker

  constructor (
    public options: PuppetWhatsAppOptions = {},
  ) {
    super(options)
    log.verbose('PuppetWhatsApp', 'constructor()')

    if (options.mocker) {
      log.verbose('PuppetWhatsApp', 'constructor() use options.mocker')
      this.mocker = options.mocker
    } else {
      log.verbose('PuppetWhatsApp', 'constructor() creating the default mocker')
      this.mocker = new Mocker()
      // this.mocker.use(SimpleBehavior())
    }
    this.mocker.puppet = this
  }

  async start (): Promise<void> {
    log.verbose('PuppetWhatsApp', 'start()')

    if (this.state.on()) {
      log.warn('PuppetWhatsApp', 'start() is called on a ON puppet. await ready(on) and return.')
      await this.state.ready('on')
      return
    }

    this.state.on('pending')

    client.on('ready', () => {
      this.id = client.info.me.user
      this.state.on(true)
      this.emit('login', { contactId: client.info.me.user })
    })

    client.on('message', (msg: Message) => {
      messageStore[msg.id.id] = msg
      this.emit('message', { messageId : msg.id.id })
    })

    client.on('qr', (qr) => {
      // NOTE: This event will not be fired if a session is specified.
      // console.log('QR RECEIVED', qr);
      this.emit('scan', { qrcode : qr, status : ScanStatus.Waiting })
    })

    client.on('authenticated', (session) => {
      sessionCfg = session
      fs.writeFile(SESSION_FILE_PATH, JSON.stringify(session), function (err) {
        if (err) {
          console.error(err)
        }
      })
    })
    void client.initialize()
    /**
     * Start mocker after the puppet fully turned ON.
     */
    setImmediate(() => this.mocker.start())
  }

  async stop (): Promise<void> {
    log.verbose('PuppetWhatsApp', 'stop()')

    if (this.state.off()) {
      log.warn('PuppetWhatsApp', 'stop() is called on a OFF puppet. await ready(off) and return.')
      await this.state.ready('off')
      return
    }

    this.state.off('pending')

    if (this.loopTimer) {
      clearInterval(this.loopTimer)
    }

    this.mocker.stop()

    if (this.logonoff()) {
      await this.logout()
    }

    // await some tasks...
    this.state.off(true)
  }

  login (contactId: string): Promise<void> {
    log.verbose('PuppetWhatsApp', 'login()')
    return super.login(contactId)
  }

  async logout (): Promise<void> {
    log.verbose('PuppetWhatsApp', 'logout()')

    if (!this.id) {
      throw new Error('logout before login?')
    }

    this.emit('logout', { contactId: this.id, data: 'test' }) // before we will throw above by logonoff() when this.user===undefined
    this.id = undefined

    // TODO: do the logout job
  }

  ding (data?: string): void {
    log.silly('PuppetWhatsApp', 'ding(%s)', data || '')
    setTimeout(() => this.emit('dong', { data: data || '' }), 1000)
  }

  unref (): void {
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
    return [...this.mocker.cacheContactPayload.keys()]
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

  async contactRawPayloadParser (payload: ContactPayload) { return payload }
  async contactRawPayload (id: string): Promise<ContactPayload> {
    log.verbose('PuppetWhatsApp', 'contactRawPayload(%s)', id)
    return this.mocker.contactPayload(id)
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

  async messageRawPayloadParser (whatsAppPayload: Message): Promise<MessagePayload> {
    const payload: MessagePayload = {
      fromId       :  whatsAppPayload.from,
      id           :  whatsAppPayload.id.id,
      mentionIdList:  whatsAppPayload.mentionedIds,
      text         :  whatsAppPayload.body,
      timestamp    :  Date.now(),
      toId         :  whatsAppPayload.to,
      type         :  MessageType.Text,
    }
    return payload
  }

  async messageRawPayload (id: string): Promise<MessagePayload> {
    log.verbose('PuppetWhatsApp', 'messageRawPayload(%s)', id)
    return messageStore[id]
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
    void client.sendMessage(conversationId, something)
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
    return this.mocker.roomPayload(id)
  }

  async roomList (): Promise<string[]> {
    log.verbose('PuppetWhatsApp', 'roomList()')
    return [...this.mocker.cacheRoomPayload.keys()]
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
