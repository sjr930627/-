<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowRight, Odometer, User } from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import { useMiniAppActionGate } from '@/composables/useMiniAppActionGate'
import { useMiniWorkerTasks } from '@/composables/useMiniWorkerTasks'
import { getEnterpriseHallLabel, getTaskHallExtra } from '@/mock/miniTaskHallSeed'
import {
  buildHallTaskRow,
  getWorkerClaimedQuantity,
  groupHallTasksByEnterprise,
  resolvePricingForTask,
} from '@/services/miniTask'

const store = useAppStore()
const router = useRouter()
const { employeeId } = useMiniAppWorker()
const { ensureActionAllowed } = useMiniAppActionGate()
const { pendingMyActionCount } = useMiniWorkerTasks()

const tagToneMap: Record<string, string> = {
  高佣金: 'red',
  急: 'orange',
  新: 'blue',
  限时: 'yellow',
  长期: 'grey',
  热门: 'red',
  新品: 'green',
  高佣: 'purple',
  奖金奖励: 'orange',
}

const hallTaskRows = computed(() =>
  store.tasks
    .filter((t) => t.status === 'active' && t.dispatchMode === 'hall')
    .map((t) => {
      const pricing = resolvePricingForTask(t, store.taskTypes)
      const myCount = getWorkerClaimedQuantity(store.taskInstances, t.id, employeeId.value)
      const extra = getTaskHallExtra(t.id)
      return buildHallTaskRow(t, pricing, myCount, extra)
    }),
)

const taskCompanies = computed(() =>
  groupHallTasksByEnterprise(hallTaskRows.value).map((g) => {
    const prices = g.previewTasks.map((t) => t.priceValue)
    const payMin = prices.length ? Math.min(...prices) : 0
    const payMax = prices.length ? Math.max(...prices) : 0
    const tags = [...new Set(g.previewTasks.flatMap((t) => t.tags))].slice(0, 5)
    return {
      id: g.enterpriseId,
      enterpriseName: g.enterpriseName,
      title: g.enterpriseName,
      tags: tags.length ? tags : ['高佣金', '长期'],
      payMin,
      payMax,
      payUnit: '起',
      payHint: '· 按次/件结算',
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

function tagClass(tag: string) {
  return tagToneMap[tag] ?? 'blue'
}

function openTaskEnterprise(enterpriseId: string, enterpriseName: string) {
  router.push({
    path: `/miniapp/task-hall/enterprise/${enterpriseId}/tasks`,
    query: { name: enterpriseName },
  })
}

async function openTaskClaim(taskId: string, e: Event) {
  e.stopPropagation()
  const task = store.tasks.find((t) => t.id === taskId)
  const allowed = await ensureActionAllowed({
    requireDepartment: true,
    enterpriseId: task?.enterpriseId,
    from: 'claim',
    redirectAfterFace: `/miniapp/task-hall/task/${taskId}/claim`,
  })
  if (!allowed) return
  router.push(`/miniapp/task-hall/task/${taskId}/claim`)
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
          <div class="job-post-loc">{{ card.storeName }}</div>
          <div class="job-post-loc-sub">{{ card.locationHint }}</div>
        </div>
        <div class="job-post-logo">{{ card.brandLetter }}</div>
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
            @click="openTaskClaim(slot.id, $event)"
          >
            立刻领取
          </button>
        </div>
      </div>
    </article>

    <div v-if="taskCompanies.length === 0" class="mini-empty">暂无大厅任务</div>
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

.company-card {
  margin: 12px 16px 0;
  background: #fff;
  border-radius: var(--mini-radius-lg);
  box-shadow: var(--mini-shadow);
  overflow: hidden;
}

.job-post-head {
  display: flex;
  gap: 12px;
  padding: 14px 14px 12px;
}

.job-post-head-clickable {
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

.job-slot-apply:disabled {
  background: #f3f4f6;
  color: var(--mini-text-muted);
  cursor: not-allowed;
}
</style>
