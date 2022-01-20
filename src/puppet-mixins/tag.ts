import * as PUPPET from 'wechaty-puppet-1.0-migration'
import { logger } from '../logger/index.js'

export async function tagContactAdd (
  tagId: string,
  contactId: string,
): Promise<void> {
  logger.verbose('tagContactAdd(%s)', tagId, contactId)
  return PUPPET.throwUnsupportedError()
}

export async function tagContactRemove (
  tagId: string,
  contactId: string,
): Promise<void> {
  logger.verbose('tagContactRemove(%s)', tagId, contactId)
  return PUPPET.throwUnsupportedError()
}

export async function tagContactDelete (
  tagId: string,
): Promise<void> {
  logger.verbose('tagContactDelete(%s)', tagId)
  return PUPPET.throwUnsupportedError()
}

export async function tagContactList (
  contactId?: string,
): Promise<string[]> {
  logger.verbose('tagContactList(%s)', contactId)
  return PUPPET.throwUnsupportedError()
}
