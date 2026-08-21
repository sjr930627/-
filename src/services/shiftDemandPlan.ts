import type {
  AttendanceGroupShiftTemplate,
  Employee,
  Holiday,
  ScheduleAssignment,
  Shift,
  ShiftDemandCommonConfig,
  ShiftDemandDayCell,
  ShiftDemandShiftCount,
  Team,
  TeamCycleScheduleRule,
  WeeklyShiftDemandPlan,
  AttendanceGroup,
  Department,
} from '@/types'
import { getDatesBetween } from '@/services/attendance'
import { getDateDemandKind, getShiftDemandHeadcount } from '@/services/schedule'
import { resolveShiftIdForTemplate } from '@/services/scheduleGroup'
import { resolveEnterpriseIdByDepartment } from '@/utils/enterpriseScope'
import { addDays, getWeekDates, getWeekStart } from '@/utils'

export function demandCellKey(date: string, shiftTemplateId: string) {
  return `${date}#${shiftTemplateId}`
}

export function isShiftDemandPublished(plan?: WeeklyShiftDemandPlan | null): boolean {
  if (!plan) return false
  return plan.status === 'published' || plan.status === 'confirmed'
}

export function planStatusLabel(status: WeeklyShiftDemandPlan['status']): string {
  if (status === 'published' || status === 'confirmed') return '已发布'
  return '草稿'
}

/** 查找覆盖某日的需求计划（可选仅已发布） */
export function getDemandPlanCoveringDate(
  plans: WeeklyShiftDemandPlan[],
  teamId: string,
  date: string,
  publishedOnly = false,
): WeeklyShiftDemandPlan | undefined {
  const candidates = plans.filter((p) => {
    if (p.teamId !== teamId) return false
    if (date < p.weekStart || date > p.weekEnd) return false
    if (publishedOnly && !isShiftDemandPublished(p)) return false
    return true
  })
  candidates.sort((a, b) => {
    const ap = isShiftDemandPublished(a) ? 1 : 0
    const bp = isShiftDemandPublished(b) ? 1 : 0
    if (ap !== bp) return bp - ap
    return b.updatedAt.localeCompare(a.updatedAt)
  })
  return candidates[0]
}

export function getWeeklyPlanForDate(
  plans: WeeklyShiftDemandPlan[],
  teamId: string,
  date: string,
): WeeklyShiftDemandPlan | undefined {
  return getDemandPlanCoveringDate(plans, teamId, date, false)
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

export function countsFromTemplates(
  templates: AttendanceGroupShiftTemplate[],
  kind: 'weekday' | 'weekend' | 'holiday' = 'weekday',
): ShiftDemandShiftCount[] {
  return templates.map((tpl) => ({
    shiftTemplateId: tpl.id,
    requiredHeadcount:
      kind === 'holiday'
        ? (tpl.holidayRequiredHeadcount ?? tpl.requiredHeadcount ?? 0)
        : kind === 'weekend'
          ? (tpl.weekendRequiredHeadcount ?? tpl.requiredHeadcount ?? 0)
          : (tpl.requiredHeadcount ?? 0),
  }))
}

/** 按通用配置生成周期内全部单元格 */
export function buildCellsFromCommonConfig(
  templates: AttendanceGroupShiftTemplate[],
  dates: string[],
  holidays: Holiday[],
  common: ShiftDemandCommonConfig,
): ShiftDemandDayCell[] {
  if (common.mode === 'custom' && common.customDays?.length) {
    const map = new Map(
      common.customDays.map((c) => [demandCellKey(c.date, c.shiftTemplateId), c]),
    )
    const cells: ShiftDemandDayCell[] = []
    dates.forEach((date) => {
      templates.forEach((tpl) => {
        const hit = map.get(demandCellKey(date, tpl.id))
        cells.push({
          date,
          shiftTemplateId: tpl.id,
          requiredHeadcount: hit?.requiredHeadcount ?? 0,
        })
      })
    })
    return cells
  }

  const cells: ShiftDemandDayCell[] = []
  dates.forEach((date) => {
    const kind = getDateDemandKind(date, holidays)
    let counts: ShiftDemandShiftCount[] = []
    if (common.mode === 'daily_reuse') {
      counts = common.dailyReuse ?? countsFromTemplates(templates, 'weekday')
    } else if (common.mode === 'batch_by_kind') {
      const batch = common.batchByKind
      if (kind === 'holiday') counts = batch?.holiday ?? countsFromTemplates(templates, 'holiday')
      else if (kind === 'weekend') counts = batch?.weekend ?? countsFromTemplates(templates, 'weekend')
      else counts = batch?.weekday ?? countsFromTemplates(templates, 'weekday')
    } else {
      counts = countsFromTemplates(
        templates,
        kind === 'holiday' ? 'holiday' : kind === 'weekend' ? 'weekend' : 'weekday',
      )
    }
    templates.forEach((tpl) => {
      const hit = counts.find((c) => c.shiftTemplateId === tpl.id)
      cells.push({
        date,
        shiftTemplateId: tpl.id,
        requiredHeadcount: hit?.requiredHeadcount ?? 0,
      })
    })
  })
  return cells
}

/**
 * 解析班次需求人数。
 * publishedOnly=true：仅已发布计划（排班需求概览用）；无发布则返回 0。
 */
export function resolveShiftTemplateDemand(
  date: string,
  shiftTemplateId: string,
  templates: AttendanceGroupShiftTemplate[],
  holidays: Holiday[],
  weeklyPlan?: WeeklyShiftDemandPlan | null,
  options?: { publishedOnly?: boolean },
): number {
  const publishedOnly = options?.publishedOnly === true
  if (publishedOnly) {
    if (!isShiftDemandPublished(weeklyPlan)) return 0
    const fromPlan = weeklyPlan!.cells.find(
      (c) => c.date === date && c.shiftTemplateId === shiftTemplateId,
    )
    return fromPlan?.requiredHeadcount ?? 0
  }
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
  const plan = getDemandPlanCoveringDate(plans, teamId, nextStart, true)
  return !plan
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
  publishedOnly?: boolean
}) {
  const { teamId, templates, holidays, plans, resolveShiftId, publishedOnly } = options
  const templateByShiftId = new Map<string, AttendanceGroupShiftTemplate>()
  templates.forEach((tpl) => {
    const shiftId = resolveShiftId(tpl.name)
    if (shiftId) templateByShiftId.set(shiftId, tpl)
  })
  return (date: string, shiftId: string) => {
    const tpl = templateByShiftId.get(shiftId)
    if (!tpl) return 0
    const weeklyPlan = getDemandPlanCoveringDate(plans, teamId, date, publishedOnly === true)
    return resolveShiftTemplateDemand(date, tpl.id, templates, holidays, weeklyPlan, {
      publishedOnly,
    })
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
  publishedOnly = false,
): boolean {
  if (!startDate || !endDate || !teamId) return false
  const dates = getDatesBetween(startDate, endDate)
  return dates.some((date) =>
    templates.some((tpl) => {
      const shiftId = resolveShiftId(tpl.name)
      if (!shiftId) return false
      const weeklyPlan = getDemandPlanCoveringDate(plans, teamId, date, publishedOnly)
      return (
        resolveShiftTemplateDemand(date, tpl.id, templates, holidays, weeklyPlan, {
          publishedOnly,
        }) > 0
      )
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
  publishedOnly = false,
): ConfiguredShiftDemandSummary[] {
  if (!startDate || !endDate || !teamId) return []
  const dates = getDatesBetween(startDate, endDate)
  return templates
    .map((tpl) => {
      const shiftId = resolveShiftId(tpl.name)
      const shift = shiftId ? shifts.find((s) => s.id === shiftId) ?? null : null
      let totalNeeded = 0
      dates.forEach((date) => {
        const weeklyPlan = getDemandPlanCoveringDate(plans, teamId, date, publishedOnly)
        totalNeeded += resolveShiftTemplateDemand(date, tpl.id, templates, holidays, weeklyPlan, {
          publishedOnly,
        })
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

export interface ShiftDemandManageShiftItem {
  shiftTemplateId: string
  shiftTemplateName: string
  shiftId: string
  startTime: string
  endTime: string
  requiredHeadcount: number
  scheduledCount: number
  gapCount: number
}

export interface ShiftDemandManageRow {
  key: string
  enterpriseId: string
  enterpriseName: string
  departmentId: string
  departmentName: string
  /** 部门在职人数 */
  departmentHeadcount: number
  teamId: string
  teamName: string
  attendanceGroupId: string
  attendanceGroupName: string
  date: string
  dateKindLabel: string
  /** 当日各班次需求明细（早班、晚班、天地班等） */
  shifts: ShiftDemandManageShiftItem[]
  /** 班次展示文案，如「早班 8人、晚班 6人」 */
  shiftSummary: string
  requiredHeadcount: number
  scheduledCount: number
  gapCount: number
  planStatus: 'published' | 'draft' | 'none'
  planId?: string
}

/** 推荐/排班时优先取有缺口的班次 */
export function pickPrimaryShift(
  row: ShiftDemandManageRow,
): ShiftDemandManageShiftItem | undefined {
  return row.shifts.find((s) => s.gapCount > 0) ?? row.shifts[0]
}

function countTeamShiftScheduled(
  assignments: ScheduleAssignment[],
  team: Team,
  date: string,
  shiftId: string,
): number {
  const members = new Set(team.memberIds)
  return assignments.filter(
    (a) =>
      a.date === date &&
      a.shiftId === shiftId &&
      (a.teamId === team.id || members.has(a.employeeId)),
  ).length
}

function countDepartmentHeadcount(employees: Employee[], departmentId: string): number {
  return employees.filter(
    (e) => e.departmentId === departmentId && e.status !== 'resigned',
  ).length
}

/** 班次需求管理列表：企业-部门-日期一行，班次列汇总当日各班次需求 */
export function buildShiftDemandManageRows(options: {
  startDate: string
  endDate: string
  teams: Team[]
  departments: Department[]
  enterprises: { id: string; name: string }[]
  attendanceGroups: AttendanceGroup[]
  holidays: Holiday[]
  plans: WeeklyShiftDemandPlan[]
  shifts: Shift[]
  assignments: ScheduleAssignment[]
  employees?: Employee[]
  enterpriseIdFilter?: string
  departmentIdFilter?: string
  onlyGap?: boolean
  /** 列表是否优先展示已发布人数（否则展示当前计划草稿/模板） */
  preferPublished?: boolean
}): ShiftDemandManageRow[] {
  const {
    startDate,
    endDate,
    teams,
    departments,
    enterprises,
    attendanceGroups,
    holidays,
    plans,
    shifts,
    assignments,
    employees = [],
    enterpriseIdFilter,
    departmentIdFilter,
    onlyGap,
    preferPublished = false,
  } = options
  if (!startDate || !endDate) return []

  const dates = getDatesBetween(startDate, endDate)
  const rows: ShiftDemandManageRow[] = []
  const deptHeadcountCache = new Map<string, number>()

  for (const team of teams) {
    const dept = departments.find((d) => d.id === team.departmentId)
    if (!dept) continue
    const enterpriseId = resolveEnterpriseIdByDepartment(dept.id, departments)
    if (enterpriseIdFilter && enterpriseId !== enterpriseIdFilter) continue
    if (departmentIdFilter && dept.id !== departmentIdFilter) continue

    const groupId = team.attendanceGroupId
    if (!groupId) continue
    const group = attendanceGroups.find((g) => g.id === groupId)
    if (!group?.shiftTemplates?.length) continue

    const enterpriseName = enterprises.find((e) => e.id === enterpriseId)?.name ?? enterpriseId
    if (!deptHeadcountCache.has(dept.id)) {
      deptHeadcountCache.set(dept.id, countDepartmentHeadcount(employees, dept.id))
    }
    const departmentHeadcount = deptHeadcountCache.get(dept.id) ?? 0

    for (const date of dates) {
      const publishedPlan = getDemandPlanCoveringDate(plans, team.id, date, true)
      const anyPlan = getDemandPlanCoveringDate(plans, team.id, date, false)
      const plan = preferPublished ? publishedPlan ?? anyPlan : anyPlan ?? publishedPlan
      const dateKindLabel = getDateDemandKindLabel(date, holidays)
      const dayShifts: ShiftDemandManageShiftItem[] = []

      for (const tpl of group.shiftTemplates) {
        const shiftId = resolveShiftIdForTemplate(tpl.name, shifts)
        if (!shiftId) continue
        const requiredHeadcount = resolveShiftTemplateDemand(
          date,
          tpl.id,
          group.shiftTemplates,
          holidays,
          plan,
          { publishedOnly: preferPublished && !!publishedPlan },
        )
        const displayNeeded =
          requiredHeadcount > 0
            ? requiredHeadcount
            : resolveShiftTemplateDemand(date, tpl.id, group.shiftTemplates, holidays, plan)
        if (displayNeeded <= 0) continue
        const scheduledCount = countTeamShiftScheduled(assignments, team, date, shiftId)
        const gapCount = Math.max(0, displayNeeded - scheduledCount)
        dayShifts.push({
          shiftTemplateId: tpl.id,
          shiftTemplateName: tpl.name,
          shiftId,
          startTime: tpl.startTime,
          endTime: tpl.endTime,
          requiredHeadcount: displayNeeded,
          scheduledCount,
          gapCount,
        })
      }

      if (!dayShifts.length) continue
      dayShifts.sort((a, b) => a.startTime.localeCompare(b.startTime))
      const requiredHeadcount = dayShifts.reduce((s, x) => s + x.requiredHeadcount, 0)
      const scheduledCount = dayShifts.reduce((s, x) => s + x.scheduledCount, 0)
      const gapCount = dayShifts.reduce((s, x) => s + x.gapCount, 0)
      if (onlyGap && gapCount <= 0) continue

      const planStatus: ShiftDemandManageRow['planStatus'] = publishedPlan
        ? 'published'
        : anyPlan
          ? 'draft'
          : 'none'

      rows.push({
        key: `${team.id}#${date}`,
        enterpriseId,
        enterpriseName,
        departmentId: dept.id,
        departmentName: dept.name,
        departmentHeadcount,
        teamId: team.id,
        teamName: team.name,
        attendanceGroupId: group.id,
        attendanceGroupName: group.name,
        date,
        dateKindLabel,
        shifts: dayShifts,
        shiftSummary: dayShifts
          .map((s) => `${s.shiftTemplateName} ${s.requiredHeadcount}人`)
          .join('、'),
        requiredHeadcount,
        scheduledCount,
        gapCount,
        planStatus,
        planId: plan?.id,
      })
    }
  }

  return rows.sort((a, b) => {
    const byDate = a.date.localeCompare(b.date)
    if (byDate) return byDate
    const byEnt = a.enterpriseName.localeCompare(b.enterpriseName, 'zh-CN')
    if (byEnt) return byEnt
    return a.departmentName.localeCompare(b.departmentName, 'zh-CN')
  })
}
