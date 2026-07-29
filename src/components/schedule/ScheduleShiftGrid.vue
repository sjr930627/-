<script setup lang="ts">
import { getWeekday, isWeekend } from '@/utils'
import type { Employee } from '@/types'

export interface ShiftRow {
  shiftId: string
  shiftName: string
  color: string
  needed: number
  startTime: string
  endTime: string
}

defineProps<{
  dates: string[]
  shiftRows: ShiftRow[]
  compact?: boolean
  getCellEmployees: (shiftId: string, date: string) => Employee[]
  getCellGap: (shiftId: string, date: string) => number
  getCellClass: (shiftId: string, date: string) => string[]
}>()

const emit = defineEmits<{
  cellClick: [shiftId: string, date: string]
}>()
</script>

<template>
  <div class="shift-grid-wrap" :class="{ compact }">
    <table class="shift-grid">
      <thead>
        <tr>
          <th class="sticky-col">班次</th>
          <th
            v-for="date in dates"
            :key="date"
            :class="{ weekend: isWeekend(date) }"
          >
            <div>{{ date.slice(5) }}</div>
            <div class="text-muted">周{{ getWeekday(date) }}</div>
          </th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="row in shiftRows" :key="row.shiftId">
          <td class="sticky-col shift-col">
            <div class="shift-name">
              <i class="shift-dot" :style="{ background: row.color }" />
              {{ row.shiftName }}
            </div>
            <div class="text-muted">{{ row.startTime.slice(0, 5) }}-{{ row.endTime.slice(0, 5) }}</div>
            <div class="need-tag">需 {{ row.needed }} 人/日</div>
          </td>
          <td
            v-for="date in dates"
            :key="date"
            class="shift-cell"
            :class="getCellClass(row.shiftId, date)"
            @click="emit('cellClick', row.shiftId, date)"
          >
            <div class="cell-count">
              {{ getCellEmployees(row.shiftId, date).length }}/{{ row.needed }}
            </div>
            <div class="cell-names">
              <span
                v-for="emp in getCellEmployees(row.shiftId, date).slice(0, compact ? 2 : 4)"
                :key="emp.id"
                class="emp-chip"
              >
                {{ emp.name }}
              </span>
              <span
                v-if="getCellEmployees(row.shiftId, date).length > (compact ? 2 : 4)"
                class="emp-more"
              >
                +{{ getCellEmployees(row.shiftId, date).length - (compact ? 2 : 4) }}
              </span>
            </div>
            <div v-if="getCellGap(row.shiftId, date) > 0" class="cell-gap">
              缺 {{ getCellGap(row.shiftId, date) }}
            </div>
          </td>
        </tr>
        <tr v-if="!shiftRows.length">
          <td :colspan="dates.length + 1" class="empty-row">请配置考勤组班次模板</td>
        </tr>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.shift-grid-wrap {
  overflow: auto;
  max-height: calc(100vh - 320px);
}

.shift-grid-wrap.compact .shift-grid th,
.shift-grid-wrap.compact .shift-grid td {
  min-width: 72px;
  padding: 4px 2px;
  font-size: 11px;
}

.shift-grid {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.shift-grid th,
.shift-grid td {
  border: 1px solid var(--app-border);
  padding: 8px 6px;
  text-align: center;
  min-width: 100px;
  vertical-align: top;
}

.shift-grid th.weekend {
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

.shift-col {
  background: #fff;
}

.shift-name {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  font-size: 13px;
}

.shift-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.need-tag {
  font-size: 11px;
  color: var(--app-primary);
  margin-top: 4px;
}

.shift-cell {
  cursor: pointer;
  min-height: 64px;
  transition: background 0.15s;
}

.shift-cell:hover {
  background: #f5f3ff;
}

.shift-cell.gap {
  background: #fff7e6;
}

.shift-cell.full {
  background: #f0fdf4;
}

.shift-cell.weekend {
  background: #fafafa;
}

.cell-count {
  font-weight: 700;
  font-size: 13px;
  margin-bottom: 4px;
}

.cell-names {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  justify-content: center;
}

.emp-chip {
  background: #ede9fe;
  color: #5b21b6;
  border-radius: 4px;
  padding: 1px 4px;
  font-size: 10px;
}

.emp-more {
  font-size: 10px;
  color: #909399;
}

.cell-gap {
  margin-top: 4px;
  font-size: 10px;
  color: #e6a23c;
  font-weight: 600;
}

.empty-row {
  padding: 40px;
  color: #909399;
}
</style>
