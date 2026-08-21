<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'
import TaskQuantityField from '@/components/task/TaskQuantityField.vue'
import TaskFormSection from '@/components/task/TaskFormSection.vue'
import {
  dispatchModeMap,
  formatTaskQuantity,
  formatTaskTypePrice,
  resolveTaskCustomerUnitPrice,
  resolveTaskPricing,
  resolveTaskSettlementUnitPrice,
  taskPublishStatusMap,
  workflowStatusMap,
} from '@/constants/task'
import { calcEnterpriseTaskProgress } from '@/services/task'
import { resolveEnterpriseIdByDepartment } from '@/utils/enterpriseScope'
import type { PricingMode, Task, TieredPrice } from '@/types'

const store = useAppStore()
const activeTab = ref<'pending' | 'all'>('pending')
const detailVisible = ref(false)
const publishVisible = ref(false)
const currentTask = ref<Task | null>(null)
const reviewNote = ref('')

const emptyTier = (): TieredPrice => ({ minCount: 1, maxCount: 10, unitPrice: 50 })

const reviewForm = ref({
  name: '',
  workflowId: '',
  departmentId: '',
  pricingMode: 'fixed' as PricingMode,
  fixedPrice: 50,
  tieredPrices: [emptyTier()] as TieredPrice[],
  settlementUnitPrice: 50,
  incentive: '',
  trainingCourseId: '',
  plannedTotal: 100 as number | undefined,
  unlimitedQuantity: false,
  longTerm: false,
  dateRange: [] as string[],
  dispatchMode: 'hall' as 'assign' | 'hall',
  assigneeIds: [] as string[],
  maxPerPerson: 5,
  region: '',
  description: '',
})

const publishForm = ref({
  enterpriseId: '',
  departmentId: '',
  name: '',
  workflowId: '',
  pricingMode: 'fixed' as PricingMode,
  fixedPrice: 50,
  tieredPrices: [emptyTier()] as TieredPrice[],
  incentive: '',
  trainingCourseId: '',
  plannedTotal: 100 as number | undefined,
  unlimitedQuantity: false,
  longTerm: false,
  dateRange: ['2026-07-26', '2026-08-26'] as string[],
  dispatchMode: 'hall' as 'assign' | 'hall',
  assigneeIds: [] as string[],
  maxPerPerson: 5,
  region: '',
  description: '',
})

const enterpriseOptions = computed(() =>
  store.enterprises.filter((e) => e.status === 'active' && !e.tenantDisabled),
)

function departmentsOfEnterprise(enterpriseId: string) {
  if (!enterpriseId) return []
  return store.departments.filter((d) => {
    if (d.orgType === 'enterprise') return false
    if (d.id.includes('unassigned')) return false
    return resolveEnterpriseIdByDepartment(d.id, store.departments) === enterpriseId
  })
}

const reviewDepartmentOptions = computed(() =>
  departmentsOfEnterprise(currentTask.value?.enterpriseId ?? ''),
)

const publishDepartmentOptions = computed(() =>
  departmentsOfEnterprise(publishForm.value.enterpriseId),
)

const reviewWorkflowOptions = computed(() => {
  const entId = currentTask.value?.enterpriseId
  if (!entId) return []
  return store.enabledWorkflows
    .filter(
      (w) => w.enterpriseScope === 'all' || (w.enterpriseIds ?? []).includes(entId),
    )
    .map((w) => ({
      label: `${w.name}（${workflowStatusMap[w.status]}）`,
      value: w.id,
    }))
})

const publishWorkflowOptions = computed(() => {
  const entId = publishForm.value.enterpriseId
  if (!entId) return []
  return store.enabledWorkflows
    .filter(
      (w) => w.enterpriseScope === 'all' || (w.enterpriseIds ?? []).includes(entId),
    )
    .map((w) => ({
      label: `${w.name}（${workflowStatusMap[w.status]}）`,
      value: w.id,
    }))
})

const workerOptions = computed(() => {
  const entId = currentTask.value?.enterpriseId || publishForm.value.enterpriseId
  return store.activeEmployees
    .filter((e) => !entId || e.enterpriseId === entId)
    .map((e) => ({ label: `${e.name}（${e.employeeNo}）`, value: e.id }))
})

const customerUnitPrice = computed(() =>
  resolveTaskCustomerUnitPrice({
    pricingMode: reviewForm.value.pricingMode,
    fixedPrice: reviewForm.value.fixedPrice,
    tieredPrices: reviewForm.value.tieredPrices,
  }),
)

const tableData = computed(() =>
  store.tasks
    .filter((t) => (activeTab.value === 'pending' ? t.status === 'pending' : true))
    .map((t) => {
      const wf = store.taskWorkflows.find((w) => w.id === t.workflowId)
      const pricing = resolveTaskPricing(t, store.taskTypes)
      const { progress } = calcEnterpriseTaskProgress(t)
      return {
        ...t,
        workflowName: wf?.name ?? '-',
        departmentLabel: t.departmentName || '—',
        priceLabel: pricing ? formatTaskTypePrice(pricing) : '-',
        settlementLabel:
          t.settlementUnitPrice != null
            ? `¥${t.settlementUnitPrice}/单`
            : `¥${resolveTaskSettlementUnitPrice(t)}/单（默认）`,
        dispatchLabel: dispatchModeMap[t.dispatchMode],
        quantityLabel: formatTaskQuantity(t.unlimitedQuantity, t.plannedTotal),
        statusLabel: taskPublishStatusMap[t.status],
        periodLabel: t.longTerm
          ? '长期'
          : `${t.startTime.slice(0, 10)} ~ ${t.endTime.slice(0, 10)}`,
        progress,
      }
    }),
)

const pendingCount = computed(() => store.tasks.filter((t) => t.status === 'pending').length)

function fillReviewFromTask(row: Task) {
  const pricing = resolveTaskPricing(row, store.taskTypes)
  reviewForm.value = {
    name: row.name,
    workflowId: row.workflowId,
    departmentId: row.departmentId ?? '',
    pricingMode: pricing?.pricingMode ?? 'fixed',
    fixedPrice: pricing?.fixedPrice ?? 50,
    tieredPrices: pricing?.tieredPrices?.length
      ? pricing.tieredPrices.map((t) => ({ ...t }))
      : [emptyTier()],
    settlementUnitPrice: resolveTaskSettlementUnitPrice(row),
    incentive: row.incentive ?? '',
    trainingCourseId: row.trainingCourseId ?? '',
    plannedTotal: row.plannedTotal,
    unlimitedQuantity: row.unlimitedQuantity ?? row.plannedTotal == null,
    longTerm: row.longTerm ?? false,
    dateRange: row.longTerm ? [] : [row.startTime.slice(0, 10), row.endTime.slice(0, 10)],
    dispatchMode: row.dispatchMode,
    assigneeIds: row.assigneeIds ? [...row.assigneeIds] : [],
    maxPerPerson: row.maxPerPerson ?? 5,
    region: row.region ?? '',
    description: row.description,
  }
  reviewNote.value = ''
}

function openReview(row: Task) {
  currentTask.value = row
  fillReviewFromTask(row)
  detailVisible.value = true
}

function addTier(target: 'review' | 'publish') {
  const list =
    target === 'review' ? reviewForm.value.tieredPrices : publishForm.value.tieredPrices
  const last = list[list.length - 1]
  list.push({
    minCount: (last?.maxCount ?? 0) + 1,
    maxCount: (last?.maxCount ?? 0) + 10,
    unitPrice: (last?.unitPrice ?? 50) + 10,
  })
}

function removeTier(target: 'review' | 'publish', index: number) {
  const list =
    target === 'review' ? reviewForm.value.tieredPrices : publishForm.value.tieredPrices
  if (list.length <= 1) return
  list.splice(index, 1)
}

function buildTimeRange(longTerm: boolean, dateRange: string[]) {
  const now = new Date()
  const start = longTerm
    ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}T00:00:00.000Z`
    : `${dateRange[0]}T00:00:00.000Z`
  const end = longTerm
    ? '2099-12-31T23:59:59.000Z'
    : `${dateRange[1]}T23:59:59.000Z`
  return { start, end }
}

function validateReviewForm() {
  if (!reviewForm.value.name.trim()) {
    ElMessage.warning('请输入任务名称')
    return false
  }
  if (!reviewForm.value.workflowId) {
    ElMessage.warning('请选择任务流程')
    return false
  }
  if (!reviewForm.value.departmentId) {
    ElMessage.warning('请选择部门/公司')
    return false
  }
  if (!reviewForm.value.description.trim()) {
    ElMessage.warning('请填写任务内容')
    return false
  }
  if (!reviewForm.value.region.trim()) {
    ElMessage.warning('请填写任务地点')
    return false
  }
  if (
    reviewForm.value.pricingMode === 'fixed' &&
    (!reviewForm.value.fixedPrice || reviewForm.value.fixedPrice < 1)
  ) {
    ElMessage.warning('请填写固定单价')
    return false
  }
  if (reviewForm.value.settlementUnitPrice < 0) {
    ElMessage.warning('结算价不能为负数')
    return false
  }
  if (
    !reviewForm.value.unlimitedQuantity &&
    (!reviewForm.value.plannedTotal || reviewForm.value.plannedTotal < 1)
  ) {
    ElMessage.warning('请填写任务数量或选择无上限')
    return false
  }
  if (
    !reviewForm.value.longTerm &&
    (!reviewForm.value.dateRange?.length || reviewForm.value.dateRange.length < 2)
  ) {
    ElMessage.warning('请设置任务期限或选择长期')
    return false
  }
  return true
}

async function approveTask() {
  const task = currentTask.value
  if (!task) return
  if (!validateReviewForm()) return
  const dept = store.departments.find((d) => d.id === reviewForm.value.departmentId)
  const { start, end } = buildTimeRange(
    reviewForm.value.longTerm,
    reviewForm.value.dateRange,
  )
  try {
    const { value } = await ElMessageBox.prompt(
      '审批意见（可选）',
      '通过并发布到任务大厅',
      {
        inputValue: reviewNote.value || '符合规范，予以发布',
        inputPlaceholder: '请输入',
      },
    )
    store.reviewEnterpriseTask(task.id, true, String(value || '').trim(), '运营-李芳', {
      name: reviewForm.value.name.trim(),
      workflowId: reviewForm.value.workflowId,
      departmentId: reviewForm.value.departmentId,
      departmentName: dept?.name,
      description: reviewForm.value.description.trim(),
      region: reviewForm.value.region.trim(),
      pricingMode: reviewForm.value.pricingMode,
      fixedPrice:
        reviewForm.value.pricingMode === 'fixed' ? reviewForm.value.fixedPrice : undefined,
      tieredPrices:
        reviewForm.value.pricingMode === 'tiered' ? reviewForm.value.tieredPrices : undefined,
      settlementUnitPrice: reviewForm.value.settlementUnitPrice,
      incentive: reviewForm.value.incentive.trim() || undefined,
      trainingCourseId: reviewForm.value.trainingCourseId.trim() || undefined,
      unlimitedQuantity: reviewForm.value.unlimitedQuantity,
      plannedTotal: reviewForm.value.unlimitedQuantity
        ? undefined
        : reviewForm.value.plannedTotal,
      longTerm: reviewForm.value.longTerm,
      startTime: start,
      endTime: end,
      dispatchMode: reviewForm.value.dispatchMode,
      assigneeIds:
        reviewForm.value.dispatchMode === 'assign' ? reviewForm.value.assigneeIds : undefined,
      maxPerPerson: reviewForm.value.maxPerPerson,
    })
    detailVisible.value = false
    ElMessage.success('已发布到任务大厅')
  } catch {
    // cancelled
  }
}

async function rejectTask() {
  const task = currentTask.value
  if (!task) return
  const note = reviewNote.value.trim()
  if (!note) {
    ElMessage.warning('驳回须填写原因')
    return
  }
  try {
    store.reviewEnterpriseTask(task.id, false, note, '运营-李芳')
    detailVisible.value = false
    ElMessage.success('已驳回该任务')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '驳回失败')
  }
}

function resetPublishForm() {
  const enterpriseId = enterpriseOptions.value[0]?.id ?? ''
  const depts = departmentsOfEnterprise(enterpriseId)
  const workflows = store.enabledWorkflows.filter(
    (w) =>
      w.enterpriseScope === 'all' || (w.enterpriseIds ?? []).includes(enterpriseId),
  )
  const workflowId = workflows[0]?.id ?? ''
  publishForm.value = {
    enterpriseId,
    departmentId: depts[0]?.id ?? '',
    name: workflowId ? store.suggestTaskName(workflowId) : '',
    workflowId,
    pricingMode: 'fixed',
    fixedPrice: 50,
    tieredPrices: [emptyTier()],
    incentive: '',
    trainingCourseId: '',
    plannedTotal: 100,
    unlimitedQuantity: false,
    longTerm: false,
    dateRange: ['2026-07-26', '2026-08-26'],
    dispatchMode: 'hall',
    assigneeIds: [],
    maxPerPerson: 5,
    region: '',
    description: '',
  }
}

function openPublish() {
  if (!enterpriseOptions.value.length) {
    ElMessage.warning('暂无可用企业')
    return
  }
  resetPublishForm()
  publishVisible.value = true
}

watch(
  () => publishForm.value.enterpriseId,
  (entId) => {
    if (!publishVisible.value) return
    const depts = departmentsOfEnterprise(entId)
    if (!depts.some((d) => d.id === publishForm.value.departmentId)) {
      publishForm.value.departmentId = depts[0]?.id ?? ''
    }
    const wfs = publishWorkflowOptions.value
    if (!wfs.some((w) => w.value === publishForm.value.workflowId)) {
      publishForm.value.workflowId = wfs[0]?.value ?? ''
      if (publishForm.value.workflowId) {
        publishForm.value.name = store.suggestTaskName(publishForm.value.workflowId)
      }
    }
  },
)

watch(
  () => publishForm.value.workflowId,
  (id) => {
    if (id && publishVisible.value) {
      publishForm.value.name = store.suggestTaskName(id)
    }
  },
)

function validatePublishForm() {
  if (!publishForm.value.enterpriseId) {
    ElMessage.warning('请选择企业')
    return false
  }
  if (!publishForm.value.departmentId) {
    ElMessage.warning('请选择部门/公司')
    return false
  }
  if (!publishForm.value.name.trim()) {
    ElMessage.warning('请输入任务名称')
    return false
  }
  if (!publishForm.value.workflowId) {
    ElMessage.warning('请选择任务流程')
    return false
  }
  if (!publishForm.value.description.trim()) {
    ElMessage.warning('请填写任务内容')
    return false
  }
  if (!publishForm.value.region.trim()) {
    ElMessage.warning('请填写任务地点')
    return false
  }
  if (
    publishForm.value.pricingMode === 'fixed' &&
    (!publishForm.value.fixedPrice || publishForm.value.fixedPrice < 1)
  ) {
    ElMessage.warning('请填写固定单价')
    return false
  }
  if (
    !publishForm.value.unlimitedQuantity &&
    (!publishForm.value.plannedTotal || publishForm.value.plannedTotal < 1)
  ) {
    ElMessage.warning('请填写任务数量或选择无上限')
    return false
  }
  if (
    !publishForm.value.longTerm &&
    (!publishForm.value.dateRange?.length || publishForm.value.dateRange.length < 2)
  ) {
    ElMessage.warning('请设置任务期限或选择长期')
    return false
  }
  if (
    publishForm.value.dispatchMode === 'assign' &&
    !publishForm.value.assigneeIds.length
  ) {
    ElMessage.warning('指派模式请选择人员')
    return false
  }
  return true
}

async function submitPublish() {
  if (!validatePublishForm()) return
  const dept = store.departments.find((d) => d.id === publishForm.value.departmentId)
  const { start, end } = buildTimeRange(
    publishForm.value.longTerm,
    publishForm.value.dateRange,
  )
  try {
    await ElMessageBox.confirm(
      '确认提交发布？提交后进入任务审批，通过后进入任务大厅。',
      '发布确认',
    )
    const created = store.addEnterpriseTask(publishForm.value.enterpriseId, {
      name: publishForm.value.name.trim(),
      workflowId: publishForm.value.workflowId,
      departmentId: publishForm.value.departmentId,
      departmentName: dept?.name,
      pricingMode: publishForm.value.pricingMode,
      fixedPrice:
        publishForm.value.pricingMode === 'fixed' ? publishForm.value.fixedPrice : undefined,
      tieredPrices:
        publishForm.value.pricingMode === 'tiered' ? publishForm.value.tieredPrices : undefined,
      incentive: publishForm.value.incentive.trim() || undefined,
      trainingCourseId: publishForm.value.trainingCourseId.trim() || undefined,
      unlimitedQuantity: publishForm.value.unlimitedQuantity,
      plannedTotal: publishForm.value.unlimitedQuantity
        ? undefined
        : publishForm.value.plannedTotal,
      longTerm: publishForm.value.longTerm,
      startTime: start,
      endTime: end,
      dispatchMode: publishForm.value.dispatchMode,
      assigneeIds:
        publishForm.value.dispatchMode === 'assign'
          ? publishForm.value.assigneeIds
          : undefined,
      maxPerPerson: publishForm.value.maxPerPerson,
      region: publishForm.value.region.trim(),
      description: publishForm.value.description.trim(),
    })
    store.publishEnterpriseTask(created.id)
    publishVisible.value = false
    activeTab.value = 'pending'
    ElMessage.success('已提交审批')
  } catch (e) {
    if (e !== 'cancel' && e instanceof Error) ElMessage.error(e.message)
  }
}

function syncSettlementFromCustomer() {
  reviewForm.value.settlementUnitPrice = customerUnitPrice.value
}
</script>

<template>
  <div class="page-card">
    <div class="page-header">
      <div>
        <h2 class="page-title">任务审批</h2>
        <p class="text-muted">
          审核时可修改发布内容与结算价，通过后进入任务大厅 · 待审批 {{ pendingCount }} 条
        </p>
      </div>
      <el-button type="primary" :icon="Plus" @click="openPublish">发布任务</el-button>
    </div>

    <el-tabs v-model="activeTab">
      <el-tab-pane :label="`待审批 (${pendingCount})`" name="pending" />
      <el-tab-pane label="全部记录" name="all" />
    </el-tabs>

    <el-table :data="tableData" border stripe>
      <el-table-column prop="enterpriseName" label="企业名称" min-width="150" show-overflow-tooltip />
      <el-table-column prop="departmentLabel" label="部门/公司" min-width="130" show-overflow-tooltip />
      <el-table-column prop="name" label="任务名称" min-width="150" show-overflow-tooltip />
      <el-table-column prop="workflowName" label="任务流程" min-width="130" show-overflow-tooltip />
      <el-table-column prop="priceLabel" label="客户单价" min-width="120" show-overflow-tooltip />
      <el-table-column prop="settlementLabel" label="结算价" width="120" show-overflow-tooltip />
      <el-table-column prop="quantityLabel" label="任务数量" width="90" />
      <el-table-column prop="dispatchLabel" label="派单方式" width="100" />
      <el-table-column prop="periodLabel" label="任务期限" min-width="150" />
      <el-table-column label="提交时间" width="160">
        <template #default="{ row }">
          {{ new Date(row.createdAt).toLocaleString('zh-CN') }}
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag
            size="small"
            :type="
              row.status === 'active'
                ? 'success'
                : row.status === 'pending'
                  ? 'warning'
                  : row.status === 'rejected'
                    ? 'danger'
                    : 'info'
            "
          >
            {{ row.statusLabel }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="140" fixed="right">
        <template #default="{ row }">
          <el-button
            v-if="row.status === 'pending'"
            link
            type="warning"
            @click="openReview(row)"
          >
            审核
          </el-button>
          <el-button v-else link type="primary" @click="openReview(row)">详情</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>

  <el-drawer
    v-model="detailVisible"
    :title="
      currentTask?.status === 'pending'
        ? `审核发布 · ${currentTask?.name ?? ''}`
        : currentTask?.name ?? '任务详情'
    "
    size="640px"
  >
    <template v-if="currentTask">
      <el-alert
        v-if="currentTask.status === 'pending'"
        type="info"
        :closable="false"
        title="可修改任务发布内容，并配置灵工结算价后发布到任务大厅"
        style="margin-bottom: 16px"
      />
      <el-form
        label-position="top"
        :disabled="currentTask.status !== 'pending'"
      >
        <TaskFormSection title="基本信息" subtitle="流程、部门与内容" icon="基" icon-variant="blue">
          <el-form-item label="企业">
            <el-input :model-value="currentTask.enterpriseName" disabled />
          </el-form-item>
          <el-form-item label="部门/公司" required>
            <el-select v-model="reviewForm.departmentId" style="width: 100%" filterable>
              <el-option
                v-for="d in reviewDepartmentOptions"
                :key="d.id"
                :label="d.name"
                :value="d.id"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="任务流程配置" required>
            <el-select v-model="reviewForm.workflowId" style="width: 100%">
              <el-option
                v-for="opt in reviewWorkflowOptions"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="任务名称" required>
            <el-input v-model="reviewForm.name" />
          </el-form-item>
          <el-form-item label="任务内容" required>
            <el-input v-model="reviewForm.description" type="textarea" :rows="3" />
          </el-form-item>
          <el-form-item label="任务地点" required>
            <el-input v-model="reviewForm.region" />
          </el-form-item>
        </TaskFormSection>

        <TaskFormSection title="客户定价" subtitle="企业侧发布单价，可随内容调整" icon="价" icon-variant="green">
          <el-form-item label="单价模式">
            <el-radio-group v-model="reviewForm.pricingMode">
              <el-radio value="fixed">固定单价</el-radio>
              <el-radio value="tiered">阶梯单价</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item v-if="reviewForm.pricingMode === 'fixed'" label="固定单价">
            <el-input-number v-model="reviewForm.fixedPrice" :min="1" :max="9999" /> 元/单
          </el-form-item>
          <template v-else>
            <el-form-item label="阶梯单价">
              <div class="tier-list">
                <div v-for="(tier, index) in reviewForm.tieredPrices" :key="index" class="tier-row">
                  <el-input-number v-model="tier.minCount" :min="1" controls-position="right" />
                  <span>~</span>
                  <el-input-number
                    v-model="tier.maxCount"
                    :min="tier.minCount"
                    controls-position="right"
                  />
                  <span>单</span>
                  <el-input-number v-model="tier.unitPrice" :min="1" controls-position="right" />
                  <span>元/单</span>
                  <el-button
                    v-if="currentTask.status === 'pending'"
                    text
                    type="danger"
                    :disabled="reviewForm.tieredPrices.length <= 1"
                    @click="removeTier('review', index)"
                  >
                    删除
                  </el-button>
                </div>
                <el-button
                  v-if="currentTask.status === 'pending'"
                  size="small"
                  @click="addTier('review')"
                >
                  添加阶梯
                </el-button>
              </div>
            </el-form-item>
          </template>
          <el-form-item label="任务激励">
            <el-input v-model="reviewForm.incentive" placeholder="可选" />
          </el-form-item>
          <el-form-item label="培训要求">
            <el-input v-model="reviewForm.trainingCourseId" placeholder="可选，培训课程 ID" />
          </el-form-item>
        </TaskFormSection>

        <TaskFormSection title="灵工结算价" subtitle="默认代入客户单价，审批时可改" icon="结" icon-variant="purple">
          <el-form-item label="结算单价" required>
            <div class="settlement-row">
              <el-input-number
                v-model="reviewForm.settlementUnitPrice"
                :min="0"
                :max="9999"
                :step="1"
              />
              <span>元/单</span>
              <el-button
                v-if="currentTask.status === 'pending'"
                link
                type="primary"
                @click="syncSettlementFromCustomer"
              >
                同步客户单价（¥{{ customerUnitPrice }}）
              </el-button>
            </div>
            <p class="field-hint">灵工认领结算按此单价计算；客户费用仍按上方客户定价</p>
          </el-form-item>
        </TaskFormSection>

        <TaskFormSection title="数量、期限与派单" icon="派" icon-variant="orange">
          <el-form-item label="任务数量" required>
            <TaskQuantityField
              v-model="reviewForm.plannedTotal"
              v-model:unlimited="reviewForm.unlimitedQuantity"
            />
          </el-form-item>
          <el-form-item label="任务期限">
            <el-radio-group v-model="reviewForm.longTerm">
              <el-radio :value="true">长期</el-radio>
              <el-radio :value="false">指定时间段</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item v-if="!reviewForm.longTerm" label="时间范围" required>
            <el-date-picker
              v-model="reviewForm.dateRange"
              type="daterange"
              value-format="YYYY-MM-DD"
              start-placeholder="开始"
              end-placeholder="结束"
              style="width: 100%"
            />
          </el-form-item>
          <el-form-item label="派单方式" required>
            <el-radio-group v-model="reviewForm.dispatchMode">
              <el-radio value="hall">发布到任务大厅</el-radio>
              <el-radio value="assign">指派特定人员</el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item v-if="reviewForm.dispatchMode === 'assign'" label="指派人员">
            <el-select v-model="reviewForm.assigneeIds" multiple filterable style="width: 100%">
              <el-option
                v-for="w in workerOptions"
                :key="w.value"
                :label="w.label"
                :value="w.value"
              />
            </el-select>
          </el-form-item>
          <el-form-item label="限领规则">
            <span>每人最多</span>
            <el-input-number
              v-model="reviewForm.maxPerPerson"
              :min="1"
              :max="99"
              style="margin: 0 8px"
            />
            <span>单</span>
          </el-form-item>
        </TaskFormSection>

        <el-form-item v-if="currentTask.status === 'pending'" label="审批意见 / 驳回原因">
          <el-input
            v-model="reviewNote"
            type="textarea"
            :rows="2"
            placeholder="驳回时必填"
          />
        </el-form-item>
        <el-form-item v-else-if="currentTask.reviewNote" label="审批意见">
          <el-input :model-value="currentTask.reviewNote" disabled />
        </el-form-item>
      </el-form>

      <div v-if="currentTask.status === 'pending'" class="drawer-actions">
        <el-button type="success" @click="approveTask">通过并发布到大厅</el-button>
        <el-button type="danger" @click="rejectTask">驳回</el-button>
      </div>
    </template>
  </el-drawer>

  <el-dialog
    v-model="publishVisible"
    title="发布任务"
    width="760px"
    destroy-on-close
    class="task-form-dialog"
  >
    <el-alert
      type="info"
      :closable="false"
      title="后台发布需选择企业与部门/公司，提交后进入任务审批"
      style="margin-bottom: 16px"
    />
    <el-form label-width="110px">
      <TaskFormSection title="归属" subtitle="企业与部门/公司" icon="企" icon-variant="blue">
        <el-form-item label="企业" required>
          <el-select v-model="publishForm.enterpriseId" filterable style="width: 100%">
            <el-option
              v-for="e in enterpriseOptions"
              :key="e.id"
              :label="e.name"
              :value="e.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="部门/公司" required>
          <el-select v-model="publishForm.departmentId" filterable style="width: 100%">
            <el-option
              v-for="d in publishDepartmentOptions"
              :key="d.id"
              :label="d.name"
              :value="d.id"
            />
          </el-select>
        </el-form-item>
      </TaskFormSection>

      <TaskFormSection title="基本信息" subtitle="流程配置、名称与内容" icon="基" icon-variant="blue">
        <el-form-item label="任务流程配置" required>
          <el-select v-model="publishForm.workflowId" placeholder="选择已启用流程" style="width: 100%">
            <el-option
              v-for="opt in publishWorkflowOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="任务名称" required>
          <el-input v-model="publishForm.name" placeholder="默认：流程名+年月，可编辑" />
        </el-form-item>
        <el-form-item label="任务内容" required>
          <el-input
            v-model="publishForm.description"
            type="textarea"
            :rows="3"
            placeholder="对灵工展示的任务说明"
          />
        </el-form-item>
        <el-form-item label="任务地点" required>
          <el-input v-model="publishForm.region" placeholder="如：北京市朝阳区建国路商圈" />
        </el-form-item>
      </TaskFormSection>

      <TaskFormSection title="定价配置" subtitle="固定单价或阶梯单价" icon="价" icon-variant="green">
        <el-form-item label="单价模式">
          <el-radio-group v-model="publishForm.pricingMode">
            <el-radio value="fixed">固定单价</el-radio>
            <el-radio value="tiered">阶梯单价</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="publishForm.pricingMode === 'fixed'" label="固定单价">
          <el-input-number v-model="publishForm.fixedPrice" :min="1" :max="9999" /> 元/单
        </el-form-item>
        <template v-else>
          <el-form-item label="阶梯单价">
            <div class="tier-list">
              <div v-for="(tier, index) in publishForm.tieredPrices" :key="index" class="tier-row">
                <el-input-number v-model="tier.minCount" :min="1" controls-position="right" />
                <span>~</span>
                <el-input-number
                  v-model="tier.maxCount"
                  :min="tier.minCount"
                  controls-position="right"
                />
                <span>单</span>
                <el-input-number v-model="tier.unitPrice" :min="1" controls-position="right" />
                <span>元/单</span>
                <el-button
                  text
                  type="danger"
                  :disabled="publishForm.tieredPrices.length <= 1"
                  @click="removeTier('publish', index)"
                >
                  删除
                </el-button>
              </div>
              <el-button size="small" @click="addTier('publish')">添加阶梯</el-button>
            </div>
          </el-form-item>
        </template>
        <el-form-item label="任务激励">
          <el-input v-model="publishForm.incentive" placeholder="可选" />
        </el-form-item>
        <el-form-item label="培训要求">
          <el-input v-model="publishForm.trainingCourseId" placeholder="可选，培训课程 ID" />
        </el-form-item>
      </TaskFormSection>

      <TaskFormSection title="数量、期限与派单" icon="派" icon-variant="orange">
        <el-form-item label="任务数量" required>
          <TaskQuantityField
            v-model="publishForm.plannedTotal"
            v-model:unlimited="publishForm.unlimitedQuantity"
          />
        </el-form-item>
        <el-form-item label="任务期限">
          <el-radio-group v-model="publishForm.longTerm">
            <el-radio :value="true">长期</el-radio>
            <el-radio :value="false">指定时间段</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="!publishForm.longTerm" label="时间范围" required>
          <el-date-picker
            v-model="publishForm.dateRange"
            type="daterange"
            value-format="YYYY-MM-DD"
            start-placeholder="开始"
            end-placeholder="结束"
          />
        </el-form-item>
        <el-form-item label="派单方式" required>
          <el-radio-group v-model="publishForm.dispatchMode">
            <el-radio value="hall">发布到任务大厅</el-radio>
            <el-radio value="assign">指派特定人员</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="publishForm.dispatchMode === 'assign'" label="指派人员" required>
          <el-select v-model="publishForm.assigneeIds" multiple filterable style="width: 100%">
            <el-option
              v-for="w in workerOptions"
              :key="w.value"
              :label="w.label"
              :value="w.value"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="限领规则">
          <span>每人最多</span>
          <el-input-number
            v-model="publishForm.maxPerPerson"
            :min="1"
            :max="99"
            style="margin: 0 8px"
          />
          <span>单</span>
        </el-form-item>
      </TaskFormSection>
    </el-form>
    <template #footer>
      <el-button @click="publishVisible = false">取消</el-button>
      <el-button type="primary" @click="submitPublish">提交审批</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
  margin-bottom: 8px;
}

.tier-list {
  width: 100%;
}

.tier-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

.settlement-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.field-hint {
  margin: 6px 0 0;
  font-size: 12px;
  color: #909399;
}

.drawer-actions {
  margin-top: 20px;
  display: flex;
  gap: 12px;
}
</style>
