<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import { useMiniAppNow } from '@/composables/useMiniAppNow'
import { MINIAPP_DEMO_ANCHOR_DATE } from '@/constants/miniapp'
import {
  buildDayDetail,
  formatDuration,
  getCalendarCells,
  getMonthStats,
  resolveDayState,
  shiftBarColor,
} from '@/composables/useMiniSchedule'

const router = useRouter()
const route = useRoute()
const store = useAppStore()
const { employeeId } = useMiniAppWorker()
const { now } = useMiniAppNow()

function localDateStr(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const today = computed(() => localDateStr(now.value))

const viewYear = ref(2026)
const viewMonth = ref(7)
const selectedDate = ref(MINIAPP_DEMO_ANCHOR_DATE)
const listTab = ref<'future' | 'history'>('future')

function syncFromRoute() {
  const tab = route.query.tab
  if (tab === 'punch' || tab === 'history') listTab.value = 'history'
  else if (tab === 'schedule' || tab === 'future') listTab.value = 'future'

  const dateQuery = route.query.date
  if (typeof dateQuery === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateQuery)) {
    selectedDate.value = dateQuery
    const [y, m] = dateQuery.split('-').map(Number)
    viewYear.value = y
    viewMonth.value = m
  }
}

syncFromRoute()
watch(() => route.query, syncFromRoute)

function switchTab(tab: 'future' | 'history') {
  listTab.value = tab
  router.replace({
    path: '/miniapp/schedule',
    query: {
      ...route.query,
      tab: tab === 'history' ? 'punch' : 'schedule',
      date: selectedDate.value,
    },
  })
}

const monthLabel = computed(() => `${viewYear.value}年${viewMonth.value}月`)

const monthStats = computed(() =>
  getMonthStats(store, employeeId.value, viewYear.value, viewMonth.value),
)

const calendarCells = computed(() => getCalendarCells(viewYear.value, viewMonth.value))

function cellShiftId(date: string) {
  const asn = store.getAssignment(employeeId.value, date)
  return asn?.shiftId
}

function cellClass(date: string) {
  if (date === selectedDate.value) return 'selected'
  if (date === today.value) return 'today'
  const { state } = resolveDayState(store, employeeId.value, date, today.value, now.value)
  if (date < today.value && state === 'done') return 'past-ok'
  if (date < today.value && state === 'absent') return 'past-bad'
  return ''
}

function prevMonth() {
  if (viewMonth.value === 1) {
    viewMonth.value = 12
    viewYear.value -= 1
  } else viewMonth.value -= 1
}

function nextMonth() {
  if (viewMonth.value === 12) {
    viewMonth.value = 1
    viewYear.value += 1
  } else viewMonth.value += 1
}

const futureList = computed(() => {
  const prefix = `${viewYear.value}-${String(viewMonth.value).padStart(2, '0')}`
  return store.assignments
    .filter(
      (a) =>
        a.employeeId === employeeId.value &&
        a.date.startsWith(prefix) &&
        a.date >= today.value,
    )
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((a) => buildDayDetail(store, employeeId.value, a.date, now.value))
})

const historyList = computed(() => {
  const prefix = `${viewYear.value}-${String(viewMonth.value).padStart(2, '0')}`
  const assignmentDates = new Set(
    store.assignments
      .filter(
        (a) =>
          a.employeeId === employeeId.value &&
          a.date.startsWith(prefix) &&
          a.date < today.value,
      )
      .map((a) => a.date),
  )
  const punchDates = store.punches
    .filter(
      (p) =>
        p.employeeId === employeeId.value &&
        p.date.startsWith(prefix) &&
        p.date < today.value,
    )
    .map((p) => p.date)
  punchDates.forEach((d) => assignmentDates.add(d))

  return [...assignmentDates]
    .sort((a, b) => b.localeCompare(a))
    .map((date) => buildDayDetail(store, employeeId.value, date, now.value))
})

const displayList = computed(() =>
  listTab.value === 'future' ? futureList.value : historyList.value,
)

function cancelScheduleDemo() {
  ElMessage.info('取消排班（演示）')
}

function selectDate(date: string) {
  selectedDate.value = date
  router.replace({
    path: '/miniapp/schedule',
    query: { tab: listTab.value === 'history' ? 'punch' : 'schedule', date },
  })
}

function doPunch() {
  try {
    const hasIn = store.punches.some(
      (p) =>
        p.employeeId === employeeId.value &&
        p.date === selectedDate.value &&
        p.type === 'clock_in',
    )
    store.addPunch({
      employeeId: employeeId.value,
      date: selectedDate.value,
      time: now.value.toTimeString().slice(0, 8),
      type: hasIn ? 'clock_out' : 'clock_in',
      source: 'mobile',
      location: '北京 · 朝阳区 · 中石化朝阳加油站',
      inRange: true,
    })
    ElMessage.success(hasIn ? '签退成功' : '签到成功')
  } catch (e) {
    ElMessage.warning(e instanceof Error ? e.message : '打卡失败')
  }
}

function progressPercent(detail: ReturnType<typeof buildDayDetail>) {
  const total = detail.workedMinutes + detail.remainingMinutes
  if (total <= 0) return 0
  return Math.round((detail.workedMinutes / total) * 100)
}
</script>

<template>
  <div class="sc-page">
    <div class="mini-nav-bar">
      <button class="mini-nav-back" @click="router.back()">←</button>
      <div class="mini-nav-title" style="margin-right: 0">排班日历</div>
      <button class="sc-menu-btn" type="button">⋯</button>
    </div>

    <!-- 月份选择 -->
    <div class="sc-month-bar">
      <button type="button" class="sc-nav-arrow" @click="prevMonth">‹</button>
      <div class="sc-month-label">{{ monthLabel }} ▾</div>
      <button type="button" class="sc-nav-arrow" @click="nextMonth">›</button>
    </div>

    <!-- 月度统计 -->
    <div class="sc-stats-row">
      <div class="sc-stat blue">
        <div class="sc-stat-val">{{ monthStats.days }}</div>
        <div class="sc-stat-label">排班天数</div>
      </div>
      <div class="sc-stat green">
        <div class="sc-stat-val">{{ monthStats.totalHours }}h</div>
        <div class="sc-stat-label">总工时</div>
      </div>
      <div class="sc-stat orange">
        <div class="sc-stat-val">¥{{ monthStats.totalPay.toLocaleString() }}</div>
        <div class="sc-stat-label">预计收入</div>
      </div>
    </div>

    <!-- 日历 -->
    <div class="sc-calendar-card">
      <div class="sc-week-head">
        <span v-for="w in ['日','一','二','三','四','五','六']" :key="w">{{ w }}</span>
      </div>
      <div class="sc-calendar-grid">
        <div
          v-for="(cell, idx) in calendarCells"
          :key="idx"
          class="sc-cal-cell"
          :class="cell.date ? cellClass(cell.date) : 'empty'"
          @click="cell.date && selectDate(cell.date)"
        >
          <template v-if="cell.day">
            <div class="sc-cal-day">{{ cell.day }}</div>
            <div
              v-if="cellShiftId(cell.date!) !== 'shift_rest'"
              class="sc-cal-bar"
              :style="{ background: shiftBarColor(cellShiftId(cell.date!)) }"
            />
          </template>
        </div>
      </div>
      <div class="sc-legend">
        <span><i style="background:#409EFF" />早班</span>
        <span><i style="background:#E6A23C" />中班</span>
        <span><i style="background:#9B59B6" />夜班</span>
        <span><i style="background:#d9d9d9" />休息</span>
      </div>
    </div>

    <!-- 列表 Tab -->
    <div class="sc-list-tabs">
      <button
        :class="{ active: listTab === 'future' }"
        type="button"
        @click="switchTab('future')"
      >
        排班记录
      </button>
      <button
        :class="{ active: listTab === 'history' }"
        type="button"
        @click="switchTab('history')"
      >
        打卡记录
      </button>
    </div>

    <!-- 排班列表 -->
    <div
      v-for="detail in displayList"
      :key="detail.date"
      class="sc-shift-card"
      :class="{ selected: detail.date === selectedDate }"
    >
      <div class="sc-shift-head">
        <span class="sc-shift-date">{{ detail.date.slice(5).replace('-', '月') }}日 {{ detail.weekday }}</span>
        <span
          class="sc-shift-badge"
          :class="detail.state"
        >{{ detail.stateLabel }}</span>
      </div>

      <!-- 休息 -->
      <template v-if="detail.state === 'rest'">
        <div class="sc-rest-box">
          <span>😊</span>
          <span>今天是休息日，好好放松~</span>
        </div>
        <button class="sc-link-btn" type="button" @click="router.push('/miniapp/recommend')">
          去抢额外班次 ›
        </button>
      </template>

      <!-- 有班次 -->
      <template v-else>
        <div class="sc-shift-body">
          <div class="sc-shift-left">
            <div class="sc-shift-title">
              <span class="sc-shift-icon">☀️</span>
              {{ detail.shift?.name }} · {{ detail.teamName }}
            </div>
            <div class="sc-shift-time">
              {{ detail.shift?.startTime }} - {{ detail.shift?.endTime }}
              · {{ Math.round((detail.workedMinutes + detail.remainingMinutes) / 60) }}小时
            </div>
            <div class="sc-shift-pay">
              ¥{{ detail.estimatedPay }}
              <small>¥{{ detail.hourlyRate }}/时</small>
            </div>
          </div>
        </div>

        <div v-if="detail.clockIn" class="sc-punch-row ok">
          ✓ 已签到 {{ detail.clockIn.slice(0, 5) }}
        </div>
        <div v-if="detail.clockOut" class="sc-punch-row ok">
          ✓ 已签退 {{ detail.clockOut.slice(0, 5) }}
        </div>

        <div v-if="detail.state === 'active' && detail.workedMinutes > 0" class="sc-progress-wrap">
          <div class="sc-progress-labels">
            <span>已工作 {{ formatDuration(detail.workedMinutes) }}</span>
            <span>剩余 {{ formatDuration(detail.remainingMinutes) }}</span>
          </div>
          <div class="sc-progress-bar">
            <div class="sc-progress-fill" :style="{ width: `${progressPercent(detail)}%` }" />
          </div>
        </div>

        <div v-if="!detail.clockOut && detail.clockIn" class="sc-punch-row pending">
          🕐 待签退 {{ detail.shift?.endTime?.slice(0, 5) ?? '--:--' }}
        </div>

        <div class="sc-location">📍 {{ detail.location }}</div>

        <button
          v-if="detail.date === today && detail.state === 'active' && !detail.clockOut"
          class="sc-punch-primary"
          type="button"
          @click="doPunch"
        >
          立即打卡
        </button>
        <button
          v-else-if="detail.date > today && detail.state === 'upcoming'"
          class="sc-punch-secondary"
          type="button"
          @click="cancelScheduleDemo"
        >
          取消排班
        </button>
      </template>
    </div>

    <div v-if="displayList.length === 0" class="mini-empty">
      {{ listTab === 'future' ? '暂无排班记录' : '暂无打卡记录' }}
    </div>
  </div>
</template>

<style scoped>
.sc-page {
  background: #f4f6f9;
  min-height: 100%;
  padding-bottom: 20px;
}

.sc-menu-btn {
  border: none;
  background: none;
  font-size: 20px;
  color: #333;
  padding: 0 8px;
  cursor: pointer;
}

.sc-month-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 20px;
  padding: 12px;
  background: #fff;
}

.sc-nav-arrow {
  border: none;
  background: none;
  font-size: 24px;
  color: #999;
  cursor: pointer;
  padding: 0 8px;
}

.sc-month-label {
  font-size: 17px;
  font-weight: 700;
  color: #1a1a1a;
}

.sc-stats-row {
  display: flex;
  gap: 8px;
  padding: 12px 14px;
}

.sc-stat {
  flex: 1;
  border-radius: 12px;
  padding: 12px 8px;
  text-align: center;
}

.sc-stat.blue { background: #e8f4ff; }
.sc-stat.green { background: #e8f8ef; }
.sc-stat.orange { background: #fff3e6; }

.sc-stat-val {
  font-size: 20px;
  font-weight: 800;
  color: #1a1a1a;
}

.sc-stat.orange .sc-stat-val { color: #ff8c00; }
.sc-stat.blue .sc-stat-val { color: #409eff; }
.sc-stat.green .sc-stat-val { color: #52c41a; }

.sc-stat-label {
  font-size: 11px;
  color: #999;
  margin-top: 2px;
}

.sc-calendar-card {
  margin: 0 14px 12px;
  background: #fff;
  border-radius: 16px;
  padding: 14px;
}

.sc-week-head {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  text-align: center;
  font-size: 12px;
  color: #999;
  margin-bottom: 8px;
}

.sc-calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.sc-cal-cell {
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 10px;
  cursor: pointer;
  padding: 4px;
}

.sc-cal-cell.empty { cursor: default; }
.sc-cal-cell.selected {
  background: #e8f4ff;
  border: 2px solid #409eff;
}
.sc-cal-cell.today:not(.selected) { background: #f0faf4; }
.sc-cal-cell.past-ok { background: #f6ffed; }
.sc-cal-cell.past-bad { background: #fff1f0; }

.sc-cal-day {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.sc-cal-bar {
  width: 16px;
  height: 3px;
  border-radius: 2px;
  margin-top: 4px;
}

.sc-legend {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 12px;
  font-size: 11px;
  color: #999;
}

.sc-legend i {
  display: inline-block;
  width: 12px;
  height: 4px;
  border-radius: 2px;
  margin-right: 4px;
  vertical-align: middle;
}

.sc-list-tabs {
  display: flex;
  gap: 24px;
  padding: 8px 14px 12px;
  border-bottom: 1px solid #eee;
  background: #fff;
  margin: 0 14px;
  border-radius: 12px 12px 0 0;
}

.sc-list-tabs button {
  border: none;
  background: none;
  font-size: 15px;
  color: #999;
  padding: 4px 0;
  cursor: pointer;
  position: relative;
}

.sc-list-tabs button.active {
  color: #409eff;
  font-weight: 700;
}

.sc-list-tabs button.active::after {
  content: '';
  position: absolute;
  bottom: -12px;
  left: 0;
  right: 0;
  height: 2px;
  background: #409eff;
  border-radius: 1px;
}

.sc-shift-card {
  margin: 0 14px 10px;
  background: #fff;
  border-radius: 14px;
  padding: 14px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
}

.sc-shift-card.selected {
  border: 2px solid #409eff;
  box-shadow: 0 2px 12px rgba(64, 158, 255, 0.15);
}

.sc-shift-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.sc-shift-date {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.sc-shift-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 8px;
}

.sc-shift-badge.active { background: #e8f4ff; color: #409eff; }
.sc-shift-badge.upcoming { background: #e8f8ef; color: #52c41a; }
.sc-shift-badge.done { background: #f0f0f0; color: #999; }
.sc-shift-badge.rest { background: #f5f5f5; color: #bbb; }
.sc-shift-badge.absent { background: #fff1f0; color: #ff4d4f; }

.sc-shift-title {
  font-size: 16px;
  font-weight: 700;
  display: flex;
  align-items: center;
  gap: 6px;
}

.sc-shift-time {
  font-size: 13px;
  color: #666;
  margin-top: 4px;
}

.sc-shift-pay {
  font-size: 24px;
  font-weight: 800;
  color: #ff8c00;
  margin-top: 8px;
}

.sc-shift-pay small {
  font-size: 12px;
  color: #999;
  font-weight: 400;
  margin-left: 6px;
}

.sc-punch-row {
  font-size: 13px;
  margin-top: 10px;
  padding: 8px 10px;
  border-radius: 8px;
}

.sc-punch-row.ok { background: #f6ffed; color: #52c41a; }
.sc-punch-row.pending { background: #fafafa; color: #999; }

.sc-progress-wrap { margin-top: 10px; }

.sc-progress-labels {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #999;
  margin-bottom: 4px;
}

.sc-progress-bar {
  height: 6px;
  background: #f0f0f0;
  border-radius: 3px;
  overflow: hidden;
}

.sc-progress-fill {
  height: 100%;
  background: #409eff;
  border-radius: 3px;
}

.sc-location {
  font-size: 12px;
  color: #999;
  margin-top: 10px;
}

.sc-punch-primary {
  width: 100%;
  margin-top: 12px;
  padding: 12px;
  border: none;
  border-radius: 24px;
  background: #409eff;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}

.sc-punch-secondary {
  width: 100%;
  margin-top: 12px;
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 24px;
  background: #fff;
  color: #666;
  font-size: 15px;
  cursor: pointer;
}

.sc-rest-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px;
  background: #fafafa;
  border-radius: 10px;
  color: #999;
  font-size: 14px;
}

.sc-link-btn {
  border: none;
  background: none;
  color: #409eff;
  font-size: 14px;
  margin-top: 10px;
  cursor: pointer;
}
</style>
