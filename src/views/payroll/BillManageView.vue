<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import {
  billStatusMap,
  formatMoney,
  formatPeriod,
} from '@/constants/payrollBill'
import type { SettlementBill } from '@/types'

const store = useAppStore()
const router = useRouter()

const statusFilter = ref<'all' | SettlementBill['status']>('all')
const keyword = ref('')

const tableData = computed(() =>
  store.settlementBills
    .filter((b) => {
      if (statusFilter.value !== 'all' && b.status !== statusFilter.value) return false
      if (!keyword.value.trim()) return true
      const kw = keyword.value.trim().toLowerCase()
      return (
        b.billNo.toLowerCase().includes(kw) ||
        b.enterpriseName.includes(kw)
      )
    })
    .map((b) => ({
      ...b,
      periodLabel: formatPeriod(b.periodStart, b.periodEnd),
      payrollLabel: formatMoney(b.payrollTotal),
      serviceFeeLabel: formatMoney(b.serviceFee),
      totalLabel: formatMoney(b.totalPayable),
      statusLabel: billStatusMap[b.status].label,
      statusType: billStatusMap[b.status].type,
    }))
    .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd)),
)

function openDetail(row: SettlementBill) {
  router.push(`/payroll/bills/${row.id}`)
}

function confirmBill(row: SettlementBill) {
  try {
    store.confirmSettlementBill(row.id)
    ElMessage.success('账单已确认，状态已更新为待付款')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '操作失败')
  }
}

function applyInvoice(row: SettlementBill) {
  router.push({ path: '/payroll/invoices', query: { billId: row.id } })
}
</script>

<template>
  <div class="page-card">
    <div class="page-header">
      <div>
        <h2 class="page-title">账单管理</h2>
        <p class="text-muted">查看结算账单、确认付款及申请发票</p>
      </div>
    </div>

    <div class="page-toolbar">
      <el-input
        v-model="keyword"
        placeholder="搜索账单编号、企业"
        clearable
        prefix-icon="Search"
        style="width: 240px"
      />
      <el-radio-group v-model="statusFilter">
        <el-radio-button value="all">全部</el-radio-button>
        <el-radio-button value="pending_confirm">待确认</el-radio-button>
        <el-radio-button value="pending_payment">待付款</el-radio-button>
        <el-radio-button value="pending_verify">待核实</el-radio-button>
        <el-radio-button value="paid">已支付</el-radio-button>
        <el-radio-button value="void">已作废</el-radio-button>
      </el-radio-group>
    </div>

    <el-table :data="tableData" border stripe>
      <el-table-column prop="billNo" label="账单编号" width="160">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDetail(row)">{{ row.billNo }}</el-button>
        </template>
      </el-table-column>
      <el-table-column prop="periodLabel" label="结算周期" min-width="200" />
      <el-table-column prop="payrollLabel" label="薪酬总额" width="140" align="right" />
      <el-table-column prop="serviceFeeLabel" label="服务费" width="120" align="right" />
      <el-table-column prop="totalLabel" label="企业应付总额" width="150" align="right" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag size="small" :type="row.statusType">{{ row.statusLabel }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="260" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDetail(row)">查看详情</el-button>
          <el-button
            v-if="row.status === 'pending_confirm'"
            link
            type="primary"
            @click="confirmBill(row)"
          >
            确认
          </el-button>
          <el-button
            v-if="row.status === 'pending_payment'"
            link
            type="primary"
            @click="openDetail(row)"
          >
            确认付款
          </el-button>
          <el-button
            v-if="row.status === 'paid' && row.invoicedAmount < row.totalPayable"
            link
            @click="applyInvoice(row)"
          >
            申请发票
          </el-button>
          <el-button
            v-if="row.status === 'paid' && row.invoicedAmount >= row.totalPayable"
            link
            @click="router.push('/payroll/invoices')"
          >
            查看发票
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>
