import { WAErrorType, WA_ERROR_TYPE } from './error-type.js'
import { GError } from 'gerror'

export default class WAError {

  constructor (
    type: WAErrorType,
    message: string,
    details?: string,
  ) {
    GError.from({
      code: +type,
      details,
      message,
      name: WA_ERROR_TYPE[type],
    })
  }

}
