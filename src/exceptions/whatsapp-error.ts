import { WAErrorType, WA_ERROR_TYPE } from './error-type.js'
import { GError } from 'gerror'

export default class WAError extends GError {

  constructor (
    type: WAErrorType,
    message: string,
    details?: string,
  ) {
    super({
      code: +type,
      details,
      message,
      name: WA_ERROR_TYPE[type],
    })
  }

}
