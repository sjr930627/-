import type {
  AttendanceGroup,
  AttendanceGroupShiftTemplate,
  Department,
  GrabShiftSlot,
  Holiday,
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
  hourlySubsidy: number
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
    hourlySubsidy,
    positionRequirement,
    requirements,
    teams,
    shifts,
    holidays = [],
  } = options

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
    requirements,
    positionRequirement: positionRequirement.trim(),
    hourlySubsidy: Math.max(0, hourlySubsidy),
    baseHourlyRate,
    effectiveHourlyRate,
  }
}
