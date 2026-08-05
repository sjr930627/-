import type { AttendanceGroupStatus, AttendanceGroupType } from '@/types'

export const attendanceGroupTypeMap: Record<AttendanceGroupType, string> = {
  shift: '排班制',
  free: '自由打卡',
  none: '无需打卡',
}

export const attendanceGroupStatusMap: Record<AttendanceGroupStatus, string> = {
  enabled: '启用',
  disabled: '停用',
}

export function formatShiftPeriod(group: {
  attendanceType: AttendanceGroupType
  shiftTemplates: { name: string; startTime: string; endTime: string }[]
}): string {
  if (group.attendanceType !== 'shift' || !group.shiftTemplates.length) return '—'
  const first = group.shiftTemplates[0]
  return `${first.name} (${first.startTime}-${first.endTime})`
}

export function formatMinMonthlyHours(hours?: number): string {
  return hours != null ? `${hours}h` : '不限制'
}

export function formatDeptBindings(
  bindings: { departmentName: string }[],
  max = 2,
): { visible: string[]; extra: number } {
  const visible = bindings.slice(0, max).map((b) => b.departmentName)
  const extra = Math.max(0, bindings.length - max)
  return { visible, extra }
}

export { formatVersionLabel, formatVersionTime, summarizeVersionSnapshot } from '@/services/attendanceGroupVersion'
