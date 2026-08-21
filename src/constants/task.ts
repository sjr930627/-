import type {
  DispatchMode,
  Enterprise,
  IndustryTag,
  TaskPublishStatus,
  TaskTypeStatus,
  TaskWorkflow,
  WorkflowAction,
  WorkflowFieldType,
  WorkflowNodeType,
  WorkflowPrerequisite,
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
  enterprise: '企业',
  operator: '后台',
  system: '系统',
}

export const workflowActionMap: Record<WorkflowAction, string> = {
  submit: '提交',
  confirm: '确认',
  approve: '确认',
  reject: '拒绝',
  accept: '接受/抢单',
  cancel: '取消',
  punch: '打卡',
  transfer: '转派',
}

/** 节点配置面板展示的可选动作（不含转派） */
export const workflowNodeActionOptions: WorkflowAction[] = [
  'submit',
  'confirm',
  'reject',
  'accept',
  'cancel',
  'punch',
]

export const workflowPrerequisiteMap: Record<WorkflowPrerequisite, string> = {
  upload_file: '上传文件',
  customer_signature: '客户签名',
  related_training: '关联培训',
  time_condition: '时间条件',
  punch: '打卡',
}

export const workflowFieldTypeMap: Record<WorkflowFieldType, string> = {
  text: '文本',
  select: '下拉',
  date: '日期',
  amount: '金额',
  attachment: '附件',
  textarea: '多行文本',
  switch: '开关',
}

export const workflowNodeTypeMap: Record<WorkflowNodeType, string> = {
  start: '起始节点',
  middle: '中间节点',
  end: '结束节点',
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
  pending: '待审核',
  active: '进行中',
  ended: '已结束',
  cancelled: '已取消',
  rejected: '已驳回',
}

export const dispatchModeMap: Record<DispatchMode, string> = {
  assign: '指派人员',
  hall: '任务大厅',
}

export const industryOptions = Object.entries(industryTagMap).map(([value, label]) => ({
  value,
  label,
}))

export function formatWorkflowEnterpriseLabel(
  workflow: Pick<TaskWorkflow, 'enterpriseScope' | 'enterpriseIds'>,
  enterprises: Enterprise[],
): string {
  if (workflow.enterpriseScope === 'all') return '全部企业'
  const ids = workflow.enterpriseIds ?? []
  if (!ids.length) return '未指定企业'
  return ids
    .map((id) => enterprises.find((e) => e.id === id)?.name ?? id)
    .join('、')
}

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

/** 优先取任务自身定价，兼容旧数据回退任务类型 */
export function resolveTaskPricing(
  task: {
    pricingMode?: 'fixed' | 'tiered'
    fixedPrice?: number
    tieredPrices?: { minCount: number; maxCount: number; unitPrice: number }[]
    pricingUnit?: 'piece' | 'time'
    taskTypeId?: string
  },
  taskTypes: Array<{
    id: string
    pricingMode: 'fixed' | 'tiered'
    fixedPrice?: number
    tieredPrices?: { minCount: number; maxCount: number; unitPrice: number }[]
    pricingUnit?: 'piece' | 'time'
  }>,
) {
  if (task.pricingMode) {
    return {
      pricingMode: task.pricingMode,
      fixedPrice: task.fixedPrice,
      tieredPrices: task.tieredPrices,
      pricingUnit: task.pricingUnit,
    }
  }
  if (!task.taskTypeId) return undefined
  return taskTypes.find((t) => t.id === task.taskTypeId)
}

/** 客户单价参考值（固定价或阶梯首档） */
export function resolveTaskCustomerUnitPrice(task: {
  pricingMode?: 'fixed' | 'tiered'
  fixedPrice?: number
  tieredPrices?: { unitPrice: number }[]
}): number {
  if (task.pricingMode === 'tiered') {
    return task.tieredPrices?.[0]?.unitPrice ?? 0
  }
  return task.fixedPrice ?? 0
}

/** 灵工结算单价：审批配置优先，否则回退客户单价 */
export function resolveTaskSettlementUnitPrice(task: {
  settlementUnitPrice?: number
  pricingMode?: 'fixed' | 'tiered'
  fixedPrice?: number
  tieredPrices?: { unitPrice: number }[]
}): number {
  if (task.settlementUnitPrice != null && task.settlementUnitPrice >= 0) {
    return task.settlementUnitPrice
  }
  return resolveTaskCustomerUnitPrice(task)
}

export function formatTaskQuantity(
  unlimited: boolean | undefined,
  quantity: number | undefined,
): string {
  if (unlimited || quantity == null) return '无上限'
  return `${quantity} 单`
}
