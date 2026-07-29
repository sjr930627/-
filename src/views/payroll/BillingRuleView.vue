<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import {
  hourlyPayrollFormulaFields,
  billingFormulaFieldMap,
  billingScopeMap,
  formatBillingFormulaDisplay,
  parseBillingFormulaStorage,
  defaultPayrollFormulaDisplay,
  defaultServiceFeeFormulaDisplay,
} from '@/constants/billingRule'
import type { BillingRule, BillingFormulaFieldKey } from '@/types'

const store = useAppStore()
const route = useRoute()

const dialogVisible = ref(false)
const editingId = ref<string | null>(null)

const emptyForm = (): Omit<BillingRule, 'id' | 'createdAt' | 'updatedAt'> => ({
  name: '',
  code: '',
  description: '',
  scope: 'enterprise',
  payrollFormula: defaultPayrollFormulaDisplay,
  serviceFeeFormula: defaultServiceFeeFormulaDisplay,
  enabled: true,
  isDefault: false,
})

const form = ref(emptyForm())
const payrollFormulaRef = ref<HTMLTextAreaElement | null>(null)

const tableData = computed(() =>
  store.billingRules.map((r) => ({
    ...r,
    scopeLabel: billingScopeMap[r.scope],
    formulaDisplay: formatBillingFormulaDisplay(r.payrollFormula),
    updatedLabel: new Date(r.updatedAt).toLocaleString('zh-CN'),
  })),
)

function openCreate() {
  editingId.value = null
  form.value = emptyForm()
  dialogVisible.value = true
}

function openEdit(row: BillingRule) {
  editingId.value = row.id
  form.value = {
    name: row.name,
    code: row.code,
    description: row.description ?? '',
    scope: row.scope,
    payrollFormula: formatBillingFormulaDisplay(row.payrollFormula),
    serviceFeeFormula: row.serviceFeeFormula,
    enabled: row.enabled,
    isDefault: row.isDefault ?? false,
  }
  dialogVisible.value = true
}

function insertField(field: BillingFormulaFieldKey) {
  const label = billingFormulaFieldMap[field].label
  form.value.payrollFormula += form.value.payrollFormula ? ` + ${label}` : label
  payrollFormulaRef.value?.focus()
}

function submitForm() {
  if (!form.value.name.trim()) {
    ElMessage.warning('请填写规则名称')
    return
  }
  if (!form.value.code.trim()) {
    ElMessage.warning('请填写规则编码')
    return
  }
  if (!form.value.payrollFormula.trim()) {
    ElMessage.warning('请填写时薪计薪公式')
    return
  }
  try {
    store.saveBillingRule({
      ...form.value,
      payrollFormula: parseBillingFormulaStorage(form.value.payrollFormula),
      serviceFeeFormula: parseBillingFormulaStorage(
        form.value.serviceFeeFormula || defaultServiceFeeFormulaDisplay,
      ),
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
        <p class="text-muted">配置时薪计薪公式，基于出勤工时、时薪单价等字段计算灵工薪酬</p>
      </div>
      <el-button type="primary" @click="openCreate">新建规则</el-button>
    </div>

    <el-alert
      type="info"
      :closable="false"
      title="公式由时薪相关字段与运算符（+、-、*、/、括号）组成。常用示例：出勤工时 × 时薪单价；考勤天数 × 时薪单价 × 8；出勤工时 × 时薪单价 + 加班工时 × 加班单价 - 扣款。"
      style="margin-bottom: 16px"
    />

    <el-table :data="tableData" border stripe row-key="id">
      <el-table-column prop="name" label="规则名称" min-width="160">
        <template #default="{ row }">
          <span :data-rule-id="row.id" class="rule-name">
            {{ row.name }}
            <el-tag v-if="row.isDefault" size="small" type="warning" style="margin-left: 6px">
              默认
            </el-tag>
          </span>
        </template>
      </el-table-column>
      <el-table-column prop="code" label="编码" width="160" />
      <el-table-column prop="description" label="说明" min-width="200" show-overflow-tooltip />
      <el-table-column prop="scopeLabel" label="适用范围" width="100" />
      <el-table-column label="时薪计薪公式" min-width="280">
        <template #default="{ row }">
          <code class="formula-preview">{{ row.formulaDisplay }}</code>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag size="small" :type="row.enabled ? 'success' : 'info'">
            {{ row.enabled ? '启用' : '停用' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="updatedLabel" label="更新时间" width="170" />
      <el-table-column label="操作" width="140" fixed="right">
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
    width="680px"
    destroy-on-close
  >
    <el-form label-width="100px">
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="规则名称" required>
            <el-input v-model="form.name" placeholder="如：标准时薪计薪" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="规则编码" required>
            <el-input v-model="form.code" placeholder="如：HOURLY_STANDARD" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="适用范围">
        <el-radio-group v-model="form.scope">
          <el-radio value="global">全局</el-radio>
          <el-radio value="enterprise">企业</el-radio>
          <el-radio value="department">部门</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="说明">
        <el-input v-model="form.description" type="textarea" :rows="2" placeholder="规则适用场景说明" />
      </el-form-item>

      <el-divider content-position="left">时薪字段</el-divider>
      <div class="field-tags">
        <el-tooltip
          v-for="f in hourlyPayrollFormulaFields"
          :key="f.key"
          :content="`${f.description}${f.unit ? `（${f.unit}）` : ''}`"
          placement="top"
        >
          <el-tag class="field-tag" size="small" effect="plain">
            {{ f.label }}
          </el-tag>
        </el-tooltip>
      </div>

      <el-form-item label="计薪公式" required style="margin-top: 16px">
        <div class="formula-editor">
          <div class="insert-bar">
            <span class="insert-label">插入字段：</span>
            <el-button
              v-for="f in hourlyPayrollFormulaFields"
              :key="f.key"
              size="small"
              @click="insertField(f.key)"
            >
              {{ f.label }}
            </el-button>
          </div>
          <el-input
            ref="payrollFormulaRef"
            v-model="form.payrollFormula"
            type="textarea"
            :rows="3"
            placeholder="如：出勤工时 * 时薪单价 + 加班工时 * 加班单价 - 扣款"
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

.field-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0 0 0 100px;
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
</style>
