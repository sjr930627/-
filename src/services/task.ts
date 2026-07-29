import type { TaskWorkflow, WorkflowNode } from '@/types'

export function sortedWorkflowNodes(workflow: TaskWorkflow | { nodes: WorkflowNode[] }): WorkflowNode[] {
  return [...workflow.nodes].sort((a, b) => a.sort - b.sort)
}

export function getWorkflowEndNode(workflow: TaskWorkflow): WorkflowNode | undefined {
  return sortedWorkflowNodes(workflow).find((n) => n.nodeType === 'end')
}

export function getEnterpriseReviewNode(workflow: TaskWorkflow): WorkflowNode | undefined {
  return sortedWorkflowNodes(workflow).find(
    (n) => n.role === 'enterprise' && n.actions.some((a) => a.action === 'approve'),
  )
}

export function getWorkerExecutingNode(workflow: TaskWorkflow): WorkflowNode | undefined {
  return sortedWorkflowNodes(workflow).find(
    (n) =>
      n.role === 'worker' &&
      n.nodeType === 'middle' &&
      n.actions.some((a) => a.action === 'submit'),
  )
}

export function generateTaskName(taskTypeName: string, date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${taskTypeName}-${y}${m}`
}

export function calcTaskProgress(task: {
  plannedTotal?: number
  acceptedCount: number
  completedCount: number
  approvedCount: number
}) {
  const target = task.plannedTotal ?? task.acceptedCount
  const progress = target > 0 ? Math.round((task.approvedCount / target) * 100) : 0
  const passRate =
    task.completedCount > 0 ? Math.round((task.approvedCount / task.completedCount) * 100) : 0
  return { progress: Math.min(progress, 100), passRate }
}
