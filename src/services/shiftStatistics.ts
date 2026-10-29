import { normalizeConfirmStatus } from '@/constants/schedule'
import { WORKBENCH_DEMO_NOW } from '@/constants/workbenchReminder'
import { getDatesBetween } from '@/services/attendance'
import { isGrabShiftPublished } from '@/services/grabShift'
import type {
  AttendanceGroup,
  AttendancePunch,
  CancelShiftRequest,
  Department,
  Enterprise,
  GrabShiftApplication,
  GrabShiftSlot,
  ScheduleAssignment,
  Shift,
  Team,
} from '@/types'
import { resolveEnterpriseIdByAttendanceGroup, resolveEnterpriseIdByDepartment } from '@/utils/enterpriseScope'

const HOUR_MS = 60 * 60 * 1000

export type ShiftKind = '早班' | '中班' | '晚班' | '夜班' | '其他'

export function classifyShiftKind(
  startTime: string,
  name?: string,
  code?: string,
): ShiftKind {
  const c = (code || '').toUpperCase()
  if (c === 'MORNING') return '早班'
  if (c === 'AFTERNOON') return '中班'
  if (c === 'NIGHT') {
    if (name && /夜|大晚/.test(name)) return '夜班'
    const hour = Number((startTime || '00:00').slice(0, 2))
    return !Number.isNaN(hour) && (hour >= 22 || hour < 5) ? '夜班' : '晚班'
  }
  if (name) {
    if (/早/.test(name)) return '早班'
    if (/中|午/.test(name)) return '中班'
    if (/夜|大晚/.test(name)) return '夜班'
    if (/晚/.test(name)) return '晚班'
  }
  const hour = Number((startTime || '00:00').slice(0, 2))
  if (Number.isNaN(hour)) return '其他'
  if (hour >= 5 && hour < 10) return '早班'
  if (hour >= 10 && hour < 14) return '中班'
  if (hour >= 14 && hour < 18) return '晚班'
  if (hour >= 18 || hour < 5) return hour >= 22 || hour < 5 ? '夜班' : '晚班'
  return '其他'
}

function parseCity(address?: string) {
  if (!address) return '—'
  const m = address.match(/(北京|上海|天津|重庆|杭州|广州|深圳|成都|武汉|南京|苏州|西安|青岛|厦门|长沙|郑州|合肥|宁波|东莞|佛山)/)
  return m?.[1] ?? '—'
}

export interface ShiftStatsSummary {
  publishedShifts: number
  totalPositions: number
  confirmedCount: number
  fillRate: number
  gapCount: number
  gapRate: number
  cancelRate: number
  cancelledShifts: number
  cancelledHours: number
  /** 排班班次数：日期×班次×班组去重，不含休息、不含抢班转入 */
  scheduleShiftCount: number
  /** 已审批通过的排班取消，按日期×班次×班组去重 */
  scheduleCancelled: number
  /** 排班发布人次（不含休息、不含抢班转入） */
  schedulePublished: number
  scheduleConfirmed: number
  scheduleArrived: number
  /** 班次确认率；无发布排班时为 null */
  confirmRate: number | null
  /** 班次履约率（到岗）；无已确认排班时为 null */
  fulfillRate: number | null
  grabSlotCount: number
  grabRequired: number
  grabGrabbed: number
  /** 抢班满员率；无抢班工位时为 null */
  grabFillRate: number | null
  /** 已抢满且能算出时长的班次数 */
  filledSlotCount: number
  /** 已抢满班次的平均抢满时长（小时）；无法计算时为 null */
  avgFillHours: number | null
  /** 发布满 24 小时仍未满员的抢班班次数 */
  urgentShifts: number
  /** 上述紧急班次的缺编人数 */
  urgentGapHeadcount: number
}

/** 环比对比。neutral 表示没有可比基期 */
export interface MetricCompare {
  label: string
  text: string
  up: boolean
  neutral: boolean
  positive: boolean
}

export interface ShiftTypeBucket {
  name: ShiftKind
  value: number
}

export interface ShiftStatsDetailRow {
  enterpriseId: string
  enterpriseName: string
  region: string
  jobType: string
  publishedShifts: number
  totalPositions: number
  confirmedCount: number
  fillRate: number
  gapCount: number
  cancelRate: number
  scheduleShiftCount: number
  scheduleCancelled: number
  grabShiftCount: number
  confirmRate: number | null
  fulfillRate: number | null
  grabFillRate: number | null
  avgFillHours: number | null
  urgentShifts: number
  urgentGapHeadcount: number
}

export interface ShiftTrendPoint {
  label: string
  confirmRate: number
  grabFillRate: number
}

function inRange(day: string, start: string, end: string) {
  return day >= start && day <= end
}

function round1(n: number) {
  return Math.round(n * 10) / 10
}

function percent(part: number, total: number): number | null {
  if (!total) return null
  return round1((part / total) * 100)
}

export function shiftDateByYears(ymd: string, years: number) {
  const [y, m, d] = ymd.split('-').map(Number)
  const dt = new Date(y + years, m - 1, d)
  const pad = (n: number) => String(n).padStart(2, '0')
  if (dt.getMonth() !== m - 1) {
    const last = new Date(y + years, m, 0)
    return `${last.getFullYear()}-${pad(m)}-${pad(last.getDate())}`
  }
  return `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}`
}

/** 比率、时长、次数的环比。current/previous 为 null 表示该期没有样本 */
export function compareMetric(
  current: number | null,
  previous: number | null,
  higherIsBetter = true,
): Omit<MetricCompare, 'label'> {
  if (current == null || previous == null) {
    return { text: '—', up: true, neutral: true, positive: true }
  }
  if (previous === 0 && current === 0) {
    return { text: '0%', up: true, neutral: true, positive: true }
  }
  if (previous === 0) {
    return { text: '新增', up: true, neutral: false, positive: higherIsBetter }
  }
  const pct = round1(((current - previous) / Math.abs(previous)) * 100)
  const up = pct >= 0
  return {
    text: pct === 0 ? '0%' : `${Math.abs(pct)}%`,
    up,
    neutral: pct === 0,
    positive: higherIsBetter ? pct >= 0 : pct <= 0,
  }
}

export function formatFillDuration(hours: number | null) {
  if (hours == null || Number.isNaN(hours)) return { value: '—', suffix: '' }
  if (hours < 1) return { value: String(Math.max(1, Math.round(hours * 60))), suffix: '分钟' }
  return { value: String(round1(hours)), suffix: '小时' }
}

function isScheduleStatAssignment(assignment: ScheduleAssignment, shift?: Shift) {
  if (!assignment.published || assignment.fromGrabSlotId) return false
  if (shift?.code === 'REST') return false
  return true
}

function approvedFillTimes(slotId: string, applications: GrabShiftApplication[]) {
  return applications
    .filter((a) => a.slotId === slotId && a.status === 'approved')
    .map((a) => new Date(a.reviewedAt || a.createdAt).getTime())
    .filter((t) => !Number.isNaN(t))
    .sort((a, b) => a - b)
}

/** 抢满时刻取第 N 条已通过报名的审核时间；未满或缺少时间戳则不算时长 */
function grabSlotTiming(slot: GrabShiftSlot, applications: GrabShiftApplication[], nowMs: number) {
  const required = slot.requiredCount || 0
  const grabbed = required > 0 ? Math.min(slot.grabbedCount || 0, required) : 0
  const isFull = required > 0 && (slot.status === 'full' || (slot.grabbedCount || 0) >= required)
  const publishedAt = new Date(slot.createdAt).getTime()
  const times = approvedFillTimes(slot.id, applications)
  let fillAt: number | null = null
  if (isFull && times.length >= required) fillAt = times[required - 1]
  else if (isFull && times.length > 0) fillAt = times[times.length - 1]
  const fillHours =
    isFull && fillAt != null && !Number.isNaN(publishedAt)
      ? Math.max(0, (fillAt - publishedAt) / HOUR_MS)
      : null
  const gapHeadcount = isFull ? 0 : Math.max(0, required - (slot.grabbedCount || 0))
  const windowClosed = !Number.isNaN(publishedAt) && publishedAt + 24 * HOUR_MS <= nowMs
  return {
    required,
    grabbed,
    fillHours,
    gapHeadcount,
    urgent: windowClosed && gapHeadcount > 0,
  }
}

interface SplitAccum {
  schedulePublished: number
  scheduleConfirmed: number
  scheduleArrived: number
  grabSlotCount: number
  grabRequired: number
  grabGrabbed: number
  fillHoursSum: number
  filledWithDuration: number
  urgentShifts: number
  urgentGapHeadcount: number
}

function emptySplit(): SplitAccum {
  return {
    schedulePublished: 0,
    scheduleConfirmed: 0,
    scheduleArrived: 0,
    grabSlotCount: 0,
    grabRequired: 0,
    grabGrabbed: 0,
    fillHoursSum: 0,
    filledWithDuration: 0,
    urgentShifts: 0,
    urgentGapHeadcount: 0,
  }
}

function finalizeSplit(acc: SplitAccum): Pick<
  ShiftStatsSummary,
  | 'schedulePublished'
  | 'scheduleConfirmed'
  | 'scheduleArrived'
  | 'confirmRate'
  | 'fulfillRate'
  | 'grabSlotCount'
  | 'grabRequired'
  | 'grabGrabbed'
  | 'grabFillRate'
  | 'filledSlotCount'
  | 'avgFillHours'
  | 'urgentShifts'
  | 'urgentGapHeadcount'
> {
  return {
    schedulePublished: acc.schedulePublished,
    scheduleConfirmed: acc.scheduleConfirmed,
    scheduleArrived: acc.scheduleArrived,
    confirmRate: percent(acc.scheduleConfirmed, acc.schedulePublished),
    fulfillRate: percent(acc.scheduleArrived, acc.scheduleConfirmed),
    grabSlotCount: acc.grabSlotCount,
    grabRequired: acc.grabRequired,
    grabGrabbed: acc.grabGrabbed,
    grabFillRate: percent(acc.grabGrabbed, acc.grabRequired),
    filledSlotCount: acc.filledWithDuration,
    avgFillHours: acc.filledWithDuration
      ? round1(acc.fillHoursSum / acc.filledWithDuration)
      : null,
    urgentShifts: acc.urgentShifts,
    urgentGapHeadcount: acc.urgentGapHeadcount,
  }
}

/** 聚合排班发布 + 抢班池，口径对齐班次统计看板 */
export function buildShiftStatistics(input: {
  start: string
  end: string
  grabSlots: GrabShiftSlot[]
  assignments: ScheduleAssignment[]
  shifts: Shift[]
  teams: Team[]
  departments: Department[]
  enterprises: Enterprise[]
  attendanceGroups: AttendanceGroup[]
  cancelShiftRequests?: CancelShiftRequest[]
  applications?: GrabShiftApplication[]
  punches?: AttendancePunch[]
  now?: Date
  enterpriseIds?: string[]
}): {
  summary: ShiftStatsSummary
  details: ShiftStatsDetailRow[]
} {
  const entFilter = input.enterpriseIds?.length ? new Set(input.enterpriseIds) : null

  const shiftById = new Map(input.shifts.map((s) => [s.id, s]))
  const teamById = new Map(input.teams.map((t) => [t.id, t]))

  const slots = input.grabSlots.filter((s) => {
    if (!inRange(s.date, input.start, input.end)) return false
    if (!isGrabShiftPublished(s) && s.status !== 'cancelled') return false
    const entId = resolveEnterpriseIdByAttendanceGroup(
      input.attendanceGroups.find((g) => g.id === s.attendanceGroupId),
      input.departments,
    )
    if (entFilter && !entFilter.has(entId)) return false
    return true
  })

  const publishedAssignments = input.assignments.filter((a) => {
    if (!a.published || !inRange(a.date, input.start, input.end)) return false
    const shift = shiftById.get(a.shiftId)
    if (shift?.code === 'REST') return false
    if (!entFilter) return true
    const team = a.teamId ? teamById.get(a.teamId) : undefined
    const entId = team
      ? resolveEnterpriseIdByDepartment(team.departmentId, input.departments)
      : undefined
    return entId ? entFilter.has(entId) : true
  })

  /** 发布班次：已上架抢班槽 + 排班「日期×班次×班组」去重 */
  const scheduleShiftKeys = new Set(
    publishedAssignments.map((a) => `${a.teamId ?? ''}|${a.date}|${a.shiftId}`),
  )
  const activeSlots = slots.filter((s) => s.status !== 'cancelled')
  const publishedShifts = activeSlots.length + scheduleShiftKeys.size

  const totalPositions =
    activeSlots.reduce((s, x) => s + (x.requiredCount || 0), 0) +
    publishedAssignments.length

  const confirmedFromGrab = activeSlots.reduce((s, x) => s + (x.grabbedCount || 0), 0)
  const confirmedFromSchedule = publishedAssignments.filter(
    (a) => normalizeConfirmStatus(a.confirmStatus) === 'confirmed',
  ).length
  const confirmedCount = confirmedFromGrab + confirmedFromSchedule

  const gapCount = activeSlots.reduce(
    (s, x) => s + Math.max(0, (x.requiredCount || 0) - (x.grabbedCount || 0)),
    0,
  )

  const positionsForRate = Math.max(1, totalPositions)
  const fillRate = Math.round((Math.min(confirmedCount, positionsForRate) / positionsForRate) * 1000) / 10
  const gapRate = Math.round((gapCount / positionsForRate) * 1000) / 10

  const nowMs = (input.now ?? WORKBENCH_DEMO_NOW).getTime()
  const applications = input.applications ?? []
  const arrivedKeys = new Set(
    (input.punches ?? [])
      .filter((p) => p.type === 'clock_in')
      .map((p) => `${p.employeeId}|${p.date}`),
  )
  const splitAcc = emptySplit()
  for (const slot of activeSlots) {
    const timing = grabSlotTiming(slot, applications, nowMs)
    splitAcc.grabSlotCount += 1
    splitAcc.grabRequired += timing.required
    splitAcc.grabGrabbed += timing.grabbed
    if (timing.fillHours != null) {
      splitAcc.fillHoursSum += timing.fillHours
      splitAcc.filledWithDuration += 1
    }
    if (timing.urgent) {
      splitAcc.urgentShifts += 1
      splitAcc.urgentGapHeadcount += timing.gapHeadcount
    }
  }
  const scheduleStatShiftKeys = new Set<string>()
  for (const assignment of publishedAssignments) {
    if (!isScheduleStatAssignment(assignment, shiftById.get(assignment.shiftId))) continue
    scheduleStatShiftKeys.add(`${assignment.teamId ?? ''}|${assignment.date}|${assignment.shiftId}`)
    splitAcc.schedulePublished += 1
    const confirmed = normalizeConfirmStatus(assignment.confirmStatus) === 'confirmed'
    if (!confirmed) continue
    splitAcc.scheduleConfirmed += 1
    if (arrivedKeys.has(`${assignment.employeeId}|${assignment.date}`)) splitAcc.scheduleArrived += 1
  }
  const split = finalizeSplit(splitAcc)

  const scheduleCancelledKeys = new Set<string>()
  const scheduleCancelRows: { entId: string; jobType: string }[] = []
  for (const request of input.cancelShiftRequests ?? []) {
    if (request.status !== 'approved' || !inRange(request.date, input.start, input.end)) continue
    if (request.source === 'grab' || request.grabSlotId) continue
    const team = request.teamId ? teamById.get(request.teamId) : undefined
    const entId = team
      ? resolveEnterpriseIdByDepartment(team.departmentId, input.departments)
      : undefined
    if (entFilter && (!entId || !entFilter.has(entId))) continue
    const key = `${request.teamId}|${request.date}|${request.shiftId}`
    if (scheduleCancelledKeys.has(key)) continue
    scheduleCancelledKeys.add(key)
    const shift = shiftById.get(request.shiftId)
    scheduleCancelRows.push({
      entId: entId ?? 'unknown',
      jobType: shift?.name || '排班岗位',
    })
  }

  const cancelledSlots = slots.filter((s) => s.status === 'cancelled')
  const approvedCancels = (input.cancelShiftRequests ?? []).filter(
    (r) => r.status === 'approved' && inRange(r.date, input.start, input.end),
  )
  const cancelledShifts = cancelledSlots.length + approvedCancels.length
  const cancelledHours =
    Math.round(
      cancelledSlots.reduce((s, x) => s + (x.workHours ?? 0), 0) * 10,
    ) / 10
  const cancelBase = Math.max(1, slots.length + publishedAssignments.length)
  const cancelRate = Math.round((cancelledShifts / cancelBase) * 1000) / 10

  /** 明细：按企业 × 工种 */
  const detailMap = new Map<
    string,
    {
      enterpriseId: string
      enterpriseName: string
      region: string
      jobType: string
      publishedShifts: number
      totalPositions: number
      confirmedCount: number
      cancelled: number
      slotTotal: number
      scheduleShiftCount: number
      scheduleCancelled: number
      schedulePublished: number
      scheduleConfirmed: number
      scheduleArrived: number
      grabRequired: number
      grabGrabbed: number
      fillHoursSum: number
      filledWithDuration: number
      urgentShifts: number
      urgentGapHeadcount: number
      grabSlots: number
    }
  >()

  function bump(
    enterpriseId: string,
    jobType: string,
    patch: Partial<{
      publishedShifts: number
      totalPositions: number
      confirmedCount: number
      cancelled: number
      slotTotal: number
      scheduleShiftCount: number
      scheduleCancelled: number
      schedulePublished: number
      scheduleConfirmed: number
      scheduleArrived: number
      grabRequired: number
      grabGrabbed: number
      fillHoursSum: number
      filledWithDuration: number
      urgentShifts: number
      urgentGapHeadcount: number
      grabSlots: number
    }>,
  ) {
    const ent = input.enterprises.find((e) => e.id === enterpriseId)
    const key = `${enterpriseId}||${jobType}`
    const row = detailMap.get(key) ?? {
      enterpriseId,
      enterpriseName: ent?.name ?? enterpriseId,
      region: parseCity(ent?.address),
      jobType,
      publishedShifts: 0,
      totalPositions: 0,
      confirmedCount: 0,
      cancelled: 0,
      slotTotal: 0,
      scheduleShiftCount: 0,
      scheduleCancelled: 0,
      schedulePublished: 0,
      scheduleConfirmed: 0,
      scheduleArrived: 0,
      grabRequired: 0,
      grabGrabbed: 0,
      fillHoursSum: 0,
      filledWithDuration: 0,
      urgentShifts: 0,
      urgentGapHeadcount: 0,
      grabSlots: 0,
    }
    row.publishedShifts += patch.publishedShifts ?? 0
    row.totalPositions += patch.totalPositions ?? 0
    row.confirmedCount += patch.confirmedCount ?? 0
    row.cancelled += patch.cancelled ?? 0
    row.slotTotal += patch.slotTotal ?? 0
    row.scheduleShiftCount += patch.scheduleShiftCount ?? 0
    row.scheduleCancelled += patch.scheduleCancelled ?? 0
    row.schedulePublished += patch.schedulePublished ?? 0
    row.scheduleConfirmed += patch.scheduleConfirmed ?? 0
    row.scheduleArrived += patch.scheduleArrived ?? 0
    row.grabRequired += patch.grabRequired ?? 0
    row.grabGrabbed += patch.grabGrabbed ?? 0
    row.fillHoursSum += patch.fillHoursSum ?? 0
    row.filledWithDuration += patch.filledWithDuration ?? 0
    row.urgentShifts += patch.urgentShifts ?? 0
    row.urgentGapHeadcount += patch.urgentGapHeadcount ?? 0
    row.grabSlots += patch.grabSlots ?? 0
    detailMap.set(key, row)
  }

  for (const s of slots) {
    const entId = resolveEnterpriseIdByAttendanceGroup(
      input.attendanceGroups.find((g) => g.id === s.attendanceGroupId),
      input.departments,
    )
    const jobType =
      s.positionProfile?.jobType || s.positionName || s.shiftName || '通用岗位'
    const timing = s.status === 'cancelled' ? null : grabSlotTiming(s, applications, nowMs)
    bump(entId, jobType, {
      publishedShifts: s.status === 'cancelled' ? 0 : 1,
      totalPositions: s.status === 'cancelled' ? 0 : s.requiredCount || 0,
      confirmedCount: s.status === 'cancelled' ? 0 : s.grabbedCount || 0,
      cancelled: s.status === 'cancelled' ? 1 : 0,
      slotTotal: 1,
      grabSlots: timing ? 1 : 0,
      grabRequired: timing?.required ?? 0,
      grabGrabbed: timing?.grabbed ?? 0,
      fillHoursSum: timing?.fillHours ?? 0,
      filledWithDuration: timing?.fillHours != null ? 1 : 0,
      urgentShifts: timing?.urgent ? 1 : 0,
      urgentGapHeadcount: timing?.urgent ? timing.gapHeadcount : 0,
    })
  }

  const scheduleAgg = new Map<
    string,
    {
      entId: string
      jobType: string
      count: number
      confirmed: number
      schedulePublished: number
      scheduleConfirmed: number
      scheduleArrived: number
    }
  >()
  for (const a of publishedAssignments) {
    const team = a.teamId ? teamById.get(a.teamId) : undefined
    const entId = team
      ? resolveEnterpriseIdByDepartment(team.departmentId, input.departments)
      : input.enterprises[0]?.id ?? 'unknown'
    const shift = shiftById.get(a.shiftId)
    const jobType = shift?.name || '排班岗位'
    const cellKey = `${a.teamId ?? ''}|${a.date}|${a.shiftId}`
    const prev = scheduleAgg.get(cellKey)
    const inScheduleStats = isScheduleStatAssignment(a, shift)
    const isConfirmed = inScheduleStats && normalizeConfirmStatus(a.confirmStatus) === 'confirmed'
    const arrived = isConfirmed && arrivedKeys.has(`${a.employeeId}|${a.date}`)
    if (!prev) {
      scheduleAgg.set(cellKey, {
        entId,
        jobType,
        count: 1,
        confirmed: normalizeConfirmStatus(a.confirmStatus) === 'confirmed' ? 1 : 0,
        schedulePublished: inScheduleStats ? 1 : 0,
        scheduleConfirmed: isConfirmed ? 1 : 0,
        scheduleArrived: arrived ? 1 : 0,
      })
    } else {
      prev.count += 1
      prev.confirmed += normalizeConfirmStatus(a.confirmStatus) === 'confirmed' ? 1 : 0
      prev.schedulePublished += inScheduleStats ? 1 : 0
      prev.scheduleConfirmed += isConfirmed ? 1 : 0
      prev.scheduleArrived += arrived ? 1 : 0
    }
  }
  for (const cell of scheduleAgg.values()) {
    bump(cell.entId, cell.jobType, {
      publishedShifts: 1,
      totalPositions: cell.count,
      confirmedCount: cell.confirmed,
      scheduleShiftCount: cell.schedulePublished > 0 ? 1 : 0,
      schedulePublished: cell.schedulePublished,
      scheduleConfirmed: cell.scheduleConfirmed,
      scheduleArrived: cell.scheduleArrived,
    })
  }
  for (const row of scheduleCancelRows) {
    bump(row.entId, row.jobType, { scheduleCancelled: 1 })
  }

  const details: ShiftStatsDetailRow[] = [...detailMap.values()]
    .map((r) => {
      const fillRate = r.totalPositions
        ? Math.round((r.confirmedCount / r.totalPositions) * 1000) / 10
        : 0
      const gapCount = Math.max(0, r.totalPositions - r.confirmedCount)
      const cancelRate = r.slotTotal ? Math.round((r.cancelled / r.slotTotal) * 1000) / 10 : 0
      const rowSplit = finalizeSplit(
        {
          schedulePublished: r.schedulePublished,
          scheduleConfirmed: r.scheduleConfirmed,
          scheduleArrived: r.scheduleArrived,
          grabSlotCount: r.grabSlots,
          grabRequired: r.grabRequired,
          grabGrabbed: r.grabGrabbed,
          fillHoursSum: r.fillHoursSum,
          filledWithDuration: r.filledWithDuration,
          urgentShifts: r.urgentShifts,
          urgentGapHeadcount: r.urgentGapHeadcount,
        },
      )
      return {
        enterpriseId: r.enterpriseId,
        enterpriseName: r.enterpriseName,
        region: r.region,
        jobType: r.jobType,
        publishedShifts: r.publishedShifts,
        totalPositions: r.totalPositions,
        confirmedCount: r.confirmedCount,
        fillRate: Math.min(100, fillRate),
        gapCount,
        cancelRate,
        scheduleShiftCount: r.scheduleShiftCount,
        scheduleCancelled: r.scheduleCancelled,
        grabShiftCount: r.grabSlots,
        confirmRate: rowSplit.confirmRate,
        fulfillRate: rowSplit.fulfillRate,
        grabFillRate: rowSplit.grabFillRate,
        avgFillHours: rowSplit.avgFillHours,
        urgentShifts: rowSplit.urgentShifts,
        urgentGapHeadcount: rowSplit.urgentGapHeadcount,
      }
    })
    .sort((a, b) => b.publishedShifts - a.publishedShifts)

  return {
    summary: {
      publishedShifts,
      totalPositions,
      confirmedCount,
      fillRate: Math.min(100, fillRate),
      gapCount,
      gapRate,
      cancelRate,
      cancelledShifts,
      cancelledHours,
      scheduleShiftCount: scheduleStatShiftKeys.size,
      scheduleCancelled: scheduleCancelledKeys.size,
      ...split,
    },
    details,
  }
}

function bucketLabel(day: string, mode: 'day' | 'week' | 'month') {
  if (mode === 'month') return day.slice(0, 7)
  if (mode === 'week') {
    const d = new Date(day)
    const oneJan = new Date(d.getFullYear(), 0, 1)
    const week = Math.ceil(((d.getTime() - oneJan.getTime()) / 86400000 + oneJan.getDay() + 1) / 7)
    return `W${week}`
  }
  return day.slice(5)
}

export function buildShiftFillGapTrend(input: {
  start: string
  end: string
  mode: 'day' | 'week' | 'month'
  grabSlots: GrabShiftSlot[]
  assignments: ScheduleAssignment[]
  shifts: Shift[]
  teams: Team[]
  departments: Department[]
  attendanceGroups: AttendanceGroup[]
  applications?: GrabShiftApplication[]
  punches?: AttendancePunch[]
  now?: Date
  enterpriseIds?: string[]
}): ShiftTrendPoint[] {
  const dates = getDatesBetween(input.start, input.end)
  const buckets = new Map<string, SplitAccum & { label: string }>()
  const shiftById = new Map(input.shifts.map((s) => [s.id, s]))
  const teamById = new Map(input.teams.map((t) => [t.id, t]))
  const nowMs = (input.now ?? WORKBENCH_DEMO_NOW).getTime()
  const applications = input.applications ?? []
  const arrivedKeys = new Set(
    (input.punches ?? [])
      .filter((p) => p.type === 'clock_in')
      .map((p) => `${p.employeeId}|${p.date}`),
  )
  const entFilter = input.enterpriseIds?.length ? new Set(input.enterpriseIds) : null

  const ensure = (day: string) => {
    const label = bucketLabel(day, input.mode)
    if (!buckets.has(label)) buckets.set(label, { ...emptySplit(), label })
    return buckets.get(label)!
  }

  for (const day of dates) ensure(day)

  for (const slot of input.grabSlots) {
    if (!inRange(slot.date, input.start, input.end) || slot.status === 'cancelled' || !isGrabShiftPublished(slot))
      continue
    const entId = resolveEnterpriseIdByAttendanceGroup(
      input.attendanceGroups.find((g) => g.id === slot.attendanceGroupId),
      input.departments,
    )
    if (entFilter && !entFilter.has(entId)) continue
    const b = ensure(slot.date)
    const timing = grabSlotTiming(slot, applications, nowMs)
    b.grabSlotCount += 1
    b.grabRequired += timing.required
    b.grabGrabbed += timing.grabbed
    if (timing.fillHours != null) {
      b.fillHoursSum += timing.fillHours
      b.filledWithDuration += 1
    }
    if (timing.urgent) {
      b.urgentShifts += 1
      b.urgentGapHeadcount += timing.gapHeadcount
    }
  }

  for (const assignment of input.assignments) {
    const shift = shiftById.get(assignment.shiftId)
    if (!inRange(assignment.date, input.start, input.end) || !isScheduleStatAssignment(assignment, shift)) continue
    if (entFilter) {
      const team = assignment.teamId ? teamById.get(assignment.teamId) : undefined
      const entId = team
        ? resolveEnterpriseIdByDepartment(team.departmentId, input.departments)
        : undefined
      if (entId && !entFilter.has(entId)) continue
    }
    const b = ensure(assignment.date)
    b.schedulePublished += 1
    if (normalizeConfirmStatus(assignment.confirmStatus) !== 'confirmed') continue
    b.scheduleConfirmed += 1
    if (arrivedKeys.has(`${assignment.employeeId}|${assignment.date}`)) b.scheduleArrived += 1
  }

  return [...buckets.values()].map((b) => {
    const split = finalizeSplit(b)
    return {
      label: b.label,
      confirmRate: split.confirmRate ?? 0,
      grabFillRate: split.grabFillRate ?? 0,
    }
  })
}
