import type {
  Department,
  Employee,
  Enterprise,
  WorkerIncomeRecord,
  WorkerIncomeStatus,
} from '@/types'
import { resolveEmployeeEnterpriseId } from '@/services/fundManagement'

export interface WorkerFundAccountRow {
  employeeId: string
  employeeName: string
  employeeNo: string
  phone: string
  enterpriseId?: string
  enterpriseName: string
  departmentName: string
  /** 待结算金额（pending_settlement） */
  pendingAmount: number
  /** 账户余额（可领取 claimable） */
  balanceAmount: number
  /** 累计已提现净额 */
  withdrawnNetAmount: number
  pendingCount: number
  claimableCount: number
  claimedCount: number
}

export interface WorkerWithdrawalBatch {
  key: string
  claimedAt: string
  gross: number
  tax: number
  netAmount: number
  recordCount: number
  titles: string[]
  records: WorkerIncomeRecord[]
}

export const workerIncomeStatusLabel: Record<WorkerIncomeStatus, string> = {
  pending_settlement: '待结算',
  claimable: '已结算待领取',
  claimed: '已提现',
}

export function buildWorkerFundAccounts(
  employees: Employee[],
  departments: Department[],
  enterprises: Enterprise[],
  records: WorkerIncomeRecord[],
): WorkerFundAccountRow[] {
  const byEmployee = new Map<string, WorkerIncomeRecord[]>()
  for (const record of records) {
    const list = byEmployee.get(record.employeeId) ?? []
    list.push(record)
    byEmployee.set(record.employeeId, list)
  }

  const rows: WorkerFundAccountRow[] = []
  for (const [employeeId, empRecords] of byEmployee) {
    const employee = employees.find((item) => item.id === employeeId)
    if (!employee) continue

    const enterpriseId = resolveEmployeeEnterpriseId(employee, departments)
    const enterpriseName =
      enterprises.find((item) => item.id === enterpriseId)?.name ?? '—'
    const departmentName =
      departments.find((item) => item.id === employee.departmentId)?.name ?? '—'

    let pendingAmount = 0
    let balanceAmount = 0
    let withdrawnNetAmount = 0
    let pendingCount = 0
    let claimableCount = 0
    let claimedCount = 0

    for (const record of empRecords) {
      if (record.status === 'pending_settlement') {
        pendingAmount += record.amount
        pendingCount += 1
      } else if (record.status === 'claimable') {
        balanceAmount += record.amount
        claimableCount += 1
      } else if (record.status === 'claimed') {
        withdrawnNetAmount += record.netAmount ?? record.amount
        claimedCount += 1
      }
    }

    rows.push({
      employeeId,
      employeeName: employee.name,
      employeeNo: employee.employeeNo,
      phone: employee.phone ?? '—',
      enterpriseId,
      enterpriseName,
      departmentName,
      pendingAmount: Math.round(pendingAmount * 100) / 100,
      balanceAmount: Math.round(balanceAmount * 100) / 100,
      withdrawnNetAmount: Math.round(withdrawnNetAmount * 100) / 100,
      pendingCount,
      claimableCount,
      claimedCount,
    })
  }

  return rows.sort((a, b) => {
    const amountDiff = b.pendingAmount + b.balanceAmount - (a.pendingAmount + a.balanceAmount)
    if (amountDiff !== 0) return amountDiff
    return a.employeeName.localeCompare(b.employeeName, 'zh-CN')
  })
}

export function collectWorkerIncomeRecords(
  records: WorkerIncomeRecord[],
  employeeId: string,
  status?: WorkerIncomeStatus | 'settled',
): WorkerIncomeRecord[] {
  return records
    .filter((record) => {
      if (record.employeeId !== employeeId) return false
      if (!status) return true
      if (status === 'settled') {
        return record.status === 'claimable' || record.status === 'claimed'
      }
      return record.status === status
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

export function collectWorkerWithdrawals(
  records: WorkerIncomeRecord[],
  employeeId: string,
): WorkerWithdrawalBatch[] {
  const claimed = records.filter(
    (record) => record.employeeId === employeeId && record.status === 'claimed',
  )
  const map = new Map<string, WorkerIncomeRecord[]>()
  for (const record of claimed) {
    const key = record.claimBatchId ?? record.claimedAt ?? record.id
    const list = map.get(key) ?? []
    list.push(record)
    map.set(key, list)
  }

  return [...map.entries()]
    .map(([key, batchRecords]) => ({
      key,
      claimedAt: batchRecords[0].claimedAt ?? batchRecords[0].createdAt,
      gross: batchRecords.reduce((sum, item) => sum + item.amount, 0),
      tax: batchRecords.reduce((sum, item) => sum + (item.tax ?? 0), 0),
      netAmount: batchRecords.reduce(
        (sum, item) => sum + (item.netAmount ?? item.amount),
        0,
      ),
      recordCount: batchRecords.length,
      titles: batchRecords.map((item) => item.title),
      records: [...batchRecords].sort((a, b) => b.amount - a.amount),
    }))
    .sort((a, b) => b.claimedAt.localeCompare(a.claimedAt))
}

/** 收入明细行（展开单笔班次/任务 items，非周期汇总） */
export interface WorkerIncomeDetailRow {
  id: string
  date: string
  name: string
  quantity: number
  unitPrice: number
  amount: number
  calcType: 'hourly' | 'task'
  quantityLabel: string
  unitPriceLabel: string
}

function formatDetailQuantity(calcType: 'hourly' | 'task', quantity: number): string {
  return calcType === 'hourly' ? `${quantity} 小时` : `${quantity} 次`
}

function formatDetailUnitPrice(calcType: 'hourly' | 'task', unitPrice: number): string {
  return calcType === 'hourly' ? `¥${unitPrice}/小时` : `¥${unitPrice}/次`
}

function toDetailRow(
  id: string,
  date: string,
  name: string,
  quantity: number,
  unitPrice: number,
  amount: number,
  calcType: 'hourly' | 'task',
): WorkerIncomeDetailRow {
  return {
    id,
    date,
    name,
    quantity,
    unitPrice,
    amount,
    calcType,
    quantityLabel: formatDetailQuantity(calcType, quantity),
    unitPriceLabel: formatDetailUnitPrice(calcType, unitPrice),
  }
}

/** 展开收入记录为单笔班次/任务明细（每行一笔班次或一个任务） */
export function collectWorkerIncomeDetailRows(
  records: WorkerIncomeRecord[],
  employeeId: string,
  statuses: WorkerIncomeStatus[],
): WorkerIncomeDetailRow[] {
  const statusSet = new Set(statuses)
  const matched = records.filter(
    (record) => record.employeeId === employeeId && statusSet.has(record.status),
  )
  const rows: WorkerIncomeDetailRow[] = []

  for (const record of matched) {
    if (record.items?.length) {
      for (const item of record.items) {
        const calcType = item.calcType
        // 任务按「一个任务一行」展开；工时按「一笔班次一行」保留当日工时
        if (calcType === 'task' && (item.quantity ?? 1) > 1) {
          const count = item.quantity ?? 1
          for (let i = 0; i < count; i += 1) {
            rows.push(
              toDetailRow(
                `${item.id}_${i + 1}`,
                item.date ?? record.createdAt.slice(0, 10),
                item.title,
                1,
                item.unitPrice,
                item.unitPrice,
                'task',
              ),
            )
          }
        } else {
          const quantity = item.quantity ?? 1
          rows.push(
            toDetailRow(
              item.id,
              item.date ?? record.createdAt.slice(0, 10),
              item.title,
              quantity,
              item.unitPrice,
              item.amount,
              calcType,
            ),
          )
        }
      }
    } else {
      const calcType = record.source === 'task' ? 'task' : 'hourly'
      rows.push(
        toDetailRow(
          record.id,
          record.createdAt.slice(0, 10),
          record.title,
          1,
          record.amount,
          record.amount,
          calcType,
        ),
      )
    }
  }

  return rows.sort((a, b) => b.date.localeCompare(a.date) || a.name.localeCompare(b.name, 'zh-CN'))
}

/** @deprecated 使用 collectWorkerIncomeDetailRows */
export function collectWorkerPendingDetailRows(
  records: WorkerIncomeRecord[],
  employeeId: string,
): WorkerIncomeDetailRow[] {
  return collectWorkerIncomeDetailRows(records, employeeId, ['pending_settlement'])
}
