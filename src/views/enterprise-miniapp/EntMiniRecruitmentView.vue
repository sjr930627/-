<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { useEnterpriseMiniAuth } from '@/composables/useEnterpriseMiniAuth'
import { jobRequirementStatusMap } from '@/constants/recruitment'

const router = useRouter()
const store = useAppStore()
const { enterpriseId } = useEnterpriseMiniAuth()

const requirements = computed(() =>
  store.jobRequirements
    .filter((r) => r.enterpriseId === enterpriseId.value)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
)

const menus = [
  { title: '发布招聘需求', path: '/enterprise-miniapp/recruitment/publish' },
  { title: '招聘进度', path: '/enterprise-miniapp/recruitment/progress' },
  { title: '面试进度', path: '/enterprise-miniapp/recruitment/interview' },
  { title: '资质审核', path: '/enterprise-miniapp/recruitment/qual' },
]
</script>

<template>
  <div class="mini-page">
    <header class="head">
      <h1>招聘管理</h1>
      <p>发布需求、跟进进度、面试与资质审核</p>
    </header>

    <section class="menus">
      <button v-for="m in menus" :key="m.path" type="button" @click="router.push(m.path)">
        {{ m.title }}
        <span>›</span>
      </button>
    </section>

    <section class="list">
      <h2>本企业需求</h2>
      <div v-if="!requirements.length" class="empty">暂无招聘需求</div>
      <article v-for="r in requirements" :key="r.id" class="card">
        <div class="row">
          <strong>{{ r.title }}</strong>
          <em>{{ jobRequirementStatusMap[r.status] || r.status }}</em>
        </div>
        <p>{{ r.department }} · 缺 {{ r.headcount - r.filledCount }} / {{ r.headcount }}</p>
        <p class="meta">{{ r.location }} · ¥{{ r.salaryMin }}-{{ r.salaryMax }}</p>
        <button
          type="button"
          class="link"
          @click="router.push(`/enterprise-miniapp/recruitment/progress?req=${r.id}`)"
        >
          查看进度
        </button>
      </article>
    </section>
  </div>
</template>

<style scoped>
.head {
  padding: 18px 16px 8px;
}
h1 {
  margin: 0;
  font-size: 20px;
}
.head p {
  margin: 6px 0 0;
  font-size: 12px;
  color: #9ca3af;
}
.menus {
  margin: 8px 16px 12px;
  background: #fff;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: var(--mini-shadow);
}
.menus button {
  width: 100%;
  display: flex;
  justify-content: space-between;
  border: none;
  background: none;
  padding: 14px 14px;
  font-size: 14px;
  border-bottom: 1px solid #f3f4f6;
  cursor: pointer;
}
.menus button:last-child {
  border-bottom: none;
}
.menus span {
  color: #c4c4c4;
}
.list {
  padding: 0 16px 24px;
}
h2 {
  margin: 0 0 8px;
  font-size: 14px;
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
}
.card p {
  margin: 4px 0 0;
  font-size: 12px;
  color: #6b7280;
}
.meta {
  color: #9ca3af !important;
}
.link {
  margin-top: 8px;
  border: none;
  background: none;
  color: #5b4fdb;
  font-size: 12px;
  padding: 0;
}
.empty {
  padding: 24px;
  text-align: center;
  color: #9ca3af;
  font-size: 13px;
}
</style>
