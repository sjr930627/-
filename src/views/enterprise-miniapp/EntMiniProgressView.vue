<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import EntMiniNavBar from '@/components/enterprise-miniapp/EntMiniNavBar.vue'
import { useAppStore } from '@/stores/app'
import { useEnterpriseMiniAuth } from '@/composables/useEnterpriseMiniAuth'
import { recruitmentLeadStatusMap } from '@/constants/recruitment'

const route = useRoute()
const store = useAppStore()
const { enterpriseId } = useEnterpriseMiniAuth()
const keyword = ref('')

const reqFilter = computed(() =>
  typeof route.query.req === 'string' ? route.query.req : '',
)

const leads = computed(() => {
  let list = store.recruitmentLeads.filter((l) => l.enterpriseId === enterpriseId.value)
  if (reqFilter.value) list = list.filter((l) => l.requirementId === reqFilter.value)
  const kw = keyword.value.trim()
  if (kw) {
    list = list.filter(
      (l) => l.candidateName.includes(kw) || l.phone.includes(kw) || l.position.includes(kw),
    )
  }
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
    <EntMiniNavBar title="招聘进度" back-to="/enterprise-miniapp/recruitment" />
    <div class="search">
      <input v-model="keyword" placeholder="搜索候选人/岗位">
    </div>
    <div class="list">
      <div v-if="!leads.length" class="empty">暂无线索</div>
      <article v-for="l in leads" :key="l.id" class="card">
        <div class="row">
          <strong>{{ l.candidateName }}</strong>
          <em>{{ recruitmentLeadStatusMap[l.status] || l.status }}</em>
        </div>
        <p>{{ l.requirementTitle || l.position }}</p>
        <p class="meta">{{ l.phone }} · {{ l.source }}</p>
        <p v-if="l.interviewDate" class="meta">
          面试 {{ l.interviewDate }} {{ l.interviewTime || '' }}
        </p>
        <button
          v-if="l.status !== 'onboarded' && l.status !== 'closed' && l.status !== 'qualified'"
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
.search {
  padding: 0 16px 10px;
}
.search input {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 10px 12px;
  background: #fff;
}
.list {
  padding: 0 16px 24px;
}
.card {
  background: #fff;
  border-radius: 12px;
  padding: 12px;
  margin-bottom: 8px;
  box-shadow: var(--mini-shadow);
}
.row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
.row em {
  font-style: normal;
  font-size: 11px;
  color: #5b4fdb;
  background: #eef2ff;
  padding: 2px 8px;
  border-radius: 999px;
  white-space: nowrap;
}
.card p {
  margin: 4px 0 0;
  font-size: 12px;
  color: #6b7280;
}
.meta {
  color: #9ca3af !important;
}
.sm {
  margin-top: 10px;
  height: 32px;
  padding: 0 12px;
  border: none;
  border-radius: 8px;
  background: #5b4fdb;
  color: #fff;
  font-size: 12px;
}
.empty {
  padding: 40px 0;
  text-align: center;
  color: #9ca3af;
}
</style>
