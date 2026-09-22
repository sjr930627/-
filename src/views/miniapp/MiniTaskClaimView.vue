<script setup lang="ts">
import MiniNavBack from '@/components/miniapp/MiniNavBack.vue'
import { computed, reactive, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import { useMiniAppActionGate } from '@/composables/useMiniAppActionGate'
import {
  calcTaskClaimAmount,
  formatTaskUnitPrice,
  getTaskPricingUnit,
  getWorkerClaimedQuantity,
  resolvePricingForTask,
  taskPricingUnitMap,
} from '@/services/miniTask'
import {
  getTaskClaimableCount,
  getWorkflowClaimNode,
  getWorkflowFieldsForNode,
} from '@/services/task'
import { getTaskHallExtra } from '@/mock/miniTaskHallSeed'

const route = useRoute()
const router = useRouter()
const store = useAppStore()
const { employeeId } = useMiniAppWorker()
const { ensureActionAllowed } = useMiniAppActionGate()

const CLAIM_QUANTITY = 1

const task = computed(() => store.tasks.find((t) => t.id === route.params.taskId))
const pricing = computed(() =>
  task.value ? resolvePricingForTask(task.value, store.taskTypes) : undefined,
)
const extra = computed(() => (task.value ? getTaskHallExtra(task.value.id) : { tags: [] }))
const workflow = computed(() =>
  task.value ? store.taskWorkflows.find((w) => w.id === task.value!.workflowId) : undefined,
)
const claimNode = computed(() => (workflow.value ? getWorkflowClaimNode(workflow.value) : undefined))
const claimFields = computed(() =>
  workflow.value && claimNode.value
    ? getWorkflowFieldsForNode(workflow.value, claimNode.value.id)
    : [],
)

const form = reactive<Record<string, string | number | boolean>>({})

function initClaimForm() {
  for (const key of Object.keys(form)) delete form[key]
  for (const field of claimFields.value) {
    if (field.fieldType === 'switch') form[field.id] = false
    else if (field.fieldType === 'amount') form[field.id] = ''
    else form[field.id] = ''
  }
}

watch(claimFields, initClaimForm, { immediate: true })

const pricingUnit = computed(() => getTaskPricingUnit(pricing.value))
const unitLabel = computed(() => taskPricingUnitMap[pricingUnit.value])

const myClaimed = computed(() =>
  task.value ? getWorkerClaimedQuantity(store.taskInstances, task.value.id, employeeId.value) : 0,
)

const maxClaimable = computed(() => {
  if (!task.value) return 0
  const byPerson = task.value.maxPerPerson
    ? Math.max(0, task.value.maxPerPerson - myClaimed.value)
    : 99
  const wf = workflow.value
  const claimable = getTaskClaimableCount(task.value, store.taskInstances, wf)
  const byQuota = claimable == null ? 99 : claimable
  return Math.min(byPerson, byQuota, 99)
})

const previewAmount = computed(() =>
  pricing.value ? calcTaskClaimAmount(pricing.value, CLAIM_QUANTITY) : 0,
)

function setAttachmentDemo(fieldId: string) {
  form[fieldId] = `附件_${Date.now()}.jpg`
}

async function submitClaim() {
  if (!task.value) return
  if (maxClaimable.value < 1) {
    ElMessage.warning('当前已无剩余可领名额')
    return
  }
  const allowed = await ensureActionAllowed({
    requireDepartment: true,
    enterpriseId: task.value.enterpriseId,
    from: 'claim',
  })
  if (!allowed) return
  const payload: Record<string, string | number | boolean> = {}
  for (const field of claimFields.value) {
    payload[field.id] = form[field.id]
  }
  try {
    const instance = store.acceptTaskFromHall(
      task.value.id,
      employeeId.value,
      CLAIM_QUANTITY,
      payload,
    )
    ElMessage.success('领取成功')
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

    <div v-if="task && pricing" class="claim-body">
      <div class="claim-card">
        <h1 class="claim-title">{{ task.name }}</h1>
        <div class="claim-sub">{{ task.enterpriseName }} · {{ task.taskTypeName }}</div>
        <div class="claim-tags">
          <span v-for="tag in extra.tags" :key="tag" class="mini-tag orange">{{ tag }}</span>
        </div>
        <div class="claim-price-row">
          <span class="claim-price">{{ formatTaskUnitPrice(pricing) }}</span>
          <span class="claim-remain">{{ extra.remain != null ? `剩余 ${extra.remain} 名额` : '不限名额' }}</span>
        </div>
        <p class="claim-desc">{{ task.description }}</p>
      </div>

      <div class="claim-card">
        <div class="field-label">领取数量（{{ unitLabel }}）</div>
        <div class="qty-fixed">
          <span class="qty-value">{{ CLAIM_QUANTITY }}</span>
          <span class="qty-unit">{{ unitLabel }}</span>
        </div>
        <div class="qty-tip">每次固定领取 1 {{ unitLabel }}，已领 {{ myClaimed }} {{ unitLabel }}</div>
        <div class="preview-row">
          <span>预估收入</span>
          <span class="preview-amount">¥{{ previewAmount.toFixed(2) }}</span>
        </div>
      </div>

      <div v-if="claimFields.length" class="claim-card">
        <div class="field-label">领取信息</div>
        <p class="fields-tip">请填写「{{ claimNode?.name || '领取任务' }}」节点要求的信息</p>
        <div v-for="field in claimFields" :key="field.id" class="wf-field">
          <label class="wf-label">
            {{ field.name }}
            <span v-if="field.required" class="req">*</span>
          </label>

          <input
            v-if="field.fieldType === 'text'"
            v-model="form[field.id] as string"
            class="wf-input"
            type="text"
            :placeholder="`请输入${field.name}`"
          />

          <select
            v-else-if="field.fieldType === 'select'"
            v-model="form[field.id] as string"
            class="wf-input"
          >
            <option value="">请选择</option>
            <option v-for="opt in field.options" :key="opt" :value="opt">{{ opt }}</option>
          </select>

          <input
            v-else-if="field.fieldType === 'date'"
            v-model="form[field.id] as string"
            class="wf-input"
            type="date"
          />

          <input
            v-else-if="field.fieldType === 'amount'"
            v-model.number="form[field.id] as number"
            class="wf-input"
            type="number"
            min="0"
            step="0.01"
            :placeholder="`请输入${field.name}`"
          />

          <textarea
            v-else-if="field.fieldType === 'textarea'"
            v-model="form[field.id] as string"
            class="wf-textarea"
            rows="3"
            :placeholder="`请输入${field.name}`"
          />

          <label v-else-if="field.fieldType === 'switch'" class="wf-switch">
            <input v-model="form[field.id] as boolean" type="checkbox" />
            {{ field.name }}
          </label>

          <div v-else-if="field.fieldType === 'attachment'" class="wf-upload">
            <button type="button" class="upload-btn" @click="setAttachmentDemo(field.id)">
              {{ form[field.id] ? '重新上传（演示）' : '上传附件（演示）' }}
            </button>
            <div v-if="form[field.id]" class="upload-name">{{ form[field.id] }}</div>
          </div>
        </div>
      </div>

      <button
        type="button"
        class="mini-btn-primary"
        :disabled="maxClaimable < 1"
        @click="submitClaim"
      >
        确认领取
      </button>
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
  padding-bottom: 24px;
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

.qty-fixed {
  display: flex;
  align-items: center;
  gap: 8px;
}

.qty-value {
  min-width: 48px;
  height: 36px;
  padding: 0 14px;
  border: 1px solid var(--mini-border);
  border-radius: 10px;
  background: #f9fafb;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 16px;
  font-weight: 700;
  color: var(--mini-text);
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

.fields-tip {
  margin: -4px 0 12px;
  font-size: 12px;
  color: var(--mini-text-muted);
}

.wf-field {
  margin-bottom: 14px;
}

.wf-field:last-child {
  margin-bottom: 0;
}

.wf-label {
  display: block;
  font-size: 13px;
  font-weight: 600;
  color: var(--mini-text);
  margin-bottom: 6px;
}

.req {
  color: #ef4444;
  margin-left: 2px;
}

.wf-input,
.wf-textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid var(--mini-border);
  border-radius: 10px;
  padding: 10px 12px;
  font-size: 14px;
  color: var(--mini-text);
  background: #fff;
}

.wf-textarea {
  resize: vertical;
  line-height: 1.5;
}

.wf-switch {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: var(--mini-text-secondary);
}

.wf-upload {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.upload-btn {
  align-self: flex-start;
  height: 36px;
  padding: 0 14px;
  border: 1px dashed var(--mini-border);
  border-radius: 10px;
  background: #f9fafb;
  font-size: 13px;
  color: var(--mini-text-secondary);
  cursor: pointer;
}

.upload-name {
  font-size: 12px;
  color: var(--mini-text-muted);
  word-break: break-all;
}

.mini-btn-primary:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
