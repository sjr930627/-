<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft } from '@element-plus/icons-vue'
import { ElMessage, type UploadFile, type UploadInstance } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { usePortal } from '@/composables/usePortal'
import {
  downloadPayrollImportTemplate,
  parsePayrollImportFile,
  savePayrollImportDraft,
} from '@/services/payrollImport'

const store = useAppStore()
const router = useRouter()
const { pathPrefix } = usePortal()

const enterpriseId = ref('')
const uploadRef = ref<UploadInstance>()
const importFile = ref<File | null>(null)
const parsing = ref(false)

const enterpriseOptions = computed(() =>
  store.enterprises
    .filter((e) => e.status !== 'terminated')
    .map((e) => ({ label: e.name, value: e.id })),
)

function goBack() {
  router.push(`${pathPrefix.value}/payroll/settlement`)
}

function onFileChange(uploadFile: UploadFile) {
  importFile.value = (uploadFile.raw as File) ?? null
}

function onFileRemove() {
  importFile.value = null
}

async function goConfirm() {
  if (!enterpriseId.value) {
    ElMessage.warning('请先选择企业')
    return
  }
  if (!importFile.value) {
    ElMessage.warning('请上传 Excel/CSV 文件')
    return
  }
  const enterprise = store.enterprises.find((e) => e.id === enterpriseId.value)
  if (!enterprise) {
    ElMessage.error('企业不存在')
    return
  }

  parsing.value = true
  try {
    const lines = await parsePayrollImportFile(
      importFile.value,
      store.employees,
      enterpriseId.value,
    )
    savePayrollImportDraft({
      enterpriseId: enterprise.id,
      enterpriseName: enterprise.name,
      fileName: importFile.value.name,
      lines,
    })
    router.push(`${pathPrefix.value}/payroll/settlement/import/confirm`)
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '解析失败')
  } finally {
    parsing.value = false
  }
}
</script>

<template>
  <div class="page-card">
    <div class="page-header">
      <div class="header-left">
        <el-button :icon="ArrowLeft" @click="goBack">返回</el-button>
        <div>
          <h2 class="page-title">导入发薪</h2>
          <p class="text-muted">选择企业并上传发薪明细，下一步确认金额汇总后生成结算单</p>
        </div>
      </div>
    </div>

    <el-form label-width="100px" class="import-form" style="max-width: 560px">
      <el-form-item label="企业" required>
        <el-select
          v-model="enterpriseId"
          filterable
          placeholder="请选择企业"
          style="width: 100%"
        >
          <el-option
            v-for="opt in enterpriseOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
      </el-form-item>

      <el-form-item label="发薪文件" required>
        <div class="upload-block">
          <el-upload
            ref="uploadRef"
            :auto-upload="false"
            :limit="1"
            accept=".xlsx,.xls,.csv"
            :on-change="onFileChange"
            :on-remove="onFileRemove"
          >
            <el-button>选择 Excel / CSV</el-button>
          </el-upload>
          <el-button link type="primary" @click="downloadPayrollImportTemplate">
            下载 CSV 模板
          </el-button>
          <p class="hint">必含列：手机号、姓名、发薪金额。CSV 按表头解析；xlsx 本地预览为演示数据</p>
        </div>
      </el-form-item>

      <el-form-item>
        <el-button type="primary" :loading="parsing" @click="goConfirm">
          下一步：确认导入数据
        </el-button>
      </el-form-item>
    </el-form>
  </div>
</template>

<style scoped>
.header-left {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.upload-block {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.hint {
  margin: 0;
  font-size: 12px;
  color: var(--el-text-color-secondary);
  line-height: 1.5;
}
</style>
