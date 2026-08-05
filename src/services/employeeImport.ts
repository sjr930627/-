import type { Department, Employee, EmployeeGender, EmployeeStatus } from '@/types'
import { downloadTextFile } from '@/services/payroll'
import {
  UNASSIGNED_DEPARTMENT_ID,
  UNASSIGNED_POSITION,
} from '@/constants/department'

export const EMPLOYEE_IMPORT_HEADERS = [
  '姓名',
  '手机号',
  '性别',
  '工号',
  '年龄',
  '邮箱',
  '入职日期',
  '居住地址',
  '岗位',
  '部门',
  '备注',
  '状态',
  '技能证书',
] as const

const TEMPLATE_EXAMPLE = [
  '张三',
  '13800001234',
  '男',
  'E2001',
  '28',
  'zhangsan@example.com',
  '2026-07-30',
  '浙江省杭州市西湖区',
  '',
  '待分配人员',
  '',
  '待入职',
  '',
]

export interface EmployeeImportRow {
  name: string
  phone: string
  gender?: EmployeeGender
  employeeNo: string
  age?: number
  email?: string
  hireDate: string
  address?: string
  position: string
  departmentId: string
  remark?: string
  status: EmployeeStatus
  skills: string[]
}

export interface EmployeeImportFailure {
  row: number
  name: string
  reason: string
}

export interface EmployeeImportResult {
  successCount: number
  failures: EmployeeImportFailure[]
  rows: EmployeeImportRow[]
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

export function buildEmployeeImportTemplate() {
  const lines = [
    toCsvRow([...EMPLOYEE_IMPORT_HEADERS]),
    toCsvRow(TEMPLATE_EXAMPLE),
  ]
  return `\uFEFF${lines.join('\n')}`
}

export function downloadEmployeeImportTemplate() {
  downloadTextFile(
    buildEmployeeImportTemplate(),
    '人员导入模板.csv',
    'text/csv;charset=utf-8',
  )
}

function stripBom(text: string) {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

export function parseCsvText(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQuotes = false

  const content = stripBom(text.trim())
  for (let i = 0; i < content.length; i += 1) {
    const ch = content[i]
    const next = content[i + 1]

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        cell += '"'
        i += 1
      } else if (ch === '"') {
        inQuotes = false
      } else {
        cell += ch
      }
      continue
    }

    if (ch === '"') {
      inQuotes = true
    } else if (ch === ',') {
      row.push(cell.trim())
      cell = ''
    } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
      row.push(cell.trim())
      if (row.some((item) => item.length > 0)) rows.push(row)
      row = []
      cell = ''
      if (ch === '\r') i += 1
    } else if (ch !== '\r') {
      cell += ch
    }
  }

  row.push(cell.trim())
  if (row.some((item) => item.length > 0)) rows.push(row)
  return rows
}

function parseGender(value: string): EmployeeGender | undefined {
  const v = value.trim()
  if (!v) return undefined
  if (v === '男' || v.toLowerCase() === 'male') return 'male'
  if (v === '女' || v.toLowerCase() === 'female') return 'female'
  return undefined
}

function parseStatus(value: string): EmployeeStatus {
  const v = value.trim()
  if (v === '待入职' || v === 'pending') return 'pending'
  if (v === '已离职' || v === '离职' || v === 'resigned') return 'resigned'
  if (v === '正常' || v === '在职' || v === 'active') return 'active'
  return 'active'
}

function resolveImportStatus(statusRaw: string, departmentId: string): EmployeeStatus {
  const status = parseStatus(statusRaw)
  if (status === 'resigned') return 'resigned'
  if (departmentId === UNASSIGNED_DEPARTMENT_ID) return 'pending'
  return status === 'pending' ? 'active' : status
}

function parseSkills(value: string) {
  return value
    .split(/[,，;；]/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function resolveDepartmentId(departments: Department[], value: string) {
  const v = value.trim()
  if (!v) return null
  const byName = departments.find((d) => d.name === v)
  if (byName) return byName.id
  const byId = departments.find((d) => d.id === v)
  return byId?.id ?? null
}

function isHeaderRow(cells: string[]) {
  return cells[0]?.includes('姓名') && cells.some((c) => c.includes('手机号'))
}

export function parseEmployeeImportFile(
  text: string,
  departments: Department[],
  existingEmployees: Employee[],
): EmployeeImportResult {
  const parsed = parseCsvText(text)
  if (!parsed.length) {
    return { successCount: 0, failures: [{ row: 1, name: '-', reason: '文件为空' }], rows: [] }
  }

  const dataRows = isHeaderRow(parsed[0]) ? parsed.slice(1) : parsed
  const failures: EmployeeImportFailure[] = []
  const rows: EmployeeImportRow[] = []
  const usedEmployeeNos = new Set(existingEmployees.map((e) => e.employeeNo))

  dataRows.forEach((cells, index) => {
    const rowNo = index + 2
    const [
      name = '',
      phone = '',
      genderRaw = '',
      employeeNo = '',
      ageRaw = '',
      email = '',
      hireDate = '',
      address = '',
      position = '',
      departmentName = '',
      remark = '',
      statusRaw = '',
      skillsRaw = '',
    ] = cells

    const displayName = name.trim() || `第 ${rowNo} 行`

    if (!name.trim()) {
      failures.push({ row: rowNo, name: displayName, reason: '姓名为空' })
      return
    }
    if (!phone.trim()) {
      failures.push({ row: rowNo, name: displayName, reason: '手机号为空' })
      return
    }
    if (!employeeNo.trim()) {
      failures.push({ row: rowNo, name: displayName, reason: '工号为空' })
      return
    }
    if (!hireDate.trim()) {
      failures.push({ row: rowNo, name: displayName, reason: '入职日期为空' })
      return
    }

    if (usedEmployeeNos.has(employeeNo.trim())) {
      failures.push({ row: rowNo, name: displayName, reason: `工号「${employeeNo.trim()}」已存在` })
      return
    }

    const age = ageRaw.trim() ? Number(ageRaw) : undefined
    if (ageRaw.trim() && Number.isNaN(age)) {
      failures.push({ row: rowNo, name: displayName, reason: '年龄格式不正确' })
      return
    }

    const gender = parseGender(genderRaw)
    if (genderRaw.trim() && !gender) {
      failures.push({ row: rowNo, name: displayName, reason: '性别请填写「男」或「女」' })
      return
    }

    if (!departmentName.trim()) {
      usedEmployeeNos.add(employeeNo.trim())
      rows.push({
        name: name.trim(),
        phone: phone.trim(),
        gender,
        employeeNo: employeeNo.trim(),
        age,
        email: email.trim() || undefined,
        hireDate: hireDate.trim(),
        address: address.trim() || undefined,
        position: position.trim() || UNASSIGNED_POSITION,
        departmentId: UNASSIGNED_DEPARTMENT_ID,
        remark: remark.trim() || undefined,
        status: resolveImportStatus(statusRaw, UNASSIGNED_DEPARTMENT_ID),
        skills: parseSkills(skillsRaw),
      })
      return
    }

    if (!position.trim()) {
      failures.push({ row: rowNo, name: displayName, reason: '岗位为空' })
      return
    }

    const departmentId = resolveDepartmentId(departments, departmentName)
    if (!departmentId) {
      failures.push({ row: rowNo, name: displayName, reason: `部门「${departmentName}」不存在` })
      return
    }

    if (departmentId === UNASSIGNED_DEPARTMENT_ID) {
      usedEmployeeNos.add(employeeNo.trim())
      rows.push({
        name: name.trim(),
        phone: phone.trim(),
        gender,
        employeeNo: employeeNo.trim(),
        age,
        email: email.trim() || undefined,
        hireDate: hireDate.trim(),
        address: address.trim() || undefined,
        position: position.trim() || UNASSIGNED_POSITION,
        departmentId,
        remark: remark.trim() || undefined,
        status: resolveImportStatus(statusRaw, UNASSIGNED_DEPARTMENT_ID),
        skills: parseSkills(skillsRaw),
      })
      return
    }

    usedEmployeeNos.add(employeeNo.trim())
    rows.push({
      name: name.trim(),
      phone: phone.trim(),
      gender,
      employeeNo: employeeNo.trim(),
      age,
      email: email.trim() || undefined,
      hireDate: hireDate.trim(),
      address: address.trim() || undefined,
      position: position.trim(),
      departmentId,
      remark: remark.trim() || undefined,
      status: resolveImportStatus(statusRaw, departmentId),
      skills: parseSkills(skillsRaw),
    })
  })

  return {
    successCount: rows.length,
    failures,
    rows,
  }
}
