import type { BillingFormulaFieldKey, BillingRule, Enterprise } from '@/types'
import type { BillImportTemplate } from '@/types'
import { collectTemplateFormulaFields } from '@/constants/billImportTemplate'

export type FormulaFieldDef = {
  key: string
  label: string
  description: string
  unit?: string
}

export const billingFormulaFields: {
  key: BillingFormulaFieldKey
  label: string
  description: string
  unit?: string
}[] = [
  { key: 'attendance_days', label: '考勤天数', description: '当月有效出勤天数', unit: '天' },
  { key: 'work_hours', label: '出勤工时', description: '当月累计出勤工时', unit: '小时' },
  { key: 'hourly_rate', label: '客户时薪单价', description: '客户约定时薪单价', unit: '元/小时' },
  { key: 'overtime_hours', label: '加班工时', description: '当月加班工时', unit: '小时' },
  { key: 'overtime_rate', label: '加班时薪单价', description: '加班计薪单价', unit: '元/小时' },
  { key: 'deductions', label: '扣款', description: '考勤扣款、违规扣款等', unit: '元' },
  { key: 'task_count', label: '任务完成数', description: '当月完成任务数量', unit: '个' },
  { key: 'task_unit_price', label: '客户任务单价', description: '客户约定任务单价', unit: '元/个' },
  { key: 'upload_settlement_amount', label: '上传表单结算金额', description: '上传表单汇总的结算金额', unit: '元' },
  { key: 'upload_service_fee_rate', label: '对应服务费率', description: '上传表单匹配的服务费系数/费率', unit: '%' },
  { key: 'settlement_person_count', label: '结算人员数', description: '上传表单中的结算人员数量', unit: '人' },
  { key: 'fixed_unit_amount', label: '固定金额', description: '按人头结算的固定单价', unit: '元/人' },
  { key: 'piece_count', label: '计件数量', description: '当月计件产出数量', unit: '件' },
  { key: 'piece_unit_price', label: '计件单价', description: '单件计薪单价', unit: '元/件' },
  { key: 'payroll_total', label: '灵工薪酬', description: '单条明细或汇总薪酬', unit: '元' },
  { key: 'service_fee_rate', label: '服务费率', description: '服务商阶梯费率', unit: '%' },
  { key: 'recruit_service_rate', label: '招聘服务单价', description: '招聘服务计费单价', unit: '元' },
  { key: 'manage_service_rate', label: '管理服务单价', description: '管理服务计费单价', unit: '元' },
  { key: 'grab_manage_rate', label: '抢班管理单价', description: '抢班管理计费单价', unit: '元' },
  { key: 'task_service_rate', label: '任务服务单价', description: '任务服务计费单价', unit: '元' },
  { key: 'schedule_hours', label: '排班工时', description: '排班出勤工时', unit: '小时' },
  { key: 'grab_hours', label: '抢班工时', description: '抢班出勤工时', unit: '小时' },
]

/** 结算金额公式可插入字段 */
export const settlementInsertFields = billingFormulaFields.filter((f) =>
  [
    'work_hours',
    'task_count',
    'hourly_rate',
    'overtime_hours',
    'overtime_rate',
    'task_unit_price',
  ].includes(f.key),
)

/** 服务费金额公式可插入字段 */
export const serviceFeeInsertFields: FormulaFieldDef[] = [
  { key: 'schedule_hours', label: '排班工时', description: '排班出勤工时', unit: '小时' },
  { key: 'grab_hours', label: '抢班工时', description: '抢班出勤工时', unit: '小时' },
  { key: 'recruit_service_rate', label: '招聘服务单价', description: '招聘服务计费单价', unit: '元' },
  { key: 'manage_service_rate', label: '管理服务单价', description: '管理服务计费单价', unit: '元' },
  { key: 'grab_manage_rate', label: '抢班管理单价', description: '抢班管理计费单价', unit: '元' },
  { key: 'hourly_rate', label: '客户时薪单价', description: '客户约定时薪单价', unit: '元/小时' },
  { key: 'task_service_rate', label: '任务服务单价', description: '任务服务计费单价', unit: '元' },
  { key: 'task_count', label: '任务完成数', description: '当月完成任务数量', unit: '个' },
]

/** 工时计薪公式可用字段 */
export const hourlyPayrollFormulaFields = settlementInsertFields.filter((f) =>
  ['work_hours', 'hourly_rate', 'overtime_hours', 'overtime_rate'].includes(f.key),
)

/** 任务计薪公式可用字段 */
export const taskPayrollFormulaFields = settlementInsertFields.filter((f) =>
  ['task_count', 'task_unit_price'].includes(f.key),
)

/** 工时 + 任务计薪公式可用字段 */
export const mixedPayrollFormulaFields = settlementInsertFields

/** @deprecated 兼容旧引用，等同服务费插入字段 */
export const serviceFeeFormulaFields = serviceFeeInsertFields

export const payrollFormulaFieldGroups = [
  { key: 'hourly', label: '工时计薪', fields: hourlyPayrollFormulaFields },
  { key: 'task', label: '任务计薪', fields: taskPayrollFormulaFields },
  { key: 'mixed', label: '工时+任务', fields: mixedPayrollFormulaFields },
] as const

/** 公式运算符号（工时配置等） */
export const formulaOperators = ['+', '-', '*', '/', '(', ')'] as const

export const billingFormulaExamples = [
  {
    key: 'hourly',
    label: '工时计薪',
    formula: 'work_hours * hourly_rate',
    display: '出勤工时 * 客户时薪单价',
    description: '按出勤工时 × 客户时薪单价计算，适用于排班考勤岗位',
  },
  {
    key: 'task',
    label: '任务计薪',
    formula: 'task_count * task_unit_price',
    display: '任务完成数 * 客户任务单价',
    description: '按任务完成数 × 客户任务单价计算，适用于纯任务计薪',
  },
  {
    key: 'mixed',
    label: '工时+任务',
    formula: 'work_hours * hourly_rate + task_count * task_unit_price',
    display: '出勤工时 * 客户时薪单价 + 任务完成数 * 客户任务单价',
    description: '工时薪酬与任务薪酬合并计算，适用于考勤+任务混合场景',
  },
] as const

export type BillingFormulaExampleKey = (typeof billingFormulaExamples)[number]['key']

export type PayrollFormulaGroupKey = (typeof payrollFormulaFieldGroups)[number]['key']

export function resolvePayrollFormulaGroupKey(exampleKey: BillingFormulaExampleKey): PayrollFormulaGroupKey {
  return exampleKey
}

export const billingFormulaFieldMap = Object.fromEntries(
  billingFormulaFields.map((f) => [f.key, f]),
) as Record<BillingFormulaFieldKey, (typeof billingFormulaFields)[number]>

/** 旧标签兼容，便于展示/解析历史公式 */
const legacyFormulaLabels: Record<string, string> = {
  hourly_rate: '时薪单价',
  overtime_rate: '加班单价',
  task_unit_price: '任务单价',
  task_count: '完成任务数',
}

export function mergeFormulaFieldDefs(...lists: FormulaFieldDef[][]): FormulaFieldDef[] {
  const map = new Map<string, FormulaFieldDef>()
  for (const list of lists) {
    for (const field of list) {
      if (!map.has(field.key)) map.set(field.key, field)
    }
  }
  return [...map.values()]
}

export function buildFormulaFieldContext(templates: BillImportTemplate[] = []) {
  const templateFields = collectTemplateFormulaFields(templates)
  const allFields = mergeFormulaFieldDefs(billingFormulaFields, templateFields)
  const fieldMap = Object.fromEntries(allFields.map((f) => [f.key, f]))
  return {
    allFields,
    fieldMap,
    settlementFields: settlementInsertFields,
    serviceFields: serviceFeeInsertFields,
    templateFields,
  }
}

export function formatBillingFormulaDisplay(
  formula: string,
  templates: BillImportTemplate[] = [],
): string {
  if (!formula.trim()) return formula
  const { allFields } = buildFormulaFieldContext(templates)
  const sorted = [...allFields].sort((a, b) => b.key.length - a.key.length)
  let result = formula
  for (const field of sorted) {
    result = result.replace(new RegExp(`\\b${field.key}\\b`, 'g'), field.label)
  }
  return result
}

/** 将公式中的中文名称还原为字段标识符，用于持久化存储 */
export function parseBillingFormulaStorage(
  formula: string,
  templates: BillImportTemplate[] = [],
): string {
  if (!formula.trim()) return formula
  const { allFields } = buildFormulaFieldContext(templates)
  const aliasEntries = Object.entries(legacyFormulaLabels).map(([key, label]) => ({
    key,
    label,
  }))
  const sorted = [...allFields, ...aliasEntries].sort((a, b) => b.label.length - a.label.length)
  let result = formula
  for (const field of sorted) {
    result = result.replace(
      new RegExp(field.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
      field.key,
    )
  }
  return result
}

export const billingScopeMap = {
  global: '全局',
  enterprise: '企业',
  department: '部门',
} as const

export function formatBillingEnterpriseLabel(
  rule: Pick<BillingRule, 'enterpriseScope' | 'enterpriseIds'>,
  enterprises: Enterprise[],
): string {
  if (rule.enterpriseScope === 'all') return '全部企业'
  const ids = rule.enterpriseIds ?? []
  if (!ids.length) return '未指定企业'
  return ids.map((id) => enterprises.find((e) => e.id === id)?.name ?? id).join('、')
}

export function resolveBillingEnterpriseScope(rule: BillingRule): BillingRule['enterpriseScope'] {
  return rule.enterpriseScope ?? 'all'
}

export const defaultPayrollFormulaDisplay = '出勤工时 * 客户时薪单价'

export const defaultServiceFeeFormulaDisplay = '排班工时 * 管理服务单价 + 抢班工时 * 抢班管理单价'
