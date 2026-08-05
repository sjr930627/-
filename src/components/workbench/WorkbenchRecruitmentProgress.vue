<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import type { RecruitmentReminderItem } from '@/services/workbenchDashboard'

const props = defineProps<{
  reminders?: RecruitmentReminderItem[]
}>()

const router = useRouter()

const list = computed(() => props.reminders ?? [])

const morningCount = computed(
  () =>
    list.value.filter((r) =>
      ['onboard_today', 'interview_today', 'interview_followup'].includes(r.kind),
    ).length,
)

function tagType(item: RecruitmentReminderItem) {
  if (item.kind === 'onboard_today') return 'success'
  if (item.kind === 'interview_today') return 'danger'
  if (item.kind === 'interview_followup') return 'warning'
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
      <div>
        <h3 class="card-title">招聘进度提醒</h3>
        <p class="card-sub">
          每日早晨 ·
          {{ morningCount ? `${morningCount} 条今日面试/入职` : '暂无今日安排' }}
          <template v-if="list.length"> · 共 {{ list.length }} 条</template>
        </p>
      </div>
      <el-button link type="primary" @click="goDefault">
        查看全部 →
      </el-button>
    </div>

    <el-empty v-if="!list.length" description="今日暂无面试/入职提醒" :image-size="64" />

    <div v-else class="reminder-list">
      <div
        v-for="item in list"
        :key="item.id"
        class="reminder-item"
        :class="[item.level, item.kind]"
        @click="router.push(item.path)"
      >
        <el-tag size="small" :type="tagType(item)" effect="light">
          {{ item.tag }}
        </el-tag>
        <div class="reminder-body">
          <div class="reminder-title">{{ item.title }}</div>
          <div class="reminder-detail">{{ item.detail }}</div>
        </div>
        <span class="reminder-action">{{ item.actionLabel }} →</span>
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

.reminder-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.reminder-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 14px;
  border-radius: 10px;
  border: 1px solid #f1f5f9;
  cursor: pointer;
  transition: background 0.15s ease, border-color 0.15s ease;
}

.reminder-item:hover {
  background: #f8fafc;
  border-color: #e2e8f0;
}

.reminder-item.onboard_today {
  background: #f6ffed;
  border-color: #b7eb8f;
}

.reminder-item.interview_today {
  background: #fff1f0;
  border-color: #ffa39e;
}

.reminder-item.interview_followup {
  background: #fff7e6;
  border-color: #ffd591;
}

.reminder-item.urgent:not(.onboard_today):not(.interview_today):not(.interview_followup) {
  background: #fff1f0;
  border-color: #ffa39e;
}

.reminder-item.important:not(.interview_followup) {
  background: #fff7e6;
  border-color: #ffd591;
}

.reminder-body {
  flex: 1;
  min-width: 0;
}

.reminder-title {
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
}

.reminder-detail {
  margin-top: 2px;
  font-size: 12px;
  color: #64748b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.reminder-action {
  flex-shrink: 0;
  font-size: 12px;
  font-weight: 600;
  color: #3b82f6;
}
</style>
