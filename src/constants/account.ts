import type { SystemAccount, SystemRole } from '@/types'

type LegacySystemAccount = SystemAccount & { roleId?: string }

/** 兼容旧版单角色字段 roleId */
export function normalizeSystemAccount(account: LegacySystemAccount): SystemAccount {
  if (account.roleIds?.length) {
    const { roleId: _legacy, ...rest } = account
    return rest as SystemAccount
  }
  const { roleId, ...rest } = account
  return {
    ...rest,
    roleIds: roleId ? [roleId] : [],
  } as SystemAccount
}

export function accountHasRole(account: Pick<SystemAccount, 'roleIds'>, roleId: string) {
  return account.roleIds.includes(roleId)
}

export function formatAccountRoleNames(
  account: Pick<SystemAccount, 'roleIds'>,
  roles: SystemRole[],
) {
  if (!account.roleIds.length) return '-'
  const names = account.roleIds
    .map((id) => roles.find((r) => r.id === id)?.name)
    .filter((name): name is string => Boolean(name))
  return names.length ? names.join('、') : '-'
}
