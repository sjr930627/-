<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import WorkflowFlowChart from '@/components/task/WorkflowFlowChart.vue'
import WorkflowNodeCard from '@/components/task/WorkflowNodeCard.vue'
import WorkflowFieldPreview from '@/components/task/WorkflowFieldPreview.vue'
import { workflowActionMap, workflowFieldTypeMap } from '@/constants/task'
import { workflowTemplates } from '@/mock/taskSeed'
import type { TaskWorkflow, WorkflowEnterpriseScope, WorkflowFieldConfig, WorkflowFieldType, WorkflowNode } from '@/types'
import { generateId } from '@/utils'
import { normalizeWorkflowNode, prepareWorkflowNodesForSave } from '@/utils/workflow'

const route = useRoute()
const router = useRouter()
const store = useAppStore()

const editingId = computed(() => (route.params.id as string | undefined) ?? null)
const isEdit = computed(() => Boolean(editingId.value))
const existing = computed(() =>
  editingId.value ? store.taskWorkflows.find((w) => w.id === editingId.value) : null,
)

const boundTaskTypeCount = computed(() => {
  if (!editingId.value) return 0
  return store.taskTypes.filter((t) => t.workflowId === editingId.value).length
})

const nodesLocked = computed(() => boundTaskTypeCount.value > 0)

const emptyNode = (): WorkflowNode =>
  normalizeWorkflowNode({
    id: generateId('node'),
    name: '',
    nodeType: 'middle',
    role: 'worker',
    actions: [{ action: 'submit' }],
    sort: 0,
  })

const form = ref({
  name: '',
  description: '',
  enterpriseScope: 'all' as WorkflowEnterpriseScope,
  enterpriseIds: [] as string[],
  status: 'enabled' as 'enabled' | 'disabled',
  nodes: [] as WorkflowNode[],
  fields: [] as WorkflowFieldConfig[],
})

const previewNodeId = ref('')

const previewWorkflow = computed(() => ({
  name: form.value.name,
  enterpriseScope: form.value.enterpriseScope,
  enterpriseIds: form.value.enterpriseIds,
  nodes: form.value.nodes,
  status: form.value.status,
}))

const enterpriseOptions = computed(() =>
  store.enterprises.filter((e) => e.status !== 'terminated').map((e) => ({ value: e.id, label: e.name })),
)

const fieldTypeOptions = Object.entries(workflowFieldTypeMap) as [WorkflowFieldType, string][]

const previewNodeLabel = computed(() => {
  if (!previewNodeId.value) return '全部节点'
  return form.value.nodes.find((n) => n.id === previewNodeId.value)?.name ?? '全部节点'
})

function normalizeNodes(nodes: WorkflowNode[]): WorkflowNode[] {
  return nodes.map((n) => normalizeWorkflowNode({ ...n, actions: n.actions.map((a) => ({ ...a })) }, nodes))
}

function resolveEnterpriseScope(wf: TaskWorkflow) {
  if (wf.enterpriseScope) {
    return {
      enterpriseScope: wf.enterpriseScope,
      enterpriseIds: wf.enterpriseIds ? [...wf.enterpriseIds] : [],
    }
  }
  return { enterpriseScope: 'all' as WorkflowEnterpriseScope, enterpriseIds: [] as string[] }
}

function loadForm() {
  if (isEdit.value && existing.value) {
    const wf = existing.value
    const rawNodes = wf.nodes.map((n) => ({ ...n, actions: n.actions.map((a) => ({ ...a })) }))
    const scope = resolveEnterpriseScope(wf)
    form.value = {
      name: wf.name,
      description: wf.description ?? '',
      ...scope,
      status: wf.status,
      nodes: normalizeNodes(rawNodes),
      fields: (wf.fields ?? []).map((f) => ({ ...f, nodeIds: [...f.nodeIds] })),
    }
    if (nodesLocked.value) {
      ElMessage.warning('该工作流已绑定任务类型，仅可修改名称、描述和适用企业')
    }
    syncPreviewNode()
    return
  }
  form.value = {
    name: '',
    description: '',
    enterpriseScope: 'all',
    enterpriseIds: [],
    status: 'enabled',
    nodes: [],
    fields: defaultFields(),
  }
  const startId = generateId('node')
  const execId = generateId('node')
  const doneId = generateId('node')
  const cancelId = generateId('node')
  form.value.nodes = normalizeNodes([
    {
      id: startId,
      name: '待领取',
      nodeType: 'start',
      role: 'worker',
      actions: [
        { action: 'accept', targetNodeId: execId },
        { action: 'cancel', targetNodeId: cancelId },
      ],
      sort: 0,
    },
    {
      id: execId,
      name: '执行中',
      nodeType: 'middle',
      role: 'worker',
      actions: [
        { action: 'submit', targetNodeId: doneId },
        { action: 'cancel', targetNodeId: cancelId },
      ],
      sort: 1,
    },
    {
      id: doneId,
      name: '已完成',
      nodeType: 'end',
      role: 'system',
      actions: [],
      triggerSettlement: true,
      sort: 2,
    },
    {
      id: cancelId,
      name: '已取消',
      nodeType: 'end',
      role: 'system',
      actions: [],
      sort: 3,
    },
  ])
  syncPreviewNode()
}

function syncPreviewNode() {
  previewNodeId.value = form.value.nodes.find((n) => n.nodeType !== 'end')?.id ?? form.value.nodes[0]?.id ?? ''
}

function defaultFields(): WorkflowFieldConfig[] {
  return [
    {
      id: generateId('field'),
      name: '任务编号',
      fieldType: 'text',
      required: true,
      nodeIds: [],
    },
    {
      id: generateId('field'),
      name: '备注说明',
      fieldType: 'textarea',
      required: false,
      nodeIds: [],
    },
  ]
}

watch([editingId, () => store.taskWorkflows.length], loadForm, { immediate: true })

watch(
  () => form.value.enterpriseScope,
  (scope) => {
    if (scope === 'all') form.value.enterpriseIds = []
  },
)

function applyTemplate(tplIndex: number) {
  const tpl = workflowTemplates[tplIndex]
  form.value.name = tpl.name.replace('（模板）', '')
  form.value.enterpriseScope = tpl.enterpriseScope
  form.value.enterpriseIds = tpl.enterpriseIds ? [...tpl.enterpriseIds] : []

  const idMap = new Map<string, string>()
  const nodes = tpl.nodes.map((n, i) => {
    const newId = generateId('node')
    idMap.set(n.id, newId)
    return {
      ...n,
      id: newId,
      sort: i,
      actions: n.actions.map((a) => ({ ...a })),
    }
  })
  nodes.forEach((n) => {
    if (n.timeoutTargetNodeId && idMap.has(n.timeoutTargetNodeId)) {
      n.timeoutTargetNodeId = idMap.get(n.timeoutTargetNodeId)
    }
    if (n.defaultNextNodeId && idMap.has(n.defaultNextNodeId)) {
      n.defaultNextNodeId = idMap.get(n.defaultNextNodeId)
    }
    n.actions.forEach((a) => {
      if (a.targetNodeId && idMap.has(a.targetNodeId)) {
        a.targetNodeId = idMap.get(a.targetNodeId)
      }
    })
    if (n.nodeType !== 'end') n.triggerSettlement = false
  })
  form.value.nodes = normalizeNodes(nodes)

  if (tpl.fields?.length) {
    form.value.fields = tpl.fields.map((f) => ({
      ...f,
      id: generateId('field'),
      nodeIds: f.nodeIds.map((nid) => idMap.get(nid) ?? nid).filter((nid) => [...idMap.values()].includes(nid)),
    }))
  }
  syncPreviewNode()
  ElMessage.success('已套用模板，可按需调整节点')
}

function addNode() {
  if (nodesLocked.value) return
  const sort = form.value.nodes.length
  form.value.nodes.push(
    normalizeWorkflowNode({ ...emptyNode(), name: `节点${sort + 1}`, sort }, form.value.nodes),
  )
}

function removeNode(index: number) {
  if (nodesLocked.value) return
  if (form.value.nodes.length <= 2) {
    ElMessage.warning('至少保留起始和结束两个节点')
    return
  }
  form.value.nodes.splice(index, 1)
  form.value.nodes.forEach((n, i) => {
    n.sort = i
  })
  syncPreviewNode()
}

function moveNode(index: number, direction: -1 | 1) {
  if (nodesLocked.value) return
  const target = index + direction
  if (target < 0 || target >= form.value.nodes.length) return
  const nodes = form.value.nodes
  ;[nodes[index], nodes[target]] = [nodes[target], nodes[index]]
  nodes.forEach((n, i) => {
    n.sort = i
  })
}

function addField() {
  form.value.fields.push({
    id: generateId('field'),
    name: '',
    fieldType: 'text',
    required: false,
    nodeIds: [],
  })
}

function removeField(index: number) {
  form.value.fields.splice(index, 1)
}

function nodeOptionsForField() {
  return form.value.nodes.filter((n) => n.name.trim()).map((n) => ({ value: n.id, label: n.name }))
}

function validateForm() {
  if (!form.value.name.trim()) {
    ElMessage.warning('请输入流程名称')
    return false
  }
  if (form.value.enterpriseScope === 'specific' && !form.value.enterpriseIds.length) {
    ElMessage.warning('请选择适用企业')
    return false
  }
  if (!nodesLocked.value) {
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
    for (const node of form.value.nodes) {
      if (node.nodeType === 'end') {
        if (node.actions.length > 0) {
          ElMessage.warning(`结束节点「${node.name}」不可配置可执行动作`)
          return false
        }
        continue
      }
      if (node.triggerSettlement) {
        ElMessage.warning(`仅结束节点可配置关联结算，请检查「${node.name}」`)
        return false
      }
      if (node.timeoutEnabled && (!node.timeoutHours || !node.timeoutTargetNodeId)) {
        ElMessage.warning(`节点「${node.name || '未命名'}」请完善超时规则`)
        return false
      }
      for (const action of node.actions) {
        if (!action.targetNodeId) {
          ElMessage.warning(
            `节点「${node.name}」的「${workflowActionMap[action.action === 'approve' ? 'confirm' : action.action]}」请配置流转目标`,
          )
          return false
        }
      }
    }
  }
  if (form.value.fields.some((f) => !f.name.trim())) {
    ElMessage.warning('请填写所有字段名称')
    return false
  }
  return true
}

function buildPayload(status: 'enabled' | 'disabled') {
  const payload = {
    name: form.value.name.trim(),
    description: form.value.description.trim() || undefined,
    enterpriseScope: form.value.enterpriseScope,
    enterpriseIds:
      form.value.enterpriseScope === 'specific' ? [...form.value.enterpriseIds] : undefined,
    status,
    fields: form.value.fields.map((f) => ({
      ...f,
      name: f.name.trim(),
      nodeIds: f.nodeIds.length ? f.nodeIds : [],
    })),
  }
  if (!nodesLocked.value) {
    return {
      ...payload,
      nodes: prepareWorkflowNodesForSave(form.value.nodes),
    }
  }
  return payload
}

function save(asDraft = false) {
  if (!validateForm()) return
  const status = asDraft ? 'disabled' : 'enabled'
  const payload = buildPayload(status)
  try {
    if (isEdit.value && editingId.value) {
      store.updateTaskWorkflow(editingId.value, payload)
      ElMessage.success(asDraft ? '草稿已保存' : '更新成功')
    } else {
      store.addTaskWorkflow({ ...payload, status } as Omit<TaskWorkflow, 'id' | 'version' | 'boundTaskTypeCount' | 'createdAt' | 'updatedAt'>)
      ElMessage.success(asDraft ? '草稿已保存' : '创建成功')
    }
    router.push('/task-workflows')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '操作失败')
  }
}

function cancel() {
  router.push('/task-workflows')
}
</script>

<template>
  <div class="workflow-form-page">
    <div class="form-header">
      <div>
        <h2 class="page-title">{{ isEdit ? '编辑工作流' : '新增工作流' }}</h2>
        <p class="text-muted">配置流程节点、角色权限、前置条件、通知与超时规则</p>
      </div>
      <div class="header-actions">
        <el-button @click="cancel">取消</el-button>
        <el-button @click="save(true)">保存草稿</el-button>
        <el-button type="primary" @click="save(false)">保存并启用</el-button>
      </div>
    </div>

    <div class="form-layout">
      <div class="form-main">
        <section class="section-card">
          <h3 class="section-title">基本信息</h3>
          <el-form label-width="100px">
            <el-row :gutter="16">
              <el-col :span="12">
                <el-form-item label="流程名称" required>
                  <el-input v-model="form.name" placeholder="如：运营商套餐推广流程" />
                </el-form-item>
              </el-col>
              <el-col :span="12">
                <el-form-item label="关联任务类型">
                  <div class="bound-task-types">
                    <el-tag v-if="boundTaskTypeCount > 0" type="warning">{{ boundTaskTypeCount }} 个</el-tag>
                    <span v-else class="text-muted">暂无关联</span>
                    <span class="bound-hint">由任务类型配置时关联，此处不可修改</span>
                  </div>
                </el-form-item>
              </el-col>
            </el-row>
            <el-form-item label="适用企业" required>
              <div class="enterprise-scope">
                <el-radio-group v-model="form.enterpriseScope">
                  <el-radio value="all">全部企业</el-radio>
                  <el-radio value="specific">特定企业</el-radio>
                </el-radio-group>
                <el-select
                  v-if="form.enterpriseScope === 'specific'"
                  v-model="form.enterpriseIds"
                  multiple
                  collapse-tags
                  placeholder="选择企业"
                  style="width: 100%; margin-top: 8px"
                >
                  <el-option v-for="opt in enterpriseOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
                </el-select>
              </div>
            </el-form-item>
            <el-form-item label="流程描述">
              <el-input v-model="form.description" type="textarea" :rows="3" placeholder="简要说明流程用途与适用场景" />
            </el-form-item>
            <el-form-item v-if="!isEdit" label="流程模板">
              <el-button
                v-for="(tpl, i) in workflowTemplates"
                :key="tpl.name"
                size="small"
                :disabled="nodesLocked"
                @click="applyTemplate(i)"
              >
                套用{{ tpl.name.replace('（模板）', '') }}
              </el-button>
            </el-form-item>
          </el-form>
        </section>

        <section class="section-card">
          <div class="section-header">
            <h3 class="section-title">节点配置</h3>
          </div>
          <div v-if="!nodesLocked" class="action-bar">
            <el-button type="primary" @click="addNode">+ 添加节点</el-button>
          </div>
          <el-alert v-if="nodesLocked" type="warning" show-icon :closable="false" style="margin-bottom: 12px">
            工作流已绑定任务类型，节点配置不可修改
          </el-alert>
          <WorkflowNodeCard
            v-for="(node, index) in form.nodes"
            :key="node.id"
            :node="node"
            :index="index"
            :total="form.nodes.length"
            :all-nodes="form.nodes"
            :readonly="nodesLocked"
            @move="moveNode(index, $event)"
            @remove="removeNode(index)"
          />
          <div v-if="!nodesLocked && form.nodes.length" class="action-bar action-bar-bottom">
            <el-button type="primary" plain @click="addNode">+ 添加节点</el-button>
          </div>
        </section>
      </div>

      <div class="form-side">
        <section class="section-card">
          <h3 class="section-title">流程预览</h3>
          <WorkflowFlowChart :workflow="previewWorkflow" compact />
        </section>

        <section class="section-card">
          <h3 class="section-title">业务规则</h3>
          <ul class="rules-list">
            <li>流程必须包含至少一个起始节点和一个结束节点，可配置多个结束节点（如已完成、已取消）</li>
            <li>结束节点无可执行动作，仅作为分叉流转的目标</li>
            <li>分叉节点可为每个动作指定流转目标，如「取消」→ 已取消、「确认」→ 已结算</li>
            <li>关联结算仅可在结束节点配置</li>
            <li>工作流绑定任务后不可修改节点，仅可停用并新建版本</li>
            <li>超时规则可指定超时后自动流转至目标节点</li>
          </ul>
        </section>

        <section class="section-card">
          <div class="section-header">
            <h3 class="section-title">字段配置</h3>
          </div>
          <div class="action-bar">
            <el-button type="primary" @click="addField">+ 添加字段</el-button>
          </div>
          <div v-for="(field, index) in form.fields" :key="field.id" class="field-row">
            <el-input v-model="field.name" placeholder="字段名称" style="width: 120px" />
            <el-select v-model="field.fieldType" style="width: 90px">
              <el-option v-for="[key, label] in fieldTypeOptions" :key="key" :label="label" :value="key" />
            </el-select>
            <el-checkbox v-model="field.required">必填</el-checkbox>
            <el-select
              v-model="field.nodeIds"
              multiple
              collapse-tags
              placeholder="下发节点（空=全部）"
              style="flex: 1; min-width: 140px"
            >
              <el-option v-for="opt in nodeOptionsForField()" :key="opt.value" :label="opt.label" :value="opt.value" />
            </el-select>
            <el-button type="danger" link @click="removeField(index)">删除</el-button>
          </div>
          <p v-if="!form.fields.length" class="text-muted empty-hint">暂无字段，点击「添加字段」配置任务采集项</p>
          <div v-if="form.fields.length" class="field-preview-wrap">
            <el-select
              v-model="previewNodeId"
              clearable
              placeholder="预览节点（空=全部）"
              style="width: 100%; margin-bottom: 8px"
            >
              <el-option label="全部节点" value="" />
              <el-option v-for="opt in nodeOptionsForField()" :key="opt.value" :label="opt.label" :value="opt.value" />
            </el-select>
            <WorkflowFieldPreview
              :fields="form.fields"
              :preview-node-id="previewNodeId || undefined"
              :node-label="previewNodeLabel"
            />
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.workflow-form-page {
  padding: 0 4px 24px;
}

.form-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}

.header-actions {
  display: flex;
  gap: 8px;
}

.form-layout {
  display: grid;
  grid-template-columns: 1fr 380px;
  gap: 16px;
  align-items: start;
}

.section-card {
  background: #fff;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  padding: 16px 20px;
  margin-bottom: 16px;
}

.section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}

.section-title {
  margin: 0 0 12px;
  font-size: 15px;
  font-weight: 600;
}

.section-header .section-title {
  margin-bottom: 0;
}

.enterprise-scope {
  width: 100%;
}

.bound-task-types {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  min-height: 32px;
}

.bound-hint {
  font-size: 12px;
  color: #909399;
}

.action-bar {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.action-bar-bottom {
  margin-top: 4px;
  margin-bottom: 0;
}

.rules-list {
  margin: 0;
  padding-left: 18px;
  color: #606266;
  font-size: 13px;
  line-height: 1.8;
}

.field-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 10px;
}

.field-preview-wrap {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed #e4e7ed;
}

.empty-hint {
  font-size: 13px;
  margin: 0;
}

@media (max-width: 1200px) {
  .form-layout {
    grid-template-columns: 1fr;
  }
}
</style>
