import {
  log,
} from 'wechaty-puppet'
import { PRE } from '../config.js'

const verbose = (...args: any[]) => log.verbose(PRE, ...args)
const info = (...args: any[]) => log.info(PRE, ...args)
const warn = (...args: any[]) => log.warn(PRE, ...args)
const error = (...args: any[]) => log.error(PRE, ...args)
const silly = (...args: any[]) => log.silly(PRE, ...args)
export const logger = {
  error,
  info,
  silly,
  verbose,
  warn,
}

export function withPrefix (pre: string) {
  const verbose = (...args: any[]) => log.verbose(pre, ...args)
  const info = (...args: any[]) => log.info(pre, ...args)
  const warn = (...args: any[]) => log.warn(pre, ...args)
  const error = (...args: any[]) => log.error(pre, ...args)
  const silly = (...args: any[]) => log.silly(pre, ...args)
  return {
    error,
    info,
    silly,
    verbose,
    warn,
  }
}
