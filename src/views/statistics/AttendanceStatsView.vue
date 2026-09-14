<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { usePortal } from '@/composables/usePortal'
import StatKpiCard from '@/components/statistics/StatKpiCard.vue'
import StatPanel from '@/components/statistics/StatPanel.vue'
import VChart from '@/components/statistics/VChart.vue'
import {
  buildDailyAttendanceList,
  buildMonthlySummary,
  getMonthDateRange,
} from '@/services/attendance'
import { donutChartOption, valueLineChartOption } from '@/services/statisticsCharts'
import { chartColors } from '@/plugins/echarts'
import { resolveEnterpriseIdByDepartment, resolveEnterpriseIdByEmployee } from '@/utils/enterpriseScope'
import DepartmentLeafCascader from '@/components/employee/DepartmentLeafCascader.vue'
import type { ExceptionType } from '@/types'

const store = useAppStore()
const router = useRouter()
const { pathPrefix, isEnterprise } = usePortal()

const month = ref('2026-07')
const deptFilter = ref('')
const groupFilter = ref('')
const exceptionTypes = ref<ExceptionType[]>([])

const scopedEmployees = computed(() => {
  let list = store.activeEmployees
  if (isEnterprise.value && store.currentEnterpriseId) {
    list = list.filter((e) => resolveEnterpriseIdByEmployee(e) === store.currentEnterpriseId)
  }
  if (deptFilter.value) list = list.filter((e) => e.departmentId === deptFilter.value)
  return list
})

const dailyList = computed(() =>
  buildDailyAttendanceList(
    scopedEmployees.value.map((e) => e.id),
    getMonthDateRange(month.value),
    store.assignments,
    store.shifts,
    store.punches,
    store.leaveRequests,
    store.attendanceRule,
    store.manualOverrides,
  ),
)

const scheduledDaily = computed(() =>
  dailyList.value.filter((d) => d.scheduledHours > 0 || d.status === 'leave'),
)

const summaries = computed(() =>
  scopedEmployees.value.map((emp) =>
    buildMonthlySummary(emp.id, month.value, dailyList.value.filter((d) => d.employeeId === emp.id)),
  ),
)

const shouldAttend = computed(() =>
  summaries.value.reduce((s, m) => s + m.scheduledDays, 0),
)
const actualAttend = computed(() =>
  summaries.value.reduce((s, m) => s + m.actualDays, 0),
)
const leaveDays = computed(() => summaries.value.reduce((s, m) => s + m.leaveDays, 0))
const absent = computed(() =>
  Math.max(0, shouldAttend.value - actualAttend.value - leaveDays.value),
)
const lateCount = computed(() => summaries.value.reduce((s, m) => s + m.lateCount, 0))
const earlyCount = computed(() => summaries.value.reduce((s, m) => s + m.earlyLeaveCount, 0))
const lateEarly = computed(() => lateCount.value + earlyCount.value)
const makeupCount = computed(() =>
  store.makeupRequests.filter((r) => r.date.startsWith(month.value)).length,
)

const scopedExceptions = computed(() => {
  const empIds = new Set(scopedEmployees.value.map((e) => e.id))
  return store.exceptions.filter((e) => {
    if (!e.date.startsWith(month.value) || !empIds.has(e.employeeId)) return false
    if (exceptionTypes.value.length && !exceptionTypes.value.includes(e.type)) return false
    return true
  })
})

const swapDays = computed(() =>
  store.swapRequests.filter(
    (r) =>
      r.status === 'approved' &&
      r.date.startsWith(month.value) &&
      scopedEmployees.value.some(
        (e) => e.id === r.applicantId || e.id === r.targetEmployeeId,
      ),
  ).length,
)

const resultComposition = computed(() => {
  const normal = scheduledDaily.value.filter((d) => d.status === 'normal').length
  const absentN = scheduledDaily.value.filter((d) => d.status === 'absent').length
  const lateEarlyN = scheduledDaily.value.filter(
    (d) => d.status === 'late' || d.status === 'early_leave',
  ).length
  const leaveN = scheduledDaily.value.filter((d) => d.status === 'leave').length + swapDays.value
  const otherN = scheduledDaily.value.filter(
    (d) => d.status === 'missing_punch' || d.status === 'rest',
  ).length
  const total = Math.max(1, normal + absentN + lateEarlyN + leaveN + otherN)
  return {
    total: normal + absentN + lateEarlyN + leaveN + otherN,
    items: [
      { name: '正常出勤', value: normal, color: chartColors.green, pct: Math.round((normal / total) * 1000) / 10 },
      { name: '缺勤', value: absentN, color: chartColors.red, pct: Math.round((absentN / total) * 1000) / 10 },
      { name: '迟到/早退', value: lateEarlyN, color: chartColors.orange, pct: Math.round((lateEarlyN / total) * 1000) / 10 },
      { name: '请假换班', value: leaveN, color: chartColors.purple, pct: Math.round((leaveN / total) * 1000) / 10 },
      { name: '其他', value: otherN, color: '#c0c4cc', pct: Math.round((otherN / total) * 1000) / 10 },
    ],
  }
})

const resultDonutOption = computed(() =>
  donutChartOption(
    resultComposition.value.items.filter((i) => i.value > 0),
    `${resultComposition.value.total.toLocaleString()}\n总人次`,
  ),
)

const totalWorkHours = computed(() =>
  Math.round(summaries.value.reduce((s, m) => s + m.totalWorkHours, 0) * 10) / 10,
)
const overtimeHours = computed(() =>
  Math.round(summaries.value.reduce((s, m) => s + m.overtimeHours, 0) * 10) / 10,
)
const validWorkHours = computed(() =>
  Math.max(0, Math.round((totalWorkHours.value - overtimeHours.value * 0.2) * 10) / 10),
)

const hoursTrendOption = computed(() => {
  const dates = getMonthDateRange(month.value)
  const labels = dates.map((d) => d.slice(5))
  const total: number[] = []
  const overtime: number[] = []
  for (const date of dates) {
    const days = dailyList.value.filter((d) => d.date === date)
    total.push(Math.round(days.reduce((s, d) => s + d.workHours, 0) * 10) / 10)
    overtime.push(
      Math.round(days.reduce((s, d) => s + Math.max(0, d.workHours - d.scheduledHours), 0) * 10) / 10,
    )
  }
  return valueLineChartOption(
    labels,
    [
      { name: '总工时', data: total, color: chartColors.blue },
      { name: '加班工时', data: overtime, color: chartColors.orange, dashed: true },
    ],
    'h',
  )
})

const keyword = ref('')
const page = ref(1)
const pageSize = 10

const detailRows = computed(() => {
  type Agg = {
    id: string
    name: string
    scheduled: number
    actual: number
    absent: number
    late: number
    early: number
    exception: number
  }
  const map = new Map<string, Agg>()

  for (const m of summaries.value) {
    const emp = store.employees.find((e) => e.id === m.employeeId)
    if (!emp) continue
    let id: string
    let name: string
    if (isEnterprise.value) {
      id = emp.departmentId
      name = store.departments.find((d) => d.id === id)?.name ?? '未分配部门'
    } else {
      id =
        emp.enterpriseId ||
        resolveEnterpriseIdByDepartment(emp.departmentId, store.departments)
      name = store.enterprises.find((e) => e.id === id)?.name ?? id
    }
    const row = map.get(id) ?? {
      id,
      name,
      scheduled: 0,
      actual: 0,
      absent: 0,
      late: 0,
      early: 0,
      exception: 0,
    }
    row.scheduled += m.scheduledDays
    row.actual += m.actualDays
    row.absent += m.absentCount
    row.late += m.lateCount
    row.early += m.earlyLeaveCount
    map.set(id, row)
  }

  for (const ex of scopedExceptions.value) {
    const emp = store.employees.find((e) => e.id === ex.employeeId)
    if (!emp) continue
    const id = isEnterprise.value
      ? emp.departmentId
      : emp.enterpriseId ||
        resolveEnterpriseIdByDepartment(emp.departmentId, store.departments)
    const row = map.get(id)
    if (row) row.exception += 1
  }

  return [...map.values()]
    .map((r) => ({
      ...r,
      rate: r.scheduled ? Math.round((r.actual / r.scheduled) * 1000) / 10 : 0,
    }))
    .sort((a, b) => b.scheduled - a.scheduled)
})

const filteredDetailRows = computed(() => {
  const kw = keyword.value.trim()
  if (!kw) return detailRows.value
  return detailRows.value.filter((r) => r.name.includes(kw))
})

const pagedDetailRows = computed(() => {
  const start = (page.value - 1) * pageSize
  return filteredDetailRows.value.slice(start, start + pageSize)
})

const detailTitle = computed(() => (isEnterprise.value ? '部门考勤统计' : '考勤统计明细'))
const detailUnitLabel = computed(() => (isEnterprise.value ? '部门' : '用工企业'))
const searchPlaceholder = computed(() =>
  isEnterprise.value ? '搜索部门' : '搜索企业',
)
const detailFooterText = computed(() =>
  isEnterprise.value
    ? `共 ${filteredDetailRows.value.length} 个部门数据`
    : `共 ${filteredDetailRows.value.length} 家企业数据`,
)

const iconColors = [chartColors.blue, chartColors.cyan, chartColors.purple, chartColors.orange, chartColors.green]

const deptOptions = computed(() =>
  store.departments
    .filter((d) => d.id !== 'dept_root')
    .filter((d) =>
      !isEnterprise.value || !store.currentEnterpriseId
        ? true
        : d.enterpriseId === store.currentEnterpriseId,
    ),
)

const groupOptions = computed(() => store.attendanceGroups ?? [])

function onExport() {
  ElMessage.success(`已导出 ${filteredDetailRows.value.length} 条考勤统计（演示）`)
}

function drillAnomaly() {
  router.push(`${pathPrefix.value}/attendance-exceptions`)
}

function drillMakeup() {
  router.push(`${pathPrefix.value}/approvals`)
}

function viewDetail(row: { id: string; name: string }) {
  if (isEnterprise.value) {
    deptFilter.value = row.id
    ElMessage.info(`已筛选部门：${row.name}`)
    return
  }
  router.push({
    path: `${pathPrefix.value}/attendance-exceptions`,
    query: { enterpriseId: row.id },
  })
}
</script>

<template>
  <div class="stats-page">
    <div class="stats-header">
      <div>
        <h2 class="page-title">考勤分析</h2>
        <p class="text-muted">应出勤 / 考勤结果构成 / 工时监控</p>
      </div>
      <div class="header-actions">
        <el-date-picker v-model="month" type="month" value-format="YYYY-MM" style="width: 140px" />
        <el-button type="primary" @click="onExport">导出</el-button>
      </div>
    </div>

    <StatPanel title="筛选条件">
      <div class="filters">
        <div class="filter-dept">
          <DepartmentLeafCascader
            v-model="deptFilter"
            :departments="deptOptions"
            :exclude-system="false"
            clearable
            placeholder="部门"
          />
        </div>
        <el-select v-model="groupFilter" clearable placeholder="考勤组" style="width: 180px">
          <el-option v-for="g in groupOptions" :key="g.id" :label="g.name" :value="g.id" />
        </el-select>
        <el-select
          v-model="exceptionTypes"
          multiple
          collapse-tags
          clearable
          placeholder="异常类型"
          style="width: 240px"
        >
          <el-option label="GPS偏移" value="location" />
          <el-option label="迟到" value="late" />
          <el-option label="早退" value="early_leave" />
          <el-option label="缺勤" value="absent" />
          <el-option label="缺卡" value="missing_punch" />
        </el-select>
      </div>
    </StatPanel>

    <el-row :gutter="16" class="kpi-row">
      <el-col :xs="12" :sm="8" :md="6" :lg="4">
        <StatKpiCard label="应出勤" :value="shouldAttend" suffix="人次" icon="Calendar" color="blue" sub-text="已确认班次人次" />
      </el-col>
      <el-col :xs="12" :sm="8" :md="6" :lg="4">
        <StatKpiCard label="实际出勤" :value="actualAttend" suffix="人次" icon="CircleCheck" color="green" />
      </el-col>
      <el-col :xs="12" :sm="8" :md="6" :lg="4">
        <StatKpiCard label="缺勤" :value="absent" suffix="人次" icon="CircleClose" color="red" />
      </el-col>
      <el-col :xs="12" :sm="8" :md="6" :lg="4">
        <StatKpiCard
          label="迟到早退"
          :value="lateEarly"
          suffix="人次"
          icon="AlarmClock"
          color="orange"
          :sub-text="`含早退 ${earlyCount}`"
          clickable
          @click="drillAnomaly"
        />
      </el-col>
      <el-col :xs="12" :sm="8" :md="6" :lg="4">
        <StatKpiCard label="补卡" :value="makeupCount" icon="Edit" color="purple" clickable @click="drillMakeup" />
      </el-col>
      <el-col :xs="12" :sm="8" :md="6" :lg="4">
        <StatKpiCard
          label="异常打卡"
          :value="scopedExceptions.length"
          icon="Warning"
          color="cyan"
          clickable
          @click="drillAnomaly"
        />
      </el-col>
      <el-col :xs="12" :sm="8" :md="6" :lg="4">
        <StatKpiCard label="总工时" :value="totalWorkHours" suffix="h" icon="Timer" color="blue" />
      </el-col>
      <el-col :xs="12" :sm="8" :md="6" :lg="4">
        <StatKpiCard label="有效工时" :value="validWorkHours" suffix="h" icon="Finished" color="green" />
      </el-col>
      <el-col :xs="12" :sm="8" :md="6" :lg="4">
        <StatKpiCard label="加班工时" :value="overtimeHours" suffix="h" icon="Sunrise" color="orange" />
      </el-col>
    </el-row>

    <el-row :gutter="16" class="chart-row">
      <el-col :xs="24" :lg="10">
        <StatPanel title="考勤结果构成">
          <VChart :option="resultDonutOption" height="280px" />
          <div class="result-legend">
            <span v-for="item in resultComposition.items" :key="item.name" class="legend-item">
              <i :style="{ background: item.color }" />
              {{ item.name }} {{ item.pct }}%
            </span>
          </div>
        </StatPanel>
      </el-col>
      <el-col :xs="24" :lg="14">
        <StatPanel title="工时监控">
          <VChart :option="hoursTrendOption" height="280px" />
        </StatPanel>
      </el-col>
    </el-row>

    <StatPanel :title="detailTitle">
      <template #extra>
        <el-input
          v-model="keyword"
          :placeholder="searchPlaceholder"
          clearable
          prefix-icon="Search"
          style="width: 220px"
          @input="page = 1"
        />
      </template>
      <el-table :data="pagedDetailRows" border stripe>
        <el-table-column :label="detailUnitLabel" min-width="180">
          <template #default="{ row, $index }">
            <div class="name-cell">
              <span
                class="name-icon"
                :style="{ background: iconColors[$index % iconColors.length] }"
              >
                <el-icon><OfficeBuilding /></el-icon>
              </span>
              <span>{{ row.name }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="scheduled" label="应出勤人次" width="110" align="right" />
        <el-table-column prop="actual" label="出勤人次" width="100" align="right" />
        <el-table-column label="出勤率" width="90" align="right">
          <template #default="{ row }">
            <span class="c-green">{{ row.rate }}%</span>
          </template>
        </el-table-column>
        <el-table-column label="缺勤" width="80" align="right">
          <template #default="{ row }">
            <span class="c-red">{{ row.absent }}</span>
          </template>
        </el-table-column>
        <el-table-column label="迟到" width="80" align="right">
          <template #default="{ row }">
            <span class="c-orange">{{ row.late }}</span>
          </template>
        </el-table-column>
        <el-table-column label="早退" width="80" align="right">
          <template #default="{ row }">
            <span class="c-orange">{{ row.early }}</span>
          </template>
        </el-table-column>
        <el-table-column label="异常打卡" width="90" align="right">
          <template #default="{ row }">
            <span class="c-purple">{{ row.exception }}</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="viewDetail(row)">查看明细</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="table-footer">
        <span class="text-muted">{{ detailFooterText }}</span>
        <el-pagination
          v-model:current-page="page"
          :page-size="pageSize"
          layout="prev, pager, next"
          :total="filteredDetailRows.length"
          background
        />
      </div>
    </StatPanel>
  </div>
</template>

<style scoped>
.stats-page { display: flex; flex-direction: column; gap: 16px; }
.stats-header {
  display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 12px;
  background: #fff; border-radius: 12px; padding: 20px 24px; border: 1px solid var(--app-border);
}
.header-actions, .filters { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
.filter-dept { width: 220px; }
.kpi-row .el-col, .chart-row .el-col { margin-bottom: 16px; }
.result-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px 16px;
  justify-content: center;
  margin-top: 4px;
  font-size: 12px;
  color: #606266;
}
.legend-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.legend-item i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  display: inline-block;
}
.name-cell {
  display: flex;
  align-items: center;
  gap: 10px;
}
.name-icon {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 14px;
  flex-shrink: 0;
}
.c-green { color: #52c41a; font-weight: 600; }
.c-red { color: #f5222d; font-weight: 600; }
.c-orange { color: #fa8c16; font-weight: 600; }
.c-purple { color: #9270ca; font-weight: 600; }
.table-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
