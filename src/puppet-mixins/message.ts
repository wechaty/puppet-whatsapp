import * as PUPPET from 'wechaty-puppet'

import { log, FileBox } from 'wechaty-puppet'
import WAWebJS from 'whatsapp-web.js'
import { PRE } from '../config.js'
import type { PuppetWhatsapp } from '../puppet-whatsapp.js'
import WAError from '../pure-function-helpers/error-type.js'
import { parseVcard } from '../pure-function-helpers/vcard-parser.js'
import type {  MessageContent } from '../schema/index.js'
import { WA_ERROR_TYPE } from '../schema/error-type.js'
import type { WhatsappMessage } from '../whatsapp'

/**
  * Get contact message
  * @param messageId message Id
  * @returns contact name
  */
export async function messageContact (this:PuppetWhatsapp, messageId: string): Promise<string> {
  log.verbose(PRE, 'messageContact(%s)', messageId)
  const cacheManager = await this.getCacheManager()
  const msg = await cacheManager.getMessageRawPayload(messageId)
  if (!msg) {
    log.error('Message %s not found', messageId)
    throw new WAError(WA_ERROR_TYPE.ERR_MSG_NOT_FOUND, `Message ${messageId} not found`)
  }
  if (msg.type !== WAWebJS.MessageTypes.CONTACT_CARD) {
    log.error('Message %s is not contact type', messageId)
    throw new WAError(WA_ERROR_TYPE.ERR_MSG_NOT_MATCH, `Message ${messageId} is not contact type`)
  }
  try {
    const vcard = parseVcard(msg.vCards[0]!)
    // FIXME: Under current typing configuration, it is not possible to return multiple vcards that WhatsApp allows
    // Therefore sending the first vcard only (for now?)
    if (!vcard.TEL) {
      log.warn('vcard has not TEL field')
    }
    return vcard.TEL ? vcard.TEL.waid : ''
  } catch (error) {
    throw new WAError(WA_ERROR_TYPE.ERR_MSG_CONTACT, `Can not parse contact card from message: ${messageId}, error: ${(error as Error).message}`)
  }
}

/**
* Get image from message
* @param messageId message id
* @param imageType image size to get (may not apply to WhatsApp)
* @returns the image
*/
export async function messageImage (this:PuppetWhatsapp, messageId: string, imageType: PUPPET.ImageType): Promise<FileBox> {
  log.info(PRE, 'messageImage(%s, %s[%s])', messageId, imageType, PUPPET.ImageType[imageType])
  const cacheManager = await this.getCacheManager()
  const msg = await cacheManager.getMessageRawPayload(messageId)
  if (!msg) {
    log.error('Message %s not found', messageId)
    throw new WAError(WA_ERROR_TYPE.ERR_MSG_NOT_FOUND, `Message ${messageId} Not Found`)
  }
  if (msg.type !== WAWebJS.MessageTypes.IMAGE || !msg.hasMedia) {
    log.error('Message %s does not contain any media', messageId)
    throw new WAError(WA_ERROR_TYPE.ERR_MSG_NOT_MATCH, `Message ${messageId} does not contain any media`)
  }
  try {
    const media = await msg.downloadMedia()
    return FileBox.fromBase64(media.data, media.filename ?? '')
  } catch (error) {
    throw new WAError(WA_ERROR_TYPE.ERR_MSG_IMAGE, `Message ${messageId} does not contain any media`)
  }
}

/**
* Recall message
* @param messageId message id
* @returns { Promise<boolean> }
*/
export async function messageRecall (this:PuppetWhatsapp, messageId: string): Promise<boolean> {
  log.info(PRE, 'messageRecall(%s)', messageId)
  const cacheManager = await this.getCacheManager()
  const msg = await cacheManager.getMessageRawPayload(messageId)
  if (!msg) {
    log.error('Message %s not found', messageId)
    throw new WAError(WA_ERROR_TYPE.ERR_MSG_NOT_FOUND, `Message ${messageId} not found`)
  }

  try {
    await msg.delete(true)
    return true
  } catch (error) {
    log.error(`Can not recall this message: ${messageId}, error: ${(error as Error).message}`)
    return false
  }
}

/**
* Get the file attached to the message
* @param messageId message id
* @returns the file that attached to the message
*/
export async function messageFile (this:PuppetWhatsapp, messageId: string): Promise<FileBox> {
  log.info(PRE, 'messageFile(%s)', messageId)
  const cacheManager = await this.getCacheManager()
  const msg = await cacheManager.getMessageRawPayload(messageId)
  if (!msg) {
    log.error('Message %s not found', messageId)
    throw new WAError(WA_ERROR_TYPE.ERR_MSG_NOT_FOUND, `Message ${messageId} Not Found`)
  }
  if (!msg.hasMedia) {
    log.error('Message %s does not contain any media', messageId)
    throw new WAError(WA_ERROR_TYPE.ERR_MSG_NOT_MATCH, `Message ${messageId} does not contain any media`)
  }
  try {
    const media = await msg.downloadMedia()
    return FileBox.fromBase64(media.data, media.filename ?? '')
  } catch (error) {
    throw new WAError(WA_ERROR_TYPE.ERR_MSG_FILE, `Message ${messageId} does not contain any media`)
  }
}

/**
* Get url in the message
* @param messageId message id
* @returns url in the message
*/
export async function messageUrl (this:PuppetWhatsapp, messageId: string): Promise<PUPPET.UrlLinkPayload> {
  log.info(PRE, 'messageUrl(%s)', messageId)
  const cacheManager = await this.getCacheManager()
  const msg = await cacheManager.getMessageRawPayload(messageId)
  if (!msg) {
    log.error('Message %s not found', messageId)
    throw new WAError(WA_ERROR_TYPE.ERR_MSG_NOT_FOUND, `Message ${messageId} Not Found`)
  }
  if (msg.links.length === 0) {
    log.error('Message %s is does not contain links', messageId)
    throw new WAError(WA_ERROR_TYPE.ERR_MSG_NOT_MATCH, `Message ${messageId} does not contain any link message.`)
  }
  try {
    return {
      // FIXME: Link title not available in WhatsApp
      title: 'N/A',
      url: msg.links[0]!.link,
    }
  } catch (error) {
    throw new WAError(WA_ERROR_TYPE.ERR_MSG_URL_LINK, `Get link message: ${messageId} failed, error: ${(error as Error).message}`)
  }
}

/**
* Not supported for WhatsApp
* @param messageId message id
*/
export async function messageMiniProgram (this:PuppetWhatsapp, messageId: string): Promise<PUPPET.MiniProgramPayload> {
  log.info(PRE, 'messageMiniProgram(%s)', messageId)
  return PUPPET.throwUnsupportedError()
}

export async function messageSend (this:PuppetWhatsapp, conversationId: string, content: MessageContent): Promise<void> {
  log.verbose(PRE, 'messageSend(%s, %s)', conversationId, typeof content)

  if (!this.getWhatsapp()) {
    log.warn(PRE, 'messageSend() this.client not found')
    return
  }

  const msg = await this.getWhatsapp()!.sendMessage(conversationId, content)
  const messageId = msg.id.id
  const cacheManager = await this.getCacheManager()
  await cacheManager.setMessageRawPayload(messageId, msg)
}

export async function messageSendText (this:PuppetWhatsapp, conversationId: string, text: string): Promise<void> {
  log.info(PRE, 'messageSendText(%s, %s)', conversationId, text)
  return messageSend.call(this, conversationId, text)
}

export async function messageSendFile (this:PuppetWhatsapp, conversationId: string, file: FileBox): Promise<void> {
  log.info(PRE, 'messageSendFile(%s, %s)', conversationId, file.name)
  const msgContent = new WAWebJS.MessageMedia(file.mimeType!, await file.toBase64(), file.name)
  return messageSend.call(this, conversationId, msgContent)
}

export async function messageSendContact (this:PuppetWhatsapp, conversationId: string, contactId: string): Promise<void> {
  log.info(PRE, 'messageSendContact(%s, %s)', conversationId, contactId)
  if (!this.getWhatsapp()) {
    log.error('WhatsApp instance is undefined')
    return
  }
  const contact = await this.getWhatsapp()!.getContactById(contactId)
  await messageSend.call(this, conversationId, contact)
}

export async function messageSendUrl (
  this:PuppetWhatsapp,
  conversationId: string,
  urlLinkPayload: PUPPET.UrlLinkPayload,
): Promise<void> {
  log.info(PRE, 'messageSendUrl(%s, %s)', conversationId, JSON.stringify(urlLinkPayload))
  // FIXME: Does WhatsApp really support link messages like wechat? Find out and fix this!
  await messageSend.call(this, conversationId, urlLinkPayload.url)
}

export async function messageSendMiniProgram (this:PuppetWhatsapp, conversationId: string, miniProgramPayload: PUPPET.MiniProgramPayload): Promise<void> {
  log.info(
    'PuppetWhatsApp',
    'messageSendMiniProgram(%s, %s)',
    conversationId,
    JSON.stringify(miniProgramPayload),
  )
  return PUPPET.throwUnsupportedError()
}

export async function messageForward (this:PuppetWhatsapp, conversationId: string, messageId: string): Promise<void> {
  log.info(PRE, 'messageForward(%s, %s)', conversationId, messageId)
  const cacheManager = await this.getCacheManager()
  const msg = await cacheManager.getMessageRawPayload(messageId)
  if (!msg) {
    log.error('Message %s not found', messageId)
    throw new WAError(WA_ERROR_TYPE.ERR_MSG_NOT_FOUND, `Message ${messageId} not found`)
  }
  try {
    await msg.forward(conversationId)
  } catch (error) {
    throw new WAError(WA_ERROR_TYPE.ERR_MSG_FORWARD, `Forward message: ${messageId} failed, error: ${(error as Error).message}`)
  }
}

export async function messageRawPayloadParser (this:PuppetWhatsapp, whatsAppPayload: WhatsappMessage): Promise<PUPPET.MessagePayload> {
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
    fromId: whatsAppPayload.from,
    id: whatsAppPayload.id.id,
    mentionIdList: whatsAppPayload.mentionedIds,
    text: whatsAppPayload.body,
    timestamp: Date.now(),
    toId: whatsAppPayload.to,
    type,
    // filename
  }
}

export async function messageRawPayload (this:PuppetWhatsapp, id: string): Promise<WhatsappMessage> {
  log.verbose(PRE, 'messageRawPayload(%s)', id)
  const cacheManager = await this.getCacheManager()
  const msg = await cacheManager.getMessageRawPayload(id)
  if (!msg) {
    throw new WAError(WA_ERROR_TYPE.ERR_MSG_NOT_FOUND, `Can not find this message: ${id}`)
  }
  return msg
}
