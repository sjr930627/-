<script setup lang="ts">
import { computed, nextTick, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  ArrowDown,
  ArrowRight,
  RefreshRight,
  Search,
  User,
} from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import { getGrabShiftPostExtra, getGrabShiftSlotExtra } from '@/mock/miniappDetailSeed'
import { TASK_PREVIEW_LIMIT } from '@/services/miniTask'
import { isGrabSlotVisibleToWorker } from '@/services/grabShift'
import { listOpenGrabInterviewPosts } from '@/services/miniGrabInterview'
import { resolveEnterpriseIdByAttendanceGroupId } from '@/utils/enterpriseScope'
import {
  DISTANCE_OPTIONS,
  SETTLEMENT_OPTIONS,
  SHIFT_FILTER_CHIPS,
  SHIFT_REQ_HOT_OPTIONS,
  SHIFT_REQ_TYPE_OPTIONS,
  SHIFT_REQ_WEEKDAY_OPTIONS,
  buildFilterSlotMeta,
  chipDisplayLabel,
  cloneShiftReqFilter,
  createDefaultShiftReqFilter,
  createEmptyRecommendFilters,
  isChipActive,
  isNoExperienceRequired,
  matchRecommendCard,
  toggleShiftReqHot,
  toggleShiftReqType,
  toggleShiftReqWeekday,
  type RecommendFilterChipDef,
  type RecommendFilterChipKey,
  type RecommendFilterOption,
  type ShiftReqFilterState,
  type ShiftReqTypeId,
} from '@/services/miniRecommendFilter'
import { MINIAPP_DEMO_ANCHOR_DATE } from '@/constants/miniapp'

const store = useAppStore()
const route = useRoute()
const router = useRouter()
const { employeeId } = useMiniAppWorker()
const activeTab = ref<'jobs' | 'shifts'>('shifts')
const city = ref('上海市')
const keyword = ref('')

const filters = reactive(createEmptyRecommendFilters())
const sheetOpen = ref(false)
const sheetKey = ref<RecommendFilterChipKey | null>(null)
const sheetDraft = ref<string[]>([])
const shiftReqDraft = ref<ShiftReqFilterState>(createDefaultShiftReqFilter())

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
  抢班直面: 'blue',
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

const shiftCompanies = computed(() => {
  const worker = store.employees.find((e) => e.id === employeeId.value)
  const open = store.grabShiftSlots.filter((s) =>
    isGrabSlotVisibleToWorker(s, worker, store.teams, store.departments),
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
        startTime: s.startTime,
        shiftName: s.shiftName,
        date: s.date,
        durationHours: extra.durationHours || s.workHours || 8,
      }
    })
    const hourlies = slots.map((s) => s.hourly)
    const hourlyMin = hourlies.length ? Math.min(...hourlies) : 0
    const hourlyMax = hourlies.length ? Math.max(...hourlies) : 0
    const enterpriseId = resolveEnterpriseIdByAttendanceGroupId(
      first.attendanceGroupId,
      store.attendanceGroups,
      store.departments,
    )
    const enterpriseName =
      store.enterprises.find((e) => e.id === enterpriseId)?.name?.trim() ||
      post.storeName
    const team = store.teams.find((t) => t.id === teamId)
    const departmentId = first.departmentId || team?.departmentId
    const departmentName =
      first.departmentName?.trim() ||
      (departmentId
        ? store.departments.find((d) => d.id === departmentId)?.name?.trim()
        : '') ||
      post.storeName
    const positionName = first.positionName?.trim() || post.title
    const filterSlots = slots.map((s) =>
      buildFilterSlotMeta({
        date: s.date,
        startTime: s.startTime,
        durationHours: s.durationHours,
      }),
    )
    return {
      id: teamId,
      title: positionName,
      brand: enterpriseName,
      orgLabel: `${enterpriseName} · ${departmentName}`,
      tags,
      payMin: hourlyMin,
      payMax: hourlyMax,
      payUnit: '/小时',
      payHint: '· 日结上岗',
      storeName: post.storeName,
      locationHint: `${post.distance} · ${post.commute}`,
      locationMain: '',
      locationSide: '',
      brandLetter: enterpriseName.slice(0, 1),
      slotCount: slots.length,
      previewSlots: slots.slice(0, TASK_PREVIEW_LIMIT),
      hasMoreSlots: slots.length > TASK_PREVIEW_LIMIT,
      filterSlots,
      noExperience: isNoExperienceRequired({
        tags,
        requirements: post.requirements,
      }),
      keywordText: `${positionName} ${enterpriseName} ${departmentName} ${post.storeName} ${tags.join(' ')}`,
    }
  })
})

const interviewPosts = computed(() =>
  listOpenGrabInterviewPosts(store, employeeId.value, { previewLimit: TASK_PREVIEW_LIMIT }),
)

const rawFeedCards = computed(() => {
  if (activeTab.value === 'jobs') return []
  const interviews = interviewPosts.value.map((card) => ({
    ...card,
    brand: card.enterpriseName,
    tab: 'shifts' as const,
    kind: 'interview' as const,
    panelTitle: '可面试时间',
    filterSlots: card.previewSlots.map((s) =>
      buildFilterSlotMeta({
        date: s.date,
        startTime: s.interviewExactTime || s.timeRange.split('~')[0] || '09:00',
        durationHours: s.durationHours || 1,
      }),
    ),
    noExperience: isNoExperienceRequired({
      tags: card.tags,
      requirementsLine: card.requirementsLine,
    }),
    keywordText: `${card.title} ${card.orgLabel} ${card.storeName} ${card.tags.join(' ')}`,
  }))
  const shifts = shiftCompanies.value.map((card) => ({
    ...card,
    tab: 'shifts' as const,
    kind: 'shift' as const,
    panelTitle: '可抢班次',
  }))
  return [...interviews, ...shifts]
})

const feedCards = computed(() =>
  rawFeedCards.value.filter((card) =>
    matchRecommendCard(card, filters, keyword.value, city.value, MINIAPP_DEMO_ANCHOR_DATE),
  ),
)

const brandOptions = computed<RecommendFilterOption[]>(() => {
  const names = [...new Set(rawFeedCards.value.map((c) => c.brand).filter(Boolean))]
  return names.map((name) => ({ id: name, label: name }))
})

const sheetOptions = computed<RecommendFilterOption[]>(() => {
  if (sheetKey.value === 'brand') return brandOptions.value
  if (sheetKey.value === 'distance') return DISTANCE_OPTIONS
  if (sheetKey.value === 'settlement') return SETTLEMENT_OPTIONS
  return []
})

const isShiftReqSheet = computed(() => sheetKey.value === 'shiftReq')

const sheetTitle = computed(() => {
  const def = SHIFT_FILTER_CHIPS.find((c) => c.key === sheetKey.value)
  return def?.label || '筛选'
})

const feedEmptyText = computed(() => {
  if (activeTab.value === 'jobs') return '岗位招聘开发中，敬请期待'
  if (rawFeedCards.value.length > 0 && feedCards.value.length === 0) {
    return '暂无符合筛选条件的抢班'
  }
  return '暂无抢班班次或抢班直面'
})

function onChipClick(def: RecommendFilterChipDef) {
  if (def.kind === 'toggle') {
    const key = def.key as 'latest' | 'noExp'
    filters[key] = !filters[key]
    return
  }
  sheetKey.value = def.key
  if (def.key === 'shiftReq') {
    shiftReqDraft.value = cloneShiftReqFilter(filters.shiftReq)
  } else {
    const current = filters[def.key]
    sheetDraft.value = Array.isArray(current) ? [...current] : []
  }
  sheetOpen.value = true
}

function toggleSheetOption(id: string) {
  const idx = sheetDraft.value.indexOf(id)
  if (idx >= 0) sheetDraft.value.splice(idx, 1)
  else sheetDraft.value.push(id)
}

function confirmSheet() {
  if (!sheetKey.value) return
  const key = sheetKey.value
  if (key === 'shiftReq') {
    const draft = cloneShiftReqFilter(shiftReqDraft.value)
    if (!draft.types.length) draft.types = ['shift', 'interview']
    filters.shiftReq = draft
    // 只勾选一种类型：自动切到对应内容（同处抢班 Tab 内用类型过滤；仅直面时提示仍留在抢班）
    if (draft.types.length === 1) {
      activeTab.value = 'shifts'
      router.replace({ path: '/miniapp/recommend', query: { tab: 'shifts' } })
    }
  } else if (key === 'brand' || key === 'distance' || key === 'settlement') {
    filters[key] = [...sheetDraft.value]
  }
  sheetOpen.value = false
  sheetKey.value = null
}

function resetSheet() {
  if (sheetKey.value === 'shiftReq') {
    shiftReqDraft.value = createDefaultShiftReqFilter()
    return
  }
  sheetDraft.value = []
}

function closeSheet() {
  sheetOpen.value = false
  sheetKey.value = null
}

function isShiftReqTypeOn(id: string) {
  return shiftReqDraft.value.types.includes(id as ShiftReqTypeId)
}

function onToggleShiftReqType(id: string) {
  toggleShiftReqType(shiftReqDraft.value, id as ShiftReqTypeId)
}

function onToggleShiftReqHot(id: string) {
  toggleShiftReqHot(shiftReqDraft.value, id)
}

function onToggleShiftReqWeekday(id: string) {
  toggleShiftReqWeekday(shiftReqDraft.value, id)
}

function openCard(card: (typeof feedCards.value)[number]) {
  if (card.kind === 'interview') openInterview(card.id)
  else openShiftEnterprise(card.id)
}

function slotActionLabel(
  slot: (typeof feedCards.value)[number]['previewSlots'][number],
) {
  return slot.applied ? '已报名' : '立刻报名'
}

function onSlotAction(
  card: (typeof feedCards.value)[number],
  slot: (typeof feedCards.value)[number]['previewSlots'][number],
  e: Event,
) {
  e.stopPropagation()
  if (card.kind !== 'shift') return
  router.push({
    path: `/miniapp/recommend/shift/${encodeURIComponent(card.id)}`,
    query: { slot: slot.id },
  })
}

function tagClass(tag: string, kind?: string) {
  if (kind === 'interview') {
    if (tag === '抢班直面' || tag === '直面') return 'blue'
    if (tag === '免审核') return 'green'
    return ''
  }
  return tagToneMap[tag] ?? 'blue'
}

function openShiftEnterprise(teamId: string) {
  router.push(`/miniapp/recommend/shift/${teamId}`)
}

function openInterview(postId: string, slotId?: string) {
  router.push({
    path: `/miniapp/recommend/interview/${encodeURIComponent(postId)}`,
    query: slotId ? { slot: slotId } : undefined,
  })
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
      <div class="rec-search">
        <el-icon :size="14" class="rec-search-icon"><Search /></el-icon>
        <input
          v-model="keyword"
          type="search"
          class="rec-search-input"
          placeholder="搜索岗位 / 企业"
          enterkeyhint="search"
        />
      </div>
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

    <div v-if="activeTab === 'shifts'" class="rec-chips-wrap">
      <div class="rec-chips">
        <button
          v-for="chip in SHIFT_FILTER_CHIPS"
          :key="chip.key"
          type="button"
          class="rec-chip"
          :class="{ active: isChipActive(chip, filters) }"
          @click="onChipClick(chip)"
        >
          <span>{{ chipDisplayLabel(chip, filters) }}</span>
          <el-icon v-if="chip.kind === 'options'" :size="10" class="rec-chip-caret">
            <ArrowDown />
          </el-icon>
        </button>
      </div>
    </div>

    <article
      v-for="card in feedCards"
      :key="`${card.kind}-${card.id}`"
      class="company-card job-post-card"
      :class="{ 'job-post-card-clickable': card.kind !== 'shift' }"
      @click="card.kind !== 'shift' ? openCard(card) : undefined"
    >
      <div
        class="job-post-head"
        :class="{ 'job-post-head-clickable': card.kind === 'shift' || card.kind === 'interview' }"
        @click="card.kind === 'shift' || card.kind === 'interview' ? openCard(card) : undefined"
      >
        <div class="job-post-main">
          <div class="job-post-title">{{ card.title }}</div>
          <div class="job-post-tags">
            <span
              v-for="tag in card.tags.slice(0, 5)"
              :key="tag"
              class="mini-tag"
              :class="tagClass(tag, card.kind)"
            >
              {{ tag }}
            </span>
          </div>
          <div class="job-post-salary">
            ¥{{ card.payMin }}~{{ card.payMax }}
            <span class="job-post-salary-unit">{{ card.payUnit }}</span>
            <span class="job-post-salary-hint">{{ card.payHint }}</span>
          </div>
          <div class="job-post-org">
            <div class="job-post-logo">{{ card.brandLetter }}</div>
            <div class="job-post-org-meta">
              <div class="job-post-org-text">{{ card.orgLabel || card.storeName }}</div>
              <div v-if="card.locationHint" class="job-post-loc-sub">{{ card.locationHint }}</div>
            </div>
          </div>
        </div>
      </div>

      <div
        class="job-slot-panel"
        :class="{ interview: card.kind === 'interview' }"
      >
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
          <span v-else-if="card.slotCount > 0 && card.kind !== 'interview'" class="job-slot-panel-count">
            共 {{ card.slotCount }} 个
          </span>
        </div>
        <div
          v-for="slot in card.previewSlots"
          :key="slot.id"
          class="job-slot-row"
          :class="{ interview: card.kind === 'interview' }"
          @click="card.kind === 'interview' ? openInterview(card.id, slot.id) : undefined"
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
            v-if="card.kind === 'shift'"
            type="button"
            class="job-slot-apply"
            :class="{ applied: slot.applied }"
            :disabled="slot.disabled"
            @click="onSlotAction(card, slot, $event)"
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

    <div v-if="activeTab === 'jobs'" class="jobs-placeholder">
      <div class="jobs-placeholder-icon">岗</div>
      <h3>岗位招聘</h3>
      <p>功能开发中，敬请期待</p>
    </div>
    <div v-else-if="feedCards.length === 0" class="mini-empty">{{ feedEmptyText }}</div>

    <Teleport to="body">
      <div v-if="sheetOpen" class="rec-sheet-mask" @click.self="closeSheet">
        <div class="rec-sheet" :class="{ 'rec-sheet-tall': isShiftReqSheet }">
          <div class="rec-sheet-head">
            <button type="button" class="rec-sheet-reset" @click="resetSheet">重置</button>
            <div class="rec-sheet-title">{{ sheetTitle }}</div>
            <button type="button" class="rec-sheet-close" @click="closeSheet">×</button>
          </div>
          <div class="rec-sheet-body">
            <template v-if="isShiftReqSheet">
              <div class="req-group">
                <div class="req-group-title">类型</div>
                <div class="req-tags">
                  <button
                    v-for="opt in SHIFT_REQ_TYPE_OPTIONS"
                    :key="opt.id"
                    type="button"
                    class="req-tag"
                    :class="{ active: isShiftReqTypeOn(opt.id) }"
                    @click="onToggleShiftReqType(opt.id)"
                  >
                    {{ opt.label }}
                  </button>
                </div>
              </div>
              <div class="req-group">
                <div class="req-group-title">热门筛选</div>
                <div class="req-tags">
                  <button
                    v-for="opt in SHIFT_REQ_HOT_OPTIONS"
                    :key="opt.id"
                    type="button"
                    class="req-tag"
                    :class="{ active: shiftReqDraft.hot.includes(opt.id) }"
                    @click="onToggleShiftReqHot(opt.id)"
                  >
                    {{ opt.label }}
                  </button>
                </div>
              </div>
              <div class="req-group">
                <div class="req-group-title">班次日期</div>
                <div class="req-tags">
                  <button
                    v-for="opt in SHIFT_REQ_WEEKDAY_OPTIONS"
                    :key="opt.id"
                    type="button"
                    class="req-tag"
                    :class="{ active: shiftReqDraft.weekdays.includes(opt.id) }"
                    @click="onToggleShiftReqWeekday(opt.id)"
                  >
                    {{ opt.label }}
                  </button>
                </div>
              </div>
            </template>
            <template v-else>
              <button
                v-for="opt in sheetOptions"
                :key="opt.id"
                type="button"
                class="rec-sheet-option"
                :class="{ active: sheetDraft.includes(opt.id) }"
                @click="toggleSheetOption(opt.id)"
              >
                <span>{{ opt.label }}</span>
                <span v-if="sheetDraft.includes(opt.id)" class="rec-sheet-check">✓</span>
              </button>
              <div v-if="!sheetOptions.length" class="rec-sheet-empty">暂无可选项</div>
            </template>
          </div>
          <div class="rec-sheet-foot">
            <button type="button" class="rec-sheet-ok" @click="confirmSheet">确定</button>
          </div>
        </div>
      </div>
    </Teleport>
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
  gap: 10px;
  padding: 12px 16px 8px;
  background: #E6FFFA;
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
  flex-shrink: 0;
}

.rec-search {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  height: 34px;
  padding: 0 12px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.85);
  border: 1px solid rgba(79, 209, 197, 0.25);
}

.rec-search-icon {
  color: #9ca3af;
  flex-shrink: 0;
}

.rec-search-input {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  outline: none;
  font-size: 13px;
  color: var(--mini-text);
}

.rec-search-input::placeholder {
  color: #9ca3af;
}

.rec-chips-wrap {
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
}

.rec-chips {
  display: flex;
  gap: 8px;
  padding: 10px 16px;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

.rec-chips::-webkit-scrollbar {
  display: none;
}

.rec-chip {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 30px;
  padding: 0 12px;
  border: none;
  border-radius: 8px;
  background: #f3f4f6;
  color: #4b5563;
  font-size: 13px;
  font-weight: 400;
  cursor: pointer;
  white-space: nowrap;
}

.rec-chip.active {
  background: #E6FFFA;
  color: var(--mini-primary);
  font-weight: 700;
}

.rec-chip-caret {
  opacity: 0.7;
}

.rec-sheet-mask {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.rec-sheet {
  width: 100%;
  max-width: 430px;
  max-height: 70vh;
  background: #fff;
  border-radius: 16px 16px 0 0;
  display: flex;
  flex-direction: column;
}

.rec-sheet-head {
  display: grid;
  grid-template-columns: 56px 1fr 36px;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid #f3f4f6;
}

.rec-sheet-title {
  text-align: center;
  font-size: 16px;
  font-weight: 700;
  color: var(--mini-text);
}

.rec-sheet-reset {
  border: none;
  background: none;
  color: #6b7280;
  font-size: 13px;
  cursor: pointer;
  padding: 0;
  text-align: left;
}

.rec-sheet-close {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 50%;
  background: #f3f4f6;
  color: #6b7280;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  justify-self: end;
}

.rec-sheet-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 16px 12px;
}

.rec-sheet-option {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 4px;
  border: none;
  border-bottom: 1px solid #f5f5f5;
  background: none;
  font-size: 14px;
  color: #333;
  cursor: pointer;
  text-align: left;
}

.rec-sheet-option.active {
  color: var(--mini-primary);
  font-weight: 700;
}

.rec-sheet-check {
  color: var(--mini-primary);
  font-weight: 700;
}

.rec-sheet-empty {
  padding: 24px 0;
  text-align: center;
  color: #9ca3af;
  font-size: 13px;
}

.rec-sheet-foot {
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid #f3f4f6;
}

.rec-sheet-tall {
  max-height: 82vh;
}

.req-group {
  padding: 12px 0 4px;
}

.req-group + .req-group {
  border-top: 1px solid #f5f5f5;
  margin-top: 4px;
}

.req-group-title {
  font-size: 13px;
  font-weight: 600;
  color: #6b7280;
  margin-bottom: 10px;
}

.req-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.req-tag {
  height: 32px;
  padding: 0 14px;
  border: none;
  border-radius: 8px;
  background: #f3f4f6;
  color: #4b5563;
  font-size: 13px;
  cursor: pointer;
}

.req-tag.active {
  background: #E6FFFA;
  color: var(--mini-primary);
  font-weight: 700;
}

.rec-sheet-ok {
  width: 100%;
  height: 44px;
  border: none;
  border-radius: 999px;
  background: var(--mini-primary);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}

.rec-tabs-wrap {
  background: #E6FFFA;
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

.job-slot-panel {
  margin: 0 14px 14px;
  padding: 0;
  border: 1px solid #f3f4f6;
  border-radius: 12px;
  background: #fff;
  overflow: hidden;
}

.job-slot-panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: #f7f8fa;
  border-bottom: 1px solid #f0f0f0;
}

.job-slot-panel-title {
  font-size: 13px;
  font-weight: 500;
  color: #6b7280;
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
  padding: 12px;
  border-top: 1px solid #f0f0f0;
}

.job-slot-row.interview {
  cursor: pointer;
}

.job-slot-panel-head + .job-slot-row {
  border-top: none;
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

.jobs-placeholder {
  margin: 28px 16px;
  padding: 40px 20px;
  border-radius: 16px;
  background: #fff;
  text-align: center;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.jobs-placeholder-icon {
  width: 52px;
  height: 52px;
  margin: 0 auto 14px;
  border-radius: 14px;
  background: #eefbf8;
  color: var(--mini-primary, #4fd1c5);
  font-size: 20px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

.jobs-placeholder h3 {
  margin: 0 0 6px;
  font-size: 16px;
  color: #111827;
}

.jobs-placeholder p {
  margin: 0;
  font-size: 13px;
  color: #64748b;
}
</style>
