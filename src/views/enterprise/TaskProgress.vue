<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { useEnterpriseInstanceAction } from '@/composables/useEnterpriseInstanceAction'
import {
  calcEnterpriseTaskProgress,
  getEnterpriseActionUiMeta,
  getInstanceEnterpriseActions,
  getWorkflowFieldsForNode,
  instanceWorkflowStatusMap,
  isInstanceAtEnterpriseNode,
  resolveInstanceWorkflowStatus,
} from '@/services/task'
import type { TaskInstance, WorkflowActionConfig } from '@/types'

const store = useAppStore()
const route = useRoute()
const router = useRouter()
const { runEnterpriseAction } = useEnterpriseInstanceAction()
const taskFilter = ref('')
const workerIdFilter = ref('')
const instanceStatusFilter = ref<'all' | 'running' | 'completed' | 'cancelled' | 'pending_enterprise'>(
  'all',
)

onMounted(() => {
  if (typeof route.query.worker === 'string') workerIdFilter.value = route.query.worker
})

const enterpriseId = computed(() => store.currentEnterpriseId)

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
    workflow,
    workflowStatus,
    statusLabel: statusMeta.label,
    statusType: statusMeta.type,
    pendingEnterprise,
    enterpriseActions,
    hasEnterpriseFields,
    updatedLabel: new Date(i.updatedAt).toLocaleString('zh-CN'),
  }
}

const summary = computed(() => {
  const tasks = store.tasks.filter((t) => t.enterpriseId === enterpriseId.value)
  const active = tasks.filter((t) => t.status === 'active')
  const instances = store.taskInstances.filter((i) => i.enterpriseId === enterpriseId.value)
  const enriched = instances.map((i) => enrichInstance(i))
  const instanceStatuses = enriched.map((i) => i.workflowStatus)
  return {
    total: tasks.length,
    active: active.length,
    accepted: active.reduce((s, t) => s + t.acceptedCount, 0),
    completed: active.reduce((s, t) => s + t.completedCount, 0),
    pendingEnterprise: enriched.filter((i) => i.pendingEnterprise).length,
    instanceCompleted: instanceStatuses.filter((s) => s === 'completed').length,
    instanceCancelled: instanceStatuses.filter((s) => s === 'cancelled').length,
    avgCompletionRate:
      active.length > 0
        ? Math.round(
            active.reduce((s, t) => s + calcEnterpriseTaskProgress(t).completionRate, 0) /
              active.length,
          )
        : 0,
  }
})

const detailData = computed(() =>
  store.taskInstances
    .filter((i) => i.enterpriseId === enterpriseId.value)
    .filter((i) => !workerIdFilter.value || i.workerId === workerIdFilter.value)
    .filter((i) => !taskFilter.value || i.taskId === taskFilter.value)
    .map(enrichInstance)
    .filter((i) => {
      if (instanceStatusFilter.value === 'all') return true
      if (instanceStatusFilter.value === 'pending_enterprise') return i.pendingEnterprise
      return i.workflowStatus === instanceStatusFilter.value
    }),
)

const taskFilterOptions = computed(() =>
  store.tasks
    .filter((t) => t.enterpriseId === enterpriseId.value)
    .map((t) => ({ label: t.name, value: t.id })),
)

const workerFilterName = computed(() =>
  workerIdFilter.value
    ? store.employees.find((e) => e.id === workerIdFilter.value)?.name ?? ''
    : '',
)

function openInstanceDetail(row: TaskInstance) {
  router.push(`/enterprise/task/instances/${row.id}`)
}

function handleEnterpriseAction(
  row: TaskInstance & { hasEnterpriseFields?: boolean },
  config: WorkflowActionConfig,
) {
  if (row.hasEnterpriseFields) {
    openInstanceDetail(row)
    return
  }
  runEnterpriseAction(row.id, config)
}
</script>

<template>
  <div class="stats-row">
    <div class="stat-card">
      <div class="stat-value">{{ summary.total }}</div>
      <div class="stat-label">任务总数</div>
    </div>
    <div class="stat-card green">
      <div class="stat-value">{{ summary.active }}</div>
      <div class="stat-label">进行中</div>
    </div>
    <div class="stat-card blue">
      <div class="stat-value">{{ summary.accepted }}</div>
      <div class="stat-label">总接单数</div>
    </div>
    <div class="stat-card orange">
      <div class="stat-value">{{ summary.completed }}</div>
      <div class="stat-label">已完成量</div>
    </div>
    <div class="stat-card red">
      <div class="stat-value">{{ summary.pendingEnterprise }}</div>
      <div class="stat-label">待企业处理</div>
    </div>
    <div class="stat-card purple">
      <div class="stat-value">{{ summary.avgCompletionRate }}%</div>
      <div class="stat-label">平均完成率</div>
    </div>
  </div>

  <div class="page-card">
    <div class="page-header">
      <div>
        <h2 class="page-title">任务进度</h2>
        <p class="text-muted">
          按任务流节点跟踪认领明细；流程到达企业操作节点时可审核、驳回或结束任务
        </p>
      </div>
    </div>

    <div class="detail-toolbar">
      <el-tag v-if="workerFilterName" closable @close="workerIdFilter = ''">
        灵工：{{ workerFilterName }}
      </el-tag>
      <el-select
        v-model="taskFilter"
        placeholder="全部任务"
        clearable
        filterable
        style="width: 260px"
      >
        <el-option
          v-for="opt in taskFilterOptions"
          :key="opt.value"
          :label="opt.label"
          :value="opt.value"
        />
      </el-select>
      <el-radio-group v-model="instanceStatusFilter" size="small">
        <el-radio-button value="all">全部</el-radio-button>
        <el-radio-button value="pending_enterprise">待企业处理</el-radio-button>
        <el-radio-button value="running">执行中</el-radio-button>
        <el-radio-button value="completed">已完成</el-radio-button>
        <el-radio-button value="cancelled">已结束</el-radio-button>
      </el-radio-group>
      <span class="text-muted">共 {{ detailData.length }} 条认领记录</span>
    </div>

    <el-table :data="detailData" border stripe>
      <el-table-column prop="taskName" label="任务名称" min-width="160" />
      <el-table-column prop="taskTypeName" label="类型" width="120" />
      <el-table-column prop="workerName" label="灵工" width="100" />
      <el-table-column label="执行状态" width="100">
        <template #default="{ row }">
          <el-tag size="small" :type="row.statusType">{{ row.statusLabel }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="currentNodeName" label="当前节点" width="110">
        <template #default="{ row }">
          <el-tag size="small" :type="row.pendingEnterprise ? 'danger' : undefined">
            {{ row.currentNodeName }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="认领数量" width="90" align="center">
        <template #default="{ row }">{{ row.claimQuantity }}</template>
      </el-table-column>
      <el-table-column label="金额" width="90">
        <template #default="{ row }">¥{{ row.amount }}</template>
      </el-table-column>
      <el-table-column prop="updatedLabel" label="更新时间" min-width="160" />
      <el-table-column label="操作" min-width="240" fixed="right">
        <template #default="{ row }">
          <template v-if="row.pendingEnterprise">
            <el-button
              v-for="item in row.enterpriseActions"
              :key="item.config.action"
              link
              :type="item.meta.buttonType"
              @click="handleEnterpriseAction(row, item.config)"
            >
              {{ item.meta.label }}
            </el-button>
          </template>
          <el-button link type="primary" @click="openInstanceDetail(row)">详情</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<style scoped>
.stats-row {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}

.stat-card {
  background: linear-gradient(135deg, #1890ff 0%, #096dd9 100%);
  color: #fff;
  border-radius: 8px;
  padding: 16px 20px;
}

.stat-card.green {
  background: linear-gradient(135deg, #52c41a 0%, #389e0d 100%);
}

.stat-card.blue {
  background: linear-gradient(135deg, #13c2c2 0%, #08979c 100%);
}

.stat-card.orange {
  background: linear-gradient(135deg, #fa8c16 0%, #d46b08 100%);
}

.stat-card.red {
  background: linear-gradient(135deg, #f5222d 0%, #cf1322 100%);
}

.stat-card.purple {
  background: linear-gradient(135deg, #722ed1 0%, #531dab 100%);
}

.stat-value {
  font-size: 24px;
  font-weight: 700;
}

.stat-label {
  font-size: 13px;
  opacity: 0.9;
  margin-top: 4px;
}

.detail-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

@media (max-width: 1200px) {
  .stats-row {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
