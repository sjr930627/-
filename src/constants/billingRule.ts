import type { BillingFormulaFieldKey } from '@/types'

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
  // 历史公式字段，仅用于旧数据展示/解析
  { key: 'task_count', label: '完成任务数', description: '当月完成任务数量', unit: '个' },
  { key: 'task_unit_price', label: '任务单价', description: '单任务计薪单价', unit: '元/个' },
  { key: 'piece_count', label: '计件数量', description: '当月计件产出数量', unit: '件' },
  { key: 'piece_unit_price', label: '计件单价', description: '单件计薪单价', unit: '元/件' },
  { key: 'payroll_total', label: '灵工薪酬', description: '单条明细或汇总薪酬', unit: '元' },
  { key: 'service_fee_rate', label: '服务费率', description: '服务商阶梯费率', unit: '%' },
]

/** 计薪公式可用字段（仅时薪相关） */
export const hourlyPayrollFormulaFields = billingFormulaFields.filter((f) =>
  ['attendance_days', 'work_hours', 'hourly_rate', 'overtime_hours', 'overtime_rate', 'deductions'].includes(
    f.key,
  ),
)

export const billingFormulaFieldMap = Object.fromEntries(
  billingFormulaFields.map((f) => [f.key, f]),
) as Record<BillingFormulaFieldKey, (typeof billingFormulaFields)[number]>

export const billingScopeMap = {
  global: '全局',
  enterprise: '企业',
  department: '部门',
} as const

/** 将公式中的字段标识符替换为中文名称，用于展示与编辑 */
export function formatBillingFormulaDisplay(formula: string): string {
  if (!formula.trim()) return formula
  const sorted = [...billingFormulaFields].sort((a, b) => b.key.length - a.key.length)
  let result = formula
  for (const field of sorted) {
    result = result.replace(new RegExp(`\\b${field.key}\\b`, 'g'), field.label)
  }
  return result
}

/** 将公式中的中文名称还原为字段标识符，用于持久化存储 */
export function parseBillingFormulaStorage(formula: string): string {
  if (!formula.trim()) return formula
  const sorted = [...billingFormulaFields].sort((a, b) => b.label.length - a.label.length)
  let result = formula
  for (const field of sorted) {
    result = result.replace(
      new RegExp(field.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'),
      field.key,
    )
  }
  return result
}

export const defaultPayrollFormulaDisplay = '出勤工时 * 时薪单价 - 扣款'

export const defaultServiceFeeFormulaDisplay = '灵工薪酬 * 服务费率'
