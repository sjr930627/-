<script setup lang="ts">
import MiniNavBack from '@/components/miniapp/MiniNavBack.vue'
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Clock, OfficeBuilding, Document, Share, Location } from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import { isTaskInstanceCancelled } from '@/composables/useMiniWorkerTasks'
import {
  formatTaskUnitPrice,
  getPendingPunchEntryForInstance,
  getTaskPricingUnit,
  getWorkflowFieldsForNode,
  isPendingEnterpriseAction,
  isPendingWorkerAction,
  pickWorkerSubmitAction,
  resolvePricingForTask,
  taskPricingUnitMap,
} from '@/services/miniTask'
import { getTaskDetailExtra, getTaskHallExtra } from '@/mock/miniTaskHallSeed'
import { workflowActionMap } from '@/constants/task'
import MiniTaskWorkflowSteps from '@/components/miniapp/MiniTaskWorkflowSteps.vue'
import { buildTaskWorkflowSteps } from '@/services/miniTaskWorkflow'

const route = useRoute()
const router = useRouter()
const store = useAppStore()
const { employeeId } = useMiniAppWorker()

const form = reactive<Record<string, string | number | boolean>>({})
const fieldDialogVisible = ref(false)

const instance = computed(() =>
  store.taskInstances.find(
    (i) => i.id === route.params.instanceId && i.workerId === employeeId.value,
  ),
)

const task = computed(() =>
  instance.value ? store.tasks.find((t) => t.id === instance.value!.taskId) : undefined,
)

const pricing = computed(() =>
  task.value ? resolvePricingForTask(task.value, store.taskTypes) : undefined,
)

const workflow = computed(() =>
  task.value ? store.taskWorkflows.find((w) => w.id === task.value!.workflowId) : undefined,
)

const extra = computed(() => (task.value ? getTaskHallExtra(task.value.id) : { tags: [] }))
const detail = computed(() => (task.value ? getTaskDetailExtra(task.value.id) : null))

const workflowName = computed(() => {
  if (!task.value) return ''
  return workflow.value?.name?.trim() || task.value.taskTypeName || ''
})

const locationText = computed(() => {
  if (!task.value) return ''
  const region = task.value.region?.trim() || ''
  const detailAddr = task.value.addressDetail?.trim() || ''
  if (region && detailAddr) return `${region} · ${detailAddr}`
  return region || detailAddr || detail.value?.address || detail.value?.location || ''
})

const nodeFields = computed(() =>
  instance.value && workflow.value
    ? getWorkflowFieldsForNode(workflow.value, instance.value.currentNodeId)
    : [],
)

const needsWorkerAction = computed(() =>
  instance.value && workflow.value
    ? isPendingWorkerAction(instance.value, workflow.value)
    : false,
)

const waitingEnterprise = computed(() =>
  instance.value && workflow.value
    ? isPendingEnterpriseAction(instance.value, workflow.value)
    : false,
)

const isCancelled = computed(() =>
  instance.value && workflow.value
    ? isTaskInstanceCancelled(instance.value, workflow.value)
    : false,
)

const submitAction = computed(() =>
  workflow.value && instance.value && needsWorkerAction.value
    ? pickWorkerSubmitAction(workflow.value, instance.value.currentNodeId)
    : undefined,
)

const submitLabel = computed(() =>
  submitAction.value ? workflowActionMap[submitAction.value] : '提交',
)

const punchEntryPending = computed(() =>
  instance.value && workflow.value
    ? getPendingPunchEntryForInstance(instance.value, workflow.value, store.punches)
    : undefined,
)

const unitLabel = computed(() => taskPricingUnitMap[getTaskPricingUnit(pricing.value)])

const priceLabel = computed(
  () =>
    extra.value.priceRange ??
    formatTaskUnitPrice(pricing.value).replace('/单', `/${unitLabel.value}`),
)

const workflowSteps = computed(() =>
  detail.value
    ? buildTaskWorkflowSteps(
        detail.value.processSteps,
        workflow.value,
        instance.value,
      )
    : [],
)

const metadataFields = computed(() => task.value?.metadataFields ?? [])

function initForm() {
  if (!instance.value) return
  for (const key of Object.keys(form)) delete form[key]
  for (const field of nodeFields.value) {
    const existing = instance.value.fieldValues?.[field.id]
    if (existing !== undefined) form[field.id] = existing
    else if (field.fieldType === 'switch') form[field.id] = false
    else form[field.id] = ''
  }
}

watch(nodeFields, initForm, { immediate: true })

function setAttachmentDemo(fieldId: string) {
  form[fieldId] = `附件_${Date.now()}.jpg`
}

function doSubmit() {
  if (!instance.value || !submitAction.value) return
  try {
    const payload: Record<string, string | number | boolean> = {}
    for (const field of nodeFields.value) {
      payload[field.id] = form[field.id]
    }
    store.submitTaskInstanceWorkflow(instance.value.id, payload, submitAction.value)
    fieldDialogVisible.value = false
    ElMessage.success('提交成功')
    router.push('/miniapp/tasks')
  } catch (e) {
    ElMessage.warning(e instanceof Error ? e.message : '提交失败')
  }
}

function onSubmitClick() {
  if (!submitAction.value) return
  if (nodeFields.value.length > 0) {
    initForm()
    fieldDialogVisible.value = true
    return
  }
  doSubmit()
}

function closeFieldDialog() {
  fieldDialogVisible.value = false
}

function goPunchPage() {
  if (!instance.value) return
  router.push({ path: '/miniapp/punch', query: { fromTask: instance.value.id } })
}
</script>

<template>
  <div class="detail-page">
    <div class="mini-nav-bar">
      <MiniNavBack fallback="/miniapp/tasks" />
      <div class="mini-nav-title">任务详情</div>
    </div>

    <div v-if="instance && task && detail" class="detail-body">
      <div class="hero-card">
        <div class="hero-icon">★</div>
        <div class="hero-main">
          <h1 class="hero-title">{{ task.name }}</h1>
          <div class="hero-tags">
            <span v-if="extra.highlightTag" class="tag hot">{{ extra.highlightTag }}</span>
            <span
              v-for="tag in extra.tags.filter((t) => t !== extra.highlightTag)"
              :key="tag"
              class="tag"
            >
              {{ tag }}
            </span>
            <span class="tag blue">已领 {{ instance.claimQuantity }} {{ unitLabel }}</span>
          </div>
        </div>
        <div class="reward-box">
          <div>
            <div class="reward-label">任务金额</div>
            <div class="reward-value">{{ priceLabel }}</div>
          </div>
          <div class="reward-side">
            <div>本单预估 ¥{{ instance.amount }}</div>
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
            <div class="ent-name">{{ task.enterpriseName }}</div>
            <div v-if="workflowName" class="ent-meta">关联工作流：{{ workflowName }}</div>
          </div>
        </div>
      </div>

      <div class="section-card">
        <div class="section-head">
          <el-icon :size="16"><Document /></el-icon>
          任务内容
        </div>
        <p class="desc">{{ task.description || '暂无任务内容说明' }}</p>
        <ul v-if="detail.bullets.length" class="bullets">
          <li v-for="(item, idx) in detail.bullets" :key="idx">{{ item }}</li>
        </ul>
      </div>

      <div class="section-card">
        <div class="section-head">
          <el-icon :size="16"><Location /></el-icon>
          任务地点
        </div>
        <p class="desc location-text">{{ locationText || '未填写任务地点' }}</p>
      </div>

      <div class="section-card">
        <div class="section-head">
          <el-icon :size="16"><Document /></el-icon>
          任务元数据
        </div>
        <div v-if="metadataFields.length" class="meta-list">
          <div v-for="meta in metadataFields" :key="meta.key" class="meta-row">
            <span class="meta-label">{{ meta.label }}</span>
            <span class="meta-value">{{ meta.value || '—' }}</span>
          </div>
        </div>
        <p v-else class="desc muted">暂无任务元数据</p>
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

      <div class="section-card status-card">
        <div class="section-head">当前状态</div>

        <div v-if="isCancelled" class="cancel-banner">
          <div class="cancel-icon">✕</div>
          <div>
            <div class="cancel-title">任务已取消</div>
            <div class="cancel-desc">该任务已中途结束，不会继续结算奖励</div>
          </div>
        </div>

        <div v-else-if="punchEntryPending" class="punch-banner">
          <div class="punch-icon">📍</div>
          <div class="punch-main">
            <div class="punch-title">待打卡</div>
            <div class="punch-desc">{{ punchEntryPending.incompletePrompt || '请先完成打卡' }}</div>
            <div class="punch-hint">系统已生成待打卡记录，请前往打卡页完成（非任务内操作）</div>
            <button type="button" class="punch-go-btn" @click="goPunchPage">去打卡</button>
          </div>
        </div>

        <div v-else-if="waitingEnterprise" class="wait-banner">
          <div class="wait-icon">⏳</div>
          <div>
            <div class="wait-title">您无需操作</div>
            <div class="wait-desc">等待企业方确认「{{ instance.currentNodeName }}」</div>
          </div>
        </div>

        <template v-else-if="needsWorkerAction">
          <p class="status-tip">
            当前节点「{{ instance.currentNodeName }}」
            <template v-if="nodeFields.length">，提交时需填写自定义字段</template>
          </p>
          <button
            v-if="submitAction"
            type="button"
            class="mini-btn-primary submit-btn"
            @click="onSubmitClick"
          >
            {{ submitLabel }}
          </button>
        </template>

        <div v-else class="done-banner">
          当前处于「{{ instance.currentNodeName }}」，暂无需要您操作的步骤
        </div>
      </div>
    </div>

    <div v-else class="mini-empty">任务不存在</div>

    <Teleport to="body">
      <div
        v-if="fieldDialogVisible"
        class="field-overlay"
        @click.self="closeFieldDialog"
      >
        <div class="field-dialog">
          <div class="field-dialog-head">
            <div>
              <div class="field-dialog-title">填写信息</div>
              <div class="field-dialog-sub">{{ instance?.currentNodeName }}</div>
            </div>
            <button type="button" class="field-dialog-close" @click="closeFieldDialog">×</button>
          </div>
          <div class="field-dialog-body">
            <div v-for="field in nodeFields" :key="field.id" class="wf-field">
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
          <div class="field-dialog-foot">
            <button type="button" class="field-btn-cancel" @click="closeFieldDialog">取消</button>
            <button type="button" class="field-btn-ok" @click="doSubmit">确认提交</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<style scoped>
.detail-page {
  min-height: 100%;
  background: var(--mini-bg);
  padding-bottom: 24px;
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
  background: #E6FFFA;
  color: #4FD1C5;
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
  background: #E6FFFA;
  color: #4FD1C5;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
}

.ent-name {
  font-size: 15px;
  font-weight: 600;
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

.desc.muted,
.location-text {
  margin-bottom: 0;
}

.desc.muted {
  color: #999;
}

.meta-list {
  display: flex;
  flex-direction: column;
}

.meta-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid #f5f5f5;
  font-size: 13px;
}

.meta-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.meta-row:first-child {
  padding-top: 0;
}

.meta-label {
  color: #999;
  flex-shrink: 0;
}

.meta-value {
  color: #333;
  text-align: right;
  word-break: break-all;
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
  background: #E6FFFA;
  color: #4FD1C5;
  font-size: 12px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.status-card {
  margin-bottom: 0;
}

.wait-banner {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 14px;
  background: #f5f3ff;
  border-radius: 10px;
}

.punch-banner {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 14px;
  background: #fff7ed;
  border-radius: 10px;
  border: 1px solid #fed7aa;
}

.punch-icon {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #ffedd5;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
}

.punch-title {
  font-size: 15px;
  font-weight: 700;
  color: #9a3412;
  margin-bottom: 4px;
}

.punch-desc {
  font-size: 14px;
  color: #c2410c;
  margin-bottom: 4px;
}

.punch-hint {
  font-size: 12px;
  color: #9a3412;
  opacity: 0.85;
  margin-bottom: 12px;
}

.punch-go-btn {
  border: none;
  background: var(--mini-primary);
  color: #fff;
  border-radius: 8px;
  padding: 8px 20px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.cancel-banner {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 14px;
  background: #f9fafb;
  border-radius: 10px;
  border: 1px solid #e5e7eb;
}

.cancel-icon {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: #e5e7eb;
  color: #6b7280;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  flex-shrink: 0;
}

.cancel-title {
  font-size: 15px;
  font-weight: 600;
  color: #6b7280;
}

.cancel-desc {
  margin-top: 4px;
  font-size: 13px;
  color: #9ca3af;
}

.wait-icon {
  font-size: 24px;
  line-height: 1;
}

.wait-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--mini-primary);
}

.wait-desc {
  margin-top: 4px;
  font-size: 13px;
  color: #6b7280;
}

.status-tip {
  margin: 0 0 12px;
  font-size: 13px;
  color: var(--mini-text-secondary);
}

.done-banner {
  padding: 14px;
  background: #f0fdf4;
  border-radius: 10px;
  font-size: 13px;
  color: #16a34a;
  text-align: center;
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
  font-weight: 500;
  color: var(--mini-text);
  margin-bottom: 6px;
}

.req {
  color: #ef4444;
}

.wf-input,
.wf-textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid var(--mini-border);
  border-radius: 10px;
  font-size: 14px;
}

.wf-switch {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.wf-upload {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.upload-btn {
  align-self: flex-start;
  padding: 10px 14px;
  border: 1px dashed var(--mini-border);
  border-radius: 10px;
  background: #f9fafb;
  color: var(--mini-text-secondary);
  cursor: pointer;
}

.upload-name {
  font-size: 12px;
  color: var(--mini-text-muted);
  word-break: break-all;
}

.submit-btn {
  width: 100%;
  margin-top: 4px;
}

.field-overlay {
  position: fixed;
  inset: 0;
  z-index: 2000;
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.field-dialog {
  width: 100%;
  max-width: 430px;
  max-height: 78vh;
  background: #fff;
  border-radius: 16px 16px 0 0;
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.field-dialog-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 16px 16px 12px;
  border-bottom: 1px solid #f3f4f6;
}

.field-dialog-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--mini-text);
}

.field-dialog-sub {
  margin-top: 4px;
  font-size: 12px;
  color: var(--mini-text-muted);
}

.field-dialog-close {
  width: 32px;
  height: 32px;
  border: none;
  background: #f3f4f6;
  border-radius: 50%;
  font-size: 20px;
  line-height: 1;
  color: #6b7280;
  cursor: pointer;
}

.field-dialog-body {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
}

.field-dialog-foot {
  display: flex;
  gap: 10px;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid #f3f4f6;
}

.field-btn-cancel,
.field-btn-ok {
  flex: 1;
  height: 44px;
  border-radius: 999px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}

.field-btn-cancel {
  border: 1px solid var(--mini-border);
  background: #fff;
  color: var(--mini-text-secondary);
}

.field-btn-ok {
  border: none;
  background: var(--mini-primary);
  color: #fff;
}
</style>
