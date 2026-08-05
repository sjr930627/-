import type { AttendanceGroupCompliance, ScheduleAssignment, Shift } from '@/types'
import { getAssignmentWorkHours, parseScheduleTimeNote } from '@/constants/schedule'
import { calcShiftHours } from '@/utils'

export interface ComplianceConflict {
  type: 'daily_hours' | 'weekly_hours' | 'monthly_hours' | 'consecutive_workdays' | 'shift_interval'
  employeeId: string
  date: string
  message: string
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + (m || 0)
}

function getWeekDates(date: string): string[] {
  const d = new Date(date)
  const day = d.getDay()
  const monday = new Date(d)
  monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  const dates: string[] = []
  for (let i = 0; i < 7; i += 1) {
    const cur = new Date(monday)
    cur.setDate(monday.getDate() + i)
    dates.push(cur.toISOString().slice(0, 10))
  }
  return dates
}

function getShiftOnDate(
  employeeId: string,
  date: string,
  assignments: ScheduleAssignment[],
  shifts: Shift[],
): Shift | null {
  const all = assignments.filter((a) => a.employeeId === employeeId && a.date === date)
  const asn = all.find((a) => !a.published) ?? all.find((a) => a.published) ?? all[0]
  if (!asn) return null
  const base = shifts.find((s) => s.id === asn.shiftId) ?? null
  if (!base) return null
  const parsed = parseScheduleTimeNote(asn.note)
  if (parsed) {
    return { ...base, startTime: parsed.startTime, endTime: parsed.endTime, breakMinutes: 0 }
  }
  return base
}

function isWorkShift(shift: Shift | null | undefined): shift is Shift {
  return Boolean(shift && shift.code !== 'REST')
}

function hoursBetweenShifts(prev: Shift, next: Shift, dayGap: number): number {
  let prevEnd = timeToMinutes(prev.endTime)
  const prevStart = timeToMinutes(prev.startTime)
  if (prevEnd <= prevStart) prevEnd += 24 * 60
  const nextStart = timeToMinutes(next.startTime)
  return (dayGap * 24 * 60 + nextStart - prevEnd) / 60
}

function countConsecutiveWorkdays(
  employeeId: string,
  date: string,
  assignments: ScheduleAssignment[],
  shifts: Shift[],
): number {
  const isWork = (d: string) => isWorkShift(getShiftOnDate(employeeId, d, assignments, shifts))
  let count = isWork(date) ? 1 : 0
  if (!count) return 0

  const base = new Date(date)
  for (let i = 1; i <= 14; i += 1) {
    const prev = new Date(base)
    prev.setDate(prev.getDate() - i)
    const prevStr = prev.toISOString().slice(0, 10)
    if (isWork(prevStr)) count += 1
    else break
  }
  for (let i = 1; i <= 14; i += 1) {
    const next = new Date(base)
    next.setDate(next.getDate() + i)
    const nextStr = next.toISOString().slice(0, 10)
    if (isWork(nextStr)) count += 1
    else break
  }
  return count
}

function sumHoursInDates(
  employeeId: string,
  dates: string[],
  assignments: ScheduleAssignment[],
  shifts: Shift[],
  replace?: { date: string; shiftId: string },
): number {
  return dates.reduce((sum, d) => {
    let asn = assignments.find((a) => a.employeeId === employeeId && a.date === d)
    if (replace && d === replace.date) {
      asn = asn
        ? { ...asn, shiftId: replace.shiftId }
        : ({
            id: '_sim',
            employeeId,
            date: d,
            shiftId: replace.shiftId,
            teamId: '',
            published: false,
          } as ScheduleAssignment)
    }
    if (!asn) return sum
    const shift = shifts.find((s) => s.id === asn!.shiftId)
    return isWorkShift(shift) ? sum + getAssignmentWorkHours(asn, shifts) : sum
  }, 0)
}

/** 仅基于考勤组合规工时红线的冲突检测 */
export function detectComplianceConflicts(
  employeeId: string,
  date: string,
  shiftId: string,
  assignments: ScheduleAssignment[],
  shifts: Shift[],
  compliance: AttendanceGroupCompliance,
): ComplianceConflict[] {
  const conflicts: ComplianceConflict[] = []
  const shift = shifts.find((s) => s.id === shiftId)
  if (!isWorkShift(shift)) return conflicts

  const cellAsn = assignments.find((a) => a.employeeId === employeeId && a.date === date)
  const dailyHours = cellAsn
    ? getAssignmentWorkHours({ ...cellAsn, shiftId }, shifts)
    : calcShiftHours(shift!)
  if (dailyHours > compliance.maxDailyHours) {
    conflicts.push({
      type: 'daily_hours',
      employeeId,
      date,
      message: `日工时 ${dailyHours.toFixed(1)}h 超过红线 ${compliance.maxDailyHours}h`,
    })
  }

  const weekDates = getWeekDates(date)
  const weeklyHours = sumHoursInDates(employeeId, weekDates, assignments, shifts, { date, shiftId })
  if (weeklyHours > compliance.maxWeeklyHours) {
    conflicts.push({
      type: 'weekly_hours',
      employeeId,
      date,
      message: `周工时 ${weeklyHours.toFixed(1)}h 超过红线 ${compliance.maxWeeklyHours}h`,
    })
  }

  const month = date.slice(0, 7)
  const monthDates = assignments
    .filter((a) => a.employeeId === employeeId && a.date.startsWith(month))
    .map((a) => a.date)
  const uniqueMonthDates = Array.from(new Set([...monthDates, date]))
  const monthlyHours = sumHoursInDates(
    employeeId,
    uniqueMonthDates,
    assignments,
    shifts,
    { date, shiftId },
  )
  if (monthlyHours > compliance.maxMonthlyHours) {
    conflicts.push({
      type: 'monthly_hours',
      employeeId,
      date,
      message: `月工时 ${monthlyHours.toFixed(1)}h 超过红线 ${compliance.maxMonthlyHours}h`,
    })
  }

  const simulated = assignments.filter((a) => !(a.employeeId === employeeId && a.date === date))
  simulated.push({
    id: '_sim',
    employeeId,
    date,
    shiftId,
    teamId: '',
    published: false,
  })
  const consecutive = countConsecutiveWorkdays(employeeId, date, simulated, shifts)
  if (consecutive > compliance.maxConsecutiveWorkdays) {
    conflicts.push({
      type: 'consecutive_workdays',
      employeeId,
      date,
      message: `连续工作 ${consecutive} 天，超过红线 ${compliance.maxConsecutiveWorkdays} 天`,
    })
  }

  const prevDate = new Date(date)
  prevDate.setDate(prevDate.getDate() - 1)
  const prevStr = prevDate.toISOString().slice(0, 10)
  const prevShift = getShiftOnDate(employeeId, prevStr, assignments, shifts)
  if (isWorkShift(prevShift)) {
    const gap = hoursBetweenShifts(prevShift, shift, 1)
    if (gap < compliance.minShiftIntervalHours) {
      conflicts.push({
        type: 'shift_interval',
        employeeId,
        date,
        message: `与前班间隔 ${gap.toFixed(1)}h，低于红线 ${compliance.minShiftIntervalHours}h`,
      })
    }
  }

  return conflicts
}

export function detectAllComplianceConflicts(
  assignments: ScheduleAssignment[],
  shifts: Shift[],
  compliance: AttendanceGroupCompliance,
  filter?: { teamId?: string; dates?: string[]; employeeIds?: string[] },
): ComplianceConflict[] {
  let list = assignments
  if (filter?.teamId) list = list.filter((a) => a.teamId === filter.teamId)
  if (filter?.dates?.length) {
    const set = new Set(filter.dates)
    list = list.filter((a) => set.has(a.date))
  }
  if (filter?.employeeIds?.length) {
    const set = new Set(filter.employeeIds)
    list = list.filter((a) => set.has(a.employeeId))
  }

  const all: ComplianceConflict[] = []
  list.forEach((a) => {
    all.push(
      ...detectComplianceConflicts(a.employeeId, a.date, a.shiftId, assignments, shifts, compliance),
    )
  })
  const key = (c: ComplianceConflict) => `${c.employeeId}_${c.date}_${c.type}`
  return Array.from(new Map(all.map((c) => [key(c), c])).values())
}
