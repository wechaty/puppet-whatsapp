import schedule, { Job, JobCallback } from 'node-schedule'
import { log } from '../../config.js'

const PRE = 'ScheduleManager'

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

  public addScheduledTask (rule: string, callback: JobCallback): Job {
    log.silly(PRE, 'addNewScheduledTask()')
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
