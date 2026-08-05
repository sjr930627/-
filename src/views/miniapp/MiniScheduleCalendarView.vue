<script setup lang="ts">
import MiniNavBack from '@/components/miniapp/MiniNavBack.vue'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  CircleCheck,
  Clock,
  Cloudy,
  Location,
  Moon,
  Plus,
  Sunny,
} from '@element-plus/icons-vue'
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
import {
  approvalStatusLabel,
  approvalStatusTone,
} from '@/services/miniScheduleException'

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

function syncFromRoute() {
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

const isPastDay = computed(() => selectedDate.value < today.value)
const panelTitle = computed(() => (isPastDay.value ? '当天打卡' : '当天排班'))

const selectedDayDetail = computed(() =>
  buildDayDetail(store, employeeId.value, selectedDate.value, now.value),
)

const selectedDateMakeups = computed(() =>
  store.makeupRequests
    .filter((r) => r.employeeId === employeeId.value && r.date === selectedDate.value)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
)

const pendingExceptionCount = computed(
  () =>
    store.makeupRequests.filter(
      (r) => r.employeeId === employeeId.value && r.status === 'pending',
    ).length +
    store.cancelShiftRequests.filter(
      (r) => r.employeeId === employeeId.value && r.status === 'pending',
    ).length,
)

const canApplyMakeup = computed(() => {
  const detail = selectedDayDetail.value
  if (detail.state === 'rest') return false
  if (
    store.makeupRequests.some(
      (r) =>
        r.employeeId === employeeId.value &&
        r.date === selectedDate.value &&
        r.status === 'pending',
    )
  ) {
    return false
  }
  if (detail.state === 'absent') return true
  if (isPastDay.value && (!detail.clockIn || !detail.clockOut)) return true
  return false
})

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
  syncSelectedToViewMonth()
}

function nextMonth() {
  if (viewMonth.value === 12) {
    viewMonth.value = 1
    viewYear.value += 1
  } else viewMonth.value += 1
  syncSelectedToViewMonth()
}

function syncSelectedToViewMonth() {
  const prefix = `${viewYear.value}-${String(viewMonth.value).padStart(2, '0')}`
  if (selectedDate.value.startsWith(prefix)) return
  const fallback =
    today.value.startsWith(prefix) ? today.value : `${prefix}-01`
  selectDate(fallback, false)
}

function hasPendingCancel(date: string) {
  return store.cancelShiftRequests.some(
    (r) =>
      r.employeeId === employeeId.value &&
      r.date === date &&
      r.status === 'pending',
  )
}

async function applyCancelShift(detail: ReturnType<typeof buildDayDetail>) {
  try {
    const { value } = await ElMessageBox.prompt('请输入取消原因', '取消班次', {
      inputType: 'textarea',
      inputPlaceholder: '请说明无法出勤的原因，提交后等待企业审批',
      inputValidator: (v) => (v?.trim() ? true : '请填写取消原因'),
      confirmButtonText: '提交申请',
      cancelButtonText: '再想想',
    })
    const asn = store.getAssignment(employeeId.value, detail.date)
    if (!asn) {
      ElMessage.warning('该日期暂无排班')
      return
    }
    store.submitCancelShiftRequest({
      employeeId: employeeId.value,
      date: detail.date,
      shiftId: asn.shiftId,
      teamId: asn.teamId ?? '',
      reason: value.trim(),
      initiatedBy: 'employee',
    })
    ElMessage.success('取消班次申请已提交，请等待审批')
  } catch (e) {
    if (e instanceof Error && e.message.includes('已有待审批')) {
      ElMessage.warning(e.message)
    }
  }
}

function selectDate(date: string, updateRoute = true) {
  selectedDate.value = date
  if (!updateRoute) return
  router.replace({
    path: '/miniapp/schedule',
    query: {
      tab: date < today.value ? 'punch' : 'schedule',
      date,
    },
  })
}

function goPunch() {
  router.push('/miniapp/punch')
}

function goPunchHistory() {
  router.push({ path: '/miniapp/schedule/history', query: { date: selectedDate.value } })
}

function goExceptionRecords() {
  router.push('/miniapp/schedule/exceptions')
}

function goMakeupApply() {
  router.push({ path: '/miniapp/schedule/makeup/apply', query: { date: selectedDate.value } })
}

function goMakeupDetail(id: string) {
  router.push(`/miniapp/schedule/makeup/${id}`)
}

function progressPercent(detail: ReturnType<typeof buildDayDetail>) {
  const total = detail.workedMinutes + detail.remainingMinutes
  if (total <= 0) return 0
  return Math.round((detail.workedMinutes / total) * 100)
}

function formatDateHead(detail: ReturnType<typeof buildDayDetail>) {
  const [, month, day] = detail.date.split('-')
  const prefix =
    detail.date === today.value
      ? '今日'
      : detail.date > today.value
        ? detail.weekday
        : detail.weekday
  return `${prefix} · ${Number(month)}月${Number(day)}日 ${detail.weekday}`
}

function shiftIcon(shiftId?: string) {
  if (shiftId === 'shift_afternoon') return Cloudy
  if (shiftId === 'shift_night') return Moon
  return Sunny
}

function shiftIconTone(shiftId?: string) {
  if (shiftId === 'shift_afternoon') return 'mid'
  if (shiftId === 'shift_night') return 'night'
  return 'morning'
}
</script>

<template>
  <div class="sc-page">
    <div class="mini-nav-bar">
      <MiniNavBack fallback="/miniapp/workbench" />
      <div class="mini-nav-title">排班日历</div>
      <button class="sc-record-btn" type="button" @click="goExceptionRecords">
        异常申请记录
        <span v-if="pendingExceptionCount" class="sc-record-badge">{{ pendingExceptionCount }}</span>
      </button>
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

    <!-- 选中日期详情 -->
    <div class="sc-day-panel">
      <div class="sc-day-panel-head">
        <div class="sc-day-panel-left">
          <span class="sc-day-panel-title">{{ panelTitle }}</span>
          <span class="sc-day-panel-date">{{ formatDateHead(selectedDayDetail) }}</span>
        </div>
        <button type="button" class="sc-history-link" @click="goPunchHistory">历史打卡</button>
      </div>

      <div class="sc-shift-card selected">
        <div class="sc-shift-head">
          <span class="sc-shift-badge" :class="selectedDayDetail.state">{{ selectedDayDetail.stateLabel }}</span>
        </div>

        <template v-if="selectedDayDetail.state === 'rest'">
          <div class="sc-rest-box">
            <div class="sc-rest-icon">☺</div>
            <span>{{ isPastDay ? '当日休息，无打卡记录' : '今日休息，好好放松一下吧~' }}</span>
          </div>
          <button
            v-if="!isPastDay"
            class="sc-link-btn"
            type="button"
            @click="router.push('/miniapp/recommend?tab=shifts')"
          >
            <el-icon :size="14"><Plus /></el-icon>
            去抢额外班次
          </button>
        </template>

        <template v-else>
          <div v-if="isPastDay" class="sc-punch-summary">
            <div class="sc-punch-stat">
              <div class="sc-punch-stat-label">签到</div>
              <div class="sc-punch-stat-val" :class="{ muted: !selectedDayDetail.clockIn }">
                {{ selectedDayDetail.clockIn?.slice(0, 5) ?? '未打卡' }}
              </div>
            </div>
            <div class="sc-punch-stat">
              <div class="sc-punch-stat-label">签退</div>
              <div class="sc-punch-stat-val" :class="{ muted: !selectedDayDetail.clockOut }">
                {{ selectedDayDetail.clockOut?.slice(0, 5) ?? '未打卡' }}
              </div>
            </div>
            <div class="sc-punch-stat">
              <div class="sc-punch-stat-label">工时</div>
              <div class="sc-punch-stat-val highlight">
                {{ selectedDayDetail.workedMinutes > 0 ? formatDuration(selectedDayDetail.workedMinutes) : '—' }}
              </div>
            </div>
          </div>

          <div class="sc-shift-body">
            <div
              class="sc-shift-icon-box"
              :class="shiftIconTone(selectedDayDetail.shift?.id)"
            >
              <el-icon :size="20">
                <component :is="shiftIcon(selectedDayDetail.shift?.id)" />
              </el-icon>
            </div>
            <div class="sc-shift-left">
              <div class="sc-shift-title">
                {{ selectedDayDetail.shift?.name }} · {{ selectedDayDetail.teamName }}
              </div>
              <div class="sc-shift-time">
                {{ selectedDayDetail.shift?.startTime?.slice(0, 5) }} - {{ selectedDayDetail.shift?.endTime?.slice(0, 5) }}
                · {{ Math.round((selectedDayDetail.workedMinutes + selectedDayDetail.remainingMinutes) / 60) }}小时
              </div>
              <div v-if="!isPastDay" class="sc-shift-pay">
                ¥{{ selectedDayDetail.estimatedPay }}
                <small>¥{{ selectedDayDetail.hourlyRate }}/时</small>
              </div>
            </div>
          </div>

          <div v-if="!isPastDay && selectedDayDetail.clockIn" class="sc-punch-row ok">
            <el-icon :size="14"><CircleCheck /></el-icon>
            已签到 {{ selectedDayDetail.clockIn.slice(0, 5) }}
          </div>
          <div v-if="!isPastDay && selectedDayDetail.clockOut" class="sc-punch-row ok">
            <el-icon :size="14"><CircleCheck /></el-icon>
            已签退 {{ selectedDayDetail.clockOut.slice(0, 5) }}
          </div>

          <div
            v-if="selectedDayDetail.state === 'active' && selectedDayDetail.workedMinutes > 0"
            class="sc-progress-wrap"
          >
            <div class="sc-progress-labels">
              <span>已工作 {{ formatDuration(selectedDayDetail.workedMinutes) }}</span>
              <span>剩余 {{ formatDuration(selectedDayDetail.remainingMinutes) }}</span>
            </div>
            <div class="sc-progress-bar">
              <div class="sc-progress-fill" :style="{ width: `${progressPercent(selectedDayDetail)}%` }" />
            </div>
          </div>

          <div
            v-if="!isPastDay && !selectedDayDetail.clockOut && selectedDayDetail.clockIn"
            class="sc-punch-row pending"
          >
            <el-icon :size="14"><Clock /></el-icon>
            待签退 {{ selectedDayDetail.shift?.endTime?.slice(0, 5) ?? '--:--' }}
          </div>

          <div class="sc-location">
            <el-icon :size="13"><Location /></el-icon>
            {{ selectedDayDetail.location }}
          </div>

          <div v-if="selectedDateMakeups.length" class="sc-makeup-records">
            <button
              v-for="req in selectedDateMakeups"
              :key="req.id"
              type="button"
              class="sc-makeup-link"
              @click="goMakeupDetail(req.id)"
            >
              查看补卡记录 · {{ approvalStatusLabel(req.status) }}
              <span class="mini-tag small" :class="approvalStatusTone(req.status)">
                {{ req.status === 'approved' ? '正常' : approvalStatusLabel(req.status) }}
              </span>
            </button>
          </div>

          <button
            v-if="canApplyMakeup"
            class="sc-punch-secondary makeup"
            type="button"
            @click="goMakeupApply"
          >
            申请补卡
          </button>

          <button
            v-if="
              selectedDayDetail.date === today &&
              (selectedDayDetail.state === 'active' || selectedDayDetail.state === 'upcoming') &&
              !selectedDayDetail.clockOut
            "
            class="sc-punch-primary"
            type="button"
            @click="goPunch"
          >
            立即打卡
          </button>
          <button
            v-else-if="
              selectedDayDetail.date > today &&
              selectedDayDetail.state === 'upcoming' &&
              hasPendingCancel(selectedDayDetail.date)
            "
            class="sc-punch-secondary pending"
            type="button"
            disabled
          >
            取消申请审批中
          </button>
          <button
            v-else-if="selectedDayDetail.date > today && selectedDayDetail.state === 'upcoming'"
            class="sc-punch-secondary"
            type="button"
            @click="applyCancelShift(selectedDayDetail)"
          >
            取消排班
          </button>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.sc-page {
  background: var(--mini-bg, #f4f6f9);
  min-height: 100%;
  padding-bottom: 20px;
}

.sc-menu-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border: none;
  background: none;
  color: var(--mini-text, #333);
  cursor: pointer;
  border-radius: 8px;
}

.sc-record-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: none;
  font-size: 12px;
  color: #3b82f6;
  cursor: pointer;
  padding: 4px 0;
  white-space: nowrap;
}

.sc-record-badge {
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: #ef4444;
  color: #fff;
  font-size: 10px;
  line-height: 16px;
  text-align: center;
}

.mini-nav-title {
  margin-right: 0;
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

.sc-stat.orange .sc-stat-val { color: #f59e0b; }
.sc-stat.blue .sc-stat-val { color: #3b82f6; }
.sc-stat.green .sc-stat-val { color: #22c55e; }

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
  background: #eff6ff;
  border: 2px solid #3b82f6;
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

.sc-day-panel {
  margin: 0 14px;
}

.sc-day-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 4px 8px;
  gap: 10px;
}

.sc-day-panel-left {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.sc-history-link {
  border: none;
  background: none;
  font-size: 13px;
  color: #3b82f6;
  cursor: pointer;
  flex-shrink: 0;
  padding: 4px 0;
}

.sc-day-panel-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--mini-text, #1f2937);
}

.sc-day-panel-date {
  font-size: 12px;
  color: var(--mini-text-muted, #999);
}

.sc-punch-summary {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.sc-punch-stat {
  flex: 1;
  padding: 10px 8px;
  background: #f9fafb;
  border-radius: 10px;
  text-align: center;
}

.sc-punch-stat-label {
  font-size: 11px;
  color: #999;
  margin-bottom: 4px;
}

.sc-punch-stat-val {
  font-size: 15px;
  font-weight: 700;
  color: #333;
}

.sc-punch-stat-val.muted {
  color: #bbb;
  font-weight: 500;
}

.sc-punch-stat-val.highlight {
  color: #3b82f6;
}

.sc-shift-card {
  background: #fff;
  border-radius: 14px;
  padding: 14px;
  box-shadow: 0 1px 4px rgba(0,0,0,0.04);
}

.sc-shift-card.selected {
  border: 2px solid #3b82f6;
  box-shadow: 0 2px 12px rgba(59, 130, 246, 0.15);
}

.sc-shift-head {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  margin-bottom: 10px;
}

.sc-shift-badge {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 8px;
}

.sc-shift-badge.active { background: #eff6ff; color: #3b82f6; }
.sc-shift-badge.upcoming { background: #f0fdf4; color: #22c55e; }
.sc-shift-badge.done { background: #f0f0f0; color: #999; }
.sc-shift-badge.rest { background: #f5f5f5; color: #bbb; }
.sc-shift-badge.absent { background: #fff1f0; color: #ff4d4f; }

.sc-shift-body {
  display: flex;
  gap: 12px;
  align-items: flex-start;
}

.sc-shift-icon-box {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.sc-shift-icon-box.morning {
  background: #eff6ff;
  color: #3b82f6;
}

.sc-shift-icon-box.mid {
  background: #fff7ed;
  color: #f59e0b;
}

.sc-shift-icon-box.night {
  background: #faf5ff;
  color: #a855f7;
}

.sc-shift-left {
  flex: 1;
  min-width: 0;
}

.sc-shift-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--mini-text, #1f2937);
}

.sc-shift-time {
  font-size: 13px;
  color: #666;
  margin-top: 4px;
}

.sc-shift-pay {
  font-size: 24px;
  font-weight: 800;
  color: #f59e0b;
  margin-top: 8px;
}

.sc-shift-pay small {
  font-size: 12px;
  color: #999;
  font-weight: 400;
  margin-left: 6px;
}

.sc-punch-row {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  margin-top: 10px;
  padding: 8px 10px;
  border-radius: 8px;
}

.sc-punch-row.ok { background: #f0fdf4; color: #22c55e; }
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
  background: #3b82f6;
  border-radius: 3px;
}

.sc-location {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: var(--mini-text-muted, #999);
  margin-top: 10px;
}

.sc-punch-primary {
  width: 100%;
  margin-top: 12px;
  padding: 12px;
  border: none;
  border-radius: 24px;
  background: #3b82f6;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.25);
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

.sc-punch-secondary.pending {
  color: #999;
  background: #f5f5f5;
  border-color: #eee;
  cursor: not-allowed;
}

.sc-punch-secondary.makeup {
  color: #ea580c;
  border-color: #fed7aa;
  background: #fff7ed;
}

.sc-makeup-records {
  margin-top: 10px;
}

.sc-makeup-link {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #dbeafe;
  border-radius: 10px;
  background: #eff6ff;
  color: #3b82f6;
  font-size: 13px;
  cursor: pointer;
  margin-bottom: 8px;
}

.mini-tag.small {
  font-size: 10px;
  padding: 1px 6px;
}

.mini-tag.orange { background: #fff7ed; color: #ea580c; }
.mini-tag.green { background: #f0fdf4; color: #16a34a; }
.mini-tag.red { background: #fef2f2; color: #ef4444; }

.sc-rest-box {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px;
  background: #f9fafb;
  border-radius: 12px;
  color: var(--mini-text-muted, #999);
  font-size: 14px;
}

.sc-rest-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  color: #9ca3af;
}

.sc-link-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: 1px solid #dbeafe;
  background: #eff6ff;
  color: #3b82f6;
  font-size: 13px;
  margin-top: 10px;
  padding: 8px 14px;
  border-radius: 999px;
  cursor: pointer;
}
</style>
