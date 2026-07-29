<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAppStore } from '@/stores/app'
import StatKpiCard from '@/components/statistics/StatKpiCard.vue'
import StatPanel from '@/components/statistics/StatPanel.vue'
import VChart from '@/components/statistics/VChart.vue'
import { recruitmentLeadStatusMap } from '@/constants/recruitment'
import { barChartOption, comboChartOption } from '@/services/statisticsCharts'
import { chartColors } from '@/plugins/echarts'
import type { RecruitmentLeadStatus } from '@/types'

const store = useAppStore()
const deptFilter = ref('')
const keyword = ref('')

const totalEmployees = computed(() => store.employees.length + store.talents.length)
const newThisMonth = computed(() =>
  store.recruitmentLeads.filter((l) => l.createdAt.startsWith('2026-07')).length,
)
const churnThisMonth = computed(() =>
  store.recruitmentLeads.filter((l) => l.status === 'closed' && l.updatedAt.startsWith('2026-07')).length,
)
const activeRate = computed(() =>
  store.employees.length
    ? Math.round((store.activeEmployees.length / store.employees.length) * 1000) / 10
    : 0,
)

const personnelTrendOption = computed(() => {
  const months = ['2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月']
  const newHires = [180, 220, 195, 260, 240, 285, 310, 275, 290, 320, 350]
  const churn = [45, 52, 48, 62, 55, 68, 72, 58, 65, 70, 75]
  const net = newHires.map((n, i) => n - churn[i])
  return comboChartOption(
    months,
    [
      { name: '新增', data: newHires, color: chartColors.green },
      { name: '流失', data: churn, color: chartColors.red },
    ],
    { name: '净增', data: net, color: chartColors.blue },
  )
})

const cityData = computed(() => {
  const cities = ['上海', '北京', '广州', '深圳', '杭州', '成都', '武汉', '西安', '南京', '重庆']
  const counts = cities.map((_, i) => 1200 - i * 95 + (store.talents.length % 20))
  return barChartOption(cities.reverse(), [{ name: '人数', data: counts.reverse(), color: chartColors.blue }], true)
})

const ageOption = computed(() =>
  barChartOption(
    ['18-25', '26-35', '36-45', '46-55', '55+'],
    [{ name: '人数', data: [2100, 4800, 3200, 1800, 946], color: chartColors.purple }],
  ),
)

const performanceOption = computed(() =>
  barChartOption(
    ['D', 'C', 'B', 'A', 'S'],
    [{
      name: '人数',
      data: [420, 1850, 4200, 3800, 1576],
      color: [chartColors.red, chartColors.orange, chartColors.blue, chartColors.green, chartColors.purple],
    }],
  ),
)

const qualityIndicators = [
  { label: '平均任务完成率', value: 87.3, color: chartColors.blue },
  { label: '平均响应速度', value: 92.1, color: chartColors.green },
  { label: '客户满意度', value: 94.5, color: chartColors.orange },
  { label: '培训完成率', value: 88.6, color: chartColors.purple },
  { label: '合规率', value: 96.2, color: chartColors.cyan },
]

const departmentRows = computed(() => {
  const depts = store.departments.filter((d) => d.id !== 'dept_root')
  return depts
    .filter((d) => !deptFilter.value || d.id === deptFilter.value)
    .filter((d) => !keyword.value.trim() || d.name.includes(keyword.value.trim()))
    .map((dept) => {
      const emps = store.employees.filter((e) => e.departmentId === dept.id)
      const active = emps.filter((e) => e.status === 'active').length
      const seed = dept.id.charCodeAt(dept.id.length - 1)
      return {
        departmentName: dept.name,
        total: emps.length,
        fullTime: Math.round(emps.length * 0.6),
        partTime: Math.round(emps.length * 0.25),
        project: emps.length - Math.round(emps.length * 0.85),
        newCount: seed % 8 + 2,
        churnCount: seed % 4,
        activeRate: emps.length ? Math.round((active / emps.length) * 100) : 0,
        performance: (3.5 + (seed % 15) / 10).toFixed(1),
      }
    })
})

const statusRows = computed(() => {
  const counts = {} as Record<RecruitmentLeadStatus, number>
  for (const lead of store.recruitmentLeads) {
    counts[lead.status] = (counts[lead.status] ?? 0) + 1
  }
  return (Object.keys(recruitmentLeadStatusMap) as RecruitmentLeadStatus[]).map((status) => ({
    statusLabel: recruitmentLeadStatusMap[status],
    count: counts[status] ?? 0,
  }))
})
</script>

<template>
  <div class="stats-page">
    <div class="stats-header">
      <div>
        <h2 class="page-title">人员数据报表</h2>
        <p class="text-muted">招聘统计 · 人员增减与质量分析</p>
      </div>
      <el-button type="primary">刷新数据</el-button>
    </div>

    <el-row :gutter="16" class="kpi-row">
      <el-col :xs="24" :sm="12" :md="8" :lg="4">
        <StatKpiCard label="灵工总数" :value="totalEmployees.toLocaleString()" icon="User" color="blue" trend="+8.2% 较上月" :trend-up="true" />
      </el-col>
      <el-col :xs="24" :sm="12" :md="8" :lg="4">
        <StatKpiCard label="本月新增" :value="newThisMonth" suffix="人" icon="Plus" color="green" trend="+15.3% 较上月" :trend-up="true" />
      </el-col>
      <el-col :xs="24" :sm="12" :md="8" :lg="4">
        <StatKpiCard label="本月流失" :value="churnThisMonth" suffix="人" icon="Minus" color="red" trend="-5.1% 较上月" :trend-up="false" />
      </el-col>
      <el-col :xs="24" :sm="12" :md="8" :lg="4">
        <StatKpiCard label="月活跃率" :value="activeRate" suffix="%" icon="TrendCharts" color="orange" trend="+2.8% 较上月" :trend-up="true" />
      </el-col>
      <el-col :xs="24" :sm="12" :md="8" :lg="4">
        <StatKpiCard label="30天留存率" value="91.5" suffix="%" icon="DataAnalysis" color="purple" trend="+0.6% 较上月" :trend-up="true" />
      </el-col>
    </el-row>

    <StatPanel title="人员增减趋势" subtitle="近12个月">
      <VChart :option="personnelTrendOption" height="300px" />
    </StatPanel>

    <el-row :gutter="16" class="chart-row">
      <el-col :xs="24" :lg="14">
        <StatPanel title="地域分布 TOP 10">
          <VChart :option="cityData" height="320px" />
        </StatPanel>
      </el-col>
      <el-col :xs="24" :lg="10">
        <StatPanel title="年龄段分布">
          <VChart :option="ageOption" height="320px" />
        </StatPanel>
      </el-col>
    </el-row>

    <el-row :gutter="16" class="chart-row">
      <el-col :xs="24" :lg="12">
        <StatPanel title="绩效评级分布">
          <VChart :option="performanceOption" height="260px" />
        </StatPanel>
      </el-col>
      <el-col :xs="24" :lg="12">
        <StatPanel title="关键质量指标">
          <div class="quality-list">
            <div v-for="item in qualityIndicators" :key="item.label" class="quality-item">
              <span class="quality-label">{{ item.label }}</span>
              <el-progress :percentage="item.value" :stroke-width="10" :color="item.color" />
              <span class="quality-value">{{ item.value }}%</span>
            </div>
          </div>
        </StatPanel>
      </el-col>
    </el-row>

    <StatPanel title="各部门人员明细">
      <template #extra>
        <div class="table-toolbar">
          <el-select v-model="deptFilter" clearable placeholder="全部部门" style="width: 140px">
            <el-option v-for="d in store.departments.filter((dep) => dep.id !== 'dept_root')" :key="d.id" :label="d.name" :value="d.id" />
          </el-select>
          <el-input v-model="keyword" placeholder="搜索部门" clearable prefix-icon="Search" style="width: 160px" />
        </div>
      </template>
      <el-table :data="departmentRows" border stripe>
        <el-table-column prop="departmentName" label="部门名称" min-width="120" fixed />
        <el-table-column prop="total" label="总人数" width="80" align="center" />
        <el-table-column prop="fullTime" label="全职" width="70" align="center" />
        <el-table-column prop="partTime" label="兼职" width="70" align="center" />
        <el-table-column prop="project" label="项目制" width="80" align="center" />
        <el-table-column label="本月新增" width="90" align="center">
          <template #default="{ row }"><span class="text-success">+{{ row.newCount }}</span></template>
        </el-table-column>
        <el-table-column label="本月流失" width="90" align="center">
          <template #default="{ row }"><span class="text-danger">-{{ row.churnCount }}</span></template>
        </el-table-column>
        <el-table-column label="活跃率" width="80" align="center">
          <template #default="{ row }">{{ row.activeRate }}%</template>
        </el-table-column>
        <el-table-column prop="performance" label="平均绩效" width="90" align="center" />
      </el-table>
    </StatPanel>

    <StatPanel title="候选人阶段分布">
      <el-table :data="statusRows" border stripe size="small">
        <el-table-column prop="statusLabel" label="阶段" />
        <el-table-column prop="count" label="人数" width="100" align="center" />
      </el-table>
    </StatPanel>
  </div>
</template>

<style scoped>
.stats-page { display: flex; flex-direction: column; gap: 16px; }
.stats-header {
  display: flex; justify-content: space-between; align-items: flex-start;
  background: #fff; border-radius: 12px; padding: 20px 24px; border: 1px solid var(--app-border);
}
.kpi-row .el-col, .chart-row .el-col { margin-bottom: 16px; }
.table-toolbar { display: flex; gap: 10px; }
.text-success { color: #52c41a; font-weight: 500; }
.text-danger { color: #f5222d; font-weight: 500; }
.quality-list { display: flex; flex-direction: column; gap: 18px; padding: 8px 0; }
.quality-item { display: flex; align-items: center; gap: 12px; }
.quality-label { width: 120px; font-size: 13px; color: #606266; flex-shrink: 0; }
.quality-item .el-progress { flex: 1; }
.quality-value { width: 48px; text-align: right; font-size: 13px; font-weight: 600; }
</style>
