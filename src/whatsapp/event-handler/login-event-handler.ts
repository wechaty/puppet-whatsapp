/* eslint-disable no-case-declarations */
import * as PUPPET from 'wechaty-puppet'
import {
  LOGOUT_REASON,
  MIN_BATTERY_VALUE_FOR_LOGOUT,
  DEFAULT_TIMEOUT,
  PRE,
  MEMORY_SLOT,
} from '../../config.js'
import {
  batchProcess,
  isContactId,
  isRoomId,
} from '../../utils.js'
import { WA_ERROR_TYPE } from '../../exceptions/error-type.js'
import WAError from '../../exceptions/whatsapp-error.js'
import {
  WAState,
} from '../../schema/whatsapp-interface.js'
import WhatsAppBase from '../whatsapp-base.js'
import { withPrefix } from '../../logger/index.js'

import type {
  WhatsAppContact,
  ClientSession,
  BatteryInfo,
  WAStateType,
} from '../../schema/whatsapp-type.js'

const logger = withPrefix(`${PRE} LoginEventHandler`)

export default class LoginEventHandler extends WhatsAppBase { // FIXME: I have no good idea for this class name.

  protected loadingData: boolean = false

  public onQRCode (qr: string) {
    logger.info(`onQRCode(${qr})`)
    // NOTE: This event will not be fired if a session is specified.
    this.emit('scan', PUPPET.ScanStatus.Waiting, qr)
  }

  public async onAuthenticated (session: ClientSession) {
    logger.info(`onAuthenticated(${JSON.stringify(session)})`)
    await this.setSession(session)
  }

  public async onAuthFailure (message: string) {
    logger.warn('auth_failure: %s', message)
    // avoid reuse invalid session data
    await this.clearSession()
  }

  public async onWhatsAppReady () {
    logger.info('onWhatsAppReady()')
    const contactOrRoomList = await this.manager.syncContactOrRoomList()
    await this.onLogin(contactOrRoomList)
    await this.onReady(contactOrRoomList)
    this.manager.startSchedule()
  }

  public async onLogin (contactOrRoomList: WhatsAppContact[]) {
    logger.info('onLogin()')
    const whatsapp = this.manager.getWhatsAppClient()
    try {
      this.botId = whatsapp.info.wid._serialized
    } catch (error) {
      throw WAError(WA_ERROR_TYPE.ERR_INIT, `Can not get bot id from WhatsApp client, current state: ${await whatsapp.getState()}`, JSON.stringify(error))
    }
    logger.info(`WhatsApp Client Info: ${JSON.stringify(whatsapp.info)}`)

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
    logger.info(`onLogin(${this.botId}})`)
  }

  public async onReady (contactOrRoomList: WhatsAppContact[]) {
    logger.info('onReady()')
    if (this.loadingData) {
      logger.info('onReady() loading data are under process.')
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
        logger.warn(`Unknown contact type: ${JSON.stringify(contactOrRoom)}`)
      }
      await this.manager.fetchMessages(contactOrRoom)
    })

    logger.info(`onReady() all contacts and rooms are ready, friendCount: ${friendCount} contactCount: ${contactCount} roomCount: ${roomCount}`)
    this.emit('ready')
    this.loadingData = false
  }

  public async onLogout (reason: string = LOGOUT_REASON.DEFAULT) {
    logger.info(`onLogout(${reason})`)
    await this.clearSession()
    this.manager.stopSchedule()
    this.emit('logout', this.getBotId(), reason as string)
    this.clearWhatsAppRelatedData()
  }

  public async onChangeState (state: WAStateType) {
    logger.info(`onChangeState(${JSON.stringify(state)})`)
    if (!this.botId) {
      throw WAError(WA_ERROR_TYPE.ERR_INIT, 'No login bot id.')
    }

    switch (state) {
      case WAState.TIMEOUT:
        this.pendingLogoutEmitTimer = setTimeout(() => {
          this.emit('logout', this.getBotId(), LOGOUT_REASON.NETWORK_TIMEOUT_IN_PHONE)
          this.pendingLogoutEmitTimer = undefined
        }, DEFAULT_TIMEOUT.TIMEOUT_WAIT_CONNECTED)
        break
      case WAState.CONNECTED:
        this.clearPendingLogoutEmitTimer()
        this.emit('login', this.botId)
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
    logger.silly(`onChangeBattery(${JSON.stringify(batteryInfo)})`)
    if (!this.botId) {
      throw WAError(WA_ERROR_TYPE.ERR_INIT, 'No login bot id.')
    }

    if (batteryInfo.battery <= MIN_BATTERY_VALUE_FOR_LOGOUT && !batteryInfo.plugged) {
      this.emit('logout', this.botId, LOGOUT_REASON.BATTERY_LOWER_IN_PHONE)
    }
  }

  /**
   * MemoryCard Session Section
   */

  public async setSession (session: ClientSession) {
    const memoryCard = this.manager.getOptions().memory
    if (memoryCard) {
      await memoryCard.set(MEMORY_SLOT, session)
      await memoryCard.save()
    }
  }

  public async clearSession () {
    const memoryCard = this.manager.getOptions().memory
    if (memoryCard) {
      await memoryCard.delete(MEMORY_SLOT)
      await memoryCard.save()
    }
  }

}
