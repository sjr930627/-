<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { formatMoney, formatPeriod } from '@/constants/payrollBill'

const store = useAppStore()
const router = useRouter()
const activeTab = ref('pending')
const filterDept = ref('')
const keyword = ref('')
const periodFilter = ref('')

const pendingTotal = computed(() =>
  store.pendingSettlements.reduce((s, i) => s + i.estimatedIncome, 0),
)

const pendingList = computed(() =>
  store.pendingSettlements
    .filter((i) => {
      if (filterDept.value && i.departmentId !== filterDept.value) return false
      if (!keyword.value.trim()) return true
      return i.employeeName.includes(keyword.value.trim())
    })
    .map((i) => ({
      ...i,
      incomeLabel: formatMoney(i.estimatedIncome),
    })),
)

const settledBills = computed(() =>
  store.settlementBills
    .filter((b) => b.status === 'paid')
    .filter((b) => !periodFilter.value || b.periodStart.startsWith(periodFilter.value))
    .map((b) => ({
      ...b,
      periodLabel: formatPeriod(b.periodStart, b.periodEnd),
      payrollLabel: formatMoney(b.payrollTotal),
      totalLabel: formatMoney(b.totalPayable),
    }))
    .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd)),
)

const settledTotal = computed(() =>
  settledBills.value.reduce((s, b) => s + b.payrollTotal, 0),
)

const periodOptions = computed(() => {
  const set = new Set(store.settlementBills.filter((b) => b.status === 'paid').map((b) => b.periodStart.slice(0, 7)))
  return [...set].sort().reverse()
})
</script>

<template>
  <div class="page-card">
    <div class="page-header">
      <div>
        <h2 class="page-title">结算概览</h2>
        <p class="text-muted">查看待结算预估与历史已结算灵工收入</p>
      </div>
    </div>

    <el-tabs v-model="activeTab">
      <el-tab-pane label="待结算" name="pending">
        <el-row :gutter="16" class="summary-row">
          <el-col :span="8">
            <el-statistic title="待结算预估总额" :value="pendingTotal" prefix="¥" :precision="2" />
          </el-col>
          <el-col :span="8">
            <el-statistic title="涉及灵工" :value="pendingList.length" suffix="人" />
          </el-col>
          <el-col :span="8">
            <el-alert type="info" :closable="false" title="仅作参考，以最终生成账单为准" />
          </el-col>
        </el-row>

        <div class="page-toolbar">
          <el-select v-model="filterDept" clearable placeholder="全部部门" style="width: 160px">
            <el-option v-for="d in store.departments.filter((dep) => dep.id !== 'dept_root')" :key="d.id" :label="d.name" :value="d.id" />
          </el-select>
          <el-input v-model="keyword" placeholder="搜索灵工姓名" clearable prefix-icon="Search" style="width: 200px" />
        </div>

        <el-table :data="pendingList" border stripe>
          <el-table-column prop="employeeName" label="灵工姓名" width="100" />
          <el-table-column prop="departmentName" label="部门" min-width="120" />
          <el-table-column prop="attendanceDays" label="考勤天数" width="100" align="center" />
          <el-table-column prop="taskCount" label="完成任务数" width="110" align="center" />
          <el-table-column prop="incomeLabel" label="预估收入" width="130" align="right" />
          <el-table-column prop="month" label="所属月份" width="100" />
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="已结算" name="settled">
        <el-row :gutter="16" class="summary-row">
          <el-col :span="8">
            <el-statistic title="已结算薪酬总额" :value="settledTotal" prefix="¥" :precision="2" />
          </el-col>
          <el-col :span="8">
            <el-statistic title="已支付账单" :value="settledBills.length" suffix="期" />
          </el-col>
        </el-row>

        <div class="page-toolbar">
          <el-select v-model="periodFilter" clearable placeholder="结算周期" style="width: 160px">
            <el-option v-for="p in periodOptions" :key="p" :label="p" :value="p" />
          </el-select>
        </div>

        <el-table :data="settledBills" border stripe>
          <el-table-column prop="billNo" label="账单编号" width="160" />
          <el-table-column prop="periodLabel" label="结算周期" min-width="200" />
          <el-table-column prop="enterpriseName" label="企业" min-width="140" />
          <el-table-column prop="payrollLabel" label="灵工薪酬总额" width="150" align="right" />
          <el-table-column prop="totalLabel" label="企业应付" width="140" align="right" />
          <el-table-column label="操作" width="120">
            <template #default="{ row }">
              <el-button link type="primary" @click="router.push(`/payroll/bills/${row.id}`)">
                查看明细
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<style scoped>
.summary-row {
  margin-bottom: 16px;
}
</style>
