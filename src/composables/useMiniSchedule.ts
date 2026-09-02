import type { useAppStore } from '@/stores/app'
import type { ScheduleAssignment, Shift } from '@/types'

type Store = ReturnType<typeof useAppStore>

export type DayPreviewState = 'done' | 'absent' | 'active' | 'rest' | 'upcoming'

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

export function resolveDayState(
  store: Store,
  employeeId: string,
  date: string,
  today: string,
  now: Date,
): { state: DayPreviewState; stateLabel: string } {
  const asn = store.getAssignment(employeeId, date)
  const shift = asn ? store.shifts.find((s) => s.id === asn.shiftId) : null
  if (!shift || shift.id === 'shift_rest') {
    return { state: 'rest', stateLabel: '休息' }
  }

  const punches = store.punches.filter((p) => p.employeeId === employeeId && p.date === date)
  const hasIn = punches.some((p) => p.type === 'clock_in')
  const hasOut = punches.some((p) => p.type === 'clock_out')

  if (date < today) {
    if (hasIn && hasOut) return { state: 'done', stateLabel: '已签退' }
    if (!hasIn) return { state: 'absent', stateLabel: '缺勤' }
    return { state: 'absent', stateLabel: '缺勤' }
  }

  if (date === today) {
    if (hasIn && hasOut) return { state: 'done', stateLabel: '已签退' }
    if (hasIn) return { state: 'active', stateLabel: '进行中' }
    const startMin = parseTimeMinutes(shift.startTime)
    const nowMin = now.getHours() * 60 + now.getMinutes()
    if (nowMin >= startMin) return { state: 'active', stateLabel: '进行中' }
    return { state: 'upcoming', stateLabel: '待上岗' }
  }

  return { state: 'upcoming', stateLabel: '待上岗' }
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
    const isRest = !shift || shift.id === 'shift_rest'
    items.push({
      date,
      weekday: WEEKDAYS[d.getDay()],
      dayNum: `${d.getMonth() + 1}/${d.getDate()}`,
      shiftName: isRest ? '休息' : shift!.name,
      timeRange: isRest ? '—' : `${shift!.startTime.slice(0, 5).replace(':', '')}-${shift!.endTime.slice(0, 5).replace(':', '')}`,
      state,
      stateLabel,
      shiftColor: shift?.color ?? '#d9d9d9',
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
  if (clockOut) {
    const [oh, om] = clockOut.time.split(':').map(Number)
    return Math.max(0, oh * 60 + om - (ih * 60 + im))
  }
  return Math.max(0, now.getHours() * 60 + now.getMinutes() - (ih * 60 + im))
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
  const today = now.toISOString().slice(0, 10)
  const d = new Date(date + 'T12:00:00')
  const asn = store.getAssignment(employeeId, date)
  const shift = asn ? store.shifts.find((s) => s.id === asn.shiftId) ?? null : null
  const team = asn?.teamId ? store.teams.find((t) => t.id === asn.teamId) : null
  const hourlyRate = getHourlyRate(store, employeeId)
  const { state, stateLabel } = resolveDayState(store, employeeId, date, today, now)
  const punches = store.punches.filter((p) => p.employeeId === employeeId && p.date === date)
  const clockIn = punches.find((p) => p.type === 'clock_in')?.time
  const clockOut = punches.find((p) => p.type === 'clock_out')?.time
  const totalMin = shift ? shiftWorkMinutes(shift) : 0
  const workedMinutes = calcWorkedMinutes(employeeId, date, store.punches, now)
  const remainingMinutes = Math.max(0, totalMin - workedMinutes)
  const estimatedPay =
    totalMin > 0
      ? Math.round(((totalMin / 60) * hourlyRate) * 100) / 100
      : 0

  return {
    date,
    weekday: WEEKDAYS[d.getDay()],
    assignment: asn ?? null,
    shift,
    teamName: team?.name ?? '中国移动朝阳营业厅班组',
    state,
    stateLabel,
    clockIn,
    clockOut,
    workedMinutes,
    remainingMinutes,
    estimatedPay,
    hourlyRate,
    location: '北京 · 朝阳区 · 中国移动朝阳营业厅',
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

export function shiftBarColor(shiftId: string | undefined) {
  const map: Record<string, string> = {
    shift_morning: '#409EFF',
    shift_afternoon: '#E6A23C',
    shift_night: '#9B59B6',
    shift_rest: '#d9d9d9',
  }
  return shiftId ? map[shiftId] ?? '#409EFF' : 'transparent'
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
    const isRest = !shift || shift.id === 'shift_rest'
    const punches = store.punches.filter((p) => p.employeeId === employeeId && p.date === date)
    const hasIn = punches.some((p) => p.type === 'clock_in')
    const hasOut = punches.some((p) => p.type === 'clock_out')

    let state: WeekDayState
    if (isRest) {
      state = 'rest'
    } else if (date > today) {
      state = 'future'
    } else if (isToday) {
      state = 'today'
    } else if (hasIn && hasOut) {
      state = 'done'
    } else {
      state = 'missed'
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

export function countConsecutivePunchDays(
  employeeId: string,
  punches: { employeeId: string; date: string; type: string }[],
  today: string,
) {
  let count = 0
  const d = new Date(today + 'T12:00:00')
  while (true) {
    const date = localDateStr(d)
    const hasIn = punches.some((p) => p.employeeId === employeeId && p.date === date && p.type === 'clock_in')
    if (!hasIn) break
    count += 1
    d.setDate(d.getDate() - 1)
  }
  return count
}

export interface PunchRecordItem {
  date: string
  relativeLabel: string
  dateLabel: string
  clockIn: string
  clockOut: string
  statusLabel: string
  statusType: 'online' | 'hours' | 'rest' | 'pending'
  workedHours: string
}

export function buildRecentPunchRecords(
  store: Store,
  employeeId: string,
  anchor: Date,
  limit = 5,
): PunchRecordItem[] {
  const today = localDateStr(anchor)
  const weekdayFull = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  const items: PunchRecordItem[] = []

  for (let i = 0; i < limit; i++) {
    const d = new Date(anchor)
    d.setDate(anchor.getDate() - i)
    const date = localDateStr(d)
    const asn = store.getAssignment(employeeId, date)
    const shift = asn ? store.shifts.find((s) => s.id === asn.shiftId) : null
    const isRest = !shift || shift.id === 'shift_rest'
    const punches = store.punches.filter((p) => p.employeeId === employeeId && p.date === date)
    const clockIn = punches.find((p) => p.type === 'clock_in')?.time.slice(0, 5) ?? '--:--'
    const clockOut = punches.find((p) => p.type === 'clock_out')?.time.slice(0, 5) ?? '--:--'
    const workedMin = calcWorkedMinutes(employeeId, date, store.punches, anchor)
    const hasIn = punches.some((p) => p.type === 'clock_in')
    const hasOut = punches.some((p) => p.type === 'clock_out')

    let relativeLabel = ''
    if (i === 0) relativeLabel = '今天'
    else if (i === 1) relativeLabel = '昨天'
    else if (i === 2) relativeLabel = '前天'
    else relativeLabel = `${d.getMonth() + 1}月${d.getDate()}日`

    let statusLabel = ''
    let statusType: PunchRecordItem['statusType'] = 'pending'
    if (isRest) {
      statusLabel = '休息'
      statusType = 'rest'
    } else if (date === today && hasIn && !hasOut) {
      statusLabel = '在线中'
      statusType = 'online'
    } else if (workedMin > 0) {
      statusLabel = formatHoursShort(workedMin)
      statusType = 'hours'
    } else if (!hasIn) {
      statusLabel = '未打卡'
      statusType = 'pending'
    } else {
      statusLabel = formatHoursShort(workedMin)
      statusType = 'hours'
    }

    items.push({
      date,
      relativeLabel,
      dateLabel: `${d.getMonth() + 1}月${d.getDate()}日 ${weekdayFull[d.getDay()]}`,
      clockIn,
      clockOut,
      statusLabel,
      statusType,
      workedHours: formatHoursShort(workedMin),
    })
  }
  return items
}
