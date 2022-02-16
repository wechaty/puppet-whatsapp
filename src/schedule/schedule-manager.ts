import schedule, { Job } from 'node-schedule'
import { PRE } from '../config.js'
import { withPrefix } from '../logger/index.js'
import type { Manager } from '../manager.js'
import type { WhatsAppContact } from '../schema/whatsapp-type.js'
import { batchProcess } from '../utils.js'
const logger = withPrefix(`${PRE} ScheduleManager`)

export default class ScheduleManager {

  private syncMissedMessagesSchedule?: Job

  constructor (private manager: Manager) {}

  public startSyncMissedMessagesSchedule () {
    logger.silly('startSyncMissedMessages()')
    if (!this.syncMissedMessagesSchedule) {
      this.syncMissedMessagesSchedule = schedule.scheduleJob('0 */2 * * * *', async () => {
        const contactOrRoomList = await this.manager.syncContactOrRoomList()
        const batchSize = 100
        await batchProcess(batchSize, contactOrRoomList, async (contactOrRoom: WhatsAppContact) => {
          await this.manager.fetchMessages(contactOrRoom)
        })
      })
    }
  }

  public stopSyncMissedMessagesSchedule () {
    logger.silly('stopSyncMissedMessages()')
    if (this.syncMissedMessagesSchedule) {
      this.syncMissedMessagesSchedule.cancel()
    }
  }

}
