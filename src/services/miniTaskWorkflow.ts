import { getWorkflowFieldsForNode, pickWorkerSubmitAction } from '@/services/miniTask'
import { sortedWorkflowNodes } from '@/services/task'
import { isTaskInstanceCancelled } from '@/composables/useMiniWorkerTasks'
import { workflowActionMap } from '@/constants/task'
import type { TaskInstance, TaskWorkflow, WorkflowNode } from '@/types'

export type WorkflowStepStatus = 'completed' | 'active' | 'pending'

export interface TaskWorkflowStepItem {
  id: string
  index: number
  title: string
  description: string
  status: WorkflowStepStatus
}

function parseProcessStep(raw: string): { title: string; description: string } {
  const sepIdx = raw.search(/[:：]/)
  if (sepIdx < 0) return { title: raw.trim(), description: '' }
  return {
    title: raw.slice(0, sepIdx).trim(),
    description: raw.slice(sepIdx + 1).trim(),
  }
}

function formatClaimDate(iso: string) {
  const d = new Date(iso)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

function getDisplayNodes(workflow: TaskWorkflow) {
  return sortedWorkflowNodes(workflow).filter(
    (n) => n.id !== 'node_cancelled' && n.id !== 'node_settled',
  )
}

function getStoppedStepIndex(workflow: TaskWorkflow, instance: TaskInstance) {
  const displayNodes = getDisplayNodes(workflow)
  const allNodes = sortedWorkflowNodes(workflow)
  const cancelIdx = allNodes.findIndex((n) => n.id === instance.currentNodeId)
  if (cancelIdx <= 0) return 0

  for (let j = cancelIdx - 1; j >= 0; j--) {
    const n = allNodes[j]
    if (n.id === 'node_settled') continue
    if (n.nodeType === 'end' && !n.name.includes('取消')) continue
    const displayIdx = displayNodes.findIndex((d) => d.id === n.id)
    if (displayIdx >= 0) return displayIdx
  }
  return 0
}

function buildCompletedDesc(
  stepIndex: number,
  instance: TaskInstance,
  node: WorkflowNode | undefined,
  fallback: string,
) {
  if (stepIndex === 0 || node?.nodeType === 'start') {
    return `已于 ${formatClaimDate(instance.createdAt)} 领取`
  }
  if (node?.nodeType === 'end' || node?.name.includes('完成')) {
    return `已于 ${formatClaimDate(instance.updatedAt)} 完成`
  }
  if (fallback) return fallback
  return `已于 ${formatClaimDate(instance.updatedAt)} 完成`
}

function buildActiveDesc(
  node: WorkflowNode | undefined,
  instance: TaskInstance,
  workflow: TaskWorkflow,
  fallback: string,
) {
  if (!node) return fallback || '请完成当前步骤'

  if (node.role === 'enterprise') {
    return '等待企业方确认，您无需操作'
  }

  if (node.role === 'worker') {
    const fields = getWorkflowFieldsForNode(workflow, node.id)
    const action = pickWorkerSubmitAction(workflow, node.id)
    if (fields.length) {
      const names = fields.map((f) => f.name).join('、')
      return `请填写或上传：${names}`
    }
    if (action) {
      return `${workflowActionMap[action]}，${fallback || '按任务要求完成当前步骤'}`
    }
  }

  if (node.nodeType === 'end') {
    return '任务已完成，奖励将自动发放'
  }

  return fallback || `当前：${instance.currentNodeName}`
}

export function buildTaskWorkflowSteps(
  processSteps: string[],
  workflow?: TaskWorkflow,
  instance?: TaskInstance,
): TaskWorkflowStepItem[] {
  const parsed = processSteps.map(parseProcessStep)

  if (!workflow || !instance) {
    return parsed.map((p, i) => ({
      id: `preview_${i}`,
      index: i + 1,
      title: p.title,
      description: i === 0 ? p.description || '下一步：点击领取任务' : p.description,
      status: (i === 0 ? 'active' : 'pending') as WorkflowStepStatus,
    }))
  }

  const nodes = getDisplayNodes(workflow)
  const cancelled = isTaskInstanceCancelled(instance, workflow)
  const currentIdx = cancelled
    ? getStoppedStepIndex(workflow, instance)
    : nodes.findIndex((n) => n.id === instance.currentNodeId)
  const stepCount = Math.max(parsed.length, nodes.length)

  return Array.from({ length: stepCount }, (_, i) => {
    const p = parsed[i]
    const node = nodes[i]
    const title = p?.title || node?.name || `步骤 ${i + 1}`
    const baseDesc = p?.description || ''

    let status: WorkflowStepStatus = 'pending'
    if (currentIdx >= 0) {
      if (i < currentIdx) status = 'completed'
      else if (i === currentIdx) {
        status =
          !cancelled && node?.nodeType === 'end' && node.name.includes('完成')
            ? 'completed'
            : 'active'
      }
    }

    let description = baseDesc
    if (cancelled && i === currentIdx) {
      description = `已于 ${formatClaimDate(instance.updatedAt)} 取消，任务中途结束`
    } else if (status === 'completed') {
      description = buildCompletedDesc(i, instance, node, baseDesc)
    } else if (status === 'active') {
      description = buildActiveDesc(node, instance, workflow, baseDesc)
    }

    return {
      id: node?.id ?? `step_${i}`,
      index: i + 1,
      title,
      description,
      status,
    }
  })
}
