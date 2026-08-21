import type { Employee } from '@/types'

export const PAYROLL_IMPORT_DRAFT_KEY = 'payrollImportDraft'

export interface PayrollImportDraftLine {
  id: string
  phone: string
  employeeName: string
  amount: number
  employeeId?: string
  employeeNo?: string
  departmentName?: string
}

export interface PayrollImportDraft {
  enterpriseId: string
  enterpriseName: string
  fileName?: string
  lines: PayrollImportDraftLine[]
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

function normalizeHeader(header: string): string {
  return header.replace(/^\uFEFF/, '').trim().toLowerCase()
}

function findColumnIndex(headers: string[], aliases: string[]): number {
  const normalized = headers.map(normalizeHeader)
  for (const alias of aliases) {
    const idx = normalized.findIndex((h) => h === alias || h.includes(alias))
    if (idx >= 0) return idx
  }
  return -1
}

function parseAmount(raw: string): number {
  const cleaned = raw.replace(/[,，\s￥¥]/g, '')
  const num = Number(cleaned)
  if (!Number.isFinite(num) || num < 0) throw new Error(`金额无效：${raw || '（空）'}`)
  return Math.round(num * 100) / 100
}

function normalizePhone(raw: string): string {
  return raw.replace(/\s+/g, '').replace(/^\+86/, '')
}

export function matchEmployeeByPhone(
  employees: Employee[],
  phone: string,
  enterpriseId?: string,
): Employee | undefined {
  const normalized = normalizePhone(phone)
  return employees.find((emp) => {
    if (!emp.phone) return false
    if (enterpriseId && emp.enterpriseId && emp.enterpriseId !== enterpriseId) return false
    return normalizePhone(emp.phone) === normalized
  })
}

function enrichLine(
  line: Omit<PayrollImportDraftLine, 'id'> & { id?: string },
  employees: Employee[],
  enterpriseId: string,
): PayrollImportDraftLine {
  const matched = matchEmployeeByPhone(employees, line.phone, enterpriseId)
  return {
    id: line.id ?? `pil_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    phone: normalizePhone(line.phone),
    employeeName: line.employeeName.trim() || matched?.name || '',
    amount: line.amount,
    employeeId: matched?.id ?? line.employeeId,
    employeeNo: matched?.employeeNo ?? line.employeeNo,
    departmentName: line.departmentName,
  }
}

export function parsePayrollImportCsv(
  text: string,
  employees: Employee[],
  enterpriseId: string,
): PayrollImportDraftLine[] {
  const lines = text
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
  if (lines.length < 2) throw new Error('文件无有效数据行')

  const headers = parseCsvLine(lines[0])
  const phoneIdx = findColumnIndex(headers, ['手机号', '手机', 'phone', 'mobile'])
  const nameIdx = findColumnIndex(headers, ['姓名', '名称', 'name'])
  const amountIdx = findColumnIndex(headers, ['发薪金额', '金额', 'amount', 'payroll'])
  if (phoneIdx < 0 || nameIdx < 0 || amountIdx < 0) {
    throw new Error('表头需包含：手机号、姓名、发薪金额（或金额）')
  }

  const rows: PayrollImportDraftLine[] = []
  for (let i = 1; i < lines.length; i += 1) {
    const cells = parseCsvLine(lines[i])
    const phone = cells[phoneIdx] ?? ''
    const employeeName = cells[nameIdx] ?? ''
    const amountRaw = cells[amountIdx] ?? ''
    if (!phone && !employeeName && !amountRaw) continue
    if (!phone) throw new Error(`第 ${i + 1} 行缺少手机号`)
    if (!employeeName) throw new Error(`第 ${i + 1} 行缺少姓名`)
    const amount = parseAmount(amountRaw)
    rows.push(enrichLine({ phone, employeeName, amount }, employees, enterpriseId))
  }
  if (!rows.length) throw new Error('未解析到有效发薪明细')
  return rows
}

/** 非 CSV（xlsx 等）演示解析：按企业员工生成样例行 */
export function buildDemoPayrollImportLines(
  employees: Employee[],
  enterpriseId: string,
): PayrollImportDraftLine[] {
  const scoped = employees.filter(
    (e) => !e.enterpriseId || e.enterpriseId === enterpriseId,
  )
  const pool = scoped.filter((e) => e.phone).slice(0, 5)
  if (!pool.length) {
    return [
      enrichLine(
        { phone: '13800000001', employeeName: '示例人员甲', amount: 1200 },
        employees,
        enterpriseId,
      ),
      enrichLine(
        { phone: '13800000002', employeeName: '示例人员乙', amount: 980 },
        employees,
        enterpriseId,
      ),
    ]
  }
  return pool.map((emp, idx) =>
    enrichLine(
      {
        phone: emp.phone!,
        employeeName: emp.name,
        amount: 800 + idx * 150,
        employeeId: emp.id,
        employeeNo: emp.employeeNo,
      },
      employees,
      enterpriseId,
    ),
  )
}

export async function parsePayrollImportFile(
  file: File,
  employees: Employee[],
  enterpriseId: string,
): Promise<PayrollImportDraftLine[]> {
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (ext === 'csv') {
    const text = await file.text()
    return parsePayrollImportCsv(text, employees, enterpriseId)
  }
  // xlsx/xls：本地无解析库，生成与企业匹配的演示数据便于联调
  return buildDemoPayrollImportLines(employees, enterpriseId)
}

export function downloadPayrollImportTemplate() {
  const content = '\uFEFF手机号,姓名,发薪金额\n13800138000,张三,1500.00\n13900139000,李四,1200.50\n'
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = '导入发薪模板.csv'
  a.click()
  URL.revokeObjectURL(url)
}

export function savePayrollImportDraft(draft: PayrollImportDraft) {
  sessionStorage.setItem(PAYROLL_IMPORT_DRAFT_KEY, JSON.stringify(draft))
}

export function loadPayrollImportDraft(): PayrollImportDraft | null {
  const raw = sessionStorage.getItem(PAYROLL_IMPORT_DRAFT_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as PayrollImportDraft
  } catch {
    return null
  }
}

export function clearPayrollImportDraft() {
  sessionStorage.removeItem(PAYROLL_IMPORT_DRAFT_KEY)
}

export function summarizePayrollImportLines(lines: PayrollImportDraftLine[]) {
  return {
    workerCount: lines.length,
    totalAmount: lines.reduce((sum, line) => sum + line.amount, 0),
  }
}
