import schedule, { Job, JobCallback, RecurrenceRule, RecurrenceSpecDateRange, RecurrenceSpecObjLit } from 'node-schedule'
import { log } from '../../config.js'

const PRE = 'ScheduleManager'

type ScheduleRule = RecurrenceRule | RecurrenceSpecDateRange | RecurrenceSpecObjLit | Date | string | number

export default class ScheduleManager {

  private static _instance?: ScheduleManager
  private jobPool :Job[] = []

  private constructor () {}

  public static get Instance () {
    if (!this._instance) {
      this._instance = new ScheduleManager()
    }
    return this._instance
  }

  /**
   * Create a schedule job.
   *
   * @param rule     scheduling info, ref: https://github.com/node-schedule/node-schedule#cron-style-scheduling
   * @param callback callback to be executed on each invocation
   */
  public addScheduledTask (rule: ScheduleRule, callback: JobCallback): Job {
    log.silly(PRE, 'addScheduledTask()')
    const job = schedule.scheduleJob(rule, callback)
    this.jobPool.push(job)
    return job
  }

  public removeScheduledTask (job: Job): boolean {
    log.silly(PRE, 'removeScheduledTask()')
    const jobIndex = this.jobPool.indexOf(job)
    if (jobIndex === -1) {
      log.warn(PRE, 'trying to cannel a job not in jobPool')
    } else {
      this.jobPool = this.jobPool.slice(jobIndex)
    }
    return job.cancel()
  }

}
