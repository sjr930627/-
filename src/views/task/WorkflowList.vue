<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import WorkflowFlowChart from '@/components/task/WorkflowFlowChart.vue'
import { formatWorkflowEnterpriseLabel, workflowStatusMap } from '@/constants/task'
import type { TaskWorkflow } from '@/types'

const store = useAppStore()
const router = useRouter()

const keyword = ref('')
const statusFilter = ref<'all' | 'enabled' | 'disabled'>('all')
const chartVisible = ref(false)
const viewingWorkflow = ref<TaskWorkflow | null>(null)

const tableData = computed(() =>
  store.taskWorkflows
    .filter((w) => {
      if (statusFilter.value !== 'all' && w.status !== statusFilter.value) return false
      if (!keyword.value.trim()) return true
      const kw = keyword.value.trim()
      const enterpriseLabel = formatWorkflowEnterpriseLabel(w, store.enterprises)
      return w.name.includes(kw) || enterpriseLabel.includes(kw)
    })
    .map((w) => ({
      ...w,
      enterpriseLabel: formatWorkflowEnterpriseLabel(w, store.enterprises),
      statusLabel: workflowStatusMap[w.status],
      nodeCount: w.nodes.length,
    })),
)

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
</script>

<template>
  <div class="page-card">
    <div class="page-header">
      <div>
        <h2 class="page-title">任务流程配置</h2>
        <p class="text-muted">
          定义任务类型对应的流程模板，配置节点、角色权限与结算关联 · 共 {{ store.taskWorkflows.length }} 个流程
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
      <el-table-column prop="boundTaskTypeCount" label="绑定类型" width="90" align="center">
        <template #default="{ row }">
          <el-tag v-if="row.boundTaskTypeCount > 0" type="warning" size="small">
            {{ row.boundTaskTypeCount }} 个
          </el-tag>
          <span v-else class="text-muted">未绑定</span>
        </template>
      </el-table-column>
      <el-table-column prop="version" label="版本" width="70" align="center" />
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
</template>

<style scoped>
.toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  align-items: center;
}
</style>
