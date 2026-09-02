import type { Department, Employee, EmployeeDataSource, WorkerJoinApplication } from '@/types'

export const DEFAULT_WORKFORCE_ENTERPRISE_ID = 'ent_stars_telecom'

/** 系统内置：待入驻人员部门（与一级企业并列） */
export const UNASSIGNED_DEPARTMENT_ID = 'dept_unassigned'

export const UNASSIGNED_DEPARTMENT_NAME = '待入驻人员'

export const UNASSIGNED_POSITION = '待入驻'

export const employeeDataSourceMap: Record<EmployeeDataSource, string> = {
  recruit: '招聘推荐',
  manual: '手动录入',
  qr: '扫码申请',
}

export const employeeDataSourceTagType: Record<
  EmployeeDataSource,
  'success' | 'info' | 'warning'
> = {
  recruit: 'success',
  manual: 'info',
  qr: 'warning',
}

/** 演示种子在未写入 dataSource 时的回退（兼容本地已缓存人员） */
const DEMO_EMPLOYEE_DATA_SOURCE: Record<string, EmployeeDataSource> = {
  emp_001: 'qr',
  emp_002: 'recruit',
  emp_pending_001: 'recruit',
  emp_pending_002: 'qr',
  emp_pj_pending: 'recruit',
}

export function resolveEmployeeDataSource(
  emp: Pick<Employee, 'id' | 'dataSource' | 'applyDepartmentId'>,
  joinApps: Pick<WorkerJoinApplication, 'employeeId' | 'source'>[] = [],
): EmployeeDataSource {
  if (emp.dataSource) return emp.dataSource
  if (emp.applyDepartmentId) return 'qr'
  if (joinApps.some((a) => a.employeeId === emp.id && a.source === 'qr')) return 'qr'
  return DEMO_EMPLOYEE_DATA_SOURCE[emp.id] ?? 'manual'
}

export function enterpriseRootDepartmentId(enterpriseId: string) {
  if (enterpriseId === DEFAULT_WORKFORCE_ENTERPRISE_ID) return 'dept_root'
  return `dept_root_${enterpriseId}`
}

export function enterpriseUnassignedDepartmentId(enterpriseId: string) {
  if (enterpriseId === DEFAULT_WORKFORCE_ENTERPRISE_ID) return UNASSIGNED_DEPARTMENT_ID
  return `dept_unassigned_${enterpriseId}`
}

export function isUnassignedDepartment(id: string | null | undefined) {
  if (!id) return false
  return id === UNASSIGNED_DEPARTMENT_ID || id.startsWith('dept_unassigned_')
}

export function isEnterpriseRootDepartment(dept: Pick<Department, 'id' | 'orgType'>) {
  return dept.orgType === 'enterprise' || dept.id.startsWith('dept_root_') || dept.id === 'dept_root'
}

export function createEnterpriseRootDepartment(
  enterpriseId: string,
  enterpriseName: string,
): Department {
  return {
    id: enterpriseRootDepartmentId(enterpriseId),
    name: enterpriseName,
    parentId: null,
    sort: 0,
    enterpriseId,
    orgType: 'enterprise',
    nodeType: 'branch',
  }
}

export function createEnterpriseUnassignedDepartment(enterpriseId: string): Department {
  return {
    id: enterpriseUnassignedDepartmentId(enterpriseId),
    name: UNASSIGNED_DEPARTMENT_NAME,
    parentId: null,
    sort: 1,
    enterpriseId,
    nodeType: 'leaf',
    description: '管理待申请 / 已申请入驻的人员，审批通过后分配部门与人员 ID',
  }
}

export function createUnassignedDepartment(): Department {
  return createEnterpriseUnassignedDepartment(DEFAULT_WORKFORCE_ENTERPRISE_ID)
}

/** 部门入驻二维码内容 */
export function buildDepartmentJoinQrPayload(enterpriseId: string, departmentId: string) {
  return `JOIN|${enterpriseId}|${departmentId}`
}

export function parseDepartmentJoinQrPayload(raw: string): {
  enterpriseId: string
  departmentId: string
} | null {
  const text = raw.trim()
  const parts = text.split('|')
  if (parts.length >= 3 && parts[0] === 'JOIN' && parts[1] && parts[2]) {
    return { enterpriseId: parts[1], departmentId: parts[2] }
  }
  // 兼容 query 形式
  try {
    const url = new URL(text, 'https://local.invalid')
    const enterpriseId = url.searchParams.get('enterprise') || url.searchParams.get('e')
    const departmentId = url.searchParams.get('department') || url.searchParams.get('d')
    if (enterpriseId && departmentId) return { enterpriseId, departmentId }
  } catch {
    /* ignore */
  }
  return null
}

export function departmentJoinQrImageUrl(enterpriseId: string, departmentId: string, size = 160) {
  const data = encodeURIComponent(buildDepartmentJoinQrPayload(enterpriseId, departmentId))
  return `https://api.qrserver.com/v1/create-qr-code/?size=${size}x${size}&data=${data}`
}

export const EMPLOYEE_POSITION_OPTIONS = [
  '营业厅营业员',
  '班组长',
  '操作工',
  '质检员',
  '设备维护',
  '装卸工',
  '调度员',
  '营销专员',
  '安全员',
]
