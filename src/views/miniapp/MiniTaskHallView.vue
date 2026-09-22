<script setup lang="ts">
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowDown, ArrowRight, Odometer, User } from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import { useMiniWorkerTasks } from '@/composables/useMiniWorkerTasks'
import { getEnterpriseHallLabel, getTaskHallExtra } from '@/mock/miniTaskHallSeed'
import {
  buildHallTaskRow,
  getWorkerClaimedQuantity,
  groupHallTasksByEnterprise,
  isTaskVisibleToWorker,
  resolvePricingForTask,
} from '@/services/miniTask'
import {
  hasLatestTag,
  type RecommendFilterOption,
} from '@/services/miniRecommendFilter'

const store = useAppStore()
const router = useRouter()
const { employeeId, employee } = useMiniAppWorker()
const { pendingMyActionCount } = useMiniWorkerTasks()

const HALL_FILTER_CHIPS = [
  { key: 'brand' as const, label: '品牌', kind: 'options' as const },
  { key: 'latest' as const, label: '最新发布', kind: 'toggle' as const },
]

const filters = reactive({
  brand: [] as string[],
  latest: false,
})

const sheetOpen = ref(false)
const sheetDraft = ref<string[]>([])

const tagToneMap: Record<string, string> = {
  高佣金: 'red',
  急: 'orange',
  新: 'blue',
  近期发布: 'blue',
  限时: 'yellow',
  长期: 'grey',
  热门: 'red',
  新品: 'green',
  高佣: 'purple',
  奖金奖励: 'orange',
}

const hallTaskRows = computed(() =>
  store.tasks
    .filter((t) => isTaskVisibleToWorker(t, employee.value?.departmentId))
    .map((t) => {
      const pricing = resolvePricingForTask(t, store.taskTypes)
      const myCount = getWorkerClaimedQuantity(store.taskInstances, t.id, employeeId.value)
      const extra = getTaskHallExtra(t.id)
      return buildHallTaskRow(t, pricing, myCount, extra)
    }),
)

const filteredHallRows = computed(() =>
  hallTaskRows.value.filter((row) => {
    if (filters.brand.length && !filters.brand.includes(row.enterpriseName)) return false
    if (filters.latest && !hasLatestTag(row.tags)) return false
    return true
  }),
)

const brandOptions = computed<RecommendFilterOption[]>(() => {
  const names = [...new Set(hallTaskRows.value.map((r) => r.enterpriseName).filter(Boolean))]
  return names.map((name) => ({ id: name, label: name }))
})

const taskCompanies = computed(() =>
  groupHallTasksByEnterprise(filteredHallRows.value).map((g) => {
    const prices = g.previewTasks.map((t) => t.priceValue)
    const payMin = prices.length ? Math.min(...prices) : 0
    const payMax = prices.length ? Math.max(...prices) : 0
    const tags = [...new Set(g.previewTasks.flatMap((t) => t.tags))].slice(0, 5)
    return {
      id: g.enterpriseId,
      enterpriseName: g.enterpriseName,
      title: g.enterpriseName,
      orgLabel: g.enterpriseName,
      tags: tags.length ? tags : ['高佣金', '长期'],
      payMin,
      payMax,
      payUnit: '/件',
      payHint: '· 单价',
      storeName: getEnterpriseHallLabel(g.enterpriseId),
      locationHint: `${g.taskCount} 个任务可领`,
      brandLetter: g.enterpriseName.slice(0, 1),
      slotCount: g.taskCount,
      previewSlots: g.previewTasks.map((t) => ({
        id: t.id,
        dateTimeLabel: t.name,
        incomeLabel: `${t.priceDisplay} · ${t.remainLabel}`,
        capacity: `${t.participants ?? 0}人`,
        disabled: !t.canClaim,
      })),
      hasMoreSlots: g.hasMore,
    }
  }),
)

function isChipActive(key: 'brand' | 'latest') {
  if (key === 'latest') return filters.latest
  return filters.brand.length > 0
}

function chipLabel(key: 'brand' | 'latest', label: string) {
  if (key === 'latest') return label
  const n = filters.brand.length
  return n > 0 ? `${label} · ${n}` : label
}

function onChipClick(chip: (typeof HALL_FILTER_CHIPS)[number]) {
  if (chip.kind === 'toggle') {
    filters.latest = !filters.latest
    return
  }
  sheetDraft.value = [...filters.brand]
  sheetOpen.value = true
}

function toggleSheetOption(id: string) {
  const idx = sheetDraft.value.indexOf(id)
  if (idx >= 0) sheetDraft.value.splice(idx, 1)
  else sheetDraft.value.push(id)
}

function confirmSheet() {
  filters.brand = [...sheetDraft.value]
  sheetOpen.value = false
}

function resetSheet() {
  sheetDraft.value = []
}

function closeSheet() {
  sheetOpen.value = false
}

function tagClass(tag: string) {
  return tagToneMap[tag] ?? 'blue'
}

function openTaskEnterprise(enterpriseId: string, enterpriseName: string) {
  router.push({
    path: `/miniapp/task-hall/enterprise/${enterpriseId}/tasks`,
    query: { name: enterpriseName },
  })
}

function openTaskDetail(taskId: string, e: Event) {
  e.stopPropagation()
  router.push(`/miniapp/task-hall/task/${taskId}`)
}

function goProgress() {
  router.push('/miniapp/tasks')
}
</script>

<template>
  <div class="hall-page">
    <header class="hall-header">
      <h1 class="hall-title">任务大厅</h1>
      <button type="button" class="hall-progress-btn" aria-label="任务进度" @click="goProgress">
        <el-icon :size="22"><Odometer /></el-icon>
        <span v-if="pendingMyActionCount" class="hall-progress-badge">
          {{ pendingMyActionCount > 9 ? '9+' : pendingMyActionCount }}
        </span>
      </button>
    </header>

    <div class="hall-chips-wrap">
      <div class="hall-chips">
        <button
          v-for="chip in HALL_FILTER_CHIPS"
          :key="chip.key"
          type="button"
          class="hall-chip"
          :class="{ active: isChipActive(chip.key) }"
          @click="onChipClick(chip)"
        >
          <span>{{ chipLabel(chip.key, chip.label) }}</span>
          <el-icon v-if="chip.kind === 'options'" :size="10" class="hall-chip-caret">
            <ArrowDown />
          </el-icon>
        </button>
      </div>
    </div>

    <article
      v-for="card in taskCompanies"
      :key="card.id"
      class="company-card"
    >
      <div class="job-post-head job-post-head-clickable" @click="openTaskEnterprise(card.id, card.enterpriseName)">
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
          <div class="job-post-org">
            <div class="job-post-logo">{{ card.brandLetter }}</div>
            <div class="job-post-org-meta">
              <div class="job-post-org-text">{{ card.orgLabel || card.storeName }}</div>
              <div v-if="card.locationHint" class="job-post-loc-sub">{{ card.locationHint }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="job-slot-panel">
        <div class="job-slot-panel-head">
          <span class="job-slot-panel-title">可领任务</span>
          <button
            v-if="card.hasMoreSlots"
            type="button"
            class="job-slot-panel-more"
            @click.stop="openTaskEnterprise(card.id, card.enterpriseName)"
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
            :disabled="slot.disabled"
            @click="openTaskDetail(slot.id, $event)"
          >
            立刻领取
          </button>
        </div>
      </div>
    </article>

    <div v-if="taskCompanies.length === 0" class="mini-empty">
      {{ hallTaskRows.length ? '暂无符合筛选条件的任务' : '暂无大厅任务' }}
    </div>

    <Teleport to="body">
      <div v-if="sheetOpen" class="hall-sheet-mask" @click.self="closeSheet">
        <div class="hall-sheet">
          <div class="hall-sheet-head">
            <button type="button" class="hall-sheet-reset" @click="resetSheet">重置</button>
            <div class="hall-sheet-title">品牌</div>
            <button type="button" class="hall-sheet-close" @click="closeSheet">×</button>
          </div>
          <div class="hall-sheet-body">
            <button
              v-for="opt in brandOptions"
              :key="opt.id"
              type="button"
              class="hall-sheet-option"
              :class="{ active: sheetDraft.includes(opt.id) }"
              @click="toggleSheetOption(opt.id)"
            >
              <span>{{ opt.label }}</span>
              <span v-if="sheetDraft.includes(opt.id)" class="hall-sheet-check">✓</span>
            </button>
            <div v-if="!brandOptions.length" class="hall-sheet-empty">暂无可选项</div>
          </div>
          <div class="hall-sheet-foot">
            <button type="button" class="hall-sheet-ok" @click="confirmSheet">确定</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.hall-page {
  min-height: 100%;
  padding: 0 0 16px;
  background: var(--mini-bg);
}

.hall-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 12px;
  background: #E6FFFA;
}

.hall-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--mini-text);
}

.hall-progress-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border: none;
  border-radius: 12px;
  background: #fff;
  color: var(--mini-primary);
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.08);
  cursor: pointer;
}

.hall-progress-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: #ef4444;
  color: #fff;
  font-size: 10px;
  font-weight: 700;
  line-height: 16px;
  text-align: center;
}

.hall-chips-wrap {
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
}

.hall-chips {
  display: flex;
  gap: 8px;
  padding: 10px 16px;
  overflow-x: auto;
  scrollbar-width: none;
  -webkit-overflow-scrolling: touch;
}

.hall-chips::-webkit-scrollbar {
  display: none;
}

.hall-chip {
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

.hall-chip.active {
  background: #E6FFFA;
  color: var(--mini-primary);
  font-weight: 700;
}

.hall-chip-caret {
  opacity: 0.7;
}

.company-card {
  margin: 12px 16px 0;
  background: #fff;
  border-radius: var(--mini-radius-lg);
  box-shadow: var(--mini-shadow);
  overflow: hidden;
}

.job-post-head-clickable {
  cursor: pointer;
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
  cursor: pointer;
  flex-shrink: 0;
}

.job-slot-apply:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.hall-sheet-mask {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.hall-sheet {
  width: 100%;
  max-width: 430px;
  max-height: 70vh;
  background: #fff;
  border-radius: 16px 16px 0 0;
  display: flex;
  flex-direction: column;
}

.hall-sheet-head {
  display: grid;
  grid-template-columns: 56px 1fr 36px;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid #f3f4f6;
}

.hall-sheet-title {
  text-align: center;
  font-size: 16px;
  font-weight: 700;
  color: var(--mini-text);
}

.hall-sheet-reset {
  border: none;
  background: none;
  color: #6b7280;
  font-size: 13px;
  cursor: pointer;
  padding: 0;
  text-align: left;
}

.hall-sheet-close {
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

.hall-sheet-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 16px 12px;
}

.hall-sheet-option {
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

.hall-sheet-option.active {
  color: var(--mini-primary);
  font-weight: 700;
}

.hall-sheet-check {
  color: var(--mini-primary);
  font-weight: 700;
}

.hall-sheet-empty {
  padding: 24px 0;
  text-align: center;
  color: #9ca3af;
  font-size: 13px;
}

.hall-sheet-foot {
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid #f3f4f6;
}

.hall-sheet-ok {
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
</style>
