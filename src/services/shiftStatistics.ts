import { normalizeConfirmStatus } from '@/constants/schedule'
import { getDatesBetween } from '@/services/attendance'
import { isGrabShiftPublished } from '@/services/grabShift'
import type {
  AttendanceGroup,
  CancelShiftRequest,
  Department,
  Enterprise,
  GrabShiftSlot,
  ScheduleAssignment,
  Shift,
  Team,
} from '@/types'
import { resolveEnterpriseIdByAttendanceGroup, resolveEnterpriseIdByDepartment } from '@/utils/enterpriseScope'

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
}

export interface ShiftTrendPoint {
  label: string
  fillRate: number
  gapRate: number
}

function inRange(day: string, start: string, end: string) {
  return day >= start && day <= end
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
  enterpriseIds?: string[]
}): {
  summary: ShiftStatsSummary
  typeDist: ShiftTypeBucket[]
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

  const typeMap = new Map<ShiftKind, number>()
  for (const s of activeSlots) {
    const cat = shiftById.get(s.shiftId)
    const kind = classifyShiftKind(
      s.startTime,
      s.shiftName || s.customShiftName || cat?.name,
      cat?.code,
    )
    typeMap.set(kind, (typeMap.get(kind) ?? 0) + 1)
  }
  for (const key of scheduleShiftKeys) {
    const shiftId = key.split('|')[2]
    const shift = shiftById.get(shiftId)
    const kind = classifyShiftKind(shift?.startTime ?? '08:00', shift?.name, shift?.code)
    typeMap.set(kind, (typeMap.get(kind) ?? 0) + 1)
  }
  const order: ShiftKind[] = ['早班', '中班', '晚班', '夜班', '其他']
  const typeDist = order
    .map((name) => ({ name, value: typeMap.get(name) ?? 0 }))
    .filter((x) => x.value > 0)

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
    }
    row.publishedShifts += patch.publishedShifts ?? 0
    row.totalPositions += patch.totalPositions ?? 0
    row.confirmedCount += patch.confirmedCount ?? 0
    row.cancelled += patch.cancelled ?? 0
    row.slotTotal += patch.slotTotal ?? 0
    detailMap.set(key, row)
  }

  for (const s of slots) {
    const entId = resolveEnterpriseIdByAttendanceGroup(
      input.attendanceGroups.find((g) => g.id === s.attendanceGroupId),
      input.departments,
    )
    const jobType =
      s.positionProfile?.jobType || s.positionName || s.shiftName || '通用岗位'
    bump(entId, jobType, {
      publishedShifts: s.status === 'cancelled' ? 0 : 1,
      totalPositions: s.status === 'cancelled' ? 0 : s.requiredCount || 0,
      confirmedCount: s.status === 'cancelled' ? 0 : s.grabbedCount || 0,
      cancelled: s.status === 'cancelled' ? 1 : 0,
      slotTotal: 1,
    })
  }

  const scheduleAgg = new Map<
    string,
    { entId: string; jobType: string; count: number; confirmed: number }
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
    const isConfirmed = normalizeConfirmStatus(a.confirmStatus) === 'confirmed'
    if (!prev) {
      scheduleAgg.set(cellKey, {
        entId,
        jobType,
        count: 1,
        confirmed: isConfirmed ? 1 : 0,
      })
    } else {
      prev.count += 1
      prev.confirmed += isConfirmed ? 1 : 0
    }
  }
  for (const cell of scheduleAgg.values()) {
    bump(cell.entId, cell.jobType, {
      publishedShifts: 1,
      totalPositions: cell.count,
      confirmedCount: cell.confirmed,
    })
  }

  const details: ShiftStatsDetailRow[] = [...detailMap.values()]
    .map((r) => {
      const fillRate = r.totalPositions
        ? Math.round((r.confirmedCount / r.totalPositions) * 1000) / 10
        : 0
      const gapCount = Math.max(0, r.totalPositions - r.confirmedCount)
      const cancelRate = r.slotTotal ? Math.round((r.cancelled / r.slotTotal) * 1000) / 10 : 0
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
    },
    typeDist,
    details,
  }
}

export function buildShiftFillGapTrend(
  start: string,
  end: string,
  mode: 'day' | 'week' | 'month',
  grabSlots: GrabShiftSlot[],
  enterpriseIds?: string[],
  attendanceGroups?: AttendanceGroup[],
  departments?: Department[],
): ShiftTrendPoint[] {
  const dates = getDatesBetween(start, end)
  const buckets = new Map<string, { required: number; grabbed: number; label: string }>()

  const filterSlot = (s: GrabShiftSlot) => {
    if (!enterpriseIds?.length || !attendanceGroups || !departments) return true
    const entId = resolveEnterpriseIdByAttendanceGroup(
      attendanceGroups.find((g) => g.id === s.attendanceGroupId),
      departments,
    )
    return enterpriseIds.includes(entId)
  }

  for (const day of dates) {
    let label = day.slice(5)
    if (mode === 'week') {
      const d = new Date(day)
      const oneJan = new Date(d.getFullYear(), 0, 1)
      const week = Math.ceil(((d.getTime() - oneJan.getTime()) / 86400000 + oneJan.getDay() + 1) / 7)
      label = `W${week}`
    } else if (mode === 'month') {
      label = day.slice(0, 7)
    }
    if (!buckets.has(label)) buckets.set(label, { required: 0, grabbed: 0, label })
  }

  for (const s of grabSlots) {
    if (!inRange(s.date, start, end) || s.status === 'cancelled' || !isGrabShiftPublished(s) || !filterSlot(s))
      continue
    let label = s.date.slice(5)
    if (mode === 'week') {
      const d = new Date(s.date)
      const oneJan = new Date(d.getFullYear(), 0, 1)
      const week = Math.ceil(((d.getTime() - oneJan.getTime()) / 86400000 + oneJan.getDay() + 1) / 7)
      label = `W${week}`
    } else if (mode === 'month') {
      label = s.date.slice(0, 7)
    }
    const b = buckets.get(label) ?? { required: 0, grabbed: 0, label }
    b.required += s.requiredCount || 0
    b.grabbed += s.grabbedCount || 0
    buckets.set(label, b)
  }

  return [...buckets.values()].map((b) => ({
    label: b.label,
    fillRate: b.required ? Math.round((b.grabbed / b.required) * 1000) / 10 : 0,
    gapRate: b.required
      ? Math.round((Math.max(0, b.required - b.grabbed) / b.required) * 1000) / 10
      : 0,
  }))
}
