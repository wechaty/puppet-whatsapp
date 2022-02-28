import * as PUPPET from 'wechaty-puppet'
import { log } from '../config.js'

const PRE = 'MIXIN_CONVERSATION'

export async function conversationReadMark (
  conversationId: string,
  hasRead?: boolean,
): Promise<void | boolean> {
  log.verbose(PRE, 'conversationReadMark(%s, %s)', conversationId, hasRead)
  return PUPPET.throwUnsupportedError()
}
