<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import {
  billingRuleTypeMap,
  contractStatusMap,
  contractTermOptions,
  formatContractExpiry,
  formatSettlementConfig,
  resolveContractDisplayStatus,
} from '@/constants/partnership'
import {
  contractHasBillingType,
  formatBillingRuleRate,
  formatBillingRuleTierRange,
  formatContractBillingSummary,
  getContractBillingRules,
} from '@/services/contractBilling'

const route = useRoute()
const router = useRouter()
const store = useAppStore()

const contract = computed(() =>
  store.serviceContracts.find((c) => c.id === route.params.id as string),
)

const enterprise = computed(() =>
  contract.value ? store.enterprises.find((e) => e.id === contract.value!.enterpriseId) : null,
)

const provider = computed(() =>
  contract.value ? store.serviceProviders.find((p) => p.id === contract.value!.providerId) : null,
)

const displayStatus = computed(() =>
  contract.value ? resolveContractDisplayStatus(contract.value) : 'draft',
)

const statusMeta = computed(() => contractStatusMap[displayStatus.value])

const billingRules = computed(() =>
  contract.value ? getContractBillingRules(contract.value) : [],
)

const termLabel = computed(() => {
  if (!contract.value) return '-'
  const term = contract.value.contractTerm
  if (term) return contractTermOptions.find((o) => o.value === term)?.label ?? '-'
  return '-'
})

const previewItems = computed(() => {
  if (!contract.value) return []
  const c = contract.value
  return [
    { label: '企业名称', value: enterprise.value?.name ?? '-' },
    { label: '服务商', value: provider.value?.name ?? '-' },
    { label: '合同期限', value: termLabel.value },
    {
      label: '合约期限',
      value: `${c.effectiveDate} ~ ${formatContractExpiry(c.expiryDate, c.contractTerm)}`,
    },
    { label: '结算周期', value: formatSettlementConfig(c) },
    { label: '计费规则', value: formatContractBillingSummary(c) },
  ]
})

const estimatedMonthly = computed(() => {
  if (!contract.value) return 0
  let total = 0
  if (contractHasBillingType(contract.value, 'hourly')) {
    const rule = billingRules.value.find((r) => r.type === 'hourly')
    if (rule) total += 1200 * rule.baseRate
  }
  if (contractHasBillingType(contract.value, 'task')) {
    const rule = billingRules.value.find((r) => r.type === 'task')
    if (rule) {
      total += rule.chargeMethod === 'percentage' ? 18720 : 800 * rule.baseRate
    }
  }
  return total
})

function chargeMethodLabel(method: 'fixed' | 'percentage') {
  return method === 'fixed' ? '固定金额' : '比率（百分比）'
}
</script>

<template>
  <div v-if="contract" class="contract-detail-page">
    <div class="page-breadcrumb-row">
      <el-breadcrumb separator=">">
        <el-breadcrumb-item>企业管理</el-breadcrumb-item>
        <el-breadcrumb-item>合同管理</el-breadcrumb-item>
        <el-breadcrumb-item>合约详情</el-breadcrumb-item>
      </el-breadcrumb>
      <div class="header-actions">
        <el-button @click="router.push('/contracts')">返回列表</el-button>
        <el-button
          v-if="displayStatus !== 'terminated'"
          type="primary"
          @click="router.push(`/contracts/${contract.id}/edit`)"
        >
          编辑合约
        </el-button>
      </div>
    </div>

    <div class="detail-layout">
      <div class="detail-main">
        <section class="page-card section-card">
          <div class="section-head">
            <div class="section-icon section-icon--blue">基</div>
            <div>
              <h3>合约基本信息</h3>
              <p>企业与服务商之间的合作协议详情</p>
            </div>
          </div>

          <el-descriptions :column="2" border>
            <el-descriptions-item label="合约编号">{{ contract.contractNo }}</el-descriptions-item>
            <el-descriptions-item label="合约状态">
              <span class="status-dot" :style="{ background: statusMeta.dot }" />
              {{ statusMeta.label }}
            </el-descriptions-item>
            <el-descriptions-item label="企业名称">{{ enterprise?.name }}</el-descriptions-item>
            <el-descriptions-item label="服务商">{{ provider?.name }}</el-descriptions-item>
            <el-descriptions-item label="合约名称" :span="2">{{ contract.name }}</el-descriptions-item>
            <el-descriptions-item label="签约日期">{{ contract.signingDate }}</el-descriptions-item>
            <el-descriptions-item label="我方签约主体">{{ contract.ourSigningEntity }}</el-descriptions-item>
            <el-descriptions-item label="生效日期">{{ contract.effectiveDate }}</el-descriptions-item>
            <el-descriptions-item label="合同期限">{{ termLabel }}</el-descriptions-item>
            <el-descriptions-item label="到期日期">
              {{ formatContractExpiry(contract.expiryDate, contract.contractTerm) }}
            </el-descriptions-item>
            <el-descriptions-item label="结算周期">
              {{ formatSettlementConfig(contract) }}
            </el-descriptions-item>
            <el-descriptions-item label="备注说明" :span="2">
              {{ contract.remark ?? '—' }}
            </el-descriptions-item>
          </el-descriptions>
        </section>

        <section class="page-card section-card">
          <div class="section-head">
            <div class="section-icon section-icon--purple">计</div>
            <div>
              <h3>计费规则配置</h3>
              <p>支持同时启用多种计费方式，各自独立配置</p>
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
              <el-descriptions-item label="基础费率">
                {{ formatBillingRuleRate(rule) }}
              </el-descriptions-item>
            </el-descriptions>

            <div v-if="rule.tiers.length" class="tier-table-wrap">
              <div class="tier-title">阶梯费率</div>
              <el-table :data="rule.tiers" border size="small">
                <el-table-column label="区间" min-width="180">
                  <template #default="{ row }">
                    {{ formatBillingRuleTierRange(rule, row.minQuantity, row.maxQuantity) }}
                  </template>
                </el-table-column>
                <el-table-column label="费率" width="160">
                  <template #default="{ row }">
                    {{ formatBillingRuleRate({ ...rule, baseRate: row.rate }) }}
                  </template>
                </el-table-column>
                <el-table-column prop="label" label="说明" min-width="120" />
              </el-table>
            </div>
          </div>
        </section>
      </div>

      <div class="detail-side">
        <section class="page-card side-card">
          <h3 class="side-title">合约预览</h3>
          <div class="preview-list">
            <div v-for="item in previewItems" :key="item.label" class="preview-row">
              <span class="preview-label">{{ item.label }}</span>
              <span class="preview-value">{{ item.value }}</span>
            </div>
          </div>
          <div class="estimate-box">
            <div class="estimate-label">预估月收入</div>
            <div class="estimate-value">
              ¥{{ estimatedMonthly.toLocaleString('zh-CN', { minimumFractionDigits: 2 }) }}
            </div>
            <p class="estimate-hint">基于当前在册灵工数及合约单价估算，仅供参考</p>
          </div>
        </section>

        <section class="page-card side-card">
          <h3 class="side-title">合约附件</h3>
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

  <el-empty v-else description="合约不存在" class="page-card">
    <el-button type="primary" @click="router.push('/contracts')">返回列表</el-button>
  </el-empty>
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
}

.header-actions {
  display: flex;
  gap: 8px;
}

.detail-layout {
  display: grid;
  grid-template-columns: 1fr 340px;
  gap: 12px;
  align-items: start;
}

.section-card {
  padding: 20px 24px;
  margin-bottom: 12px;
}

.section-head {
  display: flex;
  gap: 14px;
  margin-bottom: 16px;
}

.section-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 700;
}

.section-icon--blue {
  background: linear-gradient(135deg, #409eff, #79bbff);
}

.section-icon--purple {
  background: linear-gradient(135deg, #5b4fdb, #7c6df0);
}

.section-head h3 {
  margin: 0 0 4px;
  font-size: 16px;
}

.section-head p {
  margin: 0;
  font-size: 13px;
  color: #909399;
}

.rule-section {
  margin-bottom: 20px;
}

.rule-section:last-child {
  margin-bottom: 0;
}

.rule-section-head {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.rule-rate {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.rule-desc {
  margin-bottom: 12px;
}

.tier-table-wrap {
  margin-top: 8px;
}

.tier-title {
  font-size: 14px;
  font-weight: 600;
  margin-bottom: 8px;
}

.side-card {
  padding: 16px 18px;
  margin-bottom: 12px;
}

.side-title {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 600;
}

.preview-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.preview-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
}

.preview-label {
  color: #909399;
  flex-shrink: 0;
}

.preview-value {
  text-align: right;
  color: #303133;
}

.estimate-box {
  margin-top: 16px;
  padding-top: 14px;
  border-top: 1px dashed #ebeef5;
}

.estimate-label {
  font-size: 13px;
  color: #909399;
}

.estimate-value {
  font-size: 24px;
  font-weight: 700;
  color: #5b4fdb;
  margin: 4px 0;
}

.estimate-hint {
  margin: 0;
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
}

.attachment-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
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

@media (max-width: 1200px) {
  .detail-layout {
    grid-template-columns: 1fr;
  }
}
</style>
