<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useAppStore } from '@/stores/app'
import { buildDailyAttendanceList, getStatusLabel, getStatusTagType } from '@/services/attendance'
import { getWeekday } from '@/utils'

defineProps<{ embedded?: boolean }>()

const store = useAppStore()
const selectedDate = ref('2026-07-24')
const filterDept = ref('')

onMounted(() => store.syncExceptions())

const tableData = computed(() => {
  const employees = store.activeEmployees.filter((e) => {
    if (filterDept.value && e.departmentId !== filterDept.value) return false
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
  return daily.map((d) => {
    const emp = store.employees.find((e) => e.id === d.employeeId)
    const shift = d.shiftId ? store.shifts.find((s) => s.id === d.shiftId) : undefined
    return {
      ...d,
      employeeName: emp?.name ?? '-',
      employeeNo: emp?.employeeNo ?? '-',
      shiftName: shift?.name ?? '-',
      statusLabel: getStatusLabel(d.status),
      tagType: getStatusTagType(d.status),
    }
  })
})

const summary = computed(() => {
  const list = tableData.value
  return {
    normal: list.filter((d) => d.status === 'normal').length,
    abnormal: list.filter((d) => !['normal', 'rest', 'leave'].includes(d.status)).length,
    rest: list.filter((d) => d.status === 'rest').length,
    leave: list.filter((d) => d.status === 'leave').length,
  }
})
</script>

<template>
  <div :class="{ 'page-card': !embedded }">
    <div v-if="!embedded" class="page-header">
      <div>
        <h2 class="page-title">日考勤数据</h2>
        <p class="text-muted">
          {{ selectedDate }}（周{{ getWeekday(selectedDate) }}）· 按日查看出勤与打卡判定
        </p>
      </div>
    </div>
    <p v-else class="text-muted tab-desc">
      {{ selectedDate }}（周{{ getWeekday(selectedDate) }}）· 按日查看出勤与打卡判定
    </p>

    <el-form inline style="margin-bottom: 16px">
        <el-form-item label="日期">
          <el-date-picker v-model="selectedDate" type="date" value-format="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item label="部门">
          <el-select v-model="filterDept" clearable placeholder="全部" style="width: 160px">
            <el-option v-for="d in store.departments" :key="d.id" :label="d.name" :value="d.id" />
          </el-select>
        </el-form-item>
      </el-form>

      <el-row :gutter="12" style="margin-bottom: 16px">
        <el-col :span="6"><el-statistic title="正常" :value="summary.normal" /></el-col>
        <el-col :span="6"><el-statistic title="异常" :value="summary.abnormal" /></el-col>
        <el-col :span="6"><el-statistic title="休息" :value="summary.rest" /></el-col>
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
        <el-table-column prop="workHours" label="工时(h)" width="90" />
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.tagType" size="small">{{ row.statusLabel }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="备注" min-width="120">
          <template #default="{ row }">
            <span v-if="row.manualStatus" class="text-muted">人工修正</span>
          </template>
        </el-table-column>
      </el-table>
  </div>
</template>

<style scoped>
.tab-desc {
  margin: 0 0 16px;
}
</style>
