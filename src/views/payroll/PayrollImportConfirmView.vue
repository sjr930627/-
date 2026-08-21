<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { usePortal } from '@/composables/usePortal'
import { formatMoney } from '@/constants/payrollBill'
import {
  clearPayrollImportDraft,
  loadPayrollImportDraft,
  matchEmployeeByPhone,
  savePayrollImportDraft,
  summarizePayrollImportLines,
  type PayrollImportDraft,
  type PayrollImportDraftLine,
} from '@/services/payrollImport'

const store = useAppStore()
const router = useRouter()
const { pathPrefix } = usePortal()

const draft = ref<PayrollImportDraft | null>(null)
const saving = ref(false)
const addVisible = ref(false)

const addForm = reactive({
  phone: '',
  employeeName: '',
  amount: undefined as number | undefined,
})

const summary = computed(() =>
  draft.value ? summarizePayrollImportLines(draft.value.lines) : { workerCount: 0, totalAmount: 0 },
)

onMounted(() => {
  draft.value = loadPayrollImportDraft()
  if (!draft.value) {
    ElMessage.warning('请先上传发薪文件')
    router.replace(`${pathPrefix.value}/payroll/settlement/import`)
  }
})

function goBack() {
  router.push(`${pathPrefix.value}/payroll/settlement/import`)
}

function persistDraft() {
  if (draft.value) savePayrollImportDraft(draft.value)
}

function removeLine(id: string) {
  if (!draft.value) return
  draft.value.lines = draft.value.lines.filter((line) => line.id !== id)
  persistDraft()
}

function openAdd() {
  addForm.phone = ''
  addForm.employeeName = ''
  addForm.amount = undefined
  addVisible.value = true
}

function onPhoneBlur() {
  if (!draft.value || !addForm.phone.trim()) return
  const matched = matchEmployeeByPhone(store.employees, addForm.phone, draft.value.enterpriseId)
  if (matched && !addForm.employeeName.trim()) {
    addForm.employeeName = matched.name
  }
}

function submitAdd() {
  if (!draft.value) return
  if (!addForm.phone.trim()) {
    ElMessage.warning('请填写手机号')
    return
  }
  if (!addForm.employeeName.trim()) {
    ElMessage.warning('请填写姓名')
    return
  }
  if (addForm.amount == null || !Number.isFinite(addForm.amount) || addForm.amount < 0) {
    ElMessage.warning('请填写有效发薪金额')
    return
  }
  const matched = matchEmployeeByPhone(store.employees, addForm.phone, draft.value.enterpriseId)
  const line: PayrollImportDraftLine = {
    id: `pil_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    phone: addForm.phone.trim(),
    employeeName: addForm.employeeName.trim(),
    amount: Math.round(addForm.amount * 100) / 100,
    employeeId: matched?.id,
    employeeNo: matched?.employeeNo,
  }
  draft.value.lines.push(line)
  persistDraft()
  addVisible.value = false
  ElMessage.success('已添加人员')
}

function onAmountChange(row: PayrollImportDraftLine) {
  if (!Number.isFinite(row.amount) || row.amount < 0) {
    row.amount = 0
  } else {
    row.amount = Math.round(row.amount * 100) / 100
  }
  persistDraft()
}

async function confirmPayroll() {
  if (!draft.value) return
  if (!draft.value.lines.length) {
    ElMessage.warning('请至少保留一条发薪明细')
    return
  }
  saving.value = true
  try {
    const slip = store.createImportPayrollSlip({
      enterpriseId: draft.value.enterpriseId,
      enterpriseName: draft.value.enterpriseName,
      lines: draft.value.lines,
    })
    clearPayrollImportDraft()
    ElMessage.success(`结算单 ${slip.slipNo} 已生成`)
    router.replace(`${pathPrefix.value}/payroll/settlement/slip/${slip.id}`)
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '确认发薪失败')
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div v-if="draft" class="page-card">
    <div class="page-header">
      <div class="header-left">
        <el-button :icon="ArrowLeft" @click="goBack">返回修改</el-button>
        <div>
          <h2 class="page-title">确认导入发薪</h2>
          <p class="text-muted">
            {{ draft.enterpriseName }}
            <template v-if="draft.fileName"> · {{ draft.fileName }}</template>
          </p>
        </div>
      </div>
      <div class="header-actions">
        <el-button @click="openAdd">增加人员</el-button>
        <el-button type="primary" :loading="saving" @click="confirmPayroll">
          确认发薪
        </el-button>
      </div>
    </div>

    <el-descriptions :column="3" border class="summary-desc">
      <el-descriptions-item label="企业">{{ draft.enterpriseName }}</el-descriptions-item>
      <el-descriptions-item label="人数">{{ summary.workerCount }}</el-descriptions-item>
      <el-descriptions-item label="发薪金额合计">
        {{ formatMoney(summary.totalAmount) }}
      </el-descriptions-item>
    </el-descriptions>

    <h3 class="section-title">发薪明细</h3>

    <el-table :data="draft.lines" border stripe>
      <el-table-column prop="phone" label="手机号" min-width="140" />
      <el-table-column prop="employeeName" label="姓名" min-width="120" />
      <el-table-column prop="employeeNo" label="工号" width="120">
        <template #default="{ row }">{{ row.employeeNo || '—' }}</template>
      </el-table-column>
      <el-table-column label="发薪金额" width="180" align="right">
        <template #default="{ row }">
          <el-input-number
            v-model="row.amount"
            :min="0"
            :precision="2"
            :controls="false"
            style="width: 140px"
            @change="onAmountChange(row)"
          />
        </template>
      </el-table-column>
      <el-table-column label="操作" width="90" fixed="right">
        <template #default="{ row }">
          <el-button link type="danger" @click="removeLine(row.id)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>

    <p class="footer-sum">
      合计 {{ summary.workerCount }} 人，金额 {{ formatMoney(summary.totalAmount) }}
    </p>

    <el-dialog v-model="addVisible" title="增加人员" width="420px" destroy-on-close>
      <el-form label-width="88px">
        <el-form-item label="手机号" required>
          <el-input v-model="addForm.phone" placeholder="请输入手机号" @blur="onPhoneBlur" />
        </el-form-item>
        <el-form-item label="姓名" required>
          <el-input v-model="addForm.employeeName" placeholder="请输入姓名" />
        </el-form-item>
        <el-form-item label="发薪金额" required>
          <el-input-number
            v-model="addForm.amount"
            :min="0"
            :precision="2"
            :controls="false"
            style="width: 100%"
            placeholder="请输入金额"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addVisible = false">取消</el-button>
        <el-button type="primary" @click="submitAdd">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.header-left {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.summary-desc {
  margin-bottom: 20px;
}

.section-title {
  margin: 0 0 12px;
  font-size: 16px;
  font-weight: 600;
}

.footer-sum {
  margin-top: 12px;
  font-size: 14px;
  color: var(--el-text-color-regular);
}
</style>
