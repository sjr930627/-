<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ArrowLeft,
  ArrowRight,
  DocumentCopy,
  Promotion,
  RefreshLeft,
  RefreshRight,
  WarningFilled,
} from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'
import { useEnterpriseMiniAuth } from '@/composables/useEnterpriseMiniAuth'
import { detectComplianceConflicts, filterAssignmentsByEnterprise, normalizeAttendanceGroupCompliance } from '@/services/scheduleCompliance'
import {
  confirmStatusMap,
  formatLineAssignmentLabel,
  FLEX_SHIFT_COLOR,
  FLEX_SHIFT_ID,
  isAssignmentConfirmedLocked,
  isScheduleHistoryDate,
  isScheduleFutureDate,
  isScheduleShiftHistorical,
  resolveAssignmentStartTime,
  normalizeConfirmStatus,
  SCHEDULE_DEMO_TODAY,
} from '@/constants/schedule'
import {
  CANCEL_SHIFT_REASON_OPTIONS,
  buildCancelShiftReasonText,
  type CancelShiftReasonCode,
} from '@/constants/cancelShift'
import type { AttendanceGroupCompliance, ScheduleAssignment, SchedulePublishRecord } from '@/types'
import {
  isEnterpriseRootDepartment,
  isLeafDepartment,
  isUnassignedDepartment,
} from '@/constants/department'
import ScheduleLinePanel from '@/components/schedule/ScheduleLinePanel.vue'
import { resolveShiftIdForTemplate } from '@/services/scheduleGroup'
import { resolveDepartmentAttendanceGroupId } from '@/services/settlementPrice'
import { addDays, calcShiftHours, getDepartmentDescendantIds, getDepartmentPath } from '@/utils'

dayjs.extend(isoWeek)

const DRAFT_KEY = 'enterprise-mini:schedule-line-draft'
const DEPT_STORAGE_PREFIX = 'ent-mini-schedule-dept:'

/** 与设计稿一致的画笔色（矩阵概览图例） */
const BRUSH_META = [
  { id: 'shift_morning', name: '早班', short: '早', time: '08-16', color: '#3B82F6', soft: '#DBEAFE' },
  { id: 'shift_afternoon', name: '中班', short: '中', time: '16-00', color: '#F97316', soft: '#FFEDD5' },
  { id: 'shift_night', name: '夜班', short: '夜', time: '00-08', color: '#8B5CF6', soft: '#EDE9FE' },
  { id: 'shift_flex', name: '自定义', short: '自定', time: '灵活时段', color: FLEX_SHIFT_COLOR, soft: '#DBEAFE' },
  { id: 'eraser', name: '橡皮', short: '擦', time: '清除', color: '#9CA3AF', soft: '#F3F4F6' },
] as const

const TEAM_COLORS = ['#3B82F6', '#F97316', '#8B5CF6', '#22C55E', '#EC4899', '#14B8A6']

const router = useRouter()
const store = useAppStore()
const { enterpriseId } = useEnterpriseMiniAuth()

const weekAnchor = ref('2026-07-27')
const selectedDeptId = ref('')
const deptPickerOpen = ref(false)
const lineSelectedDate = ref(SCHEDULE_DEMO_TODAY)
const scheduleMode = ref<'shift' | 'custom'>('shift')
const selectedLineShiftId = ref<string | null>(null)
const brushId = ref('shift_morning')
const continuousMode = ref(false)
const moreOpen = ref(false)
const cellMenu = ref<{ employeeId: string; date: string } | null>(null)
const conflictTip = ref<{ employeeId: string; date: string; messages: string[] } | null>(null)
const cellDetail = ref<{ employeeId: string; date: string } | null>(null)
const cancelSheetOpen = ref(false)
const cancelSubmitting = ref(false)
const cancelForm = ref<{
  reasonCode: CancelShiftReasonCode
  reasonOther: string
}>({
  reasonCode: 'business_change',
  reasonOther: '',
})
const publishLogOpen = ref(false)
const selectedPublishRecord = ref<SchedulePublishRecord | null>(null)
const landscapeTip = ref(false)
const selectedRowId = ref('')
/** 默认发布态（只读查看）；点击「编辑排班」后进入编辑态 */
const editMode = ref(false)

type HistItem = { employeeId: string; date: string; prev: string | null; next: string | null }
const undoStack = ref<HistItem[][]>([])
const redoStack = ref<HistItem[][]>([])

const defaultCompliance: AttendanceGroupCompliance = {
  enabled: false,
  maxDailyHours: 12,
  maxWeeklyHours: 60,
  maxMonthlyHours: 220,
  maxConsecutiveWorkdays: 3,
  minShiftIntervalHours: 8,
}

const brushes = computed(() => [...BRUSH_META])

const longPressOptions = [
  { id: 'shift_morning', label: '早班' },
  { id: 'shift_afternoon', label: '中班' },
  { id: 'shift_night', label: '夜班' },
  { id: FLEX_SHIFT_ID, label: '自定义' },
  { id: 'shift_rest', label: '休息' },
  { id: 'leave', label: '请假' },
]

const departments = computed(() => store.getDepartmentsByEnterprise(enterpriseId.value))

const departmentOptions = computed(() =>
  departments.value
    .filter(
      (d) =>
        !isUnassignedDepartment(d.id) &&
        !isEnterpriseRootDepartment(d) &&
        isLeafDepartment(d),
    )
    .map((d) => ({
      id: d.id,
      label: getDepartmentPath(departments.value, d.id),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'zh-CN')),
)

watch(
  [enterpriseId, departmentOptions],
  () => {
    const options = departmentOptions.value
    if (!options.length) {
      selectedDeptId.value = ''
      return
    }
    const saved = localStorage.getItem(`${DEPT_STORAGE_PREFIX}${enterpriseId.value}`)
    if (saved && options.some((d) => d.id === saved)) {
      selectedDeptId.value = saved
      return
    }
    if (!options.some((d) => d.id === selectedDeptId.value)) {
      selectedDeptId.value = options[0].id
    }
  },
  { immediate: true },
)

watch(selectedDeptId, (id) => {
  if (!id || !enterpriseId.value) return
  localStorage.setItem(`${DEPT_STORAGE_PREFIX}${enterpriseId.value}`, id)
})

const selectedDeptLabel = computed(() => {
  if (!selectedDeptId.value) return '请选择部门'
  return (
    departmentOptions.value.find((d) => d.id === selectedDeptId.value)?.label ||
    getDepartmentPath(departments.value, selectedDeptId.value)
  )
})

const scopedDeptIds = computed(() => {
  if (!selectedDeptId.value) return new Set<string>()
  return getDepartmentDescendantIds(departments.value, selectedDeptId.value)
})

const enterpriseTeams = computed(() => {
  const empIds = new Set(
    store.employees
      .filter(
        (e) =>
          e.enterpriseId === enterpriseId.value &&
          e.departmentId &&
          scopedDeptIds.value.has(e.departmentId),
      )
      .map((e) => e.id),
  )
  return store.teams.filter(
    (t) =>
      (t.departmentId && scopedDeptIds.value.has(t.departmentId)) ||
      t.memberIds.some((id) => empIds.has(id)),
  )
})

const employees = computed(() =>
  store.employees.filter(
    (e) =>
      e.status === 'active' &&
      e.enterpriseId === enterpriseId.value &&
      Boolean(e.departmentId && scopedDeptIds.value.has(e.departmentId)),
  ),
)

const memberIds = computed(() => employees.value.map((e) => e.id))

const scheduleTeamId = computed(
  () =>
    enterpriseTeams.value[0]?.id ||
    store.teams.find((t) => t.memberIds.some((id) => memberIds.value.includes(id)))?.id ||
    '',
)

const selectedAttendanceGroup = computed(() => {
  const team = store.teams.find((t) => t.id === scheduleTeamId.value)
  if (team?.attendanceGroupId) {
    const byTeam = store.attendanceGroups.find((g) => g.id === team.attendanceGroupId)
    if (byTeam) return byTeam
  }
  const dept = departments.value.find((d) => d.id === selectedDeptId.value)
  if (dept) {
    const groupId = resolveDepartmentAttendanceGroupId(dept, store.attendanceGroups)
    if (groupId) {
      const byDept = store.attendanceGroups.find((g) => g.id === groupId)
      if (byDept) return byDept
    }
  }
  return (
    store.attendanceGroups.find(
      (g) =>
        g.attendanceType === 'shift' &&
        (g.departmentBindings ?? []).some((b) => scopedDeptIds.value.has(b.departmentId)),
    ) ?? null
  )
})

function isSelectableWorkShift(shift: { id: string; code: string; name: string }) {
  if (shift.id === FLEX_SHIFT_ID || shift.id === 'shift_free_punch') return false
  if (shift.code === 'REST' || shift.code === 'FREE' || shift.code === 'FLEX' || shift.code === 'CUSTOM') {
    return false
  }
  if (shift.name === '休息' || shift.name === '自由打卡' || shift.name === '自定义') return false
  return true
}

const groupShifts = computed(() => {
  const templates = selectedAttendanceGroup.value?.shiftTemplates ?? []
  return templates
    .map((tpl) => {
      const shiftId = resolveShiftIdForTemplate(tpl.name, store.shifts)
      const shift = shiftId ? store.shifts.find((s) => s.id === shiftId) ?? null : null
      return { template: tpl, shift }
    })
    .filter((d): d is { template: (typeof templates)[number]; shift: NonNullable<typeof d.shift> } =>
      Boolean(d.shift && isSelectableWorkShift(d.shift)),
    )
})

const selectedLineShiftContext = computed(() => {
  if (!selectedLineShiftId.value) return null
  const d = groupShifts.value.find((x) => x.shift.id === selectedLineShiftId.value)
  if (!d) return null
  return {
    shiftId: d.shift.id,
    shiftName: d.template.name,
    startTime: d.template.startTime,
    endTime: d.template.endTime,
    color: d.shift.color,
  }
})

const showLinePanel = computed(() => {
  if (!editMode.value || !hasMutableWeekDates.value || !scheduleTeamId.value || !memberIds.value.length) {
    return false
  }
  if (scheduleMode.value === 'custom') return true
  return Boolean(selectedLineShiftContext.value)
})

watch(scheduleMode, (mode) => {
  if (mode === 'shift') {
    if (!selectedLineShiftId.value || !groupShifts.value.some((d) => d.shift.id === selectedLineShiftId.value)) {
      selectedLineShiftId.value = groupShifts.value[0]?.shift.id ?? null
    }
  }
})

watch(groupShifts, (list) => {
  if (scheduleMode.value !== 'shift') return
  if (!selectedLineShiftId.value || !list.some((d) => d.shift.id === selectedLineShiftId.value)) {
    selectedLineShiftId.value = list[0]?.shift.id ?? null
  }
})

/** 按班组分组，用于矩阵左侧分组展示 */
const groupedRows = computed(() => {
  const teams = enterpriseTeams.value
  const used = new Set<string>()
  const groups: { id: string; name: string; color: string; members: typeof employees.value }[] = []

  teams.forEach((t, i) => {
    const members = employees.value.filter((e) => t.memberIds.includes(e.id))
    members.forEach((m) => used.add(m.id))
    if (!members.length) return
    groups.push({
      id: t.id,
      name: t.name,
      color: TEAM_COLORS[i % TEAM_COLORS.length],
      members,
    })
  })

  const orphans = employees.value.filter((e) => !used.has(e.id))
  if (orphans.length) {
    groups.push({
      id: '_other',
      name: '未分组',
      color: '#9CA3AF',
      members: orphans,
    })
  }
  return groups
})

const weekStart = computed(() => dayjs(weekAnchor.value).startOf('isoWeek').format('YYYY-MM-DD'))
const weekDays = computed(() =>
  Array.from({ length: 7 }, (_, i) => dayjs(weekStart.value).add(i, 'day').format('YYYY-MM-DD')),
)
const weekLabel = computed(() => {
  const d = dayjs(weekStart.value)
  return `${d.year()}年 第${d.isoWeek()}周`
})
const weekRange = computed(() => {
  const s = dayjs(weekStart.value)
  const e = s.add(6, 'day')
  return `${s.format('MM/DD')} - ${e.format('MM/DD')}`
})
const weekdayLabels = ['一', '二', '三', '四', '五', '六', '日']

const selectedBrush = computed(() => brushes.value.find((b) => b.id === brushId.value))

const compliance = computed(() => {
  const group =
    selectedAttendanceGroup.value ||
    store.attendanceGroups.find((g) => g.id === enterpriseTeams.value[0]?.attendanceGroupId)
  return normalizeAttendanceGroupCompliance(group?.compliance || defaultCompliance)
})

const enterpriseScopedAssignments = computed(() =>
  filterAssignmentsByEnterprise(
    store.assignments,
    enterpriseId.value,
    store.teams,
    store.departments,
  ),
)

function getPublishedAssignment(employeeId: string, date: string) {
  const all = store.assignments.filter((a) => a.employeeId === employeeId && a.date === date)
  return all.find((a) => a.published)
}

function getDraftAssignment(employeeId: string, date: string) {
  const all = store.assignments.filter((a) => a.employeeId === employeeId && a.date === date)
  return all.find((a) => !a.published)
}

function getAsn(employeeId: string, date: string) {
  const published = getPublishedAssignment(employeeId, date)
  const draft = getDraftAssignment(employeeId, date)
  if (isScheduleHistoryDate(date, SCHEDULE_DEMO_TODAY)) return published
  if (!editMode.value) return published
  return draft ?? published
}

function isCellLocked(employeeId: string, date: string) {
  return isAssignmentConfirmedLocked(getPublishedAssignment(employeeId, date))
}

function isCellHistorical(employeeId: string, date: string, nextShiftId?: string) {
  if (isScheduleHistoryDate(date, SCHEDULE_DEMO_TODAY)) return true
  if (nextShiftId && nextShiftId !== 'eraser' && nextShiftId !== 'leave') {
    return isScheduleShiftHistorical(date, store.shifts.find((s) => s.id === nextShiftId)?.startTime)
  }
  const asn = getAsn(employeeId, date)
  return isScheduleShiftHistorical(date, resolveAssignmentStartTime(asn, store.shifts))
}

function canEditCell(employeeId: string, date: string, nextShiftId?: string) {
  if (!editMode.value) return false
  if (isCellHistorical(employeeId, date, nextShiftId)) return false
  if (isCellLocked(employeeId, date)) return false
  return true
}

function displayConfirmStatus(employeeId: string, date: string) {
  const asn = getPublishedAssignment(employeeId, date)
  if (!asn?.published) return undefined
  return normalizeConfirmStatus(asn.confirmStatus)
}

const hasMutableWeekDates = computed(() =>
  weekDays.value.some((d) => isScheduleFutureDate(d, SCHEDULE_DEMO_TODAY)),
)

const hasDraftInWeek = computed(() =>
  employees.value.some((emp) =>
    weekDays.value.some((date) => {
      const draft = getDraftAssignment(emp.id, date)
      return Boolean(draft && !isScheduleHistoryDate(date, SCHEDULE_DEMO_TODAY))
    }),
  ),
)

const weekPublishRecord = computed(() => {
  const month = weekDays.value[0]?.slice(0, 7)
  const tid = scheduleTeamId.value
  if (!tid || !month) return undefined
  return store.publishRecords.find((r) => r.teamId === tid && r.month === month)
})

const statusBar = computed(() => {
  if (!hasMutableWeekDates.value) {
    return {
      tone: 'info' as const,
      label: '已过期',
      desc: '本周班次均已过期，仅可查看',
    }
  }
  if (!editMode.value) {
    if (weekPublishRecord.value) {
      const t = new Date(weekPublishRecord.value.publishedAt).toLocaleString('zh-CN')
      return {
        tone: 'success' as const,
        label: '已发布',
        desc: `已于 ${t} 发布；点击「编辑排班」可调整待确认班次，已确认班次置灰锁定`,
      }
    }
    return {
      tone: 'success' as const,
      label: '发布视图',
      desc: '当前展示已发布排班；点击「编辑排班」开始划线调整',
    }
  }
  if (hasDraftInWeek.value) {
    return {
      tone: 'warning' as const,
      label: '编辑中',
      desc:
        scheduleMode.value === 'shift'
          ? '班次划线：先选班次再拖选日期；已确认班次置灰锁定'
          : '自定义排班：按日/按周划灵活时段；已确认班次置灰锁定',
    }
  }
  return {
    tone: 'warning' as const,
    label: '编辑中',
    desc: '可切换班次划线或自定义排班，完成后点击「发布排班」',
  }
})

const confirmStats = computed(() => {
  let pending = 0
  let confirmed = 0
  let rejected = 0
  employees.value.forEach((emp) => {
    weekDays.value.forEach((date) => {
      const status = displayConfirmStatus(emp.id, date)
      if (status === 'pending') pending += 1
      else if (status === 'confirmed') confirmed += 1
      else if (status === 'rejected') rejected += 1
    })
  })
  return { pending, confirmed, rejected }
})

const publishHistory = computed(() => {
  const tid = scheduleTeamId.value
  const month = weekDays.value[0]?.slice(0, 7)
  if (!tid) return []
  return store.getSchedulePublishHistory(tid, month)
})

const currentPublishVersion = computed(() => {
  const list = publishHistory.value.filter((r) => r.version)
  return list.length ? Math.max(...list.map((r) => r.version ?? 0)) : 0
})

function formatPublishTime(iso: string) {
  return new Date(iso).toLocaleString('zh-CN')
}

function shiftLabel(asn: ScheduleAssignment | undefined) {
  if (!asn) return '未排班'
  const shift = store.shifts.find((s) => s.id === asn.shiftId)
  return formatLineAssignmentLabel(asn, shift ?? null) || shift?.name || '未排班'
}

function openCellDetail(employeeId: string, date: string) {
  cellDetail.value = { employeeId, date }
}

function openPublishRecord(record: SchedulePublishRecord) {
  selectedPublishRecord.value = record
}

function closePublishRecord() {
  selectedPublishRecord.value = null
}

const detailEmployee = computed(() => {
  if (!cellDetail.value) return null
  return store.employees.find((e) => e.id === cellDetail.value!.employeeId) ?? null
})

const detailPublishedAssignment = computed(() => {
  if (!cellDetail.value) return undefined
  return getPublishedAssignment(cellDetail.value.employeeId, cellDetail.value.date)
})

const detailDraftAssignment = computed(() => {
  if (!cellDetail.value) return undefined
  return getDraftAssignment(cellDetail.value.employeeId, cellDetail.value.date)
})

const detailAssignment = computed(() => {
  if (!cellDetail.value) return undefined
  return getAsn(cellDetail.value.employeeId, cellDetail.value.date)
})

const detailConfirmStatus = computed(() => {
  if (!detailPublishedAssignment.value?.published) return undefined
  return normalizeConfirmStatus(detailPublishedAssignment.value.confirmStatus)
})

const detailIsLocked = computed(() => {
  if (!cellDetail.value) return false
  return isCellLocked(cellDetail.value.employeeId, cellDetail.value.date)
})

const detailIsHistory = computed(() => {
  if (!cellDetail.value) return false
  return isCellHistorical(cellDetail.value.employeeId, cellDetail.value.date)
})

function avatarChar(name: string) {
  return name.slice(0, 1)
}

function conflictLabel(messages: string[]) {
  const text = messages.join(' ')
  if (/连续.*夜|夜班/.test(text)) return '×3夜'
  if (/工时|小时/.test(text)) return '超时'
  if (/间隔/.test(text)) return '间隔'
  return '冲突'
}

function cellDisplay(employeeId: string, date: string) {
  const key = `${employeeId}_${date}`
  const conflicts = conflictMap.value.get(key)
  if (conflicts?.length) {
    return {
      kind: 'conflict' as const,
      short: conflictLabel(conflicts),
      color: '#EF4444',
      soft: '#FEE2E2',
      text: '#fff',
    }
  }

  const asn = getAsn(employeeId, date)
  if (!asn) return null

  const locked = isCellLocked(employeeId, date)
  const rejected = asn.published && normalizeConfirmStatus(asn.confirmStatus) === 'rejected'

  if (asn.shiftId === 'shift_rest' || asn.note?.includes('请假')) {
    if (asn.note?.includes('请假')) {
      return {
        kind: 'leave' as const,
        short: '请假',
        color: '#F59E0B',
        soft: '#FEF3C7',
        text: '#B45309',
      }
    }
    return {
      kind: 'rest' as const,
      short: '休',
      color: '#D1D5DB',
      soft: '#F3F4F6',
      text: '#9CA3AF',
    }
  }

  const brush = BRUSH_META.find((b) => b.id === asn.shiftId)
  const shift = store.shifts.find((s) => s.id === asn.shiftId)
  const isFlex = asn.shiftId === FLEX_SHIFT_ID || asn.shiftId === 'shift_flex'
  const flexLabel = isFlex ? formatLineAssignmentLabel(asn, shift ?? null) : ''
  return {
    kind: 'shift' as const,
    short: isFlex
      ? flexLabel?.slice(0, 8) || '自定义'
      : brush?.short || shift?.name?.slice(0, 1) || '班',
    color: locked
      ? '#CBD5E1'
      : isFlex
        ? FLEX_SHIFT_COLOR
        : brush?.color || shift?.color || '#3B82F6',
    soft: brush?.soft || '#DBEAFE',
    text: locked ? '#64748B' : '#fff',
    locked,
    rejected,
  }
}

const conflictMap = computed(() => {
  const map = new Map<string, string[]>()
  if (!compliance.value.enabled) return map
  const scoped = enterpriseScopedAssignments.value
  employees.value.forEach((emp) => {
    weekDays.value.forEach((date) => {
      const asn = getAsn(emp.id, date)
      if (!asn || asn.shiftId === 'shift_rest') return
      const list = detectComplianceConflicts(
        emp.id,
        date,
        asn.shiftId,
        scoped,
        store.shifts,
        compliance.value,
      )
      if (list.length) map.set(`${emp.id}_${date}`, list.map((c) => c.message))
    })
  })
  return map
})

function empHasConflict(employeeId: string) {
  return weekDays.value.some((d) => conflictMap.value.has(`${employeeId}_${d}`))
}

function chipStyle(employeeId: string, date: string) {
  const d = cellDisplay(employeeId, date)
  if (!d) return {}
  if (d.kind === 'shift' || d.kind === 'conflict') {
    return { background: d.color, color: '#fff', borderColor: 'transparent' }
  }
  if (d.kind === 'leave') {
    return { background: d.soft, color: d.text, borderColor: d.color }
  }
  return { background: d.soft, color: d.text, borderColor: 'transparent' }
}

const stats = computed(() => {
  let count = 0
  let hours = 0
  employees.value.forEach((emp) => {
    weekDays.value.forEach((date) => {
      const asn = getAsn(emp.id, date)
      if (!asn || asn.shiftId === 'shift_rest') return
      count += 1
      const shift = store.shifts.find((s) => s.id === asn.shiftId)
      if (shift) hours += calcShiftHours(shift)
      else if (asn.shiftId === 'shift_flex') hours += 12
    })
  })
  return { count, hours: Math.round(hours), conflicts: conflictMap.value.size }
})

function shiftWeek(delta: number) {
  weekAnchor.value = dayjs(weekStart.value).add(delta, 'week').format('YYYY-MM-DD')
}

function resolveTeamId(employeeId: string) {
  return (
    store.teams.find((t) => t.memberIds.includes(employeeId))?.id ||
    scheduleTeamId.value ||
    enterpriseTeams.value[0]?.id
  )
}

function applyCell(employeeId: string, date: string, nextShiftId: string | null, note?: string) {
  if (!canEditCell(employeeId, date, nextShiftId ?? undefined)) return null
  const prevAsn = getAsn(employeeId, date)
  const prev = prevAsn?.shiftId ?? null
  const prevNote = prevAsn?.note
  if (prev === nextShiftId && !note) return null
  if (nextShiftId === 'leave' && prev === 'shift_rest' && prevNote?.includes('请假') && !note) {
    return null
  }

  if (!nextShiftId || nextShiftId === 'eraser') {
    store.upsertAssignment({
      employeeId,
      date,
      shiftId: 'shift_rest',
      teamId: resolveTeamId(employeeId),
      published: false,
      manualEdited: true,
      note: '橡皮清除',
    })
    return { employeeId, date, prev, next: 'shift_rest' } as HistItem
  }

  store.upsertAssignment({
    employeeId,
    date,
    shiftId: nextShiftId === 'leave' ? 'shift_rest' : nextShiftId,
    teamId: resolveTeamId(employeeId),
    published: false,
    manualEdited: true,
    note:
      note ||
      (nextShiftId === 'leave'
        ? '请假'
        : nextShiftId === 'shift_flex'
          ? '天地班 8-12+18-22'
          : '企业小程序划线排班'),
  })
  return {
    employeeId,
    date,
    prev,
    next: nextShiftId === 'leave' ? 'shift_rest' : nextShiftId,
  } as HistItem
}

const dragBatch = ref<HistItem[]>([])

function paint(employeeId: string, date: string, overrideShiftId?: string, batching = false) {
  if (!canEditCell(employeeId, date)) {
    if (!batching) {
      if (isCellLocked(employeeId, date)) {
        ElMessage.info('该班次灵工已确认，不可直接编辑')
        openCellDetail(employeeId, date)
      } else if (isCellHistorical(employeeId, date)) {
        ElMessage.info('历史班次不可编辑')
        openCellDetail(employeeId, date)
      }
    }
    return
  }
  const target = overrideShiftId ?? brushId.value
  const item = applyCell(employeeId, date, target === 'eraser' ? 'eraser' : target)
  if (!item) return
  if (batching) {
    dragBatch.value.push(item)
  } else {
    undoStack.value.push([item])
    redoStack.value = []
  }
  persistDraft()
  try {
    navigator.vibrate?.(8)
  } catch {
    /* ignore */
  }
}

function paintBrush(employeeId: string, date: string, shiftKey: string) {
  cellMenu.value = null
  if (!canEditCell(employeeId, date)) {
    ElMessage.info(isCellLocked(employeeId, date) ? '该班次灵工已确认，不可直接编辑' : '历史班次不可编辑')
    openCellDetail(employeeId, date)
    return
  }
  const item = applyCell(
    employeeId,
    date,
    shiftKey === 'leave' ? 'leave' : shiftKey,
    shiftKey === 'leave' ? '请假' : undefined,
  )
  if (item) {
    undoStack.value.push([item])
    redoStack.value = []
    persistDraft()
  }
}

const painting = ref(false)
const paintedKeys = ref(new Set<string>())
const pointerStart = ref<{ employeeId: string; date: string; x: number; y: number } | null>(null)
const pointerMoved = ref(false)
const matrixScale = ref(1)
let pinchStartDist = 0
let pinchStartScale = 1

function openConflict(employeeId: string, date: string) {
  const msgs = conflictMap.value.get(`${employeeId}_${date}`)
  if (!msgs?.length) return false
  conflictTip.value = { employeeId, date, messages: msgs }
  return true
}

function paintCellKey(employeeId: string, date: string) {
  const key = `${employeeId}_${date}`
  if (paintedKeys.value.has(key)) return
  paintedKeys.value.add(key)
  paint(employeeId, date, undefined, true)
}

function cellFromPoint(x: number, y: number) {
  const el = document.elementFromPoint(x, y) as HTMLElement | null
  const cell = el?.closest?.('td.cell') as HTMLElement | null
  if (!cell) return null
  const employeeId = cell.dataset.employeeId
  const date = cell.dataset.date
  if (!employeeId || !date) return null
  return { employeeId, date }
}

function onCellPointerDown(employeeId: string, date: string, e: PointerEvent) {
  pointerStart.value = { employeeId, date, x: e.clientX, y: e.clientY }
  pointerMoved.value = false
  if (continuousMode.value) {
    painting.value = true
    paintedKeys.value = new Set()
    dragBatch.value = []
  }
}

function onMatrixPointerMove(e: PointerEvent) {
  if (!painting.value || !continuousMode.value || !pointerStart.value) return
  const dx = e.clientX - pointerStart.value.x
  const dy = e.clientY - pointerStart.value.y
  if (!pointerMoved.value && Math.hypot(dx, dy) < 8) return
  if (!pointerMoved.value) {
    pointerMoved.value = true
    paintCellKey(pointerStart.value.employeeId, pointerStart.value.date)
  }
  const hit = cellFromPoint(e.clientX, e.clientY)
  if (hit) paintCellKey(hit.employeeId, hit.date)
}

function onCellPointerUp() {
  if (continuousMode.value && painting.value) {
    if (!pointerMoved.value && pointerStart.value) {
      const { employeeId, date } = pointerStart.value
      if (!openConflict(employeeId, date)) {
        paint(employeeId, date)
      }
    } else if (dragBatch.value.length) {
      undoStack.value.push([...dragBatch.value])
      redoStack.value = []
      const last = dragBatch.value[dragBatch.value.length - 1]
      const msgs = conflictMap.value.get(`${last.employeeId}_${last.date}`)
      if (msgs?.length) ElMessage.warning(msgs[0])
    }
  }
  painting.value = false
  dragBatch.value = []
  pointerStart.value = null
  pointerMoved.value = false
}

function onCellClick(employeeId: string, date: string) {
  if (openConflict(employeeId, date)) return
  openCellDetail(employeeId, date)
}

function onPinchStart(e: TouchEvent) {
  if (e.touches.length !== 2) return
  const [a, b] = [e.touches[0], e.touches[1]]
  pinchStartDist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
  pinchStartScale = matrixScale.value
}

function onPinchMove(e: TouchEvent) {
  if (e.touches.length !== 2 || !pinchStartDist) return
  e.preventDefault()
  const [a, b] = [e.touches[0], e.touches[1]]
  const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
  matrixScale.value = Math.min(1.6, Math.max(0.85, pinchStartScale * (dist / pinchStartDist)))
}

function coverConflictWithBrush() {
  if (!conflictTip.value) return
  const { employeeId, date } = conflictTip.value
  conflictTip.value = null
  paint(employeeId, date)
}

let longPressTimer: ReturnType<typeof setTimeout> | null = null
function onCellTouchStart(employeeId: string, date: string) {
  if (!editMode.value) return
  longPressTimer = setTimeout(() => {
    cellMenu.value = { employeeId, date }
    try {
      navigator.vibrate?.(15)
    } catch {
      /* ignore */
    }
  }, 480)
}
function onCellTouchEnd() {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

function undo() {
  const batch = undoStack.value.pop()
  if (!batch?.length) return
  batch
    .slice()
    .reverse()
    .forEach((item) => {
      applyCell(item.employeeId, item.date, item.prev)
    })
  redoStack.value.push(batch)
  persistDraft()
}

function redo() {
  const batch = redoStack.value.pop()
  if (!batch?.length) return
  batch.forEach((item) => applyCell(item.employeeId, item.date, item.next))
  undoStack.value.push(batch)
  persistDraft()
}

function persistDraft() {
  localStorage.setItem(
    DRAFT_KEY,
    JSON.stringify({
      weekAnchor: weekAnchor.value,
      selectedDeptId: selectedDeptId.value,
      brushId: brushId.value,
      at: Date.now(),
    }),
  )
}

function restoreDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return
    const data = JSON.parse(raw) as {
      weekAnchor?: string
      selectedDeptId?: string
      brushId?: string
    }
    if (data.weekAnchor) weekAnchor.value = data.weekAnchor
    if (data.selectedDeptId) selectedDeptId.value = data.selectedDeptId
    if (data.brushId) brushId.value = data.brushId
  } catch {
    /* ignore */
  }
}

function resolveActionTeams() {
  if (enterpriseTeams.value.length) return enterpriseTeams.value
  if (scheduleTeamId.value) {
    const t = store.teams.find((x) => x.id === scheduleTeamId.value)
    return t ? [t] : []
  }
  return []
}

function openCancelShift() {
  if (!cellDetail.value || !detailPublishedAssignment.value) return
  if (detailIsHistory.value) {
    ElMessage.warning('历史班次不可取消')
    return
  }
  if (!detailIsLocked.value) {
    ElMessage.info('仅已确认班次需走取消班次流程')
    return
  }
  cancelForm.value = { reasonCode: 'business_change', reasonOther: '' }
  cancelSheetOpen.value = true
}

async function submitCancelShift() {
  if (!cellDetail.value || !detailPublishedAssignment.value) return
  try {
    const reason = buildCancelShiftReasonText(
      cancelForm.value.reasonCode,
      cancelForm.value.reasonOther,
    )
    cancelSubmitting.value = true
    const asn = detailPublishedAssignment.value
    const req = store.submitCancelShiftRequest({
      employeeId: cellDetail.value.employeeId,
      date: cellDetail.value.date,
      shiftId: asn.shiftId,
      teamId: asn.teamId || resolveTeamId(cellDetail.value.employeeId) || '',
      reason,
      reasonCode: cancelForm.value.reasonCode,
      reasonOther:
        cancelForm.value.reasonCode === 'other'
          ? cancelForm.value.reasonOther.trim()
          : undefined,
      initiatedBy: 'admin',
      source: 'schedule',
      cancelScope: 'person',
    })
    cancelSheetOpen.value = false
    try {
      await ElMessageBox.confirm('取消班次申请已创建，是否立即审批通过？', '发起取消班次', {
        type: 'warning',
        confirmButtonText: '立即通过',
        cancelButtonText: '稍后审批',
      })
      store.reviewCancelShiftRequest(req.id, true, '企业小程序审批通过', '企业小程序')
      ElMessage.success('班次已取消')
      cellDetail.value = null
    } catch {
      ElMessage.success('取消班次申请已提交，可在「考勤审批」中查看')
      cellDetail.value = null
    }
  } catch (e) {
    ElMessage.warning(e instanceof Error ? e.message : '提交失败')
  } finally {
    cancelSubmitting.value = false
  }
}

function copyLastWeek() {
  if (!memberIds.value.length) {
    ElMessage.warning('当前部门暂无人员')
    return
  }
  if (!editMode.value) {
    enterEditMode()
    if (!editMode.value) return
  }
  const targetDates = weekDays.value
  const sourceDates = targetDates.map((d) => addDays(d, -7))
  let count = 0
  const teams = resolveActionTeams()
  if (teams.length) {
    teams.forEach((t) => {
      const ids = memberIds.value.filter((id) => t.memberIds.includes(id))
      if (!ids.length) return
      count += store.cloneAssignmentsFromDates(t.id, sourceDates, targetDates, ids)
    })
  } else {
    memberIds.value.forEach((employeeId) => {
      const tid = resolveTeamId(employeeId)
      if (!tid) return
      count += store.cloneAssignmentsFromDates(tid, sourceDates, targetDates, [employeeId])
    })
  }
  moreOpen.value = false
  ElMessage.success(
    count ? `已复制上周 ${count} 条排班（已确认班次保持不变）` : '上周无可复制排班',
  )
}

async function clearDraftPeriod() {
  const dates = weekDays.value.filter((d) => isScheduleFutureDate(d, SCHEDULE_DEMO_TODAY))
  if (!dates.length) {
    ElMessage.warning('当前周没有可清空的未来班次草稿')
    return
  }
  try {
    await ElMessageBox.confirm('将清空本周未发布草稿并恢复至上次发布版本', '清空草稿', {
      type: 'warning',
      confirmButtonText: '清空',
      cancelButtonText: '取消',
    })
  } catch {
    return
  }
  const teams = resolveActionTeams()
  if (teams.length) {
    teams.forEach((t) => store.revertDraftForPeriod(t.id, dates))
  } else {
    memberIds.value.forEach((employeeId) => {
      const tid = resolveTeamId(employeeId)
      if (tid) store.revertDraftForPeriod(tid, dates)
    })
  }
  undoStack.value = []
  redoStack.value = []
  editMode.value = false
  moreOpen.value = false
  ElMessage.success('草稿已清空')
}

function openPublishLogFromMore() {
  moreOpen.value = false
  publishLogOpen.value = true
}

function saveDraft() {
  persistDraft()
  ElMessage.success('排班草稿已保存')
}

function enterEditMode() {
  if (!selectedDeptId.value) {
    ElMessage.warning('请先选择叶子部门')
    deptPickerOpen.value = true
    return
  }
  if (!memberIds.value.length) {
    ElMessage.warning('该部门暂无在职人员')
    return
  }
  if (!scheduleTeamId.value) {
    ElMessage.warning('当前部门未关联班组，无法划线排班')
    return
  }
  if (!hasMutableWeekDates.value) {
    ElMessage.warning('当前周没有可编辑的未来班次')
    return
  }
  editMode.value = true
  if (scheduleMode.value === 'shift' && !selectedLineShiftId.value) {
    selectedLineShiftId.value = groupShifts.value[0]?.shift.id ?? null
  }
}

async function publishWeek() {
  const teams = enterpriseTeams.value.length
    ? enterpriseTeams.value
    : scheduleTeamId.value
      ? store.teams.filter((t) => t.id === scheduleTeamId.value)
      : []
  if (!teams.length) {
    ElMessage.warning('当前部门暂无可用班组，请先配置班组或人员')
    return
  }
  const dates = weekDays.value.filter((d) => isScheduleFutureDate(d, SCHEDULE_DEMO_TODAY))
  if (!dates.length) {
    ElMessage.warning('没有可发布的未来班次')
    return
  }
  try {
    await ElMessageBox.confirm(
      `确认发布 ${selectedDeptLabel.value} · ${weekLabel.value} 的排班？变更的待确认班次将通知灵工重新确认；已确认班次保持不变。`,
      '发布排班',
      { type: 'warning', confirmButtonText: '确认发布' },
    )
    teams.forEach((t) => {
      store.publishSchedulePeriod(t.id, dates, '企业小程序')
    })
    editMode.value = false
    undoStack.value = []
    redoStack.value = []
    ElMessage.success('排班已发布，可在矩阵中查看灵工确认状态')
  } catch {
    /* cancel */
  }
}

function selectDepartment(id: string) {
  selectedDeptId.value = id
  deptPickerOpen.value = false
  editMode.value = false
  undoStack.value = []
  redoStack.value = []
}

function syncLineSelectedDate() {
  const next =
    weekDays.value.find((d) => isScheduleFutureDate(d, SCHEDULE_DEMO_TODAY)) || weekDays.value[0]
  if (next) lineSelectedDate.value = next
}

watch([weekAnchor, selectedDeptId, brushId], persistDraft)

watch([weekAnchor, selectedDeptId], () => {
  editMode.value = false
  undoStack.value = []
  redoStack.value = []
  selectedLineShiftId.value = null
  syncLineSelectedDate()
})

watch(weekDays, syncLineSelectedDate, { immediate: true })

function onOrientation() {
  landscapeTip.value =
    typeof window !== 'undefined' && window.matchMedia('(orientation: landscape)').matches
}

onMounted(() => {
  restoreDraft()
  onOrientation()
  window.addEventListener('orientationchange', onOrientation)
  window.addEventListener('resize', onOrientation)
  window.addEventListener('pointerup', onCellPointerUp)
  window.addEventListener('pointermove', onMatrixPointerMove)
})

onUnmounted(() => {
  window.removeEventListener('orientationchange', onOrientation)
  window.removeEventListener('resize', onOrientation)
  window.removeEventListener('pointerup', onCellPointerUp)
  window.removeEventListener('pointermove', onMatrixPointerMove)
})
</script>

<template>
  <div class="page">
    <header class="nav">
      <button type="button" class="nav-btn" aria-label="返回" @click="router.back()">
        <el-icon :size="20"><ArrowLeft /></el-icon>
      </button>
      <h1>划线排班</h1>
      <button type="button" class="nav-more-text" @click="moreOpen = true">更多</button>
    </header>

    <div class="filter-bar">
      <div class="week-card">
        <button type="button" class="week-arrow" @click="shiftWeek(-1)">
          <el-icon><ArrowLeft /></el-icon>
        </button>
        <div class="week-text">
          <strong>{{ weekLabel }}</strong>
          <span>{{ weekRange }}</span>
        </div>
        <button type="button" class="week-arrow" @click="shiftWeek(1)">
          <el-icon><ArrowRight /></el-icon>
        </button>
      </div>
      <button
        type="button"
        class="dept-select"
        :disabled="!departmentOptions.length"
        @click="deptPickerOpen = true"
      >
        <span>{{ selectedDeptLabel }}</span>
        <el-icon :size="14"><ArrowRight /></el-icon>
      </button>
    </div>

    <div class="status-bar" :class="statusBar.tone">
      <strong>{{ statusBar.label }}</strong>
      <span>{{ statusBar.desc }}</span>
      <button
        v-if="publishHistory.length"
        type="button"
        class="status-link"
        @click="publishLogOpen = true"
      >
        发布记录
        <template v-if="currentPublishVersion">V{{ currentPublishVersion }}</template>
      </button>
    </div>

    <p v-if="landscapeTip" class="landscape">建议竖屏使用；横屏可展示更多日期列</p>

    <div v-if="editMode && !!hasMutableWeekDates" class="mode-tabs">
      <button
        type="button"
        :class="{ active: scheduleMode === 'shift' }"
        @click="scheduleMode = 'shift'"
      >
        班次划线
      </button>
      <button
        type="button"
        :class="{ active: scheduleMode === 'custom' }"
        @click="scheduleMode = 'custom'"
      >
        自定义排班
      </button>
    </div>

    <div
      v-if="editMode && scheduleMode === 'shift' && !!hasMutableWeekDates"
      class="shift-chips"
    >
      <button
        v-for="d in groupShifts"
        :key="d.shift.id"
        type="button"
        class="shift-chip"
        :class="{ active: selectedLineShiftId === d.shift.id }"
        :style="{ '--chip': d.shift.color }"
        @click="selectedLineShiftId = d.shift.id"
      >
        <strong>{{ d.template.name }}</strong>
        <span>{{ d.template.startTime.slice(0, 5) }}-{{ d.template.endTime.slice(0, 5) }}</span>
      </button>
      <p v-if="!groupShifts.length" class="shift-empty">
        当前部门未配置考勤组班次，请先在考勤组中维护班次，或改用自定义排班
      </p>
    </div>

    <div
      v-if="showLinePanel"
      class="line-panel-wrap"
    >
      <ScheduleLinePanel
        v-model:selected-date="lineSelectedDate"
        :team-id="scheduleTeamId"
        :member-ids="memberIds"
        :week-dates="weekDays"
        :edit-mode="editMode"
        :mode="scheduleMode"
        :shift-context="scheduleMode === 'shift' ? selectedLineShiftContext : null"
        default-scope="week"
        :conflict-map="conflictMap"
        :is-cell-locked="isCellLocked"
        @enter-edit="enterEditMode"
      />
    </div>

    <div v-if="editMode && !!hasMutableWeekDates" class="hint">
      <el-icon class="hint-icon"><WarningFilled /></el-icon>
      <span>
        {{
          scheduleMode === 'shift'
            ? selectedLineShiftContext
              ? `已选「${selectedLineShiftContext.shiftName}」，按周拖选日期即可划线（同后台班次划线）`
              : '请先选择考勤组班次，或切换到自定义排班'
            : '上方按日/按周自定义划线（同后台）；下方矩阵可查看本周概览'
        }}
      </span>
    </div>

    <div v-else-if="!!hasMutableWeekDates" class="hint view-hint">
      <el-icon class="hint-icon"><WarningFilled /></el-icon>
      <span>点击格子查看详情；已过期班次只读，未来班次可点「编辑排班」选择班次划线或自定义排班</span>
    </div>

    <div v-else class="hint history-hint">
      <el-icon class="hint-icon"><WarningFilled /></el-icon>
      <span>本周班次均已过期，仅可查看当时班次与灵工确认状态</span>
    </div>

    <div class="matrix-wrap">
      <div class="matrix-scroll" @touchstart="onPinchStart" @touchmove="onPinchMove">
        <table
          class="matrix"
          :style="{ transform: `scale(${matrixScale})`, transformOrigin: 'top left' }"
        >
          <thead>
            <tr>
              <th class="sticky head-person">人员</th>
              <th v-for="(d, i) in weekDays" :key="d" class="head-day">
                <div class="wd">{{ weekdayLabels[i] }}</div>
                <div class="md">{{ d.slice(5).replace('-', '.') }}</div>
              </th>
            </tr>
          </thead>
          <tbody>
            <template v-for="group in groupedRows" :key="group.id">
              <tr class="group-row">
                <td class="sticky group-cell" :colspan="weekDays.length + 1">
                  <span class="group-bar" :style="{ background: group.color }" />
                  <span class="group-name" :style="{ color: group.color }">{{ group.name }}</span>
                </td>
              </tr>
              <tr
                v-for="emp in group.members"
                :key="emp.id"
                :class="{ 'row-selected': selectedRowId === emp.id }"
              >
                <td
                  class="sticky name-cell"
                  :class="{ selected: selectedRowId === emp.id }"
                  @click="selectedRowId = emp.id"
                >
                  <div class="name-inner">
                    <span class="avatar" :style="{ background: group.color }">
                      {{ avatarChar(emp.name) }}
                    </span>
                    <span class="ename">{{ emp.name }}</span>
                    <span v-if="empHasConflict(emp.id)" class="warn-dot">!</span>
                  </div>
                </td>
                <td
                  v-for="d in weekDays"
                  :key="d"
                  class="cell"
                  :class="{
                    conflict: conflictMap.has(`${emp.id}_${d}`),
                    locked: isCellLocked(emp.id, d),
                    rejected: displayConfirmStatus(emp.id, d) === 'rejected',
                    history: isCellHistorical(emp.id, d),
                  }"
                  :data-employee-id="emp.id"
                  :data-date="d"
                  @click="onCellClick(emp.id, d)"
                  @pointerdown="onCellPointerDown(emp.id, d, $event)"
                  @touchstart.passive="onCellTouchStart(emp.id, d)"
                  @touchend="onCellTouchEnd"
                  @touchcancel="onCellTouchEnd"
                  @contextmenu.prevent="editMode && (cellMenu = { employeeId: emp.id, date: d })"
                >
                  <span
                    v-if="cellDisplay(emp.id, d)"
                    class="chip"
                    :class="[cellDisplay(emp.id, d)!.kind, { locked: cellDisplay(emp.id, d)!.locked }]"
                    :style="chipStyle(emp.id, d)"
                  >
                    <template v-if="cellDisplay(emp.id, d)!.kind === 'conflict'">
                      ⚠{{ cellDisplay(emp.id, d)!.short }}
                    </template>
                    <template v-else>
                      {{ cellDisplay(emp.id, d)!.short }}
                    </template>
                  </span>
                  <span
                    v-if="displayConfirmStatus(emp.id, d)"
                    class="confirm-badge"
                    :style="{
                      color: confirmStatusMap[displayConfirmStatus(emp.id, d)!].color,
                      background: confirmStatusMap[displayConfirmStatus(emp.id, d)!].bg,
                    }"
                  >
                    {{ confirmStatusMap[displayConfirmStatus(emp.id, d)!].short }}
                  </span>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
      <div v-if="!employees.length" class="empty">
        {{ selectedDeptId ? '该部门暂无在职人员' : '请先选择叶子部门' }}
      </div>
    </div>

    <div class="legend">
      <span class="legend-title">图例</span>
      <span class="lg"><i :style="{ background: FLEX_SHIFT_COLOR }" />自定义划线</span>
      <span v-for="b in brushes.slice(0, 3)" :key="b.id" class="lg">
        <i :style="{ background: b.color }" />{{ b.name }}
      </span>
      <span class="lg"><i style="background: #e5e7eb" />休息</span>
      <span class="lg"><i style="background: #fde68a" />请假</span>
      <span class="lg"><i style="background: #ef4444" />冲突</span>
      <span
        v-for="(cfg, key) in confirmStatusMap"
        :key="key"
        class="lg"
      >
        <i :style="{ background: cfg.bg, border: `1px solid ${cfg.color}` }" />{{ cfg.label }}
      </span>
      <span class="lg"><i class="dot-locked" />已确认（置灰）</span>
    </div>

    <footer class="dock">
      <div class="stats">
        <span>已划线 <b>{{ stats.count }}</b> 条</span>
        <span class="sep">|</span>
        <span>总工时 <b>{{ stats.hours }}h</b></span>
        <template v-if="confirmStats.pending + confirmStats.confirmed + confirmStats.rejected > 0">
          <span class="sep">|</span>
          <span>待确认 <b>{{ confirmStats.pending }}</b></span>
          <span class="sep">·</span>
          <span>已确认 <b>{{ confirmStats.confirmed }}</b></span>
          <span v-if="confirmStats.rejected" class="sep">·</span>
          <span v-if="confirmStats.rejected">已拒绝 <b>{{ confirmStats.rejected }}</b></span>
        </template>
        <span class="sep">|</span>
        <span class="conflict-stat">
          <i class="c-dot" />
          <b>{{ stats.conflicts }}</b> 冲突
        </span>
      </div>
      <div v-if="!!hasMutableWeekDates && !editMode" class="actions view-actions">
        <button type="button" class="text-more" @click="moreOpen = true">更多</button>
        <button type="button" class="btn edit" @click="enterEditMode">编辑排班</button>
      </div>
      <div v-else-if="!!hasMutableWeekDates && editMode" class="actions">
        <button type="button" class="icon-btn" :disabled="!undoStack.length" @click="undo">
          <el-icon :size="18"><RefreshLeft /></el-icon>
        </button>
        <button type="button" class="icon-btn" :disabled="!redoStack.length" @click="redo">
          <el-icon :size="18"><RefreshRight /></el-icon>
        </button>
        <button type="button" class="text-more" @click="moreOpen = true">更多</button>
        <button type="button" class="btn save" @click="saveDraft">
          <span class="disk" />
          保存排班
        </button>
        <button type="button" class="btn publish" @click="publishWeek">
          <el-icon><Promotion /></el-icon>
          发布排班
        </button>
      </div>
      <div v-else class="actions readonly-actions">
        <button type="button" class="text-more" @click="moreOpen = true">更多</button>
      </div>
    </footer>

    <div v-if="deptPickerOpen" class="sheet-mask" @click="deptPickerOpen = false">
      <div class="sheet" @click.stop>
        <h3>选择部门</h3>
        <p class="sheet-sub">仅展示叶子部门</p>
        <button
          v-for="d in departmentOptions"
          :key="d.id"
          type="button"
          class="sheet-row"
          :class="{ active: d.id === selectedDeptId }"
          @click="selectDepartment(d.id)"
        >
          {{ d.label }}
          <small v-if="d.id === selectedDeptId">当前</small>
        </button>
        <div v-if="!departmentOptions.length" class="empty">暂无可选叶子部门</div>
        <button type="button" class="sheet-cancel" @click="deptPickerOpen = false">取消</button>
      </div>
    </div>

    <div v-if="moreOpen" class="sheet-mask" @click="moreOpen = false">
      <div class="sheet" @click.stop>
        <h3>快捷操作</h3>
        <button type="button" class="sheet-row" @click="copyLastWeek">
          <el-icon><DocumentCopy /></el-icon>
          复制上周
        </button>
        <button type="button" class="sheet-row danger" @click="clearDraftPeriod">
          清空草稿
        </button>
        <button type="button" class="sheet-row" @click="openPublishLogFromMore">
          发布日志
        </button>
        <button type="button" class="sheet-cancel" @click="moreOpen = false">取消</button>
      </div>
    </div>

    <div v-if="cellMenu" class="sheet-mask" @click="cellMenu = null">
      <div class="sheet" @click.stop>
        <h3>选择班次</h3>
        <button
          v-for="opt in longPressOptions"
          :key="opt.id"
          type="button"
          class="sheet-row"
          @click="paintBrush(cellMenu!.employeeId, cellMenu!.date, opt.id)"
        >
          {{ opt.label }}
        </button>
        <button type="button" class="sheet-cancel" @click="cellMenu = null">取消</button>
      </div>
    </div>

    <div v-if="conflictTip" class="sheet-mask" @click="conflictTip = null">
      <div class="sheet" @click.stop>
        <h3>冲突详情</h3>
        <p v-for="(m, i) in conflictTip.messages" :key="i" class="conflict-msg">{{ m }}</p>
        <button type="button" class="sheet-row" @click="coverConflictWithBrush">
          用当前画笔（{{ selectedBrush?.name }}）覆盖
        </button>
        <button type="button" class="sheet-cancel" @click="conflictTip = null">知道了</button>
      </div>
    </div>

    <div v-if="cellDetail && detailEmployee" class="sheet-mask" @click="cellDetail = null">
      <div class="sheet detail-sheet" @click.stop>
        <h3>排班详情</h3>
        <div class="detail-row">
          <span class="detail-label">员工</span>
          <span>{{ detailEmployee.name }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">日期</span>
          <span>{{ cellDetail.date }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">班次</span>
          <span>{{ shiftLabel(detailAssignment) }}</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">发布状态</span>
          <span v-if="detailPublishedAssignment">已发布</span>
          <span v-else-if="detailDraftAssignment">草稿（未发布）</span>
          <span v-else>未排班</span>
        </div>
        <div class="detail-row">
          <span class="detail-label">灵工确认</span>
          <span
            v-if="detailConfirmStatus"
            class="confirm-pill"
            :style="{
              color: confirmStatusMap[detailConfirmStatus].color,
              background: confirmStatusMap[detailConfirmStatus].bg,
            }"
          >
            {{ confirmStatusMap[detailConfirmStatus].label }}
          </span>
          <span v-else-if="detailPublishedAssignment">—</span>
          <span v-else>—</span>
        </div>
        <p v-if="detailIsLocked" class="detail-tip warn">
          灵工已确认该班次，不可直接编辑，可通过取消班次处理。
        </p>
        <p v-else-if="detailIsHistory" class="detail-tip">
          该班次已过期，不可修改、取消或发布。
        </p>
        <p v-else-if="detailDraftAssignment && detailPublishedAssignment" class="detail-tip">
          存在未发布修改，重新发布后将通知灵工确认。
        </p>
        <button
          v-if="detailIsLocked && !detailIsHistory"
          type="button"
          class="sheet-primary danger"
          @click="openCancelShift"
        >
          取消班次
        </button>
        <button type="button" class="sheet-cancel" @click="cellDetail = null">关闭</button>
      </div>
    </div>

    <div v-if="cancelSheetOpen" class="sheet-mask" @click="cancelSheetOpen = false">
      <div class="sheet" @click.stop>
        <h3>发起取消班次</h3>
        <p class="sheet-sub">
          {{ detailEmployee?.name }} · {{ cellDetail?.date }} · {{ shiftLabel(detailPublishedAssignment) }}
        </p>
        <p class="detail-tip warn">取消通过后将移除该日排班</p>
        <div class="reason-list">
          <label
            v-for="opt in CANCEL_SHIFT_REASON_OPTIONS"
            :key="opt.value"
            class="reason-item"
            :class="{ active: cancelForm.reasonCode === opt.value }"
          >
            <input v-model="cancelForm.reasonCode" type="radio" :value="opt.value">
            <span>{{ opt.label }}</span>
          </label>
        </div>
        <textarea
          v-if="cancelForm.reasonCode === 'other'"
          v-model="cancelForm.reasonOther"
          class="reason-other"
          rows="3"
          maxlength="200"
          placeholder="请填写其他取消原因"
        />
        <button
          type="button"
          class="sheet-primary danger"
          :disabled="cancelSubmitting"
          @click="submitCancelShift"
        >
          {{ cancelSubmitting ? '提交中…' : '提交取消' }}
        </button>
        <button type="button" class="sheet-cancel" @click="cancelSheetOpen = false">返回</button>
      </div>
    </div>

    <div v-if="publishLogOpen" class="sheet-mask" @click="publishLogOpen = false">
      <div class="sheet publish-sheet" @click.stop>
        <h3>排班发布记录</h3>
        <p class="publish-sub">
          {{ weekLabel }} · 当前版本
          <strong v-if="currentPublishVersion">V{{ currentPublishVersion }}</strong>
          <strong v-else>未发布</strong>
        </p>
        <div v-if="!publishHistory.length" class="empty-inline">暂无发布记录</div>
        <button
          v-for="row in publishHistory"
          :key="row.id"
          type="button"
          class="publish-row"
          @click="openPublishRecord(row)"
        >
          <div class="publish-row-head">
            <span v-if="row.version" class="ver">V{{ row.version }}</span>
            <span class="time">{{ formatPublishTime(row.publishedAt) }}</span>
          </div>
          <div class="publish-row-meta">
            {{ row.periodStart }} ~ {{ row.periodEnd }} · {{ row.assignmentCount }} 条 · {{ row.publishedBy }}
          </div>
          <div class="publish-row-note">{{ row.changeNote || '—' }}</div>
        </button>
        <button type="button" class="sheet-cancel" @click="publishLogOpen = false">关闭</button>
      </div>
    </div>

    <div v-if="selectedPublishRecord" class="sheet-mask" @click="closePublishRecord">
      <div class="sheet publish-sheet" @click.stop>
        <h3>版本 V{{ selectedPublishRecord.version }} 快照</h3>
        <p class="publish-sub">
          {{ formatPublishTime(selectedPublishRecord.publishedAt) }} · {{ selectedPublishRecord.publishedBy }}
        </p>
        <div class="snapshot-list">
          <div
            v-for="row in selectedPublishRecord.snapshot ?? []"
            :key="`${row.employeeId}_${row.date}`"
            class="snapshot-item"
          >
            <div class="snapshot-main">
              <strong>{{ store.employees.find((e) => e.id === row.employeeId)?.name ?? row.employeeId }}</strong>
              <span>{{ row.date }}</span>
            </div>
            <div class="snapshot-sub">
              {{ store.shifts.find((s) => s.id === row.shiftId)?.name ?? row.shiftId }}
              <span
                v-if="row.published && normalizeConfirmStatus(row.confirmStatus)"
                class="confirm-pill small"
                :style="{
                  color: confirmStatusMap[normalizeConfirmStatus(row.confirmStatus)!].color,
                  background: confirmStatusMap[normalizeConfirmStatus(row.confirmStatus)!].bg,
                }"
              >
                {{ confirmStatusMap[normalizeConfirmStatus(row.confirmStatus)!].label }}
              </span>
            </div>
          </div>
        </div>
        <button type="button" class="sheet-cancel" @click="closePublishRecord">返回</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  min-height: 100%;
  background: #fff;
  padding-bottom: calc(108px + env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-direction: column;
}
.nav {
  display: grid;
  grid-template-columns: 40px 1fr auto;
  align-items: center;
  padding: 8px 8px 6px;
  background: #fff;
  position: sticky;
  top: 0;
  z-index: 40;
}
.nav-btn {
  width: 40px;
  height: 40px;
  border: none;
  background: transparent;
  color: #111827;
  display: flex;
  align-items: center;
  justify-content: center;
}
.nav-more-text {
  height: 40px;
  border: none;
  background: transparent;
  color: #228BFF;
  font-size: 14px;
  font-weight: 600;
  padding: 0 8px;
}
.nav-spacer {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
}
h1 {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  text-align: center;
  color: #111827;
}
.filter-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px 10px;
  background: #fff;
}
.week-card {
  flex: 1.15;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  background: #f8fafc;
  border: 1px solid #eef2f7;
  border-radius: 12px;
  padding: 6px 4px;
}
.week-arrow {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.week-text {
  flex: 1;
  min-width: 0;
  text-align: center;
  line-height: 1.25;
}
.week-text strong {
  display: block;
  font-size: 13px;
  color: #111827;
  font-weight: 700;
}
.week-text span {
  font-size: 11px;
  color: #94a3b8;
}
.team-select {
  width: 96px;
  flex-shrink: 0;
  height: 40px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  font-size: 12px;
  color: #334155;
  padding: 0 8px;
}
.dept-select {
  flex: 1;
  min-width: 0;
  height: 40px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  font-size: 12px;
  color: #334155;
  padding: 0 10px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}
.dept-select span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  text-align: left;
  flex: 1;
}
.dept-select:disabled {
  opacity: 0.55;
}
.mode-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  margin: 0 12px 8px;
  background: #f3f4f6;
  border-radius: 10px;
  padding: 3px;
}
.mode-tabs button {
  border: none;
  background: transparent;
  height: 34px;
  border-radius: 8px;
  font-size: 13px;
  color: #6b7280;
}
.mode-tabs button.active {
  background: #fff;
  color: #228BFF;
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.06);
}
.shift-chips {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 0 12px 8px;
  -webkit-overflow-scrolling: touch;
}
.shift-chip {
  flex-shrink: 0;
  min-width: 96px;
  border: 1px solid #e5e7eb;
  background: #fff;
  border-radius: 10px;
  padding: 8px 10px;
  text-align: left;
}
.shift-chip strong {
  display: block;
  font-size: 13px;
  color: #111827;
}
.shift-chip span {
  display: block;
  margin-top: 2px;
  font-size: 11px;
  color: #9ca3af;
}
.shift-chip.active {
  border-color: var(--chip, #228BFF);
  background: color-mix(in srgb, var(--chip, #228BFF) 12%, #fff);
  box-shadow: inset 3px 0 0 var(--chip, #228BFF);
}
.shift-chip.active strong {
  color: var(--chip, #228BFF);
}
.shift-empty {
  margin: 0;
  padding: 8px 4px;
  font-size: 12px;
  color: #9ca3af;
  line-height: 1.45;
}
.line-panel-wrap {
  margin: 0 12px 8px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid #e5e7eb;
  background: #fff;
}
.line-panel-wrap :deep(.line-panel) {
  padding: 12px;
  box-shadow: none;
  border: none;
  border-radius: 0;
}
.line-panel-wrap :deep(.line-panel-head .panel-title) {
  font-size: 14px;
}
.line-panel-wrap :deep(.line-toolbar .hint) {
  display: none;
}
.line-panel-wrap :deep(.emp-col) {
  width: 72px;
  padding: 6px 8px;
  font-size: 12px;
}
.line-panel-wrap :deep(.act-col) {
  width: 52px;
}
.line-panel-wrap :deep(.line-table .line-header),
.line-panel-wrap :deep(.line-table .line-row) {
  min-width: 640px;
}
.sheet-sub {
  margin: -4px 0 10px;
  font-size: 12px;
  color: #9ca3af;
}
.sheet-row.active {
  color: #228BFF;
  font-weight: 600;
  background: #EBF4FF;
}
.landscape {
  margin: 0 12px 8px;
  padding: 6px 10px;
  font-size: 11px;
  color: #b45309;
  background: #fffbeb;
  border-radius: 8px;
}
.brushes {
  display: flex;
  gap: 8px;
  padding: 0 12px 8px;
  overflow-x: auto;
  scrollbar-width: none;
}
.brushes::-webkit-scrollbar {
  display: none;
}
.brush {
  flex-shrink: 0;
  min-width: 78px;
  border: 1.5px solid #e5e7eb;
  border-left: 4px solid var(--brush);
  border-radius: 12px;
  background: #fff;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  transition: 0.15s ease;
}
.brush.active {
  border-color: var(--brush);
  background: var(--brush-soft);
  box-shadow: 0 0 0 1px var(--brush);
}
.brush-name {
  font-size: 13px;
  font-weight: 700;
  color: #111827;
}
.brush-time {
  font-size: 10px;
  color: #94a3b8;
  white-space: nowrap;
}
.hint {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 12px 10px;
  padding: 8px 10px;
  background: #fffbeb;
  border-radius: 10px;
  font-size: 12px;
  color: #92400e;
}
.hint-icon {
  color: #f59e0b;
  font-size: 14px;
  flex-shrink: 0;
}
.matrix-wrap {
  flex: 1;
  min-height: 240px;
  border-top: 1px solid #f1f5f9;
}
.matrix-scroll {
  overflow: auto;
  max-height: calc(100vh - 360px);
  -webkit-overflow-scrolling: touch;
}
.matrix {
  border-collapse: separate;
  border-spacing: 0;
  min-width: 100%;
  background: #fff;
}
.matrix th,
.matrix td {
  border-bottom: 1px solid #f1f5f9;
  border-right: 1px solid #f8fafc;
  text-align: center;
  font-size: 12px;
  height: 48px;
  min-width: 54px;
  user-select: none;
  touch-action: none;
  padding: 4px;
}
.head-day {
  position: sticky;
  top: 0;
  z-index: 3;
  background: #fafafa;
  color: #64748b;
  font-weight: 600;
  padding: 8px 4px !important;
}
.head-day .wd {
  font-size: 12px;
  color: #334155;
}
.head-day .md {
  font-size: 10px;
  color: #94a3b8;
  font-weight: 400;
  margin-top: 2px;
}
.sticky {
  position: sticky;
  left: 0;
  z-index: 4;
  background: #fff;
  min-width: 88px !important;
  max-width: 96px;
  box-shadow: 2px 0 8px rgba(15, 23, 42, 0.04);
}
.head-person {
  z-index: 5;
  background: #fafafa;
  color: #64748b;
  font-weight: 600;
}
.group-row td {
  height: 30px !important;
  background: #f8fafc;
  border-right: none;
  text-align: left !important;
}
.group-cell {
  z-index: 5;
  background: #f8fafc !important;
  padding: 0 10px !important;
  position: sticky;
  left: 0;
}
.group-bar {
  width: 3px;
  height: 14px;
  border-radius: 2px;
  display: inline-block;
  vertical-align: middle;
  margin-right: 6px;
}
.group-name {
  font-size: 11px;
  font-weight: 700;
  vertical-align: middle;
  white-space: nowrap;
}
.name-cell {
  text-align: left !important;
  padding: 0 8px !important;
}
.name-inner {
  display: flex;
  align-items: center;
  gap: 6px;
}
.name-cell.selected {
  background: #eff6ff;
}
.avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.ename {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
  white-space: nowrap;
}
.warn-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #ef4444;
  color: #fff;
  font-size: 10px;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.row-selected .cell {
  background: #f8fafc;
}
.cell {
  cursor: pointer;
  background: #fff;
}
.cell.conflict {
  animation: blink 1.1s ease infinite;
}
.cell.locked {
  background: #f8fafc;
}
.cell.rejected {
  background: #fff5f5;
}
.cell.history {
  background: #fafafa;
}
.cell {
  position: relative;
  vertical-align: middle;
}
.confirm-badge {
  display: block;
  margin: 2px auto 0;
  font-size: 9px;
  line-height: 1.2;
  padding: 1px 4px;
  border-radius: 4px;
  font-weight: 600;
  max-width: 42px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chip.locked {
  opacity: 0.85;
}
.status-bar {
  margin: 0 12px 8px;
  padding: 10px 12px;
  border-radius: 10px;
  font-size: 12px;
  line-height: 1.45;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px 10px;
}
.status-bar strong {
  font-size: 13px;
}
.status-bar span {
  flex: 1;
  min-width: 0;
  color: #64748b;
}
.status-bar.info {
  background: #eff6ff;
  color: #1d4ed8;
}
.status-bar.success {
  background: #f0fdf4;
  color: #15803d;
}
.status-bar.warning {
  background: #fffbeb;
  color: #b45309;
}
.status-bar.neutral {
  background: #f8fafc;
  color: #475569;
}
.status-link {
  border: none;
  background: none;
  color: #228BFF;
  font-size: 12px;
  font-weight: 600;
  padding: 0;
  flex-shrink: 0;
}
.history-hint {
  background: #f8fafc;
}
.dot-locked {
  background: #cbd5e1 !important;
  border: 1px solid #94a3b8 !important;
}
.detail-sheet .detail-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid #f1f5f9;
  font-size: 14px;
}
.detail-label {
  color: #94a3b8;
  flex-shrink: 0;
}
.detail-tip {
  margin: 12px 0 0;
  font-size: 12px;
  color: #64748b;
  line-height: 1.5;
}
.detail-tip.warn {
  color: #b45309;
  background: #fffbeb;
  padding: 8px 10px;
  border-radius: 8px;
}
.confirm-pill {
  display: inline-flex;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}
.confirm-pill.small {
  font-size: 10px;
  padding: 1px 6px;
}
.publish-sheet {
  max-height: 78vh;
  overflow: auto;
}
.publish-sub {
  margin: 0 0 12px;
  font-size: 12px;
  color: #64748b;
}
.publish-row {
  width: 100%;
  text-align: left;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
  padding: 10px 12px;
  margin-bottom: 8px;
}
.publish-row-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}
.publish-row-head .ver {
  font-weight: 700;
  color: #228BFF;
}
.publish-row-head .time {
  font-size: 11px;
  color: #94a3b8;
}
.publish-row-meta,
.publish-row-note {
  font-size: 12px;
  color: #64748b;
}
.snapshot-list {
  max-height: 50vh;
  overflow: auto;
  margin-bottom: 8px;
}
.snapshot-item {
  padding: 10px 0;
  border-bottom: 1px solid #f1f5f9;
}
.snapshot-main {
  display: flex;
  justify-content: space-between;
  font-size: 14px;
}
.snapshot-sub {
  margin-top: 4px;
  font-size: 12px;
  color: #64748b;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.empty-inline {
  padding: 24px 0;
  text-align: center;
  color: #94a3b8;
  font-size: 13px;
}
.view-hint {
  background: #f0fdf4;
  color: #166534;
}
.view-hint .hint-icon {
  color: #22c55e;
}
.readonly-actions {
  justify-content: center;
}
.readonly-actions .btn,
.view-actions .btn {
  width: 100%;
}
.view-actions {
  justify-content: center;
}
.btn.edit {
  background: #3b82f6;
  color: #fff;
}
.readonly-actions .btn {
  width: 100%;
}
@keyframes blink {
  50% {
    background: #fef2f2;
  }
}
.chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  height: 28px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
  padding: 0 6px;
  border: 1.5px solid transparent;
}
.chip.shift {
  color: inherit;
}
.chip.conflict {
  background: #ef4444 !important;
  color: #fff !important;
  font-size: 11px;
}
.chip.leave {
  border-style: solid;
}
.chip.rest {
  font-weight: 600;
}
.empty {
  padding: 40px;
  text-align: center;
  color: #94a3b8;
}
.legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 12px;
  padding: 10px 12px 12px;
  border-top: 1px solid #f1f5f9;
  font-size: 11px;
  color: #64748b;
}
.legend-title {
  font-weight: 700;
  color: #94a3b8;
}
.lg {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.lg i {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  display: inline-block;
}
.dock {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: 0;
  width: 100%;
  max-width: 430px;
  background: #fff;
  border-top: 1px solid #e5e7eb;
  padding: 8px 10px calc(8px + env(safe-area-inset-bottom, 0px));
  z-index: 50;
  box-shadow: 0 -6px 20px rgba(15, 23, 42, 0.06);
}
.stats {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #64748b;
  margin-bottom: 8px;
  padding: 0 2px;
}
.stats b {
  color: #111827;
  font-weight: 700;
}
.stats .sep {
  color: #e2e8f0;
}
.conflict-stat {
  color: #ef4444;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.conflict-stat b {
  color: #ef4444;
}
.c-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ef4444;
  display: inline-block;
}
.actions {
  display: flex;
  align-items: center;
  gap: 6px;
}
.icon-btn {
  width: 36px;
  height: 40px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.icon-btn:disabled {
  opacity: 0.35;
}
.more-btn {
  height: 40px;
  padding: 0 8px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
  color: #64748b;
  font-size: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0;
  line-height: 1.1;
  flex-shrink: 0;
}
.text-more {
  height: 40px;
  padding: 0 10px;
  border: none;
  background: transparent;
  color: #228BFF;
  font-size: 14px;
  font-weight: 600;
  flex-shrink: 0;
}
.btn {
  flex: 1;
  height: 40px;
  border: none;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 0;
}
.btn.save {
  background: #3b82f6;
  color: #fff;
}
.btn.publish {
  background: #22c55e;
  color: #fff;
}
.disk {
  width: 12px;
  height: 12px;
  border: 2px solid #fff;
  border-radius: 2px;
  position: relative;
}
.disk::after {
  content: '';
  position: absolute;
  top: 1px;
  right: 1px;
  width: 4px;
  height: 4px;
  background: #fff;
  border-radius: 1px;
}
.sheet-mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  z-index: 80;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.sheet {
  width: 100%;
  max-width: 430px;
  background: #fff;
  border-radius: 16px 16px 0 0;
  padding: 16px 12px calc(12px + env(safe-area-inset-bottom, 0px));
}
.sheet h3 {
  margin: 0 0 10px;
  font-size: 16px;
  text-align: center;
}
.sheet-row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  border: none;
  background: #f9fafb;
  border-radius: 12px;
  padding: 14px 12px;
  margin-bottom: 8px;
  font-size: 14px;
  color: #111827;
  text-align: left;
}
.sheet-row:disabled {
  opacity: 0.5;
}
.sheet-row.danger {
  color: #dc2626;
}
.sheet-row small {
  color: #94a3b8;
  font-size: 11px;
}
.switch-row {
  justify-content: space-between;
}
.switch-row input {
  width: 44px;
  height: 24px;
}
.sheet-cancel {
  width: 100%;
  height: 44px;
  border: none;
  border-radius: 12px;
  background: #f3f4f6;
  margin-top: 4px;
  font-size: 14px;
}
.sheet-primary {
  width: 100%;
  height: 44px;
  border: none;
  border-radius: 12px;
  background: #228BFF;
  color: #fff;
  margin-top: 8px;
  font-size: 14px;
  font-weight: 600;
}
.sheet-primary.danger {
  background: #ef4444;
}
.reason-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin: 8px 0 12px;
}
.reason-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  font-size: 13px;
  color: #374151;
  line-height: 1.4;
}
.reason-item.active {
  border-color: #228BFF;
  background: #EBF4FF;
  color: #228BFF;
}
.reason-item input {
  margin-top: 2px;
}
.reason-other {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 14px;
  margin-bottom: 8px;
  resize: vertical;
}
.conflict-msg {
  margin: 0 0 8px;
  padding: 10px 12px;
  background: #fef2f2;
  color: #b91c1c;
  border-radius: 10px;
  font-size: 13px;
}
</style>
