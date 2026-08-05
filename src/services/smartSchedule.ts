import type {
  AttendanceGroupCompliance,
  Employee,
  Holiday,
  LeaveRequest,
  ScheduleAssignment,
  Shift,
  ShiftRecommendation,
  SmartScheduleResult,
  Team,
} from '@/types'
import { calcShiftHours, getMonthDays } from '@/utils'
import { detectComplianceConflicts } from '@/services/scheduleCompliance'
import { getDatesBetween } from '@/services/attendance'
import { getShiftDemandHeadcount } from '@/services/schedule'

export interface ShiftDemandSlot {
  shiftId: string
  templateName: string
  requiredHeadcount: number
  weekendRequiredHeadcount?: number
  holidayRequiredHeadcount?: number
}

export interface SmartScheduleOptions {
  teamId: string
  /** @deprecated 使用 startDate/endDate */
  month?: string
  startDate?: string
  endDate?: string
  /** 参与排班的人员 */
  employeeIds: string[]
  /** 每日各班次人数需求 */
  shiftDemands: ShiftDemandSlot[]
  /** 按日期解析人数需求，优先于 shiftDemands 中的平/末/节默认值 */
  getDateHeadcount?: (date: string, shiftId: string) => number
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
  _holidays: Holiday[],
  compliance: AttendanceGroupCompliance,
  requiredSkills: string[] = [],
  excludeEmployeeIds: string[] = [],
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
      if (excludeEmployeeIds.includes(employeeId)) return null

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

      const conflicts = detectComplianceConflicts(
        employeeId,
        date,
        shiftId,
        assignments,
        shifts,
        compliance,
      )
      if (conflicts.length > 0) {
        score -= conflicts.length * 20
        reasons.push(`存在 ${conflicts.length} 项工时红线预警`)
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
  compliance: AttendanceGroupCompliance,
  options: SmartScheduleOptions,
): SmartScheduleResult {
  const { teamId, employeeIds, shiftDemands, getDateHeadcount } = options
  const respectLeave = options.respectLeave !== false

  const resolveDateHeadcount = (demand: ShiftDemandSlot, date: string) =>
    getDateHeadcount?.(date, demand.shiftId) ?? getShiftDemandHeadcount(demand, date, holidays)

  let days: string[]
  if (options.startDate && options.endDate) {
    days = getDatesBetween(options.startDate, options.endDate)
  } else if (options.month) {
    const [year, monthNum] = options.month.split('-').map(Number)
    days = getMonthDays(year, monthNum)
  } else {
    return { assignments: [], conflictCount: 0, balancedHours: {}, message: '请指定排班区间' }
  }

  const activeDemands = shiftDemands.filter((d) => {
    if (!shifts.some((s) => s.id === d.shiftId)) return false
    if (getDateHeadcount) {
      return days.some((date) => getDateHeadcount(date, d.shiftId) > 0)
    }
    return (
      d.requiredHeadcount > 0 ||
      (d.weekendRequiredHeadcount ?? 0) > 0 ||
      (d.holidayRequiredHeadcount ?? 0) > 0
    )
  })

  if (!activeDemands.length) {
    return { assignments: [], conflictCount: 0, balancedHours: {}, message: '请先配置每日班次需求' }
  }

  if (!employeeIds.length) {
    return { assignments: [], conflictCount: 0, balancedHours: {}, message: '请选择参与排班的人员' }
  }

  const poolTeam: Team = { ...team, memberIds: employeeIds }

  const approvedLeave = respectLeave ? leaveRequests.filter((r) => r.status === 'approved') : []
  const isLeave = (empId: string, date: string) =>
    approvedLeave.some((r) => r.employeeId === empId && date >= r.startDate && date <= r.endDate)

  const otherAssignments = existingAssignments.filter(
    (a) =>
      !(
        a.teamId === teamId &&
        days.includes(a.date) &&
        employeeIds.includes(a.employeeId)
      ),
  )

  const draft: Omit<ScheduleAssignment, 'id' | 'published'>[] = []

  days.forEach((date) => {
    const assignedToday = new Set<string>()

    activeDemands.forEach((demand) => {
      const dateHeadcount = resolveDateHeadcount(demand, date)
      if (dateHeadcount <= 0) return

      const simulated = [
        ...otherAssignments,
        ...draft.map((d) => ({ ...d, id: 'sim', published: false as const })),
      ]

      const leaveExcluded = respectLeave
        ? employeeIds.filter((id) => isLeave(id, date))
        : []

      const recommendations = recommendEmployeesForShift(
        date,
        demand.shiftId,
        poolTeam,
        employees,
        simulated,
        shifts,
        holidays,
        compliance,
        [],
        [...assignedToday, ...leaveExcluded],
      )

      const picked = recommendations
        .filter((r) => {
          const emp = employees.find((e) => e.id === r.employeeId)
          return emp && !emp.unavailableDates.includes(date)
        })
        .slice(0, dateHeadcount)

      picked.forEach(({ employeeId }) => {
        assignedToday.add(employeeId)
        draft.push({ employeeId, shiftId: demand.shiftId, date, teamId })
      })
    })
  })

  const simulated = [...otherAssignments, ...draft.map((d) => ({ ...d, id: 'sim', published: false }))]
  let conflictCount = 0
  draft.forEach((d) => {
    conflictCount += detectComplianceConflicts(
      d.employeeId,
      d.date,
      d.shiftId,
      simulated,
      shifts,
      compliance,
    ).length
  })

  const balancedHours: Record<string, number> = {}
  employeeIds.forEach((empId) => {
    balancedHours[empId] = draft
      .filter((d) => d.employeeId === empId)
      .reduce((sum, d) => {
        const s = shifts.find((sh) => sh.id === d.shiftId)
        return s && s.code !== 'REST' ? sum + calcShiftHours(s) : sum
      }, 0)
  })

  const totalNeeded = days.reduce((sum, date) => {
    return (
      sum +
      activeDemands.reduce(
        (daySum, d) => daySum + resolveDateHeadcount(d, date),
        0,
      )
    )
  }, 0)
  const fillRate = totalNeeded ? Math.round((draft.length / totalNeeded) * 100) : 0

  return {
    assignments: draft,
    conflictCount,
    balancedHours,
    message: `已生成 ${draft.length} 条排班（需求满足率 ${fillRate}%），${conflictCount} 处工时红线预警待确认`,
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
