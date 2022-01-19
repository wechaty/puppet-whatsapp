import * as PUPPET from 'wechaty-puppet-1.0-migration'
import { log } from 'wechaty-puppet-1.0-migration'
import { PRE } from '../config.js'

export async function conversationReadMark (
  conversationId: string,
  hasRead?: boolean,
) : Promise<void | boolean> {
  log.verbose(PRE, 'conversationReadMark(%s, %s)', conversationId, hasRead)
  return PUPPET.throwUnsupportedError()
}
