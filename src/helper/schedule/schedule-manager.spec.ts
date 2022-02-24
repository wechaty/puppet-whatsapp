import ScheduleManager from './schedule-manager.js'
import { test } from 'tstest'
import { Job } from 'node-schedule'

test('scheduleManager task add and remove test', async t => {
  try {
    const scheduleManager = ScheduleManager.Instance
    if (scheduleManager instanceof ScheduleManager) {
      t.ok('schedule manager instance obtained correctly')
    } else {
      t.fail('cannot get schedule manager instance')
    }

    const task = scheduleManager.addScheduledTask('42 * * * *', () => {
      console.info('The answer to life, the universe, and everything!')
    })
    if (task instanceof Job) {
      t.ok('add task successfully')
    } else {
      t.fail('add task should return a Job instance')
    }

    scheduleManager.removeScheduledTask(task)
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (task.nextInvocation() === null) {
      t.ok('task canceled successfully')
    } else {
      t.fail('cannot cancel task')
    }
    scheduleManager.clearAllTasks()

    t.pass('scheduleManager add and remove test pass.')

  } catch (e) {
    t.fail(e as any)
  }
})

test('scheduleManager task add and clear test', async t => {
  try {
    const scheduleManager = ScheduleManager.Instance
    if (scheduleManager instanceof ScheduleManager) {
      t.ok('schedule manager instance obtained correctly')
    } else {
      t.fail('cannot get schedule manager instance')
    }

    const task = scheduleManager.addScheduledTask('42 * * * *', () => {
      console.info('The answer to life, the universe, and everything!')
    })
    if (task instanceof Job) {
      t.ok('add task successfully')
    } else {
      t.fail('add task should return a Job instance')
    }

    scheduleManager.clearAllTasks()
    // @ts-ignore
    const taskCount = scheduleManager.jobPool.length
    if (taskCount === 0) {
      t.ok('all tasks cleared')
    } else {
      t.fail('job pool not empty')
    }

    t.pass('scheduleManager add and clear test pass.')

  } catch (e) {
    t.fail(e as any)
  }
})
