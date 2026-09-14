<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import {
  instanceWorkflowStatusMap,
  resolveInstanceWorkflowStatus,
} from '@/services/task'
import type { TaskInstance } from '@/types'

const store = useAppStore()
const route = useRoute()
const router = useRouter()

const keyword = ref('')
const workerIdFilter = ref('')
const enterpriseFilter = ref('')
const taskFilter = ref('')
const instanceStatusFilter = ref<'all' | 'running' | 'completed' | 'cancelled'>('all')

onMounted(() => {
  if (typeof route.query.worker === 'string') workerIdFilter.value = route.query.worker
  if (typeof route.query.keyword === 'string') keyword.value = route.query.keyword
})

const enterpriseOptions = computed(() =>
  [...new Set(store.tasks.map((t) => t.enterpriseName))].map((name) => ({
    label: name,
    value: name,
  })),
)

function enrichInstance(i: TaskInstance) {
  const task = store.tasks.find((t) => t.id === i.taskId)
  const workflow = task ? store.taskWorkflows.find((w) => w.id === task.workflowId) : undefined
  const workflowStatus = resolveInstanceWorkflowStatus(i, workflow)
  const statusMeta = instanceWorkflowStatusMap[workflowStatus]
  const worker = store.employees.find((e) => e.id === i.workerId)
  return {
    ...i,
    taskNo: task?.taskNo || '—',
    providerLabel: task?.serviceProviderName || '—',
    workflowName: workflow?.name ?? '—',
    phone: worker?.phone || '—',
    workflowStatus,
    statusLabel: statusMeta.label,
    statusType: statusMeta.type,
    updatedLabel: new Date(i.updatedAt).toLocaleString('zh-CN'),
  }
}

function matchesBaseFilters(i: TaskInstance) {
  if (workerIdFilter.value && i.workerId !== workerIdFilter.value) return false
  if (taskFilter.value && i.taskId !== taskFilter.value) return false
  if (enterpriseFilter.value && i.enterpriseName !== enterpriseFilter.value) return false
  if (!keyword.value.trim()) return true
  const kw = keyword.value.trim()
  const task = store.tasks.find((t) => t.id === i.taskId)
  const workflowName =
    store.taskWorkflows.find((w) => w.id === task?.workflowId)?.name ?? ''
  return (
    i.taskName.includes(kw) ||
    (task?.taskNo ?? '').includes(kw) ||
    (task?.serviceProviderName ?? '').includes(kw) ||
    workflowName.includes(kw) ||
    i.enterpriseName.includes(kw) ||
    i.workerName.includes(kw) ||
    (store.employees.find((e) => e.id === i.workerId)?.phone ?? '').includes(kw)
  )
}

function matchesStatusFilter(
  status: ReturnType<typeof resolveInstanceWorkflowStatus>,
  filter: typeof instanceStatusFilter.value,
) {
  if (filter === 'all') return true
  if (filter === 'cancelled') return status === 'cancelled' || status === 'ended'
  return status === filter
}

const filteredInstances = computed(() =>
  store.taskInstances.filter(matchesBaseFilters).map(enrichInstance),
)

const summary = computed(() => {
  const list =
    instanceStatusFilter.value === 'all'
      ? filteredInstances.value
      : filteredInstances.value.filter((i) =>
          matchesStatusFilter(i.workflowStatus, instanceStatusFilter.value),
        )
  const pool = filteredInstances.value
  const running = pool.filter((i) => i.workflowStatus === 'running').length
  const completed = pool.filter((i) => i.workflowStatus === 'completed').length
  const cancelled = pool.filter(
    (i) => i.workflowStatus === 'cancelled' || i.workflowStatus === 'ended',
  ).length
  const accepted = running + completed + cancelled
  return {
    total: list.length,
    running,
    accepted,
    completed,
    avgCompletionRate: accepted > 0 ? Math.round((completed / accepted) * 100) : 0,
  }
})

const detailData = computed(() =>
  filteredInstances.value.filter((i) =>
    matchesStatusFilter(i.workflowStatus, instanceStatusFilter.value),
  ),
)

const workerFilterName = computed(() =>
  workerIdFilter.value
    ? store.employees.find((e) => e.id === workerIdFilter.value)?.name ?? ''
    : '',
)

const taskFilterOptions = computed(() =>
  store.tasks.map((t) => ({ label: `${t.enterpriseName} · ${t.name}`, value: t.id })),
)

function openInstanceDetail(row: TaskInstance) {
  router.push(`/task-instances/${row.id}`)
}
</script>

<template>
  <div class="stats-row">
    <div class="stat-card">
      <div class="stat-value">{{ summary.total }}</div>
      <div class="stat-label">任务总数</div>
    </div>
    <div class="stat-card green">
      <div class="stat-value">{{ summary.running }}</div>
      <div class="stat-label">执行中</div>
    </div>
    <div class="stat-card blue">
      <div class="stat-value">{{ summary.accepted }}</div>
      <div class="stat-label">总接单数</div>
    </div>
    <div class="stat-card orange">
      <div class="stat-value">{{ summary.completed }}</div>
      <div class="stat-label">已完成量</div>
    </div>
    <div class="stat-card purple">
      <div class="stat-value">{{ summary.avgCompletionRate }}%</div>
      <div class="stat-label">平均完成率</div>
    </div>
  </div>

  <div class="page-card">
    <div class="page-header">
      <div>
        <h2 class="page-title">任务管理</h2>
        <p class="text-muted">查看各企业任务认领明细与执行状态</p>
      </div>
    </div>

    <div class="toolbar">
      <el-input
        v-model="keyword"
        placeholder="搜索任务ID/名称/服务商/企业/灵工/手机号"
        clearable
        style="width: 240px"
      />
      <el-tag v-if="workerFilterName" closable @close="workerIdFilter = ''">
        灵工：{{ workerFilterName }}
      </el-tag>
      <el-select v-model="enterpriseFilter" placeholder="企业筛选" clearable style="width: 200px">
        <el-option
          v-for="opt in enterpriseOptions"
          :key="opt.value"
          :label="opt.label"
          :value="opt.value"
        />
      </el-select>
      <el-select
        v-model="taskFilter"
        placeholder="全部任务"
        clearable
        filterable
        style="width: 280px"
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
        <el-radio-button value="running">执行中</el-radio-button>
        <el-radio-button value="completed">已完成</el-radio-button>
        <el-radio-button value="cancelled">已结束</el-radio-button>
      </el-radio-group>
      <span class="text-muted">共 {{ detailData.length }} 条认领记录</span>
    </div>

    <el-table :data="detailData" border stripe>
      <el-table-column prop="taskNo" label="任务ID" width="130" show-overflow-tooltip />
      <el-table-column prop="enterpriseName" label="企业" min-width="140" />
      <el-table-column prop="providerLabel" label="服务商" min-width="140" show-overflow-tooltip />
      <el-table-column prop="taskName" label="任务名称" min-width="160" />
      <el-table-column prop="workflowName" label="任务流程" width="120" />
      <el-table-column prop="workerName" label="灵工" width="100" />
      <el-table-column prop="phone" label="手机号" width="130" />
      <el-table-column label="任务状态" width="100">
        <template #default="{ row }">
          <el-tag size="small" :type="row.statusType">{{ row.statusLabel }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column prop="currentNodeName" label="当前节点" width="110">
        <template #default="{ row }">
          <el-tag size="small">{{ row.currentNodeName }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="认领数量" width="90" align="center">
        <template #default="{ row }">{{ row.claimQuantity }}</template>
      </el-table-column>
      <el-table-column label="金额" width="90">
        <template #default="{ row }">¥{{ row.amount }}</template>
      </el-table-column>
      <el-table-column prop="updatedLabel" label="更新时间" min-width="160" />
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openInstanceDetail(row)">查看详情</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<style scoped>
.stats-row {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 16px;
  margin-bottom: 16px;
}

.stat-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border-radius: 8px;
  padding: 16px 20px;
}

.stat-card.green {
  background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
}

.stat-card.blue {
  background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
}

.stat-card.orange {
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
}

.stat-card.purple {
  background: linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%);
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

.toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
  flex-wrap: wrap;
  align-items: center;
}

@media (max-width: 1200px) {
  .stats-row {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
