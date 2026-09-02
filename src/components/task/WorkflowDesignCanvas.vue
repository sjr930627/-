<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import { ElMessage } from 'element-plus'
import WorkflowNodeConfigPanel from '@/components/task/WorkflowNodeConfigPanel.vue'
import { getPaletteItem, isPaletteItemVisible, workflowPaletteItems } from '@/constants/workflowPalette'
import { workflowRoleMap } from '@/constants/task'
import type { WorkflowNode, WorkflowRole, WorkflowFieldConfig } from '@/types'
import {
  buildWorkflowFlowEdgeDetails,
  CANVAS_CARD_H,
  CANVAS_CARD_W,
  CANVAS_GRID_X,
  ensureNodePositions,
  getNodeDependencyLabel,
  isNodeVisibleToRole,
  removeWorkflowConnection,
  resolveWorkflowActionLabel,
  updateWorkflowConnectionLabel,
  updateWorkflowConnectionTarget,
  upsertWorkflowConnection,
} from '@/utils/workflow'
import { computeWorkflowEdgeLayouts } from '@/utils/workflowGraphLayout'

const props = withDefaults(
  defineProps<{
    nodes: WorkflowNode[]
    workflowFields?: WorkflowFieldConfig[]
    selectedNodeId?: string
    mode?: 'config' | 'preview' | 'trial'
    previewRole?: WorkflowRole
    readonly?: boolean
    trialStatus?: Record<string, 'running' | 'success' | 'waiting' | 'error'>
  }>(),
  {
    mode: 'config',
    previewRole: 'enterprise',
    trialStatus: () => ({}),
  },
)

const emit = defineEmits<{
  'update:nodes': [WorkflowNode[]]
  'select-node': [nodeId: string]
  'remove-node': [nodeId: string]
  'add-from-palette': [key: string, position: { x: number; y: number }, connectFrom?: string]
}>()

const FLOATING_PANEL_W = 340
const FLOATING_PANEL_MAX_H = 520

const canvasRef = ref<HTMLElement | null>(null)
/** 关闭悬浮节点配置时不取消选中，右侧采集字段栏仍可用 */
const floatingCollapsed = ref(false)
const hoveredNodeId = ref('')
const positionedNodes = computed(() => ensureNodePositions(props.nodes))
const edgeDetails = computed(() => buildWorkflowFlowEdgeDetails(props.nodes))
const nodeMap = computed(() => new Map(props.nodes.map((n) => [n.id, n])))

const edgeRenderItems = computed(() => {
  const layouts = computeWorkflowEdgeLayouts(positionedNodes.value, edgeDetails.value)
  return edgeDetails.value
    .map((detail, i) => ({ detail, layout: layouts[i] }))
    .filter((item) => item.layout.path)
})

const draggingNodeId = ref('')
const dragOffset = ref({ x: 0, y: 0 })
const connectFromId = ref('')
const connectCursor = ref({ x: 0, y: 0 })
const selectedEdgeKey = ref('')
const edgeEditor = ref({
  open: false,
  fromId: '',
  toId: '',
  originalToId: '',
  actionIndex: -1,
  label: '',
})
const edgeLabelEditor = ref({
  open: false,
  fromId: '',
  toId: '',
  actionIndex: -1,
  label: '',
  labelX: 0,
  labelY: 0,
  width: 80,
})
const labelInputRef = ref<HTMLInputElement | null>(null)
const addMenu = ref<{ nodeId: string; left: number; top: number } | null>(null)
const dropPreview = ref<{ x: number; y: number; key: string } | null>(null)

const addablePaletteItems = computed(() =>
  workflowPaletteItems.filter((item) => {
    if (!isPaletteItemVisible(item)) return false
    if (item.key === 'trigger_start') return !props.nodes.some((n) => n.nodeType === 'start')
    return true
  }),
)

const zoom = ref(1)
const MIN_ZOOM = 0.5
const MAX_ZOOM = 2
const ZOOM_STEP = 0.1
const viewportRef = ref<HTMLElement | null>(null)

const scalerStyle = computed(() => ({
  width: `${canvasSize.value.width * zoom.value}px`,
  height: `${canvasSize.value.height * zoom.value}px`,
}))

const stageStyle = computed(() => ({
  width: `${canvasSize.value.width}px`,
  height: `${canvasSize.value.height}px`,
  transform: `scale(${zoom.value})`,
  transformOrigin: '0 0',
}))

function zoomIn() {
  zoom.value = Math.min(MAX_ZOOM, +(zoom.value + ZOOM_STEP).toFixed(2))
}

function zoomOut() {
  zoom.value = Math.max(MIN_ZOOM, +(zoom.value - ZOOM_STEP).toFixed(2))
}

function resetZoom() {
  zoom.value = 1
}

function getCanvasScale() {
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect || !canvasSize.value.width) return zoom.value
  return rect.width / canvasSize.value.width
}

function getCanvasPoint(e: MouseEvent) {
  const rect = canvasRef.value?.getBoundingClientRect()
  if (!rect) return { x: 0, y: 0 }
  const scale = getCanvasScale()
  return {
    x: (e.clientX - rect.left) / scale,
    y: (e.clientY - rect.top) / scale,
  }
}

function onViewportWheel(e: WheelEvent) {
  if (!e.ctrlKey && !e.metaKey) return
  e.preventDefault()
  if (e.deltaY < 0) zoomIn()
  else zoomOut()
}

const connectionTargetOptions = computed(() =>
  props.nodes
    .filter((n) => n.id !== edgeEditor.value.fromId && n.name.trim())
    .map((n) => ({
      value: n.id,
      label: n.nodeType === 'end' ? `${n.name}（终止）` : n.name,
    })),
)

const canvasSize = computed(() => {
  let maxX = 800
  let maxY = 500
  for (const n of positionedNodes.value) {
    if (!n.position) continue
    maxX = Math.max(maxX, n.position.x + CANVAS_CARD_W + 80)
    maxY = Math.max(maxY, n.position.y + CANVAS_CARD_H + 120)
  }
  if (props.selectedNodeId && props.mode !== 'preview') {
    const sel = positionedNodes.value.find((n) => n.id === props.selectedNodeId)
    if (sel?.position) {
      maxX = Math.max(maxX, sel.position.x + CANVAS_CARD_W + FLOATING_PANEL_W + 48)
      maxY = Math.max(maxY, sel.position.y + FLOATING_PANEL_MAX_H + 48)
    }
  }
  return { width: maxX, height: maxY }
})

const selectedNode = computed(
  () => props.nodes.find((n) => n.id === props.selectedNodeId) ?? null,
)

const floatingPanelStyle = computed(() => {
  const n = positionedNodes.value.find((x) => x.id === props.selectedNodeId)
  if (!n?.position) return {}
  let left = n.position.x + CANVAS_CARD_W + 16
  if (left + FLOATING_PANEL_W > canvasSize.value.width - 16) {
    left = Math.max(8, n.position.x - FLOATING_PANEL_W - 16)
  }
  const top = Math.max(8, Math.min(n.position.y, canvasSize.value.height - FLOATING_PANEL_MAX_H - 16))
  return {
    left: `${left}px`,
    top: `${top}px`,
    width: `${FLOATING_PANEL_W}px`,
    maxHeight: `${FLOATING_PANEL_MAX_H}px`,
  }
})

function selectNode(id: string) {
  closeAddMenu()
  closeEdgeEditor()
  floatingCollapsed.value = false
  emit('select-node', id)
}

function closeFloatingPanel() {
  floatingCollapsed.value = true
}

function removeSelectedNode() {
  if (!props.selectedNodeId) return
  emit('remove-node', props.selectedNodeId)
}

function onNodeEnter(nodeId: string) {
  hoveredNodeId.value = nodeId
}

function onNodeLeave(nodeId: string) {
  if (hoveredNodeId.value === nodeId) hoveredNodeId.value = ''
}

function onCanvasClick(e: MouseEvent) {
  if (props.mode === 'preview') return
  const target = e.target as HTMLElement
  if (
    target.closest('.wf-card') ||
    target.closest('.floating-config') ||
    target.closest('.edge-editor') ||
    target.closest('.edge-label-editor') ||
    target.closest('.add-node-menu') ||
    target.closest('.node-add-btn') ||
    target.closest('.edge-add-hit') ||
    target.closest('.port')
  ) {
    return
  }
  closeEdgeEditor()
  closeEdgeLabelEditor()
  closeAddMenu()
}

function canEditEdgeLabel(fromId: string, actionIndex: number, kind: string) {
  if (kind !== 'action' || actionIndex < 0) return false
  const from = nodeMap.value.get(fromId)
  return from != null && from.nodeType !== 'start'
}

const edgeEditorActionEditable = computed(() =>
  canEditEdgeLabel(edgeEditor.value.fromId, edgeEditor.value.actionIndex, 'action'),
)

function edgeKey(fromId: string, toId: string, actionIndex: number) {
  return `${fromId}:${toId}:${actionIndex}`
}

function isEdgeSelected(fromId: string, toId: string, actionIndex: number) {
  return selectedEdgeKey.value === edgeKey(fromId, toId, actionIndex)
}

function selectEdge(fromId: string, toId: string, actionIndex: number, label: string) {
  if (props.readonly || props.mode !== 'config') return
  closeEdgeLabelEditor()
  selectedEdgeKey.value = edgeKey(fromId, toId, actionIndex)
  edgeEditor.value = { open: true, fromId, toId, originalToId: toId, actionIndex, label }
  closeAddMenu()
}

function closeEdgeLabelEditor() {
  edgeLabelEditor.value.open = false
}

function startEdgeLabelEdit(
  detail: { from: string; to: string; actionIndex: number; label: string; kind: string },
  layout: { labelX: number; labelY: number },
) {
  if (props.readonly || props.mode !== 'config') return
  if (!canEditEdgeLabel(detail.from, detail.actionIndex, detail.kind)) {
    if (detail.kind === 'action' && nodeMap.value.get(detail.from)?.nodeType === 'start') {
      ElMessage.info('开始节点的操作名称已固定')
    }
    return
  }
  closeEdgeEditor()
  const width = edgeLabelWidth(detail.label)
  edgeLabelEditor.value = {
    open: true,
    fromId: detail.from,
    toId: detail.to,
    actionIndex: detail.actionIndex,
    label: detail.label,
    labelX: layout.labelX,
    labelY: layout.labelY,
    width,
  }
  nextTick(() => labelInputRef.value?.focus())
}

function applyEdgeLabel() {
  if (!edgeLabelEditor.value.open) return
  const { fromId, actionIndex, label } = edgeLabelEditor.value
  const trimmed = label.trim()
  if (!trimmed) {
    ElMessage.warning('操作名称不能为空')
    labelInputRef.value?.focus()
    return
  }
  emit('update:nodes', updateWorkflowConnectionLabel(props.nodes, fromId, actionIndex, trimmed))
  closeEdgeLabelEditor()
  ElMessage.success('已更新操作名称')
}

function onEdgeLabelKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter') {
    e.preventDefault()
    applyEdgeLabel()
  } else if (e.key === 'Escape') {
    closeEdgeLabelEditor()
  }
}

function closeEdgeEditor() {
  selectedEdgeKey.value = ''
  edgeEditor.value.open = false
}

function applyEdgeTarget() {
  const { fromId, originalToId, toId, actionIndex, label } = edgeEditor.value
  if (!fromId || actionIndex < 0) return

  let nodes = props.nodes
  if (toId !== originalToId) {
    nodes = updateWorkflowConnectionTarget(nodes, fromId, actionIndex, toId)
  }
  if (edgeEditorActionEditable.value && label.trim()) {
    const currentLabel = props.nodes
      .find((n) => n.id === fromId)
      ?.actions[actionIndex]?.label?.trim()
    if (label.trim() !== currentLabel) {
      nodes = updateWorkflowConnectionLabel(nodes, fromId, actionIndex, label.trim())
    }
  }

  if (toId === originalToId && !edgeEditorActionEditable.value) {
    closeEdgeEditor()
    return
  }

  emit('update:nodes', nodes)
  closeEdgeEditor()
  ElMessage.success('已更新流转线')
}

function deleteSelectedEdge() {
  const { fromId, toId, actionIndex } = edgeEditor.value
  if (!fromId) return
  emit('update:nodes', removeWorkflowConnection(props.nodes, fromId, toId, actionIndex))
  closeEdgeEditor()
  ElMessage.success('已删除流转线')
}

function openAddMenu(node: WorkflowNode) {
  if (props.readonly || props.mode !== 'config' || node.nodeType === 'end') return
  if (!node.position) return
  openAddMenuAt(
    node.id,
    node.position.x + CANVAS_CARD_W + 28,
    node.position.y + CANVAS_CARD_H / 2 - 72,
  )
}

function closeAddMenu() {
  addMenu.value = null
}

function pickAddNodeType(key: string) {
  if (!addMenu.value) return
  const fromNode = props.nodes.find((n) => n.id === addMenu.value!.nodeId)
  if (!fromNode?.position) return
  const item = getPaletteItem(key)
  if (!item) return
  const position = {
    x: fromNode.position.x + CANVAS_GRID_X,
    y: fromNode.position.y,
  }
  emit('add-from-palette', key, position, addMenu.value.nodeId)
  closeAddMenu()
}

function isHovered(id: string) {
  return hoveredNodeId.value === id && !isSelected(id)
}

function isSelected(id: string) {
  return props.selectedNodeId === id
}

function isDimmed(node: WorkflowNode) {
  if (props.mode !== 'preview') return false
  return !isNodeVisibleToRole(node, props.previewRole)
}

function nodeCardStyle(node: WorkflowNode) {
  const p = node.position ?? { x: 0, y: 0 }
  return { left: `${p.x}px`, top: `${p.y}px`, width: `${CANVAS_CARD_W}px` }
}

function nodeTheme(node: WorkflowNode) {
  if (node.nodeType === 'start') return 'theme-start'
  if (node.nodeType === 'end') return 'theme-end'
  if ((node.entryConditionGroups?.length ?? 0) > 0 || node.actions.length > 1) return 'theme-branch'
  if (node.role === 'system') return 'theme-system'
  if (node.role === 'operator') return 'theme-cc'
  return 'theme-task'
}

function nodeHeaderIcon(node: WorkflowNode) {
  if (node.nodeType === 'start') return '▶'
  if (node.nodeType === 'end') return '■'
  if ((node.entryConditionGroups?.length ?? 0) > 0 || node.actions.length > 1) return '⋔'
  if (node.role === 'system') return '⚙'
  return '✓'
}

function nodeCategoryBadge(node: WorkflowNode) {
  if (node.nodeType === 'start') return '触发'
  if (node.nodeType === 'end') return '流程控制'
  if ((node.entryConditionGroups?.length ?? 0) > 0) return '进入条件'
  if (node.actions.length > 1) return '流程控制'
  if (node.role === 'system') return '系统'
  return '任务节点'
}

function nodeSummaryLines(node: WorkflowNode): [string, string] {
  if (node.nodeType === 'start') {
    return ['流程起点', node.stageLabel?.trim() || '任务创建后进入此节点']
  }
  if (node.nodeType === 'end') {
    return ['结束并触发结算', node.stageLabel?.trim() || '无后续节点']
  }
  const dep = getNodeDependencyLabel(node)
  if (dep) {
    return [`需满足：${dep}`, node.stageLabel?.trim() || `${workflowRoleMap[node.role]}处理`]
  }
  if (node.actions.length > 1) {
    return [
      node.stageLabel?.trim() || '多分支流转',
      node.actions.map((a) => resolveWorkflowActionLabel(a)).join(' · '),
    ]
  }
  if (node.actions.length === 1) {
    const target = props.nodes.find((n) => n.id === node.actions[0]?.targetNodeId)
    return [
      node.stageLabel?.trim() || `${workflowRoleMap[node.role]}处理`,
      target ? `流转 → ${target.name}` : `操作：${resolveWorkflowActionLabel(node.actions[0])}`,
    ]
  }
  return [node.stageLabel?.trim() || `${workflowRoleMap[node.role]}处理`, '拖连线或点 + 配置流转']
}

function edgeLabelWidth(label: string) {
  return Math.min(168, Math.max(56, label.length * 12 + 20))
}

function openAddMenuAt(fromId: string, left: number, top: number) {
  if (props.readonly || props.mode !== 'config') return
  closeEdgeEditor()
  addMenu.value = {
    nodeId: fromId,
    left,
    top: Math.max(8, top),
  }
}

function openAddMenuFromEdge(fromId: string, labelX: number, labelY: number) {
  openAddMenuAt(fromId, labelX + 12, labelY + 10)
}

function nodeStatusClass(node: WorkflowNode) {
  const trial = props.trialStatus[node.id]
  if (trial === 'running') return 'trial-running'
  if (trial === 'success') return 'trial-success'
  if (trial === 'waiting') return 'trial-waiting'
  if (trial === 'error') return 'trial-error'
  if (isSelected(node.id)) return 'selected'
  if (!node.name.trim()) return 'state-error'
  if (node.nodeType !== 'end' && !node.actions.length && !node.defaultNextNodeId) return 'state-warn'
  return ''
}

function getPortCenter(nodeId: string, side: 'in' | 'out') {
  const n = positionedNodes.value.find((x) => x.id === nodeId)
  if (!n?.position) return { x: 0, y: 0 }
  return {
    x: n.position.x + (side === 'in' ? 0 : CANVAS_CARD_W),
    y: n.position.y + CANVAS_CARD_H / 2,
  }
}

function onNodeMouseDown(node: WorkflowNode, e: MouseEvent) {
  if (props.readonly || props.mode === 'preview') return
  if ((e.target as HTMLElement).closest('.port')) return
  if (!node.position) return
  draggingNodeId.value = node.id
  const pt = getCanvasPoint(e)
  dragOffset.value = {
    x: pt.x - node.position.x,
    y: pt.y - node.position.y,
  }
  window.addEventListener('mousemove', onWindowMouseMove)
  window.addEventListener('mouseup', onWindowMouseUp)
}

function onWindowMouseMove(e: MouseEvent) {
  if (connectFromId.value) {
    const pt = getCanvasPoint(e)
    connectCursor.value = { x: pt.x, y: pt.y }
  }
  if (!draggingNodeId.value) return
  const pt = getCanvasPoint(e)
  const x = Math.max(0, Math.round((pt.x - dragOffset.value.x) / 20) * 20)
  const y = Math.max(0, Math.round((pt.y - dragOffset.value.y) / 20) * 20)
  const next = props.nodes.map((n) =>
    n.id === draggingNodeId.value ? { ...n, position: { x, y } } : n,
  )
  emit('update:nodes', next)
}

function onWindowMouseUp() {
  draggingNodeId.value = ''
  window.removeEventListener('mousemove', onWindowMouseMove)
  window.removeEventListener('mouseup', onWindowMouseUp)
}

function onPortOutMouseDown(nodeId: string, e: MouseEvent) {
  if (props.readonly || props.mode !== 'config') return
  e.stopPropagation()
  connectFromId.value = nodeId
  const rect = canvasRef.value?.getBoundingClientRect()
  const from = getPortCenter(nodeId, 'out')
  connectCursor.value = rect
    ? { x: from.x, y: from.y }
    : { x: from.x, y: from.y }
  window.addEventListener('mousemove', onConnectMove)
  window.addEventListener('mouseup', onConnectUp)
}

function onConnectMove(e: MouseEvent) {
  const pt = getCanvasPoint(e)
  connectCursor.value = { x: pt.x, y: pt.y }
}

function onConnectUp(e: MouseEvent) {
  window.removeEventListener('mousemove', onConnectMove)
  window.removeEventListener('mouseup', onConnectUp)
  if (!connectFromId.value) return
  const target = (e.target as HTMLElement).closest('[data-port-in]') as HTMLElement | null
  const toId = target?.getAttribute('data-port-in') ?? ''
  const fromId = connectFromId.value
  connectFromId.value = ''
  if (toId && toId !== fromId) {
    emit('update:nodes', upsertWorkflowConnection(props.nodes, fromId, toId))
    ElMessage.success('已建立流转')
    return
  }
  if (!target && canvasRef.value?.contains(e.target as Node)) {
    ElMessage.info('拖到目标节点左侧圆点以建立或修改流转')
  }
}

function onDragOver(e: DragEvent) {
  if (props.readonly) return
  e.preventDefault()
  const raw = e.dataTransfer?.getData('application/workflow-palette')
  if (!raw || !canvasRef.value) return
  try {
    const { key } = JSON.parse(raw) as { key: string }
    const pt = getCanvasPoint(e)
    dropPreview.value = {
      key,
      x: Math.round((pt.x - CANVAS_CARD_W / 2) / 20) * 20,
      y: Math.round((pt.y - CANVAS_CARD_H / 2) / 20) * 20,
    }
  } catch {
    dropPreview.value = null
  }
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  const raw = e.dataTransfer?.getData('application/workflow-palette')
  dropPreview.value = null
  if (!raw || !canvasRef.value || props.readonly) return
  try {
    const { key } = JSON.parse(raw) as { key: string }
    const item = getPaletteItem(key)
    if (!item || item.disabled) return
    const pt = getCanvasPoint(e)
    const position = {
      x: Math.max(0, Math.round((pt.x - CANVAS_CARD_W / 2) / 20) * 20),
      y: Math.max(0, Math.round((pt.y - CANVAS_CARD_H / 2) / 20) * 20),
    }
    emit('add-from-palette', key, position)
  } catch {
    /* ignore */
  }
}

const tempLine = computed(() => {
  if (!connectFromId.value) return ''
  const from = getPortCenter(connectFromId.value, 'out')
  const { x: tx, y: ty } = connectCursor.value
  return `M ${from.x} ${from.y} L ${tx} ${ty}`
})

onBeforeUnmount(() => {
  window.removeEventListener('mousemove', onWindowMouseMove)
  window.removeEventListener('mouseup', onWindowMouseUp)
  window.removeEventListener('mousemove', onConnectMove)
  window.removeEventListener('mouseup', onConnectUp)
})
</script>

<template>
  <div class="canvas-wrap">
    <div class="canvas-toolbar">
      <span>拖连线改流转 · 双击流转线标签改操作名 · 节点右侧 + 添加 · 单击节点/连线配置</span>
      <div class="zoom-controls">
        <button type="button" class="zoom-btn" title="缩小" @click="zoomOut">−</button>
        <span class="zoom-label">{{ Math.round(zoom * 100) }}%</span>
        <button type="button" class="zoom-btn" title="放大" @click="zoomIn">+</button>
        <button type="button" class="zoom-reset" @click="resetZoom">重置</button>
      </div>
    </div>
    <div
      ref="viewportRef"
      class="canvas-viewport"
      @wheel="onViewportWheel"
    >
      <div class="canvas-scaler" :style="scalerStyle">
        <div
          ref="canvasRef"
          class="canvas-stage"
          :style="stageStyle"
          @click="onCanvasClick"
          @dragover="onDragOver"
          @dragleave="dropPreview = null"
          @drop="onDrop"
        >
      <div class="grid-bg" aria-hidden="true" />

      <svg class="edge-layer" :width="canvasSize.width" :height="canvasSize.height">
        <defs>
          <marker id="wf-arrow-main" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <polygon points="0 0, 8 4, 0 8" fill="#94a3b8" />
          </marker>
          <marker id="wf-arrow-branch" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
            <polygon points="0 0, 8 4, 0 8" fill="#94a3b8" />
          </marker>
        </defs>
        <g
          v-for="item in edgeRenderItems"
          :key="`${item.detail.from}:${item.detail.to}:${item.detail.actionIndex}`"
          class="edge-group"
          :class="{
            selected: isEdgeSelected(item.detail.from, item.detail.to, item.detail.actionIndex),
            branch: item.detail.isBranch,
          }"
          @click.stop="
            selectEdge(item.detail.from, item.detail.to, item.detail.actionIndex, item.detail.label)
          "
        >
          <path
            :d="item.layout.path"
            class="edge-path"
            marker-end="url(#wf-arrow-main)"
          />
          <rect
            :x="item.layout.labelX - edgeLabelWidth(item.detail.label) / 2"
            :y="item.layout.labelY - 11"
            :width="edgeLabelWidth(item.detail.label)"
            height="20"
            rx="4"
            class="edge-label-bg"
            :class="{
              editable: canEditEdgeLabel(
                item.detail.from,
                item.detail.actionIndex,
                item.detail.kind,
              ),
            }"
            @dblclick.stop="
              startEdgeLabelEdit(item.detail, item.layout)
            "
          />
          <text
            :x="item.layout.labelX"
            :y="item.layout.labelY + 3"
            class="edge-label"
            :class="{
              editable: canEditEdgeLabel(
                item.detail.from,
                item.detail.actionIndex,
                item.detail.kind,
              ),
            }"
            text-anchor="middle"
            @dblclick.stop="
              startEdgeLabelEdit(item.detail, item.layout)
            "
          >
            {{ item.detail.label }}
          </text>
          <g
            v-if="mode === 'config' && !readonly && item.detail.isBranch"
            class="edge-add-hit"
            @click.stop="openAddMenuFromEdge(item.detail.from, item.layout.labelX, item.layout.labelY)"
          >
            <circle
              :cx="item.layout.labelX"
              :cy="item.layout.labelY + 18"
              r="10"
              class="edge-add-circle"
            />
            <text
              :x="item.layout.labelX"
              :y="item.layout.labelY + 22"
              class="edge-add-plus"
              text-anchor="middle"
            >
              +
            </text>
          </g>
        </g>
        <path v-if="tempLine" :d="tempLine" class="edge-temp" />
      </svg>

      <div
        v-if="edgeLabelEditor.open"
        class="edge-label-editor"
        :style="{
          left: `${edgeLabelEditor.labelX - edgeLabelEditor.width / 2}px`,
          top: `${edgeLabelEditor.labelY - 14}px`,
          width: `${edgeLabelEditor.width}px`,
        }"
      >
        <input
          ref="labelInputRef"
          v-model="edgeLabelEditor.label"
          class="edge-label-input"
          maxlength="32"
          @keydown="onEdgeLabelKeydown"
          @blur="applyEdgeLabel"
        />
      </div>

      <div
        v-if="dropPreview"
        class="drop-ghost"
        :style="{ left: `${dropPreview.x}px`, top: `${dropPreview.y}px` }"
      >
        {{ getPaletteItem(dropPreview.key)?.name }}
      </div>

      <div
        v-if="mode === 'config' && !selectedNodeId && !readonly"
        class="canvas-empty-hint"
      >
        单击节点配置流转；采集字段在右侧栏点击「+ 添加字段」
      </div>

      <div
        v-for="node in positionedNodes"
        :key="node.id"
        class="wf-card"
        :class="[
          nodeTheme(node),
          nodeStatusClass(node),
          {
            dimmed: isDimmed(node),
            dragging: draggingNodeId === node.id,
            hovered: isHovered(node.id),
            'config-mode': mode === 'config' && !readonly,
          },
        ]"
        :style="nodeCardStyle(node)"
        :data-node-id="node.id"
        @mouseenter="onNodeEnter(node.id)"
        @mouseleave="onNodeLeave(node.id)"
        @mousedown="onNodeMouseDown(node, $event)"
        @click.stop="selectNode(node.id)"
      >
        <span v-if="trialStatus[node.id] === 'success'" class="trial-badge ok">✓</span>
        <span v-else-if="trialStatus[node.id] === 'error'" class="trial-badge err">✕</span>
        <span v-else-if="trialStatus[node.id] === 'waiting'" class="trial-badge wait">⏳</span>

        <div class="card-header">
          <span class="header-icon">{{ nodeHeaderIcon(node) }}</span>
          <span class="header-title">{{ node.name || '未命名' }}</span>
          <span class="header-badge">{{ nodeCategoryBadge(node) }}</span>
        </div>
        <div class="card-body">
          <p>{{ nodeSummaryLines(node)[0] }}</p>
          <p>{{ nodeSummaryLines(node)[1] }}</p>
        </div>

        <button
          type="button"
          class="port port-in"
          :data-port-in="node.id"
          title="入口"
          @mousedown.stop
        />
        <button
          v-if="node.nodeType !== 'end' && mode === 'config' && !readonly"
          type="button"
          class="port port-out"
          title="拖出连线"
          @mousedown="onPortOutMouseDown(node.id, $event)"
        />

        <button
          v-if="node.nodeType !== 'end' && mode === 'config' && !readonly && (isHovered(node.id) || isSelected(node.id))"
          type="button"
          class="node-add-btn"
          title="添加下一节点"
          @click.stop="openAddMenu(node)"
          @mousedown.stop
        >
          +
        </button>
      </div>

      <div
        v-if="addMenu && mode === 'config' && !readonly"
        class="add-node-menu"
        :style="{ left: `${addMenu.left}px`, top: `${addMenu.top}px` }"
        @click.stop
        @mousedown.stop
      >
        <header class="add-menu-head">选择节点类型</header>
        <button
          v-for="item in addablePaletteItems"
          :key="item.key"
          type="button"
          class="add-menu-item"
          @click="pickAddNodeType(item.key)"
        >
          <span>{{ item.icon }}</span>
          <span>
            <strong>{{ item.name }}</strong>
            <small>{{ item.description }}</small>
          </span>
        </button>
      </div>

      <div
        v-if="selectedNode && mode !== 'preview' && !floatingCollapsed"
        class="floating-config"
        :style="floatingPanelStyle"
        @click.stop
        @mousedown.stop
      >
        <WorkflowNodeConfigPanel
          :node="selectedNode"
          :all-nodes="nodes"
          :workflow-fields="workflowFields"
          :readonly="readonly"
          floating
          @close="closeFloatingPanel"
          @remove="removeSelectedNode"
        />
      </div>

      <button
        v-if="selectedNode && mode !== 'preview' && floatingCollapsed"
        type="button"
        class="reopen-floating-btn"
        :style="floatingPanelStyle"
        @click.stop="floatingCollapsed = false"
      >
        打开节点配置
      </button>

        </div>
      </div>
    </div>

    <div v-if="edgeEditor.open && mode === 'config' && !readonly" class="edge-editor">
      <h4>流转线路</h4>
      <p>
        {{ nodeMap.get(edgeEditor.fromId)?.name }} → {{ nodeMap.get(edgeEditor.originalToId)?.name }}
      </p>
      <template v-if="edgeEditorActionEditable">
        <label class="edge-field-label">操作名称</label>
        <input v-model="edgeEditor.label" class="popover-input" maxlength="32" />
      </template>
      <p v-else-if="edgeEditor.label" class="edge-label-readonly">{{ edgeEditor.label }}</p>
      <label class="edge-field-label">流转目标</label>
      <select v-model="edgeEditor.toId" class="popover-input">
        <option v-for="opt in connectionTargetOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
      <div class="popover-actions">
        <button type="button" class="danger" @click="deleteSelectedEdge">删除连线</button>
        <button type="button" @click="closeEdgeEditor">取消</button>
        <button type="button" class="primary" @click="applyEdgeTarget">确定</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.canvas-wrap {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: #eef1f5;
  position: relative;
}

.canvas-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 14px;
  font-size: 12px;
  color: #64748b;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
}

.zoom-controls {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.zoom-btn,
.zoom-reset {
  border: 1px solid #e2e8f0;
  background: #fff;
  border-radius: 6px;
  min-width: 28px;
  height: 28px;
  font-size: 14px;
  line-height: 1;
  cursor: pointer;
  color: #475569;
}

.zoom-reset {
  padding: 0 10px;
  font-size: 12px;
  min-width: auto;
}

.zoom-label {
  min-width: 42px;
  text-align: center;
  font-variant-numeric: tabular-nums;
  color: #334155;
}

.canvas-viewport {
  flex: 1;
  overflow: auto;
  min-height: 420px;
}

.canvas-scaler {
  position: relative;
}

.canvas-stage {
  position: relative;
}

.grid-bg {
  position: absolute;
  inset: 0;
  background-image: radial-gradient(#cbd5e1 1px, transparent 1px);
  background-size: 18px 18px;
  opacity: 0.55;
  pointer-events: none;
}

.edge-layer {
  position: absolute;
  inset: 0;
  z-index: 1;
}

.edge-group {
  cursor: pointer;
}

.edge-group .edge-path {
  pointer-events: stroke;
  fill: none;
  stroke: #cbd5e1;
  stroke-width: 2;
  transition: stroke 0.15s, stroke-width 0.15s;
}

.edge-group:hover .edge-path,
.edge-group.selected .edge-path {
  stroke: #64748b;
  stroke-width: 2.5;
}

.edge-label-bg {
  fill: #fff;
  stroke: #e2e8f0;
  stroke-width: 1;
  pointer-events: all;
  cursor: default;
}

.edge-label-bg.editable {
  cursor: text;
}

.edge-label {
  pointer-events: all;
  font-size: 10px;
  fill: #64748b;
  font-weight: 500;
  cursor: default;
}

.edge-label.editable {
  cursor: text;
}

.edge-label-editor {
  position: absolute;
  z-index: 6;
  height: 28px;
}

.edge-label-input {
  width: 100%;
  height: 28px;
  border: 1px solid #3b82f6;
  border-radius: 4px;
  padding: 0 6px;
  font-size: 11px;
  color: #475569;
  background: #fff;
  box-shadow: 0 2px 8px rgba(59, 130, 246, 0.2);
  outline: none;
  box-sizing: border-box;
}

.edge-label-readonly {
  margin: 0 0 10px;
  font-size: 12px;
  color: #374151;
}

.edge-group.selected .edge-label {
  fill: #334155;
  font-weight: 600;
}

.edge-add-hit {
  cursor: pointer;
}

.edge-add-circle {
  fill: #fff;
  stroke: #cbd5e1;
  stroke-width: 1.5;
  pointer-events: all;
}

.edge-add-hit:hover .edge-add-circle {
  fill: #6366f1;
  stroke: #6366f1;
}

.edge-add-plus {
  font-size: 14px;
  fill: #64748b;
  font-weight: 600;
  pointer-events: none;
}

.edge-add-hit:hover .edge-add-plus {
  fill: #fff;
}

.edge-temp {
  fill: none;
  stroke: #6366f1;
  stroke-width: 2;
  stroke-dasharray: 6 4;
  pointer-events: none;
}

.drop-ghost {
  position: absolute;
  width: 220px;
  height: 116px;
  border: 2px dashed #6366f1;
  border-radius: 10px;
  background: rgba(99, 102, 241, 0.06);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 13px;
  color: #6366f1;
  z-index: 2;
  pointer-events: none;
}

.wf-card {
  position: absolute;
  z-index: 3;
  height: 116px;
  border-radius: 10px;
  background: #fff;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
  cursor: grab;
  transition: box-shadow 0.15s, transform 0.15s;
  user-select: none;
  overflow: visible;
  border: 2px solid transparent;
}

.wf-card.config-mode {
  cursor: pointer;
}

.wf-card:hover,
.wf-card.hovered {
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.12);
  transform: translateY(-1px);
}

.wf-card.selected {
  border-color: #6366f1;
  box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.18), 0 8px 20px rgba(15, 23, 42, 0.12);
  z-index: 4;
}

.wf-card.state-warn {
  border-color: #fcd34d;
}

.wf-card.state-error {
  border-color: #fca5a5;
}

.wf-card.dragging {
  cursor: grabbing;
  z-index: 5;
}

.card-header {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 36px;
  padding: 0 10px;
  border-radius: 8px 8px 0 0;
  color: #fff;
}

.header-icon {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.22);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  line-height: 1;
}

.header-title {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.header-badge {
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.22);
  font-size: 10px;
  font-weight: 500;
}

.theme-start .card-header {
  background: linear-gradient(135deg, #22c55e, #16a34a);
}

.theme-end .card-header {
  background: linear-gradient(135deg, #f87171, #dc2626);
}

.theme-task .card-header {
  background: linear-gradient(135deg, #60a5fa, #2563eb);
}

.theme-branch .card-header {
  background: linear-gradient(135deg, #fbbf24, #d97706);
}

.theme-system .card-header {
  background: linear-gradient(135deg, #a78bfa, #7c3aed);
}

.theme-cc .card-header {
  background: linear-gradient(135deg, #2dd4bf, #0d9488);
}

.card-body {
  padding: 8px 10px 10px;
  height: calc(100% - 36px);
  box-sizing: border-box;
}

.card-body p {
  margin: 0;
  font-size: 11px;
  line-height: 1.45;
  color: #64748b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-body p + p {
  margin-top: 4px;
  color: #94a3b8;
}

.wf-card.trial-running {
  animation: pulse 1s infinite;
}

.wf-card.dimmed {
  opacity: 0.35;
}

@keyframes pulse {
  50% {
    box-shadow: 0 0 0 6px rgba(251, 191, 36, 0.2);
  }
}

.trial-badge {
  position: absolute;
  top: -8px;
  right: 10px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  color: #fff;
  z-index: 2;
}

.trial-badge.ok {
  background: #10b981;
}

.trial-badge.err {
  background: #ef4444;
}

.trial-badge.wait {
  background: #f59e0b;
}

.port {
  position: absolute;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid #cbd5e1;
  background: #fff;
  padding: 0;
  top: 50%;
  transform: translateY(-50%);
  cursor: crosshair;
  z-index: 2;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.12);
  transition: border-color 0.15s, transform 0.15s;
}

.port-in {
  left: -7px;
}

.port-out {
  right: -7px;
}

.wf-card:hover .port,
.wf-card.selected .port {
  border-color: #94a3b8;
}

.port-out:hover {
  border-color: #6366f1;
  transform: translateY(-50%) scale(1.12);
}

.canvas-empty-hint {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  padding: 16px 24px;
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.92);
  border: 1px dashed #c7d2fe;
  color: #6366f1;
  font-size: 14px;
  pointer-events: none;
  z-index: 0;
}

.floating-config {
  position: absolute;
  z-index: 6;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 16px 48px rgba(15, 23, 42, 0.14);
  border: 1px solid #e5e7eb;
  background: #fff;
}

.reopen-floating-btn {
  position: absolute;
  z-index: 5;
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid #dbeafe;
  background: #eff6ff;
  color: #2563eb;
  font-size: 12px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.12);
}

.reopen-floating-btn:hover {
  background: #dbeafe;
}

.node-add-btn {
  position: absolute;
  right: -36px;
  top: 50%;
  transform: translateY(-50%);
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 2px solid #6366f1;
  background: #fff;
  color: #6366f1;
  font-size: 18px;
  line-height: 1;
  cursor: pointer;
  z-index: 3;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(99, 102, 241, 0.25);
  transition: transform 0.15s, background 0.15s;
}

.node-add-btn:hover {
  background: #6366f1;
  color: #fff;
  transform: translateY(-50%) scale(1.08);
}

.add-node-menu {
  position: absolute;
  z-index: 8;
  width: 220px;
  background: #fff;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.12);
  overflow: hidden;
}

.add-menu-head {
  padding: 10px 12px;
  font-size: 12px;
  font-weight: 600;
  color: #374151;
  border-bottom: 1px solid #f3f4f6;
  background: #fafafa;
}

.add-menu-item {
  display: flex;
  gap: 8px;
  width: 100%;
  border: none;
  background: #fff;
  padding: 10px 12px;
  text-align: left;
  cursor: pointer;
  transition: background 0.15s;
}

.add-menu-item:hover {
  background: #f8fafc;
}

.add-menu-item strong {
  display: block;
  font-size: 12px;
  color: #111827;
}

.add-menu-item small {
  display: block;
  margin-top: 2px;
  font-size: 10px;
  color: #9ca3af;
}

.edge-editor {
  position: absolute;
  right: 24px;
  bottom: 24px;
  width: 280px;
  background: #fff;
  border-radius: 12px;
  padding: 14px;
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.12);
  z-index: 10;
}

.edge-editor h4 {
  margin: 0 0 8px;
  font-size: 14px;
}

.edge-editor p {
  margin: 0 0 10px;
  font-size: 12px;
  color: #6b7280;
}

.edge-field-label {
  display: block;
  font-size: 11px;
  color: #909399;
  margin-bottom: 4px;
}

.popover-input {
  width: 100%;
  margin-bottom: 8px;
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  padding: 6px 8px;
  font-size: 12px;
}

.popover-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.popover-actions button {
  border: 1px solid #e5e7eb;
  background: #fff;
  border-radius: 6px;
  padding: 5px 12px;
  font-size: 12px;
  cursor: pointer;
}

.popover-actions .primary {
  background: #3b82f6;
  border-color: #3b82f6;
  color: #fff;
}

.popover-actions .danger {
  color: #ef4444;
  border-color: #fecaca;
}
</style>
