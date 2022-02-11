import * as PUPPET from 'wechaty-puppet'
import { FileBox } from '../compact/index.js'
import type PuppetWhatsApp from '../puppet-whatsapp.js'
import { parserMessageRawPayload, parseVcard, convertMessagePayloadToClass } from '../pure-function-helpers/index.js'
import type {
  MessageContent,
  WhatsAppMessagePayload,
  MessageSendOptions,
} from '../schema/whatsapp-type.js'
import {
  MessageMedia,
  MessageTypes as WhatsAppMessageType,
} from '../schema/whatsapp-interface.js'
import { WA_ERROR_TYPE } from '../exceptions/error-type.js'
import WAError from '../exceptions/whatsapp-error.js'
import { withPrefix } from '../logger/index.js'
import { PRE } from '../config.js'

const logger = withPrefix(`${PRE} message`)

/**
  * Get contact message
  * @param messageId message Id
  * @returns contact name
  */
export async function messageContact (this: PuppetWhatsApp, messageId: string): Promise<string> {
  logger.info('messageContact(%s)', messageId)
  const cacheManager = await this.manager.getCacheManager()
  const msg = await cacheManager.getMessageRawPayload(messageId)
  if (!msg) {
    logger.error('Message %s not found', messageId)
    throw new WAError(WA_ERROR_TYPE.ERR_MSG_NOT_FOUND, `Message ${messageId} not found`)
  }
  if (msg.type !== WhatsAppMessageType.CONTACT_CARD) {
    logger.error('Message %s is not contact type', messageId)
    throw new WAError(WA_ERROR_TYPE.ERR_MSG_NOT_MATCH, `Message ${messageId} is not contact type`)
  }
  if (!msg.vCards[0]) {
    throw new WAError(WA_ERROR_TYPE.ERR_MSG_NOT_MATCH, `Message ${messageId} has no vCards info, detail: ${JSON.stringify(msg)}`)
  }
  try {
    const vcard = parseVcard(msg.vCards[0])
    return vcard.TEL![0]!.waid
  } catch (error) {
    throw new WAError(WA_ERROR_TYPE.ERR_MSG_CONTACT, `Can not parse contact card from message: ${messageId}, error: ${(error as Error).message}`)
  }
}

/**
* Recall message
* @param messageId message id
* @returns { Promise<boolean> }
*/
export async function messageRecall (this: PuppetWhatsApp, messageId: string): Promise<boolean> {
  logger.info('messageRecall(%s)', messageId)
  const cacheManager = await this.manager.getCacheManager()
  const msg = await cacheManager.getMessageRawPayload(messageId)
  if (!msg) {
    logger.error('Message %s not found', messageId)
    throw new WAError(WA_ERROR_TYPE.ERR_MSG_NOT_FOUND, `Message ${messageId} not found`)
  }
  const msgObj = convertMessagePayloadToClass(this.manager.getWhatsApp(), msg)
  try {
    await msgObj.delete(true)
    return true
  } catch (err) {
    logger.error(`Can not recall this message: ${messageId}, error: ${(err as Error).message}`)
    return false
  }
}

/**
* Get image from message
* @param messageId message id
* @param imageType image size to get (may not apply to WhatsApp)
* @returns the image
*/
export async function messageImage (this: PuppetWhatsApp, messageId: string, imageType: PUPPET.ImageType): Promise<FileBox> {
  logger.info('messageImage(%s, %s[%s])', messageId, imageType, PUPPET.ImageType[imageType])
  const cacheManager = await this.manager.getCacheManager()
  const msg = await cacheManager.getMessageRawPayload(messageId)
  if (!msg) {
    logger.error('Message %s not found', messageId)
    throw new WAError(WA_ERROR_TYPE.ERR_MSG_NOT_FOUND, `Message ${messageId} Not Found`)
  }
  if (msg.type !== WhatsAppMessageType.IMAGE || !msg.hasMedia) {
    logger.error('Message %s does not contain any media', messageId)
    throw new WAError(WA_ERROR_TYPE.ERR_MSG_NOT_MATCH, `Message ${messageId} does not contain any media`)
  }
  try {
    const media = await downloadMedia.call(this, msg)
    return FileBox.fromBase64(media.data, media.filename ?? 'img.jpg')
  } catch (error) {
    throw new WAError(WA_ERROR_TYPE.ERR_MSG_IMAGE, `Message ${messageId} does not contain any media`)
  }
}

/**
* Get the file attached to the message
* @param messageId message id
* @returns the file that attached to the message
*/
export async function messageFile (this: PuppetWhatsApp, messageId: string): Promise<FileBox> {
  logger.info('messageFile(%s)', messageId)
  const cacheManager = await this.manager.getCacheManager()
  const msg = await cacheManager.getMessageRawPayload(messageId)
  if (!msg) {
    logger.error('Message %s not found', messageId)
    throw new WAError(WA_ERROR_TYPE.ERR_MSG_NOT_FOUND, `Message ${messageId} Not Found`)
  }
  if (!msg.hasMedia) {
    logger.error('Message %s does not contain any media', messageId)
    throw new WAError(WA_ERROR_TYPE.ERR_MSG_NOT_MATCH, `Message ${messageId} does not contain any media`)
  }
  try {
    const media = await downloadMedia.call(this, msg)
    return FileBox.fromBase64(media.data, media.filename ?? '')
  } catch (error) {
    throw new WAError(WA_ERROR_TYPE.ERR_MSG_FILE, `Message ${messageId} does not contain any media`)
  }
}

async function downloadMedia (this: PuppetWhatsApp, msg: WhatsAppMessagePayload) {
  const msgObj = convertMessagePayloadToClass(this.manager.getWhatsApp(), msg)
  msgObj.hasMedia = true // FIXME: workaround for make media could be downloaded. see: https://github.com/wechaty/puppet-whatsapp/issues/165
  return msgObj.downloadMedia()
}

/**
* Get url in the message
* @param messageId message id
* @returns url in the message
*/
export async function messageUrl (this: PuppetWhatsApp, messageId: string): Promise<PUPPET.UrlLinkPayload> {
  logger.info('messageUrl(%s)', messageId)
  const cacheManager = await this.manager.getCacheManager()
  const msg = await cacheManager.getMessageRawPayload(messageId)
  if (!msg) {
    logger.error('Message %s not found', messageId)
    throw new WAError(WA_ERROR_TYPE.ERR_MSG_NOT_FOUND, `Message ${messageId} Not Found`)
  }
  if (msg.links.length === 0) {
    logger.error('Message %s is does not contain links', messageId)
    throw new WAError(WA_ERROR_TYPE.ERR_MSG_NOT_MATCH, `Message ${messageId} does not contain any link message.`)
  }
  try {
    return {
      description: msg.description || 'NO_DESCRIPTION',
      title: msg.title || 'NO_TITLE',
      url: msg.links[0]?.link || msg.body,
    }
  } catch (error) {
    throw new WAError(WA_ERROR_TYPE.ERR_MSG_URL_LINK, `Get link message: ${messageId} failed, error: ${(error as Error).message}`)
  }
}

/**
* Not supported for WhatsApp
* @param messageId message id
*/
export async function messageMiniProgram (this: PuppetWhatsApp, messageId: string): Promise<PUPPET.MiniProgramPayload> {
  logger.info('messageMiniProgram(%s)', messageId)
  return PUPPET.throwUnsupportedError()
}

export async function messageSend (this: PuppetWhatsApp, conversationId: string, content: MessageContent, options?: MessageSendOptions): Promise<string> {
  logger.info('messageSend(%s, %s)', conversationId, typeof content)

  const msg = await this.manager.sendMessage(conversationId, content, options)
  const messageId = msg.id.id
  const cacheManager = await this.manager.getCacheManager()
  await cacheManager.setMessageRawPayload(messageId, msg)
  return messageId
}

export async function messageSendText (this: PuppetWhatsApp, conversationId: string, text: string, mentions?: string[]): Promise<void | string> {
  logger.info('messageSendText(%s, %s)', conversationId, text)
  if (mentions) {
    const contacts = await Promise.all(mentions.map((v) => (
      this.manager.getContactById(v)
    )))
    return messageSend.call(this, conversationId, text, { mentions: contacts })
  } else {
    return messageSend.call(this, conversationId, text)
  }
}

export async function messageSendFile (this: PuppetWhatsApp, conversationId: string, file: FileBox, options?: MessageSendOptions): Promise<void | string> {
  logger.info('messageSendFile(%s, %s)', conversationId, file.name)
  await file.ready()
  const msgContent = new MessageMedia(file.mimeType!, await file.toBase64(), file.name)
  return messageSend.call(this, conversationId, msgContent, options)
}

export async function messageSendContact (this: PuppetWhatsApp, conversationId: string, contactId: string, options?: MessageSendOptions): Promise<void> {
  logger.info('messageSendContact(%s, %s)', conversationId, contactId)

  const contact = await this.manager.getContactById(contactId)
  await messageSend.call(this, conversationId, contact, options)
}

export async function messageSendUrl (
  this: PuppetWhatsApp,
  conversationId: string,
  urlLinkPayload: PUPPET.UrlLinkPayload,
): Promise<string> {
  logger.info('messageSendUrl(%s, %s)', conversationId, JSON.stringify(urlLinkPayload))
  return messageSend.call(this, conversationId, urlLinkPayload.url)
}

export async function messageSendMiniProgram (this: PuppetWhatsApp, conversationId: string, miniProgramPayload: PUPPET.MiniProgramPayload): Promise<void> {
  logger.verbose(
    'PuppetWhatsApp',
    'messageSendMiniProgram(%s, %s)',
    conversationId,
    JSON.stringify(miniProgramPayload),
  )
  return PUPPET.throwUnsupportedError()
}

export async function messageForward (this: PuppetWhatsApp, conversationId: string, messageId: string): Promise<void> {
  logger.info('messageForward(%s, %s)', conversationId, messageId)
  const cacheManager = await this.manager.getCacheManager()
  const msg = await cacheManager.getMessageRawPayload(messageId)
  if (!msg) {
    logger.error('Message %s not found', messageId)
    throw new WAError(WA_ERROR_TYPE.ERR_MSG_NOT_FOUND, `Message ${messageId} not found`)
  }
  const msgObj = convertMessagePayloadToClass(this.manager.getWhatsApp(), msg)
  try {
    await msgObj.forward(conversationId)
  } catch (error) {
    throw new WAError(WA_ERROR_TYPE.ERR_MSG_FORWARD, `Forward message: ${messageId} failed, error: ${(error as Error).message}`)
  }
}

export async function messageRawPayload (this: PuppetWhatsApp, id: string): Promise<WhatsAppMessagePayload> {
  logger.info('messageRawPayload(%s)', id)
  const cacheManager = await this.manager.getCacheManager()
  const msg = await cacheManager.getMessageRawPayload(id)
  if (!msg) {
    throw new WAError(WA_ERROR_TYPE.ERR_MSG_NOT_FOUND, `Can not find this message: ${id}`)
  }
  return msg
}

export async function messageRawPayloadParser (this: PuppetWhatsApp, whatsAppPayload: WhatsAppMessagePayload): Promise<PUPPET.MessagePayload> {
  const result = parserMessageRawPayload(whatsAppPayload)
  logger.verbose('messageRawPayloadParser whatsAppPayload(%s) result(%s)', JSON.stringify(whatsAppPayload), JSON.stringify(result))
  return result
}
