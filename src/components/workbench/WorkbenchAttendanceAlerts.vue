<script setup lang="ts">
import { useRouter } from 'vue-router'
import type { AttendanceAlertItem } from '@/services/workbenchDashboard'

defineProps<{
  items: AttendanceAlertItem[]
}>()

const router = useRouter()
</script>

<template>
  <section class="wb-card">
    <div class="card-head">
      <h3 class="card-title">考勤异常提醒</h3>
      <el-button
        link
        type="primary"
        @click="router.push(items[0]?.path ?? '/attendance-exceptions')"
      >
        查看全部
      </el-button>
    </div>

    <el-empty v-if="!items.length" description="今日暂无考勤异常" :image-size="64" />

    <div v-else class="alert-list">
      <div
        v-for="item in items"
        :key="item.id"
        class="alert-item"
        @click="router.push(item.path)"
      >
        <div class="alert-icon">
          <el-icon :size="16"><Clock /></el-icon>
        </div>
        <div class="alert-body">
          <div class="alert-title">{{ item.title }}</div>
          <div class="alert-desc">{{ item.description }}</div>
        </div>
        <div class="alert-time">{{ item.timeLabel }}</div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.wb-card {
  background: #fff;
  border-radius: 12px;
  padding: 18px 20px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04), 0 6px 18px rgba(15, 23, 42, 0.04);
  border: 1px solid #eef2f7;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 14px;
}

.card-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #0f172a;
  padding-left: 10px;
  border-left: 3px solid #2563eb;
  line-height: 1.2;
}

.alert-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.alert-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 12px 14px;
  border: 1px solid #f1f5f9;
  border-radius: 10px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.alert-item:hover {
  background: #fffbeb;
}

.alert-icon {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff7ed;
  color: #ea580c;
  flex-shrink: 0;
}

.alert-body {
  flex: 1;
  min-width: 0;
}

.alert-title {
  font-size: 13px;
  font-weight: 600;
  color: #0f172a;
}

.alert-desc {
  margin-top: 4px;
  font-size: 12px;
  color: #94a3b8;
  line-height: 1.5;
}

.alert-time {
  font-size: 12px;
  color: #94a3b8;
  white-space: nowrap;
}
</style>
