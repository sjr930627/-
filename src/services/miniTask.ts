import type { AttendancePunch, PricingMode, Task, TaskInstance, TaskPricingUnit, TaskType, TaskWorkflow, TieredPrice, WorkflowAction, WorkflowEntryConditionGroup } from '@/types'
import type { MiniTaskCategory } from '@/mock/miniTaskHallSeed'
import { resolveTaskPricing, resolveTaskSettlementUnitPrice } from '@/constants/task'
import { resolveTransitionTarget } from '@/services/task'
import { localDateStr } from '@/composables/useMiniPunch'
import { getNodePunchEntryCondition } from '@/utils/workflow'

export const TASK_PREVIEW_LIMIT = 5

export const taskPricingUnitMap = {
  piece: '件',
  time: '次',
} as const

export type TaskPricingLike = {
  pricingMode: PricingMode
  fixedPrice?: number
  tieredPrices?: TieredPrice[]
  pricingUnit?: TaskPricingUnit
}

export function getTaskPricingUnit(pricing: TaskPricingLike | undefined): 'piece' | 'time' {
  return pricing?.pricingUnit ?? 'piece'
}

export function formatTaskUnitPrice(pricing: TaskPricingLike | undefined): string {
  if (!pricing) return '-'
  const unit = taskPricingUnitMap[getTaskPricingUnit(pricing)]
  if (pricing.pricingMode === 'fixed') {
    return pricing.fixedPrice != null ? `¥${pricing.fixedPrice}/${unit}` : '-'
  }
  const first = pricing.tieredPrices?.[0]
  return first ? `¥${first.unitPrice}/${unit}起` : '-'
}

export function calcTaskClaimAmount(pricing: TaskPricingLike, quantity: number): number {
  const q = Math.max(1, quantity)
  if (pricing.pricingMode === 'fixed') {
    return Math.round((pricing.fixedPrice ?? 0) * q * 100) / 100
  }
  const tier = pricing.tieredPrices?.find((t) => q >= t.minCount && q <= t.maxCount)
  const unit = tier?.unitPrice ?? pricing.tieredPrices?.[0]?.unitPrice ?? 0
  return Math.round(unit * q * 100) / 100
}

export function resolvePricingForTask(task: Task, taskTypes: TaskType[]): TaskPricingLike | undefined {
  return resolveTaskPricing(task, taskTypes) as TaskPricingLike | undefined
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

/** 当前节点有待打卡进入条件且执行人今日尚未打卡 */
export function getPendingPunchEntryForInstance(
  instance: TaskInstance,
  workflow: TaskWorkflow | undefined,
  punches: AttendancePunch[],
  today: string = localDateStr(new Date()),
): WorkflowEntryConditionGroup | undefined {
  if (!workflow) return undefined
  const node = getWorkflowNode(workflow, instance.currentNodeId)
  const punchEntry = getNodePunchEntryCondition(node)
  if (!punchEntry) return undefined
  const workerId = instance.workerId
  const hasPunchedToday = punches.some(
    (p) => p.employeeId === workerId && p.date === today && p.type === 'clock_in',
  )
  return hasPunchedToday ? undefined : punchEntry
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
  pricing: TaskPricingLike | undefined,
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
  const pricingUnit = getTaskPricingUnit(pricing)
  const unit = taskPricingUnitMap[pricingUnit]
  const priceValue = resolveTaskSettlementUnitPrice({
    settlementUnitPrice: task.settlementUnitPrice,
    pricingMode: pricing?.pricingMode,
    fixedPrice: pricing?.fixedPrice,
    tieredPrices: pricing?.tieredPrices,
  })
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
