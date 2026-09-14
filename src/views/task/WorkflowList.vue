<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import WorkflowFlowChart from '@/components/task/WorkflowFlowChart.vue'
import { formatWorkflowEnterpriseLabel, workflowStatusMap } from '@/constants/task'
import { countWorkflowBoundTasks } from '@/services/task'
import {
  ensureWorkflowVersions,
  formatWorkflowVersionLabel,
  formatWorkflowVersionTime,
  summarizeWorkflowVersionSnapshot,
  workflowFromVersionSnapshot,
} from '@/services/taskWorkflowVersion'
import type { TaskWorkflow, TaskWorkflowVersion } from '@/types'

const store = useAppStore()
const router = useRouter()

const keyword = ref('')
const statusFilter = ref<'all' | 'enabled' | 'disabled'>('all')
const chartVisible = ref(false)
const viewingWorkflow = ref<TaskWorkflow | null>(null)

const historyVisible = ref(false)
const historyWorkflow = ref<TaskWorkflow | null>(null)
const versionDetailVisible = ref(false)
const selectedVersion = ref<TaskWorkflowVersion | null>(null)

const tableData = computed(() =>
  store.taskWorkflows
    .filter((w) => {
      if (statusFilter.value !== 'all' && w.status !== statusFilter.value) return false
      if (!keyword.value.trim()) return true
      const kw = keyword.value.trim()
      const enterpriseLabel = formatWorkflowEnterpriseLabel(w, store.enterprises)
      return w.name.includes(kw) || enterpriseLabel.includes(kw)
    })
    .map((w) => {
      const ensured = ensureWorkflowVersions(w)
      return {
        ...ensured,
        enterpriseLabel: formatWorkflowEnterpriseLabel(w, store.enterprises),
        statusLabel: workflowStatusMap[w.status],
        nodeCount: w.nodes.length,
        boundTaskCount: countWorkflowBoundTasks(store.tasks, w.id),
        versionLabel: formatWorkflowVersionLabel(ensured.version),
      }
    }),
)

const versionHistory = computed(() => {
  if (!historyWorkflow.value) return []
  return [...(historyWorkflow.value.versions ?? [])].sort((a, b) => b.version - a.version)
})

const versionDetailLines = computed(() =>
  selectedVersion.value
    ? summarizeWorkflowVersionSnapshot(selectedVersion.value.snapshot, store.enterprises)
    : [],
)

const versionPreviewWorkflow = computed(() => {
  if (!historyWorkflow.value || !selectedVersion.value) return null
  return workflowFromVersionSnapshot(historyWorkflow.value, selectedVersion.value)
})

function openCreate() {
  router.push('/task-workflows/create')
}

function openEdit(row: TaskWorkflow) {
  router.push(`/task-workflows/${row.id}/edit`)
}

async function copyWorkflow(row: TaskWorkflow) {
  store.copyTaskWorkflow(row.id)
  ElMessage.success('已复制为新工作流（默认停用）')
}

async function toggleStatus(row: TaskWorkflow) {
  store.toggleTaskWorkflowStatus(row.id)
  ElMessage.success(row.status === 'enabled' ? '已停用' : '已启用')
}

async function remove(row: TaskWorkflow) {
  try {
    await ElMessageBox.confirm(`确定删除工作流「${row.name}」？`, '提示', { type: 'warning' })
    store.removeTaskWorkflow(row.id)
    ElMessage.success('删除成功')
  } catch (e) {
    if (e instanceof Error && e.message !== 'cancel') {
      ElMessage.error(e.message)
    }
  }
}

function viewChart(row: TaskWorkflow) {
  viewingWorkflow.value = row
  chartVisible.value = true
}

function openVersionHistory(row: TaskWorkflow) {
  const live = store.taskWorkflows.find((w) => w.id === row.id) ?? row
  historyWorkflow.value = ensureWorkflowVersions(live)
  // 写回确保旧数据有 versions
  Object.assign(live, historyWorkflow.value)
  historyVisible.value = true
}

function viewVersionDetail(version: TaskWorkflowVersion) {
  selectedVersion.value = version
  versionDetailVisible.value = true
}

async function restoreVersion(version: TaskWorkflowVersion) {
  if (!historyWorkflow.value) return
  if (version.isActive) {
    ElMessage.info('当前已是该版本')
    return
  }
  try {
    await ElMessageBox.confirm(
      `将流程恢复为 V${version.version} 的配置，并生成新版本生效。已绑定任务时节点也会一并恢复，请确认。`,
      '恢复版本',
      { type: 'warning' },
    )
    const record = store.restoreTaskWorkflowVersion(historyWorkflow.value.id, version.id)
    const live = store.taskWorkflows.find((w) => w.id === historyWorkflow.value!.id)
    historyWorkflow.value = live ? ensureWorkflowVersions(live) : historyWorkflow.value
    ElMessage.success(`已恢复并发布为 V${record.version}`)
    versionDetailVisible.value = false
  } catch (e) {
    if (e !== 'cancel' && e instanceof Error) ElMessage.error(e.message)
  }
}
</script>

<template>
  <div class="page-card">
    <div class="page-header">
      <div>
        <h2 class="page-title">任务流程配置</h2>
        <p class="text-muted">
          阶段一：配置小任务流程模板（节点、权限、按钮）· 发布后进入模板库供企业引用 · 共 {{ store.taskWorkflows.length }} 个流程
        </p>
      </div>
      <el-button type="primary" @click="openCreate">新增工作流</el-button>
    </div>

    <div class="toolbar">
      <el-input v-model="keyword" placeholder="搜索流程名称或企业" clearable style="width: 240px" />
      <el-radio-group v-model="statusFilter">
        <el-radio-button value="all">全部</el-radio-button>
        <el-radio-button value="enabled">启用</el-radio-button>
        <el-radio-button value="disabled">停用</el-radio-button>
      </el-radio-group>
    </div>

    <el-table :data="tableData" border stripe>
      <el-table-column prop="name" label="流程名称" min-width="180" />
      <el-table-column prop="enterpriseLabel" label="适用企业" min-width="160" show-overflow-tooltip />
      <el-table-column prop="nodeCount" label="节点数" width="80" align="center" />
      <el-table-column prop="boundTaskCount" label="绑定任务数量" width="110" align="center">
        <template #default="{ row }">
          <el-tag v-if="row.boundTaskCount > 0" type="warning" size="small">
            {{ row.boundTaskCount }} 个
          </el-tag>
          <span v-else class="text-muted">0</span>
        </template>
      </el-table-column>
      <el-table-column label="版本" width="100" align="center">
        <template #default="{ row }">
          <el-button link type="primary" class="version-link" @click="openVersionHistory(row)">
            {{ row.versionLabel }}
          </el-button>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag :type="row.status === 'enabled' ? 'success' : 'info'" size="small">
            {{ row.statusLabel }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="280" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="viewChart(row)">流程图</el-button>
          <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
          <el-button link @click="copyWorkflow(row)">复制</el-button>
          <el-button link @click="toggleStatus(row)">
            {{ row.status === 'enabled' ? '停用' : '启用' }}
          </el-button>
          <el-button link type="danger" @click="remove(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>

  <el-dialog v-model="chartVisible" title="流程预览" width="800px">
    <WorkflowFlowChart v-if="viewingWorkflow" :workflow="viewingWorkflow" compact />
  </el-dialog>

  <el-dialog
    v-model="historyVisible"
    :title="historyWorkflow ? `${historyWorkflow.name} · 版本历史` : '版本历史'"
    width="760px"
  >
    <el-table :data="versionHistory" border stripe size="small">
      <el-table-column label="版本" width="90" align="center">
        <template #default="{ row }">
          <el-tag :type="row.isActive ? 'success' : 'info'" size="small">
            V{{ row.version }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90" align="center">
        <template #default="{ row }">
          <span v-if="row.isActive" class="active-label">生效中</span>
          <span v-else class="text-muted">历史</span>
        </template>
      </el-table-column>
      <el-table-column label="发布时间" width="160">
        <template #default="{ row }">{{ formatWorkflowVersionTime(row.publishedAt) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="150" align="center" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="viewVersionDetail(row)">查看</el-button>
          <el-button
            v-if="!row.isActive"
            link
            type="warning"
            @click="restoreVersion(row)"
          >
            恢复
          </el-button>
        </template>
      </el-table-column>
    </el-table>
  </el-dialog>

  <el-dialog
    v-model="versionDetailVisible"
    :title="selectedVersion ? `V${selectedVersion.version} 配置详情` : '配置详情'"
    width="820px"
  >
    <div v-if="selectedVersion" class="version-detail">
      <div class="version-meta">
        <span>发布时间：{{ formatWorkflowVersionTime(selectedVersion.publishedAt) }}</span>
        <el-tag v-if="selectedVersion.isActive" size="small" type="success">当前生效</el-tag>
      </div>
      <ul class="version-lines">
        <li v-for="(line, index) in versionDetailLines" :key="index">{{ line }}</li>
      </ul>
      <div v-if="versionPreviewWorkflow" class="version-chart">
        <WorkflowFlowChart :workflow="versionPreviewWorkflow" compact />
      </div>
      <div class="version-actions">
        <el-button
          v-if="!selectedVersion.isActive"
          type="warning"
          @click="restoreVersion(selectedVersion)"
        >
          恢复此版本
        </el-button>
      </div>
    </div>
  </el-dialog>
</template>

<style scoped>
.toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  align-items: center;
}

.version-link {
  font-weight: 600;
}

.active-label {
  color: var(--el-color-success);
  font-size: 13px;
}

.version-detail {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.version-meta {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: var(--el-text-color-secondary);
}

.version-note {
  margin: 0;
  padding: 8px 12px;
  background: var(--el-fill-color-light);
  border-radius: 6px;
  font-size: 13px;
}

.version-lines {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  line-height: 1.8;
  color: var(--el-text-color-regular);
}

.version-chart {
  border: 1px solid var(--el-border-color-lighter);
  border-radius: 8px;
  padding: 8px;
  overflow: auto;
}

.version-actions {
  display: flex;
  justify-content: flex-end;
}
</style>
