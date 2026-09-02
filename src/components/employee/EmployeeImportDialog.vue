<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage, type UploadFile, type UploadInstance } from 'element-plus'
import { useAppStore } from '@/stores/app'
import {
  downloadEmployeeImportTemplate,
  parseEmployeeImportFile,
  type EmployeeImportFailure,
} from '@/services/employeeImport'

const props = defineProps<{
  visible: boolean
  defaultDepartmentId?: string
}>()

const emit = defineEmits<{
  'update:visible': [value: boolean]
  imported: [count: number]
}>()

const store = useAppStore()
const uploadRef = ref<UploadInstance>()
const selectedFile = ref<File | null>(null)
const importing = ref(false)
const importDone = ref(false)
const successCount = ref(0)
const failures = ref<EmployeeImportFailure[]>([])

function resetState() {
  selectedFile.value = null
  importing.value = false
  importDone.value = false
  successCount.value = 0
  failures.value = []
  uploadRef.value?.clearFiles()
}

function close() {
  emit('update:visible', false)
  resetState()
}

function handleVisibleChange(open: boolean) {
  emit('update:visible', open)
  if (!open) resetState()
}

function handleDownloadTemplate() {
  downloadEmployeeImportTemplate()
  ElMessage.success('模板已开始下载')
}

function handleFileChange(file: UploadFile) {
  if (file.raw && file.raw.size > 5 * 1024 * 1024) {
    ElMessage.warning('文件大小不能超过 5MB')
    uploadRef.value?.clearFiles()
    selectedFile.value = null
    return
  }
  selectedFile.value = file.raw ?? null
  importDone.value = false
  failures.value = []
  successCount.value = 0
}

function handleFileRemove() {
  selectedFile.value = null
  importDone.value = false
  failures.value = []
  successCount.value = 0
}

async function handleImport() {
  if (!selectedFile.value) {
    ElMessage.warning('请先上传导入文件')
    return
  }

  importing.value = true
  try {
    const text = await selectedFile.value.text()
    const result = parseEmployeeImportFile(text, store.departments, store.employees)

    result.rows.forEach((row) => {
      store.addEmployee({
        name: row.name,
        phone: row.phone,
        gender: row.gender,
        employeeNo: row.employeeNo,
        age: row.age,
        email: row.email,
        hireDate: row.hireDate,
        address: row.address,
        position: row.position,
        departmentId: row.departmentId || props.defaultDepartmentId || '',
        remark: row.remark,
        status: row.status,
        skills: row.skills,
        skillCertificates: row.skills.map((name, index) => ({
          id: `cert_import_${Date.now()}_${index}`,
          name,
        })),
        preferredShiftIds: [],
        unavailableDates: [],
        dataSource: 'manual',
      })
    })

    successCount.value = result.rows.length
    failures.value = result.failures
    importDone.value = true

    if (result.rows.length > 0) {
      ElMessage.success(`成功导入 ${result.rows.length} 条人员数据`)
      emit('imported', result.rows.length)
    }
    if (result.rows.length === 0 && result.failures.length > 0) {
      ElMessage.error('导入失败，请检查文件内容')
    }
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '文件解析失败')
  } finally {
    importing.value = false
  }
}
</script>

<template>
  <el-dialog
    :model-value="visible"
    title="批量导入人员"
    width="560px"
    destroy-on-close
    class="employee-import-dialog"
    @update:model-value="handleVisibleChange"
  >
    <div class="import-section">
      <div class="section-title">
        <span class="step">1</span>
        <span>下载导入模板</span>
      </div>
      <p class="section-desc">请按模板格式填写人员信息。部门留空或填写「待入驻人员」将导入至待入驻池。</p>
      <el-button type="primary" class="download-template-btn" @click="handleDownloadTemplate">
        <el-icon><Download /></el-icon>
        下载模板
      </el-button>
    </div>

    <div class="import-section">
      <div class="section-title">
        <span class="step">2</span>
        <span>上传导入文件</span>
      </div>
      <p class="section-desc">支持 CSV 格式，文件大小不超过 5MB。</p>
      <el-upload
        ref="uploadRef"
        drag
        :auto-upload="false"
        accept=".csv"
        :limit="1"
        :on-change="handleFileChange"
        :on-remove="handleFileRemove"
        :on-exceed="() => ElMessage.warning('仅支持上传一个文件')"
      >
        <el-icon class="upload-icon"><UploadFilled /></el-icon>
        <div class="upload-text">点击或拖拽文件到此处上传</div>
        <div class="upload-hint">仅支持 .csv 文件</div>
      </el-upload>
    </div>

    <el-alert
      v-if="importDone"
      :type="failures.length ? 'warning' : 'success'"
      :closable="false"
      show-icon
      class="import-result"
    >
      <template #title>
        {{ successCount > 0 ? `成功导入 ${successCount} 条` : '未导入任何数据' }}
        <template v-if="failures.length">，失败 {{ failures.length }} 条</template>
      </template>
      <ul v-if="failures.length" class="failure-list">
        <li v-for="item in failures.slice(0, 5)" :key="`${item.row}-${item.reason}`">
          第 {{ item.row }} 行（{{ item.name }}）：{{ item.reason }}
        </li>
        <li v-if="failures.length > 5">……还有 {{ failures.length - 5 }} 条失败记录</li>
      </ul>
    </el-alert>

    <template #footer>
      <el-button @click="close">取消</el-button>
      <el-button type="primary" :loading="importing" @click="handleImport">
        开始导入
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.import-section + .import-section {
  margin-top: 20px;
}

.section-title {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 14px;
  font-weight: 600;
  color: #334155;
}

.step {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: var(--app-primary-light, #ede9fe);
  color: var(--app-primary, #5b4fdb);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
}

.section-desc {
  margin: 0 0 12px;
  font-size: 13px;
  color: #64748b;
  line-height: 1.6;
}

.download-template-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.upload-icon {
  font-size: 32px;
  color: #94a3b8;
  margin-bottom: 8px;
}

.upload-text {
  font-size: 14px;
  color: #475569;
}

.upload-hint {
  margin-top: 4px;
  font-size: 12px;
  color: #94a3b8;
}

.import-result {
  margin-top: 16px;
}

.failure-list {
  margin: 8px 0 0;
  padding-left: 18px;
  font-size: 13px;
  line-height: 1.7;
  color: #64748b;
}
</style>
