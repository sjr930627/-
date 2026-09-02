<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useAppStore } from '@/stores/app'
import {
  buildDailyAttendanceList,
  buildMonthlySummary,
  filterAssignmentsBySource,
  formatDailyWorkHoursText,
  resolveAttendanceShiftColumn,
  getMonthDateRange,
  getStatusLabel,
  getStatusTagType,
  isDailyAttendanceVisible,
} from '@/services/attendance'
import { getDepartmentName } from '@/utils'
import { resolveEnterpriseIdByEmployee } from '@/utils/enterpriseScope'
import type { AttendanceHoursAudit } from '@/types'

const props = withDefaults(
  defineProps<{
    embedded?: boolean
    enterpriseId?: string
    assignmentSource?: 'schedule' | 'grab'
    initialEmployeeId?: string
    initialMonth?: string
  }>(),
  { embedded: false, assignmentSource: 'schedule' },
)

const store = useAppStore()
const monthTableRef = ref<{ toggleRowExpansion: (row: unknown) => void }>()
const selectedMonth = ref(props.initialMonth || '2026-07')
const filterDept = ref('')
const filterEmployeeId = ref(props.initialEmployeeId ?? '')
const expandedIds = ref<string[]>([])
const auditVisible = ref(false)
const auditTarget = ref<{
  employeeName: string
  date: string
  history: AttendanceHoursAudit[]
  correctedBy?: string
  correctedAt?: string
  note?: string
} | null>(null)

watch(
  () => [props.initialEmployeeId, props.initialMonth] as const,
  ([employeeId, month]) => {
    if (employeeId) filterEmployeeId.value = employeeId
    if (month) selectedMonth.value = month
  },
)

const scopedEmployees = computed(() => {
  const list = props.enterpriseId
    ? store.getEmployeesByEnterprise(props.enterpriseId)
    : store.employees
  return list.filter((e) => e.status === 'active')
})

const scopedDepartments = computed(() =>
  props.enterpriseId ? store.getDepartmentsByEnterprise(props.enterpriseId) : store.departments,
)

const tableData = computed(() => {
  const employees = scopedEmployees.value.filter((e) => {
    if (filterDept.value && e.departmentId !== filterDept.value) return false
    if (filterEmployeeId.value && e.id !== filterEmployeeId.value) return false
    return true
  })
  const daily = buildDailyAttendanceList(
    employees.map((e) => e.id),
    getMonthDateRange(selectedMonth.value),
    filterAssignmentsBySource(store.assignments, props.assignmentSource),
    store.shifts,
    store.punches,
    store.leaveRequests,
    store.attendanceRule,
    store.manualOverrides,
  )

  return employees.map((emp) => {
    const empDaily = daily.filter((d) => d.employeeId === emp.id)
    const summary = buildMonthlySummary(emp.id, selectedMonth.value, empDaily)
    const enterpriseId = resolveEnterpriseIdByEmployee(emp)
    const enterpriseName = store.enterprises.find((e) => e.id === enterpriseId)?.name ?? '—'
    const departmentName = getDepartmentName(store.departments, emp.departmentId)
    const dailyRows = empDaily.filter(isDailyAttendanceVisible).map((d) => {
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
      return {
        ...d,
        rowKey: `${d.employeeId}_${d.date}`,
        enterpriseName,
        departmentName,
        employeeName: emp.name,
        phone: emp.phone || '—',
        shiftName: shiftColumn.text,
        statusLabel: getStatusLabel(d.status),
        tagType: getStatusTagType(d.status),
        hoursHistory: override?.hoursHistory ?? [],
      }
    })
    return {
      ...summary,
      enterpriseName,
      name: emp.name,
      phone: emp.phone || '—',
      departmentName,
      dailyRows,
    }
  })
})

const shiftColumnLabel = computed(() =>
  props.assignmentSource === 'grab' ? '班次' : '排班',
)

function isRowExpanded(employeeId: string) {
  return expandedIds.value.includes(employeeId)
}

function toggleExpand(row: { employeeId: string }) {
  monthTableRef.value?.toggleRowExpansion(row)
}

function onExpandChange(_row: { employeeId: string }, expandedRows: { employeeId: string }[]) {
  expandedIds.value = expandedRows.map((r) => r.employeeId)
}

function formatTime(iso?: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-CN')
}

function openAudit(row: {
  employeeName: string
  date: string
  hoursHistory: AttendanceHoursAudit[]
  hoursCorrectedBy?: string
  hoursCorrectedAt?: string
  manualNote?: string
}) {
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

const totals = computed(() => ({
  scheduled: tableData.value.reduce((s, r) => s + r.scheduledDays, 0),
  actual: tableData.value.reduce((s, r) => s + r.actualDays, 0),
  late: tableData.value.reduce((s, r) => s + r.lateCount, 0),
  absent: tableData.value.reduce((s, r) => s + r.absentCount, 0),
  hours: Math.round(tableData.value.reduce((s, r) => s + r.totalWorkHours, 0) * 10) / 10,
}))

const summaryNumberKeys = [
  'scheduledDays',
  'actualDays',
  'lateCount',
  'earlyLeaveCount',
  'missingPunchCount',
  'absentCount',
  'leaveDays',
  'overtimeHours',
  'totalWorkHours',
] as const

function getSummaries({ columns, data }: { columns: { property?: string }[]; data: typeof tableData.value }) {
  return columns.map((col, index) => {
    if (index === 0 || col.property === 'enterpriseName') return '合计'
    const key = col.property
    if (!key || !summaryNumberKeys.includes(key as (typeof summaryNumberKeys)[number])) return ''
    const sum = data.reduce((s, r) => s + (Number((r as unknown as Record<string, number>)[key]) || 0), 0)
    if (key === 'overtimeHours' || key === 'totalWorkHours') return Math.round(sum * 10) / 10
    return sum
  })
}

watch([selectedMonth, filterDept, filterEmployeeId], () => {
  expandedIds.value = []
})
</script>

<template>
  <div :class="{ 'page-card': !props.embedded }">
    <div v-if="!props.embedded" class="page-header">
      <div>
        <h2 class="page-title">月考勤数据</h2>
        <p class="text-muted">按月汇总应出勤、实际出勤、迟到、请假、加班等</p>
      </div>
    </div>
    <p v-else class="text-muted tab-desc">按月汇总应出勤、实际出勤、迟到、请假、加班等</p>

    <el-form inline class="filter-bar">
      <el-form-item label="月份">
        <el-date-picker
          v-model="selectedMonth"
          type="month"
          value-format="YYYY-MM"
          :clearable="false"
        />
      </el-form-item>
      <el-form-item label="部门">
        <el-select v-model="filterDept" clearable placeholder="全部" style="width: 160px">
          <el-option v-for="d in scopedDepartments" :key="d.id" :label="d.name" :value="d.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="人员">
        <el-select
          v-model="filterEmployeeId"
          clearable
          filterable
          placeholder="全部"
          style="width: 180px"
        >
          <el-option
            v-for="e in scopedEmployees"
            :key="e.id"
            :label="`${e.name}${e.phone ? ` · ${e.phone}` : ''}`"
            :value="e.id"
          />
        </el-select>
      </el-form-item>
    </el-form>

    <el-row :gutter="12" class="summary-row">
      <el-col :span="5"><el-statistic title="应出勤人次" :value="totals.scheduled" /></el-col>
      <el-col :span="5"><el-statistic title="实际出勤" :value="totals.actual" /></el-col>
      <el-col :span="4"><el-statistic title="迟到" :value="totals.late" /></el-col>
      <el-col :span="4"><el-statistic title="旷工" :value="totals.absent" /></el-col>
      <el-col :span="6"><el-statistic title="总工时(h)" :value="totals.hours" /></el-col>
    </el-row>

    <el-table
      ref="monthTableRef"
      :data="tableData"
      border
      stripe
      show-summary
      :summary-method="getSummaries"
      row-key="employeeId"
      class="month-table"
      @expand-change="onExpandChange"
    >
      <el-table-column prop="enterpriseName" label="企业" min-width="140" show-overflow-tooltip fixed />
      <el-table-column prop="departmentName" label="部门" min-width="120" show-overflow-tooltip fixed />
      <el-table-column prop="name" label="姓名" width="100" fixed />
      <el-table-column prop="phone" label="手机号" width="130" fixed />
      <el-table-column prop="scheduledDays" label="应出勤" width="90" />
      <el-table-column prop="actualDays" label="实际出勤" width="90" />
      <el-table-column prop="lateCount" label="迟到" width="70" />
      <el-table-column prop="earlyLeaveCount" label="早退" width="70" />
      <el-table-column prop="missingPunchCount" label="缺卡" width="70" />
      <el-table-column prop="absentCount" label="旷工" width="70" />
      <el-table-column prop="leaveDays" label="请假" width="70" />
      <el-table-column prop="overtimeHours" label="加班(h)" width="90" />
      <el-table-column prop="totalWorkHours" label="总工时(h)" width="100" />
      <el-table-column label="明细" width="110" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click.stop="toggleExpand(row)">
            {{ isRowExpanded(row.employeeId) ? '收起明细' : '展开明细' }}
          </el-button>
        </template>
      </el-table-column>
      <el-table-column type="expand" width="1" class-name="hidden-expand">
        <template #default="{ row }">
          <div class="daily-expand">
            <el-table :data="row.dailyRows" border stripe size="small" empty-text="本月暂无打卡数据">
              <el-table-column prop="date" label="日期" width="120" />
              <el-table-column prop="employeeName" label="姓名" width="100" />
              <el-table-column prop="phone" label="手机号" width="130" />
              <el-table-column
                prop="shiftName"
                :label="shiftColumnLabel"
                :min-width="assignmentSource === 'grab' ? 200 : 90"
                show-overflow-tooltip
              />
              <el-table-column label="上班" width="80">
                <template #default="{ row: day }">{{ day.clockIn ?? '—' }}</template>
              </el-table-column>
              <el-table-column label="下班" width="80">
                <template #default="{ row: day }">{{ day.clockOut ?? '—' }}</template>
              </el-table-column>
              <el-table-column label="工时(h)" width="150">
                <template #default="{ row: day }">
                  {{ formatDailyWorkHoursText(day) }}
                  <el-tag v-if="day.workHoursCorrected" size="small" type="warning" class="hour-tag">
                    已矫正
                  </el-tag>
                  <el-tag v-else-if="day.hoursConfirmed" size="small" type="success" class="hour-tag">
                    已确认
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column label="状态" width="100">
                <template #default="{ row: day }">
                  <el-tag :type="day.tagType" size="small">{{ day.statusLabel }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column label="校正信息" min-width="180">
                <template #default="{ row: day }">
                  <template v-if="day.workHoursCorrected">
                    <div class="audit-line">{{ day.hoursCorrectedBy || '—' }} · {{ formatTime(day.hoursCorrectedAt) }}</div>
                    <div class="audit-reason text-muted" :title="day.manualNote">
                      {{ day.manualNote || '—' }}
                    </div>
                    <el-button link type="primary" @click="openAudit(day)">查看记录</el-button>
                  </template>
                  <span v-else class="text-muted">—</span>
                </template>
              </el-table-column>
              <el-table-column label="工时确认" min-width="160">
                <template #default="{ row: day }">
                  <template v-if="day.hoursConfirmed">
                    <el-tag size="small" type="success">已确认</el-tag>
                    <div class="audit-line">{{ day.hoursConfirmedBy || '—' }}</div>
                    <div class="audit-reason text-muted">{{ formatTime(day.hoursConfirmedAt) }}</div>
                  </template>
                  <el-tag
                    v-else-if="day.scheduledHours > 0 && day.status !== 'leave' && day.status !== 'rest' && !day.hoursConfirmed"
                    size="small"
                    type="warning"
                  >
                    待确认
                  </el-tag>
                  <span v-else class="text-muted">—</span>
                </template>
              </el-table-column>
            </el-table>
          </div>
        </template>
      </el-table-column>
    </el-table>
  </div>

  <el-dialog v-model="auditVisible" title="工时操作记录" width="560px" destroy-on-close>
    <template v-if="auditTarget">
      <p class="correction-meta">{{ auditTarget.employeeName }} · {{ auditTarget.date }}</p>
      <el-descriptions v-if="auditTarget.correctedAt" :column="1" border size="small">
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

.filter-bar {
  margin-bottom: 16px;
}

.summary-row {
  margin-bottom: 16px;
}

.daily-expand {
  padding: 8px 12px 12px 48px;
  background: #f8fafc;
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

.correction-meta {
  margin: 0 0 16px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.month-table :deep(.hidden-expand),
.month-table :deep(.el-table__expand-column) {
  width: 0 !important;
  padding: 0 !important;
  border: none !important;
}

.month-table :deep(.el-table__expand-icon) {
  display: none;
}
</style>
