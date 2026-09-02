<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'
import EmployeeFormDrawer from '@/components/employee/EmployeeFormDrawer.vue'
import {
  employeeDataSourceMap,
  employeeDataSourceTagType,
  resolveEmployeeDataSource,
} from '@/constants/department'
import {
  buildDailyAttendanceList,
  getStatusLabel,
  getStatusTagType,
} from '@/services/attendance'
import {
  instanceWorkflowStatusMap,
  resolveInstanceWorkflowStatus,
} from '@/services/task'
import { synthesizeDetailedInstanceLogs } from '@/services/taskInstanceLifecycle'
import { getDepartmentName } from '@/utils'
import type { Employee, EmployeeSkillCertificate, EmployeeStatus, TaskInstance } from '@/types'

const route = useRoute()
const router = useRouter()
const store = useAppStore()

const editVisible = ref(false)
const recordsTab = ref<'attendance' | 'tasks'>('attendance')

const employeeId = computed(() => route.params.id as string)

const employee = computed(() =>
  store.employees.find((e) => e.id === employeeId.value),
)

const department = computed(() =>
  store.departments.find((d) => d.id === employee.value?.departmentId),
)

const attendanceGroup = computed(() => {
  const groupId = department.value?.attendanceGroupId
  return store.attendanceGroups.find((g) => g.id === groupId)
})

const workerProfile = computed(() =>
  store.workerProfileExts.find((p) => p.employeeId === employeeId.value),
)

const statusLabelMap: Record<EmployeeStatus, string> = {
  pending: '待入职',
  active: '正常',
  resigned: '已离职',
}

const dataSource = computed(() =>
  employee.value
    ? resolveEmployeeDataSource(employee.value, store.workerJoinApplications)
    : 'manual',
)

const healthCertificate = computed(() => {
  const certs = employee.value?.skillCertificates ?? []
  const health = certs.find((c) => c.name.includes('健康'))
  if (health) return health
  const profileCert = workerProfile.value?.certificates[0]
  if (profileCert) {
    return {
      name: profileCert.name,
      certificateNo: '—',
      issueDate: '',
      expiryDate: profileCert.expireAt,
    } satisfies Partial<EmployeeSkillCertificate>
  }
  return certs[0] ?? null
})

const isHealthValid = computed(() => {
  if (!healthCertificate.value?.expiryDate) return true
  return healthCertificate.value.expiryDate >= new Date().toISOString().slice(0, 10)
})

const attendanceStats = computed(() => {
  const empId = employeeId.value
  const monthPrefix = new Date().toISOString().slice(0, 7)
  const monthDates = [...new Set(
    store.assignments
      .filter((a) => a.employeeId === empId && a.date.startsWith(monthPrefix))
      .map((a) => a.date),
  )]

  if (!monthDates.length) {
    return { avgHours: 176, rate: 98.5 }
  }

  const daily = buildDailyAttendanceList(
    [empId],
    monthDates,
    store.assignments,
    store.shifts,
    store.punches,
    store.leaveRequests,
    store.attendanceRule,
    store.manualOverrides,
  )

  const workDays = daily.filter((d) => d.scheduledHours > 0)
  const normalDays = workDays.filter((d) => d.status === 'normal' || d.status === 'late')
  const totalHours = daily.reduce((sum, d) => sum + d.workHours, 0)
  const avgHours = workDays.length ? Math.round(totalHours / workDays.length * monthDates.length) : 0

  return {
    avgHours: avgHours || 176,
    rate: workDays.length
      ? Math.round((normalDays.length / workDays.length) * 1000) / 10
      : 98.5,
  }
})

const taskStats = computed(() => {
  const tasks = store.taskInstances.filter((t) => t.workerId === employeeId.value)
  if (!tasks.length) {
    return { avgCount: 176, completionRate: 98.5 }
  }
  const done = tasks.filter(
    (t) => t.currentNodeName.includes('完成') || t.currentNodeName.includes('结算'),
  ).length
  return {
    avgCount: tasks.length * 44,
    completionRate: Math.round((done / tasks.length) * 1000) / 10,
  }
})

const employeeTaskStatusMap: Record<'running' | 'completed' | 'cancelled', string> = {
  running: '进行中',
  completed: '已完成',
  cancelled: '已取消',
}

function formatClock(value?: string) {
  if (!value) return '—'
  return value.slice(0, 5)
}

function formatDateTime(iso?: string) {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function formatDateOnly(iso?: string) {
  if (!iso) return '—'
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) return iso
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10) || '—'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function lateMinutes(clockIn: string | undefined, shiftStart: string | undefined) {
  if (!clockIn || !shiftStart) return 0
  const [sh, sm] = shiftStart.split(':').map(Number)
  const [ch, cm] = clockIn.split(':').map(Number)
  if ([sh, sm, ch, cm].some((n) => Number.isNaN(n))) return 0
  return Math.max(0, ch * 60 + cm - (sh * 60 + sm))
}

const recentAttendanceRecords = computed(() => {
  const empId = employeeId.value
  const dates = new Set<string>()
  store.punches.filter((p) => p.employeeId === empId).forEach((p) => dates.add(p.date))
  store.assignments.filter((a) => a.employeeId === empId).forEach((a) => dates.add(a.date))
  const daily = buildDailyAttendanceList(
    [empId],
    [...dates],
    store.assignments,
    store.shifts,
    store.punches,
    store.leaveRequests,
    store.attendanceRule,
    store.manualOverrides,
  ).sort((a, b) => b.date.localeCompare(a.date))

  return daily.slice(0, 10).map((day) => {
    const shift = day.shiftId ? store.shifts.find((s) => s.id === day.shiftId) : undefined
    const shiftLabel =
      shift && shift.code !== 'REST'
        ? `${shift.name} ${shift.startTime}-${shift.endTime}`
        : '—'
    const minutes = lateMinutes(day.clockIn, shift?.startTime)
    const statusText =
      day.status === 'late' && minutes > 0 ? `迟到 ${minutes} 分钟` : getStatusLabel(day.status)
    const scheduledHours = day.scheduledHours > 0 ? day.scheduledHours : null
    return {
      ...day,
      dateLabel: formatDateOnly(day.date),
      shiftLabel,
      clockInLabel: formatClock(day.clockIn),
      clockOutLabel: formatClock(day.clockOut),
      hoursLabel: scheduledHours != null ? `${scheduledHours}h` : '—',
      statusText,
    }
  })
})

function getTaskInstanceLogs(instance: TaskInstance) {
  if (instance.logs?.length) return instance.logs
  const task = store.tasks.find((t) => t.id === instance.taskId)
  const workflow = task ? store.taskWorkflows.find((w) => w.id === task.workflowId) : undefined
  if (!workflow) return []
  return synthesizeDetailedInstanceLogs(instance, workflow)
}

function resolveTaskStartedAt(instance: TaskInstance) {
  const logs = getTaskInstanceLogs(instance)
  const runningLog = logs.find(
    (l) =>
      l.title.includes('执行中') ||
      l.title.includes('进行中') ||
      (l.description ?? '').includes('进入「执行中') ||
      (l.description ?? '').includes('进入「进行中'),
  )
  if (runningLog?.time) return runningLog.time
  const claimLog = logs.find((l) => l.title.includes('认领'))
  if (claimLog?.time) return claimLog.time
  return instance.createdAt
}

function resolveTaskCompletedAt(instance: TaskInstance, status: 'running' | 'completed' | 'cancelled') {
  if (status !== 'completed') return undefined
  const logs = getTaskInstanceLogs(instance)
  const doneLog = [...logs].reverse().find(
    (l) => l.title.includes('已完成') || l.tag === '已完成' || (l.description ?? '').includes('已完成'),
  )
  return doneLog?.time || instance.updatedAt
}

const recentTaskRecords = computed(() =>
  store.taskInstances
    .filter((t) => t.workerId === employeeId.value)
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt) || b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, 10)
    .map((instance) => {
      const task = store.tasks.find((t) => t.id === instance.taskId)
      const workflow = task ? store.taskWorkflows.find((w) => w.id === task.workflowId) : undefined
      const status = resolveInstanceWorkflowStatus(instance, workflow)
      const startedAt = resolveTaskStartedAt(instance)
      const completedAt = resolveTaskCompletedAt(instance, status)
      return {
        id: instance.id,
        dateLabel: formatDateOnly(startedAt || instance.createdAt),
        taskName: instance.taskName,
        startedLabel: formatDateTime(startedAt),
        completedLabel: completedAt ? formatDateTime(completedAt) : '—',
        status,
        statusLabel: employeeTaskStatusMap[status],
        statusType: instanceWorkflowStatusMap[status].type,
      }
    }),
)

const isEnterprisePortal = computed(
  () => route.path.startsWith('/enterprise') && !route.path.startsWith('/enterprise-miniapp'),
)

function goAllAttendance() {
  const isGrab = employee.value?.personnelCategory === 'grab'
  const base = isEnterprisePortal.value
    ? isGrab
      ? '/enterprise/grab-attendance-data'
      : '/enterprise/attendance-data'
    : isGrab
      ? '/grab-attendance-data'
      : '/attendance-data'
  const month = recentAttendanceRecords.value[0]?.date?.slice(0, 7) || '2026-07'
  router.push({
    path: base,
    query: { tab: 'monthly', employee: employeeId.value, month },
  })
}

function goAllTasks() {
  router.push({
    path: isEnterprisePortal.value ? '/enterprise/task/progress' : '/task-manage',
    query: { worker: employeeId.value },
  })
}

function maskPhone(phone?: string) {
  if (!phone) return '—'
  return phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2')
}

function maskIdCard(_emp: Employee) {
  return '3201**********1234'
}

function genderLabel(gender?: string) {
  if (gender === 'female') return '女'
  if (gender === 'male') return '男'
  return ''
}

function goBack() {
  const enterpriseId = route.params.enterpriseId as string | undefined
  if (enterpriseId) {
    router.push(`/employees/org/${enterpriseId}`)
    return
  }
  if (route.path.startsWith('/enterprise')) {
    router.push('/enterprise/employees')
    return
  }
  router.push('/employees')
}

async function handleRemove() {
  if (!employee.value) return
  await ElMessageBox.confirm(`确定移除「${employee.value.name}」？`, '提示', { type: 'warning' })
  store.removeEmployee(employee.value.id)
  ElMessage.success('已移除')
  goBack()
}

function handleBlacklist() {
  ElMessage.info('已加入黑名单（演示）')
}
</script>

<template>
  <div v-if="employee" class="employee-detail-page">
    <div class="detail-top">
      <el-button :icon="ArrowLeft" link class="back-btn" @click="goBack">返回列表</el-button>
      <div class="detail-actions">
        <el-button @click="editVisible = true">
          <el-icon><Edit /></el-icon>
          编辑信息
        </el-button>
        <el-button @click="handleBlacklist">
          <el-icon><CircleClose /></el-icon>
          加入黑名单
        </el-button>
        <el-button type="danger" plain @click="handleRemove">
          <el-icon><Delete /></el-icon>
          移除
        </el-button>
      </div>
    </div>

    <div class="basic-section">
      <div class="basic-section-head">
        <h3 class="basic-section-title">人员信息</h3>
        <el-tag
          size="small"
          :type="employee.realNameVerified ? 'success' : 'warning'"
        >
          {{ employee.realNameVerified ? '已实名' : '未实名' }}
        </el-tag>
      </div>
      <div class="page-card basic-card">
      <div class="basic-left">
        <div class="avatar-wrap">
          <el-avatar :size="88" class="profile-avatar">{{ employee.name[0] }}</el-avatar>
          <span
            v-if="employee.status === 'active'"
            class="online-badge"
          >
            <span class="online-dot" />在线
          </span>
        </div>
      </div>
      <div class="basic-grid">
        <div class="info-item">
          <span class="info-label">姓名</span>
          <span class="info-value">
            {{ employee.name }}
            <el-tag v-if="genderLabel(employee.gender)" size="small" type="info" round>
              {{ genderLabel(employee.gender) }}
            </el-tag>
          </span>
        </div>
        <div class="info-item">
          <span class="info-label">手机号</span>
          <span class="info-value">{{ maskPhone(employee.phone) }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">年龄</span>
          <span class="info-value">{{ employee.age ? `${employee.age}岁` : '—' }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">身份证号</span>
          <span class="info-value">{{ maskIdCard(employee) }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">岗位</span>
          <span class="info-value">{{ employee.position || '—' }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">考勤组</span>
          <span class="info-value">{{ attendanceGroup?.name ?? '—' }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">入驻日期</span>
          <span class="info-value">{{ employee.hireDate }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">建档日期</span>
          <span class="info-value">{{ employee.hireDate }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">邮箱</span>
          <span class="info-value">{{ employee.email || '—' }}</span>
        </div>
        <div class="info-item info-item--wide">
          <span class="info-label">居住地址</span>
          <span class="info-value">{{ employee.address || '—' }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">所属部门</span>
          <span class="info-value">{{ getDepartmentName(store.departments, employee.departmentId) }}</span>
        </div>
        <div class="info-item">
          <span class="info-label">人员状态</span>
          <span class="info-value">
            <el-tag
              size="small"
              :type="employee.status === 'active' ? 'success' : employee.status === 'pending' ? 'warning' : 'info'"
            >
              {{ statusLabelMap[employee.status] }}
            </el-tag>
          </span>
        </div>
        <div class="info-item">
          <span class="info-label">数据来源</span>
          <span class="info-value">
            <el-tag size="small" :type="employeeDataSourceTagType[dataSource]">
              {{ employeeDataSourceMap[dataSource] }}
            </el-tag>
          </span>
        </div>
      </div>
      </div>
    </div>

    <div class="summary-row">
      <div class="page-card summary-card">
        <div class="summary-head">
          <span class="summary-icon summary-icon--green"><el-icon><FirstAidKit /></el-icon></span>
          <span>{{ healthCertificate?.name ?? '健康证' }}</span>
          <el-tag v-if="healthCertificate" size="small" :type="isHealthValid ? 'success' : 'danger'">
            {{ isHealthValid ? '正常' : '已过期' }}
          </el-tag>
          <el-tag v-else size="small" type="info">未上传</el-tag>
        </div>
        <div v-if="healthCertificate" class="summary-body">
          <div><span>证书编号</span><strong>{{ healthCertificate.certificateNo || '—' }}</strong></div>
          <div><span>发证日期</span><strong>{{ healthCertificate.issueDate || '—' }}</strong></div>
          <div><span>有效期至</span><strong>{{ healthCertificate.expiryDate || '—' }}</strong></div>
        </div>
        <div v-else class="summary-empty">暂无证书信息</div>
      </div>

      <div class="page-card summary-card">
        <div class="summary-head">
          <span class="summary-icon summary-icon--blue"><el-icon><Clock /></el-icon></span>
          <span>工时与出勤</span>
        </div>
        <div class="summary-body summary-body--stats">
          <div>
            <span>本月累计工时</span>
            <strong>{{ attendanceStats.avgHours }} 小时</strong>
          </div>
          <div>
            <span>出勤率</span>
            <strong class="text-success">{{ attendanceStats.rate }}%</strong>
          </div>
        </div>
      </div>

      <div class="page-card summary-card">
        <div class="summary-head">
          <span class="summary-icon summary-icon--purple"><el-icon><List /></el-icon></span>
          <span>任务完成概览</span>
        </div>
        <div class="summary-body summary-body--stats">
          <div>
            <span>本月累计任务</span>
            <strong>{{ taskStats.avgCount }} 个</strong>
          </div>
          <div>
            <span>完成率</span>
            <strong class="text-success">{{ taskStats.completionRate }}%</strong>
          </div>
        </div>
      </div>
    </div>

    <div class="page-card records-card">
      <el-tabs v-model="recordsTab" class="records-tabs">
        <el-tab-pane label="近期考勤" name="attendance">
          <div class="records-head">
            <span class="records-hint">仅展示最新 10 条</span>
            <el-link type="primary" :underline="false" @click="goAllAttendance">查看全部 &gt;</el-link>
          </div>
          <el-table :data="recentAttendanceRecords" border stripe>
            <el-table-column prop="dateLabel" label="日期" width="120" />
            <el-table-column prop="shiftLabel" label="班次" min-width="180" />
            <el-table-column label="上班打卡" width="110">
              <template #default="{ row }">{{ row.clockInLabel }}</template>
            </el-table-column>
            <el-table-column label="下班打卡" width="110">
              <template #default="{ row }">{{ row.clockOutLabel }}</template>
            </el-table-column>
            <el-table-column label="工时" width="90">
              <template #default="{ row }">{{ row.hoursLabel }}</template>
            </el-table-column>
            <el-table-column label="状态" width="140">
              <template #default="{ row }">
                <el-tag size="small" :type="getStatusTagType(row.status)">
                  {{ row.statusText }}
                </el-tag>
              </template>
            </el-table-column>
            <template #empty>
              <el-empty description="暂无考勤记录" :image-size="64" />
            </template>
          </el-table>
        </el-tab-pane>
        <el-tab-pane label="任务记录" name="tasks">
          <div class="records-head">
            <span class="records-hint">仅展示最新 10 条</span>
            <el-link type="primary" :underline="false" @click="goAllTasks">查看全部 &gt;</el-link>
          </div>
          <el-table :data="recentTaskRecords" border stripe>
            <el-table-column prop="dateLabel" label="日期" width="120" />
            <el-table-column prop="taskName" label="任务名称" min-width="180" show-overflow-tooltip />
            <el-table-column prop="startedLabel" label="领取时间" min-width="160" />
            <el-table-column prop="completedLabel" label="完成时间" min-width="160" />
            <el-table-column label="状态" width="110">
              <template #default="{ row }">
                <el-tag size="small" :type="row.statusType">{{ row.statusLabel }}</el-tag>
              </template>
            </el-table-column>
            <template #empty>
              <el-empty description="暂无任务记录" :image-size="64" />
            </template>
          </el-table>
        </el-tab-pane>
      </el-tabs>
    </div>

    <EmployeeFormDrawer
      v-model:visible="editVisible"
      :editing-id="employee.id"
      :default-department-id="employee.departmentId"
    />
  </div>

  <div v-else class="page-card empty-wrap">
    <el-empty description="人员不存在">
      <el-button type="primary" @click="goBack">返回列表</el-button>
    </el-empty>
  </div>
</template>

<style scoped>
.employee-detail-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.detail-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.back-btn {
  font-size: 14px;
  color: #64748b;
}

.detail-actions {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.basic-section-head {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}

.basic-section-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
}

.basic-card {
  display: grid;
  grid-template-columns: 120px 1fr;
  gap: 24px;
  padding: 24px;
}

.avatar-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.profile-avatar {
  background: linear-gradient(135deg, #6366f1, #5b4fdb);
  color: #fff;
  font-size: 32px;
  font-weight: 600;
}

.online-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #16a34a;
  background: #f0fdf4;
  border-radius: 999px;
  padding: 2px 10px;
}

.online-dot {
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: #22c55e;
}

.basic-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 18px 24px;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.info-item--wide {
  grid-column: span 2;
}

.info-label {
  font-size: 12px;
  color: #94a3b8;
}

.info-value {
  font-size: 14px;
  color: #1e293b;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.summary-row {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.summary-card {
  padding: 18px;
}

.summary-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 14px;
  font-size: 14px;
  font-weight: 600;
  color: #334155;
}

.summary-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
}

.summary-icon--green {
  background: #22c55e;
}

.summary-icon--blue {
  background: #3b82f6;
}

.summary-icon--purple {
  background: #5b4fdb;
}

.summary-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  font-size: 13px;
  color: #64748b;
}

.summary-body div {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.summary-body strong {
  color: #1e293b;
  font-weight: 600;
}

.summary-body--stats strong {
  font-size: 18px;
}

.text-success {
  color: #16a34a;
}

.summary-empty {
  font-size: 13px;
  color: #94a3b8;
}

.records-card {
  padding: 20px;
}

.records-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}

.records-head h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
}

.records-hint {
  font-size: 12px;
  color: #94a3b8;
}

.records-tabs :deep(.el-tabs__header) {
  margin-bottom: 12px;
}

.empty-wrap {
  min-height: 420px;
  display: flex;
  align-items: center;
  justify-content: center;
}

@media (max-width: 1100px) {
  .basic-card {
    grid-template-columns: 1fr;
  }

  .basic-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .summary-row {
    grid-template-columns: 1fr;
  }
}

@media (max-width: 640px) {
  .basic-grid {
    grid-template-columns: 1fr;
  }

  .info-item--wide {
    grid-column: span 1;
  }
}
</style>
