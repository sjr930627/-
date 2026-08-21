<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { Component } from 'vue'
import {
  AlarmClock,
  ArrowRight,
  Bell,
  Calendar,
  ChatDotRound,
  CircleCheck,
  CircleClose,
  Clock,
  Document,
  List,
  Medal,
  Reading,
  Select,
  Sunny,
  Tickets,
  Timer,
  Wallet,
  FullScreen,
} from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import { useMiniAppNow } from '@/composables/useMiniAppNow'
import {
  buildWeekPreview,
  calcWorkedMinutes,
  countConsecutivePunchDays,
  formatHoursDecimal,
  formatHoursShort,
  sumWorkedMinutesInRange,
} from '@/composables/useMiniSchedule'
import { countPendingScheduleConfirms } from '@/constants/miniapp'
import { sortedWorkflowNodes } from '@/services/task'
import { resolveCourseAssignees } from '@/services/training'
import type { TaskInstance } from '@/types'

const router = useRouter()
const store = useAppStore()
const { employeeId, employee, profileExt } = useMiniAppWorker()
const { now } = useMiniAppNow()

const activeMainTab = ref<'schedule' | 'tasks'>('schedule')
const todoDrawerVisible = ref(false)

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

const isRestToday = computed(() => {
  if (hasClockIn.value) return false
  return !todayShift.value || todayShift.value.id === 'shift_rest'
})
const clockInRecord = computed(() => todayPunches.value.find((p) => p.type === 'clock_in'))
const clockOutRecord = computed(() => todayPunches.value.find((p) => p.type === 'clock_out'))

const workedMinutes = computed(() =>
  calcWorkedMinutes(employeeId.value, today.value, store.punches, now.value),
)

const todayGoalMinutes = computed(() => {
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

const estimatedClockOut = computed(() => {
  if (hasClockOut.value && clockOutRecord.value) return clockOutRecord.value.time.slice(0, 5)
  if (todayShift.value && todayShift.value.id !== 'shift_rest') {
    return todayShift.value.endTime.slice(0, 5)
  }
  return '17:00'
})

const isOnline = computed(() => hasClockIn.value && !hasClockOut.value)
const isNotPunched = computed(() => !isRestToday.value && !hasClockIn.value)

const punchStatusText = computed(() => {
  if (isRestToday.value) return '休息日'
  if (hasClockOut.value) return '已签退'
  if (hasClockIn.value) return `已打卡 · ${clockInRecord.value?.time.slice(0, 5)}`
  return '未打卡'
})

const punchStatusClass = computed(() => {
  if (isRestToday.value) return 'muted'
  if (hasClockOut.value) return 'done'
  if (hasClockIn.value) return 'ok'
  return 'warn'
})

const displayHours = computed(() =>
  hasClockIn.value ? formatHoursDecimal(workedMinutes.value) : '0.0 小时',
)

const monthRange = computed(() => {
  const y = now.value.getFullYear()
  const m = now.value.getMonth()
  const start = `${y}-${String(m + 1).padStart(2, '0')}-01`
  const lastDay = new Date(y, m + 1, 0).getDate()
  const end = `${y}-${String(m + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  return { start, end }
})

const weekRange = computed(() => {
  const monday = getMonday(now.value)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  return { start: localDateStr(monday), end: localDateStr(sunday) }
})

const monthOnlineMinutes = computed(() =>
  sumWorkedMinutesInRange(
    employeeId.value,
    store.punches,
    monthRange.value.start,
    monthRange.value.end,
    now.value,
  ),
)

const weekOnlineMinutes = computed(() =>
  sumWorkedMinutesInRange(
    employeeId.value,
    store.punches,
    weekRange.value.start,
    weekRange.value.end,
    now.value,
  ),
)

const consecutiveDays = computed(() =>
  countConsecutivePunchDays(employeeId.value, store.punches, today.value),
)

const weekPreview = computed(() => buildWeekPreview(store, employeeId.value, now.value))

interface TodoItem {
  id: string
  icon: Component
  title: string
  desc: string
  tone: 'red' | 'orange' | 'blue'
  path: string
}

const todoItems = computed((): TodoItem[] => {
  const items: TodoItem[] = []
  const eid = employeeId.value
  const punchedIn = store.punches.some(
    (p) => p.employeeId === eid && p.date === today.value && p.type === 'clock_in',
  )
  const asn = store.getAssignment(eid, today.value)
  const shift = asn ? store.shifts.find((s) => s.id === asn.shiftId) : null
  const restToday = !shift || shift.id === 'shift_rest'
  if (!restToday && !punchedIn) {
    items.push({
      id: 'punch',
      icon: AlarmClock,
      title: '今日尚未打卡',
      desc: shift ? `${shift.name} ${shift.startTime.slice(0, 5)} 开始，请尽快签到` : '请完成今日签到',
      tone: 'orange',
      path: '/miniapp/punch',
    })
  }

  const unread = store.miniAppMessages.filter((m) => m.employeeId === eid && !m.read).length
  if (unread > 0) {
    items.push({
      id: 'msg',
      icon: ChatDotRound,
      title: `${unread} 条未读消息`,
      desc: '查看收入、排班与系统通知',
      tone: 'red',
      path: '/miniapp/messages',
    })
  }

  const pendingShifts = countPendingScheduleConfirms(store.miniAppMessages, eid)
  if (pendingShifts > 0) {
    items.push({
      id: 'shift',
      icon: Select,
      title: `${pendingShifts} 个班次待确认`,
      desc: '前往排班通知，点击「去确认」查看详情',
      tone: 'orange',
      path: '/miniapp/messages?tab=schedule',
    })
  }

  const claimable = store.workerIncomeRecords.filter(
    (r) => r.employeeId === eid && r.status === 'claimable',
  )
  if (claimable.length > 0) {
    const total = claimable.reduce((s, r) => s + r.amount, 0)
    items.push({
      id: 'income',
      icon: Wallet,
      title: `${claimable.length} 笔收入待领取`,
      desc: `合计 ¥${total.toLocaleString()}，点击领取`,
      tone: 'orange',
      path: '/miniapp/income',
    })
  }

  const unsigned = store.workerAgreements.filter(
    (a) => a.employeeId === eid && a.required && !a.signed,
  )
  if (unsigned.length > 0) {
    items.push({
      id: 'agreement',
      icon: Document,
      title: `${unsigned.length} 份协议待签署`,
      desc: unsigned[0]?.title ?? '完成签署后继续接单',
      tone: 'red',
      path: '/miniapp/agreements',
    })
  }

  const interview = store.miniJobApplications.find(
    (a) => a.employeeId === eid && a.status === 'interview',
  )
  if (interview) {
    const job = store.jobRequirements.find((j) => j.id === interview.jobRequirementId)
    items.push({
      id: 'interview',
      icon: Tickets,
      title: '岗位面试待参加',
      desc: job?.title ?? '查看应聘进度',
      tone: 'blue',
      path: '/miniapp/applications',
    })
  }

  const assignedCourses = store.trainingCourses.filter((c) => c.status === 'published')
  for (const course of assignedCourses) {
    const assigned = resolveCourseAssignees(course, store.employees, store.departments).some(
      (e) => e.id === eid,
    )
    if (!assigned) continue
    const rec = store.courseLearningRecords.find(
      (r) => r.courseId === course.id && r.employeeId === eid,
    )
    if (rec?.status === 'completed') continue
    items.push({
      id: `course_${course.id}`,
      icon: Reading,
      title: '培训课程未完成',
      desc: course.name,
      tone: 'blue',
      path: '/miniapp/training',
    })
    break
  }

  return items
})

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

const todoCount = computed(() => todoItems.value.length)

const avatarText = computed(() => employee.value?.name?.slice(0, 1) ?? '员')

function openSchedule(tab: 'schedule' | 'punch', date?: string) {
  router.push({
    path: '/miniapp/schedule',
    query: { tab, ...(date ? { date } : {}) },
  })
}

function goPunch() {
  router.push('/miniapp/punch')
}

function handlePunchAction() {
  if (isRestToday.value) {
    ElMessage.info('今日休息，无需打卡')
    return
  }
  goPunch()
}

function openTodo(path: string) {
  todoDrawerVisible.value = false
  router.push(path)
}

async function openScanJoin() {
  try {
    const { value } = await ElMessageBox.prompt(
      '演示：粘贴部门入驻二维码内容（JOIN|企业ID|部门ID），或选择下方常用部门后确认',
      '扫码入驻',
      {
        confirmButtonText: '申请入驻',
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
    store.applyJoinDepartmentByQr(payload, {
      name: employee.value?.name || '灵工申请人',
      phone: employee.value?.phone,
      employeeId: employeeId.value,
    })
    ElMessage.success('已提交入驻申请，请等待企业审批')
  } catch {
    /* cancel */
  }
}
</script>

<template>
  <div class="wb-page">
    <!-- 用户信息 -->
    <div class="wb-hero">
      <div class="wb-profile">
        <div class="wb-avatar">{{ avatarText }}</div>
        <div class="wb-profile-info">
          <div class="wb-name">{{ employee?.name ?? '—' }}</div>
          <div class="wb-meta">
            <span>人员ID {{ employee?.employeeNo ?? '—' }}</span>
            <span v-if="profileExt?.level" class="wb-level-badge">{{ profileExt.level }}</span>
          </div>
        </div>
        <div class="wb-profile-actions">
          <button class="wb-todo-btn" type="button" aria-label="扫码入驻" @click="openScanJoin">
            <el-icon :size="18"><FullScreen /></el-icon>
          </button>
          <button class="wb-todo-btn" type="button" aria-label="待办事项" @click="todoDrawerVisible = true">
            <el-icon :size="18"><Bell /></el-icon>
            <span v-if="todoCount" class="wb-todo-badge">{{ todoCount > 9 ? '9+' : todoCount }}</span>
          </button>
          <button class="wb-cal-btn" type="button" @click="openSchedule('schedule')">
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
          打卡排班
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
      <div class="wb-punch-card" :class="{ 'not-punched': isNotPunched }">
        <div class="wb-punch-head">
          <div class="wb-punch-title">
            <span
              class="wb-dot"
              :class="{ green: hasClockIn, orange: isNotPunched, grey: isRestToday }"
            />
            <span>今日打卡</span>
          </div>
          <span class="wb-punched-at" :class="punchStatusClass">{{ punchStatusText }}</span>
        </div>

        <div v-if="!isRestToday" class="wb-punch-body">
          <div v-if="isNotPunched && todayShift" class="wb-shift-tip">
            今日 {{ todayShift.name }} · {{ todayShift.startTime.slice(0, 5) }}-{{ todayShift.endTime.slice(0, 5) }}
          </div>
          <div class="wb-punch-main">
            <div class="wb-hours" :class="{ empty: isNotPunched }">{{ displayHours }}</div>
            <div class="wb-punch-action">
              <span v-if="isOnline" class="wb-online-tag">在线中</span>
              <span v-else-if="isNotPunched" class="wb-online-tag pending">待上岗</span>
              <span v-else-if="hasClockOut" class="wb-online-tag done">已下线</span>
              <button
                v-if="!hasClockOut"
                class="wb-punch-primary"
                :class="{ highlight: isNotPunched }"
                type="button"
                @click="handlePunchAction"
              >
                {{ hasClockIn ? '下线打卡' : '上线打卡' }}
              </button>
              <div v-else class="wb-complete-tip">
                <el-icon :size="14"><CircleCheck /></el-icon>
                今日已完成
              </div>
            </div>
          </div>

          <div class="wb-progress-wrap">
            <div class="wb-progress-bar">
              <div
                class="wb-progress-fill"
                :class="{ idle: isNotPunched }"
                :style="{ width: `${todayProgressPercent}%` }"
              />
            </div>
            <div class="wb-progress-labels">
              <span>今日目标 {{ (todayGoalMinutes / 60).toFixed(0) }} 小时</span>
              <span v-if="isNotPunched">计划上班 {{ todayShift?.startTime?.slice(0, 5) ?? '08:00' }}</span>
              <span v-else>预计下线 {{ estimatedClockOut }}</span>
            </div>
          </div>
        </div>

        <div v-else class="wb-rest-body">
          <div class="wb-rest-msg">
            <el-icon :size="16" class="wb-rest-icon"><Sunny /></el-icon>
            今日休息，无需打卡
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
          <div class="wb-stat-title">本月在线</div>
          <div class="wb-stat-value">{{ formatHoursShort(monthOnlineMinutes) }}</div>
          <div class="wb-stat-goal">目标 120h</div>
          <div class="wb-stat-bar">
            <div
              class="wb-stat-bar-fill"
              :style="{ width: `${Math.min(100, Math.round((monthOnlineMinutes / 60 / 120) * 100))}%` }"
            />
          </div>
        </div>
        <div class="wb-stat-card green">
          <div class="wb-stat-icon">
            <el-icon :size="20"><Timer /></el-icon>
          </div>
          <div class="wb-stat-title">本周在线</div>
          <div class="wb-stat-value">{{ formatHoursShort(weekOnlineMinutes) }}</div>
          <div class="wb-stat-goal">目标 30h</div>
          <div class="wb-stat-bar">
            <div
              class="wb-stat-bar-fill"
              :style="{ width: `${Math.min(100, Math.round((weekOnlineMinutes / 60 / 30) * 100))}%` }"
            />
          </div>
        </div>
        <div class="wb-stat-card orange">
          <div class="wb-stat-icon">
            <el-icon :size="20"><Medal /></el-icon>
          </div>
          <div class="wb-stat-title">连续打卡</div>
          <div class="wb-stat-value">{{ consecutiveDays }} 天</div>
          <div class="wb-stat-goal">目标 20 天</div>
          <div class="wb-stat-bar">
            <div
              class="wb-stat-bar-fill"
              :style="{ width: `${Math.min(100, Math.round((consecutiveDays / 20) * 100))}%` }"
            />
          </div>
        </div>
      </div>

      <!-- 本周排班预览 -->
      <section class="wb-section">
        <div class="wb-section-head">
          <div class="wb-section-title-row">
            <span class="wb-icon wb-icon-purple">
              <el-icon :size="16"><Calendar /></el-icon>
            </span>
            <span class="wb-section-title">本周排班预览</span>
          </div>
          <button class="wb-view-all" type="button" @click="openSchedule('schedule')">
            完整排班 ›
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
            <div class="wb-day-status">
              <el-icon v-if="day.state === 'done'" class="status-icon green"><CircleCheck /></el-icon>
              <el-icon v-else-if="day.state === 'absent'" class="status-icon red"><CircleClose /></el-icon>
              <span v-else-if="day.state === 'active'" class="status-dot blue" />
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
        <button class="wb-task-hall-link" type="button" @click="router.push('/miniapp/task-hall')">
          去任务大厅领取 ›
        </button>
      </section>
    </template>

    <el-drawer
      v-model="todoDrawerVisible"
      title="待办事项"
      direction="btt"
      size="auto"
      class="wb-todo-drawer"
    >
      <div v-if="todoItems.length" class="wb-todo-list">
        <div
          v-for="item in todoItems"
          :key="item.id"
          class="wb-todo-banner"
          :class="item.tone"
          @click="openTodo(item.path)"
        >
          <span class="wb-todo-icon" :class="item.tone">
            <el-icon :size="18"><component :is="item.icon" /></el-icon>
          </span>
          <div class="wb-todo-text">
            <div class="wb-todo-title">{{ item.title }}</div>
            <div class="wb-todo-desc">{{ item.desc }}</div>
          </div>
          <span class="wb-chevron">
            <el-icon :size="16"><ArrowRight /></el-icon>
          </span>
        </div>
      </div>
      <div v-else class="wb-empty-todo">
        <el-icon :size="14" class="empty-check"><CircleCheck /></el-icon>
        暂无待办，一切顺利
      </div>
    </el-drawer>
  </div>
</template>

<style scoped>
.wb-page {
  min-height: 100%;
  background: #f0f2f5;
  padding-bottom: 16px;
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
  background: linear-gradient(135deg, #3b82f6, #60a5fa);
  border: 2px solid #eff6ff;
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
  margin-bottom: 4px;
}

.wb-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #999;
}

.wb-level-badge {
  background: #eff6ff;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
  color: #3b82f6;
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

.wb-todo-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: #ef4444;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  line-height: 16px;
  text-align: center;
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
  color: #3b82f6;
  font-weight: 700;
}

.wb-main-tab.active::after {
  content: '';
  position: absolute;
  left: 20%;
  right: 20%;
  bottom: 0;
  height: 3px;
  background: #3b82f6;
  border-radius: 3px 3px 0 0;
}

.wb-tab-count {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 10px;
  background: #eff6ff;
  color: #3b82f6;
  font-weight: 600;
}

.wb-cal-btn {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  border: 1px solid #eee;
  background: #fafafa;
  color: #3b82f6;
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

.wb-punch-card.not-punched {
  border: 1.5px solid #ffd591;
  box-shadow: 0 4px 20px rgba(250, 140, 22, 0.12);
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
.wb-punched-at.done { color: #999; }
.wb-punched-at.muted { color: #999; }

.wb-shift-tip {
  font-size: 12px;
  color: #666;
  background: #fff7e6;
  padding: 8px 10px;
  border-radius: 8px;
  margin-bottom: 12px;
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

.wb-online-tag {
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 10px;
  background: #e8f4ff;
  color: #3b82f6;
  font-weight: 500;
}

.wb-online-tag.done {
  background: #f0f0f0;
  color: #999;
}

.wb-online-tag.pending {
  background: #fff7e6;
  color: #fa8c16;
}

.wb-punch-primary {
  padding: 10px 20px;
  border: none;
  border-radius: 22px;
  background: #3b82f6;
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

.wb-progress-fill.idle {
  background: #f0f0f0;
  width: 0 !important;
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
  color: #3b82f6;
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

.wb-stat-card.blue .wb-stat-icon { color: #3b82f6; }
.wb-stat-card.green .wb-stat-icon { color: #52c41a; }
.wb-stat-card.orange .wb-stat-icon { color: #fa8c16; }

.wb-stat-title {
  font-size: 11px;
  color: #999;
  margin-bottom: 4px;
}

.wb-stat-value {
  font-size: 18px;
  font-weight: 800;
  margin-bottom: 2px;
}

.wb-stat-card.blue .wb-stat-value { color: #3b82f6; }
.wb-stat-card.green .wb-stat-value { color: #52c41a; }
.wb-stat-card.orange .wb-stat-value { color: #fa8c16; }

.wb-stat-goal {
  font-size: 10px;
  color: #bbb;
  margin-bottom: 6px;
}

.wb-stat-bar {
  height: 3px;
  background: #f0f0f0;
  border-radius: 2px;
  overflow: hidden;
}

.wb-stat-bar-fill {
  height: 100%;
  border-radius: 2px;
  transition: width 0.3s;
}

.wb-stat-card.blue .wb-stat-bar-fill { background: #3b82f6; }
.wb-stat-card.green .wb-stat-bar-fill { background: #52c41a; }
.wb-stat-card.orange .wb-stat-bar-fill { background: #fa8c16; }

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
  background: #eff6ff;
  color: #3b82f6;
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

.wb-todo-list { }

.wb-todo-banner {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px;
  border-radius: 12px;
  margin-bottom: 8px;
  cursor: pointer;
}

.wb-todo-banner:last-child { margin-bottom: 0; }
.wb-todo-banner.red { background: #fff5f5; }
.wb-todo-banner.orange { background: #fff7e6; }
.wb-todo-banner.blue { background: #f0f7ff; }

.wb-todo-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.wb-todo-icon.red {
  background: #fee2e2;
  color: #ef4444;
}

.wb-todo-icon.orange {
  background: #ffedd5;
  color: #f97316;
}

.wb-todo-icon.blue {
  background: #dbeafe;
  color: #3b82f6;
}

.wb-todo-text { flex: 1; min-width: 0; }

.wb-todo-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 2px;
}

.wb-todo-banner.red .wb-todo-title { color: #cf1322; }
.wb-todo-banner.orange .wb-todo-title { color: #d46b08; }
.wb-todo-banner.blue .wb-todo-title { color: #0958d9; }

.wb-todo-desc {
  font-size: 12px;
  color: #999;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.wb-chevron {
  display: flex;
  align-items: center;
  color: #d1d5db;
  flex-shrink: 0;
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

.empty-check {
  color: #22c55e;
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

.wb-task-hall-link {
  display: block;
  width: 100%;
  margin-top: 12px;
  padding: 12px;
  border: 1px dashed #dbeafe;
  border-radius: 12px;
  background: #f8fbff;
  color: #3b82f6;
  font-size: 14px;
  font-weight: 600;
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
  background: #e8f4ff;
  color: #3b82f6;
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
  background: linear-gradient(90deg, #3b82f6, #60a5fa);
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
  color: #3b82f6;
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
  border-color: #409eff;
  background: #f0f7ff;
}

.wb-day-card.done { background: #f0faf4; }
.wb-day-card.absent { background: #fff5f5; }
.wb-day-card.upcoming { background: #f5f9ff; }
.wb-day-card.rest { background: #f5f5f5; opacity: 0.85; }

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

.status-icon {
  font-size: 12px;
}

.status-icon.green { color: #52c41a; }
.status-icon.red { color: #ff4d4f; }
.status-icon.grey { color: #9ca3af; }

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-dot.blue {
  background: #409eff;
}

:deep(.wb-todo-drawer .el-drawer__body) {
  padding: 0 16px 24px;
  max-height: 70vh;
  overflow-y: auto;
}
</style>
