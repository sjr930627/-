<script setup lang="ts">
import { computed } from 'vue'
import { WarningFilled } from '@element-plus/icons-vue'
import { cellKey, normalizeConfirmStatus, confirmStatusMap, getAssignmentDisplayLabel, getAssignmentDisplayColor, getAssignmentWorkHours, isAssignmentConfirmedLocked } from '@/constants/schedule'
import { getWeekday, isWeekend } from '@/utils'
import type { Employee, ScheduleAssignment, Shift } from '@/types'

export interface TeamBoardGroup {
  teamId: string
  teamName: string
  employees: Employee[]
}

const props = defineProps<{
  dates: string[]
  groups: TeamBoardGroup[]
  shifts: Shift[]
  editMode: 'readonly' | 'editing'
  selectedCells: Set<string>
  conflictMap: Map<string, string[]>
  maxWeeklyHours?: number
  getAssignment: (employeeId: string, date: string) => ScheduleAssignment | undefined
  getPublishedAssignment?: (employeeId: string, date: string) => ScheduleAssignment | undefined
  isCellLocked?: (employeeId: string, date: string) => boolean
  compact?: boolean
}>()

const emit = defineEmits<{
  cellClick: [employeeId: string, date: string, event: MouseEvent]
  cellContext: [employeeId: string, date: string, event: MouseEvent]
  dragStart: [employeeId: string, date: string]
  dragOver: [employeeId: string, date: string, event: DragEvent]
  drop: [employeeId: string, date: string]
}>()

const avatarColors = ['#409EFF', '#67C23A', '#E6A23C', '#F56C6C', '#909399', '#9B59B6', '#1ABC9C']

function avatarColor(index: number) {
  return avatarColors[index % avatarColors.length]
}

function shiftOf(asn: ScheduleAssignment | undefined) {
  if (!asn) return null
  return props.shifts.find((s) => s.id === asn.shiftId) ?? null
}

function cellShiftLabel(asn: ScheduleAssignment | undefined) {
  return getAssignmentDisplayLabel(asn, shiftOf(asn))
}

function cellShiftColor(asn: ScheduleAssignment | undefined) {
  return getAssignmentDisplayColor(asn, shiftOf(asn))
}

function calcEmployeeHours(employeeId: string) {
  let total = 0
  props.dates.forEach((date) => {
    const asn = props.getAssignment(employeeId, date)
    if (!asn) return
    total += getAssignmentWorkHours(asn, props.shifts)
  })
  return Math.round(total)
}

function rowHasConflict(employeeId: string) {
  return props.dates.some((date) => props.conflictMap.has(cellKey(employeeId, date)))
}

function cellClasses(employeeId: string, date: string, asn: ScheduleAssignment | undefined) {
  const classes = ['team-cell']
  const key = cellKey(employeeId, date)
  if (props.selectedCells.has(key)) classes.push('selected')
  if (props.conflictMap.has(key)) classes.push('conflict')
  if (asn?.manualEdited && !asn.published) classes.push('manual')
  if (isWeekend(date)) classes.push('weekend')
  if (!asn) classes.push('empty')
  if (asn?.published && normalizeConfirmStatus(asn.confirmStatus) === 'rejected') {
    classes.push('rejected')
  }
  if (isAssignmentConfirmedLocked(props.getPublishedAssignment?.(employeeId, date) ?? asn) || props.isCellLocked?.(employeeId, date)) {
    classes.push('locked')
  }
  return classes
}

function conflictText(employeeId: string, date: string) {
  const msgs = props.conflictMap.get(cellKey(employeeId, date))
  if (!msgs?.length) return ''
  const msg = msgs[0]
  if (msg.length <= 12) return `冲突 ${msg}`
  return `冲突 ${msg.slice(0, 10)}…`
}

function displayConfirmStatus(employeeId: string, date: string) {
  const asn = props.getPublishedAssignment?.(employeeId, date) ?? props.getAssignment(employeeId, date)
  if (!asn?.published) return undefined
  return normalizeConfirmStatus(asn.confirmStatus)
}

const flatEmployees = computed(() =>
  props.groups.flatMap((g, gi) =>
    g.employees.map((emp, ei) => ({ emp, gi, ei, teamId: g.teamId })),
  ),
)
</script>

<template>
  <div class="team-board-wrap" :class="{ compact }">
    <table class="team-board">
      <thead>
        <tr>
          <th class="sticky-col person-head">人员</th>
          <th
            v-for="date in dates"
            :key="date"
            :class="{ weekend: isWeekend(date) }"
          >
            <div class="day-label">{{ date.slice(5) }}/周{{ getWeekday(date) }}</div>
          </th>
          <th class="hours-head">工时</th>
        </tr>
      </thead>
      <tbody>
        <template v-for="group in groups" :key="group.teamId">
          <tr class="group-row">
            <td :colspan="dates.length + 2" class="group-cell">
              {{ group.teamName }}
              <span class="group-count">{{ group.employees.length }}人</span>
            </td>
          </tr>
          <tr
            v-for="emp in group.employees"
            :key="emp.id"
            class="emp-row"
            :class="{ 'row-conflict': rowHasConflict(emp.id) }"
          >
            <td class="sticky-col person-col">
              <div class="person-info">
                <span
                  class="avatar"
                  :style="{ background: avatarColor(flatEmployees.findIndex((x) => x.emp.id === emp.id)) }"
                >
                  {{ emp.name.slice(0, 1) }}
                </span>
                <span class="person-name">{{ emp.name }}</span>
                <el-icon v-if="rowHasConflict(emp.id)" class="warn-icon" color="#F56C6C">
                  <WarningFilled />
                </el-icon>
              </div>
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
              <template v-if="conflictMap.has(cellKey(emp.id, date))">
                <div class="conflict-block">
                  {{ conflictText(emp.id, date) }}
                </div>
              </template>
              <template v-else-if="getAssignment(emp.id, date)">
                <div
                  class="shift-pill"
                  :style="{ background: cellShiftColor(getAssignment(emp.id, date)) }"
                >
                  {{ cellShiftLabel(getAssignment(emp.id, date)) }}
                </div>
                <span
                  v-if="displayConfirmStatus(emp.id, date)"
                  class="confirm-badge"
                  :style="{
                    color: confirmStatusMap[displayConfirmStatus(emp.id, date)!].color,
                    background: confirmStatusMap[displayConfirmStatus(emp.id, date)!].bg,
                  }"
                >
                  {{ confirmStatusMap[displayConfirmStatus(emp.id, date)!].label }}
                </span>
              </template>
            </td>
            <td
              class="hours-col"
              :class="{ 'hours-over': maxWeeklyHours && calcEmployeeHours(emp.id) > maxWeeklyHours }"
            >
              {{ calcEmployeeHours(emp.id) }}h
            </td>
          </tr>
        </template>
        <tr v-if="!groups.length">
          <td :colspan="dates.length + 2" class="empty-row">暂无排班人员</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.team-board-wrap {
  overflow: auto;
  max-height: calc(100vh - 320px);
  border: 1px solid var(--app-border);
  border-radius: 8px;
}

.team-board-wrap.compact .team-board th,
.team-board-wrap.compact .team-board td {
  min-width: 72px;
  font-size: 11px;
}

.team-board {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.team-board th,
.team-board td {
  border: 1px solid var(--app-border);
  padding: 6px 4px;
  text-align: center;
  min-width: 96px;
  vertical-align: middle;
}

.team-board th.weekend,
.team-board td.weekend {
  background: #fafafa;
}

.sticky-col {
  position: sticky;
  left: 0;
  background: #fff;
  z-index: 2;
  min-width: 120px;
  text-align: left;
  padding-left: 12px !important;
}

.person-head,
.hours-head {
  font-weight: 600;
  background: #f8fafc;
}

.hours-head {
  min-width: 52px;
  position: sticky;
  right: 0;
  z-index: 2;
}

.day-label {
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
}

.group-row .group-cell {
  background: #f0f4f8;
  text-align: left;
  padding: 8px 14px;
  font-weight: 600;
  font-size: 13px;
  color: #303133;
}

.group-count {
  margin-left: 8px;
  font-weight: 400;
  font-size: 12px;
  color: #909399;
}

.emp-row.row-conflict {
  background: #fef8f8;
}

.emp-row.row-conflict .person-col {
  background: #fef8f8;
}

.person-col {
  background: #fff;
}

.person-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  color: #fff;
  font-size: 12px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.person-name {
  font-weight: 600;
  font-size: 13px;
}

.warn-icon {
  font-size: 14px;
  flex-shrink: 0;
}

.team-cell {
  cursor: pointer;
  height: 48px;
  transition: background 0.12s;
  position: relative;
}

.team-cell:hover {
  background: #f5f3ff;
}

.team-cell.selected {
  outline: 2px solid var(--app-primary);
  outline-offset: -2px;
}

.team-cell.conflict {
  background: #fef0f0 !important;
}

.team-cell.manual {
  background: #ecf5ff;
}

.team-cell.rejected {
  background: #fef0f0 !important;
  box-shadow: inset 0 0 0 2px #f56c6c;
}

.team-cell.locked {
  background: #f0fdf4 !important;
  box-shadow: inset 0 0 0 2px #67c23a;
  cursor: default;
}

.shift-pill {
  display: inline-block;
  color: #fff;
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.3;
  max-width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.confirm-badge {
  position: absolute;
  top: 2px;
  right: 2px;
  font-size: 9px;
  line-height: 1.2;
  padding: 1px 4px;
  border-radius: 3px;
  font-weight: 600;
  white-space: nowrap;
}

.conflict-block {
  background: #f56c6c;
  color: #fff;
  border-radius: 6px;
  padding: 4px 6px;
  font-size: 10px;
  font-weight: 600;
  line-height: 1.3;
}

.hours-col {
  font-weight: 700;
  font-size: 13px;
  background: #fff;
  position: sticky;
  right: 0;
  z-index: 1;
  min-width: 52px;
}

.hours-col.hours-over {
  color: #f56c6c;
}

.empty-row {
  padding: 40px;
  color: #909399;
}
</style>
