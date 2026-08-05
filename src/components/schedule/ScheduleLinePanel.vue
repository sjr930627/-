<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { WarningFilled } from '@element-plus/icons-vue'
import { parseScheduleTimeNote, FLEX_SHIFT_ID, FLEX_SHIFT_COLOR, formatLineAssignmentLabel, cellKey } from '@/constants/schedule'
import { getWeekday } from '@/utils'
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
}>()

const emit = defineEmits<{
  enterEdit: []
  'update:selectedDate': [string]
}>()

const store = useAppStore()
const lineScope = ref<'day' | 'week'>('day')
/** 按周划线时使用统一时段（仅自定义模式） */
const weekTimeRange = ref<[string, string]>(['08:00', '16:00'])

const isShiftMode = computed(() => props.mode === 'shift' || Boolean(props.shiftContext))
const weekOnly = computed(() => isShiftMode.value)
const activeScope = computed(() => (weekOnly.value ? 'week' : lineScope.value))

const panelTitle = computed(() =>
  isShiftMode.value
    ? `按班次划线 · ${props.shiftContext!.shiftName}（${props.shiftContext!.startTime.slice(0, 5)}-${props.shiftContext!.endTime.slice(0, 5)}）`
    : '自定义划线排班',
)

const hours = Array.from({ length: 24 }, (_, i) => i)

const employees = computed(() =>
  store.activeEmployees.filter((e) => props.memberIds.includes(e.id)),
)

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

/** 按日：24 小时轴拖拽 */
const draggingEmployeeId = ref<string | null>(null)
const dragStartHour = ref<number | null>(null)
const dragEndHour = ref<number | null>(null)

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

function getDayLineBarStyle(employeeId: string) {
  const asn = getAssignment(employeeId, props.selectedDate)
  if (!asn) return null
  const shift = getAssignmentShift(employeeId, props.selectedDate)
  const label = formatLineAssignmentLabel(asn, shift)
  if (!label) return null

  const parsed = parseScheduleTimeNote(asn.note)
  let start: number
  let end: number
  if (parsed) {
    start = timeToMinutes(parsed.startTime)
    end = timeToMinutes(parsed.endTime)
  } else if (shift) {
    start = timeToMinutes(shift.startTime)
    end = timeToMinutes(shift.endTime)
  } else {
    return null
  }
  if (end <= start) end += 24 * 60
  const background =
    asn.shiftId === FLEX_SHIFT_ID ? FLEX_SHIFT_COLOR : shift?.color ?? FLEX_SHIFT_COLOR
  return {
    left: `${(start / 60 / 24) * 100}%`,
    width: `${((end - start) / 60 / 24) * 100}%`,
    background,
    label,
  }
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

function isHourInSelection(employeeId: string, hour: number) {
  if (lineScope.value !== 'day' || draggingEmployeeId.value !== employeeId || dragStartHour.value === null) {
    return false
  }
  const end = dragEndHour.value ?? dragStartHour.value
  const lo = Math.min(dragStartHour.value, end)
  const hi = Math.max(dragStartHour.value, end)
  return hour >= lo && hour <= hi
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

function upsertLineAssignment(employeeId: string, date: string, startTime: string, endTime: string) {
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
  store.upsertAssignment({
    employeeId,
    date,
    shiftId: FLEX_SHIFT_ID,
    teamId: props.teamId,
    published: false,
    manualEdited: true,
    note: `自定义 ${startTime}-${endTime}`,
  })
}

function onHourDown(employeeId: string, hour: number) {
  if (!props.editMode) {
    emit('enterEdit')
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
    const lo = Math.min(dragStartHour.value, end)
    const hi = Math.max(dragStartHour.value, end)
    const startTime = `${String(lo).padStart(2, '0')}:00`
    const endTime = `${String((hi + 1) % 24).padStart(2, '0')}:00`
    upsertLineAssignment(employeeId, props.selectedDate, startTime, endTime)
    ElMessage.success(
      `${store.employees.find((e) => e.id === employeeId)?.name} 已排 ${startTime}-${endTime}`,
    )
    void notifyAssignmentConflicts(employeeId, [props.selectedDate])
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
    ;[startTime, endTime] = weekTimeRange.value
    if (!startTime || !endTime || startTime === endTime) {
      ElMessage.warning('请先设置有效时段')
      resetWeekDrag()
      return
    }
  }
  const end = weekDragEndIdx.value ?? weekDragStartIdx.value
  const lo = Math.min(weekDragStartIdx.value, end)
  const hi = Math.max(weekDragStartIdx.value, end)
  const dates = props.weekDates.slice(lo, hi + 1)
  dates.forEach((date) => upsertLineAssignment(employeeId, date, startTime, endTime))
  const empName = store.employees.find((e) => e.id === employeeId)?.name
  const label = props.shiftContext
    ? props.shiftContext.shiftName
    : `${startTime}-${endTime}`
  ElMessage.success(`${empName} 已为 ${dates.length} 天排 ${label}`)
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
  store.removeAssignment(employeeId, props.selectedDate, false)
  store.removeAssignment(employeeId, props.selectedDate, true)
  ElMessage.success('已清除该员工当日排班')
}

function clearLineWeek(employeeId: string) {
  props.weekDates.forEach((date) => {
    store.removeAssignment(employeeId, date, false)
    store.removeAssignment(employeeId, date, true)
  })
  ElMessage.success('已清除该员工本周划线排班')
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

      <el-time-picker
        v-if="activeScope === 'week' && !isShiftMode"
        v-model="weekTimeRange"
        is-range
        range-separator="至"
        start-placeholder="开始"
        end-placeholder="结束"
        format="HH:mm"
        value-format="HH:mm"
        size="small"
        style="width: 200px"
      />

      <span class="text-muted hint">
        {{
          isShiftMode
            ? '拖拽连续日期为员工排选定班次'
            : activeScope === 'day'
              ? '按日：在时间轴拖拽设置当日时段（不受班次限制）'
              : '按周：拖拽选择连续日期，统一应用上方时段'
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

    <!-- 按日：24 小时轴（仅自定义模式） -->
    <div v-if="activeScope === 'day'" class="line-table">
      <div class="line-header">
        <div class="emp-col">员工</div>
        <div class="track-col">
          <span v-for="h in hours" :key="h" class="hour-tick">{{ h % 6 === 0 ? `${h}:00` : '' }}</span>
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
        <div class="track-col hour-track">
          <div
            v-for="h in hours"
            :key="h"
            class="hour-cell"
            :class="{ selecting: isHourInSelection(emp.id, h) }"
            @mousedown.prevent="onHourDown(emp.id, h)"
            @mouseenter="onHourEnter(emp.id, h)"
          />
          <div
            v-if="getDayLineBarStyle(emp.id)"
            class="shift-bar"
            :style="{
              left: getDayLineBarStyle(emp.id)!.left,
              width: getDayLineBarStyle(emp.id)!.width,
              background: getDayLineBarStyle(emp.id)!.background,
            }"
          >
            {{ getDayLineBarStyle(emp.id)!.label }}
          </div>
        </div>
        <div class="act-col">
          <el-button
            v-if="editMode && getAssignment(emp.id, selectedDate)"
            link
            type="danger"
            size="small"
            @click="clearLineDay(emp.id)"
          >
            清除
          </el-button>
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
          }"
          :title="getCellConflictMessages(emp.id, date).join('；')"
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

.line-table {
  border: 1px solid var(--app-border);
  border-radius: 8px;
  overflow: hidden;
}

.line-header,
.line-row {
  display: flex;
  align-items: stretch;
  border-bottom: 1px solid var(--app-border);
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
  width: 56px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
}

.track-col {
  flex: 1;
  min-width: 0;
}

.hour-track {
  position: relative;
  display: flex;
  min-height: 44px;
  user-select: none;
}

.line-header .track-col {
  display: flex;
}

.hour-tick {
  flex: 1;
  text-align: center;
  font-size: 10px;
  padding: 4px 0;
}

.hour-cell {
  flex: 1;
  border-right: 1px solid #f1f5f9;
  cursor: crosshair;
  min-height: 44px;
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
