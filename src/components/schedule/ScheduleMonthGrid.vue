<script setup lang="ts">
import { getWeekday, isWeekend } from '@/utils'
import type { Employee, Team } from '@/types'

defineProps<{
  dates: string[]
  teamSections: { team: Team; members: Employee[] }[]
  conflictMap: Map<string, string[]>
  compact?: boolean
  getShiftLabel: (employeeId: string, date: string) => string
  getCellClass: (employeeId: string, date: string) => string[]
  getCellStyle: (employeeId: string, date: string) => Record<string, string | undefined>
  calcPeriodHours: (employeeId: string) => number
}>()

const emit = defineEmits<{
  cellClick: [employeeId: string, date: string]
  copyCell: [employeeId: string, date: string]
  pasteCell: [employeeId: string, date: string]
}>()
</script>

<template>
  <div class="schedule-grid-wrap" :class="{ compact }">
    <table class="schedule-grid">
      <thead>
        <tr>
          <th class="sticky-col">人员</th>
          <th
            v-for="date in dates"
            :key="date"
            :class="{ weekend: isWeekend(date) }"
          >
            <div>{{ date.slice(5) }}</div>
            <div class="text-muted">周{{ getWeekday(date) }}</div>
          </th>
          <th v-if="!compact" class="hours-col">工时</th>
        </tr>
      </thead>
      <tbody>
        <template v-for="section in teamSections" :key="section.team.id">
          <tr class="team-row">
            <td :colspan="dates.length + (compact ? 1 : 2)">
              {{ section.team.name }}（{{ section.members.length }}人）
            </td>
          </tr>
          <tr v-for="emp in section.members" :key="emp.id">
            <td class="sticky-col emp-col">
              <div>{{ emp.name }}</div>
              <div class="text-muted">{{ emp.employeeNo }}</div>
            </td>
            <td
              v-for="date in dates"
              :key="date"
              :class="getCellClass(emp.id, date)"
              :style="getCellStyle(emp.id, date)"
              :title="conflictMap.get(`${emp.id}_${date}`)?.join('；')"
              @click="emit('cellClick', emp.id, date)"
              @contextmenu.prevent="emit('copyCell', emp.id, date)"
              @dblclick="emit('pasteCell', emp.id, date)"
            >
              <div v-if="getShiftLabel(emp.id, date)" class="shift-block">
                {{ getShiftLabel(emp.id, date) }}
              </div>
            </td>
            <td v-if="!compact" class="hours-col">{{ calcPeriodHours(emp.id) }}h</td>
          </tr>
        </template>
        <tr v-if="!teamSections.some((s) => s.members.length)">
          <td :colspan="dates.length + 2" class="empty-row">暂无班组成员</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.schedule-grid-wrap {
  overflow: auto;
  max-height: calc(100vh - 320px);
}

.schedule-grid-wrap.compact {
  max-height: calc(100vh - 280px);
}

.schedule-grid-wrap.compact .schedule-grid th,
.schedule-grid-wrap.compact .schedule-grid td {
  min-width: 52px;
  padding: 4px 2px;
  font-size: 11px;
}

.schedule-grid-wrap.compact .grid-cell {
  height: 40px;
}

.schedule-grid {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.schedule-grid th,
.schedule-grid td {
  border: 1px solid var(--app-border);
  padding: 6px 4px;
  text-align: center;
  min-width: 88px;
}

.schedule-grid th.weekend {
  background: #fafafa;
}

.sticky-col {
  position: sticky;
  left: 0;
  background: #fff;
  z-index: 2;
  min-width: 100px;
  text-align: left;
  padding-left: 10px !important;
}

.emp-col {
  background: #fff;
}

.team-row td {
  background: #f5f3ff;
  font-weight: 600;
  text-align: left;
  padding: 8px 12px;
  color: var(--app-primary);
}

.grid-cell {
  cursor: pointer;
  vertical-align: top;
  height: 52px;
}

.grid-cell.conflict {
  box-shadow: inset 0 0 0 2px #f56c6c;
}

.grid-cell.weekend {
  background: #fafafa;
}

.grid-cell.holiday {
  background: #fff7e6;
}

.grid-cell.draft {
  opacity: 0.92;
}

.shift-block {
  background: var(--cell-color, #409eff);
  color: #fff;
  border-radius: 4px;
  padding: 4px 6px;
  font-size: 11px;
  line-height: 1.3;
  margin: 2px;
}

.hours-col {
  font-weight: 600;
  color: #606266;
}

.empty-row {
  padding: 40px;
  color: #909399;
}
</style>
