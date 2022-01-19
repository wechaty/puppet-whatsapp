import * as PUPPET from 'wechaty-puppet'
import { logger } from '../logger/index.js'

export async function conversationReadMark (
  conversationId: string,
  hasRead?: boolean,
) : Promise<void | boolean> {
  logger.verbose('conversationReadMark(%s, %s)', conversationId, hasRead)
  return PUPPET.throwUnsupportedError()
}
