/* eslint-disable no-case-declarations */
import * as PUPPET from 'wechaty-puppet'
import {
  MIN_BATTERY_VALUE_FOR_LOGOUT,
  DEFAULT_TIMEOUT,
  log,
  STRINGS,
  LANGUAGE,
} from '../../config.js'
import { WA_ERROR_TYPE } from '../../exception/error-type.js'
import WAError from '../../exception/whatsapp-error.js'
import {
  WAState,
} from '../../schema/whatsapp-interface.js'
import WhatsAppBase from '../whatsapp-base.js'

import type {
  WhatsAppContact,
  BatteryInfo,
  WAStateType,
} from '../../schema/whatsapp-type.js'
import {
  batchProcess,
  isContactId,
  isRoomId,
} from '../../helper/miscellaneous.js'

const PRE = 'LoginEventHandler'

export default class LoginEventHandler extends WhatsAppBase { // FIXME: I have no good idea for this class name.

  protected loadingData: boolean = false

  public onQRCode (qrcode: string) {
    log.info(PRE, `onQRCode(${qrcode})`)
    // NOTE: This event will not be fired if a session is specified.
    this.emit('scan', { qrcode, status: PUPPET.types.ScanStatus.Waiting })
  }

  public async onAuthenticated () {
    log.info(PRE, 'onAuthenticated()')
  }

  public async onAuthFailure (message: string) {
    log.warn(PRE, 'auth_failure: %s', message)
    // avoid reuse invalid session data
    await this.clearSession()
  }

  public async onWhatsAppReady () {
    log.verbose(PRE, 'onWhatsAppReady()')
    const contactOrRoomList = await this.manager.syncContactOrRoomList()
    await this.onLogin(contactOrRoomList)
    await this.onReady(contactOrRoomList)
    this.manager.startSchedule()
  }

  public async onLogin (contactOrRoomList: WhatsAppContact[]) {
    log.verbose(PRE, 'onLogin()')
    const whatsapp = this.getWhatsAppClient()
    try {
      this.botId = whatsapp.info.wid._serialized
    } catch (error) {
      throw WAError(WA_ERROR_TYPE.ERR_INIT, `Can not get bot id from WhatsApp client, current state: ${await whatsapp.getState()}`, JSON.stringify(error))
    }
    log.info(PRE, `WhatsApp Client Info: ${JSON.stringify(whatsapp.info)}`)

    await this.manager.initCache(this.botId)
    const cacheManager = await this.manager.getCacheManager()

    const botSelf = await this.manager.requestManager.getContactById(this.botId)
    await cacheManager.setContactOrRoomRawPayload(this.botId, {
      ...botSelf,
      avatar: await this.manager.requestManager.getAvatarUrl(this.botId),
    })

    const batchSize = 500
    await batchProcess(batchSize, contactOrRoomList, async (contactOrRoom: WhatsAppContact) => {
      const contactOrRoomId = contactOrRoom.id._serialized
      const contactInCache = await cacheManager.getContactOrRoomRawPayload(contactOrRoomId)
      if (contactInCache) {
        return
      }
      const contactWithAvatar = Object.assign(contactOrRoom, { avatar: '' })
      await cacheManager.setContactOrRoomRawPayload(contactOrRoomId, contactWithAvatar)
    })

    this.emit('login', this.botId)
    log.info(PRE, `onLogin(${this.botId}})`)
  }

  public async onReady (contactOrRoomList: WhatsAppContact[]) {
    log.verbose(PRE, 'onReady()')
    if (this.loadingData) {
      log.verbose(PRE, 'onReady() loading data are under process.')
      return
    }
    this.loadingData = true
    let friendCount = 0
    let contactCount = 0
    let roomCount = 0

    const cacheManager = await this.manager.getCacheManager()
    const batchSize = 100
    await batchProcess(batchSize, contactOrRoomList, async (contactOrRoom: WhatsAppContact) => {
      const contactOrRoomId = contactOrRoom.id._serialized
      const avatar = await contactOrRoom.getProfilePicUrl()
      const contactWithAvatar = Object.assign(contactOrRoom, { avatar })
      if (isContactId(contactOrRoomId)) {
        contactCount++
        if (contactOrRoom.isMyContact) {
          friendCount++
        }
        await cacheManager.setContactOrRoomRawPayload(contactOrRoomId, contactWithAvatar)
      } else if (isRoomId(contactOrRoomId)) {
        const memberList = await this.manager.syncRoomMemberList(contactOrRoomId)
        if (memberList.length > 0) {
          roomCount++
          await cacheManager.setContactOrRoomRawPayload(contactOrRoomId, contactWithAvatar)
          await cacheManager.setRoomMemberIdList(contactOrRoomId, memberList)
        } else {
          await cacheManager.deleteContactOrRoom(contactOrRoomId)
          await cacheManager.deleteRoomMemberIdList(contactOrRoomId)
        }
      } else {
        log.warn(PRE, `Unknown contact type: ${JSON.stringify(contactOrRoom)}`)
      }
      await this.manager.processHistoryMessages(contactOrRoom)
    })

    log.info(PRE, `onReady() all contacts and rooms are ready, friendCount: ${friendCount} contactCount: ${contactCount} roomCount: ${roomCount}`)
    this.emit('ready')
    this.loadingData = false
  }

  public async onLogout (reason: string = STRINGS[LANGUAGE].LOGOUT_REASON.DEFAULT) {
    log.verbose(PRE, `onLogout(${reason})`)
    await this.clearSession()
    this.manager.stopSchedule()
    this.emit('logout', this.getBotId(), reason as string)
    this.clearWhatsAppRelatedData()
  }

  public async onChangeState (state: WAStateType) {
    log.info(PRE, `onChangeState(${JSON.stringify(state)})`)
    if (!this.botId) {
      throw WAError(WA_ERROR_TYPE.ERR_INIT, 'No login bot id.')
    }

    switch (state) {
      case WAState.TIMEOUT:
        this.pendingLogoutEmitTimer = setTimeout(() => {
          this.emit('logout', this.getBotId(), STRINGS[LANGUAGE].LOGOUT_REASON.NETWORK_TIMEOUT_IN_PHONE)
          this.pendingLogoutEmitTimer = undefined
        }, DEFAULT_TIMEOUT.TIMEOUT_WAIT_CONNECTED)
        break
      case WAState.CONNECTED:
        this.clearPendingLogoutEmitTimer()
        this.emit('login', this.botId)
        this.loadingData = false
        const contactOrRoomList = await this.manager.syncContactOrRoomList()
        await this.onReady(contactOrRoomList)
        break
      default:
        break
    }
  }

  /**
   * unsupported events
   * leave logs to for further dev
  */
  public async onChangeBattery (batteryInfo: BatteryInfo) {
    log.verbose(PRE, `onChangeBattery(${JSON.stringify(batteryInfo)})`)
    if (!this.botId) {
      throw WAError(WA_ERROR_TYPE.ERR_INIT, 'No login bot id.')
    }

    if (batteryInfo.battery <= MIN_BATTERY_VALUE_FOR_LOGOUT && !batteryInfo.plugged) {
      this.emit('logout', this.botId, STRINGS[LANGUAGE].LOGOUT_REASON.BATTERY_LOWER_IN_PHONE)
    }
  }

}
