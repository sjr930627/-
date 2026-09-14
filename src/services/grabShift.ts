import type {
  AttendanceGroup,
  AttendanceGroupShiftTemplate,
  AttendancePunch,
  Department,
  Employee,
  GrabInterviewPositionProfile,
  GrabPublishScope,
  GrabShiftApplication,
  GrabShiftBreakPeriod,
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
import { resolveEnterpriseIdByAttendanceGroup, resolveEnterpriseIdByDepartment } from '@/utils/enterpriseScope'
import { getDepartmentDescendantIds } from '@/utils'
import { segmentFromAbsRange, type ScheduleTimeSegment } from '@/constants/schedule'

export const GRAB_SHIFT_GLOBAL_TEAM_ID = '__global__'

export interface GrabShiftScopeOption {
  value: string
  label: string
  scope: GrabPublishScope
  departmentId?: string
}

export interface GrabShiftTemplateOption {
  templateId: string
  templateName: string
  shiftId: string | null
  startTime: string
  endTime: string
  breakRule?: string
  hasBreakTime?: boolean
  breakPeriods?: GrabShiftBreakPeriod[]
}

function toMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  if ([h, m].some((n) => Number.isNaN(n))) return NaN
  return h * 60 + m
}

/**
 * 时段时长（分钟）。
 * 跨天：结束时间早于开始时间时按次日计算（如 22:00–07:00 = 9h）。
 * 起止相同视为 0（无效时段）。
 */
export function calcTimeRangeMinutes(startTime: string, endTime: string): number {
  let start = toMinutes(startTime)
  let end = toMinutes(endTime)
  if ([start, end].some((n) => Number.isNaN(n))) return 0
  if (end < start) end += 24 * 60
  return Math.max(0, end - start)
}

/** 是否跨天班次（结束时刻早于开始时刻） */
export function isOvernightTimeRange(startTime: string, endTime: string): boolean {
  const start = toMinutes(startTime)
  const end = toMinutes(endTime)
  if ([start, end].some((n) => Number.isNaN(n))) return false
  return end < start
}

/** 展示时段，跨天标注次日，如「22:00-次日07:00」 */
export function formatShiftTimeRangeLabel(startTime: string, endTime: string): string {
  const start = startTime.slice(0, 5)
  const end = endTime.slice(0, 5)
  if (!start || !end) return '—'
  if (isOvernightTimeRange(start, end)) return `${start}-次日${end}`
  return `${start}-${end}`
}

function fromMinutesOfDay(total: number): string {
  const normalized = ((total % (24 * 60)) + 24 * 60) % (24 * 60)
  const h = Math.floor(normalized / 60)
  const m = normalized % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/**
 * 将 HH:mm 映射到班次时间轴偏移（0 … span）。
 * 跨天班仅接受 [start,24:00) ∪ [00:00,end]；同日班仅接受 [start,end]。
 */
export function toShiftTimelineOffset(
  time: string,
  shiftStart: string,
  shiftEnd: string,
): number | null {
  const span = calcTimeRangeMinutes(shiftStart, shiftEnd)
  if (span <= 0) return null
  const s = toMinutes(shiftStart)
  const e = toMinutes(shiftEnd)
  const t = toMinutes(time)
  if ([s, e, t].some((n) => Number.isNaN(n))) return null

  if (isOvernightTimeRange(shiftStart, shiftEnd)) {
    if (t >= s) return t - s
    if (t <= e) return t + 24 * 60 - s
    return null
  }
  if (t < s || t > e) return null
  return t - s
}

function fromShiftTimelineOffset(offset: number, shiftStart: string): string {
  return fromMinutesOfDay(toMinutes(shiftStart) + offset)
}

/** 休息时段是否完全落在班次时段内（含跨天） */
export function isBreakPeriodWithinShift(
  shiftStart: string,
  shiftEnd: string,
  breakStart: string,
  breakEnd: string,
): boolean {
  const span = calcTimeRangeMinutes(shiftStart, shiftEnd)
  if (span <= 0) return false
  if (calcTimeRangeMinutes(breakStart, breakEnd) <= 0) return false
  const startOff = toShiftTimelineOffset(breakStart, shiftStart, shiftEnd)
  const endOff = toShiftTimelineOffset(breakEnd, shiftStart, shiftEnd)
  if (startOff == null || endOff == null) return false
  return endOff > startOff && endOff <= span
}

export function listInvalidBreakPeriodIndexes(
  shiftStart: string,
  shiftEnd: string,
  periods?: GrabShiftBreakPeriod[],
): number[] {
  if (!periods?.length) return []
  return periods
    .map((p, idx) =>
      p.start && p.end && isBreakPeriodWithinShift(shiftStart, shiftEnd, p.start, p.end)
        ? -1
        : idx,
    )
    .filter((idx) => idx >= 0)
}

/** 过滤出落在班次内的有效休息时段 */
export function filterBreakPeriodsWithinShift(
  shiftStart: string,
  shiftEnd: string,
  periods?: GrabShiftBreakPeriod[],
): GrabShiftBreakPeriod[] {
  if (!periods?.length) return []
  return periods.filter(
    (p) => p.start && p.end && isBreakPeriodWithinShift(shiftStart, shiftEnd, p.start, p.end),
  )
}

/** 按班次时段生成默认休息（尽量落在中段） */
export function defaultGrabBreakPeriodsForShift(
  shiftStart: string,
  shiftEnd: string,
): GrabShiftBreakPeriod[] {
  const span = calcTimeRangeMinutes(shiftStart, shiftEnd)
  if (span <= 0) return [{ start: '12:00', end: '13:00' }]
  const breakLen = span >= 180 ? 60 : Math.max(15, Math.min(30, Math.floor(span / 4)))
  if (breakLen >= span) {
    return [
      {
        start: fromShiftTimelineOffset(0, shiftStart),
        end: fromShiftTimelineOffset(span, shiftStart),
      },
    ]
  }
  const startOff = Math.max(0, Math.floor(span / 2) - Math.floor(breakLen / 2))
  const endOff = Math.min(span, startOff + breakLen)
  return [
    {
      start: fromShiftTimelineOffset(startOff, shiftStart),
      end: fromShiftTimelineOffset(endOff, shiftStart),
    },
  ]
}

export function defaultGrabBreakPeriods(): GrabShiftBreakPeriod[] {
  return [{ start: '12:00', end: '13:00' }]
}

/** 休息时间段合计分钟（时段自身也可跨天，如 23:30–00:30） */
export function calcBreakMinutesFromPeriods(periods?: GrabShiftBreakPeriod[]): number {
  if (!periods?.length) return 0
  return periods.reduce((sum, p) => sum + calcTimeRangeMinutes(p.start, p.end), 0)
}

/** 仅累计落在班次内的休息分钟 */
export function calcBreakMinutesWithinShift(
  shiftStart: string,
  shiftEnd: string,
  periods?: GrabShiftBreakPeriod[],
): number {
  return calcBreakMinutesFromPeriods(
    filterBreakPeriodsWithinShift(shiftStart, shiftEnd, periods),
  )
}

/** 休息时间段展示文案，如「12:00-13:00、18:00-18:30」 */
export function formatBreakPeriodsRule(periods?: GrabShiftBreakPeriod[]): string {
  if (!periods?.length) return ''
  return periods
    .filter((p) => p.start && p.end)
    .map((p) => formatShiftTimeRangeLabel(p.start, p.end))
    .join('、')
}

/**
 * 班次起止 − 休息时段 → 工作时段列表（供自定义排班备注多段存储）。
 * 休息空档不计工时；支持跨天班次与跨天休息。
 */
export function buildWorkSegmentsFromShiftWindow(
  shiftStart: string,
  shiftEnd: string,
  breakPeriods?: GrabShiftBreakPeriod[],
): ScheduleTimeSegment[] {
  const start = shiftStart.slice(0, 5)
  const end = shiftEnd.slice(0, 5)
  const span = calcTimeRangeMinutes(start, end)
  if (span <= 0) return []

  const startAbs = toMinutes(start)
  const breakRanges = filterBreakPeriodsWithinShift(start, end, breakPeriods)
    .map((p) => {
      const s = toShiftTimelineOffset(p.start, start, end)
      const e = toShiftTimelineOffset(p.end, start, end)
      if (s == null || e == null || e <= s) return null
      return [s, e] as [number, number]
    })
    .filter((x): x is [number, number] => Boolean(x))
    .sort((a, b) => a[0] - b[0])

  const mergedBreaks: [number, number][] = []
  for (const [s, e] of breakRanges) {
    const last = mergedBreaks[mergedBreaks.length - 1]
    if (!last || s > last[1]) mergedBreaks.push([s, e])
    else last[1] = Math.max(last[1], e)
  }

  const workOffsets: [number, number][] = []
  let cursor = 0
  for (const [bs, be] of mergedBreaks) {
    if (bs > cursor) workOffsets.push([cursor, bs])
    cursor = Math.max(cursor, be)
  }
  if (cursor < span) workOffsets.push([cursor, span])

  return workOffsets.map(([ws, we]) => segmentFromAbsRange(startAbs + ws, startAbs + we))
}

/** 从休息文案解析分钟数，如「午餐休30分钟」「上下午各休15分钟」 */
export function parseBreakMinutes(
  rule?: string,
  hasBreakTime?: boolean,
  periods?: GrabShiftBreakPeriod[],
): number {
  if (!hasBreakTime) return 0
  const fromPeriods = calcBreakMinutesFromPeriods(periods)
  if (fromPeriods > 0) return fromPeriods
  if (!rule?.trim()) return 60
  const nums = [...rule.matchAll(/(\d+(?:\.\d+)?)\s*分/g)].map((m) => Number(m[1]))
  if (nums.length) {
    // 「各休15分钟」类：累加；否则取首个
    if (/各休|各休息/.test(rule) && nums.length === 1) return Math.round(nums[0] * 2)
    return Math.round(nums.reduce((s, n) => s + n, 0))
  }
  const hour = rule.match(/(\d+(?:\.\d+)?)\s*小时/)
  if (hour) return Math.round(Number(hour[1]) * 60)
  // 「12:00-13:00」类时间段文案
  const ranges = [...rule.matchAll(/(\d{1,2}:\d{2})\s*[-~至]\s*(\d{1,2}:\d{2})/g)]
  if (ranges.length) {
    return ranges.reduce((sum, m) => sum + calcTimeRangeMinutes(m[1], m[2]), 0)
  }
  return 60
}

/** 按时段与休息计算本次班次工时（支持跨天） */
export function calcGrabShiftWorkHours(
  startTime: string,
  endTime: string,
  breakMinutes = 0,
): number {
  const raw = Math.max(0, calcTimeRangeMinutes(startTime, endTime) - Math.max(0, breakMinutes))
  return Math.round((raw / 60) * 100) / 100
}

/** 由起止时间 + 休息配置测算工时（休息时段仅计落在班次内的部分） */
export function resolveGrabShiftWorkHoursFromTimes(options: {
  startTime: string
  endTime: string
  hasBreakTime?: boolean
  breakRule?: string
  breakPeriods?: GrabShiftBreakPeriod[]
  /** 已明确的休息分钟（优先） */
  breakMinutes?: number
}): number {
  let breakMinutes = 0
  if (options.breakMinutes != null && !Number.isNaN(options.breakMinutes)) {
    breakMinutes = Math.max(0, options.breakMinutes)
  } else if (options.hasBreakTime && options.breakPeriods?.length) {
    breakMinutes = calcBreakMinutesWithinShift(
      options.startTime,
      options.endTime,
      options.breakPeriods,
    )
  } else {
    breakMinutes = parseBreakMinutes(options.breakRule, options.hasBreakTime, options.breakPeriods)
  }
  return calcGrabShiftWorkHours(options.startTime, options.endTime, breakMinutes)
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
    const breakMinutes = parseBreakMinutes(slot.breakRule, slot.hasBreakTime, slot.breakPeriods)
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
    { value: GRAB_SHIFT_GLOBAL_TEAM_ID, label: '全局', scope: 'global' },
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

/** 按「部门 + 发布范围」构建 scope 选项 */
export function buildGrabPublishScopeOption(
  scope: GrabPublishScope,
  department?: Pick<Department, 'id' | 'name'> | null,
): GrabShiftScopeOption {
  if (scope === 'global') {
    return { value: GRAB_SHIFT_GLOBAL_TEAM_ID, label: '全局', scope: 'global' }
  }
  return {
    value: department?.id ?? '',
    label: department?.name ?? '部门',
    scope: 'department',
    departmentId: department?.id,
  }
}

/** 按部门查找绑定的班次考勤组（含祖先绑定） */
export function findShiftAttendanceGroupForDepartment(
  departmentId: string,
  groups: AttendanceGroup[],
  departments: Department[],
  enterpriseId?: string,
): AttendanceGroup | undefined {
  if (!departmentId) return undefined
  const shiftGroups = groups.filter((g) => {
    if (g.attendanceType !== 'shift') return false
    if (!enterpriseId) return true
    return resolveEnterpriseIdByAttendanceGroup(g, departments) === enterpriseId
  })
  return (
    shiftGroups.find((g) =>
      g.departmentBindings.some((b) =>
        getDepartmentDescendantIds(departments, b.departmentId).has(departmentId),
      ),
    ) ??
    // 部门未直接绑定时：同企业下任意班次考勤组（用于全局发布仍可选班次模板）
    (enterpriseId ? shiftGroups[0] : undefined)
  )
}

export function isEmployeeInEnterpriseGrabPool(
  employee: Pick<Employee, 'personnelCategory' | 'enterpriseId' | 'departmentId'> | undefined,
  enterpriseId: string,
  departments: Array<Pick<Department, 'id'> & { enterpriseId?: string; parentId?: string | null }>,
): boolean {
  if (!employee || employee.personnelCategory !== 'grab') return false
  const empEnt =
    employee.enterpriseId ||
    resolveEnterpriseIdByDepartment(employee.departmentId, departments as Department[])
  return empEnt === enterpriseId
}

export function isEmployeeInDepartmentGrabPool(
  employee: Pick<Employee, 'personnelCategory' | 'departmentId'> | undefined,
  departmentId: string,
  departments: Array<Pick<Department, 'id'> & { parentId?: string | null }>,
): boolean {
  if (!employee || employee.personnelCategory !== 'grab' || !departmentId) return false
  return getDepartmentDescendantIds(departments as Department[], departmentId).has(
    employee.departmentId,
  )
}

/** 普通抢班：全局=全域可见；部门=仅部门抢班池 */
export function isGrabSlotVisibleToWorker(
  slot: GrabShiftSlot,
  worker: Pick<Employee, 'personnelCategory' | 'enterpriseId' | 'departmentId'> | undefined,
  teams: { id: string; departmentId: string }[],
  departments: Array<Pick<Department, 'id'> & { parentId?: string | null }>,
): boolean {
  if (!isGrabShiftOpenForWorkers(slot)) return false
  if (!worker) return false
  const isGlobal = slot.scope === 'global' || slot.teamId === GRAB_SHIFT_GLOBAL_TEAM_ID
  if (isGlobal) return true
  const deptId = resolveGrabSlotDepartmentId(slot, teams)
  if (!deptId) return false
  return isEmployeeInDepartmentGrabPool(worker, deptId, departments)
}

/** 抢班直面：对企业抢班池人员可见（面试配置不再区分发布范围） */
export function isGrabInterviewVisibleToWorker(
  post: {
    enterpriseId: string
  },
  worker: Pick<Employee, 'personnelCategory' | 'enterpriseId' | 'departmentId'> | undefined,
  departments: Array<Pick<Department, 'id'> & { parentId?: string | null; enterpriseId?: string }>,
): boolean {
  if (!worker) return false
  return isEmployeeInEnterpriseGrabPool(worker, post.enterpriseId, departments)
}

export function getGrabShiftTemplateOptions(
  group: AttendanceGroup | null | undefined,
  shifts: Shift[],
): GrabShiftTemplateOption[] {
  if (!group) return []
  return group.shiftTemplates.map((tpl) => {
    const normalized = normalizeAttendanceShiftTemplateBreak(tpl)
    return {
      templateId: tpl.id,
      templateName: tpl.name,
      shiftId: resolveShiftIdForTemplate(tpl.name, shifts),
      startTime: tpl.startTime,
      endTime: tpl.endTime,
      breakRule: normalized.breakRule,
      hasBreakTime: normalized.hasBreakTime,
      breakPeriods: normalized.breakPeriods,
    }
  })
}

/** 规范化考勤组班次休息：优先时间段；旧文案迁移为班次内默认时段 */
export function normalizeAttendanceShiftTemplateBreak(
  tpl: Pick<
    AttendanceGroupShiftTemplate,
    'startTime' | 'endTime' | 'breakRule' | 'hasBreakTime' | 'breakPeriods'
  >,
): {
  hasBreakTime: boolean
  breakPeriods: GrabShiftBreakPeriod[]
  breakRule?: string
} {
  const start = tpl.startTime?.slice(0, 5) || '09:00'
  const end = tpl.endTime?.slice(0, 5) || '18:00'
  if (tpl.breakPeriods?.length) {
    const periods = filterBreakPeriodsWithinShift(start, end, tpl.breakPeriods)
    const hasBreakTime = tpl.hasBreakTime !== false && periods.length > 0
    return {
      hasBreakTime,
      breakPeriods: hasBreakTime ? periods : [],
      breakRule: hasBreakTime ? formatBreakPeriodsRule(periods) : undefined,
    }
  }
  const legacy = Boolean(tpl.breakRule?.trim())
  const hasBreakTime = tpl.hasBreakTime ?? legacy
  if (!hasBreakTime) {
    return { hasBreakTime: false, breakPeriods: [], breakRule: undefined }
  }
  const periods = defaultGrabBreakPeriodsForShift(start, end)
  return {
    hasBreakTime: true,
    breakPeriods: periods,
    breakRule: formatBreakPeriodsRule(periods) || tpl.breakRule?.trim(),
  }
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
  breakPeriods?: GrabShiftBreakPeriod[]
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
    breakPeriods,
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
    breakRule: hasBreakTime
      ? formatBreakPeriodsRule(
          filterBreakPeriodsWithinShift(startTime, endTime, breakPeriods),
        ) || breakRule?.trim() || undefined
      : undefined,
    breakPeriods: hasBreakTime
      ? filterBreakPeriodsWithinShift(startTime, endTime, breakPeriods)
      : undefined,
    breakMinutes: hasBreakTime
      ? breakPeriods?.length
        ? calcBreakMinutesWithinShift(startTime, endTime, breakPeriods)
        : parseBreakMinutes(breakRule, true, breakPeriods)
      : 0,
    workHours: resolveGrabShiftWorkHoursFromTimes({
      startTime,
      endTime,
      hasBreakTime,
      breakRule,
      breakPeriods,
    }),
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
  return isGrabShiftPublished(slot) && (slot.status === 'open' || (slot.status as string) === 'partial')
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
