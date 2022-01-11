import type { Client, Contact, InviteV4Data, MessageContent, MessageSendOptions } from 'whatsapp-web.js'
import { RateManager } from './rateManager.js'

export class RequestManager {

  private client: Client
  private rateManager: RateManager

  constructor (client: Client) {
    this.client = client
    this.rateManager = new RateManager()
  }

  public logout () {
    return this.client.logout()
  }

  public acceptPrivateRoomInvite (invitation: InviteV4Data) {
    return this.client.acceptGroupV4Invite(invitation)
  }

  public acceptRoomInvite (inviteCode: string) {
    return this.client.acceptInvite(inviteCode)
  }

  public archiveChat (chatId: string) {
    return this.client.archiveChat(chatId)
  }

  public unarchiveChat (chatId: string) {
    return this.client.unarchiveChat(chatId)
  }

  public createRoom (name: string, participants: Contact[] | string[]) {
    return this.client.createGroup(name, participants)
  }

  public destroy () {
    return this.client.destroy()
  }

  public getBLockedContacts () {
    return this.client.getBlockedContacts()
  }

  public getChatById (chatId: string) {
    return this.client.getChatById(chatId)
  }

  public getChatLabels (chatId: string) {
    return this.client.getChatLabels(chatId)
  }

  public getChats () {
    return this.client.getChats()
  }

  public getChatsByLabelId (labelId: string) {
    return this.client.getChatsByLabelId(labelId)
  }

  public getContactById (contactId: string) {
    return this.client.getContactById(contactId)
  }

  public getContacts () {
    return this.client.getContacts()
  }

  public getCountryCode (whatsappId: string) {
    return this.client.getCountryCode(whatsappId)
  }

  public getFormattedNumber (whatsappId: string) {
    return this.client.getFormattedNumber(whatsappId)
  }

  public getInviteInfo (inviteId: string) {
    return this.client.getInviteInfo(inviteId)
  }

  public getLabelById (labelId: string) {
    return this.client.getLabelById(labelId)
  }

  public getLabels () {
    return this.client.getLabels()
  }

  public getWhatsappIdByNumber (number: string) {
    return this.client.getNumberId(number)
  }

  public getAvatarUrl (contactId: string) {
    return this.client.getProfilePicUrl(contactId)
  }

  public getState () {
    return this.client.getState()
  }

  public getClientVersion () {
    return this.client.getWWebVersion()
  }

  public init () {
    return this.client.initialize()
  }

  public isWhatsappUser (contactId: string) {
    return this.client.isRegisteredUser(contactId)
  }

  public markChatUnread (chatId: string) {
    return this.client.markChatUnread(chatId)
  }

  public muteChat (chatId: string) {
    return this.client.muteChat(chatId)
  }

  public unmuteChat (chatId: string) {
    return this.client.unmuteChat(chatId)
  }

  public pinChat (chatId: string) {
    return this.client.pinChat(chatId)
  }

  public unpinChat (chatId: string) {
    return this.client.unpinChat(chatId)
  }

  public resetConnection () {
    return this.client.resetState()
  }

  public searchMessage (query: string, options?: { chatId?: string, page?: number, limit?: number }) {
    return this.client.searchMessages(query, options)
  }

  public sendMessage (chatId: string, content: MessageContent, options?: MessageSendOptions) {
    return this.rateManager.exec(async () => {
      return this.client.sendMessage(chatId, content, options)
    }, { delayAfter: 1, queueId: chatId })
  }

  public sendPresenceAvailable () {
    return this.client.sendPresenceAvailable()
  }

  public markChatRead (chatId: string) {
    return this.client.sendSeen(chatId)
  }

  public setNickname (name: string) {
    return this.client.setDisplayName(name)
  }

  public setStatusMessage (status: string) {
    return this.client.setStatus(status)
  }

}
