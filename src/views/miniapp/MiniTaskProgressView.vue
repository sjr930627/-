<script setup lang="ts">
import MiniNavBack from '@/components/miniapp/MiniNavBack.vue'
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useMiniWorkerTasks, type WorkerTaskStatus } from '@/composables/useMiniWorkerTasks'

const router = useRouter()

const { counts, pendingMyActionCount, tasksByStatus } = useMiniWorkerTasks()

const activeTab = ref<WorkerTaskStatus>('in_progress')
const onlyPendingMine = ref(false)

const tabs: { key: WorkerTaskStatus; label: string }[] = [
  { key: 'in_progress', label: '进行中' },
  { key: 'completed', label: '已完成' },
  { key: 'settled', label: '已结算' },
  { key: 'cancelled', label: '已取消' },
]

function formatDate(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function tabCount(key: WorkerTaskStatus) {
  return counts.value[key]
}

function displayedTasks() {
  return tasksByStatus(activeTab.value, onlyPendingMine.value)
}

function togglePendingMine() {
  onlyPendingMine.value = !onlyPendingMine.value
  if (onlyPendingMine.value) activeTab.value = 'in_progress'
}
</script>

<template>
  <div>
    <div class="mini-nav-bar">
      <MiniNavBack fallback="/miniapp/task-hall" />
      <div class="mini-nav-title">任务进度</div>
    </div>
    <div class="mini-page">
      <div class="mini-tabs task-tabs">
        <button
          v-for="tab in tabs"
          :key="tab.key"
          class="mini-tab"
          :class="{ active: activeTab === tab.key }"
          type="button"
          @click="activeTab = tab.key"
        >
          {{ tab.label }}<span v-if="tabCount(tab.key)" class="tab-count">{{ tabCount(tab.key) }}</span>
        </button>
      </div>

      <div class="filter-row" v-if="activeTab === 'in_progress'">
        <button
          class="filter-chip"
          :class="{ active: onlyPendingMine }"
          type="button"
          @click="togglePendingMine"
        >
          待我完成
          <span v-if="pendingMyActionCount" class="chip-count">{{ pendingMyActionCount }}</span>
        </button>
      </div>

      <div
        v-for="t in displayedTasks()"
        :key="t.instance.id"
        class="mini-card task-card"
        @click="router.push(`/miniapp/tasks/${t.instance.id}`)"
      >
        <div class="task-head">
          <div class="task-name">{{ t.instance.taskName }}</div>
          <span class="mini-tag" :class="`tone-${t.statusTone}`">
            {{ t.instance.currentNodeName }}
          </span>
        </div>
        <div class="task-meta">
          <span>{{ t.instance.taskTypeName }}</span>
          <span>{{ t.instance.enterpriseName }}</span>
        </div>
        <div v-if="activeTab === 'in_progress'" class="task-progress-wrap">
          <div class="task-progress-bar">
            <div class="task-progress-fill" :style="{ width: `${t.progress}%` }" />
          </div>
          <div class="task-progress-labels">
            <span>节点 {{ t.stepIndex }}/{{ t.stepTotal }}</span>
            <span>{{ t.progress }}%</span>
          </div>
        </div>
        <div class="task-foot">
          <span class="task-amount">¥{{ t.instance.amount }}</span>
          <span class="task-time">更新于 {{ formatDate(t.instance.updatedAt) }}</span>
        </div>
      </div>

      <div v-if="displayedTasks().length === 0" class="mini-empty">
        <template v-if="onlyPendingMine">暂无待您完成的任务</template>
        <template v-else>暂无{{ tabs.find((t) => t.key === activeTab)?.label }}任务</template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.task-card {
  cursor: pointer;
}

.task-tabs .mini-tab {
  padding: 8px 4px;
  font-size: 12px;
}

.tab-count {
  margin-left: 2px;
  font-size: 11px;
  opacity: 0.85;
}

.filter-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.filter-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border: 1px solid var(--mini-border);
  border-radius: 999px;
  background: #fff;
  font-size: 13px;
  color: var(--mini-text-secondary);
  cursor: pointer;
}

.filter-chip.active {
  border-color: var(--mini-primary);
  background: #E6FFFA;
  color: var(--mini-primary);
  font-weight: 600;
}

.chip-count {
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: var(--mini-primary);
  color: #fff;
  font-size: 10px;
  line-height: 16px;
  text-align: center;
}

.filter-chip.active .chip-count {
  background: var(--mini-primary);
}

.task-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 8px;
}

.task-name {
  font-size: 16px;
  font-weight: 600;
  color: #333;
  flex: 1;
}

.task-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 12px;
  color: #999;
  margin-bottom: 10px;
}

.task-progress-wrap {
  margin-bottom: 10px;
}

.task-progress-bar {
  height: 6px;
  background: #f0f0f0;
  border-radius: 3px;
  overflow: hidden;
}

.task-progress-fill {
  height: 100%;
  background: var(--mini-primary);
  border-radius: 3px;
}

.task-progress-labels {
  display: flex;
  justify-content: space-between;
  font-size: 11px;
  color: #999;
  margin-top: 4px;
}

.task-foot {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 12px;
}

.task-amount {
  font-size: 16px;
  font-weight: 700;
  color: #ef4444;
}

.task-time {
  color: #bbb;
}

.mini-tag.tone-blue {
  background: #E6FFFA;
  color: #4FD1C5;
}

.mini-tag.tone-orange {
  background: #fff7ed;
  color: #ea580c;
}

.mini-tag.tone-purple {
  background: #f5f3ff;
  color: #7c3aed;
}

.mini-tag.tone-green {
  background: #f0fdf4;
  color: #16a34a;
}

.mini-tag.tone-gray {
  background: #f3f4f6;
  color: #6b7280;
}

.mini-tag.tone-amber {
  background: #fffbeb;
  color: #d97706;
}
</style>
