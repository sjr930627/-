import type { SettlementBillStatus } from '@/types'

export {
  invoiceTypeMap,
  invoiceStatusMap,
  invoiceDeliveryMethodMap,
  resolveInvoiceStatusMeta,
} from '@/constants/invoice'

export const billStatusMap: Record<
  SettlementBillStatus,
  { label: string; type: 'warning' | 'primary' | 'success' | 'info' | 'danger' }
> = {
  pending_submit: { label: '待提交', type: 'info' },
  pending_confirm: { label: '待确认', type: 'warning' },
  pending_payment: { label: '待付款', type: 'primary' },
  paid: { label: '已付款', type: 'success' },
  void: { label: '已作废', type: 'danger' },
}

/** 兼容旧 localStorage 中的 pending_verify 状态 */
const legacyBillStatusMap: Record<string, { label: string; type: 'warning' | 'primary' | 'success' | 'info' | 'danger' }> = {
  pending_verify: { label: '待付款', type: 'primary' },
}

export function resolveBillStatusMeta(status: string) {
  return billStatusMap[status as SettlementBillStatus] ?? legacyBillStatusMap[status] ?? {
    label: status,
    type: 'info' as const,
  }
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
