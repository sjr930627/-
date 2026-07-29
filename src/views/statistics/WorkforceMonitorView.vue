<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { registerMap } from 'echarts/core'
import VChart from '@/components/statistics/VChart.vue'
import type { BiDrillPerson, BiKpiItem } from '@/mock/workforceBiSeed'
import {
  cityHeatPoints,
  regionOnDuty,
  liveFeeds,
  teamKpis,
  teamDeptHeadcount,
  teamHireChurn12m,
  teamStatusPie,
  teamTenureHist,
  attendanceKpis,
  attendanceDailyTrend,
  attendanceDeptRank,
  attendanceLateHeat,
  trainingStats,
  missingPunchAlert,
  payrollKpis,
  payrollTrend12m,
  payrollDeptPie,
  insuranceDailyTrend,
  claimStats,
  feeStacked,
  taskKpis,
  taskTypePie,
  taskDailyActive,
  taskCompleteRank,
  zeroTaskByDept,
  zeroTaskTwoMonthAlert,
  drillLists,
} from '@/mock/workforceBiSeed'
import {
  darkChinaMapOption,
  darkRegionBarOption,
  darkMultiLineOption,
  darkPieOption,
  darkBarOption,
  darkHBarOption,
  darkDualAxisOption,
  darkStackedBarOption,
  darkHeatmapOption,
} from '@/services/workforceMonitorCharts'
import { chartColors } from '@/plugins/echarts'

type BiPage = 'people' | 'ops'

const pages: { key: BiPage; label: string }[] = [
  { key: 'people', label: '人员与分布' },
  { key: 'ops', label: '合规与成本' },
]

const activePage = ref<BiPage>('people')
const now = ref(new Date())
const mapReady = ref(false)
const refreshing = ref(false)
const drillVisible = ref(false)
const drillTitle = ref('')
const drillList = ref<BiDrillPerson[]>([])
let clockTimer: ReturnType<typeof setInterval> | null = null

const clockText = computed(() =>
  now.value.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
)

const mapOption = computed(() => (mapReady.value ? darkChinaMapOption(cityHeatPoints) : null))
const regionOption = computed(() => darkRegionBarOption(regionOnDuty))
const tickerItems = [...liveFeeds, ...liveFeeds]

const teamCharts = computed(() => ({
  dept: darkBarOption(teamDeptHeadcount.map((d) => d.name), teamDeptHeadcount.map((d) => d.count)),
  hireChurn: darkMultiLineOption(teamHireChurn12m.labels, [
    { name: '入职', data: teamHireChurn12m.hire, color: chartColors.green, area: true },
    { name: '流失', data: teamHireChurn12m.churn, color: chartColors.red, area: true },
  ]),
  status: darkPieOption(teamStatusPie),
  tenure: darkBarOption(teamTenureHist.map((t) => t.name), teamTenureHist.map((t) => t.value), chartColors.purple),
}))

const attendanceCharts = computed(() => ({
  daily: darkMultiLineOption(attendanceDailyTrend.labels, [
    { name: '出勤率', data: attendanceDailyTrend.rates, color: chartColors.green, area: true },
  ], 100),
  dept: darkHBarOption(attendanceDeptRank.map((d) => ({ name: d.name, value: d.rate })), { unit: '%', warnBelow: 50, max: 100 }),
  heat: darkHeatmapOption(attendanceLateHeat.days, attendanceLateHeat.depts, attendanceLateHeat.data),
  training: darkPieOption([
    { name: '已完成', value: trainingStats.completionRate, color: chartColors.green },
    { name: '未完成', value: 100 - trainingStats.completionRate, color: '#ebeef5' },
  ], { donut: true, centerText: `${trainingStats.completionRate}%\n完成率` }),
}))

const payrollCharts = computed(() => ({
  trend: darkDualAxisOption(
    payrollTrend12m.labels,
    { name: '薪酬(万)', data: payrollTrend12m.payroll, color: chartColors.blue },
    { name: '服务费(万)', data: payrollTrend12m.fee, color: chartColors.orange },
  ),
  dept: darkPieOption(payrollDeptPie),
  insurance: darkMultiLineOption(insuranceDailyTrend.labels, [
    { name: '投保人次', data: insuranceDailyTrend.counts, color: chartColors.green, area: true },
  ]),
  fee: darkStackedBarOption(feeStacked.labels, [
    { name: '基础服务费', data: feeStacked.base, color: chartColors.blue },
    { name: '管理费', data: feeStacked.manage, color: chartColors.purple },
  ]),
}))

const taskCharts = computed(() => ({
  type: darkPieOption(taskTypePie),
  active: darkMultiLineOption(taskDailyActive.labels, [
    { name: '活跃人数', data: taskDailyActive.counts, color: chartColors.blue, area: true },
  ]),
  complete: darkHBarOption(taskCompleteRank.map((d) => ({ name: d.name, value: d.rate })), { unit: '%', max: 100 }),
  zero: darkHBarOption(zeroTaskByDept.map((d) => ({ name: d.name, value: d.ratio })), { unit: '%', warnBelow: 20, max: 40 }),
}))

function formatNum(n: number | string) {
  return typeof n === 'number' ? n.toLocaleString('zh-CN') : n
}

function openDrill(kpi: BiKpiItem) {
  drillTitle.value = kpi.label
  drillList.value = drillLists[kpi.key] ?? []
  drillVisible.value = true
}

async function loadChinaMap() {
  try {
    const res = await fetch('https://geo.datav.aliyun.com/areas_v3/bound/100000_full.json')
    if (!res.ok) throw new Error('map fetch failed')
    registerMap('china', await res.json())
    mapReady.value = true
  } catch {
    mapReady.value = false
  }
}

function handleRefresh() {
  refreshing.value = true
  setTimeout(() => { now.value = new Date(); refreshing.value = false }, 600)
}

onMounted(() => {
  loadChinaMap()
  clockTimer = setInterval(() => { now.value = new Date() }, 1000)
})
onUnmounted(() => { if (clockTimer) clearInterval(clockTimer) })
</script>

<template>
  <div class="bi-screen">
    <header class="bi-header">
      <div class="bi-title-wrap">
        <div class="bi-title-accent" />
        <h1 class="bi-title">灵工人员数据监控中心</h1>
      </div>
      <div class="bi-header-right">
        <span class="bi-clock">{{ clockText }}</span>
        <button class="bi-refresh" :class="{ spinning: refreshing }" @click="handleRefresh">
          <span class="dot" />刷新数据
        </button>
        <router-link to="/dashboard" class="bi-back">
          <el-button size="small">返回后台</el-button>
        </router-link>
      </div>
    </header>

    <nav class="bi-tabs">
      <button
        v-for="p in pages"
        :key="p.key"
        class="bi-tab"
        :class="{ active: activePage === p.key }"
        @click="activePage = p.key"
      >
        {{ p.label }}
      </button>
    </nav>

    <!-- 页面一：人员与分布 -->
    <div v-show="activePage === 'people'" class="tab-panel">
      <div class="map-row">
        <div class="panel panel-map">
          <div class="panel-head"><span class="panel-icon">▮</span>全国在岗人数热力分布</div>
          <VChart v-if="mapOption" :option="mapOption" height="300px" />
          <div v-else class="map-fallback">地图加载中…</div>
        </div>
        <div class="panel panel-region">
          <div class="panel-head"><span class="panel-icon">▮</span>各地区在岗人数</div>
          <VChart :option="regionOption" height="300px" />
        </div>
      </div>

      <h2 class="section-title">队伍状态</h2>
      <div class="kpi-row kpi-4">
        <div v-for="kpi in teamKpis" :key="kpi.key" class="kpi-card clickable" @click="openDrill(kpi)">
          <div class="kpi-body">
            <div class="kpi-label">{{ kpi.label }}</div>
            <div class="kpi-value">{{ formatNum(kpi.value) }}<span v-if="kpi.suffix" class="kpi-suffix">{{ kpi.suffix }}</span></div>
            <div v-if="kpi.progress" class="kpi-progress"><div class="kpi-progress-bar" :style="{ width: `${kpi.progress}%` }" /></div>
            <div v-if="kpi.trend !== undefined" class="kpi-trend" :class="kpi.trend >= 0 ? 'up' : 'down'">
              {{ kpi.trend >= 0 ? '↑' : '↓' }} {{ Math.abs(kpi.trend) }}% {{ kpi.trendLabel }}
            </div>
          </div>
        </div>
      </div>
      <div class="panel-grid">
        <div class="panel"><div class="panel-head"><span class="panel-icon">▮</span>部门/网格人数分布</div><VChart :option="teamCharts.dept" height="200px" /></div>
        <div class="panel"><div class="panel-head"><span class="panel-icon">▮</span>入职/流失趋势（近12月）</div><VChart :option="teamCharts.hireChurn" height="200px" /></div>
        <div class="panel"><div class="panel-head"><span class="panel-icon">▮</span>人员状态结构</div><VChart :option="teamCharts.status" height="200px" /></div>
        <div class="panel"><div class="panel-head"><span class="panel-icon">▮</span>在岗时长分布</div><VChart :option="teamCharts.tenure" height="200px" /></div>
      </div>

      <h2 class="section-title">任务活力</h2>
      <div class="kpi-row kpi-4">
        <div v-for="kpi in taskKpis" :key="kpi.key" class="kpi-card clickable" @click="openDrill(kpi)">
          <div class="kpi-body">
            <div class="kpi-label">{{ kpi.label }}</div>
            <div class="kpi-value">{{ formatNum(kpi.value) }}<span v-if="kpi.suffix" class="kpi-suffix">{{ kpi.suffix }}</span></div>
            <div v-if="kpi.trend !== undefined" class="kpi-trend" :class="kpi.trend >= 0 ? 'up' : 'down'">
              {{ kpi.trend >= 0 ? '↑' : '↓' }} {{ Math.abs(kpi.trend) }}% {{ kpi.trendLabel }}
            </div>
          </div>
        </div>
      </div>
      <div class="panel-grid">
        <div class="panel"><div class="panel-head"><span class="panel-icon">▮</span>任务类型分布</div><VChart :option="taskCharts.type" height="200px" /></div>
        <div class="panel span-2"><div class="panel-head"><span class="panel-icon">▮</span>接单人日活跃趋势</div><VChart :option="taskCharts.active" height="200px" /></div>
        <div class="panel"><div class="panel-head"><span class="panel-icon">▮</span>任务完成率排行</div><VChart :option="taskCharts.complete" height="200px" /></div>
        <div class="panel"><div class="panel-head"><span class="panel-icon">▮</span>零接单人员部门占比</div><VChart :option="taskCharts.zero" height="200px" /></div>
      </div>
      <div class="alert-panel">
        <div class="panel-head warn"><span class="panel-icon">▮</span>连续两月零接单预警</div>
        <div class="alert-list">
          <div v-for="a in zeroTaskTwoMonthAlert" :key="a.id" class="alert-row">
            <span class="alert-name">{{ a.name }}</span>
            <span class="alert-dept">{{ a.department }}</span>
            <span class="alert-detail">{{ a.detail }}</span>
            <span class="alert-extra">{{ a.extra }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- 页面二：合规与成本 -->
    <div v-show="activePage === 'ops'" class="tab-panel">
      <h2 class="section-title">考勤合规</h2>
      <div class="kpi-row kpi-4">
        <div v-for="kpi in attendanceKpis" :key="kpi.key" class="kpi-card clickable" @click="openDrill(kpi)">
          <div class="kpi-body">
            <div class="kpi-label">{{ kpi.label }}</div>
            <div class="kpi-value">{{ formatNum(kpi.value) }}<span v-if="kpi.suffix" class="kpi-suffix">{{ kpi.suffix }}</span></div>
            <div v-if="kpi.trend !== undefined" class="kpi-trend" :class="kpi.trend >= 0 ? 'up' : 'down'">
              {{ kpi.trend >= 0 ? '↑' : '↓' }} {{ Math.abs(kpi.trend) }}% {{ kpi.trendLabel }}
            </div>
          </div>
        </div>
      </div>
      <div class="panel-grid">
        <div class="panel span-2"><div class="panel-head"><span class="panel-icon">▮</span>出勤率日趋势（本月）</div><VChart :option="attendanceCharts.daily" height="200px" /></div>
        <div class="panel"><div class="panel-head"><span class="panel-icon">▮</span>培训完成率</div><VChart :option="attendanceCharts.training" height="200px" /><p class="panel-note">考试通过率 {{ trainingStats.passRate }}%</p></div>
        <div class="panel"><div class="panel-head"><span class="panel-icon">▮</span>部门出勤率排行</div><VChart :option="attendanceCharts.dept" height="200px" /></div>
        <div class="panel span-2"><div class="panel-head"><span class="panel-icon">▮</span>迟到早退分布热力</div><VChart :option="attendanceCharts.heat" height="180px" /></div>
      </div>
      <div class="alert-panel">
        <div class="panel-head warn"><span class="panel-icon">▮</span>连续3天缺卡预警</div>
        <div class="alert-list">
          <div v-for="a in missingPunchAlert" :key="a.id" class="alert-row">
            <span class="alert-name">{{ a.name }}</span>
            <span class="alert-dept">{{ a.department }}</span>
            <span class="alert-detail">{{ a.detail }}</span>
            <span class="alert-extra">{{ a.extra }}</span>
          </div>
        </div>
      </div>

      <h2 class="section-title">薪酬保险</h2>
      <div class="kpi-row kpi-4">
        <div v-for="kpi in payrollKpis" :key="kpi.key" class="kpi-card clickable" @click="openDrill(kpi)">
          <div class="kpi-body">
            <div class="kpi-label">{{ kpi.label }}</div>
            <div class="kpi-value">{{ formatNum(kpi.value) }}<span v-if="kpi.suffix" class="kpi-suffix">{{ kpi.suffix }}</span></div>
            <div v-if="kpi.trend !== undefined" class="kpi-trend" :class="kpi.trend >= 0 ? 'up' : 'down'">
              {{ kpi.trend >= 0 ? '↑' : '↓' }} {{ Math.abs(kpi.trend) }}% {{ kpi.trendLabel }}
            </div>
          </div>
        </div>
      </div>
      <div class="panel-grid">
        <div class="panel span-2"><div class="panel-head"><span class="panel-icon">▮</span>月度薪酬与服务费趋势</div><VChart :option="payrollCharts.trend" height="200px" /></div>
        <div class="panel"><div class="panel-head"><span class="panel-icon">▮</span>薪酬部门分布</div><VChart :option="payrollCharts.dept" height="200px" /></div>
        <div class="panel span-2"><div class="panel-head"><span class="panel-icon">▮</span>保险投保日趋势</div><VChart :option="payrollCharts.insurance" height="200px" /></div>
        <div class="panel"><div class="panel-head"><span class="panel-icon">▮</span>服务费构成</div><VChart :option="payrollCharts.fee" height="200px" /></div>
      </div>
      <div class="claim-row">
        <div class="claim-card"><span class="claim-label">本月理赔件数</span><span class="claim-val">{{ claimStats.count }}</span><span class="claim-trend" :class="claimStats.countTrend >= 0 ? 'up' : 'down'">{{ claimStats.countTrend >= 0 ? '+' : '' }}{{ claimStats.countTrend }} 较上月</span></div>
        <div class="claim-card"><span class="claim-label">理赔金额（万）</span><span class="claim-val">{{ claimStats.amount }}</span><span class="claim-trend up">+{{ claimStats.amountTrend }}% 较上月</span></div>
        <div class="claim-card"><span class="claim-label">结案率</span><span class="claim-val">{{ claimStats.closeRate }}%</span></div>
      </div>
    </div>

    <footer class="bi-ticker">
      <span class="ticker-label">实时动态</span>
      <div class="ticker-track">
        <div class="ticker-content">
          <span v-for="(item, idx) in tickerItems" :key="`${item.id}-${idx}`" class="ticker-item">
            <span class="ticker-dot" />{{ item.text }}<span class="ticker-time">{{ item.time }}</span>
          </span>
        </div>
      </div>
    </footer>

    <el-drawer v-model="drillVisible" :title="`${drillTitle} · 人员明细`" size="480px" append-to-body>
      <el-empty v-if="!drillList.length" description="暂无明细数据（演示）" />
      <el-table v-else :data="drillList" stripe size="small">
        <el-table-column prop="name" label="姓名" width="80" />
        <el-table-column prop="employeeNo" label="工号" width="100" />
        <el-table-column prop="department" label="部门" min-width="100" />
        <el-table-column prop="detail" label="详情" min-width="100" />
        <el-table-column prop="extra" label="备注" width="100" />
      </el-table>
    </el-drawer>
  </div>
</template>

<style scoped>
.bi-screen {
  min-height: 100vh;
  background: #fff;
  color: var(--app-text);
  padding: 16px 20px 52px;
  box-sizing: border-box;
}

.bi-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--app-border);
}

.bi-title-wrap { display: flex; align-items: center; gap: 12px; }
.bi-title-accent { width: 4px; height: 28px; background: linear-gradient(180deg, var(--app-primary), #ff4d4f); border-radius: 2px; }
.bi-title { margin: 0; font-size: 18px; font-weight: 600; color: #1a1a2e; letter-spacing: 0.3px; }
.bi-header-right { display: flex; align-items: center; gap: 12px; }
.bi-clock { font-size: 13px; color: var(--app-text-secondary); font-variant-numeric: tabular-nums; }
.bi-refresh {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  background: #fff;
  color: var(--app-text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.bi-refresh:hover { border-color: var(--app-primary); color: var(--app-primary); background: var(--app-primary-light); }
.bi-refresh .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--app-primary); animation: pulse 1.5s infinite; }
.bi-back { text-decoration: none; }

.bi-tabs {
  display: inline-flex;
  gap: 6px;
  margin-bottom: 16px;
  padding: 3px;
  border-radius: 8px;
  background: #fafafa;
  border: 1px solid var(--app-border);
}

.bi-tab {
  padding: 6px 16px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--app-text-secondary);
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.bi-tab:hover { color: var(--app-primary); background: var(--app-primary-light); }
.bi-tab.active {
  background: var(--app-primary);
  color: #fff;
  font-weight: 600;
}

.map-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 16px;
}

.panel-map,
.panel-region {
  min-width: 0;
}

.section-title {
  margin: 20px 0 12px;
  padding-left: 10px;
  border-left: 3px solid var(--app-primary);
  font-size: 15px;
  font-weight: 600;
  color: #1a1a2e;
}
.section-title:first-child { margin-top: 0; }

.tab-panel { animation: fadeIn 0.2s ease; }
@keyframes fadeIn { from { opacity: 0; transform: translateY(4px); } to { opacity: 1; transform: none; } }

.kpi-row { display: grid; gap: 16px; margin-bottom: 16px; }
.kpi-4 { grid-template-columns: repeat(4, 1fr); }

.kpi-card {
  padding: 18px 20px;
  background: #fff;
  border: 1px solid var(--app-border);
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.kpi-card.clickable { cursor: pointer; transition: border-color 0.15s, box-shadow 0.15s; }
.kpi-card.clickable:hover { border-color: var(--app-primary-light-5, #f599a3); box-shadow: 0 2px 8px rgba(230, 0, 18, 0.08); }

.kpi-label { font-size: 13px; color: #909399; margin-bottom: 4px; }
.kpi-value { font-size: 28px; font-weight: 700; font-variant-numeric: tabular-nums; color: #1a1a2e; }
.kpi-suffix { font-size: 14px; margin-left: 2px; font-weight: 500; }
.kpi-trend { margin-top: 8px; font-size: 12px; }
.kpi-trend.up { color: #52c41a; }
.kpi-trend.down { color: #f5222d; }

.kpi-progress { margin-top: 8px; height: 4px; background: #f0f0f0; border-radius: 2px; overflow: hidden; }
.kpi-progress-bar { height: 100%; background: linear-gradient(90deg, var(--app-primary), #ff4d4f); border-radius: 2px; }

.panel-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 16px; }
.span-2 { grid-column: span 2; }

.panel {
  background: #fff;
  border: 1px solid var(--app-border);
  border-radius: 12px;
  padding: 16px 20px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  position: relative;
}

.panel-head { display: flex; align-items: center; gap: 6px; font-size: 15px; font-weight: 600; color: #1a1a2e; margin-bottom: 12px; }
.panel-head.warn { color: #e6a23c; }
.panel-icon { color: var(--app-primary); font-size: 12px; }
.panel-note { margin: 4px 0 0; font-size: 11px; color: #909399; text-align: center; }

.map-fallback { height: 300px; display: flex; align-items: center; justify-content: center; color: #909399; }

.alert-panel {
  background: #fef0f0;
  border: 1px solid #fde2e2;
  border-radius: 12px;
  padding: 16px 20px;
}

.alert-list { display: flex; flex-direction: column; gap: 8px; }
.alert-row {
  display: grid;
  grid-template-columns: 80px 120px 1fr 100px;
  gap: 8px;
  font-size: 12px;
  padding: 10px 12px;
  background: #fff;
  border: 1px solid var(--app-border);
  border-radius: 8px;
}

.alert-name { color: #303133; font-weight: 600; }
.alert-dept { color: #909399; }
.alert-detail { color: #e6a23c; }
.alert-extra { color: #909399; text-align: right; }

.claim-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; }
.claim-card {
  padding: 18px 20px;
  background: #fff;
  border: 1px solid var(--app-border);
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}
.claim-label { display: block; font-size: 13px; color: #909399; margin-bottom: 6px; }
.claim-val { font-size: 28px; font-weight: 700; color: var(--app-primary); }
.claim-trend { display: block; margin-top: 4px; font-size: 12px; }
.claim-trend.up { color: #52c41a; }
.claim-trend.down { color: #f5222d; }

.bi-ticker {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  height: 36px;
  background: #fff;
  border-top: 1px solid var(--app-border);
  box-shadow: 0 -1px 4px rgba(0, 0, 0, 0.04);
  display: flex;
  align-items: center;
  padding: 0 20px;
  gap: 16px;
  z-index: 100;
}

.ticker-label {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--app-primary);
  padding-right: 12px;
  border-right: 1px solid var(--app-border);
}
.ticker-track { flex: 1; overflow: hidden; mask-image: linear-gradient(90deg, transparent, #000 5%, #000 95%, transparent); }
.ticker-content { display: flex; gap: 48px; animation: marquee 40s linear infinite; white-space: nowrap; }
.ticker-item { font-size: 12px; color: #909399; }
.ticker-dot { display: inline-block; width: 5px; height: 5px; border-radius: 50%; background: var(--app-primary); margin-right: 6px; vertical-align: middle; }
.ticker-time { margin-left: 8px; color: var(--app-text-secondary); }

@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.3; } }
@keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } }

@media (max-width: 1200px) {
  .kpi-4, .panel-grid, .claim-row { grid-template-columns: 1fr 1fr; }
  .map-row { grid-template-columns: 1fr; }
  .span-2 { grid-column: span 2; }
}
@media (max-width: 768px) {
  .kpi-4, .panel-grid, .claim-row { grid-template-columns: 1fr; }
  .span-2 { grid-column: span 1; }
}
</style>
