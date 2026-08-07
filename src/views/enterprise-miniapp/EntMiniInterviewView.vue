<script setup lang="ts">
import { computed } from 'vue'
import EntMiniNavBar from '@/components/enterprise-miniapp/EntMiniNavBar.vue'
import { useAppStore } from '@/stores/app'
import { useEnterpriseMiniAuth } from '@/composables/useEnterpriseMiniAuth'
import { recruitmentLeadStatusMap } from '@/constants/recruitment'

const store = useAppStore()
const { enterpriseId } = useEnterpriseMiniAuth()

const interviews = computed(() =>
  store.recruitmentLeads
    .filter(
      (l) =>
        l.enterpriseId === enterpriseId.value &&
        Boolean(l.interviewDate) &&
        (l.status === 'interview_pending' ||
          l.status === 'interview_attended' ||
          l.status === 'feedback_pending'),
    )
    .sort((a, b) =>
      `${a.interviewDate}${a.interviewTime || ''}`.localeCompare(
        `${b.interviewDate}${b.interviewTime || ''}`,
      ),
    ),
)
</script>

<template>
  <div class="mini-page">
    <EntMiniNavBar title="面试进度" back-to="/enterprise-miniapp/recruitment" />
    <div class="list">
      <div v-if="!interviews.length" class="empty">暂无面试安排</div>
      <article v-for="l in interviews" :key="l.id" class="card">
        <div class="date">
          <strong>{{ l.interviewDate }}</strong>
          <span>{{ l.interviewTime || '待定' }}</span>
        </div>
        <div class="body">
          <strong>{{ l.candidateName }}</strong>
          <p>{{ l.requirementTitle || l.position }}</p>
          <p class="meta">
            {{ recruitmentLeadStatusMap[l.status] }}
            · {{ l.interviewMethod === 'online' ? '线上面试' : '线下面试' }}
          </p>
          <p v-if="l.interviewAddress" class="meta">{{ l.interviewAddress }}</p>
          <p v-if="l.interviewer" class="meta">面试官：{{ l.interviewer }}</p>
        </div>
      </article>
    </div>
  </div>
</template>

<style scoped>
.list {
  padding: 8px 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.card {
  display: flex;
  gap: 12px;
  background: #fff;
  border-radius: 12px;
  padding: 12px;
  box-shadow: var(--mini-shadow);
}
.date {
  width: 72px;
  flex-shrink: 0;
  text-align: center;
  background: #eef2ff;
  border-radius: 10px;
  padding: 10px 6px;
  color: #4338ca;
}
.date strong {
  display: block;
  font-size: 12px;
}
.date span {
  display: block;
  margin-top: 4px;
  font-size: 13px;
  font-weight: 700;
}
.body strong {
  font-size: 14px;
}
.body p {
  margin: 4px 0 0;
  font-size: 12px;
  color: #6b7280;
}
.meta {
  color: #9ca3af !important;
}
.empty {
  padding: 40px 0;
  text-align: center;
  color: #9ca3af;
}
</style>
