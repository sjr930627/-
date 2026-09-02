<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import EntMiniNavBar from '@/components/enterprise-miniapp/EntMiniNavBar.vue'
import { useAppStore } from '@/stores/app'
import { useEnterpriseMiniAuth } from '@/composables/useEnterpriseMiniAuth'
import { getDatesBetween } from '@/services/attendance'
import {
  buildCellsFromCommonConfig,
  buildShiftDemandManageRows,
  countsFromTemplates,
  type ShiftDemandManageRow,
  type ShiftDemandManageShiftItem,
} from '@/services/shiftDemandPlan'
import {
  calcGrabEnrollCap,
  calcGrabShiftEffectiveRate,
  resolveGrabShiftBaseHourlyRate,
} from '@/services/grabShift'
import { resolveEnterpriseIdByDepartment } from '@/utils/enterpriseScope'
import type { ShiftDemandShiftCount } from '@/types'

const DEFAULT_GRAB_POSITION_REQUIREMENT = [
  '遵守现场安全规范',
  '按时到岗，服从班组长安排',
  '具备对应岗位基础操作能力',
].join('\n')

const store = useAppStore()
const { enterpriseId } = useEnterpriseMiniAuth()

const startDate = ref('2026-07-24')
const endDate = ref('2026-07-31')
const teamFilter = ref('')
const gapOnly = ref(false)

const publishOpen = ref(false)
const publishForm = ref({
  teamId: '',
  startDate: '2026-07-24',
  endDate: '2026-07-31',
  counts: [] as ShiftDemandShiftCount[],
})

const grabOpen = ref(false)
const grabRow = ref<ShiftDemandManageRow | null>(null)
const grabForm = ref({
  floatMode: 'absolute' as 'absolute' | 'percent',
  floatValue: 2,
  selectedIds: [] as string[],
  positionRequirement: DEFAULT_GRAB_POSITION_REQUIREMENT,
  hourlySubsidy: 0,
})

const enterpriseTeams = computed(() =>
  store.teams.filter((t) => {
    const ent = resolveEnterpriseIdByDepartment(t.departmentId, store.departments)
    return ent === enterpriseId.value
  }),
)

const allRows = computed(() =>
  buildShiftDemandManageRows({
    startDate: startDate.value,
    endDate: endDate.value,
    teams: teamFilter.value
      ? store.teams.filter((t) => t.id === teamFilter.value)
      : store.teams,
    departments: store.departments,
    enterprises: store.enterprises,
    attendanceGroups: store.attendanceGroups,
    holidays: store.holidays,
    plans: store.weeklyShiftDemandPlans,
    shifts: store.shifts,
    assignments: store.assignments,
    employees: store.employees,
    enterpriseIdFilter: enterpriseId.value || undefined,
    onlyGap: gapOnly.value,
    preferPublished: false,
  }),
)

const summary = computed(() => {
  const required = allRows.value.reduce((s, r) => s + r.requiredHeadcount, 0)
  const scheduled = allRows.value.reduce((s, r) => s + r.scheduledCount, 0)
  const gap = allRows.value.reduce((s, r) => s + r.gapCount, 0)
  const gapRows = allRows.value.filter((r) => r.gapCount > 0).length
  return { required, scheduled, gap, gapRows }
})

const publishTeam = computed(() => store.teams.find((t) => t.id === publishForm.value.teamId))
const publishTemplates = computed(() => {
  const gid = publishTeam.value?.attendanceGroupId
  return gid ? store.attendanceGroups.find((g) => g.id === gid)?.shiftTemplates ?? [] : []
})

const grabGapShifts = computed(() => {
  const row = grabRow.value
  if (!row) return [] as (ShiftDemandManageShiftItem & { enrollCap: number })[]
  return row.shifts
    .filter((s) => s.gapCount > 0)
    .map((s) => ({
      ...s,
      enrollCap: calcGrabEnrollCap(s.gapCount, grabForm.value.floatMode, grabForm.value.floatValue),
    }))
})

function syncPublishCounts() {
  publishForm.value.counts = countsFromTemplates(publishTemplates.value, 'weekday')
}

watch(
  enterpriseTeams,
  (teams) => {
    if (!publishForm.value.teamId) publishForm.value.teamId = teams[0]?.id || ''
  },
  { immediate: true },
)

watch(
  () => publishForm.value.teamId,
  () => {
    if (publishOpen.value) syncPublishCounts()
  },
)

function openPublish() {
  publishForm.value = {
    teamId: teamFilter.value || enterpriseTeams.value[0]?.id || '',
    startDate: startDate.value,
    endDate: endDate.value,
    counts: [],
  }
  publishOpen.value = true
  setTimeout(() => syncPublishCounts(), 0)
}

function closePublish() {
  publishOpen.value = false
}

function submitPublish() {
  if (!publishForm.value.teamId) {
    ElMessage.warning('请选择班组')
    return
  }
  if (!publishTemplates.value.length) {
    ElMessage.warning('该班组未关联考勤组班次模板')
    return
  }
  const { startDate: start, endDate: end } = publishForm.value
  if (!start || !end) {
    ElMessage.warning('请选择需求周期')
    return
  }
  if (start > end) {
    ElMessage.warning('开始日期不能晚于结束日期')
    return
  }
  try {
    const dates = getDatesBetween(start, end)
    const commonConfig = {
      mode: 'daily_reuse' as const,
      dailyReuse: publishForm.value.counts.map((c) => ({ ...c })),
    }
    const cells = buildCellsFromCommonConfig(
      publishTemplates.value,
      dates,
      store.holidays,
      commonConfig,
    )
    store.saveWeeklyShiftDemandPlan({
      teamId: publishForm.value.teamId,
      weekStart: start,
      weekEnd: end,
      cells,
      commonConfig,
      status: 'published',
    })
    ElMessage.success(`已发布 ${start} ~ ${end} 班次需求（${cells.length} 条）`)
    closePublish()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '发布失败')
  }
}

function openGrab(row: ShiftDemandManageRow) {
  const gapShifts = row.shifts.filter((s) => s.gapCount > 0)
  if (!gapShifts.length) {
    ElMessage.warning('当日无缺口，无需发布抢班')
    return
  }
  grabRow.value = row
  grabForm.value = {
    floatMode: 'absolute',
    floatValue: 2,
    selectedIds: gapShifts.map((s) => s.shiftTemplateId),
    positionRequirement: DEFAULT_GRAB_POSITION_REQUIREMENT,
    hourlySubsidy: 0,
  }
  grabOpen.value = true
}

function closeGrab() {
  grabOpen.value = false
  grabRow.value = null
}

function toggleGrabShift(id: string) {
  const set = new Set(grabForm.value.selectedIds)
  if (set.has(id)) set.delete(id)
  else set.add(id)
  grabForm.value.selectedIds = [...set]
}

function submitGrab() {
  const row = grabRow.value
  if (!row) return
  const selected = grabGapShifts.value.filter((s) =>
    grabForm.value.selectedIds.includes(s.shiftTemplateId),
  )
  if (!selected.length) {
    ElMessage.warning('请至少选择一个缺口班次')
    return
  }
  if (!grabForm.value.positionRequirement.trim()) {
    ElMessage.warning('请填写岗位要求')
    return
  }
  const group = store.attendanceGroups.find((g) => g.id === row.attendanceGroupId)
  if (!group) {
    ElMessage.warning('未找到考勤组')
    return
  }

  let created = 0
  for (const item of selected) {
    const startTime = item.startTime.slice(0, 5)
    const endTime = item.endTime.slice(0, 5)
    const baseHourlyRate = resolveGrabShiftBaseHourlyRate(group, {
      date: row.date,
      startTime,
      holidays: store.holidays,
    })
    const subsidy = Math.max(0, grabForm.value.hourlySubsidy)
    store.createGrabShiftSlot({
      attendanceGroupId: group.id,
      scope: 'department',
      departmentId: row.departmentId,
      departmentName: row.departmentName,
      teamId: row.teamId,
      teamName: row.teamName,
      shiftSource: 'template',
      shiftTemplateId: item.shiftTemplateId,
      shiftId: item.shiftId,
      shiftName: item.shiftTemplateName,
      date: row.date,
      startTime,
      endTime,
      requiredCount: item.enrollCap,
      requirements: ['安全作业证'],
      positionRequirement: grabForm.value.positionRequirement.trim(),
      hourlySubsidy: subsidy,
      baseHourlyRate,
      effectiveHourlyRate: calcGrabShiftEffectiveRate(baseHourlyRate, subsidy),
    })
    created += 1
  }
  closeGrab()
  ElMessage.success(`已提交 ${created} 个抢班班次至发布审批`)
}

function tplName(id: string) {
  return publishTemplates.value.find((t) => t.id === id)?.name ?? id
}
</script>

<template>
  <div class="mini-page">
    <EntMiniNavBar title="需求总览" back-to="/enterprise-miniapp/attendance" />

    <div class="header-actions">
      <button type="button" class="primary-btn" @click="openPublish">发布班次需求</button>
    </div>

    <div class="filters">
      <input v-model="startDate" type="date">
      <span>至</span>
      <input v-model="endDate" type="date">
      <select v-model="teamFilter">
        <option value="">全部班组</option>
        <option v-for="t in enterpriseTeams" :key="t.id" :value="t.id">{{ t.name }}</option>
      </select>
      <label class="gap-check">
        <input v-model="gapOnly" type="checkbox">
        仅看缺口
      </label>
    </div>

    <div class="summary">
      <div><span>需求</span><strong>{{ summary.required }}</strong></div>
      <div><span>已排</span><strong class="ok">{{ summary.scheduled }}</strong></div>
      <div><span>缺口</span><strong class="gap">{{ summary.gap }}</strong></div>
      <div><span>缺口日</span><strong>{{ summary.gapRows }}</strong></div>
    </div>

    <div class="list">
      <article v-for="row in allRows" :key="row.key" class="card">
        <div class="card-top">
          <div>
            <strong>{{ row.date }}</strong>
            <span class="kind">{{ row.dateKindLabel }}</span>
          </div>
          <span v-if="row.gapCount > 0" class="gap-badge">缺口 {{ row.gapCount }}</span>
          <span v-else class="ok-badge">已齐</span>
        </div>
        <p class="meta">{{ row.teamName }} · {{ row.departmentName }}</p>
        <p class="shifts">{{ row.shiftSummary || '暂无班次需求' }}</p>
        <div class="nums">
          <span>需求 {{ row.requiredHeadcount }}</span>
          <span>已排 {{ row.scheduledCount }}</span>
          <span :class="{ warn: row.gapCount > 0 }">缺口 {{ row.gapCount }}</span>
        </div>
        <ul class="shift-detail">
          <li v-for="s in row.shifts" :key="s.shiftTemplateId">
            {{ s.shiftTemplateName }}：需 {{ s.requiredHeadcount }} / 排 {{ s.scheduledCount }}
            <em v-if="s.gapCount > 0">缺 {{ s.gapCount }}</em>
          </li>
        </ul>
        <button
          v-if="row.gapCount > 0"
          type="button"
          class="grab-btn"
          @click="openGrab(row)"
        >
          依据缺口发布抢班
        </button>
      </article>
      <div v-if="!allRows.length" class="empty">所选范围内暂无班次需求</div>
    </div>

    <div v-if="publishOpen" class="sheet-mask" @click.self="closePublish">
      <div class="sheet">
        <header>
          <strong>发布班次需求</strong>
          <button type="button" class="close" @click="closePublish">×</button>
        </header>
        <label>班组</label>
        <select v-model="publishForm.teamId">
          <option v-for="t in enterpriseTeams" :key="t.id" :value="t.id">{{ t.name }}</option>
        </select>
        <label>开始日期</label>
        <input v-model="publishForm.startDate" type="date">
        <label>结束日期</label>
        <input v-model="publishForm.endDate" type="date">
        <label>每日班次人数（复用）</label>
        <div v-if="!publishForm.counts.length" class="soft-empty">暂无班次模板</div>
        <div v-for="c in publishForm.counts" :key="c.shiftTemplateId" class="count-row">
          <span>{{ tplName(c.shiftTemplateId) }}</span>
          <input v-model.number="c.requiredHeadcount" type="number" min="0">
        </div>
        <button type="button" class="submit" @click="submitPublish">确认发布</button>
      </div>
    </div>

    <div v-if="grabOpen && grabRow" class="sheet-mask" @click.self="closeGrab">
      <div class="sheet">
        <header>
          <strong>依据缺口发布抢班</strong>
          <button type="button" class="close" @click="closeGrab">×</button>
        </header>
        <p class="sheet-meta">
          {{ grabRow.teamName }} · {{ grabRow.date }} · 当日缺口 {{ grabRow.gapCount }} 人
        </p>
        <label>缺口班次（可报名 = 缺口 + 上浮）</label>
        <label
          v-for="item in grabGapShifts"
          :key="item.shiftTemplateId"
          class="gap-item"
        >
          <input
            type="checkbox"
            :checked="grabForm.selectedIds.includes(item.shiftTemplateId)"
            @change="toggleGrabShift(item.shiftTemplateId)"
          >
          <span>
            {{ item.shiftTemplateName }} · 缺口 {{ item.gapCount }} → 可报名
            <b>{{ item.enrollCap }}</b>
          </span>
        </label>
        <div class="float-row">
          <select v-model="grabForm.floatMode">
            <option value="absolute">上浮人数</option>
            <option value="percent">上浮百分比</option>
          </select>
          <input v-model.number="grabForm.floatValue" type="number" min="0">
        </div>
        <label>时薪补贴</label>
        <input v-model.number="grabForm.hourlySubsidy" type="number" min="0" step="1">
        <label>岗位要求（必填）</label>
        <textarea v-model="grabForm.positionRequirement" rows="3" />
        <button type="button" class="submit" @click="submitGrab">发布抢班</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.header-actions {
  padding: 10px 16px 0;
  display: flex;
  justify-content: flex-end;
}
.primary-btn {
  height: 34px;
  padding: 0 14px;
  border: none;
  border-radius: 999px;
  background: #228BFF;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
}
.filters {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  padding: 10px 16px;
  font-size: 12px;
  color: #6b7280;
}
.filters input[type='date'],
.filters select {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 6px 8px;
  font-size: 12px;
  background: #fff;
}
.gap-check {
  display: flex;
  align-items: center;
  gap: 4px;
}
.summary {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  padding: 0 16px 10px;
}
.summary div {
  background: #fff;
  border-radius: 10px;
  padding: 8px 6px;
  text-align: center;
  box-shadow: var(--mini-shadow);
}
.summary span {
  display: block;
  font-size: 11px;
  color: #9ca3af;
}
.summary strong {
  font-size: 16px;
  color: #111827;
}
.summary .ok { color: #059669; }
.summary .gap { color: #dc2626; }
.list {
  padding: 0 16px 28px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.card {
  background: #fff;
  border-radius: 14px;
  padding: 12px 14px;
  box-shadow: var(--mini-shadow);
}
.card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.kind {
  margin-left: 6px;
  font-size: 11px;
  color: #9ca3af;
}
.gap-badge {
  font-size: 11px;
  color: #dc2626;
  background: #fef2f2;
  border-radius: 999px;
  padding: 2px 8px;
}
.ok-badge {
  font-size: 11px;
  color: #059669;
  background: #ecfdf5;
  border-radius: 999px;
  padding: 2px 8px;
}
.meta,
.shifts {
  margin: 4px 0 0;
  font-size: 12px;
  color: #6b7280;
}
.nums {
  display: flex;
  gap: 12px;
  margin-top: 8px;
  font-size: 12px;
  color: #374151;
}
.nums .warn { color: #dc2626; font-weight: 600; }
.shift-detail {
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
  font-size: 12px;
  color: #6b7280;
}
.shift-detail li { margin-top: 2px; }
.shift-detail em {
  font-style: normal;
  color: #dc2626;
  margin-left: 4px;
}
.grab-btn {
  margin-top: 10px;
  height: 32px;
  width: 100%;
  border: 1px solid #228BFF;
  border-radius: 999px;
  background: #fff;
  color: #228BFF;
  font-size: 13px;
  font-weight: 600;
}
.empty {
  padding: 40px 0;
  text-align: center;
  color: #9ca3af;
  font-size: 13px;
}
.sheet-mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  z-index: 40;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.sheet {
  width: min(420px, 100%);
  max-height: 86vh;
  overflow: auto;
  background: #fff;
  border-radius: 16px 16px 0 0;
  padding: 16px 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sheet header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.sheet .close {
  border: none;
  background: none;
  font-size: 22px;
  color: #9ca3af;
}
.sheet-meta {
  margin: 0;
  font-size: 12px;
  color: #6b7280;
}
.sheet label {
  font-size: 12px;
  color: #6b7280;
  margin-top: 4px;
}
.sheet input,
.sheet select,
.sheet textarea {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 10px;
  font-size: 14px;
}
.count-row,
.float-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
}
.count-row input,
.float-row input {
  width: 96px;
}
.gap-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 13px;
  color: #374151;
}
.gap-item b { color: #228BFF; }
.soft-empty {
  font-size: 12px;
  color: #9ca3af;
}
.submit {
  margin-top: 8px;
  height: 42px;
  border: none;
  border-radius: 10px;
  background: #228BFF;
  color: #fff;
  font-weight: 600;
}
</style>
