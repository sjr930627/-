<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'

const store = useAppStore()
const activeTab = ref('leave')

const leaveTypeMap = {
  annual: '年假',
  sick: '病假',
  personal: '事假',
  compensatory: '调休',
}

const leaveList = computed(() =>
  store.leaveRequests.map((r) => ({
    ...r,
    employeeName: store.employees.find((e) => e.id === r.employeeId)?.name ?? '-',
    typeLabel: leaveTypeMap[r.leaveType],
    statusLabel: { pending: '待审批', approved: '已通过', rejected: '已驳回' }[r.status],
  })),
)

const swapList = computed(() =>
  store.swapRequests.map((r) => ({
    ...r,
    applicantName: store.employees.find((e) => e.id === r.applicantId)?.name ?? '-',
    targetName: store.employees.find((e) => e.id === r.targetEmployeeId)?.name ?? '-',
    statusLabel: { pending: '待审批', approved: '已通过', rejected: '已驳回' }[r.status],
  })),
)

const makeupList = computed(() =>
  store.makeupRequests.map((r) => ({
    ...r,
    employeeName: store.employees.find((e) => e.id === r.employeeId)?.name ?? '-',
    typeLabel: r.punchType === 'clock_in' ? '上班卡' : '下班卡',
    statusLabel: { pending: '待审批', approved: '已通过', rejected: '已驳回' }[r.status],
  })),
)

const overtimeTypeMap = { weekday: '工作日', weekend: '公休日', holiday: '节假日' }
const compensationMap = { pay: '加班费', time_off: '调休' }

const overtimeList = computed(() =>
  store.overtimeRequests.map((r) => ({
    ...r,
    employeeName: store.employees.find((e) => e.id === r.employeeId)?.name ?? '-',
    typeLabel: overtimeTypeMap[r.overtimeType],
    compensationLabel: compensationMap[r.compensation],
    statusLabel: { pending: '待审批', approved: '已通过', rejected: '已驳回' }[r.status],
  })),
)

const pendingCount = computed(
  () =>
    leaveList.value.filter((r) => r.status === 'pending').length +
    swapList.value.filter((r) => r.status === 'pending').length +
    makeupList.value.filter((r) => r.status === 'pending').length +
    overtimeList.value.filter((r) => r.status === 'pending').length,
)

async function review(
  type: 'leave' | 'swap' | 'makeup' | 'overtime',
  id: string,
  approved: boolean,
) {
  try {
    const { value } = await ElMessageBox.prompt(
      approved ? '审批意见（可选）' : '驳回原因',
      approved ? '通过申请' : '驳回申请',
      { inputValue: approved ? '同意' : '', inputPlaceholder: '请输入' },
    )
    if (type === 'leave') store.reviewLeaveRequest(id, approved, value)
    if (type === 'swap') store.reviewSwapRequest(id, approved, value)
    if (type === 'makeup') store.reviewMakeupRequest(id, approved, value)
    if (type === 'overtime') store.reviewOvertimeRequest(id, approved, value)
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
        <h2 class="page-title">审批中心</h2>
        <p class="text-muted">换班、请假、补卡、加班申请审批 · 待处理 {{ pendingCount }} 条</p>
      </div>
    </div>

    <el-tabs v-model="activeTab">
      <el-tab-pane label="请假" name="leave">
        <el-table :data="leaveList" border stripe>
          <el-table-column prop="employeeName" label="员工" width="100" />
          <el-table-column prop="typeLabel" label="类型" width="80" />
          <el-table-column label="日期" min-width="160">
            <template #default="{ row }">{{ row.startDate }} ~ {{ row.endDate }}</template>
          </el-table-column>
          <el-table-column prop="reason" label="原因" min-width="160" show-overflow-tooltip />
          <el-table-column prop="statusLabel" label="状态" width="90" />
          <el-table-column label="操作" width="160" fixed="right">
            <template #default="{ row }">
              <template v-if="row.status === 'pending'">
                <el-button link type="success" @click="review('leave', row.id, true)">通过</el-button>
                <el-button link type="danger" @click="review('leave', row.id, false)">驳回</el-button>
              </template>
              <span v-else class="text-muted">{{ row.reviewNote ?? '—' }}</span>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="换班" name="swap">
        <el-table :data="swapList" border stripe>
          <el-table-column prop="applicantName" label="申请人" width="100" />
          <el-table-column prop="targetName" label="换班对象" width="100" />
          <el-table-column prop="date" label="日期" width="110" />
          <el-table-column prop="reason" label="原因" min-width="180" show-overflow-tooltip />
          <el-table-column prop="statusLabel" label="状态" width="90" />
          <el-table-column label="操作" width="160" fixed="right">
            <template #default="{ row }">
              <template v-if="row.status === 'pending'">
                <el-button link type="success" @click="review('swap', row.id, true)">通过</el-button>
                <el-button link type="danger" @click="review('swap', row.id, false)">驳回</el-button>
              </template>
              <span v-else class="text-muted">审批后自动更新排班</span>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="补卡" name="makeup">
        <el-table :data="makeupList" border stripe>
          <el-table-column prop="employeeName" label="员工" width="100" />
          <el-table-column prop="date" label="日期" width="110" />
          <el-table-column prop="typeLabel" label="卡类型" width="90" />
          <el-table-column prop="time" label="补卡时间" width="90" />
          <el-table-column prop="reason" label="原因" min-width="160" show-overflow-tooltip />
          <el-table-column prop="statusLabel" label="状态" width="90" />
          <el-table-column label="操作" width="160" fixed="right">
            <template #default="{ row }">
              <template v-if="row.status === 'pending'">
                <el-button link type="success" @click="review('makeup', row.id, true)">通过</el-button>
                <el-button link type="danger" @click="review('makeup', row.id, false)">驳回</el-button>
              </template>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="加班" name="overtime">
        <el-table :data="overtimeList" border stripe>
          <el-table-column prop="employeeName" label="员工" width="100" />
          <el-table-column prop="date" label="日期" width="110" />
          <el-table-column prop="typeLabel" label="类型" width="90" />
          <el-table-column label="时段" width="130">
            <template #default="{ row }">{{ row.startTime }}-{{ row.endTime }}</template>
          </el-table-column>
          <el-table-column prop="hours" label="时长(h)" width="80" />
          <el-table-column prop="compensationLabel" label="补偿" width="80" />
          <el-table-column prop="reason" label="原因" min-width="140" show-overflow-tooltip />
          <el-table-column prop="statusLabel" label="状态" width="90" />
          <el-table-column label="操作" width="160" fixed="right">
            <template #default="{ row }">
              <template v-if="row.status === 'pending'">
                <el-button link type="success" @click="review('overtime', row.id, true)">通过</el-button>
                <el-button link type="danger" @click="review('overtime', row.id, false)">驳回</el-button>
              </template>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </div>
</template>
