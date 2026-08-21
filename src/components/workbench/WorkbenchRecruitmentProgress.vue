<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import type { RecruitmentReminderItem } from '@/services/workbenchDashboard'

const props = defineProps<{
  reminders?: RecruitmentReminderItem[]
}>()

const router = useRouter()

const list = computed(() => props.reminders ?? [])

function tagType(item: RecruitmentReminderItem) {
  if (item.kind === 'onboard_today') return 'success'
  if (item.kind === 'interview_today') return 'warning'
  if (item.kind === 'interview_followup') return 'primary'
  if (item.kind === 'screening') return 'warning'
  if (item.level === 'urgent') return 'danger'
  return 'info'
}

function goDefault() {
  router.push(list.value[0]?.path ?? '/recruitment/progress')
}
</script>

<template>
  <section class="wb-card">
    <div class="card-head">
      <h3 class="card-title">招聘进度提醒</h3>
      <el-button link type="primary" @click="goDefault">查看全部</el-button>
    </div>

    <el-empty v-if="!list.length" description="今日暂无面试/入职提醒" :image-size="64" />

    <div v-else class="reminder-grid">
      <div
        v-for="item in list.slice(0, 6)"
        :key="item.id"
        class="reminder-item"
        @click="router.push(item.path)"
      >
        <el-tag size="small" :type="tagType(item)" effect="light" round>
          {{ item.tag }}
        </el-tag>
        <div class="reminder-body">
          <div class="reminder-title">{{ item.title }}</div>
          <div class="reminder-detail">{{ item.detail }}</div>
        </div>
        <el-icon class="reminder-arrow"><ArrowRight /></el-icon>
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

.reminder-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}

.reminder-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 10px;
  background: #f8fafc;
  border: 1px solid #f1f5f9;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.reminder-item:hover {
  background: #eff6ff;
  border-color: #dbeafe;
}

.reminder-body {
  flex: 1;
  min-width: 0;
}

.reminder-title {
  font-size: 13px;
  font-weight: 600;
  color: #0f172a;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reminder-detail {
  margin-top: 2px;
  font-size: 12px;
  color: #94a3b8;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reminder-arrow {
  color: #cbd5e1;
  flex-shrink: 0;
}

@media (max-width: 900px) {
  .reminder-grid {
    grid-template-columns: 1fr;
  }
}
</style>
