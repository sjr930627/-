import type {
  AttendanceGroupShiftTemplate,
  Holiday,
  Shift,
  ShiftDemandDayCell,
  TeamCycleScheduleRule,
  WeeklyShiftDemandPlan,
} from '@/types'
import { getDatesBetween } from '@/services/attendance'
import { getDateDemandKind, getShiftDemandHeadcount } from '@/services/schedule'
import { addDays, getWeekDates, getWeekStart } from '@/utils'

export function demandCellKey(date: string, shiftTemplateId: string) {
  return `${date}#${shiftTemplateId}`
}

export function getWeeklyPlanForDate(
  plans: WeeklyShiftDemandPlan[],
  teamId: string,
  date: string,
): WeeklyShiftDemandPlan | undefined {
  const weekStart = getWeekStart(date)
  return plans.find((p) => p.teamId === teamId && p.weekStart === weekStart)
}

export function getDefaultHeadcountForCell(
  tpl: AttendanceGroupShiftTemplate,
  date: string,
  holidays: Holiday[],
): number {
  return getShiftDemandHeadcount(tpl, date, holidays)
}

export function buildWeeklyPlanCells(
  templates: AttendanceGroupShiftTemplate[],
  weekDates: string[],
  holidays: Holiday[],
  existingCells: ShiftDemandDayCell[] = [],
): ShiftDemandDayCell[] {
  const map = new Map(existingCells.map((c) => [demandCellKey(c.date, c.shiftTemplateId), c]))
  const cells: ShiftDemandDayCell[] = []
  weekDates.forEach((date) => {
    templates.forEach((tpl) => {
      const key = demandCellKey(date, tpl.id)
      const saved = map.get(key)
      cells.push({
        date,
        shiftTemplateId: tpl.id,
        requiredHeadcount: saved?.requiredHeadcount ?? getDefaultHeadcountForCell(tpl, date, holidays),
      })
    })
  })
  return cells
}

export function resolveShiftTemplateDemand(
  date: string,
  shiftTemplateId: string,
  templates: AttendanceGroupShiftTemplate[],
  holidays: Holiday[],
  weeklyPlan?: WeeklyShiftDemandPlan | null,
): number {
  const fromPlan = weeklyPlan?.cells.find(
    (c) => c.date === date && c.shiftTemplateId === shiftTemplateId,
  )
  if (fromPlan) return fromPlan.requiredHeadcount
  const tpl = templates.find((t) => t.id === shiftTemplateId)
  if (!tpl) return 0
  return getDefaultHeadcountForCell(tpl, date, holidays)
}

export function getDateDemandKindLabel(date: string, holidays: Holiday[]): string {
  const kind = getDateDemandKind(date, holidays)
  if (kind === 'holiday') return '节'
  if (kind === 'weekend') return '末'
  return '平'
}

export function getNextWeekStart(fromDate?: string): string {
  return addDays(getWeekStart(fromDate), 7)
}

export function teamHasEnabledCycleRule(rules: TeamCycleScheduleRule[], teamId: string): boolean {
  return rules.some((r) => r.teamId === teamId && r.enabled)
}

export function needsNextWeekDemandPlan(
  rules: TeamCycleScheduleRule[],
  plans: WeeklyShiftDemandPlan[],
  teamId: string,
  today = new Date().toISOString().slice(0, 10),
): boolean {
  if (teamHasEnabledCycleRule(rules, teamId)) return false
  const nextStart = getNextWeekStart(today)
  const plan = getWeeklyPlanForDate(plans, teamId, nextStart)
  return !plan || plan.status !== 'confirmed'
}

export function shouldAutoGenerateCycleRule(
  rule: TeamCycleScheduleRule,
  today = new Date().toISOString().slice(0, 10),
): boolean {
  if (!rule.enabled) return false
  const targetStart = addDays(today, rule.autoGenerateLeadDays)
  if (!rule.lastGeneratedAt) return true
  const last = rule.lastGeneratedAt.slice(0, 10)
  return targetStart > last
}

export function getCycleRuleGenerateRange(
  rule: TeamCycleScheduleRule,
  fallbackDates: string[],
): { startDate: string; days: number } {
  if (fallbackDates.length) {
    return { startDate: fallbackDates[0], days: fallbackDates.length }
  }
  const startDate = rule.anchorStartDate || getWeekStart()
  return { startDate, days: rule.cycleDays || 7 }
}

export function summarizeWeeklyPlan(plan: WeeklyShiftDemandPlan | undefined) {
  if (!plan) return { totalNeeded: 0, cellCount: 0, status: 'none' as const }
  const totalNeeded = plan.cells.reduce((s, c) => s + c.requiredHeadcount, 0)
  return { totalNeeded, cellCount: plan.cells.length, status: plan.status }
}

export function getWeekDatesFromStart(weekStart: string): string[] {
  return getWeekDates(weekStart)
}

export interface ConfiguredShiftDemandSummary {
  shiftId: string
  templateId: string
  templateName: string
  startTime: string
  endTime: string
  shift: Shift | null
  totalNeeded: number
  dayCount: number
  avgNeeded: number
  hasDemand: boolean
}

export function createShiftDemandHeadcountResolver(options: {
  teamId: string
  templates: AttendanceGroupShiftTemplate[]
  holidays: Holiday[]
  plans: WeeklyShiftDemandPlan[]
  resolveShiftId: (templateName: string) => string | undefined
}) {
  const { teamId, templates, holidays, plans, resolveShiftId } = options
  const templateByShiftId = new Map<string, AttendanceGroupShiftTemplate>()
  templates.forEach((tpl) => {
    const shiftId = resolveShiftId(tpl.name)
    if (shiftId) templateByShiftId.set(shiftId, tpl)
  })
  return (date: string, shiftId: string) => {
    const tpl = templateByShiftId.get(shiftId)
    if (!tpl) return 0
    const weeklyPlan = getWeeklyPlanForDate(plans, teamId, date)
    return resolveShiftTemplateDemand(date, tpl.id, templates, holidays, weeklyPlan)
  }
}

export function hasShiftDemandInRange(
  startDate: string,
  endDate: string,
  teamId: string,
  templates: AttendanceGroupShiftTemplate[],
  holidays: Holiday[],
  plans: WeeklyShiftDemandPlan[],
  resolveShiftId: (templateName: string) => string | undefined,
): boolean {
  if (!startDate || !endDate || !teamId) return false
  const dates = getDatesBetween(startDate, endDate)
  return dates.some((date) =>
    templates.some((tpl) => {
      const shiftId = resolveShiftId(tpl.name)
      if (!shiftId) return false
      const weeklyPlan = getWeeklyPlanForDate(plans, teamId, date)
      return resolveShiftTemplateDemand(date, tpl.id, templates, holidays, weeklyPlan) > 0
    }),
  )
}

export function summarizeConfiguredShiftDemands(
  startDate: string,
  endDate: string,
  teamId: string,
  templates: AttendanceGroupShiftTemplate[],
  shifts: Shift[],
  holidays: Holiday[],
  plans: WeeklyShiftDemandPlan[],
  resolveShiftId: (templateName: string) => string | undefined,
): ConfiguredShiftDemandSummary[] {
  if (!startDate || !endDate || !teamId) return []
  const dates = getDatesBetween(startDate, endDate)
  return templates
    .map((tpl) => {
      const shiftId = resolveShiftId(tpl.name)
      const shift = shiftId ? shifts.find((s) => s.id === shiftId) ?? null : null
      let totalNeeded = 0
      dates.forEach((date) => {
        const weeklyPlan = getWeeklyPlanForDate(plans, teamId, date)
        totalNeeded += resolveShiftTemplateDemand(date, tpl.id, templates, holidays, weeklyPlan)
      })
      const dayCount = dates.length
      return {
        shiftId: shiftId ?? '',
        templateId: tpl.id,
        templateName: tpl.name,
        startTime: tpl.startTime,
        endTime: tpl.endTime,
        shift,
        totalNeeded,
        dayCount,
        avgNeeded: dayCount ? Math.round((totalNeeded / dayCount) * 10) / 10 : 0,
        hasDemand: totalNeeded > 0,
      }
    })
    .filter((item) => item.shiftId)
}
