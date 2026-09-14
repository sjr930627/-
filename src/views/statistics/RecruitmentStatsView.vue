<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { usePortal } from '@/composables/usePortal'
import StatKpiCard from '@/components/statistics/StatKpiCard.vue'
import StatPanel from '@/components/statistics/StatPanel.vue'
import VChart from '@/components/statistics/VChart.vue'
import { WORKBENCH_DEMO_NOW } from '@/constants/workbenchReminder'
import { recruitmentLeadStatusMap } from '@/constants/recruitment'
import { barChartOption, funnelChartOption } from '@/services/statisticsCharts'
import { chartColors } from '@/plugins/echarts'
import {
  buildRecruitmentAnalysisFunnel,
  resolveDashboardWindow,
  retentionRate,
} from '@/services/businessDashboard'
import type { RecruitmentLead, RecruitmentLeadStatus } from '@/types'

const store = useAppStore()
const route = useRoute()
const router = useRouter()
const { isEnterprise } = usePortal()

const enterpriseFilter = ref<string[]>([])
const deptFilter = ref<string[]>([])
const channelFilter = ref<string[]>([])
const ownerFilter = ref<string[]>([])
const dateRange = ref<[string, string] | null>(null)
const dimension = ref<'enterprise' | 'department' | 'channel' | 'owner'>('enterprise')
const stageFilter = ref<string>((route.query.stage as string) || '')
const subscribeVisible = ref(false)
const subscribeForm = ref({ cycle: 'weekly', roles: ['hr'] as string[] })

const defaultWindow = resolveDashboardWindow('month', WORKBENCH_DEMO_NOW)

watch(
  () => route.query.stage,
  (v) => {
    stageFilter.value = typeof v === 'string' ? v : ''
  },
)

if (!dateRange.value) {
  dateRange.value = [defaultWindow.start, defaultWindow.end]
}

const enterpriseOptions = computed(() => {
  if (isEnterprise.value) {
    const cur = store.currentEnterprise
    return cur ? [{ id: cur.id, name: cur.name }] : []
  }
  return store.enterprises.map((e) => ({ id: e.id, name: e.name }))
})

const departmentOptions = computed(() => {
  const ents = enterpriseFilter.value.length
    ? new Set(enterpriseFilter.value)
    : isEnterprise.value
      ? new Set([store.currentEnterpriseId])
      : null
  return store.departments
    .filter((d) => d.id !== 'dept_root')
    .filter((d) => !ents || (d.enterpriseId && ents.has(d.enterpriseId)))
    .map((d) => ({ id: d.id, name: d.name }))
})

const channelOptions = ['自有', '猎头', '内推', 'RPO', '线上投放', '线下招聘']

const ownerOptions = computed(() => {
  const set = new Set<string>()
  for (const l of store.recruitmentLeads) {
    if (l.assignedTo) set.add(l.assignedTo)
    if (l.interviewer) set.add(l.interviewer)
  }
  return [...set]
})

function normalizeChannel(source: string) {
  if (/猎头/.test(source)) return '猎头'
  if (/内推|推荐/.test(source)) return '内推'
  if (/RPO|外包/.test(source)) return 'RPO'
  if (/线上|招聘网站|Boss|智联/.test(source)) return '线上投放'
  if (/线下|现场/.test(source)) return '线下招聘'
  return '自有'
}

const filteredLeads = computed(() => {
  let list = store.recruitmentLeads as RecruitmentLead[]
  if (isEnterprise.value && store.currentEnterpriseId) {
    list = list.filter((l) => l.enterpriseId === store.currentEnterpriseId)
  }
  if (enterpriseFilter.value.length) {
    const set = new Set(enterpriseFilter.value)
    list = list.filter((l) => set.has(l.enterpriseId))
  }
  if (deptFilter.value.length) {
    const reqDept = new Map(
      store.jobRequirements.map((j) => [j.id, j.departmentId || j.department]),
    )
    const set = new Set(deptFilter.value)
    list = list.filter((l) => {
      const d = reqDept.get(l.requirementId)
      return d ? set.has(d) || [...set].some((id) => d === id || String(d).includes(id)) : false
    })
  }
  if (channelFilter.value.length) {
    const set = new Set(channelFilter.value)
    list = list.filter((l) => set.has(normalizeChannel(l.source)))
  }
  if (ownerFilter.value.length) {
    const set = new Set(ownerFilter.value)
    list = list.filter((l) => set.has(l.assignedTo || '') || set.has(l.interviewer || ''))
  }
  if (dateRange.value) {
    const [start, end] = dateRange.value
    list = list.filter((l) => {
      const day = l.createdAt.slice(0, 10)
      return day >= start && day <= end
    })
  }
  return list
})

const funnel = computed(() =>
  buildRecruitmentAnalysisFunnel(
    filteredLeads.value,
    dateRange.value?.[0],
    dateRange.value?.[1],
  ),
)

const funnelOption = computed(() =>
  funnelChartOption(funnel.value.stages.map((s) => ({ name: s.label, value: s.count }))),
)

const retain30 = computed(() => retentionRate(store.employees, 30))
const retain90 = computed(() => retentionRate(store.employees, 90))

const stageStatusMap: Record<string, RecruitmentLeadStatus[]> = {
  clue: Object.keys(recruitmentLeadStatusMap) as RecruitmentLeadStatus[],
  resume: [
    'screening',
    'interview_pending',
    'interview_attended',
    'feedback_pending',
    'salary_negotiation',
    'background_check',
    'medical_check',
    'onboarding_pending',
    'onboarded',
    'qualified',
  ],
  interview: [
    'interview_pending',
    'interview_attended',
    'feedback_pending',
    'salary_negotiation',
    'background_check',
    'medical_check',
    'onboarding_pending',
    'onboarded',
    'qualified',
  ],
  attended: [
    'interview_attended',
    'feedback_pending',
    'salary_negotiation',
    'background_check',
    'medical_check',
    'onboarding_pending',
    'onboarded',
    'qualified',
  ],
  offer: [
    'salary_negotiation',
    'background_check',
    'medical_check',
    'onboarding_pending',
    'onboarded',
    'qualified',
  ],
  onboarded: ['onboarded', 'qualified'],
}

const detailRows = computed(() => {
  let list = funnel.value.leads
  if (stageFilter.value && stageStatusMap[stageFilter.value]) {
    const set = new Set(stageStatusMap[stageFilter.value])
    list = list.filter((l) => set.has(l.status))
  }
  return list.map((l) => ({
    ...l,
    channel: normalizeChannel(l.source),
    statusLabel: recruitmentLeadStatusMap[l.status] ?? l.status,
    owner: l.assignedTo || l.interviewer || '—',
  }))
})

const gapRows = computed(() => {
  const jobs = store.jobRequirements.filter((j) => {
    if (isEnterprise.value && store.currentEnterpriseId) {
      return j.enterpriseId === store.currentEnterpriseId
    }
    if (enterpriseFilter.value.length) return enterpriseFilter.value.includes(j.enterpriseId)
    return true
  })
  const byDept = new Map<string, { name: string; planned: number; filled: number }>()
  for (const j of jobs) {
    const key = j.departmentId || j.department || '未分配'
    const name =
      store.departments.find((d) => d.id === key)?.name || j.department || key
    const row = byDept.get(key) ?? { name, planned: 0, filled: 0 }
    row.planned += j.headcount
    row.filled += j.filledCount
    byDept.set(key, row)
  }
  return [...byDept.entries()]
    .map(([id, r]) => ({
      departmentId: id,
      departmentName: r.name,
      planned: r.planned,
      filled: r.filled,
      gap: Math.max(0, r.planned - r.filled),
    }))
    .filter((r) => r.gap > 0)
    .sort((a, b) => b.gap - a.gap)
})

const gapOption = computed(() =>
  barChartOption(
    gapRows.value.map((r) => r.departmentName),
    [{ name: '缺口', data: gapRows.value.map((r) => r.gap), color: chartColors.orange }],
    true,
  ),
)

const dimensionRows = computed(() => {
  const map = new Map<string, number>()
  for (const l of filteredLeads.value) {
    let key = '—'
    if (dimension.value === 'enterprise') key = l.enterpriseName
    if (dimension.value === 'channel') key = normalizeChannel(l.source)
    if (dimension.value === 'owner') key = l.assignedTo || l.interviewer || '未分配'
    if (dimension.value === 'department') {
      const job = store.jobRequirements.find((j) => j.id === l.requirementId)
      key =
        store.departments.find((d) => d.id === job?.departmentId)?.name ||
        job?.department ||
        '未分配'
    }
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return [...map.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
})

const dimensionLabel = computed(
  () =>
    ({ enterprise: '企业', department: '部门', channel: '渠道', owner: '负责人' } as const)[
      dimension.value
    ],
)

function onFunnelStage(stageKey: string) {
  stageFilter.value = stageKey
  router.replace({
    path: route.path,
    query: { ...route.query, stage: stageKey },
  })
}

function onExport() {
  ElMessage.success(`已按当前筛选导出 ${detailRows.value.length} 条候选人明细（演示）`)
}

function onSubscribe() {
  subscribeVisible.value = true
}

function saveSubscribe() {
  subscribeVisible.value = false
  ElMessage.success('订阅已保存至规则引擎（演示）')
}

function drillDept(row: { departmentId: string; departmentName: string }) {
  deptFilter.value = [row.departmentId]
  stageFilter.value = ''
  ElMessage.info(`已下钻部门：${row.departmentName}`)
}
</script>

<template>
  <div class="stats-page">
    <div class="stats-header">
      <div>
        <h2 class="page-title">招聘分析</h2>
        <p class="text-muted">线索 → 入职全链路转化 · 部门缺口与留存</p>
      </div>
      <div class="header-actions">
        <el-button @click="onSubscribe">定时推送</el-button>
        <el-button type="primary" @click="onExport">导出 Excel</el-button>
      </div>
    </div>

    <StatPanel title="筛选条件">
      <div class="filters">
        <el-select
          v-if="!isEnterprise"
          v-model="enterpriseFilter"
          multiple
          collapse-tags
          clearable
          placeholder="企业"
          style="width: 200px"
        >
          <el-option v-for="e in enterpriseOptions" :key="e.id" :label="e.name" :value="e.id" />
        </el-select>
        <el-select
          v-model="deptFilter"
          multiple
          collapse-tags
          clearable
          filterable
          placeholder="部门"
          style="width: 200px"
        >
          <el-option v-for="d in departmentOptions" :key="d.id" :label="d.name" :value="d.id" />
        </el-select>
        <el-select
          v-model="channelFilter"
          multiple
          collapse-tags
          clearable
          placeholder="招聘渠道"
          style="width: 180px"
        >
          <el-option v-for="c in channelOptions" :key="c" :label="c" :value="c" />
        </el-select>
        <el-select
          v-model="ownerFilter"
          multiple
          collapse-tags
          clearable
          filterable
          placeholder="招聘负责人"
          style="width: 180px"
        >
          <el-option v-for="o in ownerOptions" :key="o" :label="o" :value="o" />
        </el-select>
        <el-date-picker
          v-model="dateRange"
          type="daterange"
          value-format="YYYY-MM-DD"
          start-placeholder="开始"
          end-placeholder="结束"
          style="width: 260px"
        />
        <el-radio-group v-model="dimension" size="small">
          <el-radio-button value="enterprise">企业</el-radio-button>
          <el-radio-button value="department">部门</el-radio-button>
          <el-radio-button value="channel">渠道</el-radio-button>
          <el-radio-button value="owner">负责人</el-radio-button>
        </el-radio-group>
      </div>
    </StatPanel>

    <el-row :gutter="16" class="kpi-row">
      <el-col v-for="rate in funnel.rates" :key="rate.key" :xs="12" :sm="12" :md="6">
        <StatKpiCard
          :label="rate.label"
          :value="rate.value == null ? '—' : rate.value"
          :suffix="rate.value == null ? undefined : '%'"
          :sub-text="rate.formula"
          color="blue"
        />
      </el-col>
      <el-col :xs="12" :sm="12" :md="6">
        <StatKpiCard
          label="30天留存率"
          :value="retain30 == null ? '—' : retain30"
          :suffix="retain30 == null ? undefined : '%'"
          color="green"
        />
      </el-col>
      <el-col :xs="12" :sm="12" :md="6">
        <StatKpiCard
          label="90天留存率"
          :value="retain90 == null ? '—' : retain90"
          :suffix="retain90 == null ? undefined : '%'"
          color="cyan"
        />
      </el-col>
    </el-row>

    <el-row :gutter="16" class="chart-row">
      <el-col :xs="24" :lg="14">
        <StatPanel title="招聘漏斗">
          <div class="funnel-stages">
            <button
              v-for="s in funnel.stages"
              :key="s.key"
              type="button"
              class="funnel-chip"
              :class="{ active: stageFilter === s.key }"
              @click="onFunnelStage(s.key)"
            >
              <span class="chip-label">{{ s.label }}</span>
              <span class="chip-count">{{ s.count }}</span>
            </button>
          </div>
          <VChart :option="funnelOption" height="280px" />
        </StatPanel>
      </el-col>
      <el-col :xs="24" :lg="10">
        <StatPanel title="部门缺口">
          <VChart v-if="gapRows.length" :option="gapOption" height="280px" />
          <el-empty v-else description="暂无编制缺口" :image-size="64" />
          <el-table
            v-if="gapRows.length"
            :data="gapRows"
            size="small"
            class="gap-table"
            @row-click="drillDept"
          >
            <el-table-column prop="departmentName" label="部门" min-width="120" />
            <el-table-column prop="planned" label="编制" width="70" align="center" />
            <el-table-column prop="filled" label="在职" width="70" align="center" />
            <el-table-column prop="gap" label="缺口" width="70" align="center" />
          </el-table>
        </StatPanel>
      </el-col>
    </el-row>

    <StatPanel :title="`维度切分 · ${dimensionLabel}`">
      <el-table :data="dimensionRows" border stripe size="small" max-height="240">
        <el-table-column prop="name" label="维度值" min-width="160" />
        <el-table-column prop="count" label="线索数" width="100" align="center" />
      </el-table>
    </StatPanel>

    <StatPanel :title="stageFilter ? `候选人明细（${funnel.stages.find((s) => s.key === stageFilter)?.label ?? stageFilter}）` : '候选人明细'">
      <template #extra>
        <el-button v-if="stageFilter" link type="primary" @click="stageFilter = ''">清除阶段筛选</el-button>
      </template>
      <el-table :data="detailRows" border stripe>
        <el-table-column prop="candidateName" label="候选人" width="100" />
        <el-table-column prop="enterpriseName" label="企业" min-width="140" />
        <el-table-column prop="position" label="岗位" min-width="120" />
        <el-table-column prop="channel" label="渠道" width="100" />
        <el-table-column prop="owner" label="负责人" width="100" />
        <el-table-column prop="statusLabel" label="阶段" width="110" />
        <el-table-column prop="createdAt" label="创建时间" width="170" />
      </el-table>
    </StatPanel>

    <el-dialog v-model="subscribeVisible" title="定时推送订阅" width="420px">
      <el-form label-width="88px">
        <el-form-item label="推送周期">
          <el-select v-model="subscribeForm.cycle" style="width: 100%">
            <el-option label="每日" value="daily" />
            <el-option label="每周" value="weekly" />
            <el-option label="每月" value="monthly" />
          </el-select>
        </el-form-item>
        <el-form-item label="接收角色">
          <el-select v-model="subscribeForm.roles" multiple style="width: 100%">
            <el-option label="招聘负责人" value="hr" />
            <el-option label="运营" value="ops" />
            <el-option label="企业管理员" value="ent_admin" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="subscribeVisible = false">取消</el-button>
        <el-button type="primary" @click="saveSubscribe">保存到规则引擎</el-button>
      </template>
    </el-dialog>
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
.header-actions {
  display: flex;
  gap: 8px;
}
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
}
.kpi-row .el-col,
.chart-row .el-col {
  margin-bottom: 16px;
}
.funnel-stages {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}
.funnel-chip {
  border: 1px solid var(--app-border);
  background: #f7f8fa;
  border-radius: 8px;
  padding: 8px 12px;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  min-width: 72px;
}
.funnel-chip.active {
  border-color: var(--el-color-primary);
  background: var(--el-color-primary-light-9);
}
.chip-label {
  font-size: 12px;
  color: #909399;
}
.chip-count {
  font-size: 18px;
  font-weight: 700;
  color: #303133;
}
.gap-table {
  margin-top: 8px;
  cursor: pointer;
}
</style>
