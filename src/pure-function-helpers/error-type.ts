import type { WAErrorType } from '../schema/error-type'

export default class WAError extends Error {

  constructor (type: WAErrorType, message: string) {
    super(`${type} ${message}`)
  }

}
