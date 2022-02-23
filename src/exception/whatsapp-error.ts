import { WAErrorType, WA_ERROR_TYPE } from './error-type.js'
import { GError } from 'gerror'

export default function WAError (
  type: WAErrorType,
  message: string,
  details?: string,
) {
  return GError.from({
    code: +type,
    details,
    message,
    name: WA_ERROR_TYPE[type],
  })
}
