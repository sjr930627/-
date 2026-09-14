<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { usePortal } from '@/composables/usePortal'
import StatKpiCard from '@/components/statistics/StatKpiCard.vue'
import StatPanel from '@/components/statistics/StatPanel.vue'
import VChart from '@/components/statistics/VChart.vue'
import {
  buildDailyAttendanceList,
  buildMonthlySummary,
  getMonthDateRange,
} from '@/services/attendance'
import { formatMoney } from '@/constants/payrollBill'
import { buildWorkerSettlementStats } from '@/services/settlementStatistics'
import { barChartOption, donutChartOption, valueLineChartOption } from '@/services/statisticsCharts'
import { chartColors } from '@/plugins/echarts'

const store = useAppStore()
const { isEnterprise } = usePortal()

const month = ref('2026-07')
const keyword = ref('')
const page = ref(1)
const pageSize = 10

const scopedBills = computed(() => {
  let list = store.settlementBills.filter((b) => b.status !== 'void')
  if (isEnterprise.value && store.currentEnterpriseId) {
    list = list.filter((b) => b.enterpriseId === store.currentEnterpriseId)
  }
  /** 优先取结算周期落在所选月份的账单 */
  const monthBills = list.filter(
    (b) => b.periodStart.startsWith(month.value) || b.periodEnd.startsWith(month.value),
  )
  return monthBills.length ? monthBills : list
})

const hourByEmployee = computed(() => {
  const empIds = [
    ...new Set(scopedBills.value.flatMap((b) => b.lines.map((l) => l.employeeId))),
  ]
  if (!empIds.length) return new Map<string, number>()
  const daily = buildDailyAttendanceList(
    empIds,
    getMonthDateRange(month.value),
    store.assignments,
    store.shifts,
    store.punches,
    store.leaveRequests,
    store.attendanceRule,
    store.manualOverrides,
  )
  const map = new Map<string, number>()
  for (const id of empIds) {
    const summary = buildMonthlySummary(
      id,
      month.value,
      daily.filter((d) => d.employeeId === id),
    )
    map.set(id, summary.totalWorkHours)
  }
  return map
})

const stats = computed(() =>
  buildWorkerSettlementStats({
    bills: scopedBills.value,
    slips: store.settlementSlips,
    hourByEmployee: hourByEmployee.value,
  }),
)

const hourDistOption = computed(() => {
  const buckets = [
    { label: '0-40h', min: 0, max: 40 },
    { label: '40-80h', min: 40, max: 80 },
    { label: '80-120h', min: 80, max: 120 },
    { label: '120-176h', min: 120, max: 176 },
    { label: '176h+', min: 176, max: 9999 },
  ]
  const data = buckets.map((b) =>
    stats.value.workers.filter((w) => w.workHours >= b.min && w.workHours < b.max).length,
  )
  return barChartOption(
    buckets.map((b) => b.label),
    [{ name: '人数', data, color: chartColors.blue }],
  )
})

const payDonutOption = computed(() => {
  const rows = stats.value.enterpriseRows.slice(0, 5)
  const colors = [chartColors.blue, chartColors.green, chartColors.orange, chartColors.purple, chartColors.cyan]
  return donutChartOption(
    rows.map((r, i) => ({
      name: r.enterpriseName,
      value: Math.round(r.payroll),
      color: colors[i % colors.length],
    })),
    `${stats.value.summary.settledHeadcount}\n结算人数`,
  )
})

const avgTrendOption = computed(() => {
  const labels = stats.value.enterpriseRows.slice(0, 8).map((r) => r.enterpriseName.slice(0, 6))
  return valueLineChartOption(
    labels,
    [
      {
        name: '平均工时',
        data: stats.value.enterpriseRows.slice(0, 8).map((r) => r.avgHours),
        color: chartColors.green,
      },
      {
        name: '人均薪酬(百元)',
        data: stats.value.enterpriseRows.slice(0, 8).map((r) => Math.round(r.avgPay / 100)),
        color: chartColors.orange,
        dashed: true,
      },
    ],
  )
})

const filteredWorkers = computed(() => {
  const kw = keyword.value.trim()
  if (!kw) return stats.value.workers
  return stats.value.workers.filter(
    (w) =>
      w.employeeName.includes(kw) ||
      w.enterpriseName.includes(kw) ||
      w.departmentName.includes(kw),
  )
})

const pagedWorkers = computed(() => {
  const start = (page.value - 1) * pageSize
  return filteredWorkers.value.slice(start, start + pageSize)
})

function onExport() {
  ElMessage.success(`已导出 ${filteredWorkers.value.length} 条灵工结算明细（演示）`)
}
</script>

<template>
  <div class="stats-page">
    <div class="stats-header">
      <div>
        <h2 class="page-title">灵工结算分析</h2>
        <p class="text-muted">
          平均工时 = 出勤工时 ÷ 结算人数 · 评估产能、人效与薪酬水平
        </p>
      </div>
      <div class="header-actions">
        <el-date-picker v-model="month" type="month" value-format="YYYY-MM" style="width: 140px" />
        <el-button type="primary" @click="onExport">导出</el-button>
      </div>
    </div>

    <el-row :gutter="16" class="kpi-row">
      <el-col :xs="12" :sm="8" :md="6" :lg="4">
        <StatKpiCard label="结算人数" :value="stats.summary.settledHeadcount" suffix="人" icon="User" color="blue" />
      </el-col>
      <el-col :xs="12" :sm="8" :md="6" :lg="4">
        <StatKpiCard label="总工时" :value="stats.summary.totalHours" suffix="h" icon="Timer" color="cyan" />
      </el-col>
      <el-col :xs="12" :sm="8" :md="6" :lg="4">
        <StatKpiCard
          label="平均工时"
          :value="stats.summary.avgHours"
          suffix="h"
          icon="DataLine"
          color="green"
          sub-text="出勤工时 ÷ 结算人数"
        />
      </el-col>
      <el-col :xs="12" :sm="8" :md="6" :lg="4">
        <StatKpiCard label="应发总额" :value="formatMoney(stats.summary.totalPayroll)" icon="Money" color="purple" />
      </el-col>
      <el-col :xs="12" :sm="8" :md="6" :lg="4">
        <StatKpiCard label="人均薪酬" :value="formatMoney(stats.summary.avgPay)" icon="Wallet" color="orange" />
      </el-col>
      <el-col :xs="12" :sm="8" :md="6" :lg="4">
        <StatKpiCard
          label="工时利用率"
          :value="stats.summary.hourUtilRate"
          suffix="%"
          icon="TrendCharts"
          color="green"
          :sub-text="`时薪产出 ¥${stats.summary.outputPerHour}/h`"
        />
      </el-col>
    </el-row>

    <el-row :gutter="16" class="chart-row">
      <el-col :xs="24" :lg="8">
        <StatPanel title="工时分布（人）">
          <VChart :option="hourDistOption" height="280px" />
        </StatPanel>
      </el-col>
      <el-col :xs="24" :lg="8">
        <StatPanel title="薪酬构成（按企业）">
          <VChart :option="payDonutOption" height="280px" />
        </StatPanel>
      </el-col>
      <el-col :xs="24" :lg="8">
        <StatPanel title="企业平均工时 / 人均薪酬">
          <VChart :option="avgTrendOption" height="280px" />
        </StatPanel>
      </el-col>
    </el-row>

    <StatPanel v-if="!isEnterprise" title="企业人效汇总">
      <el-table :data="stats.enterpriseRows" border stripe size="small">
        <el-table-column prop="enterpriseName" label="用工企业" min-width="160" />
        <el-table-column prop="headcount" label="结算人数" width="90" align="center" />
        <el-table-column prop="hours" label="总工时" width="100" align="right" />
        <el-table-column prop="avgHours" label="平均工时" width="100" align="right" />
        <el-table-column label="应发总额" width="130" align="right">
          <template #default="{ row }">{{ formatMoney(row.payroll) }}</template>
        </el-table-column>
        <el-table-column label="人均薪酬" width="120" align="right">
          <template #default="{ row }">{{ formatMoney(row.avgPay) }}</template>
        </el-table-column>
      </el-table>
    </StatPanel>

    <StatPanel title="灵工结算明细">
      <template #extra>
        <el-input
          v-model="keyword"
          placeholder="搜索灵工 / 企业 / 部门"
          clearable
          prefix-icon="Search"
          style="width: 240px"
          @input="page = 1"
        />
      </template>
      <el-table :data="pagedWorkers" border stripe>
        <el-table-column prop="employeeName" label="灵工" width="100" />
        <el-table-column v-if="!isEnterprise" prop="enterpriseName" label="企业" min-width="140" />
        <el-table-column prop="departmentName" label="部门" min-width="120" />
        <el-table-column prop="workHours" label="出勤工时" width="100" align="right" />
        <el-table-column label="应发薪酬" width="120" align="right">
          <template #default="{ row }">{{ formatMoney(row.payrollAmount) }}</template>
        </el-table-column>
        <el-table-column label="服务费" width="100" align="right">
          <template #default="{ row }">{{ formatMoney(row.serviceFee) }}</template>
        </el-table-column>
        <el-table-column label="时薪产出" width="100" align="right">
          <template #default="{ row }">
            {{ row.workHours ? formatMoney(Math.round((row.payrollAmount / row.workHours) * 100) / 100) : '—' }}
          </template>
        </el-table-column>
        <el-table-column prop="billCount" label="账单数" width="80" align="center" />
      </el-table>
      <div class="table-footer">
        <span class="text-muted">共 {{ filteredWorkers.length }} 人</span>
        <el-pagination
          v-model:current-page="page"
          :page-size="pageSize"
          layout="prev, pager, next"
          :total="filteredWorkers.length"
          background
        />
      </div>
    </StatPanel>
  </div>
</template>

<style scoped>
.stats-page { display: flex; flex-direction: column; gap: 16px; }
.stats-header {
  display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px;
  background: #fff; border-radius: 12px; padding: 20px 24px; border: 1px solid var(--app-border);
}
.header-actions { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.kpi-row .el-col, .chart-row .el-col { margin-bottom: 16px; }
.table-footer {
  display: flex; justify-content: space-between; align-items: center;
  margin-top: 12px; flex-wrap: wrap; gap: 8px;
}
</style>
