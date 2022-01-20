/// <reference path="./typings.d.ts" />
import {
  FileBox,
} from 'wechaty-puppet-1.0-migration'

import { packageJson } from './package-json.js'

const VERSION = packageJson.version || '0.0.0'

const GROUP_AVATAR = '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'

function avatarForGroup (): FileBox {
  return FileBox.fromDataURL(`data:image/png;base64,${GROUP_AVATAR}`, 'whatsapp_group')
}

const MEMORY_SLOT = 'PUPPET_WHATSAPP'
const PRE = 'PuppetWhatsApp'
export {
  MEMORY_SLOT,
  avatarForGroup,
  VERSION,
  PRE,
}
