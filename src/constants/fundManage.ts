import type { FundAccountStatus, FundAccountType, FundTransactionStatus, FundTransactionType } from '@/types'

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

export function formatFundAmount(amount: number) {
  return `¥${amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function maskAccountNo(accountNo: string) {
  const digits = accountNo.replace(/\s/g, '')
  if (digits.length <= 8) return accountNo
  return `${digits.slice(0, 4)} **** ${digits.slice(-4)}`
}
