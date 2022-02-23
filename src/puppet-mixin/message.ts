import * as PUPPET from 'wechaty-puppet'
import * as path from 'path'
import type PuppetWhatsApp from '../puppet-whatsapp.js'
import { parserMessageRawPayload } from '../helper/pure-function/index.js'
import type {
  MessageContent,
  WhatsAppMessagePayload,
  MessageSendOptions,
} from '../schema/whatsapp-type.js'
import {
  MessageMedia,
} from '../schema/whatsapp-interface.js'
import { WA_ERROR_TYPE } from '../exception/error-type.js'
import WAError from '../exception/whatsapp-error.js'
import { DEFAULT_TIMEOUT, log, FileBox } from '../config.js'

const PRE = 'message'

/**
  * Get contact message
  * @param messageId message Id
  * @returns contact name
  */
export async function messageContact (this: PuppetWhatsApp, messageId: string): Promise<string> {
  log.info(PRE, 'messageContact(%s)', messageId)
  // const cacheManager = await this.manager.getCacheManager()
  // const msg = await cacheManager.getMessageRawPayload(messageId)
  // if (!msg) {
  //   log.error(PRE, 'Message %s not found', messageId)
  //   throw WAError(WA_ERROR_TYPE.ERR_MSG_NOT_FOUND, `Message ${messageId} not found`)
  // }
  // if (msg.type !== WhatsAppMessageType.CONTACT_CARD) {
  //   log.error(PRE, 'Message %s is not contact type', messageId)
  //   throw WAError(WA_ERROR_TYPE.ERR_MSG_NOT_MATCH, `Message ${messageId} is not contact type`)
  // }
  // if (!msg.vCards[0]) {
  //   throw WAError(WA_ERROR_TYPE.ERR_MSG_NOT_MATCH, `Message ${messageId} has no vCards info, detail: ${JSON.stringify(msg)}`)
  // }
  // try {
  //   const vcard = parseVcard(msg.vCards[0])
  //   return vcard.TEL![0]!.waid
  // } catch (error) {
  //   throw WAError(WA_ERROR_TYPE.ERR_MSG_CONTACT, `Can not parse contact card from message: ${messageId}, error: ${(error as Error).message}`)
  // }
  return '' // TODO: remove this
}

/**
* Recall message
* @param messageId message id
* @returns { Promise<boolean> }
*/
export async function messageRecall (this: PuppetWhatsApp, messageId: string): Promise<boolean> {
  log.info(PRE, 'messageRecall(%s)', messageId)
  // const cacheManager = await this.manager.getCacheManager()
  // const msg = await cacheManager.getMessageRawPayload(messageId)
  // if (!msg) {
  //   log.error(PRE, 'Message %s not found', messageId)
  //   throw WAError(WA_ERROR_TYPE.ERR_MSG_NOT_FOUND, `Message ${messageId} not found`)
  // }
  // const msgObj = convertMessagePayloadToClass(this.manager.getWhatsAppClient(), msg)
  // try {
  //   await msgObj.delete(true)
  //   return true
  // } catch (err) {
  //   log.error(PRE, `Can not recall this message: ${messageId}, error: ${(err as Error).message}`)
  //   return false
  // }
  return false // TODO: remove this
}

/**
* Get image from message
* @param messageId message id
* @param imageType image size to get (may not apply to WhatsApp)
* @returns the image
*/
export async function messageImage (this: PuppetWhatsApp, messageId: string, imageType: PUPPET.types.Image): Promise<FileBox> {
  log.info(PRE, 'messageImage(%s, %s)', messageId, PUPPET.types.Image[imageType])
  // const cacheManager = await this.manager.getCacheManager()
  // const msg = await cacheManager.getMessageRawPayload(messageId)
  // if (!msg) {
  //   log.error(PRE, 'Message %s not found', messageId)
  //   throw WAError(WA_ERROR_TYPE.ERR_MSG_NOT_FOUND, `Message ${messageId} Not Found`)
  // }
  // if (msg.type !== WhatsAppMessageType.IMAGE || (!msg.hasMedia && !msg.body)) {
  //   log.error(PRE, 'Message %s does not contain any media', messageId)
  //   throw WAError(WA_ERROR_TYPE.ERR_MSG_NOT_MATCH, `Message ${messageId} does not contain any media`)
  // }
  // try {
  //   switch (imageType) {
  //     case PUPPET.ImageType.HD:
  //     case PUPPET.ImageType.Artwork:
  //       if (msg.hasMedia) {
  //         return downloadMedia.call(this, msg)
  //       } else {
  //         return FileBox.fromBase64(msg.body, 'thumbnail.jpg')
  //       }
  //     case PUPPET.ImageType.Thumbnail:
  //     default:
  //       if (msg.body) {
  //         return FileBox.fromBase64(msg.body, 'thumbnail.jpg')
  //       } else {
  //         return downloadMedia.call(this, msg)
  //       }
  //   }
  // } catch (error) {
  //   throw WAError(WA_ERROR_TYPE.ERR_MSG_IMAGE, `Message ${messageId} does not contain any media`)
  // }

  throw WAError(WA_ERROR_TYPE.ERR_MSG_IMAGE, `Message ${messageId} does not contain any media`) // TODO: remove this
}

/**
* Get the file attached to the message
* @param messageId message id
* @returns the file that attached to the message
*/
export async function messageFile (this: PuppetWhatsApp, messageId: string): Promise<FileBox> {
  log.info(PRE, 'messageFile(%s)', messageId)
  // const cacheManager = await this.manager.getCacheManager()
  // const msg = await cacheManager.getMessageRawPayload(messageId)
  // if (!msg) {
  //   log.error(PRE, 'Message %s not found', messageId)
  //   throw WAError(WA_ERROR_TYPE.ERR_MSG_NOT_FOUND, `Message ${messageId} Not Found`)
  // }
  // if (!msg.hasMedia) {
  //   log.error(PRE, 'Message %s does not contain any media', messageId)
  //   throw WAError(WA_ERROR_TYPE.ERR_MSG_NOT_MATCH, `Message ${messageId} does not contain any media`)
  // }
  // try {
  //   return downloadMedia.call(this, msg)
  // } catch (error) {
  //   throw WAError(WA_ERROR_TYPE.ERR_MSG_FILE, `Message ${messageId} does not contain any media`)
  // }
  throw WAError(WA_ERROR_TYPE.ERR_MSG_IMAGE, `Message ${messageId} does not contain any media`) // TODO: remove this
}

async function downloadMedia (this: PuppetWhatsApp, msg: WhatsAppMessagePayload) {
  log.verbose(PRE, 'downloadMedia(%s)', msg.id)
  // const msgObj = convertMessagePayloadToClass(this.manager.getWhatsAppClient(), msg)
  // const media = await msgObj.downloadMedia()
  // const filenameExtension = mime.getExtension(media.mimetype)
  // const fileBox = FileBox.fromBase64(media.data, media.filename ?? `unknown_name.${filenameExtension}`)
  // fileBox.mimeType = media.mimetype
  // return fileBox
}

/**
* Get url in the message
* @param messageId message id
* @returns url in the message
*/
export async function messageUrl (this: PuppetWhatsApp, messageId: string): Promise<PUPPET.payloads.UrlLink> {
  log.info(PRE, 'messageUrl(%s)', messageId)
  // const cacheManager = await this.manager.getCacheManager()
  // const msg = await cacheManager.getMessageRawPayload(messageId)
  // if (!msg) {
  //   log.error(PRE, 'Message %s not found', messageId)
  //   throw WAError(WA_ERROR_TYPE.ERR_MSG_NOT_FOUND, `Message ${messageId} Not Found`)
  // }
  // if (msg.links.length === 0) {
  //   log.error(PRE, 'Message %s is does not contain links', messageId)
  //   throw WAError(WA_ERROR_TYPE.ERR_MSG_NOT_MATCH, `Message ${messageId} does not contain any link message.`)
  // }
  // try {
  //   return {
  //     description: msg.description || 'NO_DESCRIPTION',
  //     title: msg.title || 'NO_TITLE',
  //     url: msg.links[0]?.link || msg.body,
  //   }
  // } catch (error) {
  //   throw WAError(WA_ERROR_TYPE.ERR_MSG_URL_LINK, `Get link message: ${messageId} failed, error: ${(error as Error).message}`)
  // }
  throw WAError(WA_ERROR_TYPE.ERR_MSG_URL_LINK, `Get link message: ${messageId} failed`) // TODO: remove this
}

/**
* Not supported for WhatsApp
* @param messageId message id
*/
export async function messageMiniProgram (this: PuppetWhatsApp, messageId: string): Promise<PUPPET.payloads.MiniProgram> {
  log.info(PRE, 'messageMiniProgram(%s)', messageId)
  return PUPPET.throwUnsupportedError()
}

export async function messageSend (this: PuppetWhatsApp, conversationId: string, content: MessageContent, options?: MessageSendOptions, timeout = DEFAULT_TIMEOUT.MESSAGE_SEND): Promise<string> {
  log.info(PRE, 'messageSend(%s, %s)', conversationId, typeof content)

  // const msg = await this.manager.sendMessage(conversationId, content, options)
  // const messageId = msg.id.id
  // const requestPool = RequestPool.Instance
  // await requestPool.pushRequest(messageId, timeout)
  // return messageId

  return String(timeout) // TODO: remove this
}

export async function messageSendText (this: PuppetWhatsApp, conversationId: string, text: string, mentions?: string[]): Promise<void | string> {
  log.info(PRE, 'messageSendText(%s, %s)', conversationId, text)
  // if (mentions) {
  //   const contacts = await Promise.all(mentions.map((v) => (
  //     this.manager.getContactById(v)
  //   )))
  //   return messageSend.call(this, conversationId, text, { mentions: contacts }, DEFAULT_TIMEOUT.MESSAGE_SEND_TEXT)
  // } else {
  //   return messageSend.call(this, conversationId, text, {}, DEFAULT_TIMEOUT.MESSAGE_SEND_TEXT)
  // }
  return mentions!.join(',')  // TODO: remove this
}

export async function messageSendFile (this: PuppetWhatsApp, conversationId: string, file: FileBox, options?: MessageSendOptions): Promise<void | string> {
  log.info(PRE, 'messageSendFile(%s, %s)', conversationId, file.name)
  await file.ready()
  const type = (file.mimeType && file.mimeType !== 'application/octet-stream')
    ? file.mimeType.replace(/;.*$/, '')
    : path.extname(file.name)
  log.silly(PRE, `message type: ${type}, filename: ${file.name}`)
  const fileBoxJsonObject: any = file.toJSON() // FIXME: need import FileBoxJsonObject from file-box
  const remoteUrl = fileBoxJsonObject.remoteUrl
  let msgContent
  if (remoteUrl) {
    msgContent = await MessageMedia.fromUrl(remoteUrl, { filename: file.name })
  } else {
    const fileData = await file.toBase64()
    msgContent = new MessageMedia(file.mimeType!, fileData, file.name)
  }
  return messageSend.call(this, conversationId, msgContent, options, DEFAULT_TIMEOUT.MESSAGE_SEND_FILE)
}

export async function messageSendContact (this: PuppetWhatsApp, conversationId: string, contactId: string, options?: MessageSendOptions): Promise<void> {
  log.info(PRE, 'messageSendContact(%s, %s, %s)', conversationId, contactId, JSON.stringify(options))

  // const contact = await this.manager.getContactById(contactId)
  // await messageSend.call(this, conversationId, contact, options, DEFAULT_TIMEOUT.MESSAGE_SEND_TEXT)
}

export async function messageSendUrl (
  this: PuppetWhatsApp,
  conversationId: string,
  urlLinkPayload: PUPPET.payloads.UrlLink,
): Promise<string> {
  log.info(PRE, 'messageSendUrl(%s, %s)', conversationId, JSON.stringify(urlLinkPayload))
  return messageSend.call(this, conversationId, urlLinkPayload.url, {}, DEFAULT_TIMEOUT.MESSAGE_SEND_TEXT)
}

export async function messageSendMiniProgram (this: PuppetWhatsApp, conversationId: string, miniProgramPayload: PUPPET.payloads.MiniProgram): Promise<void> {
  log.verbose(PRE,
    'PuppetWhatsApp',
    'messageSendMiniProgram(%s, %s)',
    conversationId,
    JSON.stringify(miniProgramPayload),
  )
  return PUPPET.throwUnsupportedError()
}

export async function messageForward (this: PuppetWhatsApp, conversationId: string, messageId: string): Promise<void> {
  log.info(PRE, 'messageForward(%s, %s)', conversationId, messageId)
  // const cacheManager = await this.manager.getCacheManager()
  // const msg = await cacheManager.getMessageRawPayload(messageId)
  // if (!msg) {
  //   log.error(PRE, 'Message %s not found', messageId)
  //   throw WAError(WA_ERROR_TYPE.ERR_MSG_NOT_FOUND, `Message ${messageId} not found`)
  // }
  // const msgObj = convertMessagePayloadToClass(this.manager.getWhatsAppClient(), msg)
  // try {
  //   await msgObj.forward(conversationId)
  // } catch (error) {
  //   throw WAError(WA_ERROR_TYPE.ERR_MSG_FORWARD, `Forward message: ${messageId} failed, error: ${(error as Error).message}`)
  // }
}

export async function messageRawPayload (this: PuppetWhatsApp, id: string): Promise<WhatsAppMessagePayload> {
  log.info(PRE, 'messageRawPayload(%s)', id)
  // const cacheManager = await this.manager.getCacheManager()
  // const msg = await cacheManager.getMessageRawPayload(id)
  // if (!msg) {
  //   throw WAError(WA_ERROR_TYPE.ERR_MSG_NOT_FOUND, `Can not find this message: ${id}`)
  // }
  // return msg
  throw WAError(WA_ERROR_TYPE.ERR_MSG_NOT_FOUND, `Can not find this message: ${id}`) // TODO: remove this
}

export async function messageRawPayloadParser (this: PuppetWhatsApp, whatsAppPayload: WhatsAppMessagePayload): Promise<PUPPET.payloads.Message> {
  const result = parserMessageRawPayload(whatsAppPayload)
  log.verbose(PRE, 'messageRawPayloadParser whatsAppPayload(%s) result(%s)', JSON.stringify(whatsAppPayload), JSON.stringify(result))
  return result
}
