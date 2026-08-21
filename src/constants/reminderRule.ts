import type {
  ReminderChannel,
  ReminderCondition,
  ReminderConditionLogic,
  ReminderConditionOperator,
  ReminderLevel,
  ReminderReceiverMode,
  ReminderRuleStatus,
  ReminderSceneCategory,
  ReminderTriggerMode,
} from '@/types'

export const reminderSceneOptions: { value: ReminderSceneCategory; label: string }[] = [
  { value: 'recruitment', label: '招聘线索' },
  { value: 'attendance', label: '考勤异常' },
  { value: 'schedule', label: '排班管理' },
  { value: 'settlement', label: '结算提醒' },
  { value: 'insurance', label: '保险模块' },
  { value: 'ops', label: '系统运维' },
]

export const reminderSceneMap = Object.fromEntries(
  reminderSceneOptions.map((o) => [o.value, o.label]),
) as Record<ReminderSceneCategory, string>

export const reminderStatusMap: Record<
  ReminderRuleStatus,
  { label: string; tag: 'success' | 'info' }
> = {
  active: { label: '生效', tag: 'success' },
  disabled: { label: '停用', tag: 'info' },
}

export const reminderLevelOptions: { value: ReminderLevel; label: string }[] = [
  { value: 'urgent', label: '紧急' },
  { value: 'important', label: '重要' },
  { value: 'normal', label: '普通' },
]

export const reminderLevelMap = Object.fromEntries(
  reminderLevelOptions.map((o) => [o.value, o.label]),
) as Record<ReminderLevel, string>

export const reminderChannelOptions: { value: ReminderChannel; label: string }[] = [
  { value: 'todo', label: '工作台待办' },
  { value: 'inbox', label: '站内信' },
  { value: 'push', label: '推送通知' },
  { value: 'sms', label: '短信' },
]

export const reminderTriggerModeOptions: {
  value: ReminderTriggerMode
  label: string
  desc: string
}[] = [
  { value: 'realtime', label: '实时触发', desc: '条件满足后立即推送' },
  { value: 'scheduled', label: '定时触发', desc: '每日固定时间扫描' },
  { value: 'delayed', label: '延时触发', desc: '条件满足后延时 N 分钟' },
]

export const reminderReceiverModeOptions: { value: ReminderReceiverMode; label: string }[] = [
  { value: 'role', label: '指定角色' },
  { value: 'person', label: '指定人员' },
  { value: 'dynamic', label: '动态匹配' },
]

export const reminderRoleOptions = [
  { value: 'worker', label: '灵工本人' },
  { value: 'account_manager', label: '客户经理' },
  { value: 'supervisor', label: '主管' },
  { value: 'scheduler', label: '排班员' },
  { value: 'finance', label: '财务' },
  { value: 'ops', label: '运营' },
]

export const reminderRoleMap = Object.fromEntries(
  reminderRoleOptions.map((o) => [o.value, o.label]),
) as Record<string, string>

export const reminderTriggerTargetOptions = [
  { value: 'schedule_assignment', label: '排班实例' },
  { value: 'recruitment_lead', label: '招聘线索' },
  { value: 'attendance_exception', label: '考勤异常' },
  { value: 'settlement_bill', label: '结算账单' },
  { value: 'insurance_policy', label: '保险保单' },
  { value: 'system_alert', label: '系统告警' },
]

export const reminderDataSourceOptions = [
  { value: 'attendance_punch', label: '考勤打卡记录' },
  { value: 'recruitment_progress', label: '招聘进度' },
  { value: 'schedule_publish', label: '排班发布记录' },
  { value: 'settlement_flow', label: '结算流水' },
  { value: 'insurance_api', label: '投保接口日志' },
  { value: 'system_monitor', label: '系统监控指标' },
]

export const reminderConditionFieldOptions = [
  { value: 'schedule_status', label: '排班状态' },
  { value: 'minutes_since_start', label: '当前时间 - 排班开始时间' },
  { value: 'punch_status', label: '打卡状态' },
  { value: 'gps_offset_meters', label: 'GPS偏离距离' },
  { value: 'hours_since_assign', label: '分配后未跟进时长' },
  { value: 'days_in_stage', label: '阶段停留天数' },
  { value: 'hours_before_start', label: '距班次开始' },
  { value: 'hours_since_submit', label: '提交后未审时长' },
  { value: 'bank_result', label: '银行返回结果' },
  { value: 'clock_time', label: '定时钟点' },
]

export const reminderOperatorOptions: { value: ReminderConditionOperator; label: string }[] = [
  { value: 'eq', label: '=' },
  { value: 'neq', label: '≠' },
  { value: 'gt', label: '>' },
  { value: 'gte', label: '≥' },
  { value: 'lt', label: '<' },
  { value: 'lte', label: '≤' },
  { value: 'contains', label: '包含' },
]

export const reminderConditionLogicOptions: {
  value: ReminderConditionLogic
  label: string
  desc: string
}[] = [
  { value: 'and', label: '且', desc: '同时满足' },
  { value: 'or', label: '或', desc: '满足其一' },
]

export const reminderConditionLogicMap: Record<ReminderConditionLogic, string> = {
  and: '且',
  or: '或',
}

export const reminderUnitOptions = [
  { value: '', label: '无' },
  { value: 'minute', label: '分钟' },
  { value: 'hour', label: '小时' },
  { value: 'day', label: '天' },
  { value: 'meter', label: '米' },
]

export function formatReminderConditions(
  conditions: Pick<ReminderCondition, 'field' | 'operator' | 'value' | 'unit' | 'logic'>[],
): string {
  if (!conditions.length) return '-'
  const fieldMap = Object.fromEntries(reminderConditionFieldOptions.map((o) => [o.value, o.label]))
  const opMap = Object.fromEntries(reminderOperatorOptions.map((o) => [o.value, o.label]))
  const unitMap = Object.fromEntries(reminderUnitOptions.map((o) => [o.value, o.label]))
  return conditions
    .map((c, idx) => {
      const logic = c.logic === 'or' ? 'or' : 'and'
      const prefix = idx === 0 ? '' : `${reminderConditionLogicMap[logic]} `
      const field = fieldMap[c.field] ?? c.field
      const op = opMap[c.operator] ?? c.operator
      const unit = c.unit ? unitMap[c.unit] || c.unit : ''
      return `${prefix}${field} ${op} ${c.value}${unit ? unit : ''}`
    })
    .join(' ')
}

export function createEmptyCondition(
  id: string,
  logic: ReminderConditionLogic = 'and',
): ReminderCondition {
  return {
    id,
    field: 'schedule_status',
    operator: 'eq',
    value: '',
    unit: '',
    logic,
  }
}
