import type {
  AttendanceGroup,
  AttendanceGroupShiftTemplate,
  AttendancePunch,
  Department,
  Employee,
  GrabInterviewPositionProfile,
  GrabShiftApplication,
  GrabShiftSlot,
  Holiday,
  ScheduleAssignment,
  Shift,
} from '@/types'
import {
  getGroupPricingConfig,
  resolveHourlyRateForShiftSlot,
} from '@/constants/attendanceGroupPricing'
import { resolveShiftIdForTemplate } from '@/services/scheduleGroup'
import { getDepartmentDescendantIds } from '@/utils'

export const GRAB_SHIFT_GLOBAL_TEAM_ID = '__global__'

export interface GrabShiftScopeOption {
  value: string
  label: string
  scope: 'global' | 'department'
  departmentId?: string
}

export interface GrabShiftTemplateOption {
  templateId: string
  templateName: string
  shiftId: string | null
  startTime: string
  endTime: string
  breakRule?: string
}

export function resolveGrabShiftBaseHourlyRate(
  group: AttendanceGroup | null | undefined,
  options?: {
    date?: string
    startTime?: string
    holidays?: Holiday[]
  },
): number {
  if (!group) return 0
  if (options?.date && options?.startTime) {
    return resolveHourlyRateForShiftSlot({
      group,
      date: options.date,
      startTime: options.startTime,
      holidays: options.holidays,
    }).rate
  }
  return getGroupPricingConfig(group).dayShiftRate
}

export function resolveGrabShiftBaseHourlyRateDetail(
  group: AttendanceGroup | null | undefined,
  options: {
    date: string
    startTime: string
    holidays?: Holiday[]
  },
) {
  if (!group) {
    return { rate: 0, label: '—', periodKind: 'day' as const, dateKind: 'weekday' as const, periodRate: 0 }
  }
  return resolveHourlyRateForShiftSlot({
    group,
    date: options.date,
    startTime: options.startTime,
    holidays: options.holidays,
  })
}

export function calcGrabShiftEffectiveRate(baseRate: number, subsidy: number): number {
  return Math.round((baseRate + Math.max(0, subsidy)) * 100) / 100
}

/** 从休息文案解析分钟数，如「午餐休30分钟」「上下午各休15分钟」 */
export function parseBreakMinutes(rule?: string, hasBreakTime?: boolean): number {
  if (!hasBreakTime) return 0
  if (!rule?.trim()) return 60
  const nums = [...rule.matchAll(/(\d+(?:\.\d+)?)\s*分/g)].map((m) => Number(m[1]))
  if (nums.length) {
    // 「各休15分钟」类：累加；否则取首个
    if (/各休|各休息/.test(rule) && nums.length === 1) return Math.round(nums[0] * 2)
    return Math.round(nums.reduce((s, n) => s + n, 0))
  }
  const hour = rule.match(/(\d+(?:\.\d+)?)\s*小时/)
  if (hour) return Math.round(Number(hour[1]) * 60)
  return 60
}

/** 按时段与休息计算本次班次工时 */
export function calcGrabShiftWorkHours(
  startTime: string,
  endTime: string,
  breakMinutes = 0,
): number {
  const [sh, sm] = startTime.split(':').map(Number)
  const [eh, em] = endTime.split(':').map(Number)
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return 0
  let start = sh * 60 + sm
  let end = eh * 60 + em
  if (end <= start) end += 24 * 60
  const raw = Math.max(0, end - start - Math.max(0, breakMinutes))
  return Math.round((raw / 60) * 100) / 100
}

/** （基础时薪 + 补贴）× 工时 = 本次费用 */
export function calcGrabShiftSessionFee(
  baseRate: number,
  subsidy: number,
  workHours: number,
): number {
  const hourly = calcGrabShiftEffectiveRate(baseRate, subsidy)
  return Math.round(hourly * Math.max(0, workHours) * 100) / 100
}

/** 按缺口上浮计算可报名人数上限（人 / 百分比） */
export function calcGrabEnrollCap(
  gap: number,
  mode: 'absolute' | 'percent',
  floatValue: number,
): number {
  const g = Math.max(0, Math.floor(gap))
  if (g <= 0) return 0
  const v = Math.max(0, Number(floatValue) || 0)
  if (mode === 'percent') {
    return Math.max(g, Math.ceil(g * (1 + v / 100)))
  }
  return g + Math.floor(v)
}

/** 演示环境“当前时间”，与排班/抢班种子周期对齐 */
export const GRAB_SHIFT_DEMO_NOW = new Date('2026-07-27T10:00:00')

export function parseGrabShiftStartAt(
  slot: Pick<GrabShiftSlot, 'date' | 'startTime'>,
): Date {
  const time = slot.startTime.length === 5 ? `${slot.startTime}:00` : slot.startTime
  return new Date(`${slot.date}T${time}`)
}

/**
 * 历史抢班：已满员 / 已取消 / 已驳回，或开班时间已过
 */
export function isHistoricalGrabSlot(
  slot: Pick<GrabShiftSlot, 'date' | 'startTime' | 'status' | 'publishStatus'>,
  now: Date = GRAB_SHIFT_DEMO_NOW,
): boolean {
  if (slot.status === 'full' || slot.status === 'cancelled') return true
  if (slot.publishStatus === 'rejected') return true
  return parseGrabShiftStartAt(slot).getTime() < now.getTime()
}

/** 抢班历史出勤明细（报名通过且已打卡） */
export interface GrabShiftHistoryRecord {
  id: string
  applicationId: string
  slotId: string
  assignmentId: string
  enterpriseId?: string
  enterpriseName: string
  departmentName: string
  date: string
  shiftName: string
  shiftTimeRange: string
  employeeId: string
  workerName: string
  phone: string
  /** 班次时长（小时） */
  durationHours: number
  /** 预留：评价分 */
  rating?: number | null
  /** 预留：评价内容 */
  ratingComment?: string
}

export function buildGrabShiftHistoryRecords(input: {
  applications: GrabShiftApplication[]
  slots: GrabShiftSlot[]
  assignments: ScheduleAssignment[]
  punches: AttendancePunch[]
  employees: Employee[]
  teams: { id: string; departmentId: string }[]
  departments: Department[]
  resolveEnterpriseId: (attendanceGroupId: string) => string | undefined
  resolveEnterpriseName: (enterpriseId: string | undefined) => string
}): GrabShiftHistoryRecord[] {
  const punchedKeys = new Set(
    input.punches.map((p) => `${p.employeeId}|${p.date}`),
  )

  const rows: GrabShiftHistoryRecord[] = []
  for (const app of input.applications) {
    if (app.status !== 'approved') continue
    const slot = input.slots.find((s) => s.id === app.slotId)
    if (!slot) continue
    const assignment = input.assignments.find(
      (a) =>
        a.fromGrabSlotId === slot.id &&
        a.employeeId === app.employeeId &&
        a.date === slot.date,
    )
    if (!assignment) continue
    if (!punchedKeys.has(`${app.employeeId}|${slot.date}`)) continue

    const emp = input.employees.find((e) => e.id === app.employeeId)
    const enterpriseId = input.resolveEnterpriseId(slot.attendanceGroupId)
    const breakMinutes = parseBreakMinutes(slot.breakRule, slot.hasBreakTime)
    const durationHours = calcGrabShiftWorkHours(slot.startTime, slot.endTime, breakMinutes)

    rows.push({
      id: app.id,
      applicationId: app.id,
      slotId: slot.id,
      assignmentId: assignment.id,
      enterpriseId,
      enterpriseName: input.resolveEnterpriseName(enterpriseId),
      departmentName: resolveGrabSlotDepartmentName(slot, input.teams, input.departments),
      date: slot.date,
      shiftName: resolveGrabSlotShiftName(slot),
      shiftTimeRange: `${slot.startTime}-${slot.endTime}`,
      employeeId: app.employeeId,
      workerName: emp?.name ?? '—',
      phone: emp?.phone?.trim() || '—',
      durationHours,
      rating: null,
      ratingComment: undefined,
    })
  }

  return rows.sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      a.shiftName.localeCompare(b.shiftName) ||
      a.workerName.localeCompare(b.workerName),
  )
}

/**
 * 临班次不足 36 小时且未招满 → 紧急
 * （未招满：已抢人数 < 需求人数，且未取消/已满员）
 */
export function isGrabShiftUrgent(
  slot: Pick<GrabShiftSlot, 'date' | 'startTime' | 'status' | 'requiredCount' | 'grabbedCount'>,
  now: Date = GRAB_SHIFT_DEMO_NOW,
): boolean {
  if (slot.status === 'full' || slot.status === 'cancelled') return false
  if (slot.grabbedCount >= slot.requiredCount) return false
  const hoursLeft =
    (parseGrabShiftStartAt(slot).getTime() - now.getTime()) / (1000 * 60 * 60)
  // 开班前不足 36 小时，或刚开班不久仍未招满
  return hoursLeft < 36 && hoursLeft > -12
}

export function getGrabShiftScopeOptions(
  group: AttendanceGroup | null | undefined,
  departments: Department[],
): GrabShiftScopeOption[] {
  if (!group) return []
  const options: GrabShiftScopeOption[] = [
    { value: GRAB_SHIFT_GLOBAL_TEAM_ID, label: '全局（考勤组）', scope: 'global' },
  ]
  const seen = new Set<string>()
  group.departmentBindings.forEach((binding) => {
    const ids = getDepartmentDescendantIds(departments, binding.departmentId)
    ids.forEach((deptId) => {
      if (seen.has(deptId)) return
      seen.add(deptId)
      const dept = departments.find((d) => d.id === deptId)
      options.push({
        value: deptId,
        label: dept?.name ?? binding.departmentName,
        scope: 'department',
        departmentId: deptId,
      })
    })
  })
  return options
}

export function getGrabShiftTemplateOptions(
  group: AttendanceGroup | null | undefined,
  shifts: Shift[],
): GrabShiftTemplateOption[] {
  if (!group) return []
  return group.shiftTemplates.map((tpl) => ({
    templateId: tpl.id,
    templateName: tpl.name,
    shiftId: resolveShiftIdForTemplate(tpl.name, shifts),
    startTime: tpl.startTime,
    endTime: tpl.endTime,
    breakRule: tpl.breakRule,
  }))
}

export function resolveGrabSlotShiftName(slot: GrabShiftSlot): string {
  if (slot.shiftSource === 'custom' && slot.customShiftName) return slot.customShiftName
  return slot.shiftName
}

export function isGrabSlotVisibleForTeam(
  slot: GrabShiftSlot,
  teamId: string,
  teamDepartmentId?: string,
  attendanceGroupId?: string,
): boolean {
  if (attendanceGroupId && slot.attendanceGroupId !== attendanceGroupId) return false
  if (slot.scope === 'global' || slot.teamId === GRAB_SHIFT_GLOBAL_TEAM_ID) return true
  if (slot.teamId === teamId) return true
  if (slot.departmentId && teamDepartmentId && slot.departmentId === teamDepartmentId) return true
  return false
}

export function summarizeOpenGrabSlotsByDate(
  slots: GrabShiftSlot[],
  dates: string[],
): Map<string, { count: number; labels: string[] }> {
  const map = new Map<string, { count: number; labels: string[] }>()
  dates.forEach((date) => map.set(date, { count: 0, labels: [] }))
  slots.forEach((slot) => {
    if (!dates.includes(slot.date)) return
    if (slot.status === 'cancelled' || slot.status === 'full') return
    const gap = Math.max(0, slot.requiredCount - slot.grabbedCount)
    if (gap <= 0) return
    const item = map.get(slot.date) ?? { count: 0, labels: [] }
    item.count += gap
    item.labels.push(`${resolveGrabSlotShiftName(slot)}缺${gap}`)
    map.set(slot.date, item)
  })
  return map
}

export function buildGrabShiftSlotPayload(options: {
  group: AttendanceGroup
  scopeOption: GrabShiftScopeOption
  shiftMode: 'template' | 'custom'
  template?: GrabShiftTemplateOption | AttendanceGroupShiftTemplate
  customShiftName?: string
  startTime: string
  endTime: string
  hasBreakTime: boolean
  breakRule?: string
  date: string
  requiredCount: number
  enrollFloatMode?: 'absolute' | 'percent'
  enrollFloatValue?: number
  hourlySubsidy: number
  positionName: string
  positionId?: string
  positionProfile?: GrabInterviewPositionProfile
  positionRequirement: string
  requirements: string[]
  teams: { id: string; name: string; departmentId: string; attendanceGroupId?: string }[]
  shifts: Shift[]
  holidays?: Holiday[]
}): Omit<GrabShiftSlot, 'id' | 'createdAt' | 'grabbedCount' | 'status'> {
  const {
    group,
    scopeOption,
    shiftMode,
    template,
    customShiftName,
    startTime,
    endTime,
    hasBreakTime,
    breakRule,
    date,
    requiredCount,
    enrollFloatMode = 'absolute',
    enrollFloatValue = 0,
    hourlySubsidy,
    positionName,
    positionId,
    positionProfile,
    positionRequirement,
    requirements,
    teams,
    shifts,
    holidays = [],
  } = options
  const enrollCap = calcGrabEnrollCap(requiredCount, enrollFloatMode, enrollFloatValue)

  const baseHourlyRate = resolveGrabShiftBaseHourlyRate(group, { date, startTime, holidays })
  const effectiveHourlyRate = calcGrabShiftEffectiveRate(baseHourlyRate, hourlySubsidy)

  const team =
    scopeOption.scope === 'department' && scopeOption.departmentId
      ? teams.find((t) => t.departmentId === scopeOption.departmentId)
      : teams.find((t) => t.attendanceGroupId === group.id)

  const shiftName =
    shiftMode === 'custom'
      ? customShiftName?.trim() || '自定义班次'
      : (template as GrabShiftTemplateOption)?.templateName ??
        (template as AttendanceGroupShiftTemplate)?.name ??
        '班次'

  const shiftId =
    shiftMode === 'custom'
      ? 'shift_custom'
      : (template as GrabShiftTemplateOption)?.shiftId ??
        resolveShiftIdForTemplate(
          (template as AttendanceGroupShiftTemplate)?.name ?? shiftName,
          shifts,
        ) ??
        'shift_custom'

  return {
    attendanceGroupId: group.id,
    scope: scopeOption.scope,
    departmentId: scopeOption.departmentId,
    departmentName: scopeOption.scope === 'department' ? scopeOption.label : undefined,
    teamId:
      scopeOption.scope === 'global'
        ? GRAB_SHIFT_GLOBAL_TEAM_ID
        : team?.id ?? scopeOption.departmentId ?? GRAB_SHIFT_GLOBAL_TEAM_ID,
    teamName:
      scopeOption.scope === 'global' ? '全局' : scopeOption.label ?? team?.name ?? '部门',
    shiftSource: shiftMode,
    shiftTemplateId:
      shiftMode === 'template'
        ? (template as GrabShiftTemplateOption)?.templateId ??
          (template as AttendanceGroupShiftTemplate)?.id
        : undefined,
    customShiftName: shiftMode === 'custom' ? shiftName : undefined,
    shiftId,
    shiftName,
    date,
    startTime,
    endTime,
    hasBreakTime,
    breakRule: hasBreakTime ? breakRule?.trim() || undefined : undefined,
    requiredCount,
    enrollFloatMode,
    enrollFloatValue: Math.max(0, enrollFloatValue),
    enrollCap,
    requirements,
    positionName: positionName.trim(),
    positionId: positionId || undefined,
    positionProfile: positionProfile
      ? {
          ...positionProfile,
          positionName: (positionProfile.positionName || positionName).trim(),
          skills: requirements,
        }
      : undefined,
    positionRequirement: positionRequirement.trim(),
    hourlySubsidy: Math.max(0, hourlySubsidy),
    baseHourlyRate,
    effectiveHourlyRate,
  }
}

/** 抢班发布常用岗位名称 */
export const grabShiftPositionOptions = [
  '营业厅营业员',
  '终端销售员',
  '营业厅导购',
  '收银员',
  '班组长',
  '安全员',
  '理货员',
]

/** 解析抢班班次所属部门 ID（含班组回退） */
export function resolveGrabSlotDepartmentId(
  slot: Pick<GrabShiftSlot, 'departmentId' | 'teamId'>,
  teams: { id: string; departmentId: string }[],
): string | undefined {
  if (slot.departmentId) return slot.departmentId
  return teams.find((t) => t.id === slot.teamId)?.departmentId
}

/** 解析抢班班次部门展示名 */
export function resolveGrabSlotDepartmentName(
  slot: Pick<GrabShiftSlot, 'departmentId' | 'departmentName' | 'teamId' | 'scope'>,
  teams: { id: string; departmentId: string }[],
  departments: { id: string; name: string }[],
): string {
  if (slot.departmentName?.trim()) return slot.departmentName
  const deptId = resolveGrabSlotDepartmentId(slot, teams)
  if (deptId) {
    return departments.find((d) => d.id === deptId)?.name ?? '—'
  }
  if (slot.scope === 'global' || slot.teamId === GRAB_SHIFT_GLOBAL_TEAM_ID) return '全局'
  return '—'
}

/** 是否已通过发布审批（上架小程序） */
export function isGrabShiftPublished(slot: Pick<GrabShiftSlot, 'publishStatus'>) {
  return !slot.publishStatus || slot.publishStatus === 'published'
}

/** 灵工小程序是否可见可报名 */
export function isGrabShiftOpenForWorkers(
  slot: Pick<GrabShiftSlot, 'status' | 'publishStatus'>,
) {
  return isGrabShiftPublished(slot) && (slot.status === 'open' || slot.status === 'partial')
}

export const grabShiftPublishStatusMap: Record<
  import('@/types').GrabShiftPublishStatus,
  { label: string; type: 'warning' | 'success' | 'danger' | 'info' }
> = {
  pending: { label: '待审核', type: 'warning' },
  published: { label: '已上架', type: 'success' },
  rejected: { label: '已驳回', type: 'danger' },
}

export function formatGrabPositionGender(
  gender?: GrabInterviewPositionProfile['gender'],
): string {
  if (gender === 'male') return '男'
  if (gender === 'female') return '女'
  return '不限'
}

export function formatGrabPositionAgeRange(ageMin?: number, ageMax?: number): string {
  if (ageMin != null && ageMax != null) return `${ageMin}–${ageMax}岁`
  if (ageMin != null) return `${ageMin}岁以上`
  if (ageMax != null) return `${ageMax}岁以下`
  return '不限'
}

/** 班次岗位画像：优先用发布快照，旧数据回退岗位要求/技能 */
export function resolveGrabSlotPositionProfile(slot: {
  positionName?: string
  positionProfile?: GrabInterviewPositionProfile
  positionRequirement?: string
  requirements?: string[]
}): GrabInterviewPositionProfile {
  const base = slot.positionProfile
  return {
    positionName: (base?.positionName || slot.positionName || '').trim(),
    jobType: base?.jobType,
    skills: base?.skills?.length ? base.skills : slot.requirements,
    requirements: base?.requirements?.trim() || slot.positionRequirement,
    description: base?.description,
    ageMin: base?.ageMin,
    ageMax: base?.ageMax,
    gender: base?.gender ?? 'any',
    experience: base?.experience,
  }
}
