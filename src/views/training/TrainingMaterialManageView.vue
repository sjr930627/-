<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import {
  formatFileSize,
  getMaterialCategoryLabel,
  getMaterialTypeLabel,
  trainingMaterialCategoryOptions,
  trainingMaterialStatusMap,
  trainingMaterialTypeOptions,
} from '@/constants/training'
import type { TrainingMaterial, TrainingMaterialCategory, TrainingMaterialType } from '@/types'

const store = useAppStore()
const keyword = ref('')
const typeFilter = ref<TrainingMaterialType | ''>('')
const categoryFilter = ref<TrainingMaterialCategory | ''>('')
const dialogVisible = ref(false)
const previewVisible = ref(false)
const editingId = ref<string | null>(null)
const previewItem = ref<TrainingMaterial | null>(null)

const form = ref({
  name: '',
  type: 'video' as TrainingMaterialType,
  category: 'info_security' as TrainingMaterialCategory,
  fileName: '',
  fileSize: 0,
  tags: [] as string[],
  description: '',
})

const tableData = computed(() =>
  store.trainingMaterials
    .filter((m) => {
      if (typeFilter.value && m.type !== typeFilter.value) return false
      if (categoryFilter.value && m.category !== categoryFilter.value) return false
      if (keyword.value.trim()) {
        const kw = keyword.value.trim().toLowerCase()
        if (
          !m.name.toLowerCase().includes(kw) &&
          !m.tags.some((t) => t.includes(kw))
        ) {
          return false
        }
      }
      return true
    })
    .map((m) => ({
      ...m,
      typeLabel: getMaterialTypeLabel(m.type),
      categoryLabel: getMaterialCategoryLabel(m.category),
      statusLabel: trainingMaterialStatusMap[m.status],
      refCount: store.getMaterialReferenceCount(m.id),
      fileSizeLabel: formatFileSize(m.fileSize),
    }))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
)

function openCreate() {
  editingId.value = null
  form.value = {
    name: '',
    type: 'video',
    category: 'info_security',
    fileName: '',
    fileSize: 0,
    tags: [],
    description: '',
  }
  dialogVisible.value = true
}

function openEdit(row: TrainingMaterial) {
  editingId.value = row.id
  form.value = {
    name: row.name,
    type: row.type,
    category: row.category,
    fileName: row.fileName,
    fileSize: row.fileSize,
    tags: [...row.tags],
    description: row.description ?? '',
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
  if (!form.value.name.trim() || !form.value.fileName) {
    ElMessage.warning('请填写资料名称并上传文件')
    return
  }
  const payload = {
    name: form.value.name.trim(),
    type: form.value.type,
    category: form.value.category,
    fileUrl: `/mock/training/${form.value.fileName}`,
    fileName: form.value.fileName,
    fileSize: form.value.fileSize || 1024,
    tags: form.value.tags,
    description: form.value.description,
    status: 'approved' as const,
  }
  try {
    if (editingId.value) {
      store.updateTrainingMaterial(editingId.value, payload)
      ElMessage.success('更新成功')
    } else {
      store.addTrainingMaterial(payload)
      ElMessage.success('上传成功，资料已审核确认')
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

function openPreview(row: TrainingMaterial) {
  previewItem.value = row
  previewVisible.value = true
}
</script>

<template>
  <div class="page-card">
    <div class="page-header">
      <div>
        <h2 class="page-title">培训资料管理</h2>
        <p class="text-muted">上传通用合规培训材料，作为课程的基础内容单元</p>
      </div>
      <el-button type="primary" @click="openCreate">上传资料</el-button>
    </div>

    <div class="page-toolbar">
      <el-input v-model="keyword" placeholder="搜索资料名称/标签" clearable style="width: 220px" />
      <el-select v-model="typeFilter" placeholder="资料类型" clearable style="width: 130px">
        <el-option v-for="o in trainingMaterialTypeOptions" :key="o.value" :label="o.label" :value="o.value" />
      </el-select>
      <el-select v-model="categoryFilter" placeholder="资料分类" clearable style="width: 140px">
        <el-option v-for="o in trainingMaterialCategoryOptions" :key="o.value" :label="o.label" :value="o.value" />
      </el-select>
    </div>

    <el-table :data="tableData" border stripe>
      <el-table-column prop="name" label="资料名称" min-width="180" />
      <el-table-column prop="typeLabel" label="类型" width="90" />
      <el-table-column prop="categoryLabel" label="分类" width="100" />
      <el-table-column prop="fileSizeLabel" label="文件大小" width="100" />
      <el-table-column label="上传时间" width="170">
        <template #default="{ row }">{{ row.createdAt.slice(0, 16).replace('T', ' ') }}</template>
      </el-table-column>
      <el-table-column label="被引用次数" width="110" align="center">
        <template #default="{ row }">
          <el-tag :type="row.refCount > 0 ? 'warning' : 'info'" size="small">{{ row.refCount }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag size="small" :type="row.status === 'approved' ? 'success' : 'info'">{{ row.statusLabel }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openPreview(row)">预览</el-button>
          <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
          <el-button link type="danger" @click="handleDelete(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>

  <el-dialog v-model="dialogVisible" :title="editingId ? '编辑培训资料' : '上传培训资料'" width="640px">
    <el-form label-width="100px">
      <el-form-item label="资料名称" required>
        <el-input v-model="form.name" placeholder="如：信息安全操作规范" />
      </el-form-item>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="资料类型" required>
            <el-select v-model="form.type" style="width: 100%">
              <el-option v-for="o in trainingMaterialTypeOptions" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="资料分类" required>
            <el-select v-model="form.category" style="width: 100%">
              <el-option v-for="o in trainingMaterialCategoryOptions" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="资料文件" required>
        <el-upload drag :auto-upload="false" :limit="1" :on-change="onUploadChange">
          <div class="el-upload__text">拖拽或点击上传<br><small>视频 MP4≤500M / PDF≤50M / 图片≤10M</small></div>
        </el-upload>
        <div v-if="form.fileName" class="text-muted" style="margin-top: 8px">已选：{{ form.fileName }}</div>
      </el-form-item>
      <el-form-item label="标签">
        <el-select v-model="form.tags" multiple filterable allow-create default-first-option placeholder="自定义标签" style="width: 100%" />
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

  <el-dialog v-model="previewVisible" title="资料预览" width="560px">
    <template v-if="previewItem">
      <p><strong>{{ previewItem.name }}</strong></p>
      <p class="text-muted">{{ getMaterialTypeLabel(previewItem.type) }} · {{ getMaterialCategoryLabel(previewItem.category) }}</p>
      <div v-if="previewItem.type === 'video'" class="preview-box">▶ 视频预览：{{ previewItem.fileName }}</div>
      <div v-else-if="previewItem.type === 'pdf'" class="preview-box">📄 PDF 预览：{{ previewItem.fileName }}</div>
      <div v-else class="preview-box">🖼 图文预览：{{ previewItem.fileName }}</div>
      <div v-if="previewItem.description" style="margin-top: 12px" v-html="previewItem.description" />
    </template>
  </el-dialog>
</template>

<style scoped>
.preview-box {
  padding: 40px;
  text-align: center;
  background: #f5f7fa;
  border-radius: 8px;
  color: #606266;
}
</style>
