import type { AttendanceGroup, Department, ScheduleRule, Team } from '@/types'
import { defaultScheduleRule } from '@/mock/seed'
import { getDepartmentDescendantIds } from '@/utils'

export function complianceToScheduleRule(
  compliance: AttendanceGroup['compliance'],
  overrides: Partial<ScheduleRule> = {},
): ScheduleRule {
  return {
    maxConsecutiveDays: compliance.maxConsecutiveWorkdays,
    maxDailyHours: compliance.maxDailyHours,
    maxWeeklyHours: compliance.maxWeeklyHours,
    maxMonthlyHours: compliance.maxMonthlyHours,
    minRestHours: compliance.minShiftIntervalHours,
    forbidNightShiftForFemale: false,
    weekendWork: false,
    ...overrides,
  }
}

export function scheduleRuleToCompliance(
  rule: ScheduleRule,
  base?: AttendanceGroup['compliance'],
): AttendanceGroup['compliance'] {
  return {
    maxDailyHours: rule.maxDailyHours,
    maxWeeklyHours: rule.maxWeeklyHours,
    maxMonthlyHours: rule.maxMonthlyHours,
    maxConsecutiveWorkdays: rule.maxConsecutiveDays,
    minShiftIntervalHours: rule.minRestHours,
    ...(base ?? {}),
  }
}

export function resolveGroupScheduleRule(group: AttendanceGroup): ScheduleRule {
  if (group.scheduleRule) return { ...group.scheduleRule }
  return complianceToScheduleRule(group.compliance)
}

export function getTeamsForAttendanceGroup(
  group: AttendanceGroup,
  teams: Team[],
  departments: Department[],
): Team[] {
  const deptIds = new Set<string>()
  group.departmentBindings.forEach((b) => {
    getDepartmentDescendantIds(departments, b.departmentId).forEach((id) => deptIds.add(id))
  })
  return teams.filter(
    (t) => t.attendanceGroupId === group.id || deptIds.has(t.departmentId),
  )
}

export function getDefaultScheduleRuleForSeed(overrides: Partial<ScheduleRule> = {}): ScheduleRule {
  return { ...defaultScheduleRule, ...overrides }
}

const SHIFT_NAME_TO_ID: Record<string, string> = {
  早班: 'shift_morning',
  中班: 'shift_afternoon',
  大晚班: 'shift_night',
  夜班: 'shift_night',
}

/** 考勤组班次模板映射到系统班次 ID */
export function resolveShiftIdForTemplate(
  templateName: string,
  shifts: { id: string; name: string }[],
): string | null {
  if (SHIFT_NAME_TO_ID[templateName]) return SHIFT_NAME_TO_ID[templateName]
  return shifts.find((s) => s.name === templateName)?.id ?? null
}
