import type {
  SettlementManageOrder,
  SettlementManageStatus,
  SettlementManageType,
  SettlementSlip,
} from '@/types'

export const settlementManageStatusMap: Record<
  SettlementManageStatus,
  { label: string; type: 'info' | 'success' }
> = {
  pending_settlement: { label: '待结算', type: 'info' },
  settled: { label: '已结算', type: 'success' },
}

export const settlementManageTypeMap: Record<SettlementManageType, string> = {
  hourly: '工时',
  task: '任务',
  import: '导入发薪',
}

/** 待结算可切换的类型（导入发薪直接生成结算单，无待结算池） */
export const pendingSettlementTypes: Exclude<SettlementManageType, 'import'>[] = ['hourly', 'task']

export function settlementLineKey(orderId: string, lineId: string): string {
  return `${orderId}:${lineId}`
}

export function parseSettlementLineKey(key: string): { orderId: string; lineId: string } {
  const [orderId, lineId] = key.split(':')
  return { orderId, lineId }
}

export interface PendingSettlementLineRow {
  key: string
  orderId: string
  lineId: string
  enterpriseId: string
  enterpriseName: string
  orderNo: string
  orderName: string
  orderLabel: string
  /** 明细日期（单笔班次/任务发生日） */
  date: string
  periodStart: string
  periodEnd: string
  periodLabel: string
  employeeId: string
  employeeName: string
  employeeNo?: string
  departmentName?: string
  quantity: number
  unitPrice: number
  amount: number
  type: SettlementManageType
}

export interface PendingEnterpriseGroup {
  enterpriseId: string
  enterpriseName: string
  lines: PendingSettlementLineRow[]
  workerCount: number
  totalAmount: number
}

export function resolveOrderStatus(order: SettlementManageOrder): SettlementManageStatus {
  if (!order.workerLines.length) return 'pending_settlement'
  return order.workerLines.every((line) => line.status === 'settled')
    ? 'settled'
    : 'pending_settlement'
}

export function orderTotals(order: SettlementManageOrder) {
  return {
    quantity: order.workerLines.reduce((sum, line) => sum + line.quantity, 0),
    amount: order.workerLines.reduce((sum, line) => sum + line.amount, 0),
    pendingCount: order.workerLines.filter((line) => line.status === 'pending_settlement').length,
    settledCount: order.workerLines.filter((line) => line.status === 'settled').length,
  }
}

export function collectPendingLines(
  orders: SettlementManageOrder[],
  type: SettlementManageType,
): PendingSettlementLineRow[] {
  const rows: PendingSettlementLineRow[] = []
  for (const order of orders) {
    if (order.type !== type) continue
    for (const line of order.workerLines) {
      if (line.status !== 'pending_settlement') continue
      const date = order.periodStart
      rows.push({
        key: settlementLineKey(order.id, line.id),
        orderId: order.id,
        lineId: line.id,
        enterpriseId: order.enterpriseId,
        enterpriseName: order.enterpriseName,
        orderNo: order.orderNo,
        orderName: order.orderName,
        orderLabel: order.orderName,
        date,
        periodStart: order.periodStart,
        periodEnd: order.periodEnd,
        periodLabel: formatSettlementPeriod(order.periodStart, order.periodEnd),
        employeeId: line.employeeId,
        employeeName: line.employeeName,
        employeeNo: line.employeeNo,
        departmentName: line.departmentName,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        amount: line.amount,
        type: order.type,
      })
    }
  }
  return rows.sort(
    (a, b) =>
      b.date.localeCompare(a.date) ||
      a.employeeName.localeCompare(b.employeeName, 'zh-CN') ||
      a.orderName.localeCompare(b.orderName, 'zh-CN'),
  )
}

export function groupPendingByEnterprise(lines: PendingSettlementLineRow[]): PendingEnterpriseGroup[] {
  const map = new Map<string, PendingEnterpriseGroup & { employeeIds: Set<string> }>()
  for (const line of lines) {
    let group = map.get(line.enterpriseId)
    if (!group) {
      group = {
        enterpriseId: line.enterpriseId,
        enterpriseName: line.enterpriseName,
        lines: [],
        workerCount: 0,
        totalAmount: 0,
        employeeIds: new Set(),
      }
      map.set(line.enterpriseId, group)
    }
    group.lines.push(line)
    group.employeeIds.add(line.employeeId)
    group.totalAmount += line.amount
  }
  return [...map.values()]
    .map(({ employeeIds, ...group }) => ({
      ...group,
      workerCount: employeeIds.size,
    }))
    .sort((a, b) => a.enterpriseName.localeCompare(b.enterpriseName, 'zh-CN'))
}

export function slipEnterpriseLabel(slip: SettlementSlip): string {
  const names = [...new Set(slip.lines.map((line) => line.enterpriseName))]
  if (names.length === 1) return names[0]
  return `${names.length} 家企业`
}

export function formatSettlementQuantity(type: SettlementManageType, quantity: number): string {
  if (type === 'hourly') return `${quantity} 小时`
  if (type === 'task') return `${quantity} 次`
  return `${quantity} 人`
}

export function formatSettlementUnitPrice(type: SettlementManageType, unitPrice: number): string {
  if (type === 'hourly') return `¥${unitPrice}/小时`
  if (type === 'task') return `¥${unitPrice}/次`
  return '—'
}

export function formatSettlementPeriod(start: string, end: string): string {
  if (start === end) return start.replace(/-/g, '.')
  return `${start.replace(/-/g, '.')} - ${end.replace(/-/g, '.')}`
}

export function representativeUnitPrice(order: SettlementManageOrder): number {
  const first = order.workerLines[0]
  return first?.unitPrice ?? 0
}
