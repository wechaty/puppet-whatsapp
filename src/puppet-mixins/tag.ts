import * as PUPPET from 'wechaty-puppet'
import { verbose } from '../logger/index.js'

export async function tagContactAdd (
  tagId: string,
  contactId: string,
): Promise<void> {
  verbose('tagContactAdd(%s)', tagId, contactId)
  return PUPPET.throwUnsupportedError()
}

export async function tagContactRemove (
  tagId: string,
  contactId: string,
): Promise<void> {
  verbose('tagContactRemove(%s)', tagId, contactId)
  return PUPPET.throwUnsupportedError()
}

export async function tagContactDelete (
  tagId: string,
): Promise<void> {
  verbose('tagContactDelete(%s)', tagId)
  return PUPPET.throwUnsupportedError()
}

export async function tagContactList (
  contactId?: string,
): Promise<string[]> {
  verbose('tagContactList(%s)', contactId)
  return PUPPET.throwUnsupportedError()
}
