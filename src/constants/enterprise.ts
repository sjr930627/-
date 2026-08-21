import type { Enterprise, EnterpriseInvoiceCategoryItem, InvoiceType } from '@/types'
import { getDepartmentName } from '@/utils'
import { normalizeInvoiceType } from '@/constants/invoice'

export const enterpriseStatusMap = {
  active: { label: '生效中', type: 'success' as const, dot: '#67c23a' },
  expiring: { label: '即将到期', type: 'warning' as const, dot: '#e6a23c' },
  terminated: { label: '已终止', type: 'info' as const, dot: '#909399' },
}

export const enterpriseModuleMap = {
  recruitment: '招聘',
  attendance: '考勤',
  task: '任务',
  payroll: '财税',
  training: '培训考核',
} as const

/** 企业负责人可选角色（运营专员/操作员） */
export const enterpriseOperatorRoleId = 'role_operator'

/** 读取企业负责人 ID（兼容旧字段 serviceOwnerIds） */
export function getEnterpriseOwnerIds(enterprise: Enterprise) {
  const legacy = (enterprise as Enterprise & { serviceOwnerIds?: string[] }).serviceOwnerIds
  return enterprise.enterpriseOwnerIds ?? legacy ?? []
}

/** 新建企业默认开通且不可关闭的模块 */
export const defaultEnterpriseModules = ['attendance', 'payroll'] as const satisfies readonly Enterprise['serviceModules'][number][]

export function normalizeEnterpriseModules(modules: Enterprise['serviceModules']) {
  return [...new Set([...defaultEnterpriseModules, ...modules])] as Enterprise['serviceModules']
}

export function formatEnterpriseModules(modules: Enterprise['serviceModules']) {
  return modules.map((m) => enterpriseModuleMap[m]).join('、')
}

/** 租户可用模块展示标签（参照 PRD 企业端菜单） */
export function getTenantModuleTags(modules: Enterprise['serviceModules']): string[] {
  const tags: string[] = []
  if (modules.includes('recruitment')) {
    tags.push('招聘管理', '面试日程')
  }
  if (modules.includes('attendance')) tags.push('出勤管理', '人员管理')
  if (modules.includes('training')) tags.push('培训与考核')
  if (modules.includes('task')) tags.push('任务管理')
  if (modules.includes('payroll')) tags.push('财税管理')
  return tags
}

export function isTenantActive(enterprise: Enterprise): boolean {
  return enterprise.status !== 'terminated' && !enterprise.tenantDisabled
}

export const tenantStatusMeta = {
  active: { label: '正常', dot: '#67c23a' },
  disabled: { label: '已停用', dot: '#f56c6c' },
} as const

export function formatEnterpriseOwnerNames(
  ownerIds: string[] | undefined,
  accounts: import('@/types').SystemAccount[],
) {
  if (!ownerIds?.length) return '—'
  const names = ownerIds
    .map((id) => accounts.find((a) => a.id === id)?.displayName)
    .filter((name): name is string => Boolean(name))
  return names.length ? names.join('、') : '—'
}

export function formatEnterpriseOwners(
  ownerIds: string[] | undefined,
  accounts: import('@/types').SystemAccount[],
  departments: import('@/types').Department[],
) {
  if (!ownerIds?.length) return '—'
  return ownerIds
    .map((id) => accounts.find((a) => a.id === id))
    .filter((a): a is import('@/types').SystemAccount => Boolean(a))
    .map((a) => `${a.displayName}（${getDepartmentName(departments, a.departmentId)}）`)
    .join('、')
}

export function generateEnterpriseCode(seq: number) {
  const year = new Date().getFullYear()
  return `CT-${year}-${String(seq).padStart(5, '0')}`
}

export function generateRandomPassword(length = 11) {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789$#@'
  let result = ''
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)]
  }
  return result
}

/** 兼容旧版 string[] 可开票类目 */
export function normalizeEnterpriseInvoiceCategories(
  categories: Enterprise['invoiceCategories'] | undefined,
): EnterpriseInvoiceCategoryItem[] {
  if (!categories?.length) return []
  return categories.map((item) => {
    if (typeof item === 'string') {
      return {
        name: item,
        invoiceType: 'electronic_normal' as InvoiceType,
      }
    }
    return {
      name: item.name,
      invoiceType: normalizeInvoiceType(item.invoiceType),
    }
  })
}

export function formatEnterpriseInvoiceCategoryLabel(item: EnterpriseInvoiceCategoryItem) {
  const typeLabel =
    item.invoiceType === 'electronic_special' ? '电子专票' : '电子普票'
  return `${item.name}（${typeLabel}）`
}

export function getEnterpriseInvoiceCategories(
  enterprises: Enterprise[],
  enterpriseId?: string,
): EnterpriseInvoiceCategoryItem[] {
  if (!enterpriseId) return []
  const enterprise = enterprises.find((item) => item.id === enterpriseId)
  return normalizeEnterpriseInvoiceCategories(enterprise?.invoiceCategories)
}

export function getEnterpriseInvoiceCategoryNames(
  enterprises: Enterprise[],
  enterpriseId?: string,
): string[] {
  return getEnterpriseInvoiceCategories(enterprises, enterpriseId).map((item) => item.name)
}
