<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAppStore } from '@/stores/app'
import StatKpiCard from '@/components/statistics/StatKpiCard.vue'
import StatPanel from '@/components/statistics/StatPanel.vue'
import VChart from '@/components/statistics/VChart.vue'
import RankList from '@/components/statistics/RankList.vue'
import {
  buildDailyAttendanceList,
  buildMonthlySummary,
  getMonthDateRange,
} from '@/services/attendance'
import {
  buildDepartmentAnalytics,
  buildMonthlyTrends,
  formatDepartmentLabel,
  getRecentMonths,
} from '@/services/analytics'
import { buildPayrollPreview } from '@/services/payroll'
import { barChartOption, lineChartOption, trendText } from '@/services/statisticsCharts'
import { chartColors } from '@/plugins/echarts'
import { formatMoney } from '@/constants/payrollBill'

const store = useAppStore()
const dateRange = ref<[string, string]>(['2026-07-01', '2026-07-31'])
const month = ref('2026-07')
const deptKeyword = ref('')

const dailyList = computed(() =>
  buildDailyAttendanceList(
    store.activeEmployees.map((e) => e.id),
    getMonthDateRange(month.value),
    store.assignments,
    store.shifts,
    store.punches,
    store.leaveRequests,
    store.attendanceRule,
    store.manualOverrides,
  ),
)

const summaries = computed(() =>
  store.activeEmployees.map((emp) =>
    buildMonthlySummary(emp.id, month.value, dailyList.value.filter((d) => d.employeeId === emp.id)),
  ),
)

const payrollItems = computed(() =>
  buildPayrollPreview(
    store.activeEmployees,
    summaries.value,
    dailyList.value,
    store.overtimeRequests,
    store.payrollConfig,
    store.teams,
    store.assignments,
    month.value,
  ),
)

const deptStats = computed(() =>
  buildDepartmentAnalytics(
    store.departments,
    store.employees,
    dailyList.value,
    payrollItems.value,
    month.value,
  ).map((d) => {
    const seed = d.departmentId.charCodeAt(d.departmentId.length - 1)
    return {
      ...d,
      departmentName: formatDepartmentLabel(store.departments, d.departmentId),
      abnormalRate: Math.round((d.lateRate + d.absentRate) * 10) / 10,
      taskRate: 82 + (seed % 15),
      momChange: ((seed % 7) - 3).toFixed(1),
    }
  }),
)

const filteredDeptStats = computed(() => {
  const kw = deptKeyword.value.trim()
  if (!kw) return deptStats.value
  return deptStats.value.filter((d) => d.departmentName.includes(kw))
})

const avgAttendance = computed(() =>
  deptStats.value.length
    ? Math.round(deptStats.value.reduce((s, d) => s + d.attendanceRate, 0) / deptStats.value.length * 10) / 10
    : 0,
)

const totalPayroll = computed(() =>
  Math.round(payrollItems.value.reduce((s, p) => s + p.totalPay, 0)),
)

const taskCompletionRate = computed(() => {
  const tasks = store.tasks.filter((t) => t.status === 'active' || t.status === 'ended')
  if (!tasks.length) return 0
  const total = tasks.reduce((s, t) => s + (t.plannedTotal ?? t.acceptedCount), 0)
  const done = tasks.reduce((s, t) => s + t.completedCount, 0)
  return total ? Math.round((done / total) * 1000) / 10 : 0
})

const activeRate = computed(() =>
  store.employees.length
    ? Math.round((store.activeEmployees.length / store.employees.length) * 1000) / 10
    : 0,
)

const trendDays = computed(() => {
  const dates = getMonthDateRange(month.value).slice(-30)
  const labels = dates.map((d) => d.slice(5))
  const attendance: number[] = []
  const abnormal: number[] = []
  for (const date of dates) {
    const dayRecords = dailyList.value.filter((d) => d.date === date && d.scheduledHours > 0)
    if (!dayRecords.length) {
      attendance.push(0)
      abnormal.push(0)
      continue
    }
    const normal = dayRecords.filter((d) => d.status === 'normal' || d.status === 'late').length
    const abn = dayRecords.filter((d) => ['late', 'absent', 'missing_punch', 'early_leave'].includes(d.status)).length
    attendance.push(Math.round((normal / dayRecords.length) * 1000) / 10)
    abnormal.push(Math.round((abn / dayRecords.length) * 1000) / 10)
  }
  return { labels, attendance, abnormal }
})

const attendanceTrendOption = computed(() =>
  lineChartOption(trendDays.value.labels, [
    { name: '出勤率', data: trendDays.value.attendance, color: chartColors.blue },
    { name: '异常率', data: trendDays.value.abnormal, color: chartColors.orange, dashed: true },
  ]),
)

const salaryTrendOption = computed(() => {
  const months = getRecentMonths(12, month.value)
  const trends = buildMonthlyTrends(months, store.activeEmployees, store.teams, store.assignments, (m) =>
    buildDailyAttendanceList(
      store.activeEmployees.map((e) => e.id),
      getMonthDateRange(m),
      store.assignments,
      store.shifts,
      store.punches,
      store.leaveRequests,
      store.attendanceRule,
      store.manualOverrides,
    ),
    store.payrollConfig,
  )
  const colors = trends.map((_, i) =>
    i === trends.length - 1 ? chartColors.blue : chartColors.green,
  )
  return barChartOption(
    months.map((m) => `${Number(m.slice(5))}月`),
    [{ name: '薪酬支出', data: trends.map((t) => t.laborCost), color: colors }],
  )
})

const abnormalRank = computed(() =>
  [...deptStats.value]
    .sort((a, b) => b.abnormalRate - a.abnormalRate)
    .slice(0, 5)
    .map((d, i) => ({
      name: d.departmentName,
      value: d.abnormalRate,
      percent: Math.min(100, d.abnormalRate * 10),
      color: [chartColors.red, chartColors.orange, chartColors.orange, chartColors.blue, chartColors.purple][i],
    })),
)

function refreshData() {
  month.value = month.value
}
</script>

<template>
  <div class="stats-page">
    <div class="stats-header">
      <div>
        <h2 class="page-title">概览看板</h2>
        <p class="text-muted">数据报表 · 综合运营指标一览</p>
      </div>
      <div class="stats-toolbar">
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="开始"
          end-placeholder="结束"
          value-format="YYYY-MM-DD"
          style="width: 260px"
        />
        <el-button>导出报表</el-button>
        <el-button type="primary" @click="refreshData">刷新数据</el-button>
      </div>
    </div>

    <el-row :gutter="16" class="kpi-row">
      <el-col :xs="24" :sm="12" :md="8" :lg="4">
        <StatKpiCard
          label="灵工总数"
          :value="store.employees.length.toLocaleString()"
          icon="User"
          color="blue"
          trend="+8.2% 较上月"
          :trend-up="true"
        />
      </el-col>
      <el-col :xs="24" :sm="12" :md="8" :lg="4">
        <StatKpiCard
          label="本月活跃灵工"
          :value="store.activeEmployees.length.toLocaleString()"
          icon="Avatar"
          color="orange"
          :sub-text="`活跃率 ${activeRate}%`"
        >
          <el-progress :percentage="activeRate" :show-text="false" :stroke-width="4" style="margin-top: 10px" />
        </StatKpiCard>
      </el-col>
      <el-col :xs="24" :sm="12" :md="8" :lg="4">
        <StatKpiCard
          label="本月出勤率"
          :value="avgAttendance"
          suffix="%"
          icon="Calendar"
          color="green"
          :trend="trendText(1.2)"
          :trend-up="true"
        />
      </el-col>
      <el-col :xs="24" :sm="12" :md="8" :lg="4">
        <StatKpiCard
          label="本月薪酬总额"
          :value="formatMoney(totalPayroll)"
          icon="Money"
          color="purple"
          trend="+12.5% 较上月"
          :trend-up="true"
        />
      </el-col>
      <el-col :xs="24" :sm="12" :md="8" :lg="4">
        <StatKpiCard
          label="任务完成率"
          :value="taskCompletionRate"
          suffix="%"
          icon="Finished"
          color="pink"
          trend="-2.1% 较上月"
          :trend-up="false"
        />
      </el-col>
    </el-row>

    <StatPanel title="考勤趋势" subtitle="近30天" class="chart-section">
      <VChart :option="attendanceTrendOption" height="300px" />
    </StatPanel>

    <el-row :gutter="16" class="chart-row">
      <el-col :xs="24" :lg="14">
        <StatPanel title="月度薪酬支出趋势" subtitle="近12个月">
          <VChart :option="salaryTrendOption" height="300px" />
        </StatPanel>
      </el-col>
      <el-col :xs="24" :lg="10">
        <StatPanel title="异常考勤部门排行">
          <template #extra>
            <el-button link type="primary">查看全部</el-button>
          </template>
          <RankList :items="abnormalRank" />
        </StatPanel>
      </el-col>
    </el-row>

    <StatPanel title="部门数据明细" class="table-section">
      <template #extra>
        <div class="table-toolbar">
          <el-select placeholder="全部部门" clearable style="width: 140px">
            <el-option
              v-for="d in store.departments.filter((dep) => dep.id !== 'dept_root')"
              :key="d.id"
              :label="d.name"
              :value="d.id"
            />
          </el-select>
          <el-input v-model="deptKeyword" placeholder="搜索部门名称" clearable prefix-icon="Search" style="width: 180px" />
        </div>
      </template>
      <el-table :data="filteredDeptStats" border stripe>
        <el-table-column prop="departmentName" label="部门名称" min-width="120" fixed />
        <el-table-column prop="employeeCount" label="灵工人数" width="90" align="center" />
        <el-table-column label="出勤率" width="90" align="center">
          <template #default="{ row }">
            <span class="text-success">{{ row.attendanceRate }}%</span>
          </template>
        </el-table-column>
        <el-table-column label="异常率" width="90" align="center">
          <template #default="{ row }">
            <span :class="row.abnormalRate > 5 ? 'text-danger' : 'text-success'">{{ row.abnormalRate }}%</span>
          </template>
        </el-table-column>
        <el-table-column label="任务完成率" width="110" align="center">
          <template #default="{ row }">{{ row.taskRate }}%</template>
        </el-table-column>
        <el-table-column label="薪酬总额" width="120" align="right">
          <template #default="{ row }">{{ formatMoney(row.laborCost) }}</template>
        </el-table-column>
        <el-table-column label="人均薪酬" width="110" align="right">
          <template #default="{ row }">
            {{ formatMoney(row.employeeCount ? row.laborCost / row.employeeCount : 0) }}
          </template>
        </el-table-column>
        <el-table-column label="环比变化" width="100" align="center">
          <template #default="{ row }">
            <span :class="Number(row.momChange) >= 0 ? 'text-danger' : 'text-success'">
              {{ Number(row.momChange) >= 0 ? '↑' : '↓' }} {{ Math.abs(Number(row.momChange)) }}%
            </span>
          </template>
        </el-table-column>
      </el-table>
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

.stats-toolbar {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  align-items: center;
}

.kpi-row .el-col {
  margin-bottom: 16px;
}

.chart-section,
.table-section {
  margin: 0;
}

.chart-row .el-col {
  margin-bottom: 16px;
}

.table-toolbar {
  display: flex;
  gap: 10px;
}

.text-success {
  color: #52c41a;
  font-weight: 500;
}

.text-danger {
  color: #f5222d;
  font-weight: 500;
}
</style>
