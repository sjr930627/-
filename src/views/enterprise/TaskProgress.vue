<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAppStore } from '@/stores/app'
import WorkflowFlowChart from '@/components/task/WorkflowFlowChart.vue'
import { dispatchModeMap, taskPublishStatusMap } from '@/constants/task'
import { calcTaskProgress } from '@/services/task'
import type { Task } from '@/types'

const store = useAppStore()
const statusFilter = ref<'all' | Task['status']>('active')
const detailVisible = ref(false)
const currentTask = ref<Task | null>(null)

const enterpriseId = computed(() => store.currentEnterpriseId)

const summary = computed(() => {
  const tasks = store.tasks.filter((t) => t.enterpriseId === enterpriseId.value)
  const active = tasks.filter((t) => t.status === 'active')
  return {
    total: tasks.length,
    active: active.length,
    accepted: active.reduce((s, t) => s + t.acceptedCount, 0),
    approved: active.reduce((s, t) => s + t.approvedCount, 0),
    avgPassRate:
      active.length > 0
        ? Math.round(
            active.reduce((s, t) => s + calcTaskProgress(t).passRate, 0) / active.length,
          )
        : 0,
  }
})

const tableData = computed(() =>
  store.tasks
    .filter((t) => t.enterpriseId === enterpriseId.value)
    .filter((t) => statusFilter.value === 'all' || t.status === statusFilter.value)
    .map((t) => {
      const { progress, passRate } = calcTaskProgress(t)
      return {
        ...t,
        statusLabel: taskPublishStatusMap[t.status],
        dispatchLabel: dispatchModeMap[t.dispatchMode],
        progress,
        passRate,
      }
    }),
)

const instanceList = computed(() => {
  if (!currentTask.value) return []
  return store.taskInstances
    .filter((i) => i.taskId === currentTask.value!.id)
    .map((i) => ({
      ...i,
      updatedLabel: new Date(i.updatedAt).toLocaleString('zh-CN'),
    }))
})

const currentWorkflow = computed(() => {
  if (!currentTask.value) return null
  return store.taskWorkflows.find((w) => w.id === currentTask.value!.workflowId) ?? null
})

function openDetail(row: Task) {
  currentTask.value = row
  detailVisible.value = true
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
      <div class="stat-value">{{ summary.approved }}</div>
      <div class="stat-label">已验收</div>
    </div>
    <div class="stat-card purple">
      <div class="stat-value">{{ summary.avgPassRate }}%</div>
      <div class="stat-label">平均通过率</div>
    </div>
  </div>

  <div class="page-card">
    <div class="page-header">
      <div>
        <h2 class="page-title">任务进度查看</h2>
        <p class="text-muted">查看完成数、总接单数、验收通过率等指标</p>
      </div>
      <el-radio-group v-model="statusFilter">
        <el-radio-button value="active">进行中</el-radio-button>
        <el-radio-button value="ended">已结束</el-radio-button>
        <el-radio-button value="all">全部</el-radio-button>
      </el-radio-group>
    </div>

    <el-table :data="tableData" border stripe>
      <el-table-column prop="name" label="任务名称" min-width="160" />
      <el-table-column prop="taskTypeName" label="类型" width="120" />
      <el-table-column prop="dispatchLabel" label="派单" width="100" />
      <el-table-column label="完成进度" min-width="200">
        <template #default="{ row }">
          <el-progress :percentage="row.progress" :stroke-width="10" />
          <span class="text-muted sub-text">
            验收 {{ row.approvedCount }} / 完成 {{ row.completedCount }} / 接单 {{ row.acceptedCount }}
            <template v-if="row.plannedTotal"> / 计划 {{ row.plannedTotal }}</template>
          </span>
        </template>
      </el-table-column>
      <el-table-column label="通过率" width="80" align="center">
        <template #default="{ row }">{{ row.passRate }}%</template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag size="small" :type="row.status === 'active' ? 'success' : 'info'">
            {{ row.statusLabel }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="100" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="openDetail(row)">详情</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>

  <el-drawer v-model="detailVisible" :title="currentTask?.name ?? '任务详情'" size="600px">
    <template v-if="currentTask">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="任务类型">{{ currentTask.taskTypeName }}</el-descriptions-item>
        <el-descriptions-item label="派单方式">{{ dispatchModeMap[currentTask.dispatchMode] }}</el-descriptions-item>
        <el-descriptions-item label="计划完成">{{ currentTask.plannedTotal ?? '未设置' }}</el-descriptions-item>
        <el-descriptions-item label="限领">{{ currentTask.maxPerPerson ?? '不限' }} 单/人</el-descriptions-item>
        <el-descriptions-item label="时间" :span="2">
          {{ currentTask.startTime.slice(0, 10) }} ~ {{ currentTask.endTime.slice(0, 10) }}
        </el-descriptions-item>
      </el-descriptions>

      <h4 class="section-title">工作流</h4>
      <WorkflowFlowChart v-if="currentWorkflow" :workflow="currentWorkflow" />

      <h4 class="section-title">接单明细</h4>
      <el-table :data="instanceList" border stripe size="small">
        <el-table-column prop="workerName" label="灵工" width="80" />
        <el-table-column prop="currentNodeName" label="节点" width="100">
          <template #default="{ row }">
            <el-tag size="small">{{ row.currentNodeName }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="金额" width="80">
          <template #default="{ row }">¥{{ row.amount }}</template>
        </el-table-column>
        <el-table-column prop="updatedLabel" label="更新时间" min-width="150" />
      </el-table>
    </template>
  </el-drawer>
</template>

<style scoped>
.stats-row {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
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

.sub-text {
  font-size: 12px;
  display: block;
  margin-top: 4px;
}

.section-title {
  margin: 20px 0 12px;
  font-size: 15px;
}

@media (max-width: 1200px) {
  .stats-row {
    grid-template-columns: repeat(3, 1fr);
  }
}
</style>
