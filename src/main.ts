import './style.css'
import './completion.css'
import './backup.css'
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
import { loadData, newId, parseBackupData, reconcileWeeklyTasks, saveData } from './storage'
import type { AccentName, AppData, SummaryKind, Task, TaskStatus, ThemeMode } from './types'

type ComposerDraft = {
  title: string
  note: string
  dueDate: string
  priority: 'high' | 'normal'
  repeat: boolean
  weekdays: Set<number>
}

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const icons = {
  brand: `<svg viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="dayline-brand-gradient" x1="4" y1="2" x2="29" y2="31" gradientUnits="userSpaceOnUse"><stop stop-color="#22D7C1"/><stop offset=".48" stop-color="#3388F6"/><stop offset="1" stop-color="#765CF5"/></linearGradient><radialGradient id="dayline-brand-shine" cx="0" cy="0" r="1" gradientTransform="translate(7 4) rotate(42) scale(25)"><stop stop-color="white" stop-opacity=".38"/><stop offset="1" stop-color="white" stop-opacity="0"/></radialGradient></defs><rect width="32" height="32" rx="9" fill="url(#dayline-brand-gradient)"/><rect width="32" height="32" rx="9" fill="url(#dayline-brand-shine)"/><path d="M9 10h14M9 16h8M9 22h4" stroke="white" stroke-width="2.4" stroke-linecap="round"/><path d="m16 21.5 2.6 2.5 4.2-5" fill="none" stroke="white" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  calendar: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v3M17 3v3M4.5 9.5h15M6 5h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  settings: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Zm8 3.5c0-.58-.06-1.14-.17-1.68l2.02-1.57-2-3.46-2.38.96A8.2 8.2 0 0 0 15 4.92L14.66 2.4h-4L10.3 4.92c-.9.37-1.72.84-2.47 1.33l-2.38-.96-2 3.46 2.02 1.57A8.34 8.34 0 0 0 5.3 12c0 .58.06 1.14.17 1.68L3.45 15.25l2 3.46 2.38-.96c.75.49 1.57.96 2.47 1.33l.36 2.52h4l.36-2.52c.9-.37 1.72-.84 2.47-1.33l2.38.96 2-3.46-2.02-1.57c.11-.54.17-1.1.17-1.68Z" fill="none" stroke="currentColor" stroke-width="1.65" stroke-linejoin="round"/></svg>`,
  plus: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>`,
  back: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  next: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 5 7 7-7 7" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  check: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6.5 12.5 3.5 3.5 7.5-8" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  more: `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="12" r="1.5" fill="currentColor"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/><circle cx="18" cy="12" r="1.5" fill="currentColor"/></svg>`,
  close: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>`,
  summary: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3.5h9l4 4V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1Z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="M15 3.8V8h4M8.5 12h7M8.5 15.5h5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  download: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3.5v11M8 10.5l4 4 4-4M5 18.5h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  upload: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15.5v-11M8 8.5l4-4 4 4M5 18.5h14" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  trash: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M9 7V4h6v3M7.5 7l.7 13h7.6l.7-13M10 11v5M14 11v5" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  restore: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 8v5h5M6.2 16a7 7 0 1 0 .5-8.5L5 9" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  repeat: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 7h9.5l-2.2-2.2M17 17H7.5l2.2 2.2M17 7l2 2-2 2M7 17l-2-2 2-2" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  skip: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6h12v12H6z" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round"/><path d="m9 9 6 6M15 9l-6 6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"/></svg>`,
  soundOff: `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 14v-4h4l4-3v10l-4-3H5ZM16 9l4 6M20 9l-4 6" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"/></svg>`
}

const app = document.querySelector<HTMLDivElement>('#app')
if (!app) throw new Error('App root was not found.')

document.documentElement.dataset.platform = /Android/i.test(navigator.userAgent)
  ? 'android'
  : /iPhone|iPad|iPod/i.test(navigator.userAgent)
    ? 'ios'
    : 'desktop'

const data: AppData = loadData()
if (reconcileWeeklyTasks(data)) saveData(data)

let viewDate = todayKey()
let calendarMonth = monthStart(viewDate)
let summaryDate = todayKey()
let deferredInstallPrompt: BeforeInstallPromptEvent | null = null
let toastTimer: number | null = null
let highlightTimer: number | null = null
let highlightedTaskId: string | null = null
const completingTasks = new Set<string>()
const modalHistory: string[] = []
let suppressedPopstates = 0
let draft: ComposerDraft = createDraft(viewDate)
let pendingImportedData: AppData | null = null

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
        <div class="date-actions">
          <button class="summary-action" type="button" data-action="open-summary" id="summaryAction">
            ${icons.summary}<span>总结</span>
          </button>
          <button class="back-today" type="button" data-action="go-today" id="backToday" hidden>
            ${icons.back}<span>今天</span>
          </button>
        </div>
      </div>
      <div id="todaySummary"></div>
    </header>

    <main class="content">
      <div id="summaryHost"></div>
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

  <button class="floating-add-bar" type="button" data-action="open-quick-add" aria-label="添加清单">
    <span class="floating-add-icon">${icons.plus}</span>
    <span class="floating-add-copy">
      <strong>添加清单</strong>
      <small>快速记下一件要做的事</small>
    </span>
    <span class="floating-add-end">${icons.next}</span>
  </button>

  <div class="modal-layer quick-add-layer" id="quickAddModal" hidden>
    <button class="modal-scrim" type="button" data-action="close-modal" data-modal="quickAddModal" aria-label="关闭添加清单"></button>
    <section class="modal-sheet quick-add-sheet" role="dialog" aria-modal="true" aria-labelledby="quickAddTitle">
      <div class="sheet-head quick-add-head">
        <div>
          <div class="eyebrow">NEW TASK</div>
          <h2 id="quickAddTitle">添加清单</h2>
        </div>
        <button class="icon-button" type="button" data-action="close-modal" data-modal="quickAddModal" aria-label="关闭">
          ${icons.close}
        </button>
      </div>
      <div id="composerHost"></div>
    </section>
  </div>

  <div class="modal-layer" id="summaryModal" hidden>
    <button class="modal-scrim" type="button" data-action="close-modal" data-modal="summaryModal" aria-label="关闭每日总结"></button>
    <section class="modal-sheet summary-sheet" role="dialog" aria-modal="true" aria-labelledby="summaryTitle">
      <div class="sheet-head">
        <div>
          <div class="eyebrow">DAILY REVIEW</div>
          <h2 id="summaryTitle">每日总结</h2>
        </div>
        <button class="icon-button" type="button" data-action="close-modal" data-modal="summaryModal" aria-label="关闭">
          ${icons.close}
        </button>
      </div>
      <div id="summaryBody"></div>
    </section>
  </div>

  <div class="modal-layer" id="backupConfirmModal" hidden>
    <button class="modal-scrim" type="button" data-action="cancel-import" aria-label="取消导入"></button>
    <section class="modal-sheet backup-confirm-sheet" role="dialog" aria-modal="true" aria-labelledby="backupConfirmTitle">
      <div class="sheet-head">
        <div>
          <div class="eyebrow">RESTORE BACKUP</div>
          <h2 id="backupConfirmTitle">恢复备份？</h2>
        </div>
        <button class="icon-button" type="button" data-action="cancel-import" aria-label="取消">
          ${icons.close}
        </button>
      </div>
      <div id="backupConfirmBody"></div>
    </section>
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

  <div class="undo-stack" id="undoStack"></div>
  <div class="toast" id="toast" role="status" aria-live="polite" hidden></div>
`

applyTheme()
render()

document.addEventListener('click', handleClick)
document.addEventListener('input', handleInput)
document.addEventListener('change', handleChange)
document.addEventListener('submit', handleSubmit)
document.addEventListener('keydown', handleKeydown)
document.addEventListener('gesturestart', preventZoomGesture, { passive: false })
document.addEventListener('dblclick', preventZoomGesture, { passive: false })
window.addEventListener('popstate', handleModalBack)

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
  renderSummarySection()
  renderFloatingAddButton()
  renderTasks()
}

function renderFloatingAddButton(): void {
  const title = document.querySelector<HTMLElement>('.floating-add-copy strong')
  const subtitle = document.querySelector<HTMLElement>('.floating-add-copy small')
  if (!title || !subtitle) return
  const isToday = viewDate === todayKey()
  title.textContent = isToday ? '添加清单' : `添加到${compactDateLabel(viewDate)}`
  subtitle.textContent = isToday ? '快速记下一件要做的事' : '为选中的日期补充清单'
}

function renderHeader(): void {
  const title = document.querySelector<HTMLElement>('#dateTitle')
  const eyebrow = document.querySelector<HTMLElement>('#dateEyebrow')
  const backToday = document.querySelector<HTMLElement>('#backToday')
  const summaryAction = document.querySelector<HTMLElement>('#summaryAction')
  const isToday = viewDate === todayKey()
  if (!title || !eyebrow || !backToday || !summaryAction) return

  title.textContent = isToday ? '今天' : shortDate(viewDate)
  eyebrow.textContent = friendlyHeader(viewDate).replace('今天 · ', '')
  backToday.hidden = isToday
  document.body.dataset.view = isToday ? 'today' : 'history'
}

function renderSummarySection(): void {
  const host = document.querySelector<HTMLElement>('#summaryHost')
  if (!host) return
  const summaries = summariesFor(viewDate)
  const isToday = viewDate === todayKey()

  if (summaries.length === 0) {
    host.innerHTML = isToday
      ? ''
      : `
        <section class="daily-summary-empty">
          <div><strong>这一天还没有总结</strong><span>记录工作或学习上的收获</span></div>
          <button type="button" data-action="open-summary">写总结</button>
        </section>
      `
    return
  }

  host.innerHTML = `
    <section class="daily-summary-panel" aria-labelledby="dailySummaryTitle">
      <div class="daily-summary-head">
        <div>
          <span class="mini-eyebrow">DAILY REVIEW</span>
          <h2 id="dailySummaryTitle">${isToday ? '今日总结' : shortDate(viewDate) + '总结'}</h2>
        </div>
        <button class="summary-edit-button" type="button" data-action="open-summary">
          ${icons.summary}<span>编辑</span>
        </button>
      </div>
      <div class="summary-card-list">
        ${summaries
          .map(
            (summary) => `
              <article class="summary-card ${summary.kind}">
                <div class="summary-card-head">
                  <span>${summary.kind === 'work' ? '工作总结' : '学习总结'}</span>
                  <time>${new Intl.DateTimeFormat('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(summary.updatedAt))}</time>
                </div>
                <p>${escapeHtml(summary.content).replaceAll('\n', '<br>')}</p>
              </article>
            `
          )
          .join('')}
      </div>
    </section>
  `
}

function summariesFor(date: string) {
  return data.summaries
    .filter((summary) => summary.date === date)
    .sort((a, b) => (a.kind === b.kind ? 0 : a.kind === 'work' ? -1 : 1))
}

function summaryContent(date: string, kind: SummaryKind): string {
  return data.summaries.find((summary) => summary.date === date && summary.kind === kind)?.content || ''
}

function openSummaryEditor(): void {
  summaryDate = viewDate
  renderSummaryEditor()
  showModal('summaryModal')
  document.querySelector<HTMLTextAreaElement>('#summaryWork')?.focus()
}

function renderSummaryEditor(): void {
  const body = document.querySelector<HTMLElement>('#summaryBody')
  if (!body) return
  body.innerHTML = `
    <form class="summary-form" id="summaryForm">
      <div class="summary-date-label">
        <span>${summaryDate === todayKey() ? '今天' : shortDate(summaryDate)}</span>
        <em>工作总结或学习总结，至少填写一项</em>
      </div>
      <label class="summary-input work">
        <span>工作总结</span>
        <textarea id="summaryWork" rows="4" maxlength="3000" placeholder="今天完成了什么，有什么进展或问题？">${escapeHtml(summaryContent(summaryDate, 'work'))}</textarea>
      </label>
      <label class="summary-input study">
        <span>学习总结</span>
        <textarea id="summaryStudy" rows="4" maxlength="3000" placeholder="今天学了什么，有哪些收获或想法？">${escapeHtml(summaryContent(summaryDate, 'study'))}</textarea>
      </label>
      <button class="summary-save-button" type="submit">
        ${icons.summary}<span>保存总结</span>
      </button>
    </form>
  `
}

function saveSummary(): void {
  const work = document.querySelector<HTMLTextAreaElement>('#summaryWork')?.value.trim() || ''
  const study = document.querySelector<HTMLTextAreaElement>('#summaryStudy')?.value.trim() || ''
  const now = new Date().toISOString()
  const upsert = (kind: SummaryKind, content: string): void => {
    const existing = data.summaries.find(
      (summary) => summary.date === summaryDate && summary.kind === kind
    )
    data.summaries = data.summaries.filter(
      (summary) => !(summary.date === summaryDate && summary.kind === kind)
    )
    if (content) {
      data.summaries.push({
        date: summaryDate,
        kind,
        content,
        updatedAt: existing?.content === content ? existing.updatedAt : now
      })
    }
  }
  upsert('work', work)
  upsert('study', study)
  persist()
  hideModal('summaryModal')
  renderHeader()
  renderSummarySection()
  showToast(work || study ? '总结已保存' : '总结已清空')
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
    ? `conic-gradient(var(--accent) 0 ${completedStop}%, var(--accent-2) ${completedStop}% ${activeStop}%, var(--accent-3) ${activeStop}% 100%)`
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

let editingTaskId: string | null = null

function renderComposer(): void {
  const host = document.querySelector<HTMLElement>('#composerHost')
  if (!host) return
  const isToday = viewDate === todayKey()
  const placeholder = isToday ? '今天要做什么？' : `为${shortDate(viewDate)}记一件事`

  const editing = data.tasks.find((task) => task.id === editingTaskId)
  document.querySelector('#quickAddTitle')!.textContent = editing ? '修改清单' : '添加清单'

  host.innerHTML = `
    <form class="composer task-composer" id="taskForm">
      <div class="composer-caption">
        <span>${editing?.seriesId ? '仅修改这一次重复清单' : editing ? '更新清单内容' : '把待办写下来'}</span>
        <em id="draftMeta"></em>
      </div>
      <label class="title-field">
        <span class="sr-only">清单内容</span>
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
      </label>
      <label class="field note-field">
        <span>备注 <em>选填</em></span>
        <textarea id="taskNote" name="note" rows="2" maxlength="1000" placeholder="补充一点信息">${escapeHtml(draft.note)}</textarea>
      </label>
      <div class="field-grid">
        <button class="choice-button" type="button" data-action="toggle-priority" id="priorityChoice" aria-pressed="${draft.priority === 'high'}">
          <span class="choice-swatch high"></span>
          <span>高优先级</span>
        </button>
        <label class="choice-button date-choice">
          <span>日期</span>
          <strong id="taskDateDisplay">${escapeHtml(compactDateLabel(draft.dueDate))}</strong>
          <input id="taskDate" name="date" type="date" value="${draft.dueDate}" ${editing?.seriesId ? 'disabled' : ''} />
        </label>
      </div>
      <div class="repeat-row" ${editing ? 'hidden' : ''}>
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
      <button class="submit-add-bar" id="submitAddButton" type="submit">
        <span class="submit-add-icon">${icons.plus}</span>
        <span class="submit-add-label">${editing ? '保存修改' : '添加清单'}</span>
        <span class="submit-add-hint">Enter</span>
      </button>
    </form>
  `
  updateDraftUI()
}

function updateDraftUI(): void {
  const meta = document.querySelector<HTMLElement>('#draftMeta')
  const picker = document.querySelector<HTMLElement>('#weekdayPicker')
  const repeat = document.querySelector<HTMLInputElement>('#repeatToggle')
  const priority = document.querySelector<HTMLElement>('#priorityChoice')
  const dateDisplay = document.querySelector<HTMLElement>('#taskDateDisplay')
  if (!meta || !picker || !repeat || !priority) return

  const dateLabel = draft.dueDate === todayKey() ? '今天' : shortDate(draft.dueDate)
  const priorityLabel = draft.priority === 'high' ? '高优先级' : '普通'
  meta.textContent = `${priorityLabel} · ${dateLabel}${draft.repeat ? ' · ' + formatWeekdays([...draft.weekdays]) : ''}`
  if (dateDisplay) dateDisplay.textContent = compactDateLabel(draft.dueDate)
  picker.hidden = !draft.repeat
  repeat.checked = draft.repeat
  priority.classList.toggle('is-selected', draft.priority === 'high')
  priority.setAttribute('aria-pressed', String(draft.priority === 'high'))

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
  const highlightClass = task.id === highlightedTaskId ? 'is-highlighted' : ''
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
    <article class="task-row ${task.priority === 'high' ? 'high-priority' : ''} ${statusClass} ${highlightClass}" data-task-id="${task.id}">
      <button
        class="complete-button"
        type="button"
        data-action="${task.status === 'active' ? 'complete-task' : 'open-task-menu'}"
        data-id="${task.id}"
        aria-label="${task.status === 'active' ? '标记完成' : statusLabel}"
      >
        ${task.status === 'skipped' ? icons.skip : icons.check}
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

  const summaryDates = new Set(data.summaries.filter(({ content }) => content.trim()).map(({ date }) => date))

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
          const hasSummary = summaryDates.has(day)
          const shade = count === 0 ? 0 : Math.min(count, 4)
          return `
            <button
              type="button"
              class="calendar-day ${isMonthDay(day, calendarMonth) ? '' : 'is-outside'} ${day === today ? 'is-today' : ''} ${day === viewDate ? 'is-selected' : ''} shade-${shade}"
              data-action="select-date"
              data-date="${day}"
              aria-label="${shortDate(day)}，${count} 件任务${hasSummary ? '，有总结' : ''}"
            >
              <span>${Number(day.slice(-2))}</span>
              ${count > 0 ? '<i></i>' : ''}
              ${hasSummary ? '<span class="calendar-summary-mark" aria-hidden="true">记</span>' : ''}
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
    <p class="calendar-tip">“记”表示当天有总结。点击日期可查看当天的清单和总结。</p>
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
      <h3>数据备份</h3>
      <p class="settings-copy">导出包含清单、每日总结、重复任务和主题设置的 JSON 文件。导入前会再次确认。</p>
      <div class="backup-action-grid">
        <button type="button" data-action="export-backup">
          <span class="backup-action-icon">${icons.download}</span>
          <span><strong>导出备份</strong><small>保存到文件或分享</small></span>
        </button>
        <button type="button" data-action="import-backup">
          <span class="backup-action-icon">${icons.upload}</span>
          <span><strong>导入恢复</strong><small>选择 Dayline JSON</small></span>
        </button>
      </div>
      <input id="backupFileInput" class="backup-file-input" type="file" accept="application/json,.json" hidden />
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

async function exportBackup(): Promise<void> {
  const backup = {
    ...data,
    exportedAt: new Date().toISOString()
  }
  const fileName = `dayline-backup-${todayKey()}.json`
  const file = new File([JSON.stringify(backup, null, 2)], fileName, {
    type: 'application/json'
  })
  const shareNavigator = navigator as Navigator & {
    canShare?: (shareData: { files: File[] }) => boolean
    share?: (shareData: { files: File[]; title?: string; text?: string }) => Promise<void>
  }

  if (
    document.documentElement.dataset.platform === 'ios' &&
    shareNavigator.canShare?.({ files: [file] }) &&
    shareNavigator.share
  ) {
    try {
      await shareNavigator.share({
        files: [file],
        title: 'Dayline 数据备份',
        text: '请将此备份文件保存到“文件”应用。'
      })
      showToast('备份文件已准备好')
      return
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
    }
  }

  const url = URL.createObjectURL(file)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
  showToast('备份文件已导出')
}

async function readBackupFile(file: File): Promise<void> {
  if (file.size > 10 * 1024 * 1024) {
    showToast('备份文件不能超过 10MB')
    return
  }
  let imported: AppData | null = null
  try {
    imported = parseBackupData(await file.text())
  } catch {
    imported = null
  }
  if (!imported) {
    showToast('无法识别该备份文件')
    return
  }
  pendingImportedData = imported
  renderBackupConfirmation(imported)
  showModal('backupConfirmModal')
}

function renderBackupConfirmation(backup: AppData): void {
  const body = document.querySelector<HTMLElement>('#backupConfirmBody')
  if (!body) return
  body.innerHTML = `
    <div class="backup-summary-grid">
      <div><strong>${backup.tasks.length}</strong><span>条清单</span></div>
      <div><strong>${backup.summaries.length}</strong><span>条总结</span></div>
      <div><strong>${backup.series.length}</strong><span>个重复系列</span></div>
    </div>
    <p class="series-confirm-copy">
      恢复后将覆盖当前设备上的清单、总结、重复规则和主题设置。建议先导出当前数据作为备份。
    </p>
    <div class="action-list">
      <button type="button" data-action="cancel-import">取消</button>
      <button class="backup-confirm-action" type="button" data-action="confirm-import">${icons.upload}<span>确认恢复备份</span></button>
    </div>
  `
}

function applyImportedBackup(): void {
  if (!pendingImportedData) return
  for (const id of pendingTaskUndos.keys()) clearTaskUndo(id)
  data.tasks = pendingImportedData.tasks
  data.series = pendingImportedData.series
  data.summaries = pendingImportedData.summaries
  data.preferences = { ...pendingImportedData.preferences }
  reconcileWeeklyTasks(data)
  if (!saveData(data)) {
    showToast('备份恢复失败，本地存储空间不足')
    return
  }

  pendingImportedData = null
  viewDate = todayKey()
  calendarMonth = monthStart(viewDate)
  summaryDate = viewDate
  draft = createDraft(viewDate)
  applyTheme()
  hideModal('backupConfirmModal')
  render()
  renderSettings()
  showToast('备份已恢复')
}

function openTaskMenu(taskId: string): void {
  const task = data.tasks.find((item) => item.id === taskId)
  if (!task) return
  const series = task.seriesId ? data.series.find((item) => item.id === task.seriesId) : undefined
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
      <button type="button" data-action="edit-task" data-id="${task.id}">${icons.summary}<span>修改清单</span></button>
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
      ${
        series
          ? `<button class="series-action" type="button" data-action="open-stop-series" data-id="${task.id}">${icons.repeat}<span>停止整个重复系列</span></button>`
          : ''
      }
      <button class="danger-action" type="button" data-action="delete-task" data-id="${task.id}">${icons.trash}<span>删除任务</span></button>
    </div>
  `
  showModal('taskModal')
}

function openStopSeriesMenu(taskId: string): void {
  const task = data.tasks.find((item) => item.id === taskId)
  const series = task?.seriesId ? data.series.find((item) => item.id === task.seriesId) : undefined
  if (!task || !series) return
  const pendingCount = data.tasks.filter(
    (item) => item.seriesId === series.id && item.status === 'active'
  ).length
  const body = document.querySelector<HTMLElement>('#taskModalBody')
  if (!body) return
  body.innerHTML = `
    <div class="action-head">
      <div>
        <div class="eyebrow">REPEATING TASK</div>
        <h2 id="taskModalTitle">停止整个重复系列？</h2>
      </div>
      <button class="icon-button" type="button" data-action="close-modal" data-modal="taskModal" aria-label="关闭">
        ${icons.close}
      </button>
    </div>
    <div class="series-confirm-card">
      <strong>${escapeHtml(series.title)}</strong>
      <span>${escapeHtml(formatWeekdays(series.weekdays))}</span>
    </div>
    <p class="series-confirm-copy">
      将停止此后的每周安排，并移除该系列中 ${pendingCount} 条未完成任务。已完成和“无需完成”的历史记录会保留。
    </p>
    <div class="action-list">
      <button type="button" data-action="close-modal" data-modal="taskModal">取消</button>
      <button class="danger-action" type="button" data-action="confirm-stop-series" data-id="${task.id}">${icons.repeat}<span>确认停止重复</span></button>
    </div>
  `
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
    case 'open-quick-add':
      openQuickAdd()
      break
    case 'open-summary':
      openSummaryEditor()
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
    case 'export-backup':
      void exportBackup()
      break
    case 'import-backup':
      document.querySelector<HTMLInputElement>('#backupFileInput')?.click()
      break
    case 'confirm-import':
      applyImportedBackup()
      break
    case 'cancel-import':
      pendingImportedData = null
      hideModal('backupConfirmModal')
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
    case 'edit-task':
      if (id) openQuickAdd(id)
      break
    case 'open-task-menu':
      if (id) openTaskMenu(id)
      break
    case 'open-stop-series':
      if (id) openStopSeriesMenu(id)
      break
    case 'confirm-stop-series':
      if (id) stopSeries(id)
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
    case 'undo-task':
      if (id) undoTaskAction(id)
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
  if (target.id === 'backupFileInput') {
    const file = target.files?.[0]
    target.value = ''
    if (file) void readBackupFile(file)
  }
}

function handleSubmit(event: SubmitEvent): void {
  if (!(event.target instanceof HTMLFormElement)) return
  if (event.target.id === 'taskForm') {
    event.preventDefault()
    addTask()
  } else if (event.target.id === 'summaryForm') {
    event.preventDefault()
    saveSummary()
  }
}

function handleKeydown(event: KeyboardEvent): void {
  if (event.key === 'Escape') {
    const openModal = document.querySelector<HTMLElement>('.modal-layer:not([hidden])')
    if (openModal?.id) hideModal(openModal.id)
  }
}

function preventZoomGesture(event: Event): void {
  if (event.cancelable) event.preventDefault()
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
  if (editingTaskId) {
    const task = data.tasks.find((item) => item.id === editingTaskId)
    if (!task) return
    task.title = title
    task.note = draft.note
    task.priority = draft.priority
    if (!task.seriesId) task.dueDate = draft.dueDate
    editingTaskId = null
    persist()
    hideModal('quickAddModal')
    render()
    showToast('清单已修改')
    return
  }
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
    const firstOccurrence = data.tasks.find((item) => item.id === `${seriesId}--${draft.dueDate}`)
    if (firstOccurrence) highlightedTaskId = firstOccurrence.id
    persist()
  } else {
    const taskId = newId()
    data.tasks.push({
      id: taskId,
      title,
      note: draft.note,
      priority: draft.priority,
      dueDate: draft.dueDate,
      status: 'active',
      createdAt: timestamp,
      statusAt: null
    })
    persist()
    highlightedTaskId = taskId
  }

  const savedDate = draft.dueDate
  draft = createDraft(viewDate)
  const submitButton = document.querySelector<HTMLElement>('#submitAddButton')
  submitButton?.classList.add('is-success')
  const submitLabel = submitButton?.querySelector<HTMLElement>('.submit-add-label')
  if (submitLabel) submitLabel.textContent = '已添加'
  render()
  hideModal('quickAddModal')
  if (highlightedTaskId) scheduleHighlightClear(highlightedTaskId)
  if (savedDate !== viewDate) {
    showToast(`${savedRepeat ? '重复清单' : '清单'}已记在 ${shortDate(savedDate)}`)
  } else {
    showToast(savedRepeat ? '已加入每周清单' : '已加入今天')
  }
}

function openQuickAdd(taskId?: string): void {
  const task = data.tasks.find((item) => item.id === taskId)
  editingTaskId = task?.id ?? null
  draft = createDraft(task?.dueDate ?? viewDate)
  if (task) {
    draft.title = task.title
    draft.note = task.note
    draft.priority = task.priority
    const menu = document.getElementById('taskModal')
    if (menu) {
      menu.classList.remove('is-open')
      menu.hidden = true
    }
    const menuIndex = modalHistory.lastIndexOf('taskModal')
    if (menuIndex >= 0) {
      modalHistory[menuIndex] = 'quickAddModal'
      history.replaceState({ ...history.state, daylineModal: 'quickAddModal' }, '', location.href)
    }
  }
  renderComposer()
  showModal('quickAddModal')
  const titleInput = document.querySelector<HTMLInputElement>('#taskTitle')
  titleInput?.focus()
  titleInput?.setSelectionRange(titleInput.value.length, titleInput.value.length)
}

const taskShatterMs = 460

function shatterTaskCard(row: HTMLElement): HTMLElement | null {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return null
  const bounds = row.getBoundingClientRect()
  if (!bounds.width || !bounds.height || bounds.bottom < 0 || bounds.top > window.innerHeight) return null

  const layer = document.createElement('div')
  layer.className = 'task-shatter-layer'
  layer.setAttribute('aria-hidden', 'true')
  layer.inert = true

  const points = [
    [[0, 0], [29, 0], [66, 0], [100, 0]],
    [[0, 45], [37, 62], [61, 35], [100, 54]],
    [[0, 100], [25, 100], [73, 100], [100, 100]]
  ]
  for (let y = 0; y < 2; y++) {
    for (let x = 0; x < 3; x++) {
      const topLeft = points[y][x]
      const topRight = points[y][x + 1]
      const bottomLeft = points[y + 1][x]
      const bottomRight = points[y + 1][x + 1]
      for (const corners of [[topLeft, topRight, bottomLeft], [topRight, bottomRight, bottomLeft]]) {
        const piece = document.createElement('div')
        piece.className = 'task-shatter-piece'
        piece.style.left = `${bounds.left}px`
        piece.style.top = `${bounds.top}px`
        piece.style.width = `${bounds.width}px`
        piece.style.height = `${bounds.height}px`
        piece.style.clipPath = `polygon(${corners.map(([px, py]) => `${px}% ${py}%`).join(',')})`
        const center = corners.reduce(([cx, cy], [px, py]) => [cx + px / 3, cy + py / 3], [0, 0])
        piece.style.transformOrigin = `${center[0]}% ${center[1]}%`
        piece.style.setProperty('--shatter-x', `${(center[0] - 50) * 1.8}px`)
        piece.style.setProperty('--shatter-y', `${(center[1] - 50) * 0.82 + 26}px`)
        piece.style.setProperty('--shatter-spin', `${(center[0] - 50) * 0.6 + (center[1] - 50) * 0.35}deg`)
        piece.style.animationDuration = `${taskShatterMs}ms`
        const copy = row.cloneNode(true) as HTMLElement
        copy.removeAttribute('data-task-id')
        piece.append(copy)
        layer.append(piece)
      }
    }
  }
  document.body.append(layer)
  row.classList.add('is-shattering')
  return layer
}

function finishTask(taskId: string, status: Exclude<TaskStatus, 'active'>): void {
  const task = data.tasks.find((item) => item.id === taskId)
  if (!task || completingTasks.has(taskId)) return
  completingTasks.add(taskId)
  triggerHaptic(status === 'completed' ? [12, 22, 16] : 16)

  if (status === 'completed') {
    const overviewOpen = !document.querySelector<HTMLElement>('#overviewModal')?.hidden
    const scope = overviewOpen ? document.querySelector<HTMLElement>('#overviewModal') : document
    const row = scope?.querySelector<HTMLElement>(`.task-row[data-task-id="${cssEscape(taskId)}"]`)
    const shatter = row ? shatterTaskCard(row) : null

    const previousStatus = task.status
    const previousStatusAt = task.statusAt
    const completedAt = new Date().toISOString()
    task.status = 'completed'
    task.statusAt = completedAt
    persist()
    hideModal('taskModal')
    showToast('已完成', true)
    const completionTimer = window.setTimeout(() => {
      shatter?.remove()
      if (!data.tasks.includes(task) || task.status !== 'completed' || task.statusAt !== completedAt) {
        completingTasks.delete(taskId)
        return
      }
      highlightedTaskId = task.id
      render()
      scheduleHighlightClear(task.id)
      if (!document.querySelector<HTMLElement>('#overviewModal')?.hidden) renderOverview()
      completingTasks.delete(taskId)
    }, shatter ? taskShatterMs : 0)
    offerTaskUndo('已完成', task.title, () => {
      if (!data.tasks.includes(task) || task.status !== 'completed' || task.statusAt !== completedAt) return
      window.clearTimeout(completionTimer)
      shatter?.remove()
      completingTasks.delete(taskId)
      task.status = previousStatus
      task.statusAt = previousStatusAt
      saveUndoResult('已撤回完成')
    })
    return
  }

  const overviewOpen = !document.querySelector<HTMLElement>('#overviewModal')?.hidden
  const scope = overviewOpen ? document.querySelector<HTMLElement>('#overviewModal') : document
  const row = scope?.querySelector<HTMLElement>(`.task-row[data-task-id="${cssEscape(taskId)}"]`)
  row?.classList.add('is-leaving')

  window.setTimeout(() => {
    task.status = status
    task.statusAt = new Date().toISOString()
    persist()
    hideModal('taskModal')
    render()
    if (!document.querySelector<HTMLElement>('#overviewModal')?.hidden) renderOverview()
    completingTasks.delete(taskId)
    showToast('已标记为今日无需完成')
  }, 160)
}

function triggerHaptic(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    // Haptics are unavailable in some browsers, especially iOS Safari.
  }
}

function restoreTask(taskId: string): void {
  const task = data.tasks.find((item) => item.id === taskId)
  if (!task) return
  task.status = 'active'
  task.statusAt = null
  persist()
  hideModal('taskModal')
  highlightedTaskId = task.id
  render()
  scheduleHighlightClear(task.id)
  if (!document.querySelector<HTMLElement>('#overviewModal')?.hidden) renderOverview()
  showToast('已恢复为待完成')
}

function deleteTask(taskId: string): void {
  const index = data.tasks.findIndex((item) => item.id === taskId)
  if (index === -1) return
  const [task] = data.tasks.splice(index, 1)
  const series = data.series.find((item) => item.id === task.seriesId)
  const addedException = series && !series.exceptions.includes(task.dueDate)
  if (addedException) series.exceptions.push(task.dueDate)
  persist()
  hideModal('taskModal')
  render()
  if (!document.querySelector<HTMLElement>('#overviewModal')?.hidden) renderOverview()
  offerTaskUndo('已删除', task.title, () => {
    if (data.tasks.some((item) => item.id === task.id)) return
    if (series && data.series.includes(series)) {
      if (addedException) series.exceptions = series.exceptions.filter((date) => date !== task.dueDate)
    } else if (task.seriesId) {
      delete task.seriesId
    }
    data.tasks.splice(index, 0, task)
    saveUndoResult('已恢复清单')
  })
}

const undoWindowMs = 3000
const pendingTaskUndos = new Map<string, {
  expiresAt: number
  timer: number
  row: HTMLElement
  restore: () => void
}>()

function offerTaskUndo(message: string, title: string, restore: () => void): void {
  const stack = document.querySelector<HTMLElement>('#undoStack')
  if (!stack) return
  const id = newId()
  const row = document.createElement('div')
  row.className = 'undo-bar'
  row.innerHTML = `
    <span role="status" title="${escapeHtml(title)}">${escapeHtml(message)} · ${escapeHtml(title)}</span>
    <button type="button" data-action="undo-task" data-id="${id}" aria-label="3 秒内撤回：${escapeHtml(title)}">撤回</button>
    <i aria-hidden="true"></i>
  `
  const expiresAt = performance.now() + undoWindowMs
  const timer = window.setTimeout(() => clearTaskUndo(id), undoWindowMs)
  pendingTaskUndos.set(id, { expiresAt, timer, row, restore })
  stack.append(row)
}

function clearTaskUndo(id: string): void {
  const undo = pendingTaskUndos.get(id)
  if (!undo) return
  window.clearTimeout(undo.timer)
  undo.row.remove()
  pendingTaskUndos.delete(id)
}

function undoTaskAction(id: string): void {
  const undo = pendingTaskUndos.get(id)
  clearTaskUndo(id)
  if (undo && performance.now() < undo.expiresAt) undo.restore()
}

function saveUndoResult(message: string): void {
  persist()
  render()
  if (!document.querySelector<HTMLElement>('#overviewModal')?.hidden) renderOverview()
  showToast(message)
}

function stopSeries(taskId: string): void {
  const task = data.tasks.find((item) => item.id === taskId)
  const series = task?.seriesId ? data.series.find((item) => item.id === task.seriesId) : undefined
  if (!task || !series) return
  const pendingCount = data.tasks.filter(
    (item) => item.seriesId === series.id && item.status === 'active'
  ).length
  data.tasks = data.tasks.filter(
    (item) => item.seriesId !== series.id || item.status !== 'active'
  )
  data.series = data.series.filter((item) => item.id !== series.id)
  persist()
  hideModal('taskModal')
  render()
  if (!document.querySelector<HTMLElement>('#overviewModal')?.hidden) renderOverview()
  showToast(`重复系列已停止 · 移除 ${pendingCount} 条未完成清单`)
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
          ? 'var(--accent)'
          : ratio >= 0.6
            ? 'var(--accent-2)'
            : ratio > 0
              ? 'var(--accent-3)'
              : 'color-mix(in srgb, var(--accent-3) 46%, var(--glass-line))'
    return { ...day, height, color }
  })
}

function scheduleHighlightClear(taskId: string): void {
  if (highlightTimer) window.clearTimeout(highlightTimer)
  highlightTimer = window.setTimeout(() => {
    document
      .querySelector<HTMLElement>(`.task-row[data-task-id="${cssEscape(taskId)}"]`)
      ?.classList.remove('is-highlighted')
    if (highlightedTaskId === taskId) highlightedTaskId = null
  }, 820)
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
  const wasHidden = modal.hidden
  modal.hidden = false
  void modal.offsetWidth
  modal.classList.add('is-open')
  document.body.classList.add('modal-open')
  if (wasHidden && !modalHistory.includes(id)) {
    modalHistory.push(id)
    history.pushState({ ...history.state, daylineModal: id }, '', location.href)
  }
}

function hideModal(id: string, fromPopstate = false): void {
  const modal = document.getElementById(id)
  if (!modal) return
  const wasOpen = !modal.hidden
  modal.classList.remove('is-open')
  const index = modalHistory.lastIndexOf(id)
  if (index >= 0) modalHistory.splice(index, 1)
  if (
    wasOpen &&
    !fromPopstate &&
    history.state?.daylineModal === id &&
    index === modalHistory.length
  ) {
    suppressedPopstates += 1
    history.back()
  }
  window.setTimeout(() => {
    modal.hidden = true
    if (!document.querySelector('.modal-layer:not([hidden])')) document.body.classList.remove('modal-open')
  }, 180)
}

function handleModalBack(): void {
  if (suppressedPopstates > 0) {
    suppressedPopstates -= 1
    return
  }
  const openModal = [...document.querySelectorAll<HTMLElement>('.modal-layer:not([hidden])')].at(-1)
  if (openModal?.id) hideModal(openModal.id, true)
}

let toastHideTimer: number | undefined

function showToast(message: string, celebrate = false): void {
  const toast = document.querySelector<HTMLElement>('#toast')
  if (!toast) return
  window.clearTimeout(toastHideTimer)
  toast.classList.toggle('is-celebration', celebrate)
  toast.innerHTML = `
    <span class="toast-icon" aria-hidden="true">${celebrate ? icons.check : icons.summary}</span>
    <span class="toast-message">${escapeHtml(message)}</span>
  `
  toast.hidden = false
  requestAnimationFrame(() => toast.classList.add('is-visible'))
  if (toastTimer) window.clearTimeout(toastTimer)
  toastTimer = window.setTimeout(hideToast, 2400)
}

function hideToast(): void {
  const toast = document.querySelector<HTMLElement>('#toast')
  if (!toast) return
  toast.classList.remove('is-visible')
  toastHideTimer = window.setTimeout(() => {
    toast.hidden = true
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

function compactDateLabel(date: string): string {
  const dateValue = new Date(`${date}T12:00:00`)
  const sameYear = dateValue.getFullYear() === new Date().getFullYear()
  return new Intl.DateTimeFormat('zh-CN', sameYear ? { month: 'numeric', day: 'numeric' } : { year: 'numeric', month: 'numeric', day: 'numeric' }).format(
    dateValue
  )
}

function cssEscape(value: string): string {
  return typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(value) : value
}
