<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'
import { usePortal } from '@/composables/usePortal'
import {
  buildConfirmHoursWarning,
  buildDailyAttendanceList,
  getExceptionLabel,
  getStatusLabel,
} from '@/services/attendance'

const route = useRoute()
const router = useRouter()
const store = useAppStore()
const { pathPrefix } = usePortal()

const postDialog = ref(false)
const postStep = ref<'correct' | 'confirm'>('correct')
const correctHours = ref(0)
const correctNote = ref('')
const postEmployeeId = ref('')
const postDate = ref('')

const exception = computed(() =>
  store.exceptions.find((e) => e.id === (route.params.id as string)),
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

function dayHours(employeeId: string, date: string) {
  const rows = buildDailyAttendanceList(
    [employeeId],
    [date],
    store.assignments,
    store.shifts,
    store.punches,
    store.leaveRequests,
    store.attendanceRule,
    store.manualOverrides,
  )
  const day = rows[0]
  return {
    workHours: day?.workHours ?? 0,
    scheduledHours: day?.scheduledHours ?? 0,
    statusLabel: day ? getStatusLabel(day.status) : '—',
  }
}

const postHours = computed(() => {
  if (!postEmployeeId.value || !postDate.value) {
    return { workHours: 0, scheduledHours: 0, statusLabel: '—' }
  }
  return dayHours(postEmployeeId.value, postDate.value)
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

function openPostFlow(employeeId: string, date: string) {
  const h = dayHours(employeeId, date)
  postEmployeeId.value = employeeId
  postDate.value = date
  correctHours.value = h.workHours
  correctNote.value = ''
  postStep.value = 'correct'
  postDialog.value = true
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
    ElMessage.success('补卡已通过')
    openPostFlow(exception.value.employeeId, exception.value.date)
  } catch {
    // cancelled
  }
}

function submitCorrection() {
  if (correctHours.value < 0) {
    ElMessage.warning('工时不能为负数')
    return
  }
  if (!correctNote.value.trim()) {
    ElMessage.warning('校对工时须填写原因')
    return
  }
  try {
    store.setWorkHoursCorrection(
      postEmployeeId.value,
      postDate.value,
      Number(correctHours.value),
      correctNote.value.trim(),
      '人事管理员',
      { autoConfirm: false },
    )
    postStep.value = 'confirm'
    ElMessage.success('工时已校对')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '校对失败')
  }
}

function skipToConfirm() {
  postStep.value = 'confirm'
}

function skipAll() {
  postDialog.value = false
  ElMessage.success('已跳过工时处理，可稍后单独处理')
  goBack()
}

async function confirmHours() {
  const h = postHours.value
  const warning = buildConfirmHoursWarning([
    {
      name: employee.value?.name,
      workHours: h.workHours,
      scheduledHours: h.scheduledHours,
    },
  ])
  if (warning) {
    try {
      await ElMessageBox.confirm(warning, '工时异常提醒', {
        type: 'warning',
        confirmButtonText: '仍按现工时确认',
        cancelButtonText: '取消',
      })
    } catch {
      return
    }
  }
  store.confirmWorkHours(postEmployeeId.value, postDate.value, {
    workHours: h.workHours,
    operator: '人事管理员',
    note: '补卡通过后确认工时',
  })
  postDialog.value = false
  ElMessage.success(`已确认工时 ${h.workHours}h`)
  goBack()
}

function skipConfirm() {
  postDialog.value = false
  ElMessage.success('已跳过确认工时，可稍后单独处理')
  router.push({
    path: `${pathPrefix.value}/attendance-data`,
    query: { tab: 'daily', date: postDate.value, employee: postEmployeeId.value },
  })
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

    <el-dialog
      v-model="postDialog"
      title="补卡后续：工时校对与确认"
      width="480px"
      :close-on-click-modal="false"
    >
      <el-steps :active="postStep === 'correct' ? 0 : 1" finish-status="success" simple>
        <el-step title="工时校对" />
        <el-step title="确认工时" />
      </el-steps>

      <div v-if="postStep === 'correct'" class="post-body">
        <p class="hint">
          补卡已通过。请二次确认工时是否需要校对；无需校对可进入确认工时，也可整步跳过稍后处理。
        </p>
        <p>
          当前工时 <b>{{ postHours.workHours }}h</b>
          · 排班 {{ postHours.scheduledHours }}h
          · {{ postHours.statusLabel }}
        </p>
        <el-form label-position="top">
          <el-form-item label="校对工时（小时）">
            <el-input-number v-model="correctHours" :min="0" :step="0.5" />
          </el-form-item>
          <el-form-item label="校对原因">
            <el-input
              v-model="correctNote"
              type="textarea"
              :rows="2"
              placeholder="需校对时必填；跳过可不填"
            />
          </el-form-item>
        </el-form>
      </div>

      <div v-else class="post-body">
        <p class="hint">确认当日工时，或跳过并在出勤数据中单独处理。</p>
        <p>
          待确认工时 <b>{{ postHours.workHours }}h</b>
          · 排班 {{ postHours.scheduledHours }}h
        </p>
      </div>

      <template #footer>
        <template v-if="postStep === 'correct'">
          <el-button @click="skipAll">跳过，稍后单独处理</el-button>
          <el-button @click="skipToConfirm">无需校对，进入确认</el-button>
          <el-button type="primary" @click="submitCorrection">提交校对并进入确认</el-button>
        </template>
        <template v-else>
          <el-button @click="skipConfirm">跳过确认工时</el-button>
          <el-button type="primary" @click="confirmHours">确认工时</el-button>
        </template>
      </template>
    </el-dialog>
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

.post-body {
  margin-top: 16px;
}

.post-body .hint {
  color: #64748b;
  font-size: 13px;
  line-height: 1.5;
}

.post-body b {
  color: #5b4fdb;
}
</style>
