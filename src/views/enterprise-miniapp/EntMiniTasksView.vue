<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import EntMiniPageHeader from '@/components/enterprise-miniapp/EntMiniPageHeader.vue'
import TaskPublishFormBody, {
  type TaskPublishFormModel,
} from '@/components/task/TaskPublishFormBody.vue'
import { useAppStore } from '@/stores/app'
import { useEnterpriseMiniAuth } from '@/composables/useEnterpriseMiniAuth'
import { useEnterpriseInstanceAction } from '@/composables/useEnterpriseInstanceAction'
import {
  formatTaskQuantity,
  formatTaskRegionLabel,
  resolveTaskPublishDepartmentScope,
  taskPublishScopeMap,
  taskPublishStatusMap,
  workflowStatusMap,
} from '@/constants/task'
import {
  calcEnterpriseTaskProgress,
  getEnterpriseActionUiMeta,
  getInstanceEnterpriseActions,
  getWorkflowFieldsForNode,
  instanceWorkflowStatusMap,
  isInstanceAtEnterpriseNode,
  resolveInstanceWorkflowStatus,
} from '@/services/task'
import type { Task, TaskInstance, WorkflowActionConfig } from '@/types'
import { resolveEnterpriseIdByDepartment } from '@/utils/enterpriseScope'
import { isEnterpriseRootDepartment, isUnassignedDepartment } from '@/constants/department'

const route = useRoute()
const router = useRouter()
const store = useAppStore()
const { enterpriseId } = useEnterpriseMiniAuth()
const { runEnterpriseAction } = useEnterpriseInstanceAction()

const mainTab = ref<'overview' | 'detail'>('overview')
const instanceStatusFilter = ref<'all' | 'pending_me' | 'running' | 'completed' | 'cancelled'>(
  'pending_me',
)
const filterTaskId = ref('')
const publishVisible = ref(false)

function createEmptyForm(): TaskPublishFormModel {
  return {
    serviceProviderId: '',
    publishScope: 'global',
    departmentIds: [],
    workflowId: '',
    name: '',
    description: '',
    regionCodes: [],
    addressDetail: '',
    metadataFields: [],
    fixedPrice: 50,
    plannedTotal: 100,
    unlimitedQuantity: false,
    longTerm: false,
    dateRange: ['2026-07-26', '2026-08-26'],
    maxPerPerson: 5,
  }
}

const form = ref<TaskPublishFormModel>(createEmptyForm())

const departmentOptions = computed(() =>
  store.departments.filter((d) => {
    if (isEnterpriseRootDepartment(d) || isUnassignedDepartment(d.id)) return false
    return resolveEnterpriseIdByDepartment(d.id, store.departments) === enterpriseId.value
  }),
)

const providerOptions = computed(() =>
  store.serviceProviders
    .filter((p) => p.status === 'cooperating')
    .map((p) => ({ label: p.name, value: p.id })),
)

const workflowOptions = computed(() =>
  store.enabledWorkflows
    .filter(
      (w) =>
        w.enterpriseScope === 'all' ||
        (w.enterpriseIds ?? []).includes(enterpriseId.value),
    )
    .map((w) => ({
      label: `${w.name}（${workflowStatusMap[w.status]}）`,
      value: w.id,
    })),
)

const filterTaskName = computed(() => {
  if (!filterTaskId.value) return ''
  return store.tasks.find((t) => t.id === filterTaskId.value)?.name ?? ''
})

function enrichInstance(i: TaskInstance) {
  const task = store.tasks.find((t) => t.id === i.taskId)
  const workflow = task ? store.taskWorkflows.find((w) => w.id === task.workflowId) : undefined
  const workflowStatus = resolveInstanceWorkflowStatus(i, workflow)
  const statusMeta = instanceWorkflowStatusMap[workflowStatus]
  const pendingEnterprise = isInstanceAtEnterpriseNode(i, workflow)
  const enterpriseActions = getInstanceEnterpriseActions(i, workflow).map((a) => ({
    config: a,
    meta: getEnterpriseActionUiMeta(a),
  }))
  const hasEnterpriseFields = getWorkflowFieldsForNode(workflow, i.currentNodeId).length > 0
  return {
    ...i,
    workflowStatus,
    statusLabel: statusMeta.label,
    statusType: statusMeta.type,
    pendingEnterprise,
    enterpriseActions,
    hasEnterpriseFields,
    updatedLabel: new Date(i.updatedAt).toLocaleString('zh-CN'),
  }
}

const overviewTasks = computed(() =>
  store.tasks
    .filter((t) => t.enterpriseId === enterpriseId.value)
    .map((t) => {
      const { progress } = calcEnterpriseTaskProgress(t)
      const wf = store.taskWorkflows.find((w) => w.id === t.workflowId)
      const scopeLabel =
        t.publishScope === 'department'
          ? `${taskPublishScopeMap.department}·${t.departmentName || '—'}`
          : taskPublishScopeMap.global
      return {
        ...t,
        workflowName: wf?.name ?? t.taskTypeName,
        departmentLabel: t.departmentName || '—',
        providerLabel: t.serviceProviderName || '—',
        scopeLabel,
        statusLabel: taskPublishStatusMap[t.status],
        quantityLabel: formatTaskQuantity(t.unlimitedQuantity, t.plannedTotal),
        progress,
      }
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
)

const detailData = computed(() =>
  store.taskInstances
    .filter((i) => i.enterpriseId === enterpriseId.value)
    .filter((i) => !filterTaskId.value || i.taskId === filterTaskId.value)
    .map(enrichInstance)
    .filter((i) => {
      if (instanceStatusFilter.value === 'all') return true
      if (instanceStatusFilter.value === 'pending_me') return i.pendingEnterprise
      return i.workflowStatus === instanceStatusFilter.value
    }),
)

/** 统计锚定月：优先真实当月；当月无明细时用企业最近一条明细所在月（兼容演示种子） */
const statsMonthKey = computed(() => {
  const real = new Date().toISOString().slice(0, 7)
  const mine = store.taskInstances.filter((i) => i.enterpriseId === enterpriseId.value)
  if (mine.some((i) => i.createdAt.startsWith(real) || i.updatedAt.startsWith(real))) {
    return real
  }
  const latest = [...mine].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
  return latest?.updatedAt.slice(0, 7) ?? real
})

function inStatsMonth(iso: string) {
  return iso.slice(0, 7) === statsMonthKey.value
}

const summary = computed(() => {
  const enriched = store.taskInstances
    .filter((i) => i.enterpriseId === enterpriseId.value)
    .map(enrichInstance)

  const monthRunning = enriched.filter(
    (i) =>
      i.workflowStatus === 'running' &&
      (inStatsMonth(i.createdAt) || inStatsMonth(i.updatedAt)),
  ).length

  const monthCompleted = enriched.filter(
    (i) => i.workflowStatus === 'completed' && inStatsMonth(i.updatedAt),
  ).length

  return {
    monthLabel: `${statsMonthKey.value.slice(5)}月`,
    running: monthRunning,
    completed: monthCompleted,
    pendingMe: enriched.filter((i) => i.pendingEnterprise).length,
  }
})

function syncFromQuery() {
  const tab = String(route.query.tab ?? '')
  if (tab === 'detail' || tab === 'overview') {
    mainTab.value = tab
  }
  filterTaskId.value = String(route.query.taskId ?? '')
  if (filterTaskId.value) {
    mainTab.value = 'detail'
    instanceStatusFilter.value = 'all'
  }
}

onMounted(syncFromQuery)
watch(() => route.query, syncFromQuery, { deep: true })

function clearTaskFilter() {
  filterTaskId.value = ''
  router.replace({ path: '/enterprise-miniapp/tasks', query: { tab: 'detail' } })
}

function switchTab(tab: 'overview' | 'detail') {
  mainTab.value = tab
  if (tab === 'overview') {
    filterTaskId.value = ''
    router.replace({ path: '/enterprise-miniapp/tasks' })
    return
  }
  router.replace({
    path: '/enterprise-miniapp/tasks',
    query: {
      tab: 'detail',
      ...(filterTaskId.value ? { taskId: filterTaskId.value } : {}),
    },
  })
}

function resetPublishForm() {
  const workflowId = workflowOptions.value[0]?.value ?? ''
  form.value = {
    ...createEmptyForm(),
    serviceProviderId: providerOptions.value[0]?.value ?? '',
    workflowId,
    name: workflowId ? store.suggestTaskName(workflowId) : '',
  }
}

watch(
  () => form.value.workflowId,
  (id) => {
    if (id && publishVisible.value) {
      form.value.name = store.suggestTaskName(id)
    }
  },
)

function openPublish() {
  if (!workflowOptions.value.length) {
    ElMessage.warning('暂无可用任务流程，请联系平台配置')
    return
  }
  if (!providerOptions.value.length) {
    ElMessage.warning('暂无合作服务商，请联系平台配置')
    return
  }
  resetPublishForm()
  publishVisible.value = true
}

function validatePublish() {
  if (!form.value.serviceProviderId) {
    ElMessage.warning('请选择服务商')
    return false
  }
  if (!form.value.name.trim()) {
    ElMessage.warning('请输入任务名称')
    return false
  }
  if (!form.value.workflowId) {
    ElMessage.warning('请选择任务流程')
    return false
  }
  if (form.value.publishScope === 'department' && !form.value.departmentIds.length) {
    ElMessage.warning('请选择发布部门')
    return false
  }
  if (!form.value.description.trim()) {
    ElMessage.warning('请填写任务内容')
    return false
  }
  if (!form.value.fixedPrice || form.value.fixedPrice < 1) {
    ElMessage.warning('请填写固定单价')
    return false
  }
  if (!form.value.unlimitedQuantity && (!form.value.plannedTotal || form.value.plannedTotal < 1)) {
    ElMessage.warning('请填写任务数量或选择无上限')
    return false
  }
  if (!form.value.longTerm && (!form.value.dateRange?.length || form.value.dateRange.length < 2)) {
    ElMessage.warning('请设置任务期限或选择长期')
    return false
  }
  return true
}

function buildPayload(): Omit<
  Task,
  | 'id'
  | 'enterpriseId'
  | 'enterpriseName'
  | 'taskTypeName'
  | 'status'
  | 'acceptedCount'
  | 'completedCount'
  | 'approvedCount'
  | 'createdAt'
> {
  const now = new Date()
  const start = form.value.longTerm
    ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T00:00:00.000Z`
    : `${form.value.dateRange[0]}T00:00:00.000Z`
  const end = form.value.longTerm
    ? '2099-12-31T23:59:59.000Z'
    : `${form.value.dateRange[1]}T23:59:59.000Z`

  const provider = store.serviceProviders.find((p) => p.id === form.value.serviceProviderId)
  const deptScope =
    form.value.publishScope === 'department'
      ? resolveTaskPublishDepartmentScope(store.departments, form.value.departmentIds)
      : {
          publishDepartmentIds: [] as string[],
          departmentId: undefined as string | undefined,
          departmentName: undefined as string | undefined,
          scopeDepartmentIds: undefined as string[] | undefined,
        }
  const region = formatTaskRegionLabel(form.value.regionCodes, form.value.addressDetail)

  return {
    name: form.value.name.trim(),
    workflowId: form.value.workflowId,
    serviceProviderId: form.value.serviceProviderId,
    serviceProviderName: provider?.name,
    publishScope: form.value.publishScope,
    departmentId: deptScope.departmentId,
    departmentName: deptScope.departmentName,
    publishDepartmentIds: deptScope.publishDepartmentIds.length
      ? deptScope.publishDepartmentIds
      : undefined,
    scopeDepartmentIds: deptScope.scopeDepartmentIds,
    pricingMode: 'fixed',
    fixedPrice: form.value.fixedPrice,
    unlimitedQuantity: form.value.unlimitedQuantity,
    plannedTotal: form.value.unlimitedQuantity ? undefined : form.value.plannedTotal,
    longTerm: form.value.longTerm,
    startTime: start,
    endTime: end,
    dispatchMode: 'hall',
    maxPerPerson: form.value.maxPerPerson,
    regionCodes: [...form.value.regionCodes],
    addressDetail: form.value.addressDetail.trim() || undefined,
    region,
    description: form.value.description.trim(),
    metadataFields: form.value.metadataFields.filter((m) => m.label.trim()),
  }
}

async function submitPublish() {
  if (!validatePublish()) return
  try {
    await ElMessageBox.confirm(
      '确认提交发布？提交后将由平台审核，通过后进入任务大厅。',
      '发布确认',
    )
    const created = store.addEnterpriseTask(enterpriseId.value, buildPayload())
    store.publishEnterpriseTask(created.id)
    ElMessage.success('已提交审核')
    publishVisible.value = false
    mainTab.value = 'overview'
  } catch (e) {
    if (e !== 'cancel' && e instanceof Error) ElMessage.error(e.message)
  }
}

function openTaskDetail(taskId: string) {
  router.push(`/enterprise-miniapp/tasks/${taskId}`)
}

function openInstance(row: TaskInstance) {
  router.push(`/enterprise-miniapp/task-instances/${row.id}`)
}

function handleAction(
  row: TaskInstance & { hasEnterpriseFields?: boolean },
  config: WorkflowActionConfig,
) {
  if (row.hasEnterpriseFields) {
    router.push(`/enterprise-miniapp/task-instances/${row.id}`)
    return
  }
  runEnterpriseAction(row.id, config)
}
</script>

<template>
  <div class="page">
    <EntMiniPageHeader title="任务管理" />

    <div class="body">
      <section class="metrics">
        <div>
          <strong>{{ summary.running }}</strong>
          <span>{{ summary.monthLabel }}进行中</span>
        </div>
        <div>
          <strong>{{ summary.completed }}</strong>
          <span>{{ summary.monthLabel }}已完成</span>
        </div>
        <div class="warn">
          <strong>{{ summary.pendingMe }}</strong>
          <span>待我处理</span>
        </div>
      </section>

      <button type="button" class="publish-btn" @click="openPublish">＋ 任务发布</button>

      <div class="tabs">
        <button
          type="button"
          :class="{ active: mainTab === 'overview' }"
          @click="switchTab('overview')"
        >
          任务总览
        </button>
        <button
          type="button"
          :class="{ active: mainTab === 'detail' }"
          @click="switchTab('detail')"
        >
          任务明细
          <i v-if="summary.pendingMe" class="tab-badge">{{ summary.pendingMe }}</i>
        </button>
      </div>

      <template v-if="mainTab === 'overview'">
        <div v-if="!overviewTasks.length" class="empty">暂无任务，点击上方发布</div>
        <article
          v-for="t in overviewTasks"
          :key="t.id"
          class="card clickable"
          @click="openTaskDetail(t.id)"
        >
          <div class="row">
            <strong>{{ t.name }}</strong>
            <span class="tag">{{ t.statusLabel }}</span>
          </div>
          <p>{{ t.providerLabel }} · {{ t.scopeLabel }} · {{ t.workflowName }} · {{ t.quantityLabel }}</p>
          <div class="progress">
            <div class="bar"><i :style="{ width: `${t.progress}%` }" /></div>
            <span>完成 {{ t.completedCount }} / 接单 {{ t.acceptedCount }}</span>
          </div>
        </article>
      </template>

      <template v-else>
        <div v-if="filterTaskId" class="filter-banner">
          <span>当前任务：{{ filterTaskName || filterTaskId }}</span>
          <button type="button" @click="clearTaskFilter">清除筛选</button>
        </div>
        <div class="filters">
          <button
            type="button"
            :class="{ active: instanceStatusFilter === 'pending_me' }"
            @click="instanceStatusFilter = 'pending_me'"
          >
            待我处理
          </button>
          <button
            type="button"
            :class="{ active: instanceStatusFilter === 'all' }"
            @click="instanceStatusFilter = 'all'"
          >
            全部
          </button>
          <button
            type="button"
            :class="{ active: instanceStatusFilter === 'running' }"
            @click="instanceStatusFilter = 'running'"
          >
            执行中
          </button>
          <button
            type="button"
            :class="{ active: instanceStatusFilter === 'completed' }"
            @click="instanceStatusFilter = 'completed'"
          >
            已完成
          </button>
          <button
            type="button"
            :class="{ active: instanceStatusFilter === 'cancelled' }"
            @click="instanceStatusFilter = 'cancelled'"
          >
            已结束
          </button>
        </div>
        <div v-if="!detailData.length" class="empty">
          {{ instanceStatusFilter === 'pending_me' ? '暂无待我处理的明细' : '暂无认领记录' }}
        </div>
        <article
          v-for="row in detailData"
          :key="row.id"
          class="card clickable"
          @click="openInstance(row)"
        >
          <div class="row">
            <strong>{{ row.taskName }}</strong>
            <span class="tag" :class="row.pendingEnterprise ? 'pending' : row.workflowStatus">
              {{ row.pendingEnterprise ? '待我处理' : row.statusLabel }}
            </span>
          </div>
          <p>{{ row.workerName }} · {{ row.currentNodeName }} · ¥{{ row.amount }}</p>
          <div v-if="row.pendingEnterprise" class="actions" @click.stop>
            <button
              v-for="item in row.enterpriseActions"
              :key="item.config.action"
              type="button"
              class="act"
              @click="handleAction(row, item.config)"
            >
              {{ item.meta.label }}
            </button>
          </div>
        </article>
      </template>
    </div>

    <div v-if="publishVisible" class="sheet-mask" @click.self="publishVisible = false">
      <div class="sheet">
        <div class="sheet-head">
          <strong>任务发布</strong>
          <button type="button" class="close" @click="publishVisible = false">关闭</button>
        </div>
        <div class="sheet-body publish-form">
          <el-form label-position="top">
            <TaskPublishFormBody
              v-model="form"
              :require-location="false"
              :provider-options="providerOptions"
              :department-options="departmentOptions"
              :workflow-options="workflowOptions"
            />
          </el-form>
        </div>
        <div class="sheet-foot">
          <button type="button" class="ghost" @click="publishVisible = false">取消</button>
          <button type="button" class="primary" @click="submitPublish">提交审核</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  min-height: 100%;
  background: #fff;
}
.body {
  padding: 12px;
}
.metrics {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  background: #fff;
  border-radius: 14px;
  padding: 12px 6px;
  text-align: center;
  margin-bottom: 10px;
}
.metrics strong {
  display: block;
  font-size: 18px;
  color: #111827;
}
.metrics span {
  font-size: 11px;
  color: #9ca3af;
}
.metrics .warn strong {
  color: #ef4444;
}
.publish-btn {
  width: 100%;
  height: 42px;
  border: none;
  border-radius: 12px;
  background: #228BFF;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 10px;
}
.tabs,
.filters {
  display: flex;
  gap: 6px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}
.tabs button,
.filters button {
  border: none;
  background: #fff;
  color: #6b7280;
  border-radius: 999px;
  height: 30px;
  padding: 0 12px;
  font-size: 12px;
  position: relative;
}
.tabs button.active,
.filters button.active {
  background: #228BFF;
  color: #fff;
  font-weight: 600;
}
.tab-badge {
  margin-left: 4px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: #ef4444;
  color: #fff;
  font-size: 10px;
  font-style: normal;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.card {
  background: #fff;
  border-radius: 12px;
  padding: 12px;
  margin-bottom: 8px;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.04);
}
.card.clickable {
  cursor: pointer;
}
.filter-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
  padding: 8px 12px;
  border-radius: 10px;
  background: #D5E9FF;
  color: #228BFF;
  font-size: 12px;
}
.filter-banner button {
  border: none;
  background: transparent;
  color: #228BFF;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.row strong {
  font-size: 14px;
  color: #111827;
}
.tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  background: #f3f4f6;
  color: #6b7280;
  flex-shrink: 0;
}
.tag.running {
  background: #fff7ed;
  color: #c2410c;
}
.tag.completed {
  background: #ecfdf5;
  color: #059669;
}
.tag.cancelled {
  background: #f3f4f6;
  color: #6b7280;
}
.tag.pending {
  background: #fef2f2;
  color: #dc2626;
}
.card p {
  margin: 6px 0 0;
  font-size: 12px;
  color: #6b7280;
}
.progress {
  margin-top: 8px;
}
.bar {
  height: 6px;
  background: #D5E9FF;
  border-radius: 999px;
  overflow: hidden;
}
.bar i {
  display: block;
  height: 100%;
  background: #228BFF;
  font-style: normal;
}
.progress span {
  display: block;
  margin-top: 4px;
  font-size: 11px;
  color: #9ca3af;
}
.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}
.act,
.link {
  border: none;
  background: #228BFF;
  color: #fff;
  border-radius: 8px;
  height: 28px;
  padding: 0 10px;
  font-size: 12px;
}
.empty {
  padding: 40px 0;
  text-align: center;
  color: #9ca3af;
  font-size: 13px;
}

.sheet-mask {
  position: fixed;
  inset: 0;
  z-index: 80;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.sheet {
  width: min(100%, 560px);
  max-height: 92vh;
  background: #fff;
  border-radius: 16px 16px 0 0;
  display: flex;
  flex-direction: column;
}
.sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid #f3f4f6;
}
.sheet-head strong {
  font-size: 16px;
}
.close {
  border: none;
  background: none;
  color: #6b7280;
  font-size: 13px;
}
.sheet-body {
  padding: 12px 16px 8px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sheet-body label {
  font-size: 12px;
  color: #6b7280;
}
.sheet-body input,
.sheet-body select,
.sheet-body textarea {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 10px;
  font-size: 14px;
}
.inline {
  display: flex;
  align-items: center;
  gap: 10px;
}
.inline input[type='number'],
.inline input[type='date'] {
  flex: 1;
}
.check {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 13px;
  color: #374151;
  white-space: nowrap;
}
.dates span {
  font-size: 12px;
  color: #9ca3af;
}
.sheet-foot {
  display: grid;
  grid-template-columns: 1fr 1.4fr;
  gap: 10px;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
  border-top: 1px solid #f3f4f6;
}
.ghost,
.primary {
  height: 42px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
}
.ghost {
  border: 1px solid #e5e7eb;
  background: #fff;
  color: #6b7280;
}
.primary {
  border: none;
  background: #228BFF;
  color: #fff;
}
.publish-form {
  gap: 0;
}
.publish-form :deep(.el-form-item) {
  margin-bottom: 12px;
}
.publish-form :deep(.task-publish-form-body) {
  font-size: 13px;
}
</style>
