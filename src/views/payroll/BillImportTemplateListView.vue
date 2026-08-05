<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import BillImportTemplateForm from '@/components/payroll/BillImportTemplateForm.vue'
import {
  createDefaultImportFields,
  fieldCount,
  formatImportTemplateEnterpriseLabel,
  validateImportFields,
} from '@/constants/billImportTemplate'
import { downloadBillImportTemplate } from '@/services/billSettlement'
import type { BillImportFieldConfig, BillImportTemplate } from '@/types'
import { generateId } from '@/utils'

const store = useAppStore()

const keyword = ref('')
const dialogVisible = ref(false)
const editingId = ref<string | null>(null)

const enterpriseOptions = computed(() =>
  store.enterprises
    .filter((e) => e.status !== 'terminated')
    .map((e) => ({ value: e.id, label: e.name })),
)

const form = ref({
  name: '',
  enterpriseScope: 'all' as BillImportTemplate['enterpriseScope'],
  enterpriseIds: [] as string[],
  fields: createDefaultImportFields(generateId) as BillImportFieldConfig[],
})

const tableData = computed(() =>
  store.billImportTemplates
    .filter((t) => {
      if (!keyword.value.trim()) return true
      const kw = keyword.value.trim().toLowerCase()
      return t.name.toLowerCase().includes(kw)
    })
    .map((t) => ({
      ...t,
      enterpriseLabel: formatImportTemplateEnterpriseLabel(t, store.enterprises),
      fieldCount: fieldCount(t.fields),
      fieldPreview: t.fields.map((f) => f.label).slice(0, 4).join('、') + (t.fields.length > 4 ? '…' : ''),
      updatedLabel: new Date(t.updatedAt).toLocaleString('zh-CN'),
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
)

function emptyForm() {
  form.value = {
    name: '',
    enterpriseScope: 'all',
    enterpriseIds: [],
    fields: createDefaultImportFields(generateId),
  }
}

function openCreate() {
  editingId.value = null
  emptyForm()
  dialogVisible.value = true
}

function openEdit(row: BillImportTemplate) {
  editingId.value = row.id
  form.value = {
    name: row.name,
    enterpriseScope: row.enterpriseScope,
    enterpriseIds: row.enterpriseIds ? [...row.enterpriseIds] : [],
    fields: row.fields.map((f) => ({ ...f })),
  }
  dialogVisible.value = true
}

function saveTemplate() {
  if (!form.value.name.trim()) {
    ElMessage.warning('请输入模板名称')
    return
  }
  if (form.value.enterpriseScope === 'specific' && !form.value.enterpriseIds.length) {
    ElMessage.warning('请选择适配企业')
    return
  }
  const error = validateImportFields(form.value.fields)
  if (error) {
    ElMessage.warning(error)
    return
  }
  try {
    store.saveBillImportTemplate({
      id: editingId.value ?? undefined,
      name: form.value.name.trim(),
      enterpriseScope: form.value.enterpriseScope,
      enterpriseIds:
        form.value.enterpriseScope === 'specific' ? [...form.value.enterpriseIds] : undefined,
      fields: form.value.fields.map((f) => ({ ...f })),
    })
    dialogVisible.value = false
    ElMessage.success(editingId.value ? '模板已更新' : '模板已创建')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败')
  }
}

async function removeTemplate(row: BillImportTemplate) {
  try {
    await ElMessageBox.confirm(`确定删除导入模板「${row.name}」？`, '删除确认', {
      type: 'warning',
      confirmButtonText: '删除',
      cancelButtonText: '取消',
    })
    store.deleteBillImportTemplate(row.id)
    ElMessage.success('模板已删除')
  } catch {
    // cancelled
  }
}

function downloadTemplate(row: BillImportTemplate) {
  downloadBillImportTemplate({ fields: row.fields })
  ElMessage.success('模板已开始下载')
}
</script>

<template>
  <div class="page-card">
    <div class="page-header">
      <div>
        <h2 class="page-title">账单导入模板</h2>
        <p class="text-muted">
          维护 Excel 导入字段及取值要求；结算/服务费公式请在「计薪规则」中引用字段标识配置
        </p>
      </div>
      <el-button type="primary" @click="openCreate">新增模板</el-button>
    </div>

    <div class="page-toolbar">
      <el-input
        v-model="keyword"
        placeholder="搜索模板名称"
        clearable
        prefix-icon="Search"
        style="width: 240px"
      />
    </div>

    <el-table :data="tableData" border stripe>
      <el-table-column prop="name" label="模板名称" min-width="180" />
      <el-table-column prop="enterpriseLabel" label="适配企业" min-width="160" />
      <el-table-column prop="fieldCount" label="字段数" width="80" align="center" />
      <el-table-column prop="fieldPreview" label="字段概览" min-width="240" />
      <el-table-column prop="updatedLabel" label="更新时间" width="170" />
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
          <el-button link type="primary" @click="downloadTemplate(row)">下载模板</el-button>
          <el-button link type="danger" @click="removeTemplate(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <el-dialog
      v-model="dialogVisible"
      :title="editingId ? '编辑导入模板' : '新增导入模板'"
      width="920px"
      destroy-on-close
      @closed="emptyForm"
    >
      <el-form label-width="96px">
        <el-form-item label="模板名称" required>
          <el-input v-model="form.name" placeholder="如：标准工时+任务导入模板" maxlength="50" />
        </el-form-item>
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
              <el-option
                v-for="opt in enterpriseOptions"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </div>
        </el-form-item>
      </el-form>

      <BillImportTemplateForm v-model:fields="form.fields" />

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveTemplate">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.enterprise-scope {
  width: 100%;
}
</style>
