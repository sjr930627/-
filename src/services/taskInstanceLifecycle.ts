import type { Task, TaskInstance, TaskInstanceLog, TaskWorkflow } from '@/types'
import { sortedWorkflowNodes } from '@/utils/workflow'

export interface TaskInstanceLifecycleRecord {
  id: string
  title: string
  tag?: string
  operator?: string
  time?: string
  description?: string
  type: 'system' | 'manual' | 'operation' | 'current'
}

function getMainPathNodeIds(workflow: TaskWorkflow): string[] {
  const sorted = sortedWorkflowNodes(workflow.nodes)
  const endNames = ['取消', '关闭']
  return sorted
    .filter((n) => n.nodeType !== 'end' || !endNames.some((k) => n.name.includes(k)))
    .slice(0, 6)
    .map((n) => n.id)
}

function synthesizeLogs(
  instance: TaskInstance,
  task: Task,
  workflow: TaskWorkflow,
): TaskInstanceLog[] {
  const pathIds = getMainPathNodeIds(workflow)
  const currentIdx = pathIds.indexOf(instance.currentNodeId)
  const logs: TaskInstanceLog[] = [
    {
      id: 'syn_created',
      title: '任务创建',
      tag: '起始',
      operator: task.enterpriseName,
      time: task.createdAt,
      description: `企业创建任务「${task.name}」。`,
      kind: 'system',
    },
    {
      id: 'syn_published',
      title: '任务发布',
      tag: '系统自动',
      operator: '系统',
      time: task.createdAt,
      description: '任务已发布至任务大厅，灵工可认领。',
      kind: 'system',
    },
    {
      id: 'syn_claimed',
      title: `${sortedWorkflowNodes(workflow.nodes)[0]?.name ?? '待领取'} → ${instance.currentNodeName}`,
      tag: '系统自动',
      operator: instance.workerName,
      time: instance.createdAt,
      description: `${instance.workerName} 认领 ${instance.claimQuantity} 单。`,
      kind: 'system',
    },
  ]

  if (currentIdx > 1) {
    for (let i = 1; i < currentIdx; i++) {
      const node = workflow.nodes.find((n) => n.id === pathIds[i])
      if (!node) continue
      logs.push({
        id: `syn_node_${i}`,
        title: `进入「${node.name}」节点`,
        tag: '系统自动',
        operator: instance.workerName,
        time: instance.createdAt,
        kind: 'system',
      })
    }
  }

  logs.push({
    id: 'syn_current',
    title: `进入「${instance.currentNodeName}」节点`,
    tag: '当前',
    operator: instance.workerName,
    time: instance.updatedAt,
    description: '任务执行中，等待下一步操作。',
    kind: 'system',
  })

  return logs
}

export function buildTaskInstanceLifecycleRecords(
  instance: TaskInstance,
  task: Task | undefined,
  workflow: TaskWorkflow | undefined,
  includeOpLogs = true,
): TaskInstanceLifecycleRecord[] {
  let source: TaskInstanceLog[] = instance.logs?.length
    ? [...instance.logs].sort((a, b) => new Date(a.time).getTime() - new Date(b.time).getTime())
    : task && workflow
      ? synthesizeLogs(instance, task, workflow)
      : []

  if (!includeOpLogs) {
    source = source.filter((l) => l.kind !== 'operation')
  }

  const records: TaskInstanceLifecycleRecord[] = source.map((log) => ({
    id: log.id,
    title: log.title,
    tag: log.tag,
    operator: log.operator,
    time: log.time,
    description: log.description,
    type:
      log.kind === 'manual'
        ? 'manual'
        : log.tag === '当前'
          ? 'current'
          : log.kind === 'operation'
            ? 'operation'
            : 'system',
  }))

  if (records.length) {
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
