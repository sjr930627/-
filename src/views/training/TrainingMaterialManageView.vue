<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { useTrainingScope } from '@/composables/useTrainingScope'
import { trainingTypeFilterOptions, trainingOwnerTypeOptions } from '@/constants/trainingOwner'
import {
  formatFileSize,
  getMaterialTypeLabel,
  trainingMaterialTypeOptions,
} from '@/constants/training'
import { filterDepartmentsByEnterprise, isGlobalTrainingOwner, type TrainingOwnerScope } from '@/services/training'
import type { TrainingMaterial, TrainingMaterialType } from '@/types'

const store = useAppStore()
const {
  isPlatform,
  isEnterprise,
  typeFilter,
  enterpriseFilter,
  defaultEnterpriseId,
  filterByTrainingType,
  ownerTypeLabel,
} = useTrainingScope()

const keyword = ref('')
const typeFilterMedia = ref<TrainingMaterialType | ''>('')
const dialogVisible = ref(false)
const editingId = ref<string | null>(null)

const form = ref({
  ownerType: 'enterprise' as TrainingOwnerScope,
  enterpriseId: defaultEnterpriseId.value as string | null,
  name: '',
  type: 'video' as TrainingMaterialType,
  fileName: '',
  fileSize: 0,
  description: '',
  departmentScope: 'all' as 'all' | 'department',
  departmentIds: [] as string[],
})

const formDepartments = computed(() =>
  filterDepartmentsByEnterprise(store.departments, form.value.enterpriseId || undefined),
)

watch(
  () => form.value.ownerType,
  (t) => {
    if (t === 'global') {
      form.value.enterpriseId = null
      form.value.departmentScope = 'all'
      form.value.departmentIds = []
    } else if (!form.value.enterpriseId) {
      form.value.enterpriseId = defaultEnterpriseId.value
    }
  },
)

watch(
  () => [form.value.ownerType, form.value.enterpriseId] as const,
  () => {
    const allowed = new Set(formDepartments.value.map((d) => d.id))
    form.value.departmentIds = form.value.departmentIds.filter((id) => allowed.has(id))
  },
)

watch(
  () => form.value.departmentScope,
  (scope) => {
    if (scope === 'all') form.value.departmentIds = []
  },
)

const tableData = computed(() =>
  filterByTrainingType(store.trainingMaterials)
    .filter((m) => {
      if (typeFilterMedia.value && m.type !== typeFilterMedia.value) return false
      if (keyword.value.trim()) {
        const kw = keyword.value.trim().toLowerCase()
        if (!m.name.toLowerCase().includes(kw)) return false
      }
      return true
    })
    .map((m) => ({
      ...m,
      ownerTypeLabel: ownerTypeLabel(m.enterpriseId),
      typeLabel: getMaterialTypeLabel(m.type),
      refCount: store.getMaterialReferenceCount(m.id),
      fileSizeLabel: formatFileSize(m.fileSize),
      enterpriseName: isGlobalTrainingOwner(m.enterpriseId)
        ? '-'
        : store.enterprises.find((e) => e.id === m.enterpriseId)?.shortName ||
          store.enterprises.find((e) => e.id === m.enterpriseId)?.name ||
          '-',
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
)

function openCreate() {
  editingId.value = null
  form.value = {
    ownerType: isEnterprise.value ? 'enterprise' : 'enterprise',
    enterpriseId: defaultEnterpriseId.value,
    name: '',
    type: 'video',
    fileName: '',
    fileSize: 0,
    description: '',
    departmentScope: 'all',
    departmentIds: [],
  }
  dialogVisible.value = true
}

function openEdit(row: TrainingMaterial) {
  editingId.value = row.id
  form.value = {
    ownerType: isGlobalTrainingOwner(row.enterpriseId) ? 'global' : 'enterprise',
    enterpriseId: row.enterpriseId ?? defaultEnterpriseId.value,
    name: row.name,
    type: row.type,
    fileName: row.fileName,
    fileSize: row.fileSize,
    description: row.description ?? '',
    departmentScope: row.departmentScope ?? 'all',
    departmentIds: [...(row.departmentIds ?? [])],
  }
  dialogVisible.value = true
}

function handleFileChange(uploadFile: { name: string; size?: number }) {
  form.value.fileName = uploadFile.name
  form.value.fileSize = uploadFile.size ?? 0
  const ext = uploadFile.name.split('.').pop()?.toLowerCase()
  if (['mp4', 'mov'].includes(ext ?? '')) form.value.type = 'video'
  else if (ext === 'pdf') form.value.type = 'pdf'
  else form.value.type = 'article'
}

function onUploadChange(file: { name: string; raw?: File }) {
  handleFileChange({ name: file.name, size: file.raw?.size })
}

function submit() {
  const isGlobal = form.value.ownerType === 'global'
  if (!isGlobal && !form.value.enterpriseId) {
    ElMessage.warning('请选择所属企业')
    return
  }
  if (!form.value.name.trim() || !form.value.fileName) {
    ElMessage.warning('请填写资料名称并上传文件')
    return
  }
  if (form.value.departmentScope === 'department' && form.value.departmentIds.length === 0) {
    ElMessage.warning('请选择部门')
    return
  }
  const payload = {
    enterpriseId: isGlobal ? null : form.value.enterpriseId,
    name: form.value.name.trim(),
    type: form.value.type,
    fileUrl: `/mock/training/${form.value.fileName}`,
    fileName: form.value.fileName,
    fileSize: form.value.fileSize || 1024,
    tags: [] as string[],
    description: form.value.description,
    departmentScope: isGlobal ? ('all' as const) : form.value.departmentScope,
    departmentIds:
      !isGlobal && form.value.departmentScope === 'department'
        ? form.value.departmentIds
        : undefined,
    status: 'approved' as const,
  }
  try {
    if (editingId.value) {
      store.updateTrainingMaterial(editingId.value, payload)
      ElMessage.success('更新成功')
    } else {
      store.addTrainingMaterial(payload)
      ElMessage.success('上传成功')
    }
    dialogVisible.value = false
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '操作失败')
  }
}

async function handleDelete(row: TrainingMaterial & { refCount: number }) {
  if (row.refCount > 0) {
    ElMessage.warning(`该资料已被 ${row.refCount} 门课程引用，不可删除`)
    return
  }
  await ElMessageBox.confirm(`确定删除资料「${row.name}」？`, '提示', { type: 'warning' })
  try {
    store.removeTrainingMaterial(row.id)
    ElMessage.success('已删除')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '删除失败')
  }
}
</script>

<template>
  <div class="page-card">
    <div class="page-header">
      <div>
        <h2 class="page-title">培训资料管理</h2>
        <p class="text-muted">按类型区分企业培训与通用培训资料，作为课程的基础内容单元</p>
      </div>
      <el-button type="primary" @click="openCreate">上传资料</el-button>
    </div>

    <div class="page-toolbar">
      <el-select
        v-if="isPlatform"
        v-model="typeFilter"
        placeholder="类型"
        style="width: 120px"
      >
        <el-option
          v-for="o in trainingTypeFilterOptions"
          :key="o.value"
          :label="o.label"
          :value="o.value"
        />
      </el-select>
      <el-select
        v-if="isPlatform && typeFilter !== 'global'"
        v-model="enterpriseFilter"
        placeholder="所属企业"
        clearable
        style="width: 200px"
      >
        <el-option v-for="e in store.enterprises" :key="e.id" :label="e.name" :value="e.id" />
      </el-select>
      <el-input v-model="keyword" placeholder="搜索资料名称" clearable style="width: 220px" />
      <el-select v-model="typeFilterMedia" placeholder="资料类型" clearable style="width: 130px">
        <el-option v-for="o in trainingMaterialTypeOptions" :key="o.value" :label="o.label" :value="o.value" />
      </el-select>
    </div>

    <el-table :data="tableData" border stripe>
      <el-table-column v-if="isPlatform" prop="ownerTypeLabel" label="类型" width="80">
        <template #default="{ row }">
          <el-tag size="small" :type="row.enterpriseId == null ? 'warning' : 'primary'">
            {{ row.ownerTypeLabel }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column
        v-if="isPlatform"
        prop="enterpriseName"
        label="所属企业"
        width="120"
        show-overflow-tooltip
      />
      <el-table-column prop="name" label="资料名称" min-width="180" />
      <el-table-column prop="typeLabel" label="资料类型" width="90" />
      <el-table-column prop="fileSizeLabel" label="文件大小" width="100" />
      <el-table-column label="上传时间" width="170">
        <template #default="{ row }">{{ row.createdAt.slice(0, 16).replace('T', ' ') }}</template>
      </el-table-column>
      <el-table-column label="被引用次数" width="110" align="center">
        <template #default="{ row }">
          <el-tag :type="row.refCount > 0 ? 'warning' : 'info'" size="small">{{ row.refCount }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="140" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
          <el-button link type="danger" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>

  <el-dialog v-model="dialogVisible" :title="editingId ? '编辑培训资料' : '上传培训资料'" width="640px">
    <el-form label-width="100px">
      <el-form-item v-if="isPlatform" label="类型" required>
        <el-radio-group v-model="form.ownerType">
          <el-radio
            v-for="o in trainingOwnerTypeOptions"
            :key="o.value"
            :value="o.value"
          >
            {{ o.label }}
          </el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item v-if="form.ownerType === 'enterprise'" label="所属企业" required>
        <el-select
          v-model="form.enterpriseId"
          style="width: 100%"
          :disabled="isEnterprise"
          placeholder="选择企业"
        >
          <el-option v-for="e in store.enterprises" :key="e.id" :label="e.name" :value="e.id" />
        </el-select>
      </el-form-item>
      <el-form-item v-if="form.ownerType === 'enterprise'" label="部门选择">
        <el-radio-group v-model="form.departmentScope">
          <el-radio value="all">全部部门</el-radio>
          <el-radio value="department">指定部门</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item
        v-if="form.ownerType === 'enterprise' && form.departmentScope === 'department'"
        label="选择部门"
      >
        <el-select
          v-model="form.departmentIds"
          multiple
          filterable
          style="width: 100%"
          placeholder="选择部门"
        >
          <el-option v-for="d in formDepartments" :key="d.id" :label="d.name" :value="d.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="资料名称" required>
        <el-input v-model="form.name" placeholder="如：信息安全操作规范" />
      </el-form-item>
      <el-form-item label="资料类型" required>
        <el-select v-model="form.type" style="width: 100%">
          <el-option v-for="o in trainingMaterialTypeOptions" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
      </el-form-item>
      <el-form-item label="资料文件" required>
        <el-upload drag :auto-upload="false" :limit="1" :on-change="onUploadChange">
          <div class="el-upload__text">拖拽或点击上传<br><small>视频 MP4≤500M / PDF≤50M / 图片≤10M</small></div>
        </el-upload>
        <div v-if="form.fileName" class="text-muted" style="margin-top: 8px">已选：{{ form.fileName }}</div>
      </el-form-item>
      <el-form-item label="资料简介">
        <el-input v-model="form.description" type="textarea" :rows="3" placeholder="对该资料的简要说明" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" @click="submit">保存</el-button>
    </template>
  </el-dialog>
</template>
