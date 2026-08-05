import type {
  EnterpriseInvoiceProfile,
  InvoiceApplication,
  InvoiceApplicationBillRef,
  InvoiceDeliveryMethod,
  InvoiceStatus,
  InvoiceType,
  SettlementBill,
} from '@/types'
import { billRemainingInvoiceAmount } from '@/constants/payrollBill'

export const invoiceTypeMap: Record<InvoiceType, string> = {
  electronic_special: '电子专用发票',
  electronic_normal: '电子普通发票',
}

const legacyInvoiceTypeMap: Record<string, InvoiceType> = {
  special: 'electronic_special',
  normal: 'electronic_normal',
  electronic: 'electronic_normal',
}

export function normalizeInvoiceType(type: string): InvoiceType {
  if (type in invoiceTypeMap) return type as InvoiceType
  return legacyInvoiceTypeMap[type] ?? 'electronic_normal'
}

export const invoiceDeliveryMethodMap: Record<InvoiceDeliveryMethod, string> = {
  sf: '顺丰快递',
  ems: 'EMS',
  other: '其他',
}

export const invoiceStatusMap: Record<
  InvoiceStatus,
  { label: string; type: 'info' | 'warning' | 'success' | 'primary' | 'danger' }
> = {
  draft: { label: '草稿', type: 'info' },
  pending_review: { label: '待审核', type: 'warning' },
  reviewing: { label: '审核中', type: 'primary' },
  rejected: { label: '已驳回', type: 'danger' },
  issuing: { label: '开票中', type: 'primary' },
  issued: { label: '已开票', type: 'success' },
}

const legacyInvoiceStatusMap: Record<string, { label: string; type: 'info' | 'warning' | 'success' | 'primary' | 'danger' }> = {
  pending: { label: '待审核', type: 'warning' },
  mailed: { label: '已开票', type: 'success' },
}

export function resolveInvoiceStatusMeta(status: string) {
  return invoiceStatusMap[status as InvoiceStatus] ?? legacyInvoiceStatusMap[status] ?? {
    label: status,
    type: 'info' as const,
  }
}

export function invoiceApplicationsForEnterprise(
  applications: InvoiceApplication[],
  enterpriseId?: string,
) {
  if (!enterpriseId) return applications
  return applications.filter((item) => item.enterpriseId === enterpriseId)
}

export function invoiceStats(
  applications: InvoiceApplication[],
  bills: SettlementBill[],
  enterpriseId?: string,
) {
  const scopedApps = invoiceApplicationsForEnterprise(applications, enterpriseId)
  const scopedBills = enterpriseId
    ? bills.filter((bill) => bill.enterpriseId === enterpriseId)
    : bills

  const invoiceableTotal = scopedBills
    .filter((bill) => bill.status === 'paid')
    .reduce((sum, bill) => sum + billRemainingInvoiceAmount(bill), 0)

  const issuedAmount = scopedApps
    .filter((item) => item.status === 'issued')
    .reduce((sum, item) => sum + item.amount, 0)

  const pendingAmount = scopedApps
    .filter((item) => ['pending_review', 'reviewing', 'issuing'].includes(item.status))
    .reduce((sum, item) => sum + item.amount, 0)

  const reservedFromBills = scopedBills
    .filter((bill) => bill.status === 'paid')
    .reduce((sum, bill) => sum + bill.invoicedAmount, 0)

  return {
    invoiceableTotal,
    issuedAmount,
    pendingAmount,
    totalApplications: scopedApps.filter((item) => item.status !== 'draft').length,
    reservedFromBills,
    progress: {
      approved: scopedApps.filter((item) => item.status === 'issued').length,
      reviewing: scopedApps.filter((item) => ['pending_review', 'reviewing', 'issuing'].includes(item.status)).length,
      rejected: scopedApps.filter((item) => item.status === 'rejected').length,
      draft: scopedApps.filter((item) => item.status === 'draft').length,
    },
  }
}

export function billFeePreviewRows(bill?: SettlementBill) {
  if (!bill) return []
  const summary = bill.summary ?? {
    attendancePay: bill.lines.reduce((sum, line) => sum + (line.attendancePay ?? 0), 0),
    taskPay: bill.lines.reduce((sum, line) => sum + (line.taskPay ?? 0), 0),
    overtimePay: bill.lines.reduce((sum, line) => sum + (line.overtimePay ?? 0), 0),
    deductions: bill.lines.reduce((sum, line) => sum + (line.deductions ?? 0), 0),
    workerCount: bill.lines.length,
  }
  return [
    { label: '考勤薪酬', amount: summary.attendancePay },
    { label: '任务薪酬', amount: summary.taskPay },
    { label: '加班薪酬', amount: summary.overtimePay },
    { label: '扣款', amount: -summary.deductions },
    { label: '结算金额', amount: bill.payrollTotal, highlight: true },
    { label: '服务费', amount: bill.serviceFee },
    { label: '总计金额', amount: bill.totalPayable, highlight: true },
  ]
}

export function defaultInvoiceProfile(profiles: EnterpriseInvoiceProfile[], enterpriseId?: string) {
  if (!enterpriseId) return profiles[0]
  return profiles.find((item) => item.enterpriseId === enterpriseId) ?? profiles[0]
}

export function maxInvoiceAmountForBills(billIds: string[], bills: SettlementBill[]) {
  return billIds.reduce((sum, billId) => {
    const bill = bills.find((item) => item.id === billId)
    return sum + (bill ? billRemainingInvoiceAmount(bill) : 0)
  }, 0)
}

export function allocateAmountToBills(
  billIds: string[],
  totalAmount: number,
  bills: SettlementBill[],
): InvoiceApplicationBillRef[] {
  let remaining = Math.round(totalAmount * 100) / 100
  const refs: InvoiceApplicationBillRef[] = []
  for (const billId of billIds) {
    if (remaining <= 0) break
    const bill = bills.find((item) => item.id === billId)
    if (!bill) continue
    const cap = billRemainingInvoiceAmount(bill)
    const amount = Math.min(cap, remaining)
    if (amount <= 0) continue
    refs.push({
      billId: bill.id,
      billNo: bill.billNo,
      amount: Math.round(amount * 100) / 100,
    })
    remaining = Math.round((remaining - amount) * 100) / 100
  }
  return refs
}

export function mergeBillFeePreviewRows(bills: SettlementBill[]) {
  if (!bills.length) return []
  const merged = {
    attendancePay: 0,
    taskPay: 0,
    overtimePay: 0,
    deductions: 0,
    payrollTotal: 0,
    serviceFee: 0,
    totalPayable: 0,
  }
  for (const bill of bills) {
    const rows = billFeePreviewRows(bill)
    merged.attendancePay += rows.find((row) => row.label === '考勤薪酬')?.amount ?? 0
    merged.taskPay += rows.find((row) => row.label === '任务薪酬')?.amount ?? 0
    merged.overtimePay += rows.find((row) => row.label === '加班薪酬')?.amount ?? 0
    merged.deductions += Math.abs(rows.find((row) => row.label === '扣款')?.amount ?? 0)
    merged.payrollTotal += bill.payrollTotal
    merged.serviceFee += bill.serviceFee
    merged.totalPayable += bill.totalPayable
  }
  return [
    { label: '考勤薪酬', amount: merged.attendancePay },
    { label: '任务薪酬', amount: merged.taskPay },
    { label: '加班薪酬', amount: merged.overtimePay },
    { label: '扣款', amount: -merged.deductions },
    { label: '结算金额', amount: merged.payrollTotal, highlight: true },
    { label: '服务费', amount: merged.serviceFee },
    { label: '总计金额', amount: merged.totalPayable, highlight: true },
  ]
}

export function formatInvoiceBillLabel(bills: InvoiceApplicationBillRef[]) {
  if (!bills.length) return '—'
  if (bills.length === 1) return bills[0].billNo
  return `${bills[0].billNo} 等 ${bills.length} 张账单`
}
