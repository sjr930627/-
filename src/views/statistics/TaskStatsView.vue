<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAppStore } from '@/stores/app'
import StatKpiCard from '@/components/statistics/StatKpiCard.vue'
import StatPanel from '@/components/statistics/StatPanel.vue'
import VChart from '@/components/statistics/VChart.vue'
import RankList from '@/components/statistics/RankList.vue'
import { taskPublishStatusMap } from '@/constants/task'
import { barChartOption, donutChartOption, lineChartOption } from '@/services/statisticsCharts'
import { chartColors } from '@/plugins/echarts'

const store = useAppStore()
const statusFilter = ref<'all' | 'active' | 'ended'>('all')

const filteredTasks = computed(() =>
  store.tasks.filter((t) => {
    if (statusFilter.value === 'all') return true
    if (statusFilter.value === 'active') return t.status === 'active'
    return t.status === 'ended'
  }),
)

const summary = computed(() => {
  const tasks = store.tasks
  const instances = store.taskInstances
  const planned = tasks.reduce((s, t) => s + (t.plannedTotal ?? t.acceptedCount), 0)
  const completed = tasks.reduce((s, t) => s + t.completedCount, 0)
  return {
    totalTasks: tasks.length,
    activeTasks: tasks.filter((t) => t.status === 'active').length,
    totalInstances: instances.length,
    completionRate: planned ? Math.round((completed / planned) * 1000) / 10 : 0,
    totalAmount: instances.reduce((s, i) => s + i.amount, 0),
    approvedRate: completed
      ? Math.round((tasks.reduce((s, t) => s + t.approvedCount, 0) / completed) * 1000) / 10
      : 0,
  }
})

const trendOption = computed(() => {
  const weeks = ['第1周', '第2周', '第3周', '第4周']
  return lineChartOption(weeks, [
    { name: '完成率', data: [82, 85, 87, summary.value.completionRate], color: chartColors.blue },
    { name: '验收率', data: [78, 80, 84, summary.value.approvedRate], color: chartColors.green, dashed: true },
  ])
})

const typeDonutOption = computed(() => {
  const map = new Map<string, number>()
  for (const t of store.tasks) map.set(t.taskTypeName, (map.get(t.taskTypeName) ?? 0) + 1)
  const colors = [chartColors.blue, chartColors.green, chartColors.orange, chartColors.purple, chartColors.pink]
  return donutChartOption(
    [...map.entries()].map(([name, value], i) => ({ name, value, color: colors[i % colors.length] })),
    `${store.tasks.length}\n任务总数`,
  )
})

const typeBarOption = computed(() => {
  const map = new Map<string, { accepted: number; completed: number }>()
  for (const t of store.tasks) {
    const row = map.get(t.taskTypeName) ?? { accepted: 0, completed: 0 }
    row.accepted += t.acceptedCount
    row.completed += t.completedCount
    map.set(t.taskTypeName, row)
  }
  const labels = [...map.keys()]
  return barChartOption(labels, [
    { name: '接单量', data: labels.map((l) => map.get(l)!.accepted), color: chartColors.blue },
    { name: '完成量', data: labels.map((l) => map.get(l)!.completed), color: chartColors.green },
  ])
})

const enterpriseRank = computed(() => {
  const map = new Map<string, number>()
  for (const t of store.tasks) {
    const rate = t.plannedTotal ? (t.completedCount / t.plannedTotal) * 100 : 0
    map.set(t.enterpriseName, Math.max(map.get(t.enterpriseName) ?? 0, rate))
  }
  return [...map.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, value], i) => ({
      name,
      value: Math.round(value * 10) / 10,
      percent: value,
      color: [chartColors.green, chartColors.blue, chartColors.orange, chartColors.purple, chartColors.cyan][i],
    }))
})

const taskRows = computed(() =>
  filteredTasks.value.map((t) => ({
    ...t,
    statusLabel: taskPublishStatusMap[t.status],
    completionRate: t.plannedTotal ? `${Math.round((t.completedCount / t.plannedTotal) * 100)}%` : '—',
    acceptanceRate: t.completedCount ? `${Math.round((t.approvedCount / t.completedCount) * 100)}%` : '0%',
  })),
)
</script>

<template>
  <div class="stats-page">
    <div class="stats-header">
      <div>
        <h2 class="page-title">任务数据报表</h2>
        <p class="text-muted">任务统计 · 发布、完成与验收分析</p>
      </div>
      <el-radio-group v-model="statusFilter">
        <el-radio-button value="all">全部</el-radio-button>
        <el-radio-button value="active">进行中</el-radio-button>
        <el-radio-button value="ended">已结束</el-radio-button>
      </el-radio-group>
    </div>

    <el-row :gutter="16" class="kpi-row">
      <el-col :xs="24" :sm="12" :md="8" :lg="4">
        <StatKpiCard label="任务总数" :value="summary.totalTasks" suffix="个" icon="Tickets" color="blue" trend="+6.2% 较上月" :trend-up="true" />
      </el-col>
      <el-col :xs="24" :sm="12" :md="8" :lg="4">
        <StatKpiCard label="进行中" :value="summary.activeTasks" suffix="个" icon="Loading" color="orange" />
      </el-col>
      <el-col :xs="24" :sm="12" :md="8" :lg="4">
        <StatKpiCard label="任务实例" :value="summary.totalInstances" suffix="条" icon="List" color="green" />
      </el-col>
      <el-col :xs="24" :sm="12" :md="8" :lg="4">
        <StatKpiCard label="完成率" :value="summary.completionRate" suffix="%" icon="Finished" color="purple" trend="-2.1% 较上月" :trend-up="false" />
      </el-col>
      <el-col :xs="24" :sm="12" :md="8" :lg="4">
        <StatKpiCard label="验收率" :value="summary.approvedRate" suffix="%" icon="CircleCheck" color="cyan" trend="+1.5% 较上月" :trend-up="true" />
      </el-col>
    </el-row>

    <el-row :gutter="16" class="chart-row">
      <el-col :xs="24" :lg="14">
        <StatPanel title="任务完成趋势" subtitle="近4周">
          <VChart :option="trendOption" height="280px" />
        </StatPanel>
      </el-col>
      <el-col :xs="24" :lg="10">
        <StatPanel title="任务类型分布">
          <VChart :option="typeDonutOption" height="280px" />
        </StatPanel>
      </el-col>
    </el-row>

    <el-row :gutter="16" class="chart-row">
      <el-col :xs="24" :lg="14">
        <StatPanel title="任务类型完成对比">
          <VChart :option="typeBarOption" height="280px" />
        </StatPanel>
      </el-col>
      <el-col :xs="24" :lg="10">
        <StatPanel title="企业完成率排行">
          <RankList :items="enterpriseRank" />
        </StatPanel>
      </el-col>
    </el-row>

    <StatPanel title="任务明细统计">
      <el-table :data="taskRows" border stripe>
        <el-table-column prop="name" label="任务名称" min-width="160" />
        <el-table-column prop="enterpriseName" label="企业" min-width="130" />
        <el-table-column prop="taskTypeName" label="类型" width="110" />
        <el-table-column prop="statusLabel" label="状态" width="90" />
        <el-table-column prop="acceptedCount" label="已接单" width="80" align="center" />
        <el-table-column prop="completedCount" label="已完成" width="80" align="center" />
        <el-table-column prop="approvedCount" label="已验收" width="80" align="center" />
        <el-table-column prop="completionRate" label="完成率" width="90" align="center" />
        <el-table-column prop="acceptanceRate" label="验收率" width="90" align="center" />
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
</style>
