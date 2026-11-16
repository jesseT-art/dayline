export type Priority = 'high' | 'normal'
export type TaskStatus = 'active' | 'completed' | 'skipped'
export type ThemeMode = 'system' | 'light' | 'dark'
export type AccentName = 'indigo' | 'moss' | 'coral' | 'amber' | 'violet' | 'ocean'

export interface Task {
  id: string
  title: string
  note: string
  priority: Priority
  dueDate: string
  status: TaskStatus
  createdAt: string
  statusAt: string | null
  seriesId?: string
}

export interface WeeklySeries {
  id: string
  title: string
  note: string
  priority: Priority
  weekdays: number[]
  startDate: string
  exceptions: string[]
  createdAt: string
}

export interface Preferences {
  theme: ThemeMode
  accent: AccentName
}

export interface AppData {
  version: 1
  tasks: Task[]
  series: WeeklySeries[]
  preferences: Preferences
}
