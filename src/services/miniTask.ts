import type { Task, TaskInstance, TaskType, TaskWorkflow, WorkflowAction } from '@/types'
import type { MiniTaskCategory } from '@/mock/miniTaskHallSeed'
import { resolveTransitionTarget } from '@/services/task'

export const TASK_PREVIEW_LIMIT = 5

export const taskPricingUnitMap = {
  piece: '件',
  time: '次',
} as const

export function getTaskPricingUnit(taskType: TaskType | undefined): 'piece' | 'time' {
  return taskType?.pricingUnit ?? 'piece'
}

export function formatTaskUnitPrice(taskType: TaskType | undefined): string {
  if (!taskType) return '-'
  const unit = taskPricingUnitMap[getTaskPricingUnit(taskType)]
  if (taskType.pricingMode === 'fixed') {
    return taskType.fixedPrice != null ? `¥${taskType.fixedPrice}/${unit}` : '-'
  }
  const first = taskType.tieredPrices?.[0]
  return first ? `¥${first.unitPrice}/${unit}起` : '-'
}

export function calcTaskClaimAmount(taskType: TaskType, quantity: number): number {
  const q = Math.max(1, quantity)
  if (taskType.pricingMode === 'fixed') {
    return Math.round((taskType.fixedPrice ?? 0) * q * 100) / 100
  }
  const tier = taskType.tieredPrices?.find((t) => q >= t.minCount && q <= t.maxCount)
  const unit = tier?.unitPrice ?? taskType.tieredPrices?.[0]?.unitPrice ?? 0
  return Math.round(unit * q * 100) / 100
}

export function getWorkerClaimedQuantity(
  instances: TaskInstance[],
  taskId: string,
  workerId: string,
): number {
  return instances
    .filter((i) => i.taskId === taskId && i.workerId === workerId)
    .reduce((sum, i) => sum + (i.claimQuantity ?? 1), 0)
}

export function getWorkflowFieldsForNode(workflow: TaskWorkflow | undefined, nodeId: string) {
  return workflow?.fields?.filter((f) => f.nodeIds.includes(nodeId)) ?? []
}

export function getWorkflowNode(workflow: TaskWorkflow | undefined, nodeId: string) {
  return workflow?.nodes.find((n) => n.id === nodeId)
}

export function pickWorkerSubmitAction(
  workflow: TaskWorkflow,
  nodeId: string,
): WorkflowAction | undefined {
  const node = getWorkflowNode(workflow, nodeId)
  if (!node || node.role !== 'worker') return undefined
  const order: WorkflowAction[] = ['submit', 'accept', 'punch', 'confirm']
  for (const action of order) {
    if (node.actions.some((a) => a.action === action)) return action
  }
  return undefined
}

export type NodeStatusTone = 'blue' | 'orange' | 'purple' | 'green' | 'gray' | 'amber'

export function getNodeStatusTone(
  instance: TaskInstance,
  workflow: TaskWorkflow | undefined,
): NodeStatusTone {
  const name = instance.currentNodeName
  if (name.includes('已取消')) return 'gray'
  if (name.includes('已结算') || name.includes('已完成')) return 'green'

  const node = getWorkflowNode(workflow, instance.currentNodeId)
  if (node?.role === 'enterprise') return 'purple'
  if (node?.role === 'worker') {
    if (workflow && pickWorkerSubmitAction(workflow, instance.currentNodeId)) return 'orange'
    return 'blue'
  }
  return 'blue'
}

export function isPendingWorkerAction(
  instance: TaskInstance,
  workflow: TaskWorkflow | undefined,
): boolean {
  if (!workflow) return false
  const node = getWorkflowNode(workflow, instance.currentNodeId)
  if (node?.role !== 'worker') return false
  return !!pickWorkerSubmitAction(workflow, instance.currentNodeId)
}

export function isPendingEnterpriseAction(
  instance: TaskInstance,
  workflow: TaskWorkflow | undefined,
): boolean {
  const node = getWorkflowNode(workflow, instance.currentNodeId)
  return node?.role === 'enterprise'
}

export function resolveSubmitTarget(
  workflow: TaskWorkflow,
  nodeId: string,
  action: WorkflowAction,
) {
  return resolveTransitionTarget(workflow, nodeId, action)
}

export interface HallTaskRow {
  id: string
  name: string
  taskTypeName: string
  enterpriseId: string
  enterpriseName: string
  description: string
  region?: string
  unitPriceLabel: string
  priceValue: number
  pricingUnit: 'piece' | 'time'
  remainLabel: string
  tags: string[]
  myCount: number
  maxPerPerson?: number
  canClaim: boolean
  category: MiniTaskCategory
  participants?: number
  cardTone?: 'blue' | 'green' | 'purple' | 'orange' | 'pink'
  highlightTag?: string
  priceDisplay: string
  isMobile?: boolean
}

export interface TaskEnterpriseGroup {
  enterpriseId: string
  enterpriseName: string
  industryLabel: string
  taskCount: number
  previewTasks: HallTaskRow[]
  hasMore: boolean
}

export function buildHallTaskRow(
  task: Task,
  taskType: TaskType | undefined,
  myCount: number,
  extra?: {
    tags?: string[]
    remain?: number
    category?: MiniTaskCategory
    participants?: number
    cardTone?: 'blue' | 'green' | 'purple' | 'orange' | 'pink'
    highlightTag?: string
    priceRange?: string
    isMobile?: boolean
  },
): HallTaskRow {
  const pricingUnit = getTaskPricingUnit(taskType)
  const unit = taskPricingUnitMap[pricingUnit]
  const priceValue =
    taskType?.pricingMode === 'fixed'
      ? (taskType.fixedPrice ?? 0)
      : (taskType?.tieredPrices?.[0]?.unitPrice ?? 0)
  const remain =
    extra?.remain ??
    (task.plannedTotal != null ? Math.max(0, task.plannedTotal - task.acceptedCount) : undefined)
  const remainLabel =
    remain == null || remain > 9999 ? '不限名额' : `剩余 ${remain} 名额`
  const canClaim =
    task.status === 'active' &&
    task.dispatchMode === 'hall' &&
    (remain == null || remain > 0) &&
    (!task.maxPerPerson || myCount < task.maxPerPerson)

  return {
    id: task.id,
    name: task.name,
    taskTypeName: task.taskTypeName,
    enterpriseId: task.enterpriseId,
    enterpriseName: task.enterpriseName,
    description: task.description,
    region: task.region,
    unitPriceLabel: `¥${priceValue}/${unit}`,
    priceValue,
    pricingUnit,
    remainLabel,
    tags: extra?.tags ?? [],
    myCount,
    maxPerPerson: task.maxPerPerson,
    canClaim,
    category: extra?.category ?? 'main',
    participants: extra?.participants ?? task.acceptedCount,
    cardTone: extra?.cardTone ?? 'blue',
    highlightTag: extra?.highlightTag,
    priceDisplay: extra?.priceRange ?? `¥${priceValue}/${unit === '次' ? '次' : '人'}`,
    isMobile: extra?.isMobile,
  }
}

export function groupHallTasksByEnterprise(
  rows: HallTaskRow[],
  previewLimit = TASK_PREVIEW_LIMIT,
): TaskEnterpriseGroup[] {
  const map = new Map<string, HallTaskRow[]>()
  for (const row of rows) {
    const key = row.enterpriseName
    const list = map.get(key) ?? []
    list.push(row)
    map.set(key, list)
  }
  return [...map.entries()].map(([enterpriseName, tasks]) => ({
    enterpriseId: tasks[0]?.enterpriseId ?? '',
    enterpriseName,
    industryLabel: `${tasks.length}个任务`,
    taskCount: tasks.length,
    previewTasks: tasks.slice(0, previewLimit),
    hasMore: tasks.length > previewLimit,
  }))
}
