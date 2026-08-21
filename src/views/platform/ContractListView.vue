<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import {
  billingRuleTypeMap,
  contractApprovalStatusMap,
  contractRenewPeriodOptions,
  contractStatusMap,
  formatContractExpiry,
  formatSettlementConfig,
  resolveContractApprovalStatus,
  resolveContractDisplayStatus,
  resolveContractRenewBaseDate,
  addContractRenewPeriod,
  type ContractRenewPeriod,
} from '@/constants/partnership'
import {
  contractHasBillingType,
  formatContractBillingSummary,
  getContractBillingListItems,
} from '@/services/contractBilling'
import { getEffectiveVersion } from '@/services/contractVersion'
import type {
  ContractApprovalStatus,
  ContractBillingRuleType,
  ServiceContract,
  ServiceContractStatus,
} from '@/types'

type BillingFilter = 'all' | ContractBillingRuleType | 'both'

const store = useAppStore()
const router = useRouter()

const keyword = ref('')
const statusFilter = ref<'all' | ServiceContractStatus>('all')
const approvalFilter = ref<'all' | ContractApprovalStatus>('all')
const billingFilter = ref<BillingFilter>('all')
const dateRange = ref<[string, string] | null>(null)
const page = ref(1)
const pageSize = ref(8)
const selectedIds = ref<string[]>([])

const approveVisible = ref(false)
const approveTarget = ref<(ServiceContract & { enterpriseName?: string; providerName?: string }) | null>(null)
const approveRemark = ref('')
const approveAction = ref<'approve' | 'reject'>('approve')
const approverName = ref('平台负责人')

const renewVisible = ref(false)
const renewTarget = ref<(ServiceContract & { enterpriseName?: string }) | null>(null)
const renewPeriod = ref<ContractRenewPeriod>('1m')

const avatarColors = ['#5b4fdb', '#409eff', '#67c23a', '#e6a23c', '#f56c6c']

function avatarColor(name: string) {
  return avatarColors[name.charCodeAt(0) % avatarColors.length]
}

function formatDateTime(iso?: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-CN')
}

const approveDetail = computed(() => {
  const c = approveTarget.value
  if (!c) return null
  const full = store.serviceContracts.find((x) => x.id === c.id) ?? c
  const pending =
    (full.versions ?? []).find((v) => v.status === 'pending') ||
    (full.versions ?? []).find((v) => v.status === 'draft' || v.status === 'rejected')
  const view = pending ?? full
  const enterprise = store.enterprises.find((e) => e.id === full.enterpriseId)
  const provider = store.serviceProviders.find((p) => p.id === full.providerId)
  const effective = getEffectiveVersion(full)
  return {
    ...full,
    ...view,
    id: full.id,
    contractNo: full.contractNo,
    enterpriseName: enterprise?.name ?? c.enterpriseName ?? '-',
    providerName: provider?.name ?? c.providerName ?? '-',
    billingSummary: formatContractBillingSummary(view as ServiceContract),
    settlementLabel: formatSettlementConfig(view as ServiceContract),
    expiryLabel: formatContractExpiry(view.expiryDate, view.contractTerm),
    billingItems: getContractBillingListItems(view as ServiceContract),
    pendingVersion: pending?.version,
    effectiveVersion: effective?.version,
    changeNote: pending?.changeNote,
  }
})

const tableData = computed(() => {
  const seen = new Set<string>()
  return store.serviceContracts
    .map((c) => {
      const enterprise = store.enterprises.find((e) => e.id === c.enterpriseId)
      const provider = store.serviceProviders.find((p) => p.id === c.providerId)
      const displayStatus = resolveContractDisplayStatus(c)
      const approvalStatus = resolveContractApprovalStatus(c)
      const hasHourly = contractHasBillingType(c, 'hourly')
      const hasTask = contractHasBillingType(c, 'task')
      const hasBoth = hasHourly && hasTask
      return {
        ...c,
        enterpriseName: enterprise?.name ?? '-',
        providerName: provider?.name ?? '-',
        displayStatus,
        statusMeta: contractStatusMap[displayStatus],
        approvalStatus,
        approvalMeta: contractApprovalStatusMap[approvalStatus],
        hasHourly,
        hasTask,
        hasBoth,
        billingItems: getContractBillingListItems(c),
        expiryLabel: formatContractExpiry(c.expiryDate, c.contractTerm),
        versionLabel: c.currentVersion ? `V${c.currentVersion}` : '—',
        versionCount: c.versions?.length ?? 0,
        pairKey: `${c.enterpriseId}::${c.providerId}`,
      }
    })
    // 企业+服务商唯一：列表只展示一条主档（优先非终止）
    .sort((a, b) => {
      if (a.status === 'terminated' && b.status !== 'terminated') return 1
      if (a.status !== 'terminated' && b.status === 'terminated') return -1
      return b.effectiveDate.localeCompare(a.effectiveDate)
    })
    .filter((row) => {
      if (seen.has(row.pairKey)) return false
      seen.add(row.pairKey)
      return true
    })
    .filter((row) => {
      if (statusFilter.value !== 'all' && row.displayStatus !== statusFilter.value) return false
      if (approvalFilter.value !== 'all' && row.approvalStatus !== approvalFilter.value) return false
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
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))
})

const pagedData = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return tableData.value.slice(start, start + pageSize.value)
})

const totalCount = computed(() => tableData.value.length)

function resetFilters() {
  keyword.value = ''
  statusFilter.value = 'all'
  approvalFilter.value = 'all'
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

function canSubmit(row: { approvalStatus: ContractApprovalStatus; displayStatus: ServiceContractStatus }) {
  return (
    row.displayStatus !== 'terminated' &&
    (row.approvalStatus === 'draft' || row.approvalStatus === 'rejected')
  )
}

function canApprove(row: { approvalStatus: ContractApprovalStatus }) {
  return row.approvalStatus === 'pending'
}

function canRenew(row: { displayStatus: ServiceContractStatus }) {
  return row.displayStatus === 'expiring' || row.displayStatus === 'expired'
}

function canTerminate(row: {
  displayStatus: ServiceContractStatus
  approvalStatus: ContractApprovalStatus
}) {
  return row.displayStatus !== 'terminated' && row.approvalStatus === 'approved'
}

function canRestore(row: { displayStatus: ServiceContractStatus; expiryDate: string }) {
  if (row.displayStatus !== 'terminated') return false
  const today = new Date().toISOString().slice(0, 10)
  return Boolean(row.expiryDate) && row.expiryDate >= today
}

const renewPreviewExpiry = computed(() => {
  if (!renewTarget.value) return '—'
  const base = resolveContractRenewBaseDate(renewTarget.value.expiryDate)
  return addContractRenewPeriod(base, renewPeriod.value)
})

async function submitApproval(row: ServiceContract & { enterpriseName: string }) {
  try {
    await ElMessageBox.confirm(
      `确定提交「${row.enterpriseName}」合同 ${row.contractNo} 给负责人审批？`,
      '提交审批',
      { type: 'info' },
    )
    store.submitServiceContractForApproval(row.id)
    ElMessage.success('已提交审批')
  } catch (e) {
    if (e === 'cancel' || e === 'close') return
    ElMessage.warning(e instanceof Error ? e.message : '提交失败')
  }
}

function openApprove(row: ServiceContract & { enterpriseName?: string; providerName?: string }) {
  approveTarget.value = row
  approveAction.value = 'approve'
  approveRemark.value = ''
  approveVisible.value = true
}

function confirmApprove() {
  if (!approveTarget.value) return
  const operator = approverName.value.trim() || '平台负责人'
  try {
    if (approveAction.value === 'approve') {
      store.approveServiceContract(approveTarget.value.id, approveRemark.value, operator)
      ElMessage.success(`审批已通过（${operator} · ${new Date().toLocaleString('zh-CN')}）`)
    } else {
      if (!approveRemark.value.trim()) {
        ElMessage.warning('请填写驳回原因')
        return
      }
      store.rejectServiceContract(approveTarget.value.id, approveRemark.value, operator)
      ElMessage.success('已驳回，操作员可修改后重新提交')
    }
    approveVisible.value = false
  } catch (e) {
    ElMessage.warning(e instanceof Error ? e.message : '操作失败')
  }
}

async function terminate(row: ServiceContract & { enterpriseName: string }) {
  try {
    await ElMessageBox.confirm(
      `确认终止「${row.enterpriseName}」的合同 ${row.contractNo} 吗？终止后合同将不再生效。`,
      '确认终止',
      {
        type: 'warning',
        confirmButtonText: '确认终止',
        cancelButtonText: '取消',
      },
    )
    store.terminateServiceContract(row.id)
    ElMessage.success('合同已终止')
  } catch (e) {
    if (e === 'cancel' || e === 'close') return
    ElMessage.warning(e instanceof Error ? e.message : '终止失败')
  }
}

function openRenew(row: ServiceContract & { enterpriseName?: string }) {
  renewTarget.value = row
  renewPeriod.value = '1m'
  renewVisible.value = true
}

function confirmRenew() {
  if (!renewTarget.value) return
  try {
    const updated = store.extendServiceContract(renewTarget.value.id, renewPeriod.value)
    ElMessage.success(`续约成功，新到期日：${updated.expiryDate}`)
    renewVisible.value = false
  } catch (e) {
    ElMessage.warning(e instanceof Error ? e.message : '续约失败')
  }
}

async function restore(row: ServiceContract & { enterpriseName: string }) {
  try {
    await ElMessageBox.confirm(
      `确认恢复「${row.enterpriseName}」的合同 ${row.contractNo} 吗？恢复后合同将回到生效状态。`,
      '确认恢复',
      {
        type: 'info',
        confirmButtonText: '确认恢复',
        cancelButtonText: '取消',
      },
    )
    store.restoreServiceContract(row.id)
    ElMessage.success('合同已恢复生效')
  } catch (e) {
    if (e === 'cancel' || e === 'close') return
    ElMessage.warning(e instanceof Error ? e.message : '恢复失败')
  }
}
</script>

<template>
  <div class="contract-list-page">
    <div class="page-header-row">
      <el-button type="primary" @click="router.push('/contracts/create')">
        <el-icon><Plus /></el-icon>
        新增合同
      </el-button>
    </div>

    <div class="page-card filter-card">
      <div class="filter-row">
        <el-input
          v-model="keyword"
          placeholder="搜索合同编号、企业名称、服务商名称..."
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
        <el-select v-model="approvalFilter" placeholder="审批状态" style="width: 140px" @change="page = 1">
          <el-option label="全部审批" value="all" />
          <el-option label="待提交" value="draft" />
          <el-option label="待审批" value="pending" />
          <el-option label="已通过" value="approved" />
          <el-option label="已驳回" value="rejected" />
        </el-select>
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          range-separator="至"
          start-placeholder="合同日期"
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
        <el-radio-button value="draft">草稿</el-radio-button>
        <el-radio-button value="terminated">已终止</el-radio-button>
      </el-radio-group>
    </div>

    <div class="page-card table-card">
      <div class="table-toolbar">
        <div class="table-title">
          合同列表
          <el-tag size="small" round>{{ totalCount }}</el-tag>
        </div>
        <span class="selection-tip">已选择 {{ selectedIds.length }} 项</span>
      </div>

      <el-table :data="pagedData" border stripe @selection-change="handleSelection">
        <el-table-column type="selection" width="48" />
        <el-table-column prop="contractNo" label="合同编号" width="150">
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
        <el-table-column label="服务费配置" min-width="240">
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
              </div>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="合同期限" min-width="200">
          <template #default="{ row }">
            {{ row.effectiveDate }} ~ {{ row.expiryLabel }}
          </template>
        </el-table-column>
        <el-table-column label="生效版本" width="100">
          <template #default="{ row }">
            <el-tag size="small" type="success">{{ row.versionLabel }}</el-tag>
            <span v-if="row.versionCount > 1" class="ver-count">/{{ row.versionCount }}版</span>
          </template>
        </el-table-column>
        <el-table-column label="创建时间" width="170">
          <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
        </el-table-column>
        <el-table-column label="合同状态" width="100">
          <template #default="{ row }">
            <span class="status-dot" :style="{ background: row.statusMeta.dot }" />
            {{ row.statusMeta.label }}
          </template>
        </el-table-column>
        <el-table-column label="审批状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.approvalMeta.type" size="small">{{ row.approvalMeta.label }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="340" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row)">查看</el-button>
            <el-button
              v-if="row.displayStatus !== 'terminated' && row.approvalStatus !== 'pending'"
              link
              type="primary"
              @click="router.push(`/contracts/${row.id}/edit`)"
            >
              编辑
            </el-button>
            <el-button
              v-if="canSubmit(row)"
              link
              type="warning"
              @click="submitApproval(row)"
            >
              提交审批
            </el-button>
            <el-button
              v-if="canApprove(row)"
              link
              type="success"
              @click="openApprove(row)"
            >
              审批
            </el-button>
            <el-button
              v-if="canRenew(row)"
              link
              type="primary"
              @click="openRenew(row)"
            >
              续约
            </el-button>
            <el-button
              v-if="canTerminate(row)"
              link
              type="danger"
              @click="terminate(row)"
            >
              终止
            </el-button>
            <el-button
              v-if="canRestore(row)"
              link
              type="success"
              @click="restore(row)"
            >
              恢复
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

    <el-drawer
      v-model="approveVisible"
      title="合同审批"
      size="640px"
      destroy-on-close
    >
      <template v-if="approveDetail">
        <div class="approve-section">
          <h4>待审版本配置</h4>
          <p v-if="approveDetail.pendingVersion" class="approve-version-tip">
            审批对象：V{{ approveDetail.pendingVersion }}
            <template v-if="approveDetail.effectiveVersion">
              （当前生效仍为 V{{ approveDetail.effectiveVersion }}，通过后切换）
            </template>
          </p>
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="合同编号">{{ approveDetail.contractNo }}</el-descriptions-item>
            <el-descriptions-item label="合同名称">{{ approveDetail.name }}</el-descriptions-item>
            <el-descriptions-item label="企业">{{ approveDetail.enterpriseName }}</el-descriptions-item>
            <el-descriptions-item label="服务商">{{ approveDetail.providerName }}</el-descriptions-item>
            <el-descriptions-item label="签约日期">{{ approveDetail.signingDate }}</el-descriptions-item>
            <el-descriptions-item label="生效 / 到期">
              {{ approveDetail.effectiveDate }} ~ {{ approveDetail.expiryLabel }}
            </el-descriptions-item>
            <el-descriptions-item label="结算周期">{{ approveDetail.settlementLabel }}</el-descriptions-item>
            <el-descriptions-item label="服务费配置">{{ approveDetail.billingSummary }}</el-descriptions-item>
            <el-descriptions-item label="改版/续约说明">{{ approveDetail.changeNote || '—' }}</el-descriptions-item>
            <el-descriptions-item label="备注">{{ approveDetail.remark || '—' }}</el-descriptions-item>
          </el-descriptions>
          <div v-if="approveDetail.billingItems.length" class="billing-preview">
            <div
              v-for="item in approveDetail.billingItems"
              :key="item.type"
              class="billing-config-row"
            >
              <el-tag size="small" :type="item.type === 'hourly' ? 'primary' : 'success'">
                {{ item.typeLabel }}
              </el-tag>
              <span class="billing-rate">{{ item.rateLabel }}</span>
              <span class="billing-rate">{{ item.chargeMethodLabel }}</span>
            </div>
          </div>
        </div>

        <div class="approve-section">
          <h4>提交信息</h4>
          <el-descriptions :column="1" border size="small">
            <el-descriptions-item label="提交人">{{ approveDetail.submittedBy || '—' }}</el-descriptions-item>
            <el-descriptions-item label="提交时间">{{ formatDateTime(approveDetail.submittedAt) }}</el-descriptions-item>
          </el-descriptions>
        </div>

        <div class="approve-section">
          <h4>审批操作</h4>
          <el-radio-group v-model="approveAction" class="approve-action-group">
            <el-radio-button value="approve">审批通过</el-radio-button>
            <el-radio-button value="reject">驳回</el-radio-button>
          </el-radio-group>
          <el-form label-position="top" class="approve-form">
            <el-form-item label="审批人">
              <el-input v-model="approverName" placeholder="记录操作员姓名" />
            </el-form-item>
            <el-form-item
              :label="approveAction === 'approve' ? '审批意见（可选）' : '驳回原因（必填）'"
              :required="approveAction === 'reject'"
            >
              <el-input
                v-model="approveRemark"
                type="textarea"
                :rows="3"
                :placeholder="
                  approveAction === 'approve'
                    ? '可填写审批意见'
                    : '请填写驳回原因（必填）'
                "
              />
            </el-form-item>
          </el-form>
          <p class="approve-tip">
            {{
              approveAction === 'approve'
                ? '通过后将记录审批人与审批时间，合同立即生效。'
                : '驳回须填写原因，操作员修改后需再次提交审批。'
            }}
          </p>
        </div>
      </template>
      <template #footer>
        <el-button @click="approveVisible = false">取消</el-button>
        <el-button
          :type="approveAction === 'approve' ? 'primary' : 'danger'"
          @click="confirmApprove"
        >
          {{ approveAction === 'approve' ? '确认通过' : '确认驳回' }}
        </el-button>
      </template>
    </el-drawer>

    <el-dialog
      v-model="renewVisible"
      title="续约延期"
      width="440px"
      destroy-on-close
    >
      <template v-if="renewTarget">
        <p class="renew-tip">
          「{{ renewTarget.enterpriseName }}」合同 {{ renewTarget.contractNo }}
          <br />
          当前到期日：{{ renewTarget.expiryDate }}
        </p>
        <el-form label-width="96px">
          <el-form-item label="延期周期" required>
            <el-radio-group v-model="renewPeriod">
              <el-radio
                v-for="opt in contractRenewPeriodOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="新到期日">
            <span class="renew-preview">{{ renewPreviewExpiry }}</span>
          </el-form-item>
        </el-form>
      </template>
      <template #footer>
        <el-button @click="renewVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmRenew">确认续约</el-button>
      </template>
    </el-dialog>
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
}

.table-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 650;
}

.selection-tip {
  font-size: 12px;
  color: #909399;
}

.name-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.name-avatar {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  flex-shrink: 0;
}

.billing-config-cell {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.billing-config-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.billing-rate {
  font-size: 12px;
  color: #606266;
}

.status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
  vertical-align: middle;
}

.table-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 20px 4px;
}

.approve-tip {
  margin: 0 0 12px;
  color: #606266;
  font-size: 13px;
}

.approve-section {
  margin-bottom: 20px;
}

.approve-section h4 {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 650;
}

.approve-version-tip {
  margin: 0 0 10px;
  font-size: 13px;
  color: #606266;
}

.billing-preview {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 10px;
}

.approve-action-group {
  margin-bottom: 12px;
}

.approve-form {
  margin-top: 4px;
}

.ver-count {
  margin-left: 4px;
  font-size: 12px;
  color: #909399;
}

.renew-tip {
  margin: 0 0 16px;
  line-height: 1.6;
  color: #606266;
}

.renew-preview {
  font-weight: 600;
  color: #303133;
}
</style>
