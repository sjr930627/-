<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import {
  billingRuleTypeMap,
  contractServiceFeeCategoryMap,
  contractTermOptions,
  settlementCycleMap,
  settlementQuarterMonthOptions,
  settlementWeekdayOptions,
} from '@/constants/partnership'
import {
  billingRuleTierRateUnit,
  calcExpiryFromTerm,
  defaultBillingRule,
  defaultServiceFees,
  ensureServiceFees,
  getContractBillingRules,
  inferContractTerm,
  serviceFeeCategoriesForType,
  sumServiceFeeRates,
  syncLegacyBillingFields,
  unitPriceTaxFieldLabel,
  withSyncedServiceFees,
} from '@/services/contractBilling'
import type {
  ContractAttachment,
  ContractBillingRule,
  ContractBillingRuleType,
  ContractServiceFeeCategory,
  ContractTermPreset,
  SettlementCycle,
} from '@/types'
import {
  getEffectiveVersion,
  getFormSourceConfig,
} from '@/services/contractVersion'
import { generateId } from '@/utils'

const route = useRoute()
const router = useRouter()
const store = useAppStore()

const contractId = computed(() => route.params.id as string | undefined)
const isEdit = computed(() => route.name === 'ContractEdit' && !!contractId.value)
const isRenew = computed(() => route.name === 'ContractRenew' && !!contractId.value)
const isRevision = computed(() => isEdit.value || isRenew.value)
const pageTitle = computed(() => {
  if (isRenew.value) return '续约合同'
  if (isEdit.value) return '改版编辑'
  return '新增合同'
})

const editingContract = computed(() =>
  isRevision.value ? store.serviceContracts.find((c) => c.id === contractId.value) : null,
)

const expiryManuallyEdited = ref(false)
const changeNote = ref('')
const pendingAttachments = ref<ContractAttachment[]>([])

const form = ref({
  enterpriseId: '',
  providerId: '',
  name: '',
  contractTerm: '1y' as ContractTermPreset,
  signingDate: new Date().toISOString().slice(0, 10),
  effectiveDate: new Date().toISOString().slice(0, 10),
  expiryDate: calcExpiryFromTerm(new Date().toISOString().slice(0, 10), '1y'),
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
  return withSyncedServiceFees({
    ...rule,
    serviceFees: ensureServiceFees(rule).map((f) => ({ ...f })),
  })
}

function loadFromContract(contract: NonNullable<typeof editingContract.value>) {
  // 续约始终代入当前生效配置；改版优先加载未生效草稿
  const source = isRenew.value
    ? getEffectiveVersion(contract) ?? getFormSourceConfig(contract)
    : getFormSourceConfig(contract)
  const rules = getContractBillingRules(source as typeof contract)
  const hourly = rules.find((r) => r.type === 'hourly')
  const task = rules.find((r) => r.type === 'task')
  form.value = {
    enterpriseId: contract.enterpriseId,
    providerId: contract.providerId,
    name: source.name,
    contractTerm: source.contractTerm ?? inferContractTerm(source.effectiveDate, source.expiryDate),
    signingDate: source.signingDate,
    effectiveDate: source.effectiveDate,
    expiryDate: source.expiryDate,
    settlementCycle:
      source.settlementCycle === 'weekly' ||
      source.settlementCycle === 'monthly' ||
      source.settlementCycle === 'quarterly'
        ? source.settlementCycle
        : 'monthly',
    settlementDay: source.settlementDay ?? 15,
    settlementWeekday: source.settlementWeekday ?? 5,
    settlementQuarterMonth: source.settlementQuarterMonth ?? 3,
    settlementQuarterDay: source.settlementQuarterDay ?? 15,
    remark: source.remark ?? '',
    enabledBillingTypes: rules.map((r) => r.type),
    hourlyRule: hourly ? cloneRule(hourly) : defaultBillingRule('hourly'),
    taskRule: task ? cloneRule(task) : defaultBillingRule('task'),
  }
  expiryManuallyEdited.value = true
  changeNote.value = isRenew.value ? '' : ''
  pendingAttachments.value = []
}

if (editingContract.value) {
  loadFromContract(editingContract.value)
}

watch(editingContract, (c) => {
  if (c) loadFromContract(c)
})

watch(
  () => route.name,
  () => {
    if (editingContract.value) loadFromContract(editingContract.value)
  },
)

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function onUploadChange(uploadFile: { name: string; size?: number; raw?: File }) {
  const size = uploadFile.size ?? uploadFile.raw?.size ?? 0
  pendingAttachments.value = [
    ...pendingAttachments.value,
    {
      id: generateId('att'),
      name: uploadFile.name,
      size: formatFileSize(size),
      uploadedAt: new Date().toLocaleString('zh-CN'),
    },
  ]
}

function removePendingAttachment(id: string) {
  pendingAttachments.value = pendingAttachments.value.filter((a) => a.id !== id)
}

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

function getServiceFeeRate(type: ContractBillingRuleType, category: ContractServiceFeeCategory) {
  const rule = getRule(type)
  if (!rule.serviceFees?.length) {
    rule.serviceFees = ensureServiceFees(rule)
  }
  return rule.serviceFees.find((f) => f.category === category)?.rate ?? 0
}

function setServiceFeeRate(
  type: ContractBillingRuleType,
  category: ContractServiceFeeCategory,
  rate: number | undefined,
) {
  const rule = getRule(type)
  const fees = ensureServiceFees(rule).map((f) =>
    f.category === category ? { ...f, rate: Math.max(0, Number(rate) || 0) } : f,
  )
  rule.serviceFees = fees
  rule.baseRate = sumServiceFeeRates(fees)
}

function ruleRateMax(rule: ContractBillingRule) {
  return rule.chargeMethod === 'percentage' ? 100 : 99999
}

function onChargeMethodChange(type: ContractBillingRuleType) {
  const rule = getRule(type)
  rule.serviceFees = defaultServiceFees(type, rule.chargeMethod)
  rule.baseRate = sumServiceFeeRates(rule.serviceFees)
  rule.tiers = []
}

function validateRule(rule: ContractBillingRule, label: string) {
  const fees = ensureServiceFees(rule)
  rule.serviceFees = fees
  rule.baseRate = sumServiceFeeRates(fees)
  if (fees.every((f) => f.rate <= 0)) {
    ElMessage.warning(`请至少填写一项有效的${label}服务费`)
    return false
  }
  for (const fee of fees) {
    const name = contractServiceFeeCategoryMap[fee.category].label
    if (fee.rate < 0) {
      ElMessage.warning(`${label}·${name}不能为负数`)
      return false
    }
    if (rule.chargeMethod === 'percentage' && fee.rate > 100) {
      ElMessage.warning(`${label}·${name}按比例费率不能超过 100%`)
      return false
    }
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
    ElMessage.warning('请填写合同名称')
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
    ElMessage.warning('请至少选择一种服务费计费方式')
    return false
  }
  if (form.value.enabledBillingTypes.includes('hourly') && !validateRule(form.value.hourlyRule, '服务费工时')) {
    return false
  }
  if (form.value.enabledBillingTypes.includes('task') && !validateRule(form.value.taskRule, '任务服务费')) {
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
  if (isRenew.value) {
    if (!changeNote.value.trim()) {
      ElMessage.warning('请填写续约说明')
      return false
    }
    if (!pendingAttachments.value.length) {
      ElMessage.warning('请上传续约合同文件')
      return false
    }
  } else if (isEdit.value && !changeNote.value.trim()) {
    // 改版说明可选，默认用「配置改版」
  }
  return true
}

function buildBillingRules(): ContractBillingRule[] {
  return form.value.enabledBillingTypes.map((type) => {
    const rule = type === 'hourly' ? form.value.hourlyRule : form.value.taskRule
    return withSyncedServiceFees({
      type,
      chargeMethod: rule.chargeMethod,
      baseRate: rule.baseRate,
      tiers: [],
      serviceFeeIncludesTax: rule.serviceFeeIncludesTax ?? false,
      unitPriceIncludesTax: rule.unitPriceIncludesTax ?? false,
      serviceFees: ensureServiceFees(rule),
    })
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

function save(submitForApproval = false) {
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
    ...buildSettlementFields(),
    remark: form.value.remark.trim() || undefined,
  }

  if (isRevision.value && contractId.value) {
    const note =
      changeNote.value.trim() ||
      (isRenew.value ? '续约改版' : '配置改版')
    const existing = editingContract.value?.attachments ?? []
    const attachments =
      pendingAttachments.value.length > 0
        ? [...existing, ...pendingAttachments.value]
        : undefined
    store.updateServiceContract(
      contractId.value,
      {
        ...payload,
        ...(attachments ? { attachments } : {}),
      },
      { changeNote: note },
    )
    if (submitForApproval) {
      try {
        store.submitServiceContractForApproval(contractId.value)
        ElMessage.success(
          isRenew.value
            ? '已提交续约审批；审批通过前仍沿用原生效版本配置'
            : '已保存并提交改版审批；审批通过前仍沿用原生效版本配置',
        )
      } catch (e) {
        ElMessage.warning(e instanceof Error ? e.message : '提交审批失败')
        return
      }
    } else {
      ElMessage.success(
        isRenew.value
          ? '续约草稿已保存，需提交审批后生效'
          : '已保存改版草稿，需重新提交审批后生效',
      )
    }
    router.push(`/contracts/${contractId.value}`)
  } else {
    try {
      const item = store.addServiceContract({
        ...payload,
        submitForApproval,
        changeNote: '初始版本',
        attachments: [...pendingAttachments.value],
      })
      ElMessage.success(submitForApproval ? '已创建并提交审批' : '草稿已保存')
      router.push(`/contracts/${item.id}`)
    } catch (e) {
      ElMessage.warning(e instanceof Error ? e.message : '创建失败')
    }
  }
}

function cancel() {
  if (isRevision.value && contractId.value) {
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
        <el-breadcrumb-item>{{ pageTitle }}</el-breadcrumb-item>
      </el-breadcrumb>
      <div class="header-actions">
        <el-button @click="cancel">取消</el-button>
        <el-button @click="save(false)">
          {{ isRevision ? '保存（待提交审批）' : '保存草稿' }}
        </el-button>
        <el-button type="primary" @click="save(true)">提交审批</el-button>
      </div>
    </div>

    <section class="form-section page-card">
      <div class="section-head">
        <div class="section-icon section-icon--blue">基</div>
        <div>
          <h3>合同基本信息</h3>
          <p>
            {{
              isRenew
                ? '已代入原生效合同内容，可调整期限与配置；提交审批期间仍沿用原版本配置'
                : isEdit
                  ? '同一企业与服务商仅一份合同主档，保存后生成改版草稿，审批通过前仍沿用原生效配置'
                  : '选择合作企业与服务商（唯一组合），填写合同期限与结算方式'
            }}
          </p>
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
                :disabled="isRevision"
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
                :disabled="!form.enterpriseId || isRevision"
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

        <el-form-item label="合同名称" required>
          <el-input v-model="form.name" placeholder="如：XX企业灵工服务合同" />
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
            <el-form-item label="结算周期" required>
              <el-select v-model="form.settlementCycle" style="width: 100%">
                <el-option
                  v-for="(label, key) in settlementCycleMap"
                  :key="key"
                  :label="label"
                  :value="key"
                />
              </el-select>
              <div class="field-hint">用于提醒生成账单</div>
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

        <template v-if="isRevision">
          <el-form-item :label="isRenew ? '续约说明' : '改版说明'" :required="isRenew">
            <el-input
              v-model="changeNote"
              type="textarea"
              :rows="3"
              :placeholder="isRenew ? '请说明续约原因、期限调整等' : '可选，说明本次改版内容'"
            />
          </el-form-item>
          <el-form-item :label="isRenew ? '上传续约合同' : '上传合同附件'" :required="isRenew">
            <el-upload
              drag
              action="#"
              :auto-upload="false"
              :show-file-list="false"
              :on-change="onUploadChange"
              accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
            >
              <div class="upload-inner">
                <p>拖拽文件到此处，或点击选择</p>
                <p class="upload-hint">支持 PDF / Word / 图片（演示仅记录文件名）</p>
              </div>
            </el-upload>
            <div v-if="pendingAttachments.length" class="pending-files">
              <div v-for="file in pendingAttachments" :key="file.id" class="pending-file">
                <span>{{ file.name }}（{{ file.size }}）</span>
                <el-button link type="danger" @click="removePendingAttachment(file.id)">移除</el-button>
              </div>
            </div>
          </el-form-item>
        </template>
        <el-form-item v-else label="合同附件">
          <el-upload
            drag
            action="#"
            :auto-upload="false"
            :show-file-list="false"
            :on-change="onUploadChange"
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
          >
            <div class="upload-inner">
              <p>拖拽文件到此处，或点击选择</p>
              <p class="upload-hint">支持 PDF / Word / 图片（演示仅记录文件名）</p>
            </div>
          </el-upload>
          <div v-if="pendingAttachments.length" class="pending-files">
            <div v-for="file in pendingAttachments" :key="file.id" class="pending-file">
              <span>{{ file.name }}（{{ file.size }}）</span>
              <el-button link type="danger" @click="removePendingAttachment(file.id)">移除</el-button>
            </div>
          </div>
        </el-form-item>
      </el-form>
    </section>

    <section class="form-section page-card">
      <div class="section-head">
        <div class="section-icon section-icon--purple">费</div>
        <div>
          <h3>服务费配置</h3>
          <p>服务费工时拆分招聘/管理/抢班；任务服务费拆分招聘/管理，并分别配置含税规则</p>
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

            <div class="fee-split-grid">
              <el-form-item
                v-for="category in serviceFeeCategoriesForType(billingType)"
                :key="`${billingType}-${category}`"
                :label="contractServiceFeeCategoryMap[category].label"
                required
              >
                <el-input-number
                  :model-value="getServiceFeeRate(billingType, category)"
                  :min="0"
                  :max="ruleRateMax(getRule(billingType))"
                  :precision="2"
                  :step="getRule(billingType).chargeMethod === 'percentage' ? 0.5 : 1"
                  style="width: 180px"
                  @update:model-value="(v: number | undefined) => setServiceFeeRate(billingType, category, v)"
                />
                <span class="rate-unit">
                  {{ billingRuleTierRateUnit(billingType, getRule(billingType).chargeMethod) }}
                </span>
              </el-form-item>
            </div>

            <el-row :gutter="16">
              <el-col :span="12">
                <el-form-item label="服务费是否含税">
                  <el-radio-group v-model="getRule(billingType).serviceFeeIncludesTax">
                    <el-radio :value="false">不含税</el-radio>
                    <el-radio :value="true">含税</el-radio>
                  </el-radio-group>
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item :label="unitPriceTaxFieldLabel(billingType)">
                  <el-radio-group v-model="getRule(billingType).unitPriceIncludesTax">
                    <el-radio :value="false">不含税</el-radio>
                    <el-radio :value="true">含税</el-radio>
                  </el-radio-group>
                </el-form-item>
              </el-col>
            </el-row>
          </div>
        </template>

        <el-empty
          v-if="!form.enabledBillingTypes.length"
          description="请至少选择一种服务费计费方式"
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

.fee-split-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 8px 16px;
  margin-bottom: 8px;
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

.upload-inner {
  padding: 12px 0;
  text-align: center;
  color: #606266;
}

.upload-hint {
  margin: 6px 0 0;
  font-size: 12px;
  color: #909399;
}

.pending-files {
  margin-top: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.pending-file {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: #f5f7fa;
  border-radius: 6px;
  font-size: 13px;
}
</style>
