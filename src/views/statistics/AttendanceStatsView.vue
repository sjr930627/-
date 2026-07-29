<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAppStore } from '@/stores/app'
import StatKpiCard from '@/components/statistics/StatKpiCard.vue'
import StatPanel from '@/components/statistics/StatPanel.vue'
import VChart from '@/components/statistics/VChart.vue'
import RankList from '@/components/statistics/RankList.vue'
import {
  buildDailyAttendanceList,
  buildMonthlySummary,
  getMonthDateRange,
} from '@/services/attendance'
import {
  barChartOption,
  donutChartOption,
  lineChartOption,
  trendText,
} from '@/services/statisticsCharts'
import { chartColors } from '@/plugins/echarts'

const store = useAppStore()
const month = ref('2026-07')
const deptFilter = ref('')
const keyword = ref('')

const dailyList = computed(() =>
  buildDailyAttendanceList(
    store.activeEmployees.map((e) => e.id),
    getMonthDateRange(month.value),
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
    buildMonthlySummary(emp.id, month.value, dailyList.value.filter((d) => d.employeeId === emp.id)),
  ),
)

const avgAttendance = computed(() => {
  const rates = summaries.value.filter((s) => s.scheduledDays > 0).map((s) => (s.actualDays / s.scheduledDays) * 100)
  return rates.length ? Math.round(rates.reduce((a, b) => a + b, 0) / rates.length * 10) / 10 : 0
})

const totalLate = computed(() => summaries.value.reduce((s, m) => s + m.lateCount, 0))
const totalAbsent = computed(() => summaries.value.reduce((s, m) => s + m.absentCount, 0))
const totalMissing = computed(() => summaries.value.reduce((s, m) => s + m.missingPunchCount, 0))
const totalAnomaly = computed(() => totalLate.value + totalAbsent.value + totalMissing.value)

const departmentRows = computed(() => {
  const depts = store.departments.filter((d) => d.id !== 'dept_root')
  return depts
    .filter((d) => !deptFilter.value || d.id === deptFilter.value)
    .filter((d) => !keyword.value.trim() || d.name.includes(keyword.value.trim()))
    .map((dept) => {
      const emps = store.activeEmployees.filter((e) => e.departmentId === dept.id)
      const empIds = new Set(emps.map((e) => e.id))
      const records = dailyList.value.filter((d) => empIds.has(d.employeeId))
      const summaries = emps.map((emp) =>
        buildMonthlySummary(emp.id, month.value, records.filter((d) => d.employeeId === emp.id)),
      )
      const scheduled = summaries.reduce((s, m) => s + m.scheduledDays, 0)
      const actual = summaries.reduce((s, m) => s + m.actualDays, 0)
      const late = summaries.reduce((s, m) => s + m.lateCount, 0)
      const early = summaries.reduce((s, m) => s + m.earlyLeaveCount, 0)
      const missing = summaries.reduce((s, m) => s + m.missingPunchCount, 0)
      const absent = summaries.reduce((s, m) => s + m.absentCount, 0)
      const rate = scheduled ? Math.round((actual / scheduled) * 1000) / 10 : 0
      const anomalyRate = scheduled ? Math.round(((late + absent + missing) / scheduled) * 1000) / 10 : 0
      return {
        departmentName: dept.name,
        scheduled,
        actual,
        rate,
        late,
        early,
        missing,
        absent,
        anomalyRate,
        momChange: ((dept.id.charCodeAt(dept.id.length - 1) % 5) - 2).toFixed(1),
      }
    })
})

const trendOption = computed(() => {
  const dates = getMonthDateRange(month.value).slice(-30)
  const labels = dates.map((d) => d.slice(5))
  const attendance: number[] = []
  const lateRate: number[] = []
  const absentRate: number[] = []
  for (const date of dates) {
    const dayRecords = dailyList.value.filter((d) => d.date === date && d.scheduledHours > 0)
    if (!dayRecords.length) {
      attendance.push(0)
      lateRate.push(0)
      absentRate.push(0)
      continue
    }
    const ok = dayRecords.filter((d) => d.status === 'normal' || d.status === 'late').length
    attendance.push(Math.round((ok / dayRecords.length) * 1000) / 10)
    lateRate.push(Math.round((dayRecords.filter((d) => d.status === 'late').length / dayRecords.length) * 1000) / 10)
    absentRate.push(Math.round((dayRecords.filter((d) => d.status === 'absent').length / dayRecords.length) * 1000) / 10)
  }
  return lineChartOption(labels, [
    { name: '出勤率', data: attendance, color: chartColors.green },
    { name: '迟到率', data: lateRate, color: chartColors.orange, dashed: true },
    { name: '缺勤率', data: absentRate, color: chartColors.red, dashed: true },
  ])
})

const anomalyDonutOption = computed(() =>
  donutChartOption(
    [
      { name: '迟到', value: totalLate.value, color: chartColors.orange },
      { name: '缺勤', value: totalAbsent.value, color: chartColors.red },
      { name: '缺卡', value: totalMissing.value, color: chartColors.blue },
      { name: '早退', value: summaries.value.reduce((s, m) => s + m.earlyLeaveCount, 0), color: chartColors.purple },
    ],
    `${totalAnomaly.value}\n异常总数`,
  ),
)

const punchTimeOption = computed(() => {
  const hours = ['6:00', '7:00', '8:00', '9:00', '10:00', '17:00', '18:00', '19:00', '20:00']
  const clockIn = [120, 680, 2450, 890, 210, 0, 0, 0, 0]
  const clockOut = [0, 0, 0, 0, 0, 320, 1580, 920, 180]
  return barChartOption(hours, [
    { name: '上班打卡', data: clockIn, color: chartColors.blue },
    { name: '下班打卡', data: clockOut, color: chartColors.purple },
  ])
})

const punchMethodOption = computed(() =>
  barChartOption(
    ['GPS定位', 'WiFi打卡', '人脸识别', '蓝牙信标', '手动补卡'],
    [{
      name: '占比',
      data: [42, 28, 18, 8, 4],
      color: [chartColors.purple, chartColors.blue, chartColors.green, chartColors.orange, chartColors.pink],
    }],
  ),
)

const abnormalRank = computed(() =>
  [...departmentRows.value]
    .sort((a, b) => b.anomalyRate - a.anomalyRate)
    .slice(0, 5)
    .map((d, i) => ({
      name: d.departmentName,
      value: d.anomalyRate,
      percent: Math.min(100, d.anomalyRate * 12),
      color: [chartColors.red, chartColors.orange, chartColors.orange, chartColors.blue, chartColors.purple][i],
    })),
)

const weekCompare = computed(() => [
  { label: '第1周', rate: 95.2 },
  { label: '第2周', rate: 96.8 },
  { label: '第3周', rate: 97.1 },
  { label: '第4周', rate: avgAttendance.value },
])

const lastUpdated = computed(() => new Date().toLocaleString('zh-CN'))
</script>

<template>
  <div class="stats-page">
    <div class="stats-header">
      <div>
        <h2 class="page-title">考勤数据报表</h2>
        <p class="text-muted">
          <el-icon style="vertical-align: -2px"><Refresh /></el-icon>
          最后更新：{{ lastUpdated }}
        </p>
      </div>
      <el-date-picker v-model="month" type="month" value-format="YYYY-MM" style="width: 140px" />
    </div>

    <el-row :gutter="16" class="kpi-row">
      <el-col :xs="24" :sm="12" :md="8" :lg="4">
        <StatKpiCard label="本月出勤率" :value="avgAttendance" suffix="%" icon="Calendar" color="green" :trend="trendText(1.2)" :trend-up="true" />
      </el-col>
      <el-col :xs="24" :sm="12" :md="8" :lg="4">
        <StatKpiCard label="迟到次数" :value="totalLate" suffix="次" icon="AlarmClock" color="orange" trend="-5.3% 较上月" :trend-up="false" />
      </el-col>
      <el-col :xs="24" :sm="12" :md="8" :lg="4">
        <StatKpiCard label="缺勤次数" :value="totalAbsent" suffix="次" icon="CircleClose" color="red" trend="+2.1% 较上月" :trend-up="true" />
      </el-col>
      <el-col :xs="24" :sm="12" :md="8" :lg="4">
        <StatKpiCard label="缺卡次数" :value="totalMissing" suffix="次" icon="DocumentDelete" color="blue" trend="-8.6% 较上月" :trend-up="false" />
      </el-col>
      <el-col :xs="24" :sm="12" :md="8" :lg="4">
        <StatKpiCard label="异常总数" :value="totalAnomaly" suffix="次" icon="Warning" color="purple" trend="-3.2% 较上月" :trend-up="false" />
      </el-col>
    </el-row>

    <el-row :gutter="16" class="chart-row">
      <el-col :xs="24" :lg="14">
        <StatPanel title="考勤趋势" subtitle="近30天">
          <VChart :option="trendOption" height="300px" />
        </StatPanel>
      </el-col>
      <el-col :xs="24" :lg="10">
        <StatPanel title="异常类型分布">
          <VChart :option="anomalyDonutOption" height="300px" />
        </StatPanel>
      </el-col>
    </el-row>

    <el-row :gutter="16" class="chart-row">
      <el-col :xs="24" :lg="14">
        <StatPanel title="打卡时间段分布">
          <VChart :option="punchTimeOption" height="280px" />
        </StatPanel>
      </el-col>
      <el-col :xs="24" :lg="10">
        <StatPanel title="异常考勤部门排行">
          <template #extra><el-button link type="primary">查看全部</el-button></template>
          <RankList :items="abnormalRank" />
        </StatPanel>
      </el-col>
    </el-row>

    <el-row :gutter="16" class="chart-row">
      <el-col :xs="24" :lg="12">
        <StatPanel title="打卡方式分布">
          <VChart :option="punchMethodOption" height="260px" />
        </StatPanel>
      </el-col>
      <el-col :xs="24" :lg="12">
        <StatPanel title="近4周考勤对比">
          <div class="week-compare">
            <div v-for="w in weekCompare" :key="w.label" class="week-item">
              <span class="week-label">{{ w.label }}</span>
              <el-progress :percentage="w.rate" :stroke-width="12" :color="chartColors.green" />
              <span class="week-value">{{ w.rate }}%</span>
            </div>
          </div>
          <div class="week-avg">平均出勤率 <strong>{{ avgAttendance }}%</strong></div>
        </StatPanel>
      </el-col>
    </el-row>

    <StatPanel title="各部门考勤明细">
      <template #extra>
        <div class="table-toolbar">
          <el-select v-model="deptFilter" clearable placeholder="全部部门" style="width: 140px">
            <el-option v-for="d in store.departments.filter((dep) => dep.id !== 'dept_root')" :key="d.id" :label="d.name" :value="d.id" />
          </el-select>
          <el-input v-model="keyword" placeholder="搜索部门名称" clearable prefix-icon="Search" style="width: 180px" />
        </div>
      </template>
      <el-table :data="departmentRows" border stripe>
        <el-table-column prop="departmentName" label="部门名称" min-width="120" fixed />
        <el-table-column prop="scheduled" label="应出勤" width="80" align="center" />
        <el-table-column prop="actual" label="实际出勤" width="90" align="center" />
        <el-table-column label="出勤率" width="90" align="center">
          <template #default="{ row }"><span class="text-success">{{ row.rate }}%</span></template>
        </el-table-column>
        <el-table-column prop="late" label="迟到" width="70" align="center" />
        <el-table-column prop="early" label="早退" width="70" align="center" />
        <el-table-column prop="missing" label="缺卡" width="70" align="center" />
        <el-table-column label="异常率" width="90" align="center">
          <template #default="{ row }">
            <span :class="row.anomalyRate > 5 ? 'text-danger' : 'text-success'">{{ row.anomalyRate }}%</span>
          </template>
        </el-table-column>
        <el-table-column label="环比" width="90" align="center">
          <template #default="{ row }">
            <span :class="Number(row.momChange) >= 0 ? 'text-danger' : 'text-success'">
              {{ Number(row.momChange) >= 0 ? '↑' : '↓' }}{{ Math.abs(Number(row.momChange)) }}%
            </span>
          </template>
        </el-table-column>
      </el-table>
    </StatPanel>
  </div>
</template>

<style scoped>
.stats-page { display: flex; flex-direction: column; gap: 16px; }
.stats-header {
  display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px;
  background: #fff; border-radius: 12px; padding: 20px 24px; border: 1px solid var(--app-border);
}
.kpi-row .el-col, .chart-row .el-col { margin-bottom: 16px; }
.table-toolbar { display: flex; gap: 10px; }
.text-success { color: #52c41a; font-weight: 500; }
.text-danger { color: #f5222d; font-weight: 500; }
.week-compare { display: flex; flex-direction: column; gap: 16px; padding: 8px 0; }
.week-item { display: flex; align-items: center; gap: 12px; }
.week-label { width: 48px; font-size: 13px; color: #606266; flex-shrink: 0; }
.week-item .el-progress { flex: 1; }
.week-value { width: 48px; text-align: right; font-size: 13px; font-weight: 600; }
.week-avg { margin-top: 20px; padding-top: 16px; border-top: 1px dashed var(--app-border); font-size: 13px; color: #909399; }
.week-avg strong { color: #52c41a; font-size: 18px; margin-left: 8px; }
</style>
