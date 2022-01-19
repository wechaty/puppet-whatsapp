import {
  log,
} from 'wechaty-puppet'
import { PRE } from '../config.js'

export const verbose = (...args: any[]) => log.verbose(PRE, ...args)
export const info = (...args: any[]) => log.info(PRE, ...args)
export const warn = (...args: any[]) => log.warn(PRE, ...args)
export const error = (...args: any[]) => log.error(PRE, ...args)
export const silly = (...args: any[]) => log.silly(PRE, ...args)
