export const confirmStatusMap = {
  pending: { label: '待确认', short: '待', color: '#909399', bg: '#f4f4f5' },
  confirmed: { label: '已确认', short: '✓', color: '#67c23a', bg: '#f0f9eb' },
  rejected: { label: '已拒绝', short: '拒', color: '#f56c6c', bg: '#fef0f0' },
} as const

/** 演示锚定「今天」，用于历史/未来排班分界（对齐种子数据） */
export const SCHEDULE_DEMO_TODAY = '2026-07-28'

/** 演示当前时刻，用于判断当天班次是否已开始（对齐取消班次） */
export const SCHEDULE_DEMO_NOW = `${SCHEDULE_DEMO_TODAY}T07:00:00`

export type ScheduleScope = 'history' | 'future'

/** 历史日期：严格早于今天；未来日期：今天及以后 */
export function isScheduleHistoryDate(date: string, today = SCHEDULE_DEMO_TODAY) {
  return date < today
}

export function isScheduleFutureDate(date: string, today = SCHEDULE_DEMO_TODAY) {
  return date >= today
}

export function filterDatesByScheduleScope(
  dates: string[],
  scope: ScheduleScope,
  today = SCHEDULE_DEMO_TODAY,
) {
  return dates.filter((d) =>
    scope === 'history' ? isScheduleHistoryDate(d, today) : isScheduleFutureDate(d, today),
  )
}

export function filterMutableScheduleDates(dates: string[], today = SCHEDULE_DEMO_TODAY) {
  return dates.filter((d) => isScheduleFutureDate(d, today))
}

/** 排班开始时间：优先划线/自定义备注，否则取班次模板 */
export function resolveAssignmentStartTime(
  asn: { shiftId?: string; note?: string } | null | undefined,
  shifts: { id: string; startTime: string }[],
): string | undefined {
  if (!asn) return undefined
  const parsed = parseScheduleTimeNote(asn.note)
  if (parsed) return parsed.startTime
  return shifts.find((s) => s.id === asn.shiftId)?.startTime
}

/**
 * 班次已进入历史（不可改/取消/发布）：
 * 日期早于今天，或当天开始时间已到/已过。无开始时间的空格子：仅按日期判断。
 */
export function isScheduleShiftHistorical(
  date: string,
  startTime?: string,
  nowIso = SCHEDULE_DEMO_NOW,
) {
  if (isScheduleHistoryDate(date)) return true
  if (!startTime) return false
  if (isScheduleFutureDate(date) && date > SCHEDULE_DEMO_TODAY) return false
  const start = startTime.slice(0, 5)
  return new Date(`${date}T${start}:00`).getTime() <= new Date(nowIso).getTime()
}

export function isScheduleSlotMutable(
  date: string,
  startTime?: string,
  nowIso = SCHEDULE_DEMO_NOW,
) {
  return !isScheduleShiftHistorical(date, startTime, nowIso)
}

/** 旧数据「确认中」归并展示为待确认 */
export function normalizeConfirmStatus(
  status?: keyof typeof confirmStatusMap | 'confirming',
): keyof typeof confirmStatusMap | undefined {
  if (!status) return undefined
  if (status === 'confirming') return 'pending'
  return status in confirmStatusMap ? status : undefined
}

/** 已发布且灵工已确认的排班不可直接编辑（需走取消班次） */
export function isAssignmentConfirmedLocked(
  asn: { published?: boolean; confirmStatus?: keyof typeof confirmStatusMap | 'confirming' } | null | undefined,
): boolean {
  if (!asn?.published) return false
  return normalizeConfirmStatus(asn.confirmStatus) === 'confirmed'
}

/** 已发布待确认：允许在未来排班中改草稿后重新发布 */
export function isAssignmentPendingEditable(
  asn: { published?: boolean; confirmStatus?: keyof typeof confirmStatusMap | 'confirming' } | null | undefined,
): boolean {
  if (!asn?.published) return true
  const status = normalizeConfirmStatus(asn.confirmStatus)
  return status === 'pending' || status === 'rejected' || !status
}

export function parseScheduleTimeNote(note?: string): ScheduleTimeSegment | null {
  const segments = parseScheduleTimeSegments(note)
  if (!segments.length) return null
  return resolveOverallPunchWindow(segments)
}

/** 自定义/划线备注中的单个工作时段；dayOffset=1 表示次日时段 */
export type ScheduleTimeSegment = {
  startTime: string
  endTime: string
  /** 0=当日（默认），1=次日 */
  dayOffset?: 0 | 1
}

export const SCHEDULE_SLOT_MINUTES = 30
export const SCHEDULE_SLOTS_PER_DAY = (24 * 60) / SCHEDULE_SLOT_MINUTES

function toScheduleMinutes(time: string): number {
  const [h, m] = time.slice(0, 5).split(':').map(Number)
  return h * 60 + (m || 0)
}

function fromScheduleMinutes(total: number): string {
  const normalized = ((total % (24 * 60)) + 24 * 60) % (24 * 60)
  const h = Math.floor(normalized / 60)
  const m = normalized % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

const DAY_MINUTES = 24 * 60

/** 由绝对分钟还原时段（含次日 dayOffset） */
export function segmentFromAbsRange(startAbs: number, endAbs: number): ScheduleTimeSegment {
  const startDay = Math.min(1, Math.max(0, Math.floor(startAbs / DAY_MINUTES))) as 0 | 1
  const localStart = startAbs - startDay * DAY_MINUTES
  const localEnd = endAbs - startDay * DAY_MINUTES
  return {
    startTime: fromScheduleMinutes(localStart),
    endTime: fromScheduleMinutes(localEnd),
    dayOffset: startDay,
  }
}

/** 时段绝对区间（相对排班日 00:00；次日 +24h；跨午夜 end 再 +24h） */
export function scheduleSegmentAbsRange(seg: ScheduleTimeSegment): [number, number] {
  const dayOff = (seg.dayOffset ?? 0) * DAY_MINUTES
  const start = toScheduleMinutes(seg.startTime) + dayOff
  let end = toScheduleMinutes(seg.endTime) + dayOff
  if (end <= start) end += DAY_MINUTES
  return [start, end]
}

export function isOvernightScheduleSegment(seg: ScheduleTimeSegment): boolean {
  const dayOff = (seg.dayOffset ?? 0) * DAY_MINUTES
  const [, end] = scheduleSegmentAbsRange(seg)
  return end > dayOff + DAY_MINUTES
}

export function formatScheduleSegmentPart(seg: ScheduleTimeSegment): string {
  const prefix = (seg.dayOffset ?? 0) > 0 ? '次日' : ''
  return `${prefix}${seg.startTime}-${seg.endTime}`
}

export function formatScheduleSegmentLabel(seg: ScheduleTimeSegment): string {
  if ((seg.dayOffset ?? 0) > 0) {
    return `次日${formatTimeShort(seg.startTime)}-${formatTimeShort(seg.endTime)}`
  }
  if (isOvernightScheduleSegment(seg)) {
    return `${formatTimeShort(seg.startTime)}-次日${formatTimeShort(seg.endTime)}`
  }
  return formatScheduleTimeRange(seg.startTime, seg.endTime)
}

/**
 * 从前一日备注中取出落入次日的工作片段，并映射为相对「次日 00:00」的时段。
 * 用于切换到下一天时只读展示昨续凌晨班。
 */
export function extractCarryOverSegmentsFromPrevDay(note?: string): ScheduleTimeSegment[] {
  const segments = parseScheduleTimeSegments(note)
  if (!segments.length) return []
  const spill: ScheduleTimeSegment[] = []
  for (const seg of segments) {
    const [start, end] = scheduleSegmentAbsRange(seg)
    const spillStart = Math.max(start, DAY_MINUTES)
    const spillEnd = Math.min(end, DAY_MINUTES * 2)
    if (spillEnd > spillStart) {
      spill.push(segmentFromAbsRange(spillStart - DAY_MINUTES, spillEnd - DAY_MINUTES))
    }
  }
  return mergeScheduleTimeSegments(spill)
}

/** 班次模板跨天时，落入次日的片段（相对次日 00:00） */
export function extractCarryOverFromShiftTimes(
  startTime: string,
  endTime: string,
): ScheduleTimeSegment[] {
  const start = toScheduleMinutes(startTime.slice(0, 5))
  let end = toScheduleMinutes(endTime.slice(0, 5))
  if (end > start) return []
  end += DAY_MINUTES
  const spillStart = Math.max(start, DAY_MINUTES)
  const spillEnd = Math.min(end, DAY_MINUTES * 2)
  if (spillEnd <= spillStart) return []
  return mergeScheduleTimeSegments([
    segmentFromAbsRange(spillStart - DAY_MINUTES, spillEnd - DAY_MINUTES),
  ])
}

/** 两时段是否在绝对时间轴上重叠 */
export function scheduleSegmentsOverlap(
  a: ScheduleTimeSegment,
  b: ScheduleTimeSegment,
): boolean {
  const [as, ae] = scheduleSegmentAbsRange(a)
  const [bs, be] = scheduleSegmentAbsRange(b)
  return as < be && ae > bs
}

/** 解析备注中全部工作时段：`自定义 14:00-18:00,次日02:00-06:00` */
export function parseScheduleTimeSegments(note?: string): ScheduleTimeSegment[] {
  if (!note?.trim()) return []
  const body = note.match(/^(?:划线|自定义)\s+(.+)$/)?.[1]?.trim()
  if (!body) return []
  return body
    .split(/[,，、;；]\s*/)
    .map((part): ScheduleTimeSegment | null => {
      const m = part.trim().match(/^(次日)?(\d{1,2}:\d{2})\s*[-~～]\s*(\d{1,2}:\d{2})$/)
      if (!m) return null
      const startTime = m[2].padStart(5, '0')
      const endTime = m[3].padStart(5, '0')
      return {
        startTime,
        endTime,
        dayOffset: m[1] ? 1 : 0,
      }
    })
    .filter((s): s is ScheduleTimeSegment => Boolean(s))
}

/** 合并重叠/相接时段 */
export function mergeScheduleTimeSegments(
  segments: ScheduleTimeSegment[],
): ScheduleTimeSegment[] {
  if (!segments.length) return []
  const ranges = segments
    .map(scheduleSegmentAbsRange)
    .sort((a, b) => a[0] - b[0])
  const merged: [number, number][] = []
  for (const [s, e] of ranges) {
    const last = merged[merged.length - 1]
    if (!last || s > last[1]) {
      merged.push([s, e])
    } else {
      last[1] = Math.max(last[1], e)
    }
  }
  return merged.map(([s, e]) => segmentFromAbsRange(s, e))
}

export function formatScheduleTimeSegmentsNote(
  prefix: '自定义' | '划线',
  segments: ScheduleTimeSegment[],
): string {
  const merged = mergeScheduleTimeSegments(segments)
  const body = merged.map(formatScheduleSegmentPart).join(',')
  return `${prefix} ${body}`
}

/**
 * 打卡窗口 = 全部工作时段合计起止（最早开始 → 最晚结束）。
 * 中间空档视为休息，不计入工时，但仍包含在打卡起止内。
 */
export function resolveOverallPunchWindow(
  segments: ScheduleTimeSegment[],
): ScheduleTimeSegment | null {
  const merged = mergeScheduleTimeSegments(segments)
  if (!merged.length) return null
  let earliest = Infinity
  let latest = -Infinity
  for (const seg of merged) {
    const [s, e] = scheduleSegmentAbsRange(seg)
    if (s < earliest) earliest = s
    if (e > latest) latest = e
  }
  return segmentFromAbsRange(earliest, latest)
}

/** 工作工时 = 各工作时段时长之和（空档休息不计） */
export function calcScheduleSegmentsWorkHours(segments: ScheduleTimeSegment[]): number {
  return (
    Math.round(
      mergeScheduleTimeSegments(segments).reduce((sum, seg) => {
        const [s, e] = scheduleSegmentAbsRange(seg)
        return sum + (e - s) / 60
      }, 0) * 100,
    ) / 100
  )
}

/** 休息分钟 = 打卡窗口总时长 − 工作时段合计 */
export function calcScheduleSegmentsBreakMinutes(segments: ScheduleTimeSegment[]): number {
  const window = resolveOverallPunchWindow(segments)
  if (!window) return 0
  const [ws, we] = scheduleSegmentAbsRange(window)
  const workMin = calcScheduleSegmentsWorkHours(segments) * 60
  return Math.max(0, Math.round(we - ws - workMin))
}

/** 跨天排班：起始不得早于此时刻（14:00） */
export const CROSS_DAY_MIN_START_MINUTES = 14 * 60

/** 跨天排班：从第一段开始到最后一段结束的最大跨度（两天内 ≤ 24h） */
export const CROSS_DAY_MAX_SPAN_MINUTES = 24 * 60

/** 是否落到次日（过夜段或显式次日段） */
export function spansCrossDaySchedule(segments: ScheduleTimeSegment[]): boolean {
  const merged = mergeScheduleTimeSegments(segments)
  if (!merged.length) return false
  if (merged.some((s) => (s.dayOffset ?? 0) > 0 || isOvernightScheduleSegment(s))) return true
  const window = resolveOverallPunchWindow(merged)
  if (!window) return false
  const [, we] = scheduleSegmentAbsRange(window)
  return we > DAY_MINUTES
}

/**
 * 校验跨天划线规则：
 * - 交互覆盖两天时间轴
 * - 起始（第一段开始）不得早于 14:00，且须在当日
 * - 第一段开始 → 最后一段结束 跨度 ≤ 24 小时
 * - 第 2 段及以后（含休息空档）可落在次日
 */
export function validateCrossDayScheduleSegments(
  segments: ScheduleTimeSegment[],
): { ok: true } | { ok: false; message: string } {
  const merged = mergeScheduleTimeSegments(segments)
  if (!merged.length) return { ok: true }

  const ordered = [...merged].sort(
    (a, b) => scheduleSegmentAbsRange(a)[0] - scheduleSegmentAbsRange(b)[0],
  )
  const firstAbs = scheduleSegmentAbsRange(ordered[0])[0]
  if (firstAbs >= DAY_MINUTES) {
    return {
      ok: false,
      message: '首段须从当日开始；第 2 段及以后（含休息）可落在次日',
    }
  }
  if (firstAbs < CROSS_DAY_MIN_START_MINUTES) {
    return { ok: false, message: '跨天排班起始时间不能早于下午 14:00' }
  }

  const window = resolveOverallPunchWindow(merged)
  if (!window) return { ok: true }
  const [ws, we] = scheduleSegmentAbsRange(window)
  if (we - ws > CROSS_DAY_MAX_SPAN_MINUTES) {
    return {
      ok: false,
      message: '跨天排班从第一段开始到最后一段结束不能超过 24 小时（覆盖两天）',
    }
  }
  return { ok: true }
}

/** 是否包含跨天（结束早于开始）的工作时段 */
export function hasOvernightScheduleSegments(segments: ScheduleTimeSegment[]): boolean {
  return mergeScheduleTimeSegments(segments).some(isOvernightScheduleSegment)
}

/** 划线/自定义排班使用的通用班次，不关联考勤组班次模板 */
export const FLEX_SHIFT_ID = 'shift_flex'
export const FLEX_SHIFT_COLOR = '#6366f1'

/** 自由打卡虚拟班次（无排班、有打卡时用于展示与出勤归类） */
export const FREE_PUNCH_SHIFT_ID = 'shift_free_punch'
export const FREE_PUNCH_SHIFT_COLOR = '#0EA5E9'

export function formatTimeShort(time: string) {
  return time.slice(0, 5).replace(':', '')
}

export function formatScheduleTimeRange(startTime: string, endTime: string) {
  return `${formatTimeShort(startTime)}-${formatTimeShort(endTime)}`
}

/** 划线/自定义单元格展示：班次（时段）或 自定义（时段） */
export function formatLineAssignmentLabel(
  asn: { note?: string; shiftId: string } | undefined,
  shift: { id?: string; name: string; code: string; startTime: string; endTime: string } | null | undefined,
): string | null {
  if (!asn) return null
  const segments = parseScheduleTimeSegments(asn.note)
  const range = segments.length
    ? segments.map(formatScheduleSegmentLabel).join(',')
    : shift && shift.code !== 'REST'
      ? formatScheduleTimeRange(shift.startTime, shift.endTime)
      : null
  if (asn.shiftId === FLEX_SHIFT_ID || asn.note?.startsWith('自定义')) {
    return range ? `自定义（${range}）` : '自定义'
  }
  if (!shift) return range
  if (shift.code === 'REST') return shift.name
  return range ? `${shift.name}（${range}）` : shift.name
}

export function isFlexibleScheduleNote(note?: string) {
  return Boolean(parseScheduleTimeNote(note))
}

export function isCustomFlexAssignment(
  asn: { note?: string; shiftId: string } | undefined,
): boolean {
  if (!asn) return false
  return asn.shiftId === FLEX_SHIFT_ID || Boolean(asn.note?.startsWith('自定义'))
}

export function getAssignmentDisplayLabel(
  asn: { note?: string; shiftId: string } | undefined,
  shift: { name: string; code: string; startTime: string; endTime: string; id?: string } | null | undefined,
): string | null {
  if (!asn || !shift) return null
  const parsed = parseScheduleTimeNote(asn.note)
  if (parsed || asn.shiftId === FLEX_SHIFT_ID) {
    return formatLineAssignmentLabel(asn, shift)
  }
  if (shift.code === 'REST') return shift.name
  return `${shift.name} ${formatScheduleTimeRange(shift.startTime, shift.endTime)}`
}

export function getAssignmentDisplayColor(
  asn: { note?: string; shiftId: string } | undefined,
  shift: { color: string } | null | undefined,
): string {
  if (isCustomFlexAssignment(asn)) return FLEX_SHIFT_COLOR
  return shift?.color ?? '#909399'
}

export function getAssignmentStatsKey(
  asn: { note?: string },
  shift: { name: string; startTime: string; endTime: string },
): string {
  const segments = parseScheduleTimeSegments(asn.note)
  if (segments.length) {
    return segments.map(formatScheduleSegmentLabel).join(',')
  }
  return shift.name
}

export function getAssignmentWorkHours(
  asn: { note?: string; shiftId: string },
  shifts: { id: string; code: string; startTime: string; endTime: string; breakMinutes: number }[],
): number {
  const segments = parseScheduleTimeSegments(asn.note)
  if (segments.length) {
    return calcScheduleSegmentsWorkHours(segments)
  }
  const shift = shifts.find((s) => s.id === asn.shiftId)
  if (!shift || shift.code === 'REST') return 0
  const [sh, sm] = shift.startTime.split(':').map(Number)
  const [eh, em] = shift.endTime.split(':').map(Number)
  let start = sh * 60 + sm
  let end = eh * 60 + em
  if (end <= start) end += 24 * 60
  return (end - start - shift.breakMinutes) / 60
}

export function cellKey(employeeId: string, date: string) {
  return `${employeeId}#${date}`
}

export function parseCellKey(key: string) {
  const idx = key.indexOf('#')
  return { employeeId: key.slice(0, idx), date: key.slice(idx + 1) }
}

export function shiftShortName(name: string) {
  if (name.includes('休')) return '休'
  return name.slice(0, 1)
}

export function getAssignmentCalendarLabel(
  asn: { note?: string; shiftId: string } | undefined,
  shift: { name: string; code: string; startTime: string; endTime: string } | null | undefined,
): string {
  if (!asn || !shift) return ''
  const parsed = parseScheduleTimeNote(asn.note)
  if (parsed) return formatScheduleTimeRange(parsed.startTime, parsed.endTime)
  if (shift.code === 'REST') return '休'
  return shiftShortName(shift.name)
}

export function formatStatsSummaryKey(key: string): string {
  if (/^\d{4}-\d{4}$/.test(key)) return key
  return key.slice(0, 1)
}
