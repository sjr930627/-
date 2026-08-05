import type { SystemRole } from '@/types'
import {
  createDefaultMenuPermissions,
  getAllPermissionIds,
  menuPermissionsToIds,
} from '@/constants/permission'

const allIds = getAllPermissionIds()
const platformAllPerms = createDefaultMenuPermissions('platform', 'all')
const enterpriseAllPerms = createDefaultMenuPermissions('enterprise', 'all')

export function buildEnterpriseRoleId(enterpriseId: string, code: string) {
  return `role_${code}_${enterpriseId}`
}

export const seedSystemRoles: SystemRole[] = [
  {
    id: 'role_super_admin',
    name: '超级管理员',
    code: 'super_admin',
    description: '拥有全部功能与数据权限，不可删除',
    permissionIds: [...allIds],
    menuPermissions: platformAllPerms,
    rolePortal: 'platform',
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
      id.startsWith('perm_recruitment'),
    ),
    menuPermissions: createDefaultMenuPermissions('platform').map((p) => ({
      ...p,
      view: ['dashboard:view', 'attendance', 'recruitment:requirements', 'recruitment:progress', 'recruitment:calendar', 'recruitment:talents'].includes(p.code),
      edit: ['attendance', 'recruitment:requirements'].includes(p.code),
    })),
    rolePortal: 'platform',
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
    menuPermissions: createDefaultMenuPermissions('platform').map((p) => ({
      ...p,
      view: p.code === 'dashboard:view' || p.code.startsWith('recruitment'),
      edit: p.code.startsWith('recruitment'),
    })),
    rolePortal: 'platform',
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
    menuPermissions: createDefaultMenuPermissions('platform').map((p) => ({
      ...p,
      view: ['dashboard:view', 'task'].includes(p.code),
      edit: p.code === 'task',
    })),
    rolePortal: 'platform',
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
    menuPermissions: createDefaultMenuPermissions('platform').map((p) => ({
      ...p,
      view: ['dashboard:view', 'attendance', 'payroll'].includes(p.code),
      edit: false,
    })),
    rolePortal: 'platform',
    dataScope: 'custom',
    customDepartmentIds: ['dept_hr', 'dept_logistics'],
    status: 'disabled',
    userCount: 0,
    updatedAt: '2026-07-22T16:45:00.000Z',
  },
]

/** 企业端角色参考模板（用于初始化各企业角色库） */
export const seedEnterpriseRoleTemplates: SystemRole[] = [
  {
    id: 'tpl_ent_admin',
    name: '企业管理员',
    code: 'ent_admin',
    description: '企业端全部功能与数据权限',
    permissionIds: menuPermissionsToIds(enterpriseAllPerms),
    menuPermissions: enterpriseAllPerms,
    rolePortal: 'enterprise_template',
    dataScope: 'all',
    customDepartmentIds: [],
    status: 'enabled',
    isSystem: true,
    isTemplate: true,
    userCount: 0,
    updatedAt: '2026-07-01T08:00:00.000Z',
  },
  {
    id: 'tpl_recruit_specialist',
    name: '招聘专员',
    code: 'ent_recruiter',
    description: '负责发布需求、查看进度与面试安排',
    permissionIds: menuPermissionsToIds(
      createDefaultMenuPermissions('enterprise').map((p) => ({
        ...p,
        view: ['dashboard:view', 'recruitment:requirements', 'recruitment:calendar'].includes(p.code),
        edit: ['recruitment:requirements', 'recruitment:calendar'].includes(p.code),
      })),
    ),
    menuPermissions: createDefaultMenuPermissions('enterprise').map((p) => ({
      ...p,
      view: ['dashboard:view', 'recruitment:requirements', 'recruitment:calendar'].includes(p.code),
      edit: ['recruitment:requirements', 'recruitment:calendar'].includes(p.code),
    })),
    rolePortal: 'enterprise_template',
    dataScope: 'department',
    customDepartmentIds: [],
    status: 'enabled',
    isSystem: true,
    isTemplate: true,
    userCount: 0,
    updatedAt: '2026-07-01T08:00:00.000Z',
  },
  {
    id: 'tpl_interviewer',
    name: '面试官',
    code: 'ent_interviewer',
    description: '查看面试日程与候选人信息',
    permissionIds: menuPermissionsToIds(
      createDefaultMenuPermissions('enterprise').map((p) => ({
        ...p,
        view: ['dashboard:view', 'recruitment:calendar'].includes(p.code),
        edit: false,
      })),
    ),
    menuPermissions: createDefaultMenuPermissions('enterprise').map((p) => ({
      ...p,
      view: ['dashboard:view', 'recruitment:calendar'].includes(p.code),
      edit: false,
    })),
    rolePortal: 'enterprise_template',
    dataScope: 'self',
    customDepartmentIds: [],
    status: 'enabled',
    isSystem: true,
    isTemplate: true,
    userCount: 0,
    updatedAt: '2026-07-01T08:00:00.000Z',
  },
  {
    id: 'tpl_store_staff',
    name: '门店店员',
    code: 'ent_store_staff',
    description: '门店一线人员，查看排班与任务进度',
    permissionIds: menuPermissionsToIds(
      createDefaultMenuPermissions('enterprise').map((p) => ({
        ...p,
        view: ['dashboard:view', 'attendance', 'task'].includes(p.code),
        edit: false,
      })),
    ),
    menuPermissions: createDefaultMenuPermissions('enterprise').map((p) => ({
      ...p,
      view: ['dashboard:view', 'attendance', 'task'].includes(p.code),
      edit: false,
    })),
    rolePortal: 'enterprise_template',
    dataScope: 'self',
    customDepartmentIds: [],
    status: 'enabled',
    isSystem: true,
    isTemplate: true,
    userCount: 0,
    updatedAt: '2026-07-01T08:00:00.000Z',
  },
]

/** 按企业从模板生成独立角色库 */
export function buildEnterpriseRolesForEnterprise(
  enterpriseId: string,
  templates: SystemRole[] = seedEnterpriseRoleTemplates,
): SystemRole[] {
  return templates.map((t) => ({
    id: buildEnterpriseRoleId(enterpriseId, t.code),
    name: t.name,
    code: t.code,
    description: t.description,
    permissionIds: [...t.permissionIds],
    menuPermissions: t.menuPermissions?.map((p) => ({ ...p })),
    rolePortal: 'enterprise' as const,
    enterpriseId,
    templateId: t.id,
    dataScope: t.dataScope,
    customDepartmentIds: [...t.customDepartmentIds],
    status: t.status,
    isSystem: t.isSystem,
    isTemplate: false,
    userCount: 0,
    updatedAt: t.updatedAt,
  }))
}

export function buildEnterpriseRolesForAll(enterprises: Array<{ id: string }>) {
  return enterprises.flatMap((e) => buildEnterpriseRolesForEnterprise(e.id))
}

export function findEnterpriseRoleByCode(
  roles: SystemRole[],
  enterpriseId: string,
  code: string,
) {
  return roles.find(
    (r) => r.rolePortal === 'enterprise' && r.enterpriseId === enterpriseId && r.code === code,
  )
}
