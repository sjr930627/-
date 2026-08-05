<script setup lang="ts">
import MiniNavBack from '@/components/miniapp/MiniNavBack.vue'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import { buildGrabShiftApplicationDisplay, buildJobApplicationDisplay, grabStatusTagClass, jobStatusTagClass } from '@/services/miniApplication'

const router = useRouter()
const store = useAppStore()
const { employeeId } = useMiniAppWorker()
const activeTab = ref<'job' | 'shift'>('job')

const jobApps = computed(() =>
  store.miniJobApplications
    .filter((a) => a.employeeId === employeeId.value)
    .map((a) => buildJobApplicationDisplay(a, store.jobRequirements.find((j) => j.id === a.jobRequirementId)))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
)

const shiftApps = computed(() =>
  store.grabShiftApplications
    .filter((a) => a.employeeId === employeeId.value)
    .map((a) =>
      buildGrabShiftApplicationDisplay(a, store.grabShiftSlots.find((s) => s.id === a.slotId)),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
)

function openJobDetail(id: string) {
  router.push(`/miniapp/applications/job/${id}`)
}

function openShiftDetail(id: string) {
  router.push(`/miniapp/applications/shift/${id}`)
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="apps-page">
    <div class="mini-nav-bar">
      <MiniNavBack fallback="/miniapp/profile" />
      <div class="mini-nav-title">我的报名</div>
    </div>

    <div class="apps-tabs">
      <button
        type="button"
        class="apps-tab"
        :class="{ active: activeTab === 'job' }"
        @click="activeTab = 'job'"
      >
        岗位报名
        <span v-if="jobApps.length" class="apps-tab-count">{{ jobApps.length }}</span>
      </button>
      <button
        type="button"
        class="apps-tab"
        :class="{ active: activeTab === 'shift' }"
        @click="activeTab = 'shift'"
      >
        抢班报名
        <span v-if="shiftApps.length" class="apps-tab-count">{{ shiftApps.length }}</span>
      </button>
    </div>

    <div class="mini-page">
      <template v-if="activeTab === 'job'">
        <div
          v-for="a in jobApps"
          :key="a.id"
          class="app-card"
          @click="openJobDetail(a.id)"
        >
          <div class="app-card-head">
            <div class="app-card-title">{{ a.title }}</div>
            <span class="mini-tag" :class="jobStatusTagClass(a.status)">{{ a.statusLabel }}</span>
          </div>
          <div class="app-card-sub">{{ a.enterprise }} · {{ a.salaryLabel }}</div>
          <div class="app-card-hint">{{ a.detailHint }}</div>
          <div class="app-card-foot">报名时间 {{ formatTime(a.createdAt) }} ›</div>
        </div>
        <div v-if="jobApps.length === 0" class="mini-empty">暂无岗位报名</div>
      </template>

      <template v-else>
        <div
          v-for="a in shiftApps"
          :key="a.id"
          class="app-card"
          @click="openShiftDetail(a.id)"
        >
          <div class="app-card-head">
            <div class="app-card-title">{{ a.postTitle }} · {{ a.title }}</div>
            <span class="mini-tag" :class="grabStatusTagClass(a.phase, a.status)">{{ a.statusLabel }}</span>
          </div>
          <div class="app-card-sub">{{ a.date }} {{ a.timeRange }} · {{ a.payLabel }}</div>
          <div class="app-card-hint">{{ a.detailHint }}</div>
          <div class="app-card-foot">报名时间 {{ formatTime(a.createdAt) }} ›</div>
        </div>
        <div v-if="shiftApps.length === 0" class="mini-empty">暂无抢班报名</div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.apps-page {
  min-height: 100%;
  background: #f5f6f8;
}

.apps-tabs {
  display: flex;
  gap: 8px;
  padding: 12px 12px 0;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
}

.apps-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 10px 0;
  border: none;
  border-bottom: 2px solid transparent;
  background: none;
  font-size: 14px;
  font-weight: 500;
  color: #666;
  cursor: pointer;
}

.apps-tab.active {
  color: var(--app-primary);
  border-bottom-color: var(--app-primary);
  font-weight: 600;
}

.apps-tab-count {
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: var(--app-primary-light);
  color: var(--app-primary);
  font-size: 11px;
  line-height: 18px;
}

.app-card {
  background: #fff;
  border-radius: 12px;
  padding: 14px;
  margin-bottom: 10px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  cursor: pointer;
}

.app-card-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.app-card-title {
  font-size: 15px;
  font-weight: 600;
  color: #333;
  line-height: 1.4;
}

.app-card-sub {
  margin-top: 6px;
  font-size: 12px;
  color: #999;
}

.app-card-hint {
  margin-top: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  background: #fafafa;
  font-size: 12px;
  color: #666;
  line-height: 1.5;
}

.app-card-foot {
  margin-top: 10px;
  font-size: 11px;
  color: #bbb;
  text-align: right;
}

.mini-tag.blue {
  background: #e6f7ff;
  color: #1890ff;
}
</style>
