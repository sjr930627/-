import {
  workflowActionMap,
  workflowEntryConditionTypeMap,
  workflowEntryListenTargetMap,
  workflowEntryTimeoutActionMap,
  workflowEventNameOptions,
  workflowEventSourceMap,
  workflowPrerequisiteMap,
  workflowPunchCountModeMap,
  workflowPunchLocationSourceMap,
  workflowPunchMethodMap,
  workflowPunchNavigateModeMap,
  workflowPunchTimeSourceMap,
} from '@/constants/task'
import type {
  WorkflowAction,
  WorkflowActionConfig,
  WorkflowEntryConditionGroup,
  WorkflowNode,
  WorkflowRole,
} from '@/types'
import { generateId } from '@/utils'

export const WORKFLOW_ROLES: WorkflowRole[] = ['enterprise', 'worker', 'operator', 'system']

/** 流程开始节点固定名称 */
export const WORKFLOW_FIXED_START_NODE_NAME = '领取任务'
export const WORKFLOW_FIXED_START_STAGE_LABEL = '领取阶段'
export const WORKFLOW_FIXED_START_ACTION_LABEL = '确认领取'

export function applyFixedStartNodeDefaults(node: WorkflowNode, allNodes: WorkflowNode[]): WorkflowNode {
  if (node.nodeType !== 'start') return node

  const existingTarget =
    node.actions.find((a) => a.targetNodeId)?.targetNodeId ??
    node.defaultNextNodeId ??
    suggestActionTargetNodeId(node, 'confirm', allNodes)

  const first = node.actions[0]

  return {
    ...node,
    name: WORKFLOW_FIXED_START_NODE_NAME,
    stageLabel: WORKFLOW_FIXED_START_STAGE_LABEL,
    role: 'worker',
    visibleRoles: node.visibleRoles?.length ? [...node.visibleRoles] : [...WORKFLOW_ROLES],
    actions: [
      {
        ...first,
        action: 'confirm',
        label: WORKFLOW_FIXED_START_ACTION_LABEL,
        allowedRoles: ['worker'],
        targetNodeId: existingTarget,
        triggerType: first?.triggerType ?? 'manual',
      },
    ],
  }
}

export function getNodeVisibleRoles(node: WorkflowNode): WorkflowRole[] {
  return node.visibleRoles?.length ? [...node.visibleRoles] : [...WORKFLOW_ROLES]
}

export function isNodeVisibleToRole(node: WorkflowNode, role: WorkflowRole): boolean {
  return getNodeVisibleRoles(node).includes(role)
}

export function getActionAllowedRoles(
  action: WorkflowActionConfig,
  node: WorkflowNode,
): WorkflowRole[] {
  return action.allowedRoles?.length ? [...action.allowedRoles] : [node.role]
}

export function isActionAllowedForRole(
  action: WorkflowActionConfig,
  node: WorkflowNode,
  role: WorkflowRole,
): boolean {
  return getActionAllowedRoles(action, node).includes(role)
}

export function resolveWorkflowActionLabel(action: WorkflowActionConfig): string {
  if (action.label?.trim()) return action.label.trim()
  const normalized = action.action === 'approve' ? 'confirm' : action.action
  return workflowActionMap[normalized]
}

export function formatTransitionPrerequisite(
  action: WorkflowActionConfig,
  node?: WorkflowNode,
): string {
  if (action.prerequisiteNote?.trim()) return action.prerequisiteNote.trim()
  const keys = node?.prerequisites ?? []
  if (!keys.length) return '—'
  return keys.map((k) => workflowPrerequisiteMap[k]).join('、')
}

export function getNodeFollowUpSummary(node: WorkflowNode, nodes: WorkflowNode[]): string {
  if (node.nodeType === 'end') return '—'
  const names = node.actions
    .map((a) => getNodeById(nodes, a.targetNodeId ?? '')?.name)
    .filter((name): name is string => Boolean(name?.trim()))
  if (node.timeoutEnabled && node.timeoutTargetNodeId) {
    const timeoutName = getNodeById(nodes, node.timeoutTargetNodeId)?.name
    if (timeoutName) names.push(`${timeoutName}(超时)`)
  }
  return names.length ? names.join('、') : '—'
}

export function sortedWorkflowNodes(nodes: WorkflowNode[]): WorkflowNode[] {
  return [...nodes].sort((a, b) => a.sort - b.sort)
}

export function getNodeById(nodes: WorkflowNode[], nodeId: string): WorkflowNode | undefined {
  return nodes.find((n) => n.id === nodeId)
}

export function getDefaultNextNodeId(node: WorkflowNode, nodes: WorkflowNode[]): string | undefined {
  if (node.defaultNextNodeId) return node.defaultNextNodeId
  const sorted = sortedWorkflowNodes(nodes)
  const index = sorted.findIndex((n) => n.id === node.id)
  if (index < 0 || index >= sorted.length - 1) return undefined
  return sorted[index + 1]?.id
}

export function getCancelledEndNode(nodes: WorkflowNode[]): WorkflowNode | undefined {
  return sortedWorkflowNodes(nodes).find(
    (n) => n.nodeType === 'end' && (n.name.includes('取消') || n.name.includes('关闭')),
  )
}

export function resolveCancelEndNode(nodes: WorkflowNode[]): WorkflowNode | undefined {
  return getCancelledEndNode(nodes) ?? sortedWorkflowNodes(nodes).find((n) => n.nodeType === 'end')
}

export function suggestActionTargetNodeId(
  node: WorkflowNode,
  action: WorkflowAction,
  nodes: WorkflowNode[],
): string | undefined {
  const sorted = sortedWorkflowNodes(nodes)
  if (action === 'cancel' || action === 'reject') {
    return getCancelledEndNode(nodes)?.id ?? sorted.find((n) => n.nodeType === 'end')?.id
  }
  if (action === 'transfer') {
    return node.id
  }
  return getDefaultNextNodeId(node, nodes)
}

export function getActionConfig(node: WorkflowNode, action: WorkflowAction): WorkflowActionConfig | undefined {
  if (action === 'confirm') {
    return node.actions.find((a) => a.action === 'confirm' || a.action === 'approve')
  }
  return node.actions.find((a) => a.action === action)
}

export function nodeHasAction(node: WorkflowNode, action: WorkflowAction): boolean {
  return Boolean(getActionConfig(node, action))
}

export function toggleNodeAction(node: WorkflowNode, action: WorkflowAction, nodes: WorkflowNode[]): void {
  if (node.nodeType === 'end') return

  if (action === 'confirm') {
    const idx = node.actions.findIndex((a) => a.action === 'confirm' || a.action === 'approve')
    if (idx >= 0) {
      node.actions.splice(idx, 1)
    } else {
      node.actions.push({
        action: 'confirm',
        targetNodeId: suggestActionTargetNodeId(node, 'confirm', nodes),
      })
    }
    return
  }

  const idx = node.actions.findIndex((a) => a.action === action)
  if (idx >= 0) {
    node.actions.splice(idx, 1)
  } else {
    node.actions.push({
      action,
      targetNodeId: suggestActionTargetNodeId(node, action, nodes),
    })
  }
}

export function resolveActionTargetNodeId(
  node: WorkflowNode,
  action: WorkflowAction,
  nodes: WorkflowNode[],
): string | undefined {
  const config = getActionConfig(node, action)
  if (!config) return undefined
  return config.targetNodeId ?? suggestActionTargetNodeId(node, action, nodes)
}

export function normalizeWorkflowNode(node: WorkflowNode, allNodes: WorkflowNode[] = []): WorkflowNode {
  if (node.nodeType === 'end') {
    return {
      ...node,
      actions: [],
      timeoutEnabled: false,
      timeoutHours: undefined,
      timeoutTargetNodeId: undefined,
      triggerSettlement: true,
    }
  }

  const prerequisites = new Set(node.prerequisites ?? [])
  for (const action of node.actions) {
    if (action.requireProof) prerequisites.add('upload_file')
    if (action.requireSignature) prerequisites.add('customer_signature')
    if (action.requireTraining) prerequisites.add('related_training')
  }

  const actions = node.actions.map((a) => ({
    ...a,
    action: a.action === 'approve' ? 'confirm' : a.action,
    targetNodeId: a.targetNodeId ?? suggestActionTargetNodeId(node, a.action === 'approve' ? 'confirm' : a.action, allNodes),
    allowedRoles: a.allowedRoles?.length ? [...a.allowedRoles] : [node.role],
    triggerType: a.triggerType ?? 'manual',
  }))

  const notifySms = node.notifySms ?? node.actions.some((a) => a.notifySms)
  const notifyMiniProgram = node.notifyMiniProgram ?? node.actions.some((a) => a.notifyMiniProgram)
  const timeoutEnabled = node.timeoutEnabled ?? (node.timeoutHours != null && node.timeoutHours > 0)

  const normalized: WorkflowNode = {
    ...node,
    triggerSettlement: false,
    visibleRoles: node.visibleRoles?.length ? [...node.visibleRoles] : [...WORKFLOW_ROLES],
    actions,
    prerequisites: [...prerequisites],
    entryConditionGroups: node.entryConditionGroups?.map((g) => migrateEntryConditionGroup(g)),
    notifySms,
    notifyMiniProgram,
    notifyRoles: node.notifyRoles ?? [],
    timeoutEnabled,
  }

  if (node.nodeType === 'start') {
    return applyFixedStartNodeDefaults(normalized, allNodes)
  }

  return normalized
}

export function prepareWorkflowNodesForSave(nodes: WorkflowNode[]): WorkflowNode[] {
  return nodes.map((raw, i) => {
    const node = normalizeWorkflowNode(raw, nodes)
    return {
      ...node,
      sort: i,
      actions:
        node.nodeType === 'end'
          ? []
          : node.actions.map((a) => ({
              action: a.action,
              label: a.label?.trim() || undefined,
              targetNodeId: a.targetNodeId,
              prerequisiteNote: a.prerequisiteNote?.trim() || undefined,
              allowedRoles: a.allowedRoles?.length ? [...a.allowedRoles] : undefined,
              triggerType: a.triggerType,
            })),
      stageLabel: node.stageLabel?.trim() || undefined,
      visibleRoles: node.visibleRoles?.length ? [...node.visibleRoles] : undefined,
      entryConditionGroups: node.entryConditionGroups?.length
        ? node.entryConditionGroups.map((g) => {
            const migrated = migrateEntryConditionGroup(g)
            return {
              id: migrated.id,
              type: migrated.type === 'external_event' ? 'punch_record' : migrated.type,
              generatePunchRecord: migrated.generatePunchRecord,
              punchNavigateMode: migrated.punchNavigateMode,
              listenTarget: migrated.listenTarget,
              incompletePrompt: migrated.incompletePrompt?.trim() || undefined,
              punchCountMode: migrated.punchCountMode,
              allowedPunchMethods: migrated.allowedPunchMethods?.length
                ? [...migrated.allowedPunchMethods]
                : undefined,
              locationSource: migrated.locationSource,
              locationFieldId: migrated.locationFieldId,
              serviceTimeSource: migrated.serviceTimeSource,
              serviceTimeFieldId: migrated.serviceTimeFieldId,
              serviceStartTime: migrated.serviceStartTime,
              serviceEndTime: migrated.serviceEndTime,
              defaultWorkHours: migrated.defaultWorkHours,
              requireWithinServiceWindow: migrated.requireWithinServiceWindow,
              timeoutDays: migrated.timeoutDays,
              timeoutAction: migrated.timeoutAction,
              timeoutTargetNodeId: migrated.timeoutTargetNodeId,
            }
          })
        : undefined,
      defaultNextNodeId: node.nodeType === 'end' ? undefined : node.defaultNextNodeId,
      timeoutHours: node.timeoutEnabled ? node.timeoutHours : undefined,
      timeoutTargetNodeId: node.timeoutEnabled ? node.timeoutTargetNodeId : undefined,
      position: node.position ? { ...node.position } : undefined,
      paletteKey: node.paletteKey,
    }
  })
}

export interface WorkflowFlowEdge {
  from: string
  to: string
  label: string
  isBranch: boolean
}

export interface WorkflowFlowEdgeDetail extends WorkflowFlowEdge {
  actionIndex: number
  kind: 'action' | 'defaultNext'
}

export function buildWorkflowFlowEdgeDetails(nodes: WorkflowNode[]): WorkflowFlowEdgeDetail[] {
  const sorted = sortedWorkflowNodes(nodes)
  const edges: WorkflowFlowEdgeDetail[] = []

  for (const node of sorted) {
    if (node.nodeType === 'end') continue

    if (node.actions.length === 0) {
      if (node.defaultNextNodeId) {
        edges.push({
          from: node.id,
          to: node.defaultNextNodeId,
          label: '自动流转',
          isBranch: false,
          actionIndex: -1,
          kind: 'defaultNext',
        })
      }
      continue
    }

    node.actions.forEach((action, actionIndex) => {
      if (!action.targetNodeId) return
      edges.push({
        from: node.id,
        to: action.targetNodeId,
        label: resolveWorkflowActionLabel(action),
        isBranch: actionIndex > 0,
        actionIndex,
        kind: 'action',
      })
    })
  }

  return edges
}

export function buildWorkflowFlowEdges(nodes: WorkflowNode[]): WorkflowFlowEdge[] {
  return buildWorkflowFlowEdgeDetails(nodes).map(({ from, to, label, isBranch }) => ({
    from,
    to,
    label,
    isBranch,
  }))
}

/** 画布连线：创建或更新流转（单出口时拖拽即改线） */
export function upsertWorkflowConnection(
  nodes: WorkflowNode[],
  fromId: string,
  toId: string,
  options?: { actionType?: WorkflowAction; label?: string },
): WorkflowNode[] {
  if (fromId === toId) return nodes
  const fromNode = getNodeById(nodes, fromId)
  const toNode = getNodeById(nodes, toId)
  if (!fromNode || !toNode || fromNode.nodeType === 'end') return nodes

  const label = options?.label ?? (toNode.name.trim() ? `流转至${toNode.name}` : '流转')
  const actionType = options?.actionType ?? 'submit'

  return nodes.map((n) => {
    if (n.id !== fromId) return n

    if (n.actions.some((a) => a.targetNodeId === toId)) return n

    if (n.actions.length <= 1) {
      const prev = n.actions[0]
      return {
        ...n,
        defaultNextNodeId: undefined,
        actions: [
          {
            action: prev?.action ?? actionType,
            label: prev?.label?.trim() || label,
            targetNodeId: toId,
            triggerType: prev?.triggerType ?? 'manual',
            allowedRoles: prev?.allowedRoles?.length ? [...prev.allowedRoles] : [n.role],
            prerequisiteNote: prev?.prerequisiteNote,
          },
        ],
      }
    }

    return {
      ...n,
      actions: [
        ...n.actions,
        {
          action: actionType,
          label,
          targetNodeId: toId,
          triggerType: 'manual',
          allowedRoles: [n.role],
        },
      ],
    }
  })
}

export function updateWorkflowConnectionTarget(
  nodes: WorkflowNode[],
  fromId: string,
  actionIndex: number,
  toId: string,
): WorkflowNode[] {
  if (fromId === toId) return nodes
  const toNode = getNodeById(nodes, toId)
  if (!toNode) return nodes

  return nodes.map((n) => {
    if (n.id !== fromId || actionIndex < 0 || actionIndex >= n.actions.length) return n
    return {
      ...n,
      actions: n.actions.map((a, i) =>
        i === actionIndex
          ? {
              ...a,
              targetNodeId: toId,
              label: a.label?.trim() || (toNode.name.trim() ? `流转至${toNode.name}` : '流转'),
            }
          : a,
      ),
    }
  })
}

export function updateWorkflowConnectionLabel(
  nodes: WorkflowNode[],
  fromId: string,
  actionIndex: number,
  label: string,
): WorkflowNode[] {
  const trimmed = label.trim()
  if (!trimmed) return nodes

  return nodes.map((n) => {
    if (n.id !== fromId || actionIndex < 0 || actionIndex >= n.actions.length) return n
    return {
      ...n,
      actions: n.actions.map((a, i) => (i === actionIndex ? { ...a, label: trimmed } : a)),
    }
  })
}

export function removeWorkflowConnection(
  nodes: WorkflowNode[],
  fromId: string,
  toId: string,
  actionIndex?: number,
): WorkflowNode[] {
  return nodes.map((n) => {
    if (n.id !== fromId) return n
    if (actionIndex !== undefined && actionIndex >= 0) {
      return { ...n, actions: n.actions.filter((_, i) => i !== actionIndex) }
    }
    return {
      ...n,
      actions: n.actions.filter((a) => a.targetNodeId !== toId),
      defaultNextNodeId: n.defaultNextNodeId === toId ? undefined : n.defaultNextNodeId,
    }
  })
}

export function getEndNodes(nodes: WorkflowNode[]): WorkflowNode[] {
  return sortedWorkflowNodes(nodes).filter((n) => n.nodeType === 'end')
}

export const CANVAS_CARD_W = 220
export const CANVAS_CARD_H = 116
export const CANVAS_GRID_X = 260
export const CANVAS_GRID_Y = 180

export function ensureNodePositions(nodes: WorkflowNode[]): WorkflowNode[] {
  const sorted = sortedWorkflowNodes(nodes)
  return sorted.map((n, i) => {
    if (n.position) return { ...n, position: { ...n.position } }
    const col = i % 3
    const row = Math.floor(i / 3)
    return {
      ...n,
      position: { x: 60 + col * CANVAS_GRID_X, y: 60 + row * CANVAS_GRID_Y },
    }
  })
}

export function getNodeDependencyLabel(node: WorkflowNode): string | undefined {
  const punch = node.entryConditionGroups?.find((g) => g.type === 'punch_record' || g.type === 'external_event')
  if (!punch) return undefined
  if (punch.type === 'punch_record') return '打卡完成'
  return punch.conditionNote || '外部事件'
}

export function migrateEntryConditionGroup(
  group: WorkflowEntryConditionGroup,
): WorkflowEntryConditionGroup {
  if (
    group.type === 'external_event' ||
    (group.eventSource === 'attendance' && group.eventName?.includes('punch'))
  ) {
    return migrateEntryConditionGroup({
      ...group,
      type: 'punch_record',
      generatePunchRecord: group.generatePunchRecord ?? true,
      punchNavigateMode: group.punchNavigateMode ?? 'jump_to_punch_page',
      listenTarget: group.listenTarget ?? 'task_executor',
      incompletePrompt:
        group.incompletePrompt?.trim() ||
        group.conditionNote?.trim() ||
        '请先完成打卡',
    })
  }
  if (group.type === 'punch_record') {
    return {
      ...group,
      generatePunchRecord: group.generatePunchRecord ?? true,
      punchNavigateMode: group.punchNavigateMode ?? 'jump_to_punch_page',
      listenTarget: group.listenTarget ?? 'task_executor',
      punchCountMode: group.punchCountMode ?? 'clock_in_out',
      allowedPunchMethods: group.allowedPunchMethods?.length
        ? [...group.allowedPunchMethods]
        : ['gps'],
      locationSource: group.locationSource ?? 'task_region',
      locationFieldId: group.locationFieldId,
      serviceTimeSource: group.serviceTimeSource ?? 'task_schedule',
      serviceTimeFieldId: group.serviceTimeFieldId,
      serviceStartTime: group.serviceStartTime,
      serviceEndTime: group.serviceEndTime,
      defaultWorkHours: group.defaultWorkHours,
      requireWithinServiceWindow: group.requireWithinServiceWindow ?? true,
    }
  }
  return { ...group }
}

function formatPunchMethods(methods?: WorkflowEntryConditionGroup['allowedPunchMethods']) {
  if (!methods?.length) return '定位打卡'
  return methods.map((m) => workflowPunchMethodMap[m]).join('、')
}

function formatPunchLocationSource(
  group: WorkflowEntryConditionGroup,
  fields?: { id: string; name: string }[],
) {
  const source = group.locationSource ?? 'task_region'
  if (source === 'task_field' && group.locationFieldId) {
    const field = fields?.find((f) => f.id === group.locationFieldId)
    return field ? `字段「${field.name}」` : '自定义地点字段'
  }
  return workflowPunchLocationSourceMap[source] ?? source
}

function formatPunchTimeSource(
  group: WorkflowEntryConditionGroup,
  fields?: { id: string; name: string }[],
) {
  const source = group.serviceTimeSource ?? 'task_schedule'
  if (source === 'task_field' && group.serviceTimeFieldId) {
    const field = fields?.find((f) => f.id === group.serviceTimeFieldId)
    return field ? `字段「${field.name}」` : '自定义时段字段'
  }
  if (source === 'fixed_window' && group.serviceStartTime && group.serviceEndTime) {
    return `固定 ${group.serviceStartTime}-${group.serviceEndTime}`
  }
  return workflowPunchTimeSourceMap[source] ?? source
}

export function createDefaultEntryConditionGroup(): WorkflowEntryConditionGroup {
  return {
    id: generateId('entry'),
    type: 'punch_record',
    generatePunchRecord: true,
    punchNavigateMode: 'jump_to_punch_page',
    listenTarget: 'task_executor',
    incompletePrompt: '请先完成打卡',
    punchCountMode: 'clock_in_out',
    allowedPunchMethods: ['gps'],
    locationSource: 'task_region',
    serviceTimeSource: 'task_schedule',
    requireWithinServiceWindow: true,
    timeoutDays: 3,
    timeoutAction: 'auto_cancel',
  }
}

export function getNodePunchEntryCondition(
  node: WorkflowNode | undefined,
): WorkflowEntryConditionGroup | undefined {
  if (!node?.entryConditionGroups?.length) return undefined
  return node.entryConditionGroups
    .map((g) => migrateEntryConditionGroup(g))
    .find((g) => g.type === 'punch_record')
}

export function resolveEventNameLabel(
  source: WorkflowEntryConditionGroup['eventSource'],
  eventName?: string,
): string {
  if (!source || !eventName) return '—'
  const opt = workflowEventNameOptions[source]?.find((o) => o.value === eventName)
  return opt?.label ?? eventName
}

export function formatEntryConditionSummary(
  group: WorkflowEntryConditionGroup,
  allNodes: WorkflowNode[] = [],
  workflowFields?: { id: string; name: string }[],
): { key: string; text: string }[] {
  const migrated = migrateEntryConditionGroup(group)
  const lines: { key: string; text: string }[] = []
  if (migrated.type === 'none') {
    lines.push({ key: 'type', text: '无条件进入' })
    return lines
  }
  if (migrated.type === 'punch_record') {
    if (migrated.generatePunchRecord !== false) {
      lines.push({ key: 'generate', text: '进入时：自动生成待打卡记录' })
    }
    const mode =
      migrated.punchNavigateMode === 'in_task'
        ? workflowPunchNavigateModeMap.in_task
        : workflowPunchNavigateModeMap.jump_to_punch_page
    lines.push({ key: 'navigate', text: `完成方式：${mode}` })
    const target = migrated.listenTarget
      ? workflowEntryListenTargetMap[migrated.listenTarget]
      : '任务执行人'
    lines.push({ key: 'target', text: `打卡对象：${target}` })
    if (migrated.punchCountMode) {
      lines.push({
        key: 'count',
        text: `打卡次数：${workflowPunchCountModeMap[migrated.punchCountMode]}`,
      })
    }
    lines.push({ key: 'methods', text: `打卡方式：${formatPunchMethods(migrated.allowedPunchMethods)}` })
    lines.push({
      key: 'location',
      text: `地点：${formatPunchLocationSource(migrated, workflowFields)}`,
    })
    lines.push({
      key: 'time',
      text: `服务时段：${formatPunchTimeSource(migrated, workflowFields)}`,
    })
    if (migrated.requireWithinServiceWindow) {
      lines.push({ key: 'window', text: '须在服务时段内打卡' })
    }
    if (migrated.punchCountMode === 'clock_in_only' && migrated.defaultWorkHours) {
      lines.push({ key: 'hours', text: `默认工时：${migrated.defaultWorkHours} 小时` })
    }
    lines.push({ key: 'done', text: '完成条件：打卡记录已提交' })
  } else if (migrated.type === 'external_event') {
    const source = migrated.eventSource ? workflowEventSourceMap[migrated.eventSource] : '—'
    const event = resolveEventNameLabel(migrated.eventSource, migrated.eventName)
    lines.push({ key: 'event', text: `外部事件：${source} · ${event}` })
  } else {
    lines.push({ key: 'type', text: workflowEntryConditionTypeMap[migrated.type] })
  }
  if (migrated.timeoutDays && migrated.timeoutAction) {
    const action = workflowEntryTimeoutActionMap[migrated.timeoutAction]
    const target =
      migrated.timeoutTargetNodeId && allNodes.length
        ? allNodes.find((n) => n.id === migrated.timeoutTargetNodeId)?.name
        : undefined
    const suffix = target ? ` → ${target}` : ''
    lines.push({ key: 'timeout', text: `超时处理：${migrated.timeoutDays}天${action}${suffix}` })
  }
  return lines
}

export function ensureNodeEntryConditions(node: WorkflowNode): WorkflowEntryConditionGroup[] {
  if (node.nodeType === 'end') return []
  if (!node.entryConditionGroups?.length) return []
  return node.entryConditionGroups
}

export function canRemoveWorkflowNode(node: WorkflowNode): string | null {
  if (node.nodeType === 'start') return '开始节点不可删除'
  return null
}

/** 删除节点并清理其他节点对它的流转引用 */
export function removeWorkflowNode(nodes: WorkflowNode[], nodeId: string): WorkflowNode[] {
  if (!nodes.some((n) => n.id === nodeId)) return nodes

  return nodes
    .filter((n) => n.id !== nodeId)
    .map((n) => ({
      ...n,
      actions: n.actions.map((a) => ({
        ...a,
        targetNodeId: a.targetNodeId === nodeId ? undefined : a.targetNodeId,
      })),
      defaultNextNodeId: n.defaultNextNodeId === nodeId ? undefined : n.defaultNextNodeId,
      timeoutTargetNodeId: n.timeoutTargetNodeId === nodeId ? undefined : n.timeoutTargetNodeId,
      entryConditionGroups: n.entryConditionGroups?.map((g) => ({
        ...g,
        timeoutTargetNodeId: g.timeoutTargetNodeId === nodeId ? undefined : g.timeoutTargetNodeId,
      })),
    }))
}
