<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { usePortal } from '@/composables/usePortal'
import StatKpiCard from '@/components/statistics/StatKpiCard.vue'
import StatPanel from '@/components/statistics/StatPanel.vue'
import VChart from '@/components/statistics/VChart.vue'
import RankList from '@/components/statistics/RankList.vue'
import {
  billStatusMap,
  resolveBillStatusMeta,
  formatMoney,
  formatPeriod,
} from '@/constants/payrollBill'
import { donutChartOption } from '@/services/statisticsCharts'
import { chartColors } from '@/plugins/echarts'
import type { SettlementBill, SettlementBillStatus } from '@/types'

const store = useAppStore()
const route = useRoute()
const router = useRouter()
const { pathPrefix, isEnterprise } = usePortal()

const enterpriseFilter = ref<string[]>([])
const providerFilter = ref<string[]>([])
const statusFilter = ref<SettlementBillStatus[]>([])
const keyword = ref('')
const drillEnterpriseId = ref('')
const drillBillId = ref('')

watch(
  () => route.query.status,
  (v) => {
    if (typeof v === 'string' && v) statusFilter.value = [v as SettlementBillStatus]
  },
  { immediate: true },
)

const scopedBills = computed(() => {
  let list = store.settlementBills as SettlementBill[]
  if (isEnterprise.value && store.currentEnterpriseId) {
    list = list.filter((b) => b.enterpriseId === store.currentEnterpriseId)
  }
  if (enterpriseFilter.value.length) {
    const set = new Set(enterpriseFilter.value)
    list = list.filter((b) => set.has(b.enterpriseId))
  }
  if (providerFilter.value.length) {
    const set = new Set(providerFilter.value)
    list = list.filter((b) => b.serviceProviderId && set.has(b.serviceProviderId))
  }
  if (statusFilter.value.length) {
    const set = new Set(statusFilter.value)
    list = list.filter((b) => set.has(b.status))
  }
  if (drillEnterpriseId.value) {
    list = list.filter((b) => b.enterpriseId === drillEnterpriseId.value)
  }
  if (keyword.value.trim()) {
    const kw = keyword.value.trim()
    list = list.filter(
      (b) => b.billNo.includes(kw) || b.enterpriseName.includes(kw) || (b.serviceProviderName ?? '').includes(kw),
    )
  }
  return list
})

const taxTotal = computed(() =>
  store.taxDeclarations.reduce((s, d) => s + d.totalTaxAmount, 0),
)

const summary = computed(() => {
  const bills = scopedBills.value
  const payroll = bills.reduce((s, b) => s + b.payrollTotal, 0)
  const fee = bills.reduce((s, b) => s + b.serviceFee, 0)
  const total = bills.reduce((s, b) => s + b.totalPayable, 0)
  const paid = bills.filter((b) => b.status === 'paid').reduce((s, b) => s + b.totalPayable, 0)
  const pending = bills
    .filter((b) => b.status === 'pending_payment')
    .reduce((s, b) => s + b.totalPayable, 0)
  /** 服务商分账：应付 − 灵工应发 − 服务费 − 分摊个税（演示口径） */
  const taxShare = bills.length
    ? Math.round((taxTotal.value * bills.length) / Math.max(1, store.settlementBills.length))
    : 0
  const providerShare = Math.max(0, Math.round((total - payroll - fee - taxShare) * 100) / 100)
  const balanceLeft = total
  const balanceRight = payroll + fee + taxShare + providerShare
  const balanced = Math.abs(balanceLeft - balanceRight) < 0.01
  return {
    total,
    paid,
    pending,
    fee,
    tax: taxShare,
    payroll,
    providerShare,
    balanced,
    balanceLeft,
    balanceRight,
  }
})

const statusDonutOption = computed(() => {
  const colors: Record<string, string> = {
    pending_submit: chartColors.cyan,
    pending_confirm: chartColors.orange,
    pending_payment: chartColors.blue,
    paid: chartColors.green,
    void: chartColors.red,
  }
  const counts: Record<string, number> = {}
  for (const key of Object.keys(billStatusMap)) counts[key] = 0
  for (const b of scopedBills.value) {
    const status = (b.status as string) === 'pending_verify' ? 'pending_payment' : b.status
    counts[status] = (counts[status] ?? 0) + 1
  }
  return donutChartOption(
    (Object.keys(billStatusMap) as (keyof typeof billStatusMap)[]).map((s) => ({
      name: billStatusMap[s].label,
      value: counts[s] ?? 0,
      color: colors[s] ?? chartColors.blue,
    })),
    `${scopedBills.value.length}\n账单`,
  )
})

const enterpriseRank = computed(() => {
  const map = new Map<string, { name: string; value: number; id: string }>()
  for (const b of scopedBills.value) {
    const row = map.get(b.enterpriseId) ?? { id: b.enterpriseId, name: b.enterpriseName, value: 0 }
    row.value += b.totalPayable
    map.set(b.enterpriseId, row)
  }
  const max = Math.max(...[...map.values()].map((r) => r.value), 1)
  return [...map.values()]
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)
    .map((r, i) => ({
      name: r.name,
      value: Math.round(r.value / 100) / 100,
      percent: (r.value / max) * 100,
      color: [chartColors.purple, chartColors.blue, chartColors.green, chartColors.orange, chartColors.cyan][i % 5],
      enterpriseId: r.id,
    }))
})

const billRows = computed(() =>
  scopedBills.value
    .map((b) => ({
      ...b,
      periodLabel: formatPeriod(b.periodStart, b.periodEnd),
      payrollLabel: formatMoney(b.payrollTotal),
      serviceFeeLabel: formatMoney(b.serviceFee),
      totalLabel: formatMoney(b.totalPayable),
      statusLabel: resolveBillStatusMeta(b.status).label,
      workerCount: b.summary?.workerCount ?? b.lines.length,
      billingRuleVersion: b.billingRuleName || b.billingRuleId || '—',
      priceVersion: b.serviceFeeRate != null ? `费率 ${b.serviceFeeRate}%` : '—',
      contractSnapshot: b.serviceFeeIncludesTax != null
        ? `服务费${b.serviceFeeIncludesTax ? '含税' : '不含税'}`
        : '—',
    }))
    .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd)),
)

const lineRows = computed(() => {
  const bill = scopedBills.value.find((b) => b.id === drillBillId.value)
  if (!bill) return []
  return bill.lines.map((l) => ({
    ...l,
    payrollLabel: formatMoney(l.payrollAmount),
    feeLabel: formatMoney(l.serviceFee),
    ruleVersion: bill.billingRuleName || bill.billingRuleId || '—',
    priceVersion: l.serviceFeeRate != null ? `${l.serviceFeeRate}%` : bill.serviceFeeRate != null ? `${bill.serviceFeeRate}%` : '—',
    contractSnapshot:
      bill.serviceFeeIncludesTax != null
        ? `服务费${bill.serviceFeeIncludesTax ? '含税' : '不含税'}/单价${bill.unitPriceIncludesTax ? '含税' : '不含税'}`
        : '—',
  }))
})

const enterpriseOptions = computed(() =>
  store.enterprises.map((e) => ({ id: e.id, name: e.name })),
)
const providerOptions = computed(() =>
  (store.serviceProviders ?? []).map((p: { id: string; name: string }) => ({
    id: p.id,
    name: p.name,
  })),
)

function onExport() {
  ElMessage.success(`已导出 ${billRows.value.length} 条账单明细（演示）`)
}

function onRankClick(item: { enterpriseId?: string; name: string; [key: string]: unknown }) {
  if (item.enterpriseId) {
    drillEnterpriseId.value = String(item.enterpriseId)
    drillBillId.value = ''
    ElMessage.info(`已下钻企业：${item.name}`)
  }
}

function openBill(row: { id: string }) {
  drillBillId.value = row.id
}

function goTax() {
  if (isEnterprise.value) {
    router.push(`${pathPrefix.value}/payroll/bills`)
    return
  }
  router.push(`${pathPrefix.value}/payroll/tax`)
}

function goPendingPay() {
  statusFilter.value = ['pending_payment']
}
</script>

<template>
  <div class="stats-page">
    <div class="stats-header">
      <div>
        <h2 class="page-title">结算分析</h2>
        <p class="text-muted">与财税结算报表同源 · 强制平衡校验</p>
      </div>
      <el-button type="primary" @click="onExport">导出</el-button>
    </div>

    <StatPanel title="筛选条件">
      <div class="filters">
        <el-select
          v-if="!isEnterprise"
          v-model="enterpriseFilter"
          multiple
          collapse-tags
          clearable
          placeholder="企业"
          style="width: 200px"
        >
          <el-option v-for="e in enterpriseOptions" :key="e.id" :label="e.name" :value="e.id" />
        </el-select>
        <el-select
          v-model="providerFilter"
          multiple
          collapse-tags
          clearable
          placeholder="服务商"
          style="width: 200px"
        >
          <el-option v-for="p in providerOptions" :key="p.id" :label="p.name" :value="p.id" />
        </el-select>
        <el-select
          v-model="statusFilter"
          multiple
          collapse-tags
          clearable
          placeholder="账单状态"
          style="width: 200px"
        >
          <el-option
            v-for="(meta, key) in billStatusMap"
            :key="key"
            :label="meta.label"
            :value="key"
          />
        </el-select>
        <el-input v-model="keyword" placeholder="账单号/企业" clearable style="width: 180px" />
        <el-button
          v-if="drillEnterpriseId || drillBillId"
          link
          type="primary"
          @click="drillEnterpriseId = ''; drillBillId = ''"
        >
          清除下钻
        </el-button>
      </div>
    </StatPanel>

    <el-alert
      :title="summary.balanced
        ? `平衡校验通过：账单总额 ${formatMoney(summary.balanceLeft)} = 灵工应发 + 服务费 + 个税 + 服务商分账`
        : `平衡校验失败：左 ${formatMoney(summary.balanceLeft)} ≠ 右 ${formatMoney(summary.balanceRight)}`"
      :type="summary.balanced ? 'success' : 'error'"
      :closable="false"
      show-icon
    />

    <el-row :gutter="16" class="kpi-row">
      <el-col :xs="12" :sm="8" :md="4">
        <StatKpiCard label="账单总额" :value="formatMoney(summary.total)" icon="DocumentCopy" color="blue" />
      </el-col>
      <el-col :xs="12" :sm="8" :md="4">
        <StatKpiCard label="已付金额" :value="formatMoney(summary.paid)" icon="CircleCheck" color="green" />
      </el-col>
      <el-col :xs="12" :sm="8" :md="4">
        <StatKpiCard
          label="待付金额"
          :value="formatMoney(summary.pending)"
          icon="Wallet"
          color="orange"
          clickable
          @click="goPendingPay"
        />
      </el-col>
      <el-col :xs="12" :sm="8" :md="4">
        <StatKpiCard label="服务费" :value="formatMoney(summary.fee)" icon="Coin" color="purple" />
      </el-col>
      <el-col :xs="12" :sm="8" :md="4">
        <StatKpiCard
          label="个税"
          :value="formatMoney(summary.tax)"
          icon="Ticket"
          color="cyan"
          clickable
          @click="goTax"
        />
      </el-col>
      <el-col :xs="12" :sm="8" :md="4">
        <StatKpiCard label="灵工应发" :value="formatMoney(summary.payroll)" icon="User" color="green" />
      </el-col>
      <el-col :xs="12" :sm="8" :md="4">
        <StatKpiCard label="服务商分账" :value="formatMoney(summary.providerShare)" icon="OfficeBuilding" color="pink" />
      </el-col>
    </el-row>

    <el-row :gutter="16" class="chart-row">
      <el-col :xs="24" :lg="10">
        <StatPanel title="账单状态分布">
          <VChart :option="statusDonutOption" height="280px" />
        </StatPanel>
      </el-col>
      <el-col :xs="24" :lg="14">
        <StatPanel title="企业排行（按账单总额）">
          <RankList
            :items="enterpriseRank"
            value-suffix="万"
            clickable
            @select="onRankClick"
          />
          <p class="hint">点击排行行下钻该企业账单明细</p>
        </StatPanel>
      </el-col>
    </el-row>

    <StatPanel title="账单明细">
      <el-table :data="billRows" border stripe @row-click="openBill">
        <el-table-column prop="billNo" label="账单编号" width="160" />
        <el-table-column prop="enterpriseName" label="企业" min-width="130" />
        <el-table-column prop="serviceProviderName" label="服务商" min-width="120" />
        <el-table-column prop="periodLabel" label="结算周期" min-width="180" />
        <el-table-column prop="workerCount" label="灵工数" width="80" align="center" />
        <el-table-column prop="payrollLabel" label="灵工应发" width="120" align="right" />
        <el-table-column prop="serviceFeeLabel" label="服务费" width="110" align="right" />
        <el-table-column prop="totalLabel" label="账单总额" width="120" align="right" />
        <el-table-column prop="billingRuleVersion" label="计薪规则版本" min-width="120" />
        <el-table-column prop="statusLabel" label="状态" width="90" />
      </el-table>
    </StatPanel>

    <StatPanel v-if="drillBillId" title="灵工明细溯源（结算价版本 / 计薪规则 / 合同费率快照）">
      <el-table :data="lineRows" border stripe size="small">
        <el-table-column prop="employeeName" label="灵工" width="100" />
        <el-table-column prop="departmentName" label="部门" min-width="120" />
        <el-table-column prop="payrollLabel" label="应发" width="110" align="right" />
        <el-table-column prop="feeLabel" label="服务费" width="100" align="right" />
        <el-table-column prop="ruleVersion" label="计薪规则版本" min-width="140" />
        <el-table-column prop="priceVersion" label="结算价/费率版本" min-width="130" />
        <el-table-column prop="contractSnapshot" label="合同费率快照" min-width="180" />
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
.filters { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.kpi-row .el-col, .chart-row .el-col { margin-bottom: 16px; }
.hint { margin: 8px 0 0; font-size: 12px; color: #909399; }
</style>
