<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import WorkflowDesignCanvas from '@/components/task/WorkflowDesignCanvas.vue'
import WorkflowNodePalette from '@/components/task/WorkflowNodePalette.vue'
import WorkflowNodeConfigPanel from '@/components/task/WorkflowNodeConfigPanel.vue'
import { buildNodeFromPalette, getPaletteItem, validatePaletteDrop } from '@/constants/workflowPalette'
import { countWorkflowBoundTasks } from '@/services/task'
import {
  ensureWorkflowVersions,
  formatWorkflowVersionLabel,
  workflowFromVersionSnapshot,
} from '@/services/taskWorkflowVersion'
import { workflowTemplates } from '@/mock/taskSeed'
import type {
  TaskWorkflow,
  TaskWorkflowVersion,
  WorkflowEnterpriseScope,
  WorkflowFieldConfig,
  WorkflowNode,
} from '@/types'
import { generateId } from '@/utils'
import {
  canRemoveWorkflowNode,
  ensureNodePositions,
  normalizeWorkflowNode,
  prepareWorkflowNodesForSave,
  removeWorkflowNode,
  resolveWorkflowActionLabel,
  upsertWorkflowConnection,
} from '@/utils/workflow'

const route = useRoute()
const router = useRouter()
const store = useAppStore()

const editingId = computed(() => (route.params.id as string | undefined) ?? null)
const versionId = computed(() => (route.params.versionId as string | undefined) ?? null)
const isViewMode = computed(
  () => route.name === 'TaskWorkflowView' || route.name === 'TaskWorkflowVersionView',
)
const isVersionView = computed(() => route.name === 'TaskWorkflowVersionView')
const isEdit = computed(() => Boolean(editingId.value))
const existing = computed(() =>
  editingId.value ? store.taskWorkflows.find((w) => w.id === editingId.value) : null,
)

const viewingVersion = computed((): TaskWorkflowVersion | null => {
  if (!isVersionView.value || !existing.value || !versionId.value) return null
  const ensured = ensureWorkflowVersions(existing.value)
  return ensured.versions?.find((v) => v.id === versionId.value) ?? null
})

const boundActiveTaskCount = computed(() => {
  if (!editingId.value || isVersionView.value) return 0
  return countWorkflowBoundTasks(store.tasks, editingId.value)
})

/** 详情/版本快照只读，或绑定进行中任务时不可改节点 */
const nodesLocked = computed(() => isViewMode.value || boundActiveTaskCount.value > 0)

const setupStep = ref<'basic' | 'canvas'>('basic')
const selectedNodeId = ref('')
const settingsVisible = ref(false)

const form = ref({
  name: '',
  description: '',
  enterpriseScope: 'all' as WorkflowEnterpriseScope,
  enterpriseIds: [] as string[],
  status: 'disabled' as 'enabled' | 'disabled',
  nodes: [] as WorkflowNode[],
  fields: [] as WorkflowFieldConfig[],
})

const enterpriseOptions = computed(() =>
  store.enterprises.filter((e) => e.status !== 'terminated').map((e) => ({ value: e.id, label: e.name })),
)

/** 草稿或新建：可保存；已启用：仅可发布；详情页只读 */
const canSaveDraft = computed(
  () => !isViewMode.value && (!isEdit.value || form.value.status === 'disabled'),
)
const canPublish = computed(() => !isViewMode.value)
const isPublished = computed(() => isEdit.value && form.value.status === 'enabled')

const selectedNode = computed(() =>
  form.value.nodes.find((n) => n.id === selectedNodeId.value) ?? null,
)

function normalizeNodes(nodes: WorkflowNode[]): WorkflowNode[] {
  const normalized = nodes.map((n) =>
    normalizeWorkflowNode({ ...n, actions: n.actions.map((a) => ({ ...a })) }, nodes),
  )
  return ensureNodePositions(normalized)
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

function defaultFields(): WorkflowFieldConfig[] {
  return []
}

function initDefaultNodes() {
  const startId = generateId('node')
  form.value.nodes = normalizeNodes([
    {
      id: startId,
      name: '领取任务',
      stageLabel: '领取阶段',
      nodeType: 'start',
      role: 'worker',
      visibleRoles: ['worker', 'enterprise', 'operator'],
      actions: [
        {
          action: 'confirm',
          label: '确认领取',
          allowedRoles: ['worker'],
        },
      ],
      sort: 0,
    },
  ])
  selectedNodeId.value = startId
}

function loadForm() {
  if (isEdit.value && existing.value) {
    setupStep.value = 'canvas'
    let wf: TaskWorkflow = existing.value
    if (isVersionView.value) {
      if (!viewingVersion.value) {
        ElMessage.error('版本不存在')
        router.replace(`/task-workflows/${editingId.value}`)
        return
      }
      wf = workflowFromVersionSnapshot(existing.value, viewingVersion.value)
    }
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
    if (!isViewMode.value && boundActiveTaskCount.value > 0) {
      ElMessage.warning(
        `该工作流有 ${boundActiveTaskCount.value} 个进行中任务，节点与流转不可修改`,
      )
    }
    selectedNodeId.value = form.value.nodes[0]?.id ?? ''
    return
  }
  if (isEdit.value && !existing.value) {
    ElMessage.error('工作流不存在')
    router.replace('/task-workflows')
    return
  }
  setupStep.value = 'basic'
  form.value = {
    name: '',
    description: '',
    enterpriseScope: 'all',
    enterpriseIds: [],
    status: 'disabled',
    nodes: [],
    fields: defaultFields(),
  }
  selectedNodeId.value = ''
}

watch(
  [editingId, versionId, isViewMode, isVersionView, () => store.taskWorkflows.length],
  loadForm,
  { immediate: true },
)

watch(
  () => form.value.enterpriseScope,
  (scope) => {
    if (scope === 'all') form.value.enterpriseIds = []
  },
)

watch(
  () => form.value.nodes,
  (nodes) => {
    if (!nodes.some((n) => n.id === selectedNodeId.value)) {
      selectedNodeId.value = nodes[0]?.id ?? ''
    }
    nodes.forEach((n, i) => {
      n.sort = i
    })
  },
  { deep: true },
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
    return { ...n, id: newId, sort: i, actions: n.actions.map((a) => ({ ...a })) }
  })
  nodes.forEach((n) => {
    if (n.timeoutTargetNodeId && idMap.has(n.timeoutTargetNodeId)) {
      n.timeoutTargetNodeId = idMap.get(n.timeoutTargetNodeId)
    }
    n.actions.forEach((a) => {
      if (a.targetNodeId && idMap.has(a.targetNodeId)) a.targetNodeId = idMap.get(a.targetNodeId)
    })
    if (n.nodeType === 'end') n.triggerSettlement = true
    else n.triggerSettlement = false
  })
  form.value.nodes = normalizeNodes(nodes)
  if (tpl.fields?.length) {
    form.value.fields = tpl.fields.map((f) => ({
      ...f,
      id: generateId('field'),
      nodeIds: f.nodeIds.map((nid) => idMap.get(nid) ?? nid).filter((nid) => [...idMap.values()].includes(nid)),
    }))
  }
  selectedNodeId.value = form.value.nodes[0]?.id ?? ''
  ElMessage.success('已套用模板，可在画布上继续调整')
}

function onNodesUpdate(nodes: WorkflowNode[]) {
  form.value.nodes = nodes
}

function addFromPalette(key: string, position: { x: number; y: number }, connectFrom?: string) {
  if (nodesLocked.value) return
  const item = getPaletteItem(key)
  if (!item) return
  const err = validatePaletteDrop(item, form.value.nodes)
  if (err) {
    ElMessage.warning(err)
    return
  }
  const id = generateId('node')
  const partial = buildNodeFromPalette(item, id, position, form.value.nodes.length, form.value.nodes)
  const node = normalizeWorkflowNode(partial as WorkflowNode, form.value.nodes)
  let nodes: WorkflowNode[] = [...form.value.nodes, node]
  if (connectFrom) {
    nodes = upsertWorkflowConnection(nodes, connectFrom, id)
  }
  form.value.nodes = nodes
  selectedNodeId.value = id
  ElMessage.success(connectFrom ? `已添加${item.name}并建立流转` : `已添加${item.name}，单击节点进行配置`)
}

function selectNode(id: string) {
  selectedNodeId.value = id
}

function onRemoveNode(nodeId: string) {
  if (nodesLocked.value) return
  const node = form.value.nodes.find((n) => n.id === nodeId)
  if (!node) return
  const err = canRemoveWorkflowNode(node)
  if (err) {
    ElMessage.warning(err)
    return
  }
  form.value.nodes = removeWorkflowNode(form.value.nodes, nodeId)
  form.value.fields = form.value.fields.filter((f) => !f.nodeIds.includes(nodeId))
  selectedNodeId.value = ''
  ElMessage.success('已删除节点')
}

function validateBasicForm() {
  if (!form.value.name.trim()) {
    ElMessage.warning('请输入流程名称')
    return false
  }
  if (form.value.enterpriseScope === 'specific' && !form.value.enterpriseIds.length) {
    ElMessage.warning('请选择适用企业')
    return false
  }
  return true
}

function enterCanvas() {
  if (!validateBasicForm()) return
  if (!form.value.nodes.length) {
    initDefaultNodes()
  } else {
    form.value.nodes = normalizeNodes(form.value.nodes)
    selectedNodeId.value =
      form.value.nodes.find((n) => n.nodeType === 'start')?.id ?? form.value.nodes[0]?.id ?? ''
  }
  setupStep.value = 'canvas'
}

function backToBasic() {
  setupStep.value = 'basic'
}

function validateForm() {
  if (!validateBasicForm()) return false
  if (!nodesLocked.value) {
    const starts = form.value.nodes.filter((n) => n.nodeType === 'start')
    const ends = form.value.nodes.filter((n) => n.nodeType === 'end')
    if (starts.length !== 1 || ends.length < 1) {
      ElMessage.warning('需包含一个起始节点和至少一个终止节点')
      return false
    }
    if (form.value.nodes.some((n) => !n.name.trim())) {
      ElMessage.warning('请填写所有节点名称')
      return false
    }
    for (const node of form.value.nodes) {
      if (node.nodeType === 'end') continue
      if (node.timeoutEnabled && (!node.timeoutHours || !node.timeoutTargetNodeId)) {
        ElMessage.warning(`节点「${node.name}」请完善超时规则`)
        return false
      }
      for (const action of node.actions) {
        if (!action.targetNodeId) {
          ElMessage.warning(
            `「${node.name}」的操作「${resolveWorkflowActionLabel(action)}」请配置目标节点`,
          )
          return false
        }
      }
    }
  }
  for (const field of form.value.fields) {
    if (!field.name.trim()) {
      ElMessage.warning('请填写所有采集字段名称')
      return false
    }
    if (!field.nodeIds.length) {
      ElMessage.warning('采集字段需绑定到节点')
      return false
    }
    if (field.fieldType === 'select' && (!field.options || !field.options.length)) {
      ElMessage.warning(`字段「${field.name}」请配置下拉选项`)
      return false
    }
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
    return { ...payload, nodes: prepareWorkflowNodesForSave(form.value.nodes) }
  }
  return payload
}

function save(asDraft = false) {
  if (isViewMode.value) return
  if (!validateForm()) return
  if (asDraft && isPublished.value) {
    ElMessage.warning('已发布流程不可保存为草稿，请直接发布新版本')
    return
  }
  const status = asDraft ? 'disabled' : 'enabled'
  const payload = buildPayload(status)
  try {
    if (isEdit.value && editingId.value) {
      if (asDraft) {
        store.updateTaskWorkflow(editingId.value, payload)
        form.value.status = 'disabled'
        ElMessage.success('已保存为草稿')
      } else {
        store.publishTaskWorkflow(editingId.value, payload, '配置发布')
        form.value.status = 'enabled'
        ElMessage.success('已发布新版本')
      }
    } else {
      store.addTaskWorkflow({
        ...payload,
        status,
      } as Omit<
        TaskWorkflow,
        'id' | 'version' | 'versions' | 'boundTaskTypeCount' | 'createdAt' | 'updatedAt'
      >)
      ElMessage.success(asDraft ? '草稿已保存' : '发布成功')
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
  <div v-if="setupStep === 'basic' && !isEdit" class="basic-setup page-card">
    <div class="page-header">
      <div>
        <h2 class="page-title">新建工作流</h2>
        <p class="text-muted">先填写基本信息，再进入画布配置节点与流转</p>
      </div>
    </div>
    <el-form label-width="96px" class="basic-form">
      <el-form-item label="流程名称" required>
        <el-input v-model="form.name" placeholder="如：标准验收流程" />
      </el-form-item>
      <el-form-item label="适用企业" required>
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
      </el-form-item>
      <el-form-item label="流程描述">
        <el-input v-model="form.description" type="textarea" :rows="3" placeholder="说明该流程的适用场景" />
      </el-form-item>
      <el-form-item label="套用模板">
        <div class="template-btns">
          <el-button
            v-for="(tpl, i) in workflowTemplates"
            :key="tpl.name"
            size="small"
            @click="applyTemplate(i)"
          >
            {{ tpl.name.replace('（模板）', '') }}
          </el-button>
        </div>
        <p v-if="form.nodes.length" class="text-muted template-hint">
          已套用模板（{{ form.nodes.length }} 个节点），进入画布后可继续调整
        </p>
      </el-form-item>
    </el-form>
    <div class="basic-actions">
      <el-button @click="cancel">取消</el-button>
      <el-button type="primary" @click="enterCanvas">进入画布配置</el-button>
    </div>
  </div>

  <div v-else class="workflow-studio">
    <header class="studio-header">
      <div class="header-title">
        <el-button
          v-if="!isEdit"
          link
          type="primary"
          class="back-basic-btn"
          @click="backToBasic"
        >
          ← 返回基本信息
        </el-button>
        <h2 class="page-title">
          {{ isVersionView ? '版本快照' : isViewMode ? '流程详情' : '任务流程配置' }}
          <span v-if="form.name" class="flow-name">· {{ form.name }}</span>
          <span v-if="viewingVersion" class="flow-name">
            · {{ formatWorkflowVersionLabel(viewingVersion.version) }}
          </span>
        </h2>
        <button type="button" class="link-btn" @click="settingsVisible = true">流程设置</button>
      </div>
      <div class="header-actions">
        <el-button @click="cancel">{{ isViewMode ? '返回' : '取消' }}</el-button>
        <el-button v-if="canSaveDraft" @click="save(true)">保存</el-button>
        <el-button v-if="canPublish" type="primary" @click="save(false)">发布</el-button>
      </div>
    </header>

    <el-alert
      v-if="isVersionView && viewingVersion"
      type="info"
      show-icon
      :closable="false"
      class="lock-alert"
    >
      正在查看 {{ formatWorkflowVersionLabel(viewingVersion.version) }} 历史快照（只读）
      <template v-if="viewingVersion.isActive"> · 当前生效版本</template>
    </el-alert>
    <el-alert
      v-else-if="isViewMode"
      type="info"
      show-icon
      :closable="false"
      class="lock-alert"
    >
      当前为查看模式，仅可浏览流程配置
    </el-alert>
    <el-alert
      v-else-if="boundActiveTaskCount > 0"
      type="warning"
      show-icon
      :closable="false"
      class="lock-alert"
    >
      已绑定 {{ boundActiveTaskCount }} 个进行中任务，节点与流转不可修改；待任务结束后可编辑并发布新版本
    </el-alert>

    <div class="coze-studio">
      <WorkflowNodePalette :readonly="nodesLocked" />
      <WorkflowDesignCanvas
        :nodes="form.nodes"
        :workflow-fields="form.fields"
        :selected-node-id="selectedNodeId"
        mode="config"
        :readonly="nodesLocked"
        @update:nodes="onNodesUpdate"
        @select-node="selectNode"
        @remove-node="onRemoveNode"
        @add-from-palette="addFromPalette"
      />
      <aside class="studio-side fields-side">
        <WorkflowNodeConfigPanel
          :node="selectedNode"
          :all-nodes="form.nodes"
          :workflow-fields="form.fields"
          :readonly="nodesLocked"
          fields-only
        />
      </aside>
    </div>

    <el-dialog v-model="settingsVisible" title="流程设置" width="560px">
      <el-form label-width="96px">
        <el-form-item label="流程名称" required>
          <el-input v-model="form.name" placeholder="如：盘点任务流程" :disabled="isViewMode" />
        </el-form-item>
        <el-form-item label="适用企业" required>
          <el-radio-group v-model="form.enterpriseScope" :disabled="isViewMode">
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
            :disabled="isViewMode"
          >
            <el-option v-for="opt in enterpriseOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
        </el-form-item>
        <el-form-item label="流程描述">
          <el-input v-model="form.description" type="textarea" :rows="2" :disabled="isViewMode" />
        </el-form-item>
        <el-form-item v-if="!isEdit && setupStep === 'canvas'" label="套用模板">
          <el-button
            v-for="(tpl, i) in workflowTemplates"
            :key="tpl.name"
            size="small"
            :disabled="nodesLocked"
            @click="applyTemplate(i)"
          >
            {{ tpl.name.replace('（模板）', '') }}
          </el-button>
        </el-form-item>
      </el-form>
    </el-dialog>
  </div>
</template>

<style scoped>
.basic-setup {
  max-width: 720px;
}

.basic-form {
  margin-top: 8px;
}

.basic-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #ebeef5;
}

.template-btns {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.template-hint {
  margin: 8px 0 0;
  font-size: 12px;
}

.back-basic-btn {
  margin-right: 4px;
  padding: 0;
}

.workflow-studio {
  padding: 0 4px 24px;
  display: flex;
  flex-direction: column;
  min-height: calc(100vh - 120px);
}

.studio-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-bottom: 8px;
  padding: 8px 4px 0;
}

.header-title {
  display: flex;
  align-items: baseline;
  gap: 12px;
}

.flow-name {
  font-size: 16px;
  font-weight: 500;
  color: #6b7280;
}

.link-btn {
  border: none;
  background: none;
  color: #3b82f6;
  font-size: 12px;
  cursor: pointer;
  padding: 0;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.lock-alert {
  margin-bottom: 12px;
}

.basic-collapse {
  margin-bottom: 12px;
  border: 1px solid #ebeef5;
  border-radius: 8px;
  overflow: hidden;
}

.field-list {
  width: 100%;
}

.field-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}

.coze-studio {
  flex: 1;
  display: flex;
  min-height: 560px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  overflow: hidden;
  background: #fff;
}

.studio-side {
  width: 300px;
  flex-shrink: 0;
  border-left: 1px solid #e5e7eb;
  overflow: hidden;
  background: #fff;
}

.studio-side.fields-side {
  width: 400px;
}

.studio-side .config-panel {
  height: 100%;
}
</style>
