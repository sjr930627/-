import type { FundAccountStatus, FundAccountType, FundTransactionStatus, FundTransactionType, FundWithdrawLimitConfig } from '@/types'

export const fundAccountTypeMap: Record<FundAccountType, { label: string; color: string }> = {
  alipay: { label: '支付宝', color: '#1677ff' },
  cmb: { label: '招商银行', color: '#c41230' },
}

export const fundAccountStatusMap: Record<FundAccountStatus, { label: string; type: 'success' | 'warning' | 'info' }> = {
  active: { label: '正常', type: 'success' },
  frozen: { label: '冻结', type: 'warning' },
  disabled: { label: '停用', type: 'info' },
}

export const fundTransactionTypeMap: Record<FundTransactionType, { label: string }> = {
  income: { label: '收入' },
  payout: { label: '代发' },
  transfer: { label: '转账' },
}

export const fundTransactionStatusMap: Record<FundTransactionStatus, { label: string; type: 'success' | 'warning' | 'danger' }> = {
  success: { label: '成功', type: 'success' },
  pending: { label: '处理中', type: 'warning' },
  failed: { label: '失败', type: 'danger' },
}

/** 平台统一提现限额默认值（元） */
export const defaultFundWithdrawLimitConfig: FundWithdrawLimitConfig = {
  monthlyPerProvider: 100000,
  perTransaction: 20000,
  dailyPerProvider: 50000,
  updatedAt: '2026-07-28T10:00:00.000Z',
}

export function ensureFundWithdrawLimitConfig(
  value: (Partial<FundWithdrawLimitConfig> & {
    /** @deprecated 兼容旧字段 */
    monthlyPerPerson?: number
    dailyWithdraw?: number
  }) | null | undefined,
): FundWithdrawLimitConfig {
  const monthly =
    typeof value?.monthlyPerProvider === 'number'
      ? value.monthlyPerProvider
      : typeof value?.monthlyPerPerson === 'number'
        ? value.monthlyPerPerson
        : defaultFundWithdrawLimitConfig.monthlyPerProvider
  const daily =
    typeof value?.dailyPerProvider === 'number'
      ? value.dailyPerProvider
      : typeof value?.dailyWithdraw === 'number'
        ? value.dailyWithdraw
        : defaultFundWithdrawLimitConfig.dailyPerProvider
  return {
    monthlyPerProvider: monthly >= 0 ? monthly : defaultFundWithdrawLimitConfig.monthlyPerProvider,
    perTransaction:
      typeof value?.perTransaction === 'number' && value.perTransaction >= 0
        ? value.perTransaction
        : defaultFundWithdrawLimitConfig.perTransaction,
    dailyPerProvider: daily >= 0 ? daily : defaultFundWithdrawLimitConfig.dailyPerProvider,
    updatedAt: value?.updatedAt ?? defaultFundWithdrawLimitConfig.updatedAt,
  }
}

export function formatFundAmount(amount: number) {
  return `¥${amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function maskAccountNo(accountNo: string) {
  const digits = accountNo.replace(/\s/g, '')
  if (digits.length <= 8) return accountNo
  return `${digits.slice(0, 4)} **** ${digits.slice(-4)}`
}
