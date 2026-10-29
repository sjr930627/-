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
  compareMetric,
  formatFillDuration,
  type MetricCompare,
  type ShiftStatsSummary,
} from '@/services/shiftStatistics'
import { lineChartOption } from '@/services/statisticsCharts'
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

function statsFor(start: string, end: string) {
  return buildShiftStatistics({
    start,
    end,
    grabSlots: store.grabShiftSlots,
    assignments: store.assignments,
    shifts: store.shifts,
    teams: store.teams,
    departments: store.departments,
    enterprises: store.enterprises,
    attendanceGroups: store.attendanceGroups,
    cancelShiftRequests: store.cancelShiftRequests,
    applications: store.grabShiftApplications,
    punches: store.punches,
    now: WORKBENCH_DEMO_NOW,
    enterpriseIds: enterpriseIds.value,
  })
}

const stats = computed(() => statsFor(window.value.start, window.value.end))
const prevStats = computed(() => statsFor(window.value.prevStart, window.value.prevEnd))

function mom(
  pick: (s: ShiftStatsSummary) => number | null,
  higherIsBetter = true,
): MetricCompare[] {
  return [
    { label: '环比', ...compareMetric(pick(stats.value.summary), pick(prevStats.value.summary), higherIsBetter) },
  ]
}

const scheduleCountCompares = computed(() => mom((s) => s.scheduleShiftCount))
const confirmCompares = computed(() => mom((s) => s.confirmRate))
const fulfillCompares = computed(() => mom((s) => s.fulfillRate))
const scheduleCancelCompares = computed(() => mom((s) => s.scheduleCancelled, false))
const grabCountCompares = computed(() => mom((s) => s.grabSlotCount))
const grabFillCompares = computed(() => mom((s) => s.grabFillRate))
const fillHoursCompares = computed(() => mom((s) => s.avgFillHours, false))
const urgentCompares = computed(() => mom((s) => s.urgentShifts, false))

const avgFillDisplay = computed(() => formatFillDuration(stats.value.summary.avgFillHours))

function rateText(value: number | null) {
  return value == null ? '—' : `${value}%`
}

function durationText(hours: number | null) {
  const formatted = formatFillDuration(hours)
  return formatted.suffix ? `${formatted.value}${formatted.suffix}` : formatted.value
}

const trendPoints = computed(() =>
  buildShiftFillGapTrend({
    start: window.value.start,
    end: window.value.end,
    mode: trendMode.value,
    grabSlots: store.grabShiftSlots,
    assignments: store.assignments,
    shifts: store.shifts,
    teams: store.teams,
    departments: store.departments,
    attendanceGroups: store.attendanceGroups,
    applications: store.grabShiftApplications,
    punches: store.punches,
    now: WORKBENCH_DEMO_NOW,
    enterpriseIds: enterpriseIds.value,
  }),
)

const trendOption = computed(() =>
  lineChartOption(trendPoints.value.map((p) => p.label), [
    { name: '排班确认率', data: trendPoints.value.map((p) => p.confirmRate), color: chartColors.blue },
    { name: '抢班满员率', data: trendPoints.value.map((p) => p.grabFillRate), color: chartColors.cyan },
  ]),
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
          排班与抢班分开统计，各项含环比 · {{ window.label }}（{{ window.start }} ~ {{ window.end }}）
        </p>
      </div>
      <el-radio-group v-model="period" size="default">
        <el-radio-button value="month">本月</el-radio-button>
        <el-radio-button value="30d">近30天</el-radio-button>
      </el-radio-group>
    </div>

    <el-row :gutter="16" class="split-row">
      <el-col :xs="24" :lg="12">
        <StatPanel title="排班统计" subtitle="已发布排班，不含休息班和抢班转入">
          <el-row :gutter="12">
            <el-col :xs="24" :sm="12">
              <StatKpiCard
                label="班次数"
                :value="stats.summary.scheduleShiftCount.toLocaleString()"
                suffix="个"
                icon="Calendar"
                color="blue"
                :compares="scheduleCountCompares"
                sub-text="日期 × 班次 × 班组"
              />
            </el-col>
            <el-col :xs="24" :sm="12">
              <StatKpiCard
                label="确认率"
                :value="rateText(stats.summary.confirmRate)"
                icon="CircleCheck"
                color="cyan"
                :compares="confirmCompares"
                :sub-text="`已确认 ${stats.summary.scheduleConfirmed} / 发布 ${stats.summary.schedulePublished} 人次`"
              />
            </el-col>
            <el-col :xs="24" :sm="12">
              <StatKpiCard
                label="履约率"
                :value="rateText(stats.summary.fulfillRate)"
                icon="Position"
                color="green"
                :compares="fulfillCompares"
                :sub-text="`到岗 ${stats.summary.scheduleArrived} / 已确认 ${stats.summary.scheduleConfirmed} 人次`"
              />
            </el-col>
            <el-col :xs="24" :sm="12">
              <StatKpiCard
                label="取消班次数"
                :value="stats.summary.scheduleCancelled.toLocaleString()"
                suffix="个"
                icon="CircleClose"
                color="red"
                :compares="scheduleCancelCompares"
                sub-text="已审批通过的排班班次"
              />
            </el-col>
          </el-row>
        </StatPanel>
      </el-col>
      <el-col :xs="24" :lg="12">
        <StatPanel title="抢班统计" subtitle="抢班池班次；紧急缺口为发布满 24 小时仍未满员的班次">
          <el-row :gutter="12">
            <el-col :xs="24" :sm="12">
              <StatKpiCard
                label="班次数"
                :value="stats.summary.grabSlotCount.toLocaleString()"
                suffix="个"
                icon="Calendar"
                color="blue"
                :compares="grabCountCompares"
                :sub-text="`需求 ${stats.summary.grabRequired.toLocaleString()} 人`"
              />
            </el-col>
            <el-col :xs="24" :sm="12">
              <StatKpiCard
                label="满员率"
                :value="rateText(stats.summary.grabFillRate)"
                icon="UserFilled"
                color="cyan"
                :compares="grabFillCompares"
                :sub-text="`已抢 ${stats.summary.grabGrabbed} / 需求 ${stats.summary.grabRequired}`"
              />
            </el-col>
            <el-col :xs="24" :sm="12">
              <StatKpiCard
                label="平均抢满时长"
                :value="avgFillDisplay.value"
                :suffix="avgFillDisplay.suffix || undefined"
                icon="Timer"
                color="purple"
                :compares="fillHoursCompares"
                :sub-text="`已抢满 ${stats.summary.filledSlotCount} 个班次`"
              />
            </el-col>
            <el-col :xs="24" :sm="12">
              <StatKpiCard
                label="紧急班次缺口数"
                :value="stats.summary.urgentShifts.toLocaleString()"
                suffix="个"
                icon="Warning"
                color="orange"
                :compares="urgentCompares"
                :sub-text="stats.summary.urgentGapHeadcount ? `缺 ${stats.summary.urgentGapHeadcount} 人 · 发布满 24 小时仍未满员` : '发布满 24 小时仍未满员'"
              />
            </el-col>
          </el-row>
        </StatPanel>
      </el-col>
    </el-row>

    <StatPanel title="排班确认率与抢班满员率趋势">
      <template #extra>
        <el-radio-group v-model="trendMode" size="small">
          <el-radio-button value="day">日</el-radio-button>
          <el-radio-button value="week">周</el-radio-button>
          <el-radio-button value="month">月</el-radio-button>
        </el-radio-group>
      </template>
      <VChart :option="trendOption" height="300px" />
    </StatPanel>

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
        <el-table-column prop="scheduleShiftCount" label="排班班次" width="100" align="right" />
        <el-table-column label="确认率" width="90" align="right">
          <template #default="{ row }">{{ rateText(row.confirmRate) }}</template>
        </el-table-column>
        <el-table-column label="履约率" width="90" align="right">
          <template #default="{ row }">{{ rateText(row.fulfillRate) }}</template>
        </el-table-column>
        <el-table-column prop="scheduleCancelled" label="取消班次" width="100" align="right" />
        <el-table-column prop="grabShiftCount" label="抢班班次" width="100" align="right" />
        <el-table-column label="满员率" width="90" align="right">
          <template #default="{ row }">
            <span class="rate-ok">{{ rateText(row.grabFillRate) }}</span>
          </template>
        </el-table-column>
        <el-table-column label="平均抢满时长" width="120" align="right">
          <template #default="{ row }">{{ durationText(row.avgFillHours) }}</template>
        </el-table-column>
        <el-table-column label="紧急缺口" width="100" align="right">
          <template #default="{ row }">
            <span class="gap">{{ row.urgentShifts }}</span>
          </template>
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
.split-row .el-col {
  margin-bottom: 16px;
}
.split-row :deep(.el-col) {
  margin-bottom: 12px;
}
.split-row :deep(.el-col:last-child) {
  margin-bottom: 0;
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
