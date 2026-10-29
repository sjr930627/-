<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import EntMiniNavBar from '@/components/enterprise-miniapp/EntMiniNavBar.vue'
import WorkflowFieldForm from '@/components/task/WorkflowFieldForm.vue'
import WorkflowVerticalProgress from '@/components/task/WorkflowVerticalProgress.vue'
import { useAppStore } from '@/stores/app'
import { useEnterpriseMiniAuth } from '@/composables/useEnterpriseMiniAuth'
import { useEnterpriseInstanceAction } from '@/composables/useEnterpriseInstanceAction'
import { hasTaskCustomerPrice, resolveTaskCustomerAmount, resolveTaskCustomerUnitPrice } from '@/constants/task'
import {
  buildTaskInstanceLifecycleRecords,
  calcInstanceTimeoutHours,
} from '@/services/taskInstanceLifecycle'
import {
  formatWorkflowFieldValue,
  getEnterpriseActionUiMeta,
  getInstanceEnterpriseActions,
  getSubmittedWorkflowFieldSnapshots,
  getWorkflowFieldsForNode,
  isInstanceAtEnterpriseNode,
  instanceWorkflowStatusMap,
  resolveInstanceWorkflowStatus,
} from '@/services/task'
import type { WorkflowActionConfig } from '@/types'

const route = useRoute()
const router = useRouter()
const store = useAppStore()
const { enterpriseId } = useEnterpriseMiniAuth()
const { runEnterpriseAction } = useEnterpriseInstanceAction()

const includeOpLogs = true
const actionLoading = ref(false)
const enterpriseForm = reactive<Record<string, string | number | boolean>>({})

const instanceId = computed(() => String(route.params.instanceId ?? ''))

const instance = computed(() => store.taskInstances.find((i) => i.id === instanceId.value))

const task = computed(() =>
  instance.value ? store.tasks.find((t) => t.id === instance.value!.taskId) : undefined,
)

const workflow = computed(() =>
  task.value ? store.taskWorkflows.find((w) => w.id === task.value!.workflowId) : undefined,
)

const workflowStatus = computed(() =>
  instance.value && workflow.value
    ? resolveInstanceWorkflowStatus(instance.value, workflow.value)
    : 'running',
)

const statusMeta = computed(() => instanceWorkflowStatusMap[workflowStatus.value])

const timeoutHours = computed(() =>
  instance.value ? calcInstanceTimeoutHours(instance.value) : null,
)

const unitPriceLabel = computed(() => {
  if (!task.value || !hasTaskCustomerPrice(task.value)) return '—'
  return `¥${resolveTaskCustomerUnitPrice(task.value)}/单`
})

const customerAmount = computed(() => {
  if (!instance.value) return 0
  if (!task.value) return instance.value.amount
  return resolveTaskCustomerAmount(task.value, instance.value.claimQuantity) ?? instance.value.amount
})

const lifecycleRecords = computed(() =>
  instance.value
    ? buildTaskInstanceLifecycleRecords(
        instance.value,
        task.value,
        workflow.value,
        includeOpLogs,
      )
    : [],
)

const pendingEnterprise = computed(() =>
  instance.value && workflow.value
    ? isInstanceAtEnterpriseNode(instance.value, workflow.value)
    : false,
)

const enterpriseActions = computed(() => {
  if (!instance.value || !workflow.value || !pendingEnterprise.value) return []
  return getInstanceEnterpriseActions(instance.value, workflow.value).map((a) => ({
    config: a,
    meta: getEnterpriseActionUiMeta(a),
  }))
})

const enterpriseNodeFields = computed(() =>
  instance.value && workflow.value
    ? getWorkflowFieldsForNode(workflow.value, instance.value.currentNodeId)
    : [],
)

const submittedFieldSnapshots = computed(() =>
  instance.value && workflow.value
    ? getSubmittedWorkflowFieldSnapshots(workflow.value, instance.value)
    : [],
)

const showEnterpriseCard = computed(
  () =>
    pendingEnterprise.value &&
    (enterpriseNodeFields.value.length > 0 || submittedFieldSnapshots.value.length > 0),
)

function initEnterpriseForm() {
  if (!instance.value) return
  for (const key of Object.keys(enterpriseForm)) {
    delete enterpriseForm[key]
  }
  for (const field of enterpriseNodeFields.value) {
    const existing = instance.value.fieldValues?.[field.id]
    if (existing !== undefined) enterpriseForm[field.id] = existing
    else if (field.fieldType === 'switch') enterpriseForm[field.id] = false
    else enterpriseForm[field.id] = ''
  }
}

watch([enterpriseNodeFields, instance], initEnterpriseForm, { immediate: true, deep: true })

function assertAccessible() {
  const i = instance.value
  if (!i) {
    ElMessage.warning('任务明细不存在')
    router.replace('/enterprise-miniapp/tasks')
    return false
  }
  if (i.enterpriseId !== enterpriseId.value) {
    ElMessage.warning('无权访问该明细')
    router.replace('/enterprise-miniapp/tasks')
    return false
  }
  return true
}

onMounted(assertAccessible)
watch(instanceId, assertAccessible)

function formatTime(iso?: string) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('zh-CN')
}

async function handleEnterpriseAction(config: WorkflowActionConfig) {
  if (!instance.value) return
  actionLoading.value = true
  try {
    const payload: Record<string, string | number | boolean> = {}
    for (const field of enterpriseNodeFields.value) {
      payload[field.id] = enterpriseForm[field.id]
    }
    await runEnterpriseAction(instance.value.id, config, payload)
  } finally {
    actionLoading.value = false
  }
}

function goParentTask() {
  if (!task.value) return
  router.push(`/enterprise-miniapp/tasks/${task.value.id}`)
}
</script>

<template>
  <div v-if="instance && task && workflow" class="show-page" :class="{ 'has-actions': pendingEnterprise && enterpriseActions.length && !showEnterpriseCard }">
    <EntMiniNavBar
      title="子任务详情"
      :back-to="`/enterprise-miniapp/tasks?tab=detail&taskId=${task.id}`"
    />

    <div class="show-body">
      <section class="info-card">
        <div class="section-head">
          <div class="section-icon section-icon--blue">基</div>
          <div class="section-head-text">
            <h3>任务基本信息</h3>
            <p>灵工认领的子任务执行详情</p>
          </div>
          <span class="status" :class="timeoutHours ? 'danger' : workflowStatus">
            {{ timeoutHours ? '超时异常' : statusMeta.label }}
          </span>
        </div>
        <div class="info-row">
          <span class="label">任务 ID</span>
          <span class="value mono">{{ instance.id }}</span>
        </div>
        <div class="info-row">
          <span class="label">任务状态</span>
          <span class="value">{{ statusMeta.label }}</span>
        </div>
        <div class="info-row">
          <span class="label">企业名称</span>
          <span class="value">{{ instance.enterpriseName }}</span>
        </div>
        <div class="info-row">
          <span class="label">服务商</span>
          <span class="value">{{ task.serviceProviderName || '—' }}</span>
        </div>
        <div class="info-row">
          <span class="label">任务流程</span>
          <span class="value">{{ workflow.name }}</span>
        </div>
        <div class="info-row">
          <span class="label">执行灵工</span>
          <span class="value">{{ instance.workerName }}</span>
        </div>
        <div class="info-row">
          <span class="label">当前节点</span>
          <span class="value">{{ instance.currentNodeName }}</span>
        </div>
        <div class="info-row">
          <span class="label">认领数量</span>
          <span class="value">{{ instance.claimQuantity }} 单</span>
        </div>
        <div class="info-row">
          <span class="label">任务单价</span>
          <span class="value">{{ unitPriceLabel }}</span>
        </div>
        <div class="info-row">
          <span class="label">预估金额</span>
          <span class="value">¥{{ customerAmount }}</span>
        </div>
        <div class="info-row">
          <span class="label">所属任务</span>
          <span class="value link" @click="goParentTask">{{ task.name }}</span>
        </div>
        <div v-if="task.region" class="info-row">
          <span class="label">任务地点</span>
          <span class="value">{{ task.region }}</span>
        </div>
        <div class="info-row">
          <span class="label">创建时间</span>
          <span class="value">{{ formatTime(instance.createdAt) }}</span>
        </div>
        <div class="info-row">
          <span class="label">最后更新</span>
          <span class="value">{{ formatTime(instance.updatedAt) }}</span>
        </div>
        <div v-if="timeoutHours && instance.timeoutAt" class="timeout-alert">
          超时信息：已超时 {{ timeoutHours }} 小时，应完成时间 {{ formatTime(instance.timeoutAt) }}
        </div>
      </section>

      <section class="info-card">
        <div class="section-head">
          <div class="section-icon section-icon--green">流</div>
          <div class="section-head-text">
            <h3>生命周期流转记录</h3>
            <p>子任务从认领到当前节点的全流程轨迹（每条认领一条记录）</p>
          </div>
        </div>
        <p class="hint">{{ lifecycleRecords.length }} 条记录</p>
        <div v-if="lifecycleRecords.length" class="timeline">
          <div
            v-for="record in lifecycleRecords"
            :key="record.id"
            class="timeline-item"
            :class="record.type"
          >
            <div class="timeline-head">
              <strong>{{ record.title }}</strong>
              <span v-if="record.tag" class="tag">{{ record.tag }}</span>
            </div>
            <p v-if="record.operator || record.time" class="timeline-meta">
              <span v-if="record.operator">操作人：{{ record.operator }}</span>
              <span v-if="record.time">{{ formatTime(record.time) }}</span>
            </p>
            <p v-if="record.description" class="timeline-desc">{{ record.description }}</p>
            <div v-if="record.fieldEntries?.length" class="timeline-fields">
              <div class="timeline-fields-title">节点字段</div>
              <div
                v-for="entry in record.fieldEntries"
                :key="entry.fieldId"
                class="timeline-field-row"
              >
                <span class="field-name">{{ entry.name }}</span>
                <span class="field-value">{{ entry.value }}</span>
              </div>
            </div>
          </div>
        </div>
        <p v-else class="empty-text">暂无流转记录</p>
      </section>

      <section class="info-card">
        <div class="section-head">
          <div class="section-head-text">
            <h3>工作流进度</h3>
            <p>当前子任务在工作流中的位置</p>
          </div>
        </div>
        <WorkflowVerticalProgress
          :workflow="workflow"
          :current-node-id="instance.currentNodeId"
          :current-node-name="instance.currentNodeName"
        />
      </section>

      <section v-if="showEnterpriseCard" class="info-card">
        <div class="section-head">
          <div class="section-head-text">
            <h3>企业处理 · {{ instance.currentNodeName }}</h3>
            <p>填写采集信息后，使用下方按钮完成操作</p>
          </div>
        </div>
        <div v-if="submittedFieldSnapshots.length" class="submitted-fields">
          <div class="submitted-title">灵工已提交</div>
          <div v-for="item in submittedFieldSnapshots" :key="item.field.id" class="submitted-row">
            <span class="submitted-label">{{ item.field.name }}</span>
            <span class="submitted-value">{{ formatWorkflowFieldValue(item.field, item.value) }}</span>
          </div>
        </div>
        <WorkflowFieldForm
          v-if="enterpriseNodeFields.length"
          v-model="enterpriseForm"
          :fields="enterpriseNodeFields"
          label-width="88px"
        />
        <div v-if="enterpriseActions.length" class="card-actions">
          <button
            v-for="item in enterpriseActions"
            :key="item.config.action"
            type="button"
            class="act"
            :class="item.meta.buttonType"
            :disabled="actionLoading"
            @click="handleEnterpriseAction(item.config)"
          >
            {{ item.meta.label }}
          </button>
        </div>
      </section>
    </div>

    <footer v-if="pendingEnterprise && enterpriseActions.length && !showEnterpriseCard" class="show-footer">
      <button
        v-for="item in enterpriseActions"
        :key="item.config.action"
        type="button"
        class="act"
        :class="item.meta.buttonType"
        :disabled="actionLoading"
        @click="handleEnterpriseAction(item.config)"
      >
        {{ item.meta.label }}
      </button>
    </footer>
  </div>
</template>

<style scoped>
.show-page {
  min-height: 100%;
  padding-bottom: calc(24px + env(safe-area-inset-bottom, 0px));
}

.show-page.has-actions {
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
  justify-content: space-between;
  gap: 10px;
  align-items: flex-start;
}

.hero h1 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #111827;
}

.sub {
  margin: 4px 0 0;
  font-size: 12px;
  color: #6b7280;
}

.status {
  flex-shrink: 0;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  background: #228BFF;
  color: #fff;
}

.status.completed {
  background: #ecfdf5;
  color: #059669;
}

.status.cancelled {
  background: #f3f4f6;
  color: #6b7280;
}

.card-title {
  margin: 0 0 10px;
  font-size: 14px;
  font-weight: 700;
  color: #374151;
}

.status.danger {
  background: #fef2f2;
  color: #dc2626;
}

.section-head {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  margin-bottom: 12px;
}

.section-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}

.section-icon--blue {
  background: #228BFF;
}

.section-icon--green {
  background: #10b981;
}

.section-head-text {
  flex: 1;
  min-width: 0;
}

.section-head-text h3 {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: #111827;
}

.section-head-text p {
  margin: 4px 0 0;
  font-size: 12px;
  color: #9ca3af;
  line-height: 1.4;
}

.submitted-fields {
  margin-bottom: 12px;
  padding: 10px 12px;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 8px;
}

.submitted-title {
  font-size: 13px;
  font-weight: 600;
  color: #d97706;
  margin-bottom: 8px;
}

.submitted-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
  padding: 6px 0;
}

.submitted-label {
  color: #9ca3af;
  flex-shrink: 0;
}

.submitted-value {
  color: #374151;
  text-align: right;
  word-break: break-word;
}

.card-actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 12px;
}

.card-actions .act {
  height: 36px;
  padding: 0 14px;
  border: none;
  border-radius: 8px;
  background: #228BFF;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.card-actions .act.success {
  background: #10b981;
}

.card-actions .act.danger {
  background: #ef4444;
}

.card-actions .act.warning {
  background: #f59e0b;
}

.info-card :deep(.workflow-field-form .el-form-item) {
  display: block;
  margin-bottom: 12px;
}

.info-card :deep(.workflow-field-form .el-form-item__label) {
  width: auto !important;
  height: auto;
  justify-content: flex-start;
  margin-bottom: 4px;
  line-height: 1.4;
}

.info-card :deep(.workflow-field-form .el-form-item__content) {
  margin-left: 0 !important;
}

.switch-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #6b7280;
}

.hint {
  margin: 6px 0 8px;
  font-size: 12px;
  color: #9ca3af;
}

.info-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 0;
  font-size: 13px;
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

.info-row .value.mono {
  font-size: 12px;
}

.info-row .value.link {
  color: #228BFF;
  cursor: pointer;
}

.timeout-alert {
  margin-top: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  background: #fef2f2;
  color: #dc2626;
  font-size: 12px;
  line-height: 1.5;
}

.timeline-item {
  padding: 10px 0;
  border-bottom: 1px solid #f3f4f6;
}

.timeline-item:last-child {
  border-bottom: none;
}

.timeline-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: #111827;
}

.timeline-head .tag {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 4px;
  background: #228BFF;
  color: #fff;
}

.timeline-meta {
  margin: 4px 0 0;
  font-size: 12px;
  color: #9ca3af;
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.timeline-desc {
  margin: 4px 0 0;
  font-size: 12px;
  color: #6b7280;
  line-height: 1.5;
}

.timeline-fields {
  margin-top: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  background: #f8fafc;
  border: 1px solid #eef2f7;
}

.timeline-fields-title {
  font-size: 11px;
  font-weight: 600;
  color: #9ca3af;
  margin-bottom: 4px;
}

.timeline-field-row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  padding: 3px 0;
  font-size: 12px;
}

.timeline-field-row .field-name {
  color: #9ca3af;
  flex-shrink: 0;
}

.timeline-field-row .field-value {
  color: #374151;
  text-align: right;
  word-break: break-word;
}

.empty-text {
  margin: 0;
  font-size: 13px;
  color: #9ca3af;
}

.show-footer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
  max-width: 430px;
  margin: 0 auto;
  display: flex;
  gap: 8px;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid #e5e7eb;
  background: #fff;
  box-shadow: 0 -4px 20px rgba(15, 23, 42, 0.06);
}

.show-footer .act {
  flex: 1;
  height: 42px;
  border: none;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  color: #fff;
}

.show-footer .act.success {
  background: #10b981;
}

.show-footer .act.danger {
  background: #ef4444;
}

.show-footer .act.warning {
  background: #f59e0b;
}
</style>
