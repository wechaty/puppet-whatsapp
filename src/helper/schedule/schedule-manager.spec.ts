import ScheduleManager from './schedule-manager.js'
import { test } from 'tstest'
import { Job } from 'node-schedule'

test('scheduleManager task add and remove test', async t => {
  try {
    const scheduleManager = ScheduleManager.Instance
    t.ok(scheduleManager instanceof ScheduleManager)

    const task = scheduleManager.addScheduledTask('42 * * * *', () => {
      console.info('The answer to life, the universe, and everything!')
    })
    t.ok(task instanceof Job)

    scheduleManager.removeScheduledTask(task)
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    t.ok(task.nextInvocation() === null)
    scheduleManager.clearAllTasks()

    t.pass('scheduleManager add and remove test pass.')

  } catch (e) {
    t.fail(e as any)
  }
})

test('scheduleManager task add and clear test', async t => {
  try {
    const scheduleManager = ScheduleManager.Instance
    t.ok(scheduleManager instanceof ScheduleManager)

    const task = scheduleManager.addScheduledTask('42 * * * *', () => {
      console.info('The answer to life, the universe, and everything!')
    })
    t.ok(task instanceof Job)

    scheduleManager.clearAllTasks()
    // @ts-ignore
    const taskCount = scheduleManager.jobPool.length
    t.ok(taskCount === 0)
    t.pass('scheduleManager add and clear test pass.')

  } catch (e) {
    t.fail(e as any)
  }
})
