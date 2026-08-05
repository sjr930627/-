<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'
import { usePortal } from '@/composables/usePortal'
import { getExceptionLabel } from '@/services/attendance'

const route = useRoute()
const router = useRouter()
const store = useAppStore()
const { pathPrefix } = usePortal()

const exception = computed(() =>
  store.exceptions.find((e) => e.id === route.params.id as string),
)

const employee = computed(() =>
  exception.value
    ? store.employees.find((e) => e.id === exception.value!.employeeId)
    : undefined,
)

const departmentName = computed(() => {
  const deptId = employee.value?.departmentId
  if (!deptId) return '—'
  return store.departments.find((d) => d.id === deptId)?.name ?? '—'
})

const statusLabel = computed(() => {
  if (!exception.value) return '—'
  const map = {
    open: '待处理',
    appealed: '申诉中',
    resolved: '已处理',
    dismissed: '已忽略',
  } as const
  return map[exception.value.status]
})

const relatedMakeup = computed(() => {
  if (!exception.value || exception.value.type !== 'missing_punch') return null
  return store.makeupRequests.find(
    (r) =>
      r.employeeId === exception.value!.employeeId &&
      r.date === exception.value!.date &&
      r.status === 'pending',
  )
})

function goBack() {
  router.push(`${pathPrefix.value}/dashboard`)
}

async function resolveException(dismiss = false) {
  if (!exception.value) return
  try {
    const { value } = await ElMessageBox.prompt(
      dismiss ? '忽略原因' : '处理说明',
      dismiss ? '忽略异常' : '确认处理',
      {
        inputValue: dismiss ? '经核实无需处理' : '已核实并处理',
        inputPlaceholder: '请输入说明',
      },
    )
    store.resolveException(exception.value.id, value.trim(), '人事管理员', dismiss)
    ElMessage.success(dismiss ? '已忽略' : '处理完成')
    goBack()
  } catch {
    // cancelled
  }
}

async function approveMakeup() {
  if (!exception.value || !relatedMakeup.value) return
  try {
    const { value } = await ElMessageBox.prompt('审批意见（可选）', '通过补卡申请', {
      inputValue: '同意补卡',
    })
    store.reviewMakeupForException(
      relatedMakeup.value.id,
      exception.value.id,
      true,
      value?.trim() ?? '',
    )
    ElMessage.success('补卡已通过，异常已关闭')
    goBack()
  } catch {
    // cancelled
  }
}

async function goAttendanceData() {
  if (!exception.value) return
  router.push({
    path: `${pathPrefix.value}/attendance-data`,
    query: { tab: 'daily', date: exception.value.date, employee: exception.value.employeeId },
  })
}
</script>

<template>
  <div v-if="exception" class="page-card">
    <div class="page-header">
      <div class="header-left">
        <el-button :icon="ArrowLeft" link @click="goBack">返回工作台</el-button>
        <div>
          <h2 class="page-title">考勤异常处理</h2>
          <p class="text-muted">{{ employee?.name ?? '员工' }} · {{ exception.date }}</p>
        </div>
      </div>
      <el-tag
        :type="exception.status === 'open' ? 'danger' : exception.status === 'appealed' ? 'warning' : 'success'"
      >
        {{ statusLabel }}
      </el-tag>
    </div>

    <el-descriptions :column="2" border>
      <el-descriptions-item label="员工">{{ employee?.name ?? '—' }}</el-descriptions-item>
      <el-descriptions-item label="工号">{{ employee?.employeeNo ?? '—' }}</el-descriptions-item>
      <el-descriptions-item label="部门">{{ departmentName }}</el-descriptions-item>
      <el-descriptions-item label="异常日期">{{ exception.date }}</el-descriptions-item>
      <el-descriptions-item label="异常类型">
        {{ getExceptionLabel(exception.type) }}
      </el-descriptions-item>
      <el-descriptions-item label="异常说明" :span="2">{{ exception.message }}</el-descriptions-item>
      <el-descriptions-item v-if="exception.appealReason" label="申诉理由" :span="2">
        {{ exception.appealReason }}
      </el-descriptions-item>
      <el-descriptions-item v-if="exception.resolution" label="处理结果" :span="2">
        {{ exception.resolution }}
      </el-descriptions-item>
    </el-descriptions>

    <div v-if="exception.status === 'open' || exception.status === 'appealed'" class="action-panel">
      <h3>办理操作</h3>
      <div class="action-buttons">
        <el-button v-if="relatedMakeup" type="primary" @click="approveMakeup">
          审批关联补卡
        </el-button>
        <el-button type="primary" @click="resolveException(false)">确认处理</el-button>
        <el-button @click="goAttendanceData">查看当日考勤</el-button>
        <el-button @click="resolveException(true)">忽略异常</el-button>
      </div>
    </div>
  </div>

  <el-empty v-else description="异常记录不存在或已删除">
    <el-button type="primary" @click="goBack">返回工作台</el-button>
  </el-empty>
</template>

<style scoped>
.header-left {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.action-panel {
  margin-top: 24px;
  padding: 20px;
  border: 1px solid #f1f5f9;
  border-radius: 12px;
  background: #f8fafc;
}

.action-panel h3 {
  margin: 0 0 14px;
  font-size: 15px;
  font-weight: 600;
}

.action-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}
</style>
