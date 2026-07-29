import type { DataScopeType, PermissionNode } from '@/types'

/** 后台功能权限资源树（静态目录） */
export const permissionCatalog: PermissionNode[] = [
  { id: 'perm_dashboard', name: '工作台', code: 'dashboard:view', module: '工作台', parentId: null, type: 'menu' },

  { id: 'perm_recruitment', name: '招聘管理', code: 'recruitment', module: '招聘管理', parentId: null, type: 'menu' },
  { id: 'perm_recruitment_req', name: '需求管理', code: 'recruitment:requirements', module: '招聘管理', parentId: 'perm_recruitment', type: 'menu' },
  { id: 'perm_recruitment_req_edit', name: '编辑需求', code: 'recruitment:requirements:edit', module: '招聘管理', parentId: 'perm_recruitment_req', type: 'action' },
  { id: 'perm_recruitment_progress', name: '招聘进度', code: 'recruitment:progress', module: '招聘管理', parentId: 'perm_recruitment', type: 'menu' },
  { id: 'perm_recruitment_calendar', name: '面试日程', code: 'recruitment:calendar', module: '招聘管理', parentId: 'perm_recruitment', type: 'menu' },
  { id: 'perm_recruitment_talents', name: '人才库', code: 'recruitment:talents', module: '招聘管理', parentId: 'perm_recruitment', type: 'menu' },
  { id: 'perm_recruitment_export', name: '导出数据', code: 'recruitment:export', module: '招聘管理', parentId: 'perm_recruitment', type: 'action' },
  { id: 'perm_training', name: '培训与考核', code: 'training', module: '培训与考核', parentId: null, type: 'menu' },
  { id: 'perm_training_materials', name: '培训资料', code: 'training:materials', module: '培训与考核', parentId: 'perm_training', type: 'menu' },
  { id: 'perm_training_courses', name: '课程管理', code: 'training:courses', module: '培训与考核', parentId: 'perm_training', type: 'menu' },
  { id: 'perm_training_exams', name: '考核管理', code: 'training:exams', module: '培训与考核', parentId: 'perm_training', type: 'menu' },
  { id: 'perm_training_progress', name: '学习进度', code: 'training:progress', module: '培训与考核', parentId: 'perm_training', type: 'menu' },
  { id: 'perm_training_results', name: '考核结果', code: 'training:results', module: '培训与考核', parentId: 'perm_training', type: 'menu' },

  { id: 'perm_attendance', name: '人员考勤管理', code: 'attendance', module: '人员考勤管理', parentId: null, type: 'menu' },
  { id: 'perm_attendance_employee', name: '人员管理', code: 'attendance:employees', module: '人员考勤管理', parentId: 'perm_attendance', type: 'menu' },
  { id: 'perm_attendance_employee_edit', name: '编辑人员', code: 'attendance:employees:edit', module: '人员考勤管理', parentId: 'perm_attendance_employee', type: 'action' },
  { id: 'perm_attendance_group', name: '考勤组管理', code: 'attendance:groups', module: '人员考勤管理', parentId: 'perm_attendance', type: 'menu' },
  { id: 'perm_attendance_schedule', name: '排班管理', code: 'attendance:schedule', module: '人员考勤管理', parentId: 'perm_attendance', type: 'menu' },
  { id: 'perm_attendance_schedule_publish', name: '发布排班', code: 'attendance:schedule:publish', module: '人员考勤管理', parentId: 'perm_attendance_schedule', type: 'action' },
  { id: 'perm_attendance_smart', name: '智能排班', code: 'attendance:smart-schedule', module: '人员考勤管理', parentId: 'perm_attendance', type: 'menu' },
  { id: 'perm_attendance_data', name: '考勤数据', code: 'attendance:data', module: '人员考勤管理', parentId: 'perm_attendance', type: 'menu' },
  { id: 'perm_attendance_data_export', name: '导出考勤', code: 'attendance:data:export', module: '人员考勤管理', parentId: 'perm_attendance_data', type: 'action' },
  { id: 'perm_attendance_exception', name: '考勤异常处理', code: 'attendance:exceptions', module: '人员考勤管理', parentId: 'perm_attendance', type: 'menu' },
  { id: 'perm_attendance_exception_approve', name: '异常审批', code: 'attendance:exceptions:approve', module: '人员考勤管理', parentId: 'perm_attendance_exception', type: 'action' },

  { id: 'perm_task', name: '任务管理', code: 'task', module: '任务管理', parentId: null, type: 'menu' },
  { id: 'perm_task_workflow', name: '任务规则配置', code: 'task:workflows', module: '任务管理', parentId: 'perm_task', type: 'menu' },
  { id: 'perm_task_type_approval', name: '任务类型审批', code: 'task:type-approval', module: '任务管理', parentId: 'perm_task', type: 'menu' },
  { id: 'perm_task_manage', name: '任务管理', code: 'task:manage', module: '任务管理', parentId: 'perm_task', type: 'menu' },

  { id: 'perm_partnership', name: '合作管理', code: 'partnership', module: '合作管理', parentId: null, type: 'menu' },
  { id: 'perm_partnership_providers', name: '服务商合作', code: 'partnership:providers', module: '合作管理', parentId: 'perm_partnership', type: 'menu' },
  { id: 'perm_partnership_contract', name: '合同费率', code: 'partnership:contracts', module: '合作管理', parentId: 'perm_partnership_providers', type: 'action' },

  { id: 'perm_payroll', name: '薪税管理', code: 'payroll', module: '薪税管理', parentId: null, type: 'menu' },
  { id: 'perm_payroll_bills', name: '账单管理', code: 'payroll:bills', module: '薪税管理', parentId: 'perm_payroll', type: 'menu' },
  { id: 'perm_payroll_billing_rules', name: '计薪规则', code: 'payroll:billing-rules', module: '薪税管理', parentId: 'perm_payroll', type: 'menu' },
  { id: 'perm_payroll_settlement', name: '结算概览', code: 'payroll:settlement', module: '薪税管理', parentId: 'perm_payroll', type: 'menu' },
  { id: 'perm_payroll_invoices', name: '发票管理', code: 'payroll:invoices', module: '薪税管理', parentId: 'perm_payroll', type: 'menu' },

  { id: 'perm_statistics', name: '数据统计', code: 'statistics', module: '数据统计', parentId: null, type: 'menu' },
  { id: 'perm_statistics_overview', name: '概览看板', code: 'statistics:overview', module: '数据统计', parentId: 'perm_statistics', type: 'menu' },
  { id: 'perm_statistics_recruitment', name: '招聘统计', code: 'statistics:recruitment', module: '数据统计', parentId: 'perm_statistics', type: 'menu' },
  { id: 'perm_statistics_attendance', name: '考勤统计', code: 'statistics:attendance', module: '数据统计', parentId: 'perm_statistics', type: 'menu' },
  { id: 'perm_statistics_task', name: '任务统计', code: 'statistics:task', module: '数据统计', parentId: 'perm_statistics', type: 'menu' },
  { id: 'perm_statistics_settlement', name: '结算统计', code: 'statistics:settlement', module: '数据统计', parentId: 'perm_statistics', type: 'menu' },
  { id: 'perm_statistics_export', name: '导出报表', code: 'statistics:export', module: '数据统计', parentId: 'perm_statistics', type: 'action' },

  { id: 'perm_system', name: '系统设置', code: 'system', module: '系统设置', parentId: null, type: 'menu' },
  { id: 'perm_system_account', name: '账号管理', code: 'system:accounts', module: '系统设置', parentId: 'perm_system', type: 'menu' },
  { id: 'perm_system_account_edit', name: '编辑账号', code: 'system:accounts:edit', module: '系统设置', parentId: 'perm_system_account', type: 'action' },
  { id: 'perm_system_role', name: '角色权限', code: 'system:roles', module: '系统设置', parentId: 'perm_system', type: 'menu' },
  { id: 'perm_system_role_edit', name: '配置权限', code: 'system:roles:edit', module: '系统设置', parentId: 'perm_system_role', type: 'action' },

  { id: 'perm_approval', name: '审批中心', code: 'approval:view', module: '通用', parentId: null, type: 'menu' },
]

export const dataScopeOptions: { value: DataScopeType; label: string; desc: string }[] = [
  { value: 'all', label: '全部数据', desc: '可查看和操作全公司数据' },
  { value: 'department_and_sub', label: '本部门及下级', desc: '可访问所属部门及所有子部门数据' },
  { value: 'department', label: '仅本部门', desc: '仅可访问所属部门数据' },
  { value: 'self', label: '仅本人', desc: '仅可访问与本人相关的数据' },
  { value: 'custom', label: '自定义部门', desc: '手动指定可访问的部门范围' },
]

export function buildPermissionTree(nodes: PermissionNode[] = permissionCatalog) {
  const roots = nodes.filter((n) => !n.parentId)
  function attach(parent: PermissionNode): PermissionNode & { children?: ReturnType<typeof attach>[] } {
    const children = nodes.filter((n) => n.parentId === parent.id).map(attach)
    return children.length ? { ...parent, children } : { ...parent }
  }
  return roots.map(attach)
}

export function getAllPermissionIds(nodes: PermissionNode[] = permissionCatalog): string[] {
  return nodes.map((n) => n.id)
}

export function getChildPermissionIds(parentId: string, nodes: PermissionNode[] = permissionCatalog): string[] {
  const ids: string[] = []
  const walk = (pid: string) => {
    nodes.filter((n) => n.parentId === pid).forEach((n) => {
      ids.push(n.id)
      walk(n.id)
    })
  }
  walk(parentId)
  return ids
}
