<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import {
  billingFormulaExamples,
  billingFormulaFieldMap,
  buildFormulaFieldContext,
  formatBillingEnterpriseLabel,
  formatBillingFormulaDisplay,
  parseBillingFormulaStorage,
  resolveBillingEnterpriseScope,
  resolvePayrollFormulaGroupKey,
  defaultPayrollFormulaDisplay,
  defaultServiceFeeFormulaDisplay,
} from '@/constants/billingRule'
import type { BillingRule } from '@/types'
import type { BillingFormulaExampleKey, PayrollFormulaGroupKey } from '@/constants/billingRule'

const store = useAppStore()
const route = useRoute()

const dialogVisible = ref(false)
const editingId = ref<string | null>(null)
const formulaGroup = ref<PayrollFormulaGroupKey>('hourly')

const emptyForm = (): Omit<BillingRule, 'id' | 'createdAt' | 'updatedAt'> => ({
  name: '',
  code: '',
  description: '',
  scope: 'global',
  enterpriseScope: 'all',
  enterpriseIds: [],
  payrollFormula: defaultPayrollFormulaDisplay,
  serviceFeeFormula: defaultServiceFeeFormulaDisplay,
  enabled: true,
  isDefault: false,
})

const form = ref(emptyForm())
const settlementFormulaRef = ref<HTMLTextAreaElement | null>(null)
const serviceFeeFormulaRef = ref<HTMLTextAreaElement | null>(null)

const enterpriseOptions = computed(() =>
  store.enterprises.filter((e) => e.status !== 'terminated').map((e) => ({ value: e.id, label: e.name })),
)

const formulaContext = computed(() => buildFormulaFieldContext(store.billImportTemplates))

const settlementFormulaFields = computed(() => formulaContext.value.settlementFields)

const serviceFeeFormulaFields = computed(() => formulaContext.value.serviceFields)

const tableData = computed(() =>
  store.billingRules.map((r) => {
    const scope = resolveBillingEnterpriseScope(r)
    return {
      ...r,
      enterpriseScope: scope,
      enterpriseLabel: formatBillingEnterpriseLabel(
        { enterpriseScope: scope, enterpriseIds: r.enterpriseIds },
        store.enterprises,
      ),
      formulaTypeLabel:
        billingFormulaExamples.find((e) => e.formula === r.payrollFormula)?.label ??
        detectFormulaTypeLabel(r.payrollFormula),
      settlementFormulaDisplay: formatBillingFormulaDisplay(r.payrollFormula, store.billImportTemplates),
      serviceFeeFormulaDisplay: formatBillingFormulaDisplay(r.serviceFeeFormula, store.billImportTemplates),
      updatedLabel: new Date(r.updatedAt).toLocaleString('zh-CN'),
    }
  }),
)

function detectFormulaTypeLabel(formula: string) {
  const hasHourly = /work_hours|hourly_rate|attendance_days|overtime_hours/.test(formula)
  const hasTask = /task_count|task_unit_price/.test(formula)
  if (hasHourly && hasTask) return '工时+任务'
  if (hasTask) return '任务计薪'
  return '工时计薪'
}

function openCreate() {
  editingId.value = null
  form.value = emptyForm()
  formulaGroup.value = 'hourly'
  dialogVisible.value = true
}

function openEdit(row: BillingRule) {
  editingId.value = row.id
  form.value = {
    name: row.name,
    code: row.code,
    description: row.description ?? '',
    scope: row.scope ?? 'global',
    enterpriseScope: resolveBillingEnterpriseScope(row),
    enterpriseIds: row.enterpriseIds ? [...row.enterpriseIds] : [],
    payrollFormula: formatBillingFormulaDisplay(row.payrollFormula, store.billImportTemplates),
    serviceFeeFormula: formatBillingFormulaDisplay(row.serviceFeeFormula, store.billImportTemplates),
    enabled: row.enabled,
    isDefault: row.isDefault ?? false,
  }
  const matched = billingFormulaExamples.find((e) => e.formula === row.payrollFormula)
  formulaGroup.value = matched ? resolvePayrollFormulaGroupKey(matched.key) : 'hourly'
  dialogVisible.value = true
}

function applyFormulaExample(key: BillingFormulaExampleKey) {
  const example = billingFormulaExamples.find((e) => e.key === key)
  if (!example) return
  formulaGroup.value = resolvePayrollFormulaGroupKey(key)
  form.value.payrollFormula = example.display
  if (!(form.value.description ?? '').trim()) {
    form.value.description = example.description
  }
}

function insertField(fieldKey: string, target: 'settlement' | 'service_fee') {
  const label =
    formulaContext.value.fieldMap[fieldKey]?.label ??
    billingFormulaFieldMap[fieldKey as keyof typeof billingFormulaFieldMap]?.label ??
    fieldKey
  if (target === 'settlement') {
    form.value.payrollFormula += form.value.payrollFormula ? ` + ${label}` : label
    settlementFormulaRef.value?.focus()
  } else {
    form.value.serviceFeeFormula += form.value.serviceFeeFormula ? ` + ${label}` : label
    serviceFeeFormulaRef.value?.focus()
  }
}

watch(
  () => form.value.enterpriseScope,
  (scope) => {
    if (scope === 'all') form.value.enterpriseIds = []
  },
)

function submitForm() {
  const enterpriseIds = form.value.enterpriseIds ?? []
  if (!form.value.name.trim()) {
    ElMessage.warning('请填写规则名称')
    return
  }
  if (!form.value.code.trim()) {
    ElMessage.warning('请填写规则编码')
    return
  }
  if (form.value.enterpriseScope === 'specific' && !enterpriseIds.length) {
    ElMessage.warning('请选择适配企业')
    return
  }
  if (!form.value.payrollFormula.trim()) {
    ElMessage.warning('请填写结算金额公式')
    return
  }
  if (!form.value.serviceFeeFormula.trim()) {
    ElMessage.warning('请填写服务费金额公式')
    return
  }
  try {
    store.saveBillingRule({
      ...form.value,
      scope: 'global',
      enterpriseIds: form.value.enterpriseScope === 'specific' ? [...enterpriseIds] : undefined,
      payrollFormula: parseBillingFormulaStorage(form.value.payrollFormula, store.billImportTemplates),
      serviceFeeFormula: parseBillingFormulaStorage(form.value.serviceFeeFormula, store.billImportTemplates),
      id: editingId.value ?? undefined,
    })
    dialogVisible.value = false
    ElMessage.success(editingId.value ? '规则已更新' : '规则已创建')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败')
  }
}

function toggleRule(row: BillingRule) {
  const next = !row.enabled
  try {
    store.toggleBillingRule(row.id, next)
    ElMessage.success(next ? '规则已启用' : '规则已停用')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '操作失败')
  }
}

onMounted(() => {
  const highlight = route.query.highlight as string | undefined
  if (highlight) {
    const el = document.querySelector(`[data-rule-id="${highlight}"]`)
    el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
})
</script>

<template>
  <div class="page-card">
    <div class="page-header">
      <div>
        <h2 class="page-title">计薪规则</h2>
        <p class="text-muted">配置结算金额公式与服务费金额公式，支持按企业适配</p>
      </div>
      <el-button type="primary" @click="openCreate">新建规则</el-button>
    </div>

    <div class="example-cards">
      <div v-for="example in billingFormulaExamples" :key="example.key" class="example-card">
        <div class="example-head">
          <span class="example-title">{{ example.label }}</span>
          <el-button size="small" link type="primary" @click="openCreate(); applyFormulaExample(example.key)">
            使用示例
          </el-button>
        </div>
        <code class="formula-preview">{{ example.display }}</code>
        <p class="example-desc">{{ example.description }}</p>
      </div>
    </div>

    <el-table :data="tableData" border stripe row-key="id">
      <el-table-column prop="name" label="规则名称" min-width="140">
        <template #default="{ row }">
          <span :data-rule-id="row.id" class="rule-name">
            {{ row.name }}
            <el-tag v-if="row.isDefault" size="small" type="warning" style="margin-left: 6px">
              默认
            </el-tag>
          </span>
        </template>
      </el-table-column>
      <el-table-column prop="code" label="编码" width="140" />
      <el-table-column prop="formulaTypeLabel" label="计薪类型" width="100" />
      <el-table-column prop="enterpriseLabel" label="适配企业" min-width="140" show-overflow-tooltip />
      <el-table-column label="结算金额公式" min-width="240">
        <template #default="{ row }">
          <code class="formula-preview">{{ row.settlementFormulaDisplay }}</code>
        </template>
      </el-table-column>
      <el-table-column label="服务费金额公式" min-width="200">
        <template #default="{ row }">
          <code class="formula-preview">{{ row.serviceFeeFormulaDisplay }}</code>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="80">
        <template #default="{ row }">
          <el-tag size="small" :type="row.enabled ? 'success' : 'info'">
            {{ row.enabled ? '启用' : '停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="updatedLabel" label="更新时间" width="160" />
      <el-table-column label="操作" width="120" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
          <el-button link @click="toggleRule(row)">
            {{ row.enabled ? '停用' : '启用' }}
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>

  <el-dialog
    v-model="dialogVisible"
    :title="editingId ? '编辑计薪规则' : '新建计薪规则'"
    width="760px"
    destroy-on-close
  >
    <el-form label-width="110px">
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="规则名称" required>
            <el-input v-model="form.name" placeholder="如：标准工时计薪" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="规则编码" required>
            <el-input v-model="form.code" placeholder="如：PAYROLL_HOURLY" />
          </el-form-item>
        </el-col>
      </el-row>

      <el-form-item label="适配企业" required>
        <div class="enterprise-scope">
          <el-radio-group v-model="form.enterpriseScope">
            <el-radio value="all">全部企业</el-radio>
            <el-radio value="specific">特定企业</el-radio>
          </el-radio-group>
          <el-select
            v-if="form.enterpriseScope === 'specific'"
            v-model="form.enterpriseIds"
            multiple
            collapse-tags
            placeholder="选择企业"
            style="width: 100%; margin-top: 8px"
          >
            <el-option v-for="opt in enterpriseOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </div>
      </el-form-item>

      <el-form-item label="说明">
        <el-input v-model="form.description" type="textarea" :rows="2" placeholder="规则适用场景说明" />
      </el-form-item>

      <el-divider content-position="left">结算金额公式</el-divider>
      <div class="example-actions">
        <span class="section-hint">结算类型示例：</span>
        <el-button
          v-for="example in billingFormulaExamples"
          :key="example.key"
          size="small"
          :type="formulaGroup === example.key ? 'primary' : 'default'"
          @click="applyFormulaExample(example.key)"
        >
          {{ example.label }}
        </el-button>
      </div>
      <div class="field-tags">
        <el-tooltip
          v-for="f in settlementFormulaFields"
          :key="f.key"
          :content="`${f.description}${f.unit ? `（${f.unit}）` : ''}`"
          placement="top"
        >
          <el-tag class="field-tag" size="small" effect="plain">{{ f.label }}</el-tag>
        </el-tooltip>
      </div>
      <div v-if="formulaContext.templateFields.length" class="field-tags import-field-tags">
        <span class="section-hint">导入模板字段：</span>
        <el-tooltip
          v-for="f in formulaContext.templateFields"
          :key="`tpl-${f.key}`"
          :content="f.description"
          placement="top"
        >
          <el-tag class="field-tag" size="small" type="success" effect="plain">{{ f.label }}</el-tag>
        </el-tooltip>
      </div>
      <el-form-item label="结算金额" required>
        <div class="formula-editor">
          <div class="insert-bar">
            <span class="insert-label">插入字段：</span>
            <el-button
              v-for="f in settlementFormulaFields"
              :key="f.key"
              size="small"
              @click="insertField(f.key, 'settlement')"
            >
              {{ f.label }}
            </el-button>
          </div>
          <el-input
            ref="settlementFormulaRef"
            v-model="form.payrollFormula"
            type="textarea"
            :rows="2"
            placeholder="如：出勤工时 * 时薪单价 - 扣款"
          />
        </div>
      </el-form-item>

      <el-divider content-position="left">服务费金额公式</el-divider>
      <div class="field-tags">
        <el-tooltip
          v-for="f in serviceFeeFormulaFields"
          :key="f.key"
          :content="`${f.description}${f.unit ? `（${f.unit}）` : ''}`"
          placement="top"
        >
          <el-tag class="field-tag" size="small" effect="plain">{{ f.label }}</el-tag>
        </el-tooltip>
      </div>
      <el-form-item label="服务费金额" required>
        <div class="formula-editor">
          <div class="insert-bar">
            <span class="insert-label">插入字段：</span>
            <el-button
              v-for="f in serviceFeeFormulaFields"
              :key="f.key"
              size="small"
              @click="insertField(f.key, 'service_fee')"
            >
              {{ f.label }}
            </el-button>
          </div>
          <el-input
            ref="serviceFeeFormulaRef"
            v-model="form.serviceFeeFormula"
            type="textarea"
            :rows="2"
            placeholder="如：灵工薪酬 * 服务费率"
          />
        </div>
      </el-form-item>

      <el-form-item label="选项">
        <el-checkbox v-model="form.enabled">启用规则</el-checkbox>
        <el-checkbox v-model="form.isDefault">设为默认规则</el-checkbox>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" @click="submitForm">保存</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.example-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px;
  margin-bottom: 16px;
}

.example-card {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 12px 14px;
  background: #fafafa;
}

.example-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}

.example-title {
  font-weight: 600;
  font-size: 14px;
}

.example-desc {
  margin: 8px 0 0;
  font-size: 12px;
  color: #909399;
  line-height: 1.5;
}

.formula-preview {
  font-family: 'SF Mono', Menlo, monospace;
  font-size: 12px;
  color: var(--el-color-primary);
  word-break: break-all;
}

.rule-name {
  display: inline-flex;
  align-items: center;
}

.enterprise-scope {
  width: 100%;
}

.example-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
  padding-left: 110px;
  margin-bottom: 8px;
}

.section-hint {
  font-size: 12px;
  color: #909399;
}

.field-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0 0 8px 110px;
}

.field-tag {
  cursor: default;
}

.formula-editor {
  width: 100%;
}

.insert-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
}

.insert-label {
  font-size: 12px;
  color: var(--el-text-color-secondary);
  flex-shrink: 0;
}

@media (max-width: 1200px) {
  .example-cards {
    grid-template-columns: 1fr;
  }
}
</style>
