<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'
import type { Shift } from '@/types'

const store = useAppStore()
const route = useRoute()
const router = useRouter()

const selectedGroupId = ref('ag_factory')
const selectedDate = ref('2026-07-28')
const selectedEmployeeId = ref('')
const lineShiftId = ref('shift_morning')

const dragStart = ref<number | null>(null)
const dragEnd = ref<number | null>(null)
const isDragging = ref(false)

const hours = Array.from({ length: 24 }, (_, i) => i)

const availableTeams = computed(() => store.getTeamsForGroup(selectedGroupId.value))
const memberIds = computed(() => new Set(availableTeams.value.flatMap((t) => t.memberIds)))

const employees = computed(() =>
  store.activeEmployees.filter((e) => memberIds.value.has(e.id)),
)

const selectedEmployee = computed(() =>
  store.employees.find((e) => e.id === selectedEmployeeId.value),
)

watch(employees, (list) => {
  if (!list.some((e) => e.id === selectedEmployeeId.value)) {
    selectedEmployeeId.value = list[0]?.id ?? ''
  }
}, { immediate: true })

function syncRoute() {
  const group = route.query.group
  if (typeof group === 'string') selectedGroupId.value = group
}

watch(() => route.query, syncRoute, { immediate: true })

function timeToMinutes(time: string) {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + (m || 0)
}

function shiftSpan(shift: Shift) {
  let start = timeToMinutes(shift.startTime)
  let end = timeToMinutes(shift.endTime)
  if (end <= start) end += 24 * 60
  return { startHour: Math.floor(start / 60), endHour: Math.ceil(end / 60) % 24 || 24, start, end }
}

function getAssignmentShift(employeeId: string) {
  const asn = store.getAssignment(employeeId, selectedDate.value)
  if (!asn) return null
  return store.shifts.find((s) => s.id === asn.shiftId) ?? null
}

function isHourInShift(hour: number, shift: Shift) {
  const { start, end } = shiftSpan(shift)
  const min = hour * 60
  const max = (hour + 1) * 60
  return min < end && max > start
}

function isHourInSelection(hour: number) {
  if (dragStart.value === null) return false
  const end = dragEnd.value ?? dragStart.value
  const lo = Math.min(dragStart.value, end)
  const hi = Math.max(dragStart.value, end)
  return hour >= lo && hour <= hi
}

function onHourDown(hour: number) {
  isDragging.value = true
  dragStart.value = hour
  dragEnd.value = hour
}

function onHourEnter(hour: number) {
  if (isDragging.value && dragStart.value !== null) {
    dragEnd.value = hour
  }
}

function onHourUp() {
  isDragging.value = false
}

function clearSelection() {
  dragStart.value = null
  dragEnd.value = null
}

function selectionLabel() {
  if (dragStart.value === null) return ''
  const end = dragEnd.value ?? dragStart.value
  const lo = Math.min(dragStart.value, end)
  const hi = Math.max(dragStart.value, end)
  return `${String(lo).padStart(2, '0')}:00 - ${String(hi + 1).padStart(2, '0')}:00`
}

function applyLineSchedule() {
  if (!selectedEmployeeId.value || dragStart.value === null) {
    ElMessage.warning('请先在时间轴上划线选择时段')
    return
  }
  const team = availableTeams.value.find((t) => t.memberIds.includes(selectedEmployeeId.value))
  store.upsertAssignment({
    employeeId: selectedEmployeeId.value,
    date: selectedDate.value,
    shiftId: lineShiftId.value,
    teamId: team?.id,
  })
  ElMessage.success(`已为 ${selectedEmployee.value?.name} 设置 ${store.shifts.find((s) => s.id === lineShiftId.value)?.name}`)
  clearSelection()
}

function clearDaySchedule() {
  if (!selectedEmployeeId.value) return
  store.removeAssignment(selectedEmployeeId.value, selectedDate.value)
  ElMessage.success('已清除当日排班')
}

const teamOverview = computed(() =>
  employees.value.map((emp) => ({
    emp,
    shift: getAssignmentShift(emp.id),
  })),
)
</script>

<template>
  <div class="line-schedule-page">
    <header class="page-card sub-header">
      <el-button :icon="ArrowLeft" link @click="router.push({ path: '/schedule-manage', query: { group: selectedGroupId } })">
        返回排班操作
      </el-button>
      <h2 class="page-title">划线排班</h2>
      <el-date-picker v-model="selectedDate" type="date" value-format="YYYY-MM-DD" style="width: 150px" />
    </header>

    <div class="line-body">
      <aside class="emp-sidebar page-card">
        <h4 class="sidebar-title">选择人员</h4>
        <div
          v-for="emp in employees"
          :key="emp.id"
          class="emp-item"
          :class="{ active: selectedEmployeeId === emp.id }"
          @click="selectedEmployeeId = emp.id"
        >
          <span>{{ emp.name }}</span>
          <el-tag v-if="getAssignmentShift(emp.id)" size="small" effect="plain">
            {{ getAssignmentShift(emp.id)?.name }}
          </el-tag>
        </div>
      </aside>

      <main class="line-main">
        <div v-if="selectedEmployee" class="page-card line-panel">
          <div class="line-panel-head">
            <div>
              <h3>{{ selectedEmployee.name }} · {{ selectedDate }}</h3>
              <p class="text-muted">在时间轴上按住拖动划线，选择工作时段后指定班次</p>
            </div>
            <div class="line-actions">
              <el-select v-model="lineShiftId" style="width: 120px">
                <el-option v-for="s in store.shifts" :key="s.id" :label="s.name" :value="s.id" />
              </el-select>
              <el-button type="primary" @click="applyLineSchedule">应用划线</el-button>
              <el-button @click="clearDaySchedule">清除</el-button>
            </div>
          </div>

          <div v-if="selectionLabel()" class="selection-hint">
            已选时段：{{ selectionLabel() }}
          </div>

          <div
            class="timeline"
            @mouseup="onHourUp"
            @mouseleave="onHourUp"
          >
            <div class="timeline-hours">
              <div v-for="h in hours" :key="h" class="hour-label">{{ h }}</div>
            </div>
            <div class="timeline-track">
              <div
                v-for="h in hours"
                :key="h"
                class="hour-cell"
                :class="{
                  selected: isHourInSelection(h),
                  assigned: getAssignmentShift(selectedEmployeeId) && isHourInShift(h, getAssignmentShift(selectedEmployeeId)!),
                }"
                :style="getAssignmentShift(selectedEmployeeId) && isHourInShift(h, getAssignmentShift(selectedEmployeeId)!)
                  ? { background: getAssignmentShift(selectedEmployeeId)!.color }
                  : {}"
                @mousedown.prevent="onHourDown(h)"
                @mouseenter="onHourEnter(h)"
              />
              <div
                v-if="getAssignmentShift(selectedEmployeeId)"
                class="shift-overlay"
                :style="{
                  left: `${(shiftSpan(getAssignmentShift(selectedEmployeeId)!).startHour / 24) * 100}%`,
                  width: `${((shiftSpan(getAssignmentShift(selectedEmployeeId)!).end - shiftSpan(getAssignmentShift(selectedEmployeeId)!).start) / (24 * 60)) * 100}%`,
                  background: getAssignmentShift(selectedEmployeeId)!.color,
                }"
              >
                {{ getAssignmentShift(selectedEmployeeId)!.name }}
              </div>
            </div>
          </div>
        </div>

        <div class="page-card overview-panel">
          <h4 class="panel-title">当日班组概览</h4>
          <div class="overview-list">
            <div v-for="row in teamOverview" :key="row.emp.id" class="overview-row">
              <span class="overview-name">{{ row.emp.name }}</span>
              <div class="mini-timeline">
                <div
                  v-for="h in hours"
                  :key="h"
                  class="mini-cell"
                  :class="{ on: row.shift && isHourInShift(h, row.shift) }"
                  :style="row.shift && isHourInShift(h, row.shift) ? { background: row.shift.color } : {}"
                />
              </div>
              <span class="overview-shift">{{ row.shift?.name ?? '—' }}</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.line-schedule-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sub-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
}

.sub-header .page-title {
  margin: 0;
  flex: 1;
}

.line-body {
  display: grid;
  grid-template-columns: 200px 1fr;
  gap: 12px;
  align-items: start;
}

.emp-sidebar {
  padding: 12px;
  max-height: calc(100vh - 160px);
  overflow-y: auto;
}

.sidebar-title {
  margin: 0 0 10px;
  font-size: 13px;
  font-weight: 600;
}

.emp-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  margin-bottom: 4px;
}

.emp-item:hover {
  background: #f5f3ff;
}

.emp-item.active {
  background: #ede9fe;
  font-weight: 600;
}

.line-main {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.line-panel {
  padding: 16px 20px;
}

.line-panel-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.line-panel-head h3 {
  margin: 0 0 4px;
}

.line-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.selection-hint {
  background: #ede9fe;
  color: #5b21b6;
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
  margin-bottom: 12px;
}

.timeline {
  user-select: none;
}

.timeline-hours {
  display: grid;
  grid-template-columns: repeat(24, 1fr);
  margin-bottom: 4px;
}

.hour-label {
  text-align: center;
  font-size: 10px;
  color: #909399;
}

.timeline-track {
  position: relative;
  display: grid;
  grid-template-columns: repeat(24, 1fr);
  height: 56px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  overflow: hidden;
}

.hour-cell {
  border-right: 1px solid #eee;
  cursor: crosshair;
  transition: background 0.1s;
}

.hour-cell:last-child {
  border-right: none;
}

.hour-cell.selected {
  background: rgba(124, 58, 237, 0.35) !important;
}

.hour-cell.assigned {
  opacity: 0.85;
}

.shift-overlay {
  position: absolute;
  top: 0;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 12px;
  font-weight: 600;
  border-radius: 4px;
  pointer-events: none;
  opacity: 0.9;
}

.overview-panel {
  padding: 16px 20px;
}

.panel-title {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
}

.overview-row {
  display: grid;
  grid-template-columns: 80px 1fr 60px;
  align-items: center;
  gap: 12px;
  margin-bottom: 8px;
}

.overview-name {
  font-size: 13px;
}

.mini-timeline {
  display: grid;
  grid-template-columns: repeat(24, 1fr);
  height: 16px;
  border: 1px solid #eee;
  border-radius: 4px;
  overflow: hidden;
}

.mini-cell {
  border-right: 1px solid #f5f5f5;
}

.mini-cell.on {
  opacity: 0.9;
}

.overview-shift {
  font-size: 12px;
  color: #606266;
  text-align: right;
}

@media (max-width: 900px) {
  .line-body {
    grid-template-columns: 1fr;
  }
}
</style>
