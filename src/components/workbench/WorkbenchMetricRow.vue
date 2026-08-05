<script setup lang="ts">
import type { WorkbenchMetricCard } from '@/services/workbenchDashboard'

defineProps<{
  metrics: WorkbenchMetricCard[]
}>()

const iconMap = {
  users: '👥',
  hire: '➕',
  leave: '➖',
  approval: '⏰',
}
</script>

<template>
  <div class="metric-row">
    <div v-for="item in metrics" :key="item.key" class="metric-card">
      <div class="metric-icon" :class="item.tone">{{ iconMap[item.icon] }}</div>
      <div class="metric-body">
        <div class="metric-label">{{ item.label }}</div>
        <div class="metric-value-row">
          <span class="metric-value">{{ item.value }}</span>
          <span
            v-if="item.trend"
            class="metric-trend"
            :class="{
              up: item.trend.direction === 'up',
              down: item.trend.direction === 'down',
            }"
          >
            {{ item.trend.direction === 'up' ? '↑' : '↓' }} {{ item.trend.text }}
          </span>
        </div>
        <div v-if="item.subLabel" class="metric-sub urgent">{{ item.subLabel }}</div>
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
  display: flex;
  align-items: flex-start;
  gap: 14px;
  background: #fff;
  border-radius: 16px;
  padding: 20px 22px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px rgba(15, 23, 42, 0.06);
}

.metric-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  flex-shrink: 0;
}

.metric-icon.purple {
  background: #f3e8ff;
}

.metric-icon.green {
  background: #ecfdf5;
}

.metric-icon.red {
  background: #fef2f2;
}

.metric-icon.orange {
  background: #fff7ed;
}

.metric-label {
  font-size: 13px;
  color: #64748b;
  margin-bottom: 6px;
}

.metric-value-row {
  display: flex;
  align-items: baseline;
  gap: 8px;
}

.metric-value {
  font-size: 28px;
  font-weight: 700;
  color: #0f172a;
  line-height: 1;
}

.metric-trend {
  font-size: 12px;
  font-weight: 600;
}

.metric-trend.up {
  color: #16a34a;
}

.metric-trend.down {
  color: #dc2626;
}

.metric-sub {
  margin-top: 6px;
  font-size: 12px;
  color: #64748b;
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
