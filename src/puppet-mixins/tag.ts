import * as PUPPET from 'wechaty-puppet'
import { PRE, log } from '../config.js'

export async function tagContactAdd (
  tagId: string,
  contactId: string,
): Promise<void> {
  log.verbose(PRE, 'tagContactAdd(%s)', tagId, contactId)
  return PUPPET.throwUnsupportedError()
}

export async function tagContactRemove (
  tagId: string,
  contactId: string,
): Promise<void> {
  log.verbose(PRE, 'tagContactRemove(%s)', tagId, contactId)
  return PUPPET.throwUnsupportedError()
}

export async function tagContactDelete (
  tagId: string,
): Promise<void> {
  log.verbose(PRE, 'tagContactDelete(%s)', tagId)
  return PUPPET.throwUnsupportedError()
}

export async function tagContactList (
  contactId?: string,
): Promise<string[]> {
  log.verbose(PRE, 'tagContactList(%s)', contactId)
  return PUPPET.throwUnsupportedError()
}
