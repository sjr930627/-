<script setup lang="ts">
import { computed } from 'vue'
import {
  Bell,
  Calendar,
  List,
  FolderOpened,
  User,
  CircleCheck,
  CircleClose,
  DocumentChecked,
} from '@element-plus/icons-vue'
import type { WorkbenchMetricCard } from '@/services/workbenchDashboard'

const props = defineProps<{
  metrics: WorkbenchMetricCard[]
}>()

const iconMap = {
  todo: List,
  today: Calendar,
  message: Bell,
  users: User,
  hire: CircleCheck,
  leave: CircleClose,
  approval: DocumentChecked,
} as const

const toneClass = computed(() => {
  const map: Record<string, string> = {}
  for (const item of props.metrics) {
    map[item.key] = `tone-${item.tone}`
  }
  return map
})

function resolveIcon(item: WorkbenchMetricCard) {
  return iconMap[item.icon] ?? FolderOpened
}
</script>

<template>
  <div class="metric-row" :class="`cols-${metrics.length}`">
    <div
      v-for="item in metrics"
      :key="item.key"
      class="metric-card"
      :class="toneClass[item.key]"
    >
      <div class="metric-top">
        <div class="metric-icon">
          <el-icon :size="18"><component :is="resolveIcon(item)" /></el-icon>
        </div>
        <div class="metric-label">{{ item.label }}</div>
      </div>

      <div class="metric-mid">
        <div class="metric-value">{{ item.value }}</div>
      </div>

      <div v-if="item.compareLabel || item.subLabel || item.footExtra" class="metric-foot">
        <div class="metric-foot-main">
          <span v-if="item.compareLabel" class="metric-compare">{{ item.compareLabel }}</span>
          <span v-if="item.subLabel" class="metric-sub urgent">{{ item.subLabel }}</span>
        </div>
        <div v-if="item.footExtra" class="metric-foot-extra">{{ item.footExtra }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.metric-row {
  display: grid;
  gap: 16px;
  margin-bottom: 16px;
}

.metric-row.cols-3 {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.metric-row.cols-4 {
  grid-template-columns: repeat(4, minmax(0, 1fr));
}

.metric-card {
  background: #fff;
  border-radius: 12px;
  padding: 18px 20px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04), 0 6px 18px rgba(15, 23, 42, 0.04);
  border: 1px solid #eef2f7;
}

.metric-top {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
}

.metric-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: #eff6ff;
  color: #2563eb;
}

.tone-orange .metric-icon {
  background: #fff7ed;
  color: #ea580c;
}

.tone-blue .metric-icon {
  background: #eff6ff;
  color: #2563eb;
}

.tone-teal .metric-icon {
  background: #f0fdfa;
  color: #0d9488;
}

.tone-purple .metric-icon {
  background: #f5f3ff;
  color: #7c3aed;
}

.tone-green .metric-icon {
  background: #f0fdf4;
  color: #16a34a;
}

.tone-red .metric-icon {
  background: #fef2f2;
  color: #dc2626;
}

.metric-label {
  font-size: 13px;
  color: #64748b;
}

.metric-mid {
  margin-bottom: 12px;
}

.metric-value {
  font-size: 30px;
  font-weight: 700;
  color: #0f172a;
  line-height: 1;
}

.metric-foot {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #94a3b8;
  padding-top: 10px;
  border-top: 1px solid #f1f5f9;
}

.metric-foot-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.metric-compare {
  color: #64748b;
}

.metric-sub.urgent {
  color: #dc2626;
  font-weight: 600;
}

.metric-foot-extra {
  color: #64748b;
}

@media (max-width: 1200px) {
  .metric-row.cols-3,
  .metric-row.cols-4 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 640px) {
  .metric-row.cols-3,
  .metric-row.cols-4 {
    grid-template-columns: 1fr;
  }
}
</style>
