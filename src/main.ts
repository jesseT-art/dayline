import './style.css'
import {
  WEEKDAY_SHORT,
  WEEKDAY_START_MONDAY,
  addDaysToKey,
  formatWeekdays,
  friendlyHeader,
  isMonthDay,
  monthGrid,
  monthStart,
  monthTitle,
  shiftMonth,
  shortDate,
  sourceLabel,
  timestampDateKey,
  todayKey,
  weekdayOfKey
} from './date'
import { loadData, newId, reconcileWeeklyTasks, saveData } from './storage'
import type { AccentName, AppData, Task, TaskStatus, ThemeMode } from './types'

type ComposerDraft = {
  title: string
  note: string
  dueDate: string
  priority: 'high' | 'normal'
  repeat: boolean
  weekdays: Set<number>
}

type DeletedSnapshot = {
  task: Task
  exceptionAdded: boolean
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const icons = {
  brand: `<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="9" fill="currentColor"/><path d="M9 11h14M9 16h9M9 21h11" stroke="#f8f5ec" stroke-width="2.4" stroke-linecap="round"/><circle cx="23" cy="21" r="2.8" fill="#f0a259"/></svg>`,
  calendar: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v3M17 3v3M4.5 9.5h15M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  settings: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm8 3.5c0-.58-.06-1.14-.17-1.68l2.02-1.57-2-3.46-2.38.96A8.2 8.2 0 0 0 15 4.92L14.66 2.4h-4L10.3 4.92c-.9.37-1.72.84-2.47 1.33l-2.38-.96-2 3.46 2.02 1.57A8.34 8.34 0 0 0 5.3 12c0 .58.06 1.14.17 1.68L3.45 15.25l2 3.46 2.38-.96c.75.49 1.57.96 2.47 1.33l.36 2.52h4l.36-2.52c.9-.37 1.72-.84 2.47-1.33l2.38.96 2-3.46-2.02-1.57c.11-.54.17-1.1.17-1.68Z" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linejoin="round"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  back: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  next: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  check: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6.5 12.5 3.5 3.5 7.5-8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  more: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="18" cy="12" r="1.5" fill="currentColor"/></svg>`,
  close: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M9 7V4h6v3M7.5 7l.7 13h7.6l.7-13M10 11v5M14 11v5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  restore: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8v5h5M6.2 16a7 7 0 1 0 .5-8.5L5 9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  skip: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6h12v12H6z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="m9 9 6 6M15 9l-6 6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  soundOff: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 14v-4h4l4-3v10l-4-3H5ZM16 9l4 6M20 9l-4 6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`
}

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('App root was not found.')

const data: AppData = loadData()
if (reconcileWeeklyTasks(data)) saveData(data)

let viewDate = todayKey()
let calendarMonth = monthStart(viewDate)
let advancedOpen = false
let deferredInstallPrompt: BeforeInstallPromptEvent | null = null
let lastDeleted: DeletedSnapshot | null = null
let toastTimer: number | null = null
let draft: ComposerDraft = createDraft(viewDate)

app.innerHTML = `
  <div class="app-frame">
    <header class="hero">
      <div class="topbar">
        <button class="brand" type="button" data-action="go-today" aria-label="返回今天">
          <span class="brand-mark">${icons.brand}</span>
          <span>Dayline</span>
        </button>
        <div class="topbar-actions">
          <button class="icon-button" type="button" data-action="open-calendar" aria-label="打开日历">
            ${icons.calendar}
          </button>
          <button class="icon-button" type="button" data-action="open-settings" aria-label="打开设置">
            ${icons.settings}
          </button>
        </div>
      </div>
      <div class="date-head">
        <div>
          <div class="eyebrow" id="dateEyebrow"></div>
          <h1 id="dateTitle"></h1>
        </div>
        <button class="back-today" type="button" data-action="go-today" id="backToday" hidden>
          ${icons.back}<span>今天</span>
        </button>
      </div>
      <div id="todaySummary"></div>
    </header>

    <main class="content">
      <div id="composerHost"></div>
      <section class="task-section" aria-labelledby="listTitle">
        <div class="section-label">
          <span id="listTitle">清单</span>
          <span id="listHint"></span>
        </div>
        <div class="task-list" id="taskList"></div>
      </section>
      <p class="local-note">离线保存 · 仅存于此设备</p>
    </main>
  </div>

  <div class="modal-layer" id="calendarModal" hidden>
    <button class="modal-scrim" type="button" data-action="close-modal" data-modal="calendarModal" aria-label="关闭日历"></button>
    <section class="modal-sheet calendar-sheet" role="dialog" aria-modal="true" aria-labelledby="calendarTitle">
      <div class="sheet-head">
        <div>
          <div class="eyebrow">HISTORY</div>
          <h2 id="calendarTitle">选择日期</h2>
        </div>
        <button class="icon-button" type="button" data-action="close-modal" data-modal="calendarModal" aria-label="关闭">
          ${icons.close}
        </button>
      </div>
      <div id="calendarBody"></div>
    </section>
  </div>

  <div class="modal-layer" id="overviewModal" hidden>
    <button class="modal-scrim" type="button" data-action="close-modal" data-modal="overviewModal" aria-label="关闭总览"></button>
    <section class="modal-sheet overview-sheet" role="dialog" aria-modal="true" aria-labelledby="overviewTitle">
      <div class="sheet-head">
        <div>
          <div class="eyebrow">TODAY</div>
          <h2 id="overviewTitle">今日清单总览</h2>
        </div>
        <button class="icon-button" type="button" data-action="close-modal" data-modal="overviewModal" aria-label="关闭">
          ${icons.close}
        </button>
      </div>
      <div id="overviewBody"></div>
    </section>
  </div>

  <div class="modal-layer" id="settingsModal" hidden>
    <button class="modal-scrim" type="button" data-action="close-modal" data-modal="settingsModal" aria-label="关闭设置"></button>
    <section class="modal-sheet settings-sheet" role="dialog" aria-modal="true" aria-labelledby="settingsTitle">
      <div class="sheet-head">
        <div>
          <div class="eyebrow">PREFERENCES</div>
          <h2 id="settingsTitle">设置</h2>
        </div>
        <button class="icon-button" type="button" data-action="close-modal" data-modal="settingsModal" aria-label="关闭">
          ${icons.close}
        </button>
      </div>
      <div id="settingsBody"></div>
    </section>
  </div>

  <div class="modal-layer" id="taskModal" hidden>
    <button class="modal-scrim" type="button" data-action="close-modal" data-modal="taskModal" aria-label="关闭任务操作"></button>
    <section class="modal-sheet action-sheet" role="dialog" aria-modal="true" aria-labelledby="taskModalTitle">
      <div id="taskModalBody"></div>
    </section>
  </div>

  <div class="toast" id="toast" role="status" aria-live="polite" hidden></div>
`

applyTheme()
render()

document.addEventListener('click', handleClick)
document.addEventListener('input', handleInput)
document.addEventListener('change', handleChange)
document.addEventListener('submit', handleSubmit)
document.addEventListener('keydown', handleKeydown)

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault()
  deferredInstallPrompt = event as BeforeInstallPromptEvent
  const installButton = document.querySelector<HTMLElement>('[data-action="install-app"]')
  if (installButton) installButton.hidden = false
})

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (data.preferences.theme === 'system') applyTheme()
})

function createDraft(date: string): ComposerDraft {
  return {
    title: '',
    note: '',
    dueDate: date,
    priority: 'normal',
    repeat: false,
    weekdays: new Set([weekdayOfKey(date)])
  }
}

function render(): void {
  renderHeader()
  renderTodaySummary()
  renderComposer()
  renderTasks()
}

function renderHeader(): void {
  const title = document.querySelector<HTMLElement>('#dateTitle')
  const eyebrow = document.querySelector<HTMLElement>('#dateEyebrow')
  const backToday = document.querySelector<HTMLElement>('#backToday')
  const isToday = viewDate === todayKey()
  if (!title || !eyebrow || !backToday) return

  title.textContent = isToday ? '今天' : shortDate(viewDate)
  eyebrow.textContent = friendlyHeader(viewDate).replace('今天 · ', '')
  backToday.hidden = isToday
  document.body.dataset.view = isToday ? 'today' : 'history'
}

function renderTodaySummary(): void {
  const host = document.querySelector<HTMLElement>('#todaySummary')
  if (!host) return

  if (viewDate !== todayKey()) {
    host.innerHTML = `
      <div class="history-marker">
        <i class="${viewDate > todayKey() ? 'future' : 'past'}"></i>
        <span>${viewDate > todayKey() ? '未来清单' : '历史清单'}</span>
        <em>${tasksDueOn(viewDate).length} 件</em>
      </div>
    `
    return
  }

  const active = activeForToday()
  const completed = finishedForToday('completed')
  const skipped = finishedForToday('skipped')
  const total = active.length + completed.length + skipped.length
  const completedPercent = total ? Math.round((completed.length / total) * 100) : 0
  const activePercent = total ? (active.length / total) * 100 : 0
  const completedStop = completedPercent
  const activeStop = completedPercent + activePercent
  const ring = total
    ? `conic-gradient(var(--success) 0 ${completedStop}%, var(--accent) ${completedStop}% ${activeStop}%, var(--violet) ${activeStop}% 100%)`
    : 'var(--surface-muted)'
  const week = sevenDayOverview()
  const weekTotal = week.reduce((sum, day) => sum + day.total, 0)
  const weekCompleted = week.reduce((sum, day) => sum + day.completed, 0)

  host.innerHTML = `
    <section class="today-dashboard" aria-label="今日信息概览">
      <div class="dashboard-panels">
        <div class="progress-panel">
          <div class="progress-ring" style="--ring:${ring}">
            <div><strong>${completedPercent}%</strong><span>完成</span></div>
          </div>
          <div class="progress-copy">
            <span class="mini-eyebrow">TODAY</span>
            <h2>今日进度</h2>
            <p>${completed.length} / ${total} 件已完成</p>
          </div>
        </div>
        <div class="week-panel">
          <div class="week-head">
            <div><span class="mini-eyebrow">7 DAYS</span><h2>近 7 天</h2></div>
            <em>完成 ${weekCompleted}<span> / ${weekTotal}</span></em>
          </div>
          <div class="week-chart">
            ${week
              .map(
                (day, index) => `
                  <div class="week-day ${index === week.length - 1 ? 'is-today' : ''}" title="${shortDate(day.date)}：${day.completed} / ${day.total}">
                    <div class="week-track"><i style="height:${day.height}%;--bar:${day.color}"></i></div>
                    <span>${index === week.length - 1 ? '今' : WEEKDAY_SHORT[weekdayOfKey(day.date)]}</span>
                  </div>
                `
              )
              .join('')}
          </div>
          <p class="chart-caption"><i></i>高度为任务量 · 颜色为完成度</p>
        </div>
      </div>
      <div class="dashboard-footer">
        <div class="metric-list">
          <span class="metric pending"><i></i>待完成 <strong>${active.length}</strong></span>
          <span class="metric done"><i></i>已完成 <strong>${completed.length}</strong></span>
          <span class="metric skipped"><i></i>无需 <strong>${skipped.length}</strong></span>
        </div>
        <button class="overview-link" type="button" data-action="open-overview">
          清单总览 ${icons.next}
        </button>
      </div>
    </section>
  `
}

function renderComposer(): void {
  const host = document.querySelector<HTMLElement>('#composerHost')
  if (!host) return
  const isToday = viewDate === todayKey()
  const placeholder = isToday ? '今天要做什么？' : `为${shortDate(viewDate)}记一件事`

  host.innerHTML = `
    <form class="composer ${advancedOpen ? 'is-expanded' : ''}" id="taskForm">
      <div class="quick-entry">
        <input
          id="taskTitle"
          name="title"
          type="text"
          value="${escapeHtml(draft.title)}"
          placeholder="${placeholder}"
          autocomplete="off"
          enterkeyhint="done"
          maxlength="160"
          aria-label="任务内容"
        />
        <button class="add-button" type="submit" aria-label="添加任务">
          ${icons.plus}<span>添加</span>
        </button>
      </div>
      <div class="composer-tools">
        <button class="detail-toggle" type="button" data-action="toggle-details">
          <span class="detail-dot"></span>
          <span>${advancedOpen ? '收起选项' : '详情'}</span>
        </button>
        <div class="draft-meta" id="draftMeta"></div>
      </div>
      <div class="composer-advanced" id="composerAdvanced">
        <label class="field note-field">
          <span>备注 <em>选填</em></span>
          <textarea id="taskNote" name="note" rows="2" maxlength="1000" placeholder="补充一点信息">${escapeHtml(draft.note)}</textarea>
        </label>
        <div class="field-grid">
          <button class="choice-button" type="button" data-action="toggle-priority" id="priorityChoice">
            <span class="choice-swatch high"></span>
            <span>高优先级</span>
          </button>
          <label class="choice-button date-choice">
            <span>日期</span>
            <input id="taskDate" name="date" type="date" value="${draft.dueDate}" />
          </label>
        </div>
        <div class="repeat-row">
          <div>
            <strong>每周重复</strong>
            <span>按所选星期，每周自动列出</span>
          </div>
          <label class="switch">
            <input id="repeatToggle" type="checkbox" ${draft.repeat ? 'checked' : ''} />
            <span></span>
          </label>
        </div>
        <div class="weekday-picker" id="weekdayPicker">
          ${WEEKDAY_START_MONDAY.map(
            (day) => `
              <button type="button" class="weekday-button ${draft.weekdays.has(day) ? 'is-selected' : ''}" data-action="toggle-weekday" data-weekday="${day}" aria-pressed="${draft.weekdays.has(day)}">
                ${WEEKDAY_SHORT[day]}
              </button>
            `
          ).join('')}
        </div>
      </div>
    </form>
  `
  updateDraftUI()
}

function updateDraftUI(): void {
  const meta = document.querySelector<HTMLElement>('#draftMeta')
  const advanced = document.querySelector<HTMLElement>('#composerAdvanced')
  const picker = document.querySelector<HTMLElement>('#weekdayPicker')
  const repeat = document.querySelector<HTMLInputElement>('#repeatToggle')
  const priority = document.querySelector<HTMLElement>('#priorityChoice')
  if (!meta || !advanced || !picker || !repeat || !priority) return

  const dateLabel = draft.dueDate === todayKey() ? '今天' : shortDate(draft.dueDate)
  const priorityLabel = draft.priority === 'high' ? '高优先级' : '普通'
  meta.textContent = `${priorityLabel} · ${dateLabel}${draft.repeat ? ' · ' + formatWeekdays([...draft.weekdays]) : ''}`
  advanced.hidden = !advancedOpen
  picker.hidden = !draft.repeat
  repeat.checked = draft.repeat
  priority.classList.toggle('is-selected', draft.priority === 'high')

  document.querySelectorAll<HTMLElement>('.weekday-button').forEach((button) => {
    const day = Number(button.dataset.weekday)
    const selected = draft.weekdays.has(day)
    button.classList.toggle('is-selected', selected)
    button.setAttribute('aria-pressed', String(selected))
  })
}

function renderTasks(): void {
  const host = document.querySelector<HTMLElement>('#taskList')
  const hint = document.querySelector<HTMLElement>('#listHint')
  if (!host || !hint) return

  const isToday = viewDate === todayKey()
  const dayTasks = isToday ? activeForToday() : tasksDueOn(viewDate)
  const pending = dayTasks.filter((task) => task.status === 'active')
  const finished = isToday
    ? finishedForToday('completed')
    : dayTasks.filter((task) => task.status !== 'active')
  const visibleCount = pending.length
  hint.textContent = isToday
    ? `${visibleCount} 待办${finished.length ? ` · ${finished.length} 完成` : ''}`
    : `${dayTasks.length} 件`

  if (pending.length === 0 && finished.length === 0) {
    host.innerHTML = `
      <div class="empty-state">
        <span class="empty-line"></span>
        <strong>${isToday ? '今天还很清爽' : '这一天没有清单'}</strong>
        <p>${isToday ? '写下一件要做的事，就从这里开始。' : '可以选择其他有颜色的日期查看。'}</p>
      </div>
    `
    return
  }

  host.innerHTML = `
    <div class="task-group">
      ${sortTasks(pending).map((task) => taskRow(task, isToday ? 'today' : 'history')).join('')}
    </div>
    ${
      finished.length
        ? `
          <div class="completed-divider">
            <span></span><strong>${isToday ? '已完成' : '完成情况'}</strong><em>${finished.length}</em><span></span>
          </div>
          <div class="task-group finished-group">
            ${sortTasks(finished).map((task) => taskRow(task, isToday ? 'today' : 'history')).join('')}
          </div>
        `
        : ''
    }
  `
}

function taskRow(task: Task, context: 'today' | 'history' | 'overview'): string {
  const statusClass = task.status === 'active' ? '' : `is-${task.status}`
  const statusLabel =
    task.status === 'completed' ? '已完成' : task.status === 'skipped' ? '今日无需完成' : ''
  const source = context === 'today' ? sourceLabel(task.dueDate) : ''
  const seriesLabel = task.seriesId ? '每周重复' : ''
  const sourceChip = source ? `<span class="meta-chip overdue">${escapeHtml(source)}</span>` : ''
  const repeatChip = seriesLabel ? `<span class="meta-chip">${seriesLabel}</span>` : ''
  const statusTime =
    task.status !== 'active' && task.statusAt
      ? new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(
          new Date(task.statusAt)
        )
      : ''
  const statusChip = statusLabel
    ? `<span class="status-chip ${statusClass}">${statusLabel}${statusTime ? ` · ${statusTime}` : ''}</span>`
    : ''
  const restoreButton =
    context === 'overview' && task.status !== 'active'
      ? `<button class="restore-button" type="button" data-action="restore-task" data-id="${task.id}">${icons.restore}<span>恢复</span></button>`
      : ''

  return `
    <article class="task-row ${task.priority === 'high' ? 'high-priority' : ''} ${statusClass}" data-task-id="${task.id}">
      <button
        class="complete-button"
        type="button"
        data-action="${task.status === 'active' ? 'complete-task' : 'open-task-menu'}"
        data-id="${task.id}"
        aria-label="${task.status === 'active' ? '标记完成' : statusLabel}"
      >
        ${task.status === 'completed' ? icons.check : task.status === 'skipped' ? icons.skip : ''}
      </button>
      <div class="task-copy">
        <div class="task-title-row">
          <h3>${escapeHtml(task.title)}</h3>
          ${task.priority === 'high' ? '<span class="priority-mark">重要</span>' : ''}
        </div>
        ${task.note ? `<p class="task-note">${escapeHtml(task.note)}</p>` : ''}
        <div class="task-meta">
          ${sourceChip}
          ${repeatChip}
          ${statusChip}
        </div>
      </div>
      ${restoreButton}
      <button class="task-menu-button" type="button" data-action="open-task-menu" data-id="${task.id}" aria-label="更多操作">
        ${icons.more}
      </button>
    </article>
  `
}

function renderCalendar(): void {
  const body = document.querySelector<HTMLElement>('#calendarBody')
  if (!body) return
  const today = todayKey()
  const days = monthGrid(calendarMonth)
  const counts = new Map<string, number>()
  for (const task of data.tasks) counts.set(task.dueDate, (counts.get(task.dueDate) || 0) + 1)

  body.innerHTML = `
    <div class="calendar-nav">
      <button class="icon-button" type="button" data-action="calendar-prev" aria-label="上个月">${icons.back}</button>
      <strong>${monthTitle(calendarMonth)}</strong>
      <button class="icon-button" type="button" data-action="calendar-next" aria-label="下个月">${icons.next}</button>
    </div>
    <div class="weekday-head">
      ${WEEKDAY_START_MONDAY.map((day) => `<span>${WEEKDAY_SHORT[day]}</span>`).join('')}
    </div>
    <div class="calendar-grid">
      ${days
        .map((day) => {
          const count = counts.get(day) || 0
          const shade = count === 0 ? 0 : Math.min(count, 4)
          return `
            <button
              type="button"
              class="calendar-day ${isMonthDay(day, calendarMonth) ? '' : 'is-outside'} ${day === today ? 'is-today' : ''} ${day === viewDate ? 'is-selected' : ''} shade-${shade}"
              data-action="select-date"
              data-date="${day}"
              aria-label="${shortDate(day)}，${count} 件任务"
            >
              <span>${Number(day.slice(-2))}</span>
              ${count > 0 ? '<i></i>' : ''}
            </button>
          `
        })
        .join('')}
    </div>
    <div class="calendar-legend">
      <span>没有清单</span>
      <div class="legend-shades">
        <i></i><i></i><i></i><i></i>
      </div>
      <span>清单较多</span>
    </div>
    <p class="calendar-tip">点击任意日期，查看当天的完成情况。</p>
  `
}

function renderOverview(): void {
  const body = document.querySelector<HTMLElement>('#overviewBody')
  if (!body) return
  const active = activeForToday()
  const completed = finishedForToday('completed')
  const skipped = finishedForToday('skipped')

  body.innerHTML = `
    <div class="overview-section">
      <div class="overview-label"><span>待完成</span><em>${active.length}</em></div>
      <div class="overview-list">
        ${active.length ? sortTasks(active).map((task) => taskRow(task, 'overview')).join('') : emptyOverview('没有待完成的任务')}
      </div>
    </div>
    <div class="overview-section">
      <div class="overview-label"><span>已完成</span><em>${completed.length}</em></div>
      <div class="overview-list">
        ${completed.length ? sortTasks(completed).map((task) => taskRow(task, 'overview')).join('') : emptyOverview('今天还没有完成记录')}
      </div>
    </div>
    <div class="overview-section">
      <div class="overview-label"><span>今日无需完成</span><em>${skipped.length}</em></div>
      <div class="overview-list">
        ${skipped.length ? sortTasks(skipped).map((task) => taskRow(task, 'overview')).join('') : emptyOverview('没有标记为无需完成的任务')}
      </div>
    </div>
  `
}

function emptyOverview(text: string): string {
  return `<p class="overview-empty">${text}</p>`
}

function renderSettings(): void {
  const body = document.querySelector<HTMLElement>('#settingsBody')
  if (!body) return
  const themeOptions: { value: ThemeMode; label: string }[] = [
    { value: 'system', label: '跟随系统' },
    { value: 'light', label: '浅色' },
    { value: 'dark', label: '深色' }
  ]
  const accentOptions: { value: AccentName; label: string; color: string }[] = [
    { value: 'indigo', label: '靛蓝', color: '#5264e8' },
    { value: 'moss', label: '苔绿', color: '#3d876a' },
    { value: 'coral', label: '珊瑚', color: '#de6954' },
    { value: 'amber', label: '琥珀', color: '#c88922' },
    { value: 'violet', label: '紫罗兰', color: '#8b64d8' },
    { value: 'ocean', label: '海蓝', color: '#168aa3' }
  ]

  body.innerHTML = `
    <section class="settings-section">
      <h3>外观</h3>
      <div class="segmented-control" role="group" aria-label="主题模式">
        ${themeOptions
          .map(
            (option) => `
              <button type="button" data-action="set-theme" data-theme="${option.value}" class="${data.preferences.theme === option.value ? 'is-selected' : ''}">
                ${option.label}
              </button>
            `
          )
          .join('')}
      </div>
      <div class="settings-block">
        <div class="settings-row-title"><span>主题色</span><small>${accentOptions.find((item) => item.value === data.preferences.accent)?.label}</small></div>
        <div class="accent-list" role="group" aria-label="主题色">
          ${accentOptions
            .map(
              (option) => `
                <button
                  type="button"
                  class="accent-swatch ${data.preferences.accent === option.value ? 'is-selected' : ''}"
                  data-action="set-accent"
                  data-accent="${option.value}"
                  style="--swatch:${option.color}"
                  aria-label="${option.label}"
                  aria-pressed="${data.preferences.accent === option.value}"
                ><i></i></button>
              `
            )
            .join('')}
        </div>
      </div>
    </section>
    <section class="settings-section">
      <h3>安装到桌面</h3>
      <p class="settings-copy">安装后可从主屏幕直接打开，离线也能记录。iPhone 请在 Safari 中点“分享”再选择“添加到主屏幕”。</p>
      <button class="wide-button" type="button" data-action="install-app" ${deferredInstallPrompt ? '' : 'hidden'}>
        安装 Dayline
      </button>
    </section>
    <section class="settings-section">
      <div class="notice-card">
        ${icons.soundOff}
        <div><strong>无悬浮通知</strong><span>清单只在你打开时呈现，不会打扰你。</span></div>
      </div>
      <p class="storage-note">数据保存在当前浏览器本地。清理网站数据会同时清除清单。</p>
    </section>
    <div class="brand-footer">
      <span class="brand-mark small">${icons.brand}</span>
      <div><strong>Dayline</strong><span>A clearer day, one line at a time.</span></div>
    </div>
  `
}

function openTaskMenu(taskId: string): void {
  const task = data.tasks.find((item) => item.id === taskId)
  if (!task) return
  const body = document.querySelector<HTMLElement>('#taskModalBody')
  if (!body) return
  body.innerHTML = `
    <div class="action-head">
      <div>
        <div class="eyebrow">TASK</div>
        <h2 id="taskModalTitle">${escapeHtml(task.title)}</h2>
      </div>
      <button class="icon-button" type="button" data-action="close-modal" data-modal="taskModal" aria-label="关闭">
        ${icons.close}
      </button>
    </div>
    <div class="action-list">
      ${
        task.status === 'active'
          ? `
            <button type="button" data-action="complete-task" data-id="${task.id}">${icons.check}<span>标记已完成</span></button>
            <button type="button" data-action="skip-task" data-id="${task.id}">${icons.skip}<span>今日无需完成</span></button>
          `
          : `
            <button type="button" data-action="restore-task" data-id="${task.id}">${icons.restore}<span>恢复为待完成</span></button>
          `
      }
      <button class="danger-action" type="button" data-action="delete-task" data-id="${task.id}">${icons.trash}<span>删除任务</span></button>
    </div>
  `
  showModal('taskModal')
}

function handleClick(event: MouseEvent): void {
  const target = event.target as HTMLElement
  const actionElement = target.closest<HTMLElement>('[data-action]')
  if (!actionElement) return
  const action = actionElement.dataset.action
  const id = actionElement.dataset.id

  switch (action) {
    case 'go-today':
      setViewDate(todayKey())
      break
    case 'open-calendar':
      calendarMonth = monthStart(viewDate)
      renderCalendar()
      showModal('calendarModal')
      break
    case 'calendar-prev':
      calendarMonth = shiftMonth(calendarMonth, -1)
      renderCalendar()
      break
    case 'calendar-next':
      calendarMonth = shiftMonth(calendarMonth, 1)
      renderCalendar()
      break
    case 'select-date':
      if (actionElement.dataset.date) {
        setViewDate(actionElement.dataset.date)
        hideModal('calendarModal')
      }
      break
    case 'open-overview':
      renderOverview()
      showModal('overviewModal')
      break
    case 'open-settings':
      renderSettings()
      showModal('settingsModal')
      break
    case 'toggle-details':
      advancedOpen = !advancedOpen
      document.querySelector('.composer')?.classList.toggle('is-expanded', advancedOpen)
      const toggleLabel = actionElement.querySelector('span:last-child')
      if (toggleLabel) toggleLabel.textContent = advancedOpen ? '收起选项' : '详情'
      updateDraftUI()
      if (advancedOpen) window.setTimeout(() => document.querySelector<HTMLTextAreaElement>('#taskNote')?.focus(), 100)
      break
    case 'toggle-priority':
      draft.priority = draft.priority === 'high' ? 'normal' : 'high'
      updateDraftUI()
      break
    case 'toggle-weekday': {
      const day = Number(actionElement.dataset.weekday)
      if (!Number.isInteger(day)) break
      if (draft.weekdays.has(day)) {
        if (draft.weekdays.size > 1) draft.weekdays.delete(day)
      } else {
        draft.weekdays.add(day)
      }
      updateDraftUI()
      break
    }
    case 'open-task-menu':
      if (id) openTaskMenu(id)
      break
    case 'complete-task':
      if (id) finishTask(id, 'completed')
      break
    case 'skip-task':
      if (id) finishTask(id, 'skipped')
      break
    case 'restore-task':
      if (id) restoreTask(id)
      break
    case 'delete-task':
      if (id) deleteTask(id)
      break
    case 'close-modal': {
      const modal = actionElement.dataset.modal
      if (modal) hideModal(modal)
      break
    }
    case 'set-theme': {
      const theme = actionElement.dataset.theme as ThemeMode | undefined
      if (theme) {
        data.preferences.theme = theme
        persist()
        applyTheme()
        renderSettings()
      }
      break
    }
    case 'set-accent': {
      const accent = actionElement.dataset.accent as AccentName | undefined
      if (accent) {
        data.preferences.accent = accent
        persist()
        applyTheme()
        renderSettings()
      }
      break
    }
    case 'install-app':
      void installApp()
      break
    case 'undo-delete':
      undoDelete()
      break
  }
}

function handleInput(event: Event): void {
  const target = event.target as HTMLInputElement | HTMLTextAreaElement
  if (target.id === 'taskTitle') draft.title = target.value
  if (target.id === 'taskNote') draft.note = target.value
}

function handleChange(event: Event): void {
  const target = event.target as HTMLInputElement
  if (target.id === 'taskDate') {
    const previousDate = draft.dueDate
    const previousWeekday = weekdayOfKey(previousDate)
    draft.dueDate = target.value || todayKey()
    if (draft.weekdays.size === 1 && draft.weekdays.has(previousWeekday)) {
      draft.weekdays.clear()
      draft.weekdays.add(weekdayOfKey(draft.dueDate))
    } else if (!draft.weekdays.size) {
      draft.weekdays.add(weekdayOfKey(draft.dueDate))
    }
    updateDraftUI()
  }
  if (target.id === 'repeatToggle') {
    draft.repeat = target.checked
    updateDraftUI()
  }
}

function handleSubmit(event: SubmitEvent): void {
  if (!(event.target instanceof HTMLFormElement) || event.target.id !== 'taskForm') return
  event.preventDefault()
  addTask()
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    const openModal = document.querySelector<HTMLElement>('.modal-layer:not([hidden])')
    if (openModal?.id) hideModal(openModal.id)
  }
}

function addTask(): void {
  const titleInput = document.querySelector<HTMLInputElement>('#taskTitle')
  const dateInput = document.querySelector<HTMLInputElement>('#taskDate')
  const noteInput = document.querySelector<HTMLTextAreaElement>('#taskNote')
  const title = (titleInput?.value || '').trim()
  if (!title) {
    titleInput?.focus()
    showToast('先写下一件要做的事')
    return
  }

  draft.title = title
  draft.note = noteInput?.value.trim() || ''
  draft.dueDate = dateInput?.value || viewDate
  const timestamp = new Date().toISOString()

  const savedRepeat = draft.repeat
  if (savedRepeat) {
    const seriesId = newId()
    data.series.push({
      id: seriesId,
      title,
      note: draft.note,
      priority: draft.priority,
      weekdays: [...draft.weekdays],
      startDate: draft.dueDate,
      exceptions: [],
      createdAt: timestamp
    })
    reconcileWeeklyTasks(data)
    persist()
  } else {
    data.tasks.push({
      id: newId(),
      title,
      note: draft.note,
      priority: draft.priority,
      dueDate: draft.dueDate,
      status: 'active',
      createdAt: timestamp,
      statusAt: null
    })
    persist()
  }

  const savedDate = draft.dueDate
  advancedOpen = false
  draft = createDraft(viewDate)
  render()
  titleInput?.focus()
  if (savedDate !== viewDate) {
    showToast(`${savedRepeat ? '重复清单' : '清单'}已记在 ${shortDate(savedDate)}`)
  } else {
    showToast(savedRepeat ? '已加入每周清单' : '已加入今天')
  }
}

function finishTask(taskId: string, status: Exclude<TaskStatus, 'active'>): void {
  const task = data.tasks.find((item) => item.id === taskId)
  if (!task) return
  if (status === 'completed') {
    task.status = 'completed'
    task.statusAt = new Date().toISOString()
    persist()
    hideModal('taskModal')
    render()
    navigator.vibrate?.(8)
    showToast('已完成 · 已移至清单底部')
    return
  }

  const row = document.querySelector<HTMLElement>(`.task-row[data-task-id="${cssEscape(taskId)}"]`)
  row?.classList.add('is-leaving')

  window.setTimeout(() => {
    task.status = status
    task.statusAt = new Date().toISOString()
    persist()
    hideModal('taskModal')
    render()
    navigator.vibrate?.(8)
    showToast('已标记为今日无需完成')
  }, 160)
}

function restoreTask(taskId: string): void {
  const task = data.tasks.find((item) => item.id === taskId)
  if (!task) return
  task.status = 'active'
  task.statusAt = null
  persist()
  hideModal('taskModal')
  render()
  if (!document.querySelector<HTMLElement>('#overviewModal')?.hidden) renderOverview()
  showToast('已恢复为待完成')
}

function deleteTask(taskId: string): void {
  const index = data.tasks.findIndex((item) => item.id === taskId)
  if (index === -1) return
  const [task] = data.tasks.splice(index, 1)
  let exceptionAdded = false
  if (task.seriesId) {
    const series = data.series.find((item) => item.id === task.seriesId)
    if (series && !series.exceptions.includes(task.dueDate)) {
      series.exceptions.push(task.dueDate)
      exceptionAdded = true
    }
  }
  lastDeleted = { task, exceptionAdded }
  persist()
  hideModal('taskModal')
  render()
  if (!document.querySelector<HTMLElement>('#overviewModal')?.hidden) renderOverview()
  showToast('任务已删除', '撤销')
}

function undoDelete(): void {
  if (!lastDeleted) return
  const { task, exceptionAdded } = lastDeleted
  if (!data.tasks.some((item) => item.id === task.id)) data.tasks.push(task)
  if (exceptionAdded && task.seriesId) {
    const series = data.series.find((item) => item.id === task.seriesId)
    if (series) series.exceptions = series.exceptions.filter((date) => date !== task.dueDate)
  }
  lastDeleted = null
  persist()
  render()
  if (!document.querySelector<HTMLElement>('#overviewModal')?.hidden) renderOverview()
  hideToast()
}

function setViewDate(date: string): void {
  viewDate = date
  calendarMonth = monthStart(date)
  draft = createDraft(date)
  render()
}

function activeForToday(): Task[] {
  const today = todayKey()
  return data.tasks.filter((task) => task.status === 'active' && task.dueDate <= today)
}

function tasksDueOn(date: string): Task[] {
  return data.tasks.filter((task) => task.dueDate === date)
}

function finishedForToday(status: 'completed' | 'skipped'): Task[] {
  const today = todayKey()
  return data.tasks.filter(
    (task) =>
      task.status === status &&
      (task.dueDate === today || timestampDateKey(task.statusAt) === today)
  )
}

function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    if (a.status !== b.status) {
      const order: Record<TaskStatus, number> = { active: 0, completed: 1, skipped: 2 }
      return order[a.status] - order[b.status]
    }
    const priorityDifference = (a.priority === 'high' ? 0 : 1) - (b.priority === 'high' ? 0 : 1)
    if (priorityDifference !== 0) return priorityDifference
    return b.createdAt.localeCompare(a.createdAt)
  })
}

function sevenDayOverview(): Array<{
  date: string
  total: number
  completed: number
  height: number
  color: string
}> {
  const today = todayKey()
  const days = Array.from({ length: 7 }, (_, index) => addDaysToKey(today, index - 6))
  const raw = days.map((date) => {
    const tasks = tasksDueOn(date)
    return {
      date,
      total: tasks.length,
      completed: tasks.filter((task) => task.status === 'completed').length
    }
  })
  const maxTotal = Math.max(1, ...raw.map((day) => day.total))

  return raw.map((day) => {
    const ratio = day.total ? day.completed / day.total : 0
    const height = day.total ? Math.max(22, Math.round((day.total / maxTotal) * 100)) : 6
    const color =
      day.total === 0
        ? 'var(--line-strong)'
        : ratio === 1
          ? 'var(--success)'
          : ratio >= 0.6
            ? 'var(--teal)'
            : ratio > 0
              ? 'var(--amber)'
              : 'var(--coral)'
    return { ...day, height, color }
  })
}

function persist(): void {
  if (!saveData(data)) showToast('本地保存失败，请检查浏览器存储空间')
}

function applyTheme(): void {
  const theme =
    data.preferences.theme === 'system'
      ? window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
      : data.preferences.theme
  document.documentElement.dataset.theme = theme
  document.documentElement.dataset.accent = data.preferences.accent
  document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.setAttribute(
    'content',
    theme === 'dark' ? '#0e1319' : '#eef2f6'
  )
}

function showModal(id: string): void {
  const modal = document.getElementById(id)
  if (!modal) return
  modal.hidden = false
  requestAnimationFrame(() => modal.classList.add('is-open'))
  document.body.classList.add('modal-open')
}

function hideModal(id: string): void {
  const modal = document.getElementById(id)
  if (!modal) return
  modal.classList.remove('is-open')
  window.setTimeout(() => {
    modal.hidden = true
    if (!document.querySelector('.modal-layer:not([hidden])')) document.body.classList.remove('modal-open')
  }, 180)
}

function showToast(message: string, actionLabel?: string): void {
  const toast = document.querySelector<HTMLElement>('#toast')
  if (!toast) return
  toast.innerHTML = `<span>${escapeHtml(message)}</span>${
    actionLabel ? `<button type="button" data-action="undo-delete">${actionLabel}</button>` : ''
  }`
  toast.hidden = false
  requestAnimationFrame(() => toast.classList.add('is-visible'))
  if (toastTimer) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(hideToast, actionLabel ? 5000 : 2400)
}

function hideToast(): void {
  const toast = document.querySelector<HTMLElement>('#toast')
  if (!toast) return
  toast.classList.remove('is-visible')
  window.setTimeout(() => {
    toast.hidden = true
    if (!toast.querySelector('[data-action="undo-delete"]')) lastDeleted = null
  }, 180)
}

async function installApp(): Promise<void> {
  if (!deferredInstallPrompt) {
    showToast('请使用浏览器菜单中的“添加到主屏幕”')
    return
  }
  await deferredInstallPrompt.prompt()
  const choice = await deferredInstallPrompt.userChoice
  deferredInstallPrompt = null
  if (choice.outcome === 'accepted') hideModal('settingsModal')
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function cssEscape(value: string): string {
  return typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(value) : value
}
