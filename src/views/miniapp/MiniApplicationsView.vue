<script setup lang="ts">
import MiniNavBack from '@/components/miniapp/MiniNavBack.vue'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import {
  buildGrabInterviewApplicationDisplay,
  buildGrabShiftApplicationDisplay,
  grabInterviewStatusTagClass,
  grabStatusTagClass,
  isGrabInterviewRegForWorker,
} from '@/services/miniApplication'

const router = useRouter()
const store = useAppStore()
const { employeeId, employee } = useMiniAppWorker()
const activeTab = ref<'job' | 'interview' | 'shift'>('interview')

const interviewApps = computed(() =>
  store.grabInterviewRegistrations
    .filter((r) => isGrabInterviewRegForWorker(r, employee.value ?? { id: employeeId.value }))
    .map((r) =>
      buildGrabInterviewApplicationDisplay(r, {
        enterprises: store.enterprises,
        departments: store.departments,
      }),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
)

const shiftApps = computed(() =>
  store.grabShiftApplications
    .filter((a) => a.employeeId === employeeId.value)
    .map((a) =>
      buildGrabShiftApplicationDisplay(a, store.grabShiftSlots.find((s) => s.id === a.slotId), {
        enterprises: store.enterprises,
        departments: store.departments,
        attendanceGroups: store.attendanceGroups,
      }),
    )
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
)

function openInterviewDetail(id: string) {
  router.push(`/miniapp/applications/interview/${id}`)
}

function openShiftDetail(id: string) {
  router.push(`/miniapp/applications/shift/${id}`)
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
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
      </button>
      <button
        type="button"
        class="apps-tab"
        :class="{ active: activeTab === 'interview' }"
        @click="activeTab = 'interview'"
      >
        抢班面试
      </button>
      <button
        type="button"
        class="apps-tab"
        :class="{ active: activeTab === 'shift' }"
        @click="activeTab = 'shift'"
      >
        抢班报名
      </button>
    </div>

    <div class="mini-page">
      <template v-if="activeTab === 'job'">
        <div class="dev-placeholder">
          <div class="dev-placeholder-icon">岗</div>
          <h3>岗位报名</h3>
          <p>功能开发中，敬请期待</p>
        </div>
      </template>

      <template v-else-if="activeTab === 'interview'">
        <div
          v-for="a in interviewApps"
          :key="a.id"
          class="app-card"
          @click="openInterviewDetail(a.id)"
        >
          <div class="app-card-head">
            <div class="app-card-title">{{ a.positionName }}</div>
            <span class="mini-tag" :class="grabInterviewStatusTagClass(a.status)">
              {{ a.statusLabel }}
            </span>
          </div>
          <div class="app-card-sub">{{ a.orgLabel }}</div>
          <div class="app-card-schedule">面试时间 {{ a.scheduleLabel }}</div>
          <div class="app-card-hint">{{ a.detailHint }}</div>
          <div class="app-card-foot">报名时间 {{ formatTime(a.createdAt) }} ›</div>
        </div>
        <div v-if="interviewApps.length === 0" class="mini-empty">暂无抢班面试报名</div>
      </template>

      <template v-else>
        <div
          v-for="a in shiftApps"
          :key="a.id"
          class="app-card"
          @click="openShiftDetail(a.id)"
        >
          <div class="app-card-head">
            <div class="app-card-title">{{ a.positionName }}</div>
            <span class="mini-tag" :class="grabStatusTagClass(a.phase, a.status)">
              {{ a.statusLabel }}
            </span>
          </div>
          <div class="app-card-sub">{{ a.orgLabel }}</div>
          <div class="app-card-schedule">
            {{ a.date }} {{ a.timeRange }} · {{ a.payLabel }}
          </div>
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
  gap: 4px;
  padding: 12px 8px 0;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
  overflow-x: auto;
}

.apps-tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 0;
  padding: 10px 4px;
  border: none;
  border-bottom: 2px solid transparent;
  background: none;
  font-size: 13px;
  font-weight: 500;
  color: #666;
  cursor: pointer;
  white-space: nowrap;
}

.apps-tab.active {
  color: var(--mini-primary, #4fd1c5);
  border-bottom-color: var(--mini-primary, #4fd1c5);
  font-weight: 600;
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

.app-card-schedule {
  margin-top: 4px;
  font-size: 13px;
  font-weight: 500;
  color: #555;
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
  background: #e6fffa;
  color: var(--mini-primary, #4fd1c5);
}

.mini-tag.grey {
  background: #f3f4f6;
  color: #6b7280;
}

.dev-placeholder {
  margin-top: 48px;
  text-align: center;
  color: #999;
}

.dev-placeholder-icon {
  width: 56px;
  height: 56px;
  margin: 0 auto 12px;
  border-radius: 16px;
  background: #e6fffa;
  color: var(--mini-primary, #4fd1c5);
  font-size: 22px;
  font-weight: 700;
  line-height: 56px;
}

.dev-placeholder h3 {
  margin: 0 0 6px;
  font-size: 16px;
  font-weight: 600;
  color: #333;
}

.dev-placeholder p {
  margin: 0;
  font-size: 13px;
}
</style>
