import type {
  AttendanceDaily,
  AttendanceException,
  AttendanceManualAdjustment,
  AttendanceMonthlySummary,
  AttendancePunch,
  AttendanceRule,
  AttendanceStatus,
  Employee,
  LeaveRequest,
  PunchType,
  ScheduleAssignment,
  Shift,
} from '@/types'
import { calcShiftHours, getMonthDays } from '@/utils'

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

export function canCorrectWorkHours(status: AttendanceStatus): boolean {
  return status === 'late' || status === 'missing_punch'
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
    next.workHoursCorrected = true
  }
  if (manualOverride.note) {
    next.manualNote = manualOverride.note
  }
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
    return applyManualAdjustment(
      {
        employeeId,
        date,
        shiftId: shift?.id,
        status: manualOverride.status,
        clockIn: dayPunches.find((p) => p.type === 'clock_in')?.time,
        clockOut: dayPunches.find((p) => p.type === 'clock_out')?.time,
        workHours: calcWorkHours(dayPunches, shift),
        scheduledHours,
        manualStatus: manualOverride.status,
        manualNote: manualOverride.note,
      },
      manualOverride,
    )
  }

  if (isOnLeave(leaveRequests, employeeId, date)) {
    return applyManualAdjustment(
      {
        employeeId,
        date,
        shiftId: shift?.id,
        status: 'leave',
        workHours: 0,
        scheduledHours,
      },
      manualOverride,
    )
  }

  if (!shift || shift.code === 'REST') {
    return {
      employeeId,
      date,
      shiftId: shift?.id,
      status: 'rest',
      workHours: 0,
      scheduledHours: 0,
    }
  }

  const dayPunches = getPunchesForDay(punches, employeeId, date)
  const clockIn = dayPunches.find((p) => p.type === 'clock_in')
  const clockOut = dayPunches.find((p) => p.type === 'clock_out')

  if (!clockIn && !clockOut) {
    return applyManualAdjustment(
      {
        employeeId,
        date,
        shiftId: shift.id,
        status: 'absent',
        workHours: 0,
        scheduledHours,
      },
      manualOverride,
    )
  }

  if (!clockIn || !clockOut) {
    return applyManualAdjustment(
      {
        employeeId,
        date,
        shiftId: shift.id,
        status: 'missing_punch',
        clockIn: clockIn?.time,
        clockOut: clockOut?.time,
        workHours: calcWorkHours(dayPunches, shift),
        scheduledHours,
      },
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

  return applyManualAdjustment(
    {
      employeeId,
      date,
      shiftId: shift.id,
      status,
      clockIn: clockIn.time,
      clockOut: clockOut.time,
      workHours: calcWorkHours(dayPunches, shift),
      scheduledHours,
    },
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
