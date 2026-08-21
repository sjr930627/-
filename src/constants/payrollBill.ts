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

/** 服务费/结算金额转含税所用税率（价内税口径） */
export const BILL_SERVICE_TAX_RATE = 0.0672

function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100
}

/** 不含税金额转含税价：含税价 = 不含税合计 / (1 - 税率) */
export function calcTaxInclusiveAmount(
  exTaxAmount: number,
  taxRate = BILL_SERVICE_TAX_RATE,
): number {
  if (taxRate >= 1) return exTaxAmount
  return roundMoney(exTaxAmount / (1 - taxRate))
}

/** 按含税标记换算为含税金额 */
export function toBillTaxInclusiveAmount(amount: number, includesTax?: boolean): number {
  const value = Math.max(0, amount)
  return includesTax ? roundMoney(value) : calcTaxInclusiveAmount(value)
}

/** 结算金额与服务费均按不含税计价时，展示含税换算 */
export function isBillTaxExclusiveMode(bill: {
  serviceFeeIncludesTax?: boolean
  unitPriceIncludesTax?: boolean
}): boolean {
  return !(bill.serviceFeeIncludesTax ?? false) && !(bill.unitPriceIncludesTax ?? false)
}

export function getBillServiceFeeWaiver(bill: { serviceFeeWaiver?: number }): number {
  return Math.max(0, bill.serviceFeeWaiver ?? 0)
}

/** 账单应付（存储口径）= 结算金额 + 服务费 − 减免金额 */
export function calcBillTotalPayable(bill: {
  payrollTotal: number
  serviceFee: number
  serviceFeeWaiver?: number
}): number {
  return Math.max(
    0,
    roundMoney(bill.payrollTotal + bill.serviceFee - getBillServiceFeeWaiver(bill)),
  )
}

/**
 * 总计金额（含税）=
 * 结算金额（含税）+ 服务费（含税）− 减免金额（同服务费是否含税）
 */
export function calcBillTotalTaxInclusive(bill: {
  payrollTotal: number
  serviceFee: number
  serviceFeeWaiver?: number
  serviceFeeIncludesTax?: boolean
  unitPriceIncludesTax?: boolean
}): number {
  const payrollTax = toBillTaxInclusiveAmount(bill.payrollTotal, bill.unitPriceIncludesTax)
  const serviceTax = toBillTaxInclusiveAmount(bill.serviceFee, bill.serviceFeeIncludesTax)
  const waiverTax = toBillTaxInclusiveAmount(
    getBillServiceFeeWaiver(bill),
    bill.serviceFeeIncludesTax,
  )
  return Math.max(0, roundMoney(payrollTax + serviceTax - waiverTax))
}

export function formatBillTaxInclusiveTip(taxRate = BILL_SERVICE_TAX_RATE): string {
  return `总计含税 = 结算含税 + 服务费含税 − 减免（同服务费含税口径；税率 ${taxRate}）`
}

/** 按人数×工时估算减免金额（单位服务费 = 账单服务费 / 明细总工时） */
export function estimateServiceFeeWaiverByQuantity(
  bill: {
    serviceFee: number
    lines: { workHours?: number; attendanceDays?: number }[]
  },
  workerCount: number,
  workHours: number,
): { unitRate: number; amount: number; totalWorkHours: number } {
  const totalWorkHours = bill.lines.reduce((sum, line) => {
    if (line.workHours != null && line.workHours > 0) return sum + line.workHours
    return sum + Math.max(0, line.attendanceDays ?? 0) * 8
  }, 0)
  const unitRate = totalWorkHours > 0 ? bill.serviceFee / totalWorkHours : 0
  const amount = roundMoney(Math.max(0, workerCount) * Math.max(0, workHours) * unitRate)
  return { unitRate: roundMoney(unitRate), amount, totalWorkHours: roundMoney(totalWorkHours) }
}
