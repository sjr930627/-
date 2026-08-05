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
  { key: 'hourly_rate', label: '时薪单价', description: '考勤计薪单价', unit: '元/小时' },
  { key: 'overtime_hours', label: '加班工时', description: '当月加班工时', unit: '小时' },
  { key: 'overtime_rate', label: '加班单价', description: '加班计薪单价（通常为时薪倍数）', unit: '元/小时' },
  { key: 'deductions', label: '扣款', description: '考勤扣款、违规扣款等', unit: '元' },
  { key: 'task_count', label: '完成任务数', description: '当月完成任务数量', unit: '个' },
  { key: 'task_unit_price', label: '任务单价', description: '单任务计薪单价', unit: '元/个' },
  { key: 'upload_settlement_amount', label: '上传表单结算金额', description: '上传表单汇总的结算金额', unit: '元' },
  { key: 'upload_service_fee_rate', label: '对应服务费率', description: '上传表单匹配的服务费系数/费率', unit: '%' },
  { key: 'settlement_person_count', label: '结算人员数', description: '上传表单中的结算人员数量', unit: '人' },
  { key: 'fixed_unit_amount', label: '固定金额', description: '按人头结算的固定单价', unit: '元/人' },
  { key: 'piece_count', label: '计件数量', description: '当月计件产出数量', unit: '件' },
  { key: 'piece_unit_price', label: '计件单价', description: '单件计薪单价', unit: '元/件' },
  { key: 'payroll_total', label: '灵工薪酬', description: '单条明细或汇总薪酬', unit: '元' },
  { key: 'service_fee_rate', label: '服务费率', description: '服务商阶梯费率', unit: '%' },
]

/** 工时计薪公式可用字段 */
export const hourlyPayrollFormulaFields = billingFormulaFields.filter((f) =>
  ['attendance_days', 'work_hours', 'hourly_rate', 'overtime_hours', 'overtime_rate', 'deductions'].includes(
    f.key,
  ),
)

/** 任务计薪公式可用字段 */
export const taskPayrollFormulaFields = billingFormulaFields.filter((f) =>
  ['task_count', 'task_unit_price', 'deductions'].includes(f.key),
)

/** 工时 + 任务计薪公式可用字段 */
export const mixedPayrollFormulaFields = billingFormulaFields.filter((f) =>
  [
    'work_hours',
    'hourly_rate',
    'overtime_hours',
    'overtime_rate',
    'task_count',
    'task_unit_price',
    'deductions',
  ].includes(f.key),
)

/** 服务费金额公式可用字段 */
export const serviceFeeFormulaFields = billingFormulaFields.filter((f) =>
  ['payroll_total', 'service_fee_rate', 'upload_settlement_amount', 'settlement_person_count', 'fixed_unit_amount'].includes(
    f.key,
  ),
)

export const payrollFormulaFieldGroups = [
  { key: 'hourly', label: '工时计薪', fields: hourlyPayrollFormulaFields },
  { key: 'task', label: '任务计薪', fields: taskPayrollFormulaFields },
  { key: 'mixed', label: '工时+任务', fields: mixedPayrollFormulaFields },
] as const

export const billingFormulaExamples = [
  {
    key: 'hourly',
    label: '工时计薪',
    formula: 'work_hours * hourly_rate - deductions',
    display: '出勤工时 * 时薪单价 - 扣款',
    description: '按出勤工时 × 时薪单价计算，适用于排班考勤岗位',
  },
  {
    key: 'task',
    label: '任务计薪',
    formula: 'task_count * task_unit_price - deductions',
    display: '完成任务数 * 任务单价 - 扣款',
    description: '按完成任务数 × 任务单价计算，适用于纯任务计薪',
  },
  {
    key: 'mixed',
    label: '工时+任务',
    formula: 'work_hours * hourly_rate + task_count * task_unit_price - deductions',
    display: '出勤工时 * 时薪单价 + 完成任务数 * 任务单价 - 扣款',
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
  const settlementFields = mergeFormulaFieldDefs(
    hourlyPayrollFormulaFields,
    taskPayrollFormulaFields,
    mixedPayrollFormulaFields,
    templateFields,
  )
  const serviceFields = mergeFormulaFieldDefs(serviceFeeFormulaFields, templateFields)
  return { allFields, fieldMap, settlementFields, serviceFields, templateFields }
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
  const sorted = [...allFields].sort((a, b) => b.label.length - a.label.length)
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

export const defaultPayrollFormulaDisplay = '出勤工时 * 时薪单价 - 扣款'

export const defaultServiceFeeFormulaDisplay = '灵工薪酬 * 服务费率'
