<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { usePortal } from '@/composables/usePortal'
import StatKpiCard from '@/components/statistics/StatKpiCard.vue'
import StatPanel from '@/components/statistics/StatPanel.vue'
import VChart from '@/components/statistics/VChart.vue'
import { WORKBENCH_DEMO_NOW } from '@/constants/workbenchReminder'
import { formatMoney } from '@/constants/payrollBill'
import { valueLineChartOption } from '@/services/statisticsCharts'
import { chartColors } from '@/plugins/echarts'
import {
  buildDashboardAlerts,
  countActiveEmployees,
  countHiresInRange,
  countPendingApprovals,
  countResignsInRange,
  formatMomPercent,
  formatResignMom,
  listOpenExceptionsOnDay,
  resolveDashboardWindow,
  sumPendingPaymentAmount,
  windowDates,
  type DashboardPeriod,
} from '@/services/businessDashboard'
import { resolveEnterpriseIdByEmployee } from '@/utils/enterpriseScope'

const store = useAppStore()
const router = useRouter()
const { pathPrefix, isEnterprise } = usePortal()

const period = ref<DashboardPeriod>('month')

const nowDay = computed(() => {
  const d = WORKBENCH_DEMO_NOW
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
})

const window = computed(() => resolveDashboardWindow(period.value, WORKBENCH_DEMO_NOW))

const enterpriseIds = computed(() => {
  if (!isEnterprise.value) return undefined as string[] | undefined
  const id = store.currentEnterpriseId
  return id ? [id] : undefined
})

function employeeInScope(employeeId: string) {
  const ids = enterpriseIds.value
  if (!ids?.length) return true
  const emp = store.employees.find((e) => e.id === employeeId)
  return emp ? ids.includes(resolveEnterpriseIdByEmployee(emp)) : false
}

const scopedEmployees = computed(() => {
  const ids = enterpriseIds.value
  if (!ids?.length) return store.employees
  return store.employees.filter((e) => ids.includes(resolveEnterpriseIdByEmployee(e)))
})

const scopedBills = computed(() => {
  const ids = enterpriseIds.value
  if (!ids?.length) return store.settlementBills
  return store.settlementBills.filter((b) => ids.includes(b.enterpriseId))
})

const scopedExceptions = computed(() =>
  store.exceptions.filter((e) => employeeInScope(e.employeeId)),
)

const scopedJoins = computed(() => {
  const ids = enterpriseIds.value
  if (!ids?.length) return store.workerJoinApplications
  return store.workerJoinApplications.filter((a) => ids.includes(a.enterpriseId))
})

const scopedMakeup = computed(() =>
  store.makeupRequests.filter((r) => employeeInScope(r.employeeId)),
)

const scopedGrab = computed(() => {
  const ids = enterpriseIds.value
  if (!ids?.length) return store.grabShiftApplications
  return store.grabShiftApplications.filter((a) => {
    const emp = store.employees.find((e) => e.id === a.employeeId)
    return emp ? ids.includes(resolveEnterpriseIdByEmployee(emp)) : true
  })
})

const scopedTasks = computed(() => {
  const ids = enterpriseIds.value
  if (!ids?.length) return store.tasks
  return store.tasks.filter((t) => ids.includes(t.enterpriseId))
})

const activeTotal = computed(() => countActiveEmployees(scopedEmployees.value))

const hireCount = computed(() =>
  countHiresInRange(scopedEmployees.value, window.value.start, window.value.end),
)
const hirePrev = computed(() =>
  countHiresInRange(scopedEmployees.value, window.value.prevStart, window.value.prevEnd),
)
const hireMom = computed(() => formatMomPercent(hireCount.value, hirePrev.value))

const resignCount = computed(() =>
  countResignsInRange(scopedEmployees.value, window.value.start, window.value.end),
)
const resignPrev = computed(() =>
  countResignsInRange(scopedEmployees.value, window.value.prevStart, window.value.prevEnd),
)
const resignMom = computed(() => formatResignMom(resignCount.value, resignPrev.value))

const pending = computed(() =>
  countPendingApprovals({
    makeupRequests: scopedMakeup.value,
    grabApplications: scopedGrab.value,
    tasks: scopedTasks.value,
    joinApplications: scopedJoins.value,
    leavePending: store.leaveRequests.filter(
      (r) => r.status === 'pending' && employeeInScope(r.employeeId),
    ).length,
    overtimePending: store.overtimeRequests.filter(
      (r) => r.status === 'pending' && employeeInScope(r.employeeId),
    ).length,
    swapPending: store.swapRequests.filter(
      (r) =>
        r.status === 'pending' &&
        (employeeInScope(r.applicantId) || employeeInScope(r.targetEmployeeId)),
    ).length,
  }),
)

const pendingPayAmount = computed(() => sumPendingPaymentAmount(scopedBills.value))

const todayExceptions = computed(() =>
  listOpenExceptionsOnDay(scopedExceptions.value, nowDay.value),
)

const latestExceptionSummary = computed(() => {
  const list = todayExceptions.value
  if (!list.length) return '—'
  const ex = [...list].sort((a, b) => b.date.localeCompare(a.date))[0]
  const emp = store.employees.find((e) => e.id === ex.employeeId)
  const name = emp?.name ?? '未知员工'
  const dept = store.departments.find((d) => d.id === emp?.departmentId)?.name ?? '—'
  const overtime = ex.message.includes('超') || ex.type === 'absent'
  return {
    text: `${name} · ${dept} · ${ex.message} · ${ex.date}`,
    overtime,
  }
})

const alerts = computed(() =>
  buildDashboardAlerts({
    exceptions: scopedExceptions.value,
    bills: scopedBills.value,
    joinApplications: scopedJoins.value,
    makeupRequests: scopedMakeup.value,
    pathPrefix: pathPrefix.value,
    nowDay: nowDay.value,
  }),
)

const trendOption = computed(() => {
  const dates = windowDates(window.value)
  const labels = dates.map((d) => d.slice(5))
  const hires: number[] = []
  const resigns: number[] = []
  const exceptions: number[] = []
  for (const day of dates) {
    hires.push(countHiresInRange(scopedEmployees.value, day, day))
    resigns.push(countResignsInRange(scopedEmployees.value, day, day))
    exceptions.push(
      scopedExceptions.value.filter((e) => e.date === day && (e.status === 'open' || e.status === 'appealed'))
        .length,
    )
  }
  return valueLineChartOption(
    labels,
    [
      { name: '入职', data: hires, color: chartColors.green },
      { name: '离职', data: resigns, color: chartColors.orange, dashed: true },
      { name: '考勤异常', data: exceptions, color: chartColors.red },
    ],
    '人',
  )
})

function displayValue(n: number) {
  return n === 0 ? '—' : n
}

function go(path: string, query?: Record<string, string>) {
  router.push({ path: `${pathPrefix.value}${path}`, query })
}

function onAlert(path: string) {
  router.push(path)
}
</script>

<template>
  <div class="stats-page">
    <div class="stats-header">
      <div>
        <h2 class="page-title">经营看板</h2>
        <p class="text-muted">
          平台经营核心指标 · {{ window.label }}（{{ window.start }} ~ {{ window.end }}）
        </p>
      </div>
      <el-radio-group v-model="period" size="default">
        <el-radio-button value="month">本月</el-radio-button>
        <el-radio-button value="30d">近30天</el-radio-button>
      </el-radio-group>
    </div>

    <div v-if="alerts.length" class="alert-bar">
      <div v-for="item in alerts" :key="item.id" class="alert-item" :class="item.level">
        <div class="alert-main">
          <el-tag
            size="small"
            :type="item.level === 'urgent' ? 'danger' : item.level === 'important' ? 'warning' : 'info'"
          >
            {{ item.level === 'urgent' ? '紧急' : item.level === 'important' ? '重要' : '一般' }}
          </el-tag>
          <span class="alert-title">{{ item.title }}</span>
          <span class="alert-detail">{{ item.detail }}</span>
        </div>
        <el-button type="primary" link @click="onAlert(item.path)">去处理</el-button>
      </div>
    </div>

    <el-row :gutter="16" class="kpi-row">
      <el-col :xs="24" :sm="12" :md="8" :lg="4">
        <StatKpiCard
          label="在职员工总数"
          :value="activeTotal"
          icon="User"
          color="blue"
          clickable
          @click="go('/employees', { status: 'active' })"
        />
      </el-col>
      <el-col :xs="24" :sm="12" :md="8" :lg="4">
        <StatKpiCard
          :label="`${window.label}入职`"
          :value="displayValue(hireCount)"
          icon="Plus"
          color="green"
          :trend="hireMom ? `${hireMom.text} 环比` : undefined"
          :trend-up="hireMom?.up"
          :trend-positive="hireMom?.positive"
          clickable
          @click="go('/employees', { status: 'active' })"
        />
      </el-col>
      <el-col :xs="24" :sm="12" :md="8" :lg="4">
        <StatKpiCard
          :label="`${window.label}离职`"
          :value="displayValue(resignCount)"
          icon="Minus"
          color="orange"
          :trend="resignMom ? `${resignMom.text} 环比` : undefined"
          :trend-up="resignMom?.up"
          :trend-positive="resignMom?.positive"
          clickable
          @click="go('/employees', { status: 'resigned' })"
        />
      </el-col>
      <el-col :xs="24" :sm="12" :md="8" :lg="4">
        <StatKpiCard
          label="待审批"
          :value="pending.total"
          icon="Stamp"
          color="purple"
          :sub-text="pending.urgent > 0 ? `⚠ ${pending.urgent} 项紧急` : undefined"
          clickable
          @click="go('/approvals')"
        />
      </el-col>
      <el-col :xs="24" :sm="12" :md="8" :lg="4">
        <StatKpiCard
          label="结算待付金额"
          :value="formatMoney(pendingPayAmount)"
          icon="Wallet"
          color="cyan"
          clickable
          @click="go('/statistics/settlement/enterprise', { status: 'pending_payment' })"
        />
      </el-col>
      <el-col :xs="24" :sm="12" :md="8" :lg="4">
        <StatKpiCard
          label="考勤异常数"
          :value="todayExceptions.length"
          icon="Warning"
          color="red"
          :sub-text="typeof latestExceptionSummary === 'string' ? latestExceptionSummary : latestExceptionSummary.text"
          clickable
          @click="go('/attendance-exceptions')"
        >
          <div
            v-if="typeof latestExceptionSummary !== 'string' && latestExceptionSummary.overtime"
            class="overtime-flag"
          >
            超工时待复核
          </div>
        </StatKpiCard>
      </el-col>
    </el-row>

    <StatPanel :title="`经营趋势（${window.label}）`">
      <VChart :option="trendOption" height="320px" />
    </StatPanel>
  </div>
</template>

<style scoped>
.stats-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stats-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 12px;
  background: #fff;
  border-radius: 12px;
  padding: 20px 24px;
  border: 1px solid var(--app-border);
}

.alert-bar {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.alert-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  background: #fff;
  border: 1px solid var(--app-border);
  border-radius: 10px;
  padding: 10px 16px;
}

.alert-item.urgent {
  border-color: #f5c2c0;
  background: #fff7f6;
}

.alert-item.important {
  border-color: #f5dab1;
  background: #fffbf2;
}

.alert-main {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  min-width: 0;
}

.alert-title {
  font-weight: 600;
  color: #303133;
}

.alert-detail {
  color: #909399;
  font-size: 13px;
}

.kpi-row .el-col {
  margin-bottom: 16px;
}

.overtime-flag {
  margin-top: 6px;
  font-size: 12px;
  color: #f5222d;
  font-weight: 600;
}
</style>
