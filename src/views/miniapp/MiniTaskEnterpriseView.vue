<script setup lang="ts">
import MiniNavBack from '@/components/miniapp/MiniNavBack.vue'
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Box,
  Connection,
  House,
  OfficeBuilding,
  User,
} from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import { useMiniAppActionGate } from '@/composables/useMiniAppActionGate'
import {
  buildHallTaskRow,
  getWorkerClaimedQuantity,
  resolvePricingForTask,
} from '@/services/miniTask'
import {
  getCategoryLabel,
  getEnterpriseHallLabel,
  getTaskHallExtra,
  miniTaskCategoryConfig,
  type MiniTaskCategory,
} from '@/mock/miniTaskHallSeed'

const route = useRoute()
const router = useRouter()
const store = useAppStore()
const { employeeId } = useMiniAppWorker()
const { ensureActionAllowed } = useMiniAppActionGate()

const taskCategory = ref<MiniTaskCategory>('main')

const categoryIcons: Record<MiniTaskCategory, typeof Box> = {
  main: Box,
  personal: User,
  family: House,
  gov: OfficeBuilding,
  converged: Connection,
}

const enterpriseId = computed(() => String(route.params.enterpriseId))
const enterpriseNameFilter = computed(() => {
  const name = route.query.name
  return typeof name === 'string' ? name : undefined
})

const enterpriseName = computed(() => {
  if (enterpriseNameFilter.value) return enterpriseNameFilter.value
  const task = store.tasks.find((t) => t.enterpriseId === enterpriseId.value)
  return task?.enterpriseName ?? '企业任务'
})

const allTaskRows = computed(() =>
  store.tasks
    .filter(
      (t) =>
        t.enterpriseId === enterpriseId.value &&
        t.status === 'active' &&
        t.dispatchMode === 'hall' &&
        (!enterpriseNameFilter.value || t.enterpriseName === enterpriseNameFilter.value),
    )
    .map((t) => {
      const pricing = resolvePricingForTask(t, store.taskTypes)
      const myCount = getWorkerClaimedQuantity(store.taskInstances, t.id, employeeId.value)
      const extra = getTaskHallExtra(t.id)
      return buildHallTaskRow(t, pricing, myCount, extra)
    }),
)

const taskRows = computed(() =>
  allTaskRows.value.filter((row) => row.category === taskCategory.value),
)

const industryLabel = computed(
  () => `${getEnterpriseHallLabel(enterpriseId.value)} · ${allTaskRows.value.length}个任务`,
)

function openTaskDetail(taskId: string) {
  router.push(`/miniapp/task-hall/task/${taskId}`)
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
</script>

<template>
  <div class="ent-page">
    <div class="mini-nav-bar">
      <MiniNavBack fallback="/miniapp/task-hall" />
      <div class="mini-nav-title">{{ enterpriseName }}</div>
    </div>

    <div class="ent-head">
      <div class="ent-logo">{{ enterpriseName.slice(0, 1) }}</div>
      <div>
        <div class="ent-name-row">
          <span class="ent-name">{{ enterpriseName }}</span>
          <span class="ent-badge">认证</span>
        </div>
        <div class="ent-meta">{{ industryLabel }}</div>
      </div>
    </div>

    <div class="task-category-row">
      <button
        v-for="cat in miniTaskCategoryConfig"
        :key="cat.key"
        type="button"
        class="task-category-item"
        :class="{ active: taskCategory === cat.key }"
        @click="taskCategory = cat.key"
      >
        <span class="cat-icon" :style="{ color: taskCategory === cat.key ? cat.color : '#9ca3af' }">
          <el-icon :size="22"><component :is="categoryIcons[cat.key]" /></el-icon>
        </span>
        <span class="cat-label">{{ cat.label }}</span>
      </button>
    </div>

    <div class="task-list-head">
      <span>{{ getCategoryLabel(taskCategory) }}任务 · {{ taskRows.length }}项</span>
    </div>

    <div
      v-for="task in taskRows"
      :key="task.id"
      class="mobile-task-card"
      :class="task.cardTone ?? 'blue'"
      @click="openTaskDetail(task.id)"
    >
      <div class="mobile-task-head">
        <span v-if="task.highlightTag" class="mobile-highlight">{{ task.highlightTag }}</span>
        <span class="mobile-task-title">{{ task.name }}</span>
      </div>
      <p class="mobile-task-desc">{{ task.description }}</p>
      <div class="mobile-task-meta">
        <span>单笔佣金 <strong>{{ task.priceDisplay }}</strong></span>
        <span>{{ task.participants ?? 0 }} 人参与</span>
      </div>
      <button type="button" class="mobile-task-btn" @click="openTaskClaim(task.id, $event)">
        立即办理
      </button>
    </div>

    <div v-if="taskRows.length === 0" class="mini-empty">该分类暂无任务</div>
  </div>
</template>

<style scoped>
.ent-page {
  min-height: 100%;
  background: var(--mini-bg);
  padding-bottom: 20px;
}

.ent-head {
  display: flex;
  gap: 12px;
  padding: 16px;
  background: #fff;
  margin-bottom: 0;
}

.ent-logo {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  background: linear-gradient(135deg, #fde68a, #fbbf24);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 800;
  color: #92400e;
}

.ent-name-row {
  display: flex;
  align-items: center;
  gap: 6px;
}

.ent-name {
  font-size: 18px;
  font-weight: 700;
}

.ent-badge {
  padding: 1px 6px;
  border-radius: 4px;
  background: #f0fdf4;
  color: #22c55e;
  font-size: 10px;
  font-weight: 600;
}

.ent-meta {
  margin-top: 4px;
  font-size: 12px;
  color: var(--mini-text-muted);
}

.task-category-row {
  display: flex;
  justify-content: space-between;
  padding: 12px 8px;
  background: #fff;
  border-bottom: 1px solid #f3f4f6;
  overflow-x: auto;
}

.task-category-item {
  flex: 1;
  min-width: 64px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  border: none;
  background: none;
  cursor: pointer;
  padding: 4px 2px;
  position: relative;
}

.task-category-item.active::after {
  content: '';
  position: absolute;
  bottom: -12px;
  left: 20%;
  right: 20%;
  height: 3px;
  background: var(--mini-primary);
  border-radius: 2px;
}

.cat-label {
  font-size: 11px;
  color: var(--mini-text-muted);
}

.task-category-item.active .cat-label {
  color: var(--mini-primary);
  font-weight: 600;
}

.task-list-head {
  padding: 16px 16px 8px;
  font-size: 14px;
  font-weight: 600;
  color: var(--mini-text);
}

.mobile-task-card {
  margin: 0 16px 12px;
  padding: 14px;
  border-radius: 14px;
  cursor: pointer;
}

.mobile-task-card.blue { background: linear-gradient(135deg, #eff6ff, #dbeafe); }
.mobile-task-card.green { background: linear-gradient(135deg, #f0fdf4, #dcfce7); }
.mobile-task-card.purple { background: linear-gradient(135deg, #faf5ff, #f3e8ff); }
.mobile-task-card.orange { background: linear-gradient(135deg, #fff7ed, #ffedd5); }
.mobile-task-card.pink { background: linear-gradient(135deg, #fdf2f8, #fce7f3); }

.mobile-task-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.mobile-highlight {
  padding: 2px 6px;
  border-radius: 4px;
  background: #fef2f2;
  color: #ef4444;
  font-size: 10px;
  font-weight: 700;
}

.mobile-task-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--mini-text);
}

.mobile-task-desc {
  margin: 0 0 10px;
  font-size: 13px;
  color: var(--mini-text-secondary);
  line-height: 1.5;
}

.mobile-task-meta {
  display: flex;
  justify-content: space-between;
  font-size: 12px;
  color: var(--mini-text-muted);
  margin-bottom: 12px;
}

.mobile-task-meta strong {
  color: #ef4444;
  font-weight: 700;
}

.mobile-task-btn {
  width: 100%;
  padding: 10px;
  border: none;
  border-radius: 999px;
  background: var(--mini-primary);
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.mobile-task-card.green .mobile-task-btn { background: #22c55e; }
.mobile-task-card.purple .mobile-task-btn { background: #a855f7; }
.mobile-task-card.orange .mobile-task-btn { background: #f97316; }
.mobile-task-card.pink .mobile-task-btn { background: #ec4899; }
</style>
