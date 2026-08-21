import type {
  Department,
  Employee,
  FundTransaction,
  ProviderFundAccount,
  ServiceProvider,
  WorkerIncomeRecord,
} from '@/types'

export interface ProviderFundSummary {
  providerId: string
  accountCount: number
  totalBalance: number
  pendingClaimable: number
}

export function resolveEmployeeEnterpriseId(
  employee: Employee,
  departments: Department[],
): string | undefined {
  if (employee.enterpriseId) return employee.enterpriseId
  return departments.find((d) => d.id === employee.departmentId)?.enterpriseId
}

export function computeProviderPendingClaimable(
  providerId: string,
  providers: ServiceProvider[],
  employees: Employee[],
  departments: Department[],
  workerIncomeRecords: WorkerIncomeRecord[],
): number {
  const provider = providers.find((p) => p.id === providerId)
  if (!provider) return 0

  const enterpriseIds = new Set(provider.linkedEnterpriseIds)
  const employeeIds = new Set(
    employees
      .filter((employee) => {
        const enterpriseId = resolveEmployeeEnterpriseId(employee, departments)
        return enterpriseId && enterpriseIds.has(enterpriseId)
      })
      .map((employee) => employee.id),
  )

  return workerIncomeRecords
    .filter((record) => record.status === 'claimable' && employeeIds.has(record.employeeId))
    .reduce((sum, record) => sum + record.amount, 0)
}

export function summarizeProviderFunds(
  providerId: string,
  accounts: ProviderFundAccount[],
  pendingClaimable: number,
): ProviderFundSummary {
  const providerAccounts = accounts.filter(
    (account) => account.providerId === providerId && account.status !== 'disabled',
  )
  return {
    providerId,
    accountCount: providerAccounts.length,
    totalBalance: providerAccounts.reduce((sum, account) => sum + account.balance, 0),
    pendingClaimable,
  }
}

export function summarizeAllProviders(
  providers: ServiceProvider[],
  accounts: ProviderFundAccount[],
  employees: Employee[],
  departments: Department[],
  workerIncomeRecords: WorkerIncomeRecord[],
): ProviderFundSummary[] {
  return providers.map((provider) => {
    const pendingClaimable = computeProviderPendingClaimable(
      provider.id,
      providers,
      employees,
      departments,
      workerIncomeRecords,
    )
    return summarizeProviderFunds(provider.id, accounts, pendingClaimable)
  })
}

export function formatAccountConfigSummary(account: ProviderFundAccount): string {
  if (account.accountType === 'alipay' && account.alipayConfig) {
    return `${account.alipayConfig.merchantName} · ${account.alipayConfig.alipayAccount}`
  }
  if (account.accountType === 'cmb' && account.cmbConfig) {
    return `${account.cmbConfig.accountName} · ${account.cmbConfig.accountNo}`
  }
  return '—'
}

/** 账户号（支付宝账号 / 银行账号） */
export function resolveFundAccountNo(account: ProviderFundAccount | undefined): string {
  if (!account) return '—'
  if (account.accountType === 'alipay') return account.alipayConfig?.alipayAccount || '—'
  return account.cmbConfig?.accountNo || '—'
}

export function isIncomeTransaction(tx: Pick<FundTransaction, 'direction' | 'type'>) {
  return tx.direction === 'in'
}
