<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft } from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'
import { usePortal } from '@/composables/usePortal'
import { formatMoney } from '@/constants/payrollBill'
import {
  formatSettlementPeriod,
  formatSettlementQuantity,
  formatSettlementUnitPrice,
  settlementManageTypeMap,
  slipEnterpriseLabel,
} from '@/constants/settlementManage'

const route = useRoute()
const router = useRouter()
const store = useAppStore()
const { pathPrefix } = usePortal()

const slip = computed(() =>
  store.settlementSlips.find((item) => item.id === route.params.id as string),
)

const tableData = computed(() =>
  (slip.value?.lines ?? []).map((line) => ({
    ...line,
    orderLabel: `${line.orderName}（${line.orderNo}）`,
    periodLabel: formatSettlementPeriod(line.periodStart, line.periodEnd),
    quantityLabel: formatSettlementQuantity(slip.value!.type, line.quantity),
    unitPriceLabel: formatSettlementUnitPrice(slip.value!.type, line.unitPrice),
    amountLabel: formatMoney(line.amount),
  })),
)

function goBack() {
  router.push(`${pathPrefix.value}/payroll/settlement`)
}

function formatTime(iso?: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-CN')
}
</script>

<template>
  <div v-if="slip" class="page-card">
    <div class="page-header">
      <div class="header-left">
        <el-button :icon="ArrowLeft" @click="goBack">返回</el-button>
        <div>
          <h2 class="page-title">结算单 {{ slip.slipNo }}</h2>
          <p class="text-muted">
            {{ settlementManageTypeMap[slip.type] }} · {{ formatTime(slip.settledAt) }}
          </p>
        </div>
      </div>
    </div>

    <el-descriptions :column="4" border class="summary-desc">
      <el-descriptions-item label="结算单号">{{ slip.slipNo }}</el-descriptions-item>
      <el-descriptions-item label="企业">{{ slipEnterpriseLabel(slip) }}</el-descriptions-item>
      <el-descriptions-item label="类型">{{ settlementManageTypeMap[slip.type] }}</el-descriptions-item>
      <el-descriptions-item label="结算时间">{{ formatTime(slip.settledAt) }}</el-descriptions-item>
      <el-descriptions-item label="灵工数">{{ slip.workerCount }}</el-descriptions-item>
      <el-descriptions-item label="工时/次数">
        {{ formatSettlementQuantity(slip.type, slip.totalQuantity) }}
      </el-descriptions-item>
      <el-descriptions-item label="结算金额">{{ formatMoney(slip.totalAmount) }}</el-descriptions-item>
    </el-descriptions>

    <h3 class="section-title">灵工明细</h3>

    <el-table :data="tableData" border stripe>
      <el-table-column prop="enterpriseName" label="企业" min-width="160" />
      <el-table-column prop="employeeName" label="灵工" width="100" />
      <el-table-column prop="employeeNo" label="工号" width="120" />
      <el-table-column prop="departmentName" label="部门" min-width="120" />
      <el-table-column prop="orderLabel" label="班次/任务单" min-width="220" />
      <el-table-column prop="periodLabel" label="结算周期" min-width="180" />
      <el-table-column
        prop="quantityLabel"
        :label="slip.type === 'hourly' ? '工时' : '次数'"
        width="110"
        align="right"
      />
      <el-table-column prop="unitPriceLabel" label="结算单价" width="120" align="right" />
      <el-table-column prop="amountLabel" label="结算金额" width="130" align="right" />
    </el-table>
  </div>

  <el-empty v-else description="结算单不存在">
    <el-button type="primary" @click="goBack">返回列表</el-button>
  </el-empty>
</template>

<style scoped>
.header-left {
  display: flex;
  align-items: flex-start;
  gap: 16px;
}

.summary-desc {
  margin-bottom: 24px;
}

.section-title {
  margin: 0 0 12px;
  font-size: 16px;
  font-weight: 600;
}
</style>
