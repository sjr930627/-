<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import {
  buildConfirmHoursWarning,
  buildDailyAttendanceList,
  canConfirmWorkHours,
  canCorrectWorkHours,
  filterAssignmentsBySource,
  formatActualPunchHoursText,
  formatDailyWorkHoursText,
  resolveAttendanceShiftColumn,
  resolveConfirmWorkHours,
  getStatusLabel,
  getStatusTagType,
  isDailyAttendanceVisible,
} from '@/services/attendance'
import { getWeekday, getDepartmentName } from '@/utils'
import { resolveEnterpriseIdByEmployee } from '@/utils/enterpriseScope'
import type { AttendanceHoursAudit } from '@/types'

const props = withDefaults(
  defineProps<{
    embedded?: boolean
    enterpriseId?: string
    initialDate?: string
    initialEmployeeId?: string
    /** 排班考勤 / 抢班考勤 */
    assignmentSource?: 'schedule' | 'grab'
  }>(),
  { embedded: false, assignmentSource: 'schedule' },
)

const store = useAppStore()
const selectedDate = ref(props.initialDate ?? '2026-07-24')
const filterDept = ref('')
const filterEmployeeId = ref(props.initialEmployeeId ?? '')
const selectedKeys = ref<string[]>([])

const scopedEmployees = computed(() => {
  const list = props.enterpriseId
    ? store.getEmployeesByEnterprise(props.enterpriseId)
    : store.employees
  return list.filter((e) => e.status === 'active')
})

const scopedDepartments = computed(() =>
  props.enterpriseId ? store.getDepartmentsByEnterprise(props.enterpriseId) : store.departments,
)

const correctionVisible = ref(false)
const correctionTarget = ref<{
  employeeId: string
  employeeName: string
  date: string
  workHours: number
  scheduledHours: number
} | null>(null)
const correctionForm = ref({ workHours: 0, note: '' })

const auditVisible = ref(false)
const auditTarget = ref<{
  employeeName: string
  date: string
  history: AttendanceHoursAudit[]
  correctedBy?: string
  correctedAt?: string
  note?: string
} | null>(null)

onMounted(() => store.syncExceptions())

watch(selectedDate, () => {
  selectedKeys.value = []
})

const tableData = computed(() => {
  const employees = scopedEmployees.value.filter((e) => {
    if (filterDept.value && e.departmentId !== filterDept.value) return false
    if (filterEmployeeId.value && e.id !== filterEmployeeId.value) return false
    return true
  })
  const daily = buildDailyAttendanceList(
    employees.map((e) => e.id),
    [selectedDate.value],
    filterAssignmentsBySource(store.assignments, props.assignmentSource),
    store.shifts,
    store.punches,
    store.leaveRequests,
    store.attendanceRule,
    store.manualOverrides,
  )
  return daily
    .filter(isDailyAttendanceVisible)
    .map((d) => {
      const emp = store.employees.find((e) => e.id === d.employeeId)
      const shift = d.shiftId ? store.shifts.find((s) => s.id === d.shiftId) : undefined
      const assignment = store.assignments.find(
        (a) =>
          a.employeeId === d.employeeId &&
          a.date === d.date &&
          (props.assignmentSource === 'grab' ? Boolean(a.fromGrabSlotId) : !a.fromGrabSlotId),
      )
      const slot = assignment?.fromGrabSlotId
        ? store.grabShiftSlots.find((s) => s.id === assignment.fromGrabSlotId)
        : null
      const shiftColumn = resolveAttendanceShiftColumn({
        source: props.assignmentSource,
        shift,
        slot,
        scheduledHours: d.scheduledHours,
      })
      const override = store.manualOverrides[`${d.employeeId}_${d.date}`]
      const rowKey = `${d.employeeId}_${d.date}`
      const enterpriseId = resolveEnterpriseIdByEmployee(emp)
      return {
        ...d,
        rowKey,
        enterpriseName: store.enterprises.find((e) => e.id === enterpriseId)?.name ?? '—',
        departmentName: emp
          ? getDepartmentName(store.departments, emp.departmentId)
          : '—',
        employeeName: emp?.name ?? '-',
        phone: emp?.phone || '—',
        shiftName: shiftColumn.text,
        statusLabel: getStatusLabel(d.status),
        tagType: getStatusTagType(d.status),
        canCorrect: canCorrectWorkHours(d),
        canConfirm: canConfirmWorkHours(d),
        confirmWorkHours: resolveConfirmWorkHours(d),
        hoursHistory: override?.hoursHistory ?? [],
      }
    })
})

const shiftColumnLabel = computed(() =>
  props.assignmentSource === 'grab' ? '班次' : '排班',
)

const summary = computed(() => {
  const list = tableData.value
  return {
    total: list.length,
    normal: list.filter((d) => d.status === 'normal').length,
    abnormal: list.filter((d) => !['normal', 'leave'].includes(d.status)).length,
    leave: list.filter((d) => d.status === 'leave').length,
    pendingConfirm: list.filter((d) => d.canConfirm).length,
  }
})

const selectedConfirmable = computed(() =>
  tableData.value.filter((r) => selectedKeys.value.includes(r.rowKey) && r.canConfirm),
)

function onSelectionChange(rows: { rowKey: string }[]) {
  selectedKeys.value = rows.map((r) => r.rowKey)
}

function rowSelectable(row: (typeof tableData.value)[0]) {
  return row.canConfirm
}

function formatTime(iso?: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-CN')
}

function openCorrection(row: (typeof tableData.value)[0]) {
  correctionTarget.value = {
    employeeId: row.employeeId,
    employeeName: row.employeeName,
    date: row.date,
    workHours: row.actualPunchHours ?? row.workHours,
    scheduledHours: row.scheduledHours,
  }
  correctionForm.value = {
    workHours: row.workHoursCorrected ? row.workHours : (row.actualPunchHours ?? row.workHours),
    note: '',
  }
  correctionVisible.value = true
}

function submitCorrection() {
  if (!correctionTarget.value) return
  if (correctionForm.value.workHours < 0) {
    ElMessage.warning('工时不能为负数')
    return
  }
  const note = correctionForm.value.note.trim()
  if (!note) {
    ElMessage.warning('矫正原因必填')
    return
  }
  try {
    store.setWorkHoursCorrection(
      correctionTarget.value.employeeId,
      correctionTarget.value.date,
      correctionForm.value.workHours,
      note,
      '考勤管理员',
      { autoConfirm: false },
    )
    ElMessage.success('工时已矫正，可继续确认工时')
    correctionVisible.value = false
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败')
  }
}

async function confirmOne(row: (typeof tableData.value)[0]) {
  const workHours = resolveConfirmWorkHours(row)
  const warning = buildConfirmHoursWarning([
    {
      name: row.employeeName,
      workHours,
      scheduledHours: row.scheduledHours,
    },
  ])
  if (warning) {
    try {
      await ElMessageBox.confirm(warning, '工时不足提醒', {
        type: 'warning',
        confirmButtonText: '确认并结算',
        cancelButtonText: '取消',
      })
    } catch {
      return
    }
  }
  try {
    store.confirmWorkHours(row.employeeId, row.date, { workHours })
    ElMessage.success(`已确认 ${row.employeeName} 工时 ${workHours}h`)
    selectedKeys.value = selectedKeys.value.filter((k) => k !== row.rowKey)
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '确认失败')
  }
}

async function batchConfirm() {
  const rows = selectedConfirmable.value
  if (!rows.length) {
    ElMessage.warning('请先勾选待确认工时的记录')
    return
  }
  const payloads = rows.map((r) => ({
    employeeId: r.employeeId,
    date: r.date,
    name: r.employeeName,
    workHours: resolveConfirmWorkHours(r),
    scheduledHours: r.scheduledHours,
  }))
  const warning = buildConfirmHoursWarning(
    payloads.map((r) => ({
      name: r.name,
      workHours: r.workHours,
      scheduledHours: r.scheduledHours,
    })),
  )
  try {
    await ElMessageBox.confirm(
      warning || `将确认所选 ${rows.length} 条记录的当前工时并结算，是否继续？`,
      warning ? '工时不足提醒' : '批量确认工时',
      {
        type: 'warning',
        confirmButtonText: warning ? '确认并结算' : '确定',
        cancelButtonText: '取消',
      },
    )
  } catch {
    return
  }
  const count = store.batchConfirmWorkHours(
    payloads.map((r) => ({
      employeeId: r.employeeId,
      date: r.date,
      workHours: r.workHours,
    })),
  )
  selectedKeys.value = []
  ElMessage.success(`已批量确认 ${count} 条工时`)
}

function openAudit(row: (typeof tableData.value)[0]) {
  auditTarget.value = {
    employeeName: row.employeeName,
    date: row.date,
    history: row.hoursHistory,
    correctedBy: row.hoursCorrectedBy,
    correctedAt: row.hoursCorrectedAt,
    note: row.manualNote,
  }
  auditVisible.value = true
}
</script>

<template>
  <div :class="{ 'page-card': !props.embedded }">
    <div v-if="!props.embedded" class="page-header">
      <div>
        <h2 class="page-title">日考勤数据</h2>
        <p class="text-muted">
          {{ selectedDate }}（周{{ getWeekday(selectedDate) }}）· 未确认工时均可矫正（不限日期），确认后不可再矫正
        </p>
      </div>
    </div>
    <p v-else class="text-muted tab-desc">
      {{ selectedDate }}（周{{ getWeekday(selectedDate) }}）· 未确认工时均可矫正（不限日期），确认后不可再矫正
    </p>

    <el-form inline style="margin-bottom: 16px">
      <el-form-item label="日期">
        <el-date-picker v-model="selectedDate" type="date" value-format="YYYY-MM-DD" />
      </el-form-item>
      <el-form-item label="部门">
        <el-select v-model="filterDept" clearable placeholder="全部" style="width: 160px">
          <el-option v-for="d in scopedDepartments" :key="d.id" :label="d.name" :value="d.id" />
        </el-select>
      </el-form-item>
      <el-form-item>
        <el-button type="primary" :disabled="!selectedConfirmable.length" @click="batchConfirm">
          批量确认工时
          <template v-if="selectedConfirmable.length">（{{ selectedConfirmable.length }}）</template>
        </el-button>
      </el-form-item>
    </el-form>

    <el-row :gutter="12" style="margin-bottom: 16px">
      <el-col :span="5"><el-statistic title="应出勤" :value="summary.total" /></el-col>
      <el-col :span="5"><el-statistic title="正常" :value="summary.normal" /></el-col>
      <el-col :span="5"><el-statistic title="异常" :value="summary.abnormal" /></el-col>
      <el-col :span="4"><el-statistic title="请假" :value="summary.leave" /></el-col>
      <el-col :span="5"><el-statistic title="待确认工时" :value="summary.pendingConfirm" /></el-col>
    </el-row>

    <el-table
      :data="tableData"
      border
      stripe
      row-key="rowKey"
      @selection-change="onSelectionChange"
    >
      <el-table-column type="selection" width="48" :selectable="rowSelectable" />
      <el-table-column prop="enterpriseName" label="企业" min-width="140" show-overflow-tooltip />
      <el-table-column prop="departmentName" label="部门" min-width="110" show-overflow-tooltip />
      <el-table-column prop="employeeName" label="姓名" width="100" />
      <el-table-column prop="phone" label="手机号" width="130" />
      <el-table-column prop="shiftName" :label="shiftColumnLabel" :min-width="assignmentSource === 'grab' ? 200 : 90" show-overflow-tooltip />
      <el-table-column prop="clockIn" label="上班" width="80">
        <template #default="{ row }">{{ row.clockIn ?? '—' }}</template>
      </el-table-column>
      <el-table-column prop="clockOut" label="下班" width="80">
        <template #default="{ row }">{{ row.clockOut ?? '—' }}</template>
      </el-table-column>
      <el-table-column label="实际工时(h)" width="110">
        <template #default="{ row }">
          {{ formatActualPunchHoursText(row) }}
        </template>
      </el-table-column>
      <el-table-column label="工时(h)" width="120">
        <template #default="{ row }">
          {{ row.hoursConfirmed ? formatDailyWorkHoursText(row) : row.confirmWorkHours }}
          <el-tag v-if="row.workHoursCorrected" size="small" type="warning" class="hour-tag">
            已矫正
          </el-tag>
          <el-tag v-else-if="row.hoursConfirmed" size="small" type="success" class="hour-tag">
            已确认
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.tagType" size="small">{{ row.statusLabel }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="校正信息" min-width="180">
        <template #default="{ row }">
          <template v-if="row.workHoursCorrected">
            <div class="audit-line">{{ row.hoursCorrectedBy || '—' }} · {{ formatTime(row.hoursCorrectedAt) }}</div>
            <div class="audit-reason text-muted" :title="row.manualNote">
              {{ row.manualNote || '—' }}
            </div>
            <el-button link type="primary" @click="openAudit(row)">查看记录</el-button>
          </template>
          <span v-else class="text-muted">—</span>
        </template>
      </el-table-column>
      <el-table-column label="工时确认" min-width="160">
        <template #default="{ row }">
          <template v-if="row.hoursConfirmed">
            <el-tag size="small" type="success">已确认</el-tag>
            <div class="audit-line">{{ row.hoursConfirmedBy || '—' }}</div>
            <div class="audit-reason text-muted">{{ formatTime(row.hoursConfirmedAt) }}</div>
          </template>
          <el-tag v-else-if="row.canConfirm" size="small" type="warning">待确认</el-tag>
          <span v-else class="text-muted">—</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-button v-if="row.canCorrect" link type="primary" @click="openCorrection(row)">
            工时矫正
          </el-button>
          <el-button v-if="row.canConfirm" link type="success" @click="confirmOne(row)">
            确认工时
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>

  <el-dialog v-model="correctionVisible" title="工时矫正" width="460px" destroy-on-close>
    <template v-if="correctionTarget">
      <p class="correction-meta">
        {{ correctionTarget.employeeName }} · {{ correctionTarget.date }} · 班次工时
        {{ correctionTarget.scheduledHours }}h · 实际
        {{ correctionTarget.workHours }}h（矫正工时可大于班次工时）
      </p>
      <el-form label-width="100px">
        <el-form-item label="矫正工时" required>
          <el-input-number
            v-model="correctionForm.workHours"
            :min="0"
            :max="24"
            :step="0.5"
            :precision="1"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="矫正原因" required>
          <el-input
            v-model="correctionForm.note"
            type="textarea"
            :rows="3"
            maxlength="200"
            show-word-limit
            placeholder="必填，如：漏打卡已核实，按实际出勤矫正"
          />
        </el-form-item>
      </el-form>
    </template>
    <template #footer>
      <el-button @click="correctionVisible = false">取消</el-button>
      <el-button type="primary" @click="submitCorrection">确认矫正</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="auditVisible" title="工时操作记录" width="560px" destroy-on-close>
    <template v-if="auditTarget">
      <p class="correction-meta">{{ auditTarget.employeeName }} · {{ auditTarget.date }}</p>
      <el-descriptions v-if="auditTarget.correctedAt" :column="1" border size="small" class="audit-summary">
        <el-descriptions-item label="最近矫正人">{{ auditTarget.correctedBy || '—' }}</el-descriptions-item>
        <el-descriptions-item label="操作时间">{{ formatTime(auditTarget.correctedAt) }}</el-descriptions-item>
        <el-descriptions-item label="矫正原因">{{ auditTarget.note || '—' }}</el-descriptions-item>
      </el-descriptions>
      <el-table :data="auditTarget.history" border size="small" empty-text="暂无操作记录" style="margin-top: 12px">
        <el-table-column label="操作" width="80">
          <template #default="{ row }">
            {{ row.action === 'correct' ? '矫正' : '确认' }}
          </template>
        </el-table-column>
        <el-table-column prop="workHours" label="工时" width="70" />
        <el-table-column prop="operator" label="操作员" width="100" />
        <el-table-column label="时间" width="160">
          <template #default="{ row }">{{ formatTime(row.operatedAt) }}</template>
        </el-table-column>
        <el-table-column prop="reason" label="原因" min-width="140" show-overflow-tooltip />
      </el-table>
    </template>
  </el-dialog>
</template>

<style scoped>
.tab-desc {
  margin: 0 0 16px;
}

.correction-meta {
  margin: 0 0 16px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.hour-tag {
  margin-left: 4px;
}

.audit-line {
  font-size: 13px;
  line-height: 1.4;
}

.audit-reason {
  font-size: 12px;
  margin: 2px 0 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 220px;
}

.audit-summary {
  margin-bottom: 4px;
}
</style>
