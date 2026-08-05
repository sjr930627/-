import type { Department } from '@/types'

export const DEFAULT_WORKFORCE_ENTERPRISE_ID = 'ent_stars_telecom'

/** 系统内置：待分配人员部门（与一级企业并列） */
export const UNASSIGNED_DEPARTMENT_ID = 'dept_unassigned'

export const UNASSIGNED_DEPARTMENT_NAME = '待分配人员'

export const UNASSIGNED_POSITION = '待分配'

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
    description: '用于管理待入职及尚未分配部门和岗位的人员',
  }
}

export function createUnassignedDepartment(): Department {
  return createEnterpriseUnassignedDepartment(DEFAULT_WORKFORCE_ENTERPRISE_ID)
}

export const EMPLOYEE_POSITION_OPTIONS = [
  '加油站营业员',
  '班组长',
  '操作工',
  '质检员',
  '设备维护',
  '装卸工',
  '调度员',
  '营销专员',
  '安全员',
]
