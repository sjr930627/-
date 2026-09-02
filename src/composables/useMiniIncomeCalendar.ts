import type { WorkerIncomeRecord, WorkerIncomeStatus } from '@/types'
import { getCalendarCells } from './useMiniSchedule'

export type IncomeCalendarDayStatus = 'none' | WorkerIncomeStatus | 'mixed'

export interface IncomeDayLine {
  recordId: string
  recordTitle: string
  itemId: string
  title: string
  amount: number
  status: WorkerIncomeStatus
  source: WorkerIncomeRecord['source']
}

export interface IncomeDaySummary {
  date: string
  status: IncomeCalendarDayStatus
  totalAmount: number
  pendingAmount: number
  claimableAmount: number
  claimedAmount: number
  lines: IncomeDayLine[]
}

export interface IncomeMonthStats {
  daysWithIncome: number
  pending: number
  claimable: number
  claimed: number
}

function pad2(n: number) {
  return String(n).padStart(2, '0')
}

export function isoToLocalDate(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) {
    return iso.length >= 10 ? iso.slice(0, 10) : iso
  }
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`
}

export function buildIncomeDayMap(records: WorkerIncomeRecord[]): Map<string, IncomeDaySummary> {
  const map = new Map<string, IncomeDaySummary>()

  function ensure(date: string): IncomeDaySummary {
    let summary = map.get(date)
    if (!summary) {
      summary = {
        date,
        status: 'none',
        totalAmount: 0,
        pendingAmount: 0,
        claimableAmount: 0,
        claimedAmount: 0,
        lines: [],
      }
      map.set(date, summary)
    }
    return summary
  }

  function addLine(date: string, line: IncomeDayLine) {
    const summary = ensure(date)
    summary.lines.push(line)
    summary.totalAmount += line.amount
    if (line.status === 'pending_settlement') summary.pendingAmount += line.amount
    else if (line.status === 'claimable') summary.claimableAmount += line.amount
    else if (line.status === 'claimed') summary.claimedAmount += line.amount
  }

  for (const record of records) {
    if (record.items?.length) {
      for (const item of record.items) {
        const date = item.date ?? isoToLocalDate(record.createdAt)
        addLine(date, {
          recordId: record.id,
          recordTitle: record.title,
          itemId: item.id,
          title: item.title,
          amount: item.amount,
          status: record.status,
          source: record.source,
        })
      }
    } else {
      addLine(isoToLocalDate(record.createdAt), {
        recordId: record.id,
        recordTitle: record.title,
        itemId: `${record.id}_main`,
        title: record.title,
        amount: record.amount,
        status: record.status,
        source: record.source,
      })
    }
  }

  for (const summary of map.values()) {
    const hasPending = summary.pendingAmount > 0
    const hasClaimable = summary.claimableAmount > 0
    const hasClaimed = summary.claimedAmount > 0
    const kindCount = [hasPending, hasClaimable, hasClaimed].filter(Boolean).length
    if (kindCount > 1) summary.status = 'mixed'
    else if (hasClaimable) summary.status = 'claimable'
    else if (hasPending) summary.status = 'pending_settlement'
    else if (hasClaimed) summary.status = 'claimed'
    else summary.status = 'none'
  }

  return map
}

export function getIncomeMonthStats(
  year: number,
  month: number,
  dayMap: Map<string, IncomeDaySummary>,
): IncomeMonthStats {
  const prefix = `${year}-${pad2(month)}-`
  let daysWithIncome = 0
  let pending = 0
  let claimable = 0
  let claimed = 0

  for (const [date, summary] of dayMap) {
    if (!date.startsWith(prefix)) continue
    if (summary.totalAmount <= 0) continue
    daysWithIncome += 1
    pending += summary.pendingAmount
    claimable += summary.claimableAmount
    claimed += summary.claimedAmount
  }

  return { daysWithIncome, pending, claimable, claimed }
}

export function incomeDayBarColor(status: IncomeCalendarDayStatus): string {
  switch (status) {
    case 'claimable':
      return 'var(--mini-primary, #4FD1C5)'
    case 'pending_settlement':
      return 'var(--mini-warning, #f59e0b)'
    case 'claimed':
      return 'var(--mini-success, #22c55e)'
    case 'mixed':
      return 'linear-gradient(90deg, #f59e0b 0%, var(--mini-primary, #4FD1C5) 100%)'
    default:
      return 'transparent'
  }
}

export interface ClaimedBatchView {
  key: string
  claimedAt: string
  claimDate: string
  gross: number
  tax: number
  netAmount: number
  records: WorkerIncomeRecord[]
}

export interface ClaimDaySummary {
  date: string
  batches: ClaimedBatchView[]
  totalGross: number
  totalTax: number
  totalNet: number
}

export interface ClaimMonthStats {
  claimDays: number
  batchCount: number
  gross: number
  tax: number
  net: number
}

export function buildClaimedBatches(records: WorkerIncomeRecord[]): ClaimedBatchView[] {
  const claimed = records.filter((r) => r.status === 'claimed')
  const map = new Map<string, WorkerIncomeRecord[]>()
  for (const r of claimed) {
    const key = r.claimBatchId ?? r.claimedAt ?? r.id
    const list = map.get(key) ?? []
    list.push(r)
    map.set(key, list)
  }
  return [...map.entries()]
    .map(([key, batchRecords]) => {
      const claimedAt = batchRecords[0].claimedAt ?? batchRecords[0].createdAt
      return {
        key,
        claimedAt,
        claimDate: isoToLocalDate(claimedAt),
        gross: batchRecords.reduce((s, r) => s + r.amount, 0),
        tax: batchRecords.reduce((s, r) => s + (r.tax ?? 0), 0),
        netAmount: batchRecords.reduce((s, r) => s + (r.netAmount ?? r.amount), 0),
        records: [...batchRecords].sort((a, b) => b.amount - a.amount),
      }
    })
    .sort((a, b) => b.claimedAt.localeCompare(a.claimedAt))
}

export function buildClaimDateMap(batches: ClaimedBatchView[]): Map<string, ClaimDaySummary> {
  const map = new Map<string, ClaimDaySummary>()
  for (const batch of batches) {
    const date = batch.claimDate
    let summary = map.get(date)
    if (!summary) {
      summary = {
        date,
        batches: [],
        totalGross: 0,
        totalTax: 0,
        totalNet: 0,
      }
      map.set(date, summary)
    }
    summary.batches.push(batch)
    summary.totalGross += batch.gross
    summary.totalTax += batch.tax
    summary.totalNet += batch.netAmount
  }
  for (const summary of map.values()) {
    summary.batches.sort((a, b) => b.claimedAt.localeCompare(a.claimedAt))
  }
  return map
}

export function getClaimMonthStats(
  year: number,
  month: number,
  claimDateMap: Map<string, ClaimDaySummary>,
): ClaimMonthStats {
  const prefix = `${year}-${pad2(month)}-`
  let claimDays = 0
  let batchCount = 0
  let gross = 0
  let tax = 0
  let net = 0

  for (const [date, summary] of claimDateMap) {
    if (!date.startsWith(prefix)) continue
    claimDays += 1
    batchCount += summary.batches.length
    gross += summary.totalGross
    tax += summary.totalTax
    net += summary.totalNet
  }

  return { claimDays, batchCount, gross, tax, net }
}

export function buildClaimedIncomeDayMap(records: WorkerIncomeRecord[]): Map<string, IncomeDaySummary> {
  return buildIncomeDayMap(records.filter((r) => r.status === 'claimed'))
}

export { getCalendarCells }
