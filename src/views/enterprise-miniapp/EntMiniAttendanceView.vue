<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  ArrowDown,
  ChatDotRound,
  Document,
  Notebook,
  Setting,
  Stamp,
  Timer,
  User,
} from '@element-plus/icons-vue'
import EntMiniPageHeader from '@/components/enterprise-miniapp/EntMiniPageHeader.vue'
import {
  isEnterpriseRootDepartment,
  isLeafDepartment,
  isUnassignedDepartment,
} from '@/constants/department'
import { useAppStore } from '@/stores/app'
import { useEnterpriseMiniAuth } from '@/composables/useEnterpriseMiniAuth'
import {
  buildDailyAttendanceList,
  canConfirmWorkHours,
  isDailyAttendanceVisible,
} from '@/services/attendance'
import { getDepartmentDescendantIds, getDepartmentPath } from '@/utils'

const router = useRouter()
const store = useAppStore()
const { enterpriseId } = useEnterpriseMiniAuth()

const DEPT_STORAGE_PREFIX = 'ent-mini-attendance-dept:'

const enterpriseName = computed(
  () => store.enterprises.find((e) => e.id === enterpriseId.value)?.name || '本企业',
)

const departments = computed(() => store.getDepartmentsByEnterprise(enterpriseId.value))

const departmentOptions = computed(() =>
  departments.value
    .filter(
      (d) =>
        !isUnassignedDepartment(d.id) &&
        !isEnterpriseRootDepartment(d) &&
        isLeafDepartment(d),
    )
    .map((d) => ({
      id: d.id,
      label: getDepartmentPath(departments.value, d.id),
    }))
    .sort((a, b) => a.label.localeCompare(b.label, 'zh-CN')),
)

const selectedDeptId = ref('')
const deptPickerOpen = ref(false)

watch(
  [enterpriseId, departmentOptions],
  () => {
    const options = departmentOptions.value
    if (!options.length) {
      selectedDeptId.value = ''
      return
    }
    const saved = localStorage.getItem(`${DEPT_STORAGE_PREFIX}${enterpriseId.value}`)
    if (saved && options.some((d) => d.id === saved)) {
      selectedDeptId.value = saved
      return
    }
    if (!options.some((d) => d.id === selectedDeptId.value)) {
      selectedDeptId.value = options[0].id
    }
  },
  { immediate: true },
)

watch(selectedDeptId, (id) => {
  if (!id || !enterpriseId.value) return
  localStorage.setItem(`${DEPT_STORAGE_PREFIX}${enterpriseId.value}`, id)
})

const selectedDeptLabel = computed(() => {
  if (!selectedDeptId.value) return '未配置部门'
  return (
    departmentOptions.value.find((d) => d.id === selectedDeptId.value)?.label ||
    getDepartmentPath(departments.value, selectedDeptId.value)
  )
})

const storeTitle = computed(() =>
  selectedDeptId.value
    ? `${enterpriseName.value} - ${selectedDeptLabel.value}`
    : enterpriseName.value,
)

const scopedDeptIds = computed(() => {
  if (!selectedDeptId.value) return new Set<string>()
  return getDepartmentDescendantIds(departments.value, selectedDeptId.value)
})

const employees = computed(() =>
  store.employees.filter(
    (e) =>
      e.status === 'active' &&
      e.enterpriseId === enterpriseId.value &&
      (!selectedDeptId.value || (e.departmentId && scopedDeptIds.value.has(e.departmentId))),
  ),
)

const today = '2026-07-27'

const todayAllAssignments = computed(() =>
  store.assignments.filter(
    (a) => a.date === today && employees.value.some((e) => e.id === a.employeeId),
  ),
)

const todayAssignments = computed(() =>
  todayAllAssignments.value.filter((a) => a.shiftId !== 'shift_rest'),
)

const todayPresentCount = computed(() => {
  const empIds = new Set(employees.value.map((e) => e.id))
  return new Set(
    store.punches
      .filter((p) => p.date === today && empIds.has(p.employeeId))
      .map((p) => p.employeeId),
  ).size
})

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

const pendingMakeup = computed(
  () =>
    store.makeupRequests.filter(
      (r) => r.status === 'pending' && employees.value.some((e) => e.id === r.employeeId),
    ).length,
)

const pendingCancelShift = computed(
  () =>
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

function selectDepartment(id: string) {
  selectedDeptId.value = id
  deptPickerOpen.value = false
}

function goTodaySchedule() {
  router.push({
    path: '/enterprise-miniapp/today-schedule',
    query: selectedDeptId.value ? { dept: selectedDeptId.value } : undefined,
  })
}

const tools = computed(() => [
  {
    title: '考勤审批',
    icon: Stamp,
    path: '/enterprise-miniapp/exceptions',
    badge: pendingMakeup.value + pendingCancelShift.value,
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
    title: '考勤组配置',
    icon: Setting,
    path: '/enterprise-miniapp/attendance-groups',
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
    icon: User,
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
        <button
          type="button"
          class="store"
          :disabled="!departmentOptions.length"
          @click="deptPickerOpen = true"
        >
          <span class="store-text">{{ storeTitle }}</span>
          <el-icon v-if="departmentOptions.length" :size="14" class="store-arrow">
            <ArrowDown />
          </el-icon>
        </button>
        <div class="stats">
          <button type="button" class="stat-btn" @click="goTodaySchedule">
            <strong>{{ todayAssignments.length }}</strong>
            <span>今日班次</span>
          </button>
          <button type="button" class="stat-btn" @click="goTodaySchedule">
            <strong>{{ todayPresentCount }}</strong>
            <span>今日出勤</span>
          </button>
          <div class="warn">
            <strong>{{ todayExceptions.length }}</strong>
            <span>出勤异常</span>
          </div>
        </div>
        <div class="avatars">
          <span v-for="(n, i) in avatarNames" :key="i" class="av">{{ n }}</span>
          <button type="button" class="view-link" @click="goTodaySchedule">
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
            title="考勤组配置"
            @click="router.push('/enterprise-miniapp/attendance-groups')"
          >
            <el-icon :size="18"><Setting /></el-icon>
          </button>
          <button
            type="button"
            class="icon-btn count"
            title="人员管理"
            @click="router.push('/enterprise-miniapp/personnel')"
          >
            <el-icon :size="18"><User /></el-icon>
            <span>{{ employees.length }}</span>
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

    <div v-if="deptPickerOpen" class="sheet-mask" @click.self="deptPickerOpen = false">
      <div class="sheet">
        <div class="sheet-head">
          <h3>切换部门</h3>
          <button type="button" class="close" @click="deptPickerOpen = false">×</button>
        </div>
        <p class="sheet-sub">{{ enterpriseName }}</p>
        <button
          v-for="d in departmentOptions"
          :key="d.id"
          type="button"
          class="dept-option"
          :class="{ active: d.id === selectedDeptId }"
          @click="selectDepartment(d.id)"
        >
          <span>{{ d.label }}</span>
          <em v-if="d.id === selectedDeptId">当前</em>
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  min-height: 100%;
  background: #fff;
}
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
  display: flex;
  align-items: center;
  gap: 4px;
  max-width: 100%;
  border: none;
  background: none;
  padding: 0;
  text-align: left;
  cursor: pointer;
}
.store:disabled {
  cursor: default;
}
.store-text {
  font-size: 15px;
  font-weight: 700;
  color: #111827;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.store-arrow {
  flex-shrink: 0;
  color: #9ca3af;
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
  color: #228BFF;
}
.stats strong {
  display: block;
  font-size: 22px;
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
  background: #EBF4FF;
  color: #228BFF;
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
  border: 1px solid #228BFF;
  background: #fff;
  color: #228BFF;
  border-radius: 999px;
  font-size: 14px;
  font-weight: 600;
}
.icon-btn {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  border: 1px solid #e5e7eb;
  background: #fff;
  color: #374151;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1px;
  line-height: 1;
}
.icon-btn.count span {
  font-size: 10px;
  font-weight: 700;
  color: #228BFF;
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
  background: #228BFF;
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
  border-radius: 12px;
  background: #fff;
  border: 1.5px solid #e5e7eb;
  color: #228BFF;
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
.sheet-mask {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.sheet {
  width: 100%;
  max-width: 430px;
  max-height: 70vh;
  overflow: auto;
  background: #fff;
  border-radius: 16px 16px 0 0;
  padding: 16px 16px calc(16px + env(safe-area-inset-bottom, 0px));
  box-sizing: border-box;
}
.sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.sheet-head h3 {
  margin: 0;
  font-size: 16px;
  color: #111827;
}
.close {
  border: none;
  background: none;
  font-size: 22px;
  color: #9ca3af;
  line-height: 1;
}
.sheet-sub {
  margin: 6px 0 12px;
  font-size: 12px;
  color: #6b7280;
}
.dept-option {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  border: 1px solid #e5e7eb;
  background: #fff;
  border-radius: 12px;
  padding: 12px 14px;
  margin-bottom: 8px;
  text-align: left;
  font-size: 14px;
  color: #111827;
}
.dept-option.active {
  border-color: #228BFF;
  background: #EBF4FF;
  color: #228BFF;
  font-weight: 600;
}
.dept-option em {
  flex-shrink: 0;
  font-style: normal;
  font-size: 12px;
  color: #228BFF;
}
</style>
