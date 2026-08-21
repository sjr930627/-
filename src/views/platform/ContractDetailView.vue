<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import {
  billingRuleTypeMap,
  contractApprovalStatusMap,
  contractServiceFeeCategoryMap,
  contractStatusMap,
  contractTermOptions,
  contractVersionStatusMap,
  formatContractExpiry,
  formatSettlementConfig,
  resolveContractApprovalStatus,
  resolveContractDisplayStatus,
} from '@/constants/partnership'
import {
  ensureServiceFees,
  formatBillingRuleRate,
  formatServiceFeeRateValue,
  formatTaxIncludedLabel,
  getContractBillingRules,
  unitPriceTaxFieldLabel,
} from '@/services/contractBilling'
import { ensureContractVersions } from '@/services/contractVersion'
import type { ServiceContractVersion } from '@/types'

const route = useRoute()
const router = useRouter()
const store = useAppStore()

const contract = computed(() => {
  const found = store.serviceContracts.find((c) => c.id === route.params.id as string)
  if (found) ensureContractVersions(found)
  return found
})

const enterprise = computed(() =>
  contract.value ? store.enterprises.find((e) => e.id === contract.value!.enterpriseId) : null,
)

const provider = computed(() =>
  contract.value ? store.serviceProviders.find((p) => p.id === contract.value!.providerId) : null,
)

const displayStatus = computed(() =>
  contract.value ? resolveContractDisplayStatus(contract.value) : 'draft',
)

const approvalStatus = computed(() =>
  contract.value ? resolveContractApprovalStatus(contract.value) : 'draft',
)

const approvalMeta = computed(() => contractApprovalStatusMap[approvalStatus.value])
const statusMeta = computed(() => contractStatusMap[displayStatus.value])

const versionList = computed(() =>
  [...(contract.value?.versions ?? [])].sort((a, b) => b.version - a.version),
)

const selectedVersionId = ref<string>('')

watch(
  contract,
  (c) => {
    if (!c) return
    const preferred =
      versionList.value.find((v) => v.status === 'pending' || v.status === 'draft' || v.status === 'rejected') ||
      versionList.value.find((v) => v.status === 'effective') ||
      versionList.value[0]
    selectedVersionId.value = preferred?.id ?? ''
  },
  { immediate: true },
)

const viewingVersion = computed<ServiceContractVersion | null>(() => {
  if (!contract.value) return null
  return versionList.value.find((v) => v.id === selectedVersionId.value) ?? null
})

const viewingConfig = computed(() => viewingVersion.value || contract.value)

const billingRules = computed(() =>
  viewingConfig.value ? getContractBillingRules(viewingConfig.value as never) : [],
)

const termLabel = computed(() => {
  if (!viewingConfig.value) return '-'
  const term = viewingConfig.value.contractTerm
  if (term) return contractTermOptions.find((o) => o.value === term)?.label ?? '-'
  return '-'
})

function chargeMethodLabel(method: 'fixed' | 'percentage') {
  return method === 'fixed' ? '固定金额' : '比率（百分比）'
}

function formatDateTime(iso?: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-CN')
}

function selectVersion(id: string) {
  selectedVersionId.value = id
}

function versionRowClassName({ row }: { row: ServiceContractVersion }) {
  return row.id === selectedVersionId.value ? 'is-selected-row' : ''
}

function onVersionRowClick(row: ServiceContractVersion) {
  selectVersion(row.id)
}

function versionStatusMeta(status: string) {
  return contractVersionStatusMap[status as ServiceContractVersion['status']]
}

const rejectVisible = ref(false)
const rejectReason = ref('')
const approverName = ref('平台负责人')

function approvePass() {
  if (!contract.value) return
  try {
    const operator = approverName.value.trim() || '平台负责人'
    store.approveServiceContract(contract.value.id, undefined, operator)
    ElMessage.success(`审批已通过（${operator} · ${new Date().toLocaleString('zh-CN')}）`)
  } catch (e) {
    ElMessage.warning(e instanceof Error ? e.message : '操作失败')
  }
}

function openReject() {
  rejectReason.value = ''
  rejectVisible.value = true
}

function confirmReject() {
  if (!contract.value) return
  if (!rejectReason.value.trim()) {
    ElMessage.warning('请填写驳回原因')
    return
  }
  try {
    const operator = approverName.value.trim() || '平台负责人'
    store.rejectServiceContract(contract.value.id, rejectReason.value, operator)
    rejectVisible.value = false
    ElMessage.success('已驳回')
  } catch (e) {
    ElMessage.warning(e instanceof Error ? e.message : '操作失败')
  }
}
</script>

<template>
  <div v-if="contract" class="contract-detail-page">
    <div class="page-breadcrumb-row">
      <el-breadcrumb separator=">">
        <el-breadcrumb-item>企业管理</el-breadcrumb-item>
        <el-breadcrumb-item>合同管理</el-breadcrumb-item>
        <el-breadcrumb-item>合同详情</el-breadcrumb-item>
      </el-breadcrumb>
      <div class="header-actions">
        <el-button @click="router.push('/contracts')">返回列表</el-button>
        <template v-if="approvalStatus === 'pending'">
          <el-input v-model="approverName" style="width: 140px" placeholder="审批人" />
          <el-button type="danger" plain @click="openReject">驳回</el-button>
          <el-button type="primary" @click="approvePass">审批通过</el-button>
        </template>
        <el-button
          v-if="displayStatus !== 'terminated' && approvalStatus !== 'pending'"
          type="primary"
          @click="router.push(`/contracts/${contract.id}/edit`)"
        >
          改版编辑
        </el-button>
        <el-button
          v-if="displayStatus !== 'terminated' && approvalStatus !== 'pending' && contract.currentVersion"
          @click="router.push(`/contracts/${contract.id}/renew`)"
        >
          续约
        </el-button>
      </div>
    </div>

    <div class="page-card unique-tip">
      企业「{{ enterprise?.name }}」与服务商「{{ provider?.name }}」仅保留一份合同主档（列表一行）；
      当前生效版本
      <el-tag size="small" type="success" class="ver-tag">
        {{ contract.currentVersion ? `V${contract.currentVersion}` : '无' }}
      </el-tag>
      。改版/续约提交审批期间仍沿用该生效配置；点击下方版本行可查看对应版本详情。
    </div>

    <div class="detail-layout">
      <div class="detail-main">
        <section class="page-card section-card">
          <div class="section-head">
            <div class="section-icon section-icon--blue">版</div>
            <div>
              <h3>版本记录</h3>
              <p>点击版本可查看该版本的合同明细与配置内容</p>
            </div>
          </div>
          <el-table
            :data="versionList"
            border
            stripe
            highlight-current-row
            :row-class-name="versionRowClassName"
            @row-click="onVersionRowClick"
          >
            <el-table-column label="版本" width="90">
              <template #default="{ row }">V{{ row.version }}</template>
            </el-table-column>
            <el-table-column label="状态" width="110">
              <template #default="{ row }">
                <el-tag :type="versionStatusMeta(row.status).type" size="small">
                  {{ versionStatusMeta(row.status).label }}
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="changeNote" label="改版说明" min-width="180" show-overflow-tooltip />
            <el-table-column label="生效 / 到期" width="200">
              <template #default="{ row }">
                {{ row.effectiveDate }} ~ {{ formatContractExpiry(row.expiryDate, row.contractTerm) }}
              </template>
            </el-table-column>
            <el-table-column label="提交人" width="100">
              <template #default="{ row }">{{ row.submittedBy || '—' }}</template>
            </el-table-column>
            <el-table-column label="审批人" width="100">
              <template #default="{ row }">{{ row.approvedBy || '—' }}</template>
            </el-table-column>
            <el-table-column label="审批时间" width="160">
              <template #default="{ row }">{{ formatDateTime(row.approvedAt) }}</template>
            </el-table-column>
          </el-table>
        </section>

        <section class="page-card section-card">
          <div class="section-head">
            <div class="section-icon section-icon--cyan">配</div>
            <div>
              <h3>
                版本配置明细
                <el-tag v-if="viewingVersion" size="small" class="ver-tag">
                  V{{ viewingVersion.version }} · {{ contractVersionStatusMap[viewingVersion.status].label }}
                </el-tag>
              </h3>
              <p>{{ viewingVersion?.changeNote || '当前选中版本的完整配置内容' }}</p>
            </div>
          </div>

          <el-descriptions v-if="viewingConfig" :column="2" border>
            <el-descriptions-item label="合同编号">{{ contract.contractNo }}</el-descriptions-item>
            <el-descriptions-item label="合同主档状态">
              <span class="status-dot" :style="{ background: statusMeta.dot }" />
              {{ statusMeta.label }}
            </el-descriptions-item>
            <el-descriptions-item label="审批状态">
              <el-tag :type="approvalMeta.type" size="small">{{ approvalMeta.label }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="企业名称">{{ enterprise?.name }}</el-descriptions-item>
            <el-descriptions-item label="服务商">{{ provider?.name }}</el-descriptions-item>
            <el-descriptions-item label="合同名称" :span="2">{{ viewingConfig.name }}</el-descriptions-item>
            <el-descriptions-item label="提交人">{{ viewingConfig.submittedBy || '—' }}</el-descriptions-item>
            <el-descriptions-item label="提交时间">{{ formatDateTime(viewingConfig.submittedAt) }}</el-descriptions-item>
            <el-descriptions-item label="审批人">{{ viewingConfig.approvedBy || '—' }}</el-descriptions-item>
            <el-descriptions-item label="审批时间">{{ formatDateTime(viewingConfig.approvedAt) }}</el-descriptions-item>
            <el-descriptions-item label="审批意见 / 驳回原因" :span="2">
              {{ viewingConfig.approvalRemark || '—' }}
            </el-descriptions-item>
            <el-descriptions-item label="签约日期">{{ viewingConfig.signingDate }}</el-descriptions-item>
            <el-descriptions-item label="生效日期">{{ viewingConfig.effectiveDate }}</el-descriptions-item>
            <el-descriptions-item label="合同期限">{{ termLabel }}</el-descriptions-item>
            <el-descriptions-item label="到期日期">
              {{ formatContractExpiry(viewingConfig.expiryDate, viewingConfig.contractTerm) }}
            </el-descriptions-item>
            <el-descriptions-item label="结算周期">
              {{ formatSettlementConfig(viewingConfig as never) }}
            </el-descriptions-item>
            <el-descriptions-item label="备注说明" :span="2">
              {{ viewingConfig.remark ?? '—' }}
            </el-descriptions-item>
          </el-descriptions>
        </section>

        <section class="page-card section-card">
          <div class="section-head">
            <div class="section-icon section-icon--purple">费</div>
            <div>
              <h3>服务费配置</h3>
              <p>选中版本的服务费计费方式与含税规则</p>
            </div>
          </div>

          <div v-for="rule in billingRules" :key="rule.type" class="rule-section">
            <div class="rule-section-head">
              <el-tag type="primary" size="small">{{ billingRuleTypeMap[rule.type].label }}</el-tag>
              <span class="rule-rate">{{ formatBillingRuleRate(rule) }}</span>
            </div>

            <el-descriptions :column="2" border size="small" class="rule-desc">
              <el-descriptions-item label="收费方式">
                {{ chargeMethodLabel(rule.chargeMethod) }}
              </el-descriptions-item>
              <el-descriptions-item
                v-for="fee in ensureServiceFees(rule)"
                :key="fee.category"
                :label="contractServiceFeeCategoryMap[fee.category].label"
              >
                {{ formatServiceFeeRateValue(fee.rate, rule.chargeMethod, rule.type) }}
              </el-descriptions-item>
              <el-descriptions-item label="服务费是否含税">
                {{ formatTaxIncludedLabel(rule.serviceFeeIncludesTax) }}
              </el-descriptions-item>
              <el-descriptions-item :label="unitPriceTaxFieldLabel(rule.type)">
                {{ formatTaxIncludedLabel(rule.unitPriceIncludesTax) }}
              </el-descriptions-item>
            </el-descriptions>
          </div>
          <el-empty v-if="!billingRules.length" description="该版本暂无服务费配置" :image-size="64" />
        </section>
      </div>

      <div class="detail-side">
        <section class="page-card side-card">
          <h3 class="side-title">合同附件</h3>
          <div v-if="contract.attachments?.length" class="attachment-list">
            <div v-for="file in contract.attachments" :key="file.id" class="attachment-item">
              <el-icon><Document /></el-icon>
              <div class="attachment-meta">
                <div>{{ file.name }}</div>
                <div class="text-muted">{{ file.size }} · {{ file.uploadedAt }}</div>
              </div>
            </div>
          </div>
          <el-empty v-else description="暂无附件" :image-size="56" />
        </section>

        <section class="page-card side-card">
          <h3 class="side-title">操作记录</h3>
          <el-timeline>
            <el-timeline-item
              v-for="log in contract.operationLogs ?? []"
              :key="log.id"
              :timestamp="log.createdAt"
              placement="top"
            >
              <strong>{{ log.operator }}</strong> {{ log.action }}
            </el-timeline-item>
          </el-timeline>
        </section>
      </div>
    </div>
  </div>

  <el-empty v-else description="合同不存在" class="page-card">
    <el-button type="primary" @click="router.push('/contracts')">返回列表</el-button>
  </el-empty>

  <el-dialog v-model="rejectVisible" title="驳回合同" width="480px" destroy-on-close>
    <el-form label-position="top">
      <el-form-item label="审批人">
        <el-input v-model="approverName" placeholder="记录操作员姓名" />
      </el-form-item>
      <el-form-item label="驳回原因" required>
        <el-input
          v-model="rejectReason"
          type="textarea"
          :rows="3"
          placeholder="请填写驳回原因"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="rejectVisible = false">取消</el-button>
      <el-button type="danger" @click="confirmReject">确认驳回</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.contract-detail-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.page-breadcrumb-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 12px;
}

.header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}

.unique-tip {
  padding: 12px 16px;
  font-size: 13px;
  color: #606266;
  line-height: 1.6;
}

.ver-tag {
  margin-left: 6px;
}

.detail-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.6fr) minmax(280px, 0.8fr);
  gap: 12px;
}

.section-card,
.side-card {
  padding: 16px 18px;
  margin-bottom: 12px;
}

.section-head {
  display: flex;
  gap: 12px;
  margin-bottom: 14px;
}

.section-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 13px;
  flex-shrink: 0;
}

.section-icon--blue {
  background: #409eff;
}

.section-icon--cyan {
  background: #14b8a6;
}

.section-icon--purple {
  background: #8b5cf6;
}

.section-head h3 {
  margin: 0;
  font-size: 15px;
  display: flex;
  align-items: center;
}

.section-head p {
  margin: 4px 0 0;
  font-size: 12px;
  color: #909399;
}

.rule-section {
  margin-bottom: 16px;
}

.rule-section-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.rule-rate {
  font-size: 13px;
  color: #606266;
}

.rule-desc {
  margin-bottom: 0;
}

.side-title {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 650;
}

.attachment-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.attachment-item {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 10px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
}

.attachment-meta {
  font-size: 13px;
}

.status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
}

:deep(.is-selected-row) {
  background: #ecf5ff !important;
}

@media (max-width: 1200px) {
  .detail-layout {
    grid-template-columns: 1fr;
  }
}
</style>
