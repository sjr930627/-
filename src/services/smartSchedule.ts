import type {
  Employee,
  Holiday,
  LeaveRequest,
  ScheduleAssignment,
  ScheduleRule,
  Shift,
  ShiftRecommendation,
  SmartScheduleResult,
  Team,
} from '@/types'
import { calcShiftHours, getMonthDays } from '@/utils'
import { detectConflicts, isRestDay } from './schedule'
import { getDatesBetween } from '@/services/attendance'

export interface SmartScheduleOptions {
  teamId: string
  /** @deprecated 使用 startDate/endDate */
  month?: string
  startDate?: string
  endDate?: string
  primaryShiftId: string
  restShiftId: string
  workPattern?: string[]
  preferEmployeePreference?: boolean
  balanceHours?: boolean
  respectLeave?: boolean
}

export function recommendEmployeesForShift(
  date: string,
  shiftId: string,
  team: Team,
  employees: Employee[],
  assignments: ScheduleAssignment[],
  shifts: Shift[],
  holidays: Holiday[],
  rule: ScheduleRule,
  requiredSkills: string[] = [],
): ShiftRecommendation[] {
  const shift = shifts.find((s) => s.id === shiftId)
  if (!shift) return []

  const month = date.slice(0, 7)
  const monthHours = (empId: string) => {
    return assignments
      .filter((a) => a.employeeId === empId && a.date.startsWith(month))
      .reduce((sum, a) => {
        const s = shifts.find((sh) => sh.id === a.shiftId)
        return s && s.code !== 'REST' ? sum + calcShiftHours(s) : sum
      }, 0)
  }

  const avgHours =
    team.memberIds.reduce((sum, id) => sum + monthHours(id), 0) / Math.max(team.memberIds.length, 1)

  return team.memberIds
    .map((employeeId) => {
      const emp = employees.find((e) => e.id === employeeId)
      if (!emp || emp.status !== 'active') return null

      let score = 100
      const reasons: string[] = []

      if (emp.preferredShiftIds.includes(shiftId)) {
        score += 15
        reasons.push('偏好班次匹配')
      }

      if (emp.unavailableDates.includes(date)) {
        score -= 50
        reasons.push('当日不可用')
      }

      const conflicts = detectConflicts(
        employeeId,
        date,
        shiftId,
        assignments,
        employees,
        shifts,
        holidays,
        rule,
      )
      if (conflicts.length > 0) {
        score -= conflicts.length * 20
        reasons.push(`存在 ${conflicts.length} 项规则冲突`)
      }

      const hours = monthHours(employeeId)
      if (hours > avgHours) {
        score -= Math.round((hours - avgHours) * 2)
        reasons.push('本月工时偏高，优先均衡')
      } else if (hours < avgHours) {
        score += Math.round((avgHours - hours) * 1.5)
        reasons.push('本月工时偏低，推荐补班')
      }

      if (requiredSkills.length > 0) {
        const matched = requiredSkills.filter((s) => emp.skills.includes(s))
        if (matched.length === requiredSkills.length) {
          score += 20
          reasons.push('技能完全匹配')
        } else if (matched.length > 0) {
          score += 10
          reasons.push('部分技能匹配')
        } else {
          score -= 15
          reasons.push('缺少所需技能')
        }
      }

      return { employeeId, score: Math.max(0, Math.round(score)), reasons }
    })
    .filter((r): r is ShiftRecommendation => r !== null)
    .sort((a, b) => b.score - a.score)
}

export function generateSmartSchedule(
  team: Team,
  employees: Employee[],
  shifts: Shift[],
  holidays: Holiday[],
  leaveRequests: LeaveRequest[],
  existingAssignments: ScheduleAssignment[],
  rule: ScheduleRule,
  options: SmartScheduleOptions,
): SmartScheduleResult {
  const { teamId, primaryShiftId, restShiftId } = options
  const preferPref = options.preferEmployeePreference !== false
  const balanceHours = options.balanceHours !== false
  const respectLeave = options.respectLeave !== false

  let days: string[]
  if (options.startDate && options.endDate) {
    days = getDatesBetween(options.startDate, options.endDate)
  } else if (options.month) {
    const [year, monthNum] = options.month.split('-').map(Number)
    days = getMonthDays(year, monthNum)
  } else {
    return { assignments: [], conflictCount: 0, balancedHours: {}, message: '请指定排班区间' }
  }

  const workPattern =
    options.workPattern ??
    ([primaryShiftId, primaryShiftId, primaryShiftId, primaryShiftId, primaryShiftId, restShiftId, restShiftId] as string[])

  const month = days[0]?.slice(0, 7) ?? options.month ?? ''
  const restShift = shifts.find((s) => s.id === restShiftId)
  const primaryShift = shifts.find((s) => s.id === primaryShiftId)

  if (!restShift || !primaryShift) {
    return { assignments: [], conflictCount: 0, balancedHours: {}, message: '班次配置无效' }
  }

  const approvedLeave = respectLeave ? leaveRequests.filter((r) => r.status === 'approved') : []
  const isLeave = (empId: string, date: string) =>
    approvedLeave.some((r) => r.employeeId === empId && date >= r.startDate && date <= r.endDate)

  const monthHours = (empId: string) =>
    existingAssignments
      .filter((a) => a.employeeId === empId && a.date.startsWith(month))
      .reduce((sum, a) => {
        const s = shifts.find((sh) => sh.id === a.shiftId)
        return s && s.code !== 'REST' ? sum + calcShiftHours(s) : sum
      }, 0)

  const avgHours =
    team.memberIds.reduce((sum, id) => sum + monthHours(id), 0) / Math.max(team.memberIds.length, 1)

  const draft: Omit<ScheduleAssignment, 'id' | 'published'>[] = []
  const otherAssignments = existingAssignments.filter(
    (a) =>
      !(
        a.teamId === teamId &&
        days.includes(a.date) &&
        team.memberIds.includes(a.employeeId)
      ),
  )

  team.memberIds.forEach((employeeId, empIndex) => {
    const emp = employees.find((e) => e.id === employeeId)
    days.forEach((date, dayIndex) => {
      let shiftId = restShiftId
      if (!isRestDay(holidays, date, rule.weekendWork) && !isLeave(employeeId, date)) {
        const preferred = preferPref ? emp?.preferredShiftIds.filter((id) => id !== restShiftId) ?? [] : []
        if (preferred.length > 0) {
          shiftId = preferred[(dayIndex + empIndex) % preferred.length]
        } else {
          shiftId = workPattern[(dayIndex + empIndex) % workPattern.length]
        }
        if (balanceHours && shiftId !== restShiftId) {
          const hours = monthHours(employeeId)
          if (hours > avgHours + 8) {
            shiftId = restShiftId
          }
        }
      }
      draft.push({ employeeId, shiftId, date, teamId })
    })
  })

  const simulated = [...otherAssignments, ...draft.map((d) => ({ ...d, id: 'sim', published: false }))]
  let conflictCount = 0
  draft.forEach((d) => {
    conflictCount += detectConflicts(
      d.employeeId,
      d.date,
      d.shiftId,
      simulated,
      employees,
      shifts,
      holidays,
      rule,
    ).length
  })

  const balancedHours: Record<string, number> = {}
  team.memberIds.forEach((empId) => {
    balancedHours[empId] = draft
      .filter((d) => d.employeeId === empId)
      .reduce((sum, d) => {
        const s = shifts.find((sh) => sh.id === d.shiftId)
        return s && s.code !== 'REST' ? sum + calcShiftHours(s) : sum
      }, 0)
  })

  return {
    assignments: draft,
    conflictCount,
    balancedHours,
    message: `已生成 ${draft.length} 条排班，${conflictCount} 处规则冲突待确认`,
  }
}

export function getOvertimeTypeForDate(date: string, holidays: Holiday[]): 'weekday' | 'weekend' | 'holiday' {
  const hol = holidays.find((h) => h.date === date)
  if (hol && !hol.isWorkday) return 'holiday'
  const day = new Date(date).getDay()
  if (day === 0 || day === 6) return 'weekend'
  return 'weekday'
}

export function calcOvertimeHours(startTime: string, endTime: string): number {
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  let start = sh * 60 + sm
  let end = eh * 60 + em
  if (end <= start) end += 24 * 60
  return Math.round(((end - start) / 60) * 10) / 10
}
