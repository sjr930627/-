import { computed } from 'vue'
import { useAppStore } from '@/stores/app'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import { sortedWorkflowNodes } from '@/services/task'
import type { TaskInstance, TaskWorkflow } from '@/types'

export type WorkerTaskStatus = 'in_progress' | 'completed' | 'settled'

export function classifyWorkerTask(
  instance: TaskInstance,
  workflow: TaskWorkflow | undefined,
): WorkerTaskStatus {
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
          ...calcInstanceProgress(instance, workflow),
        }
      })
      .sort((a, b) => b.instance.updatedAt.localeCompare(a.instance.updatedAt)),
  )

  const counts = computed(() => ({
    in_progress: myTasks.value.filter((t) => t.status === 'in_progress').length,
    completed: myTasks.value.filter((t) => t.status === 'completed').length,
    settled: myTasks.value.filter((t) => t.status === 'settled').length,
  }))

  function tasksByStatus(status: WorkerTaskStatus) {
    return myTasks.value.filter((t) => t.status === status)
  }

  return { myTasks, counts, tasksByStatus, statusLabelMap }
}
