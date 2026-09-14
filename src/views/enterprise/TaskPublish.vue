<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import TaskPublishFormBody, {
  type TaskPublishFormModel,
} from '@/components/task/TaskPublishFormBody.vue'
import {
  formatTaskQuantity,
  formatTaskRegionLabel,
  formatTaskTypePrice,
  resolveTaskPricing,
  resolveTaskPublishDepartmentScope,
  taskPublishDepartmentIdsFromTask,
  taskPublishScopeMap,
  taskPublishStatusMap,
  workflowStatusMap,
} from '@/constants/task'
import { canManuallyEndTask, formatTaskClaimableQuantity } from '@/services/task'
import type { Task } from '@/types'
import { resolveEnterpriseIdByDepartment } from '@/utils/enterpriseScope'
import { isEnterpriseRootDepartment, isUnassignedDepartment } from '@/constants/department'

const store = useAppStore()
const dialogVisible = ref(false)
const formMode = ref<'create' | 'edit' | 'view'>('create')
const editingId = ref<string | null>(null)
const statusFilter = ref<'all' | 'pending' | 'active' | 'ended' | 'completed' | 'rejected'>('pending')
const providerKeyword = ref('')
const nameKeyword = ref('')

onMounted(() => {
  store.syncTaskLifecycleStatuses()
})

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

const enterpriseId = computed(() => store.currentEnterpriseId)
const formReadonly = computed(() => formMode.value === 'view')

const departmentOptions = computed(() =>
  store.departments.filter((d) => {
    if (isEnterpriseRootDepartment(d) || isUnassignedDepartment(d.id)) return false
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

const providerOptions = computed(() => {
  const providers = store.serviceProviders.filter((p) => p.status === 'cooperating')
  const byLink = providers.filter(
    (p) =>
      p.linkedEnterpriseIds?.includes(enterpriseId.value) ||
      store.serviceContracts.some(
        (c) => c.enterpriseId === enterpriseId.value && c.providerId === p.id,
      ),
  )
  const list = byLink.length ? byLink : providers
  return list.map((p) => ({ label: p.name, value: p.id }))
})

const enterpriseTasks = computed(() =>
  store.tasks.filter((t) => t.enterpriseId === enterpriseId.value),
)

const statusCounts = computed(() => ({
  pending: enterpriseTasks.value.filter((t) => t.status === 'pending').length,
  active: enterpriseTasks.value.filter((t) => t.status === 'active').length,
  ended: enterpriseTasks.value.filter((t) => t.status === 'ended').length,
  completed: enterpriseTasks.value.filter((t) => t.status === 'completed').length,
  rejected: enterpriseTasks.value.filter((t) => t.status === 'rejected').length,
}))

const tableData = computed(() =>
  enterpriseTasks.value
    .filter((t) => {
      if (statusFilter.value !== 'all' && t.status !== statusFilter.value) return false
      const providerKw = providerKeyword.value.trim()
      if (providerKw && !(t.serviceProviderName ?? '').includes(providerKw)) return false
      const nameKw = nameKeyword.value.trim()
      if (nameKw && !(t.name ?? '').includes(nameKw)) return false
      return true
    })
    .map((t) => {
      const wf = store.taskWorkflows.find((w) => w.id === t.workflowId)
      const pricing = resolveTaskPricing(t, store.taskTypes)
      return {
        ...t,
        workflowName: wf?.name ?? t.taskTypeName,
        providerLabel: t.serviceProviderName || '—',
        scopeLabel:
          t.publishScope === 'department'
            ? `部门 · ${t.departmentName || '—'}`
            : taskPublishScopeMap.global,
        priceLabel: pricing ? formatTaskTypePrice({ ...pricing, pricingMode: 'fixed' }) : '-',
        statusLabel: taskPublishStatusMap[t.status],
        quantityLabel: formatTaskQuantity(t.unlimitedQuantity, t.plannedTotal),
        claimableLabel: formatTaskClaimableQuantity(
          t,
          store.taskInstances,
          store.taskWorkflows.find((w) => w.id === t.workflowId),
        ),
        periodLabel: t.longTerm
          ? '长期'
          : `${t.startTime.slice(0, 10)} ~ ${t.endTime.slice(0, 10)}`,
        regionLabel: formatTaskRegionLabel(t.regionCodes, t.addressDetail) || t.region || '—',
      }
    }),
)

const dialogTitle = computed(() => {
  if (formMode.value === 'view') return '任务详情'
  if (formMode.value === 'edit') return '编辑任务'
  return '创建任务'
})

const detailClaimableLabel = computed(() => {
  if (!editingId.value) return undefined
  const task = store.tasks.find((t) => t.id === editingId.value)
  if (!task) return undefined
  return formatTaskClaimableQuantity(
    task,
    store.taskInstances,
    store.taskWorkflows.find((w) => w.id === task.workflowId),
  )
})

function resetForm() {
  const workflowId = workflowOptions.value[0]?.value ?? ''
  form.value = {
    ...createEmptyForm(),
    workflowId,
    name: workflowId ? store.suggestTaskName(workflowId) : '',
    serviceProviderId: providerOptions.value[0]?.value ?? '',
  }
}

function fillFormFromTask(row: Task) {
  const pricing = resolveTaskPricing(row, store.taskTypes)
  form.value = {
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
    fixedPrice: pricing?.fixedPrice ?? row.fixedPrice ?? 50,
    plannedTotal: row.plannedTotal,
    unlimitedQuantity: row.unlimitedQuantity ?? row.plannedTotal == null,
    longTerm: row.longTerm ?? false,
    dateRange: row.longTerm ? [] : [row.startTime.slice(0, 10), row.endTime.slice(0, 10)],
    maxPerPerson: row.maxPerPerson ?? 5,
  }
}

watch(
  () => form.value.workflowId,
  (id) => {
    if (id && formMode.value === 'create') {
      form.value.name = store.suggestTaskName(id)
    }
  },
)

function openCreate() {
  if (!workflowOptions.value.length) {
    ElMessage.warning('暂无可用任务流程，请联系平台配置')
    return
  }
  if (!providerOptions.value.length) {
    ElMessage.warning('暂无合作服务商，请先配置服务商合作')
    return
  }
  formMode.value = 'create'
  editingId.value = null
  resetForm()
  dialogVisible.value = true
}

function openEdit(row: Task) {
  if (row.status !== 'draft' && row.status !== 'rejected') {
    ElMessage.warning('仅未发布或已驳回任务可编辑')
    return
  }
  formMode.value = 'edit'
  editingId.value = row.id
  fillFormFromTask(row)
  dialogVisible.value = true
}

function openDetail(row: Task) {
  formMode.value = 'view'
  editingId.value = row.id
  fillFormFromTask(row)
  dialogVisible.value = true
}

function validate() {
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

async function saveAndPublish() {
  if (!validate()) return
  try {
    let id = editingId.value
    const payload = buildPayload()
    if (id) {
      store.updateEnterpriseTask(id, payload)
    } else {
      const created = store.addEnterpriseTask(enterpriseId.value, payload)
      id = created.id
    }
    await ElMessageBox.confirm(
      '确认提交发布？提交后将由平台审核，通过后进入任务大厅。',
      '发布确认',
    )
    store.publishEnterpriseTask(id!)
    ElMessage.success('已提交审核')
    dialogVisible.value = false
  } catch (e) {
    if (e !== 'cancel' && e instanceof Error) ElMessage.error(e.message)
  }
}

async function publishRow(row: Task) {
  try {
    await ElMessageBox.confirm(
      `确认提交任务「${row.name}」审核？通过后将进入任务大厅。`,
      '发布确认',
    )
    store.publishEnterpriseTask(row.id)
    ElMessage.success('已提交审核')
  } catch {
    // cancelled
  }
}

async function endRow(row: Task) {
  if (!canManuallyEndTask(row)) {
    ElMessage.warning('任务已过结束期限且数量已完成，将自动变为已完成')
    store.syncTaskLifecycleStatuses()
    return
  }
  try {
    await ElMessageBox.confirm(
      `确定结束任务「${row.name}」？结束后状态为已结束，进行中的子任务将同步结束。`,
      '结束任务',
      { type: 'warning' },
    )
    store.endTask(row.id)
    ElMessage.success('任务已结束')
  } catch (e) {
    if (e === 'cancel' || e === 'close') return
    if (e instanceof Error) ElMessage.error(e.message)
  }
}

</script>

<template>
  <div class="page-card">
    <div class="page-header">
      <div>
        <h2 class="page-title">任务发布</h2>
        <p class="text-muted">
          选择服务商与发布范围 · 可配置任务元数据 · 提交后由平台审核
        </p>
      </div>
      <el-button type="primary" @click="openCreate">创建任务</el-button>
    </div>

    <div class="toolbar">
      <el-input
        v-model="providerKeyword"
        placeholder="服务商模糊查询"
        clearable
        style="width: 220px"
      />
      <el-input
        v-model="nameKeyword"
        placeholder="任务名称模糊查询"
        clearable
        style="width: 200px"
      />
      <el-radio-group v-model="statusFilter">
        <el-radio-button value="all">全部</el-radio-button>
        <el-radio-button value="pending">
          待审批 ({{ statusCounts.pending }})
        </el-radio-button>
        <el-radio-button value="active">
          进行中 ({{ statusCounts.active }})
        </el-radio-button>
        <el-radio-button value="ended">
          已结束 ({{ statusCounts.ended }})
        </el-radio-button>
        <el-radio-button value="completed">
          已完成 ({{ statusCounts.completed }})
        </el-radio-button>
        <el-radio-button value="rejected">
          已驳回 ({{ statusCounts.rejected }})
        </el-radio-button>
      </el-radio-group>
    </div>

    <el-table :data="tableData" border stripe>
      <el-table-column prop="name" label="任务名称" min-width="160" />
      <el-table-column prop="providerLabel" label="服务商" min-width="140" show-overflow-tooltip />
      <el-table-column prop="scopeLabel" label="发布范围" min-width="130" show-overflow-tooltip />
      <el-table-column prop="workflowName" label="任务流程" min-width="140" />
      <el-table-column prop="priceLabel" label="单价" width="100" />
      <el-table-column prop="quantityLabel" label="任务数量" width="100" />
      <el-table-column prop="claimableLabel" label="可领任务数" width="100" />
      <el-table-column prop="regionLabel" label="地点" min-width="140" show-overflow-tooltip />
      <el-table-column label="任务期限" min-width="180">
        <template #default="{ row }">{{ row.periodLabel }}</template>
      </el-table-column>
      <el-table-column label="进度" min-width="140">
        <template #default="{ row }">
          接单 {{ row.acceptedCount }} · 完成 {{ row.completedCount }}
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag
            size="small"
            :type="
              row.status === 'active' || row.status === 'completed'
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
      <el-table-column label="操作" width="220" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDetail(row)">详情</el-button>
          <template v-if="row.status === 'draft' || row.status === 'rejected'">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button link type="success" @click="publishRow(row)">提交审核</el-button>
          </template>
          <template v-if="row.status === 'pending'">
            <span class="text-muted">待平台审核</span>
          </template>
          <template v-if="row.status === 'active'">
            <el-button
              v-if="canManuallyEndTask(row)"
              link
              type="warning"
              @click="endRow(row)"
            >
              结束
            </el-button>
          </template>
          <span v-if="row.status === 'rejected' && row.reviewNote" class="text-muted reject-note">
            {{ row.reviewNote }}
          </span>
        </template>
      </el-table-column>
    </el-table>
  </div>

  <el-dialog
    v-model="dialogVisible"
    :title="dialogTitle"
    width="780px"
    destroy-on-close
    class="task-form-dialog"
  >
    <el-form label-width="110px" :disabled="formReadonly">
      <TaskPublishFormBody
        v-model="form"
        :readonly="formReadonly"
        :require-location="false"
        :provider-options="providerOptions"
        :department-options="departmentOptions"
        :workflow-options="workflowOptions"
        :claimable-label="detailClaimableLabel"
      />
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">{{ formReadonly ? '关闭' : '取消' }}</el-button>
      <template v-if="!formReadonly">
        <el-button type="primary" @click="saveAndPublish">提交审核</el-button>
      </template>
    </template>
  </el-dialog>
</template>

<style scoped>
.toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-bottom: 16px;
  align-items: center;
}

.reject-note {
  display: block;
  font-size: 12px;
  margin-top: 4px;
}
</style>
