import type {
  AttendanceDaily,
  AttendanceException,
  AttendanceManualAdjustment,
  AttendanceMonthlySummary,
  AttendancePunch,
  AttendanceRule,
  AttendanceStatus,
  Employee,
  GrabShiftSlot,
  LeaveRequest,
  PunchType,
  ScheduleAssignment,
  Shift,
} from '@/types'
import { calcShiftHours, getMonthDays } from '@/utils'
import { calcGrabShiftWorkHours, resolveGrabSlotShiftName } from '@/services/grabShift'

/** 考勤数据/审批按排班或抢班拆分的数据来源 */
export type AttendanceAssignmentSource = 'schedule' | 'grab'

export function isGrabAssignment(
  assignment?: Pick<ScheduleAssignment, 'fromGrabSlotId'> | null,
): boolean {
  return Boolean(assignment?.fromGrabSlotId)
}

export function filterAssignmentsBySource(
  assignments: ScheduleAssignment[],
  source: AttendanceAssignmentSource = 'schedule',
): ScheduleAssignment[] {
  return assignments.filter((a) =>
    source === 'grab' ? isGrabAssignment(a) : !isGrabAssignment(a),
  )
}

export function assignmentMatchesSource(
  assignment: ScheduleAssignment | undefined | null,
  source: AttendanceAssignmentSource,
): boolean {
  if (!assignment) return false
  return source === 'grab' ? isGrabAssignment(assignment) : !isGrabAssignment(assignment)
}

const STATUS_LABELS: Record<AttendanceStatus, string> = {
  normal: '正常',
  late: '迟到',
  early_leave: '早退',
  missing_punch: '缺卡',
  absent: '旷工',
  rest: '休息',
  leave: '请假',
}

const EXCEPTION_LABELS: Record<AttendanceException['type'], string> = {
  late: '迟到',
  early_leave: '早退',
  missing_punch: '缺卡',
  absent: '旷工',
  location: '定位异常',
  schedule_conflict: '排班冲突',
}

export function getStatusLabel(status: AttendanceStatus): string {
  return STATUS_LABELS[status]
}

export function getExceptionLabel(type: AttendanceException['type']): string {
  return EXCEPTION_LABELS[type]
}

export function getStatusTagType(
  status: AttendanceStatus,
): 'success' | 'warning' | 'danger' | 'info' {
  if (status === 'normal') return 'success'
  if (status === 'rest' || status === 'leave') return 'info'
  if (status === 'late' || status === 'early_leave' || status === 'missing_punch') return 'warning'
  return 'danger'
}

export function isDailyAttendanceVisible(day: AttendanceDaily): boolean {
  return day.scheduledHours > 0
}

/** 未确认工时均可矫正（不限当天、不限异常状态）；已确认不可再矫正 */
export function canCorrectWorkHours(
  dayOrStatus: AttendanceDaily | AttendanceStatus,
): boolean {
  if (typeof dayOrStatus === 'object') {
    if (dayOrStatus.hoursConfirmed) return false
    if (dayOrStatus.scheduledHours <= 0) return false
    if (dayOrStatus.status === 'leave' || dayOrStatus.status === 'rest') return false
    return true
  }
  return dayOrStatus !== 'leave' && dayOrStatus !== 'rest'
}

export function canConfirmWorkHours(day: AttendanceDaily): boolean {
  if (day.scheduledHours <= 0) return false
  if (day.status === 'leave' || day.status === 'rest') return false
  return !day.hoursConfirmed
}

function formatHoursNumber(hours: number): string {
  const n = Math.round(Number(hours) * 10) / 10
  return Number.isInteger(n) ? String(n) : n.toFixed(1)
}

/**
 * 确认工时取值：
 * - 已矫正：按矫正工时确认结算（可大于班次工时）
 * - 未矫正：用实际打卡工时；若大于班次/默认工时，则按班次工时封顶
 */
export function resolveConfirmWorkHours(day: {
  workHours: number
  scheduledHours: number
  actualPunchHours?: number
  workHoursCorrected?: boolean
}): number {
  if (day.workHoursCorrected) {
    return Math.round(Math.max(0, day.workHours) * 10) / 10
  }
  const raw = day.actualPunchHours ?? day.workHours
  const scheduled = Math.max(0, day.scheduledHours)
  const capped = Math.min(Math.max(0, raw), scheduled || raw)
  return Math.round(capped * 10) / 10
}

/**
 * 日考勤工时展示：
 * - 未确认：待确认工时（默认=实际打卡封顶班次；已矫正=矫正工时，可超班次）
 * - 已确认：确认工时
 */
export function formatDailyWorkHoursText(day: {
  workHours: number
  hoursConfirmed?: boolean
  actualPunchHours?: number
}): string {
  return formatHoursNumber(day.workHours)
}

export function formatActualPunchHoursText(day: {
  actualPunchHours?: number
  workHours: number
}): string {
  return formatHoursNumber(day.actualPunchHours ?? day.workHours)
}

/** 抢班考勤「班次」列：班次名称（时间段）工时 */
export function formatGrabAttendanceShiftText(input: {
  name?: string
  startTime?: string
  endTime?: string
  workHours?: number
}): string {
  const name = input.name?.trim() || '—'
  const start = input.startTime?.slice(0, 5)
  const end = input.endTime?.slice(0, 5)
  const hoursText =
    input.workHours != null && !Number.isNaN(Number(input.workHours))
      ? formatHoursNumber(input.workHours)
      : ''
  if (start && end) {
    return hoursText ? `${name}（${start}-${end}）${hoursText}h` : `${name}（${start}-${end}）`
  }
  return hoursText ? `${name} ${hoursText}h` : name
}

/** 解析日考勤行的班次/排班展示文案与列名 */
export function resolveAttendanceShiftColumn(options: {
  source: AttendanceAssignmentSource
  shift?: Pick<Shift, 'name' | 'startTime' | 'endTime' | 'breakMinutes'> | null
  slot?: GrabShiftSlot | null
  scheduledHours?: number
}): { label: string; text: string } {
  if (options.source === 'grab') {
    const slot = options.slot
    const shift = options.shift
    const name = slot ? resolveGrabSlotShiftName(slot) : shift?.name || '—'
    const startTime = slot?.startTime ?? shift?.startTime
    const endTime = slot?.endTime ?? shift?.endTime
    const workHours =
      slot?.workHours ??
      (slot
        ? calcGrabShiftWorkHours(slot.startTime, slot.endTime, slot.breakMinutes)
        : options.scheduledHours)
    return {
      label: '班次',
      text: formatGrabAttendanceShiftText({ name, startTime, endTime, workHours }),
    }
  }
  return {
    label: '排班',
    text: options.shift?.name || '—',
  }
}

/** 实际工时相对排班：缺失 / 超时 */
export function getWorkHoursAnomaly(
  workHours: number,
  scheduledHours: number,
): { type: 'shortfall' | 'overtime'; diff: number } | null {
  const diff = Math.round((workHours - scheduledHours) * 10) / 10
  if (diff < -0.05) return { type: 'shortfall', diff: Math.abs(diff) }
  if (diff > 0.05) return { type: 'overtime', diff }
  return null
}

/** 确认工时时：工时不足提醒；无不足返回 null */
export function buildConfirmHoursWarning(
  items: { name?: string; workHours: number; scheduledHours: number }[],
): string | null {
  const parts: string[] = []
  items.forEach((item) => {
    if (item.workHours >= item.scheduledHours - 0.05) return
    const who = item.name?.trim()
    parts.push(who ? `${who}的工时不足` : '工时不足')
  })
  if (!parts.length) return null
  return `${parts.join('；')}，是否确认现在工时并结算？`
}

function applyManualAdjustment(
  day: AttendanceDaily,
  manualOverride?: AttendanceManualAdjustment,
): AttendanceDaily {
  if (!manualOverride) return day
  const next = { ...day }
  if (manualOverride.status) {
    next.status = manualOverride.status
    next.manualStatus = manualOverride.status
  }
  if (manualOverride.workHours !== undefined) {
    next.workHours = manualOverride.workHours
    // 仅真正矫正过才标记；确认时写入的工时不算矫正
    next.workHoursCorrected = Boolean(manualOverride.hoursCorrectedAt)
  }
  if (manualOverride.note) {
    next.manualNote = manualOverride.note
  }
  if (manualOverride.hoursConfirmed) {
    next.hoursConfirmed = true
    next.hoursConfirmedAt = manualOverride.hoursConfirmedAt
    next.hoursConfirmedBy = manualOverride.hoursConfirmedBy
  }
  if (manualOverride.hoursCorrectedAt) {
    next.hoursCorrectedAt = manualOverride.hoursCorrectedAt
    next.hoursCorrectedBy = manualOverride.hoursCorrectedBy
  }
  // 保留打卡算出的原始工时，不被矫正覆盖
  next.actualPunchHours = day.actualPunchHours ?? day.workHours
  return next
}

function parseMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function minutesToTime(minutes: number): string {
  const normalized = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60)
  const h = Math.floor(normalized / 60)
  const m = normalized % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function isOnLeave(leaveRequests: LeaveRequest[], employeeId: string, date: string): boolean {
  return leaveRequests.some(
    (r) =>
      r.status === 'approved' &&
      r.employeeId === employeeId &&
      date >= r.startDate &&
      date <= r.endDate,
  )
}

function getPunchesForDay(punches: AttendancePunch[], employeeId: string, date: string) {
  return punches
    .filter((p) => p.employeeId === employeeId && p.date === date)
    .sort((a, b) => a.time.localeCompare(b.time))
}

function withActualPunchHours(
  day: Omit<AttendanceDaily, 'actualPunchHours'> & { actualPunchHours?: number },
): AttendanceDaily {
  return {
    ...day,
    actualPunchHours: day.actualPunchHours ?? day.workHours,
  }
}

export function computeDailyAttendance(
  employeeId: string,
  date: string,
  assignments: ScheduleAssignment[],
  shifts: Shift[],
  punches: AttendancePunch[],
  leaveRequests: LeaveRequest[],
  rule: AttendanceRule,
  manualOverride?: AttendanceManualAdjustment,
): AttendanceDaily {
  const assignment = assignments.find((a) => a.employeeId === employeeId && a.date === date)
  const shift = assignment ? shifts.find((s) => s.id === assignment.shiftId) : undefined
  const scheduledHours = shift && shift.code !== 'REST' ? calcShiftHours(shift) : 0

  if (manualOverride?.status) {
    const dayPunches = getPunchesForDay(punches, employeeId, date)
    const punchHours = calcWorkHours(dayPunches, shift)
    return applyManualAdjustment(
      withActualPunchHours({
        employeeId,
        date,
        shiftId: shift?.id,
        status: manualOverride.status,
        clockIn: dayPunches.find((p) => p.type === 'clock_in')?.time,
        clockOut: dayPunches.find((p) => p.type === 'clock_out')?.time,
        workHours: punchHours,
        scheduledHours,
        manualStatus: manualOverride.status,
        manualNote: manualOverride.note,
      }),
      manualOverride,
    )
  }

  if (isOnLeave(leaveRequests, employeeId, date)) {
    return applyManualAdjustment(
      withActualPunchHours({
        employeeId,
        date,
        shiftId: shift?.id,
        status: 'leave',
        workHours: 0,
        scheduledHours,
      }),
      manualOverride,
    )
  }

  if (!shift || shift.code === 'REST') {
    return withActualPunchHours({
      employeeId,
      date,
      shiftId: shift?.id,
      status: 'rest',
      workHours: 0,
      scheduledHours: 0,
    })
  }

  const dayPunches = getPunchesForDay(punches, employeeId, date)
  const clockIn = dayPunches.find((p) => p.type === 'clock_in')
  const clockOut = dayPunches.find((p) => p.type === 'clock_out')

  if (!clockIn && !clockOut) {
    return applyManualAdjustment(
      withActualPunchHours({
        employeeId,
        date,
        shiftId: shift.id,
        status: 'absent',
        workHours: 0,
        scheduledHours,
      }),
      manualOverride,
    )
  }

  if (!clockIn || !clockOut) {
    const punchHours = calcWorkHours(dayPunches, shift)
    return applyManualAdjustment(
      withActualPunchHours({
        employeeId,
        date,
        shiftId: shift.id,
        status: 'missing_punch',
        clockIn: clockIn?.time,
        clockOut: clockOut?.time,
        workHours: punchHours,
        scheduledHours,
      }),
      manualOverride,
    )
  }

  const startMin = parseMinutes(shift.startTime)
  const endMin = parseMinutes(shift.endTime)
  const inMin = parseMinutes(clockIn.time)
  let outMin = parseMinutes(clockOut.time)
  if (endMin <= startMin && outMin < startMin) outMin += 24 * 60

  const lateThreshold = startMin + rule.flexMinutesAfter
  const earlyThreshold = endMin - rule.flexMinutesBefore

  let status: AttendanceStatus = 'normal'
  if (inMin > lateThreshold) status = 'late'
  if (outMin < earlyThreshold && status === 'normal') status = 'early_leave'
  if (inMin > lateThreshold && outMin < earlyThreshold) status = 'late'

  const punchHours = calcWorkHours(dayPunches, shift)
  return applyManualAdjustment(
    withActualPunchHours({
      employeeId,
      date,
      shiftId: shift.id,
      status,
      clockIn: clockIn.time,
      clockOut: clockOut.time,
      workHours: punchHours,
      scheduledHours,
    }),
    manualOverride,
  )
}

function calcWorkHours(punches: AttendancePunch[], shift?: Shift): number {
  const clockIn = punches.find((p) => p.type === 'clock_in')
  const clockOut = punches.find((p) => p.type === 'clock_out')
  if (!clockIn || !clockOut) return 0
  let inMin = parseMinutes(clockIn.time)
  let outMin = parseMinutes(clockOut.time)
  if (shift) {
    const startMin = parseMinutes(shift.startTime)
    const endMin = parseMinutes(shift.endTime)
    if (endMin <= startMin && outMin < startMin) outMin += 24 * 60
    if (endMin <= startMin && inMin > outMin) inMin -= 24 * 60
  }
  const breakMin = shift?.breakMinutes ?? 0
  return Math.max(0, Math.round(((outMin - inMin - breakMin) / 60) * 10) / 10)
}

export function buildDailyAttendanceList(
  employeeIds: string[],
  dates: string[],
  assignments: ScheduleAssignment[],
  shifts: Shift[],
  punches: AttendancePunch[],
  leaveRequests: LeaveRequest[],
  rule: AttendanceRule,
  manualOverrides: Record<string, AttendanceManualAdjustment> = {},
): AttendanceDaily[] {
  const result: AttendanceDaily[] = []
  employeeIds.forEach((employeeId) => {
    dates.forEach((date) => {
      const key = `${employeeId}_${date}`
      const override = manualOverrides[key]
      result.push(
        computeDailyAttendance(
          employeeId,
          date,
          assignments,
          shifts,
          punches,
          leaveRequests,
          rule,
          override,
        ),
      )
    })
  })
  return result
}

export function deriveExceptions(
  dailyList: AttendanceDaily[],
  punches: AttendancePunch[],
  existing: AttendanceException[],
): AttendanceException[] {
  const existingMap = new Map(existing.map((e) => [`${e.employeeId}_${e.date}_${e.type}`, e]))
  const derived: AttendanceException[] = []

  dailyList.forEach((day) => {
    if (day.status === 'rest' || day.status === 'leave' || day.status === 'normal') return

    const typeMap: Partial<Record<AttendanceStatus, AttendanceException['type']>> = {
      late: 'late',
      early_leave: 'early_leave',
      missing_punch: 'missing_punch',
      absent: 'absent',
    }
    const type = typeMap[day.status]
    if (!type) return

    const key = `${day.employeeId}_${day.date}_${type}`
    const prev = existingMap.get(key)
    derived.push({
      id: prev?.id ?? `exc_derived_${key}`,
      employeeId: day.employeeId,
      date: day.date,
      type,
      status: prev?.status ?? 'open',
      message: buildExceptionMessage(day),
      appealReason: prev?.appealReason,
      appealAt: prev?.appealAt,
      resolvedBy: prev?.resolvedBy,
      resolvedAt: prev?.resolvedAt,
      resolution: prev?.resolution,
    })
  })

  punches
    .filter((p) => !p.inRange)
    .forEach((p) => {
      const key = `${p.employeeId}_${p.date}_location`
      const prev = existingMap.get(key)
      if (prev?.status === 'resolved' || prev?.status === 'dismissed') {
        derived.push(prev)
        return
      }
      derived.push({
        id: prev?.id ?? `exc_loc_${key}`,
        employeeId: p.employeeId,
        date: p.date,
        type: 'location',
        status: prev?.status ?? 'open',
        message: `打卡位置超出允许范围${p.location ? `（${p.location}）` : ''}`,
        appealReason: prev?.appealReason,
        appealAt: prev?.appealAt,
        resolvedBy: prev?.resolvedBy,
        resolvedAt: prev?.resolvedAt,
        resolution: prev?.resolution,
      })
    })

  return derived
}

function buildExceptionMessage(day: AttendanceDaily): string {
  if (day.status === 'late') return `上班迟到，打卡 ${day.clockIn ?? '-'}`
  if (day.status === 'early_leave') return `下班早退，打卡 ${day.clockOut ?? '-'}`
  if (day.status === 'missing_punch') return '缺少上班或下班打卡记录'
  if (day.status === 'absent') return '应出勤但未打卡'
  return getStatusLabel(day.status)
}

export function buildMonthlySummary(
  employeeId: string,
  month: string,
  dailyList: AttendanceDaily[],
): AttendanceMonthlySummary {
  const monthData = dailyList.filter((d) => d.employeeId === employeeId && d.date.startsWith(month))
  return {
    employeeId,
    month,
    scheduledDays: monthData.filter((d) => d.scheduledHours > 0).length,
    actualDays: monthData.filter((d) => ['normal', 'late', 'early_leave'].includes(d.status)).length,
    lateCount: monthData.filter((d) => d.status === 'late').length,
    earlyLeaveCount: monthData.filter((d) => d.status === 'early_leave').length,
    missingPunchCount: monthData.filter((d) => d.status === 'missing_punch').length,
    absentCount: monthData.filter((d) => d.status === 'absent').length,
    leaveDays: monthData.filter((d) => d.status === 'leave').length,
    overtimeHours: Math.max(
      0,
      Math.round(
        monthData.reduce((sum, d) => sum + Math.max(0, d.workHours - d.scheduledHours), 0) * 10,
      ) / 10,
    ),
    totalWorkHours: Math.round(monthData.reduce((sum, d) => sum + d.workHours, 0) * 10) / 10,
  }
}

export function getDatesBetween(start: string, end: string): string[] {
  const dates: string[] = []
  const cur = new Date(start)
  const endDate = new Date(end)
  while (cur <= endDate) {
    dates.push(cur.toISOString().slice(0, 10))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

export function simulatePunchTime(shift: Shift, type: PunchType, scenario: 'normal' | 'late' | 'early' = 'normal'): string {
  const start = parseMinutes(shift.startTime)
  const end = parseMinutes(shift.endTime)
  if (type === 'clock_in') {
    if (scenario === 'late') return minutesToTime(start + 35)
    return minutesToTime(start + 5)
  }
  if (scenario === 'early') return minutesToTime(end - 40)
  return minutesToTime(end - 5)
}

export function getMonthDateRange(month: string): string[] {
  const [y, m] = month.split('-').map(Number)
  return getMonthDays(y, m)
}

export function filterEmployees(
  employees: Employee[],
  options?: { departmentId?: string; keyword?: string },
): Employee[] {
  return employees.filter((e) => {
    if (e.status !== 'active') return false
    if (options?.departmentId && e.departmentId !== options.departmentId) return false
    if (options?.keyword) {
      const k = options.keyword.toLowerCase()
      if (!e.name.includes(k) && !e.employeeNo.toLowerCase().includes(k)) return false
    }
    return true
  })
}
