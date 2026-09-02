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
import { resolveTaskSettlementUnitPrice } from '@/constants/task'
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
import type { WorkflowActionConfig, WorkflowFieldConfig } from '@/types'

const route = useRoute()
const router = useRouter()
const store = useAppStore()
const { enterpriseId } = useEnterpriseMiniAuth()
const { runEnterpriseAction } = useEnterpriseInstanceAction()

const includeOpLogs = ref(true)
const actionLoading = ref(false)
const actionSheetOpen = ref(false)
const pendingAction = ref<WorkflowActionConfig | null>(null)
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
  if (!task.value) return '—'
  const price = resolveTaskSettlementUnitPrice(task.value)
  return `¥${price}/单`
})

const lifecycleRecords = computed(() =>
  instance.value
    ? buildTaskInstanceLifecycleRecords(
        instance.value,
        task.value,
        workflow.value,
        includeOpLogs.value,
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

const pendingMeta = computed(() =>
  pendingAction.value ? getEnterpriseActionUiMeta(pendingAction.value) : null,
)

function initEnterpriseForm(fields: WorkflowFieldConfig[]) {
  for (const key of Object.keys(enterpriseForm)) {
    delete enterpriseForm[key]
  }
  if (!instance.value) return
  for (const field of fields) {
    const existing = instance.value.fieldValues?.[field.id]
    if (existing !== undefined) enterpriseForm[field.id] = existing
    else if (field.fieldType === 'switch') enterpriseForm[field.id] = false
    else enterpriseForm[field.id] = ''
  }
}

watch(
  enterpriseNodeFields,
  (fields) => {
    if (!actionSheetOpen.value) initEnterpriseForm(fields)
  },
  { immediate: true, deep: true },
)

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

function openActionSheet(config: WorkflowActionConfig) {
  if (!enterpriseNodeFields.value.length) {
    runEnterpriseAction(instanceId.value, config)
    return
  }
  pendingAction.value = config
  initEnterpriseForm(enterpriseNodeFields.value)
  actionSheetOpen.value = true
}

function closeActionSheet() {
  actionSheetOpen.value = false
  pendingAction.value = null
}

async function confirmAction() {
  if (!pendingAction.value || !instance.value) return
  actionLoading.value = true
  try {
    const payload: Record<string, string | number | boolean> = {}
    for (const field of enterpriseNodeFields.value) {
      payload[field.id] = enterpriseForm[field.id]
    }
    await runEnterpriseAction(instance.value.id, pendingAction.value, payload)
    closeActionSheet()
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
  <div v-if="instance && task && workflow" class="show-page" :class="{ 'has-actions': pendingEnterprise }">
    <EntMiniNavBar
      title="子任务详情"
      :back-to="`/enterprise-miniapp/tasks?tab=detail&taskId=${task.id}`"
    />

    <div class="show-body">
      <section class="info-card">
        <div class="hero">
          <div>
            <h1>{{ task.name }}</h1>
            <p class="sub">{{ instance.workerName }} · {{ instance.currentNodeName }}</p>
          </div>
          <span class="status" :class="workflowStatus">
            {{ timeoutHours ? '超时异常' : statusMeta.label }}
          </span>
        </div>
      </section>

      <section class="info-card">
        <h3 class="card-title">任务基本信息</h3>
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
          <span class="value">¥{{ instance.amount }}</span>
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
          已超时 {{ timeoutHours }} 小时，应完成时间 {{ formatTime(instance.timeoutAt) }}
        </div>
      </section>

      <section class="info-card">
        <h3 class="card-title">工作流进度</h3>
        <WorkflowVerticalProgress
          :workflow="workflow"
          :current-node-id="instance.currentNodeId"
          :current-node-name="instance.currentNodeName"
        />
      </section>

      <section v-if="submittedFieldSnapshots.length" class="info-card">
        <h3 class="card-title">灵工已提交</h3>
        <div
          v-for="item in submittedFieldSnapshots"
          :key="item.field.id"
          class="info-row"
        >
          <span class="label">{{ item.field.name }}</span>
          <span class="value">{{ formatWorkflowFieldValue(item.field, item.value) }}</span>
        </div>
      </section>

      <section class="info-card">
        <div class="section-head">
          <h3 class="card-title">生命周期流转记录</h3>
          <label class="switch-label">
            <input v-model="includeOpLogs" type="checkbox">
            含操作日志
          </label>
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
    </div>

    <footer v-if="pendingEnterprise && enterpriseActions.length" class="show-footer">
      <button
        v-for="item in enterpriseActions"
        :key="item.config.action"
        type="button"
        class="act"
        :class="item.meta.buttonType"
        @click="openActionSheet(item.config)"
      >
        {{ item.meta.label }}
      </button>
    </footer>

    <div v-if="actionSheetOpen && pendingAction && pendingMeta" class="sheet-mask" @click.self="closeActionSheet">
      <div class="sheet">
        <div class="sheet-head">
          <div>
            <strong>{{ pendingMeta.label }}</strong>
            <p>企业操作 · {{ instance.currentNodeName }}</p>
          </div>
          <button type="button" class="close" @click="closeActionSheet">×</button>
        </div>
        <div class="sheet-body">
          <p class="sheet-tip">请填写以下节点配置字段后提交</p>
          <WorkflowFieldForm
            v-model="enterpriseForm"
            :fields="enterpriseNodeFields"
            label-width="88px"
          />
        </div>
        <div class="sheet-foot">
          <button type="button" class="ghost" @click="closeActionSheet">取消</button>
          <button
            type="button"
            class="primary"
            :class="pendingMeta.buttonType"
            :disabled="actionLoading"
            @click="confirmAction"
          >
            {{ actionLoading ? '处理中…' : pendingMeta.label }}
          </button>
        </div>
      </div>
    </div>
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

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.section-head .card-title {
  margin: 0;
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

.sheet-mask {
  position: fixed;
  inset: 0;
  z-index: 40;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}

.sheet {
  width: 100%;
  max-width: 430px;
  max-height: 80vh;
  overflow: auto;
  background: #fff;
  border-radius: 16px 16px 0 0;
  padding: 16px 16px calc(16px + env(safe-area-inset-bottom, 0px));
}

.sheet-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
  margin-bottom: 8px;
}

.sheet-head strong {
  font-size: 16px;
  color: #111827;
}

.sheet-head p {
  margin: 4px 0 0;
  font-size: 12px;
  color: #9ca3af;
}

.sheet-head .close {
  border: none;
  background: none;
  font-size: 22px;
  line-height: 1;
  color: #9ca3af;
  cursor: pointer;
}

.sheet-tip {
  margin: 0 0 10px;
  font-size: 13px;
  color: #6b7280;
}

.sheet-foot {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

.sheet-foot .ghost,
.sheet-foot .primary {
  height: 42px;
  border-radius: 10px;
  font-size: 14px;
  cursor: pointer;
}

.sheet-foot .ghost {
  flex: 0 0 88px;
  border: 1px solid #e5e7eb;
  background: #fff;
  color: #6b7280;
}

.sheet-foot .primary {
  flex: 1;
  border: none;
  color: #fff;
  font-weight: 600;
  background: #228BFF;
}

.sheet-foot .primary.success {
  background: #10b981;
}

.sheet-foot .primary.danger {
  background: #ef4444;
}

.sheet-foot .primary.warning {
  background: #f59e0b;
}
</style>
