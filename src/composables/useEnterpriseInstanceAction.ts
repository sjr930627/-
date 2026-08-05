import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import {
  extractEnterpriseActionNote,
  getEnterpriseActionUiMeta,
  getWorkflowFieldsForNode,
} from '@/services/task'
import type { WorkflowAction, WorkflowActionConfig } from '@/types'

export function useEnterpriseInstanceAction() {
  const store = useAppStore()

  async function runEnterpriseAction(
    instanceId: string,
    actionConfig: WorkflowActionConfig,
    fieldValues?: Record<string, string | number | boolean>,
  ) {
    const meta = getEnterpriseActionUiMeta(actionConfig)
    const action = actionConfig.action
    const instance = store.taskInstances.find((i) => i.id === instanceId)
    const task = instance ? store.tasks.find((t) => t.id === instance.taskId) : undefined
    const workflow = task ? store.taskWorkflows.find((w) => w.id === task.workflowId) : undefined
    const nodeFields =
      instance && workflow ? getWorkflowFieldsForNode(workflow, instance.currentNodeId) : []
    const hasConfiguredFields = nodeFields.length > 0

    try {
      let note = ''
      if (hasConfiguredFields && fieldValues) {
        note = extractEnterpriseActionNote(nodeFields, fieldValues, action)
      } else if (meta.needNote) {
        const { value } = await ElMessageBox.prompt(
          meta.noteRequired
            ? action === 'cancel'
              ? '请填写中止原因'
              : '请填写驳回原因'
            : '审核意见（可选）',
          meta.label,
          {
            inputValue: action === 'confirm' || action === 'approve' ? '审核通过' : '',
            inputPlaceholder: '请输入',
            inputValidator: (v) => {
              if (meta.noteRequired && !v?.trim()) {
                return action === 'cancel' ? '请填写中止原因' : '请填写驳回原因'
              }
              return true
            },
          },
        )
        note = value?.trim() ?? ''
      } else if (action === 'confirm' || action === 'approve') {
        await ElMessageBox.confirm('确认审核通过？任务将标记为完成。', meta.label, { type: 'success' })
      } else if (action === 'cancel') {
        await ElMessageBox.confirm('确认结束该认领任务？任务将直接中止。', meta.label, { type: 'warning' })
      }

      store.executeEnterpriseInstanceAction(instanceId, normalizeAction(action), {
        note,
        fieldValues,
      })

      if (action === 'confirm' || action === 'approve') {
        ElMessage.success('审核通过，任务已完成')
      } else if (action === 'reject') {
        ElMessage.success('已驳回，灵工需重新提交')
      } else if (action === 'cancel') {
        ElMessage.success('任务已中止')
      } else {
        ElMessage.success('操作成功')
      }
    } catch (e) {
      if (e instanceof Error && e.message !== 'cancel') {
        ElMessage.error(e.message)
      }
    }
  }

  return { runEnterpriseAction, getEnterpriseActionUiMeta }
}

function normalizeAction(action: WorkflowAction): WorkflowAction {
  return action === 'approve' ? 'confirm' : action
}
