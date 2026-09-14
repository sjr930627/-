<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'
import TaskPublishFormBody, {
  type TaskPublishFormModel,
} from '@/components/task/TaskPublishFormBody.vue'
import TaskQuantityField from '@/components/task/TaskQuantityField.vue'
import TaskFormSection from '@/components/task/TaskFormSection.vue'
import {
  formatTaskQuantity,
  formatTaskRegionLabel,
  formatTaskTypePrice,
  resolveTaskSettlementUnitPrice,
  resolveTaskPublishDepartmentScope,
  taskPublishDepartmentIdsFromTask,
  taskPublishScopeMap,
  taskPublishStatusMap,
  workflowStatusMap,
} from '@/constants/task'
import { calcEnterpriseTaskProgress } from '@/services/task'
import { resolveEnterpriseIdByDepartment } from '@/utils/enterpriseScope'
import { isEnterpriseRootDepartment, isUnassignedDepartment } from '@/constants/department'
import type { Task } from '@/types'

const store = useAppStore()
const activeTab = ref<'pending' | 'all'>('pending')
const detailVisible = ref(false)
const publishVisible = ref(false)
const currentTask = ref<Task | null>(null)
const reviewNote = ref('')

function createEmptyForm(enterpriseId = ''): TaskPublishFormModel {
  return {
    enterpriseId,
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
    settlementUnitPrice: 50,
    trainingCourseId: '',
    plannedTotal: 100,
    unlimitedQuantity: false,
    longTerm: false,
    dateRange: ['2026-07-26', '2026-08-26'],
    maxPerPerson: 5,
  }
}

const reviewForm = ref<TaskPublishFormModel>(createEmptyForm())
const publishForm = ref<TaskPublishFormModel>(createEmptyForm())

const enterpriseOptions = computed(() =>
  store.enterprises
    .filter((e) => e.status === 'active' && !e.tenantDisabled)
    .map((e) => ({ label: e.name, value: e.id })),
)

function departmentsOfEnterprise(enterpriseId: string) {
  if (!enterpriseId) return []
  return store.departments.filter((d) => {
    if (isEnterpriseRootDepartment(d) || isUnassignedDepartment(d.id)) return false
    return resolveEnterpriseIdByDepartment(d.id, store.departments) === enterpriseId
  })
}

function workflowOptionsOf(enterpriseId: string) {
  if (!enterpriseId) return []
  return store.enabledWorkflows
    .filter(
      (w) => w.enterpriseScope === 'all' || (w.enterpriseIds ?? []).includes(enterpriseId),
    )
    .map((w) => ({
      label: `${w.name}（${workflowStatusMap[w.status]}）`,
      value: w.id,
    }))
}

function providerOptionsOf(enterpriseId: string) {
  if (!enterpriseId) return []
  const providers = store.serviceProviders.filter((p) => p.status === 'cooperating')
  const byLink = providers.filter(
    (p) =>
      p.linkedEnterpriseIds?.includes(enterpriseId) ||
      store.serviceContracts.some(
        (c) => c.enterpriseId === enterpriseId && c.providerId === p.id,
      ),
  )
  const list = byLink.length ? byLink : providers
  return list.map((p) => ({ label: p.name, value: p.id }))
}

const reviewDepartmentOptions = computed(() =>
  departmentsOfEnterprise(currentTask.value?.enterpriseId ?? ''),
)
const reviewWorkflowOptions = computed(() =>
  workflowOptionsOf(currentTask.value?.enterpriseId ?? ''),
)
const reviewProviderOptions = computed(() =>
  providerOptionsOf(currentTask.value?.enterpriseId ?? ''),
)

const publishDepartmentOptions = computed(() =>
  departmentsOfEnterprise(publishForm.value.enterpriseId || ''),
)
const publishWorkflowOptions = computed(() =>
  workflowOptionsOf(publishForm.value.enterpriseId || ''),
)
const publishProviderOptions = computed(() =>
  providerOptionsOf(publishForm.value.enterpriseId || ''),
)

const customerUnitPrice = computed(() => reviewForm.value.fixedPrice || 0)

const tableData = computed(() =>
  store.tasks
    .filter((t) => (activeTab.value === 'pending' ? t.status === 'pending' : true))
    .map((t) => {
      const wf = store.taskWorkflows.find((w) => w.id === t.workflowId)
      const { progress } = calcEnterpriseTaskProgress(t)
      return {
        ...t,
        workflowName: wf?.name ?? '-',
        providerLabel: t.serviceProviderName || '—',
        departmentLabel:
          t.publishScope === 'department'
            ? t.departmentName || '—'
            : '全局',
        scopeLabel:
          t.publishScope === 'department'
            ? `部门 · ${t.departmentName || '—'}`
            : taskPublishScopeMap.global,
        priceLabel: t.fixedPrice != null ? `¥${t.fixedPrice}/单` : formatTaskTypePrice({
          pricingMode: 'fixed',
          fixedPrice: t.fixedPrice,
        }),
        settlementLabel:
          t.settlementUnitPrice != null
            ? `¥${t.settlementUnitPrice}/单`
            : `¥${resolveTaskSettlementUnitPrice(t)}/单（默认）`,
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

function fillFormFromTask(row: Task): TaskPublishFormModel {
  return {
    enterpriseId: row.enterpriseId,
    serviceProviderId: row.serviceProviderId ?? '',
    publishScope: row.publishScope === 'department' ? 'department' : 'global',
    departmentIds: taskPublishDepartmentIdsFromTask(row),
    workflowId: row.workflowId,
    name: row.name,
    description: row.description,
    regionCodes: row.regionCodes?.length ? [...row.regionCodes] : [],
    addressDetail: row.addressDetail ?? '',
    metadataFields: (row.metadataFields ?? []).map((m) => ({
      key: m.key,
      label: m.label,
      type: m.type ?? 'text',
      value: m.value,
    })),
    fixedPrice: row.fixedPrice ?? 50,
    settlementUnitPrice: resolveTaskSettlementUnitPrice(row),
    trainingCourseId: row.trainingCourseId ?? '',
    plannedTotal: row.plannedTotal,
    unlimitedQuantity: row.unlimitedQuantity ?? row.plannedTotal == null,
    longTerm: row.longTerm ?? false,
    dateRange: row.longTerm ? [] : [row.startTime.slice(0, 10), row.endTime.slice(0, 10)],
    maxPerPerson: row.maxPerPerson ?? 5,
  }
}

function openReview(row: Task) {
  currentTask.value = row
  reviewForm.value = fillFormFromTask(row)
  reviewNote.value = ''
  detailVisible.value = true
}

function openPublish() {
  const firstEnt = enterpriseOptions.value[0]?.value ?? ''
  publishForm.value = createEmptyForm(firstEnt)
  if (firstEnt) onPublishEnterpriseChange(firstEnt)
  publishVisible.value = true
}

function onPublishEnterpriseChange(enterpriseId: string) {
  publishForm.value.enterpriseId = enterpriseId
  const providers = providerOptionsOf(enterpriseId)
  const workflows = workflowOptionsOf(enterpriseId)
  publishForm.value.serviceProviderId = providers[0]?.value ?? ''
  publishForm.value.workflowId = workflows[0]?.value ?? ''
  publishForm.value.departmentIds = []
  if (publishForm.value.workflowId) {
    publishForm.value.name = store.suggestTaskName(publishForm.value.workflowId)
  }
}

watch(
  () => publishForm.value.workflowId,
  (id) => {
    if (id && publishVisible.value) {
      publishForm.value.name = store.suggestTaskName(id)
    }
  },
)

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

function validateForm(form: TaskPublishFormModel, requireEnterprise = false) {
  if (requireEnterprise && !form.enterpriseId) {
    ElMessage.warning('请选择企业')
    return false
  }
  if (!form.serviceProviderId) {
    ElMessage.warning('请选择服务商')
    return false
  }
  if (!form.name.trim()) {
    ElMessage.warning('请输入任务名称')
    return false
  }
  if (!form.workflowId) {
    ElMessage.warning('请选择任务流程')
    return false
  }
  if (form.publishScope === 'department' && !form.departmentIds.length) {
    ElMessage.warning('请选择发布部门')
    return false
  }
  if (!form.description.trim()) {
    ElMessage.warning('请填写任务内容')
    return false
  }
  if (!form.regionCodes?.length || form.regionCodes.length < 3) {
    ElMessage.warning('请选择省市区')
    return false
  }
  if (!form.fixedPrice || form.fixedPrice < 1) {
    ElMessage.warning('请填写固定单价')
    return false
  }
  if (form.settlementUnitPrice != null && form.settlementUnitPrice < 0) {
    ElMessage.warning('结算价不能为负数')
    return false
  }
  if (!form.unlimitedQuantity && (!form.plannedTotal || form.plannedTotal < 1)) {
    ElMessage.warning('请填写任务数量或选择无上限')
    return false
  }
  if (!form.longTerm && (!form.dateRange?.length || form.dateRange.length < 2)) {
    ElMessage.warning('请设置任务期限或选择长期')
    return false
  }
  return true
}

function toTaskPayload(form: TaskPublishFormModel) {
  const { start, end } = buildTimeRange(form.longTerm, form.dateRange)
  const provider = store.serviceProviders.find((p) => p.id === form.serviceProviderId)
  const deptScope =
    form.publishScope === 'department'
      ? resolveTaskPublishDepartmentScope(store.departments, form.departmentIds)
      : {
          publishDepartmentIds: [] as string[],
          departmentId: undefined as string | undefined,
          departmentName: undefined as string | undefined,
          scopeDepartmentIds: undefined as string[] | undefined,
        }
  const region = formatTaskRegionLabel(form.regionCodes, form.addressDetail)
  return {
    name: form.name.trim(),
    workflowId: form.workflowId,
    serviceProviderId: form.serviceProviderId,
    serviceProviderName: provider?.name,
    publishScope: form.publishScope,
    departmentId: deptScope.departmentId,
    departmentName: deptScope.departmentName,
    publishDepartmentIds: deptScope.publishDepartmentIds.length
      ? deptScope.publishDepartmentIds
      : undefined,
    scopeDepartmentIds: deptScope.scopeDepartmentIds,
    pricingMode: 'fixed' as const,
    fixedPrice: form.fixedPrice,
    settlementUnitPrice: form.settlementUnitPrice,
    trainingCourseId: form.trainingCourseId.trim() || undefined,
    unlimitedQuantity: form.unlimitedQuantity,
    plannedTotal: form.unlimitedQuantity ? undefined : form.plannedTotal,
    longTerm: form.longTerm,
    startTime: start,
    endTime: end,
    dispatchMode: 'hall' as const,
    maxPerPerson: form.maxPerPerson,
    regionCodes: [...form.regionCodes],
    addressDetail: form.addressDetail.trim() || undefined,
    region,
    description: form.description.trim(),
    metadataFields: form.metadataFields.filter((m) => m.label.trim()),
  }
}

async function approveTask() {
  const task = currentTask.value
  if (!task) return
  if (!validateForm(reviewForm.value)) return
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
      ...toTaskPayload(reviewForm.value),
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

function saveActiveTask() {
  const task = currentTask.value
  if (!task || task.status !== 'active') return
  if (
    !reviewForm.value.unlimitedQuantity &&
    (!reviewForm.value.plannedTotal || reviewForm.value.plannedTotal < 1)
  ) {
    ElMessage.warning('请填写任务数量或选择无上限')
    return
  }
  if (
    !reviewForm.value.longTerm &&
    (!reviewForm.value.dateRange?.length || reviewForm.value.dateRange.length < 2)
  ) {
    ElMessage.warning('请设置任务期限或选择长期')
    return
  }
  const { start, end } = buildTimeRange(
    reviewForm.value.longTerm,
    reviewForm.value.dateRange,
  )
  try {
    store.updateActiveEnterpriseTask(task.id, {
      unlimitedQuantity: reviewForm.value.unlimitedQuantity,
      plannedTotal: reviewForm.value.unlimitedQuantity
        ? undefined
        : reviewForm.value.plannedTotal,
      longTerm: reviewForm.value.longTerm,
      startTime: start,
      endTime: end,
    })
    ElMessage.success('已保存')
    detailVisible.value = false
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败')
  }
}

async function submitPublish() {
  if (!validateForm(publishForm.value, true)) return
  try {
    await ElMessageBox.confirm(
      '确认提交发布？提交后进入任务审批，通过后进入任务大厅。',
      '发布确认',
    )
    const created = store.addEnterpriseTask(
      publishForm.value.enterpriseId!,
      toTaskPayload(publishForm.value),
    )
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

const reviewReadonly = computed(
  () => currentTask.value?.status !== 'pending',
)
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
      <el-table-column prop="enterpriseName" label="企业名称" min-width="140" show-overflow-tooltip />
      <el-table-column prop="providerLabel" label="服务商名称" min-width="140" show-overflow-tooltip />
      <el-table-column prop="scopeLabel" label="发布范围" min-width="120" show-overflow-tooltip />
      <el-table-column prop="name" label="任务名称" min-width="140" show-overflow-tooltip />
      <el-table-column prop="workflowName" label="任务流程" min-width="120" show-overflow-tooltip />
      <el-table-column prop="priceLabel" label="客户单价" width="100" />
      <el-table-column prop="settlementLabel" label="结算价" width="120" show-overflow-tooltip />
      <el-table-column prop="quantityLabel" label="任务数量" width="90" />
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
    size="680px"
  >
    <template v-if="currentTask">
      <el-alert
        v-if="currentTask.status === 'pending'"
        type="info"
        :closable="false"
        title="可修改任务发布内容，并配置灵工结算价后发布到任务大厅"
        style="margin-bottom: 16px"
      />
      <el-alert
        v-else-if="currentTask.status === 'active'"
        type="warning"
        :closable="false"
        title="进行中的任务仅可修改任务数量与任务期限"
        style="margin-bottom: 16px"
      />

      <el-form v-if="currentTask.status === 'active'" label-position="top">
        <el-form-item label="企业">
          <el-input :model-value="currentTask.enterpriseName" disabled />
        </el-form-item>
        <el-form-item label="服务商">
          <el-input :model-value="currentTask.serviceProviderName || '—'" disabled />
        </el-form-item>
        <TaskFormSection title="数量与期限" icon="量" icon-variant="purple">
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
        </TaskFormSection>
      </el-form>

      <el-form v-else label-position="top">
        <el-form-item label="企业">
          <el-input :model-value="currentTask.enterpriseName" disabled />
        </el-form-item>
        <TaskPublishFormBody
          v-model="reviewForm"
          :readonly="reviewReadonly"
          :show-settlement="currentTask.status === 'pending'"
          :provider-options="reviewProviderOptions"
          :department-options="reviewDepartmentOptions"
          :workflow-options="reviewWorkflowOptions"
          :customer-unit-price="customerUnitPrice"
          @sync-settlement="syncSettlementFromCustomer"
        />
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
      <div v-else-if="currentTask.status === 'active'" class="drawer-actions">
        <el-button type="primary" @click="saveActiveTask">保存修改</el-button>
      </div>
    </template>
  </el-drawer>

  <el-dialog
    v-model="publishVisible"
    title="发布任务"
    width="780px"
    destroy-on-close
    class="task-form-dialog"
  >
    <el-alert
      type="info"
      :closable="false"
      title="后台发布需选择企业与服务商，字段与企业端一致，提交后进入任务审批"
      style="margin-bottom: 16px"
    />
    <el-form label-width="110px">
      <TaskPublishFormBody
        v-model="publishForm"
        show-enterprise
        :enterprise-options="enterpriseOptions"
        :provider-options="publishProviderOptions"
        :department-options="publishDepartmentOptions"
        :workflow-options="publishWorkflowOptions"
        @update:enterprise-id="onPublishEnterpriseChange"
      />
    </el-form>
    <template #footer>
      <el-button @click="publishVisible = false">取消</el-button>
      <el-button type="primary" @click="submitPublish">提交审批</el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.drawer-actions {
  display: flex;
  gap: 12px;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--el-border-color-lighter);
}
</style>
