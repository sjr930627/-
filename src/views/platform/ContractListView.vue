<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import {
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
  formatContractBillingSummary,
  getContractBillingListItems,
} from '@/services/contractBilling'
import { getEffectiveVersion } from '@/services/contractVersion'
import type {
  ContractApprovalStatus,
  ServiceContract,
  ServiceContractStatus,
} from '@/types'

const store = useAppStore()
const router = useRouter()

const contractNo = ref('')
const enterpriseName = ref('')
const providerName = ref('')
const statusFilter = ref<'all' | ServiceContractStatus>('all')
const approvalFilter = ref<'all' | ContractApprovalStatus>('all')
const createdRange = ref<[string, string] | null>(null)

/** 点击「查询」后生效 */
const appliedContractNo = ref('')
const appliedEnterpriseName = ref('')
const appliedProviderName = ref('')
const appliedStatus = ref<'all' | ServiceContractStatus>('all')
const appliedApproval = ref<'all' | ContractApprovalStatus>('all')
const appliedCreatedRange = ref<[string, string] | null>(null)

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

/** 创建时间取年月日，兼容 ISO 与 YYYY-MM-DD */
function createdDateOnly(iso?: string) {
  if (!iso) return ''
  return iso.slice(0, 10)
}

function onCreatedRangeChange(val: [string, string] | null) {
  if (!val) {
    createdRange.value = null
    return
  }
  const [from, to] = val
  if (from && to && to < from) {
    ElMessage.warning('结束时间不能早于开始时间')
    createdRange.value = [from, from]
    return
  }
  createdRange.value = val
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
  const noKw = appliedContractNo.value.trim()
  const entKw = appliedEnterpriseName.value.trim().toLowerCase()
  const providerKw = appliedProviderName.value.trim().toLowerCase()

  return store.serviceContracts
    .map((c) => {
      const enterprise = store.enterprises.find((e) => e.id === c.enterpriseId)
      const provider = store.serviceProviders.find((p) => p.id === c.providerId)
      const displayStatus = resolveContractDisplayStatus(c)
      const approvalStatus = resolveContractApprovalStatus(c)
      return {
        ...c,
        enterpriseName: enterprise?.name ?? '-',
        providerName: provider?.name ?? '-',
        displayStatus,
        statusMeta: contractStatusMap[displayStatus],
        approvalStatus,
        approvalMeta: contractApprovalStatusMap[approvalStatus],
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
      if (noKw && row.contractNo !== noKw) return false
      if (entKw && !row.enterpriseName.toLowerCase().includes(entKw)) return false
      if (providerKw && !row.providerName.toLowerCase().includes(providerKw)) return false
      if (appliedStatus.value !== 'all' && row.displayStatus !== appliedStatus.value) return false
      if (appliedApproval.value !== 'all' && row.approvalStatus !== appliedApproval.value) {
        return false
      }
      if (appliedCreatedRange.value) {
        const [from, to] = appliedCreatedRange.value
        const created = createdDateOnly(row.createdAt)
        if (!created || created < from || created > to) return false
      }
      return true
    })
    .sort((a, b) => b.effectiveDate.localeCompare(a.effectiveDate))
})

const pagedData = computed(() => {
  const start = (page.value - 1) * pageSize.value
  return tableData.value.slice(start, start + pageSize.value)
})

const totalCount = computed(() => tableData.value.length)

function runQuery() {
  if (createdRange.value) {
    const [from, to] = createdRange.value
    if (from && to && to < from) {
      ElMessage.warning('结束时间不能早于开始时间')
      return
    }
  }
  appliedContractNo.value = contractNo.value
  appliedEnterpriseName.value = enterpriseName.value
  appliedProviderName.value = providerName.value
  appliedStatus.value = statusFilter.value
  appliedApproval.value = approvalFilter.value
  appliedCreatedRange.value = createdRange.value ? [...createdRange.value] : null
  page.value = 1
}

function resetFilters() {
  contractNo.value = ''
  enterpriseName.value = ''
  providerName.value = ''
  statusFilter.value = 'all'
  approvalFilter.value = 'all'
  createdRange.value = null
  appliedContractNo.value = ''
  appliedEnterpriseName.value = ''
  appliedProviderName.value = ''
  appliedStatus.value = 'all'
  appliedApproval.value = 'all'
  appliedCreatedRange.value = null
  page.value = 1
}

function handleSelection(rows: ServiceContract[]) {
  selectedIds.value = rows.map((r) => r.id)
}

function openDetail(row: ServiceContract) {
  router.push(`/contracts/${row.id}`)
}

function canApprove(row: { approvalStatus: ContractApprovalStatus }) {
  return row.approvalStatus === 'pending'
}

function canRenew(row: { displayStatus: ServiceContractStatus }) {
  return row.displayStatus === 'expiring' || row.displayStatus === 'expired'
}

function canTerminate(row: { displayStatus: ServiceContractStatus }) {
  return row.displayStatus === 'active' || row.displayStatus === 'expiring'
}

function canDelete(row: {
  displayStatus: ServiceContractStatus
  approvalStatus: ContractApprovalStatus
}) {
  return (
    row.displayStatus === 'draft' &&
    (row.approvalStatus === 'draft' || row.approvalStatus === 'rejected')
  )
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
      `是否终止合同「${row.contractNo}」（${row.enterpriseName}）？终止后合同将不再生效。`,
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

async function removeContract(row: ServiceContract & { enterpriseName: string }) {
  try {
    await ElMessageBox.confirm(
      `是否删除合同「${row.contractNo}」（${row.enterpriseName}）？删除后不可恢复。`,
      '确认删除',
      {
        type: 'warning',
        confirmButtonText: '确认删除',
        cancelButtonText: '取消',
      },
    )
    store.deleteServiceContract(row.id)
    ElMessage.success('合同已删除')
  } catch (e) {
    if (e === 'cancel' || e === 'close') return
    ElMessage.warning(e instanceof Error ? e.message : '删除失败')
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
      <div class="filter-grid">
        <el-input
          v-model="contractNo"
          placeholder="合同编号（精确）"
          clearable
          @keyup.enter="runQuery"
        />
        <el-input
          v-model="enterpriseName"
          placeholder="企业名称（模糊）"
          clearable
          @keyup.enter="runQuery"
        />
        <el-input
          v-model="providerName"
          placeholder="服务商名称（模糊）"
          clearable
          @keyup.enter="runQuery"
        />
        <el-select v-model="approvalFilter" placeholder="审批状态">
          <el-option label="全部审批" value="all" />
          <el-option label="待提交" value="draft" />
          <el-option label="待审批" value="pending" />
          <el-option label="已通过" value="approved" />
          <el-option label="已驳回" value="rejected" />
        </el-select>
        <el-select v-model="statusFilter" placeholder="合同状态">
          <el-option label="全部" value="all" />
          <el-option label="生效中" value="active" />
          <el-option label="即将到期" value="expiring" />
          <el-option label="已到期" value="expired" />
          <el-option label="草稿" value="draft" />
          <el-option label="已终止" value="terminated" />
        </el-select>
        <el-date-picker
          :model-value="createdRange"
          type="daterange"
          range-separator="至"
          start-placeholder="创建开始"
          end-placeholder="创建结束"
          format="YYYY-MM-DD"
          value-format="YYYY-MM-DD"
          style="width: 100%"
          @update:model-value="onCreatedRangeChange"
        />
        <div class="filter-actions">
          <el-button type="primary" @click="runQuery">查询</el-button>
          <el-button text @click="resetFilters">
            <el-icon><RefreshLeft /></el-icon>
            重置筛选
          </el-button>
        </div>
      </div>
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
              <el-button link type="primary" class="name-link" @click="openDetail(row)">
                {{ row.enterpriseName }}
              </el-button>
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
        <el-table-column label="操作" width="300" fixed="right">
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
              v-if="canDelete(row)"
              link
              type="danger"
              @click="removeContract(row)"
            >
              删除
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

.filter-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(160px, 1fr));
  gap: 12px;
  align-items: center;
}

.filter-actions {
  grid-column: 1 / -1;
  display: flex;
  gap: 8px;
  align-items: center;
}

@media (max-width: 1100px) {
  .filter-grid {
    grid-template-columns: repeat(2, minmax(140px, 1fr));
  }
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

.name-link {
  padding: 0;
  height: auto;
  font-weight: 500;
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
