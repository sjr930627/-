<script setup lang="ts">
import MiniNavBack from '@/components/miniapp/MiniNavBack.vue'
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import { buildJobApplicationDisplay, jobStatusTagClass } from '@/services/miniApplication'

const route = useRoute()
const store = useAppStore()
const { employeeId } = useMiniAppWorker()

const app = computed(() =>
  store.miniJobApplications.find(
    (a) => a.id === route.params.id && a.employeeId === employeeId.value,
  ),
)

const job = computed(() =>
  app.value ? store.jobRequirements.find((j) => j.id === app.value!.jobRequirementId) : undefined,
)

const display = computed(() =>
  app.value ? buildJobApplicationDisplay(app.value, job.value) : null,
)

const steps = computed(() => {
  if (!display.value) return []
  const s = display.value.status
  return [
    { key: 'submit', label: '提交报名', done: true, active: s === 'pending' },
    { key: 'review', label: '平台审核', done: s !== 'pending', active: s === 'pending' },
    {
      key: 'interview',
      label: '面试安排',
      done: s === 'approved' || s === 'rejected',
      active: s === 'interview',
      skip: s === 'rejected' && !display.value.interviewDate,
    },
    {
      key: 'result',
      label: s === 'rejected' ? '未通过' : '审核结果',
      done: s === 'approved' || s === 'rejected',
      active: s === 'approved' || s === 'rejected',
    },
  ].filter((x) => !x.skip)
})

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('zh-CN')
}
</script>

<template>
  <div class="detail-page">
    <div class="mini-nav-bar">
      <MiniNavBack fallback="/miniapp/applications" />
      <div class="mini-nav-title">岗位报名详情</div>
    </div>

    <div v-if="display && job" class="mini-page">
      <div class="mini-card">
        <div class="head-row">
          <h1 class="job-name">{{ display.title }}</h1>
          <span class="mini-tag" :class="jobStatusTagClass(display.status)">{{ display.statusLabel }}</span>
        </div>
        <div class="meta-line">{{ job.enterpriseName }}</div>
        <div class="meta-line">📍 {{ job.location }}</div>
        <div class="salary">{{ display.salaryLabel }}</div>
      </div>

      <div class="mini-card">
        <div class="mini-card-title">审核进度</div>
        <div class="steps">
          <div v-for="(step, idx) in steps" :key="step.key" class="step-item">
            <div class="step-line" :class="{ last: idx === steps.length - 1 }">
              <span class="step-dot" :class="{ done: step.done, active: step.active }" />
            </div>
            <div class="step-body">
              <div class="step-label" :class="{ active: step.active }">{{ step.label }}</div>
            </div>
          </div>
        </div>
      </div>

      <div class="mini-card status-card">
        <div class="mini-card-title">当前状态</div>
        <p class="status-text">{{ display.detailHint }}</p>
        <div v-if="display.status === 'interview' && display.interviewDate" class="info-box">
          <div>面试时间：{{ display.interviewDate }} {{ display.interviewTime ?? '' }}</div>
          <div>请携带身份证及相关资质证书</div>
        </div>
        <div v-if="display.status === 'rejected' && display.reviewNote" class="info-box warn">
          驳回原因：{{ display.reviewNote }}
        </div>
        <div v-if="display.status === 'approved'" class="info-box ok">
          您已通过岗位审核，请留意后续排班或上岗通知。
        </div>
      </div>

      <div class="mini-card">
        <div class="mini-card-title">报名信息</div>
        <div class="info-row"><span>薪酬方式</span><span class="money-text">{{ display.salaryLabel }}</span></div>
        <div class="info-row"><span>报名时间</span><span>{{ formatTime(display.createdAt) }}</span></div>
        <div class="info-row"><span>报名岗位</span><span>{{ display.title }}</span></div>
        <div class="info-row"><span>所属企业</span><span>{{ display.enterprise }}</span></div>
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

.salary {
  margin-top: 10px;
  font-size: 16px;
  font-weight: 600;
  color: #ef4444;
}

.money-text {
  color: #ef4444;
  font-weight: 600;
}

.steps {
  padding: 4px 0;
}

.step-item {
  display: flex;
  gap: 12px;
  min-height: 44px;
}

.step-line {
  position: relative;
  width: 16px;
  flex-shrink: 0;
}

.step-line:not(.last)::after {
  content: '';
  position: absolute;
  left: 7px;
  top: 16px;
  bottom: -4px;
  width: 2px;
  background: #eee;
}

.step-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  border: 2px solid #ddd;
  background: #fff;
  display: block;
  margin-top: 2px;
}

.step-dot.done {
  border-color: var(--app-primary);
  background: var(--app-primary);
}

.step-dot.active {
  border-color: var(--app-primary);
  box-shadow: 0 0 0 3px var(--app-primary-light);
}

.step-label {
  font-size: 14px;
  color: #999;
  padding-bottom: 16px;
}

.step-label.active {
  color: var(--app-primary);
  font-weight: 600;
}

.status-text {
  margin: 0;
  font-size: 14px;
  color: #666;
  line-height: 1.6;
}

.info-box {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #fafafa;
  font-size: 13px;
  color: #666;
  line-height: 1.6;
}

.info-box.ok {
  background: var(--app-primary-light);
  color: var(--app-primary);
}

.info-box.warn {
  background: #fff1f0;
  color: #cf1322;
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

.mini-tag.blue {
  background: var(--app-primary-light);
  color: var(--app-primary);
}
</style>
