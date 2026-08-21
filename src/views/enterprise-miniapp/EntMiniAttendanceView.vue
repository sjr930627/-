<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  ChatDotRound,
  DataBoard,
  Document,
  Notebook,
  Stamp,
  Timer,
  User,
  UserFilled,
} from '@element-plus/icons-vue'
import EntMiniPageHeader from '@/components/enterprise-miniapp/EntMiniPageHeader.vue'
import { useAppStore } from '@/stores/app'
import { useEnterpriseMiniAuth } from '@/composables/useEnterpriseMiniAuth'
import {
  buildDailyAttendanceList,
  canConfirmWorkHours,
  isDailyAttendanceVisible,
} from '@/services/attendance'

const router = useRouter()
const store = useAppStore()
const { enterpriseId } = useEnterpriseMiniAuth()

const enterpriseName = computed(
  () => store.enterprises.find((e) => e.id === enterpriseId.value)?.name || '本企业',
)

const employees = computed(() =>
  store.employees.filter((e) => e.status === 'active' && e.enterpriseId === enterpriseId.value),
)

const today = '2026-07-27'

const todayAssignments = computed(() =>
  store.assignments.filter(
    (a) =>
      a.date === today &&
      employees.value.some((e) => e.id === a.employeeId) &&
      a.shiftId !== 'shift_rest',
  ),
)

const todayExceptions = computed(() =>
  store.exceptions.filter(
    (e) =>
      e.date === today &&
      (e.status === 'open' || e.status === 'appealed') &&
      employees.value.some((x) => x.id === e.employeeId),
  ),
)

const pendingHours = computed(() => {
  const empIds = employees.value.map((e) => e.id)
  if (!empIds.length) return 0
  return buildDailyAttendanceList(
    empIds,
    [today],
    store.assignments,
    store.shifts,
    store.punches,
    store.leaveRequests,
    store.attendanceRule,
    store.manualOverrides,
  ).filter((d) => isDailyAttendanceVisible(d) && canConfirmWorkHours(d)).length
})

const pendingApprovals = computed(
  () =>
    store.makeupRequests.filter(
      (r) => r.status === 'pending' && employees.value.some((e) => e.id === r.employeeId),
    ).length +
    store.cancelShiftRequests.filter(
      (r) => r.status === 'pending' && employees.value.some((e) => e.id === r.employeeId),
    ).length,
)

const grabPending = computed(() =>
  store.grabShiftApplications.filter((a) => {
    if (a.status !== 'pending') return false
    const slot = store.grabShiftSlots.find((s) => s.id === a.slotId)
    if (!slot) return false
    const emp = store.employees.find((e) => e.id === a.employeeId)
    return emp?.enterpriseId === enterpriseId.value
  }).length,
)

const onboardPending = computed(
  () =>
    store
      .getEmployeesByEnterprise(enterpriseId.value)
      .filter((e) => e.status === 'pending' && e.onboardingStage === 'applied').length,
)

const avatarNames = computed(() => employees.value.slice(0, 6).map((e) => e.name.slice(0, 1)))

const tools = computed(() => [
  {
    title: '审批',
    icon: Stamp,
    path: '/enterprise-miniapp/exceptions',
    badge: pendingApprovals.value,
  },
  {
    title: '工时确认记录',
    icon: Document,
    path: '/enterprise-miniapp/hours',
  },
  {
    title: '划线排班',
    icon: Notebook,
    path: '/enterprise-miniapp/schedule',
  },
  {
    title: '需求总览',
    icon: DataBoard,
    path: '/enterprise-miniapp/shift-demand',
  },
  {
    title: '抢班面试配置',
    icon: ChatDotRound,
    path: '/enterprise-miniapp/grab-interview',
  },
  {
    title: '抢班管理',
    icon: Timer,
    path: '/enterprise-miniapp/grab-manage',
    badge: grabPending.value,
  },
  {
    title: '人员管理',
    icon: User,
    path: '/enterprise-miniapp/personnel',
  },
  {
    title: '入驻管理',
    icon: UserFilled,
    path: '/enterprise-miniapp/onboard',
    badge: onboardPending.value,
  },
])
</script>

<template>
  <div class="page">
    <EntMiniPageHeader title="出勤" />

    <div class="body">
      <section class="hero-card">
        <div class="store">{{ enterpriseName }}</div>
        <div class="stats">
          <button type="button" class="stat-btn" @click="router.push('/enterprise-miniapp/today-schedule')">
            <strong>{{ todayAssignments.length }}</strong>
            <span>今日班次</span>
          </button>
          <div>
            <strong>{{ Math.max(todayAssignments.length - todayExceptions.length, 0) }}</strong>
            <span>今日出勤</span>
          </div>
          <div class="warn">
            <strong>{{ todayExceptions.length }}</strong>
            <span>出勤异常</span>
          </div>
        </div>
        <div class="avatars">
          <span v-for="(n, i) in avatarNames" :key="i" class="av">{{ n }}</span>
          <button type="button" class="view-link" @click="router.push('/enterprise-miniapp/punch-records')">
            查看出勤 ›
          </button>
        </div>
        <div class="actions">
          <button type="button" class="assign" @click="router.push('/enterprise-miniapp/schedule')">
            去划线排班
          </button>
          <button
            type="button"
            class="icon-btn"
            title="班次需求"
            @click="router.push('/enterprise-miniapp/shift-demand')"
          >
            ▣
          </button>
          <button
            type="button"
            class="icon-btn count"
            title="人员管理"
            @click="router.push('/enterprise-miniapp/personnel')"
          >
            {{ employees.length }}
          </button>
        </div>
      </section>

      <section v-if="pendingHours > 0" class="pending">
        <div>
          <strong>待确认工时</strong>
          <p>{{ pendingHours }} 个班次待确认工时</p>
        </div>
        <button type="button" @click="router.push('/enterprise-miniapp/hours-confirm')">去确认</button>
      </section>

      <section class="grid">
        <button
          v-for="t in tools"
          :key="t.title"
          type="button"
          class="tool"
          @click="router.push(t.path)"
        >
          <span class="icon-wrap">
            <el-icon :size="22"><component :is="t.icon" /></el-icon>
            <i v-if="t.badge" class="badge">{{ t.badge > 99 ? '99+' : t.badge }}</i>
          </span>
          <span>{{ t.title }}</span>
        </button>
      </section>
    </div>
  </div>
</template>

<style scoped>
.body {
  padding: 12px;
}
.hero-card {
  background: #fff;
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 2px 12px rgba(15, 23, 42, 0.05);
}
.store {
  font-size: 15px;
  font-weight: 700;
  color: #111827;
}
.stats {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  margin-top: 14px;
  text-align: center;
}
.stat-btn {
  border: none;
  background: none;
  padding: 0;
  cursor: pointer;
}
.stat-btn:active strong {
  color: #5b4fdb;
}
.stats strong {
  display: block;
  font-size: 26px;
  color: #111827;
  line-height: 1.1;
}
.stats span {
  font-size: 12px;
  color: #9ca3af;
}
.stats .warn strong {
  color: #ef4444;
}
.avatars {
  display: flex;
  align-items: center;
  margin-top: 14px;
  gap: 0;
}
.av {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #ede9fe;
  color: #5b4fdb;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  margin-right: -6px;
  border: 2px solid #fff;
}
.view-link {
  margin-left: auto;
  border: none;
  background: none;
  color: #9ca3af;
  font-size: 12px;
}
.actions {
  display: flex;
  gap: 8px;
  margin-top: 14px;
  align-items: center;
}
.assign {
  flex: 1;
  height: 40px;
  border: 1px solid #5b4fdb;
  background: #fff;
  color: #5b4fdb;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 600;
}
.icon-btn {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  background: #fafafa;
  color: #6b7280;
  font-size: 14px;
}
.icon-btn.count {
  font-size: 12px;
  font-weight: 700;
  color: #5b4fdb;
}
.pending {
  margin-top: 10px;
  background: #fff8e8;
  border-radius: 12px;
  padding: 12px 14px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.pending strong {
  font-size: 13px;
  color: #92400e;
}
.pending p {
  margin: 4px 0 0;
  font-size: 12px;
  color: #b45309;
}
.pending button {
  border: none;
  background: #5b4fdb;
  color: #fff;
  border-radius: 999px;
  height: 32px;
  padding: 0 14px;
  font-size: 13px;
  flex-shrink: 0;
}
.grid {
  margin-top: 14px;
  background: #fff;
  border-radius: 14px;
  padding: 16px 8px 8px;
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px 4px;
}
.tool {
  border: none;
  background: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  color: #374151;
  padding: 4px;
}
.icon-wrap {
  width: 44px;
  height: 44px;
  border-radius: 14px;
  background: #eef2ff;
  color: #5b4fdb;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}
.badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 16px;
  height: 16px;
  border-radius: 999px;
  background: #ef4444;
  color: #fff;
  font-size: 10px;
  font-style: normal;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
}
</style>
