<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Calendar,
  CircleCheck,
  CircleClose,
  Clock,
  List,
  Sunny,
  Timer,
  FullScreen,
  WarningFilled,
} from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import { useMiniAppNow } from '@/composables/useMiniAppNow'
import {
  buildWeekPreview,
  calcWorkedMinutes,
  countAttendanceDays,
  formatHoursDecimal,
  resolvePunchStatus,
  resolveDayState,
  sumWorkedMinutesInRange,
} from '@/composables/useMiniSchedule'
import {
  freePunchDefaultMinutes,
  freePunchWindowLabel,
  getEmployeePunchModes,
  getFreePunchDepartmentOptions,
  isFreeClockInOnly,
  isNoPunchGroup,
  pickDefaultFreePunchDepartmentId,
  resolveAttendanceGroupByMode,
  type MiniPunchMode,
} from '@/composables/useMiniPunch'
import { sortedWorkflowNodes } from '@/services/task'
import type { TaskInstance } from '@/types'

const router = useRouter()
const store = useAppStore()
const { employeeId, employee } = useMiniAppWorker()
const { now } = useMiniAppNow()

const activeMainTab = ref<'schedule' | 'tasks'>('schedule')
const punchMode = ref<MiniPunchMode>('shift')

const punchModes = computed(() => getEmployeePunchModes(store, employeeId.value))
const showPunchModeTabs = computed(() => punchModes.value.hasShift && punchModes.value.hasFree)

watch(
  punchModes,
  (modes) => {
    if (!modes.defaultMode) return
    if (!modes.modes.includes(punchMode.value)) {
      punchMode.value = modes.defaultMode
    }
  },
  { immediate: true },
)

const activePunchMode = computed<MiniPunchMode | null>(() => {
  if (showPunchModeTabs.value) return punchMode.value
  return punchModes.value.defaultMode
})

const attendanceGroup = computed(() =>
  resolveAttendanceGroupByMode(store, employeeId.value, activePunchMode.value),
)
const isFreePunch = computed(() => activePunchMode.value === 'free')
const isNoPunch = computed(() => isNoPunchGroup(attendanceGroup.value))
const freeClockInOnly = computed(
  () => isFreePunch.value && isFreeClockInOnly(attendanceGroup.value),
)

const freeDeptOptions = computed(() =>
  isFreePunch.value
    ? getFreePunchDepartmentOptions(store, employeeId.value, attendanceGroup.value)
    : [],
)
const showFreeDeptSelect = computed(() => isFreePunch.value && freeDeptOptions.value.length > 1)
const freeDeptId = ref<string | null>(null)

watch(
  [freeDeptOptions, employeeId, isFreePunch],
  () => {
    if (!isFreePunch.value) {
      freeDeptId.value = null
      return
    }
    const opts = freeDeptOptions.value
    if (!opts.length) {
      freeDeptId.value = null
      return
    }
    if (freeDeptId.value && opts.some((o) => o.id === freeDeptId.value)) return
    freeDeptId.value = pickDefaultFreePunchDepartmentId(store, employeeId.value, opts)
  },
  { immediate: true },
)

const freeDeptLabel = computed(
  () => freeDeptOptions.value.find((o) => o.id === freeDeptId.value)?.name ?? '',
)

function localDateStr(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function getMonday(d: Date) {
  const day = d.getDay()
  const offset = day === 0 ? -6 : 1 - day
  const monday = new Date(d)
  monday.setDate(d.getDate() + offset)
  return monday
}

const today = computed(() => localDateStr(now.value))

const todayAssignment = computed(() => store.getAssignment(employeeId.value, today.value))
const todayShift = computed(() => {
  const asn = todayAssignment.value
  if (!asn) return null
  return store.shifts.find((s) => s.id === asn.shiftId) ?? null
})

const todayPunches = computed(() =>
  store.punches
    .filter((p) => p.employeeId === employeeId.value && p.date === today.value)
    .sort((a, b) => a.time.localeCompare(b.time)),
)

const hasClockIn = computed(() => todayPunches.value.some((p) => p.type === 'clock_in'))
const hasClockOut = computed(() => todayPunches.value.some((p) => p.type === 'clock_out'))

const hasScheduledWork = computed(
  () => Boolean(todayShift.value && todayShift.value.id !== 'shift_rest'),
)

/** 休息日：班次模式下无有效班次；自由打卡模式仍可打卡 */
const isRestToday = computed(() => {
  if (isFreePunch.value) return false
  if (isNoPunch.value) return true
  if (hasClockIn.value) return false
  return !hasScheduledWork.value
})

const clockInRecord = computed(() => todayPunches.value.find((p) => p.type === 'clock_in'))
const clockOutRecord = computed(() => todayPunches.value.find((p) => p.type === 'clock_out'))

const workedMinutes = computed(() =>
  calcWorkedMinutes(employeeId.value, today.value, store.punches, now.value),
)

const todayGoalMinutes = computed(() => {
  if (isFreePunch.value) {
    return freePunchDefaultMinutes(attendanceGroup.value)
  }
  if (!todayShift.value || todayShift.value.id === 'shift_rest') return 8 * 60
  const [sh, sm] = todayShift.value.startTime.split(':').map(Number)
  const [eh, em] = todayShift.value.endTime.split(':').map(Number)
  let total = eh * 60 + em - (sh * 60 + sm) - todayShift.value.breakMinutes
  if (total <= 0) total = 8 * 60
  return total
})

const todayProgressPercent = computed(() =>
  Math.min(100, Math.round((workedMinutes.value / todayGoalMinutes.value) * 100)),
)

const isNotPunched = computed(() => !isRestToday.value && !hasClockIn.value)
const punchFinished = computed(() =>
  freeClockInOnly.value ? hasClockIn.value : hasClockOut.value,
)

const punchStatus = computed(() =>
  resolvePunchStatus(todayShift.value, clockInRecord.value?.time, clockOutRecord.value?.time, {
    freePunch: isFreePunch.value,
    noPunch: isNoPunch.value || isRestToday.value,
  }),
)

const todayShiftState = computed(() =>
  resolveDayState(store, employeeId.value, today.value, today.value, now.value),
)

const freePunchTip = computed(() => freePunchWindowLabel(attendanceGroup.value))

const displayHours = computed(() =>
  hasClockIn.value ? formatHoursDecimal(workedMinutes.value) : '0.0 小时',
)

const monthRange = computed(() => {
  const y = now.value.getFullYear()
  const m = now.value.getMonth()
  const start = `${y}-${String(m + 1).padStart(2, '0')}-01`
  return { start, end: today.value }
})

const weekRange = computed(() => {
  const monday = getMonday(now.value)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const weekEnd = localDateStr(sunday)
  return { start: localDateStr(monday), end: weekEnd < today.value ? weekEnd : today.value }
})

const monthWorkedMinutes = computed(() =>
  sumWorkedMinutesInRange(
    employeeId.value,
    store.punches,
    monthRange.value.start,
    monthRange.value.end,
    now.value,
  ),
)

const weekWorkedMinutes = computed(() =>
  sumWorkedMinutesInRange(
    employeeId.value,
    store.punches,
    weekRange.value.start,
    weekRange.value.end,
    now.value,
  ),
)

const monthAttendanceDays = computed(() =>
  countAttendanceDays(
    employeeId.value,
    store.punches,
    monthRange.value.start,
    monthRange.value.end,
  ),
)

const weekPreview = computed(() => buildWeekPreview(store, employeeId.value, now.value))

function calcInstanceProgress(instance: TaskInstance) {
  const task = store.tasks.find((t) => t.id === instance.taskId)
  const wf = store.taskWorkflows.find((w) => w.id === task?.workflowId)
  if (!wf) return { progress: 0, stepIndex: 0, stepTotal: 0, isDone: false }
  const nodes = sortedWorkflowNodes(wf)
  const idx = nodes.findIndex((n) => n.id === instance.currentNodeId)
  const isDone = idx >= 0 && nodes[idx]?.nodeType === 'end'
  const stepTotal = nodes.length
  const progress =
    idx < 0 ? 0 : isDone ? 100 : Math.round((idx / Math.max(stepTotal - 1, 1)) * 100)
  return { progress, stepIndex: idx + 1, stepTotal, isDone }
}

const activeTasks = computed(() =>
  store.taskInstances
    .filter((i) => i.workerId === employeeId.value)
    .map((instance) => ({
      instance,
      ...calcInstanceProgress(instance),
    }))
    .filter((t) => !t.isDone)
    .slice(0, 8),
)

const avatarText = computed(() => employee.value?.name?.slice(0, 1) ?? '员')

function openSchedule(tab: 'schedule' | 'punch', date?: string) {
  router.push({
    path: '/miniapp/schedule',
    query: { tab, ...(date ? { date } : {}) },
  })
}

function goPunch() {
  const query: Record<string, string> = {}
  if (activePunchMode.value) query.mode = activePunchMode.value
  if (isFreePunch.value && freeDeptId.value) query.dept = freeDeptId.value
  router.push({
    path: '/miniapp/punch',
    query: Object.keys(query).length ? query : undefined,
  })
}

function handlePunchAction() {
  if (isRestToday.value || isNoPunch.value) {
    ElMessage.info('今日无需打卡')
    return
  }
  goPunch()
}

async function openScanJoin() {
  try {
    const { value } = await ElMessageBox.prompt(
      '演示：粘贴部门入驻二维码内容（JOIN|企业ID|部门ID）',
      '扫码入驻',
      {
        confirmButtonText: '下一步',
        cancelButtonText: '取消',
        inputPlaceholder: 'JOIN|ent_xxx|dept_xxx',
        inputValue: 'JOIN|ent_stars_telecom|dept_prod_a',
      },
    )
    const payload = String(value || '').trim()
    if (!payload) {
      ElMessage.warning('请填写二维码内容')
      return
    }
    router.push({ path: '/miniapp/join-apply', query: { qr: payload } })
  } catch {
    /* cancel */
  }
}
</script>

<template>
  <div class="wb-page" :class="{ 'has-task-footer': activeMainTab === 'tasks' }">
    <!-- 用户信息 -->
    <div class="wb-hero">
      <div class="wb-profile">
        <div class="wb-avatar">{{ avatarText }}</div>
        <div class="wb-profile-info">
          <div class="wb-name">{{ employee?.name ?? '—' }}</div>
        </div>
        <div class="wb-profile-actions">
          <button class="wb-todo-btn" type="button" aria-label="扫码入驻" @click="openScanJoin">
            <el-icon :size="18"><FullScreen /></el-icon>
          </button>
          <button class="wb-cal-btn" type="button" aria-label="班次日历" @click="openSchedule('schedule')">
            <el-icon :size="18"><Calendar /></el-icon>
          </button>
        </div>
      </div>

      <div class="wb-main-tabs">
        <button
          type="button"
          class="wb-main-tab"
          :class="{ active: activeMainTab === 'schedule' }"
          @click="activeMainTab = 'schedule'"
        >
          班次打卡
        </button>
        <button
          type="button"
          class="wb-main-tab"
          :class="{ active: activeMainTab === 'tasks' }"
          @click="activeMainTab = 'tasks'"
        >
          任务进度
          <span v-if="activeTasks.length" class="wb-tab-count">{{ activeTasks.length }}</span>
        </button>
      </div>
    </div>

    <template v-if="activeMainTab === 'schedule'">
      <!-- 今日打卡卡片 -->
      <div
        class="wb-punch-card"
        :class="{
          'not-punched': isNotPunched && !isFreePunch,
          'free-mode': isFreePunch,
          'free-pending': isFreePunch && isNotPunched,
        }"
      >
        <div
          v-if="showPunchModeTabs"
          class="wb-punch-mode-tabs"
          role="tablist"
        >
          <button
            type="button"
            class="wb-punch-mode-tab"
            :class="{ active: punchMode === 'shift' }"
            role="tab"
            @click="punchMode = 'shift'"
          >
            班次打卡
          </button>
          <button
            type="button"
            class="wb-punch-mode-tab"
            :class="{ active: punchMode === 'free' }"
            role="tab"
            @click="punchMode = 'free'"
          >
            自由打卡
          </button>
        </div>

        <div class="wb-punch-head">
          <div class="wb-punch-title">
            <span
              class="wb-dot"
              :class="{
                green: punchStatus.tone === 'ok',
                orange: punchStatus.tone === 'warn',
                grey: punchStatus.tone === 'muted',
              }"
            />
            <span>今日打卡</span>
            <span v-if="isFreePunch && !showPunchModeTabs" class="wb-mode-chip">自由打卡</span>
          </div>
          <span class="wb-punched-at" :class="punchStatus.tone">{{ punchStatus.text }}</span>
        </div>

        <div v-if="!isRestToday" class="wb-punch-body">
          <div v-if="!isFreePunch && isNotPunched && hasScheduledWork && todayShift" class="wb-shift-tip">
            今日 {{ todayShift.name }} · {{ todayShift.startTime.slice(0, 5) }}-{{ todayShift.endTime.slice(0, 5) }}
          </div>
          <div
            v-else-if="isFreePunch"
            class="wb-shift-tip free"
          >
            <div class="wb-free-tip-row">
              <span class="wb-free-tip-main">{{ freePunchTip }}</span>
              <label v-if="showFreeDeptSelect" class="wb-free-dept">
                <select v-model="freeDeptId" class="wb-free-dept-select" @click.stop>
                  <option
                    v-for="opt in freeDeptOptions"
                    :key="opt.id"
                    :value="opt.id"
                  >
                    {{ opt.name }}
                  </option>
                </select>
              </label>
              <span v-else-if="freeDeptLabel" class="wb-free-dept-fixed">{{ freeDeptLabel }}</span>
            </div>
            <span class="wb-free-tip-sub">无固定班次 · 按目标工时统计</span>
          </div>
          <div class="wb-punch-main">
            <div class="wb-hours" :class="{ empty: isNotPunched }">{{ displayHours }}</div>
            <div class="wb-punch-action">
              <span
                v-if="!isFreePunch && ['upcoming','normal','missing_punch','absent','late','early_leave'].includes(todayShiftState.state)"
                class="wb-shift-tag"
                :class="todayShiftState.state"
              >{{ todayShiftState.stateLabel }}</span>
              <span
                v-else-if="isFreePunch && isNotPunched"
                class="wb-shift-tag upcoming"
              >待签到</span>
              <button
                v-if="!punchFinished"
                class="wb-punch-primary"
                :class="{ highlight: isNotPunched && !isFreePunch, 'free-cta': isFreePunch }"
                type="button"
                @click="handlePunchAction"
              >
                {{ hasClockIn ? '签退' : '签到' }}
              </button>
              <div v-else class="wb-complete-tip">
                <el-icon :size="14"><CircleCheck /></el-icon>
                今日已完成
              </div>
            </div>
          </div>

          <div v-if="!isFreePunch" class="wb-progress-wrap">
            <div class="wb-progress-bar">
              <div
                class="wb-progress-fill"
                :style="{ width: `${todayProgressPercent}%` }"
              />
            </div>
            <div class="wb-progress-labels">
              <span>已工作 {{ formatHoursDecimal(workedMinutes) }}</span>
              <span>班次 {{ (todayGoalMinutes / 60).toFixed(1) }} 小时</span>
            </div>
          </div>
        </div>

        <div v-else class="wb-rest-body">
          <div class="wb-rest-msg">
            <el-icon :size="16" class="wb-rest-icon"><Sunny /></el-icon>
            {{ isNoPunch ? '今日无需打卡' : '今日无班次，无需打卡' }}
          </div>
          <button class="wb-rest-link" type="button" @click="router.push('/miniapp/recommend')">
            去抢额外班次 ›
          </button>
        </div>
      </div>

      <!-- 统计三列 -->
      <div class="wb-stats-row">
        <div class="wb-stat-card blue">
          <div class="wb-stat-icon">
            <el-icon :size="20"><Calendar /></el-icon>
          </div>
          <div class="wb-stat-title">本月出勤</div>
          <div class="wb-stat-value">{{ formatHoursDecimal(monthWorkedMinutes) }}</div>
        </div>
        <div class="wb-stat-card green">
          <div class="wb-stat-icon">
            <el-icon :size="20"><Timer /></el-icon>
          </div>
          <div class="wb-stat-title">本周出勤</div>
          <div class="wb-stat-value">{{ formatHoursDecimal(weekWorkedMinutes) }}</div>
        </div>
        <div class="wb-stat-card orange">
          <div class="wb-stat-icon">
            <el-icon :size="20"><CircleCheck /></el-icon>
          </div>
          <div class="wb-stat-title">出勤天数</div>
          <div class="wb-stat-value">{{ monthAttendanceDays }}天</div>
        </div>
      </div>

      <!-- 本周班次 -->
      <section class="wb-section">
        <div class="wb-section-head">
          <div class="wb-section-title-row">
            <span class="wb-icon wb-icon-purple">
              <el-icon :size="16"><Calendar /></el-icon>
            </span>
            <span class="wb-section-title">本周班次</span>
          </div>
          <button class="wb-view-all" type="button" @click="openSchedule('schedule')">
            班次日历 ›
          </button>
        </div>

        <div class="wb-week-scroll">
          <div
            v-for="day in weekPreview"
            :key="day.date"
            class="wb-day-card"
            :class="[day.state, { today: day.isToday }]"
            @click="openSchedule(day.date >= today ? 'schedule' : 'punch', day.date)"
          >
            <div class="wb-day-week">{{ day.weekday.replace('周', '') }}</div>
            <div class="wb-day-num">{{ day.dayNum }}</div>
            <div class="wb-day-shift">{{ day.shiftName }}</div>
            <div class="wb-day-time">{{ day.timeRange }}</div>
            <div class="wb-day-status" :class="day.state">
              <el-icon v-if="day.state === 'normal'" class="status-icon green"><CircleCheck /></el-icon>
              <el-icon v-else-if="day.state === 'absent'" class="status-icon red"><CircleClose /></el-icon>
              <el-icon
                v-else-if="day.state === 'missing_punch' || day.state === 'late' || day.state === 'early_leave'"
                class="status-icon orange"
              ><WarningFilled /></el-icon>
              <el-icon v-else-if="day.state === 'upcoming'" class="status-icon grey"><Clock /></el-icon>
              {{ day.stateLabel }}
            </div>
          </div>
        </div>
      </section>
    </template>

    <template v-else>
      <section class="wb-section wb-task-section">
        <div class="wb-section-head">
          <div class="wb-section-title-row">
            <span class="wb-icon wb-icon-green">
              <el-icon :size="16"><List /></el-icon>
            </span>
            <span class="wb-section-title">进行中任务</span>
          </div>
          <button class="wb-view-all" type="button" @click="router.push('/miniapp/tasks')">
            查看全部 ›
          </button>
        </div>

        <div v-if="activeTasks.length" class="wb-task-list">
          <div
            v-for="t in activeTasks"
            :key="t.instance.id"
            class="wb-task-card clickable"
            @click="router.push(`/miniapp/tasks/${t.instance.id}`)"
          >
            <div class="wb-task-head">
              <div class="wb-task-name">{{ t.instance.taskName }}</div>
              <span class="wb-task-node">{{ t.instance.currentNodeName }}</span>
            </div>
            <div class="wb-task-meta">
              <span>{{ t.instance.taskTypeName }}</span>
              <span class="wb-task-amount">¥{{ t.instance.amount }}</span>
            </div>
            <div class="wb-task-progress-wrap">
              <div class="wb-task-progress-bar">
                <div class="wb-task-progress-fill" :style="{ width: `${t.progress}%` }" />
              </div>
              <div class="wb-task-progress-labels">
                <span>节点 {{ t.stepIndex }}/{{ t.stepTotal }}</span>
                <span>{{ t.progress }}%</span>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="wb-empty-todo">暂无进行中的任务</div>
      </section>
    </template>

    <div v-if="activeMainTab === 'tasks'" class="wb-task-footer">
      <button class="wb-task-hall-btn" type="button" @click="router.push('/miniapp/task-hall')">
        去任务大厅领取
      </button>
    </div>
  </div>
</template>

<style scoped>
.wb-page {
  min-height: 100%;
  background: #f0f2f5;
  padding-bottom: 16px;
}

.wb-page.has-task-footer {
  padding-bottom: 88px;
}

.wb-hero {
  background: #fff;
  padding: 12px 16px 0;
  border-bottom: 1px solid #f5f5f5;
  position: sticky;
  top: 0;
  z-index: 20;
}

.wb-profile {
  display: flex;
  align-items: center;
  gap: 12px;
}

.wb-avatar {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4FD1C5, #81E6D9);
  border: 2px solid #E6FFFA;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}

.wb-profile-info {
  flex: 1;
  min-width: 0;
}

.wb-name {
  font-size: 18px;
  font-weight: 700;
  color: #1a1a1a;
}

.wb-profile-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.wb-todo-btn {
  position: relative;
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid #eee;
  background: #fafafa;
  color: #ef4444;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.wb-main-tabs {
  display: flex;
  gap: 0;
  margin-top: 14px;
  border-bottom: 1px solid #f0f0f0;
}

.wb-main-tab {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 12px 0;
  border: none;
  background: none;
  font-size: 15px;
  font-weight: 500;
  color: #999;
  cursor: pointer;
  position: relative;
}

.wb-main-tab.active {
  color: #4FD1C5;
  font-weight: 700;
}

.wb-main-tab.active::after {
  content: '';
  position: absolute;
  left: 20%;
  right: 20%;
  bottom: 0;
  height: 3px;
  background: #4FD1C5;
  border-radius: 3px 3px 0 0;
}

.wb-tab-count {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 10px;
  background: #E6FFFA;
  color: #4FD1C5;
  font-weight: 600;
}

.wb-cal-btn {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid #eee;
  background: #fafafa;
  color: #4FD1C5;
  cursor: pointer;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
}

.wb-punch-card {
  margin: 12px 14px;
  background: #fff;
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  position: relative;
  z-index: 1;
}

.wb-punch-mode-tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 6px;
  margin: -4px 0 14px;
  padding: 4px;
  background: #f5f7fa;
  border-radius: 12px;
}

.wb-punch-mode-tab {
  border: none;
  background: transparent;
  border-radius: 9px;
  padding: 8px 0;
  font-size: 13px;
  font-weight: 600;
  color: #909399;
  cursor: pointer;
}

.wb-punch-mode-tab.active {
  background: #fff;
  color: #303133;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
}

.wb-punch-card.not-punched {
  border: 1.5px solid #ffd591;
  box-shadow: 0 4px 20px rgba(250, 140, 22, 0.12);
}

.wb-punch-card.free-mode {
  border: 1.5px solid #d6eaff;
  box-shadow: 0 4px 20px rgba(64, 158, 255, 0.1);
}

.wb-punch-card.free-pending {
  border-color: #b3d8ff;
}

.wb-mode-chip {
  margin-left: 4px;
  padding: 1px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 600;
  color: #409EFF;
  background: #ECF5FF;
}

.wb-punch-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.wb-punch-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.wb-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.wb-dot.green { background: #52c41a; }
.wb-dot.orange { background: #fa8c16; }
.wb-dot.grey { background: #d9d9d9; }

.wb-punched-at {
  font-size: 12px;
  font-weight: 500;
}

.wb-punched-at.ok { color: #52c41a; }
.wb-punched-at.warn { color: #fa8c16; }
.wb-punched-at.muted { color: #999; }

.wb-shift-tip {
  font-size: 12px;
  color: #666;
  background: #fff7e6;
  padding: 8px 10px;
  border-radius: 8px;
  margin-bottom: 12px;
}

.wb-shift-tip.free {
  display: flex;
  flex-direction: column;
  gap: 4px;
  background: linear-gradient(135deg, #ECF5FF, #f5faff);
  color: #409EFF;
  border: 1px solid #d6eaff;
}

.wb-free-tip-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.wb-free-tip-main {
  font-weight: 600;
  flex: 1;
  min-width: 0;
}

.wb-free-tip-sub {
  font-size: 11px;
  color: #79bbff;
  font-weight: 400;
}

.wb-free-dept {
  flex-shrink: 0;
  max-width: 46%;
}

.wb-free-dept-select {
  width: 100%;
  max-width: 160px;
  border: 1px solid #b3d8ff;
  background: #fff;
  color: #409EFF;
  border-radius: 8px;
  padding: 4px 8px;
  font-size: 12px;
  font-weight: 600;
  outline: none;
  cursor: pointer;
}

.wb-free-dept-fixed {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 600;
  color: #79bbff;
}

.wb-punch-body { }

.wb-punch-main {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.wb-hours {
  font-size: 32px;
  font-weight: 800;
  color: #1a1a1a;
  line-height: 1.1;
  letter-spacing: -0.5px;
}

.wb-hours.empty {
  color: #ccc;
}

.wb-punch-action {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
}

.wb-shift-tag {
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 10px;
  font-weight: 500;
}

.wb-shift-tag.upcoming {
  background: #fff7e6;
  color: #fa8c16;
}

.wb-shift-tag.normal {
  background: #f6ffed;
  color: #52c41a;
}

.wb-shift-tag.late,
.wb-shift-tag.early_leave,
.wb-shift-tag.missing_punch {
  background: #fff7e6;
  color: #fa8c16;
}

.wb-shift-tag.absent {
  background: #fff1f0;
  color: #ff4d4f;
}

.wb-punch-primary {
  padding: 10px 20px;
  border: none;
  border-radius: 22px;
  background: #4FD1C5;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.wb-punch-primary.highlight {
  background: linear-gradient(135deg, #fa8c16, #ff9c2e);
  box-shadow: 0 4px 14px rgba(250, 140, 22, 0.35);
}

.wb-punch-primary.free-cta {
  background: linear-gradient(135deg, #409EFF, #66b1ff);
  box-shadow: 0 4px 14px rgba(64, 158, 255, 0.35);
}

.wb-complete-tip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #52c41a;
  font-weight: 600;
}

.wb-progress-wrap { }

.wb-progress-bar {
  height: 6px;
  background: #f0f0f0;
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 6px;
}

.wb-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #fa8c16, #ffbb33);
  border-radius: 3px;
  transition: width 0.4s ease;
}

.wb-progress-fill.free {
  background: linear-gradient(90deg, #409EFF, #79bbff);
}

.wb-progress-labels {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #999;
}

.wb-rest-body {
  text-align: center;
  padding: 8px 0;
}

.wb-rest-msg {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 15px;
  color: #666;
  margin-bottom: 10px;
}

.wb-rest-icon {
  color: #f59e0b;
}

.wb-rest-link {
  border: none;
  background: none;
  color: #4FD1C5;
  font-size: 14px;
  cursor: pointer;
}

.wb-stats-row {
  display: flex;
  gap: 8px;
  padding: 0 14px;
  margin-bottom: 12px;
}

.wb-stat-card {
  flex: 1;
  background: #fff;
  border-radius: 14px;
  padding: 12px 10px;
  text-align: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.wb-stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 4px;
}

.wb-stat-card.blue .wb-stat-icon { color: #4FD1C5; }
.wb-stat-card.green .wb-stat-icon { color: #52c41a; }
.wb-stat-card.orange .wb-stat-icon { color: #fa8c16; }

.wb-stat-title {
  font-size: 11px;
  color: #999;
  margin-bottom: 4px;
}

.wb-stat-value {
  font-size: 16px;
  font-weight: 800;
  margin-bottom: 2px;
  white-space: nowrap;
}

.wb-stat-card.blue .wb-stat-value,
.wb-stat-card.green .wb-stat-value,
.wb-stat-card.orange .wb-stat-value {
  margin-bottom: 0;
}

.wb-stat-card.blue .wb-stat-value { color: #4FD1C5; }
.wb-stat-card.green .wb-stat-value { color: #52c41a; }
.wb-stat-card.orange .wb-stat-value { color: #fa8c16; }

.wb-section {
  background: #fff;
  border-radius: 16px;
  padding: 14px;
  margin: 0 14px 12px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.wb-week-section {
  border: 2px dashed #d0e4ff;
  box-shadow: none;
}

.wb-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.wb-section-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.wb-icon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
}

.wb-icon-purple {
  background: #E6FFFA;
  color: #4FD1C5;
}

.wb-icon-red {
  background: #fff0f0;
  color: #ef4444;
}

.wb-icon-green {
  background: #e8f8ef;
  color: #22c55e;
}

.wb-badge {
  font-size: 11px;
  background: #ff4d4f;
  color: #fff;
  padding: 1px 7px;
  border-radius: 10px;
  font-weight: 600;
}

.wb-empty-todo {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  text-align: center;
  color: #ccc;
  font-size: 13px;
  padding: 16px 0;
}

.wb-task-list { display: flex; flex-direction: column; gap: 10px; }

.wb-task-card {
  background: #f8f9fb;
  border-radius: 12px;
  padding: 12px;
}

.wb-task-card.clickable {
  cursor: pointer;
}

.wb-task-section {
  margin-top: 12px;
}

.wb-task-footer {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: calc(56px + env(safe-area-inset-bottom, 0px));
  z-index: 40;
  width: 100%;
  max-width: 430px;
  padding: 12px 16px;
  background: #fff;
  box-shadow: 0 -4px 20px rgba(15, 23, 42, 0.08);
  box-sizing: border-box;
}

.wb-task-hall-btn {
  display: block;
  width: 100%;
  padding: 14px 0;
  border: none;
  border-radius: 999px;
  background: #4FD1C5;
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
}

.wb-task-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.wb-task-name {
  font-size: 14px;
  font-weight: 700;
  color: #1a1a1a;
  flex: 1;
}

.wb-task-node {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 8px;
  background: #E6FFFA;
  color: #4FD1C5;
  font-weight: 500;
  flex-shrink: 0;
}

.wb-task-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: #999;
  margin-bottom: 10px;
}

.wb-task-amount {
  color: #fa8c16;
  font-weight: 700;
}

.wb-task-progress-bar {
  height: 5px;
  background: #e8e8e8;
  border-radius: 3px;
  overflow: hidden;
  margin-bottom: 4px;
}

.wb-task-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #4FD1C5, #81E6D9);
  border-radius: 3px;
  transition: width 0.3s;
}

.wb-task-progress-labels {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #bbb;
}

.wb-section-title {
  font-size: 15px;
  font-weight: 700;
  color: #1a1a1a;
}

.wb-view-all {
  border: none;
  background: none;
  font-size: 13px;
  color: #4FD1C5;
  cursor: pointer;
}

.wb-week-scroll {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.wb-day-card {
  flex: 0 0 72px;
  border-radius: 14px;
  padding: 10px 6px;
  text-align: center;
  background: #fafafa;
  border: 2px solid transparent;
  cursor: pointer;
}

.wb-day-card.today {
  border-color: var(--mini-primary);
  background: var(--mini-primary-light);
}

.wb-day-card.normal { background: #f0faf4; }
.wb-day-card.absent { background: #fff5f5; }
.wb-day-card.upcoming { background: #fff7e6; }
.wb-day-card.late,
.wb-day-card.early_leave,
.wb-day-card.missing_punch { background: #fff7e6; }
.wb-day-card.rest,
.wb-day-card.leave { background: #f5f5f5; opacity: 0.85; }

.wb-day-week {
  font-size: 11px;
  color: #999;
}

.wb-day-num {
  font-size: 13px;
  font-weight: 700;
  color: #333;
  margin: 2px 0 6px;
}

.wb-day-shift {
  font-size: 12px;
  font-weight: 600;
  color: #333;
}

.wb-day-time {
  font-size: 10px;
  color: #999;
  margin: 2px 0 6px;
}

.wb-day-status {
  font-size: 10px;
  color: #666;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
}

.wb-day-status.normal { color: #52c41a; }
.wb-day-status.absent { color: #ff4d4f; }
.wb-day-status.upcoming { color: #fa8c16; }
.wb-day-status.late,
.wb-day-status.early_leave,
.wb-day-status.missing_punch { color: #fa8c16; }
.wb-day-status.rest,
.wb-day-status.leave { color: #999; }

.status-icon {
  font-size: 12px;
}

.status-icon.green { color: #52c41a; }
.status-icon.red { color: #ff4d4f; }
.status-icon.grey { color: #9ca3af; }
.status-icon.orange { color: #fa8c16; }

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-dot.blue {
  background: var(--mini-primary);
}
</style>
