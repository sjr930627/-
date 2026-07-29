import type { InvoiceStatus, InvoiceType, SettlementBillStatus } from '@/types'

export const billStatusMap: Record<
  SettlementBillStatus,
  { label: string; type: 'warning' | 'primary' | 'success' | 'info' | 'danger' }
> = {
  pending_confirm: { label: '待确认', type: 'warning' },
  pending_payment: { label: '待付款', type: 'primary' },
  pending_verify: { label: '待核实', type: 'warning' },
  paid: { label: '已支付', type: 'success' },
  void: { label: '已作废', type: 'info' },
}

export const invoiceTypeMap: Record<InvoiceType, string> = {
  special: '增值税专用发票',
  normal: '增值税普通发票',
}

export const invoiceStatusMap: Record<
  InvoiceStatus,
  { label: string; type: 'warning' | 'success' | 'primary' }
> = {
  pending: { label: '待开票', type: 'warning' },
  issued: { label: '已开票', type: 'success' },
  mailed: { label: '已邮寄', type: 'primary' },
}

export function formatMoney(amount: number): string {
  return `¥${amount.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function formatPeriod(start: string, end: string): string {
  return `${start.replace(/-/g, '.')} - ${end.replace(/-/g, '.')}`
}

export function billRemainingInvoiceAmount(bill: {
  totalPayable: number
  invoicedAmount: number
}): number {
  return Math.max(0, bill.totalPayable - bill.invoicedAmount)
}
