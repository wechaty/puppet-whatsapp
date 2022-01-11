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
import * as path from 'path'

import * as PUPPET from 'wechaty-puppet'
import { log } from 'wechaty-puppet'
import type { MemoryCard } from 'memory-card'
import { FileBox } from 'file-box'
import type { FileBoxInterface } from 'file-box'

import { CHATIE_OFFICIAL_ACCOUNT_QRCODE, MEMORY_SLOT, qrCodeForChatie, VERSION } from './config.js'

import { getWhatsApp, WhatsApp, WhatsappContact, WhatsappMessage } from './whatsapp.js'
import { MessageContent, MessageMedia, MessageTypes } from 'whatsapp-web.js'

// import { Attachment } from './mock/user/types'

export type PuppetWhatsAppOptions = PUPPET.PuppetOptions & {
  memory?: MemoryCard
}

class PuppetWhatsapp extends PUPPET.Puppet {

  static override readonly VERSION = VERSION

  private messageStore: { [id: string]: WhatsappMessage }
  private contactStore: { [id: string]: WhatsappContact }
  private whatsapp: undefined | WhatsApp

  constructor (override options: PuppetWhatsAppOptions = {}) {
    super(options)
    log.verbose('PuppetWhatsApp', 'constructor()')

    this.messageStore = {}
    this.contactStore = {}
  }

  override async onStart (): Promise<void> {
    log.verbose('PuppetWhatsApp', 'onStart()')

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
      .catch((e) => {
        if (this.state.active()) {
          console.error(e)
          log.error('PuppetWhatsApp', 'start() whatsapp.initialize() rejection: %s', e)
        } else {
          // Puppet is stopping...
          log.verbose(
            'PuppetWhatsApp',
            'start() whatsapp.initialize() rejected on a stopped puppet.',
          )
        }
      })

    /**
     * Huan(202102): Wait for Puppeteer to be inited before resolve start() for robust state management
     */
    const future = new Promise<void>((resolve) => {
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

    await Promise.race([future, this.state.stable('inactive')])
  }

  override async onStop (): Promise<void> {
    log.verbose('PuppetWhatsApp', 'onStop()')

    if (!this.whatsapp) {
      log.error('PuppetWhatsApp', 'stop() this.whatsapp is undefined!')
      return
    }

    const whatsapp = this.whatsapp
    this.whatsapp = undefined
    await whatsapp.destroy()
  }

  private initWhatsAppEvents (whatsapp: WhatsApp): void {
    log.verbose('PuppetWhatsApp', 'initWhatsAppEvents()')

    whatsapp.on('authenticated', (session) => {
      ; (async () => {
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
      ; (async () => {
        // this.id = whatsapp.info.wid.user
        // this.state.active(true)
        const contacts: WhatsappContact[] = await whatsapp.getContacts()
        for (const contact of contacts) {
          this.contactStore[contact.id._serialized] = contact
        }
        this.login(whatsapp.info.wid._serialized)
        // this.emit('login', { contactId: whatsapp.info.wid._serialized })
      })().catch(console.error)
    })

    whatsapp.on('message', (msg: WhatsappMessage) => {
      const id = msg.id.id
      this.messageStore[id] = msg
      this.emit('message', { messageId: msg.id.id })
    })

    whatsapp.on('qr', (qr) => {
      // NOTE: This event will not be fired if a session is specified.
      // console.log('QR RECEIVED', qr);
      this.emit('scan', { qrcode: qr, status: PUPPET.types.ScanStatus.Waiting })
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
    return CHATIE_OFFICIAL_ACCOUNT_QRCODE
  }

  override async contactSelfName (name: string): Promise<void> {
    log.verbose('PuppetWhatsApp', 'contactSelfName(%s)', name)
  }

  override async contactSelfSignature (signature: string): Promise<void> {
    log.verbose('PuppetWhatsApp', 'contactSelfSignature(%s)', signature)
  }

  /**
   *
   * Contact
   *
   */
  override contactAlias(contactId: string): Promise<string>
  override contactAlias(contactId: string, alias: string | null): Promise<void>

  override async contactAlias (contactId: string, alias?: string | null): Promise<void | string> {
    log.verbose('PuppetWhatsApp', 'contactAlias(%s, %s)', contactId, alias)

    if (typeof alias === 'undefined') {
      return 'mock alias'
    }
  }

  override async contactPhone(contactId: string): Promise<string[]>
  override async contactPhone(contactId: string, phoneList: string[]): Promise<void>

  override async contactPhone (contactId: string, phoneList?: string[]): Promise<string[] | void> {
    log.verbose('PuppetWhatsApp', 'contactPhone(%s, %s)', contactId, phoneList)
    if (typeof phoneList === 'undefined') {
      return []
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

  override async contactAvatar(contactId: string): Promise<FileBoxInterface>
  override async contactAvatar(contactId: string, file: FileBoxInterface): Promise<void>

  override async contactAvatar (
    contactId: string,
    file?: FileBoxInterface,
  ): Promise<void | FileBoxInterface> {
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

  override async contactRawPayloadParser (
    whatsAppPayload: WhatsappContact,
  ): Promise<PUPPET.payloads.Contact> {
    let type, name
    if (whatsAppPayload.isUser) {
      type = PUPPET.types.Contact.Individual
    } else if (whatsAppPayload.isEnterprise) {
      type = PUPPET.types.Contact.Corporation
    } else {
      type = PUPPET.types.Contact.Unknown
    }

    if (whatsAppPayload.name === undefined) {
      name = ''
    } else {
      name = whatsAppPayload.name
    }
    return {
      avatar: await whatsAppPayload.getProfilePicUrl(),
      gender: PUPPET.types.ContactGender.Unknown,
      id: whatsAppPayload.id.user,
      name: name,
      phone: [whatsAppPayload.number],
      type: type,
    }
  }

  override async contactRawPayload (id: string): Promise<WhatsappContact> {
    log.verbose('PuppetWhatsApp', 'contactRawPayload(%s)', id)
    return this.contactStore[id]!
  }

  /**
   *
   * Conversation
   *
   */
  override async conversationReadMark (
    conversationId: string,
    hasRead?: boolean,
  ): Promise<void | boolean> {
    log.verbose('PuppetWhatsApp', 'conversationReadMark(%s, %s)', conversationId, hasRead)
    if (!this.whatsapp) {
      log.error('WhatsApp instance does not exist')
      throw new Error('WhatsApp instance does not exist')
    }
    const chat = await this.whatsapp.getChatById(conversationId)
    const unreadCount = chat.unreadCount
    if (unreadCount) {
      return true
    }
    return false
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
    // const attachment = this.mocker.MockMessage.loadAttachment(messageId)
    // if (attachment instanceof ContactMock) {
    //   return attachment.id
    // }
    const msg = this.messageStore[messageId]
    if (!msg) {
      log.error('Message %s not found', messageId)
      throw new Error('Message not found')
    }
    if (msg.type !== MessageTypes.CONTACT_CARD) {
      log.error('Message %s is not contact type', messageId)
      throw new Error('Message is not contact type')
    }
    // NOTE: Under current typing configuration, it is not possible to return multiple vcards that WhatsApp allows
    // Therefore sending the first vcard only (for now?)
    return msg.vCards[0]!
  }

  /**
   * get image from message
   * @param messageId message id
   * @param imageType image size to get (may not apply to WhatsApp)
   * @returns the image
   */
  override async messageImage (messageId: string, imageType: PUPPET.types.Image): Promise<FileBoxInterface> {
    log.verbose('PuppetWhatsApp', 'messageImage(%s, %s[%s])', messageId, imageType, PUPPET.types.Image[imageType])
    const msg = this.messageStore[messageId]
    if (!msg) {
      log.error('Message %s not found', messageId)
      throw new Error('Message Not Found')
    }
    if (msg.type !== MessageTypes.IMAGE || !msg.hasMedia) {
      log.error('Message %s does not contain any media', messageId)
      throw new Error('Message does not contain any media')
    }
    const media = await msg.downloadMedia()
    return FileBox.fromBase64(media.data, media.filename ?? undefined)
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
    await msg.delete(true)
    return true
  }

  /**
   * get the file attached to the message
   * @param id message id
   * @returns the file that attached to the message
   */
  override async messageFile (id: string): Promise<FileBoxInterface> {
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
    return FileBox.fromBase64(media.data, media.filename ?? undefined)
  }

  /**
   * get url in the message
   * @param messageId message id
   * @returns url in the message
   */
  override async messageUrl (messageId: string): Promise<PUPPET.payloads.UrlLink> {
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
  override async messageMiniProgram (messageId: string): Promise<PUPPET.payloads.MiniProgram> {
    log.verbose('PuppetWhatsApp', 'messageMiniProgram(%s)', messageId)
    PUPPET.throwUnsupportedError()
    throw new Error('WhatsApp does not support miniProgram')
  }

  override async messageRawPayloadParser (whatsAppPayload: WhatsappMessage): Promise<PUPPET.payloads.Message> {
    return {
      fromId: whatsAppPayload.from,
      id: whatsAppPayload.id.id,
      mentionIdList: whatsAppPayload.mentionedIds,
      text: whatsAppPayload.body,
      timestamp: Date.now(),
      toId: whatsAppPayload.to,
      type: PUPPET.types.Message.Text,
    }
  }

  override async messageRawPayload (id: string): Promise<WhatsappMessage> {
    log.verbose('PuppetWhatsApp', 'messageRawPayload(%s)', id)
    return this.messageStore[id]!
  }

  private async messageSend (conversationId: string, content: MessageContent): Promise<void> {
    log.verbose('PuppetWhatsApp', 'messageSend(%s, %s)', conversationId, typeof content)

    if (!this.whatsapp) {
      log.warn('PuppetWhatsApp', 'messageSend() this.client not found')
      return
    }

    await this.whatsapp.sendMessage(conversationId, content)
    // const user = this.mocker.ContactMock.load(this.currentUserId)
    // let conversation

    // if (/@/.test(conversationId)) {
    //   // FIXME: extend a new puppet method messageRoomSendText, etc, for Room message?
    //   conversation = this.mocker.RoomMock.load(conversationId)
    // } else {
    //   conversation = this.mocker.ContactMock.load(conversationId)
    // }
    // user.say(something).to(conversation)
  }

  override async messageSendText (conversationId: string, text: string): Promise<void> {
    log.verbose('PuppetWhatsApp', 'messageSendText(%s, %s)', conversationId, text)
    return this.messageSend(conversationId, text)
  }

  override async messageSendFile (conversationId: string, file: FileBox): Promise<void> {
    log.verbose('PuppetWhatsApp', 'messageSendFile(%s, %s)', conversationId, file.name)
    const msgContent = new MessageMedia(file.mediaType, await file.toBase64(), file.name)
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
    urlLinkPayload: PUPPET.payloads.UrlLink,
  ): Promise<void> {
    log.verbose('PuppetWhatsApp', 'messageSendUrl(%s, %s)', conversationId, JSON.stringify(urlLinkPayload))
    // FIXME: Does WhatsApp really support link messages like wechat? Find out and fix this!
    await this.messageSend(conversationId, urlLinkPayload.url)
  }

  override async messageSendMiniProgram (
    conversationId: string,
    miniProgramPayload: PUPPET.payloads.MiniProgram,
  ): Promise<void> {
    log.verbose(
      'PuppetWhatsApp',
      'messageSendMiniProgram(%s, %s)',
      conversationId,
      JSON.stringify(miniProgramPayload),
    )
    PUPPET.throwUnsupportedError()
  }

  override async messageForward (conversationId: string, messageId: string): Promise<void> {
    log.verbose('PuppetWhatsApp', 'messageForward(%s, %s)', conversationId, messageId)
    const msg = this.messageStore[messageId]
    if (!msg) {
      log.error('')
    }
  }

  /**
   *
   * Room
   *
   */
  override async roomRawPayloadParser (payload: PUPPET.payloads.Room) {
    return payload
  }

  override async roomRawPayload (id: string): Promise<PUPPET.payloads.Room> {
    log.verbose('PuppetWhatsApp', 'roomRawPayload(%s)', id)
    return {} as any
  }

  override async roomList (): Promise<string[]> {
    log.verbose('PuppetWhatsApp', 'roomList()')
    return []
  }

  override async roomDel (roomId: string, contactId: string): Promise<void> {
    log.verbose('PuppetWhatsApp', 'roomDel(%s, %s)', roomId, contactId)
  }

  override async roomAvatar (roomId: string): Promise<FileBoxInterface> {
    log.verbose('PuppetWhatsApp', 'roomAvatar(%s)', roomId)

    const payload = await this.roomPayload(roomId)

    if (payload.avatar) {
      return FileBox.fromUrl(payload.avatar)
    }
    log.warn('PuppetWhatsApp', 'roomAvatar() avatar not found, use the chatie default.')
    return qrCodeForChatie()
  }

  override async roomAdd (roomId: string, contactId: string): Promise<void> {
    log.verbose('PuppetWhatsApp', 'roomAdd(%s, %s)', roomId, contactId)
  }

  override async roomTopic(roomId: string): Promise<string>
  override async roomTopic(roomId: string, topic: string): Promise<void>

  override async roomTopic (roomId: string, topic?: string): Promise<void | string> {
    log.verbose('PuppetWhatsApp', 'roomTopic(%s, %s)', roomId, topic)

    if (typeof topic === 'undefined') {
      return 'mock room topic'
    }

    await this.dirtyPayload(PUPPET.types.Payload.Room, roomId)
  }

  override async roomCreate (contactIdList: string[], topic: string): Promise<string> {
    log.verbose('PuppetWhatsApp', 'roomCreate(%s, %s)', contactIdList, topic)

    return 'mock_room_id'
  }

  override async roomQuit (roomId: string): Promise<void> {
    log.verbose('PuppetWhatsApp', 'roomQuit(%s)', roomId)
  }

  override async roomQRCode (roomId: string): Promise<string> {
    log.verbose('PuppetWhatsApp', 'roomQRCode(%s)', roomId)
    return roomId + ' mock qrcode'
  }

  override async roomMemberList (roomId: string): Promise<string[]> {
    log.verbose('PuppetWhatsApp', 'roomMemberList(%s)', roomId)
    return []
  }

  override async roomMemberRawPayload (
    roomId: string,
    contactId: string,
  ): Promise<PUPPET.payloads.RoomMember> {
    log.verbose('PuppetWhatsApp', 'roomMemberRawPayload(%s, %s)', roomId, contactId)
    return {
      avatar: 'mock-avatar-data',
      id: 'xx',
      name: 'mock-name',
      roomAlias: 'yy',
    }
  }

  override async roomMemberRawPayloadParser (
    rawPayload: PUPPET.payloads.RoomMember,
  ): Promise<PUPPET.payloads.RoomMember> {
    log.verbose('PuppetWhatsApp', 'roomMemberRawPayloadParser(%s)', rawPayload)
    return rawPayload
  }

  override async roomAnnounce(roomId: string): Promise<string>
  override async roomAnnounce(roomId: string, text: string): Promise<void>

  override async roomAnnounce (roomId: string, text?: string): Promise<void | string> {
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
  }

  override async roomInvitationRawPayload (roomInvitationId: string): Promise<any> {
    log.verbose('PuppetWhatsApp', 'roomInvitationRawPayload(%s)', roomInvitationId)
  }

  override async roomInvitationRawPayloadParser (
    rawPayload: any,
  ): Promise<PUPPET.payloads.RoomInvitation> {
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

  override async friendshipRawPayloadParser (rawPayload: any): Promise<PUPPET.payloads.Friendship> {
    return rawPayload
  }

  override async friendshipSearchPhone (phone: string): Promise<null | string> {
    log.verbose('PuppetWhatsApp', 'friendshipSearchPhone(%s)', phone)
    return null
  }

  override async friendshipSearchWeixin (weixin: string): Promise<null | string> {
    log.verbose('PuppetWhatsApp', 'friendshipSearchWeixin(%s)', weixin)
    return null
  }

  override async friendshipAdd (contactId: string, hello: string): Promise<void> {
    log.verbose('PuppetWhatsApp', 'friendshipAdd(%s, %s)', contactId, hello)
  }

  override async friendshipAccept (friendshipId: string): Promise<void> {
    log.verbose('PuppetWhatsApp', 'friendshipAccept(%s)', friendshipId)
  }

  /**
   *
   * Tag
   *
   */
  override async tagContactAdd (tagId: string, contactId: string): Promise<void> {
    log.verbose('PuppetWhatsApp', 'tagContactAdd(%s)', tagId, contactId)
  }

  override async tagContactRemove (tagId: string, contactId: string): Promise<void> {
    log.verbose('PuppetWhatsApp', 'tagContactRemove(%s)', tagId, contactId)
  }

  override async tagContactDelete (tagId: string): Promise<void> {
    log.verbose('PuppetWhatsApp', 'tagContactDelete(%s)', tagId)
  }

  override async tagContactList (contactId?: string): Promise<string[]> {
    log.verbose('PuppetWhatsApp', 'tagContactList(%s)', contactId)
    return []
  }

}

export { PuppetWhatsapp }
export default PuppetWhatsapp
