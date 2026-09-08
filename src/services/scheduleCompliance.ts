import type {
  AttendanceGroupCompliance,
  Department,
  ScheduleAssignment,
  Shift,
  Team,
} from '@/types'
import {
  getAssignmentWorkHours,
  parseScheduleTimeNote,
  parseScheduleTimeSegments,
  resolveOverallPunchWindow,
  calcScheduleSegmentsBreakMinutes,
  scheduleSegmentAbsRange,
  type ScheduleTimeSegment,
} from '@/constants/schedule'
import { calcShiftHours, addDays } from '@/utils'
import { resolveEnterpriseIdByTeamDepartment } from '@/utils/enterpriseScope'

export interface ComplianceConflict {
  type: 'daily_hours' | 'weekly_hours' | 'monthly_hours' | 'consecutive_workdays' | 'shift_interval'
  employeeId: string
  date: string
  message: string
}

/** 规范化合规配置：历史数据缺省 enabled 视为关闭 */
export function normalizeAttendanceGroupCompliance(
  compliance?: Partial<AttendanceGroupCompliance> | null,
): AttendanceGroupCompliance {
  return {
    enabled: compliance?.enabled === true,
    maxDailyHours: compliance?.maxDailyHours ?? 12,
    maxWeeklyHours: compliance?.maxWeeklyHours ?? 60,
    minShiftIntervalHours: compliance?.minShiftIntervalHours ?? 12,
    maxMonthlyHours: compliance?.maxMonthlyHours ?? 260,
    maxConsecutiveWorkdays: compliance?.maxConsecutiveWorkdays ?? 3,
  }
}

/** 仅保留归属指定企业班组下的排班（工时红线不做跨企业汇总） */
export function filterAssignmentsByEnterprise(
  assignments: ScheduleAssignment[],
  enterpriseId: string,
  teams: Team[],
  departments: Department[],
): ScheduleAssignment[] {
  const teamIds = new Set(
    teams
      .filter(
        (t) => resolveEnterpriseIdByTeamDepartment(t.departmentId, departments) === enterpriseId,
      )
      .map((t) => t.id),
  )
  return assignments.filter((a) => Boolean(a.teamId && teamIds.has(a.teamId)))
}

/** 用于间隔计算的班次时间窗（含跨天 dayOffset） */
type ShiftWindow = Pick<Shift, 'id' | 'code' | 'name' | 'startTime' | 'endTime' | 'breakMinutes'> & {
  dayOffset?: 0 | 1
}

function getWeekDates(date: string): string[] {
  const d = new Date(date + 'T12:00:00')
  const day = d.getDay()
  const monday = new Date(d)
  monday.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
  const dates: string[] = []
  for (let i = 0; i < 7; i += 1) {
    const cur = new Date(monday)
    cur.setDate(monday.getDate() + i)
    const y = cur.getFullYear()
    const m = String(cur.getMonth() + 1).padStart(2, '0')
    const dd = String(cur.getDate()).padStart(2, '0')
    dates.push(`${y}-${m}-${dd}`)
  }
  return dates
}

function getShiftOnDate(
  employeeId: string,
  date: string,
  assignments: ScheduleAssignment[],
  shifts: Shift[],
): ShiftWindow | null {
  const all = assignments.filter((a) => a.employeeId === employeeId && a.date === date)
  const asn = all.find((a) => !a.published) ?? all.find((a) => a.published) ?? all[0]
  if (!asn) return null
  const base = shifts.find((s) => s.id === asn.shiftId) ?? null
  if (!base) return null
  const segments = parseScheduleTimeSegments(asn.note)
  if (segments.length) {
    const window = resolveOverallPunchWindow(segments)
    if (!window) return base
    return {
      ...base,
      startTime: window.startTime,
      endTime: window.endTime,
      dayOffset: window.dayOffset,
      breakMinutes: calcScheduleSegmentsBreakMinutes(segments),
    }
  }
  const parsed = parseScheduleTimeNote(asn.note)
  if (parsed) {
    return {
      ...base,
      startTime: parsed.startTime,
      endTime: parsed.endTime,
      dayOffset: parsed.dayOffset,
      breakMinutes: 0,
    }
  }
  return base
}

function isWorkShift(shift: ShiftWindow | null | undefined): shift is ShiftWindow {
  return Boolean(shift && shift.code !== 'REST')
}

/**
 * 计算前班结束 → 后班开始的休息间隔（小时）。
 * prev/next 时间相对各自排班日 00:00；dayGap 为后班日期相对前班日期的天数差。
 */
function hoursBetweenShifts(prev: ShiftWindow, next: ShiftWindow, dayGap: number): number {
  const prevSeg: ScheduleTimeSegment = {
    startTime: prev.startTime.slice(0, 5),
    endTime: prev.endTime.slice(0, 5),
    dayOffset: prev.dayOffset,
  }
  const nextSeg: ScheduleTimeSegment = {
    startTime: next.startTime.slice(0, 5),
    endTime: next.endTime.slice(0, 5),
    dayOffset: next.dayOffset,
  }
  const [, prevEndAbs] = scheduleSegmentAbsRange(prevSeg)
  const [nextStartAbs] = scheduleSegmentAbsRange(nextSeg)
  return (dayGap * 24 * 60 + nextStartAbs - prevEndAbs) / 60
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

  for (let i = 1; i <= 14; i += 1) {
    if (isWork(addDays(date, -i))) count += 1
    else break
  }
  for (let i = 1; i <= 14; i += 1) {
    if (isWork(addDays(date, i))) count += 1
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

/** 仅基于考勤组合规工时红线的冲突检测（需已开启；传入 assignments 应为同企业范围） */
export function detectComplianceConflicts(
  employeeId: string,
  date: string,
  shiftId: string,
  assignments: ScheduleAssignment[],
  shifts: Shift[],
  compliance: AttendanceGroupCompliance,
): ComplianceConflict[] {
  const conflicts: ComplianceConflict[] = []
  if (!compliance.enabled) return conflicts

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
    teamId: cellAsn?.teamId ?? '',
    published: false,
    note: cellAsn?.note,
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

  // 班次间隔：必须用备注解析后的实际打卡窗，不能用班次模板默认时刻
  const prevStr = addDays(date, -1)
  const prevShift = getShiftOnDate(employeeId, prevStr, assignments, shifts)
  const nextShift =
    getShiftOnDate(employeeId, date, assignments, shifts) ??
    ({
      ...shift,
      startTime: shift.startTime,
      endTime: shift.endTime,
    } as ShiftWindow)

  if (isWorkShift(prevShift) && isWorkShift(nextShift)) {
    const gap = hoursBetweenShifts(prevShift, nextShift, 1)
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
  if (!compliance.enabled) return []

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
