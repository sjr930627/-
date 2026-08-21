<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  ArrowDown,
  ArrowRight,
  RefreshRight,
  User,
} from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import { useMiniAppActionGate } from '@/composables/useMiniAppActionGate'
import { getGrabShiftPostExtra, getGrabShiftSlotExtra, getJobDetailExtra } from '@/mock/miniappDetailSeed'
import { TASK_PREVIEW_LIMIT } from '@/services/miniTask'
import { isGrabShiftOpenForWorkers } from '@/services/grabShift'
import { resolveEnterpriseIdByAttendanceGroupId } from '@/utils/enterpriseScope'

const store = useAppStore()
const route = useRoute()
const router = useRouter()
const { employeeId } = useMiniAppWorker()
const { ensureActionAllowed } = useMiniAppActionGate()
const activeTab = ref<'jobs' | 'shifts'>('shifts')
const city = ref('上海市')

const tabs = [
  { key: 'jobs' as const, label: '岗位招聘' },
  { key: 'shifts' as const, label: '抢班' },
]

const tabRefs = ref<(HTMLElement | null)[]>([])
const indicatorStyle = ref({ left: '0px', width: '0px' })

function setTabRef(el: unknown, index: number) {
  tabRefs.value[index] = el instanceof HTMLElement ? el : null
}

function updateTabIndicator() {
  const idx = tabs.findIndex((t) => t.key === activeTab.value)
  const el = tabRefs.value[idx]
  if (!el) return
  indicatorStyle.value = {
    left: `${el.offsetLeft}px`,
    width: `${el.offsetWidth}px`,
  }
}

const tagToneMap: Record<string, string> = {
  收入秒结: 'orange',
  免审核: 'green',
  近期发布: 'blue',
  平台加薪: 'red',
  限时补贴: 'purple',
  日结: 'orange',
  兼职岗位: 'blue',
  夜班补贴: 'purple',
  奖金奖励: 'orange',
  直面: 'blue',
  星级补贴: 'purple',
  专属福利: 'red',
  高佣金: 'red',
  急: 'orange',
  新: 'blue',
  限时: 'yellow',
  长期: 'grey',
  热门: 'red',
  新品: 'green',
  高佣: 'purple',
}

function syncTabFromRoute() {
  const tab = route.query.tab
  if (tab === 'tasks') {
    router.replace('/miniapp/task-hall')
    return
  }
  if (tab === 'shifts' || tab === 'jobs') {
    activeTab.value = tab
  }
}

syncTabFromRoute()
watch(() => route.query.tab, syncTabFromRoute)
watch(activeTab, () => nextTick(updateTabIndicator))
onMounted(() => nextTick(updateTabIndicator))

function switchTab(tab: 'jobs' | 'shifts') {
  activeTab.value = tab
  router.replace({ path: '/miniapp/recommend', query: { tab } })
}

const jobs = computed(() =>
  store.jobRequirements
    .filter((j) => j.status === 'recruiting')
    .map((j) => {
      const extra = getJobDetailExtra(
        j.id,
        {
          storeName: j.enterpriseName,
          location: j.location,
        },
        j,
      )
      return {
        id: j.id,
        title: j.title,
        tags: extra.tags,
        payMin: extra.hourlyMin,
        payMax: extra.hourlyMax,
        payUnit: '/小时',
        payHint: '· 上岗后收入',
        storeName: extra.storeName,
        locationHint: `${extra.subwayHint ?? '地铁口附近'} · ${extra.distance}`,
        brandLetter: extra.storeName.slice(0, 1),
        previewSlots: [],
        hasMoreSlots: false,
        slotCount: 0,
      }
    }),
)

const shiftCompanies = computed(() => {
  const open = store.grabShiftSlots.filter(
    (s) => isGrabShiftOpenForWorkers(s),
  )
  const teamIds = [...new Set(open.map((s) => s.teamId))]
  return teamIds.map((teamId) => {
    const teamSlots = open
      .filter((s) => s.teamId === teamId)
      .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime))
    const first = teamSlots[0]
    const post = getGrabShiftPostExtra(teamId, first.teamName)
    const isWhitelisted = store.isGrabShiftWhitelisted(
      employeeId.value,
      first.attendanceGroupId,
    )
    const tags = post.tags.filter((t) => t !== '免审核' || isWhitelisted)
    const slots = teamSlots.map((s) => {
      const extra = getGrabShiftSlotExtra(s.id, s.date)
      const applied = store.grabShiftApplications.some(
        (a) => a.slotId === s.id && a.employeeId === employeeId.value,
      )
      const remain = s.requiredCount - s.grabbedCount
      const hourly = extra.durationHours
        ? Math.round(extra.pay / extra.durationHours)
        : s.effectiveHourlyRate ?? 22
      const monthDay = s.date.slice(5).replace('-', '月') + '日'
      return {
        id: s.id,
        dateTimeLabel: `${monthDay} ${extra.weekdayLabel} ${s.startTime.slice(0, 5)}~${s.endTime.slice(0, 5)}`,
        incomeLabel: `¥${extra.pay} · ${hourly}元/小时`,
        capacity: `${s.grabbedCount}/${s.requiredCount}`,
        hourly,
        disabled: applied || remain <= 0,
        applied,
      }
    })
    const hourlies = slots.map((s) => s.hourly)
    const hourlyMin = hourlies.length ? Math.min(...hourlies) : 0
    const hourlyMax = hourlies.length ? Math.max(...hourlies) : 0
    return {
      id: teamId,
      title: post.title,
      tags,
      payMin: hourlyMin,
      payMax: hourlyMax,
      payUnit: '/小时',
      payHint: '· 日结上岗',
      storeName: post.storeName,
      locationHint: `${post.distance} · ${post.commute}`,
      brandLetter: post.storeName.slice(0, 1),
      slotCount: slots.length,
      previewSlots: slots.slice(0, TASK_PREVIEW_LIMIT),
      hasMoreSlots: slots.length > TASK_PREVIEW_LIMIT,
    }
  })
})

const feedCards = computed(() => {
  if (activeTab.value === 'jobs') {
    return jobs.value.map((card) => ({
      ...card,
      tab: 'jobs' as const,
    }))
  }
  return shiftCompanies.value.map((card) => ({
    ...card,
    tab: 'shifts' as const,
    panelTitle: '可抢班次',
  }))
})

const feedEmptyText = computed(() => {
  if (activeTab.value === 'jobs') return '暂无在招岗位'
  return '暂无抢班班次'
})

function openCard(card: (typeof feedCards.value)[number]) {
  if (card.tab === 'jobs') openJob(card.id)
  else openShiftEnterprise(card.id)
}

function slotActionLabel(
  slot: (typeof feedCards.value)[number]['previewSlots'][number],
) {
  return slot.applied ? '已报名' : '立刻抢班'
}

function onSlotAction(
  slot: (typeof feedCards.value)[number]['previewSlots'][number],
  e: Event,
) {
  applyShiftSlot(slot.id, e)
}

function tagClass(tag: string) {
  return tagToneMap[tag] ?? 'blue'
}

function openJob(id: string) {
  router.push(`/miniapp/recommend/job/${id}`)
}

function openShiftEnterprise(teamId: string) {
  router.push(`/miniapp/recommend/shift/${teamId}`)
}

async function applyShiftSlot(slotId: string, e: Event) {
  e.stopPropagation()
  const slot = store.grabShiftSlots.find((s) => s.id === slotId)
  const enterpriseId = slot
    ? resolveEnterpriseIdByAttendanceGroupId(
        slot.attendanceGroupId,
        store.attendanceGroups,
        store.departments,
      )
    : undefined
  const allowed = await ensureActionAllowed({
    requireDepartment: true,
    enterpriseId,
    from: 'grab',
  })
  if (!allowed) return
  try {
    const app = store.submitGrabShiftApplication({
      slotId,
      employeeId: employeeId.value,
      message: '小程序抢班报名',
    })
    if (app.status === 'approved') {
      ElMessage.success('抢班成功，已自动通过')
    } else {
      ElMessage.success('抢班成功，待审核')
    }
  } catch (err) {
    ElMessage.warning(err instanceof Error ? err.message : '报名失败')
  }
}

function onLoadMore() {
  ElMessage.info('加载更多（演示）')
}
</script>

<template>
  <div class="rec-page">
    <header class="rec-header">
      <button type="button" class="rec-city">
        {{ city }}
        <el-icon :size="12"><ArrowDown /></el-icon>
      </button>
    </header>

    <div class="rec-tabs-wrap">
      <div class="rec-tabs">
        <button
          v-for="(tab, index) in tabs"
          :key="tab.key"
          :ref="(el) => setTabRef(el, index)"
          type="button"
          class="rec-tab"
          :class="{ active: activeTab === tab.key }"
          @click="switchTab(tab.key)"
        >
          <span v-if="activeTab === tab.key" class="rec-tab-spark" aria-hidden="true">✦</span>
          {{ tab.label }}
        </button>
        <span class="rec-tab-indicator" :style="indicatorStyle" />
      </div>
    </div>

    <article
      v-for="card in feedCards"
      :key="`${card.tab}-${card.id}`"
      class="company-card job-post-card"
      :class="{ 'job-post-card-clickable': card.tab === 'jobs' }"
      @click="card.tab === 'jobs' ? openCard(card) : undefined"
    >
      <div
        class="job-post-head"
        :class="{ 'job-post-head-clickable': card.tab !== 'jobs' }"
        @click="card.tab !== 'jobs' ? openCard(card) : undefined"
      >
        <div class="job-post-main">
          <div class="job-post-title">{{ card.title }}</div>
          <div class="job-post-tags">
            <span
              v-for="tag in card.tags.slice(0, 5)"
              :key="tag"
              class="mini-tag"
              :class="tagClass(tag)"
            >
              {{ tag }}
            </span>
          </div>
          <div class="job-post-salary">
            ¥{{ card.payMin }}~{{ card.payMax }}
            <span class="job-post-salary-unit">{{ card.payUnit }}</span>
            <span class="job-post-salary-hint">{{ card.payHint }}</span>
          </div>
          <div class="job-post-loc">{{ card.storeName }}</div>
          <div class="job-post-loc-sub">{{ card.locationHint }}</div>
        </div>
        <div class="job-post-logo">{{ card.brandLetter }}</div>
      </div>

      <div v-if="card.tab !== 'jobs'" class="job-slot-panel">
        <div class="job-slot-panel-head">
          <span class="job-slot-panel-title">{{ card.panelTitle }}</span>
          <button
            v-if="card.hasMoreSlots"
            type="button"
            class="job-slot-panel-more"
            @click.stop="openCard(card)"
          >
            全部({{ card.slotCount }})
            <el-icon :size="12"><ArrowRight /></el-icon>
          </button>
          <span v-else-if="card.slotCount > 0" class="job-slot-panel-count">
            共 {{ card.slotCount }} 个
          </span>
        </div>
        <div
          v-for="slot in card.previewSlots"
          :key="slot.id"
          class="job-slot-row"
        >
          <div class="job-slot-main">
            <div class="job-slot-time">{{ slot.dateTimeLabel }}</div>
            <div class="job-slot-income">{{ slot.incomeLabel }}</div>
          </div>
          <div class="job-slot-capacity">
            <el-icon :size="12"><User /></el-icon>
            {{ slot.capacity }}
          </div>
          <button
            type="button"
            class="job-slot-apply"
            :class="{ applied: slot.applied }"
            :disabled="slot.disabled"
            @click="onSlotAction(slot, $event)"
          >
            {{ slotActionLabel(slot) }}
          </button>
        </div>
      </div>
    </article>

    <button
      v-if="activeTab === 'shifts' && feedCards.length > 0"
      type="button"
      class="load-more"
      @click="onLoadMore"
    >
      <el-icon :size="16"><RefreshRight /></el-icon>
      加载更多
    </button>

    <div v-if="feedCards.length === 0" class="mini-empty">{{ feedEmptyText }}</div>
  </div>
</template>

<style scoped>
.rec-page {
  min-height: 100%;
  padding: 0 0 16px;
  background: var(--mini-bg);
}

.rec-header {
  display: flex;
  align-items: center;
  padding: 12px 16px 8px;
  background: #f0f9ff;
}

.rec-city {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: none;
  font-size: 16px;
  font-weight: 700;
  color: var(--mini-text);
  cursor: pointer;
}

.rec-tabs-wrap {
  background: #f0f9ff;
  overflow-x: auto;
  scrollbar-width: none;
}

.rec-tabs-wrap::-webkit-scrollbar {
  display: none;
}

.rec-tabs {
  position: relative;
  display: flex;
  align-items: center;
  gap: 28px;
  min-height: 46px;
  padding: 4px 16px 10px;
}

.rec-tab {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: none;
  padding: 8px 0;
  font-size: 15px;
  font-weight: 400;
  color: #999;
  cursor: pointer;
  white-space: nowrap;
  transition: color 0.2s, font-weight 0.2s;
}

.rec-tab.active {
  color: var(--mini-primary);
  font-weight: 700;
}

.rec-tab-spark {
  font-size: 11px;
  line-height: 1;
  color: var(--mini-primary);
}

.rec-tab-indicator {
  position: absolute;
  bottom: 0;
  left: 0;
  height: 4px;
  background: var(--mini-primary);
  border-radius: 999px;
  transition: left 0.25s ease, width 0.25s ease;
  pointer-events: none;
}

.company-card {
  margin: 12px 16px 0;
  background: #fff;
  border-radius: var(--mini-radius-lg);
  box-shadow: var(--mini-shadow);
  overflow: hidden;
}

.load-more {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: calc(100% - 32px);
  margin: 16px auto 0;
  padding: 12px;
  border: 1px dashed var(--mini-border);
  border-radius: 999px;
  background: #fff;
  color: var(--mini-text-secondary);
  font-size: 14px;
  cursor: pointer;
}

.job-post-card {
  margin: 12px 16px 0;
}

.job-post-card-clickable {
  cursor: pointer;
}

.job-post-head-clickable {
  cursor: pointer;
}

.job-post-head {
  display: flex;
  gap: 12px;
  padding: 14px 14px 12px;
  cursor: pointer;
}

.job-post-main {
  flex: 1;
  min-width: 0;
}

.job-post-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--mini-text);
  line-height: 1.35;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.job-post-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 8px;
}

.job-post-salary {
  margin-top: 10px;
  font-size: 18px;
  font-weight: 800;
  color: #ef4444;
  line-height: 1.2;
}

.job-post-salary-unit {
  font-size: 13px;
  font-weight: 600;
}

.job-post-salary-hint {
  font-size: 12px;
  font-weight: 500;
  color: var(--mini-text-muted);
}

.job-post-loc {
  margin-top: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--mini-text);
}

.job-post-loc-sub {
  margin-top: 4px;
  font-size: 12px;
  color: var(--mini-text-muted);
}

.job-post-logo {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: linear-gradient(135deg, #fde68a, #fbbf24);
  color: #92400e;
  font-size: 18px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.job-slot-panel {
  margin: 0 14px 14px;
  padding: 12px;
  border: 1px solid #f3f4f6;
  border-radius: 12px;
  background: #fafafa;
}

.job-slot-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.job-slot-panel-title {
  font-size: 13px;
  font-weight: 600;
  color: var(--mini-text);
}

.job-slot-panel-more {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  border: none;
  background: none;
  color: var(--mini-primary);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
}

.job-slot-panel-count {
  font-size: 12px;
  color: var(--mini-text-muted);
}

.job-slot-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 0;
  border-top: 1px solid #f0f0f0;
}

.job-slot-panel-head + .job-slot-row {
  border-top: none;
  padding-top: 4px;
}

.job-slot-main {
  flex: 1;
  min-width: 0;
}

.job-slot-time {
  font-size: 13px;
  font-weight: 600;
  color: var(--mini-text);
}

.job-slot-income {
  margin-top: 4px;
  font-size: 12px;
  color: #ef4444;
}

.job-slot-capacity {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 12px;
  color: var(--mini-text-muted);
  flex-shrink: 0;
}

.job-slot-apply {
  padding: 6px 12px;
  border: none;
  border-radius: 999px;
  background: var(--mini-primary);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  white-space: nowrap;
  cursor: pointer;
  flex-shrink: 0;
}

.job-slot-apply.applied,
.job-slot-apply:disabled {
  background: #f3f4f6;
  color: var(--mini-text-muted);
  cursor: not-allowed;
}
</style>
