<script setup lang="ts">
import { computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import EntMiniNavBar from '@/components/enterprise-miniapp/EntMiniNavBar.vue'
import { useAppStore } from '@/stores/app'
import { useEnterpriseMiniAuth } from '@/composables/useEnterpriseMiniAuth'
import {
  dispatchModeMap,
  formatTaskQuantity,
  formatTaskTypePrice,
  resolveTaskPricing,
  resolveTaskSettlementUnitPrice,
  taskPublishStatusMap,
} from '@/constants/task'
import { calcEnterpriseTaskProgress } from '@/services/task'

const route = useRoute()
const router = useRouter()
const store = useAppStore()
const { enterpriseId } = useEnterpriseMiniAuth()

const taskId = computed(() => String(route.params.taskId ?? ''))

const task = computed(() => store.tasks.find((t) => t.id === taskId.value))

const workflow = computed(() =>
  task.value ? store.taskWorkflows.find((w) => w.id === task.value!.workflowId) : undefined,
)

const pricing = computed(() =>
  task.value ? resolveTaskPricing(task.value, store.taskTypes) : undefined,
)

const progressInfo = computed(() =>
  task.value ? calcEnterpriseTaskProgress(task.value) : { progress: 0 },
)

const periodLabel = computed(() => {
  if (!task.value) return '—'
  if (task.value.longTerm) return '长期'
  return `${task.value.startTime.slice(0, 10)} ~ ${task.value.endTime.slice(0, 10)}`
})

const priceLabel = computed(() =>
  pricing.value ? formatTaskTypePrice(pricing.value) : '—',
)

const settlementLabel = computed(() => {
  if (!task.value) return '—'
  const price = resolveTaskSettlementUnitPrice(task.value)
  return `¥${price}/单`
})

const assigneeNames = computed(() => {
  if (!task.value?.assigneeIds?.length) return '—'
  return task.value.assigneeIds
    .map((id) => store.employees.find((e) => e.id === id)?.name ?? id)
    .join('、')
})

function assertAccessible() {
  const t = task.value
  if (!t) {
    ElMessage.warning('任务不存在')
    router.replace('/enterprise-miniapp/tasks')
    return false
  }
  if (t.enterpriseId !== enterpriseId.value) {
    ElMessage.warning('无权访问该任务')
    router.replace('/enterprise-miniapp/tasks')
    return false
  }
  return true
}

onMounted(assertAccessible)
watch(taskId, assertAccessible)

function formatTime(iso?: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-CN')
}

function viewInstances() {
  router.push({
    path: '/enterprise-miniapp/tasks',
    query: { tab: 'detail', taskId: taskId.value },
  })
}
</script>

<template>
  <div v-if="task" class="show-page">
    <EntMiniNavBar title="任务详情" back-to="/enterprise-miniapp/tasks" />

    <div class="show-body">
      <section class="info-card">
        <div class="hero">
          <h1>{{ task.name }}</h1>
          <span class="status">{{ taskPublishStatusMap[task.status] }}</span>
        </div>
        <p class="sub">{{ task.enterpriseName }}</p>
        <div class="progress">
          <div class="bar"><i :style="{ width: `${progressInfo.progress}%` }" /></div>
          <span>完成 {{ task.completedCount }} / 接单 {{ task.acceptedCount }}</span>
        </div>
      </section>

      <section class="info-card">
        <h3 class="card-title">基本信息</h3>
        <div class="info-row">
          <span class="label">部门/公司</span>
          <span class="value">{{ task.departmentName || '—' }}</span>
        </div>
        <div class="info-row">
          <span class="label">任务流程</span>
          <span class="value">{{ workflow?.name ?? task.taskTypeName }}</span>
        </div>
        <div class="info-row block">
          <span class="label">任务内容</span>
          <span class="value">{{ task.description || '—' }}</span>
        </div>
        <div class="info-row">
          <span class="label">任务地点</span>
          <span class="value">{{ task.region || '—' }}</span>
        </div>
      </section>

      <section class="info-card">
        <h3 class="card-title">定价配置</h3>
        <div class="info-row">
          <span class="label">单价模式</span>
          <span class="value">{{ pricing?.pricingMode === 'tiered' ? '阶梯单价' : '固定单价' }}</span>
        </div>
        <div class="info-row">
          <span class="label">客户单价</span>
          <span class="value">{{ priceLabel }}</span>
        </div>
        <div class="info-row">
          <span class="label">结算单价</span>
          <span class="value">{{ settlementLabel }}</span>
        </div>
        <div class="info-row block">
          <span class="label">任务激励</span>
          <span class="value">{{ task.incentive || '—' }}</span>
        </div>
        <div class="info-row">
          <span class="label">培训要求</span>
          <span class="value">{{ task.trainingCourseId || '—' }}</span>
        </div>
      </section>

      <section class="info-card">
        <h3 class="card-title">数量、期限与派单</h3>
        <div class="info-row">
          <span class="label">任务数量</span>
          <span class="value">
            {{ formatTaskQuantity(task.unlimitedQuantity, task.plannedTotal) }}
          </span>
        </div>
        <div class="info-row">
          <span class="label">任务期限</span>
          <span class="value">{{ periodLabel }}</span>
        </div>
        <div class="info-row">
          <span class="label">派单方式</span>
          <span class="value">{{ dispatchModeMap[task.dispatchMode] }}</span>
        </div>
        <div v-if="task.dispatchMode === 'assign'" class="info-row block">
          <span class="label">指派人员</span>
          <span class="value">{{ assigneeNames }}</span>
        </div>
        <div class="info-row">
          <span class="label">限领规则</span>
          <span class="value">每人限领 {{ task.maxPerPerson ?? '—' }} 单</span>
        </div>
      </section>

      <section v-if="task.metadataFields?.length" class="info-card">
        <h3 class="card-title">自定义字段</h3>
        <div
          v-for="meta in task.metadataFields"
          :key="meta.key"
          class="info-row"
        >
          <span class="label">{{ meta.label || meta.key }}</span>
          <span class="value">{{ meta.value || '—' }}</span>
        </div>
      </section>

      <section class="info-card">
        <h3 class="card-title">进度与审核</h3>
        <div class="info-row">
          <span class="label">接单数</span>
          <span class="value">{{ task.acceptedCount }}</span>
        </div>
        <div class="info-row">
          <span class="label">完成数</span>
          <span class="value">{{ task.completedCount }}</span>
        </div>
        <div class="info-row">
          <span class="label">验收数</span>
          <span class="value">{{ task.approvedCount }}</span>
        </div>
        <div class="info-row">
          <span class="label">创建时间</span>
          <span class="value">{{ formatTime(task.createdAt) }}</span>
        </div>
        <div v-if="task.reviewedAt" class="info-row">
          <span class="label">审核时间</span>
          <span class="value">{{ formatTime(task.reviewedAt) }}</span>
        </div>
        <div v-if="task.reviewNote" class="info-row block">
          <span class="label">审核意见</span>
          <span class="value">{{ task.reviewNote }}</span>
        </div>
      </section>
    </div>

    <footer class="show-footer">
      <button type="button" class="primary" @click="viewInstances">查看任务明细</button>
    </footer>
  </div>
</template>

<style scoped>
.show-page {
  min-height: 100%;
  padding-bottom: calc(72px + env(safe-area-inset-bottom, 0px));
}

.show-body {
  padding: 12px 16px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.info-card {
  background: #fff;
  border-radius: 14px;
  padding: 14px;
  box-shadow: var(--mini-shadow);
}

.hero {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
}

.hero h1 {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: #111827;
  line-height: 1.4;
}

.status {
  flex-shrink: 0;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  background: #228BFF;
  color: #fff;
}

.sub {
  margin: 6px 0 0;
  font-size: 12px;
  color: #6b7280;
}

.progress {
  margin-top: 12px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.progress .bar {
  flex: 1;
  height: 6px;
  border-radius: 999px;
  background: #f3f4f6;
  overflow: hidden;
}

.progress .bar i {
  display: block;
  height: 100%;
  background: #228BFF;
  border-radius: 999px;
}

.progress span {
  font-size: 11px;
  color: #9ca3af;
  white-space: nowrap;
}

.card-title {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 700;
  color: #374151;
}

.info-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 0;
  font-size: 13px;
}

.info-row.block {
  flex-direction: column;
  gap: 4px;
}

.info-row .label {
  color: #9ca3af;
  flex-shrink: 0;
}

.info-row .value {
  color: #374151;
  text-align: right;
  word-break: break-word;
}

.info-row.block .value {
  text-align: left;
  line-height: 1.5;
}

.show-footer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
  max-width: 430px;
  margin: 0 auto;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid #e5e7eb;
  background: #fff;
  box-shadow: 0 -4px 20px rgba(15, 23, 42, 0.06);
}

.show-footer .primary {
  width: 100%;
  height: 44px;
  border: none;
  border-radius: 10px;
  background: #228BFF;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}
</style>
