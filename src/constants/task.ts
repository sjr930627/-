import type {
  DispatchMode,
  IndustryTag,
  TaskPublishStatus,
  TaskTypeStatus,
  WorkflowAction,
  WorkflowNodeType,
  WorkflowRole,
  WorkflowStatus,
} from '@/types'

export const industryTagMap: Record<IndustryTag, string> = {
  telecom: '运营商',
  insurance: '保险',
  fmcg: '快消',
  other: '其他',
}

export const workflowRoleMap: Record<WorkflowRole, string> = {
  worker: '灵工',
  enterprise: '企业管理员',
  operator: '运营后台',
  system: '系统自动',
}

export const workflowActionMap: Record<WorkflowAction, string> = {
  submit: '提报',
  approve: '审核通过',
  reject: '驳回',
  cancel: '取消',
  transfer: '转派',
}

export const workflowNodeTypeMap: Record<WorkflowNodeType, string> = {
  start: '起始',
  middle: '中间',
  end: '结束',
}

export const workflowStatusMap: Record<WorkflowStatus, string> = {
  enabled: '启用',
  disabled: '停用',
}

export const taskTypeStatusMap: Record<TaskTypeStatus, string> = {
  draft: '草稿',
  pending: '审批中',
  published: '已发布',
  rejected: '已驳回',
  disabled: '已停用',
}

export const taskPublishStatusMap: Record<TaskPublishStatus, string> = {
  draft: '未发布',
  active: '进行中',
  ended: '已结束',
  cancelled: '已取消',
}

export const dispatchModeMap: Record<DispatchMode, string> = {
  assign: '指派人员',
  hall: '任务大厅',
}

export const industryOptions = Object.entries(industryTagMap).map(([value, label]) => ({
  value,
  label,
}))

export function formatTaskTypePrice(row: {
  pricingMode: 'fixed' | 'tiered'
  fixedPrice?: number
  tieredPrices?: { minCount: number; maxCount: number; unitPrice: number }[]
}): string {
  if (row.pricingMode === 'fixed') {
    return row.fixedPrice != null ? `¥${row.fixedPrice}/单` : '-'
  }
  if (!row.tieredPrices?.length) return '-'
  return row.tieredPrices
    .map((t) => `${t.minCount}-${t.maxCount === 999 ? '∞' : t.maxCount}单 ¥${t.unitPrice}`)
    .join('；')
}
