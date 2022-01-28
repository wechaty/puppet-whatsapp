import type { Client as WhatsApp, Contact, InviteV4Data, MessageContent, MessageSendOptions } from '@juzibot/whatsapp-web.js'
import { RateManager } from './rateManager.js'

export class RequestManager {

  private whatsapp: WhatsApp
  private rateManager: RateManager

  constructor (whatsapp: WhatsApp) {
    this.whatsapp = whatsapp
    this.rateManager = new RateManager()
  }

  public logout () {
    return this.whatsapp.logout()
  }

  public acceptPrivateRoomInvite (invitation: InviteV4Data) {
    return this.whatsapp.acceptGroupV4Invite(invitation)
  }

  public acceptRoomInvite (inviteCode: string) {
    return this.whatsapp.acceptInvite(inviteCode)
  }

  public archiveChat (chatId: string) {
    return this.whatsapp.archiveChat(chatId)
  }

  public unarchiveChat (chatId: string) {
    return this.whatsapp.unarchiveChat(chatId)
  }

  public createRoom (name: string, participants: Contact[] | string[]) {
    return this.whatsapp.createGroup(name, participants)
  }

  public destroy () {
    return this.whatsapp.destroy()
  }

  public getBLockedContacts () {
    return this.whatsapp.getBlockedContacts()
  }

  public getChatById (chatId: string) {
    return this.whatsapp.getChatById(chatId)
  }

  public getChatLabels (chatId: string) {
    return this.whatsapp.getChatLabels(chatId)
  }

  public getChats () {
    return this.whatsapp.getChats()
  }

  public getChatsByLabelId (labelId: string) {
    return this.whatsapp.getChatsByLabelId(labelId)
  }

  public getContactById (contactId: string) {
    return this.whatsapp.getContactById(contactId)
  }

  public getContacts () {
    return this.whatsapp.getContacts()
  }

  public getCountryCode (whatsappId: string) {
    return this.whatsapp.getCountryCode(whatsappId)
  }

  public getFormattedNumber (whatsappId: string) {
    return this.whatsapp.getFormattedNumber(whatsappId)
  }

  public getInviteInfo (inviteId: string) {
    return this.whatsapp.getInviteInfo(inviteId)
  }

  public getLabelById (labelId: string) {
    return this.whatsapp.getLabelById(labelId)
  }

  public getLabels () {
    return this.whatsapp.getLabels()
  }

  public getWhatsappIdByNumber (number: string) {
    return this.whatsapp.getNumberId(number)
  }

  public getAvatarUrl (contactId: string) {
    return this.whatsapp.getProfilePicUrl(contactId)
  }

  public getState () {
    return this.whatsapp.getState()
  }

  public getWhatsAppVersion () {
    return this.whatsapp.getWWebVersion()
  }

  public init () {
    return this.whatsapp.initialize()
  }

  public isWhatsappUser (contactId: string) {
    return this.whatsapp.isRegisteredUser(contactId)
  }

  public markChatUnread (chatId: string) {
    return this.whatsapp.markChatUnread(chatId)
  }

  public muteChat (chatId: string) {
    return this.whatsapp.muteChat(chatId)
  }

  public unmuteChat (chatId: string) {
    return this.whatsapp.unmuteChat(chatId)
  }

  public pinChat (chatId: string) {
    return this.whatsapp.pinChat(chatId)
  }

  public unpinChat (chatId: string) {
    return this.whatsapp.unpinChat(chatId)
  }

  public resetConnection () {
    return this.whatsapp.resetState()
  }

  public searchMessage (query: string, options?: { chatId?: string, page?: number, limit?: number }) {
    return this.whatsapp.searchMessages(query, options)
  }

  public sendMessage (chatId: string, content: MessageContent, options?: MessageSendOptions) {
    return this.rateManager.exec(async () => {
      return this.whatsapp.sendMessage(chatId, content, options)
    }, { delayAfter: 1, queueId: chatId })
  }

  public sendPresenceAvailable () {
    return this.whatsapp.sendPresenceAvailable()
  }

  public markChatRead (chatId: string) {
    return this.whatsapp.sendSeen(chatId)
  }

  public setNickname (name: string) {
    return this.whatsapp.setDisplayName(name)
  }

  public setStatusMessage (status: string) {
    return this.whatsapp.setStatus(status)
  }

}
