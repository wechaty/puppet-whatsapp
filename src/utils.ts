import { HISTORY_MESSAGES_DAYS } from './config.js'

const InviteLinkRegex = /^(https?:\/\/)?chat\.whatsapp\.com\/(?:invite\/)?([a-zA-Z0-9_-]{22})$/

export const sleep = async (milliseconds?: number) => {
  if (milliseconds) {
    await new Promise<void>(resolve => setTimeout(resolve, milliseconds))
  }
}

export const isRoomId = (id: string) => {
  return /@g.us$/i.test(id)
}

export const isContactId = (id: string) => {
  return /@c.us$/i.test(id)
}

export const isInviteLink = (link: string) => {
  return InviteLinkRegex.test(link)
}

export const getInviteCode = (link: string) => {
  const matched = link.match(InviteLinkRegex)
  if (matched) {
    if (matched.length === 3) {
      const inviteCode = matched[2]
      return inviteCode
    }
  }
  return undefined
}

export const batchProcess = async (batchSize: number, list: any[], func: any) => {
  let index = 0
  while (batchSize * index < list.length) {
    const curList = list.slice(batchSize * index, batchSize * (index + 1))
    await Promise.all(curList.map(func))
    index++
  }
}

export const getMaxTimestampForLoadHistoryMessages = () => {
  return Math.floor(Date.now() / 1000) - HISTORY_MESSAGES_DAYS * 24 * 3600
}
