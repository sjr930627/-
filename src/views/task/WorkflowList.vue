<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import WorkflowFlowChart from '@/components/task/WorkflowFlowChart.vue'
import {
  industryOptions,
  industryTagMap,
  workflowActionMap,
  workflowNodeTypeMap,
  workflowRoleMap,
  workflowStatusMap,
} from '@/constants/task'
import { workflowTemplates } from '@/mock/taskSeed'
import type { TaskWorkflow, WorkflowActionConfig, WorkflowNode } from '@/types'
import { generateId } from '@/utils'

const store = useAppStore()

const keyword = ref('')
const statusFilter = ref<'all' | 'enabled' | 'disabled'>('all')
const dialogVisible = ref(false)
const chartVisible = ref(false)
const editingId = ref<string | null>(null)
const viewingWorkflow = ref<TaskWorkflow | null>(null)

const emptyNode = (): WorkflowNode => ({
  id: generateId('node'),
  name: '',
  nodeType: 'middle',
  role: 'worker',
  actions: [{ action: 'submit' }],
  sort: 0,
})

const form = ref({
  name: '',
  industryTags: [] as string[],
  status: 'enabled' as 'enabled' | 'disabled',
  nodes: [emptyNode()] as WorkflowNode[],
})

const tableData = computed(() =>
  store.taskWorkflows
    .filter((w) => {
      if (statusFilter.value !== 'all' && w.status !== statusFilter.value) return false
      if (!keyword.value.trim()) return true
      const kw = keyword.value.trim()
      return (
        w.name.includes(kw) ||
        w.industryTags.some((t) => industryTagMap[t].includes(kw))
      )
    })
    .map((w) => ({
      ...w,
      industryLabel: w.industryTags.map((t) => industryTagMap[t]).join('、'),
      statusLabel: workflowStatusMap[w.status],
      nodeCount: w.nodes.length,
    })),
)

function openCreate() {
  editingId.value = null
  form.value = {
    name: '',
    industryTags: [],
    status: 'enabled',
    nodes: [
      { ...emptyNode(), name: '待领取', nodeType: 'start', sort: 0 },
      { ...emptyNode(), name: '已完成', nodeType: 'end', role: 'system', actions: [], triggerSettlement: true, sort: 1 },
    ],
  }
  dialogVisible.value = true
}

function openEdit(row: TaskWorkflow) {
  if (row.boundTaskTypeCount > 0) {
    ElMessage.warning('该工作流已绑定任务类型，仅可修改名称和行业标签')
  }
  editingId.value = row.id
  form.value = {
    name: row.name,
    industryTags: [...row.industryTags],
    status: row.status,
    nodes: row.nodes.map((n) => ({ ...n, actions: n.actions.map((a) => ({ ...a })) })),
  }
  dialogVisible.value = true
}

function applyTemplate(tplIndex: number) {
  const tpl = workflowTemplates[tplIndex]
  form.value.name = tpl.name.replace('（模板）', '')
  form.value.industryTags = [...tpl.industryTags]
  form.value.nodes = tpl.nodes.map((n, i) => ({
    ...n,
    id: generateId('node'),
    sort: i,
    actions: n.actions.map((a) => ({ ...a })),
  }))
  ElMessage.success('已套用模板，可按需调整节点')
}

function addNode() {
  const sort = form.value.nodes.length
  form.value.nodes.push({ ...emptyNode(), name: `节点${sort + 1}`, sort })
}

function removeNode(index: number) {
  if (form.value.nodes.length <= 2) {
    ElMessage.warning('至少保留起始和结束两个节点')
    return
  }
  form.value.nodes.splice(index, 1)
  form.value.nodes.forEach((n, i) => {
    n.sort = i
  })
}

function moveNode(index: number, direction: -1 | 1) {
  const target = index + direction
  if (target < 0 || target >= form.value.nodes.length) return
  const nodes = form.value.nodes
  ;[nodes[index], nodes[target]] = [nodes[target], nodes[index]]
  nodes.forEach((n, i) => {
    n.sort = i
  })
}

function toggleAction(node: WorkflowNode, action: WorkflowActionConfig['action']) {
  const idx = node.actions.findIndex((a) => a.action === action)
  if (idx >= 0) {
    node.actions.splice(idx, 1)
  } else {
    node.actions.push({ action })
  }
}

function hasAction(node: WorkflowNode, action: WorkflowActionConfig['action']) {
  return node.actions.some((a) => a.action === action)
}

function validateForm() {
  if (!form.value.name.trim()) {
    ElMessage.warning('请输入流程名称')
    return false
  }
  if (!form.value.industryTags.length) {
    ElMessage.warning('请选择适用行业')
    return false
  }
  const starts = form.value.nodes.filter((n) => n.nodeType === 'start')
  const ends = form.value.nodes.filter((n) => n.nodeType === 'end')
  if (starts.length !== 1 || ends.length < 1) {
    ElMessage.warning('需包含一个起始节点和至少一个结束节点')
    return false
  }
  if (form.value.nodes.some((n) => !n.name.trim())) {
    ElMessage.warning('请填写所有节点名称')
    return false
  }
  return true
}

function submit() {
  if (!validateForm()) return
  const payload = {
    name: form.value.name.trim(),
    industryTags: form.value.industryTags as TaskWorkflow['industryTags'],
    status: form.value.status,
    nodes: form.value.nodes.map((n, i) => ({ ...n, sort: i })),
  }
  try {
    if (editingId.value) {
      store.updateTaskWorkflow(editingId.value, payload)
      ElMessage.success('更新成功')
    } else {
      store.addTaskWorkflow(payload)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '操作失败')
  }
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
        <h2 class="page-title">工作流配置</h2>
        <p class="text-muted">
          定义任务类型对应的流程模板，配置节点、角色权限与结算规则 · 共 {{ store.taskWorkflows.length }} 个流程
        </p>
      </div>
      <el-button type="primary" @click="openCreate">新增工作流</el-button>
    </div>

    <div class="toolbar">
      <el-input v-model="keyword" placeholder="搜索流程名称或行业" clearable style="width: 240px" />
      <el-radio-group v-model="statusFilter">
        <el-radio-button value="all">全部</el-radio-button>
        <el-radio-button value="enabled">启用</el-radio-button>
        <el-radio-button value="disabled">停用</el-radio-button>
      </el-radio-group>
    </div>

    <el-table :data="tableData" border stripe>
      <el-table-column prop="name" label="流程名称" min-width="180" />
      <el-table-column prop="industryLabel" label="适用行业" width="140" />
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

  <el-dialog
    v-model="dialogVisible"
    :title="editingId ? '编辑工作流' : '新增工作流'"
    width="920px"
    destroy-on-close
  >
    <el-form label-width="100px">
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="流程名称" required>
            <el-input v-model="form.name" placeholder="如：运营商套餐推广流程" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="状态">
            <el-radio-group v-model="form.status">
              <el-radio value="enabled">启用</el-radio>
              <el-radio value="disabled">停用</el-radio>
            </el-radio-group>
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="适用行业" required>
        <el-select v-model="form.industryTags" multiple placeholder="选择行业标签" style="width: 100%">
          <el-option v-for="opt in industryOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
        </el-select>
      </el-form-item>
      <el-form-item v-if="!editingId" label="行业模板">
        <el-button
          v-for="(tpl, i) in workflowTemplates"
          :key="tpl.name"
          size="small"
          @click="applyTemplate(i)"
        >
          套用{{ tpl.industryTags.map((t) => industryTagMap[t]).join('/') }}模板
        </el-button>
      </el-form-item>

      <div class="nodes-header">
        <span class="nodes-title">节点列表</span>
        <el-button size="small" type="primary" plain @click="addNode">添加节点</el-button>
      </div>

      <div v-for="(node, index) in form.nodes" :key="node.id" class="node-card">
        <div class="node-card-header">
          <span>节点 {{ index + 1 }}</span>
          <div class="node-actions">
            <el-button size="small" text :disabled="index === 0" @click="moveNode(index, -1)">上移</el-button>
            <el-button
              size="small"
              text
              :disabled="index === form.nodes.length - 1"
              @click="moveNode(index, 1)"
            >
              下移
            </el-button>
            <el-button size="small" text type="danger" @click="removeNode(index)">删除</el-button>
          </div>
        </div>
        <el-row :gutter="12">
          <el-col :span="8">
            <el-form-item label="节点名称" label-width="80px">
              <el-input v-model="node.name" placeholder="如：待领取" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="节点类型" label-width="80px">
              <el-select v-model="node.nodeType" style="width: 100%">
                <el-option
                  v-for="(label, key) in workflowNodeTypeMap"
                  :key="key"
                  :label="label"
                  :value="key"
                />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="执行角色" label-width="80px">
              <el-select v-model="node.role" style="width: 100%">
                <el-option
                  v-for="(label, key) in workflowRoleMap"
                  :key="key"
                  :label="label"
                  :value="key"
                />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="可执行动作" label-width="80px">
          <el-checkbox
            v-for="(label, action) in workflowActionMap"
            :key="action"
            :model-value="hasAction(node, action)"
            @change="toggleAction(node, action)"
          >
            {{ label }}
          </el-checkbox>
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="8">
            <el-checkbox v-model="node.triggerSettlement">流转时触发结算</el-checkbox>
          </el-col>
          <el-col :span="8">
            <el-form-item label="超时(h)" label-width="70px">
              <el-input-number v-model="node.timeoutHours" :min="0" :max="720" controls-position="right" />
            </el-form-item>
          </el-col>
        </el-row>
      </div>
    </el-form>

    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" @click="submit">保存</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="chartVisible" title="流程泳道图" width="800px">
    <WorkflowFlowChart v-if="viewingWorkflow" :workflow="viewingWorkflow" />
  </el-dialog>
</template>

<style scoped>
.toolbar {
  display: flex;
  gap: 12px;
  margin-bottom: 16px;
  align-items: center;
}

.nodes-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin: 16px 0 8px;
  padding-top: 8px;
  border-top: 1px solid #ebeef5;
}

.nodes-title {
  font-weight: 600;
}

.node-card {
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 12px 16px 4px;
  margin-bottom: 12px;
  background: #fafafa;
}

.node-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
  font-weight: 500;
}

.node-actions {
  display: flex;
  gap: 4px;
}
</style>
