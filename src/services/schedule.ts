import type { Employee, Holiday, ScheduleAssignment, ScheduleRule, Shift } from '@/types'
import { calcShiftHours, getMonthDays, isWeekend } from '@/utils'

export interface ScheduleConflict {
  type: 'duplicate' | 'consecutive' | 'daily_hours' | 'weekly_hours' | 'holiday' | 'weekend' | 'unavailable'
  employeeId: string
  date: string
  message: string
}

export function getHolidayForDate(holidays: Holiday[], date: string): Holiday | undefined {
  return holidays.find((h) => h.date === date)
}

export function isRestDay(holidays: Holiday[], date: string, weekendWork: boolean): boolean {
  const holiday = getHolidayForDate(holidays, date)
  if (holiday) return !holiday.isWorkday
  if (!weekendWork && isWeekend(date)) return true
  return false
}

export function detectConflicts(
  employeeId: string,
  date: string,
  shiftId: string,
  assignments: ScheduleAssignment[],
  employees: Employee[],
  shifts: Shift[],
  holidays: Holiday[],
  rule: ScheduleRule,
): ScheduleConflict[] {
  const conflicts: ScheduleConflict[] = []
  const employee = employees.find((e) => e.id === employeeId)
  const shift = shifts.find((s) => s.id === shiftId)
  if (!employee || !shift) return conflicts

  const sameDay = assignments.filter(
    (a) => a.employeeId === employeeId && a.date === date && a.shiftId !== shiftId,
  )
  if (sameDay.length > 0) {
    conflicts.push({
      type: 'duplicate',
      employeeId,
      date,
      message: '同一天已存在其他班次',
    })
  }

  if (employee.unavailableDates.includes(date)) {
    conflicts.push({
      type: 'unavailable',
      employeeId,
      date,
      message: '员工在该日期不可用',
    })
  }

  if (isRestDay(holidays, date, rule.weekendWork) && shift.code !== 'REST') {
    conflicts.push({
      type: 'holiday',
      employeeId,
      date,
      message: '休息日安排了工作班次',
    })
  }

  const dailyHours = calcShiftHours(shift)
  if (dailyHours > rule.maxDailyHours) {
    conflicts.push({
      type: 'daily_hours',
      employeeId,
      date,
      message: `日工时 ${dailyHours.toFixed(1)}h 超过上限 ${rule.maxDailyHours}h`,
    })
  }

  const consecutive = countConsecutiveWorkDays(employeeId, date, assignments, shifts, holidays, rule)
  if (consecutive > rule.maxConsecutiveDays) {
    conflicts.push({
      type: 'consecutive',
      employeeId,
      date,
      message: `连续上班 ${consecutive} 天，超过上限 ${rule.maxConsecutiveDays} 天`,
    })
  }

  const [year, month] = date.split('-').map(Number)
  const weekDates = getWeekDates(date)
  const weeklyHours = weekDates.reduce((sum, d) => {
    const asn = assignments.find((a) => a.employeeId === employeeId && a.date === d)
    if (!asn) return sum
    const s = shifts.find((sh) => sh.id === asn.shiftId)
    return s && s.code !== 'REST' ? sum + calcShiftHours(s) : sum
  }, 0)
  const newWeeklyHours =
    weeklyHours +
    (shift.code !== 'REST' ? dailyHours : 0) -
    (() => {
      const existing = assignments.find((a) => a.employeeId === employeeId && a.date === date)
      if (!existing) return 0
      const es = shifts.find((sh) => sh.id === existing.shiftId)
      return es && es.code !== 'REST' ? calcShiftHours(es) : 0
    })()

  if (newWeeklyHours > rule.maxWeeklyHours) {
    conflicts.push({
      type: 'weekly_hours',
      employeeId,
      date,
      message: `周工时 ${newWeeklyHours.toFixed(1)}h 超过上限 ${rule.maxWeeklyHours}h`,
    })
  }

  void year
  void month
  return conflicts
}

function countConsecutiveWorkDays(
  employeeId: string,
  date: string,
  assignments: ScheduleAssignment[],
  shifts: Shift[],
  holidays: Holiday[],
  rule: ScheduleRule,
): number {
  const isWork = (d: string) => {
    const asn = assignments.find((a) => a.employeeId === employeeId && a.date === d)
    if (asn) {
      const s = shifts.find((sh) => sh.id === asn.shiftId)
      return s ? s.code !== 'REST' : false
    }
    return false
  }

  let count = 1
  const base = new Date(date)

  for (let i = 1; i <= 14; i += 1) {
    const prev = new Date(base)
    prev.setDate(prev.getDate() - i)
    const prevStr = prev.toISOString().slice(0, 10)
    if (isRestDay(holidays, prevStr, rule.weekendWork) && !isWork(prevStr)) break
    if (isWork(prevStr)) count += 1
    else break
  }

  for (let i = 1; i <= 14; i += 1) {
    const next = new Date(base)
    next.setDate(next.getDate() + i)
    const nextStr = next.toISOString().slice(0, 10)
    if (isRestDay(holidays, nextStr, rule.weekendWork) && !isWork(nextStr)) break
    if (isWork(nextStr)) count += 1
    else break
  }

  return count
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

export function detectAllConflicts(
  assignments: ScheduleAssignment[],
  employees: Employee[],
  shifts: Shift[],
  holidays: Holiday[],
  rule: ScheduleRule,
  filter?: { teamId?: string; month?: string },
): ScheduleConflict[] {
  let list = assignments
  if (filter?.teamId) list = list.filter((a) => a.teamId === filter.teamId)
  if (filter?.month) list = list.filter((a) => a.date.startsWith(filter.month!))

  const all: ScheduleConflict[] = []
  list.forEach((a) => {
    all.push(
      ...detectConflicts(a.employeeId, a.date, a.shiftId, assignments, employees, shifts, holidays, rule),
    )
  })
  const key = (c: ScheduleConflict) => `${c.employeeId}_${c.date}_${c.type}`
  return Array.from(new Map(all.map((c) => [key(c), c])).values())
}

export function generateCycleSchedule(
  employeeIds: string[],
  shiftPattern: string[],
  startDate: string,
  days: number,
  teamId: string,
): Omit<ScheduleAssignment, 'id' | 'published'>[] {
  const result: Omit<ScheduleAssignment, 'id' | 'published'>[] = []
  const start = new Date(startDate)
  employeeIds.forEach((employeeId, empIndex) => {
    for (let i = 0; i < days; i += 1) {
      const date = new Date(start)
      date.setDate(start.getDate() + i)
      const dateStr = date.toISOString().slice(0, 10)
      const shiftId = shiftPattern[(i + empIndex) % shiftPattern.length]
      result.push({ employeeId, shiftId, date: dateStr, teamId })
    }
  })
  return result
}

export function getMonthAssignmentStats(
  assignments: ScheduleAssignment[],
  shifts: Shift[],
  employeeIds: string[],
  month: string,
) {
  const monthDays = getMonthDays(Number(month.slice(0, 4)), Number(month.slice(5, 7)))
  return employeeIds.map((empId) => {
    const empAssignments = assignments.filter(
      (a) => a.employeeId === empId && a.date.startsWith(month),
    )
    const workDays = empAssignments.filter((a) => {
      const s = shifts.find((sh) => sh.id === a.shiftId)
      return s && s.code !== 'REST'
    }).length
    const totalHours = empAssignments.reduce((sum, a) => {
      const s = shifts.find((sh) => sh.id === a.shiftId)
      return s && s.code !== 'REST' ? sum + calcShiftHours(s) : sum
    }, 0)
    return {
      employeeId: empId,
      workDays,
      restDays: monthDays.length - workDays,
      totalHours: Math.round(totalHours * 10) / 10,
    }
  })
}
