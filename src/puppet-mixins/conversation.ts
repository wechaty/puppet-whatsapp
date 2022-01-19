import * as PUPPET from 'wechaty-puppet'
import { PRE, log } from '../config.js'

export async function conversationReadMark (
  conversationId: string,
  hasRead?: boolean,
) : Promise<void | boolean> {
  log.verbose(PRE, 'conversationReadMark(%s, %s)', conversationId, hasRead)
  return PUPPET.throwUnsupportedError()
}