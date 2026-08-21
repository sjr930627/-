import type {
  BillImportFieldConfig,
  BillImportTemplate,
  BillingRule,
  ServiceContract,
  ServiceProvider,
  SettlementBill,
  SettlementBillLine,
  SettlementBillSummary,
} from '@/types'
import { downloadTextFile } from '@/services/payroll'
import { validateImportFields } from '@/constants/billImportTemplate'
import { getContractBillingRules } from '@/services/contractBilling'
import { findContractByPair } from '@/services/contractVersion'
import { generateId } from '@/utils'

const DEFAULT_SERVICE_FEE_RATE = 0.0682

export function resolveServiceProviderForEnterprise(
  enterpriseId: string,
  providers: ServiceProvider[],
  contracts: ServiceContract[],
): ServiceProvider | undefined {
  const contract = contracts.find(
    (c) =>
      c.enterpriseId === enterpriseId && (c.status === 'active' || c.status === 'expiring'),
  )
  if (contract) {
    return providers.find((p) => p.id === contract.providerId)
  }
  return providers.find(
    (p) => p.status === 'cooperating' && p.linkedEnterpriseIds.includes(enterpriseId),
  )
}

/** 从企业服务合同解析账单含税标记（默认不含税） */
export function resolveBillTaxFlagsFromContract(
  enterpriseId: string,
  providerId: string | undefined,
  contracts: ServiceContract[],
): { serviceFeeIncludesTax: boolean; unitPriceIncludesTax: boolean } {
  const contract = providerId
    ? findContractByPair(contracts, enterpriseId, providerId)
    : contracts.find(
        (c) =>
          c.enterpriseId === enterpriseId &&
          (c.status === 'active' || c.status === 'expiring'),
      )
  if (!contract) {
    return { serviceFeeIncludesTax: false, unitPriceIncludesTax: false }
  }
  const rules = getContractBillingRules(contract)
  if (!rules.length) {
    return { serviceFeeIncludesTax: false, unitPriceIncludesTax: false }
  }
  return {
    serviceFeeIncludesTax: rules.some((r) => r.serviceFeeIncludesTax),
    unitPriceIncludesTax: rules.some((r) => r.unitPriceIncludesTax),
  }
}

export function generateBillNo(existingBills: SettlementBill[]): string {
  const now = new Date()
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`
  const prefix = `BILL-${ym}-`
  const seq = existingBills.filter((b) => b.billNo.startsWith(prefix)).length + 1
  return `${prefix}${String(seq).padStart(4, '0')}`
}

export function defaultPeriodRange(): [string, string] {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const lastDay = new Date(y, m + 1, 0).getDate()
  const mm = String(m + 1).padStart(2, '0')
  return [`${y}-${mm}-01`, `${y}-${mm}-${String(lastDay).padStart(2, '0')}`]
}

export interface BillImportTemplateConfig {
  fields: BillImportFieldConfig[]
}

export interface BillImportParseInput {
  template: BillImportTemplateConfig
  billingRule: Pick<BillingRule, 'payrollFormula' | 'serviceFeeFormula'>
}

export interface BillImportRow {
  employeeName: string
  employeeNo?: string
  departmentName: string
  payrollAmount: number
  serviceFee?: number
  fieldValues: Record<string, string | number>
}

export interface BillImportResult {
  rows: BillImportRow[]
  lines: SettlementBillLine[]
  payrollTotal: number
  serviceFee: number
  serviceFeeRate: number
  summary: SettlementBillSummary
}

function escapeCsvCell(value: string) {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function toCsvRow(cells: string[]) {
  return cells.map(escapeCsvCell).join(',')
}

export function buildBillImportTemplateCsv(config: BillImportTemplateConfig): string {
  const headers = config.fields.map((f) => f.columnHeader)
  const exampleRow = config.fields.map((f) => {
    switch (f.key) {
      case 'employee_name':
        return '张伟'
      case 'employee_no':
        return 'LG20240001'
      case 'department':
        return '生产一车间'
      case 'work_hours':
        return '176'
      case 'hourly_rate':
        return '30'
      case 'task_count':
        return '15'
      case 'task_unit_price':
        return '150'
      case 'deductions':
        return '110'
      case 'settlement_amount':
        return '8500'
      case 'service_fee_rate':
        return '0.0682'
      case 'service_fee':
        return '578'
      default:
        return ''
    }
  })
  return [toCsvRow(headers), toCsvRow(exampleRow)].join('\n')
}

export function downloadBillImportTemplate(config: BillImportTemplateConfig) {
  downloadTextFile(
    buildBillImportTemplateCsv(config),
    '账单明细导入模板.csv',
    'text/csv;charset=utf-8',
  )
}

function parseCsvLine(line: string): string[] {
  const cells: string[] = []
  let current = ''
  let inQuotes = false
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i]
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          current += '"'
          i += 1
        } else {
          inQuotes = false
        }
      } else {
        current += ch
      }
    } else if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      cells.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  cells.push(current.trim())
  return cells
}

function parseFieldValue(field: BillImportFieldConfig, raw: string): string | number {
  const value = raw.trim()
  if (!value) {
    if (field.required) throw new Error(`「${field.columnHeader}」为必填`)
    return field.dataType === 'number' ? 0 : ''
  }
  if (field.dataType === 'number') {
    const num = Number(value)
    if (!Number.isFinite(num)) throw new Error(`「${field.columnHeader}」须为数值`)
    if (field.min != null && num < field.min) {
      throw new Error(`「${field.columnHeader}」不能小于 ${field.min}`)
    }
    if (field.max != null && num > field.max) {
      throw new Error(`「${field.columnHeader}」不能大于 ${field.max}`)
    }
    return num
  }
  if (field.pattern) {
    const re = new RegExp(field.pattern)
    if (!re.test(value)) throw new Error(`「${field.columnHeader}」格式不符合要求`)
  }
  return value
}

export function evaluateBillFormula(formula: string, values: Record<string, number>): number {
  const expr = formula.trim()
  if (!expr) throw new Error('公式不能为空')
  let substituted = expr
  const keys = Object.keys(values).sort((a, b) => b.length - a.length)
  for (const key of keys) {
    substituted = substituted.replace(new RegExp(`\\b${key}\\b`, 'g'), String(values[key] ?? 0))
  }
  if (!/^[\d\s+\-*/().]+$/.test(substituted)) {
    throw new Error(`公式「${formula}」包含未映射字段或非法字符`)
  }
  const result = Function(`"use strict"; return (${substituted})`)() as number
  if (!Number.isFinite(result)) throw new Error(`公式「${formula}」计算结果无效`)
  return Math.round(result * 100) / 100
}

function rowNumericValues(fieldValues: Record<string, string | number>): Record<string, number> {
  const numeric: Record<string, number> = {}
  for (const [key, val] of Object.entries(fieldValues)) {
    numeric[key] = typeof val === 'number' ? val : Number(val) || 0
  }
  if (numeric.service_fee_rate === 0) {
    numeric.service_fee_rate = DEFAULT_SERVICE_FEE_RATE
  }
  return numeric
}

function computeRowAmounts(
  fieldValues: Record<string, string | number>,
  billingRule: Pick<BillingRule, 'payrollFormula' | 'serviceFeeFormula'>,
): { payrollAmount: number; serviceFee: number } {
  const numeric = rowNumericValues(fieldValues)
  const payrollAmount = evaluateBillFormula(billingRule.payrollFormula, numeric)
  numeric.payroll_total = payrollAmount
  numeric.settlement_amount = payrollAmount
  const serviceFee = evaluateBillFormula(billingRule.serviceFeeFormula, numeric)

  if (payrollAmount <= 0) throw new Error('结算金额须大于 0')
  if (serviceFee < 0) throw new Error('服务费不能为负数')
  return { payrollAmount, serviceFee }
}

function buildImportResult(rows: BillImportRow[]): BillImportResult {
  let payrollTotal = 0
  let serviceFee = 0
  const lines: SettlementBillLine[] = rows.map((row, index) => {
    payrollTotal += row.payrollAmount
    const lineFee =
      row.serviceFee ??
      Math.round(row.payrollAmount * DEFAULT_SERVICE_FEE_RATE * 100) / 100
    serviceFee += lineFee
    return {
      id: generateId('bl'),
      employeeId: `import_${index}`,
      employeeNo: row.employeeNo,
      employeeName: row.employeeName,
      departmentId: `dept_import_${index}`,
      departmentName: row.departmentName,
      attendanceDays: Number(row.fieldValues.attendance_days ?? 0) || 0,
      workHours: Number(row.fieldValues.work_hours ?? 0) || undefined,
      taskCount: Number(row.fieldValues.task_count ?? 0) || 0,
      payrollAmount: row.payrollAmount,
      serviceFee: lineFee,
      serviceFeeRate: row.payrollAmount > 0 ? lineFee / row.payrollAmount : DEFAULT_SERVICE_FEE_RATE,
      deductions: Number(row.fieldValues.deductions ?? 0) || undefined,
    }
  })
  const serviceFeeRate = payrollTotal > 0 ? serviceFee / payrollTotal : DEFAULT_SERVICE_FEE_RATE
  return {
    rows,
    lines,
    payrollTotal,
    serviceFee,
    serviceFeeRate,
    summary: {
      attendancePay: payrollTotal,
      taskPay: 0,
      overtimePay: 0,
      deductions: 0,
      workerCount: lines.length,
    },
  }
}

function parseCsvWithTemplate(text: string, input: BillImportParseInput): BillImportResult {
  const templateFields = input.template.fields
  const rawLines = text.split(/\r?\n/).filter((l) => l.trim())
  if (rawLines.length < 2) throw new Error('文件内容为空或缺少数据行')

  const header = parseCsvLine(rawLines[0])
  const columnIndex = new Map<string, number>()
  for (const field of templateFields) {
    const idx = header.indexOf(field.columnHeader)
    if (idx < 0 && field.required) {
      throw new Error(`表头缺少必填列「${field.columnHeader}」`)
    }
    if (idx >= 0) columnIndex.set(field.key, idx)
  }

  const rows: BillImportRow[] = []
  for (let i = 1; i < rawLines.length; i += 1) {
    const cells = parseCsvLine(rawLines[i])
    const fieldValues: Record<string, string | number> = {}
    for (const field of templateFields) {
      const idx = columnIndex.get(field.key)
      const raw = idx != null ? (cells[idx] ?? '') : ''
      if (!raw.trim() && !field.required) {
        fieldValues[field.key] = field.dataType === 'number' ? 0 : ''
        continue
      }
      try {
        fieldValues[field.key] = parseFieldValue(field, raw)
      } catch (e) {
        throw new Error(`第 ${i + 1} 行：${e instanceof Error ? e.message : '字段校验失败'}`)
      }
    }

    const employeeName = String(fieldValues.employee_name ?? '').trim()
    if (!employeeName) continue

    const { payrollAmount, serviceFee } = computeRowAmounts(fieldValues, input.billingRule)
    rows.push({
      employeeName,
      employeeNo: fieldValues.employee_no ? String(fieldValues.employee_no) : undefined,
      departmentName: String(fieldValues.department ?? '未分配'),
      payrollAmount,
      serviceFee,
      fieldValues,
    })
  }

  if (!rows.length) throw new Error('未解析到有效明细行')
  return buildImportResult(rows)
}

function buildDemoImportFromTemplate(
  fileName: string,
  input: BillImportParseInput,
): BillImportResult {
  const seed = fileName.length * 137
  const demoRows = [
    {
      employee_name: '导入员工A',
      employee_no: 'IMP001',
      department: '业务一部',
      work_hours: 160,
      hourly_rate: 30,
      task_count: 10,
      task_unit_price: 120,
      deductions: 50,
      service_fee_rate: DEFAULT_SERVICE_FEE_RATE,
    },
    {
      employee_name: '导入员工B',
      employee_no: 'IMP002',
      department: '业务二部',
      work_hours: 168,
      hourly_rate: 32,
      task_count: 8,
      task_unit_price: 130,
      deductions: 80,
      service_fee_rate: DEFAULT_SERVICE_FEE_RATE,
    },
    {
      employee_name: '导入员工C',
      employee_no: 'IMP003',
      department: '业务一部',
      work_hours: 152 + (seed % 8),
      hourly_rate: 28,
      task_count: 12,
      task_unit_price: 110,
      deductions: 60,
      service_fee_rate: DEFAULT_SERVICE_FEE_RATE,
    },
  ]

  const rows: BillImportRow[] = demoRows.map((demo) => {
    const fieldValues: Record<string, string | number> = { ...demo }
    const { payrollAmount, serviceFee } = computeRowAmounts(fieldValues, input.billingRule)
    return {
      employeeName: demo.employee_name,
      employeeNo: demo.employee_no,
      departmentName: demo.department,
      payrollAmount,
      serviceFee,
      fieldValues,
    }
  })
  return buildImportResult(rows)
}

export async function parseBillImportFile(
  file: File,
  input: BillImportParseInput,
): Promise<BillImportResult> {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext !== 'csv') {
    return buildDemoImportFromTemplate(file.name, input)
  }
  const text = await file.text()
  return parseCsvWithTemplate(text, input)
}

export function importTemplatesForEnterprise(
  templates: BillImportTemplate[],
  enterpriseId: string,
): BillImportTemplate[] {
  return templates.filter(
    (t) =>
      t.enterpriseScope === 'all' ||
      (t.enterpriseIds ?? []).includes(enterpriseId),
  )
}

const DEMO_WORKERS = [
  { name: '张伟', no: 'LG20240001', dept: '生产一车间' },
  { name: '李娜', no: 'LG20240002', dept: '生产一车间' },
  { name: '王强', no: 'LG20240003', dept: '生产一车间' },
  { name: '周杰', no: 'LG20240008', dept: '物流部' },
  { name: '吴婷', no: 'LG20240009', dept: '物流部' },
]

export function generateBillFromBillingRule(
  rule: BillingRule,
  enterpriseId: string,
): BillImportResult {
  const factor = (enterpriseId.length + rule.id.length) % 3
  const workerCount = 3 + factor
  const workers = DEMO_WORKERS.slice(0, workerCount)
  const rows: BillImportRow[] = workers.map((w, i) => {
    const base = 6800 + i * 900 + factor * 200
    return {
      employeeName: w.name,
      employeeNo: w.no,
      departmentName: w.dept,
      payrollAmount: base,
      fieldValues: { employee_name: w.name, department: w.dept, settlement_amount: base },
    }
  })
  return buildImportResult(rows)
}

export function billingRulesForEnterprise(
  rules: BillingRule[],
  enterpriseId: string,
): BillingRule[] {
  return rules.filter(
    (r) =>
      r.enabled &&
      (r.enterpriseScope === 'all' ||
        (r.enterpriseIds ?? []).includes(enterpriseId)),
  )
}

export function validateImportTemplateConfig(config: BillImportTemplateConfig): string | null {
  return validateImportFields(config.fields)
}
