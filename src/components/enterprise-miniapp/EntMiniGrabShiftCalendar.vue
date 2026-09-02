<script setup lang="ts">
import { computed, ref } from 'vue'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import { SCHEDULE_DEMO_TODAY } from '@/constants/schedule'
import { useAppStore } from '@/stores/app'
import type { GrabInterviewPositionProfile } from '@/types'

dayjs.extend(isoWeek)

export interface GrabShiftCalendarSlot {
  id: string
  date: string
  grabbedCount: number
  requiredCount: number
  publishStatus?: string
  positionName?: string
  displayShiftName: string
  departmentDisplayName: string
  teamName?: string
  startTime: string
  endTime: string
  status?: string
  statusLabel: string
  publishLabel: string
  pendingCount: number
  approvedCount: number
  hourlySubsidy?: number
  effectiveHourlyRate?: number
  positionRequirement?: string
  requirements?: string[]
  positionProfile?: GrabInterviewPositionProfile
  applicants: {
    id: string
    employeeName: string
    whitelisted: boolean
    status: string
    reviewNote?: string
  }[]
}

interface CalendarCell {
  date: string
  inMonth: boolean
}

const props = defineProps<{
  slots: GrabShiftCalendarSlot[]
  storeName: string
  storeOptions: { value: string; label: string }[]
  storeId: string
  selectedDate?: string
  selectedDaySlots?: GrabShiftCalendarSlot[]
}>()

const emit = defineEmits<{
  'update:storeId': [value: string]
  dayClick: [date: string, daySlots: GrabShiftCalendarSlot[]]
  slotClick: [slot: GrabShiftCalendarSlot]
  addDemand: []
}>()

const store = useAppStore()
const legendOpen = ref(false)
const storePickerOpen = ref(false)
const calendarExpanded = ref(false)
const anchorDate = ref(SCHEDULE_DEMO_TODAY)

const weekdayLabels = ['一', '二', '三', '四', '五', '六', '日']

const viewYear = computed(() => dayjs(anchorDate.value).year())
const viewMonth = computed(() => dayjs(anchorDate.value).month() + 1)

const weekDays = computed(() => {
  const start = dayjs(anchorDate.value).startOf('isoWeek')
  return Array.from({ length: 7 }, (_, i) => start.add(i, 'day').format('YYYY-MM-DD'))
})

function getIsoMonthCells(year: number, month: number): CalendarCell[] {
  const first = dayjs(`${year}-${String(month).padStart(2, '0')}-01`)
  const daysInMonth = first.daysInMonth()
  const startPad = first.isoWeekday() - 1
  const cells: CalendarCell[] = []
  for (let i = startPad; i > 0; i--) {
    cells.push({ date: first.subtract(i, 'day').format('YYYY-MM-DD'), inMonth: false })
  }
  for (let d = 0; d < daysInMonth; d++) {
    cells.push({ date: first.add(d, 'day').format('YYYY-MM-DD'), inMonth: true })
  }
  let tail = first.add(daysInMonth - 1, 'day')
  while (cells.length % 7 !== 0) {
    tail = tail.add(1, 'day')
    cells.push({ date: tail.format('YYYY-MM-DD'), inMonth: false })
  }
  return cells
}

const displayCells = computed<CalendarCell[]>(() => {
  if (!calendarExpanded.value) {
    return weekDays.value.map((date) => ({ date, inMonth: true }))
  }
  return getIsoMonthCells(viewYear.value, viewMonth.value)
})

const summaryDates = computed(() => {
  if (!calendarExpanded.value) return weekDays.value
  return displayCells.value.filter((c) => c.inMonth).map((c) => c.date)
})

const rangeLabel = computed(() => {
  if (calendarExpanded.value) return `${viewYear.value}年${viewMonth.value}月`
  const start = dayjs(anchorDate.value).startOf('isoWeek')
  const end = start.add(6, 'day')
  return `${start.format('M月D日')} ~ ${end.format('M月D日')}`
})

const dayStatsMap = computed(() => {
  const map = new Map<
    string,
    {
      grabbed: number
      required: number
      gap: number
      hasSlots: boolean
      hasPending: boolean
      slots: GrabShiftCalendarSlot[]
    }
  >()
  displayCells.value.forEach(({ date }) => {
    const daySlots = props.slots.filter((s) => s.date === date)
    const grabbed = daySlots.reduce((sum, s) => sum + s.grabbedCount, 0)
    const required = daySlots.reduce((sum, s) => sum + s.requiredCount, 0)
    map.set(date, {
      grabbed,
      required,
      gap: Math.max(0, required - grabbed),
      hasSlots: daySlots.length > 0,
      hasPending: daySlots.some((s) => s.publishStatus === 'pending'),
      slots: daySlots,
    })
  })
  return map
})

const periodSummary = computed(() => {
  let grabbed = 0
  let required = 0
  summaryDates.value.forEach((date) => {
    const stat = dayStatsMap.value.get(date)
    if (!stat?.hasSlots) return
    grabbed += stat.grabbed
    required += stat.required
  })
  return {
    total: required,
    scheduled: grabbed,
    gap: Math.max(0, required - grabbed),
  }
})

function isHoliday(date: string) {
  return store.holidays.some((h) => h.date === date && !h.isWorkday)
}

function isToday(date: string) {
  return date === SCHEDULE_DEMO_TODAY
}

function prevPeriod() {
  anchorDate.value = calendarExpanded.value
    ? dayjs(anchorDate.value).subtract(1, 'month').format('YYYY-MM-DD')
    : dayjs(anchorDate.value).subtract(1, 'week').format('YYYY-MM-DD')
}

function nextPeriod() {
  anchorDate.value = calendarExpanded.value
    ? dayjs(anchorDate.value).add(1, 'month').format('YYYY-MM-DD')
    : dayjs(anchorDate.value).add(1, 'week').format('YYYY-MM-DD')
}

function goToday() {
  anchorDate.value = SCHEDULE_DEMO_TODAY
}

function ratioText(date: string) {
  const stat = dayStatsMap.value.get(date)
  if (!stat?.hasSlots) return ''
  return `${stat.grabbed}/${stat.required}`
}

function cellTone(date: string) {
  const stat = dayStatsMap.value.get(date)
  if (!stat?.hasSlots) return 'empty'
  if (stat.gap > 0) return 'vacancy'
  return 'full'
}

function onDayClick(date: string) {
  const stat = dayStatsMap.value.get(date)
  emit('dayClick', date, stat?.slots ?? [])
}

function selectStore(value: string) {
  emit('update:storeId', value)
  storePickerOpen.value = false
}

function toggleExpanded() {
  calendarExpanded.value = !calendarExpanded.value
}

const selectedDateLabel = computed(() => {
  if (!props.selectedDate) return ''
  const d = dayjs(props.selectedDate)
  return `${d.month() + 1}月${d.date()}日`
})
</script>

<template>
  <div class="grab-cal">
    <div class="top-bar">
      <button type="button" class="store-btn" @click="storePickerOpen = true">
        <span class="store-name">{{ storeName }}</span>
        <span class="chev">▾</span>
      </button>
      <button type="button" class="range-btn" @click="toggleExpanded">
        <span>{{ rangeLabel }}</span>
        <span class="chev">▾</span>
      </button>
    </div>

    <div class="range-nav">
      <button type="button" @click="prevPeriod">‹ {{ calendarExpanded ? '上月' : '上周' }}</button>
      <button type="button" @click="goToday">回到今天</button>
      <button type="button" @click="nextPeriod">{{ calendarExpanded ? '下月' : '下周' }} ›</button>
    </div>

    <div class="filter-row">
      <button type="button" class="legend-btn" @click="legendOpen = true">图例 ?</button>
    </div>

    <div class="summary-card">
      <div class="summary-item">
        <div class="summary-val">{{ periodSummary.total }}</div>
        <div class="summary-label">总人次</div>
      </div>
      <div class="summary-eq">=</div>
      <div class="summary-item">
        <div class="summary-val">{{ periodSummary.scheduled }}</div>
        <div class="summary-label">已排人次</div>
      </div>
      <div class="summary-plus">+</div>
      <div class="summary-item accent">
        <div class="summary-val">{{ periodSummary.gap }}</div>
        <div class="summary-label">空缺人次</div>
      </div>
    </div>

    <div class="cal-grid" :class="{ month: calendarExpanded }">
      <div v-for="w in weekdayLabels" :key="w" class="week-head">{{ w }}</div>
      <button
        v-for="cell in displayCells"
        :key="cell.date"
        type="button"
        class="day-cell"
        :class="[
          cellTone(cell.date),
          {
            'out-month': calendarExpanded && !cell.inMonth,
            selected: selectedDate === cell.date,
          },
        ]"
        @click="onDayClick(cell.date)"
      >
        <span v-if="isHoliday(cell.date)" class="badge holiday">节</span>
        <span v-if="dayStatsMap.get(cell.date)?.hasPending" class="badge pending">审批中</span>
        <div class="day-num">{{ isToday(cell.date) ? '今' : dayjs(cell.date).date() }}</div>
        <div
          v-if="ratioText(cell.date)"
          class="day-ratio"
          :class="{ vacancy: cellTone(cell.date) === 'vacancy', full: cellTone(cell.date) === 'full' }"
        >
          {{ ratioText(cell.date) }}
        </div>
      </button>
    </div>

    <button type="button" class="expand-btn" @click="toggleExpanded">
      <span>{{ calendarExpanded ? '收起为一周' : '展开查看本月' }}</span>
      <span class="expand-icon" :class="{ up: calendarExpanded }">›</span>
    </button>

    <button type="button" class="add-btn" @click="emit('addDemand')">+ 新增需求</button>

    <section v-if="selectedDate" class="day-slots">
      <h3 class="day-slots-title">{{ selectedDateLabel }} 抢班班次</h3>
      <p v-if="!selectedDaySlots?.length" class="day-slots-empty">当日暂无抢班需求</p>
      <button
        v-for="s in selectedDaySlots"
        :key="s.id"
        type="button"
        class="slot-card"
        @click="emit('slotClick', s)"
      >
        <div class="slot-card-top">
          <strong>{{ s.positionName || s.displayShiftName }}</strong>
          <span class="status" :class="s.status">{{ s.statusLabel }}</span>
        </div>
        <p>{{ s.displayShiftName }} · {{ s.startTime }}-{{ s.endTime }}</p>
        <p class="slot-card-sub">{{ s.departmentDisplayName }} · {{ s.teamName }}</p>
        <div class="slot-card-meta">
          <span>已抢 {{ s.grabbedCount }}/{{ s.requiredCount }}</span>
          <span v-if="s.pendingCount">待审 {{ s.pendingCount }}</span>
          <span class="slot-card-arrow">›</span>
        </div>
      </button>
    </section>

    <div v-if="storePickerOpen" class="sheet-mask" @click="storePickerOpen = false">
      <div class="sheet" @click.stop>
        <h3>选择门店/班组</h3>
        <button
          v-for="opt in storeOptions"
          :key="opt.value"
          type="button"
          class="sheet-row"
          :class="{ active: storeId === opt.value }"
          @click="selectStore(opt.value)"
        >
          {{ opt.label }}
        </button>
        <button type="button" class="sheet-cancel" @click="storePickerOpen = false">取消</button>
      </div>
    </div>

    <div v-if="legendOpen" class="sheet-mask" @click="legendOpen = false">
      <div class="sheet" @click.stop>
        <h3>图例说明</h3>
        <p><span class="sample vacancy" /> 有空缺（已抢/需求）</p>
        <p><span class="sample full" /> 已满员</p>
        <p><span class="sample empty" /> 暂无抢班需求</p>
        <p><span class="badge holiday inline">节</span> 法定节假日</p>
        <p><span class="badge pending inline">审批中</span> 有待发布审批的抢班</p>
        <button type="button" class="sheet-cancel" @click="legendOpen = false">知道了</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.grab-cal {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 0 2px;
}

.store-btn,
.range-btn {
  border: none;
  background: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 15px;
  font-weight: 700;
  color: var(--mini-text, #111827);
  padding: 4px 0;
  max-width: 48%;
}

.store-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.range-btn {
  font-size: 13px;
  font-weight: 600;
  color: var(--mini-text-secondary, #374151);
}

.chev {
  font-size: 10px;
  color: var(--mini-text-muted, #9ca3af);
}

.range-nav {
  display: flex;
  justify-content: space-between;
  gap: 6px;
  font-size: 11px;
}

.range-nav button {
  border: none;
  background: var(--mini-bg, #f3f4f6);
  color: var(--mini-text-secondary, #6b7280);
  border-radius: 999px;
  padding: 4px 10px;
}

.filter-row {
  display: flex;
  justify-content: flex-end;
}

.legend-btn {
  border: none;
  background: none;
  font-size: 12px;
  color: var(--mini-text-muted, #9ca3af);
}

.summary-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  padding: 14px 12px;
  border-radius: var(--mini-radius, 14px);
  background: linear-gradient(135deg, var(--mini-primary, #228BFF) 0%, #5AA8FF 100%);
  color: #fff;
}

.summary-item {
  flex: 1;
  text-align: center;
  min-width: 0;
}

.summary-item.accent .summary-val {
  color: #fde68a;
}

.summary-val {
  font-size: 22px;
  font-weight: 800;
  line-height: 1.1;
}

.summary-label {
  margin-top: 2px;
  font-size: 11px;
  opacity: 0.92;
}

.summary-eq,
.summary-plus {
  font-size: 18px;
  font-weight: 700;
  opacity: 0.85;
  flex-shrink: 0;
}

.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, minmax(0, 1fr));
  gap: 6px;
}

.cal-grid.month .day-cell {
  min-height: 48px;
}

.week-head {
  text-align: center;
  font-size: 12px;
  color: var(--mini-text-muted, #9ca3af);
  padding: 2px 0 4px;
}

.day-cell {
  position: relative;
  border: none;
  border-radius: 10px;
  min-height: 54px;
  padding: 6px 4px 8px;
  background: var(--mini-bg, #f3f4f6);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
}

.day-cell.vacancy {
  background: var(--mini-primary-light, #D5E9FF);
}

.day-cell.full {
  background: #e5e7eb;
}

.day-cell.empty {
  background: var(--mini-bg, #f3f4f6);
}

.day-cell.out-month {
  opacity: 0.45;
}

.day-cell.selected {
  outline: 2px solid var(--mini-primary, #228BFF);
  outline-offset: -2px;
}

.day-num {
  font-size: 15px;
  font-weight: 700;
  color: var(--mini-text, #111827);
  line-height: 1.1;
}

.day-ratio {
  font-size: 11px;
  font-weight: 700;
}

.day-ratio.vacancy {
  color: var(--mini-primary, #228BFF);
}

.day-ratio.full {
  color: var(--mini-text-muted, #9ca3af);
}

.badge {
  position: absolute;
  top: 2px;
  font-size: 9px;
  line-height: 1;
  padding: 2px 3px;
  border-radius: 3px;
  font-weight: 700;
}

.badge.holiday {
  left: 3px;
  background: #fee2e2;
  color: #dc2626;
}

.badge.pending {
  right: 2px;
  background: #ffedd5;
  color: #ea580c;
  font-size: 8px;
  padding: 2px 4px;
  border-radius: 4px;
}

.badge.inline {
  position: static;
  display: inline-block;
  margin-right: 6px;
  vertical-align: middle;
}

.expand-btn {
  width: 100%;
  height: 36px;
  border: none;
  background: transparent;
  color: var(--mini-primary, #228BFF);
  font-size: 13px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
}

.expand-icon {
  display: inline-block;
  transform: rotate(90deg);
  transition: transform 0.2s;
  font-size: 16px;
}

.expand-icon.up {
  transform: rotate(-90deg);
}

.add-btn {
  width: 100%;
  height: 44px;
  border: 1px solid var(--mini-border, #e5e7eb);
  border-radius: 12px;
  background: var(--mini-card, #fff);
  color: var(--mini-text, #374151);
  font-size: 15px;
  font-weight: 600;
}

.day-slots {
  margin-top: 4px;
}

.day-slots-title {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 700;
  color: var(--mini-text, #111827);
}

.day-slots-empty {
  margin: 0;
  padding: 20px 0;
  text-align: center;
  font-size: 13px;
  color: var(--mini-text-muted, #9ca3af);
}

.slot-card {
  width: 100%;
  text-align: left;
  border: none;
  background: var(--mini-card, #fff);
  border-radius: 12px;
  padding: 12px;
  margin-bottom: 8px;
  box-shadow: var(--mini-shadow, 0 2px 12px rgba(15, 23, 42, 0.06));
}

.slot-card:active {
  opacity: 0.92;
}

.slot-card-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}

.slot-card-top .status {
  flex-shrink: 0;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  background: #f3f4f6;
  color: #6b7280;
}

.slot-card-top .status.open {
  background: #fef2f2;
  color: #dc2626;
}

.slot-card-top .status.partial {
  background: #fffbeb;
  color: #d97706;
}

.slot-card-top .status.full {
  background: #ecfdf5;
  color: #059669;
}

.slot-card p {
  margin: 4px 0 0;
  font-size: 12px;
  color: var(--mini-text-secondary, #6b7280);
}

.slot-card-sub {
  color: var(--mini-text-muted, #9ca3af) !important;
}

.slot-card-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-top: 8px;
  font-size: 12px;
  color: var(--mini-text, #374151);
}

.slot-card-arrow {
  margin-left: auto;
  color: var(--mini-text-muted, #9ca3af);
  font-size: 18px;
}

.sheet-mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  z-index: 50;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.sheet {
  width: min(420px, 100%);
  background: var(--mini-card, #fff);
  border-radius: 16px 16px 0 0;
  padding: 16px 16px 24px;
}

.sheet h3 {
  margin: 0 0 12px;
  font-size: 16px;
}

.sheet-row {
  width: 100%;
  text-align: left;
  border: none;
  background: var(--mini-bg, #f9fafb);
  border-radius: 10px;
  padding: 12px;
  margin-bottom: 8px;
  font-size: 14px;
}

.sheet-row.active {
  background: var(--mini-primary-light, #D5E9FF);
  color: var(--mini-primary-dark, #1A73E6);
  font-weight: 600;
}

.sheet p {
  margin: 0 0 10px;
  font-size: 13px;
  color: var(--mini-text-secondary, #4b5563);
  display: flex;
  align-items: center;
  gap: 6px;
}

.sample {
  width: 28px;
  height: 20px;
  border-radius: 6px;
  flex-shrink: 0;
}

.sample.vacancy {
  background: var(--mini-primary-light, #D5E9FF);
}

.sample.full {
  background: #e5e7eb;
}

.sample.empty {
  background: var(--mini-bg, #f3f4f6);
}

.sheet-cancel {
  width: 100%;
  margin-top: 8px;
  height: 40px;
  border: none;
  background: var(--mini-bg, #f3f4f6);
  border-radius: 10px;
  color: var(--mini-text-secondary, #6b7280);
}
</style>
