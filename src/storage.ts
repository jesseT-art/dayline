import { addDaysToKey, todayKey, weekdayOfKey } from './date'
import type { AccentName, AppData, Priority, Task, ThemeMode, WeeklySeries } from './types'

const STORE_KEY = 'dayline.app.v1'
const FUTURE_HORIZON_DAYS = 730

const accents: AccentName[] = ['indigo', 'moss', 'coral', 'amber', 'violet', 'ocean']
const themes: ThemeMode[] = ['system', 'light', 'dark']
const priorities: Priority[] = ['high', 'normal']

export function createDefaultData(): AppData {
  return {
    version: 1,
    tasks: [],
    series: [],
    preferences: {
      theme: 'system',
      accent: 'indigo'
    }
  }
}

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(STORE_KEY)
    if (!raw) return createDefaultData()
    const parsed = JSON.parse(raw) as Partial<AppData>
    const defaults = createDefaultData()

    const tasks = Array.isArray(parsed.tasks)
      ? parsed.tasks
          .filter((task): task is Task => Boolean(task?.id && task?.title && task?.dueDate))
          .map((task) => ({
            ...task,
            note: typeof task.note === 'string' ? task.note : '',
            priority: priorities.includes(task.priority) ? task.priority : 'normal',
            status:
              task.status === 'completed' || task.status === 'skipped' || task.status === 'active'
                ? task.status
                : 'active',
            createdAt: task.createdAt || new Date().toISOString(),
            statusAt: task.statusAt || null
          }))
      : []

    const series = Array.isArray(parsed.series)
      ? parsed.series
          .filter((item): item is WeeklySeries => Boolean(item?.id && item?.title && item?.startDate))
          .map((item) => ({
            ...item,
            note: typeof item.note === 'string' ? item.note : '',
            priority: priorities.includes(item.priority) ? item.priority : 'normal',
            weekdays: Array.isArray(item.weekdays)
              ? item.weekdays.filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
              : [weekdayOfKey(item.startDate)],
            exceptions: Array.isArray(item.exceptions) ? item.exceptions : [],
            createdAt: item.createdAt || new Date().toISOString()
          }))
      : []

    const preferences = parsed.preferences
    return {
      version: 1,
      tasks,
      series,
      preferences: {
        theme: preferences && themes.includes(preferences.theme) ? preferences.theme : defaults.preferences.theme,
        accent:
          preferences && accents.includes(preferences.accent) ? preferences.accent : defaults.preferences.accent
      }
    }
  } catch (error) {
    console.warn('Dayline could not read local data.', error)
    return createDefaultData()
  }
}

export function saveData(data: AppData): boolean {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(data))
    return true
  } catch (error) {
    console.error('Dayline could not save local data.', error)
    return false
  }
}

export function reconcileWeeklyTasks(data: AppData): boolean {
  const horizon = addDaysToKey(todayKey(), FUTURE_HORIZON_DAYS)
  const knownOccurrences = new Set(
    data.tasks.filter((task) => task.seriesId).map((task) => `${task.seriesId}:${task.dueDate}`)
  )
  let changed = false

  for (const series of data.series) {
    let cursor = series.startDate
    while (cursor <= horizon) {
      const occurrenceKey = `${series.id}:${cursor}`
      const isSelectedDay = series.weekdays.includes(weekdayOfKey(cursor))
      const isException = series.exceptions.includes(cursor)
      if (isSelectedDay && !isException && !knownOccurrences.has(occurrenceKey)) {
        data.tasks.push(createTaskFromSeries(series, cursor))
        knownOccurrences.add(occurrenceKey)
        changed = true
      }
      cursor = addDaysToKey(cursor, 1)
    }
  }

  return changed
}

export function createTaskFromSeries(series: WeeklySeries, dueDate: string): Task {
  return {
    id: `${series.id}--${dueDate}`,
    title: series.title,
    note: series.note,
    priority: series.priority,
    dueDate,
    status: 'active',
    createdAt: series.createdAt,
    statusAt: null,
    seriesId: series.id
  }
}

export function newId(): string {
  return typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`
}
