import type { TaskType } from '@/types'
import { taskTypeStatusMap } from '@/constants/task'

export interface TaskTypeLifecycleRecord {
  id: string
  title: string
  tag?: string
  operator?: string
  time?: string
  description?: string
  type: 'system' | 'manual' | 'current'
}

export function buildTaskTypeLifecycleRecords(taskType: TaskType): TaskTypeLifecycleRecord[] {
  const records: TaskTypeLifecycleRecord[] = [
    {
      id: 'created',
      title: '创建任务类型',
      tag: '草稿',
      operator: taskType.applicant ?? taskType.enterpriseName,
      time: taskType.createdAt,
      description: `企业创建任务类型「${taskType.name}」，保存为草稿。`,
      type: 'system',
    },
  ]

  if (taskType.submittedAt) {
    records.push({
      id: 'submitted',
      title: '提交审批',
      tag: '审批中',
      operator: taskType.applicant ?? '-',
      time: taskType.submittedAt,
      description: '任务类型已提交至运营后台，等待审批。',
      type: 'system',
    })
  }

  if (taskType.reviewedAt) {
    const approved = taskType.status === 'published' || taskType.status === 'disabled'
    records.push({
      id: 'reviewed',
      title: approved ? '审批通过' : '审批驳回',
      tag: taskTypeStatusMap[taskType.status],
      operator: taskType.reviewedBy ?? '运营人员',
      time: taskType.reviewedAt,
      description: taskType.reviewNote ?? (approved ? '任务类型已生效，企业可据此发布任务。' : '请根据审批意见修改后重新提交。'),
      type: approved ? 'system' : 'manual',
    })
  }

  if (taskType.status === 'disabled') {
    records.push({
      id: 'disabled',
      title: '停用任务类型',
      tag: '已停用',
      operator: taskType.enterpriseName,
      description: '企业停用该任务类型，不可再创建新任务。',
      type: 'manual',
    })
  }

  if (records.length) {
    records[records.length - 1]!.type = 'current'
  }

  return records.reverse()
}
