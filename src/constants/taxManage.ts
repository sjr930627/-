import type {
  TaxDeclaration,
  TaxDeclarationStatus,
  TaxDeclarationWorker,
  TaxWithdrawalChannel,
  WorkerPaymentBinding,
} from '@/types'

export const TAX_WITHHOLDING_RATE = 0.03

export const taxDeclarationStatusMap: Record<
  TaxDeclarationStatus,
  { label: string; type: 'info' | 'warning' | 'success' }
> = {
  generated: { label: '已生成', type: 'info' },
  submitted: { label: '已提交', type: 'warning' },
  filed: { label: '已申报', type: 'success' },
}

export const taxWithdrawalChannelMap: Record<TaxWithdrawalChannel, string> = {
  alipay: '支付宝',
  bank_card: '银行卡',
}

export function calcWithholdingTax(amount: number): number {
  return Math.round(amount * TAX_WITHHOLDING_RATE * 100) / 100
}

export function calcNetAfterTax(amount: number): number {
  return Math.round((amount - calcWithholdingTax(amount)) * 100) / 100
}

export function formatTaxMonthLabel(month: string): string {
  const [year, mon] = month.split('-')
  return `${year}年${Number(mon)}月`
}

export function resolveWithdrawalChannel(
  employeeId: string,
  bindings: WorkerPaymentBinding[],
  index: number,
): TaxWithdrawalChannel {
  const binding = bindings.find((item) => item.employeeId === employeeId)
  if (binding?.alipay && !binding.bankCardLast4) return 'alipay'
  if (binding?.bankCardLast4 && !binding.alipay) return 'bank_card'
  return index % 2 === 0 ? 'alipay' : 'bank_card'
}

export function formatWithdrawalChannel(channel: TaxWithdrawalChannel): string {
  return taxWithdrawalChannelMap[channel]
}

export function sumDeclarationWorkers(workers: TaxDeclarationWorker[]) {
  return {
    workerCount: workers.length,
    totalSettlementAmount: workers.reduce((sum, worker) => sum + worker.totalSettlementAmount, 0),
    totalTaxAmount: workers.reduce((sum, worker) => sum + worker.totalTaxAmount, 0),
    totalNetAmount: workers.reduce((sum, worker) => sum + worker.totalNetAmount, 0),
  }
}

export function declarationSummary(declaration: TaxDeclaration) {
  return {
    workerCount: declaration.workerCount,
    totalSettlementAmount: declaration.totalSettlementAmount,
    totalTaxAmount: declaration.totalTaxAmount,
    totalNetAmount: declaration.totalNetAmount,
  }
}
