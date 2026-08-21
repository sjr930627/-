<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox, type UploadFile, type UploadInstance } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { usePortal } from '@/composables/usePortal'
import {
  formatMoney,
  formatPeriod,
  resolveBillStatusMeta,
} from '@/constants/payrollBill'
import { isUnassignedDepartment } from '@/constants/department'
import type { SettlementBill, SettlementBillSourceType } from '@/types'
import {
  billingRulesForEnterprise,
  defaultPeriodRange,
  generateBillFromBillingRule,
  importTemplatesForEnterprise,
  parseBillImportFile,
} from '@/services/billSettlement'

const store = useAppStore()
const route = useRoute()
const router = useRouter()
const { isEnterprise, pathPrefix } = usePortal()

const statusFilter = ref<'all' | SettlementBill['status']>('all')
const keyword = ref('')

watch(
  () => route.query.keyword,
  (value) => {
    if (typeof value === 'string') keyword.value = value
  },
  { immediate: true },
)

const dialogVisible = ref(false)
const saving = ref(false)
const uploadRef = ref<UploadInstance>()
const importFile = ref<File | null>(null)

const confirmVisible = ref(false)
const confirming = ref(false)
const confirmingBill = ref<SettlementBill | null>(null)
const confirmForm = ref({
  payerEnterpriseName: '',
  payerCreditCode: '',
})

/** 部门选择：all = 全公司，其它为部门 id */
const BILL_DEPT_ALL = 'all'

const form = ref({
  enterpriseId: '',
  departmentKey: BILL_DEPT_ALL,
  payerEnterpriseName: '',
  payerCreditCode: '',
  periodRange: defaultPeriodRange() as [string, string],
  sourceType: 'rule' as SettlementBillSourceType,
  billingRuleId: '',
  importTemplateId: '',
  remark: '',
})

const availableRules = computed(() =>
  form.value.enterpriseId
    ? billingRulesForEnterprise(store.billingRules, form.value.enterpriseId)
    : [],
)

const availableImportTemplates = computed(() =>
  form.value.enterpriseId
    ? importTemplatesForEnterprise(store.billImportTemplates, form.value.enterpriseId)
    : store.billImportTemplates,
)

const departmentOptions = computed(() => {
  if (!form.value.enterpriseId) return []
  return store.departments
    .filter(
      (d) =>
        d.enterpriseId === form.value.enterpriseId &&
        !isUnassignedDepartment(d.id) &&
        d.orgType !== 'enterprise',
    )
    .sort((a, b) => a.sort - b.sort || a.name.localeCompare(b.name, 'zh-CN'))
})

function resolveDepartmentPayload() {
  if (form.value.departmentKey === BILL_DEPT_ALL) {
    return {
      departmentScope: 'all' as const,
      departmentId: undefined,
      departmentName: '全公司',
    }
  }
  const dept = store.departments.find((d) => d.id === form.value.departmentKey)
  if (!dept) throw new Error('请选择部门')
  return {
    departmentScope: 'department' as const,
    departmentId: dept.id,
    departmentName: dept.name,
  }
}

watch(
  () => form.value.enterpriseId,
  (enterpriseId) => {
    form.value.departmentKey = BILL_DEPT_ALL
    const rules = availableRules.value
    form.value.billingRuleId = rules.find((r) => r.isDefault)?.id ?? rules[0]?.id ?? ''
    const templates = availableImportTemplates.value
    form.value.importTemplateId = templates[0]?.id ?? ''
    const enterprise = store.enterprises.find((e) => e.id === enterpriseId)
    if (enterprise) {
      if (!form.value.payerEnterpriseName.trim()) {
        form.value.payerEnterpriseName = enterprise.name
      }
      if (!form.value.payerCreditCode.trim()) {
        form.value.payerCreditCode = enterprise.creditCode ?? ''
      }
    }
  },
)

watch(
  () => form.value.sourceType,
  () => {
    importFile.value = null
    uploadRef.value?.clearFiles()
    if (form.value.sourceType === 'excel') {
      const templates = availableImportTemplates.value
      form.value.importTemplateId = templates[0]?.id ?? ''
    }
  },
)

const tableData = computed(() =>
  store.settlementBills
    .filter((b) => {
      if (isEnterprise.value && b.enterpriseId !== store.currentEnterprise?.id) return false
      if (statusFilter.value !== 'all' && b.status !== statusFilter.value) return false
      if (!keyword.value.trim()) return true
      const kw = keyword.value.trim().toLowerCase()
      return (
        b.billNo.toLowerCase().includes(kw) ||
        b.enterpriseName.includes(kw) ||
        (b.serviceProviderName ?? '').includes(kw)
      )
    })
    .map((b) => {
      const meta = resolveBillStatusMeta(b.status)
      return {
        ...b,
        periodLabel: formatPeriod(b.periodStart, b.periodEnd),
        payrollLabel: formatMoney(b.payrollTotal),
        serviceFeeLabel: formatMoney(b.serviceFee),
        totalLabel: formatMoney(b.totalPayable),
        providerLabel: b.serviceProviderName ?? '—',
        statusLabel: meta.label,
        statusType: meta.type,
      }
    })
    .sort((a, b) => b.periodEnd.localeCompare(a.periodEnd)),
)

function openDetail(row: SettlementBill) {
  router.push(`${pathPrefix.value}/payroll/bills/${row.id}`)
}

function confirmBill(row: SettlementBill) {
  confirmingBill.value = row
  confirmForm.value = {
    payerEnterpriseName: row.payerEnterpriseName ?? row.enterpriseName,
    payerCreditCode: row.payerCreditCode ?? '',
  }
  confirmVisible.value = true
}

async function submitConfirmBill() {
  if (!confirmingBill.value) return
  confirming.value = true
  try {
    store.confirmSettlementBill(confirmingBill.value.id, {
      payerEnterpriseName: confirmForm.value.payerEnterpriseName,
      payerCreditCode: confirmForm.value.payerCreditCode,
    })
    confirmVisible.value = false
    ElMessage.success('账单已确认，状态已更新为待付款')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '操作失败')
  } finally {
    confirming.value = false
  }
}

async function voidBill(row: SettlementBill) {
  try {
    const { value } = await ElMessageBox.prompt('请输入作废原因（可选）', '作废账单', {
      confirmButtonText: '确认作废',
      cancelButtonText: '取消',
      inputPlaceholder: '数据有误，需重新生成',
    })
    store.voidSettlementBill(row.id, value)
    ElMessage.success('账单已作废')
  } catch {
    // cancelled
  }
}

function resetForm() {
  const enterpriseId = store.enterprises[0]?.id ?? ''
  const enterprise = store.enterprises.find((e) => e.id === enterpriseId)
  form.value = {
    enterpriseId,
    departmentKey: BILL_DEPT_ALL,
    payerEnterpriseName: enterprise?.name ?? '',
    payerCreditCode: enterprise?.creditCode ?? '',
    periodRange: defaultPeriodRange(),
    sourceType: 'rule',
    billingRuleId: '',
    importTemplateId: '',
    remark: '',
  }
  importFile.value = null
  uploadRef.value?.clearFiles()
  const templates = importTemplatesForEnterprise(
    store.billImportTemplates,
    form.value.enterpriseId,
  )
  form.value.importTemplateId = templates[0]?.id ?? ''
}

function openCreate() {
  resetForm()
  dialogVisible.value = true
}

function handleFileChange(file: UploadFile) {
  importFile.value = file.raw ?? null
}

async function buildBillPayload() {
  if (!form.value.enterpriseId) throw new Error('请选择企业')
  if (!form.value.departmentKey) throw new Error('请选择部门')
  if (!form.value.periodRange?.[0] || !form.value.periodRange?.[1]) {
    throw new Error('请选择结算周期')
  }
  const [periodStart, periodEnd] = form.value.periodRange
  if (periodStart > periodEnd) throw new Error('结算周期起始日不能晚于结束日')
  const department = resolveDepartmentPayload()

  if (form.value.sourceType === 'rule') {
    if (!form.value.billingRuleId) throw new Error('请选择计费规则')
    const rule = store.billingRules.find((r) => r.id === form.value.billingRuleId)
    if (!rule) throw new Error('计费规则不存在')
    const generated = generateBillFromBillingRule(rule, form.value.enterpriseId)
    return {
      enterpriseId: form.value.enterpriseId,
      ...department,
      payerEnterpriseName: form.value.payerEnterpriseName,
      payerCreditCode: form.value.payerCreditCode,
      periodStart,
      periodEnd,
      sourceType: 'rule' as const,
      billingRuleId: rule.id,
      billingRuleName: rule.name,
      lines: generated.lines,
      payrollTotal: generated.payrollTotal,
      serviceFee: generated.serviceFee,
      serviceFeeRate: generated.serviceFeeRate,
      summary: generated.summary,
      remark: form.value.remark,
    }
  }

  if (!form.value.importTemplateId) throw new Error('请选择导入模板')
  if (!form.value.billingRuleId) throw new Error('请选择计薪规则')
  const template = store.billImportTemplates.find((t) => t.id === form.value.importTemplateId)
  if (!template) throw new Error('导入模板不存在')
  const rule = store.billingRules.find((r) => r.id === form.value.billingRuleId)
  if (!rule) throw new Error('计薪规则不存在')
  if (!importFile.value) throw new Error('请上传 Excel/CSV 账单明细')
  const parsed = await parseBillImportFile(importFile.value, {
    template: { fields: template.fields },
    billingRule: {
      payrollFormula: rule.payrollFormula,
      serviceFeeFormula: rule.serviceFeeFormula,
    },
  })
  return {
    enterpriseId: form.value.enterpriseId,
    ...department,
    payerEnterpriseName: form.value.payerEnterpriseName,
    payerCreditCode: form.value.payerCreditCode,
    periodStart,
    periodEnd,
    sourceType: 'excel' as const,
    excelFileName: importFile.value.name,
    importTemplateId: template.id,
    importTemplateName: template.name,
    billingRuleId: rule.id,
    billingRuleName: rule.name,
    lines: parsed.lines,
    payrollTotal: parsed.payrollTotal,
    serviceFee: parsed.serviceFee,
    serviceFeeRate: parsed.serviceFeeRate,
    summary: parsed.summary,
    remark: form.value.remark,
  }
}

async function saveBill() {
  saving.value = true
  try {
    const payload = await buildBillPayload()
    const bill = store.createSettlementBill({ ...payload, submit: false })
    dialogVisible.value = false
    ElMessage.success('账单已保存为待提交，请查看详情后提交')
    router.push(`${pathPrefix.value}/payroll/bills/${bill.id}`)
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败')
  } finally {
    saving.value = false
  }
}

function applyInvoice(row: SettlementBill) {
  router.push({
    path: `${pathPrefix.value}/payroll/invoices/apply`,
    query: { billId: row.id },
  })
}
</script>

<template>
  <div class="page-card">
    <div class="page-header">
      <div>
        <h2 class="page-title">{{ isEnterprise ? '账单确认' : '账单管理' }}</h2>
        <p class="text-muted">
          {{
            isEnterprise
              ? '查看服务商提交的结算账单，确认后进入付款流程'
              : '管理服务商与企业的账单数据，创建账单保存为待提交，详情页确认后推送企业'
          }}
        </p>
      </div>
      <el-button v-if="!isEnterprise" type="primary" @click="openCreate">新增账单</el-button>
    </div>

    <div class="page-toolbar">
      <el-input
        v-model="keyword"
        :placeholder="isEnterprise ? '搜索账单编号、服务商' : '搜索账单编号、企业、服务商'"
        clearable
        prefix-icon="Search"
        style="width: 280px"
      />
      <el-radio-group v-model="statusFilter">
        <el-radio-button value="all">全部</el-radio-button>
        <el-radio-button v-if="!isEnterprise" value="pending_submit">待提交</el-radio-button>
        <el-radio-button value="pending_confirm">待确认</el-radio-button>
        <el-radio-button value="pending_payment">待付款</el-radio-button>
        <el-radio-button value="paid">已付款</el-radio-button>
        <el-radio-button value="void">已作废</el-radio-button>
      </el-radio-group>
    </div>

    <el-table :data="tableData" border stripe>
      <el-table-column v-if="!isEnterprise" prop="billNo" label="账单编号" width="160">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDetail(row)">{{ row.billNo }}</el-button>
        </template>
      </el-table-column>
      <el-table-column v-if="!isEnterprise" prop="enterpriseName" label="企业" min-width="160" />
      <el-table-column prop="departmentName" label="部门" width="120">
        <template #default="{ row }">{{ row.departmentName || '全公司' }}</template>
      </el-table-column>
      <el-table-column prop="payerEnterpriseName" label="付款企业" min-width="160">
        <template #default="{ row }">{{ row.payerEnterpriseName || '—' }}</template>
      </el-table-column>
      <el-table-column prop="providerLabel" label="服务商" min-width="180" />
      <el-table-column prop="periodLabel" label="结算周期" min-width="200" />
      <el-table-column prop="payrollLabel" label="结算金额" width="130" align="right" />
      <el-table-column prop="serviceFeeLabel" label="服务费" width="120" align="right" />
      <el-table-column prop="totalLabel" label="总计金额" width="130" align="right" />
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag size="small" :type="row.statusType">{{ row.statusLabel }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="240" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDetail(row)">
            {{ !isEnterprise && row.status === 'pending_submit' ? '查看并提交' : '查看详情' }}
          </el-button>
          <el-button
            v-if="!isEnterprise && row.status === 'pending_submit'"
            link
            type="danger"
            @click="voidBill(row)"
          >
            作废
          </el-button>
          <el-button
            v-if="isEnterprise && row.status === 'pending_confirm'"
            link
            type="primary"
            @click="confirmBill(row)"
          >
            确认账单
          </el-button>
          <el-button
            v-if="!isEnterprise && row.status === 'pending_confirm'"
            link
            type="info"
            disabled
          >
            待企业确认
          </el-button>
          <el-button
            v-if="row.status === 'pending_payment'"
            link
            type="primary"
            @click="openDetail(row)"
          >
            {{ isEnterprise ? '确认付款' : '查看付款' }}
          </el-button>
          <el-button
            v-if="!isEnterprise && ['pending_confirm', 'pending_payment'].includes(row.status)"
            link
            type="danger"
            @click="voidBill(row)"
          >
            作废
          </el-button>
          <el-button
            v-if="isEnterprise && row.status === 'paid' && row.invoicedAmount < row.totalPayable"
            link
            @click="applyInvoice(row)"
          >
            申请发票
          </el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog
      v-model="dialogVisible"
      title="新增账单"
      width="600px"
      destroy-on-close
      @closed="resetForm"
    >
      <el-form label-width="120px">
        <el-form-item label="企业" required>
          <el-select v-model="form.enterpriseId" placeholder="选择企业" filterable style="width: 100%">
            <el-option
              v-for="ent in store.enterprises"
              :key="ent.id"
              :label="ent.name"
              :value="ent.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="部门" required>
          <el-select
            v-model="form.departmentKey"
            placeholder="选择全公司或部门"
            filterable
            :disabled="!form.enterpriseId"
            style="width: 100%"
          >
            <el-option label="全公司" :value="BILL_DEPT_ALL" />
            <el-option
              v-for="dept in departmentOptions"
              :key="dept.id"
              :label="dept.name"
              :value="dept.id"
            />
          </el-select>
          <p class="field-hint">必选：可选择全公司，或指定其中一个部门</p>
        </el-form-item>
        <el-form-item label="付款企业">
          <el-input
            v-model="form.payerEnterpriseName"
            placeholder="非必填，默认可用企业名称"
            clearable
          />
        </el-form-item>
        <el-form-item label="统一信用代码">
          <el-input
            v-model="form.payerCreditCode"
            placeholder="非必填，付款企业统一社会信用代码"
            clearable
            maxlength="18"
          />
        </el-form-item>
        <el-form-item label="结算周期" required>
          <el-date-picker
            v-model="form.periodRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            range-separator="至"
            start-placeholder="起始日"
            end-placeholder="结束日"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="生成方式" required>
          <el-radio-group v-model="form.sourceType">
            <el-radio value="rule">计费规则</el-radio>
            <el-radio value="excel">上传 Excel</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="form.sourceType === 'rule'" label="计费规则" required>
          <el-select
            v-model="form.billingRuleId"
            placeholder="选择计费规则"
            :disabled="!form.enterpriseId"
            style="width: 100%"
          >
            <el-option
              v-for="rule in availableRules"
              :key="rule.id"
              :label="rule.name"
              :value="rule.id"
            />
          </el-select>
          <p v-if="form.enterpriseId && !availableRules.length" class="field-hint">
            该企业暂无可用计费规则
          </p>
        </el-form-item>
        <template v-else>
          <el-form-item label="导入模板" required>
            <div class="template-select-row">
              <el-select
                v-model="form.importTemplateId"
                placeholder="选择导入模板"
                :disabled="!form.enterpriseId"
                style="flex: 1"
              >
                <el-option
                  v-for="tpl in availableImportTemplates"
                  :key="tpl.id"
                  :label="tpl.name"
                  :value="tpl.id"
                />
              </el-select>
              <el-button link type="primary" @click="router.push('/payroll/import-templates')">
                管理模板
              </el-button>
            </div>
            <p v-if="form.enterpriseId && !availableImportTemplates.length" class="field-hint">
              暂无可用导入模板，请先在「账单导入模板」中创建
            </p>
          </el-form-item>
          <el-form-item label="计薪规则" required>
            <el-select
              v-model="form.billingRuleId"
              placeholder="选择计薪规则（用于计算公式）"
              :disabled="!form.enterpriseId"
              style="width: 100%"
            >
              <el-option
                v-for="rule in availableRules"
                :key="rule.id"
                :label="rule.name"
                :value="rule.id"
              />
            </el-select>
            <p class="field-hint">导入数据按所选计薪规则的结算/服务费公式计算金额</p>
          </el-form-item>
          <el-form-item label="账单文件" required>
            <div class="upload-block">
              <el-upload
                ref="uploadRef"
                :auto-upload="false"
                :limit="1"
                accept=".xlsx,.xls,.csv"
                :on-change="handleFileChange"
              >
                <el-button>选择文件</el-button>
              </el-upload>
              <p class="field-hint">
                按所选模板的字段配置解析；可在「账单导入模板」中下载对应 Excel 模板
              </p>
            </div>
          </el-form-item>
        </template>
        <el-form-item label="备注">
          <el-input v-model="form.remark" type="textarea" :rows="2" placeholder="可选" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveBill">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog
      v-model="confirmVisible"
      title="确认账单"
      width="480px"
      destroy-on-close
    >
      <p class="confirm-tip">确认前可修改付款企业与统一信用代码（非必填）</p>
      <el-form label-width="120px">
        <el-form-item label="付款企业">
          <el-input v-model="confirmForm.payerEnterpriseName" clearable placeholder="付款企业名称" />
        </el-form-item>
        <el-form-item label="统一信用代码">
          <el-input
            v-model="confirmForm.payerCreditCode"
            clearable
            maxlength="18"
            placeholder="统一社会信用代码"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="confirmVisible = false">取消</el-button>
        <el-button type="primary" :loading="confirming" @click="submitConfirmBill">
          确认账单
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.field-hint {
  margin: 6px 0 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}

.confirm-tip {
  margin: 0 0 16px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.upload-block {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
}

.template-select-row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}
</style>
