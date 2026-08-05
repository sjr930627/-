<script setup lang="ts">
import MiniNavBack from '@/components/miniapp/MiniNavBack.vue'
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import {
  calcTaskClaimAmount,
  formatTaskUnitPrice,
  getTaskPricingUnit,
  getWorkerClaimedQuantity,
  taskPricingUnitMap,
} from '@/services/miniTask'
import { getTaskHallExtra } from '@/mock/miniTaskHallSeed'

const route = useRoute()
const router = useRouter()
const store = useAppStore()
const { employeeId } = useMiniAppWorker()

const quantity = ref(1)

const task = computed(() => store.tasks.find((t) => t.id === route.params.taskId))
const taskType = computed(() =>
  task.value ? store.taskTypes.find((t) => t.id === task.value!.taskTypeId) : undefined,
)
const extra = computed(() => (task.value ? getTaskHallExtra(task.value.id) : { tags: [] }))

const pricingUnit = computed(() => getTaskPricingUnit(taskType.value))
const unitLabel = computed(() => taskPricingUnitMap[pricingUnit.value])

const myClaimed = computed(() =>
  task.value ? getWorkerClaimedQuantity(store.taskInstances, task.value.id, employeeId.value) : 0,
)

const maxClaimable = computed(() => {
  if (!task.value) return 1
  const byPerson = task.value.maxPerPerson
    ? Math.max(0, task.value.maxPerPerson - myClaimed.value)
    : 99
  const byQuota =
    task.value.plannedTotal != null
      ? Math.max(0, task.value.plannedTotal - task.value.acceptedCount)
      : 99
  return Math.min(byPerson, byQuota, 99)
})

const previewAmount = computed(() =>
  taskType.value ? calcTaskClaimAmount(taskType.value, quantity.value) : 0,
)

function submitClaim() {
  if (!task.value) return
  if (quantity.value < 1 || quantity.value > maxClaimable.value) {
    ElMessage.warning(`请输入 1-${maxClaimable.value} 的领取数量`)
    return
  }
  try {
    const instance = store.acceptTaskFromHall(task.value.id, employeeId.value, quantity.value)
    ElMessage.success('领取成功，请填写任务信息')
    router.replace(`/miniapp/tasks/${instance.id}`)
  } catch (e) {
    ElMessage.warning(e instanceof Error ? e.message : '领取失败')
  }
}
</script>

<template>
  <div class="claim-page">
    <div class="mini-nav-bar">
      <MiniNavBack fallback="/miniapp/task-hall" />
      <div class="mini-nav-title">领取任务</div>
    </div>

    <div v-if="task && taskType" class="claim-body">
      <div class="claim-card">
        <h1 class="claim-title">{{ task.name }}</h1>
        <div class="claim-sub">{{ task.enterpriseName }} · {{ task.taskTypeName }}</div>
        <div class="claim-tags">
          <span v-for="tag in extra.tags" :key="tag" class="mini-tag orange">{{ tag }}</span>
        </div>
        <div class="claim-price-row">
          <span class="claim-price">{{ formatTaskUnitPrice(taskType) }}</span>
          <span class="claim-remain">{{ extra.remain != null ? `剩余 ${extra.remain} 名额` : '不限名额' }}</span>
        </div>
        <p class="claim-desc">{{ task.description }}</p>
      </div>

      <div class="claim-card">
        <div class="field-label">领取数量（{{ unitLabel }}）</div>
        <div class="qty-row">
          <button
            type="button"
            class="qty-btn"
            :disabled="quantity <= 1"
            @click="quantity = Math.max(1, quantity - 1)"
          >
            −
          </button>
          <input v-model.number="quantity" type="number" class="qty-input" min="1" :max="maxClaimable" />
          <button
            type="button"
            class="qty-btn"
            :disabled="quantity >= maxClaimable"
            @click="quantity = Math.min(maxClaimable, quantity + 1)"
          >
            +
          </button>
          <span class="qty-unit">{{ unitLabel }}</span>
        </div>
        <div class="qty-tip">
          已领 {{ myClaimed }} {{ unitLabel }}，本次最多可领 {{ maxClaimable }} {{ unitLabel }}
        </div>
        <div class="preview-row">
          <span>预估收入</span>
          <span class="preview-amount">¥{{ previewAmount.toFixed(2) }}</span>
        </div>
      </div>

      <button type="button" class="mini-btn-primary" @click="submitClaim">确认领取</button>
    </div>

    <div v-else class="mini-empty">任务不存在或已下架</div>
  </div>
</template>

<style scoped>
.claim-page {
  min-height: 100%;
  background: var(--mini-bg);
}

.claim-body {
  padding: 12px;
}

.claim-card {
  background: #fff;
  border-radius: var(--mini-radius-lg);
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: var(--mini-shadow);
}

.claim-title {
  margin: 0 0 6px;
  font-size: 18px;
  font-weight: 700;
  color: var(--mini-text);
}

.claim-sub {
  font-size: 13px;
  color: var(--mini-text-muted);
}

.claim-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.claim-price-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-top: 12px;
}

.claim-price {
  font-size: 22px;
  font-weight: 800;
  color: #ef4444;
}

.claim-remain {
  font-size: 12px;
  color: var(--mini-text-muted);
}

.claim-desc {
  margin: 12px 0 0;
  font-size: 13px;
  color: var(--mini-text-secondary);
  line-height: 1.6;
}

.field-label {
  font-size: 14px;
  font-weight: 600;
  color: var(--mini-text);
  margin-bottom: 10px;
}

.qty-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.qty-btn {
  width: 36px;
  height: 36px;
  border: 1px solid var(--mini-border);
  border-radius: 10px;
  background: #fff;
  font-size: 18px;
  cursor: pointer;
}

.qty-btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.qty-input {
  width: 72px;
  height: 36px;
  border: 1px solid var(--mini-border);
  border-radius: 10px;
  text-align: center;
  font-size: 16px;
  font-weight: 600;
}

.qty-unit {
  font-size: 14px;
  color: var(--mini-text-secondary);
}

.qty-tip {
  margin-top: 8px;
  font-size: 12px;
  color: var(--mini-text-muted);
}

.preview-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid #f3f4f6;
  font-size: 14px;
}

.preview-amount {
  font-size: 20px;
  font-weight: 800;
  color: #ef4444;
}
</style>
