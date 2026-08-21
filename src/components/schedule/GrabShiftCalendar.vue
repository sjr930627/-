<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { getCalendarCells } from '@/composables/useMiniSchedule'
import { getWeekday, isWeekend } from '@/utils'
import type { GrabShiftSlot } from '@/types'

export interface GrabShiftCalendarItem extends GrabShiftSlot {
  displayShiftName: string
  groupName: string
  scopeLabel: string
  gap: number
  statusLabel: string
  statusType: 'success' | 'warning' | 'danger' | 'info'
  pendingApps: number
  positionName?: string
}

const props = defineProps<{
  slots: GrabShiftCalendarItem[]
}>()

const emit = defineEmits<{
  slotClick: [slot: GrabShiftCalendarItem]
}>()

const viewYear = ref(2026)
const viewMonth = ref(7)
const selectedDate = ref<string | null>(null)

const monthLabel = computed(() => `${viewYear.value}年${viewMonth.value}月`)

const calendarCells = computed(() => getCalendarCells(viewYear.value, viewMonth.value))

const slotsByDate = computed(() => {
  const map = new Map<string, GrabShiftCalendarItem[]>()
  props.slots.forEach((slot) => {
    const list = map.get(slot.date) ?? []
    list.push(slot)
    map.set(slot.date, list)
  })
  map.forEach((list, date) => {
    map.set(
      date,
      list.sort((a, b) => a.startTime.localeCompare(b.startTime)),
    )
  })
  return map
})

const monthSummary = computed(() => {
  const prefix = `${viewYear.value}-${String(viewMonth.value).padStart(2, '0')}`
  const monthSlots = props.slots.filter((s) => s.date.startsWith(prefix))
  return {
    total: monthSlots.length,
    open: monthSlots.filter((s) => s.status === 'open' || s.status === 'partial').length,
    full: monthSlots.filter((s) => s.status === 'full').length,
  }
})

const selectedDaySlots = computed(() =>
  selectedDate.value ? slotsByDate.value.get(selectedDate.value) ?? [] : [],
)

watch(
  () => props.slots,
  (slots) => {
    if (!slots.length) return
    const latest = slots.reduce((max, s) => (s.date > max ? s.date : max), slots[0].date)
    const [y, m] = latest.split('-').map(Number)
    if (!Number.isNaN(y) && !Number.isNaN(m)) {
      viewYear.value = y
      viewMonth.value = m
    }
  },
  { immediate: true },
)

function prevMonth() {
  if (viewMonth.value === 1) {
    viewMonth.value = 12
    viewYear.value -= 1
  } else {
    viewMonth.value -= 1
  }
}

function nextMonth() {
  if (viewMonth.value === 12) {
    viewMonth.value = 1
    viewYear.value += 1
  } else {
    viewMonth.value += 1
  }
}

function goToday() {
  viewYear.value = 2026
  viewMonth.value = 7
  selectedDate.value = '2026-07-28'
}

function slotsForDate(date: string | null) {
  if (!date) return []
  return slotsByDate.value.get(date) ?? []
}

function slotCount(date: string | null) {
  return slotsForDate(date).length
}

function selectDate(date: string | null) {
  if (!date) return
  selectedDate.value = selectedDate.value === date ? null : date
}

function statusClass(status: GrabShiftSlot['status']) {
  return `status-${status}`
}
</script>

<template>
  <div class="grab-calendar">
    <div class="calendar-toolbar">
      <div class="toolbar-left">
        <el-button-group size="small">
          <el-button @click="prevMonth">◀</el-button>
          <el-button @click="nextMonth">▶</el-button>
          <el-button @click="goToday">今天</el-button>
        </el-button-group>
        <span class="month-label">{{ monthLabel }}</span>
      </div>
      <div class="toolbar-stats text-muted">
        本月 {{ monthSummary.total }} 个班次 · 招募中 {{ monthSummary.open }} · 已满 {{ monthSummary.full }}
      </div>
    </div>

    <div class="calendar-legend">
      <span class="legend-item"><i class="dot status-open" />招募中</span>
      <span class="legend-item"><i class="dot status-partial" />部分满员</span>
      <span class="legend-item"><i class="dot status-full" />已满员</span>
      <span class="legend-item"><i class="dot status-cancelled" />已取消</span>
    </div>

    <div class="calendar-grid">
      <div v-for="w in ['日', '一', '二', '三', '四', '五', '六']" :key="w" class="weekday-head">
        周{{ w }}
      </div>
      <div
        v-for="(cell, idx) in calendarCells"
        :key="idx"
        class="day-cell"
        :class="{
          empty: !cell.date,
          weekend: cell.date && isWeekend(cell.date),
          selected: cell.date && cell.date === selectedDate,
          'has-slots': cell.date && slotCount(cell.date) > 0,
        }"
        @click="selectDate(cell.date)"
      >
        <template v-if="cell.date">
          <div class="day-head">
            <span class="day-num">{{ cell.day }}</span>
            <span v-if="slotCount(cell.date)" class="day-count">{{ slotCount(cell.date) }}</span>
          </div>
          <div class="slot-list">
            <button
              v-for="slot in slotsForDate(cell.date).slice(0, 3)"
              :key="slot.id"
              type="button"
              class="slot-pill"
              :class="statusClass(slot.status)"
              @click.stop="emit('slotClick', slot)"
            >
              <span class="slot-name">{{ slot.displayShiftName }}</span>
              <span class="slot-meta">
                {{ slot.startTime.slice(0, 5) }} · {{ slot.grabbedCount }}/{{ slot.requiredCount }}
              </span>
            </button>
            <div v-if="slotCount(cell.date) > 3" class="more-slots">
              +{{ slotCount(cell.date) - 3 }} 个
            </div>
          </div>
        </template>
      </div>
    </div>

    <div v-if="selectedDate" class="day-detail page-card">
      <div class="day-detail-head">
        <h4>{{ selectedDate }}（周{{ getWeekday(selectedDate) }}）</h4>
        <span class="text-muted">{{ selectedDaySlots.length }} 个抢班班次</span>
      </div>
      <el-empty v-if="!selectedDaySlots.length" description="当日暂无抢班班次" :image-size="48" />
      <div v-else class="day-detail-list">
        <div
          v-for="slot in selectedDaySlots"
          :key="slot.id"
          class="detail-card"
          @click="emit('slotClick', slot)"
        >
          <div class="detail-card-head">
            <span class="detail-shift">{{ slot.displayShiftName }}</span>
            <el-tag :type="slot.statusType" size="small">{{ slot.statusLabel }}</el-tag>
          </div>
          <div class="detail-card-meta text-muted">
            {{ slot.groupName }} · {{ slot.positionName || slot.scopeLabel }} · {{ slot.startTime.slice(0, 5) }}-{{ slot.endTime.slice(0, 5) }}
          </div>
          <div class="detail-card-foot">
            <span>已抢 {{ slot.grabbedCount }}/{{ slot.requiredCount }}</span>
            <span v-if="slot.effectiveHourlyRate">¥{{ slot.effectiveHourlyRate }}/h</span>
            <span v-if="slot.pendingApps" class="pending-tag">待审 {{ slot.pendingApps }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.grab-calendar {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.calendar-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 12px;
}

.month-label {
  font-size: 16px;
  font-weight: 600;
}

.toolbar-stats {
  font-size: 13px;
}

.calendar-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 16px;
  font-size: 12px;
  color: #606266;
}

.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 3px;
  display: inline-block;
}

.dot.status-open {
  background: #fef0f0;
  border: 2px solid #f56c6c;
}

.dot.status-partial {
  background: #fdf6ec;
  border: 2px solid #e6a23c;
}

.dot.status-full {
  background: #f0f9eb;
  border: 2px solid #67c23a;
}

.dot.status-cancelled {
  background: #f4f4f5;
  border: 2px solid #909399;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  border: 1px solid var(--app-border);
  border-radius: 8px;
  overflow: hidden;
}

.weekday-head {
  padding: 10px 6px;
  text-align: center;
  font-size: 12px;
  font-weight: 600;
  color: #606266;
  background: #f5f7fa;
  border-bottom: 1px solid var(--app-border);
}

.day-cell {
  min-height: 108px;
  padding: 6px;
  border-right: 1px solid var(--app-border);
  border-bottom: 1px solid var(--app-border);
  background: #fff;
  cursor: pointer;
  transition: background 0.12s;
}

.day-cell:nth-child(7n) {
  border-right: none;
}

.day-cell.empty {
  background: #fafafa;
  cursor: default;
}

.day-cell.weekend {
  background: #fcfcfc;
}

.day-cell.selected {
  background: #eef2ff;
  box-shadow: inset 0 0 0 2px var(--app-primary);
}

.day-cell.has-slots:hover {
  background: #f5f3ff;
}

.day-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 4px;
}

.day-num {
  font-size: 13px;
  font-weight: 600;
}

.day-count {
  font-size: 10px;
  font-weight: 700;
  color: #fa8c16;
  background: #fff7e6;
  border-radius: 8px;
  padding: 0 5px;
}

.slot-list {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.slot-pill {
  width: 100%;
  border: none;
  border-radius: 6px;
  padding: 4px 6px;
  text-align: left;
  cursor: pointer;
  font-size: 10px;
  line-height: 1.25;
}

.slot-pill.status-open {
  background: #fef0f0;
  color: #c45656;
  border: 1px solid #fbc4c4;
}

.slot-pill.status-partial {
  background: #fdf6ec;
  color: #b88230;
  border: 1px solid #f5dab1;
}

.slot-pill.status-full {
  background: #f0f9eb;
  color: #529b2e;
  border: 1px solid #c2e7b0;
}

.slot-pill.status-cancelled {
  background: #f4f4f5;
  color: #909399;
  border: 1px solid #dcdfe6;
}

.slot-name {
  display: block;
  font-weight: 700;
}

.slot-meta {
  display: block;
  opacity: 0.85;
}

.more-slots {
  font-size: 10px;
  color: #909399;
  padding-left: 2px;
}

.day-detail {
  padding: 16px;
}

.day-detail-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.day-detail-head h4 {
  margin: 0;
  font-size: 15px;
}

.day-detail-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 10px;
}

.detail-card {
  padding: 12px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  cursor: pointer;
  transition: box-shadow 0.12s, border-color 0.12s;
}

.detail-card:hover {
  border-color: var(--app-primary);
  box-shadow: 0 2px 8px rgba(91, 79, 219, 0.12);
}

.detail-card-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.detail-shift {
  font-weight: 600;
  font-size: 14px;
}

.detail-card-meta {
  font-size: 12px;
  margin-bottom: 8px;
}

.detail-card-foot {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  font-size: 12px;
  color: #606266;
}

.pending-tag {
  color: #e6a23c;
  font-weight: 600;
}
</style>
