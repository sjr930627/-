<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { usePortal } from '@/composables/usePortal'
import StatKpiCard from '@/components/statistics/StatKpiCard.vue'
import StatPanel from '@/components/statistics/StatPanel.vue'
import VChart from '@/components/statistics/VChart.vue'
import { taskPublishStatusMap } from '@/constants/task'
import { formatMoney } from '@/constants/payrollBill'
import { WORKBENCH_DEMO_NOW } from '@/constants/workbenchReminder'
import { resolveDashboardWindow } from '@/services/businessDashboard'
import { donutChartOption, valueLineChartOption } from '@/services/statisticsCharts'
import { chartColors } from '@/plugins/echarts'
import type { TaskPublishStatus } from '@/types'

const store = useAppStore()
const router = useRouter()
const { pathPrefix, isEnterprise } = usePortal()

const statusFilter = ref<TaskPublishStatus | 'all'>('all')
const typeFilter = ref('')
const dateRange = ref<[string, string] | null>(null)
const defaultWindow = resolveDashboardWindow('month', WORKBENCH_DEMO_NOW)
if (!dateRange.value) dateRange.value = [defaultWindow.start, defaultWindow.end]

const scopedTasks = computed(() => {
  let list = store.tasks
  if (isEnterprise.value && store.currentEnterpriseId) {
    list = list.filter((t) => t.enterpriseId === store.currentEnterpriseId)
  }
  if (typeFilter.value) list = list.filter((t) => t.taskTypeName === typeFilter.value)
  if (statusFilter.value !== 'all') list = list.filter((t) => t.status === statusFilter.value)
  if (dateRange.value) {
    const [start, end] = dateRange.value
    list = list.filter((t) => {
      const day = t.createdAt.slice(0, 10)
      return day >= start && day <= end
    })
  }
  return list
})

const taskIds = computed(() => new Set(scopedTasks.value.map((t) => t.id)))

const scopedInstances = computed(() =>
  store.taskInstances.filter((i) => taskIds.value.has(i.taskId)),
)

const summary = computed(() => {
  const tasks = scopedTasks.value
  const instances = scopedInstances.value
  const published = tasks.filter((t) => t.status !== 'draft' && t.status !== 'cancelled').length
  const claimed = instances.length || tasks.reduce((s, t) => s + t.acceptedCount, 0)
  const completed = tasks.reduce((s, t) => s + t.completedCount, 0)
  const approved = tasks.reduce((s, t) => s + t.approvedCount, 0)
  const now = WORKBENCH_DEMO_NOW.toISOString().slice(0, 10)
  const overdue = tasks.filter(
    (t) =>
      !t.longTerm &&
      t.endTime.slice(0, 10) < now &&
      t.status === 'active' &&
      t.completedCount < (t.plannedTotal ?? (t.acceptedCount || 1)),
  ).length
  const timeoutInstances = instances.filter(
    (i) => i.timeoutAt && i.timeoutAt.slice(0, 10) < now,
  ).length
  const amount = instances.reduce((s, i) => s + i.amount, 0)
  return {
    published,
    claimed,
    completed,
    approveRate: completed ? Math.round((approved / completed) * 1000) / 10 : 0,
    timeoutRate: published
      ? Math.round(((overdue + timeoutInstances) / published) * 1000) / 10
      : 0,
    amount,
  }
})

/** 固化：进行中=pending，执行中=active，已完成/已结束=ended */
const statusDist = computed(() => {
  const map: Record<string, number> = {
    草稿: 0,
    进行中: 0,
    执行中: 0,
    已完成: 0,
    已结束: 0,
  }
  for (const t of scopedTasks.value) {
    if (t.status === 'draft') map['草稿'] += 1
    else if (t.status === 'pending') map['进行中'] += 1
    else if (t.status === 'active') map['执行中'] += 1
    else if (t.status === 'ended' && t.approvedCount >= t.completedCount && t.completedCount > 0)
      map['已完成'] += 1
    else if (t.status === 'ended') map['已结束'] += 1
    else map['已结束'] += 1
  }
  return map
})

const statusDonutOption = computed(() =>
  donutChartOption(
    [
      { name: '草稿', value: statusDist.value['草稿'], color: chartColors.cyan },
      { name: '进行中', value: statusDist.value['进行中'], color: chartColors.orange },
      { name: '执行中', value: statusDist.value['执行中'], color: chartColors.blue },
      { name: '已完成', value: statusDist.value['已完成'], color: chartColors.green },
      { name: '已结束', value: statusDist.value['已结束'], color: chartColors.purple },
    ],
    `${scopedTasks.value.length}\n任务`,
  ),
)

const typeOptions = computed(() => [...new Set(store.tasks.map((t) => t.taskTypeName))])

const typeDonutOption = computed(() => {
  const map = new Map<string, number>()
  for (const t of scopedTasks.value) map.set(t.taskTypeName, (map.get(t.taskTypeName) ?? 0) + 1)
  const colors = [chartColors.blue, chartColors.green, chartColors.orange, chartColors.purple, chartColors.pink]
  return donutChartOption(
    [...map.entries()].map(([name, value], i) => ({ name, value, color: colors[i % colors.length] })),
    `${scopedTasks.value.length}\n类型`,
  )
})

const timeoutTrendOption = computed(() => {
  const weeks = ['第1周', '第2周', '第3周', '第4周']
  const base = summary.value.timeoutRate
  return valueLineChartOption(
    weeks,
    [
      {
        name: '超时率',
        data: [
          Math.max(0, base - 4),
          Math.max(0, base - 2),
          Math.max(0, base - 1),
          base,
        ].map((n) => Math.round(n * 10) / 10),
        color: chartColors.red,
      },
    ],
    '%',
  )
})

const detailRows = computed(() =>
  scopedTasks.value.map((t) => ({
    ...t,
    statusLabel: taskPublishStatusMap[t.status] ?? t.status,
    amountLabel: formatMoney(
      scopedInstances.value.filter((i) => i.taskId === t.id).reduce((s, i) => s + i.amount, 0),
    ),
  })),
)

function onExport() {
  ElMessage.success(`已导出 ${detailRows.value.length} 条任务明细（演示）`)
}

function drillStatus(name?: string) {
  const map: Record<string, TaskPublishStatus | 'all'> = {
    草稿: 'draft',
    进行中: 'pending',
    执行中: 'active',
    已完成: 'ended',
    已结束: 'ended',
  }
  if (name && map[name]) statusFilter.value = map[name]
  router.push(`${pathPrefix.value}/task/progress`)
}
</script>

<template>
  <div class="stats-page">
    <div class="stats-header">
      <div>
        <h2 class="page-title">任务分析</h2>
        <p class="text-muted">发布 / 认领 / 完成 / 超时 · 状态与类型分布</p>
      </div>
      <el-button type="primary" @click="onExport">导出</el-button>
    </div>

    <StatPanel title="筛选条件">
      <div class="filters">
        <el-select v-model="typeFilter" clearable placeholder="任务类型" style="width: 180px">
          <el-option v-for="t in typeOptions" :key="t" :label="t" :value="t" />
        </el-select>
        <el-select v-model="statusFilter" placeholder="状态" style="width: 140px">
          <el-option label="全部" value="all" />
          <el-option label="草稿" value="draft" />
          <el-option label="进行中" value="pending" />
          <el-option label="执行中" value="active" />
          <el-option label="已结束" value="ended" />
        </el-select>
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          value-format="YYYY-MM-DD"
          start-placeholder="开始"
          end-placeholder="结束"
          style="width: 260px"
        />
      </div>
    </StatPanel>

    <el-row :gutter="16" class="kpi-row">
      <el-col :xs="12" :sm="8" :md="4"><StatKpiCard label="任务发布数" :value="summary.published" icon="Promotion" color="blue" /></el-col>
      <el-col :xs="12" :sm="8" :md="4"><StatKpiCard label="认领数" :value="summary.claimed" icon="User" color="cyan" /></el-col>
      <el-col :xs="12" :sm="8" :md="4"><StatKpiCard label="完成数" :value="summary.completed" icon="CircleCheck" color="green" /></el-col>
      <el-col :xs="12" :sm="8" :md="4"><StatKpiCard label="验收通过率" :value="summary.approveRate" suffix="%" icon="Select" color="purple" /></el-col>
      <el-col :xs="12" :sm="8" :md="4">
        <StatKpiCard
          label="超时率"
          :value="summary.timeoutRate"
          suffix="%"
          icon="AlarmClock"
          color="red"
          :sub-text="summary.timeoutRate > 10 ? '偏高，请关注' : undefined"
        />
      </el-col>
      <el-col :xs="12" :sm="8" :md="4">
        <StatKpiCard label="任务总金额" :value="formatMoney(summary.amount)" icon="Wallet" color="orange" />
      </el-col>
    </el-row>

    <el-row :gutter="16" class="chart-row">
      <el-col :xs="24" :lg="8">
        <StatPanel title="状态分布">
          <div class="click-hint" @click="drillStatus()">点击区块下钻任务列表 →</div>
          <VChart :option="statusDonutOption" height="280px" />
          <div class="status-chips">
            <button
              v-for="(count, name) in statusDist"
              :key="name"
              type="button"
              class="chip"
              @click="drillStatus(String(name))"
            >
              {{ name }} {{ count }}
            </button>
          </div>
        </StatPanel>
      </el-col>
      <el-col :xs="24" :lg="8">
        <StatPanel title="类型分布">
          <VChart :option="typeDonutOption" height="280px" />
        </StatPanel>
      </el-col>
      <el-col :xs="24" :lg="8">
        <StatPanel title="超时率趋势">
          <VChart :option="timeoutTrendOption" height="280px" />
        </StatPanel>
      </el-col>
    </el-row>

    <StatPanel title="任务明细">
      <el-table :data="detailRows" border stripe>
        <el-table-column prop="name" label="任务" min-width="160" />
        <el-table-column prop="enterpriseName" label="企业" min-width="130" />
        <el-table-column prop="taskTypeName" label="类型" width="120" />
        <el-table-column prop="statusLabel" label="状态" width="90" />
        <el-table-column prop="acceptedCount" label="认领" width="70" align="center" />
        <el-table-column prop="completedCount" label="完成" width="70" align="center" />
        <el-table-column prop="approvedCount" label="验收" width="70" align="center" />
        <el-table-column prop="amountLabel" label="金额" width="120" align="right" />
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
.filters { display: flex; flex-wrap: wrap; gap: 10px; }
.kpi-row .el-col, .chart-row .el-col { margin-bottom: 16px; }
.click-hint { font-size: 12px; color: var(--el-color-primary); cursor: pointer; margin-bottom: 4px; }
.status-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.chip {
  border: 1px solid var(--app-border); background: #f7f8fa; border-radius: 6px;
  padding: 4px 10px; font-size: 12px; cursor: pointer;
}
</style>
