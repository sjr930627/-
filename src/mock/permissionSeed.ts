import type { SystemRole } from '@/types'
import { getAllPermissionIds } from '@/constants/permission'

const allIds = getAllPermissionIds()

export const seedSystemRoles: SystemRole[] = [
  {
    id: 'role_super_admin',
    name: '超级管理员',
    code: 'super_admin',
    description: '拥有全部功能与数据权限，不可删除',
    permissionIds: [...allIds],
    dataScope: 'all',
    customDepartmentIds: [],
    status: 'enabled',
    isSystem: true,
    userCount: 1,
    updatedAt: '2026-07-01T08:00:00.000Z',
  },
  {
    id: 'role_hr_admin',
    name: '人事管理员',
    code: 'hr_admin',
    description: '负责人员、考勤、排班与异常处理',
    permissionIds: allIds.filter((id) =>
      id.startsWith('perm_dashboard') ||
      id.startsWith('perm_attendance') ||
      id.startsWith('perm_approval') ||
      id === 'perm_recruitment' ||
      id.startsWith('perm_recruitment_'),
    ),
    dataScope: 'department_and_sub',
    customDepartmentIds: [],
    status: 'enabled',
    userCount: 3,
    updatedAt: '2026-07-15T10:30:00.000Z',
  },
  {
    id: 'role_recruiter',
    name: '招聘专员',
    code: 'recruiter',
    description: '负责招聘全流程与人才库维护',
    permissionIds: allIds.filter((id) =>
      id.startsWith('perm_dashboard') ||
      id.startsWith('perm_recruitment'),
    ),
    dataScope: 'department',
    customDepartmentIds: [],
    status: 'enabled',
    userCount: 5,
    updatedAt: '2026-07-18T14:20:00.000Z',
  },
  {
    id: 'role_operator',
    name: '运营专员',
    code: 'operator',
    description: '负责任务发布、验收与进度跟踪',
    permissionIds: allIds.filter((id) =>
      id.startsWith('perm_dashboard') ||
      id.startsWith('perm_task') ||
      id === 'perm_approval',
    ),
    dataScope: 'self',
    customDepartmentIds: [],
    status: 'enabled',
    userCount: 8,
    updatedAt: '2026-07-20T09:00:00.000Z',
  },
  {
    id: 'role_viewer',
    name: '只读访客',
    code: 'viewer',
    description: '仅可查看考勤数据与分析报表',
    permissionIds: [
      'perm_dashboard',
      'perm_attendance',
      'perm_attendance_data',
      'perm_payroll',
      'perm_payroll_bills',
      'perm_payroll_billing_rules',
      'perm_payroll_settlement',
      'perm_payroll_invoices',
    ],
    dataScope: 'custom',
    customDepartmentIds: ['dept_ops', 'dept_cs'],
    status: 'disabled',
    userCount: 0,
    updatedAt: '2026-07-22T16:45:00.000Z',
  },
]
