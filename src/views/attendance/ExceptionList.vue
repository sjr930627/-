<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { useEnterpriseScope } from '@/composables/useEnterpriseScope'
import { resolveEnterpriseIdByEmployee } from '@/utils/enterpriseScope'

const store = useAppStore()
const { enterpriseName } = useEnterpriseScope('filter')
const activeTab = ref('makeup')
const filterStatus = ref<'pending' | 'all'>('pending')

const overtimeTypeMap = { weekday: '工作日', weekend: '公休日', holiday: '节假日' }
const compensationMap = { pay: '加班费', time_off: '调休' }

function employeeEnterpriseName(employeeId: string) {
  const emp = store.employees.find((e) => e.id === employeeId)
  return enterpriseName(resolveEnterpriseIdByEmployee(emp))
}

const pendingCount = computed(
  () =>
    store.makeupRequests.filter((r) => r.status === 'pending').length +
    store.cancelShiftRequests.filter((r) => r.status === 'pending').length +
    store.overtimeRequests.filter((r) => r.status === 'pending').length,
)

const makeupList = computed(() =>
  store.makeupRequests
    .filter((r) => filterStatus.value === 'all' || r.status === 'pending')
    .map((r) => ({
      ...r,
      enterpriseName: employeeEnterpriseName(r.employeeId),
      employeeName: store.employees.find((e) => e.id === r.employeeId)?.name ?? '-',
      typeLabel: r.punchType === 'clock_in' ? '上班卡' : '下班卡',
      statusLabel: { pending: '待审批', approved: '已通过', rejected: '已驳回' }[r.status],
    }))
    .sort((a, b) => b.date.localeCompare(a.date)),
)

const cancelShiftList = computed(() =>
  store.cancelShiftRequests
    .filter((r) => filterStatus.value === 'all' || r.status === 'pending')
    .map((r) => ({
      ...r,
      enterpriseName: employeeEnterpriseName(r.employeeId),
      employeeName: store.employees.find((e) => e.id === r.employeeId)?.name ?? '-',
      shiftName: store.shifts.find((s) => s.id === r.shiftId)?.name ?? '-',
      initiatedByLabel: r.initiatedBy === 'employee' ? '灵工申请' : '管理端发起',
      statusLabel: { pending: '待审批', approved: '已通过', rejected: '已驳回' }[r.status],
    }))
    .sort((a, b) => b.date.localeCompare(a.date)),
)

const overtimeList = computed(() =>
  store.overtimeRequests
    .filter((r) => filterStatus.value === 'all' || r.status === 'pending')
    .map((r) => ({
      ...r,
      enterpriseName: employeeEnterpriseName(r.employeeId),
      employeeName: store.employees.find((e) => e.id === r.employeeId)?.name ?? '-',
      typeLabel: overtimeTypeMap[r.overtimeType],
      compensationLabel: compensationMap[r.compensation],
      statusLabel: { pending: '待审批', approved: '已通过', rejected: '已驳回' }[r.status],
    }))
    .sort((a, b) => b.date.localeCompare(a.date)),
)

const pendingMakeupCount = computed(
  () => store.makeupRequests.filter((r) => r.status === 'pending').length,
)
const pendingCancelCount = computed(
  () => store.cancelShiftRequests.filter((r) => r.status === 'pending').length,
)
const pendingOvertimeCount = computed(
  () => store.overtimeRequests.filter((r) => r.status === 'pending').length,
)

async function review(
  type: 'makeup' | 'cancel' | 'overtime',
  id: string,
  approved: boolean,
) {
  try {
    const { value } = await ElMessageBox.prompt(
      approved ? '审批意见（可选）' : '驳回原因',
      approved ? '通过申请' : '驳回申请',
      { inputValue: approved ? '同意' : '', inputPlaceholder: '请输入' },
    )
    if (type === 'makeup') store.reviewMakeupRequest(id, approved, value, '人事管理员')
    if (type === 'cancel') store.reviewCancelShiftRequest(id, approved, value, '人事管理员')
    if (type === 'overtime') store.reviewOvertimeRequest(id, approved, value, '人事管理员')
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
        <h2 class="page-title">考勤审批处理</h2>
        <p class="text-muted">
          管理灵工人员发起的补卡、取消班次、加班申请 · 待审批 {{ pendingCount }} 条
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
          <el-table-column prop="employeeName" label="员工" width="100" />
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
          <el-table-column prop="employeeName" label="员工" width="100" />
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

      <el-tab-pane :label="`加班 (${pendingOvertimeCount})`" name="overtime">
        <el-table :data="overtimeList" border stripe empty-text="暂无加班申请">
          <el-table-column prop="enterpriseName" label="企业" min-width="160" show-overflow-tooltip />
          <el-table-column prop="employeeName" label="员工" width="100" />
          <el-table-column prop="date" label="日期" width="110" />
          <el-table-column label="时段" min-width="120">
            <template #default="{ row }">{{ row.startTime }} ~ {{ row.endTime }}</template>
          </el-table-column>
          <el-table-column prop="typeLabel" label="类型" width="80" />
          <el-table-column prop="compensationLabel" label="补偿" width="80" />
          <el-table-column prop="reason" label="原因" min-width="160" show-overflow-tooltip />
          <el-table-column prop="statusLabel" label="状态" width="90" />
          <el-table-column label="操作" width="160" fixed="right">
            <template #default="{ row }">
              <template v-if="row.status === 'pending'">
                <el-button link type="success" @click="review('overtime', row.id, true)">通过</el-button>
                <el-button link type="danger" @click="review('overtime', row.id, false)">驳回</el-button>
              </template>
              <span v-else class="text-muted">{{ row.reviewNote ?? '—' }}</span>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>
