<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAppStore } from '@/stores/app'
import StatKpiCard from '@/components/statistics/StatKpiCard.vue'
import StatPanel from '@/components/statistics/StatPanel.vue'
import VChart from '@/components/statistics/VChart.vue'
import RankList from '@/components/statistics/RankList.vue'
import { billStatusMap, formatMoney, formatPeriod } from '@/constants/payrollBill'
import { barChartOption, donutChartOption } from '@/services/statisticsCharts'
import { chartColors } from '@/plugins/echarts'

const store = useAppStore()
const yearFilter = ref('2024')
const keyword = ref('')

const billsInYear = computed(() =>
  store.settlementBills.filter((b) => b.periodStart.startsWith(yearFilter.value)),
)

const summary = computed(() => {
  const bills = billsInYear.value
  const paid = bills.filter((b) => b.status === 'paid')
  return {
    billCount: bills.length,
    payrollTotal: bills.reduce((s, b) => s + b.payrollTotal, 0),
    serviceFeeTotal: bills.reduce((s, b) => s + b.serviceFee, 0),
    payableTotal: bills.reduce((s, b) => s + b.totalPayable, 0),
    paidAmount: paid.reduce((s, b) => s + b.totalPayable, 0),
    pendingEstimate: store.pendingSettlements.reduce((s, i) => s + i.estimatedIncome, 0),
    paidRate: bills.length ? Math.round((paid.length / bills.length) * 100) : 0,
  }
})

const monthlyBarOption = computed(() => {
  const map = new Map<string, { payroll: number; fee: number }>()
  for (const b of billsInYear.value) {
    const m = `${Number(b.periodStart.slice(5))}月`
    const row = map.get(m) ?? { payroll: 0, fee: 0 }
    row.payroll += b.payrollTotal
    row.fee += b.serviceFee
    map.set(m, row)
  }
  const labels = [...map.keys()].sort((a, b) => parseInt(a) - parseInt(b))
  return barChartOption(labels, [
    { name: '薪酬', data: labels.map((l) => map.get(l)!.payroll), color: chartColors.blue },
    { name: '服务费', data: labels.map((l) => map.get(l)!.fee), color: chartColors.green },
  ])
})

const statusDonutOption = computed(() => {
  const colors: Record<string, string> = {
    pending_confirm: chartColors.orange,
    pending_payment: chartColors.blue,
    pending_verify: chartColors.cyan,
    paid: chartColors.green,
    void: chartColors.red,
  }
  const counts = { pending_confirm: 0, pending_payment: 0, pending_verify: 0, paid: 0, void: 0 }
  for (const b of billsInYear.value) counts[b.status] += 1
  return donutChartOption(
    (Object.keys(billStatusMap) as (keyof typeof billStatusMap)[]).map((s) => ({
      name: billStatusMap[s].label,
      value: counts[s],
      color: colors[s],
    })),
    `${summary.value.billCount}\n账单总数`,
  )
})

const enterpriseRank = computed(() => {
  const map = new Map<string, number>()
  for (const b of billsInYear.value) {
    map.set(b.enterpriseName, (map.get(b.enterpriseName) ?? 0) + b.totalPayable)
  }
  const max = Math.max(...map.values(), 1)
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, value], i) => ({
      name,
      value: Math.round(value / 10000),
      percent: (value / max) * 100,
      color: [chartColors.purple, chartColors.blue, chartColors.green, chartColors.orange, chartColors.cyan][i],
    }))
})

const billRows = computed(() =>
  billsInYear.value
    .filter((b) => !keyword.value.trim() || b.billNo.includes(keyword.value.trim()) || b.enterpriseName.includes(keyword.value.trim()))
    .map((b) => ({
      ...b,
      periodLabel: formatPeriod(b.periodStart, b.periodEnd),
      payrollLabel: formatMoney(b.payrollTotal),
      serviceFeeLabel: formatMoney(b.serviceFee),
      totalLabel: formatMoney(b.totalPayable),
      statusLabel: billStatusMap[b.status].label,
      workerCount: b.summary?.workerCount ?? b.lines.length,
    }))
    .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd)),
)

const enterpriseRows = computed(() => {
  const map = new Map<string, { enterpriseName: string; billCount: number; payrollTotal: number; totalPayable: number; invoicedAmount: number }>()
  for (const b of billsInYear.value) {
    const row = map.get(b.enterpriseId) ?? { enterpriseName: b.enterpriseName, billCount: 0, payrollTotal: 0, totalPayable: 0, invoicedAmount: 0 }
    row.billCount += 1
    row.payrollTotal += b.payrollTotal
    row.totalPayable += b.totalPayable
    row.invoicedAmount += b.invoicedAmount
    map.set(b.enterpriseId, row)
  }
  return [...map.values()].map((r) => ({
    ...r,
    payrollLabel: formatMoney(r.payrollTotal),
    totalLabel: formatMoney(r.totalPayable),
    invoiceRate: r.totalPayable ? `${Math.round((r.invoicedAmount / r.totalPayable) * 100)}%` : '0%',
  }))
})
</script>

<template>
  <div class="stats-page">
    <div class="stats-header">
      <div>
        <h2 class="page-title">结算数据报表</h2>
        <p class="text-muted">结算统计 · 账单、薪酬与服务费分析</p>
      </div>
      <el-select v-model="yearFilter" style="width: 120px">
        <el-option label="2024" value="2024" />
        <el-option label="2026" value="2026" />
      </el-select>
    </div>

    <el-row :gutter="16" class="kpi-row">
      <el-col :xs="24" :sm="12" :md="8" :lg="4">
        <StatKpiCard label="账单数" :value="summary.billCount" suffix="期" icon="DocumentCopy" color="blue" />
      </el-col>
      <el-col :xs="24" :sm="12" :md="8" :lg="4">
        <StatKpiCard label="薪酬总额" :value="formatMoney(summary.payrollTotal)" icon="Money" color="green" trend="+12.5% 较上月" :trend-up="true" />
      </el-col>
      <el-col :xs="24" :sm="12" :md="8" :lg="4">
        <StatKpiCard label="服务费" :value="formatMoney(summary.serviceFeeTotal)" icon="Coin" color="orange" />
      </el-col>
      <el-col :xs="24" :sm="12" :md="8" :lg="4">
        <StatKpiCard label="应付总额" :value="formatMoney(summary.payableTotal)" icon="Wallet" color="purple" />
      </el-col>
      <el-col :xs="24" :sm="12" :md="8" :lg="4">
        <StatKpiCard label="已支付" :value="summary.paidRate" suffix="%" icon="CircleCheck" color="cyan" :sub-text="formatMoney(summary.paidAmount)" />
      </el-col>
    </el-row>

    <el-row :gutter="16" class="chart-row">
      <el-col :xs="24" :lg="14">
        <StatPanel title="月度结算趋势">
          <VChart :option="monthlyBarOption" height="300px" />
        </StatPanel>
      </el-col>
      <el-col :xs="24" :lg="10">
        <StatPanel title="账单状态分布">
          <VChart :option="statusDonutOption" height="300px" />
        </StatPanel>
      </el-col>
    </el-row>

    <el-row :gutter="16" class="chart-row">
      <el-col :xs="24" :lg="10">
        <StatPanel title="企业结算排行（万元）">
          <RankList :items="enterpriseRank" value-suffix="万" />
        </StatPanel>
      </el-col>
      <el-col :xs="24" :lg="14">
        <StatPanel title="企业结算汇总">
          <el-table :data="enterpriseRows" border stripe size="small">
            <el-table-column prop="enterpriseName" label="企业" min-width="130" />
            <el-table-column prop="billCount" label="账单" width="70" align="center" />
            <el-table-column prop="payrollLabel" label="薪酬" width="120" align="right" />
            <el-table-column prop="totalLabel" label="应付" width="120" align="right" />
            <el-table-column prop="invoiceRate" label="开票率" width="80" align="center" />
          </el-table>
        </StatPanel>
      </el-col>
    </el-row>

    <StatPanel title="账单明细统计">
      <template #extra>
        <el-input v-model="keyword" placeholder="搜索账单/企业" clearable prefix-icon="Search" style="width: 200px" />
      </template>
      <el-table :data="billRows" border stripe>
        <el-table-column prop="billNo" label="账单编号" width="160" />
        <el-table-column prop="enterpriseName" label="企业" min-width="130" />
        <el-table-column prop="periodLabel" label="结算周期" min-width="190" />
        <el-table-column prop="workerCount" label="灵工数" width="80" align="center" />
        <el-table-column prop="payrollLabel" label="薪酬" width="130" align="right" />
        <el-table-column prop="serviceFeeLabel" label="服务费" width="110" align="right" />
        <el-table-column prop="totalLabel" label="应付总额" width="130" align="right" />
        <el-table-column prop="statusLabel" label="状态" width="90" />
      </el-table>
    </StatPanel>
  </div>
</template>

<style scoped>
.stats-page { display: flex; flex-direction: column; gap: 16px; }
.stats-header {
  display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px;
  background: #fff; border-radius: 12px; padding: 20px 24px; border: 1px solid var(--app-border);
}
.kpi-row .el-col, .chart-row .el-col { margin-bottom: 16px; }
</style>
