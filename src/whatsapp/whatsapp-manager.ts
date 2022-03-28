import type {
  LaunchOptions,
  BrowserConnectOptions,
  BrowserLaunchArgumentOptions,
} from 'puppeteer'

import type {
  WhatsAppClientType,
  ClientSession,
  ClientOptions,
} from '../schema/whatsapp-type.js'
import {
  Client as WhatsApp, LocalAuth,
} from '../schema/whatsapp-interface.js'
import WhatsAppBase from './whatsapp-base.js'
import type Manager from '../manager.js'
import { log, STRINGS, LANGUAGE } from '../config.js'
import { fromEvent, map, merge, distinctUntilKeyChanged } from 'rxjs'
import LoginEventHandler from './event-handler/login-event-handler.js'
import MessageEventHandler from './event-handler/message-event-handler.js'
import GroupEventHandler from './event-handler/group-event-handler.js'

const PRE = 'WhatsAppManager'

export default class WhatsAppManager extends WhatsAppBase {

  private botEventHandler: LoginEventHandler
  private messageEventHandler: MessageEventHandler
  private groupEventHandler: GroupEventHandler

  constructor (manager: Manager) {
    super(manager)
    this.botEventHandler = new LoginEventHandler(manager)
    this.messageEventHandler = new MessageEventHandler(manager)
    this.groupEventHandler = new GroupEventHandler(manager)

    this.botEventHandler.on({
      login: data => this.emit('login', data),
      logout: (botId, data) => this.emit('logout', botId, data),
      ready: () => this.emit('ready'),
      scan: data => this.emit('scan', data),
    })

    this.messageEventHandler.on({
      friendship: data => this.emit('friendship', data),
      message: data => this.emit('message', data),
      'room-invite': data => this.emit('room-invite', data),
    })

    this.groupEventHandler.on({
      'room-join': data => this.emit('room-join', data),
      'room-leave': data => this.emit('room-leave', data),
      'room-topic': data => this.emit('room-topic', data),
    })
  }

  public async genWhatsAppClient (
    options: ClientOptions = {},
    _session?: ClientSession,
  ): Promise<WhatsAppClientType> {
    log.verbose(PRE, 'initWhatsAppClient()')
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
      authStrategy: new LocalAuth({ clientId: 'default-client' }), // FIXME: if we give it a new client name, it will start a new session. And the old client name will still keep login status.
      puppeteer: puppeteerOptions,
      // can no longer customize refresh interval
      // refresh time gap is set to 15 seconds
      restartOnAuthFail: true,
      // session,
      ...restOptions,
    })
    return this.whatsAppClient
  }

  public async initWhatsAppClient (): Promise<void> {
    const whatsAppClient = this.getWhatsAppClient()
    whatsAppClient
      .initialize()
      .then(() => log.verbose(PRE, 'start() whatsapp.initialize() done.'))
      .catch(async e => {
        log.error(PRE, 'start() whatsapp.initialize() rejection: %s', e)
      })
  }

  public async initWhatsAppEvents (): Promise<void> {
    log.verbose(PRE, 'initWhatsAppEvents()')
    const whatsAppClient = this.getWhatsAppClient()
    whatsAppClient.on('qr', this.botEventHandler.onQRCode.bind(this.botEventHandler))
    whatsAppClient.on('authenticated', this.botEventHandler.onAuthenticated.bind(this.botEventHandler))
    /**
     * There is only one situation that will cause this event, invalid session causing timeout
     * https://github.com/pedroslopez/whatsapp-web.js/blob/d86c39de3ca5699a50db98ee93e264ab8c4f25a3/src/Client.js#L116-L129
     */
    whatsAppClient.on('auth_failure', this.botEventHandler.onAuthFailure.bind(this.botEventHandler))
    whatsAppClient.on('ready', this.botEventHandler.onWhatsAppReady.bind(this.botEventHandler))
    whatsAppClient.on('change_state', this.botEventHandler.onChangeState.bind(this.botEventHandler))
    whatsAppClient.on('change_battery', this.botEventHandler.onChangeBattery.bind(this.botEventHandler))

    whatsAppClient.on('message', this.messageEventHandler.onMessage.bind(this.messageEventHandler))
    whatsAppClient.on('message_ack', this.messageEventHandler.onMessageAck.bind(this.messageEventHandler))
    whatsAppClient.on('message_create', this.messageEventHandler.onMessageCreate.bind(this.messageEventHandler))
    whatsAppClient.on('message_revoke_everyone', this.messageEventHandler.onMessageRevokeEveryone.bind(this.messageEventHandler))
    whatsAppClient.on('message_revoke_me', this.messageEventHandler.onMessageRevokeMe.bind(this.messageEventHandler))
    whatsAppClient.on('media_uploaded', this.messageEventHandler.onMediaUploaded.bind(this.messageEventHandler))
    whatsAppClient.on('incoming_call', this.messageEventHandler.onIncomingCall.bind(this.messageEventHandler))

    whatsAppClient.on('group_join', this.groupEventHandler.onRoomJoin.bind(this.messageEventHandler))
    whatsAppClient.on('group_leave', this.groupEventHandler.onRoomLeave.bind(this.messageEventHandler))
    whatsAppClient.on('group_update', this.groupEventHandler.onRoomUpdate.bind(this.messageEventHandler))

    const events = [
      'authenticated',
      'ready',
      'disconnected',
    ]
    const eventStreams = events.map((event) => fromEvent(whatsAppClient, event).pipe(map((value: any) => ({ event, value }))))
    const allEvents$ = merge(...eventStreams)
    allEvents$.pipe(distinctUntilKeyChanged('event')).subscribe(({ event, value }: { event: string, value: any }) => {
      log.info(PRE, `initWhatsAppEvents: ${JSON.stringify(event)}, value: ${JSON.stringify(value)}`)
      if (event === 'disconnected') {
        switch (value) {
          case 'NAVIGATION':
            void this.botEventHandler.onLogout(STRINGS[LANGUAGE].LOGOUT_REASON.DEFAULT)
            break
          case 'CONFLICT':
            void this.botEventHandler.onLogout(STRINGS[LANGUAGE].LOGOUT_REASON.LOGIN_CONFLICT)
            break
          default:
            void this.botEventHandler.onLogout(STRINGS[LANGUAGE].LOGOUT_REASON.DEFAULT)
            break
        }
      }
    })
  }

  public getMessageEventHandler () {
    return this.messageEventHandler
  }

}
