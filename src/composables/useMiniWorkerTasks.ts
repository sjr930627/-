import { computed } from 'vue'
import { useAppStore } from '@/stores/app'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import {
  getNodeStatusTone,
  isPendingWorkerAction,
  type NodeStatusTone,
} from '@/services/miniTask'
import { sortedWorkflowNodes } from '@/services/task'
import type { TaskInstance, TaskWorkflow } from '@/types'

export type WorkerTaskStatus = 'in_progress' | 'completed' | 'settled' | 'cancelled'

export function isTaskInstanceCancelled(
  instance: TaskInstance,
  workflow: TaskWorkflow | undefined,
): boolean {
  if (instance.currentNodeName.includes('已取消')) return true
  const node = workflow?.nodes.find((n) => n.id === instance.currentNodeId)
  return (
    node?.id === 'node_cancelled' ||
    (node?.nodeType === 'end' && node.name.includes('取消'))
  )
}

export function classifyWorkerTask(
  instance: TaskInstance,
  workflow: TaskWorkflow | undefined,
): WorkerTaskStatus {
  if (isTaskInstanceCancelled(instance, workflow)) return 'cancelled'
  if (instance.currentNodeName.includes('已结算')) return 'settled'
  const nodes = workflow ? sortedWorkflowNodes(workflow) : []
  const node = nodes.find((n) => n.id === instance.currentNodeId)
  if (node?.nodeType === 'end' || instance.currentNodeName.includes('已完成')) {
    return 'completed'
  }
  return 'in_progress'
}

export function calcInstanceProgress(instance: TaskInstance, workflow: TaskWorkflow | undefined) {
  if (!workflow) return { progress: 0, stepIndex: 0, stepTotal: 0, isDone: false }
  const nodes = sortedWorkflowNodes(workflow)
  const idx = nodes.findIndex((n) => n.id === instance.currentNodeId)
  const isDone = idx >= 0 && nodes[idx]?.nodeType === 'end'
  const stepTotal = nodes.length
  const progress =
    idx < 0 ? 0 : isDone ? 100 : Math.round((idx / Math.max(stepTotal - 1, 1)) * 100)
  return { progress, stepIndex: idx + 1, stepTotal, isDone }
}

const statusLabelMap: Record<WorkerTaskStatus, string> = {
  in_progress: '进行中',
  completed: '已完成',
  settled: '已结算',
  cancelled: '已取消',
}

export function useMiniWorkerTasks() {
  const store = useAppStore()
  const { employeeId } = useMiniAppWorker()

  const myTasks = computed(() =>
    store.taskInstances
      .filter((i) => i.workerId === employeeId.value)
      .map((instance) => {
        const task = store.tasks.find((t) => t.id === instance.taskId)
        const workflow = store.taskWorkflows.find((w) => w.id === task?.workflowId)
        const status = classifyWorkerTask(instance, workflow)
        return {
          instance,
          status,
          statusLabel: statusLabelMap[status],
          statusTone: getNodeStatusTone(instance, workflow),
          pendingMyAction: status === 'in_progress' && isPendingWorkerAction(instance, workflow),
          ...calcInstanceProgress(instance, workflow),
        }
      })
      .sort((a, b) => b.instance.updatedAt.localeCompare(a.instance.updatedAt)),
  )

  const counts = computed(() => ({
    in_progress: myTasks.value.filter((t) => t.status === 'in_progress').length,
    completed: myTasks.value.filter((t) => t.status === 'completed').length,
    settled: myTasks.value.filter((t) => t.status === 'settled').length,
    cancelled: myTasks.value.filter((t) => t.status === 'cancelled').length,
  }))

  const pendingMyActionCount = computed(
    () => myTasks.value.filter((t) => t.pendingMyAction).length,
  )

  function tasksByStatus(status: WorkerTaskStatus, onlyPendingMine = false) {
    let list = myTasks.value.filter((t) => t.status === status)
    if (onlyPendingMine) list = list.filter((t) => t.pendingMyAction)
    return list
  }

  return {
    myTasks,
    counts,
    pendingMyActionCount,
    tasksByStatus,
    statusLabelMap,
  }
}

export type { NodeStatusTone }
