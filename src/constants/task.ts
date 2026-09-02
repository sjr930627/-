import type {
  DispatchMode,
  Enterprise,
  IndustryTag,
  TaskPublishStatus,
  TaskTypeStatus,
  TaskWorkflow,
  WorkflowAction,
  PunchMethod,
  WorkflowEntryConditionType,
  WorkflowEntryListenTarget,
  WorkflowEntryTimeoutAction,
  WorkflowEventSource,
  WorkflowPunchCountMode,
  WorkflowPunchLocationSource,
  WorkflowPunchNavigateMode,
  WorkflowPunchTimeSource,
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

export const workflowEntryConditionTypeMap: Record<WorkflowEntryConditionType, string> = {
  punch_record: '待打卡记录',
  time_condition: '时间条件',
  field_filled: '字段校验',
  none: '无条件',
}

export const workflowPunchNavigateModeMap: Record<WorkflowPunchNavigateMode, string> = {
  jump_to_punch_page: '点击任务跳转打卡页',
  in_task: '任务内直接打卡',
}

export const workflowPunchCountModeMap: Record<WorkflowPunchCountMode, string> = {
  clock_in_only: '仅上班打卡',
  clock_in_out: '上下班打卡',
  each_service_period: '每个服务时段都需打卡',
}

export const workflowPunchLocationSourceMap: Record<WorkflowPunchLocationSource, string> = {
  task_region: '任务创建时的「任务地点」',
  task_field: '任务录入的自定义字段',
  attendance_group: '执行人考勤组地点',
}

export const workflowPunchTimeSourceMap: Record<WorkflowPunchTimeSource, string> = {
  task_schedule: '任务起止时间（发布时录入）',
  task_field: '任务录入的自定义字段',
  fixed_window: '固定服务时段',
}

export const workflowPunchMethodOptions: PunchMethod[] = ['gps', 'wifi', 'field', 'qrcode']

export const workflowPunchMethodMap: Record<PunchMethod, string> = {
  gps: '定位打卡',
  wifi: 'WiFi打卡',
  field: '外勤打卡',
  qrcode: '扫码打卡',
}

export const workflowEventSourceMap: Record<WorkflowEventSource, string> = {
  attendance: '考勤模块',
  task: '任务模块',
  training: '培训模块',
  finance: '财务模块',
}

export const workflowEventNameOptions: Record<WorkflowEventSource, { value: string; label: string }[]> = {
  attendance: [
    { value: 'punch_complete', label: '打卡完成' },
    { value: 'punch_on_time', label: '按时打卡' },
    { value: 'punch_missed', label: '缺卡记录' },
  ],
  task: [
    { value: 'submit_complete', label: '提交完成' },
    { value: 'proof_uploaded', label: '凭证已上传' },
  ],
  training: [
    { value: 'course_complete', label: '课程完成' },
    { value: 'exam_passed', label: '考试通过' },
  ],
  finance: [
    { value: 'invoice_uploaded', label: '发票已上传' },
    { value: 'settlement_ready', label: '结算就绪' },
  ],
}

export const workflowEntryListenTargetMap: Record<WorkflowEntryListenTarget, string> = {
  task_executor: '任务执行人',
  specified_person: '指定人员',
}

export const workflowEntryTimeoutActionMap: Record<WorkflowEntryTimeoutAction, string> = {
  auto_cancel: '自动取消',
  auto_advance: '自动流转',
  notify_only: '仅提醒',
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
  middle: '普通节点',
  end: '终止节点',
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
