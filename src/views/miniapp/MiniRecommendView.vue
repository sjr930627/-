<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import { formatSalaryRange } from '@/constants/recruitment'
import { getGrabShiftPostExtra, getGrabShiftSlotExtra } from '@/mock/miniappDetailSeed'

const store = useAppStore()
const route = useRoute()
const router = useRouter()
const { employeeId } = useMiniAppWorker()
const activeTab = ref<'jobs' | 'shifts' | 'tasks'>('jobs')

const tabs = [
  { key: 'jobs' as const, label: '岗位招聘' },
  { key: 'shifts' as const, label: '抢班' },
  { key: 'tasks' as const, label: '任务管理' },
]

function syncTabFromRoute() {
  const tab = route.query.tab
  if (tab === 'tasks' || tab === 'shifts' || tab === 'jobs') {
    activeTab.value = tab
  }
}

syncTabFromRoute()
watch(() => route.query.tab, syncTabFromRoute)

function switchTab(tab: 'jobs' | 'shifts' | 'tasks') {
  activeTab.value = tab
  router.replace({ path: '/miniapp/recommend', query: { tab } })
}

const sectionTitle = computed(() => {
  if (activeTab.value === 'jobs') return '岗位需求'
  if (activeTab.value === 'shifts') return '抢班班次'
  return '任务大厅'
})

const jobs = computed(() =>
  store.jobRequirements
    .filter((j) => j.status === 'active')
    .map((j) => ({
      ...j,
      salaryLabel: formatSalaryRange(j.salaryMin, j.salaryMax),
      remain: j.headcount - j.filledCount,
    })),
)

const grabPosts = computed(() => {
  const open = store.grabShiftSlots.filter((s) => s.status === 'open' || s.status === 'partial')
  const teamIds = [...new Set(open.map((s) => s.teamId))]
  return teamIds.map((teamId) => {
    const teamSlots = open.filter((s) => s.teamId === teamId)
    const first = teamSlots[0]
    const post = getGrabShiftPostExtra(teamId, first.teamName)
    const pays = teamSlots.map((s) => getGrabShiftSlotExtra(s.id, s.date).pay)
    const minPay = Math.min(...pays)
    const maxPay = Math.max(...pays)
    const appliedCount = teamSlots.filter((s) =>
      store.grabShiftApplications.some(
        (a) => a.slotId === s.id && a.employeeId === employeeId.value,
      ),
    ).length
    return {
      teamId,
      title: post.title,
      storeName: post.storeName,
      shiftCount: teamSlots.length,
      payLabel: minPay === maxPay ? `¥${minPay}/班` : `¥${minPay}~${maxPay}/班`,
      tags: post.tags.slice(0, 3),
      appliedAll: appliedCount === teamSlots.length,
    }
  })
})

const hallTasks = computed(() =>
  store.tasks
    .filter((t) => t.status === 'active' && t.dispatchMode === 'hall')
    .map((t) => ({
      ...t,
      myCount: store.taskInstances.filter(
        (i) => i.taskId === t.id && i.workerId === employeeId.value,
      ).length,
    })),
)

function openJob(id: string) {
  router.push(`/miniapp/recommend/job/${id}`)
}

function openShift(teamId: string) {
  router.push(`/miniapp/recommend/shift/${teamId}`)
}

function grabTask(taskId: string) {
  try {
    store.acceptTaskFromHall(taskId, employeeId.value)
    ElMessage.success('任务领取成功')
  } catch (e) {
    ElMessage.warning(e instanceof Error ? e.message : '领取失败')
  }
}

function onViewMore() {
  ElMessage.info('查看更多（演示）')
}
</script>

<template>
  <div class="rec-page">
    <div class="rec-pill-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        type="button"
        class="rec-pill-tab"
        :class="{ active: activeTab === tab.key }"
        @click="switchTab(tab.key)"
      >
        {{ tab.label }}
      </button>
    </div>

    <div class="rec-section-head">
      <span class="rec-section-title">{{ sectionTitle }}</span>
      <button type="button" class="rec-section-more" @click="onViewMore">查看更多 ›</button>
    </div>

    <template v-if="activeTab === 'jobs'">
      <div v-for="job in jobs" :key="job.id" class="mini-card job-card" @click="openJob(job.id)">
        <div class="job-head">
          <div>
            <div class="job-title">{{ job.title }}</div>
            <div class="job-sub">{{ job.enterpriseName }}</div>
          </div>
          <span class="mini-tag red">{{ job.salaryLabel }}</span>
        </div>
        <div class="job-meta">📍 {{ job.location }} · 招 {{ job.remain }} 人</div>
      </div>
      <div v-if="jobs.length === 0" class="mini-empty">暂无在招岗位</div>
    </template>

    <template v-if="activeTab === 'shifts'">
      <div
        v-for="post in grabPosts"
        :key="post.teamId"
        class="mini-card shift-card"
        @click="openShift(post.teamId)"
      >
        <div class="job-head">
          <div>
            <div class="job-title">{{ post.title }}</div>
            <div class="job-sub">{{ post.storeName }}</div>
          </div>
          <span class="mini-tag red">{{ post.payLabel }}</span>
        </div>
        <div class="shift-tags">
          <span v-for="t in post.tags" :key="t" class="mini-tag red">{{ t }}</span>
        </div>
        <div class="job-meta">共 {{ post.shiftCount }} 个班次 · 点击查看并选择</div>
        <div v-if="post.appliedAll" class="shift-applied-tip">已全部报名</div>
      </div>
      <div v-if="grabPosts.length === 0" class="mini-empty">暂无抢班班次</div>
    </template>

    <template v-if="activeTab === 'tasks'">
      <div v-for="task in hallTasks" :key="task.id" class="mini-card task-card">
        <div class="job-head">
          <div class="job-title">{{ task.name }}</div>
          <span class="mini-tag blue">{{ task.taskTypeName }}</span>
        </div>
        <div class="job-sub">{{ task.enterpriseName }}</div>
        <div class="job-meta">{{ task.description.slice(0, 60) }}…</div>
        <div class="job-sub">
          📍 {{ task.region ?? '不限' }} · 已领 {{ task.acceptedCount }} · 我领 {{ task.myCount }} 次
        </div>
        <button class="mini-btn-outline shift-btn" @click="grabTask(task.id)">领取任务</button>
      </div>
      <div v-if="hallTasks.length === 0" class="mini-empty">暂无大厅任务</div>
    </template>
  </div>
</template>

<style scoped>
.rec-page {
  padding: 12px 12px 16px;
  background: #f5f6f8;
  min-height: 100%;
}

.rec-pill-tabs {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.rec-pill-tab {
  padding: 8px 18px;
  border-radius: 999px;
  border: none;
  font-size: 14px;
  font-weight: 500;
  line-height: 1.2;
  background: #f3f4f6;
  color: #666;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}

.rec-pill-tab.active {
  background: #e60012;
  color: #fff;
}

.rec-section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 0 10px;
  margin-top: 4px;
  border-top: 1px solid #f0f0f0;
}

.rec-section-title {
  font-size: 16px;
  font-weight: 700;
  color: #1a1a1a;
}

.rec-section-more {
  font-size: 13px;
  color: #e60012;
  background: none;
  border: none;
  padding: 0;
  cursor: pointer;
}

.job-card,
.shift-card { cursor: pointer; }
.task-card { cursor: default; }

.job-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.job-title {
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.job-sub {
  font-size: 12px;
  color: #999;
  margin-top: 4px;
}

.job-meta {
  font-size: 12px;
  color: #666;
  margin-top: 8px;
}

.shift-tags {
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.shift-btn {
  display: block;
  box-sizing: border-box;
  margin-top: 12px;
  width: 100%;
  padding: 12px;
  font-size: 15px;
  font-weight: 600;
  text-align: center;
}

.shift-applied-tip {
  margin-top: 8px;
  font-size: 12px;
  color: var(--app-primary);
}

.mini-tag.blue {
  background: #f0f7ff;
  color: #1890ff;
}
</style>
