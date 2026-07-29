<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAppStore } from '@/stores/app'
import { buildDailyAttendanceList, buildMonthlySummary, getMonthDateRange } from '@/services/attendance'
import { getDepartmentName } from '@/utils'

const store = useAppStore()
const selectedMonth = ref('2026-07')
const filterDept = ref('')

const tableData = computed(() => {
  const employees = store.activeEmployees.filter((e) => {
    if (filterDept.value && e.departmentId !== filterDept.value) return false
    return true
  })
  const daily = buildDailyAttendanceList(
    employees.map((e) => e.id),
    getMonthDateRange(selectedMonth.value),
    store.assignments,
    store.shifts,
    store.punches,
    store.leaveRequests,
    store.attendanceRule,
    store.manualOverrides,
  )

  return employees.map((emp) => {
    const empDaily = daily.filter((d) => d.employeeId === emp.id)
    const summary = buildMonthlySummary(emp.id, selectedMonth.value, empDaily)
    return {
      ...summary,
      name: emp.name,
      employeeNo: emp.employeeNo,
      departmentName: getDepartmentName(store.departments, emp.departmentId),
    }
  })
})

const totals = computed(() => ({
  scheduled: tableData.value.reduce((s, r) => s + r.scheduledDays, 0),
  actual: tableData.value.reduce((s, r) => s + r.actualDays, 0),
  late: tableData.value.reduce((s, r) => s + r.lateCount, 0),
  absent: tableData.value.reduce((s, r) => s + r.absentCount, 0),
  hours: Math.round(tableData.value.reduce((s, r) => s + r.totalWorkHours, 0) * 10) / 10,
}))
</script>

<template>
  <div class="page-card">
    <div class="page-header">
      <div>
        <h2 class="page-title">月度考勤报表</h2>
        <p class="text-muted">应出勤、实际出勤、迟到、请假、加班等汇总</p>
      </div>
    </div>

    <el-form inline style="margin-bottom: 16px">
      <el-form-item label="月份">
        <el-date-picker v-model="selectedMonth" type="month" value-format="YYYY-MM" :clearable="false" />
      </el-form-item>
      <el-form-item label="部门">
        <el-select v-model="filterDept" clearable placeholder="全部" style="width: 160px">
          <el-option v-for="d in store.departments" :key="d.id" :label="d.name" :value="d.id" />
        </el-select>
      </el-form-item>
    </el-form>

    <el-row :gutter="12" style="margin-bottom: 16px">
      <el-col :span="5"><el-statistic title="应出勤人次" :value="totals.scheduled" /></el-col>
      <el-col :span="5"><el-statistic title="实际出勤" :value="totals.actual" /></el-col>
      <el-col :span="4"><el-statistic title="迟到" :value="totals.late" /></el-col>
      <el-col :span="4"><el-statistic title="旷工" :value="totals.absent" /></el-col>
      <el-col :span="6"><el-statistic title="总工时(h)" :value="totals.hours" /></el-col>
    </el-row>

    <el-table :data="tableData" border stripe show-summary>
      <el-table-column prop="employeeNo" label="工号" width="90" fixed />
      <el-table-column prop="name" label="姓名" width="100" fixed />
      <el-table-column prop="departmentName" label="部门" min-width="120" />
      <el-table-column prop="scheduledDays" label="应出勤" width="90" />
      <el-table-column prop="actualDays" label="实际出勤" width="90" />
      <el-table-column prop="lateCount" label="迟到" width="70" />
      <el-table-column prop="earlyLeaveCount" label="早退" width="70" />
      <el-table-column prop="missingPunchCount" label="缺卡" width="70" />
      <el-table-column prop="absentCount" label="旷工" width="70" />
      <el-table-column prop="leaveDays" label="请假" width="70" />
      <el-table-column prop="overtimeHours" label="加班(h)" width="90" />
      <el-table-column prop="totalWorkHours" label="总工时(h)" width="100" />
    </el-table>
  </div>
</template>
