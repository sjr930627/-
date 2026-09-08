<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { WarningFilled } from '@element-plus/icons-vue'
import {
  parseScheduleTimeSegments,
  formatScheduleTimeSegmentsNote,
  mergeScheduleTimeSegments,
  scheduleSegmentAbsRange,
  isOvernightScheduleSegment,
  validateCrossDayScheduleSegments,
  spansCrossDaySchedule,
  formatScheduleSegmentLabel,
  extractCarryOverSegmentsFromPrevDay,
  extractCarryOverFromShiftTimes,
  scheduleSegmentsOverlap,
  CROSS_DAY_MIN_START_MINUTES,
  CROSS_DAY_MAX_SPAN_MINUTES,
  SCHEDULE_SLOT_MINUTES,
  SCHEDULE_SLOTS_PER_DAY,
  FLEX_SHIFT_ID,
  FLEX_SHIFT_COLOR,
  formatLineAssignmentLabel,
  cellKey,
  isScheduleHistoryDate,
  isScheduleShiftHistorical,
  type ScheduleTimeSegment,
} from '@/constants/schedule'
import {
  buildWorkSegmentsFromShiftWindow,
  defaultGrabBreakPeriodsForShift,
  formatBreakPeriodsRule,
  formatShiftTimeRangeLabel,
  isOvernightTimeRange,
  listInvalidBreakPeriodIndexes,
  resolveGrabShiftWorkHoursFromTimes,
} from '@/services/grabShift'
import type { GrabShiftBreakPeriod } from '@/types'
import { addDays, getWeekday } from '@/utils'
import { useAppStore } from '@/stores/app'

const props = defineProps<{
  teamId: string
  memberIds: string[]
  selectedDate: string
  weekDates: string[]
  editMode: boolean
  /** 按班次排班：绑定需求班次，划线即分配该班次时段 */
  shiftContext?: {
    shiftId: string
    shiftName: string
    startTime: string
    endTime: string
    color: string
  } | null
  /** custom=自定义灵活时段；shift=按班次需求 */
  mode?: 'shift' | 'custom'
  /** 合规冲突（与下方排班列表同源） */
  conflictMap?: Map<string, string[]>
  /** 已确认班次：置灰不可划线/清除 */
  isCellLocked?: (employeeId: string, date: string) => boolean
}>()

const emit = defineEmits<{
  enterEdit: []
  'update:selectedDate': [string]
}>()

const store = useAppStore()
const lineScope = ref<'day' | 'week'>('day')
/** 按周划线：起止时间（结束早于开始视为跨天） */
const weekStartTime = ref('08:00')
const weekEndTime = ref('16:00')
/** 按周：休息时间段（逻辑同班次休息配置） */
const weekHasBreak = ref(false)
const weekBreakPeriods = ref<GrabShiftBreakPeriod[]>(defaultGrabBreakPeriodsForShift('08:00', '16:00'))
/** 自定义按日：允许跨天划线（两日时间轴） */
const allowCrossDay = ref(false)

const weekOvernight = computed(() => isOvernightTimeRange(weekStartTime.value, weekEndTime.value))
const weekTimeLabel = computed(() =>
  formatShiftTimeRangeLabel(weekStartTime.value, weekEndTime.value),
)
const weekWorkHours = computed(() =>
  resolveGrabShiftWorkHoursFromTimes({
    startTime: weekStartTime.value,
    endTime: weekEndTime.value,
    hasBreakTime: weekHasBreak.value,
    breakPeriods: weekHasBreak.value ? weekBreakPeriods.value : [],
  }),
)
const weekInvalidBreakIndexes = computed(() =>
  weekHasBreak.value
    ? listInvalidBreakPeriodIndexes(weekStartTime.value, weekEndTime.value, weekBreakPeriods.value)
    : [],
)

function syncWeekBreakPeriods() {
  if (!weekHasBreak.value) return
  const invalid = listInvalidBreakPeriodIndexes(
    weekStartTime.value,
    weekEndTime.value,
    weekBreakPeriods.value,
  )
  if (invalid.length) {
    weekBreakPeriods.value = defaultGrabBreakPeriodsForShift(weekStartTime.value, weekEndTime.value)
  }
}

function onWeekBreakToggle(enabled: boolean) {
  weekHasBreak.value = enabled
  if (enabled) {
    weekBreakPeriods.value = defaultGrabBreakPeriodsForShift(weekStartTime.value, weekEndTime.value)
  } else {
    weekBreakPeriods.value = []
  }
}

function addWeekBreakPeriod() {
  const defaults = defaultGrabBreakPeriodsForShift(weekStartTime.value, weekEndTime.value)
  weekBreakPeriods.value.push({ ...(defaults[0] ?? { start: '12:00', end: '13:00' }) })
}

function removeWeekBreakPeriod(index: number) {
  if (weekBreakPeriods.value.length <= 1) return
  weekBreakPeriods.value.splice(index, 1)
}

watch([weekStartTime, weekEndTime], () => syncWeekBreakPeriods())

const isShiftMode = computed(() => props.mode === 'shift' || Boolean(props.shiftContext))
const weekOnly = computed(() => isShiftMode.value)
const activeScope = computed(() => (weekOnly.value ? 'week' : lineScope.value))

const panelTitle = computed(() =>
  isShiftMode.value
    ? `按班次划线 · ${props.shiftContext!.shiftName}（${props.shiftContext!.startTime.slice(0, 5)}-${props.shiftContext!.endTime.slice(0, 5)}）`
    : '自定义划线排班',
)

/** 半小时一格：非跨天 48 格；跨天 当日+次日 96 格 */
const axisSlots = computed(() =>
  Array.from(
    { length: allowCrossDay.value ? SCHEDULE_SLOTS_PER_DAY * 2 : SCHEDULE_SLOTS_PER_DAY },
    (_, i) => i,
  ),
)
const nextDate = computed(() => addDays(props.selectedDate, 1))
const axisTotalMinutes = computed(() => axisSlots.value.length * SCHEDULE_SLOT_MINUTES)
const daySplitSlot = SCHEDULE_SLOTS_PER_DAY

const employees = computed(() =>
  store.activeEmployees.filter((e) => props.memberIds.includes(e.id)),
)

function slotTickLabel(slot: number) {
  const mins = (slot * SCHEDULE_SLOT_MINUTES) % (24 * 60)
  if (mins % 60 !== 0) return ''
  const h = mins / 60
  return h % 2 === 0 ? `${h}:00` : ''
}

function minutesToClock(totalMinutes: number) {
  const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60)
  const h = Math.floor(normalized / 60)
  const m = normalized % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

const lineConflictCells = computed(() => {
  const map = props.conflictMap
  if (!map?.size) return [] as { employeeId: string; date: string; messages: string[] }[]
  const items: { employeeId: string; date: string; messages: string[] }[] = []
  employees.value.forEach((emp) => {
    props.weekDates.forEach((date) => {
      const messages = map.get(cellKey(emp.id, date))
      if (messages?.length) items.push({ employeeId: emp.id, date, messages })
    })
  })
  return items
})

function hasCellConflict(employeeId: string, date: string) {
  return Boolean(props.conflictMap?.has(cellKey(employeeId, date)))
}

function getCellConflictMessages(employeeId: string, date: string) {
  return props.conflictMap?.get(cellKey(employeeId, date)) ?? []
}

function conflictCellText(employeeId: string, date: string) {
  const msgs = getCellConflictMessages(employeeId, date)
  if (!msgs.length) return ''
  const msg = msgs[0]
  if (msg.length <= 10) return msg
  return `${msg.slice(0, 9)}…`
}

function rowHasConflict(employeeId: string) {
  return props.weekDates.some((date) => hasCellConflict(employeeId, date))
}

async function notifyAssignmentConflicts(employeeId: string, dates: string[]) {
  await nextTick()
  const messages = dates.flatMap((date) => getCellConflictMessages(employeeId, date))
  if (!messages.length) return
  const empName = store.employees.find((e) => e.id === employeeId)?.name ?? '员工'
  ElMessage.warning({
    message: `${empName}：${messages[0]}`,
    duration: 4500,
  })
}

/** 按日：半小时格拖拽（跨天时为 0–95 绝对格） */
const draggingEmployeeId = ref<string | null>(null)
const dragStartHour = ref<number | null>(null)
const dragEndHour = ref<number | null>(null)

watch(allowCrossDay, () => {
  draggingEmployeeId.value = null
  dragStartHour.value = null
  dragEndHour.value = null
})

/** 按周：跨天拖拽 */
const weekDraggingEmployeeId = ref<string | null>(null)
const weekDragStartIdx = ref<number | null>(null)
const weekDragEndIdx = ref<number | null>(null)

function timeToMinutes(time: string) {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + (m || 0)
}

function getAssignment(employeeId: string, date: string) {
  return (
    store.assignments.find(
      (a) =>
        a.employeeId === employeeId &&
        a.date === date &&
        a.teamId === props.teamId &&
        (props.editMode ? !a.published : a.published),
    ) ??
    store.assignments.find(
      (a) =>
        a.employeeId === employeeId &&
        a.date === date &&
        a.teamId === props.teamId,
    )
  )
}

function getAssignmentShift(employeeId: string, date: string) {
  const asn = getAssignment(employeeId, date)
  if (!asn) return null
  return store.shifts.find((s) => s.id === asn.shiftId) ?? null
}

const prevDate = computed(() => addDays(props.selectedDate, -1))

/** 前一日跨入当日的凌晨工作时段（相对当日 00:00，只读） */
function getCarryOverSegments(employeeId: string): ScheduleTimeSegment[] {
  const asn = getAssignment(employeeId, prevDate.value)
  if (!asn) return []
  const custom = extractCarryOverSegmentsFromPrevDay(asn.note)
  if (custom.length) return custom
  const shift = store.shifts.find((s) => s.id === asn.shiftId)
  if (!shift || shift.code === 'REST') return []
  return extractCarryOverFromShiftTimes(shift.startTime, shift.endTime)
}

function hasCarryOver(employeeId: string) {
  return getCarryOverSegments(employeeId).length > 0
}

type DayLineBar = {
  left: string
  width: string
  background: string
  label: string
  crossDay: boolean
  readonly?: boolean
}

function barsFromSegments(
  segments: ScheduleTimeSegment[],
  background: string,
  opts: { readonly?: boolean; labelPrefix?: string } = {},
): DayLineBar[] {
  const totalMin = axisTotalMinutes.value
  const crossAxis = allowCrossDay.value
  const { readonly = false, labelPrefix = '' } = opts

  return segments.flatMap((seg) => {
    const [start, end] = scheduleSegmentAbsRange(seg)
    const crossDay = isOvernightScheduleSegment(seg) || (seg.dayOffset ?? 0) > 0
    const baseLabel = formatScheduleSegmentLabel(seg)
    const label = labelPrefix ? `${labelPrefix}${baseLabel}` : baseLabel

    // 跨天两日轴：连续画在当日+次日
    if (crossAxis) {
      const displayEnd = Math.min(end, totalMin)
      if (displayEnd <= start) return []
      return [
        {
          left: `${(start / totalMin) * 100}%`,
          width: `${((displayEnd - start) / totalMin) * 100}%`,
          background,
          label,
          crossDay,
          readonly,
        },
      ]
    }

    // 单日轴：
    // - 昨续（readonly）已映射到当日本地时刻，正常展示
    // - 本日本地段正常展示
    // - 过夜/次日段：当天只画到 24:00；落入次日的部分改在「下一天」以昨续展示，不画在当天轴左侧
    if (readonly) {
      return [
        {
          left: `${(start / 60 / 24) * 100}%`,
          width: `${((end - start) / 60 / 24) * 100}%`,
          background,
          label,
          crossDay: true,
          readonly: true,
        },
      ]
    }

    if ((seg.dayOffset ?? 0) > 0) {
      // 显式次日段：不在排班日单日轴展示
      return []
    }

    if (isOvernightScheduleSegment(seg)) {
      // 仅展示当日夜间至 24:00
      if (start >= 24 * 60) return []
      const dayEnd = Math.min(end, 24 * 60)
      if (dayEnd <= start) return []
      return [
        {
          left: `${(start / 60 / 24) * 100}%`,
          width: `${((dayEnd - start) / 60 / 24) * 100}%`,
          background,
          label,
          crossDay: true,
          readonly: false,
        },
      ]
    }

    return [
      {
        left: `${(start / 60 / 24) * 100}%`,
        width: `${((end - start) / 60 / 24) * 100}%`,
        background,
        label,
        crossDay: false,
        readonly: false,
      },
    ]
  })
}

function getDayLineBars(employeeId: string): DayLineBar[] {
  const carrySegs = getCarryOverSegments(employeeId)
  const carryBars = barsFromSegments(carrySegs, '#94a3b8', {
    readonly: true,
    labelPrefix: '昨续 ',
  })

  const asn = getAssignment(employeeId, props.selectedDate)
  if (!asn) return carryBars

  const shift = getAssignmentShift(employeeId, props.selectedDate)
  const segments = parseScheduleTimeSegments(asn.note)
  const background =
    asn.shiftId === FLEX_SHIFT_ID ? FLEX_SHIFT_COLOR : shift?.color ?? FLEX_SHIFT_COLOR
  const totalMin = axisTotalMinutes.value
  const crossAxis = allowCrossDay.value

  if (segments.length) {
    return [...carryBars, ...barsFromSegments(segments, background)]
  }

  // 非自定义备注：单班次模板
  if (!shift) return carryBars
  const start = timeToMinutes(shift.startTime)
  let end = timeToMinutes(shift.endTime)
  const crossDay = end <= start
  if (crossDay) end += 24 * 60
  const label = formatLineAssignmentLabel(asn, shift) ?? ''
  if (crossAxis) {
    const displayEnd = Math.min(end, totalMin)
    return [
      ...carryBars,
      {
        left: `${(start / totalMin) * 100}%`,
        width: `${((displayEnd - start) / totalMin) * 100}%`,
        background,
        label,
        crossDay,
      },
    ]
  }
  // 单日轴：跨天班次只画到当日 24:00，次日凌晨在下一天以昨续展示
  if (crossDay) {
    return [
      ...carryBars,
      {
        left: `${(start / 60 / 24) * 100}%`,
        width: `${((24 * 60 - start) / 60 / 24) * 100}%`,
        background,
        label,
        crossDay: true,
      },
    ]
  }
  return [
    ...carryBars,
    {
      left: `${(start / 60 / 24) * 100}%`,
      width: `${((end - start) / 60 / 24) * 100}%`,
      background,
      label,
      crossDay: false,
    },
  ]
}

function getWeekCellLabel(employeeId: string, date: string) {
  const asn = getAssignment(employeeId, date)
  const shift = getAssignmentShift(employeeId, date)
  return formatLineAssignmentLabel(asn, shift)
}

function getWeekCellColor(employeeId: string, date: string) {
  const asn = getAssignment(employeeId, date)
  if (asn?.shiftId === FLEX_SHIFT_ID) return FLEX_SHIFT_COLOR
  return getAssignmentShift(employeeId, date)?.color ?? '#909399'
}

function isHourInSelection(employeeId: string, slot: number) {
  if (lineScope.value !== 'day' || draggingEmployeeId.value !== employeeId || dragStartHour.value === null) {
    return false
  }
  const end = dragEndHour.value ?? dragStartHour.value
  const start = dragStartHour.value
  const lo = Math.min(start, end)
  const hi = Math.max(start, end)
  return slot >= lo && slot <= hi
}

function isDayInWeekSelection(employeeId: string, dayIdx: number) {
  if (
    activeScope.value !== 'week' ||
    weekDraggingEmployeeId.value !== employeeId ||
    weekDragStartIdx.value === null
  ) {
    return false
  }
  const end = weekDragEndIdx.value ?? weekDragStartIdx.value
  const lo = Math.min(weekDragStartIdx.value, end)
  const hi = Math.max(weekDragStartIdx.value, end)
  return dayIdx >= lo && dayIdx <= hi
}

function isLocked(employeeId: string, date: string) {
  return Boolean(props.isCellLocked?.(employeeId, date))
}

function resolveDragSegment(startSlot: number, endSlot: number): ScheduleTimeSegment | null {
  const lo = Math.min(startSlot, endSlot)
  const hi = Math.max(startSlot, endSlot)
  const startMin = lo * SCHEDULE_SLOT_MINUTES
  const endMin = (hi + 1) * SCHEDULE_SLOT_MINUTES

  if (!allowCrossDay.value) {
    if (endMin > 24 * 60) {
      ElMessage.warning('划至次日请先开启「跨天划线」')
      return null
    }
    return {
      startTime: minutesToClock(startMin),
      endTime: minutesToClock(endMin),
      dayOffset: 0,
    }
  }

  if (endMin - startMin > CROSS_DAY_MAX_SPAN_MINUTES) {
    ElMessage.warning('跨天排班从第一段开始到最后一段结束不能超过 24 小时（覆盖两天）')
    return null
  }

  const startDay = Math.floor(startMin / (24 * 60)) as 0 | 1

  // 整段落在次日：允许作为第 2/n 段（首段校验在 upsert）
  if (startDay >= 1) {
    return {
      startTime: minutesToClock(startMin),
      endTime: minutesToClock(endMin),
      dayOffset: 1,
    }
  }

  // 当日开始
  if (endMin <= 24 * 60) {
    return {
      startTime: minutesToClock(startMin),
      endTime: minutesToClock(endMin),
      dayOffset: 0,
    }
  }

  // 从当日跨入次日的连续段
  if (startMin < CROSS_DAY_MIN_START_MINUTES) {
    ElMessage.warning('跨天划线起始时间不能早于下午 14:00')
    return null
  }
  return {
    startTime: minutesToClock(startMin),
    endTime: minutesToClock(endMin),
    dayOffset: 0,
  }
}

/** 追加工作时段（多段；空档视为休息）；重叠自动合并 */
function upsertCustomSegments(
  employeeId: string,
  date: string,
  nextSegment: ScheduleTimeSegment,
): boolean {
  if (isLocked(employeeId, date)) return false
  if (isScheduleHistoryDate(date)) return false

  // 次日段按「次日日期 + 时刻」判断是否已过期，避免 02:00 被当成当日凌晨而误拦
  const segmentDate =
    (nextSegment.dayOffset ?? 0) > 0 ? addDays(date, 1) : date
  if (isScheduleShiftHistorical(segmentDate, nextSegment.startTime)) {
    ElMessage.info('该时段已开始或已过期，不可编辑')
    return false
  }

  const existing = getAssignment(employeeId, date)
  const prev = parseScheduleTimeSegments(existing?.note)

  // 首段不能只画在次日；第 2 段起（含休息空档）可在次日
  if ((nextSegment.dayOffset ?? 0) > 0 && !prev.length) {
    ElMessage.warning('首段须从当日开始划线；第 2 段及以后（含休息）可落在次日')
    return false
  }

  const carry = getCarryOverSegments(employeeId)
  if (carry.some((c) => scheduleSegmentsOverlap(c, nextSegment))) {
    ElMessage.warning('与前一日跨入的凌晨班次重叠，请切换到前一日修改')
    return false
  }

  const merged = mergeScheduleTimeSegments([...prev, nextSegment])

  if (spansCrossDaySchedule(merged)) {
    const check = validateCrossDayScheduleSegments(merged)
    if (!check.ok) {
      ElMessage.warning(check.message)
      return false
    }
  }

  const note = formatScheduleTimeSegmentsNote('自定义', merged)
  store.upsertAssignment({
    employeeId,
    date,
    shiftId: FLEX_SHIFT_ID,
    teamId: props.teamId,
    published: false,
    manualEdited: true,
    note,
  })
  return true
}

function upsertLineAssignment(employeeId: string, date: string, startTime: string, endTime: string) {
  if (isLocked(employeeId, date)) return
  if (isScheduleHistoryDate(date) || isScheduleShiftHistorical(date, startTime)) return
  if (props.shiftContext) {
    const st = props.shiftContext.startTime.slice(0, 5)
    const et = props.shiftContext.endTime.slice(0, 5)
    store.upsertAssignment({
      employeeId,
      date,
      shiftId: props.shiftContext.shiftId,
      teamId: props.teamId,
      published: false,
      manualEdited: true,
      note: `划线 ${st}-${et}`,
    })
    return
  }
  // 按周划线：起止可跨天；启用休息时拆成多段工作时段（空档=休息）
  const breakPeriods =
    weekHasBreak.value && activeScope.value === 'week' ? weekBreakPeriods.value : undefined
  const segments = buildWorkSegmentsFromShiftWindow(startTime, endTime, breakPeriods)
  if (!segments.length) {
    ElMessage.warning('有效工作时段为空，请检查起止与休息配置')
    return
  }
  store.upsertAssignment({
    employeeId,
    date,
    shiftId: FLEX_SHIFT_ID,
    teamId: props.teamId,
    published: false,
    manualEdited: true,
    note: formatScheduleTimeSegmentsNote('自定义', segments),
  })
}

function onHourDown(employeeId: string, hour: number) {
  if (!props.editMode) {
    emit('enterEdit')
    return
  }
  if (isLocked(employeeId, props.selectedDate) || isScheduleHistoryDate(props.selectedDate)) {
    ElMessage.info(isScheduleHistoryDate(props.selectedDate) ? '历史班次不可编辑' : '该班次已确认，不可编辑，请走取消班次流程')
    return
  }
  draggingEmployeeId.value = employeeId
  dragStartHour.value = hour
  dragEndHour.value = hour
}

function onHourEnter(employeeId: string, hour: number) {
  if (draggingEmployeeId.value === employeeId && dragStartHour.value !== null) {
    dragEndHour.value = hour
  }
}

function onHourUp(employeeId: string) {
  if (draggingEmployeeId.value !== employeeId || dragStartHour.value === null) return
  if (props.shiftContext) {
    const st = props.shiftContext.startTime.slice(0, 5)
    const et = props.shiftContext.endTime.slice(0, 5)
    upsertLineAssignment(employeeId, props.selectedDate, st, et)
    ElMessage.success(
      `${store.employees.find((e) => e.id === employeeId)?.name} 已排 ${props.shiftContext.shiftName}`,
    )
    void notifyAssignmentConflicts(employeeId, [props.selectedDate])
  } else {
    const end = dragEndHour.value ?? dragStartHour.value
    const seg = resolveDragSegment(dragStartHour.value, end)
    if (!seg) {
      draggingEmployeeId.value = null
      dragStartHour.value = null
      dragEndHour.value = null
      return
    }
    const ok = upsertCustomSegments(employeeId, props.selectedDate, seg)
    if (ok) {
      const asn = getAssignment(employeeId, props.selectedDate)
      const segs = parseScheduleTimeSegments(asn?.note)
      const label = segs.map(formatScheduleSegmentLabel).join('、')
      ElMessage.success(
        `${store.employees.find((e) => e.id === employeeId)?.name} 已排 ${label || formatScheduleSegmentLabel(seg)}`,
      )
      void notifyAssignmentConflicts(employeeId, [props.selectedDate])
    }
  }
  draggingEmployeeId.value = null
  dragStartHour.value = null
  dragEndHour.value = null
}

function onWeekDayDown(employeeId: string, dayIdx: number) {
  if (!props.editMode) {
    emit('enterEdit')
    return
  }
  const date = props.weekDates[dayIdx]
  if (date && (isLocked(employeeId, date) || isScheduleHistoryDate(date))) {
    ElMessage.info(isScheduleHistoryDate(date) ? '历史班次不可编辑' : '该班次已确认，不可编辑，请走取消班次流程')
    return
  }
  weekDraggingEmployeeId.value = employeeId
  weekDragStartIdx.value = dayIdx
  weekDragEndIdx.value = dayIdx
}

function onWeekDayEnter(employeeId: string, dayIdx: number) {
  if (weekDraggingEmployeeId.value === employeeId && weekDragStartIdx.value !== null) {
    weekDragEndIdx.value = dayIdx
  }
}

function onWeekDayUp(employeeId: string) {
  if (weekDraggingEmployeeId.value !== employeeId || weekDragStartIdx.value === null) return
  let startTime: string
  let endTime: string
  if (props.shiftContext) {
    startTime = props.shiftContext.startTime.slice(0, 5)
    endTime = props.shiftContext.endTime.slice(0, 5)
  } else {
    startTime = weekStartTime.value
    endTime = weekEndTime.value
    if (!startTime || !endTime) {
      ElMessage.warning('请先设置有效时段')
      resetWeekDrag()
      return
    }
    if (startTime === endTime) {
      ElMessage.warning('起止时间不能相同')
      resetWeekDrag()
      return
    }
    // 跨天（结束早于开始）：起始 ≥ 14:00，且起止跨度 ≤ 24h
    if (isOvernightTimeRange(startTime, endTime)) {
      const check = validateCrossDayScheduleSegments([{ startTime, endTime }])
      if (!check.ok) {
        ElMessage.warning(check.message)
        resetWeekDrag()
        return
      }
    }
    if (weekHasBreak.value) {
      if (!weekBreakPeriods.value.length || weekBreakPeriods.value.some((p) => !p.start || !p.end)) {
        ElMessage.warning('请完善休息时间段')
        resetWeekDrag()
        return
      }
      if (weekInvalidBreakIndexes.value.length) {
        ElMessage.warning('休息时间段必须完全落在班次起止时间内（跨天班次同理）')
        resetWeekDrag()
        return
      }
    }
  }
  const end = weekDragEndIdx.value ?? weekDragStartIdx.value
  const lo = Math.min(weekDragStartIdx.value, end)
  const hi = Math.max(weekDragStartIdx.value, end)
  const dates = props.weekDates.slice(lo, hi + 1).filter((date) => !isLocked(employeeId, date) && !isScheduleHistoryDate(date))
  const skipped = hi - lo + 1 - dates.length
  if (!dates.length) {
    ElMessage.warning('所选日期均为已过期或已确认班次，不可编辑')
    resetWeekDrag()
    return
  }
  dates.forEach((date) => upsertLineAssignment(employeeId, date, startTime, endTime))
  const empName = store.employees.find((e) => e.id === employeeId)?.name
  const label = props.shiftContext
    ? props.shiftContext.shiftName
    : weekHasBreak.value
      ? `${weekTimeLabel.value}（休${formatBreakPeriodsRule(weekBreakPeriods.value) || '—'}）`
      : weekTimeLabel.value
  ElMessage.success(
    skipped
      ? `${empName} 已为 ${dates.length} 天排 ${label}（跳过 ${skipped} 个已过期或已确认）`
      : `${empName} 已为 ${dates.length} 天排 ${label}`,
  )
  void notifyAssignmentConflicts(employeeId, dates)
  resetWeekDrag()
}

function resetWeekDrag() {
  weekDraggingEmployeeId.value = null
  weekDragStartIdx.value = null
  weekDragEndIdx.value = null
}

function resetDayDrag() {
  draggingEmployeeId.value = null
  dragStartHour.value = null
  dragEndHour.value = null
}

function clearLineDay(employeeId: string) {
  if (isLocked(employeeId, props.selectedDate)) {
    ElMessage.info('该班次已确认，不可清除，请走取消班次流程')
    return
  }
  store.removeAssignment(employeeId, props.selectedDate, false)
  ElMessage.success('已清除该员工当日排班')
}

function clearLineWeek(employeeId: string) {
  let cleared = 0
  let skipped = 0
  props.weekDates.forEach((date) => {
    if (isLocked(employeeId, date)) {
      skipped += 1
      return
    }
    store.removeAssignment(employeeId, date, false)
    cleared += 1
  })
  if (!cleared && skipped) {
    ElMessage.info('均为已确认班次，不可清除，请走取消班次流程')
    return
  }
  ElMessage.success(
    skipped ? `已清除 ${cleared} 天（跳过 ${skipped} 个已确认）` : '已清除该员工本周划线排班',
  )
}

watch(
  () => props.selectedDate,
  () => resetDayDrag(),
)

watch(lineScope, () => {
  resetDayDrag()
  resetWeekDrag()
})

watch(
  weekOnly,
  (only) => {
    if (only) lineScope.value = 'week'
  },
  { immediate: true },
)
</script>

<template>
  <div class="line-panel page-card">
    <div class="line-panel-head">
      <h3 class="panel-title">{{ panelTitle }}</h3>
      <el-tag v-if="isShiftMode" size="small" type="primary">按班次</el-tag>
      <el-tag v-else size="small">自定义</el-tag>
    </div>
    <div class="line-toolbar">
      <el-radio-group v-if="!weekOnly" v-model="lineScope" size="small">
        <el-radio-button value="day">按日划线</el-radio-button>
        <el-radio-button value="week">按周划线</el-radio-button>
      </el-radio-group>
      <el-tag v-else size="small" type="info">按周划线</el-tag>

      <el-date-picker
        v-if="activeScope === 'day'"
        :model-value="selectedDate"
        type="date"
        value-format="YYYY-MM-DD"
        size="small"
        style="width: 140px"
        placeholder="选择日期"
        @update:model-value="emit('update:selectedDate', $event)"
      />

      <div v-if="activeScope === 'week' && !isShiftMode" class="week-time-config">
        <div class="week-time-row">
          <el-time-picker
            v-model="weekStartTime"
            format="HH:mm"
            value-format="HH:mm"
            placeholder="开始"
            size="small"
            style="width: 110px"
          />
          <span class="time-sep">至</span>
          <el-time-picker
            v-model="weekEndTime"
            format="HH:mm"
            value-format="HH:mm"
            placeholder="结束"
            size="small"
            style="width: 110px"
          />
          <span class="text-muted week-time-meta">
            {{ weekTimeLabel }}
            <template v-if="weekOvernight"> · 跨天</template>
            · 工时 <strong>{{ weekWorkHours }}</strong>h
          </span>
        </div>
        <div class="week-break-config">
          <el-switch
            :model-value="weekHasBreak"
            size="small"
            inline-prompt
            active-text="休息"
            inactive-text="休息"
            @change="(v: string | number | boolean) => onWeekBreakToggle(Boolean(v))"
          />
          <div v-if="weekHasBreak" class="week-break-periods">
            <div
              v-for="(bp, idx) in weekBreakPeriods"
              :key="idx"
              class="week-break-row"
              :class="{ 'is-invalid': weekInvalidBreakIndexes.includes(idx) }"
            >
              <el-time-picker
                v-model="bp.start"
                format="HH:mm"
                value-format="HH:mm"
                placeholder="开始"
                size="small"
                style="width: 100px"
              />
              <span class="time-sep">至</span>
              <el-time-picker
                v-model="bp.end"
                format="HH:mm"
                value-format="HH:mm"
                placeholder="结束"
                size="small"
                style="width: 100px"
              />
              <el-button
                v-if="weekBreakPeriods.length > 1"
                link
                type="danger"
                size="small"
                @click="removeWeekBreakPeriod(idx)"
              >
                删除
              </el-button>
              <span v-if="weekInvalidBreakIndexes.includes(idx)" class="break-error">须在班次内</span>
            </div>
            <el-button link type="primary" size="small" @click="addWeekBreakPeriod">添加时段</el-button>
            <p class="week-break-hint text-muted">
              休息须落在 {{ weekTimeLabel }} 内
              <template v-if="weekOvernight">（跨天班次同理）</template>
              ；工时 = 班次时长 − 休息
            </p>
          </div>
        </div>
      </div>

      <el-switch
        v-if="!isShiftMode && activeScope === 'day'"
        v-model="allowCrossDay"
        size="small"
        inline-prompt
        active-text="跨天"
        inactive-text="跨天"
      />

      <span class="text-muted hint">
        {{
          isShiftMode
            ? '拖拽连续日期为员工排选定班次'
            : activeScope === 'day'
              ? allowCrossDay
                ? '按日：半小时格；两日轴可跨天划；关跨天后次日凌晨改在下一天「昨续」展示'
                : '按日：半小时一格；跨天班次的次日部分在下一天以昨续只读展示'
              : '按周：时段可跨天；可配置休息时间段（同班次休息）；拖选日期批量应用'
        }}
      </span>
    </div>

    <el-alert
      v-if="lineConflictCells.length"
      type="warning"
      :closable="false"
      show-icon
      class="line-conflict-alert"
      :title="`当前划线区域存在 ${lineConflictCells.length} 处排班冲突，请调整后再保存`"
    >
      <ul class="line-conflict-list">
        <li v-for="item in lineConflictCells.slice(0, 5)" :key="`${item.employeeId}_${item.date}`">
          {{
            store.employees.find((e) => e.id === item.employeeId)?.name ?? item.employeeId
          }}
          · {{ item.date.slice(5) }}：{{ item.messages[0] }}
        </li>
        <li v-if="lineConflictCells.length > 5" class="text-muted">
          另有 {{ lineConflictCells.length - 5 }} 处冲突，详见标红单元格
        </li>
      </ul>
    </el-alert>

    <!-- 按日：半小时轴（跨天时展示当日+次日） -->
    <div
      v-if="activeScope === 'day'"
      class="line-table"
      :class="{ 'is-cross-day': allowCrossDay }"
    >
      <div class="line-header">
        <div class="emp-col">员工</div>
        <div class="track-col" :class="{ 'cross-day-track-head': allowCrossDay }">
          <template v-if="allowCrossDay">
            <div class="cross-day-date-row">
              <div class="cross-day-date">{{ selectedDate.slice(5) }} 当日</div>
              <div class="cross-day-date is-next">{{ nextDate.slice(5) }} 次日</div>
            </div>
            <div class="cross-day-tick-row">
              <span
                v-for="s in axisSlots"
                :key="s"
                class="hour-tick"
                :class="{ 'is-next-day': s >= daySplitSlot, 'day-split': s === daySplitSlot }"
              >
                {{ slotTickLabel(s) }}
              </span>
            </div>
          </template>
          <template v-else>
            <span v-for="s in axisSlots" :key="s" class="hour-tick">{{ slotTickLabel(s) }}</span>
          </template>
        </div>
        <div class="act-col">操作</div>
      </div>

      <div
        v-for="emp in employees"
        :key="emp.id"
        class="line-row"
        @mouseup="onHourUp(emp.id)"
        @mouseleave="onHourUp(emp.id)"
      >
        <div class="emp-col">
          <div class="emp-name">
            {{ emp.name }}
            <el-icon v-if="rowHasConflict(emp.id)" class="warn-icon" color="#F56C6C">
              <WarningFilled />
            </el-icon>
          </div>
          <div class="text-muted">{{ emp.employeeNo }}</div>
        </div>
        <div
          class="track-col hour-track"
          :class="{ locked: isLocked(emp.id, selectedDate), 'is-cross-day': allowCrossDay }"
        >
          <div
            v-for="s in axisSlots"
            :key="s"
            class="hour-cell"
            :class="{
              selecting: isHourInSelection(emp.id, s),
              'is-next-day': allowCrossDay && s >= daySplitSlot,
              'day-split': allowCrossDay && s === daySplitSlot,
            }"
            @mousedown.prevent="onHourDown(emp.id, s)"
            @mouseenter="onHourEnter(emp.id, s)"
          />
          <div
            v-for="(bar, bIdx) in getDayLineBars(emp.id)"
            :key="`${emp.id}_bar_${bIdx}`"
            class="shift-bar"
            :class="{ 'is-cross-day': bar.crossDay, 'is-readonly': bar.readonly }"
            :title="bar.readonly ? '前一日跨入，请切换到前一日修改' : bar.label"
            :style="{
              left: bar.left,
              width: bar.width,
              background: bar.background,
            }"
          >
            {{ bar.label }}
          </div>
        </div>
        <div class="act-col">
          <el-tag v-if="isLocked(emp.id, selectedDate)" size="small" type="info">已确认</el-tag>
          <template v-else-if="editMode">
            <el-tag v-if="hasCarryOver(emp.id)" size="small" type="info" class="carry-tag" title="含前一日跨入凌晨班（只读）">
              昨续
            </el-tag>
            <el-button
              v-if="getAssignment(emp.id, selectedDate)"
              link
              type="danger"
              size="small"
              @click="clearLineDay(emp.id)"
            >
              清除
            </el-button>
          </template>
        </div>
      </div>
    </div>

    <!-- 按周：7 天列 -->
    <div v-else class="line-table week-table">
      <div class="line-header">
        <div class="emp-col">员工</div>
        <div
          v-for="date in weekDates"
          :key="date"
          class="day-head-col"
          :class="{ history: isScheduleHistoryDate(date) }"
        >
          <div>{{ date.slice(5) }}</div>
          <div class="day-week">周{{ getWeekday(date) }}</div>
        </div>
        <div class="act-col">操作</div>
      </div>

      <div
        v-for="emp in employees"
        :key="emp.id"
        class="line-row"
        @mouseup="onWeekDayUp(emp.id)"
        @mouseleave="onWeekDayUp(emp.id)"
      >
        <div class="emp-col">
          <div class="emp-name">
            {{ emp.name }}
            <el-icon v-if="rowHasConflict(emp.id)" class="warn-icon" color="#F56C6C">
              <WarningFilled />
            </el-icon>
          </div>
          <div class="text-muted">{{ emp.employeeNo }}</div>
        </div>
        <div
          v-for="(date, dayIdx) in weekDates"
          :key="date"
          class="day-cell"
          :class="{
            selecting: isDayInWeekSelection(emp.id, dayIdx),
            filled: getAssignment(emp.id, date),
            conflict: hasCellConflict(emp.id, date),
            locked: isLocked(emp.id, date),
          }"
          :title="
            isLocked(emp.id, date) || isScheduleHistoryDate(date)
              ? isScheduleHistoryDate(date) ? '历史班次不可编辑' : '已确认，不可编辑'
              : getCellConflictMessages(emp.id, date).join('；')
          "
          @mousedown.prevent="onWeekDayDown(emp.id, dayIdx)"
          @mouseenter="onWeekDayEnter(emp.id, dayIdx)"
        >
          <div v-if="hasCellConflict(emp.id, date)" class="conflict-block">
            {{ conflictCellText(emp.id, date) }}
          </div>
          <div
            v-else-if="getWeekCellLabel(emp.id, date)"
            class="day-shift-pill"
            :style="{ background: getWeekCellColor(emp.id, date) }"
          >
            {{ getWeekCellLabel(emp.id, date) }}
          </div>
        </div>
        <div class="act-col">
          <el-button v-if="editMode" link type="danger" size="small" @click="clearLineWeek(emp.id)">
            清除
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.line-panel {
  padding: 16px 20px;
}

.line-panel-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.line-panel-head .panel-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
}

.line-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
  flex-wrap: wrap;
}

.hint {
  font-size: 12px;
}

.week-time-config {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 280px;
}

.week-time-row,
.week-break-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.week-time-meta {
  font-size: 12px;
}

.week-break-config {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.week-break-periods {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 8px 10px;
  background: #f8fafc;
  border: 1px solid var(--app-border);
  border-radius: 6px;
}

.week-break-row.is-invalid :deep(.el-input__wrapper) {
  box-shadow: 0 0 0 1px #f56c6c inset;
}

.break-error {
  color: #f56c6c;
  font-size: 12px;
}

.week-break-hint {
  margin: 0;
  font-size: 12px;
  line-height: 1.4;
}

.time-sep {
  color: #909399;
  font-size: 12px;
}

.line-table {
  border: 1px solid var(--app-border);
  border-radius: 8px;
  overflow-x: auto;
}

.line-table.is-cross-day {
  overflow-x: auto;
}

.line-header,
.line-row {
  display: flex;
  align-items: stretch;
  border-bottom: 1px solid var(--app-border);
}

.line-table .line-header,
.line-table .line-row {
  min-width: 900px;
}

.line-table.is-cross-day .line-header,
.line-table.is-cross-day .line-row {
  min-width: 1400px;
}

.line-row:last-child {
  border-bottom: none;
}

.line-header {
  background: #f8fafc;
  font-size: 11px;
  color: #94a3b8;
}

.emp-col {
  width: 100px;
  flex-shrink: 0;
  padding: 8px 10px;
  border-right: 1px solid var(--app-border);
}

.act-col {
  width: 72px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  padding: 4px;
}

.carry-tag {
  transform: scale(0.92);
}

.track-col {
  flex: 1;
  min-width: 0;
}

.hour-track {
  position: relative;
  display: flex;
  min-height: 44px;
  min-width: 720px;
  user-select: none;
}

.hour-track.is-cross-day {
  min-width: 1200px;
}

.line-header .track-col {
  display: flex;
  min-width: 720px;
}

.cross-day-track-head {
  flex-direction: column;
  min-width: 1200px;
}

.cross-day-date-row {
  display: flex;
  border-bottom: 1px solid var(--app-border);
}

.cross-day-date {
  flex: 1;
  text-align: center;
  font-size: 11px;
  font-weight: 600;
  color: #606266;
  padding: 3px 0;
}

.cross-day-date.is-next {
  color: #2563eb;
  background: #eff6ff;
  border-left: 2px dashed #93c5fd;
}

.cross-day-tick-row {
  display: flex;
}

.hour-tick {
  flex: 1;
  text-align: center;
  font-size: 10px;
  padding: 4px 0;
}

.hour-tick.is-next-day {
  color: #64748b;
  background: #f8fbff;
}

.hour-tick.day-split {
  border-left: 2px dashed #93c5fd;
}

.hour-cell {
  flex: 1;
  border-right: 1px solid #f1f5f9;
  cursor: crosshair;
  min-height: 44px;
  min-width: 8px;
}

.hour-cell.is-next-day {
  background: #f8fbff;
}

.hour-cell.day-split {
  border-left: 2px dashed #93c5fd;
}

.hour-cell:last-child {
  border-right: none;
}

.hour-cell.selecting {
  background: rgba(59, 130, 246, 0.25);
}

.shift-bar {
  position: absolute;
  top: 6px;
  height: 32px;
  border-radius: 4px;
  color: #fff;
  font-size: 11px;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  white-space: nowrap;
  overflow: hidden;
  padding: 0 4px;
}

.shift-bar.is-readonly {
  opacity: 0.72;
  background-image: repeating-linear-gradient(
    -45deg,
    transparent,
    transparent 4px,
    rgba(255, 255, 255, 0.18) 4px,
    rgba(255, 255, 255, 0.18) 8px
  );
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.35);
}

/* 按周 */
.week-table .line-header,
.week-table .line-row {
  align-items: stretch;
}

.day-head-col {
  flex: 1;
  min-width: 72px;
  text-align: center;
  padding: 6px 4px;
  border-right: 1px solid var(--app-border);
  font-weight: 600;
  color: #606266;
}

.day-head-col.history {
  color: #909399;
  background: #f5f7fa;
}

.day-week {
  font-size: 10px;
  color: #909399;
  font-weight: 400;
}

.day-cell {
  flex: 1;
  min-width: 72px;
  min-height: 48px;
  border-right: 1px solid #f1f5f9;
  cursor: crosshair;
  user-select: none;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  transition: background 0.12s;
}

.day-cell.selecting {
  background: rgba(59, 130, 246, 0.25);
}

.day-cell.filled {
  background: #fafafa;
}

.day-cell.conflict {
  background: #fef0f0;
  box-shadow: inset 0 0 0 1px #fbc4c4;
}

.day-cell.locked,
.hour-track.locked {
  background: #f1f5f9 !important;
  opacity: 0.72;
  filter: grayscale(0.35);
  cursor: not-allowed;
}

.day-cell.locked:hover {
  background: #f1f5f9 !important;
}

.conflict-block {
  color: #f56c6c;
  font-size: 10px;
  font-weight: 600;
  line-height: 1.3;
  text-align: center;
  padding: 2px;
}

.line-conflict-alert {
  margin-bottom: 12px;
}

.line-conflict-list {
  margin: 6px 0 0;
  padding-left: 18px;
  font-size: 12px;
  line-height: 1.6;
}

.emp-name {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  font-weight: 600;
}

.warn-icon {
  flex-shrink: 0;
}

.day-shift-pill {
  color: #fff;
  border-radius: 4px;
  padding: 4px 6px;
  font-size: 10px;
  font-weight: 600;
  white-space: nowrap;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
