<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { useEnterpriseScope } from '@/composables/useEnterpriseScope'
import { usePortal } from '@/composables/usePortal'
import EnterpriseScopeSelect from '@/components/platform/EnterpriseScopeSelect.vue'
import { formatMoney } from '@/constants/payrollBill'
import {
  collectPendingLines,
  formatSettlementQuantity,
  formatSettlementUnitPrice,
  groupPendingByEnterprise,
  parseSettlementLineKey,
  pendingSettlementTypes,
  settlementManageStatusMap,
  settlementManageTypeMap,
  slipEnterpriseLabel,
  type PendingEnterpriseGroup,
  type PendingSettlementLineRow,
} from '@/constants/settlementManage'
import type { SettlementManageType } from '@/types'

const store = useAppStore()
const route = useRoute()
const router = useRouter()
const { pathPrefix } = usePortal()
const { isPlatform, enterpriseFilter, matchesEnterprise } = useEnterpriseScope('filter')

const statusTab = ref<'pending_settlement' | 'settled'>('pending_settlement')
const typeTab = ref<Exclude<SettlementManageType, 'import'>>('hourly')
const periodRange = ref<[string, string] | null>(null)
const keyword = ref('')
const selectedKeys = ref<Set<string>>(new Set())

watch([typeTab, statusTab, periodRange, enterpriseFilter, keyword], () => {
  selectedKeys.value = new Set()
})

watch(
  () => route.query.keyword,
  (value) => {
    if (typeof value === 'string') keyword.value = value
  },
  { immediate: true },
)

const filteredOrders = computed(() =>
  store.settlementManageOrders.filter((order) => {
    if (order.type !== typeTab.value) return false
    if (!matchesEnterprise(order.enterpriseId)) return false
    if (periodRange.value) {
      const [start, end] = periodRange.value
      if (order.periodEnd < start || order.periodStart > end) return false
    }
    if (keyword.value.trim()) {
      const kw = keyword.value.trim().toLowerCase()
      const haystack = [
        order.enterpriseName,
        order.orderNo,
        order.orderName,
        ...order.workerLines.flatMap((line) => [
          line.employeeName,
          line.employeeNo ?? '',
        ]),
      ]
        .join(' ')
        .toLowerCase()
      if (!haystack.includes(kw)) return false
    }
    return true
  }),
)

const pendingLines = computed(() => collectPendingLines(filteredOrders.value, typeTab.value))

const enterpriseGroups = computed(() => groupPendingByEnterprise(pendingLines.value))

const pendingSummary = computed(() => ({
  enterpriseCount: enterpriseGroups.value.length,
  workerCount: new Set(pendingLines.value.map((line) => line.employeeId)).size,
  totalAmount: pendingLines.value.reduce((sum, line) => sum + line.amount, 0),
}))

const filteredSlips = computed(() =>
  store.settlementSlips
    .filter((slip) => {
      if (periodRange.value) {
        const [start, end] = periodRange.value
        const day = slip.settledAt.slice(0, 10)
        if (day < start || day > end) return false
      }
      if (!slip.lines.some((line) => matchesEnterprise(line.enterpriseId))) return false
      if (keyword.value.trim()) {
        const kw = keyword.value.trim().toLowerCase()
        const haystack = [
          slip.slipNo,
          settlementManageTypeMap[slip.type],
          ...slip.lines.flatMap((line) => [
            line.enterpriseName,
            line.orderNo,
            line.orderName,
            line.employeeName,
            line.employeeNo ?? '',
            line.phone ?? '',
          ]),
        ]
          .join(' ')
          .toLowerCase()
        if (!haystack.includes(kw)) return false
      }
      return true
    })
    .map((slip) => ({
      ...slip,
      enterpriseLabel: slipEnterpriseLabel(slip),
      typeLabel: settlementManageTypeMap[slip.type],
      amountLabel: formatMoney(slip.totalAmount),
      quantityLabel: formatSettlementQuantity(slip.type, slip.totalQuantity),
      settledAtLabel: new Date(slip.settledAt).toLocaleString('zh-CN'),
    }))
    .sort((a, b) => b.settledAt.localeCompare(a.settledAt)),
)

const settledSummary = computed(() => ({
  slipCount: filteredSlips.value.length,
  workerCount: filteredSlips.value.reduce((sum, slip) => sum + slip.workerCount, 0),
  totalAmount: filteredSlips.value.reduce((sum, slip) => sum + slip.totalAmount, 0),
}))

const selectedCount = computed(() => selectedKeys.value.size)

const allPendingSelected = computed(() =>
  pendingLines.value.length > 0 &&
  pendingLines.value.every((line) => selectedKeys.value.has(line.key)),
)

const somePendingSelected = computed(() =>
  pendingLines.value.some((line) => selectedKeys.value.has(line.key)) && !allPendingSelected.value,
)

function isLineSelected(key: string) {
  return selectedKeys.value.has(key)
}

function isGroupAllSelected(group: PendingEnterpriseGroup) {
  return group.lines.length > 0 && group.lines.every((line) => selectedKeys.value.has(line.key))
}

function isGroupIndeterminate(group: PendingEnterpriseGroup) {
  const selected = group.lines.filter((line) => selectedKeys.value.has(line.key)).length
  return selected > 0 && selected < group.lines.length
}

function toggleLine(key: string, checked: boolean) {
  const next = new Set(selectedKeys.value)
  if (checked) next.add(key)
  else next.delete(key)
  selectedKeys.value = next
}

function toggleGroup(group: PendingEnterpriseGroup, checked: boolean) {
  const next = new Set(selectedKeys.value)
  for (const line of group.lines) {
    if (checked) next.add(line.key)
    else next.delete(line.key)
  }
  selectedKeys.value = next
}

function toggleAllPending(checked: boolean) {
  selectedKeys.value = checked
    ? new Set(pendingLines.value.map((line) => line.key))
    : new Set()
}

function formatLineRow(row: PendingSettlementLineRow) {
  return {
    ...row,
    dateLabel: row.date.replace(/-/g, '.'),
    quantityLabel: `${row.quantity}`,
    unitPriceLabel: formatSettlementUnitPrice(row.type, row.unitPrice),
    amountLabel: formatMoney(row.amount),
  }
}

function batchSettle() {
  if (!selectedKeys.value.size) {
    ElMessage.warning('请先选择待发薪明细')
    return
  }
  try {
    const items = [...selectedKeys.value].map(parseSettlementLineKey)
    const slip = store.batchSettleWorkerLines(items, typeTab.value)
    selectedKeys.value = new Set()
    ElMessage.success(`结算单 ${slip.slipNo} 已生成，共 ${slip.workerCount} 笔明细`)
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '发薪失败')
  }
}

function goSlipDetail(row: { id: string }) {
  router.push(`${pathPrefix.value}/payroll/settlement/slip/${row.id}`)
}

function goImport() {
  router.push(`${pathPrefix.value}/payroll/settlement/import`)
}
</script>

<template>
  <div class="page-card">
    <div class="page-header">
      <div>
        <h2 class="page-title">发薪管理</h2>
        <p class="text-muted">
          待结算按企业汇总，展开查看单笔班次/任务明细；已结算含工时、任务与导入发薪
        </p>
      </div>
      <div class="header-actions">
        <el-button @click="goImport">导入发薪</el-button>
        <el-button
          v-if="statusTab === 'pending_settlement'"
          type="primary"
          :disabled="!selectedCount"
          @click="batchSettle"
        >
          确认发薪{{ selectedCount ? `（${selectedCount}）` : '' }}
        </el-button>
      </div>
    </div>

    <el-tabs v-model="statusTab" class="status-tabs">
      <el-tab-pane label="待结算" name="pending_settlement" />
      <el-tab-pane label="已结算" name="settled" />
    </el-tabs>

    <el-tabs
      v-if="statusTab === 'pending_settlement'"
      v-model="typeTab"
      class="type-tabs"
    >
      <el-tab-pane
        v-for="t in pendingSettlementTypes"
        :key="t"
        :label="settlementManageTypeMap[t]"
        :name="t"
      />
    </el-tabs>

    <el-row v-if="statusTab === 'pending_settlement'" :gutter="16" class="summary-row">
      <el-col :span="8">
        <el-statistic title="企业数" :value="pendingSummary.enterpriseCount" />
      </el-col>
      <el-col :span="8">
        <el-statistic title="待发薪人数" :value="pendingSummary.workerCount" />
      </el-col>
      <el-col :span="8">
        <el-statistic title="待发薪金额" :value="pendingSummary.totalAmount" prefix="¥" :precision="2" />
      </el-col>
    </el-row>

    <el-row v-else :gutter="16" class="summary-row">
      <el-col :span="8">
        <el-statistic title="结算单数" :value="settledSummary.slipCount" />
      </el-col>
      <el-col :span="8">
        <el-statistic title="已发薪人数" :value="settledSummary.workerCount" />
      </el-col>
      <el-col :span="8">
        <el-statistic title="已发薪金额" :value="settledSummary.totalAmount" prefix="¥" :precision="2" />
      </el-col>
    </el-row>

    <div class="page-toolbar">
      <EnterpriseScopeSelect v-if="isPlatform" v-model="enterpriseFilter" mode="filter" />
      <el-date-picker
        v-model="periodRange"
        type="daterange"
        value-format="YYYY-MM-DD"
        range-separator="至"
        :start-placeholder="statusTab === 'pending_settlement' ? '明细起始日' : '发薪操作起始日'"
        :end-placeholder="statusTab === 'pending_settlement' ? '明细结束日' : '发薪操作结束日'"
        clearable
        style="width: 280px"
      />
      <el-input
        v-model="keyword"
        :placeholder="statusTab === 'pending_settlement' ? '搜索企业、姓名、班次/任务' : '搜索结算单号、企业、灵工、类型'"
        clearable
        prefix-icon="Search"
        style="width: 280px"
      />
      <el-checkbox
        v-if="statusTab === 'pending_settlement' && pendingLines.length"
        :model-value="allPendingSelected"
        :indeterminate="somePendingSelected"
        @change="toggleAllPending($event as boolean)"
      >
        全选当前筛选结果
      </el-checkbox>
    </div>

    <template v-if="statusTab === 'pending_settlement'">
      <el-table
        :key="`${typeTab}-pending`"
        :data="enterpriseGroups"
        border
        stripe
        row-key="enterpriseId"
      >
        <el-table-column type="expand" width="48">
          <template #default="{ row }: { row: PendingEnterpriseGroup }">
            <div class="expand-panel">
              <el-table :data="row.lines.map(formatLineRow)" border size="small">
                <el-table-column width="48">
                  <template #header>
                    <el-checkbox
                      :model-value="isGroupAllSelected(row)"
                      :indeterminate="isGroupIndeterminate(row)"
                      @change="toggleGroup(row, $event as boolean)"
                    />
                  </template>
                  <template #default="{ row: line }">
                    <el-checkbox
                      :model-value="isLineSelected(line.key)"
                      @change="toggleLine(line.key, $event as boolean)"
                    />
                  </template>
                </el-table-column>
                <el-table-column prop="employeeName" label="姓名" width="100" />
                <el-table-column prop="dateLabel" label="日期" width="120" />
                <template v-if="typeTab === 'hourly'">
                  <el-table-column prop="orderName" label="班次/抢班名称" min-width="200" show-overflow-tooltip />
                  <el-table-column prop="quantityLabel" label="工时" width="90" align="right" />
                  <el-table-column prop="unitPriceLabel" label="工时单价" width="120" align="right" />
                </template>
                <template v-else>
                  <el-table-column prop="orderName" label="任务名称" min-width="200" show-overflow-tooltip />
                  <el-table-column prop="quantityLabel" label="任务数量" width="90" align="right" />
                  <el-table-column prop="unitPriceLabel" label="任务单价" width="120" align="right" />
                </template>
                <el-table-column prop="amountLabel" label="发薪金额" width="120" align="right" />
              </el-table>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="enterpriseName" label="企业" min-width="200" />
        <el-table-column prop="workerCount" label="待发薪人数" width="120" align="center" />
        <el-table-column label="待发薪金额" width="140" align="right">
          <template #default="{ row }">{{ formatMoney(row.totalAmount) }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default>
            <el-tag size="small" :type="settlementManageStatusMap.pending_settlement.type">
              {{ settlementManageStatusMap.pending_settlement.label }}
            </el-tag>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="!enterpriseGroups.length" description="暂无待结算数据" />
      <p v-else class="toolbar-hint">展开企业查看单笔班次/任务明细，勾选后点击「确认发薪」生成结算单</p>
    </template>

    <template v-else>
      <el-table
        :data="filteredSlips"
        border
        stripe
        class="clickable-table"
        @row-click="goSlipDetail"
      >
        <el-table-column prop="slipNo" label="结算单号" min-width="160" />
        <el-table-column prop="enterpriseLabel" label="企业" min-width="180" />
        <el-table-column prop="typeLabel" label="类型" width="100" />
        <el-table-column prop="workerCount" label="人数" width="90" align="center" />
        <el-table-column prop="quantityLabel" label="工时/次数/人数" width="140" align="right" />
        <el-table-column prop="amountLabel" label="发薪金额" width="130" align="right" />
        <el-table-column prop="settledAtLabel" label="发薪时间" min-width="170" />
        <el-table-column label="操作" width="90" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click.stop="goSlipDetail(row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="!filteredSlips.length" description="暂无结算单" />
      <p v-else class="toolbar-hint">类型含工时、任务、导入发薪；点击查看明细</p>
    </template>
  </div>
</template>

<style scoped>
.status-tabs {
  margin-bottom: 4px;
}

.type-tabs {
  margin-bottom: 16px;
}

.summary-row {
  margin-bottom: 16px;
}

.header-actions {
  display: flex;
  gap: 8px;
  align-items: center;
}

.page-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.expand-panel {
  padding: 8px 12px 12px 48px;
}

.clickable-table :deep(.el-table__row) {
  cursor: pointer;
}

.toolbar-hint {
  margin-top: 12px;
  font-size: 12px;
  color: var(--el-text-color-secondary);
}
</style>
