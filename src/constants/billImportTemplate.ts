import type { BillImportFieldConfig, BillImportTemplate } from '@/types'

export const billImportFieldTypeMap = {
  text: '文本',
  number: '数值',
  date: '日期',
} as const

const defaultColumnHeaders: Record<string, string> = {
  employee_name: '姓名',
  employee_no: '工号',
  department: '部门',
  work_hours: '出勤工时',
  hourly_rate: '时薪单价',
  task_count: '完成任务数',
  task_unit_price: '任务单价',
  deductions: '扣款',
  settlement_amount: '结算金额',
  service_fee_rate: '服务费率',
  service_fee: '服务费',
}

const defaultFieldSeeds: Omit<BillImportFieldConfig, 'id'>[] = [
  { key: 'employee_name', label: '姓名', columnHeader: '姓名', dataType: 'text', required: true },
  { key: 'employee_no', label: '工号', columnHeader: '工号', dataType: 'text', required: false },
  { key: 'department', label: '部门', columnHeader: '部门', dataType: 'text', required: true },
  { key: 'work_hours', label: '出勤工时', columnHeader: '出勤工时', dataType: 'number', required: false, min: 0 },
  { key: 'hourly_rate', label: '时薪单价', columnHeader: '时薪单价', dataType: 'number', required: false, min: 0 },
  { key: 'task_count', label: '完成任务数', columnHeader: '完成任务数', dataType: 'number', required: false, min: 0 },
  { key: 'task_unit_price', label: '任务单价', columnHeader: '任务单价', dataType: 'number', required: false, min: 0 },
  { key: 'deductions', label: '扣款', columnHeader: '扣款', dataType: 'number', required: false, min: 0 },
  { key: 'service_fee_rate', label: '服务费率', columnHeader: '服务费率', dataType: 'number', required: false, min: 0, max: 1 },
]

export function createDefaultImportFields(createId: (prefix: string) => string): BillImportFieldConfig[] {
  return defaultFieldSeeds.map((seed) => ({
    ...seed,
    id: createId('pfield'),
    columnHeader: defaultColumnHeaders[seed.key] ?? seed.label,
  }))
}

export function createEmptyImportField(createId: (prefix: string) => string): BillImportFieldConfig {
  return {
    id: createId('pfield'),
    key: '',
    label: '',
    columnHeader: '',
    dataType: 'number',
    required: false,
    min: 0,
  }
}

export function formatImportFieldConstraint(field: BillImportFieldConfig): string {
  const parts: string[] = []
  if (field.required) parts.push('必填')
  if (field.dataType === 'number') {
    if (field.min != null) parts.push(`≥ ${field.min}`)
    if (field.max != null) parts.push(`≤ ${field.max}`)
  }
  if (field.pattern) parts.push(`格式 ${field.pattern}`)
  return parts.length ? parts.join('，') : '—'
}

export function formatImportTemplateEnterpriseLabel(
  template: Pick<BillImportTemplate, 'enterpriseScope' | 'enterpriseIds'>,
  enterprises: { id: string; name: string }[],
): string {
  if (template.enterpriseScope === 'all') return '全部企业'
  const ids = template.enterpriseIds ?? []
  if (!ids.length) return '未指定企业'
  return ids.map((id) => enterprises.find((e) => e.id === id)?.name ?? id).join('、')
}

export function fieldCount(fields: BillImportFieldConfig[]): number {
  return fields.length
}

export function slugifyFieldKey(label: string): string {
  return label
    .trim()
    .toLowerCase()
    .replace(/[\s\-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/^_+|_+$/g, '')
}

export function validateImportFields(fields: BillImportFieldConfig[]): string | null {
  if (!fields.length) return '请至少配置一个字段'
  const keys = new Set<string>()
  const headers = new Set<string>()
  for (const field of fields) {
    if (!field.label.trim()) return '字段名称不能为空'
    if (!field.key.trim()) return `字段「${field.label}」的标识不能为空`
    if (!/^[a-z][a-z0-9_]*$/.test(field.key)) {
      return `字段「${field.label}」的标识须为小写字母、数字或下划线，且以字母开头`
    }
    if (keys.has(field.key)) return `字段标识「${field.key}」重复`
    keys.add(field.key)
    if (!field.columnHeader.trim()) return `字段「${field.label}」的 Excel 列名不能为空`
    if (headers.has(field.columnHeader.trim())) return `Excel 列名「${field.columnHeader}」重复`
    headers.add(field.columnHeader.trim())
  }
  return null
}

export function collectTemplateFormulaFields(templates: BillImportTemplate[]) {
  const map = new Map<string, { key: string; label: string; description: string }>()
  for (const template of templates) {
    for (const field of template.fields) {
      if (field.dataType !== 'number') continue
      if (!map.has(field.key)) {
        map.set(field.key, {
          key: field.key,
          label: field.label,
          description: `导入模板字段：${field.label}`,
        })
      }
    }
  }
  return [...map.values()]
}
