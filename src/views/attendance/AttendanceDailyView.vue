<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import {
  buildDailyAttendanceList,
  canCorrectWorkHours,
  getStatusLabel,
  getStatusTagType,
  isDailyAttendanceVisible,
} from '@/services/attendance'
import { getWeekday } from '@/utils'

const props = withDefaults(
  defineProps<{
    embedded?: boolean
    enterpriseId?: string
    initialDate?: string
    initialEmployeeId?: string
  }>(),
  { embedded: false },
)

const store = useAppStore()
const selectedDate = ref(props.initialDate ?? '2026-07-24')
const filterDept = ref('')
const filterEmployeeId = ref(props.initialEmployeeId ?? '')

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

onMounted(() => store.syncExceptions())

const tableData = computed(() => {
  const employees = scopedEmployees.value.filter((e) => {
    if (filterDept.value && e.departmentId !== filterDept.value) return false
    if (filterEmployeeId.value && e.id !== filterEmployeeId.value) return false
    return true
  })
  const daily = buildDailyAttendanceList(
    employees.map((e) => e.id),
    [selectedDate.value],
    store.assignments,
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
      return {
        ...d,
        employeeName: emp?.name ?? '-',
        employeeNo: emp?.employeeNo ?? '-',
        shiftName: shift?.name ?? '-',
        statusLabel: getStatusLabel(d.status),
        tagType: getStatusTagType(d.status),
        canCorrect: canCorrectWorkHours(d.status),
      }
    })
})

const summary = computed(() => {
  const list = tableData.value
  return {
    total: list.length,
    normal: list.filter((d) => d.status === 'normal').length,
    abnormal: list.filter((d) => !['normal', 'leave'].includes(d.status)).length,
    leave: list.filter((d) => d.status === 'leave').length,
  }
})

function openCorrection(row: (typeof tableData.value)[0]) {
  correctionTarget.value = {
    employeeId: row.employeeId,
    employeeName: row.employeeName,
    date: row.date,
    workHours: row.workHours,
    scheduledHours: row.scheduledHours,
  }
  correctionForm.value = {
    workHours: row.workHoursCorrected ? row.workHours : row.scheduledHours,
    note: row.manualNote ?? '',
  }
  correctionVisible.value = true
}

function submitCorrection() {
  if (!correctionTarget.value) return
  if (correctionForm.value.workHours < 0) {
    ElMessage.warning('工时不能为负数')
    return
  }
  store.setWorkHoursCorrection(
    correctionTarget.value.employeeId,
    correctionTarget.value.date,
    correctionForm.value.workHours,
    correctionForm.value.note.trim() || undefined,
  )
  ElMessage.success('工时已矫正')
  correctionVisible.value = false
}
</script>

<template>
  <div :class="{ 'page-card': !props.embedded }">
    <div v-if="!props.embedded" class="page-header">
      <div>
        <h2 class="page-title">日考勤数据</h2>
        <p class="text-muted">
          {{ selectedDate }}（周{{ getWeekday(selectedDate) }}）· 仅展示有排班人员，迟到/缺卡可矫正工时
        </p>
      </div>
    </div>
    <p v-else class="text-muted tab-desc">
      {{ selectedDate }}（周{{ getWeekday(selectedDate) }}）· 仅展示有排班人员，迟到/缺卡可矫正工时
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
    </el-form>

    <el-row :gutter="12" style="margin-bottom: 16px">
      <el-col :span="6"><el-statistic title="应出勤" :value="summary.total" /></el-col>
      <el-col :span="6"><el-statistic title="正常" :value="summary.normal" /></el-col>
      <el-col :span="6"><el-statistic title="异常" :value="summary.abnormal" /></el-col>
      <el-col :span="6"><el-statistic title="请假" :value="summary.leave" /></el-col>
    </el-row>

    <el-table :data="tableData" border stripe>
      <el-table-column prop="employeeNo" label="工号" width="90" />
      <el-table-column prop="employeeName" label="姓名" width="100" />
      <el-table-column prop="shiftName" label="排班" width="90" />
      <el-table-column prop="clockIn" label="上班" width="80">
        <template #default="{ row }">{{ row.clockIn ?? '—' }}</template>
      </el-table-column>
      <el-table-column prop="clockOut" label="下班" width="80">
        <template #default="{ row }">{{ row.clockOut ?? '—' }}</template>
      </el-table-column>
      <el-table-column label="工时(h)" width="110">
        <template #default="{ row }">
          {{ row.workHours }}
          <el-tag v-if="row.workHoursCorrected" size="small" type="info" style="margin-left: 4px">
            已矫正
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="100">
        <template #default="{ row }">
          <el-tag :type="row.tagType" size="small">{{ row.statusLabel }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="备注" min-width="120">
        <template #default="{ row }">
          <span v-if="row.manualNote" class="text-muted">{{ row.manualNote }}</span>
          <span v-else-if="row.manualStatus" class="text-muted">人工修正</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-button v-if="row.canCorrect" link type="primary" @click="openCorrection(row)">
            工时矫正
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>

  <el-dialog v-model="correctionVisible" title="工时矫正" width="420px" destroy-on-close>
    <template v-if="correctionTarget">
      <p class="correction-meta">
        {{ correctionTarget.employeeName }} · {{ correctionTarget.date }} · 排班
        {{ correctionTarget.scheduledHours }}h
      </p>
      <el-form label-width="90px">
        <el-form-item label="矫正工时">
          <el-input-number
            v-model="correctionForm.workHours"
            :min="0"
            :max="24"
            :step="0.5"
            :precision="1"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="备注">
          <el-input v-model="correctionForm.note" type="textarea" :rows="2" placeholder="矫正原因（可选）" />
        </el-form-item>
      </el-form>
    </template>
    <template #footer>
      <el-button @click="correctionVisible = false">取消</el-button>
      <el-button type="primary" @click="submitCorrection">确认矫正</el-button>
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
</style>
