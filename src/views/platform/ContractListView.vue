<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import {
  billingRuleTypeMap,
  contractStatusMap,
  formatContractExpiry,
  resolveContractDisplayStatus,
} from '@/constants/partnership'
import {
  contractHasBillingType,
  getContractBillingListItems,
} from '@/services/contractBilling'
import type { ContractBillingRuleType, ServiceContract, ServiceContractStatus } from '@/types'

type BillingFilter = 'all' | ContractBillingRuleType | 'both'

const store = useAppStore()
const router = useRouter()

const keyword = ref('')
const statusFilter = ref<'all' | ServiceContractStatus>('all')
const billingFilter = ref<BillingFilter>('all')
const dateRange = ref<[string, string] | null>(null)
const page = ref(1)
const pageSize = ref(8)
const selectedIds = ref<string[]>([])

const avatarColors = ['#5b4fdb', '#409eff', '#67c23a', '#e6a23c', '#f56c6c']

function avatarColor(name: string) {
  return avatarColors[name.charCodeAt(0) % avatarColors.length]
}

const tableData = computed(() =>
  store.serviceContracts
    .map((c) => {
      const enterprise = store.enterprises.find((e) => e.id === c.enterpriseId)
      const provider = store.serviceProviders.find((p) => p.id === c.providerId)
      const displayStatus = resolveContractDisplayStatus(c)
      const hasHourly = contractHasBillingType(c, 'hourly')
      const hasTask = contractHasBillingType(c, 'task')
      const hasBoth = hasHourly && hasTask
      return {
        ...c,
        enterpriseName: enterprise?.name ?? '-',
        providerName: provider?.name ?? '-',
        displayStatus,
        statusMeta: contractStatusMap[displayStatus],
        hasHourly,
        hasTask,
        hasBoth,
        billingItems: getContractBillingListItems(c),
        expiryLabel: formatContractExpiry(c.expiryDate, c.contractTerm),
      }
    })
    .filter((row) => {
      if (statusFilter.value !== 'all' && row.displayStatus !== statusFilter.value) return false
      if (billingFilter.value === 'hourly' && !row.hasHourly) return false
      if (billingFilter.value === 'task' && !row.hasTask) return false
      if (billingFilter.value === 'both' && !row.hasBoth) return false
      if (dateRange.value) {
        const [from, to] = dateRange.value
        if (row.effectiveDate < from || row.effectiveDate > to) return false
      }
      if (!keyword.value.trim()) return true
      const kw = keyword.value.trim().toLowerCase()
      return (
        row.contractNo.toLowerCase().includes(kw) ||
        row.enterpriseName.toLowerCase().includes(kw) ||
        row.providerName.toLowerCase().includes(kw) ||
        row.name.toLowerCase().includes(kw)
      )
    })
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate)),
)

const pagedData = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return tableData.value.slice(start, start + pageSize.value)
})

const totalCount = computed(() => tableData.value.length)

function resetFilters() {
  keyword.value = ''
  statusFilter.value = 'all'
  billingFilter.value = 'all'
  dateRange.value = null
  page.value = 1
}

function handleSelection(rows: ServiceContract[]) {
  selectedIds.value = rows.map((r) => r.id)
}

function openDetail(row: ServiceContract) {
  router.push(`/contracts/${row.id}`)
}

async function terminate(row: ServiceContract & { enterpriseName: string }) {
  try {
    await ElMessageBox.confirm(`确定终止「${row.enterpriseName}」的合约 ${row.contractNo}？`, '终止合约', {
      type: 'warning',
    })
    store.terminateServiceContract(row.id)
    ElMessage.success('合约已终止')
  } catch {
    // cancelled
  }
}

function renew(row: ServiceContract) {
  store.renewServiceContract(row.id)
  ElMessage.success('续约成功，到期日已延长一年')
}
</script>

<template>
  <div class="contract-list-page">
    <div class="page-header-row">
      <el-button type="primary" @click="router.push('/contracts/create')">
        <el-icon><Plus /></el-icon>
        新增合约
      </el-button>
    </div>

    <div class="page-card filter-card">
      <div class="filter-row">
        <el-input
          v-model="keyword"
          placeholder="搜索合约编号、企业名称、服务商名称..."
          clearable
          prefix-icon="Search"
          class="search-input"
        />
        <el-select v-model="billingFilter" placeholder="计费方式" style="width: 160px">
          <el-option label="全部方式" value="all" />
          <el-option :label="billingRuleTypeMap.hourly.label" value="hourly" />
          <el-option :label="billingRuleTypeMap.task.label" value="task" />
          <el-option label="工时 + 任务" value="both" />
        </el-select>
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="合约日期"
          end-placeholder="结束日期"
          value-format="YYYY-MM-DD"
          style="width: 260px"
        />
        <el-button text @click="resetFilters">
          <el-icon><RefreshLeft /></el-icon>
          重置筛选
        </el-button>
      </div>

      <el-radio-group v-model="statusFilter" class="status-tabs" @change="page = 1">
        <el-radio-button value="all">全部</el-radio-button>
        <el-radio-button value="active">生效中</el-radio-button>
        <el-radio-button value="expiring">即将到期</el-radio-button>
        <el-radio-button value="expired">已到期</el-radio-button>
        <el-radio-button value="terminated">已终止</el-radio-button>
      </el-radio-group>
    </div>

    <div class="page-card table-card">
      <div class="table-toolbar">
        <div class="table-title">
          合约列表
          <el-tag size="small" round>{{ store.serviceContracts.length }}</el-tag>
        </div>
        <span class="selection-tip">已选择 {{ selectedIds.length }} 项</span>
      </div>

      <el-table :data="pagedData" border stripe @selection-change="handleSelection">
        <el-table-column type="selection" width="48" />
        <el-table-column prop="contractNo" label="合约编号" width="150">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row)">{{ row.contractNo }}</el-button>
          </template>
        </el-table-column>
        <el-table-column label="企业名称" min-width="180">
          <template #default="{ row }">
            <div class="name-cell">
              <span class="name-avatar" :style="{ background: avatarColor(row.enterpriseName) }">
                {{ row.enterpriseName.charAt(0) }}
              </span>
              <span>{{ row.enterpriseName }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="providerName" label="服务商" min-width="150" show-overflow-tooltip />
        <el-table-column label="计费配置" min-width="280">
          <template #default="{ row }">
            <div class="billing-config-cell">
              <div
                v-for="item in row.billingItems"
                :key="item.type"
                class="billing-config-row"
              >
                <el-tag
                  size="small"
                  :type="item.type === 'hourly' ? 'primary' : 'success'"
                  class="billing-type-tag"
                >
                  {{ item.typeLabel }}
                </el-tag>
                <span class="billing-rate">{{ item.rateLabel }}</span>
                <span class="billing-method">{{ item.chargeMethodLabel }}</span>
              </div>
              <span v-if="row.hasBoth" class="billing-combined-tip">组合计费</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="effectiveDate" label="生效日期" width="110" />
        <el-table-column label="到期日期" width="110">
          <template #default="{ row }">{{ row.expiryLabel }}</template>
        </el-table-column>
        <el-table-column label="状态" width="110">
          <template #default="{ row }">
            <span class="status-dot" :style="{ background: row.statusMeta.dot }" />
            {{ row.statusMeta.label }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="260" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row)">查看</el-button>
            <el-button
              v-if="row.displayStatus !== 'terminated'"
              link
              type="primary"
              @click="router.push(`/contracts/${row.id}/edit`)"
            >
              编辑
            </el-button>
            <el-button
              v-if="row.displayStatus === 'expiring' || row.displayStatus === 'expired'"
              link
              type="primary"
              @click="renew(row)"
            >
              续约
            </el-button>
            <el-button
              v-if="row.displayStatus !== 'terminated'"
              link
              type="danger"
              @click="terminate(row)"
            >
              终止
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <div class="table-footer">
        <span class="text-muted">
          显示 {{ totalCount ? (page - 1) * pageSize + 1 : 0 }}-{{
            Math.min(page * pageSize, totalCount)
          }}
          条，共 {{ totalCount }} 条记录
        </span>
        <el-pagination
          v-model:current-page="page"
          :page-size="pageSize"
          :total="totalCount"
          layout="prev, pager, next"
          background
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.contract-list-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.page-header-row {
  display: flex;
  justify-content: flex-end;
}

.filter-card {
  padding: 16px 20px;
}

.filter-row {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  align-items: center;
}

.search-input {
  flex: 1;
  min-width: 280px;
}

.status-tabs {
  margin-top: 14px;
}

.table-card {
  padding: 0 0 12px;
  overflow: hidden;
}

.table-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 20px;
  border-bottom: 1px solid #ebeef5;
}

.table-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  font-size: 15px;
}

.selection-tip {
  font-size: 13px;
  color: #909399;
}

.name-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}

.name-avatar {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.billing-config-cell {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 2px 0;
}

.billing-config-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  line-height: 1.4;
}

.billing-type-tag {
  flex-shrink: 0;
}

.billing-rate {
  font-size: 13px;
  color: #303133;
  font-weight: 500;
}

.billing-method {
  font-size: 12px;
  color: #909399;
}

.billing-combined-tip {
  font-size: 11px;
  color: #e6a23c;
  line-height: 1;
}

.status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
}

.table-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px 0;
}
</style>
