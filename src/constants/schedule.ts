export const confirmStatusMap = {
  pending: { label: '待确认', short: '待', color: '#909399', bg: '#f4f4f5' },
  confirmed: { label: '已确认', short: '✓', color: '#67c23a', bg: '#f0f9eb' },
  rejected: { label: '已拒绝', short: '拒', color: '#f56c6c', bg: '#fef0f0' },
} as const

/** 旧数据「确认中」归并展示为待确认 */
export function normalizeConfirmStatus(
  status?: keyof typeof confirmStatusMap | 'confirming',
): keyof typeof confirmStatusMap | undefined {
  if (!status) return undefined
  if (status === 'confirming') return 'pending'
  return status in confirmStatusMap ? status : undefined
}

/** 已发布且灵工已确认的排班不可直接编辑 */
export function isAssignmentConfirmedLocked(
  asn: { published?: boolean; confirmStatus?: keyof typeof confirmStatusMap | 'confirming' } | null | undefined,
): boolean {
  if (!asn?.published) return false
  return normalizeConfirmStatus(asn.confirmStatus) === 'confirmed'
}

export function parseScheduleTimeNote(note?: string) {
  const match = note?.match(/(?:划线|自定义) (\d{2}:\d{2})-(\d{2}:\d{2})/)
  if (!match) return null
  return { startTime: match[1], endTime: match[2] }
}

/** 划线/自定义排班使用的通用班次，不关联考勤组班次模板 */
export const FLEX_SHIFT_ID = 'shift_flex'
export const FLEX_SHIFT_COLOR = '#6366f1'

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
  const parsed = parseScheduleTimeNote(asn.note)
  const range = parsed
    ? formatScheduleTimeRange(parsed.startTime, parsed.endTime)
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
  const parsed = parseScheduleTimeNote(asn.note)
  if (parsed) return formatScheduleTimeRange(parsed.startTime, parsed.endTime)
  return shift.name
}

export function getAssignmentWorkHours(
  asn: { note?: string; shiftId: string },
  shifts: { id: string; code: string; startTime: string; endTime: string; breakMinutes: number }[],
): number {
  const parsed = parseScheduleTimeNote(asn.note)
  if (parsed) {
    const [sh, sm] = parsed.startTime.split(':').map(Number)
    const [eh, em] = parsed.endTime.split(':').map(Number)
    let start = sh * 60 + sm
    let end = eh * 60 + em
    if (end <= start) end += 24 * 60
    return (end - start) / 60
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
