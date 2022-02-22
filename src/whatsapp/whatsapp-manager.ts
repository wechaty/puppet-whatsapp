
import type {
  LaunchOptions,
  BrowserConnectOptions,
  BrowserLaunchArgumentOptions,
} from 'puppeteer'
import {
  distinctUntilKeyChanged,
  fromEvent,
  map,
  merge,
} from 'rxjs'
import {
  LOGOUT_REASON,
  PRE,
} from '../config.js'

import type {
  WhatsAppClientType,
  ClientSession,
  ClientOptions,
} from '../schema/whatsapp-type.js'
import {
  Client as WhatsApp,
} from '../schema/whatsapp-interface.js'
import { withPrefix } from '../logger/index.js'
import LoginEventHandler from './event-handler/login-event-handler.js'
import MessageEventHandler from './event-handler/message-event-handler.js'
import GroupEventHandler from './event-handler/group-event-handler.js'
import type { Manager } from '../manager.js'
import WhatsAppBase from './whatsapp-base.js'

const logger = withPrefix(`${PRE} WhatsAppEvent`)

export default class WhatsAppManager extends WhatsAppBase {

  private botEventHandler: LoginEventHandler
  private messageEventHandler: MessageEventHandler
  private groupEventHandler: GroupEventHandler

  constructor (manager: Manager) {
    super(manager)
    this.botEventHandler = new LoginEventHandler(manager)
    this.messageEventHandler = new MessageEventHandler(manager)
    this.groupEventHandler = new GroupEventHandler(manager)
  }

  public async genWhatsAppClient (
    options: ClientOptions = {},
    session?: ClientSession,
  ): Promise<WhatsAppClientType> {
    logger.verbose('initWhatsAppClient()')
    const { puppeteer = {}, ...restOptions } = options
    const { args, ...restPuppeteerOptions } = puppeteer
    const puppeteerOptions: LaunchOptions & BrowserLaunchArgumentOptions & BrowserConnectOptions = {
      /**
       * No usable sandbox!
       *  https://github.com/pedroslopez/whatsapp-web.js/issues/344#issuecomment-691570764
       */
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        ...(puppeteer.args || []),
      ],
      headless: true,
      ...restPuppeteerOptions,
    }

    this.whatsAppClient = new WhatsApp({
      puppeteer: puppeteerOptions,
      qrRefreshIntervalMs: 10 * 1000,
      restartOnAuthFail: true,
      session,
      ...restOptions,
    })
    return this.whatsAppClient
  }

  public async initWhatsAppClient (): Promise<void> {
    const whatsAppClient = this.getWhatsAppClient()
    whatsAppClient
      .initialize()
      .then(() => logger.verbose('start() whatsapp.initialize() done.'))
      .catch(async e => {
        logger.error('start() whatsapp.initialize() rejection: %s', e)
      })
  }

  public async initWhatsAppEvents (): Promise<void> {
    logger.verbose('initWhatsAppEvents()')
    const whatsAppClient = this.getWhatsAppClient()
    whatsAppClient.on('qr', this.botEventHandler.onQRCode)
    whatsAppClient.on('authenticated', this.botEventHandler.onAuthenticated)
    /**
     * There is only one situation that will cause this event, invalid session causing timeout
     * https://github.com/pedroslopez/whatsapp-web.js/blob/d86c39de3ca5699a50db98ee93e264ab8c4f25a3/src/Client.js#L116-L129
     */
    whatsAppClient.on('auth_failure', this.botEventHandler.onAuthFailure)
    whatsAppClient.on('ready', this.botEventHandler.onWhatsAppReady)
    whatsAppClient.on('change_state', this.botEventHandler.onChangeState)
    whatsAppClient.on('change_battery', this.botEventHandler.onChangeBattery)

    whatsAppClient.on('message', this.messageEventHandler.onMessage)
    whatsAppClient.on('message_ack', this.messageEventHandler.onMessageAck)
    whatsAppClient.on('message_create', this.messageEventHandler.onMessageCreate)
    whatsAppClient.on('message_revoke_everyone', this.messageEventHandler.onMessageRevokeEveryone)
    whatsAppClient.on('message_revoke_me', this.messageEventHandler.onMessageRevokeMe)
    whatsAppClient.on('media_uploaded', this.messageEventHandler.onMediaUploaded)
    whatsAppClient.on('incoming_call', this.messageEventHandler.onIncomingCall)

    whatsAppClient.on('group_join', this.groupEventHandler.onRoomJoin)
    whatsAppClient.on('group_leave', this.groupEventHandler.onRoomLeave)
    whatsAppClient.on('group_update', this.groupEventHandler.onRoomUpdate)

    const events = [
      'authenticated',
      'ready',
      'disconnected',
    ]
    const eventStreams = events.map((event) => fromEvent(whatsAppClient, event).pipe(map((value: any) => ({ event, value }))))
    const allEvents$ = merge(...eventStreams)
    allEvents$.pipe(distinctUntilKeyChanged('event')).subscribe(({ event, value }: { event: string, value: any }) => {
      logger.info(`initWhatsAppEvents: ${JSON.stringify(event)}, value: ${JSON.stringify(value)}`)
      if (event === 'disconnected') {
        switch (value) {
          case 'NAVIGATION':
            void this.botEventHandler.onLogout(LOGOUT_REASON.DEFAULT)
            break
          case 'CONFLICT':
            void this.botEventHandler.onLogout(LOGOUT_REASON.LOGIN_CONFLICT)
            break
          default:
            void this.botEventHandler.onLogout(LOGOUT_REASON.DEFAULT)
            break
        }
      }
    })
  }

  public getMessageEventHandler () {
    return this.messageEventHandler
  }

}
