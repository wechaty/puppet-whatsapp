import * as PUPPET from 'wechaty-puppet'
import { PRE } from '../config.js'
import { withPrefix } from '../logger/index.js'

const logger = withPrefix(`${PRE} conversation`)

export async function conversationReadMark (
  conversationId: string,
  hasRead?: boolean,
) : Promise<void | boolean> {
  logger.verbose('conversationReadMark(%s, %s)', conversationId, hasRead)
  return PUPPET.throwUnsupportedError()
}
