import { GRAB_SHIFT_GLOBAL_TEAM_ID } from '@/services/grabShift'
import { getDepartmentDescendantIds } from '@/utils'
import type {
  AttendanceGroup,
  Department,
  GrabShiftSlot,
  JobRequirement,
  Team,
} from '@/types'

export interface DepartmentGapSummary {
  positionGap: number
  shiftGap: number
  total: number
}

/** 历史招聘需求部门名称 → 组织部门 ID（演示数据兼容） */
const JOB_DEPT_NAME_ALIASES: Record<string, string[]> = {
  零售部: ['dept_prod_a'],
  终端销售部: ['dept_cm_field'],
  市场部: ['dept_pj_field'],
  会员部: ['dept_sh_hall'],
}

function isGlobalGrabSlot(slot: GrabShiftSlot) {
  return (
    slot.scope === 'global' ||
    slot.teamId === GRAB_SHIFT_GLOBAL_TEAM_ID ||
    slot.departmentId === GRAB_SHIFT_GLOBAL_TEAM_ID
  )
}

function jobMatchesDeptTree(
  job: JobRequirement,
  deptIds: Set<string>,
  deptNames: Set<string>,
  enterpriseId?: string,
) {
  if (job.status === 'completed') return false
  if (enterpriseId && job.enterpriseId && job.enterpriseId !== enterpriseId) return false
  if (job.departmentId && deptIds.has(job.departmentId)) return true
  if (job.department && deptNames.has(job.department)) return true
  const aliases = JOB_DEPT_NAME_ALIASES[job.department]
  return Boolean(aliases?.some((id) => deptIds.has(id)))
}

function groupCoversDeptTree(
  group: AttendanceGroup,
  deptIds: Set<string>,
  departments: Department[],
) {
  return (group.departmentBindings ?? []).some((binding) => {
    if (deptIds.has(binding.departmentId)) return true
    const boundIds = getDepartmentDescendantIds(departments, binding.departmentId)
    for (const id of boundIds) {
      if (deptIds.has(id)) return true
    }
    return false
  })
}

function slotBelongsToDeptTree(
  slot: GrabShiftSlot,
  deptIds: Set<string>,
  teamById: Map<string, Team>,
  groupById: Map<string, AttendanceGroup>,
  departments: Department[],
) {
  if (!isGlobalGrabSlot(slot) && slot.departmentId) {
    return deptIds.has(slot.departmentId)
  }
  if (!isGlobalGrabSlot(slot) && slot.teamId) {
    const team = teamById.get(slot.teamId)
    if (team?.departmentId && deptIds.has(team.departmentId)) return true
  }
  const group = groupById.get(slot.attendanceGroupId)
  if (!group) return false
  return groupCoversDeptTree(group, deptIds, departments)
}

export function summarizeDepartmentGaps(params: {
  departmentId: string
  departments: Department[]
  jobRequirements: JobRequirement[]
  grabShiftSlots: GrabShiftSlot[]
  teams: Team[]
  attendanceGroups?: AttendanceGroup[]
}): DepartmentGapSummary {
  const {
    departmentId,
    departments,
    jobRequirements,
    grabShiftSlots,
    teams,
    attendanceGroups = [],
  } = params
  if (!departmentId) return { positionGap: 0, shiftGap: 0, total: 0 }

  const deptIds = getDepartmentDescendantIds(departments, departmentId)
  const treeDepts = departments.filter((d) => deptIds.has(d.id))
  const deptNames = new Set(treeDepts.map((d) => d.name))
  const enterpriseId = treeDepts.find((d) => d.enterpriseId)?.enterpriseId
  const teamById = new Map(teams.map((t) => [t.id, t]))
  const groupById = new Map(attendanceGroups.map((g) => [g.id, g]))

  const positionGap = jobRequirements.reduce((sum, job) => {
    if (!jobMatchesDeptTree(job, deptIds, deptNames, enterpriseId)) return sum
    return sum + Math.max(0, (job.headcount ?? 0) - (job.filledCount ?? 0))
  }, 0)

  const shiftGap = grabShiftSlots.reduce((sum, slot) => {
    if (slot.status === 'cancelled') return sum
    if (!slotBelongsToDeptTree(slot, deptIds, teamById, groupById, departments)) return sum
    return sum + Math.max(0, (slot.requiredCount ?? 0) - (slot.grabbedCount ?? 0))
  }, 0)

  return { positionGap, shiftGap, total: positionGap + shiftGap }
}

export function formatDepartmentGap(gap: DepartmentGapSummary) {
  return `岗位 ${gap.positionGap} · 抢班次 ${gap.shiftGap}`
}
