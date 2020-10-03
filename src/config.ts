import {
  FileBox,
}             from 'wechaty-puppet'
import path from 'path'
export const SESSION_FILE_PATH: string = path.join(__dirname.replace('dist/src', ''), 'session.json')

export const CHATIE_OFFICIAL_ACCOUNT_QRCODE = 'http://weixin.qq.com/r/qymXj7DEO_1ErfTs93y5'

export function qrCodeForChatie (): FileBox {
  return FileBox.fromQRCode(CHATIE_OFFICIAL_ACCOUNT_QRCODE)
}

export { VERSION } from './version'
