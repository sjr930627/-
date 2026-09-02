<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import EntMiniNavBar from '@/components/enterprise-miniapp/EntMiniNavBar.vue'
import { useAppStore } from '@/stores/app'
import { useEnterpriseMiniAuth } from '@/composables/useEnterpriseMiniAuth'
import { recruitmentLeadStatusMap } from '@/constants/recruitment'
import type { RecruitmentLeadStatus } from '@/types'

type LeadListType = 'pending' | 'offer' | 'hired'

const route = useRoute()
const store = useAppStore()
const { enterpriseId } = useEnterpriseMiniAuth()

const listType = computed<LeadListType>(() => {
  const t = route.query.type
  if (t === 'offer' || t === 'hired' || t === 'pending') return t
  return 'pending'
})

const reqFilter = computed(() =>
  typeof route.query.req === 'string' ? route.query.req : '',
)

const titleMap: Record<LeadListType, string> = {
  pending: '待处理',
  offer: 'Offer / 待入驻',
  hired: '已录用',
}

const statusSet = computed<RecruitmentLeadStatus[]>(() => {
  if (listType.value === 'pending') return ['screening']
  if (listType.value === 'offer') {
    return [
      'salary_negotiation',
      'background_check',
      'medical_check',
      'onboarding_pending',
    ]
  }
  return ['onboarded', 'qualified']
})

const leads = computed(() => {
  let list = store.recruitmentLeads.filter(
    (l) =>
      l.enterpriseId === enterpriseId.value &&
      statusSet.value.includes(l.status) &&
      l.status !== 'closed',
  )
  if (reqFilter.value) list = list.filter((l) => l.requirementId === reqFilter.value)
  return [...list].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
})

function advance(id: string) {
  try {
    store.advanceLeadStatus(id)
    ElMessage.success('已推进下一阶段')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '推进失败')
  }
}
</script>

<template>
  <div class="mini-page">
    <EntMiniNavBar :title="titleMap[listType]" back-to="/enterprise-miniapp/recruitment" />
    <div class="list">
      <div v-if="!leads.length" class="empty">暂无{{ titleMap[listType] }}人员</div>
      <article v-for="l in leads" :key="l.id" class="card">
        <div class="row">
          <strong>{{ l.candidateName }}</strong>
          <em>{{ recruitmentLeadStatusMap[l.status] || l.status }}</em>
        </div>
        <p>{{ l.requirementTitle || l.position }}</p>
        <p class="meta">{{ l.phone }} · {{ l.source || '未知渠道' }}</p>
        <p v-if="l.onboardDate" class="meta">入职日期 {{ l.onboardDate }}</p>
        <p v-else-if="l.interviewDate" class="meta">
          面试 {{ l.interviewDate }} {{ l.interviewTime || '' }}
        </p>
        <button
          v-if="listType !== 'hired' && l.status !== 'closed' && l.status !== 'qualified'"
          type="button"
          class="mini-btn-primary sm"
          @click="advance(l.id)"
        >
          推进进度
        </button>
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
  background: #fff;
  border-radius: 12px;
  padding: 12px 14px;
  box-shadow: 0 1px 6px rgba(15, 23, 42, 0.04);
}
.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.row strong {
  font-size: 15px;
  color: #111827;
}
.row em {
  font-style: normal;
  font-size: 11px;
  color: #228BFF;
  background: #D5E9FF;
  padding: 2px 8px;
  border-radius: 999px;
  white-space: nowrap;
}
.card p {
  margin: 6px 0 0;
  font-size: 12px;
  color: #6b7280;
}
.meta {
  color: #9ca3af !important;
}
.sm {
  margin-top: 10px;
  height: 32px;
  font-size: 13px;
}
.empty {
  padding: 40px 0;
  text-align: center;
  color: #9ca3af;
  font-size: 13px;
}
</style>
