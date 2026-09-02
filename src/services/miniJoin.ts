import {
  isEnterpriseRootDepartment,
  isUnassignedDepartment,
} from '@/constants/department'
import { getDepartmentName } from '@/utils'
import { resolveEnterpriseIdByDepartment } from '@/utils/enterpriseScope'
import type {
  Department,
  Employee,
  Enterprise,
  Team,
  WorkerJoinApplication,
  WorkerJoinApplicationStatus,
} from '@/types'

const JOIN_STATUS_LABEL: Record<WorkerJoinApplicationStatus, string> = {
  pending: '待审批',
  approved: '已通过',
  rejected: '已拒绝',
}

const JOIN_STATUS_TAG: Record<WorkerJoinApplicationStatus, string> = {
  pending: 'orange',
  approved: 'green',
  rejected: 'red',
}

export interface WorkerJoinOrgDisplay {
  key: string
  enterpriseId: string
  enterpriseName: string
  departmentId: string
  departmentName: string
  orgPath: string
  position: string
  teamName?: string
  hireDate?: string
  primary: boolean
}

export interface WorkerJoinApplicationDisplay extends WorkerJoinApplication {
  enterpriseName: string
  departmentName: string
  assignedDepartmentName?: string
  statusLabel: string
  statusTag: string
}

function departmentChain(departments: Department[], departmentId: string) {
  const names: string[] = []
  let current = departments.find((d) => d.id === departmentId)
  let guard = 0
  while (current && guard < 8) {
    names.unshift(current.name)
    if (!current.parentId) break
    current = departments.find((d) => d.id === current.parentId)
    guard += 1
  }
  return names
}

export function buildDepartmentOrgPath(departments: Department[], departmentId: string) {
  return departmentChain(departments, departmentId).join(' / ')
}

function enterpriseNameOf(
  enterprises: Enterprise[],
  enterpriseId?: string,
) {
  return enterprises.find((e) => e.id === enterpriseId)?.name?.trim() || '未知企业'
}

export function listWorkerJoinApplications(
  applications: WorkerJoinApplication[],
  employeeId: string,
  departments: Department[],
  enterprises: Enterprise[],
): WorkerJoinApplicationDisplay[] {
  return applications
    .filter((a) => a.employeeId === employeeId)
    .map((a) => ({
      ...a,
      enterpriseName: enterpriseNameOf(enterprises, a.enterpriseId),
      departmentName: getDepartmentName(departments, a.departmentId),
      assignedDepartmentName: a.assignedDepartmentId
        ? getDepartmentName(departments, a.assignedDepartmentId)
        : undefined,
      statusLabel: JOIN_STATUS_LABEL[a.status],
      statusTag: JOIN_STATUS_TAG[a.status],
    }))
    .sort((a, b) => b.appliedAt.localeCompare(a.appliedAt))
}

export function listWorkerCurrentOrgs(
  employee: Employee | undefined,
  applications: WorkerJoinApplication[],
  departments: Department[],
  enterprises: Enterprise[],
  teams: Team[],
): WorkerJoinOrgDisplay[] {
  if (!employee) return []

  const items: WorkerJoinOrgDisplay[] = []
  const seen = new Set<string>()

  function pushOrg(params: {
    enterpriseId: string
    departmentId: string
    position: string
    hireDate?: string
    primary?: boolean
  }) {
    if (!params.departmentId || isUnassignedDepartment(params.departmentId)) return
    const dept = departments.find((d) => d.id === params.departmentId)
    if (!dept || isEnterpriseRootDepartment(dept)) return
    const key = params.departmentId
    if (seen.has(key)) return
    seen.add(key)
    const team = teams.find((t) => t.memberIds.includes(employee.id) && t.departmentId === params.departmentId)
    items.push({
      key,
      enterpriseId: params.enterpriseId,
      enterpriseName: enterpriseNameOf(enterprises, params.enterpriseId),
      departmentId: params.departmentId,
      departmentName: dept.name,
      orgPath: buildDepartmentOrgPath(departments, params.departmentId),
      position: params.position || '—',
      teamName: team?.name,
      hireDate: params.hireDate,
      primary: Boolean(params.primary),
    })
  }

  if (employee.status === 'active') {
    const enterpriseId =
      employee.enterpriseId ||
      resolveEnterpriseIdByDepartment(employee.departmentId, departments) ||
      ''
    pushOrg({
      enterpriseId,
      departmentId: employee.departmentId,
      position: employee.position,
      hireDate: employee.hireDate,
      primary: true,
    })
  }

  for (const app of applications) {
    if (app.employeeId !== employee.id || app.status !== 'approved') continue
    pushOrg({
      enterpriseId: app.enterpriseId,
      departmentId: app.assignedDepartmentId || app.departmentId,
      position: app.assignedPosition || employee.position,
      hireDate: app.reviewedAt?.slice(0, 10) || app.appliedAt.slice(0, 10),
      primary: false,
    })
  }

  return items
}
