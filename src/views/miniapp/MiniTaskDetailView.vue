<script setup lang="ts">
import MiniNavBack from '@/components/miniapp/MiniNavBack.vue'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Clock, OfficeBuilding, Document, Share } from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'
import { formatTaskUnitPrice, getTaskPricingUnit, resolvePricingForTask, taskPricingUnitMap } from '@/services/miniTask'
import { getTaskDetailExtra, getTaskHallExtra } from '@/mock/miniTaskHallSeed'
import MiniTaskWorkflowSteps from '@/components/miniapp/MiniTaskWorkflowSteps.vue'
import { buildTaskWorkflowSteps } from '@/services/miniTaskWorkflow'
import { useMiniAppActionGate } from '@/composables/useMiniAppActionGate'

const route = useRoute()
const router = useRouter()
const store = useAppStore()
const { ensureActionAllowed } = useMiniAppActionGate()

const task = computed(() => store.tasks.find((t) => t.id === route.params.taskId))
const pricing = computed(() =>
  task.value ? resolvePricingForTask(task.value, store.taskTypes) : undefined,
)
const extra = computed(() => (task.value ? getTaskHallExtra(task.value.id) : { tags: [] }))
const detail = computed(() => (task.value ? getTaskDetailExtra(task.value.id) : null))

const unitLabel = computed(() => taskPricingUnitMap[getTaskPricingUnit(pricing.value)])

const priceLabel = computed(
  () => extra.value.priceRange ?? formatTaskUnitPrice(pricing.value).replace('/单', `/${unitLabel.value}`),
)

const remainText = computed(() => {
  const remain = extra.value.remain
  if (remain == null) return '不限名额'
  return `剩余${remain}名额`
})

const workflowSteps = computed(() =>
  detail.value ? buildTaskWorkflowSteps(detail.value.processSteps) : [],
)

async function goClaim() {
  if (!task.value) return
  const allowed = await ensureActionAllowed({
    requireDepartment: true,
    enterpriseId: task.value.enterpriseId,
    from: 'claim',
    redirectAfterFace: `/miniapp/task-hall/task/${task.value.id}/claim`,
  })
  if (!allowed) return
  router.push(`/miniapp/task-hall/task/${task.value.id}/claim`)
}
</script>

<template>
  <div class="detail-page">
    <div class="mini-nav-bar">
      <MiniNavBack fallback="/miniapp/task-hall" />
      <div class="mini-nav-title">任务详情</div>
    </div>

    <div v-if="task && detail" class="detail-body">
      <div class="hero-card">
        <div class="hero-icon">★</div>
        <div class="hero-main">
          <h1 class="hero-title">{{ task.name }}</h1>
          <div class="hero-tags">
            <span v-if="extra.highlightTag" class="tag hot">{{ extra.highlightTag }}</span>
            <span v-for="tag in extra.tags.filter((t) => t !== extra.highlightTag)" :key="tag" class="tag">
              {{ tag }}
            </span>
            <span class="tag blue">{{ remainText }}</span>
          </div>
        </div>
        <div class="reward-box">
          <div>
            <div class="reward-label">任务奖励</div>
            <div class="reward-value">{{ priceLabel }}</div>
          </div>
          <div class="reward-side">
            <div>预计按量结算</div>
            <div>{{ extra.participants ?? task.acceptedCount }} 人参与</div>
          </div>
        </div>
      </div>

      <div class="section-card">
        <div class="section-head">
          <el-icon :size="16"><OfficeBuilding /></el-icon>
          任务企业
        </div>
        <div class="ent-row">
          <div class="ent-logo">{{ task.enterpriseName.slice(0, 1) }}</div>
          <div>
            <div class="ent-name">
              {{ task.enterpriseName }}
              <span class="ent-badge">认证</span>
            </div>
            <div class="ent-meta">
              {{ detail.enterpriseMeta ?? `${task.region ?? '全国'} · ${task.taskTypeName}` }}
            </div>
          </div>
        </div>
      </div>

      <div class="section-card">
        <div class="section-head">
          <el-icon :size="16"><Document /></el-icon>
          任务内容
        </div>
        <p class="desc">{{ task.description }}</p>
        <ul class="bullets">
          <li v-for="(item, idx) in detail.bullets" :key="idx">{{ item }}</li>
        </ul>
      </div>

      <div class="section-card">
        <div class="section-head">
          <el-icon :size="16"><Clock /></el-icon>
          任务期限
        </div>
        <div class="time-row">
          <span>{{ task.startTime.slice(0, 10) }}</span>
          <span class="time-arrow">→</span>
          <span>{{ task.endTime.slice(0, 10) }}</span>
        </div>
      </div>

      <div class="section-card">
        <div class="section-head">
          <el-icon :size="16"><Share /></el-icon>
          任务流程
        </div>
        <MiniTaskWorkflowSteps :steps="workflowSteps" />
      </div>
    </div>

    <div v-if="task" class="detail-footer">
      <div class="footer-info">
        <div class="footer-price">{{ priceLabel }}</div>
        <div class="footer-remain">{{ remainText }}</div>
      </div>
      <button type="button" class="claim-btn" @click="goClaim">领取任务</button>
    </div>

    <div v-if="!task" class="mini-empty">任务不存在</div>
  </div>
</template>

<style scoped>
.detail-page {
  min-height: 100%;
  background: var(--mini-bg);
  padding-bottom: 80px;
}

.detail-body {
  padding: 12px;
}

.hero-card {
  background: #fff;
  border-radius: var(--mini-radius-lg);
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: var(--mini-shadow);
}

.hero-icon {
  width: 44px;
  height: 44px;
  border-radius: 50%;
  background: #ffedd5;
  color: #f97316;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  margin-bottom: 12px;
}

.hero-title {
  margin: 0 0 8px;
  font-size: 18px;
  font-weight: 700;
}

.hero-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.tag {
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  background: #f3f4f6;
  color: #6b7280;
}

.tag.hot {
  background: #fff7ed;
  color: #ea580c;
}

.tag.blue {
  background: #eff6ff;
  color: #3b82f6;
}

.reward-box {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 14px;
  padding: 12px;
  background: #fff7ed;
  border-radius: 10px;
}

.reward-label {
  font-size: 12px;
  color: #9ca3af;
}

.reward-value {
  font-size: 22px;
  font-weight: 800;
  color: #ef4444;
}

.reward-side {
  text-align: right;
  font-size: 12px;
  color: #9ca3af;
  line-height: 1.6;
}

.section-card {
  background: #fff;
  border-radius: var(--mini-radius-lg);
  padding: 14px;
  margin-bottom: 12px;
  box-shadow: var(--mini-shadow);
}

.section-head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 12px;
  color: var(--mini-text);
}

.ent-row {
  display: flex;
  gap: 10px;
  align-items: center;
}

.ent-logo {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: #eff6ff;
  color: #3b82f6;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}

.ent-name {
  font-size: 15px;
  font-weight: 600;
}

.ent-badge {
  margin-left: 6px;
  padding: 1px 6px;
  border-radius: 4px;
  background: #f0fdf4;
  color: #22c55e;
  font-size: 10px;
}

.ent-meta {
  margin-top: 4px;
  font-size: 12px;
  color: var(--mini-text-muted);
}

.desc {
  margin: 0 0 10px;
  font-size: 14px;
  color: var(--mini-text-secondary);
  line-height: 1.6;
}

.bullets {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  color: var(--mini-text-secondary);
  line-height: 1.7;
}

.bullets li {
  margin-bottom: 4px;
}

.time-row {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  color: var(--mini-text);
}

.time-arrow {
  color: var(--mini-text-muted);
}

.steps {
  margin: 0;
  padding: 0;
  list-style: none;
}

.steps li {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding: 8px 0;
  font-size: 13px;
  color: var(--mini-text-secondary);
  border-bottom: 1px solid #f3f4f6;
}

.steps li:last-child {
  border-bottom: none;
}

.step-num {
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #eff6ff;
  color: #3b82f6;
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.detail-footer {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: calc(56px + env(safe-area-inset-bottom, 0px));
  width: 100%;
  max-width: 430px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  background: #fff;
  border-top: 1px solid var(--mini-border);
  box-sizing: border-box;
}

.footer-price {
  font-size: 18px;
  font-weight: 800;
  color: #ef4444;
}

.footer-remain {
  font-size: 12px;
  color: var(--mini-text-muted);
}

.claim-btn {
  flex: 1;
  padding: 12px;
  border: none;
  border-radius: 999px;
  background: var(--mini-primary);
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}
</style>
