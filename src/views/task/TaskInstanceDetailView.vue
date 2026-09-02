<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import WorkflowVerticalProgress from '@/components/task/WorkflowVerticalProgress.vue'
import WorkflowFieldForm from '@/components/task/WorkflowFieldForm.vue'
import { useEnterpriseInstanceAction } from '@/composables/useEnterpriseInstanceAction'
import {
  buildTaskInstanceLifecycleRecords,
  calcInstanceTimeoutHours,
} from '@/services/taskInstanceLifecycle'
import {
  formatWorkflowFieldValue,
  getInstanceEnterpriseActions,
  getEnterpriseActionUiMeta,
  getSubmittedWorkflowFieldSnapshots,
  getWorkflowFieldsForNode,
  isInstanceAtEnterpriseNode,
  instanceWorkflowStatusMap,
  resolveInstanceWorkflowStatus,
} from '@/services/task'
import { resolveTaskSettlementUnitPrice } from '@/constants/task'
import type { WorkflowActionConfig } from '@/types'

const route = useRoute()
const router = useRouter()
const store = useAppStore()
const { runEnterpriseAction } = useEnterpriseInstanceAction()

const includeOpLogs = ref(true)
const cancelReason = ref('')
const enterpriseForm = reactive<Record<string, string | number | boolean>>({})
const actionLoading = ref(false)

const isEnterprise = computed(() => route.meta.portal === 'enterprise')

const instance = computed(() =>
  store.taskInstances.find((i) => i.id === route.params.id as string),
)

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

const timeoutHours = computed(() =>
  instance.value ? calcInstanceTimeoutHours(instance.value) : null,
)

const unitPriceLabel = computed(() => {
  if (!task.value) return '-'
  const price = resolveTaskSettlementUnitPrice(task.value)
  return price != null ? `¥${price}/单` : '-'
})

const canIntervene = computed(
  () => !isEnterprise.value && workflowStatus.value === 'running',
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

function initEnterpriseForm() {
  if (!instance.value) return
  for (const field of enterpriseNodeFields.value) {
    const existing = instance.value.fieldValues?.[field.id]
    if (existing !== undefined) enterpriseForm[field.id] = existing
    else if (field.fieldType === 'switch') enterpriseForm[field.id] = false
    else enterpriseForm[field.id] = ''
  }
}

watch([enterpriseNodeFields, instance], initEnterpriseForm, { immediate: true, deep: true })

async function handleEnterpriseAction(actionConfig: WorkflowActionConfig) {
  if (!instance.value) return
  actionLoading.value = true
  try {
    const payload: Record<string, string | number | boolean> = {}
    for (const field of enterpriseNodeFields.value) {
      payload[field.id] = enterpriseForm[field.id]
    }
    await runEnterpriseAction(instance.value.id, actionConfig, payload)
  } finally {
    actionLoading.value = false
  }
}

function formatTime(iso?: string) {
  if (!iso) return '-'
  return new Date(iso).toLocaleString('zh-CN')
}

function goBack() {
  router.push(isEnterprise.value ? '/enterprise/task/progress' : '/task-manage')
}

async function executeCancel() {
  if (!instance.value) return
  if (!cancelReason.value.trim()) {
    ElMessage.warning('请填写取消原因')
    return
  }
  try {
    await ElMessageBox.confirm('确定强制取消该认领任务？', '提示', { type: 'warning' })
    store.forceCancelTaskInstance(instance.value.id, cancelReason.value.trim())
    ElMessage.success('任务已取消')
    cancelReason.value = ''
  } catch {
    // cancelled
  }
}
</script>

<template>
  <div v-if="instance && task && workflow" class="instance-detail-page">
    <div class="page-breadcrumb-row">
      <el-breadcrumb separator=">">
        <el-breadcrumb-item>任务管理</el-breadcrumb-item>
        <el-breadcrumb-item @click="goBack">
          {{ isEnterprise ? '任务进度查看' : '任务管理' }}
        </el-breadcrumb-item>
        <el-breadcrumb-item>认领详情</el-breadcrumb-item>
      </el-breadcrumb>
      <el-button @click="goBack">返回列表</el-button>
    </div>

    <div class="detail-layout">
      <div class="detail-main">
        <section class="page-card section-card">
          <div class="section-head">
            <div class="section-icon section-icon--blue">基</div>
            <div class="section-head-text">
              <h3>任务基本信息</h3>
              <p>灵工认领的子任务执行详情</p>
            </div>
            <el-tag v-if="timeoutHours" type="danger" size="small" class="status-badge">
              超时异常
            </el-tag>
            <el-tag v-else size="small" :type="statusMeta.type" class="status-badge">
              {{ statusMeta.label }}
            </el-tag>
          </div>

          <el-descriptions :column="2" border>
            <el-descriptions-item label="任务 ID">
              <span class="id-link">{{ instance.id }}</span>
            </el-descriptions-item>
            <el-descriptions-item label="任务状态">
              <span class="status-dot status-dot--primary" />
              {{ statusMeta.label }}
            </el-descriptions-item>
            <el-descriptions-item label="企业名称">{{ instance.enterpriseName }}</el-descriptions-item>
            <el-descriptions-item label="任务流程">
              <el-tag size="small" type="info">{{ workflow.name }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item label="执行灵工">
              <span class="worker-chip">{{ instance.workerName.charAt(0) }}</span>
              {{ instance.workerName }}
            </el-descriptions-item>
            <el-descriptions-item label="当前节点">{{ instance.currentNodeName }}</el-descriptions-item>
            <el-descriptions-item label="认领数量">{{ instance.claimQuantity }} 单</el-descriptions-item>
            <el-descriptions-item label="任务单价">{{ unitPriceLabel }}</el-descriptions-item>
            <el-descriptions-item label="预估金额">¥{{ instance.amount }}</el-descriptions-item>
            <el-descriptions-item label="所属任务" :span="2">{{ task.name }}</el-descriptions-item>
            <el-descriptions-item v-if="task.region" label="任务地点" :span="2">
              {{ task.region }}
            </el-descriptions-item>
            <el-descriptions-item label="创建时间">{{ formatTime(instance.createdAt) }}</el-descriptions-item>
            <el-descriptions-item label="最后更新">{{ formatTime(instance.updatedAt) }}</el-descriptions-item>
          </el-descriptions>

          <div v-if="timeoutHours && instance.timeoutAt" class="timeout-alert">
            <span class="timeout-icon">!</span>
            超时信息：已超时 {{ timeoutHours }} 小时，应完成时间 {{ formatTime(instance.timeoutAt) }}
          </div>
        </section>

        <section class="page-card section-card">
          <div class="section-head">
            <div class="section-icon section-icon--green">流</div>
            <div class="section-head-text">
              <h3>生命周期流转记录</h3>
              <p>子任务从认领到当前节点的全流程轨迹（每条认领一条记录）</p>
            </div>
            <div class="timeline-toolbar">
              <span class="record-count">{{ lifecycleRecords.length }} 条记录</span>
              <el-switch v-model="includeOpLogs" active-text="含操作日志" />
            </div>
          </div>

          <el-timeline class="lifecycle-timeline">
            <el-timeline-item
              v-for="record in lifecycleRecords"
              :key="record.id"
              :type="
                record.type === 'current'
                  ? 'primary'
                  : record.type === 'terminal'
                    ? 'info'
                    : record.type === 'manual'
                      ? 'warning'
                      : record.type === 'operation'
                        ? 'info'
                        : 'success'
              "
              :hollow="record.type !== 'current'"
              placement="top"
            >
              <div
                class="timeline-card"
                :class="{
                  current: record.type === 'current',
                  manual: record.type === 'manual',
                  operation: record.type === 'operation',
                  terminal: record.type === 'terminal',
                }"
              >
                <div class="timeline-head">
                  <strong>{{ record.title }}</strong>
                  <el-tag
                    v-if="record.tag"
                    size="small"
                    :type="
                      record.type === 'manual'
                        ? 'warning'
                        : record.type === 'current'
                          ? 'primary'
                          : 'info'
                    "
                  >
                    {{ record.tag }}
                  </el-tag>
                </div>
                <div v-if="record.operator || record.time" class="timeline-meta">
                  <span v-if="record.operator">操作人：{{ record.operator }}</span>
                  <span v-if="record.time">{{ formatTime(record.time) }}</span>
                </div>
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
            </el-timeline-item>
          </el-timeline>
        </section>
      </div>

      <div class="detail-side">
        <section class="page-card side-card">
          <div class="side-card-head">
            <h3>工作流进度</h3>
            <p>当前子任务在工作流中的位置</p>
          </div>
          <WorkflowVerticalProgress
            :workflow="workflow"
            :current-node-id="instance.currentNodeId"
            :current-node-name="instance.currentNodeName"
          />
        </section>

        <section v-if="isEnterprise && pendingEnterprise" class="page-card side-card enterprise-action-card">
          <div class="enterprise-dialog-shell">
            <div class="enterprise-dialog-backdrop" />
            <div class="enterprise-dialog">
              <div class="enterprise-dialog-header">
                <div>
                  <h3>企业操作 · {{ instance.currentNodeName }}</h3>
                  <p>企业端操作弹窗 · 请填写采集字段后执行</p>
                </div>
              </div>

              <div class="enterprise-dialog-body">
                <p v-if="enterpriseNodeFields.length" class="enterprise-dialog-tip">
                  请填写以下信息后，点击底部按钮完成当前节点操作
                </p>

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
                <el-empty
                  v-else
                  description="当前节点未配置采集字段"
                  :image-size="56"
                  class="field-empty"
                />
              </div>

              <div class="enterprise-dialog-footer">
                <el-button
                  v-for="item in enterpriseActions"
                  :key="item.config.action"
                  :type="item.meta.buttonType"
                  class="enterprise-action-btn"
                  :loading="actionLoading"
                  @click="handleEnterpriseAction(item.config)"
                >
                  {{ item.meta.label }}
                </el-button>
              </div>
            </div>
          </div>
        </section>

        <section v-if="canIntervene" class="page-card side-card intervention-card">
          <div class="side-card-head">
            <h3 class="intervention-title">人工干预</h3>
            <p>强制取消异常认领任务</p>
          </div>

          <div class="action-block">
            <div class="action-label danger">强制取消任务</div>
            <p class="action-desc">取消该灵工的认领记录，需填写原因</p>
            <el-input
              v-model="cancelReason"
              type="textarea"
              :rows="2"
              placeholder="取消原因（必填）"
            />
            <el-button type="danger" class="action-btn" @click="executeCancel">执行</el-button>
          </div>

          <el-alert
            type="warning"
            :closable="false"
            show-icon
            class="action-hint"
            title="强制取消将记录日志并通知相关方。"
          />
        </section>
      </div>
    </div>
  </div>

  <el-empty v-else description="认领记录不存在" class="page-card">
    <el-button type="primary" @click="goBack">返回列表</el-button>
  </el-empty>
</template>

<style scoped>
.instance-detail-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.page-breadcrumb-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.detail-layout {
  display: grid;
  grid-template-columns: minmax(0, 2fr) minmax(280px, 1fr);
  gap: 16px;
  align-items: start;
}

.detail-main,
.detail-side {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.section-card,
.side-card {
  padding: 20px;
}

.section-head {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 16px;
}

.section-head-text {
  flex: 1;
}

.section-head-text h3,
.side-card-head h3 {
  margin: 0 0 4px;
  font-size: 16px;
}

.section-head-text p,
.side-card-head p {
  margin: 0;
  font-size: 13px;
  color: #909399;
}

.section-icon {
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 14px;
  font-weight: 700;
  color: #fff;
  flex-shrink: 0;
}

.section-icon--blue {
  background: linear-gradient(135deg, #409eff, #096dd9);
}

.section-icon--green {
  background: linear-gradient(135deg, #67c23a, #389e0d);
}

.status-badge {
  margin-left: auto;
}

.status-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  margin-right: 6px;
}

.status-dot--primary {
  background: #409eff;
}

.id-link {
  color: #409eff;
  font-family: monospace;
}

.worker-chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #409eff;
  color: #fff;
  font-size: 12px;
  margin-right: 6px;
}

.timeout-alert {
  margin-top: 14px;
  padding: 10px 14px;
  background: #fef0f0;
  border: 1px solid #fde2e2;
  border-radius: 8px;
  color: #f56c6c;
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.timeout-icon {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #f56c6c;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  flex-shrink: 0;
}

.timeline-toolbar {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: #909399;
}

.lifecycle-timeline {
  padding-top: 4px;
}

.timeline-card {
  background: #fafafa;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 12px 14px;
}

.timeline-card.current {
  background: #ecf5ff;
  border-color: #b3d8ff;
}

.timeline-card.manual {
  background: #fdf6ec;
  border-color: #f5dab1;
}

.timeline-card.operation {
  background: #f4f4f5;
  border-color: #e9e9eb;
}

.timeline-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.timeline-meta {
  display: flex;
  gap: 16px;
  font-size: 12px;
  color: #909399;
  margin-bottom: 6px;
}

.timeline-desc {
  margin: 0;
  font-size: 13px;
  color: #606266;
  line-height: 1.5;
}

.timeline-fields {
  margin-top: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #f8fafc;
  border: 1px solid #eef2f7;
}

.timeline-fields-title {
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  margin-bottom: 6px;
}

.timeline-field-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 4px 0;
  font-size: 13px;
}

.timeline-field-row .field-name {
  color: #909399;
  flex-shrink: 0;
}

.timeline-field-row .field-value {
  color: #303133;
  text-align: right;
  word-break: break-word;
}

.side-card-head {
  margin-bottom: 14px;
}

.enterprise-action-card {
  padding: 0;
  overflow: hidden;
  border: none;
  background: transparent;
  box-shadow: none;
}

.enterprise-dialog-shell {
  position: relative;
  min-height: 320px;
  border-radius: 12px;
  overflow: hidden;
  border: 1px solid #e4e7ed;
}

.enterprise-dialog-backdrop {
  position: absolute;
  inset: 0;
  background: rgba(15, 23, 42, 0.4);
}

.enterprise-dialog {
  position: relative;
  z-index: 1;
  margin: 20px 16px;
  background: #fff;
  border-radius: 10px;
  box-shadow: 0 16px 40px rgba(15, 23, 42, 0.2);
  overflow: hidden;
}

.enterprise-dialog-header {
  padding: 16px 18px 12px;
  border-bottom: 1px solid #ebeef5;
  background: linear-gradient(180deg, #fafbfc, #fff);
}

.enterprise-dialog-header h3 {
  margin: 0;
  font-size: 16px;
}

.enterprise-dialog-header p {
  margin: 6px 0 0;
  font-size: 13px;
  color: #909399;
}

.enterprise-dialog-body {
  padding: 14px 18px;
}

.enterprise-dialog-tip {
  margin: 0 0 12px;
  font-size: 13px;
  color: #606266;
  line-height: 1.5;
}

.enterprise-dialog-footer {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  justify-content: flex-end;
  padding: 12px 18px 16px;
  border-top: 1px solid #ebeef5;
  background: #fafafa;
}

.enterprise-action-btn {
  margin: 0;
}

.submitted-fields {
  margin-bottom: 16px;
  padding: 12px;
  background: #fff;
  border: 1px solid #ffe58f;
  border-radius: 8px;
}

.submitted-title {
  font-size: 13px;
  font-weight: 600;
  color: #d48806;
  margin-bottom: 10px;
}

.submitted-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  font-size: 13px;
  padding: 6px 0;
  border-bottom: 1px dashed #f0f0f0;
}

.submitted-row:last-child {
  border-bottom: none;
}

.submitted-label {
  color: #909399;
  flex-shrink: 0;
}

.submitted-value {
  color: #303133;
  text-align: right;
  word-break: break-all;
}

.field-empty {
  padding: 8px 0;
}

.intervention-title {
  color: #f56c6c;
}

.action-block {
  margin-bottom: 16px;
  padding-bottom: 16px;
  border-bottom: 1px solid #ebeef5;
}

.action-block:last-of-type {
  border-bottom: none;
  margin-bottom: 0;
  padding-bottom: 0;
}

.action-label {
  font-size: 14px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 4px;
}

.action-label.danger {
  color: #f56c6c;
}

.action-desc {
  margin: 0 0 10px;
  font-size: 12px;
  color: #909399;
}

.action-btn {
  width: 100%;
  margin-top: 10px;
}

.action-btn--purple {
  --el-button-bg-color: #722ed1;
  --el-button-border-color: #722ed1;
  --el-button-hover-bg-color: #9254de;
  --el-button-hover-border-color: #9254de;
}

.action-hint {
  margin-top: 14px;
}

@media (max-width: 1100px) {
  .detail-layout {
    grid-template-columns: 1fr;
  }
}
</style>
