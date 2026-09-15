import type { Task, TaskWorkflow, WorkflowAction, WorkflowActionConfig, WorkflowNode } from '@/types'
import { getDefaultNextNodeId, getNodeById, resolveActionTargetNodeId, resolveWorkflowActionLabel, sortedWorkflowNodes as sortNodes } from '@/utils/workflow'

export function sortedWorkflowNodes(workflow: TaskWorkflow | { nodes: WorkflowNode[] }): WorkflowNode[] {
  return sortNodes(workflow.nodes)
}

export function getWorkflowEndNode(workflow: TaskWorkflow, preferName?: string): WorkflowNode | undefined {
  const ends = sortedWorkflowNodes(workflow).filter((n) => n.nodeType === 'end')
  if (preferName) {
    const matched = ends.find((n) => n.name.includes(preferName))
    if (matched) return matched
  }
  return ends.find((n) => n.name.includes('完成')) ?? ends[0]
}

export function resolveTransitionTarget(
  workflow: TaskWorkflow,
  fromNodeId: string,
  action: WorkflowAction,
): WorkflowNode | undefined {
  const node = getNodeById(workflow.nodes, fromNodeId)
  if (!node) return undefined
  const targetId = resolveActionTargetNodeId(node, action, workflow.nodes)
  return targetId ? getNodeById(workflow.nodes, targetId) : undefined
}

export function getEnterpriseReviewNode(workflow: TaskWorkflow): WorkflowNode | undefined {
  return sortedWorkflowNodes(workflow).find(
    (n) =>
      n.role === 'enterprise' &&
      n.actions.some((a) => a.action === 'approve' || a.action === 'confirm'),
  )
}

export function getWorkerExecutingNode(workflow: TaskWorkflow): WorkflowNode | undefined {
  return sortedWorkflowNodes(workflow).find(
    (n) =>
      n.role === 'worker' &&
      n.nodeType === 'middle' &&
      n.actions.some((a) => a.action === 'submit' || a.action === 'accept' || a.action === 'punch'),
  )
}

export function generateTaskName(taskTypeName: string, date = new Date()): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  return `${taskTypeName}-${y}${m}`
}

/** 业务任务编号：年月日 + 4 位随机数 */
export function generateTaskNo(date = new Date(), existingNos?: Set<string>): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  const prefix = `${y}${m}${d}`
  for (let i = 0; i < 20; i++) {
    const no = `${prefix}${String(Math.floor(Math.random() * 10000)).padStart(4, '0')}`
    if (!existingNos?.has(no)) {
      existingNos?.add(no)
      return no
    }
  }
  return `${prefix}${String(Date.now() % 10000).padStart(4, '0')}`
}

/** 为缺少 taskNo 的历史任务补齐编号 */
export function ensureTaskNo(task: Task, existingNos?: Set<string>): Task {
  if (task.taskNo) {
    existingNos?.add(task.taskNo)
    return task
  }
  const date = task.createdAt ? new Date(task.createdAt) : new Date()
  const base = Number.isNaN(date.getTime()) ? new Date() : date
  return { ...task, taskNo: generateTaskNo(base, existingNos) }
}

export function ensureTaskNos(tasks: Task[]): Task[] {
  const existing = new Set(
    tasks.map((t) => t.taskNo).filter((n): n is string => Boolean(n)),
  )
  return tasks.map((t) => ensureTaskNo(t, existing))
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

/** 企业端：按工作流完成数统计进度（无单独验收环节） */
export function calcEnterpriseTaskProgress(task: {
  plannedTotal?: number
  unlimitedQuantity?: boolean
  acceptedCount: number
  completedCount: number
}) {
  const target = task.unlimitedQuantity ? task.acceptedCount : (task.plannedTotal ?? task.acceptedCount)
  const progress = target > 0 ? Math.round((task.completedCount / target) * 100) : 0
  const completionRate =
    task.acceptedCount > 0 ? Math.round((task.completedCount / task.acceptedCount) * 100) : 0
  return { progress: Math.min(progress, 100), completionRate }
}

/** 有限数量是否已达计划完成量 */
export function isTaskQuantityCompleted(task: {
  plannedTotal?: number
  unlimitedQuantity?: boolean
  completedCount: number
}): boolean {
  if (task.unlimitedQuantity || task.plannedTotal == null) return false
  return task.completedCount >= task.plannedTotal
}

/** 灵工领取达上限提示 */
export const TASK_CLAIM_LIMIT_MESSAGE = '该任务已到领取上限，请换个任务试试'

type ClaimOccupancyInstance = {
  taskId: string
  currentNodeId: string
  currentNodeName: string
  claimQuantity?: number
}

/** 进行中 + 已完成占用名额（取消/已结束不占用，可释放） */
export function getTaskOccupiedClaimQuantity(
  taskId: string,
  instances: ClaimOccupancyInstance[],
  workflow: TaskWorkflow | undefined,
): { running: number; completed: number; occupied: number } {
  let running = 0
  let completed = 0
  for (const inst of instances) {
    if (inst.taskId !== taskId) continue
    const status = resolveInstanceWorkflowStatus(inst, workflow)
    const q = Math.max(1, inst.claimQuantity ?? 1)
    if (status === 'running') running += q
    else if (status === 'completed') completed += q
  }
  return { running, completed, occupied: running + completed }
}

/**
 * 可领任务数 = 任务数量 − 进行中 − 已完成。
 * 待审核/待提交、无上限返回 null（展示 —）。
 */
export function getTaskClaimableCount(
  task: {
    id: string
    status: Task['status']
    workflowId: string
    plannedTotal?: number
    unlimitedQuantity?: boolean
  },
  instances: ClaimOccupancyInstance[],
  workflow: TaskWorkflow | undefined,
): number | null {
  if (task.status === 'pending' || task.status === 'draft') return null
  if (task.unlimitedQuantity || task.plannedTotal == null) return null
  const { occupied } = getTaskOccupiedClaimQuantity(task.id, instances, workflow)
  return Math.max(0, task.plannedTotal - occupied)
}

export function formatTaskClaimableQuantity(
  task: {
    id: string
    status: Task['status']
    workflowId: string
    plannedTotal?: number
    unlimitedQuantity?: boolean
  },
  instances: ClaimOccupancyInstance[],
  workflow: TaskWorkflow | undefined,
): string {
  const count = getTaskClaimableCount(task, instances, workflow)
  return count == null ? '—' : String(count)
}

/** 是否仍在任务结束期限内（长期任务视为始终在期限内） */
export function isTaskWithinDeadline(
  task: { longTerm?: boolean; endTime: string },
  now = Date.now(),
): boolean {
  if (task.longTerm) return true
  return new Date(task.endTime).getTime() >= now
}

/** 进行中且（仍在期限内或数量未完成）时可手动结束 → 已结束 */
export function canManuallyEndTask(
  task: {
    status: Task['status']
    longTerm?: boolean
    endTime: string
    plannedTotal?: number
    unlimitedQuantity?: boolean
    completedCount: number
  },
  now = Date.now(),
): boolean {
  if (task.status !== 'active') return false
  return isTaskWithinDeadline(task, now) || !isTaskQuantityCompleted(task)
}

/**
 * 任务数已完成，且已过结束期限（长期任务仅看数量）时标记为已完成
 */
export function maybeMarkTaskCompleted(task: {
  status: Task['status']
  plannedTotal?: number
  unlimitedQuantity?: boolean
  completedCount: number
  longTerm?: boolean
  endTime: string
}, now = Date.now()): boolean {
  if (task.status !== 'active') return false
  if (!isTaskQuantityCompleted(task)) return false
  if (!task.longTerm && isTaskWithinDeadline(task, now)) return false
  task.status = 'completed'
  return true
}

export type InstanceWorkflowStatus = 'running' | 'completed' | 'cancelled' | 'ended'

/** 根据工作流当前节点判断实例状态：结束节点=完成/取消/已结束，否则进行中 */
export function resolveInstanceWorkflowStatus(
  instance: { currentNodeId: string; currentNodeName: string },
  workflow: TaskWorkflow | undefined,
): InstanceWorkflowStatus {
  if (instance.currentNodeName.includes('已结束') || instance.currentNodeName === '结束') {
    return 'ended'
  }
  if (
    instance.currentNodeName.includes('取消') ||
    instance.currentNodeName.includes('关闭')
  ) {
    return 'cancelled'
  }
  if (!workflow) return 'running'
  const node = workflow.nodes.find((n) => n.id === instance.currentNodeId)
  if (!node || node.nodeType !== 'end') return 'running'
  if (node.name.includes('已结束')) return 'ended'
  if (node.name.includes('取消') || node.name.includes('关闭') || node.name.includes('驳回')) {
    return 'cancelled'
  }
  return 'completed'
}

export const instanceWorkflowStatusMap: Record<
  InstanceWorkflowStatus,
  { label: string; type: 'success' | 'warning' | 'info' }
> = {
  running: { label: '执行中', type: 'warning' },
  completed: { label: '已完成', type: 'success' },
  cancelled: { label: '已结束', type: 'info' },
  ended: { label: '已结束', type: 'info' },
}

export function getCurrentWorkflowNode(
  workflow: TaskWorkflow | undefined,
  nodeId: string,
): WorkflowNode | undefined {
  return workflow?.nodes.find((n) => n.id === nodeId)
}

/** 实例是否处于企业可操作节点 */
export function isInstanceAtEnterpriseNode(
  instance: { currentNodeId: string },
  workflow: TaskWorkflow | undefined,
): boolean {
  const node = getCurrentWorkflowNode(workflow, instance.currentNodeId)
  return Boolean(node?.role === 'enterprise' && node.actions.length > 0)
}

/** 当前企业节点可执行的动作（按工作流配置） */
export function getInstanceEnterpriseActions(
  instance: { currentNodeId: string },
  workflow: TaskWorkflow | undefined,
): WorkflowActionConfig[] {
  const node = getCurrentWorkflowNode(workflow, instance.currentNodeId)
  if (!node || node.role !== 'enterprise') return []
  return node.actions
}

export type EnterpriseActionUiMeta = {
  action: WorkflowAction
  label: string
  buttonType: 'success' | 'danger' | 'warning'
  needNote: boolean
  noteRequired: boolean
}

const enterpriseActionUiMap: Partial<
  Record<WorkflowAction, Omit<EnterpriseActionUiMeta, 'action'>>
> = {
  confirm: { label: '审核通过', buttonType: 'success', needNote: true, noteRequired: false },
  approve: { label: '审核通过', buttonType: 'success', needNote: true, noteRequired: false },
  reject: { label: '驳回', buttonType: 'danger', needNote: true, noteRequired: true },
  cancel: { label: '任务结束', buttonType: 'warning', needNote: true, noteRequired: true },
}

export function getEnterpriseActionUiMeta(actionConfig: WorkflowActionConfig): EnterpriseActionUiMeta {
  const action = actionConfig.action === 'approve' ? 'confirm' : actionConfig.action
  const preset = enterpriseActionUiMap[actionConfig.action] ?? enterpriseActionUiMap[action]
  const customLabel = actionConfig.label?.trim()
  return {
    action: actionConfig.action,
    label: customLabel || preset?.label || resolveWorkflowActionLabel(actionConfig),
    buttonType: preset?.buttonType ?? 'success',
    needNote: preset?.needNote ?? false,
    noteRequired: preset?.noteRequired ?? false,
  }
}

/** 系统自动节点（如已结算）自动流转至下一节点 */
export function advanceThroughSystemNodes(
  workflow: TaskWorkflow,
  startNode: WorkflowNode,
): WorkflowNode {
  let node = startNode
  while (node.role === 'system' && node.nodeType === 'middle') {
    const nextId = node.defaultNextNodeId ?? getDefaultNextNodeId(node, workflow.nodes)
    if (!nextId) break
    const next = getNodeById(workflow.nodes, nextId)
    if (!next || next.id === node.id) break
    node = next
  }
  return node
}

export function isWorkflowCompletedEndNode(node: WorkflowNode): boolean {
  return node.nodeType === 'end' && node.name.includes('完成')
}

/** 当前节点关联的工作流字段 */
export function getWorkflowFieldsForNode(workflow: TaskWorkflow | undefined, nodeId: string) {
  return workflow?.fields?.filter((f) => f.nodeIds.includes(nodeId)) ?? []
}

/** 灵工领取任务所在节点（固定为流程开始节点「领取任务」） */
export function getWorkflowClaimNode(workflow: TaskWorkflow): WorkflowNode | undefined {
  const sorted = sortedWorkflowNodes(workflow)
  const start = sorted.find((n) => n.nodeType === 'start')
  if (start) return start
  return (
    sorted.find(
      (n) =>
        (n.name.includes('领取任务') || n.name.includes('认领') || n.name.includes('提交信息')) &&
        n.actions.some(
          (a) => a.action === 'confirm' || a.action === 'accept' || a.action === 'submit',
        ),
    ) ??
    sorted.find((n) =>
      n.actions.some((a) => a.action === 'confirm' || a.action === 'accept' || a.action === 'submit'),
    ) ??
    getWorkerExecutingNode(workflow)
  )
}

export function validateWorkflowNodeFields(
  workflow: TaskWorkflow,
  nodeId: string,
  fieldValues: Record<string, string | number | boolean | undefined>,
) {
  for (const field of getWorkflowFieldsForNode(workflow, nodeId)) {
    if (!field.required) continue
    const val = fieldValues[field.id]
    if (val === undefined || val === null || val === '') {
      throw new Error(`请填写${field.name}`)
    }
  }
}

/** 已填写且不属于当前节点的字段（用于展示灵工历史提交） */
export function getSubmittedWorkflowFieldSnapshots(
  workflow: TaskWorkflow | undefined,
  instance: { currentNodeId: string; fieldValues?: Record<string, string | number | boolean> },
) {
  if (!workflow?.fields?.length || !instance.fieldValues) return []
  const currentFieldIds = new Set(getWorkflowFieldsForNode(workflow, instance.currentNodeId).map((f) => f.id))
  return workflow.fields
    .filter((f) => !currentFieldIds.has(f.id) && instance.fieldValues?.[f.id] !== undefined)
    .map((field) => ({
      field,
      value: instance.fieldValues![field.id],
    }))
}

export function formatWorkflowFieldValue(
  field: { fieldType: import('@/types').WorkflowFieldType; options?: string[] },
  value: string | number | boolean | undefined,
): string {
  if (value === undefined || value === null || value === '') return '-'
  if (field.fieldType === 'switch') return value ? '是' : '否'
  if (field.fieldType === 'amount') return `¥${Number(value).toFixed(2)}`
  if (field.fieldType === 'attachment') return String(value) || '已上传'
  return String(value)
}

export interface WorkflowFieldEntry {
  fieldId: string
  name: string
  value: string
}

/** 某节点已填写的配置字段（用于生命周期展示） */
export function buildNodeFieldEntries(
  workflow: TaskWorkflow | undefined,
  nodeId: string,
  fieldValues?: Record<string, string | number | boolean>,
): WorkflowFieldEntry[] {
  if (!workflow || !fieldValues) return []
  return getWorkflowFieldsForNode(workflow, nodeId)
    .filter((f) => {
      const val = fieldValues[f.id]
      return val !== undefined && val !== null && val !== ''
    })
    .map((f) => ({
      fieldId: f.id,
      name: f.name,
      value: formatWorkflowFieldValue(f, fieldValues[f.id]),
    }))
}

/** 按节点汇总全部已填字段（字段会出现在其绑定的每个节点下） */
export function buildAllNodeFieldGroups(
  workflow: TaskWorkflow | undefined,
  fieldValues?: Record<string, string | number | boolean>,
): Array<{ nodeId: string; nodeName: string; entries: WorkflowFieldEntry[] }> {
  if (!workflow?.fields?.length || !fieldValues) return []
  const nodes = sortedWorkflowNodes(workflow)
  const nodeNameMap = new Map(nodes.map((n) => [n.id, n.name]))
  const groups = new Map<string, WorkflowFieldEntry[]>()

  for (const field of workflow.fields) {
    const val = fieldValues[field.id]
    if (val === undefined || val === null || val === '') continue
    const entry: WorkflowFieldEntry = {
      fieldId: field.id,
      name: field.name,
      value: formatWorkflowFieldValue(field, val),
    }
    const targetNodeIds = field.nodeIds.filter((id) => nodeNameMap.has(id))
    const ids = targetNodeIds.length ? targetNodeIds : []
    for (const nodeId of ids) {
      const list = groups.get(nodeId) ?? []
      if (!list.some((e) => e.fieldId === field.id)) list.push(entry)
      groups.set(nodeId, list)
    }
  }

  return nodes
    .filter((n) => groups.has(n.id))
    .map((n) => ({
      nodeId: n.id,
      nodeName: n.name,
      entries: groups.get(n.id)!,
    }))
}

export function extractEnterpriseActionNote(
  fields: import('@/types').WorkflowFieldConfig[],
  fieldValues: Record<string, string | number | boolean>,
  action: WorkflowAction,
): string {
  const preferNames = action === 'reject' || action === 'cancel'
    ? ['驳回原因', '中止原因', '原因', '备注', '意见', '说明']
    : ['审核意见', '备注', '意见', '说明']
  for (const name of preferNames) {
    const field = fields.find((f) => f.name.includes(name))
    if (field) {
      const val = fieldValues[field.id]
      if (val !== undefined && val !== null && String(val).trim()) return String(val).trim()
    }
  }
  const textarea = fields.find((f) => f.fieldType === 'textarea')
  if (textarea) {
    const val = fieldValues[textarea.id]
    if (val !== undefined && val !== null && String(val).trim()) return String(val).trim()
  }
  return ''
}

/** 统计引用该工作流的进行中任务数（status === active） */
export function countWorkflowBoundTasks(
  tasks: Pick<Task, 'workflowId' | 'status'>[],
  workflowId: string,
): number {
  return tasks.filter((t) => t.workflowId === workflowId && t.status === 'active').length
}
