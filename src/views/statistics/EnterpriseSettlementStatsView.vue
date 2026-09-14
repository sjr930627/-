<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { usePortal } from '@/composables/usePortal'
import StatPanel from '@/components/statistics/StatPanel.vue'
import VChart from '@/components/statistics/VChart.vue'
import { formatMoney } from '@/constants/payrollBill'
import { WORKBENCH_DEMO_NOW } from '@/constants/workbenchReminder'
import { chartColors } from '@/plugins/echarts'
import {
  buildAnnualEnterpriseSettlement,
  buildMonthlyEnterpriseSettlement,
  formatCompactMoney,
  formatWanNumber,
  listSettlementYears,
} from '@/services/settlementStatistics'
import type { EChartsOption } from 'echarts'

const store = useAppStore()
const router = useRouter()
const { pathPrefix, isEnterprise } = usePortal()

/** 时间维度：年度 / 按月 */
const timeDimension = ref<'year' | 'month'>('year')

const yearOptions = computed(() => listSettlementYears(store.settlementBills, WORKBENCH_DEMO_NOW))
const year = ref(yearOptions.value[0] ?? WORKBENCH_DEMO_NOW.getFullYear())
const pad = (n: number) => String(n).padStart(2, '0')
const month = ref(
  `${WORKBENCH_DEMO_NOW.getFullYear()}-${pad(WORKBENCH_DEMO_NOW.getMonth() + 1)}`,
)
const showYoy = ref(true)
const grain = ref<'month' | 'quarter'>('month')
const regionFilter = ref('')
const enterpriseFilter = ref('')
const highlightMonth = ref(Math.min(WORKBENCH_DEMO_NOW.getMonth() + 1, 12))
const keyword = ref('')
const page = ref(1)
const pageSize = 10

const regionOptions = ['全部区域', '华东', '华北', '华南', '西南']

const scopedBills = computed(() => {
  let list = store.settlementBills
  if (isEnterprise.value && store.currentEnterpriseId) {
    list = list.filter((b) => b.enterpriseId === store.currentEnterpriseId)
  }
  if (enterpriseFilter.value) {
    list = list.filter((b) => b.enterpriseId === enterpriseFilter.value)
  }
  return list
})

const annual = computed(() => buildAnnualEnterpriseSettlement(scopedBills.value, year.value))
const monthly = computed(() =>
  buildMonthlyEnterpriseSettlement(scopedBills.value, month.value),
)

const activeSummary = computed(() =>
  timeDimension.value === 'year' ? annual.value.summary : monthly.value.summary,
)

const enterpriseOptions = computed(() => {
  if (isEnterprise.value) return []
  return store.enterprises.map((e) => ({ id: e.id, name: e.name }))
})

const collectionRingStyle = computed(() => {
  const p = Math.min(100, activeSummary.value.collectionRate)
  return {
    background: `conic-gradient(${chartColors.blue} ${p * 3.6}deg, #eef0f5 0deg)`,
  }
})

const pageTitle = computed(() =>
  timeDimension.value === 'year' ? '企业结算 · 年度收入分析' : '企业结算 · 按月收入分析',
)

const trendOption = computed((): EChartsOption => {
  if (timeDimension.value === 'month') {
    /** 按月视角：近 6 个月账单 + 服务费趋势 */
    const labels: string[] = []
    const billData: number[] = []
    const feeData: number[] = []
    const yoyBillData: number[] = []
    const [y, m] = month.value.split('-').map(Number)
    for (let i = 5; i >= 0; i--) {
      const d = new Date(y, m - 1 - i, 1)
      const ym = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
      labels.push(`${d.getMonth() + 1}月`)
      const snap = buildMonthlyEnterpriseSettlement(scopedBills.value, ym)
      billData.push(Math.round(snap.summary.billTotal / 1e4))
      feeData.push(Math.round(snap.summary.serviceFee / 1e4))
      const prev = buildMonthlyEnterpriseSettlement(
        scopedBills.value,
        `${d.getFullYear() - 1}-${pad(d.getMonth() + 1)}`,
      )
      yoyBillData.push(Math.round(prev.summary.billTotal / 1e4))
    }
    const hi = 5
    return {
      tooltip: { trigger: 'axis' },
      legend: { right: 0, top: 0, icon: 'circle', itemWidth: 8 },
      grid: { left: 48, right: 48, top: 40, bottom: 28 },
      xAxis: {
        type: 'category',
        data: labels,
        axisLine: { lineStyle: { color: '#e8e8e8' } },
        axisLabel: { color: '#909399', fontSize: 11 },
      },
      yAxis: [
        {
          type: 'value',
          name: '账单(万)',
          nameTextStyle: { color: '#909399', fontSize: 11 },
          splitLine: { lineStyle: { color: '#f0f0f0', type: 'dashed' } },
          axisLabel: { color: '#909399', fontSize: 11 },
        },
        {
          type: 'value',
          name: '服务费(万)',
          nameTextStyle: { color: '#909399', fontSize: 11 },
          splitLine: { show: false },
          axisLabel: { color: '#909399', fontSize: 11 },
        },
      ],
      series: [
        {
          name: '账单收入',
          type: 'bar',
          barMaxWidth: 28,
          data: billData.map((v, i) => ({
            value: v,
            itemStyle: {
              color: i === hi ? chartColors.blue : '#9eb9ff',
              borderRadius: [4, 4, 0, 0],
            },
            label:
              i === hi
                ? {
                    show: true,
                    position: 'top',
                    formatter: `¥${v.toLocaleString()}`,
                    color: '#303133',
                    fontWeight: 600,
                  }
                : undefined,
          })),
        },
        {
          name: '服务费',
          type: 'line',
          yAxisIndex: 1,
          smooth: true,
          symbol: 'circle',
          symbolSize: 6,
          lineStyle: { width: 2, color: chartColors.green },
          itemStyle: { color: chartColors.green },
          data: feeData,
        },
        ...(showYoy.value
          ? [
              {
                name: '账单上年同期',
                type: 'line' as const,
                smooth: true,
                symbol: 'circle',
                symbolSize: 6,
                lineStyle: { width: 2, type: 'dashed' as const, color: chartColors.orange },
                itemStyle: { color: chartColors.orange },
                data: yoyBillData,
              },
            ]
          : []),
      ],
    }
  }

  const isMonth = grain.value === 'month'
  const labels = isMonth
    ? annual.value.months.map((m) => m.label)
    : annual.value.quarters.map((q) => q.label)
  const cur = isMonth
    ? annual.value.months.map((m) => Math.round(m.billAmount / 1e4))
    : annual.value.quarters.map((q) => Math.round(q.billAmount / 1e4))
  const fee = isMonth
    ? annual.value.months.map((m) => Math.round(m.serviceFee / 1e4))
    : annual.value.quarters.map((q) => Math.round(q.serviceFee / 1e4))
  const prev = isMonth
    ? annual.value.prevYearMonthlyBills.map((v) => Math.round(v / 1e4))
    : [0, 1, 2, 3].map((q) => {
        const slice = annual.value.prevYearMonthlyBills.slice(q * 3, q * 3 + 3)
        return Math.round(slice.reduce((s, n) => s + n, 0) / 1e4)
      })
  const prevFee = isMonth
    ? annual.value.prevYearMonthlyFees.map((v) => Math.round(v / 1e4))
    : [0, 1, 2, 3].map((q) => {
        const slice = annual.value.prevYearMonthlyFees.slice(q * 3, q * 3 + 3)
        return Math.round(slice.reduce((s, n) => s + n, 0) / 1e4)
      })

  const barData = cur.map((v, i) => {
    const hi = isMonth && i + 1 === highlightMonth.value
    return {
      value: v,
      itemStyle: {
        color: hi ? chartColors.blue : '#9eb9ff',
        borderRadius: [4, 4, 0, 0],
      },
      label: hi
        ? {
            show: true,
            position: 'top' as const,
            formatter: `¥${v.toLocaleString()}`,
            color: '#303133',
            fontWeight: 600,
          }
        : undefined,
    }
  })

  const series: EChartsOption['series'] = [
    {
      name: `${year.value} 账单收入`,
      type: 'bar',
      barMaxWidth: 28,
      data: barData,
    },
    {
      name: `${year.value} 服务费`,
      type: 'line',
      yAxisIndex: 1,
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { width: 2, color: chartColors.green },
      itemStyle: { color: chartColors.green },
      data: fee,
    },
  ]
  if (showYoy.value) {
    series.push(
      {
        name: `${year.value - 1} 账单同期`,
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        lineStyle: { width: 2, type: 'dashed', color: chartColors.orange },
        itemStyle: { color: chartColors.orange },
        data: prev,
      },
      {
        name: `${year.value - 1} 服务费同期`,
        type: 'line',
        yAxisIndex: 1,
        smooth: true,
        symbol: 'circle',
        symbolSize: 5,
        lineStyle: { width: 2, type: 'dashed', color: chartColors.cyan },
        itemStyle: { color: chartColors.cyan },
        data: prevFee,
      },
    )
  }

  return {
    tooltip: {
      trigger: 'axis',
      formatter: (params: unknown) => {
        const list = (Array.isArray(params) ? params : [params]) as {
          marker?: string
          seriesName?: string
          value?: number | { value: number }
          axisValue?: string
        }[]
        const head = list[0]?.axisValue ?? ''
        const lines = list.map((p) => {
          const raw = typeof p.value === 'object' && p.value ? p.value.value : p.value
          return `${p.marker ?? ''}${p.seriesName}：¥${Number(raw ?? 0).toLocaleString()} 万`
        })
        return [head, ...lines].join('<br/>')
      },
    },
    legend: { right: 0, top: 0, icon: 'circle', itemWidth: 8 },
    grid: { left: 48, right: 48, top: 40, bottom: 28 },
    xAxis: {
      type: 'category',
      data: labels,
      axisLine: { lineStyle: { color: '#e8e8e8' } },
      axisLabel: { color: '#909399', fontSize: 11 },
    },
    yAxis: [
      {
        type: 'value',
        name: '账单(万)',
        nameTextStyle: { color: '#909399', fontSize: 11 },
        splitLine: { lineStyle: { color: '#f0f0f0', type: 'dashed' } },
        axisLabel: { color: '#909399', fontSize: 11 },
      },
      {
        type: 'value',
        name: '服务费(万)',
        nameTextStyle: { color: '#909399', fontSize: 11 },
        splitLine: { show: false },
        axisLabel: { color: '#909399', fontSize: 11 },
      },
    ],
    series,
  }
})

const tableRows = computed(() => {
  if (grain.value === 'quarter') {
    return annual.value.quarters.map((q, i) => ({
      key: q.label,
      label: q.label,
      billWan: formatWanNumber(q.billAmount),
      feeWan: formatWanNumber(q.serviceFee),
      yoy: q.yoy,
      active: false,
      index: i,
    }))
  }
  return annual.value.months.map((m) => ({
    key: m.label,
    label: m.label,
    billWan: formatWanNumber(m.billAmount),
    feeWan: formatWanNumber(m.serviceFee),
    yoy: m.yoy,
    active: m.month === highlightMonth.value,
    index: m.month - 1,
  }))
})

const filteredEnterprises = computed(() => {
  const kw = keyword.value.trim()
  const list = monthly.value.enterprises
  if (!kw) return list
  return list.filter((r) => r.enterpriseName.includes(kw))
})

const pagedEnterprises = computed(() => {
  const start = (page.value - 1) * pageSize
  return filteredEnterprises.value.slice(start, start + pageSize)
})

const perspective = ref<'enterprise' | 'worker'>('enterprise')

watch(perspective, (v) => {
  if (v === 'worker') goWorker()
})

watch(timeDimension, (v) => {
  if (v === 'month') {
    month.value = `${year.value}-${pad(highlightMonth.value)}`
  } else {
    year.value = Number(month.value.slice(0, 4))
  }
})

watch(month, (v) => {
  year.value = Number(v.slice(0, 4))
  highlightMonth.value = Number(v.slice(5, 7))
})

function onExport() {
  const label =
    timeDimension.value === 'year' ? `${year.value}年度` : monthly.value.label
  ElMessage.success(`已导出企业结算${label}报表（演示）`)
}

function goWorker() {
  router.push(`${pathPrefix.value}/statistics/settlement/worker`)
}

function selectMonthRow(row: { index: number }) {
  if (grain.value !== 'month') return
  highlightMonth.value = row.index + 1
  if (timeDimension.value === 'year') {
    // 双击语义：切到按月维度看该月
  }
}

function drillMonth(row: { index: number }) {
  if (grain.value !== 'month') return
  highlightMonth.value = row.index + 1
  month.value = `${year.value}-${pad(row.index + 1)}`
  timeDimension.value = 'month'
}

function rowClassName({ row }: { row: { active?: boolean } }) {
  return row.active ? 'row-active' : ''
}
</script>

<template>
  <div class="stats-page">
    <div class="stats-header">
      <div class="header-left">
        <div class="title-row">
          <h2 class="page-title">{{ pageTitle }}</h2>
          <el-radio-group v-model="perspective" size="small" class="perspective-tabs">
            <el-radio-button value="enterprise">企业结算分析</el-radio-button>
            <el-radio-button value="worker">灵工结算分析</el-radio-button>
          </el-radio-group>
        </div>
        <p class="text-muted">账单 + 垫资全流程 · 支持年度 / 按月维度切换</p>
      </div>
      <el-button type="primary" @click="onExport">
        <el-icon class="btn-icon"><Download /></el-icon>
        导出报表
      </el-button>
    </div>

    <div class="filter-bar">
      <el-radio-group v-model="timeDimension" size="default">
        <el-radio-button value="year">按年</el-radio-button>
        <el-radio-button value="month">按月</el-radio-button>
      </el-radio-group>

      <template v-if="timeDimension === 'year'">
        <el-select v-model="year" style="width: 140px">
          <el-option
            v-for="y in yearOptions"
            :key="y"
            :label="`${y} 年度`"
            :value="y"
          />
        </el-select>
        <el-radio-group v-model="year" size="default">
          <el-radio-button v-for="y in yearOptions.slice(0, 3)" :key="y" :value="y">
            {{ y }}
          </el-radio-button>
        </el-radio-group>
      </template>

      <el-date-picker
        v-else
        v-model="month"
        type="month"
        value-format="YYYY-MM"
        placeholder="选择月份"
        style="width: 150px"
      />

      <el-select v-model="regionFilter" clearable placeholder="全部区域" style="width: 140px">
        <el-option v-for="r in regionOptions" :key="r" :label="r" :value="r === '全部区域' ? '' : r" />
      </el-select>
      <el-select
        v-if="!isEnterprise"
        v-model="enterpriseFilter"
        clearable
        filterable
        placeholder="全部企业"
        style="width: 180px"
      >
        <el-option
          v-for="e in enterpriseOptions"
          :key="e.id"
          :label="e.name"
          :value="e.id"
        />
      </el-select>
      <el-checkbox v-model="showYoy" class="yoy-check">显示上年同期</el-checkbox>
    </div>

    <el-row :gutter="16" class="kpi-row">
      <el-col :xs="24" :sm="12" :lg="6">
        <div class="metric-card">
          <div class="metric-label">{{ timeDimension === 'year' ? '年度' : '本月' }}账单金额</div>
          <div class="metric-value">{{ formatCompactMoney(activeSummary.billTotal) }}</div>
          <div class="metric-trend" :class="activeSummary.billYoy.up ? 'up' : 'down'">
            {{ activeSummary.billYoy.up ? '↑' : '↓' }} {{ activeSummary.billYoy.text }} 同比
          </div>
          <div
            v-if="timeDimension === 'month' && 'billMom' in activeSummary"
            class="metric-sub"
          >
            环比 {{ (activeSummary as typeof monthly.summary).billMom.text }}
          </div>
        </div>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6">
        <div class="metric-card">
          <div class="metric-label">{{ timeDimension === 'year' ? '年度' : '本月' }}服务费收入</div>
          <div class="metric-value">{{ formatCompactMoney(activeSummary.serviceFee) }}</div>
          <div class="metric-trend" :class="activeSummary.feeYoy.up ? 'up' : 'down'">
            {{ activeSummary.feeYoy.up ? '↑' : '↓' }} {{ activeSummary.feeYoy.text }} 同比
          </div>
        </div>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6">
        <div class="metric-card">
          <div class="metric-label">{{ timeDimension === 'year' ? '年度累计' : '本月' }}垫资</div>
          <div class="metric-value">{{ formatCompactMoney(activeSummary.advance) }}</div>
          <div class="metric-sub">垫资占比 {{ activeSummary.advanceRatio }}%</div>
        </div>
      </el-col>
      <el-col :xs="24" :sm="12" :lg="6">
        <div class="metric-card collection-card">
          <div class="collection-text">
            <div class="metric-label">{{ timeDimension === 'year' ? '年度' : '本月' }}回款</div>
            <div class="metric-sub">已回款 {{ formatCompactMoney(activeSummary.paid) }}</div>
            <div class="metric-sub warn">待回款 {{ formatCompactMoney(activeSummary.receivable) }}</div>
          </div>
          <div class="collection-ring" :style="collectionRingStyle">
            <div class="collection-ring-inner">{{ activeSummary.collectionRate }}%</div>
          </div>
        </div>
      </el-col>
    </el-row>

    <StatPanel
      :title="timeDimension === 'year' ? '本年度账单 / 服务费趋势' : `${monthly.label} · 近6月账单 / 服务费趋势`"
    >
      <template v-if="timeDimension === 'year'" #extra>
        <el-radio-group v-model="grain" size="small">
          <el-radio-button value="month">月</el-radio-button>
          <el-radio-button value="quarter">季</el-radio-button>
        </el-radio-group>
      </template>
      <VChart :option="trendOption" height="320px" />
    </StatPanel>

    <StatPanel v-if="timeDimension === 'year'" :title="`${year} 年度明细`">
      <template #extra>
        <span class="hint">点击月份可下钻到按月分析</span>
      </template>
      <el-table
        :data="tableRows"
        border
        stripe
        :row-class-name="rowClassName"
        @row-click="selectMonthRow"
        @row-dblclick="drillMonth"
      >
        <el-table-column prop="label" :label="grain === 'month' ? '月份' : '季度'" width="100" />
        <el-table-column label="账单金额(万)" align="right" min-width="120">
          <template #default="{ row }">{{ row.billWan }}</template>
        </el-table-column>
        <el-table-column label="服务费(万)" align="right" min-width="110">
          <template #default="{ row }">{{ row.feeWan }}</template>
        </el-table-column>
        <el-table-column label="同比" width="120" align="right">
          <template #default="{ row }">
            <span :class="row.yoy.up ? 'up' : 'down'">
              {{ row.yoy.up ? '↑' : '↓' }} {{ row.yoy.text }}
            </span>
          </template>
        </el-table-column>
        <el-table-column v-if="grain === 'month'" label="操作" width="100" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click.stop="drillMonth(row)">按月查看</el-button>
          </template>
        </el-table-column>
      </el-table>
    </StatPanel>

    <StatPanel v-else :title="`${monthly.label} · 企业结算明细`">
      <template #extra>
        <el-input
          v-model="keyword"
          placeholder="搜索企业"
          clearable
          prefix-icon="Search"
          style="width: 200px"
          @input="page = 1"
        />
      </template>
      <el-empty
        v-if="!filteredEnterprises.length"
        description="当月暂无企业账单明细（可用上方趋势查看补齐口径）"
        :image-size="72"
      />
      <template v-else>
        <el-table :data="pagedEnterprises" border stripe>
          <el-table-column prop="enterpriseName" label="用工企业" min-width="160" />
          <el-table-column prop="billCount" label="账单数" width="80" align="center" />
          <el-table-column label="账单金额" width="130" align="right">
            <template #default="{ row }">{{ formatMoney(row.billTotal) }}</template>
          </el-table-column>
          <el-table-column label="应发薪资" width="120" align="right">
            <template #default="{ row }">{{ formatMoney(row.payroll) }}</template>
          </el-table-column>
          <el-table-column label="服务费" width="110" align="right">
            <template #default="{ row }">{{ formatMoney(row.serviceFee) }}</template>
          </el-table-column>
          <el-table-column label="已回款" width="120" align="right">
            <template #default="{ row }"><span class="up">{{ formatMoney(row.paid) }}</span></template>
          </el-table-column>
          <el-table-column label="垫资" width="120" align="right">
            <template #default="{ row }"><span class="warn-text">{{ formatMoney(row.advance) }}</span></template>
          </el-table-column>
        </el-table>
        <div class="table-footer">
          <span class="text-muted">共 {{ filteredEnterprises.length }} 家企业</span>
          <el-pagination
            v-model:current-page="page"
            :page-size="pageSize"
            layout="prev, pager, next"
            :total="filteredEnterprises.length"
            background
          />
        </div>
      </template>
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
.title-row {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}
.page-title {
  margin: 0;
  font-size: 20px;
}
.perspective-tabs {
  margin-left: 4px;
}
.btn-icon {
  margin-right: 4px;
  vertical-align: -2px;
}
.filter-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
  background: #fff;
  border-radius: 12px;
  padding: 14px 16px;
  border: 1px solid var(--app-border);
}
.yoy-check {
  margin-left: auto;
}
.kpi-row .el-col {
  margin-bottom: 16px;
}
.metric-card {
  background: #fff;
  border-radius: 12px;
  padding: 18px 20px;
  border: 1px solid var(--app-border);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  height: 100%;
  min-height: 118px;
}
.metric-label {
  font-size: 13px;
  color: #909399;
}
.metric-value {
  margin-top: 8px;
  font-size: 26px;
  font-weight: 700;
  color: #1a1a2e;
  line-height: 1.2;
}
.metric-trend {
  margin-top: 8px;
  font-size: 12px;
}
.metric-trend.up,
.up {
  color: #52c41a;
  font-weight: 600;
}
.metric-trend.down,
.down {
  color: #f5222d;
  font-weight: 600;
}
.metric-sub {
  margin-top: 6px;
  font-size: 12px;
  color: #909399;
}
.metric-sub.warn,
.warn-text {
  color: #fa8c16;
  font-weight: 600;
}
.collection-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.collection-ring {
  width: 68px;
  height: 68px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.collection-ring-inner {
  width: 50px;
  height: 50px;
  border-radius: 50%;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  color: #3b6ff5;
}
.hint {
  font-size: 12px;
  color: #909399;
}
.table-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 12px;
  flex-wrap: wrap;
  gap: 8px;
}
:deep(.row-active) {
  background: #eef3ff !important;
}
:deep(.el-table__row) {
  cursor: pointer;
}
</style>
