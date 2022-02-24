import ScheduleManager from './schedule-manager.js'
import { test } from 'tstest'
import { Job } from 'node-schedule'

test('scheduleManager get, set and clear test', async t => {
  try {
    const scheduleManager = ScheduleManager.Instance
    if (scheduleManager instanceof ScheduleManager) {
      t.ok('schedule manager instance obtained correctly')
    } else {
      t.fail('cannot get schedule manager instance')
    }

    const job = scheduleManager.addScheduledTask('42 * * * *', () => {
      console.info('The answer to life, the universe, and everything!')
    })
    if (job instanceof Job) {
      t.ok('add task successfully')
    } else {
      t.fail('add task should return a Job instance')
    }

    scheduleManager.clearAllTasks()
    // @ts-ignore
    const taskCount = scheduleManager.jobPool.length
    if (taskCount === 0) {
      t.ok('all job cleared')
    } else {
      t.fail('job pool not empty')
    }

  } catch (e) {
    t.fail(e as any)
  }
})
