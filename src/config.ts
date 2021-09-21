/// <reference path="./typings.d.ts" />

import {
  FileBox,
}             from 'wechaty-puppet'
import { packageJson } from './package-json.js'

const VERSION = packageJson.version || '0.0.0'

const CHATIE_OFFICIAL_ACCOUNT_QRCODE = 'http://weixin.qq.com/r/qymXj7DEO_1ErfTs93y5'

function qrCodeForChatie (): FileBox {
  return FileBox.fromQRCode(CHATIE_OFFICIAL_ACCOUNT_QRCODE)
}

const MEMORY_SLOT = 'PUPPET_WHATSAPP'

export {
  CHATIE_OFFICIAL_ACCOUNT_QRCODE,
  FileBox,
  MEMORY_SLOT,
  qrCodeForChatie,
  VERSION,
}
