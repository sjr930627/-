import type {
  AttendanceGroup,
  Department,
  Employee,
  GrabShiftApplication,
  GrabShiftSlot,
  Holiday,
  ScheduleAssignment,
  Shift,
  Team,
  WeeklyShiftDemandPlan,
} from '@/types'
import { getDatesBetween } from '@/services/attendance'
import {
  getDemandPlanCoveringDate,
  resolveShiftTemplateDemand,
} from '@/services/shiftDemandPlan'
import { resolveShiftIdForTemplate } from '@/services/scheduleGroup'
import { resolveEnterpriseIdByDepartment } from '@/utils/enterpriseScope'
import { addDays, getWeekStart } from '@/utils'

export interface DemandGapShiftItem {
  date: string
  shiftTemplateId: string
  shiftName: string
  startTime: string
  endTime: string
  required: number
  appliedCount: number
  gap: number
  teamId: string
  teamName: string
  departmentId: string
  departmentName: string
  /** 关联抢班班次，用于跳转抢班管理 */
  grabSlotId?: string
}

export interface DemandOverviewMetrics {
  /** 总人数（在职） */
  totalHeadcount: number
  /** 现需求人数（人次） */
  requiredHeadcount: number
  /** 班次需求数（有需求的班次格子数） */
  shiftDemandCount: number
  /** 已报名数（抢班报名） */
  appliedCount: number
  /** 缺口数 = 现需求人数 - 已报名数 */
  gapCount: number
  urgentShiftLabel: string
  urgentGrabSlotId?: string
  gapShifts: DemandGapShiftItem[]
}

export interface DemandOverviewDeptRow extends DemandOverviewMetrics {
  kind: 'department'
  id: string
  enterpriseId: string
  enterpriseName: string
  departmentId: string
  departmentName: string
  managerName: string
  attendanceGroupIds: string[]
  teamIds: string[]
}

export interface DemandOverviewEnterpriseRow extends DemandOverviewMetrics {
  kind: 'enterprise'
  id: string
  enterpriseId: string
  enterpriseName: string
  managerName: string
  children: DemandOverviewDeptRow[]
}

export type DemandOverviewSortKey = 'gapCount' | 'requiredHeadcount' | 'departmentName'

export function defaultDemandOverviewRange(anchor = '2026-08-14'): [string, string] {
  const start = getWeekStart(anchor)
  return [start, addDays(start, 6)]
}

function countActiveInDepartment(employees: Employee[], departmentId: string) {
  return employees.filter(
    (e) => e.departmentId === departmentId && e.status === 'active',
  ).length
}

function resolveManagerName(
  departmentId: string,
  groups: AttendanceGroup[],
  departments: Department[],
  employees: Employee[],
): string {
  for (const g of groups) {
    const binding = g.departmentBindings.find((b) => b.departmentId === departmentId)
    if (binding?.managerName) return binding.managerName
  }
  const dept = departments.find((d) => d.id === departmentId)
  if (dept?.managerEmployeeId) {
    return employees.find((e) => e.id === dept.managerEmployeeId)?.name ?? '—'
  }
  return '—'
}

function matchGrabSlots(
  slots: GrabShiftSlot[],
  team: Team,
  departmentId: string,
  date: string,
  shiftId: string,
) {
  return slots.filter((s) => {
    if (s.date !== date || s.shiftId !== shiftId) return false
    if (s.status === 'cancelled') return false
    if (s.teamId === team.id) return true
    if (s.departmentId === departmentId) return true
    return false
  })
}

function countApplications(
  applications: GrabShiftApplication[],
  slotIds: Set<string>,
) {
  return applications.filter(
    (a) => slotIds.has(a.slotId) && a.status !== 'rejected',
  ).length
}

function formatUrgentLabel(item: DemandGapShiftItem | undefined): string {
  if (!item || item.gap <= 0) return '—'
  const md = `${Number(item.date.slice(5, 7))}/${Number(item.date.slice(8, 10))}`
  return `${md} ${item.shiftName} 缺${item.gap}人`
}

function aggregateMetrics(parts: DemandOverviewMetrics[]): DemandOverviewMetrics {
  const totalHeadcount = parts.reduce((s, p) => s + p.totalHeadcount, 0)
  const requiredHeadcount = parts.reduce((s, p) => s + p.requiredHeadcount, 0)
  const shiftDemandCount = parts.reduce((s, p) => s + p.shiftDemandCount, 0)
  const appliedCount = parts.reduce((s, p) => s + p.appliedCount, 0)
  const gapCount = Math.max(0, requiredHeadcount - appliedCount)
  const gapShifts = parts
    .flatMap((p) => p.gapShifts)
    .filter((g) => g.gap > 0)
    .sort((a, b) => b.gap - a.gap || a.date.localeCompare(b.date))
  return {
    totalHeadcount,
    requiredHeadcount,
    shiftDemandCount,
    appliedCount,
    gapCount,
    urgentShiftLabel: formatUrgentLabel(gapShifts[0]),
    urgentGrabSlotId: gapShifts[0]?.grabSlotId,
    gapShifts,
  }
}

function buildDepartmentMetrics(options: {
  departmentId: string
  departmentName: string
  enterpriseId: string
  enterpriseName: string
  startDate: string
  endDate: string
  teams: Team[]
  departments: Department[]
  attendanceGroups: AttendanceGroup[]
  holidays: Holiday[]
  plans: WeeklyShiftDemandPlan[]
  shifts: Shift[]
  employees: Employee[]
  grabSlots: GrabShiftSlot[]
  grabApplications: GrabShiftApplication[]
  attendanceGroupIdFilter?: string
}): DemandOverviewDeptRow | null {
  const {
    departmentId,
    departmentName,
    enterpriseId,
    enterpriseName,
    startDate,
    endDate,
    teams,
    departments,
    attendanceGroups,
    holidays,
    plans,
    shifts,
    employees,
    grabSlots,
    grabApplications,
    attendanceGroupIdFilter,
  } = options

  const deptTeams = teams.filter((t) => {
    if (t.departmentId !== departmentId) return false
    if (!t.attendanceGroupId) return false
    if (attendanceGroupIdFilter && t.attendanceGroupId !== attendanceGroupIdFilter) return false
    return true
  })
  if (!deptTeams.length) return null

  const dates = getDatesBetween(startDate, endDate)
  const totalHeadcount = countActiveInDepartment(employees, departmentId)

  let requiredHeadcount = 0
  let shiftDemandCount = 0
  let appliedCount = 0
  const gapShifts: DemandGapShiftItem[] = []
  const groupIds = new Set<string>()
  const countedAppSlotIds = new Set<string>()

  for (const team of deptTeams) {
    const group = attendanceGroups.find((g) => g.id === team.attendanceGroupId)
    if (!group?.shiftTemplates?.length) continue
    groupIds.add(group.id)

    for (const date of dates) {
      const plan = getDemandPlanCoveringDate(plans, team.id, date, false)
      for (const tpl of group.shiftTemplates) {
        const shiftId = resolveShiftIdForTemplate(tpl.name, shifts)
        if (!shiftId) continue
        const required = resolveShiftTemplateDemand(
          date,
          tpl.id,
          group.shiftTemplates,
          holidays,
          plan,
        )
        if (required <= 0) continue

        shiftDemandCount += 1
        requiredHeadcount += required

        const matchedSlots = matchGrabSlots(grabSlots, team, departmentId, date, shiftId)
        const slotIds = new Set(matchedSlots.map((s) => s.id))
        let cellApplied = 0
        for (const id of slotIds) {
          if (countedAppSlotIds.has(id)) continue
          countedAppSlotIds.add(id)
          const n = countApplications(grabApplications, new Set([id]))
          cellApplied += n
          appliedCount += n
        }
        // 无报名记录时，回退用抢班班次已抢人数
        if (!slotIds.size) {
          cellApplied = 0
        } else if (cellApplied === 0) {
          cellApplied = matchedSlots.reduce((s, slot) => s + (slot.grabbedCount || 0), 0)
          appliedCount += cellApplied
        }

        const gap = Math.max(0, required - cellApplied)
        const primarySlot = matchedSlots.find((s) => s.status !== 'full') ?? matchedSlots[0]
        if (gap > 0) {
          gapShifts.push({
            date,
            shiftTemplateId: tpl.id,
            shiftName: tpl.name,
            startTime: tpl.startTime,
            endTime: tpl.endTime,
            required,
            appliedCount: cellApplied,
            gap,
            teamId: team.id,
            teamName: team.name,
            departmentId,
            departmentName,
            grabSlotId: primarySlot?.id,
          })
        }
      }
    }
  }

  if (requiredHeadcount <= 0 && totalHeadcount <= 0) return null

  gapShifts.sort((a, b) => b.gap - a.gap || a.date.localeCompare(b.date))
  const gapCount = Math.max(0, requiredHeadcount - appliedCount)

  return {
    kind: 'department',
    id: `dept:${departmentId}`,
    enterpriseId,
    enterpriseName,
    departmentId,
    departmentName,
    managerName: resolveManagerName(departmentId, attendanceGroups, departments, employees),
    attendanceGroupIds: [...groupIds],
    teamIds: deptTeams.map((t) => t.id),
    totalHeadcount,
    requiredHeadcount,
    shiftDemandCount,
    appliedCount,
    gapCount,
    urgentShiftLabel: formatUrgentLabel(gapShifts[0]),
    urgentGrabSlotId: gapShifts[0]?.grabSlotId,
    gapShifts,
  }
}

export function buildDemandOverviewTree(options: {
  startDate: string
  endDate: string
  teams: Team[]
  departments: Department[]
  enterprises: { id: string; name: string }[]
  attendanceGroups: AttendanceGroup[]
  holidays: Holiday[]
  plans: WeeklyShiftDemandPlan[]
  shifts: Shift[]
  assignments?: ScheduleAssignment[]
  employees: Employee[]
  grabSlots?: GrabShiftSlot[]
  grabApplications?: GrabShiftApplication[]
  enterpriseIdFilter?: string
  attendanceGroupIdFilter?: string
  sortKey?: DemandOverviewSortKey
}): DemandOverviewEnterpriseRow[] {
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
    employees,
    grabSlots = [],
    grabApplications = [],
    enterpriseIdFilter,
    attendanceGroupIdFilter,
    sortKey = 'gapCount',
  } = options
  if (!startDate || !endDate) return []

  const deptIds = new Set(
    teams
      .filter((t) => {
        if (!t.attendanceGroupId) return false
        if (attendanceGroupIdFilter && t.attendanceGroupId !== attendanceGroupIdFilter) {
          return false
        }
        return true
      })
      .map((t) => t.departmentId),
  )

  const byEnterprise = new Map<string, DemandOverviewDeptRow[]>()

  for (const departmentId of deptIds) {
    const dept = departments.find((d) => d.id === departmentId)
    if (!dept) continue
    const enterpriseId = resolveEnterpriseIdByDepartment(dept.id, departments)
    if (enterpriseIdFilter && enterpriseId !== enterpriseIdFilter) continue
    const enterpriseName =
      enterprises.find((e) => e.id === enterpriseId)?.name ?? enterpriseId
    const row = buildDepartmentMetrics({
      departmentId,
      departmentName: dept.name,
      enterpriseId,
      enterpriseName,
      startDate,
      endDate,
      teams,
      departments,
      attendanceGroups,
      holidays,
      plans,
      shifts,
      employees,
      grabSlots,
      grabApplications,
      attendanceGroupIdFilter,
    })
    if (!row) continue
    const list = byEnterprise.get(enterpriseId) ?? []
    list.push(row)
    byEnterprise.set(enterpriseId, list)
  }

  const sortDepts = (list: DemandOverviewDeptRow[]) => {
    list.sort((a, b) => {
      if (sortKey === 'requiredHeadcount') return b.requiredHeadcount - a.requiredHeadcount
      if (sortKey === 'departmentName') {
        return a.departmentName.localeCompare(b.departmentName, 'zh-CN')
      }
      return b.gapCount - a.gapCount || b.requiredHeadcount - a.requiredHeadcount
    })
  }

  const result: DemandOverviewEnterpriseRow[] = []
  for (const [enterpriseId, children] of byEnterprise) {
    sortDepts(children)
    const metrics = aggregateMetrics(children)
    result.push({
      kind: 'enterprise',
      id: `ent:${enterpriseId}`,
      enterpriseId,
      enterpriseName: children[0]?.enterpriseName ?? enterpriseId,
      managerName: '—',
      children,
      ...metrics,
    })
  }

  result.sort((a, b) => {
    if (sortKey === 'requiredHeadcount') return b.requiredHeadcount - a.requiredHeadcount
    if (sortKey === 'departmentName') {
      return a.enterpriseName.localeCompare(b.enterpriseName, 'zh-CN')
    }
    return b.gapCount - a.gapCount
  })

  return result
}

export function gapToneClass(gap: number): 'gap-critical' | 'gap-warning' | 'gap-ok' {
  if (gap <= 0) return 'gap-ok'
  if (gap >= 10) return 'gap-critical'
  if (gap >= 3) return 'gap-warning'
  return 'gap-warning'
}
