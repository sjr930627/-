<script setup lang="ts">
import { confirmStatusMap, cellKey, shiftShortName } from '@/constants/schedule'
import { getWeekday, isWeekend } from '@/utils'
import type { Employee, ScheduleAssignment, Shift } from '@/types'

const props = defineProps<{
  dates: string[]
  employees: Employee[]
  shifts: Shift[]
  editMode: 'readonly' | 'editing'
  selectedCells: Set<string>
  conflictMap: Map<string, string[]>
  getAssignment: (employeeId: string, date: string) => ScheduleAssignment | undefined
  dailyStats: { date: string; shiftSummary: string; confirmed: number; total: number }[]
  compact?: boolean
}>()

const emit = defineEmits<{
  cellClick: [employeeId: string, date: string, event: MouseEvent]
  cellContext: [employeeId: string, date: string, event: MouseEvent]
  dragStart: [employeeId: string, date: string]
  dragOver: [employeeId: string, date: string, event: DragEvent]
  drop: [employeeId: string, date: string]
}>()

function shiftOf(asn: ScheduleAssignment | undefined) {
  if (!asn) return null
  return props.shifts.find((s) => s.id === asn.shiftId) ?? null
}

function cellClasses(employeeId: string, date: string, asn: ScheduleAssignment | undefined) {
  const classes = ['board-cell']
  const key = cellKey(employeeId, date)
  if (props.selectedCells.has(key)) classes.push('selected')
  if (props.conflictMap.has(key)) classes.push('conflict')
  if (asn?.manualEdited && !asn.published) classes.push('manual')
  if (isWeekend(date)) classes.push('weekend')
  if (!asn) classes.push('empty')
  return classes
}
</script>

<template>
  <div class="board-wrap" :class="{ compact }">
    <table class="board-table">
      <thead>
        <tr>
          <th class="sticky-col emp-head">员工</th>
          <th
            v-for="date in dates"
            :key="date"
            :class="{ weekend: isWeekend(date) }"
          >
            <div class="date-num">{{ date.slice(8) }}</div>
            <div class="date-week">周{{ getWeekday(date) }}</div>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="emp in employees" :key="emp.id">
          <td class="sticky-col emp-name">
            <div>{{ emp.name }}</div>
            <div class="text-muted">{{ emp.employeeNo }}</div>
          </td>
          <td
            v-for="date in dates"
            :key="date"
            :class="cellClasses(emp.id, date, getAssignment(emp.id, date))"
            :title="conflictMap.get(cellKey(emp.id, date))?.join('；')"
            draggable="true"
            @click="emit('cellClick', emp.id, date, $event)"
            @contextmenu.prevent="emit('cellContext', emp.id, date, $event)"
            @dragstart="emit('dragStart', emp.id, date)"
            @dragover.prevent="emit('dragOver', emp.id, date, $event)"
            @drop.prevent="emit('drop', emp.id, date)"
          >
            <template v-if="getAssignment(emp.id, date)">
              <div
                class="shift-block"
                :style="{ background: shiftOf(getAssignment(emp.id, date))?.color ?? '#909399' }"
              >
                {{ shiftShortName(shiftOf(getAssignment(emp.id, date))?.name ?? '') }}
              </div>
              <span
                v-if="getAssignment(emp.id, date)?.confirmStatus"
                class="confirm-badge"
                :style="{
                  color: confirmStatusMap[getAssignment(emp.id, date)!.confirmStatus!].color,
                  background: confirmStatusMap[getAssignment(emp.id, date)!.confirmStatus!].bg,
                }"
              >
                {{ confirmStatusMap[getAssignment(emp.id, date)!.confirmStatus!].short }}
              </span>
              <span v-if="getAssignment(emp.id, date)?.manualEdited" class="edit-dot" />
            </template>
          </td>
        </tr>
        <tr class="stats-row">
          <td class="sticky-col stats-label">班次统计</td>
          <td v-for="row in dailyStats" :key="row.date" class="stats-cell">
            <div>{{ row.shiftSummary || '—' }}</div>
          </td>
        </tr>
        <tr class="stats-row">
          <td class="sticky-col stats-label">确认进度</td>
          <td v-for="row in dailyStats" :key="'c-' + row.date" class="stats-cell">
            <div>确认:{{ row.confirmed }}/{{ row.total }}</div>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.board-wrap {
  overflow: auto;
  max-height: calc(100vh - 280px);
  border: 1px solid var(--app-border);
  border-radius: 8px;
}

.board-wrap.compact .board-table th,
.board-wrap.compact .board-table td {
  min-width: 52px;
  font-size: 11px;
}

.board-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.board-table th,
.board-table td {
  border: 1px solid var(--app-border);
  padding: 6px 4px;
  text-align: center;
  min-width: 72px;
  vertical-align: middle;
  position: relative;
}

.board-table th.weekend,
.board-table td.weekend {
  background: #fafafa;
}

.sticky-col {
  position: sticky;
  left: 0;
  background: #fff;
  z-index: 2;
  min-width: 88px;
  text-align: left;
  padding-left: 10px !important;
}

.emp-head {
  font-weight: 600;
}

.emp-name {
  background: #fff;
  font-size: 12px;
}

.date-num {
  font-weight: 700;
}

.date-week {
  font-size: 10px;
  color: #909399;
}

.board-cell {
  cursor: pointer;
  height: 52px;
  transition: background 0.12s;
}

.board-cell:hover {
  background: #f5f3ff;
}

.board-cell.selected {
  outline: 2px solid var(--app-primary);
  outline-offset: -2px;
}

.board-cell.conflict {
  background: #fef0f0 !important;
  box-shadow: inset 0 0 0 2px #f56c6c;
}

.board-cell.manual {
  background: #ecf5ff;
}

.board-cell.empty {
  background: #fff;
}

.shift-block {
  color: #fff;
  border-radius: 4px;
  padding: 4px 6px;
  font-size: 12px;
  font-weight: 600;
  margin: 0 auto;
  max-width: 48px;
}

.confirm-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  font-size: 9px;
  line-height: 1;
  padding: 1px 3px;
  border-radius: 3px;
  font-weight: 700;
}

.edit-dot {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #409eff;
}

.stats-row td {
  background: #f5f6fa;
  font-size: 10px;
  padding: 6px 4px;
  height: auto;
}

.stats-label {
  font-weight: 600;
  color: #606266;
  background: #eef0f5 !important;
}

.stats-cell {
  color: #606266;
  line-height: 1.4;
}
</style>
