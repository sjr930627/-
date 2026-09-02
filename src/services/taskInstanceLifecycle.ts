import type {
  Task,
  TaskInstance,
  TaskInstanceLog,
  TaskInstanceLogFieldEntry,
  TaskWorkflow,
  WorkflowNode,
} from '@/types'
import {
  buildAllNodeFieldGroups,
  buildNodeFieldEntries,
  resolveInstanceWorkflowStatus,
} from '@/services/task'
import { sortedWorkflowNodes } from '@/utils/workflow'

export interface TaskInstanceLifecycleRecord {
  id: string
  title: string
  tag?: string
  operator?: string
  time?: string
  description?: string
  type: 'system' | 'manual' | 'operation' | 'current' | 'terminal'
  /** 节点配置字段值（展示用） */
  fieldEntries?: TaskInstanceLogFieldEntry[]
}

function isTerminalStatus(
  instance: TaskInstance,
  workflow: TaskWorkflow | undefined,
): 'completed' | 'cancelled' | null {
  const status = resolveInstanceWorkflowStatus(instance, workflow)
  if (status === 'completed' || status === 'cancelled') return status
  return null
}

function isCancelEndNode(node: WorkflowNode): boolean {
  return (
    node.nodeType === 'end' &&
    (node.name.includes('取消') || node.name.includes('关闭') || node.name.includes('中止'))
  )
}

function isCompleteEndNode(node: WorkflowNode): boolean {
  return node.nodeType === 'end' && !isCancelEndNode(node)
}

function interpolateTime(startIso: string, endIso: string, index: number, total: number): string {
  if (total <= 1) return startIso
  const start = new Date(startIso).getTime()
  const end = new Date(endIso).getTime()
  const t = start + ((end - start) * index) / (total - 1)
  return new Date(t).toISOString()
}

/** 主流程节点（不含取消结束）按到达当前节点截断；取消则保留认领后直达取消 */
function resolveTraversalPath(
  workflow: TaskWorkflow,
  instance: TaskInstance,
): WorkflowNode[] {
  const nodes = sortedWorkflowNodes(workflow.nodes)
  const cancelEnds = nodes.filter(isCancelEndNode)
  const mainPath = nodes.filter((n) => !isCancelEndNode(n))
  const terminal = isTerminalStatus(instance, workflow)

  if (terminal === 'cancelled') {
    const start = mainPath[0]
    const cancel =
      cancelEnds.find((n) => n.id === instance.currentNodeId) ?? cancelEnds[0]
    // 取消前至少经过领取 + 一个执行节点（若存在）
    const mid = mainPath.find((n) => n.nodeType === 'middle' && n.role === 'worker')
    return [start, mid, cancel].filter(Boolean) as WorkflowNode[]
  }

  const idx = mainPath.findIndex((n) => n.id === instance.currentNodeId)
  if (idx >= 0) return mainPath.slice(0, idx + 1)
  // 当前节点不在主链（异常）时至少返回起点
  return mainPath[0] ? [mainPath[0]] : []
}

/**
 * 按工作流路径合成完整流转明细（认领 → 各节点提交/审核 → 当前/终态）
 * 用于无 logs 或需要补全演示数据的场景。
 */
export function synthesizeDetailedInstanceLogs(
  instance: TaskInstance,
  workflow: TaskWorkflow,
): TaskInstanceLog[] {
  const path = resolveTraversalPath(workflow, instance)
  if (!path.length) return []

  const terminal = isTerminalStatus(instance, workflow)
  const logs: TaskInstanceLog[] = []
  const totalSteps = Math.max(path.length * 2 - 1, 1)
  let step = 0

  path.forEach((node, index) => {
    const prev = path[index - 1]
    const isLast = index === path.length - 1
    const time = interpolateTime(
      instance.createdAt,
      instance.updatedAt,
      Math.min(step, totalSteps - 1),
      totalSteps,
    )
    step += 1

    if (index === 0) {
      logs.push({
        id: `syn_${instance.id}_${node.id}_claim`,
        title: `认领任务 · ${node.name}`,
        tag: isLast && !terminal ? '当前' : '起始',
        operator: instance.workerName,
        time: instance.createdAt,
        description: `${instance.workerName} 认领 ${instance.claimQuantity} 单，进入「${node.name}」。`,
        kind: 'system',
        fieldEntries: buildNodeFieldEntries(workflow, node.id, instance.fieldValues),
      })
      return
    }

    // 灵工节点提交
    if (
      prev &&
      prev.role === 'worker' &&
      (node.role === 'enterprise' ||
        node.role === 'operator' ||
        node.role === 'system' ||
        node.role === 'worker')
    ) {
      const submitTime = interpolateTime(
        instance.createdAt,
        instance.updatedAt,
        Math.min(step, totalSteps - 1),
        totalSteps,
      )
      step += 1
      if (!isCancelEndNode(node)) {
        logs.push({
          id: `syn_${instance.id}_${prev.id}_submit`,
          title: `灵工提交：${prev.name}`,
          tag: '灵工操作',
          operator: instance.workerName,
          time: submitTime,
          description: `已完成「${prev.name}」节点提交，流转至「${node.name}」。`,
          kind: 'system',
          fieldEntries: buildNodeFieldEntries(workflow, prev.id, instance.fieldValues),
        })
      }
    }

    // 企业/运营审核通过后进入系统节点
    if (
      prev &&
      (prev.role === 'enterprise' || prev.role === 'operator') &&
      (node.role === 'system' || isCompleteEndNode(node))
    ) {
      const reviewTime = interpolateTime(
        instance.createdAt,
        instance.updatedAt,
        Math.min(step, totalSteps - 1),
        totalSteps,
      )
      step += 1
      logs.push({
        id: `syn_${instance.id}_${prev.id}_review`,
        title: '企业审核通过',
        tag: '企业操作',
        operator: '企业',
        time: reviewTime,
        description: `「${prev.name}」审核通过${buildNodeFieldEntries(workflow, prev.id, instance.fieldValues).length ? '，已保存节点字段' : ''}。`,
        kind: 'manual',
        fieldEntries: buildNodeFieldEntries(workflow, prev.id, instance.fieldValues),
      })
    }

    if (isCancelEndNode(node)) {
      logs.push({
        id: `syn_${instance.id}_cancelled`,
        title: '任务已取消',
        tag: '已取消',
        operator: '系统',
        time: instance.updatedAt,
        description: `${instance.workerName} 的认领任务已取消。`,
        kind: 'manual',
      })
      return
    }

    const enterTag =
      isLast && !terminal
        ? '当前'
        : isCompleteEndNode(node)
          ? '已完成'
          : node.role === 'system'
            ? '系统自动'
            : undefined

    logs.push({
      id: `syn_${instance.id}_${node.id}_enter`,
      title: `进入「${node.name}」节点`,
      tag: enterTag,
      operator:
        node.role === 'enterprise' || node.role === 'operator'
          ? '企业'
          : node.role === 'system'
            ? '系统'
            : instance.workerName,
      time: isLast ? instance.updatedAt : time,
      description: isCompleteEndNode(node)
        ? `${instance.workerName} 已完成 ${instance.claimQuantity} 单任务。`
        : `流程流转至「${node.name}」。`,
      kind: 'system',
      fieldEntries: buildNodeFieldEntries(workflow, node.id, instance.fieldValues),
    })
  })

  return logs
}

function synthesizeLogs(instance: TaskInstance, workflow: TaskWorkflow): TaskInstanceLog[] {
  return synthesizeDetailedInstanceLogs(instance, workflow)
}

function mergeFieldEntries(
  base: TaskInstanceLogFieldEntry[] | undefined,
  extra: TaskInstanceLogFieldEntry[],
): TaskInstanceLogFieldEntry[] {
  const map = new Map<string, TaskInstanceLogFieldEntry>()
  for (const item of base ?? []) map.set(item.fieldId, item)
  for (const item of extra) map.set(item.fieldId, item)
  return [...map.values()]
}

function findRecordForNode(
  records: TaskInstanceLifecycleRecord[],
  nodeName: string,
): TaskInstanceLifecycleRecord | undefined {
  const quoted = `「${nodeName}」`
  return (
    records.find((r) => r.title.includes(quoted)) ??
    records.find((r) => r.title.includes(nodeName))
  )
}

/** 将所有节点已填字段挂到对应流转记录；无匹配记录时补一条字段记录 */
function attachAllNodeFieldEntries(
  records: TaskInstanceLifecycleRecord[],
  instance: TaskInstance,
  workflow: TaskWorkflow | undefined,
): TaskInstanceLifecycleRecord[] {
  const groups = buildAllNodeFieldGroups(workflow, instance.fieldValues)
  if (!groups.length) return records

  const next = [...records]

  for (const group of groups) {
    const matched = findRecordForNode(next, group.nodeName)
    if (matched) {
      matched.fieldEntries = mergeFieldEntries(matched.fieldEntries, group.entries)
      continue
    }

    next.push({
      id: `fields_${group.nodeId}`,
      title: `节点「${group.nodeName}」采集字段`,
      tag: '字段',
      operator: instance.workerName,
      time: instance.updatedAt,
      description: `展示「${group.nodeName}」节点配置字段填写结果。`,
      type: 'system',
      fieldEntries: group.entries,
    })
  }

  return next
}

export function buildTaskInstanceLifecycleRecords(
  instance: TaskInstance,
  task: Task | undefined,
  workflow: TaskWorkflow | undefined,
  includeOpLogs = true,
): TaskInstanceLifecycleRecord[] {
  const terminal = workflow ? isTerminalStatus(instance, workflow) : null

  // 日志过少（如仅一条取消）时按工作流补全完整流转明细
  const rawLogs = instance.logs ?? []
  const needSynthesize =
    Boolean(workflow) &&
    (rawLogs.length < 2 ||
      (terminal === 'cancelled' && rawLogs.length < 3) ||
      (terminal === 'completed' && rawLogs.length < 3))

  let source: TaskInstanceLog[] =
    workflow && needSynthesize
      ? synthesizeDetailedInstanceLogs(instance, workflow)
      : rawLogs.length
        ? [...rawLogs].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
        : task && workflow
          ? synthesizeLogs(instance, workflow)
          : []

  // 若有人工取消记录，合并进合成明细末尾说明
  if (workflow && terminal === 'cancelled' && rawLogs.length) {
    const manualCancel = rawLogs.find(
      (l) => l.kind === 'manual' && (l.title.includes('取消') || l.tag === '人工干预'),
    )
    if (manualCancel && source.every((l) => l.id !== manualCancel.id)) {
      const withoutSynCancel = source.filter((l) => !l.title.includes('已取消'))
      source = [
        ...withoutSynCancel,
        {
          ...manualCancel,
          tag: manualCancel.tag ?? '已取消',
        },
      ]
    }
  }

  if (!includeOpLogs) {
    source = source.filter((l) => l.kind !== 'operation')
  }

  let records: TaskInstanceLifecycleRecord[] = source.map((log) => ({
    id: log.id,
    title: log.title,
    tag: log.tag,
    operator: log.operator,
    time: log.time,
    description: log.description,
    fieldEntries: log.fieldEntries?.length ? [...log.fieldEntries] : undefined,
    type:
      log.kind === 'manual'
        ? terminal === 'cancelled'
          ? 'terminal'
          : 'manual'
        : log.tag === '当前' && !terminal
          ? 'current'
          : log.kind === 'operation'
            ? 'operation'
            : terminal
              ? 'terminal'
              : 'system',
  }))

  records = attachAllNodeFieldEntries(records, instance, workflow)

  if (records.length && !terminal) {
    const currentIdx = records.findIndex((r) => r.type === 'current')
    if (currentIdx >= 0) {
      records.forEach((r, i) => {
        if (i !== currentIdx && r.type === 'current') r.type = 'system'
      })
    } else {
      records[records.length - 1]!.type = 'current'
    }
  }

  return records.reverse()
}

export function calcInstanceTimeoutHours(instance: TaskInstance): number | null {
  if (!instance.timeoutAt) return null
  const diff = Date.now() - new Date(instance.timeoutAt).getTime()
  if (diff <= 0) return null
  return Math.round(diff / (1000 * 60 * 60))
}
