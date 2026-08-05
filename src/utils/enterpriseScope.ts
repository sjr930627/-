import type { AttendanceGroup, Department, Employee } from '@/types'
import { DEFAULT_WORKFORCE_ENTERPRISE_ID } from '@/constants/department'

export function normalizeEnterpriseId(id?: string) {
  return id ?? DEFAULT_WORKFORCE_ENTERPRISE_ID
}

export function resolveEnterpriseIdByDepartment(
  departmentId: string | undefined,
  departments: Department[],
): string {
  if (!departmentId) return DEFAULT_WORKFORCE_ENTERPRISE_ID
  const dept = departments.find((d) => d.id === departmentId)
  return normalizeEnterpriseId(dept?.enterpriseId)
}

export function resolveEnterpriseIdByAttendanceGroup(
  group: AttendanceGroup | undefined,
  departments: Department[],
): string {
  if (!group) return DEFAULT_WORKFORCE_ENTERPRISE_ID
  for (const binding of group.departmentBindings) {
    const enterpriseId = resolveEnterpriseIdByDepartment(binding.departmentId, departments)
    if (enterpriseId) return enterpriseId
  }
  return DEFAULT_WORKFORCE_ENTERPRISE_ID
}

export function resolveEnterpriseIdByAttendanceGroupId(
  groupId: string,
  groups: AttendanceGroup[],
  departments: Department[],
): string {
  return resolveEnterpriseIdByAttendanceGroup(
    groups.find((g) => g.id === groupId),
    departments,
  )
}

export function resolveEnterpriseIdByEmployee(employee: Employee | undefined): string {
  return normalizeEnterpriseId(employee?.enterpriseId)
}

export function resolveEnterpriseIdByTeamDepartment(
  departmentId: string | undefined,
  departments: Department[],
): string {
  return resolveEnterpriseIdByDepartment(departmentId, departments)
}
