<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import WorkflowFlowChart from '@/components/task/WorkflowFlowChart.vue'
import {
  dispatchModeMap,
  formatTaskQuantity,
  taskPublishStatusMap,
} from '@/constants/task'
import type { Task, TaskInstance } from '@/types'

const store = useAppStore()
const router = useRouter()

const listTab = ref<'overview' | 'detail'>('overview')
const keyword = ref('')
const statusFilter = ref<'all' | Task['status']>('all')
const enterpriseFilter = ref('')
const taskFilter = ref('')
const detailVisible = ref(false)
const chartVisible = ref(false)
const currentTask = ref<Task | null>(null)

const enterpriseOptions = computed(() =>
  [...new Set(store.tasks.map((t) => t.enterpriseName))].map((name) => ({
    label: name,
    value: name,
  })),
)

const summary = computed(() => {
  const active = store.tasks.filter((t) => t.status === 'active')
  return {
    totalTasks: store.tasks.length,
    activeTasks: active.length,
    totalInstances: store.taskInstances.length,
    pendingReview: store.taskInstances.filter((i) => i.currentNodeName.includes('待审核')).length,
    totalAmount: store.taskInstances
      .filter((i) => i.currentNodeName.includes('已完成') || i.currentNodeName.includes('已结算'))
      .reduce((sum, i) => sum + i.amount, 0),
  }
})

const overviewData = computed(() =>
  store.tasks
    .filter((t) => {
      if (statusFilter.value !== 'all' && t.status !== statusFilter.value) return false
      if (enterpriseFilter.value && t.enterpriseName !== enterpriseFilter.value) return false
      if (!keyword.value.trim()) return true
      const kw = keyword.value.trim()
      return (
        t.name.includes(kw) ||
        t.taskTypeName.includes(kw) ||
        t.enterpriseName.includes(kw)
      )
    })
    .map((t) => {
      const progress = t.plannedTotal && !t.unlimitedQuantity
        ? Math.round((t.approvedCount / t.plannedTotal) * 100)
        : t.acceptedCount > 0
          ? Math.round((t.approvedCount / t.acceptedCount) * 100)
          : 0
      const passRate =
        t.completedCount > 0 ? Math.round((t.approvedCount / t.completedCount) * 100) : 0
      const instanceCount = store.taskInstances.filter((i) => i.taskId === t.id).length
      return {
        ...t,
        statusLabel: taskPublishStatusMap[t.status],
        dispatchLabel: dispatchModeMap[t.dispatchMode],
        quantityLabel: formatTaskQuantity(t.unlimitedQuantity, t.plannedTotal),
        progress,
        passRate,
        instanceCount,
      }
    }),
)

const detailData = computed(() =>
  store.taskInstances
    .filter((i) => {
      if (taskFilter.value && i.taskId !== taskFilter.value) return false
      if (enterpriseFilter.value && i.enterpriseName !== enterpriseFilter.value) return false
      if (!keyword.value.trim()) return true
      const kw = keyword.value.trim()
      return (
        i.taskName.includes(kw) ||
        i.taskTypeName.includes(kw) ||
        i.enterpriseName.includes(kw) ||
        i.workerName.includes(kw)
      )
    })
    .map((i) => ({
      ...i,
      updatedLabel: new Date(i.updatedAt).toLocaleString('zh-CN'),
    })),
)

const taskFilterOptions = computed(() =>
  store.tasks.map((t) => ({ label: `${t.enterpriseName} · ${t.name}`, value: t.id })),
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

function openChart(row: Task) {
  currentTask.value = row
  chartVisible.value = true
}

function switchToDetail(taskId: string) {
  taskFilter.value = taskId
  listTab.value = 'detail'
}

function openInstanceDetail(row: TaskInstance) {
  router.push(`/task-instances/${row.id}`)
}

async function endTask(row: Task) {
  try {
    await ElMessageBox.confirm(`确定提前结束任务「${row.name}」？`, '提示', { type: 'warning' })
    store.endTask(row.id)
    ElMessage.success('任务已结束')
  } catch {
    // cancelled
  }
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('zh-CN')
}
</script>

<template>
  <div class="stats-row">
    <div class="stat-card">
      <div class="stat-value">{{ summary.totalTasks }}</div>
      <div class="stat-label">任务总数</div>
    </div>
    <div class="stat-card green">
      <div class="stat-value">{{ summary.activeTasks }}</div>
      <div class="stat-label">进行中</div>
    </div>
    <div class="stat-card blue">
      <div class="stat-value">{{ summary.totalInstances }}</div>
      <div class="stat-label">接单实例</div>
    </div>
    <div class="stat-card orange">
      <div class="stat-value">{{ summary.pendingReview }}</div>
      <div class="stat-label">待审核</div>
    </div>
    <div class="stat-card purple">
      <div class="stat-value">¥{{ summary.totalAmount.toLocaleString() }}</div>
      <div class="stat-label">已验收金额</div>
    </div>
  </div>

  <div class="page-card">
    <div class="page-header">
      <div>
        <h2 class="page-title">任务管理</h2>
        <p class="text-muted">总览各企业任务汇总进度，明细查看每位灵工认领执行情况</p>
      </div>
    </div>

    <div class="toolbar">
      <el-input v-model="keyword" placeholder="搜索任务/类型/企业/灵工" clearable style="width: 240px" />
      <el-select v-model="enterpriseFilter" placeholder="企业筛选" clearable style="width: 200px">
        <el-option v-for="opt in enterpriseOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
      </el-select>
      <el-radio-group v-if="listTab === 'overview'" v-model="statusFilter">
        <el-radio-button value="all">全部</el-radio-button>
        <el-radio-button value="active">进行中</el-radio-button>
        <el-radio-button value="ended">已结束</el-radio-button>
        <el-radio-button value="draft">未发布</el-radio-button>
      </el-radio-group>
    </div>

    <el-tabs v-model="listTab" class="list-tabs">
      <el-tab-pane label="任务总览" name="overview">
        <el-table :data="overviewData" border stripe>
          <el-table-column prop="enterpriseName" label="企业" min-width="150" />
          <el-table-column prop="name" label="任务名称" min-width="160" />
          <el-table-column prop="taskTypeName" label="任务类型" width="130" />
          <el-table-column prop="quantityLabel" label="任务数量" width="100" />
          <el-table-column prop="dispatchLabel" label="派单方式" width="100" />
          <el-table-column label="任务期限" min-width="160">
            <template #default="{ row }">
              {{
                row.longTerm
                  ? '长期'
                  : `${formatTime(row.startTime).slice(0, 10)} ~ ${formatTime(row.endTime).slice(0, 10)}`
              }}
            </template>
          </el-table-column>
          <el-table-column label="子任务进度" min-width="180">
            <template #default="{ row }">
              <div class="progress-cell">
                <el-progress :percentage="row.progress" :stroke-width="8" />
                <span class="text-muted progress-text">
                  验收 {{ row.approvedCount }} / 完成 {{ row.completedCount }} / 接单 {{ row.acceptedCount }}
                  · 灵工 {{ row.instanceCount }} 人
                </span>
              </div>
            </template>
          </el-table-column>
          <el-table-column label="通过率" width="80" align="center">
            <template #default="{ row }">{{ row.passRate }}%</template>
          </el-table-column>
          <el-table-column label="状态" width="90">
            <template #default="{ row }">
              <el-tag
                size="small"
                :type="
                  row.status === 'active'
                    ? 'success'
                    : row.status === 'ended'
                      ? 'info'
                      : row.status === 'cancelled'
                        ? 'danger'
                        : 'warning'
                "
              >
                {{ row.statusLabel }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="220" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="openDetail(row)">详情</el-button>
              <el-button link @click="switchToDetail(row.id)">明细</el-button>
              <el-button link @click="openChart(row)">流程</el-button>
              <el-button
                v-if="row.status === 'active'"
                link
                type="warning"
                @click="endTask(row)"
              >
                结束
              </el-button>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane label="任务明细" name="detail">
        <div class="detail-toolbar">
          <el-select
            v-model="taskFilter"
            placeholder="全部任务"
            clearable
            filterable
            style="width: 320px"
          >
            <el-option
              v-for="opt in taskFilterOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
          <span class="text-muted">共 {{ detailData.length }} 条认领记录</span>
        </div>
        <el-table :data="detailData" border stripe>
          <el-table-column prop="enterpriseName" label="企业" min-width="140" />
          <el-table-column prop="taskName" label="任务名称" min-width="160" />
          <el-table-column prop="taskTypeName" label="类型" width="120" />
          <el-table-column prop="workerName" label="灵工" width="100" />
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
      </el-tab-pane>
    </el-tabs>
  </div>

  <el-drawer v-model="detailVisible" :title="currentTask?.name ?? '任务详情'" size="640px">
    <template v-if="currentTask">
      <el-descriptions :column="2" border class="desc-block">
        <el-descriptions-item label="企业" :span="2">{{ currentTask.enterpriseName }}</el-descriptions-item>
        <el-descriptions-item label="任务类型">{{ currentTask.taskTypeName }}</el-descriptions-item>
        <el-descriptions-item label="派单方式">{{ dispatchModeMap[currentTask.dispatchMode] }}</el-descriptions-item>
        <el-descriptions-item label="任务数量">
          {{ formatTaskQuantity(currentTask.unlimitedQuantity, currentTask.plannedTotal) }}
        </el-descriptions-item>
        <el-descriptions-item label="限领规则">
          {{ currentTask.maxPerPerson ? `每人最多 ${currentTask.maxPerPerson} 单` : '不限' }}
        </el-descriptions-item>
        <el-descriptions-item label="任务地点" :span="2">{{ currentTask.region ?? '-' }}</el-descriptions-item>
        <el-descriptions-item label="任务期限" :span="2">
          {{
            currentTask.longTerm
              ? '长期'
              : `${formatTime(currentTask.startTime).slice(0, 10)} ~ ${formatTime(currentTask.endTime).slice(0, 10)}`
          }}
        </el-descriptions-item>
        <el-descriptions-item label="任务内容" :span="2">{{ currentTask.description }}</el-descriptions-item>
      </el-descriptions>

      <h4 class="section-title">接单实例</h4>
      <el-table :data="instanceList" border stripe size="small">
        <el-table-column prop="workerName" label="灵工" width="80" />
        <el-table-column prop="currentNodeName" label="当前节点" width="100">
          <template #default="{ row }">
            <el-tag size="small">{{ row.currentNodeName }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="认领" width="70">
          <template #default="{ row }">{{ row.claimQuantity }}</template>
        </el-table-column>
        <el-table-column label="金额" width="80">
          <template #default="{ row }">¥{{ row.amount }}</template>
        </el-table-column>
        <el-table-column prop="updatedLabel" label="更新时间" min-width="150" />
      </el-table>
    </template>
  </el-drawer>

  <el-dialog v-model="chartVisible" title="任务工作流" width="800px">
    <WorkflowFlowChart
      v-if="currentWorkflow"
      :workflow="currentWorkflow"
    />
  </el-dialog>
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

.list-tabs {
  margin-top: 4px;
}

.detail-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.progress-cell {
  min-width: 140px;
}

.progress-text {
  font-size: 12px;
  display: block;
  margin-top: 4px;
}

.desc-block {
  margin-bottom: 20px;
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
