<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import EntMiniNavBar from '@/components/enterprise-miniapp/EntMiniNavBar.vue'
import { useAppStore } from '@/stores/app'
import { useEnterpriseMiniAuth } from '@/composables/useEnterpriseMiniAuth'
import { jobRequirementStatusMap } from '@/constants/recruitment'

const route = useRoute()
const store = useAppStore()
const { enterpriseId } = useEnterpriseMiniAuth()

const reqFilter = computed(() =>
  typeof route.query.req === 'string' ? route.query.req : '',
)

const jobs = computed(() => {
  let list = store.jobRequirements.filter((j) => j.enterpriseId === enterpriseId.value)
  if (reqFilter.value) list = list.filter((j) => j.id === reqFilter.value)
  return [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt))
})
</script>

<template>
  <div class="mini-page">
    <EntMiniNavBar title="岗位需求" back-to="/enterprise-miniapp/recruitment" />
    <div class="list">
      <div v-if="!jobs.length" class="empty">暂无岗位需求</div>
      <article v-for="j in jobs" :key="j.id" class="card">
        <div class="row">
          <strong>{{ j.title }}</strong>
          <em>{{ jobRequirementStatusMap[j.status] || j.status }}</em>
        </div>
        <p>{{ j.department }} · {{ j.location || '未填地点' }}</p>
        <p class="meta">
          需求 {{ j.headcount }} · 已招 {{ j.filledCount }} · 缺口
          {{ Math.max(j.headcount - j.filledCount, 0) }}
        </p>
        <p class="meta">薪资 {{ j.salaryMin }}-{{ j.salaryMax }} · {{ j.createdAt.slice(0, 10) }}</p>
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
  color: #5b4fdb;
  background: #eef2ff;
  padding: 2px 8px;
  border-radius: 999px;
}
.card p {
  margin: 6px 0 0;
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
  font-size: 13px;
}
</style>
