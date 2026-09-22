import { getWorkflowFieldsForNode, pickWorkerSubmitAction } from '@/services/miniTask'
import { buildNodeFieldEntries, sortedWorkflowNodes } from '@/services/task'
import { isTaskInstanceCancelled } from '@/composables/useMiniWorkerTasks'
import { workflowActionMap } from '@/constants/task'
import type { TaskInstance, TaskInstanceLog, TaskWorkflow, WorkflowNode } from '@/types'

export type WorkflowStepStatus = 'completed' | 'active' | 'pending'

export interface TaskWorkflowStepFieldEntry {
  fieldId: string
  name: string
  value: string
}

export interface TaskWorkflowStepItem {
  id: string
  index: number
  title: string
  description: string
  status: WorkflowStepStatus
  /** 该步骤操作完成时间（展示用） */
  operatedAt?: string
  /** 该步骤已录入的自定义字段 */
  fieldEntries?: TaskWorkflowStepFieldEntry[]
}

function parseProcessStep(raw: string): { title: string; description: string } {
  const sepIdx = raw.search(/[:：]/)
  if (sepIdx < 0) return { title: raw.trim(), description: '' }
  return {
    title: raw.slice(0, sepIdx).trim(),
    description: raw.slice(sepIdx + 1).trim(),
  }
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

/** 流程步骤操作时间展示 */
export function formatWorkflowOperateTime(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`
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

function findNodeOperateLog(
  instance: TaskInstance,
  node: WorkflowNode,
): TaskInstanceLog | undefined {
  const logs = instance.logs ?? []
  const reversed = [...logs].reverse()
  const bySubmit = reversed.find(
    (l) =>
      l.title.includes(`提交：${node.name}`) ||
      l.title.includes(`完成：${node.name}`) ||
      (l.title.includes(node.name) && !!l.fieldEntries?.length),
  )
  if (bySubmit) return bySubmit
  return reversed.find((l) => l.title.includes(`进入「${node.name}」`) || l.title.includes(node.name))
}

function resolveCompletedMeta(
  stepIndex: number,
  instance: TaskInstance,
  workflow: TaskWorkflow,
  node: WorkflowNode | undefined,
) {
  const fieldEntries = node
    ? buildNodeFieldEntries(workflow, node.id, instance.fieldValues)
    : []
  const log = node ? findNodeOperateLog(instance, node) : undefined
  let operatedIso = log?.time
  if (!operatedIso) {
    if (stepIndex === 0 || node?.nodeType === 'start') operatedIso = instance.createdAt
    else if (node?.nodeType === 'end' || node?.name.includes('完成')) operatedIso = instance.updatedAt
  }
  const logFields =
    log?.fieldEntries?.map((e) => ({
      fieldId: e.fieldId,
      name: e.name,
      value: e.value,
    })) ?? []
  const merged = fieldEntries.length
    ? fieldEntries
    : logFields

  return {
    operatedAt: operatedIso ? formatWorkflowOperateTime(operatedIso) : undefined,
    fieldEntries: merged,
  }
}

function buildCompletedDesc(
  stepIndex: number,
  node: WorkflowNode | undefined,
  fallback: string,
) {
  if (stepIndex === 0 || node?.nodeType === 'start') {
    return fallback || '已领取'
  }
  if (node?.nodeType === 'end' || node?.name.includes('完成')) {
    return fallback || '已完成'
  }
  return fallback || '已完成'
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
      return '请点击下方按钮填写信息并提交'
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
    let operatedAt: string | undefined
    let fieldEntries: TaskWorkflowStepFieldEntry[] | undefined

    if (cancelled && i === currentIdx) {
      description = '任务已取消，中途结束'
      operatedAt = formatWorkflowOperateTime(instance.updatedAt)
    } else if (status === 'completed') {
      description = buildCompletedDesc(i, node, baseDesc)
      const meta = resolveCompletedMeta(i, instance, workflow, node)
      operatedAt = meta.operatedAt
      fieldEntries = meta.fieldEntries.length ? meta.fieldEntries : undefined
    } else if (status === 'active') {
      description = buildActiveDesc(node, instance, workflow, baseDesc)
    }

    return {
      id: node?.id ?? `step_${i}`,
      index: i + 1,
      title,
      description,
      status,
      operatedAt,
      fieldEntries,
    }
  })
}
