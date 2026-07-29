<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { exceptionHandleMap, getDefaultHandleType } from '@/constants/exception'
import type { ExceptionHandleType } from '@/constants/exception'
import { getExceptionLabel } from '@/services/attendance'
import type { AttendanceException } from '@/types'

const store = useAppStore()
const activeTab = ref('exceptions')
const filterStatus = ref<'all' | 'open' | 'appealed' | 'resolved'>('open')

const handleDrawer = ref(false)
const currentException = ref<AttendanceException | null>(null)
const handleType = ref<ExceptionHandleType>('manual')
const reviewNote = ref('')

const makeupForm = ref({
  punchType: 'clock_out' as 'clock_in' | 'clock_out',
  time: '16:00',
  reason: '',
})

const leaveForm = ref({
  leaveType: 'personal' as 'annual' | 'sick' | 'personal' | 'compensatory',
  reason: '',
})

const manualResolution = ref('管理员核实后调整为正常')

onMounted(() => store.syncExceptions())

const leaveTypeMap = {
  annual: '年假',
  sick: '病假',
  personal: '事假',
  compensatory: '调休',
}

const pendingApprovalCount = computed(
  () =>
    store.leaveRequests.filter((r) => r.status === 'pending').length +
    store.swapRequests.filter((r) => r.status === 'pending').length +
    store.makeupRequests.filter((r) => r.status === 'pending').length,
)

const exceptionList = computed(() =>
  store.exceptions
    .filter((e) => {
      if (filterStatus.value === 'all') return true
      if (filterStatus.value === 'open') return e.status === 'open'
      if (filterStatus.value === 'appealed') return e.status === 'appealed'
      return e.status === 'resolved' || e.status === 'dismissed'
    })
    .map((e) => ({
      ...e,
      employeeName: store.employees.find((emp) => emp.id === e.employeeId)?.name ?? '-',
      typeLabel: getExceptionLabel(e.type),
      statusLabel: {
        open: '待处理',
        appealed: '申诉中',
        resolved: '已结案',
        dismissed: '已驳回',
      }[e.status],
      suggestLabel: exceptionHandleMap[e.type][0]?.label ?? '直接结案',
      relatedMakeup: store.makeupRequests.filter(
        (r) => r.employeeId === e.employeeId && r.date === e.date && r.status === 'pending',
      ),
      relatedLeave: store.leaveRequests.filter(
        (r) =>
          r.employeeId === e.employeeId &&
          r.status === 'pending' &&
          r.startDate <= e.date &&
          r.endDate >= e.date,
      ),
      relatedSwap: store.swapRequests.filter(
        (r) =>
          (r.applicantId === e.employeeId || r.targetEmployeeId === e.employeeId) &&
          r.date === e.date &&
          r.status === 'pending',
      ),
    }))
    .sort((a, b) => b.date.localeCompare(a.date)),
)

const currentExceptionRow = computed(() => {
  if (!currentException.value) return null
  return exceptionList.value.find((e) => e.id === currentException.value!.id) ?? null
})

const pendingLeaveList = computed(() =>
  store.leaveRequests
    .filter((r) => r.status === 'pending')
    .map((r) => ({
      ...r,
      employeeName: store.employees.find((e) => e.id === r.employeeId)?.name ?? '-',
      typeLabel: leaveTypeMap[r.leaveType],
      linkedException: store.exceptions.find(
        (e) =>
          e.employeeId === r.employeeId &&
          e.date >= r.startDate &&
          e.date <= r.endDate &&
          (e.status === 'open' || e.status === 'appealed'),
      ),
    })),
)

const pendingSwapList = computed(() =>
  store.swapRequests
    .filter((r) => r.status === 'pending')
    .map((r) => ({
      ...r,
      applicantName: store.employees.find((e) => e.id === r.applicantId)?.name ?? '-',
      targetName: store.employees.find((e) => e.id === r.targetEmployeeId)?.name ?? '-',
      linkedException: store.exceptions.find(
        (e) =>
          (e.employeeId === r.applicantId || e.employeeId === r.targetEmployeeId) &&
          e.date === r.date &&
          (e.status === 'open' || e.status === 'appealed'),
      ),
    })),
)

const pendingMakeupList = computed(() =>
  store.makeupRequests
    .filter((r) => r.status === 'pending')
    .map((r) => ({
      ...r,
      employeeName: store.employees.find((e) => e.id === r.employeeId)?.name ?? '-',
      typeLabel: r.punchType === 'clock_in' ? '上班卡' : '下班卡',
      linkedException: store.exceptions.find(
        (e) =>
          e.employeeId === r.employeeId &&
          e.date === r.date &&
          (e.status === 'open' || e.status === 'appealed'),
      ),
    })),
)

function openHandle(row: (typeof exceptionList.value)[0]) {
  currentException.value = row
  handleType.value = getDefaultHandleType(row.type)
  reviewNote.value = ''
  makeupForm.value = {
    punchType: row.type === 'missing_punch' ? 'clock_out' : 'clock_in',
    time: '16:00',
    reason: row.appealReason ?? row.message,
  }
  leaveForm.value = {
    leaveType: row.type === 'absent' ? 'sick' : 'personal',
    reason: row.appealReason ?? '',
  }
  manualResolution.value = '管理员核实后调整为正常'
  handleDrawer.value = true
}

async function reviewLinked(
  type: 'leave' | 'swap' | 'makeup',
  requestId: string,
  exceptionId: string | undefined,
  approved: boolean,
) {
  try {
    const { value } = await ElMessageBox.prompt(
      approved ? '审批意见（可选）' : '驳回原因',
      approved ? '通过申请' : '驳回申请',
      { inputValue: approved ? '同意' : '', inputPlaceholder: '请输入' },
    )
    if (exceptionId) {
      if (type === 'leave') store.reviewLeaveForException(requestId, exceptionId, approved, value)
      if (type === 'swap') store.reviewSwapForException(requestId, exceptionId, approved, value)
      if (type === 'makeup') store.reviewMakeupForException(requestId, exceptionId, approved, value)
    } else {
      if (type === 'leave') store.reviewLeaveRequest(requestId, approved, value, '人事管理员')
      if (type === 'swap') store.reviewSwapRequest(requestId, approved, value, '人事管理员')
      if (type === 'makeup') store.reviewMakeupRequest(requestId, approved, value, '人事管理员')
    }
    ElMessage.success(approved ? '已通过并关联结案' : '已驳回')
    handleDrawer.value = false
  } catch {
    // cancelled
  }
}

function submitHandle() {
  if (!currentException.value) return
  const exc = currentException.value
  try {
    if (handleType.value === 'makeup') {
      const pending = store.makeupRequests.find(
        (r) =>
          r.employeeId === exc.employeeId &&
          r.date === exc.date &&
          r.status === 'pending',
      )
      if (pending) {
        store.reviewMakeupForException(pending.id, exc.id, true, reviewNote.value || '审批通过')
      } else {
        if (!makeupForm.value.reason.trim()) {
          ElMessage.warning('请填写补卡原因')
          return
        }
        store.submitAndApproveMakeup(
          {
            employeeId: exc.employeeId,
            date: exc.date,
            punchType: makeupForm.value.punchType,
            time: makeupForm.value.time,
            reason: makeupForm.value.reason,
          },
          exc.id,
          reviewNote.value || '管理员代提交补卡',
        )
      }
      ElMessage.success('补卡已审批，异常已结案')
    } else if (handleType.value === 'leave') {
      const pending = store.leaveRequests.find(
        (r) =>
          r.employeeId === exc.employeeId &&
          r.status === 'pending' &&
          r.startDate <= exc.date &&
          r.endDate >= exc.date,
      )
      if (pending) {
        store.reviewLeaveForException(pending.id, exc.id, true, reviewNote.value || '审批通过')
      } else {
        if (!leaveForm.value.reason.trim()) {
          ElMessage.warning('请填写请假原因')
          return
        }
        store.submitAndApproveLeave(
          {
            employeeId: exc.employeeId,
            leaveType: leaveForm.value.leaveType,
            startDate: exc.date,
            endDate: exc.date,
            reason: leaveForm.value.reason,
          },
          exc.id,
          reviewNote.value || '管理员代提交请假',
        )
      }
      ElMessage.success('请假已审批，异常已结案')
    } else if (handleType.value === 'swap') {
      const pending = store.swapRequests.find(
        (r) =>
          (r.applicantId === exc.employeeId || r.targetEmployeeId === exc.employeeId) &&
          r.date === exc.date &&
          r.status === 'pending',
      )
      if (!pending) {
        ElMessage.warning('暂无关联换班申请，请员工先提交换班')
        return
      }
      store.reviewSwapForException(pending.id, exc.id, true, reviewNote.value || '审批通过')
      ElMessage.success('换班已审批，异常已结案')
    } else {
      store.resolveException(
        exc.id,
        manualResolution.value,
        '人事管理员',
        manualResolution.value.includes('驳回'),
      )
      ElMessage.success('异常已结案')
    }
    handleDrawer.value = false
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '处理失败')
  }
}

async function dismissException(id: string) {
  try {
    const { value } = await ElMessageBox.prompt('驳回原因', '驳回申诉', {
      inputPlaceholder: '请输入',
    })
    store.resolveException(id, value, '人事管理员', true)
    ElMessage.success('已驳回')
  } catch {
    // cancelled
  }
}
</script>

<template>
  <div class="page-card">
    <div class="page-header">
      <div>
        <h2 class="page-title">考勤异常处理</h2>
        <p class="text-muted">
          针对异常进行请假/换班/补卡审批 · 待处理异常
          {{ exceptionList.filter((e) => e.status === 'open' || e.status === 'appealed').length }} 条 ·
          待审批 {{ pendingApprovalCount }} 条
        </p>
      </div>
    </div>

    <el-tabs v-model="activeTab">
      <el-tab-pane label="异常列表" name="exceptions">
        <div class="page-toolbar">
          <el-radio-group v-model="filterStatus">
            <el-radio-button value="open">待处理</el-radio-button>
            <el-radio-button value="appealed">申诉中</el-radio-button>
            <el-radio-button value="resolved">已结案</el-radio-button>
            <el-radio-button value="all">全部</el-radio-button>
          </el-radio-group>
        </div>

        <el-table :data="exceptionList" border stripe empty-text="暂无异常记录">
          <el-table-column prop="date" label="日期" width="110" />
          <el-table-column prop="employeeName" label="员工" width="100" />
          <el-table-column prop="typeLabel" label="异常类型" width="100" />
          <el-table-column prop="message" label="说明" min-width="160" show-overflow-tooltip />
          <el-table-column label="建议处理" width="110">
            <template #default="{ row }">
              <el-tag size="small" type="warning">{{ row.suggestLabel }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="关联申请" width="120">
            <template #default="{ row }">
              <span v-if="row.relatedMakeup.length" class="link-tag">补卡{{ row.relatedMakeup.length }}</span>
              <span v-if="row.relatedLeave.length" class="link-tag">请假{{ row.relatedLeave.length }}</span>
              <span v-if="row.relatedSwap.length" class="link-tag">换班{{ row.relatedSwap.length }}</span>
              <span
                v-if="!row.relatedMakeup.length && !row.relatedLeave.length && !row.relatedSwap.length"
                class="text-muted"
              >
                —
              </span>
            </template>
          </el-table-column>
          <el-table-column prop="statusLabel" label="状态" width="90" />
          <el-table-column label="操作" width="160" fixed="right">
            <template #default="{ row }">
              <template v-if="row.status === 'open' || row.status === 'appealed'">
                <el-button link type="primary" @click="openHandle(row)">审批处理</el-button>
                <el-button link type="danger" @click="dismissException(row.id)">驳回</el-button>
              </template>
              <span v-else class="text-muted">{{ row.resolution ?? '—' }}</span>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane :label="`待审批 (${pendingApprovalCount})`" name="approvals">
        <h4 class="sub-title">补卡申请</h4>
        <el-table :data="pendingMakeupList" border stripe size="small" empty-text="暂无待审批补卡">
          <el-table-column prop="employeeName" label="员工" width="100" />
          <el-table-column prop="date" label="日期" width="110" />
          <el-table-column prop="typeLabel" label="类型" width="80" />
          <el-table-column prop="time" label="补卡时间" width="90" />
          <el-table-column prop="reason" label="原因" min-width="160" show-overflow-tooltip />
          <el-table-column label="关联异常" width="90">
            <template #default="{ row }">
              <el-tag v-if="row.linkedException" size="small" type="warning">有</el-tag>
              <span v-else class="text-muted">—</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="160" fixed="right">
            <template #default="{ row }">
              <el-button
                link
                type="success"
                @click="reviewLinked('makeup', row.id, row.linkedException?.id, true)"
              >
                通过
              </el-button>
              <el-button
                link
                type="danger"
                @click="reviewLinked('makeup', row.id, row.linkedException?.id, false)"
              >
                驳回
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <h4 class="sub-title">请假申请</h4>
        <el-table :data="pendingLeaveList" border stripe size="small" empty-text="暂无待审批请假">
          <el-table-column prop="employeeName" label="员工" width="100" />
          <el-table-column prop="typeLabel" label="类型" width="80" />
          <el-table-column label="日期" min-width="160">
            <template #default="{ row }">{{ row.startDate }} ~ {{ row.endDate }}</template>
          </el-table-column>
          <el-table-column prop="reason" label="原因" min-width="160" show-overflow-tooltip />
          <el-table-column label="关联异常" width="90">
            <template #default="{ row }">
              <el-tag v-if="row.linkedException" size="small" type="warning">有</el-tag>
              <span v-else class="text-muted">—</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="160" fixed="right">
            <template #default="{ row }">
              <el-button
                link
                type="success"
                @click="reviewLinked('leave', row.id, row.linkedException?.id, true)"
              >
                通过
              </el-button>
              <el-button
                link
                type="danger"
                @click="reviewLinked('leave', row.id, row.linkedException?.id, false)"
              >
                驳回
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <h4 class="sub-title">换班申请</h4>
        <el-table :data="pendingSwapList" border stripe size="small" empty-text="暂无待审批换班">
          <el-table-column prop="applicantName" label="申请人" width="100" />
          <el-table-column prop="targetName" label="换班对象" width="100" />
          <el-table-column prop="date" label="日期" width="110" />
          <el-table-column prop="reason" label="原因" min-width="180" show-overflow-tooltip />
          <el-table-column label="关联异常" width="90">
            <template #default="{ row }">
              <el-tag v-if="row.linkedException" size="small" type="warning">有</el-tag>
              <span v-else class="text-muted">—</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="160" fixed="right">
            <template #default="{ row }">
              <el-button
                link
                type="success"
                @click="reviewLinked('swap', row.id, row.linkedException?.id, true)"
              >
                通过
              </el-button>
              <el-button
                link
                type="danger"
                @click="reviewLinked('swap', row.id, row.linkedException?.id, false)"
              >
                驳回
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </div>

  <el-drawer
    v-model="handleDrawer"
    title="异常审批处理"
    size="520px"
    destroy-on-close
  >
    <template v-if="currentException">
      <el-descriptions :column="1" border class="exc-desc">
        <el-descriptions-item label="员工">
          {{ store.employees.find((e) => e.id === currentException!.employeeId)?.name }}
        </el-descriptions-item>
        <el-descriptions-item label="日期">{{ currentException.date }}</el-descriptions-item>
        <el-descriptions-item label="异常">
          {{ getExceptionLabel(currentException.type) }}：{{ currentException.message }}
        </el-descriptions-item>
        <el-descriptions-item v-if="currentException.appealReason" label="申诉理由">
          {{ currentException.appealReason }}
        </el-descriptions-item>
      </el-descriptions>

      <div class="handle-section">
        <div class="handle-label">处理方式</div>
        <el-radio-group v-model="handleType" class="handle-radio">
          <el-radio
            v-for="opt in exceptionHandleMap[currentException.type]"
            :key="opt.handle"
            :value="opt.handle"
          >
            {{ opt.label }}
          </el-radio>
        </el-radio-group>
        <p class="text-muted handle-tip">
          {{ exceptionHandleMap[currentException.type].find((o) => o.handle === handleType)?.desc }}
        </p>
      </div>

      <template v-if="handleType === 'makeup'">
        <el-alert
          v-if="currentExceptionRow?.relatedMakeup.length"
          type="info"
          :closable="false"
          title="检测到员工已提交补卡申请，确认后将直接审批通过"
          style="margin-bottom: 12px"
        />
        <el-form v-else label-width="90px">
          <el-form-item label="补卡类型">
            <el-radio-group v-model="makeupForm.punchType">
              <el-radio value="clock_in">上班卡</el-radio>
              <el-radio value="clock_out">下班卡</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="补卡时间">
            <el-time-select v-model="makeupForm.time" start="06:00" step="00:15" end="22:00" />
          </el-form-item>
          <el-form-item label="原因">
            <el-input v-model="makeupForm.reason" type="textarea" :rows="2" />
          </el-form-item>
        </el-form>
      </template>

      <template v-if="handleType === 'leave'">
        <el-alert
          v-if="currentExceptionRow?.relatedLeave.length"
          type="info"
          :closable="false"
          title="检测到员工已提交请假申请，确认后将直接审批通过"
          style="margin-bottom: 12px"
        />
        <el-form v-else label-width="90px">
          <el-form-item label="请假类型">
            <el-select v-model="leaveForm.leaveType" style="width: 100%">
              <el-option label="事假" value="personal" />
              <el-option label="病假" value="sick" />
              <el-option label="年假" value="annual" />
              <el-option label="调休" value="compensatory" />
            </el-select>
          </el-form-item>
          <el-form-item label="原因">
            <el-input v-model="leaveForm.reason" type="textarea" :rows="2" />
          </el-form-item>
        </el-form>
      </template>

      <template v-if="handleType === 'swap'">
        <el-alert
          v-if="!currentExceptionRow?.relatedSwap.length"
          type="warning"
          :closable="false"
          title="暂无换班申请，请通知员工提交后再审批"
        />
        <el-alert v-else type="info" :closable="false" title="确认后将审批换班并自动更新排班" />
      </template>

      <template v-if="handleType === 'manual'">
        <el-form label-width="90px">
          <el-form-item label="处理意见">
            <el-input v-model="manualResolution" type="textarea" :rows="3" />
          </el-form-item>
        </el-form>
      </template>

      <el-form-item v-if="handleType !== 'manual'" label="审批意见" label-width="90px">
        <el-input v-model="reviewNote" placeholder="可选" />
      </el-form-item>

      <div class="drawer-footer">
        <el-button @click="handleDrawer = false">取消</el-button>
        <el-button type="primary" @click="submitHandle">确认处理</el-button>
      </div>
    </template>
  </el-drawer>
</template>

<style scoped>
.sub-title {
  margin: 20px 0 12px;
  font-size: 14px;
  font-weight: 600;
}

.sub-title:first-of-type {
  margin-top: 0;
}

.link-tag {
  display: inline-block;
  font-size: 12px;
  color: var(--app-primary);
  margin-right: 6px;
}

.exc-desc {
  margin-bottom: 20px;
}

.handle-section {
  margin-bottom: 16px;
}

.handle-label {
  font-weight: 600;
  margin-bottom: 8px;
}

.handle-radio {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}

.handle-tip {
  margin-top: 8px;
}

.drawer-footer {
  margin-top: 24px;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
</style>
