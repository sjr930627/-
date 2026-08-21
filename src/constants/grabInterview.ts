import type {
  GrabInterviewDeptPosition,
  GrabInterviewDeptRule,
  GrabInterviewPositionProfile,
  GrabInterviewPositionTemplate,
  GrabInterviewRegStatus,
  GrabInterviewScheduleMode,
  GrabInterviewScheduleRule,
  GrabInterviewSeatUnitMinutes,
  GrabInterviewTimeSlot,
  GrabInterviewWeekday,
} from '@/types'
import { generateId } from '@/utils'

export const grabInterviewWeekdayOptions: { value: GrabInterviewWeekday; label: string }[] = [
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
  { value: 7, label: '周日' },
]

export const grabInterviewWeekdayMap: Record<GrabInterviewWeekday, string> = {
  1: '周一',
  2: '周二',
  3: '周三',
  4: '周四',
  5: '周五',
  6: '周六',
  7: '周日',
}

export const grabInterviewScheduleModeOptions: {
  value: GrabInterviewScheduleMode
  label: string
  desc: string
}[] = [
  { value: 'unified', label: '统一配置时间段', desc: '所选星期共用同一组时间段' },
  { value: 'by_day', label: '按日配置时间段', desc: '每个星期可配置不同时间段' },
]

export const grabInterviewSeatUnitOptions: {
  value: GrabInterviewSeatUnitMinutes
  label: string
}[] = [
  { value: 30, label: '每半小时' },
  { value: 60, label: '每 1 小时' },
]

export const grabInterviewRegStatusMap: Record<
  GrabInterviewRegStatus,
  { label: string; type: 'success' | 'warning' | 'info' | 'danger' }
> = {
  pending: { label: '待面试', type: 'warning' },
  passed: { label: '面试通过', type: 'success' },
  failed: { label: '面试未通过', type: 'danger' },
  no_show_cancelled: { label: '未到面/取消面试', type: 'info' },
}

export function weekdayFromDate(dateStr: string): GrabInterviewWeekday {
  const d = new Date(`${dateStr}T12:00:00`)
  const js = d.getDay()
  return (js === 0 ? 7 : js) as GrabInterviewWeekday
}

export function emptyScheduleRule(): GrabInterviewScheduleRule {
  return {
    scheduleMode: 'unified',
    weekdays: [1, 2, 3, 4, 5],
    timeSlots: [{ id: generateId('slot'), start: '09:00', end: '10:00' }],
    dayTimeSlots: {},
    seatUnitMinutes: 30,
    seatsPerUnit: 1,
  }
}

export function emptyPositionProfile(name = ''): GrabInterviewPositionProfile {
  return {
    positionName: name,
    jobType: '',
    skills: [],
    requirements: '',
    description: '',
    ageMin: undefined,
    ageMax: undefined,
    gender: 'any',
    experience: '',
  }
}

/** 规范化面试时间/席位规则 */
export function normalizeGrabInterviewScheduleRule(
  rule?: Partial<GrabInterviewScheduleRule> | null,
): GrabInterviewScheduleRule {
  const base = emptyScheduleRule()
  if (!rule) return base
  const scheduleMode: GrabInterviewScheduleMode = rule.scheduleMode ?? 'unified'
  const dayTimeSlots = { ...(rule.dayTimeSlots ?? {}) }
  let weekdays = [...(rule.weekdays ?? [])] as GrabInterviewWeekday[]
  let timeSlots = [...(rule.timeSlots ?? [])]

  if (scheduleMode === 'by_day') {
    if (!weekdays.length) {
      weekdays = Object.keys(dayTimeSlots)
        .map((k) => Number(k) as GrabInterviewWeekday)
        .filter((d) => (dayTimeSlots[d]?.length ?? 0) > 0)
        .sort((a, b) => a - b)
    }
    weekdays.forEach((d) => {
      if (!dayTimeSlots[d]?.length) {
        dayTimeSlots[d] = timeSlots.length
          ? timeSlots.map((s) => ({ ...s, id: `${s.id}_${d}` }))
          : [{ id: generateId('slot'), start: '09:00', end: '10:00' }]
      }
    })
  } else if (!timeSlots.length) {
    const first = weekdays
      .map((d) => dayTimeSlots[d])
      .find((list) => list && list.length)
    if (first?.length) timeSlots = first.map((s) => ({ ...s }))
    else timeSlots = base.timeSlots
  }

  if (!weekdays.length) weekdays = base.weekdays

  return {
    scheduleMode,
    weekdays,
    timeSlots,
    dayTimeSlots,
    seatUnitMinutes: rule.seatUnitMinutes === 60 ? 60 : 30,
    seatsPerUnit: Math.max(1, rule.seatsPerUnit ?? 1),
  }
}

/** @deprecated 兼容旧调用名 */
export function normalizeGrabInterviewDeptRule(rule: GrabInterviewDeptRule): GrabInterviewDeptRule {
  return normalizeDeptInterviewRule(rule)
}

/** 将旧版单岗位扁平结构迁移为多岗位 */
export function normalizeDeptInterviewRule(rule: GrabInterviewDeptRule): GrabInterviewDeptRule {
  const legacySchedule =
    rule.weekdays || rule.timeSlots || rule.scheduleMode || rule.dayTimeSlots
      ? normalizeGrabInterviewScheduleRule({
          scheduleMode: rule.scheduleMode,
          weekdays: rule.weekdays ?? [],
          timeSlots: rule.timeSlots ?? [],
          dayTimeSlots: rule.dayTimeSlots,
          seatUnitMinutes: rule.seatUnitMinutes,
          seatsPerUnit: rule.seatsPerUnit,
        })
      : undefined

  let positions = [...(rule.positions ?? [])]
  if (!positions.length && (rule.positionName || legacySchedule)) {
    positions = [
      {
        id: generateId('gip'),
        templateId: null,
        profile: {
          positionName: rule.positionName || '未命名岗位',
          jobType: rule.jobType,
          skills: rule.skills ?? [],
          requirements: rule.requirements,
          description: rule.description,
          ageMin: rule.ageMin,
          ageMax: rule.ageMax,
          gender: rule.gender ?? 'any',
          experience: rule.experience,
        },
        ruleScope: 'position',
        schedule: legacySchedule ?? emptyScheduleRule(),
      },
    ]
  }

  positions = positions.map((p) => ({
    ...p,
    id: p.id || generateId('gip'),
    profile: {
      ...emptyPositionProfile(),
      ...p.profile,
      skills: p.profile?.skills ?? [],
      positionName: p.profile?.positionName || '未命名岗位',
    },
    ruleScope: p.ruleScope === 'department' ? 'department' : 'position',
    schedule:
      p.ruleScope === 'department'
        ? undefined
        : normalizeGrabInterviewScheduleRule(p.schedule ?? legacySchedule),
  }))

  return {
    departmentId: rule.departmentId,
    positions,
    departmentSchedule: normalizeGrabInterviewScheduleRule(
      rule.departmentSchedule ?? legacySchedule ?? emptyScheduleRule(),
    ),
  }
}

export function resolvePositionSchedule(
  dept: GrabInterviewDeptRule,
  position?: GrabInterviewDeptPosition | null,
): GrabInterviewScheduleRule {
  const normalized = normalizeDeptInterviewRule(dept)
  if (!position || position.ruleScope === 'department') {
    return normalizeGrabInterviewScheduleRule(normalized.departmentSchedule)
  }
  return normalizeGrabInterviewScheduleRule(position.schedule)
}

export function findDeptPosition(
  dept: GrabInterviewDeptRule | undefined,
  positionName: string,
): GrabInterviewDeptPosition | undefined {
  if (!dept) return undefined
  const normalized = normalizeDeptInterviewRule(dept)
  return normalized.positions.find((p) => p.profile.positionName === positionName)
}

/** 解析某星期实际可用时间段（请传入已解析的 schedule） */
export function resolveInterviewSlotsForSchedule(
  schedule: GrabInterviewScheduleRule,
  weekday: GrabInterviewWeekday,
): GrabInterviewTimeSlot[] {
  const normalized = normalizeGrabInterviewScheduleRule(schedule)
  if (normalized.scheduleMode === 'by_day') {
    return normalized.dayTimeSlots?.[weekday] ?? []
  }
  if (!normalized.weekdays.includes(weekday)) return []
  return normalized.timeSlots
}

/** @deprecated 兼容旧调用：部门规则按部门统一规则解析 */
export function resolveInterviewSlotsForWeekday(
  rule: GrabInterviewScheduleRule | GrabInterviewDeptRule,
  weekday: GrabInterviewWeekday,
): GrabInterviewTimeSlot[] {
  if ('departmentId' in rule || 'positions' in rule) {
    const dept = normalizeDeptInterviewRule(rule as GrabInterviewDeptRule)
    return resolveInterviewSlotsForSchedule(
      dept.departmentSchedule ?? emptyScheduleRule(),
      weekday,
    )
  }
  return resolveInterviewSlotsForSchedule(rule as GrabInterviewScheduleRule, weekday)
}

export function estimateSlotSeats(
  slot: GrabInterviewTimeSlot,
  seatUnitMinutes: GrabInterviewSeatUnitMinutes,
  seatsPerUnit: number,
): number {
  const toMin = (t: string) => {
    const [h, m] = t.split(':').map(Number)
    return h * 60 + m
  }
  const duration = Math.max(0, toMin(slot.end) - toMin(slot.start))
  const units = Math.max(1, Math.ceil(duration / seatUnitMinutes))
  return units * Math.max(1, seatsPerUnit)
}

export function formatSeatRuleLabel(
  seatUnitMinutes: GrabInterviewSeatUnitMinutes = 30,
  seatsPerUnit = 1,
) {
  const unit = seatUnitMinutes === 60 ? '每 1 小时' : '每半小时'
  return `${unit}可面试 ${seatsPerUnit} 人`
}

function toMinutes(t: string) {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}

function fromMinutes(total: number) {
  const h = Math.floor(total / 60)
  const m = total % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function buildExactInterviewTimes(
  slot: GrabInterviewTimeSlot,
  seatUnitMinutes: GrabInterviewSeatUnitMinutes = 30,
): string[] {
  const start = toMinutes(slot.start)
  const end = toMinutes(slot.end)
  if (!(end > start)) return []
  const step = seatUnitMinutes === 60 ? 60 : 30
  const times: string[] = []
  for (let t = start; t < end; t += step) {
    times.push(fromMinutes(t))
  }
  if (!times.length) times.push(slot.start)
  return times
}

export function formatRegistrationTime(iso: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatInterviewScheduleDisplay(row: {
  interviewDate: string
  timeSlotLabel: string
  interviewExactTime?: string
  weekday?: GrabInterviewWeekday
}) {
  const week = row.weekday ? `（${grabInterviewWeekdayMap[row.weekday]}）` : ''
  const exact = row.interviewExactTime ? ` ${row.interviewExactTime}` : ''
  const window = row.timeSlotLabel ? ` · ${row.timeSlotLabel}` : ''
  return `${row.interviewDate}${week}${exact}${window}`
}

export function cloneSchedule(rule: GrabInterviewScheduleRule): GrabInterviewScheduleRule {
  return JSON.parse(JSON.stringify(normalizeGrabInterviewScheduleRule(rule)))
}

export function profileFromTemplate(
  tpl: GrabInterviewPositionTemplate,
): GrabInterviewPositionProfile {
  return JSON.parse(JSON.stringify(tpl.profile))
}
