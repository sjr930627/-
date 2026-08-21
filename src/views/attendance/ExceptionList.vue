<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { useEnterpriseScope } from '@/composables/useEnterpriseScope'
import { getDepartmentName } from '@/utils'
import { resolveEnterpriseIdByEmployee } from '@/utils/enterpriseScope'
import {
  assignmentMatchesSource,
  type AttendanceAssignmentSource,
} from '@/services/attendance'

const route = useRoute()
const store = useAppStore()
const { enterpriseName } = useEnterpriseScope('filter')
const activeTab = ref('makeup')
const filterStatus = ref<'pending' | 'all'>('pending')

const assignmentSource = computed<AttendanceAssignmentSource>(() =>
  route.meta.assignmentSource === 'grab' ? 'grab' : 'schedule',
)

const pageTitle = computed(() =>
  assignmentSource.value === 'grab' ? '考勤审批处理' : '考勤审批数据',
)

const sourceLabel = computed(() => (assignmentSource.value === 'grab' ? '抢班' : '排班'))

function employeeRowMeta(employeeId: string) {
  const emp = store.employees.find((e) => e.id === employeeId)
  return {
    enterpriseName: enterpriseName(resolveEnterpriseIdByEmployee(emp)),
    departmentName: getDepartmentName(store.departments, emp?.departmentId ?? ''),
    employeeName: emp?.name ?? '-',
    phone: emp?.phone || '—',
  }
}

function matchesSource(employeeId: string, date: string) {
  return assignmentMatchesSource(store.getAssignment(employeeId, date), assignmentSource.value)
}

const makeupList = computed(() =>
  store.makeupRequests
    .filter((r) => matchesSource(r.employeeId, r.date))
    .filter((r) => filterStatus.value === 'all' || r.status === 'pending')
    .map((r) => ({
      ...r,
      ...employeeRowMeta(r.employeeId),
      typeLabel: r.punchType === 'clock_in' ? '上班卡' : '下班卡',
      statusLabel: { pending: '待审批', approved: '已通过', rejected: '已驳回' }[r.status],
    }))
    .sort((a, b) => b.date.localeCompare(a.date)),
)

const cancelShiftList = computed(() =>
  store.cancelShiftRequests
    .filter((r) => matchesSource(r.employeeId, r.date))
    .filter((r) => filterStatus.value === 'all' || r.status === 'pending')
    .map((r) => ({
      ...r,
      ...employeeRowMeta(r.employeeId),
      shiftName: store.shifts.find((s) => s.id === r.shiftId)?.name ?? '-',
      initiatedByLabel: r.initiatedBy === 'employee' ? '灵工申请' : '管理端发起',
      statusLabel: { pending: '待审批', approved: '已通过', rejected: '已驳回' }[r.status],
    }))
    .sort((a, b) => b.date.localeCompare(a.date)),
)

const pendingMakeupCount = computed(
  () => makeupList.value.filter((r) => r.status === 'pending').length,
)
const pendingCancelCount = computed(
  () => cancelShiftList.value.filter((r) => r.status === 'pending').length,
)
const pendingCount = computed(() => pendingMakeupCount.value + pendingCancelCount.value)

async function review(type: 'makeup' | 'cancel', id: string, approved: boolean) {
  try {
    const { value } = await ElMessageBox.prompt(
      approved ? '审批意见（可选）' : '驳回原因',
      approved ? '通过申请' : '驳回申请',
      { inputValue: approved ? '同意' : '', inputPlaceholder: '请输入' },
    )
    if (type === 'makeup') store.reviewMakeupRequest(id, approved, value, '人事管理员')
    if (type === 'cancel') store.reviewCancelShiftRequest(id, approved, value, '人事管理员')
    ElMessage.success(approved ? '已通过' : '已驳回')
  } catch {
    // cancelled
  }
}
</script>

<template>
  <div class="page-card">
    <div class="page-header">
      <div>
        <h2 class="page-title">{{ pageTitle }}</h2>
        <p class="text-muted">
          {{ sourceLabel }}来源 · 管理灵工补卡、取消班次申请 · 待审批 {{ pendingCount }} 条
        </p>
      </div>
    </div>

    <div class="page-toolbar">
      <el-radio-group v-model="filterStatus">
        <el-radio-button value="pending">待审批</el-radio-button>
        <el-radio-button value="all">全部</el-radio-button>
      </el-radio-group>
    </div>

    <el-tabs v-model="activeTab">
      <el-tab-pane :label="`补卡 (${pendingMakeupCount})`" name="makeup">
        <el-table :data="makeupList" border stripe empty-text="暂无补卡申请">
          <el-table-column prop="enterpriseName" label="企业" min-width="160" show-overflow-tooltip />
          <el-table-column prop="departmentName" label="部门" min-width="120" show-overflow-tooltip />
          <el-table-column prop="employeeName" label="姓名" width="100" />
          <el-table-column prop="phone" label="手机号" width="130" />
          <el-table-column prop="date" label="日期" width="110" />
          <el-table-column prop="typeLabel" label="类型" width="80" />
          <el-table-column prop="time" label="补卡时间" width="90" />
          <el-table-column prop="reason" label="原因" min-width="180" show-overflow-tooltip />
          <el-table-column prop="statusLabel" label="状态" width="90" />
          <el-table-column label="操作" width="160" fixed="right">
            <template #default="{ row }">
              <template v-if="row.status === 'pending'">
                <el-button link type="success" @click="review('makeup', row.id, true)">通过</el-button>
                <el-button link type="danger" @click="review('makeup', row.id, false)">驳回</el-button>
              </template>
              <span v-else class="text-muted">{{ row.reviewNote ?? '—' }}</span>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane :label="`取消班次 (${pendingCancelCount})`" name="cancel">
        <el-table :data="cancelShiftList" border stripe empty-text="暂无取消班次申请">
          <el-table-column prop="enterpriseName" label="企业" min-width="160" show-overflow-tooltip />
          <el-table-column prop="departmentName" label="部门" min-width="120" show-overflow-tooltip />
          <el-table-column prop="employeeName" label="姓名" width="100" />
          <el-table-column prop="phone" label="手机号" width="130" />
          <el-table-column prop="date" label="日期" width="110" />
          <el-table-column prop="shiftName" label="班次" width="90" />
          <el-table-column prop="initiatedByLabel" label="来源" width="100" />
          <el-table-column prop="reason" label="原因" min-width="180" show-overflow-tooltip />
          <el-table-column prop="statusLabel" label="状态" width="90" />
          <el-table-column label="操作" width="160" fixed="right">
            <template #default="{ row }">
              <template v-if="row.status === 'pending'">
                <el-button link type="success" @click="review('cancel', row.id, true)">通过</el-button>
                <el-button link type="danger" @click="review('cancel', row.id, false)">驳回</el-button>
              </template>
              <span v-else class="text-muted">{{ row.reviewNote ?? '—' }}</span>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>
