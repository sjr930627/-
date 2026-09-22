<script setup lang="ts">
import MiniNavBack from '@/components/miniapp/MiniNavBack.vue'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Clock, Document, Top } from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import {
  buildGrabInterviewApplicationDisplay,
  grabInterviewStatusTagClass,
  isGrabInterviewRegForWorker,
} from '@/services/miniApplication'
import { listOpenGrabInterviewPosts } from '@/services/miniGrabInterview'

const route = useRoute()
const router = useRouter()
const store = useAppStore()
const { employeeId, employee } = useMiniAppWorker()

const reg = computed(() => {
  const found = store.grabInterviewRegistrations.find((r) => r.id === route.params.id)
  if (!found) return undefined
  if (!isGrabInterviewRegForWorker(found, employee.value ?? { id: employeeId.value })) {
    return undefined
  }
  return found
})

const display = computed(() =>
  reg.value
    ? buildGrabInterviewApplicationDisplay(reg.value, {
        enterprises: store.enterprises,
        departments: store.departments,
      })
    : null,
)

const postId = computed(() => {
  if (!reg.value) return null
  const r = reg.value
  const matched = listOpenGrabInterviewPosts(store, employeeId.value, {
    previewLimit: 1,
  }).find(
    (p) =>
      p.enterpriseId === r.enterpriseId &&
      p.departmentId === r.departmentId &&
      p.positionName === r.position,
  )
  if (matched) return matched.id
  // 无开放场次时仍按配置拼 postId，便于回看岗位详情
  for (const cfg of store.grabInterviewConfigs) {
    if (cfg.enterpriseId !== r.enterpriseId) continue
    for (const dept of cfg.deptRules) {
      if (dept.departmentId !== r.departmentId) continue
      const pos = dept.positions.find((p) => p.profile.positionName === r.position)
      if (pos) return `${cfg.enterpriseId}__${dept.departmentId}__${pos.id}`
    }
  }
  return null
})

const processSteps = [
  {
    title: '选择时间',
    desc: '免筛简历，锁定名额',
    icon: Clock,
  },
  {
    title: '线下面试',
    desc: '奖励秒结，等待评估',
    icon: Document,
  },
  {
    title: '日常抢班',
    desc: '通过后，优先报名',
    icon: Top,
  },
]

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('zh-CN')
}

function openPostDetail() {
  if (!postId.value) {
    ElMessage.info('暂无可查看的岗位详情')
    return
  }
  router.push(`/miniapp/recommend/interview/${encodeURIComponent(postId.value)}`)
}
</script>

<template>
  <div class="detail-page">
    <div class="mini-nav-bar">
      <MiniNavBack fallback="/miniapp/applications" />
      <div class="mini-nav-title">抢班面试详情</div>
    </div>

    <div v-if="display && reg" class="mini-page">
      <div
        class="mini-card job-card"
        :class="{ clickable: !!postId }"
        @click="openPostDetail"
      >
        <div class="head-row">
          <h1 class="job-name">{{ display.positionName }}</h1>
          <span class="mini-tag" :class="grabInterviewStatusTagClass(display.status)">
            {{ display.statusLabel }}
          </span>
        </div>
        <div class="meta-line">{{ display.orgLabel }}</div>
        <div class="schedule-line">{{ display.scheduleLabel }}</div>
        <div v-if="postId" class="job-card-hint">查看岗位详情 ›</div>
      </div>

      <div class="mini-card status-card">
        <div class="mini-card-title">当前状态</div>
        <p class="status-text">{{ display.detailHint }}</p>
      </div>

      <div class="mini-card">
        <div class="mini-card-title">报名抢班直面流程</div>
        <div class="process-row">
          <div
            v-for="(step, idx) in processSteps"
            :key="step.title"
            class="process-step"
          >
            <div class="process-icon">
              <el-icon :size="18"><component :is="step.icon" /></el-icon>
            </div>
            <div class="process-title">{{ step.title }}</div>
            <div class="process-desc">{{ step.desc }}</div>
            <div v-if="idx < processSteps.length - 1" class="process-arrow">›</div>
          </div>
        </div>
      </div>

      <div class="mini-card">
        <div class="mini-card-title">面试信息</div>
        <div class="info-row"><span>所属部门</span><span>{{ display.departmentName }}</span></div>
        <div class="info-row"><span>面试日期</span><span>{{ display.interviewDate }}</span></div>
        <div class="info-row"><span>星期</span><span>{{ display.weekdayLabel || '—' }}</span></div>
        <div class="info-row"><span>时段窗口</span><span>{{ display.timeSlotLabel }}</span></div>
        <div class="info-row">
          <span>面试准确时间</span>
          <span>{{ display.interviewExactTime || '—' }}</span>
        </div>
      </div>

      <div class="mini-card">
        <div class="mini-card-title">报名记录</div>
        <div class="info-row"><span>报名时间</span><span>{{ formatTime(display.createdAt) }}</span></div>
        <div class="info-row">
          <span>审核时间</span>
          <span>{{ display.feedbackAt ? formatTime(display.feedbackAt) : '—' }}</span>
        </div>
      </div>
    </div>

    <div v-else class="mini-empty">记录不存在</div>
  </div>
</template>

<style scoped>
.detail-page {
  min-height: 100%;
  background: #f5f6f8;
}

.head-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.job-card.clickable {
  cursor: pointer;
}

.job-card-hint {
  margin-top: 10px;
  font-size: 12px;
  font-weight: 600;
  color: var(--mini-primary, #4fd1c5);
}

.job-name {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #333;
}

.meta-line {
  margin-top: 6px;
  font-size: 13px;
  color: #999;
}

.schedule-line {
  margin-top: 10px;
  font-size: 15px;
  font-weight: 600;
  color: #333;
}

.status-text {
  margin: 0;
  font-size: 14px;
  color: #666;
  line-height: 1.6;
}

.process-row {
  display: flex;
  align-items: flex-start;
  gap: 4px;
}

.process-step {
  position: relative;
  flex: 1;
  min-width: 0;
  text-align: center;
  padding: 0 4px;
}

.process-icon {
  width: 36px;
  height: 36px;
  margin: 0 auto 8px;
  border-radius: 50%;
  background: #ecfdf5;
  color: #16a34a;
  display: flex;
  align-items: center;
  justify-content: center;
}

.process-title {
  font-size: 13px;
  font-weight: 700;
  color: #1a1a1a;
}

.process-desc {
  margin-top: 4px;
  font-size: 11px;
  color: #999;
  line-height: 1.35;
}

.process-arrow {
  position: absolute;
  top: 8px;
  right: -8px;
  color: #d1d5db;
  font-size: 18px;
  line-height: 1;
}

.info-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  font-size: 13px;
  border-bottom: 1px solid #f5f5f5;
}

.info-row:last-child {
  border-bottom: none;
}

.info-row span:first-child {
  color: #999;
  flex-shrink: 0;
}

.info-row span:last-child {
  color: #333;
  text-align: right;
}

.mini-tag.grey {
  background: #f3f4f6;
  color: #6b7280;
}
</style>
