import { WAErrorType, WXWORK_ERROR_TYPE } from '../schema/error-type.js'
import { GError } from 'gerror'

export default class WAError {

  constructor (
    type: WAErrorType,
    message: string,
    details?: string,
  ) {
    GError.from({
      code: type,
      details,
      message,
      name: WXWORK_ERROR_TYPE[type],
    })
  }

}