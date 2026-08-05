import type { SystemOperationLogType } from '@/types'

export const operationLogTypeOptions: { value: SystemOperationLogType | 'all'; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'enterprise_account_change', label: '企业账户变更' },
  { value: 'module_auth', label: '模块授权' },
  { value: 'login_logout', label: '登录/登出' },
  { value: 'role_permission', label: '角色权限' },
  { value: 'ops_role_config', label: '运营人员角色配置' },
  { value: 'enterprise_role_library', label: '企业端角色库调整' },
  { value: 'account_manage', label: '账号管理' },
  { value: 'tenant_manage', label: '租户管理' },
  { value: 'data_export', label: '数据导出' },
  { value: 'other', label: '其他' },
]

export const operationLogResultOptions = [
  { value: 'all', label: '全部' },
  { value: 'success', label: '成功' },
  { value: 'failed', label: '失败' },
] as const

export function getOperationLogTypeLabel(type: SystemOperationLogType) {
  return operationLogTypeOptions.find((o) => o.value === type)?.label ?? type
}

export function formatOperationLogOperator(name: string, roleLabel?: string) {
  return roleLabel ? `${name} (${roleLabel})` : name
}

export function formatOperationLogTime(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

export function exportOperationLogsCsv(
  rows: Array<{
    operatedAtLabel: string
    enterpriseName: string
    operatorLabel: string
    operationTypeLabel: string
    targetObject: string
    detail: string
    resultLabel: string
    ip: string
  }>,
) {
  const header = ['操作时间', '所属企业', '操作人', '操作类型', '操作对象', '操作详情', '结果', '操作IP']
  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`
  const lines = [
    header.map(escape).join(','),
    ...rows.map((r) =>
      [
        r.operatedAtLabel,
        r.enterpriseName,
        r.operatorLabel,
        r.operationTypeLabel,
        r.targetObject,
        r.detail,
        r.resultLabel,
        r.ip,
      ]
        .map(escape)
        .join(','),
    ),
  ]
  return `\uFEFF${lines.join('\n')}`
}
