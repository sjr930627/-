<script setup lang="ts">
import type { WorkbenchMetricCard } from '@/services/workbenchDashboard'

defineProps<{
  metrics: WorkbenchMetricCard[]
}>()

function sparkPath(points: number[]) {
  if (!points.length) return ''
  const max = Math.max(...points, 1)
  const min = Math.min(...points, 0)
  const span = Math.max(max - min, 1)
  const w = 72
  const h = 28
  return points
    .map((v, i) => {
      const x = (i / Math.max(points.length - 1, 1)) * w
      const y = h - ((v - min) / span) * (h - 4) - 2
      return `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
    })
    .join(' ')
}

function trendClass(item: WorkbenchMetricCard) {
  if (!item.trend) return ''
  const positive = item.trend.positive ?? item.trend.direction === 'up'
  return positive ? 'up' : 'down'
}
</script>

<template>
  <div class="metric-row">
    <div v-for="item in metrics" :key="item.key" class="metric-card">
      <div class="metric-top">
        <div class="metric-icon">
          <el-icon :size="18"><FolderOpened /></el-icon>
        </div>
        <div class="metric-label">{{ item.label }}</div>
      </div>

      <div class="metric-mid">
        <div class="metric-value">{{ item.value }}</div>
        <svg
          v-if="item.sparkline?.length"
          class="metric-spark"
          viewBox="0 0 72 28"
          preserveAspectRatio="none"
        >
          <path :d="sparkPath(item.sparkline)" fill="none" stroke="#3b82f6" stroke-width="2" />
        </svg>
      </div>

      <div class="metric-foot">
        <span v-if="item.compareLabel" class="metric-compare">{{ item.compareLabel }}</span>
        <span v-if="item.subLabel" class="metric-sub urgent">{{ item.subLabel }}</span>
        <span v-if="item.trend" class="metric-trend" :class="trendClass(item)">
          较上月 {{ item.trend.direction === 'up' ? '+' : '-' }}{{ item.trend.text }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.metric-row {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 16px;
  margin-bottom: 16px;
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
  background: #eff6ff;
  color: #2563eb;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.metric-label {
  font-size: 13px;
  color: #64748b;
}

.metric-mid {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.metric-value {
  font-size: 30px;
  font-weight: 700;
  color: #0f172a;
  line-height: 1;
}

.metric-spark {
  width: 72px;
  height: 28px;
  flex-shrink: 0;
}

.metric-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 12px;
  color: #94a3b8;
  padding-top: 10px;
  border-top: 1px solid #f1f5f9;
}

.metric-compare {
  color: #64748b;
}

.metric-trend.up {
  color: #16a34a;
  font-weight: 600;
}

.metric-trend.down {
  color: #dc2626;
  font-weight: 600;
}

.metric-sub.urgent {
  color: #dc2626;
  font-weight: 600;
}

@media (max-width: 1200px) {
  .metric-row {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
</style>
