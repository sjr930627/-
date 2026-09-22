import { computeDailyAttendance } from '@/services/attendance'
import {
  getEmployeeAttendanceGroup,
  isFreeClockInOnly,
  isFreePunchGroup,
  isNoPunchGroup,
} from '@/composables/useMiniPunch'
import type { useAppStore } from '@/stores/app'
import type { AttendanceStatus, ScheduleAssignment, Shift } from '@/types'

type Store = ReturnType<typeof useAppStore>

export type DayPreviewState =
  | 'upcoming'
  | 'normal'
  | 'missing_punch'
  | 'absent'
  | 'late'
  | 'early_leave'
  | 'rest'
  | 'leave'

export type PunchStatusTone = 'muted' | 'ok' | 'warn'

const SHIFT_STATUS_LABEL: Record<DayPreviewState, string> = {
  upcoming: '待上岗',
  normal: '正常',
  missing_punch: '缺卡',
  absent: '缺勤',
  late: '迟到',
  early_leave: '早退',
  rest: '休息',
  leave: '请假',
}

export interface DayPreviewItem {
  date: string
  weekday: string
  dayNum: string
  shiftName: string
  timeRange: string
  state: DayPreviewState
  stateLabel: string
  shiftColor: string
  isToday: boolean
}

export interface DayScheduleDetail {
  date: string
  weekday: string
  assignment: ScheduleAssignment | null
  shift: Shift | null
  teamName: string
  state: DayPreviewState
  stateLabel: string
  clockIn?: string
  clockOut?: string
  workedMinutes: number
  remainingMinutes: number
  estimatedPay: number
  hourlyRate: number
  location: string
  /** 自由打卡（无班次）日 */
  freePunch?: boolean
  freePunchLabel?: string
  freeClockInOnly?: boolean
  goalMinutes?: number
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

function parseTimeMinutes(time: string) {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function shiftWorkMinutes(shift: Shift) {
  if (shift.id === 'shift_rest') return 0
  let start = parseTimeMinutes(shift.startTime)
  let end = parseTimeMinutes(shift.endTime)
  if (end <= start) end += 24 * 60
  return Math.max(0, end - start - shift.breakMinutes)
}

export function getHourlyRate(store: Store, employeeId: string) {
  const team = store.teams.find((t) => t.memberIds.includes(employeeId))
  return team?.hourlyRate ?? store.payrollConfig.defaultHourlyRate ?? 25
}

function labeled(state: DayPreviewState) {
  return { state, stateLabel: SHIFT_STATUS_LABEL[state] }
}

function shiftHasEnded(shift: Shift, now: Date) {
  let start = parseTimeMinutes(shift.startTime)
  let end = parseTimeMinutes(shift.endTime)
  if (end <= start) end += 24 * 60
  let nowMin = now.getHours() * 60 + now.getMinutes()
  if (end > 24 * 60 && nowMin < start) nowMin += 24 * 60
  return nowMin >= end
}

function isLateClockIn(shift: Shift, clockInTime: string, flexMinutesAfter: number) {
  const start = parseTimeMinutes(shift.startTime)
  const inMin = parseTimeMinutes(clockInTime)
  return inMin > start + flexMinutesAfter
}

function fromSettledAttendance(status: AttendanceStatus): DayPreviewState {
  if (status === 'late') return 'late'
  if (status === 'early_leave') return 'early_leave'
  if (status === 'missing_punch') return 'missing_punch'
  if (status === 'absent') return 'absent'
  if (status === 'leave') return 'leave'
  if (status === 'rest') return 'rest'
  return 'normal'
}

export function resolveDayState(
  store: Store,
  employeeId: string,
  date: string,
  today: string,
  now: Date,
): { state: DayPreviewState; stateLabel: string } {
  const asn = store.getAssignment(employeeId, date)
  const shift = asn ? store.shifts.find((s) => s.id === asn.shiftId) : null
  const group = getEmployeeAttendanceGroup(store, employeeId)
  const freePunch = isFreePunchGroup(group)
  const noPunch = isNoPunchGroup(group)

  if ((!shift || shift.id === 'shift_rest' || shift.code === 'REST') && freePunch) {
    if (date > today) return labeled('upcoming')
    const punches = store.punches.filter((p) => p.employeeId === employeeId && p.date === date)
    const hasIn = punches.some((p) => p.type === 'clock_in')
    const hasOut = punches.some((p) => p.type === 'clock_out')
    const clockInOnly = isFreeClockInOnly(group)
    if (!hasIn) {
      if (date < today) return labeled('rest')
      return labeled('upcoming')
    }
    if (clockInOnly || hasOut) return labeled('normal')
    return labeled('normal')
  }

  if (!shift || shift.id === 'shift_rest' || shift.code === 'REST' || noPunch) {
    return labeled('rest')
  }

  if (date > today) return labeled('upcoming')

  const day = computeDailyAttendance(
    employeeId,
    date,
    store.assignments,
    store.shifts,
    store.punches,
    store.leaveRequests,
    store.attendanceRule,
    store.manualOverrides[`${employeeId}_${date}`],
  )

  if (day.status === 'leave') return labeled('leave')
  if (day.status === 'rest') return labeled('rest')

  const hasIn = Boolean(day.clockIn)
  const hasOut = Boolean(day.clockOut)
  const ended = date < today || shiftHasEnded(shift, now)

  if (!ended && !hasOut) {
    if (!hasIn) return labeled('upcoming')
    if (isLateClockIn(shift, day.clockIn!, store.attendanceRule.flexMinutesAfter)) {
      return labeled('late')
    }
    return labeled('normal')
  }

  return labeled(fromSettledAttendance(day.status))
}

export function resolvePunchStatus(
  shift: Shift | null | undefined,
  clockInTime?: string,
  clockOutTime?: string,
  options?: { freePunch?: boolean; noPunch?: boolean },
): { text: string; tone: PunchStatusTone } {
  if (clockOutTime) return { text: '已签退', tone: 'muted' }
  if (clockInTime) return { text: `已签到 · ${clockInTime.slice(0, 5)}`, tone: 'ok' }
  if (options?.freePunch) return { text: '未打卡', tone: 'warn' }
  if (options?.noPunch) return { text: '无需打卡', tone: 'muted' }
  const noShift = !shift || shift.id === 'shift_rest' || shift.code === 'REST'
  if (noShift) return { text: '无需打卡', tone: 'muted' }
  return { text: '未打卡', tone: 'warn' }
}

export function buildWeekPreview(
  store: Store,
  employeeId: string,
  anchor: Date,
): DayPreviewItem[] {
  const today = localDateStr(anchor)
  const day = anchor.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  const monday = new Date(anchor)
  monday.setDate(anchor.getDate() + mondayOffset)

  const items: DayPreviewItem[] = []
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const date = localDateStr(d)
    const asn = store.getAssignment(employeeId, date)
    const shift = asn ? store.shifts.find((s) => s.id === asn.shiftId) : null
    const { state, stateLabel } = resolveDayState(store, employeeId, date, today, anchor)
    const group = getEmployeeAttendanceGroup(store, employeeId)
    const freePunch = isFreePunchGroup(group) && (!shift || shift.id === 'shift_rest')
    const isRest = freePunch ? false : !shift || shift.id === 'shift_rest'
    const cfg = group?.freePunchConfig
    items.push({
      date,
      weekday: WEEKDAYS[d.getDay()],
      dayNum: `${d.getMonth() + 1}/${d.getDate()}`,
      shiftName: freePunch ? '自由打卡' : isRest ? '无班次' : shift!.name,
      timeRange: freePunch
        ? cfg
          ? `${cfg.startTime.slice(0, 5).replace(':', '')}-${cfg.endTime.slice(0, 5).replace(':', '')}`
          : '弹性'
        : isRest
          ? '—'
          : `${shift!.startTime.slice(0, 5).replace(':', '')}-${shift!.endTime.slice(0, 5).replace(':', '')}`,
      state,
      stateLabel: state === 'rest' ? '无班次' : stateLabel,
      shiftColor: freePunch ? '#409EFF' : shift?.color ?? '#d9d9d9',
      isToday: date === today,
    })
  }
  return items
}

export function calcWorkedMinutes(
  employeeId: string,
  date: string,
  punches: { employeeId: string; date: string; time: string; type: string }[],
  now: Date,
) {
  const dayPunches = punches
    .filter((p) => p.employeeId === employeeId && p.date === date)
    .sort((a, b) => a.time.localeCompare(b.time))
  const clockIn = dayPunches.find((p) => p.type === 'clock_in')
  const clockOut = dayPunches.find((p) => p.type === 'clock_out')
  if (!clockIn) return 0
  const [ih, im] = clockIn.time.split(':').map(Number)
  const inMin = ih * 60 + im
  if (clockOut) {
    const [oh, om] = clockOut.time.split(':').map(Number)
    return Math.max(0, oh * 60 + om - inMin)
  }
  if (date !== localDateStr(now)) return 0
  return Math.max(0, now.getHours() * 60 + now.getMinutes() - inMin)
}

export function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h <= 0) return `${m}分钟`
  if (m === 0) return `${h}小时`
  return `${h}小时${m}分`
}

export function buildDayDetail(
  store: Store,
  employeeId: string,
  date: string,
  now: Date,
): DayScheduleDetail {
  const today = localDateStr(now)
  const d = new Date(date + 'T12:00:00')
  const asn = store.getAssignment(employeeId, date)
  const shift = asn ? store.shifts.find((s) => s.id === asn.shiftId) ?? null : null
  const team = asn?.teamId ? store.teams.find((t) => t.id === asn.teamId) : null
  const group = getEmployeeAttendanceGroup(store, employeeId)
  const freePunch =
    isFreePunchGroup(group) && (!shift || shift.id === 'shift_rest' || shift.code === 'REST')
  const freeClockInOnly = freePunch && isFreeClockInOnly(group)
  const cfg = group?.freePunchConfig
  const freePunchLabel = freePunch
    ? cfg
      ? `自由打卡 · ${cfg.startTime.slice(0, 5)}-${cfg.endTime.slice(0, 5)}`
      : '自由打卡 · 无班次'
    : undefined
  const hourlyRate = getHourlyRate(store, employeeId)
  const { state, stateLabel } = resolveDayState(store, employeeId, date, today, now)
  const punches = store.punches.filter((p) => p.employeeId === employeeId && p.date === date)
  const clockIn = punches.find((p) => p.type === 'clock_in')?.time
  const clockOut = punches.find((p) => p.type === 'clock_out')?.time
  const goalMinutes = freePunch
    ? Math.max(1, cfg?.defaultWorkHours ?? 8) * 60
    : shift
      ? shiftWorkMinutes(shift)
      : 0
  const workedMinutes = calcWorkedMinutes(employeeId, date, store.punches, now)
  const remainingMinutes = Math.max(0, goalMinutes - workedMinutes)
  const estimatedPay =
    goalMinutes > 0
      ? Math.round(((goalMinutes / 60) * hourlyRate) * 100) / 100
      : 0
  const teamName =
    team?.name ??
    (freePunch
      ? store.teams.find((t) => t.memberIds.includes(employeeId))?.name ?? '外勤推广组'
      : '中国移动朝阳营业厅班组')

  return {
    date,
    weekday: WEEKDAYS[d.getDay()],
    assignment: asn ?? null,
    shift,
    teamName,
    state,
    stateLabel,
    clockIn,
    clockOut,
    workedMinutes,
    remainingMinutes,
    estimatedPay,
    hourlyRate,
    location: freePunch
      ? '不限固定点位 · 按打卡范围核算'
      : '北京 · 朝阳区 · 中国移动朝阳营业厅',
    freePunch,
    freePunchLabel,
    freeClockInOnly,
    goalMinutes,
  }
}

export function getMonthStats(
  store: Store,
  employeeId: string,
  year: number,
  month: number,
) {
  const prefix = `${year}-${String(month).padStart(2, '0')}`
  const assignments = store.assignments.filter(
    (a) => a.employeeId === employeeId && a.date.startsWith(prefix),
  )
  let days = 0
  let totalMinutes = 0
  let totalPay = 0
  const hourlyRate = getHourlyRate(store, employeeId)
  for (const asn of assignments) {
    const shift = store.shifts.find((s) => s.id === asn.shiftId)
    if (!shift || shift.id === 'shift_rest') continue
    days += 1
    const mins = shiftWorkMinutes(shift)
    totalMinutes += mins
    totalPay += (mins / 60) * hourlyRate
  }
  return {
    days,
    totalHours: Math.round((totalMinutes / 60) * 10) / 10,
    totalPay: Math.round(totalPay),
  }
}

export function getCalendarCells(year: number, month: number) {
  const first = new Date(year, month - 1, 1)
  const last = new Date(year, month, 0)
  const startPad = first.getDay()
  const cells: { date: string | null; day: number | null }[] = []
  for (let i = 0; i < startPad; i++) cells.push({ date: null, day: null })
  for (let d = 1; d <= last.getDate(); d++) {
    const date = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    cells.push({ date, day: d })
  }
  return cells
}

/** 以周日为一周起点，返回锚点日期所在周的 7 天 */
export function getWeekCalendarCells(anchorDate: string) {
  const anchor = new Date(anchorDate + 'T12:00:00')
  const sunday = new Date(anchor)
  sunday.setDate(anchor.getDate() - anchor.getDay())
  const cells: { date: string; day: number }[] = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(sunday)
    d.setDate(sunday.getDate() + i)
    cells.push({ date: localDateStr(d), day: d.getDate() })
  }
  return cells
}

export function formatTodayLabel(date: Date) {
  const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d} ${WEEKDAYS[date.getDay()]}`
}

export function formatHoursDecimal(minutes: number) {
  const h = Math.round((minutes / 60) * 10) / 10
  return `${h.toFixed(1)} 小时`
}

export function formatHoursShort(minutes: number) {
  const h = Math.round((minutes / 60) * 10) / 10
  return `${h}h`
}

function localDateStr(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getMonday(d: Date) {
  const day = d.getDay()
  const mondayOffset = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setDate(d.getDate() + mondayOffset)
  return monday
}

export function formatWeekRange(anchor: Date) {
  const monday = getMonday(anchor)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const fmt = (dt: Date) => `${dt.getMonth() + 1}月${dt.getDate()}日`
  return `${fmt(monday)} - ${fmt(sunday)}`
}

export type WeekDayState = 'done' | 'today' | 'future' | 'missed' | 'rest'

export interface WeekDayItem {
  date: string
  weekdayShort: string
  dayNum: number
  state: WeekDayState
  isToday: boolean
}

export function buildWeekAttendance(
  store: Store,
  employeeId: string,
  anchor: Date,
): WeekDayItem[] {
  const today = localDateStr(anchor)
  const monday = getMonday(anchor)
  const weekdayShort = ['日', '一', '二', '三', '四', '五', '六']
  const items: WeekDayItem[] = []

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    const date = localDateStr(d)
    const isToday = date === today
    const asn = store.getAssignment(employeeId, date)
    const shift = asn ? store.shifts.find((s) => s.id === asn.shiftId) : null
    const group = getEmployeeAttendanceGroup(store, employeeId)
    const freePunch =
      isFreePunchGroup(group) && (!shift || shift.id === 'shift_rest')
    const isRest = freePunch ? false : !shift || shift.id === 'shift_rest'
    const punches = store.punches.filter((p) => p.employeeId === employeeId && p.date === date)
    const hasIn = punches.some((p) => p.type === 'clock_in')
    const hasOut = punches.some((p) => p.type === 'clock_out')
    const clockInOnly = freePunch && isFreeClockInOnly(group)

    let state: WeekDayState
    if (isRest) {
      state = 'rest'
    } else if (date > today) {
      state = 'future'
    } else if (isToday) {
      state = 'today'
    } else if (hasIn && (clockInOnly || hasOut)) {
      state = 'done'
    } else {
      state = freePunch && !hasIn ? 'rest' : 'missed'
    }

    items.push({
      date,
      weekdayShort: weekdayShort[d.getDay()],
      dayNum: d.getDate(),
      state,
      isToday,
    })
  }
  return items
}

export function sumWorkedMinutesInRange(
  employeeId: string,
  punches: { employeeId: string; date: string; time: string; type: string }[],
  startDate: string,
  endDate: string,
  now: Date,
) {
  let total = 0
  const start = new Date(startDate + 'T00:00:00')
  const end = new Date(endDate + 'T00:00:00')
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const date = localDateStr(d)
    total += calcWorkedMinutes(employeeId, date, punches, now)
  }
  return total
}

export function countAttendanceDays(
  employeeId: string,
  punches: { employeeId: string; date: string; type: string }[],
  startDate: string,
  endDate: string,
) {
  const dates = new Set<string>()
  for (const p of punches) {
    if (p.employeeId !== employeeId || p.type !== 'clock_in') continue
    if (p.date < startDate || p.date > endDate) continue
    dates.add(p.date)
  }
  return dates.size
}

export interface PunchRecordItem {
  date: string
  relativeLabel: string
  dateLabel: string
  clockIn: string
  clockOut: string
  statusLabel: string
  statusType: 'normal' | 'missing_punch' | 'absent' | 'late' | 'early_leave'
  workedHours: string
}

const HISTORY_STATUS: ReadonlySet<PunchRecordItem['statusType']> = new Set([
  'normal',
  'missing_punch',
  'absent',
  'late',
  'early_leave',
])

export function buildRecentPunchRecords(
  store: Store,
  employeeId: string,
  anchor: Date,
  limit = 5,
): PunchRecordItem[] {
  const today = localDateStr(anchor)
  const weekdayFull = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  const items: PunchRecordItem[] = []
  const maxLookback = Math.max(limit * 4, 90)

  for (let i = 0; i < maxLookback && items.length < limit; i++) {
    const d = new Date(anchor)
    d.setDate(anchor.getDate() - i)
    const date = localDateStr(d)
    const asn = store.getAssignment(employeeId, date)
    const shift = asn ? store.shifts.find((s) => s.id === asn.shiftId) : null
    const isRestShift = !shift || shift.id === 'shift_rest'
    const punches = store.punches.filter((p) => p.employeeId === employeeId && p.date === date)
    const clockIn = punches.find((p) => p.type === 'clock_in')?.time.slice(0, 5) ?? '--:--'
    const clockOut = punches.find((p) => p.type === 'clock_out')?.time.slice(0, 5) ?? '--:--'
    const workedMin = calcWorkedMinutes(employeeId, date, store.punches, anchor)
    const hasIn = punches.some((p) => p.type === 'clock_in')
    const hasOut = punches.some((p) => p.type === 'clock_out')

    // 休息日且无打卡：不进入历史列表
    if (isRestShift && !hasIn && !hasOut) continue

    const { state, stateLabel } = resolveDayState(store, employeeId, date, today, anchor)
    // 仅展示：正常 / 缺卡 / 缺勤 / 迟到 / 早退
    if (!HISTORY_STATUS.has(state as PunchRecordItem['statusType'])) continue

    let relativeLabel = ''
    if (i === 0) relativeLabel = '今天'
    else if (i === 1) relativeLabel = '昨天'
    else if (i === 2) relativeLabel = '前天'
    else relativeLabel = `${d.getMonth() + 1}月${d.getDate()}日`

    items.push({
      date,
      relativeLabel,
      dateLabel: `${d.getMonth() + 1}月${d.getDate()}日 ${weekdayFull[d.getDay()]}`,
      clockIn,
      clockOut,
      statusLabel: stateLabel,
      statusType: state as PunchRecordItem['statusType'],
      workedHours: formatHoursShort(workedMin),
    })
  }
  return items
}
