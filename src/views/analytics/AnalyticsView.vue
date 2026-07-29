<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAppStore } from '@/stores/app'
import {
  buildDailyAttendanceList,
  buildMonthlySummary,
  getMonthDateRange,
} from '@/services/attendance'
import {
  buildDepartmentAnalytics,
  buildMonthlyTrends,
  buildShiftPatternStats,
  formatDepartmentLabel,
  getRecentMonths,
} from '@/services/analytics'
import { buildPayrollPreview } from '@/services/payroll'

const store = useAppStore()
const selectedMonth = ref('2026-07')

const dailyList = computed(() =>
  buildDailyAttendanceList(
    store.activeEmployees.map((e) => e.id),
    getMonthDateRange(selectedMonth.value),
    store.assignments,
    store.shifts,
    store.punches,
    store.leaveRequests,
    store.attendanceRule,
    store.manualOverrides,
  ),
)

const summaries = computed(() =>
  store.activeEmployees.map((emp) =>
    buildMonthlySummary(emp.id, selectedMonth.value, dailyList.value.filter((d) => d.employeeId === emp.id)),
  ),
)

const payrollItems = computed(() =>
  buildPayrollPreview(
    store.activeEmployees,
    summaries.value,
    dailyList.value,
    store.overtimeRequests,
    store.payrollConfig,
    store.teams,
    store.assignments,
    selectedMonth.value,
  ),
)

const deptStats = computed(() =>
  buildDepartmentAnalytics(
    store.departments,
    store.employees,
    dailyList.value,
    payrollItems.value,
    selectedMonth.value,
  ).map((d) => ({
    ...d,
    departmentName: formatDepartmentLabel(store.departments, d.departmentId),
  })),
)

const shiftPatterns = computed(() => buildShiftPatternStats(store.assignments, store.shifts, selectedMonth.value))

const trends = computed(() => {
  const months = getRecentMonths(6, selectedMonth.value)
  return buildMonthlyTrends(months, store.activeEmployees, store.teams, store.assignments, (month) =>
    buildDailyAttendanceList(
      store.activeEmployees.map((e) => e.id),
      getMonthDateRange(month),
      store.assignments,
      store.shifts,
      store.punches,
      store.leaveRequests,
      store.attendanceRule,
      store.manualOverrides,
    ),
  store.payrollConfig,
  )
})

const totalLaborCost = computed(() =>
  Math.round(deptStats.value.reduce((s, d) => s + d.laborCost, 0) * 100) / 100,
)

const maxTrendCost = computed(() => Math.max(...trends.value.map((t) => t.laborCost), 1))
</script>

<template>
  <div>
    <div class="page-card">
      <div class="page-header">
        <div>
          <h2 class="page-title">数据分析</h2>
          <p class="text-muted">部门考勤统计、排班模式与人力成本分析</p>
        </div>
        <el-date-picker v-model="selectedMonth" type="month" value-format="YYYY-MM" :clearable="false" />
      </div>

      <el-row :gutter="16" style="margin-bottom: 20px">
        <el-col :span="8">
          <div class="stat-card blue">
            <div class="stat-value">¥{{ totalLaborCost.toLocaleString() }}</div>
            <div class="stat-label">{{ selectedMonth }} 人力成本</div>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="stat-card green">
            <div class="stat-value">{{ deptStats.length ? Math.round(deptStats.reduce((s, d) => s + d.attendanceRate, 0) / deptStats.length) : 0 }}%</div>
            <div class="stat-label">平均出勤率</div>
          </div>
        </el-col>
        <el-col :span="8">
          <div class="stat-card orange">
            <div class="stat-value">{{ shiftPatterns[0]?.shiftName ?? '—' }}</div>
            <div class="stat-label">主力班次（{{ shiftPatterns[0]?.percentage ?? 0 }}%）</div>
          </div>
        </el-col>
      </el-row>

      <el-row :gutter="16">
        <el-col :span="12">
          <h3 class="section-title">部门考勤统计</h3>
          <el-table :data="deptStats" border stripe size="small">
            <el-table-column prop="departmentName" label="部门" min-width="120" />
            <el-table-column prop="employeeCount" label="人数" width="60" />
            <el-table-column label="出勤率" width="100">
              <template #default="{ row }">{{ row.attendanceRate }}%</template>
            </el-table-column>
            <el-table-column label="迟到率" width="90">
              <template #default="{ row }">{{ row.lateRate }}%</template>
            </el-table-column>
            <el-table-column prop="totalWorkHours" label="工时(h)" width="80" />
            <el-table-column label="人力成本" width="100">
              <template #default="{ row }">¥{{ row.laborCost.toLocaleString() }}</template>
            </el-table-column>
          </el-table>
        </el-col>
        <el-col :span="12">
          <h3 class="section-title">排班模式分析</h3>
          <div v-for="item in shiftPatterns" :key="item.shiftId" class="pattern-bar-row">
            <span class="pattern-label">{{ item.shiftName }}</span>
            <div class="pattern-bar-wrap">
              <div class="pattern-bar" :style="{ width: `${item.percentage}%` }">
                {{ item.count }} 次 · {{ item.percentage }}%
              </div>
            </div>
          </div>
        </el-col>
      </el-row>
    </div>

    <div class="page-card" style="margin-top: 16px">
      <h3 class="section-title">人力成本趋势（近 6 月）</h3>
      <div class="trend-chart">
        <div v-for="t in trends" :key="t.month" class="trend-col">
          <div
            class="trend-bar"
            :style="{ height: `${Math.max(8, (t.laborCost / maxTrendCost) * 120)}px` }"
            :title="`¥${t.laborCost}`"
          />
          <div class="trend-label">{{ t.month.slice(5) }}月</div>
          <div class="trend-value">¥{{ (t.laborCost / 1000).toFixed(1) }}k</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.section-title {
  margin: 0 0 12px;
  font-size: 15px;
}

.pattern-bar-row {
  display: flex;
  align-items: center;
  margin-bottom: 10px;
}

.pattern-label {
  width: 60px;
  font-size: 13px;
}

.pattern-bar-wrap {
  flex: 1;
  height: 24px;
  background: #f5f7fa;
  border-radius: 4px;
  overflow: hidden;
}

.pattern-bar {
  height: 100%;
  background: linear-gradient(90deg, #409eff, #67c23a);
  color: #fff;
  font-size: 11px;
  display: flex;
  align-items: center;
  padding-left: 8px;
  min-width: 80px;
}

.trend-chart {
  display: flex;
  align-items: flex-end;
  gap: 16px;
  height: 160px;
  padding-top: 20px;
}

.trend-col {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.trend-bar {
  width: 36px;
  background: linear-gradient(180deg, #667eea, #764ba2);
  border-radius: 4px 4px 0 0;
  min-height: 8px;
}

.trend-label {
  font-size: 12px;
  color: #909399;
  margin-top: 6px;
}

.trend-value {
  font-size: 11px;
  color: #606266;
}
</style>
