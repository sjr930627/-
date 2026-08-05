<script setup lang="ts">
import { useRouter } from 'vue-router'
import type { AttendanceAlertItem } from '@/services/workbenchDashboard'

defineProps<{
  items: AttendanceAlertItem[]
}>()

const router = useRouter()

const severityIcon: Record<AttendanceAlertItem['severity'], string> = {
  severe: '✕',
  warning: '⏰',
  info: '⏰',
  pending: '🌙',
}

const severityClass: Record<AttendanceAlertItem['severity'], string> = {
  severe: 'severe',
  warning: 'warning',
  info: 'info',
  pending: 'pending',
}
</script>

<template>
  <section class="wb-card">
    <div class="card-head">
      <div>
        <h3 class="card-title">考勤异常提醒</h3>
        <p class="card-sub">今日 {{ items.length }} 条异常记录</p>
      </div>
      <el-button
        link
        type="primary"
        @click="router.push(items[0]?.path ?? '/attendance-exceptions')"
      >
        查看全部 →
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
        <div class="alert-icon" :class="severityClass[item.severity]">
          {{ severityIcon[item.severity] }}
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
  border-radius: 16px;
  padding: 20px 22px;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px rgba(15, 23, 42, 0.06);
}

.card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 16px;
}

.card-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #0f172a;
}

.card-sub {
  margin: 4px 0 0;
  font-size: 13px;
  color: #94a3b8;
}

.alert-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.alert-item {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid #f1f5f9;
  border-radius: 12px;
  cursor: pointer;
  transition: background 0.15s ease;
}

.alert-item:hover {
  background: #f8fafc;
}

.alert-icon {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  flex-shrink: 0;
}

.alert-icon.severe {
  background: #fef2f2;
  color: #dc2626;
}

.alert-icon.warning {
  background: #fff7ed;
  color: #ea580c;
}

.alert-icon.info {
  background: #eff6ff;
  color: #2563eb;
}

.alert-icon.pending {
  background: #f8fafc;
  color: #475569;
}

.alert-body {
  flex: 1;
  min-width: 0;
}

.alert-title {
  font-size: 14px;
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
