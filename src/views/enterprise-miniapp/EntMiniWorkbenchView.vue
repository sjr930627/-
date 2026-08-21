<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  Calendar,
  Checked,
  Clock,
  DocumentChecked,
  EditPen,
  Promotion,
  Timer,
  UserFilled,
} from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'
import { useEnterpriseMiniAuth } from '@/composables/useEnterpriseMiniAuth'

const router = useRouter()
const store = useAppStore()
const { displayName, enterpriseId } = useEnterpriseMiniAuth()

const enterpriseName = computed(
  () => store.enterprises.find((e) => e.id === enterpriseId.value)?.name || '企业',
)

const stats = computed(() => {
  const eid = enterpriseId.value
  const reqs = store.jobRequirements.filter((r) => r.enterpriseId === eid)
  const leads = store.recruitmentLeads.filter((l) => l.enterpriseId === eid)
  const qualPending = leads.filter(
    (l) =>
      l.ext?.criminalRecordStatus === 'pending' || l.ext?.healthCertStatus === 'pending',
  ).length
  const interviews = leads.filter(
    (l) => l.status === 'interview_pending' || l.status === 'interview_attended',
  ).length
  const makeupPending = store.makeupRequests.filter((r) => r.status === 'pending').length
  const excOpen = store.exceptions.filter(
    (e) => e.status === 'open' || e.status === 'appealed',
  ).length
  const grabPending = store.grabShiftApplications.filter((a) => a.status === 'pending').length
  return {
    recruiting: reqs.filter((r) => r.status === 'recruiting').length,
    leads: leads.length,
    interviews,
    qualPending,
    makeupPending,
    excOpen,
    grabPending,
  }
})

const entries = [
  {
    title: '发布招聘',
    desc: '提交岗位需求',
    path: '/enterprise-miniapp/recruitment/publish',
    icon: Promotion,
    color: '#5b4fdb',
  },
  {
    title: '招聘进度',
    desc: '线索跟进流转',
    path: '/enterprise-miniapp/recruitment/progress',
    icon: UserFilled,
    color: '#2563eb',
  },
  {
    title: '面试日程',
    desc: '查看面试安排',
    path: '/enterprise-miniapp/recruitment/interview',
    icon: Calendar,
    color: '#0891b2',
  },
  {
    title: '资质审核',
    desc: '无犯罪证明 / 健康证',
    path: '/enterprise-miniapp/recruitment/qual',
    icon: DocumentChecked,
    color: '#059669',
  },
  {
    title: '编辑排班',
    desc: '划线排班与调整',
    path: '/enterprise-miniapp/schedule',
    icon: EditPen,
    color: '#7c3aed',
  },
  {
    title: '需求总览',
    desc: '查看排班缺口并发布需求',
    path: '/enterprise-miniapp/shift-demand',
    icon: Clock,
    color: '#d97706',
  },
  {
    title: '抢班管理',
    desc: '报名情况与发布抢班',
    path: '/enterprise-miniapp/grab-manage',
    icon: Timer,
    color: '#ea580c',
  },
  {
    title: '工时确认',
    desc: '确认与批量确认工时',
    path: '/enterprise-miniapp/hours-confirm',
    icon: Checked,
    color: '#0f766e',
  },
]
</script>

<template>
  <div class="page">
    <header class="hero">
      <p class="eyebrow">企业小程序</p>
      <h1>{{ enterpriseName }}</h1>
      <p class="sub">你好，{{ displayName || '管理员' }}</p>
    </header>

    <section class="stats">
      <div class="stat"><strong>{{ stats.recruiting }}</strong><span>招聘中</span></div>
      <div class="stat"><strong>{{ stats.interviews }}</strong><span>面试中</span></div>
      <div class="stat"><strong>{{ stats.qualPending }}</strong><span>待审资质</span></div>
      <div class="stat"><strong>{{ stats.excOpen + stats.makeupPending }}</strong><span>考勤待办</span></div>
    </section>

    <section class="grid">
      <button
        v-for="item in entries"
        :key="item.path"
        type="button"
        class="entry"
        @click="router.push(item.path)"
      >
        <span class="icon" :style="{ background: item.color + '18', color: item.color }">
          <el-icon :size="20"><component :is="item.icon" /></el-icon>
        </span>
        <span class="text">
          <strong>{{ item.title }}</strong>
          <small>{{ item.desc }}</small>
        </span>
      </button>
    </section>
  </div>
</template>

<style scoped>
.page {
  padding-bottom: 16px;
}
.hero {
  padding: 20px 16px 12px;
  background: linear-gradient(160deg, #5b4fdb 0%, #7c6df0 55%, #eef2ff 100%);
  color: #fff;
}
.eyebrow {
  margin: 0;
  font-size: 12px;
  opacity: 0.85;
}
h1 {
  margin: 6px 0 0;
  font-size: 20px;
}
.sub {
  margin: 6px 0 0;
  font-size: 13px;
  opacity: 0.9;
}
.stats {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin: -18px 16px 0;
  position: relative;
  z-index: 1;
}
.stat {
  background: #fff;
  border-radius: 12px;
  padding: 10px 6px;
  text-align: center;
  box-shadow: var(--mini-shadow);
}
.stat strong {
  display: block;
  font-size: 18px;
  color: #4338ca;
}
.stat span {
  font-size: 10px;
  color: #9ca3af;
}
.grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
  padding: 16px;
}
.entry {
  display: flex;
  gap: 10px;
  align-items: center;
  text-align: left;
  border: none;
  background: #fff;
  border-radius: 14px;
  padding: 12px;
  box-shadow: var(--mini-shadow);
  cursor: pointer;
}
.icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.text strong {
  font-size: 13px;
  color: #111827;
}
.text small {
  font-size: 11px;
  color: #9ca3af;
}
</style>
