<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import {
  billingRuleTypeMap,
  contractTermOptions,
  settlementCycleMap,
  settlementQuarterMonthOptions,
  settlementWeekdayOptions,
} from '@/constants/partnership'
import {
  billingRuleTierRateUnit,
  calcExpiryFromTerm,
  defaultBillingRule,
  getContractBillingRules,
  inferContractTerm,
  syncLegacyBillingFields,
} from '@/services/contractBilling'
import type {
  ContractBillingRule,
  ContractBillingRuleType,
  ContractTermPreset,
  SettlementCycle,
} from '@/types'

const route = useRoute()
const router = useRouter()
const store = useAppStore()

const contractId = computed(() => route.params.id as string | undefined)
const isEdit = computed(() => route.name === 'ContractEdit' && !!contractId.value)
const editingContract = computed(() =>
  isEdit.value ? store.serviceContracts.find((c) => c.id === contractId.value) : null,
)

const expiryManuallyEdited = ref(false)

const form = ref({
  enterpriseId: '',
  providerId: '',
  name: '',
  contractTerm: '1y' as ContractTermPreset,
  signingDate: new Date().toISOString().slice(0, 10),
  effectiveDate: new Date().toISOString().slice(0, 10),
  expiryDate: calcExpiryFromTerm(new Date().toISOString().slice(0, 10), '1y'),
  ourSigningEntity: '星辰灵工科技有限公司',
  settlementCycle: 'monthly' as SettlementCycle,
  settlementDay: 15,
  settlementWeekday: 5,
  settlementQuarterMonth: 3,
  settlementQuarterDay: 15,
  remark: '',
  enabledBillingTypes: ['hourly'] as ContractBillingRuleType[],
  hourlyRule: defaultBillingRule('hourly'),
  taskRule: defaultBillingRule('task'),
})

function cloneRule(rule: ContractBillingRule): ContractBillingRule {
  return {
    ...rule,
    tiers: rule.tiers.map((t) => ({ ...t })),
  }
}

function loadFromContract(contract: NonNullable<typeof editingContract.value>) {
  const rules = getContractBillingRules(contract)
  const hourly = rules.find((r) => r.type === 'hourly')
  const task = rules.find((r) => r.type === 'task')
  form.value = {
    enterpriseId: contract.enterpriseId,
    providerId: contract.providerId,
    name: contract.name,
    contractTerm: contract.contractTerm ?? inferContractTerm(contract.effectiveDate, contract.expiryDate),
    signingDate: contract.signingDate,
    effectiveDate: contract.effectiveDate,
    expiryDate: contract.expiryDate,
    ourSigningEntity: contract.ourSigningEntity,
    settlementCycle: contract.settlementCycle,
    settlementDay: contract.settlementDay ?? 15,
    settlementWeekday: contract.settlementWeekday ?? 5,
    settlementQuarterMonth: contract.settlementQuarterMonth ?? 3,
    settlementQuarterDay: contract.settlementQuarterDay ?? 15,
    remark: contract.remark ?? '',
    enabledBillingTypes: rules.map((r) => r.type),
    hourlyRule: hourly ? cloneRule(hourly) : defaultBillingRule('hourly'),
    taskRule: task ? cloneRule(task) : defaultBillingRule('task'),
  }
  expiryManuallyEdited.value = true
}

if (editingContract.value) {
  loadFromContract(editingContract.value)
}

watch(editingContract, (c) => {
  if (c) loadFromContract(c)
})

watch(
  () => [form.value.contractTerm, form.value.effectiveDate] as const,
  ([term, effectiveDate]) => {
    if (!effectiveDate || expiryManuallyEdited.value) return
    form.value.expiryDate = calcExpiryFromTerm(effectiveDate, term)
  },
)

function onTermChange(term: ContractTermPreset) {
  form.value.contractTerm = term
  expiryManuallyEdited.value = false
  if (form.value.effectiveDate) {
    form.value.expiryDate = calcExpiryFromTerm(form.value.effectiveDate, term)
  }
}

function onExpiryChange(value: string) {
  form.value.expiryDate = value
  expiryManuallyEdited.value = true
}

const activeEnterprises = computed(() =>
  store.enterprises.filter((e) => e.status !== 'terminated'),
)

const availableProviders = computed(() => {
  if (!form.value.enterpriseId) return store.serviceProviders.filter((p) => p.status === 'cooperating')
  return store.serviceProviders.filter(
    (p) =>
      p.status === 'cooperating' &&
      (p.linkedEnterpriseIds.length === 0 ||
        p.linkedEnterpriseIds.includes(form.value.enterpriseId)),
  )
})

watch(
  () => form.value.enterpriseId,
  () => {
    if (
      form.value.providerId &&
      !availableProviders.value.some((p) => p.id === form.value.providerId)
    ) {
      form.value.providerId = ''
    }
  },
)

function getRule(type: ContractBillingRuleType) {
  return type === 'hourly' ? form.value.hourlyRule : form.value.taskRule
}

function ruleRateLabel(rule: ContractBillingRule) {
  return rule.chargeMethod === 'percentage' ? '基础费率' : '基础单价'
}

function ruleRateMax(rule: ContractBillingRule) {
  return rule.chargeMethod === 'percentage' ? 100 : 99999
}

function tierHint(type: ContractBillingRuleType) {
  if (type === 'hourly') return '按累计人时数划分阶梯，超出部分适用对应费率'
  return '按累计任务量划分阶梯，超出部分适用对应费率'
}

function onChargeMethodChange(type: ContractBillingRuleType) {
  const rule = getRule(type)
  if (type === 'task' && rule.chargeMethod === 'percentage') {
    rule.baseRate = 10
    rule.tiers = [
      { id: 't1', minQuantity: 0, maxQuantity: 500000, rate: 10, label: '标准档' },
      { id: 't2', minQuantity: 500000, maxQuantity: undefined, rate: 8, label: '大额档' },
    ]
  } else if (type === 'task') {
    rule.baseRate = 8
    rule.tiers = [
      { id: 't1', minQuantity: 0, maxQuantity: 1000, rate: 8, label: '基础档' },
      { id: 't2', minQuantity: 1000, maxQuantity: undefined, rate: 6.5, label: '规模档' },
    ]
  }
}

function addTier(type: ContractBillingRuleType) {
  const rule = getRule(type)
  const last = rule.tiers[rule.tiers.length - 1]
  const min = last?.maxQuantity ?? (last?.minQuantity ?? 0) + 1000
  rule.tiers.push({
    id: `t${Date.now()}`,
    minQuantity: min,
    maxQuantity: undefined,
    rate: rule.baseRate,
    label: '',
  })
}

function removeTier(type: ContractBillingRuleType, index: number) {
  const rule = getRule(type)
  if (rule.tiers.length <= 1) {
    ElMessage.warning('至少保留一个阶梯档位')
    return
  }
  rule.tiers.splice(index, 1)
}

function validateRule(rule: ContractBillingRule, label: string) {
  if (rule.baseRate <= 0) {
    ElMessage.warning(`请填写有效的${label}费率/单价`)
    return false
  }
  if (rule.chargeMethod === 'percentage' && rule.baseRate > 100) {
    ElMessage.warning(`${label}按比例费率不能超过 100%`)
    return false
  }
  return true
}

function validate() {
  if (!form.value.enterpriseId) {
    ElMessage.warning('请选择企业')
    return false
  }
  if (!form.value.providerId) {
    ElMessage.warning('请选择服务商')
    return false
  }
  if (!form.value.name.trim()) {
    ElMessage.warning('请填写合约名称')
    return false
  }
  if (!form.value.effectiveDate) {
    ElMessage.warning('请选择生效日期')
    return false
  }
  if (!form.value.expiryDate) {
    ElMessage.warning('请填写到期日期')
    return false
  }
  if (form.value.expiryDate < form.value.effectiveDate) {
    ElMessage.warning('到期日期不能早于生效日期')
    return false
  }
  if (!form.value.enabledBillingTypes.length) {
    ElMessage.warning('请至少选择一种计费方式')
    return false
  }
  if (form.value.enabledBillingTypes.includes('hourly') && !validateRule(form.value.hourlyRule, '工时')) {
    return false
  }
  if (form.value.enabledBillingTypes.includes('task') && !validateRule(form.value.taskRule, '任务')) {
    return false
  }
  if (form.value.settlementCycle === 'weekly' && !form.value.settlementWeekday) {
    ElMessage.warning('请选择每周结算日')
    return false
  }
  if (form.value.settlementCycle === 'monthly' && !form.value.settlementDay) {
    ElMessage.warning('请填写每月结算日')
    return false
  }
  if (form.value.settlementCycle === 'quarterly') {
    if (!form.value.settlementQuarterMonth || !form.value.settlementQuarterDay) {
      ElMessage.warning('请完善按季结算配置')
      return false
    }
  }
  return true
}

function buildBillingRules(): ContractBillingRule[] {
  return form.value.enabledBillingTypes.map((type) => {
    const rule = type === 'hourly' ? form.value.hourlyRule : form.value.taskRule
    return {
      type,
      chargeMethod: rule.chargeMethod,
      baseRate: rule.baseRate,
      tiers: rule.tiers.map((t) => ({
        ...t,
        rate: t.rate || rule.baseRate,
      })),
    }
  })
}

function buildSettlementFields() {
  const cycle = form.value.settlementCycle
  return {
    settlementCycle: cycle,
    settlementDay: cycle === 'monthly' ? form.value.settlementDay : undefined,
    settlementWeekday: cycle === 'weekly' ? form.value.settlementWeekday : undefined,
    settlementQuarterMonth: cycle === 'quarterly' ? form.value.settlementQuarterMonth : undefined,
    settlementQuarterDay: cycle === 'quarterly' ? form.value.settlementQuarterDay : undefined,
  }
}

function save() {
  if (!validate()) return
  const billingRules = buildBillingRules()
  const legacy = syncLegacyBillingFields(billingRules)
  const payload = {
    enterpriseId: form.value.enterpriseId,
    providerId: form.value.providerId,
    name: form.value.name.trim(),
    billingRules,
    contractTerm: form.value.contractTerm,
    ...legacy,
    signingDate: form.value.signingDate,
    effectiveDate: form.value.effectiveDate,
    expiryDate: form.value.expiryDate,
    ourSigningEntity: form.value.ourSigningEntity.trim(),
    ...buildSettlementFields(),
    remark: form.value.remark.trim() || undefined,
  }

  if (isEdit.value && contractId.value) {
    store.updateServiceContract(contractId.value, payload)
    ElMessage.success('合约已更新')
    router.push(`/contracts/${contractId.value}`)
  } else {
    const item = store.addServiceContract(payload)
    ElMessage.success('合约创建成功')
    router.push(`/contracts/${item.id}`)
  }
}

function cancel() {
  if (isEdit.value && contractId.value) {
    router.push(`/contracts/${contractId.value}`)
  } else {
    router.push('/contracts')
  }
}
</script>

<template>
  <div class="contract-form-page">
    <div class="page-breadcrumb-row">
      <el-breadcrumb separator=">">
        <el-breadcrumb-item>企业管理</el-breadcrumb-item>
        <el-breadcrumb-item>合同管理</el-breadcrumb-item>
        <el-breadcrumb-item>{{ isEdit ? '编辑合约' : '新增合约' }}</el-breadcrumb-item>
      </el-breadcrumb>
      <div class="header-actions">
        <el-button @click="cancel">取消</el-button>
        <el-button type="primary" @click="save">{{ isEdit ? '保存修改' : '保存并创建' }}</el-button>
      </div>
    </div>

    <section class="form-section page-card">
      <div class="section-head">
        <div class="section-icon section-icon--blue">基</div>
        <div>
          <h3>合约基本信息</h3>
          <p>选择合作企业与服务商，填写合约期限与结算方式</p>
        </div>
      </div>

      <el-form label-position="top" class="section-form">
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="企业名称" required>
              <el-select
                v-model="form.enterpriseId"
                filterable
                placeholder="请选择企业"
                style="width: 100%"
                :disabled="isEdit"
              >
                <el-option
                  v-for="e in activeEnterprises"
                  :key="e.id"
                  :label="e.name"
                  :value="e.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="服务商" required>
              <el-select
                v-model="form.providerId"
                filterable
                placeholder="请选择服务商"
                style="width: 100%"
                :disabled="!form.enterpriseId || isEdit"
              >
                <el-option
                  v-for="p in availableProviders"
                  :key="p.id"
                  :label="p.name"
                  :value="p.id"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="合约名称" required>
          <el-input v-model="form.name" placeholder="如：XX企业灵工服务合约" />
        </el-form-item>

        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="签约日期">
              <el-date-picker
                v-model="form.signingDate"
                type="date"
                value-format="YYYY-MM-DD"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="生效日期" required>
              <el-date-picker
                v-model="form.effectiveDate"
                type="date"
                value-format="YYYY-MM-DD"
                style="width: 100%"
              />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="合同期限">
              <el-radio-group :model-value="form.contractTerm" @change="onTermChange">
                <el-radio-button
                  v-for="opt in contractTermOptions"
                  :key="opt.value"
                  :value="opt.value"
                >
                  {{ opt.label }}
                </el-radio-button>
              </el-radio-group>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row :gutter="16">
          <el-col :span="8">
            <el-form-item label="到期日期" required>
              <el-date-picker
                :model-value="form.expiryDate"
                type="date"
                value-format="YYYY-MM-DD"
                placeholder="必填"
                style="width: 100%"
                @update:model-value="onExpiryChange"
              />
              <div class="field-hint">选择合同期限后自动计算，也可手动修改</div>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="我方签约主体">
              <el-input v-model="form.ourSigningEntity" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="结算周期">
              <el-select v-model="form.settlementCycle" style="width: 100%">
                <el-option
                  v-for="(label, key) in settlementCycleMap"
                  :key="key"
                  :label="label"
                  :value="key"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row v-if="form.settlementCycle === 'weekly'" :gutter="16">
          <el-col :span="8">
            <el-form-item label="每周结算日" required>
              <el-select v-model="form.settlementWeekday" style="width: 100%">
                <el-option
                  v-for="d in settlementWeekdayOptions"
                  :key="d.value"
                  :label="d.label"
                  :value="d.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row v-else-if="form.settlementCycle === 'monthly'" :gutter="16">
          <el-col :span="8">
            <el-form-item label="每月结算日" required>
              <el-input-number v-model="form.settlementDay" :min="1" :max="28" style="width: 100%" />
              <div class="field-hint">每月固定结算日（1~28 日）</div>
            </el-form-item>
          </el-col>
        </el-row>

        <el-row v-else-if="form.settlementCycle === 'quarterly'" :gutter="16">
          <el-col :span="8">
            <el-form-item label="季度内月份" required>
              <el-select v-model="form.settlementQuarterMonth" style="width: 100%">
                <el-option
                  v-for="m in settlementQuarterMonthOptions"
                  :key="m.value"
                  :label="m.label"
                  :value="m.value"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="结算日" required>
              <el-input-number
                v-model="form.settlementQuarterDay"
                :min="1"
                :max="28"
                style="width: 100%"
              />
              <div class="field-hint">该月几号结算</div>
            </el-form-item>
          </el-col>
        </el-row>

        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="可选" />
        </el-form-item>
      </el-form>
    </section>

    <section class="form-section page-card">
      <div class="section-head">
        <div class="section-icon section-icon--purple">计</div>
        <div>
          <h3>计费规则配置</h3>
          <p>可同时启用按工时与按任务计费，各自独立配置固定金额或比率及阶梯</p>
        </div>
      </div>

      <el-form label-position="top" class="section-form">
        <el-form-item label="计费方式" required>
          <el-checkbox-group v-model="form.enabledBillingTypes" class="billing-type-group">
            <el-checkbox
              v-for="(meta, key) in billingRuleTypeMap"
              :key="key"
              :value="key"
              class="billing-type-item"
            >
              <span class="billing-type-label">{{ meta.label }}</span>
              <span class="billing-type-desc">{{ meta.desc }}</span>
            </el-checkbox>
          </el-checkbox-group>
        </el-form-item>

        <template v-for="billingType in form.enabledBillingTypes" :key="billingType">
          <div class="rule-block">
            <div class="rule-block-head">
              <h4>{{ billingRuleTypeMap[billingType].label }}</h4>
            </div>

            <el-form-item label="收费方式" required>
              <el-radio-group
                v-model="getRule(billingType).chargeMethod"
                @change="onChargeMethodChange(billingType)"
              >
                <el-radio value="fixed">固定金额</el-radio>
                <el-radio value="percentage">比率（百分比）</el-radio>
              </el-radio-group>
            </el-form-item>

            <el-form-item :label="ruleRateLabel(getRule(billingType))" required>
              <el-input-number
                v-model="getRule(billingType).baseRate"
                :min="0.01"
                :max="ruleRateMax(getRule(billingType))"
                :precision="2"
                :step="getRule(billingType).chargeMethod === 'percentage' ? 0.5 : 1"
                style="width: 200px"
              />
              <span class="rate-unit">
                {{ billingRuleTierRateUnit(billingType, getRule(billingType).chargeMethod) }}
              </span>
            </el-form-item>

            <div class="tier-block">
              <div class="tier-head">
                <span class="tier-head-title">阶梯费率（可选）</span>
              </div>
              <el-table :data="getRule(billingType).tiers" border size="small">
                <el-table-column label="累计区间下限" width="140">
                  <template #default="{ row }">
                    <el-input-number
                      v-model="row.minQuantity"
                      :min="0"
                      size="small"
                      controls-position="right"
                    />
                  </template>
                </el-table-column>
                <el-table-column label="累计区间上限" width="140">
                  <template #default="{ row }">
                    <el-input-number
                      v-model="row.maxQuantity"
                      :min="row.minQuantity"
                      size="small"
                      controls-position="right"
                      placeholder="不限"
                    />
                  </template>
                </el-table-column>
                <el-table-column label="费率" width="140">
                  <template #default="{ row }">
                    <el-input-number
                      v-model="row.rate"
                      :min="0.01"
                      :max="ruleRateMax(getRule(billingType))"
                      :precision="2"
                      size="small"
                      controls-position="right"
                    />
                  </template>
                </el-table-column>
                <el-table-column label="单位" width="120">
                  <template #default>
                    {{
                      billingRuleTierRateUnit(billingType, getRule(billingType).chargeMethod)
                    }}
                  </template>
                </el-table-column>
                <el-table-column label="说明" min-width="120">
                  <template #default="{ row }">
                    <el-input v-model="row.label" size="small" placeholder="如：基础档" />
                  </template>
                </el-table-column>
                <el-table-column label="操作" width="80" align="center">
                  <template #default="{ $index }">
                    <el-button link type="danger" @click="removeTier(billingType, $index)">
                      删除
                    </el-button>
                  </template>
                </el-table-column>
              </el-table>
              <el-button size="small" class="tier-add-btn" @click="addTier(billingType)">
                添加档位
              </el-button>
              <p class="field-hint tier-hint">{{ tierHint(billingType) }}</p>
            </div>
          </div>
        </template>

        <el-empty
          v-if="!form.enabledBillingTypes.length"
          description="请至少选择一种计费方式"
          :image-size="64"
        />
      </el-form>
    </section>
  </div>
</template>

<style scoped>
.contract-form-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.page-breadcrumb-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.form-section {
  padding: 20px 24px;
}

.section-head {
  display: flex;
  gap: 14px;
  margin-bottom: 20px;
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
  flex-shrink: 0;
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

.field-hint {
  margin-top: 4px;
  font-size: 12px;
  color: #909399;
}

.billing-type-group {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 12px;
}

.billing-type-item {
  align-items: flex-start;
  height: auto;
  margin-right: 0;
}

.billing-type-item :deep(.el-checkbox__label) {
  white-space: normal;
  line-height: 1.4;
}

.billing-type-label {
  display: block;
  font-weight: 600;
  color: #303133;
}

.billing-type-desc {
  display: block;
  font-size: 12px;
  color: #909399;
  font-weight: 400;
}

.rule-block {
  margin-top: 16px;
  padding: 16px;
  border: 1px solid #ebeef5;
  border-radius: 10px;
  background: #fafafa;
}

.rule-block-head h4 {
  margin: 0 0 12px;
  font-size: 15px;
  color: #303133;
}

.rate-unit {
  margin-left: 8px;
  font-size: 14px;
  color: #606266;
}

.tier-block {
  margin-top: 8px;
}

.tier-head {
  margin-bottom: 10px;
}

.tier-add-btn {
  margin-top: 10px;
}

.tier-add-btn:hover,
.tier-add-btn:focus {
  color: var(--el-button-text-color);
  background-color: var(--el-button-bg-color);
  border-color: var(--el-button-border-color);
}

.tier-head-title {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
}

.tier-hint {
  margin-top: 8px;
}
</style>
