import { workflowActionMap } from '@/constants/task'
import type { WorkflowAction, WorkflowActionConfig, WorkflowNode } from '@/types'

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
  }))

  const notifySms = node.notifySms ?? node.actions.some((a) => a.notifySms)
  const notifyMiniProgram = node.notifyMiniProgram ?? node.actions.some((a) => a.notifyMiniProgram)
  const timeoutEnabled = node.timeoutEnabled ?? (node.timeoutHours != null && node.timeoutHours > 0)

  return {
    ...node,
    actions,
    prerequisites: [...prerequisites],
    notifySms,
    notifyMiniProgram,
    notifyRoles: node.notifyRoles ?? [],
    timeoutEnabled,
  }
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
              targetNodeId: a.targetNodeId,
            })),
      defaultNextNodeId: node.nodeType === 'end' ? undefined : node.defaultNextNodeId,
      timeoutHours: node.timeoutEnabled ? node.timeoutHours : undefined,
      timeoutTargetNodeId: node.timeoutEnabled ? node.timeoutTargetNodeId : undefined,
    }
  })
}

export interface WorkflowFlowEdge {
  from: string
  to: string
  label: string
  isBranch: boolean
}

export function buildWorkflowFlowEdges(nodes: WorkflowNode[]): WorkflowFlowEdge[] {
  const sorted = sortedWorkflowNodes(nodes)
  const edges: WorkflowFlowEdge[] = []

  for (const node of sorted) {
    if (node.nodeType === 'end') continue

    const defaultNext = getDefaultNextNodeId(node, sorted)

    if (node.actions.length === 0) {
      if (node.defaultNextNodeId || defaultNext) {
        edges.push({
          from: node.id,
          to: node.defaultNextNodeId ?? defaultNext!,
          label: '自动流转',
          isBranch: false,
        })
      }
      continue
    }

    for (const action of node.actions) {
      const target = action.targetNodeId ?? defaultNext
      if (!target) continue
      const normalizedAction = action.action === 'approve' ? 'confirm' : action.action
      edges.push({
        from: node.id,
        to: target,
        label: workflowActionMap[normalizedAction],
        isBranch: target !== defaultNext,
      })
    }
  }

  return edges
}

export function getEndNodes(nodes: WorkflowNode[]): WorkflowNode[] {
  return sortedWorkflowNodes(nodes).filter((n) => n.nodeType === 'end')
}
