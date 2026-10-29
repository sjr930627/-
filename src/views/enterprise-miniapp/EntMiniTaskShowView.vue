<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import EntMiniNavBar from '@/components/enterprise-miniapp/EntMiniNavBar.vue'
import TaskFormSection from '@/components/task/TaskFormSection.vue'
import TaskPublishFormBody, {
  type TaskPublishFormModel,
} from '@/components/task/TaskPublishFormBody.vue'
import { useAppStore } from '@/stores/app'
import { useEnterpriseMiniAuth } from '@/composables/useEnterpriseMiniAuth'
import {
  formatTaskQuantity,
  resolveTaskPricing,
  taskPublishDepartmentIdsFromTask,
  workflowStatusMap,
} from '@/constants/task'
import { formatTaskClaimableQuantity } from '@/services/task'
import { resolveEnterpriseIdByDepartment } from '@/utils/enterpriseScope'
import { isEnterpriseRootDepartment, isUnassignedDepartment } from '@/constants/department'
import type { Task } from '@/types'

const route = useRoute()
const router = useRouter()
const store = useAppStore()
const { enterpriseId } = useEnterpriseMiniAuth()

const taskId = computed(() => String(route.params.taskId ?? ''))

const task = computed(() => store.tasks.find((t) => t.id === taskId.value))

const workflow = computed(() =>
  task.value ? store.taskWorkflows.find((w) => w.id === task.value!.workflowId) : undefined,
)

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
    dateRange: [],
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
  const options = list.map((p) => ({ label: p.name, value: p.id }))
  const currentId = task.value?.serviceProviderId
  if (currentId && !options.some((o) => o.value === currentId)) {
    options.unshift({
      label: task.value?.serviceProviderName || currentId,
      value: currentId,
    })
  }
  return options
})

const workflowOptions = computed(() => {
  const options = store.enabledWorkflows
    .filter(
      (w) =>
        w.enterpriseScope === 'all' ||
        (w.enterpriseIds ?? []).includes(enterpriseId.value),
    )
    .map((w) => ({
      label: `${w.name}（${workflowStatusMap[w.status]}）`,
      value: w.id,
    }))
  const currentId = task.value?.workflowId
  if (currentId && !options.some((o) => o.value === currentId)) {
    const wf = store.taskWorkflows.find((w) => w.id === currentId)
    options.unshift({
      label: wf ? `${wf.name}（${workflowStatusMap[wf.status]}）` : currentId,
      value: currentId,
    })
  }
  return options
})

const claimableLabel = computed(() => {
  if (!task.value) return undefined
  return formatTaskClaimableQuantity(task.value, store.taskInstances, workflow.value)
})

const totalQuantityLabel = computed(() => {
  if (!task.value) return '—'
  return formatTaskQuantity(task.value.unlimitedQuantity, task.value.plannedTotal)
})

function formatCountLabel(value: string | number | undefined) {
  if (value == null || value === '' || value === '—') return '—'
  return `${value} 单`
}

function fillForm(row: Task) {
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

watch(task, (row) => {
  if (row) fillForm(row)
}, { immediate: true })

function assertAccessible() {
  const t = task.value
  if (!t) {
    ElMessage.warning('任务不存在')
    router.replace('/enterprise-miniapp/tasks')
    return false
  }
  if (t.enterpriseId !== enterpriseId.value) {
    ElMessage.warning('无权访问该任务')
    router.replace('/enterprise-miniapp/tasks')
    return false
  }
  return true
}

onMounted(assertAccessible)
watch(taskId, assertAccessible)

function viewInstances() {
  router.push({
    path: '/enterprise-miniapp/tasks',
    query: { tab: 'detail', taskId: taskId.value },
  })
}
</script>

<template>
  <div v-if="task" class="show-page">
    <EntMiniNavBar title="任务详情" back-to="/enterprise-miniapp/tasks" />

    <div class="show-body">
      <el-form label-position="top" class="detail-form">
        <TaskPublishFormBody
          v-model="form"
          readonly
          :require-location="false"
          :provider-options="providerOptions"
          :department-options="departmentOptions"
          :workflow-options="workflowOptions"
          :claimable-label="claimableLabel"
        />
        <TaskFormSection class="task-totals" title="任务总计" icon="计" icon-variant="blue">
          <div class="totals">
            <div>
              <strong>{{ totalQuantityLabel }}</strong>
              <span>任务总计</span>
            </div>
            <div>
              <strong>{{ formatCountLabel(task.acceptedCount) }}</strong>
              <span>已接单</span>
            </div>
            <div>
              <strong>{{ formatCountLabel(task.completedCount) }}</strong>
              <span>已完成</span>
            </div>
            <div>
              <strong>{{ formatCountLabel(claimableLabel) }}</strong>
              <span>可领数量</span>
            </div>
          </div>
        </TaskFormSection>
      </el-form>
    </div>

    <footer class="show-footer">
      <button type="button" class="primary" @click="viewInstances">查看任务明细</button>
    </footer>
  </div>
</template>

<style scoped>
.show-page {
  min-height: 100%;
  padding-bottom: calc(72px + env(safe-area-inset-bottom, 0px));
  background: #f3f4f6;
}

.show-body {
  padding: 12px;
}

.detail-form :deep(.el-form-item) {
  margin-bottom: 12px;
}

.detail-form :deep(.el-form-item__label) {
  margin-bottom: 4px;
  line-height: 1.4;
}

.detail-form :deep(.task-form-section) {
  background: #fff;
}

.task-totals {
  margin-top: 14px;
}

.totals {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.totals div {
  background: #f8fafc;
  border-radius: 10px;
  padding: 12px 8px;
  text-align: center;
}

.totals strong {
  display: block;
  font-size: 18px;
  font-weight: 700;
  color: #111827;
}

.totals span {
  display: block;
  margin-top: 4px;
  font-size: 12px;
  color: #6b7280;
}

.detail-form :deep(.metadata-row) {
  align-items: stretch;
}

.detail-form :deep(.metadata-row .el-input),
.detail-form :deep(.metadata-row .el-select),
.detail-form :deep(.metadata-row .el-date-editor) {
  flex: 1 1 140px;
  width: auto !important;
  min-width: 0;
}

.show-footer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 20;
  max-width: 430px;
  margin: 0 auto;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px));
  border-top: 1px solid #e5e7eb;
  background: #fff;
  box-shadow: 0 -4px 20px rgba(15, 23, 42, 0.06);
}

.show-footer .primary {
  width: 100%;
  height: 44px;
  border: none;
  border-radius: 10px;
  background: #228BFF;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}
</style>
