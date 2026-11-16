export const WEEKDAY_SHORT = ['日', '一', '二', '三', '四', '五', '六']
export const WEEKDAY_FULL = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
export const WEEKDAY_START_MONDAY = [1, 2, 3, 4, 5, 6, 0]

const monthFormatter = new Intl.DateTimeFormat('zh-CN', {
  year: 'numeric',
  month: 'long'
})

const headerFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: 'long',
  day: 'numeric',
  weekday: 'long'
})

const shortFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: 'long',
  day: 'numeric'
})

export function dateFromKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(year, month - 1, day, 12, 0, 0, 0)
}

export function toDateKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function todayKey(now = new Date()): string {
  return toDateKey(now)
}

export function addDaysToKey(key: string, amount: number): string {
  const date = dateFromKey(key)
  date.setDate(date.getDate() + amount)
  return toDateKey(date)
}

export function weekdayOfKey(key: string): number {
  return dateFromKey(key).getDay()
}

export function daysBetweenKeys(from: string, to: string): number {
  const [fromYear, fromMonth, fromDay] = from.split('-').map(Number)
  const [toYear, toMonth, toDay] = to.split('-').map(Number)
  const fromUtc = Date.UTC(fromYear, fromMonth - 1, fromDay)
  const toUtc = Date.UTC(toYear, toMonth - 1, toDay)
  return Math.round((toUtc - fromUtc) / 86_400_000)
}

export function timestampDateKey(timestamp: string | null): string | null {
  if (!timestamp) return null
  return todayKey(new Date(timestamp))
}

export function monthStart(key: string): string {
  const date = dateFromKey(key)
  return toDateKey(new Date(date.getFullYear(), date.getMonth(), 1, 12))
}

export function shiftMonth(monthKey: string, amount: number): string {
  const date = dateFromKey(monthKey)
  return toDateKey(new Date(date.getFullYear(), date.getMonth() + amount, 1, 12))
}

export function monthTitle(monthKey: string): string {
  return monthFormatter.format(dateFromKey(monthKey))
}

export function friendlyHeader(key: string, today = todayKey()): string {
  const prefix = key === today ? '今天 · ' : ''
  return `${prefix}${headerFormatter.format(dateFromKey(key))}`
}

export function shortDate(key: string): string {
  return shortFormatter.format(dateFromKey(key))
}

export function sourceLabel(dueDate: string, today = todayKey()): string {
  if (dueDate === today) return ''
  const distance = daysBetweenKeys(dueDate, today)
  if (distance === 1) return '昨天'
  if (distance === 2) return '前天'
  if (distance > 2) return `${distance} 天前`
  return shortDate(dueDate)
}

export function monthGrid(monthKey: string): string[] {
  const first = dateFromKey(monthKey)
  const startOffset = (first.getDay() + 6) % 7
  const gridStart = addDaysToKey(monthKey, -startOffset)
  return Array.from({ length: 42 }, (_, index) => addDaysToKey(gridStart, index))
}

export function isMonthDay(dayKey: string, monthKey: string): boolean {
  const day = dateFromKey(dayKey)
  const month = dateFromKey(monthKey)
  return day.getFullYear() === month.getFullYear() && day.getMonth() === month.getMonth()
}

export function formatWeekdays(weekdays: number[]): string {
  const sorted = [...weekdays].sort((a, b) => WEEKDAY_START_MONDAY.indexOf(a) - WEEKDAY_START_MONDAY.indexOf(b))
  if (sorted.length === 7) return '每天'
  if (sorted.length === 5 && [1, 2, 3, 4, 5].every((day) => sorted.includes(day))) return '工作日'
  return `每周${sorted.map((day) => WEEKDAY_SHORT[day]).join('、')}`
}
