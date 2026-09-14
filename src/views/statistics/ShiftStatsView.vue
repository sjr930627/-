<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { usePortal } from '@/composables/usePortal'
import StatKpiCard from '@/components/statistics/StatKpiCard.vue'
import StatPanel from '@/components/statistics/StatPanel.vue'
import VChart from '@/components/statistics/VChart.vue'
import { WORKBENCH_DEMO_NOW } from '@/constants/workbenchReminder'
import { resolveDashboardWindow } from '@/services/businessDashboard'
import {
  buildShiftFillGapTrend,
  buildShiftStatistics,
} from '@/services/shiftStatistics'
import { comboChartOption, donutChartOption } from '@/services/statisticsCharts'
import { chartColors } from '@/plugins/echarts'

const store = useAppStore()
const router = useRouter()
const { pathPrefix, isEnterprise } = usePortal()

const period = ref<'month' | '30d'>('month')
const trendMode = ref<'day' | 'week' | 'month'>('week')
const keyword = ref('')
const page = ref(1)
const pageSize = 10

const window = computed(() => resolveDashboardWindow(period.value, WORKBENCH_DEMO_NOW))

const enterpriseIds = computed(() => {
  if (!isEnterprise.value || !store.currentEnterpriseId) return undefined
  return [store.currentEnterpriseId]
})

const stats = computed(() =>
  buildShiftStatistics({
    start: window.value.start,
    end: window.value.end,
    grabSlots: store.grabShiftSlots,
    assignments: store.assignments,
    shifts: store.shifts,
    teams: store.teams,
    departments: store.departments,
    enterprises: store.enterprises,
    attendanceGroups: store.attendanceGroups,
    cancelShiftRequests: store.cancelShiftRequests,
    enterpriseIds: enterpriseIds.value,
  }),
)

const typeDonutOption = computed(() => {
  const colors = [
    chartColors.blue,
    chartColors.cyan,
    chartColors.orange,
    chartColors.purple,
    chartColors.green,
  ]
  const items = stats.value.typeDist.map((t, i) => ({
    name: t.name,
    value: t.value,
    color: colors[i % colors.length],
  }))
  return donutChartOption(items, `${stats.value.summary.publishedShifts}\n发布班次`)
})

const trendPoints = computed(() =>
  buildShiftFillGapTrend(
    window.value.start,
    window.value.end,
    trendMode.value,
    store.grabShiftSlots,
    enterpriseIds.value,
    store.attendanceGroups,
    store.departments,
  ),
)

const trendOption = computed(() =>
  comboChartOption(
    trendPoints.value.map((p) => p.label),
    [{ name: '满员率', data: trendPoints.value.map((p) => p.fillRate), color: chartColors.blue }],
    { name: '缺口率', data: trendPoints.value.map((p) => p.gapRate), color: chartColors.orange },
  ),
)

const filteredDetails = computed(() => {
  const kw = keyword.value.trim()
  if (!kw) return stats.value.details
  return stats.value.details.filter(
    (r) => r.enterpriseName.includes(kw) || r.jobType.includes(kw) || r.region.includes(kw),
  )
})

const pagedDetails = computed(() => {
  const start = (page.value - 1) * pageSize
  return filteredDetails.value.slice(start, start + pageSize)
})

const fillRingStyle = computed(() => {
  const p = Math.min(100, stats.value.summary.fillRate)
  return {
    background: `conic-gradient(#52c41a ${p * 3.6}deg, #f0f2f5 0deg)`,
  }
})

function goDetail(row: { enterpriseId: string }) {
  router.push({
    path: `${pathPrefix.value}/schedule-manage`,
    query: isEnterprise.value ? undefined : { enterpriseId: row.enterpriseId },
  })
}
</script>

<template>
  <div class="stats-page">
    <div class="stats-header">
      <div>
        <h2 class="page-title">班次统计</h2>
        <p class="text-muted">
          排班发布 / 抢班确认 · {{ window.label }}（{{ window.start }} ~ {{ window.end }}）
        </p>
      </div>
      <el-radio-group v-model="period" size="default">
        <el-radio-button value="month">本月</el-radio-button>
        <el-radio-button value="30d">近30天</el-radio-button>
      </el-radio-group>
    </div>

    <el-row :gutter="16" class="kpi-row">
      <el-col :xs="24" :sm="12" :md="8" :lg="4">
        <StatKpiCard
          label="排班发布班次"
          :value="stats.summary.publishedShifts.toLocaleString()"
          icon="Calendar"
          color="blue"
          :sub-text="`总工位 ${stats.summary.totalPositions.toLocaleString()}`"
        />
      </el-col>
      <el-col :xs="24" :sm="12" :md="8" :lg="4">
        <StatKpiCard
          label="实际确认人数"
          :value="stats.summary.confirmedCount.toLocaleString()"
          suffix="人"
          icon="User"
          color="cyan"
        />
      </el-col>
      <el-col :xs="24" :sm="12" :md="8" :lg="5">
        <div class="fill-card">
          <div class="fill-left">
            <div class="fill-label">班次满员率</div>
            <div class="fill-value">{{ stats.summary.fillRate }}%</div>
            <div class="fill-sub">确认人数 / 总工位</div>
          </div>
          <div class="fill-ring" :style="fillRingStyle">
            <div class="fill-ring-inner">{{ Math.round(stats.summary.fillRate) }}%</div>
          </div>
        </div>
      </el-col>
      <el-col :xs="24" :sm="12" :md="8" :lg="5">
        <StatKpiCard
          label="班次缺口"
          :value="stats.summary.gapCount.toLocaleString()"
          suffix="工位"
          icon="Warning"
          color="orange"
          :sub-text="`缺口率 ${stats.summary.gapRate}%`"
        />
      </el-col>
      <el-col :xs="24" :sm="12" :md="8" :lg="6">
        <StatKpiCard
          label="班次取消率"
          :value="stats.summary.cancelRate"
          suffix="%"
          icon="CircleClose"
          color="red"
          :sub-text="`取消 ${stats.summary.cancelledShifts} 班 · ${stats.summary.cancelledHours}h`"
        />
      </el-col>
    </el-row>

    <el-row :gutter="16" class="chart-row">
      <el-col :xs="24" :lg="10">
        <StatPanel title="班次类型分布">
          <VChart :option="typeDonutOption" height="300px" />
        </StatPanel>
      </el-col>
      <el-col :xs="24" :lg="14">
        <StatPanel title="满员率与缺口趋势">
          <template #extra>
            <el-radio-group v-model="trendMode" size="small">
              <el-radio-button value="day">日</el-radio-button>
              <el-radio-button value="week">周</el-radio-button>
              <el-radio-button value="month">月</el-radio-button>
            </el-radio-group>
          </template>
          <VChart :option="trendOption" height="300px" />
        </StatPanel>
      </el-col>
    </el-row>

    <StatPanel title="班次统计明细">
      <template #extra>
        <el-input
          v-model="keyword"
          placeholder="搜索企业 / 工种"
          clearable
          prefix-icon="Search"
          style="width: 220px"
          @input="page = 1"
        />
      </template>
      <el-table :data="pagedDetails" border stripe>
        <el-table-column prop="enterpriseName" label="用工企业" min-width="160" />
        <el-table-column prop="region" label="区域" width="90" />
        <el-table-column prop="jobType" label="工种" min-width="120" />
        <el-table-column prop="publishedShifts" label="发布班次" width="100" align="right" />
        <el-table-column prop="totalPositions" label="总工位数" width="100" align="right" />
        <el-table-column prop="confirmedCount" label="确认人数" width="100" align="right" />
        <el-table-column label="满员率" width="100" align="right">
          <template #default="{ row }">
            <span class="rate-ok">{{ row.fillRate }}%</span>
          </template>
        </el-table-column>
        <el-table-column label="缺口数" width="90" align="right">
          <template #default="{ row }">
            <span class="gap">{{ row.gapCount }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="cancelRate" label="取消率" width="90" align="right">
          <template #default="{ row }">{{ row.cancelRate }}%</template>
        </el-table-column>
        <el-table-column label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="goDetail(row)">查看详情</el-button>
          </template>
        </el-table-column>
      </el-table>
      <div class="table-footer">
        <span class="text-muted">共 {{ filteredDetails.length }} 条明细</span>
        <el-pagination
          v-model:current-page="page"
          :page-size="pageSize"
          layout="prev, pager, next"
          :total="filteredDetails.length"
          background
        />
      </div>
    </StatPanel>
  </div>
</template>

<style scoped>
.stats-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.stats-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  flex-wrap: wrap;
  gap: 12px;
  background: #fff;
  border-radius: 12px;
  padding: 20px 24px;
  border: 1px solid var(--app-border);
}
.kpi-row .el-col,
.chart-row .el-col {
  margin-bottom: 16px;
}
.fill-card {
  background: #fff;
  border-radius: 12px;
  padding: 18px 20px;
  border: 1px solid var(--app-border);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.fill-label {
  font-size: 13px;
  color: #909399;
}
.fill-value {
  font-size: 28px;
  font-weight: 700;
  color: #1a1a2e;
  margin-top: 6px;
}
.fill-sub {
  margin-top: 8px;
  font-size: 12px;
  color: #909399;
}
.fill-ring {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.fill-ring-inner {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  color: #52c41a;
}
.rate-ok {
  color: #52c41a;
  font-weight: 600;
}
.gap {
  color: #fa8c16;
  font-weight: 600;
}
.table-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
