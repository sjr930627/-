<script setup lang="ts">
import { ref } from 'vue'
import { useMiniAppBack } from '@/composables/useMiniAppBack'
import { useMiniWorkerTasks, type WorkerTaskStatus } from '@/composables/useMiniWorkerTasks'

const { goBack } = useMiniAppBack('/miniapp/profile')
const { counts, tasksByStatus } = useMiniWorkerTasks()

const activeTab = ref<WorkerTaskStatus>('in_progress')

const tabs: { key: WorkerTaskStatus; label: string }[] = [
  { key: 'in_progress', label: '进行中' },
  { key: 'completed', label: '已完成' },
  { key: 'settled', label: '已结算' },
]

function formatDate(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}

function tabCount(key: WorkerTaskStatus) {
  return counts.value[key]
}
</script>

<template>
  <div>
    <div class="mini-nav-bar">
      <button class="mini-nav-back" type="button" @click="goBack">← 返回</button>
      <div class="mini-nav-title">任务进度</div>
    </div>
    <div class="mini-page">
      <div class="mini-tabs">
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

      <div v-for="t in tasksByStatus(activeTab)" :key="t.instance.id" class="mini-card task-card">
        <div class="task-head">
          <div class="task-name">{{ t.instance.taskName }}</div>
          <span class="mini-tag" :class="activeTab === 'in_progress' ? 'orange' : activeTab === 'completed' ? 'blue' : 'green'">
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

      <div v-if="tasksByStatus(activeTab).length === 0" class="mini-empty">
        暂无{{ tabs.find((t) => t.key === activeTab)?.label }}任务
      </div>
    </div>
  </div>
</template>

<style scoped>
.tab-count {
  margin-left: 2px;
  font-size: 11px;
  opacity: 0.85;
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
  background: #e60012;
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
  color: #e60012;
}

.task-time {
  color: #bbb;
}

.mini-tag.blue {
  background: #f0f7ff;
  color: #1890ff;
}

.mini-tag.orange {
  background: #fff7e6;
  color: #fa8c16;
}
</style>
