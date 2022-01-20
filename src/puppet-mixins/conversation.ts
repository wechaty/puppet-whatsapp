import * as PUPPET from 'wechaty-puppet-1.0-migration'
import { logger } from '../logger/index.js'

export async function conversationReadMark (
  conversationId: string,
  hasRead?: boolean,
) : Promise<void | boolean> {
  logger.verbose('conversationReadMark(%s, %s)', conversationId, hasRead)
  return PUPPET.throwUnsupportedError()
}
