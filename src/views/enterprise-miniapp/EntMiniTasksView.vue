<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import EntMiniPageHeader from '@/components/enterprise-miniapp/EntMiniPageHeader.vue'
import { useAppStore } from '@/stores/app'
import { useEnterpriseMiniAuth } from '@/composables/useEnterpriseMiniAuth'
import { useEnterpriseInstanceAction } from '@/composables/useEnterpriseInstanceAction'
import {
  dispatchModeMap,
  formatTaskQuantity,
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
import type { PricingMode, TaskInstance, TieredPrice, WorkflowActionConfig } from '@/types'
import { resolveEnterpriseIdByDepartment } from '@/utils/enterpriseScope'

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

const emptyTier = (): TieredPrice => ({ minCount: 1, maxCount: 10, unitPrice: 50 })

const form = ref({
  name: '',
  workflowId: '',
  departmentId: '',
  pricingMode: 'fixed' as PricingMode,
  fixedPrice: 50,
  tieredPrices: [emptyTier()] as TieredPrice[],
  plannedTotal: 100 as number | undefined,
  unlimitedQuantity: false,
  longTerm: false,
  dateRange: ['2026-07-26', '2026-08-26'] as string[],
  dispatchMode: 'hall' as 'assign' | 'hall',
  maxPerPerson: 5,
  region: '',
  description: '',
})

const departmentOptions = computed(() =>
  store.departments.filter((d) => {
    if (d.orgType === 'enterprise') return false
    if (d.id.includes('unassigned')) return false
    return resolveEnterpriseIdByDepartment(d.id, store.departments) === enterpriseId.value
  }),
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
      return {
        ...t,
        workflowName: wf?.name ?? t.taskTypeName,
        departmentLabel: t.departmentName || '—',
        statusLabel: taskPublishStatusMap[t.status],
        dispatchLabel: dispatchModeMap[t.dispatchMode],
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
    name: workflowId ? store.suggestTaskName(workflowId) : '',
    workflowId,
    departmentId: departmentOptions.value[0]?.id ?? '',
    pricingMode: 'fixed',
    fixedPrice: 50,
    tieredPrices: [emptyTier()],
    plannedTotal: 100,
    unlimitedQuantity: false,
    longTerm: false,
    dateRange: ['2026-07-26', '2026-08-26'],
    dispatchMode: 'hall',
    maxPerPerson: 5,
    region: '',
    description: '',
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
  if (!departmentOptions.value.length) {
    ElMessage.warning('暂无可用部门/公司')
    return
  }
  resetPublishForm()
  publishVisible.value = true
}

function validatePublish() {
  if (!form.value.name.trim()) {
    ElMessage.warning('请输入任务名称')
    return false
  }
  if (!form.value.workflowId) {
    ElMessage.warning('请选择任务流程')
    return false
  }
  if (!form.value.departmentId) {
    ElMessage.warning('请选择部门/公司')
    return false
  }
  if (!form.value.description.trim()) {
    ElMessage.warning('请填写任务内容')
    return false
  }
  if (form.value.pricingMode === 'fixed' && (!form.value.fixedPrice || form.value.fixedPrice < 1)) {
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
  if (!form.value.region.trim()) {
    ElMessage.warning('请填写任务地点')
    return false
  }
  return true
}

function buildPayload() {
  const now = new Date()
  const start = form.value.longTerm
    ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T00:00:00.000Z`
    : `${form.value.dateRange[0]}T00:00:00.000Z`
  const end = form.value.longTerm
    ? '2099-12-31T23:59:59.000Z'
    : `${form.value.dateRange[1]}T23:59:59.000Z`

  return {
    name: form.value.name.trim(),
    workflowId: form.value.workflowId,
    departmentId: form.value.departmentId,
    departmentName: store.departments.find((d) => d.id === form.value.departmentId)?.name,
    pricingMode: form.value.pricingMode,
    fixedPrice: form.value.pricingMode === 'fixed' ? form.value.fixedPrice : undefined,
    tieredPrices: form.value.pricingMode === 'tiered' ? form.value.tieredPrices : undefined,
    unlimitedQuantity: form.value.unlimitedQuantity,
    plannedTotal: form.value.unlimitedQuantity ? undefined : form.value.plannedTotal,
    longTerm: form.value.longTerm,
    startTime: start,
    endTime: end,
    dispatchMode: form.value.dispatchMode,
    maxPerPerson: form.value.maxPerPerson,
    region: form.value.region.trim(),
    description: form.value.description.trim(),
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
          <p>{{ t.departmentLabel }} · {{ t.workflowName }} · {{ t.quantityLabel }} · {{ t.dispatchLabel }}</p>
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
        <div class="sheet-body">
          <label>部门/公司</label>
          <select v-model="form.departmentId">
            <option value="" disabled>请选择</option>
            <option v-for="d in departmentOptions" :key="d.id" :value="d.id">
              {{ d.name }}
            </option>
          </select>

          <label>任务流程</label>
          <select v-model="form.workflowId">
            <option v-for="opt in workflowOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>

          <label>任务名称</label>
          <input v-model="form.name" type="text" placeholder="任务名称" />

          <label>任务内容</label>
          <textarea v-model="form.description" rows="3" placeholder="任务说明、完成标准等" />

          <label>任务地点</label>
          <input v-model="form.region" type="text" placeholder="如：北京市朝阳区" />

          <label>单价（元/单）</label>
          <input v-model.number="form.fixedPrice" type="number" min="1" />

          <label>任务数量</label>
          <div class="inline">
            <input
              v-model.number="form.plannedTotal"
              type="number"
              min="1"
              :disabled="form.unlimitedQuantity"
            />
            <label class="check">
              <input v-model="form.unlimitedQuantity" type="checkbox" />
              无上限
            </label>
          </div>

          <label>任务期限</label>
          <div class="inline">
            <label class="check">
              <input v-model="form.longTerm" type="checkbox" />
              长期
            </label>
          </div>
          <div v-if="!form.longTerm" class="inline dates">
            <input v-model="form.dateRange[0]" type="date" />
            <span>至</span>
            <input v-model="form.dateRange[1]" type="date" />
          </div>

          <label>派单方式</label>
          <select v-model="form.dispatchMode">
            <option value="hall">发布到任务大厅</option>
            <option value="assign">指派特定人员</option>
          </select>

          <label>每人限领</label>
          <input v-model.number="form.maxPerPerson" type="number" min="1" max="99" />
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
  width: min(100%, 430px);
  max-height: 88vh;
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
</style>
