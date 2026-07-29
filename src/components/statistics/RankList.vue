<script setup lang="ts">
defineProps<{
  items: { name: string; value: number; percent: number; color?: string }[]
  valueSuffix?: string
}>()
</script>

<template>
  <div class="rank-list">
    <div v-for="(item, idx) in items" :key="item.name" class="rank-item">
      <span class="rank-no" :class="{ top: idx < 3 }">{{ idx + 1 }}</span>
      <span class="rank-name">{{ item.name }}</span>
      <div class="rank-bar-wrap">
        <div
          class="rank-bar"
          :style="{ width: `${item.percent}%`, background: item.color ?? '#5B8FF9' }"
        />
      </div>
      <span class="rank-value">{{ item.value }}{{ valueSuffix ?? '%' }}</span>
    </div>
  </div>
</template>

<style scoped>
.rank-list {
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.rank-item {
  display: flex;
  align-items: center;
  gap: 10px;
}

.rank-no {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: #f0f2f5;
  color: #909399;
  font-size: 12px;
  font-weight: 600;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.rank-no.top {
  background: #eef3ff;
  color: #5b8ff9;
}

.rank-name {
  width: 80px;
  font-size: 13px;
  flex-shrink: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rank-bar-wrap {
  flex: 1;
  height: 8px;
  background: #f5f6fa;
  border-radius: 4px;
  overflow: hidden;
}

.rank-bar {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s;
}

.rank-value {
  width: 42px;
  text-align: right;
  font-size: 13px;
  font-weight: 600;
  color: #303133;
  flex-shrink: 0;
}
</style>
