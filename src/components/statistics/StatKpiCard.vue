<script setup lang="ts">
defineProps<{
  label: string
  value: string | number
  suffix?: string
  trend?: string
  trendUp?: boolean
  subText?: string
  color?: 'blue' | 'green' | 'orange' | 'red' | 'purple' | 'cyan' | 'pink'
  icon?: string
}>()
</script>

<template>
  <div class="kpi-card">
    <div class="kpi-top">
      <span class="kpi-label">{{ label }}</span>
      <div v-if="icon" class="kpi-icon" :class="color ?? 'blue'">
        <el-icon><component :is="icon" /></el-icon>
      </div>
    </div>
    <div class="kpi-value">
      {{ value }}<span v-if="suffix" class="kpi-suffix">{{ suffix }}</span>
    </div>
    <div v-if="trend" class="kpi-trend" :class="trendUp ? 'up' : 'down'">
      {{ trendUp ? '↑' : '↓' }} {{ trend }}
    </div>
    <div v-if="subText" class="kpi-sub">{{ subText }}</div>
    <slot />
  </div>
</template>

<style scoped>
.kpi-card {
  background: #fff;
  border-radius: 12px;
  padding: 18px 20px;
  border: 1px solid var(--app-border);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  height: 100%;
}

.kpi-top {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 10px;
}

.kpi-label {
  font-size: 13px;
  color: #909399;
}

.kpi-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
}

.kpi-icon.blue { background: #eef3ff; color: #5b8ff9; }
.kpi-icon.green { background: #e8faf3; color: #5ad8a6; }
.kpi-icon.orange { background: #fef6e8; color: #f6bd16; }
.kpi-icon.red { background: #fdeee8; color: #e8684a; }
.kpi-icon.purple { background: #f3eefb; color: #9270ca; }
.kpi-icon.cyan { background: #e8f7fc; color: #6dc8ec; }
.kpi-icon.pink { background: #fdeef5; color: #ff99c3; }

.kpi-value {
  font-size: 28px;
  font-weight: 700;
  color: #1a1a2e;
  line-height: 1.2;
}

.kpi-suffix {
  font-size: 14px;
  font-weight: 500;
  margin-left: 2px;
}

.kpi-trend {
  margin-top: 8px;
  font-size: 12px;
}

.kpi-trend.up { color: #52c41a; }
.kpi-trend.down { color: #f5222d; }

.kpi-sub {
  margin-top: 8px;
  font-size: 12px;
  color: #909399;
}
</style>
