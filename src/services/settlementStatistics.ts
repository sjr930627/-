import { WORKBENCH_DEMO_NOW } from '@/constants/workbenchReminder'
import type { SettlementBill, SettlementBillLine, SettlementSlip } from '@/types'

function toYmd(d: Date) {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

function daysBetween(from: string, to: string) {
  const a = new Date(from.slice(0, 10))
  const b = new Date(to.slice(0, 10))
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000))
}

export function formatCompactMoney(amount: number): string {
  const abs = Math.abs(amount)
  if (abs >= 1e8) return `¥${(amount / 1e8).toFixed(2)} 亿`
  if (abs >= 1e4) return `¥${(amount / 1e4).toFixed(abs >= 1e6 ? 0 : 2)} 万`
  return `¥${amount.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`
}

export function formatWanNumber(amount: number): string {
  return (amount / 1e4).toLocaleString('zh-CN', {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  })
}

function yoyText(current: number, previous: number) {
  if (!previous && !current) return { text: '—', up: true, pct: 0 }
  if (!previous) return { text: '新增', up: true, pct: 100 }
  const pct = Math.round(((current - previous) / previous) * 1000) / 10
  return { text: `${pct >= 0 ? '+' : ''}${pct}%`, up: pct >= 0, pct }
}

/** 按结算周期月份汇总 */
function monthlyBuckets(bills: SettlementBill[], year: number) {
  const months = Array.from({ length: 12 }, (_, i) => ({
    month: i + 1,
    label: `${i + 1}月`,
    billAmount: 0,
    serviceFee: 0,
    payroll: 0,
    paid: 0,
    advance: 0,
    count: 0,
  }))
  for (const b of bills) {
    if (b.status === 'void') continue
    if (!b.periodStart.startsWith(String(year))) continue
    const m = Number(b.periodStart.slice(5, 7))
    if (m < 1 || m > 12) continue
    const row = months[m - 1]
    row.billAmount += b.totalPayable
    row.serviceFee += b.serviceFee
    row.payroll += b.payrollTotal
    row.count += 1
    if (b.status === 'paid') row.paid += b.totalPayable
    if (b.status === 'pending_payment') row.advance += b.payrollTotal
  }
  return months
}

/** 演示补齐：真实月数据不足时，按年种子生成可读年度曲线 */
function ensureAnnualMonths(
  months: ReturnType<typeof monthlyBuckets>,
  year: number,
) {
  const base = 2800000 + (year % 10) * 120000
  return months.map((m, i) => {
    if (m.count > 0) return { ...m, synthetic: false as const }
    const wave = 1 + Math.sin((i + year) * 0.7) * 0.12 + i * 0.025
    const billAmount = Math.round(base * wave)
    const serviceFee = Math.round(billAmount * 0.09)
    const payroll = billAmount - serviceFee
    return {
      ...m,
      billAmount,
      serviceFee,
      payroll,
      paid: Math.round(billAmount * 0.88),
      advance: Math.round(payroll * 0.12),
      count: 0,
      synthetic: true as const,
    }
  })
}

export interface AnnualEnterpriseSettlement {
  year: number
  summary: {
    billTotal: number
    serviceFee: number
    advance: number
    advanceRatio: number
    paid: number
    receivable: number
    collectionRate: number
    billYoy: ReturnType<typeof yoyText>
    feeYoy: ReturnType<typeof yoyText>
  }
  months: {
    month: number
    label: string
    billAmount: number
    serviceFee: number
    yoy: ReturnType<typeof yoyText>
    synthetic: boolean
  }[]
  quarters: {
    label: string
    billAmount: number
    serviceFee: number
    yoy: ReturnType<typeof yoyText>
  }[]
  prevYearMonthlyBills: number[]
  prevYearMonthlyFees: number[]
}

export function buildAnnualEnterpriseSettlement(
  bills: SettlementBill[],
  year: number,
): AnnualEnterpriseSettlement {
  const cur = ensureAnnualMonths(monthlyBuckets(bills, year), year)
  const prev = ensureAnnualMonths(monthlyBuckets(bills, year - 1), year - 1)

  const billTotal = cur.reduce((s, m) => s + m.billAmount, 0)
  const serviceFee = cur.reduce((s, m) => s + m.serviceFee, 0)
  const advance = cur.reduce((s, m) => s + m.advance, 0)
  const paid = cur.reduce((s, m) => s + m.paid, 0)
  const receivable = Math.max(0, billTotal - paid)
  const prevBillTotal = prev.reduce((s, m) => s + m.billAmount, 0)
  const prevFee = prev.reduce((s, m) => s + m.serviceFee, 0)

  const months = cur.map((m, i) => ({
    month: m.month,
    label: m.label,
    billAmount: m.billAmount,
    serviceFee: m.serviceFee,
    yoy: yoyText(m.billAmount, prev[i].billAmount),
    synthetic: m.synthetic,
  }))

  const quarters = [0, 1, 2, 3].map((q) => {
    const slice = months.slice(q * 3, q * 3 + 3)
    const prevSlice = prev.slice(q * 3, q * 3 + 3)
    const billAmount = slice.reduce((s, m) => s + m.billAmount, 0)
    const fee = slice.reduce((s, m) => s + m.serviceFee, 0)
    const prevBill = prevSlice.reduce((s, m) => s + m.billAmount, 0)
    return {
      label: `Q${q + 1}`,
      billAmount,
      serviceFee: fee,
      yoy: yoyText(billAmount, prevBill),
    }
  })

  return {
    year,
    summary: {
      billTotal,
      serviceFee,
      advance,
      advanceRatio: billTotal ? Math.round((advance / billTotal) * 1000) / 10 : 0,
      paid,
      receivable,
      collectionRate: billTotal ? Math.round((paid / billTotal) * 1000) / 10 : 0,
      billYoy: yoyText(billTotal, prevBillTotal),
      feeYoy: yoyText(serviceFee, prevFee),
    },
    months,
    quarters,
    prevYearMonthlyBills: prev.map((m) => m.billAmount),
    prevYearMonthlyFees: prev.map((m) => m.serviceFee),
  }
}

function shiftMonth(ym: string, delta: number) {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + delta, 1)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}`
}

function sumMonth(bills: SettlementBill[], ym: string) {
  let billAmount = 0
  let serviceFee = 0
  let payroll = 0
  let paid = 0
  let advance = 0
  const enterpriseMap = new Map<
    string,
    {
      enterpriseId: string
      enterpriseName: string
      billCount: number
      billTotal: number
      payroll: number
      serviceFee: number
      paid: number
      advance: number
    }
  >()
  for (const b of bills) {
    if (b.status === 'void' || !b.periodStart.startsWith(ym)) continue
    billAmount += b.totalPayable
    serviceFee += b.serviceFee
    payroll += b.payrollTotal
    if (b.status === 'paid') paid += b.totalPayable
    if (b.status === 'pending_payment') advance += b.payrollTotal
    const row = enterpriseMap.get(b.enterpriseId) ?? {
      enterpriseId: b.enterpriseId,
      enterpriseName: b.enterpriseName,
      billCount: 0,
      billTotal: 0,
      payroll: 0,
      serviceFee: 0,
      paid: 0,
      advance: 0,
    }
    row.billCount += 1
    row.billTotal += b.totalPayable
    row.payroll += b.payrollTotal
    row.serviceFee += b.serviceFee
    if (b.status === 'paid') row.paid += b.totalPayable
    if (b.status === 'pending_payment') row.advance += b.payrollTotal
    enterpriseMap.set(b.enterpriseId, row)
  }
  return {
    billAmount,
    serviceFee,
    payroll,
    paid,
    advance,
    receivable: Math.max(0, billAmount - paid),
    enterprises: [...enterpriseMap.values()].sort((a, b) => b.billTotal - a.billTotal),
  }
}

/** 按月维度：本月 KPI + 同比/环比 + 企业明细 */
export function buildMonthlyEnterpriseSettlement(bills: SettlementBill[], month: string) {
  const cur = sumMonth(bills, month)
  const prevMonth = sumMonth(bills, shiftMonth(month, -1))
  const prevYear = sumMonth(bills, shiftMonth(month, -12))

  /** 无真实账单时用年度补齐曲线中的对应月，保证演示可读 */
  const y = Number(month.slice(0, 4))
  const m = Number(month.slice(5, 7))
  const annual = buildAnnualEnterpriseSettlement(bills, y)
  const annualMonth = annual.months[m - 1]
  const useSynthetic = cur.billAmount === 0 && annualMonth
  const billAmount = useSynthetic ? annualMonth.billAmount : cur.billAmount
  const serviceFee = useSynthetic ? annualMonth.serviceFee : cur.serviceFee
  const advance = useSynthetic
    ? Math.round(annualMonth.billAmount * 0.1)
    : cur.advance
  const paid = useSynthetic ? Math.round(billAmount * 0.88) : cur.paid
  const receivable = Math.max(0, billAmount - paid)

  const prevYBill = prevYear.billAmount || (buildAnnualEnterpriseSettlement(bills, y - 1).months[m - 1]?.billAmount ?? 0)
  const prevMBill =
    prevMonth.billAmount ||
    (m === 1
      ? buildAnnualEnterpriseSettlement(bills, y - 1).months[11]?.billAmount ?? 0
      : buildAnnualEnterpriseSettlement(bills, y).months[m - 2]?.billAmount ?? 0)

  return {
    month,
    label: `${y}年${m}月`,
    summary: {
      billTotal: billAmount,
      serviceFee,
      advance,
      advanceRatio: billAmount ? Math.round((advance / billAmount) * 1000) / 10 : 0,
      paid,
      receivable,
      collectionRate: billAmount ? Math.round((paid / billAmount) * 1000) / 10 : 0,
      billYoy: yoyText(billAmount, prevYBill),
      billMom: yoyText(billAmount, prevMBill),
      feeYoy: yoyText(serviceFee, prevYear.serviceFee || serviceFee * 0.9),
      feeMom: yoyText(serviceFee, prevMonth.serviceFee || serviceFee * 0.95),
    },
    enterprises: cur.enterprises.length
      ? cur.enterprises
      : [],
    synthetic: useSynthetic,
  }
}

export function listSettlementYears(
  bills: SettlementBill[],
  asOf: Date = WORKBENCH_DEMO_NOW,
): number[] {
  const set = new Set<number>()
  for (const b of bills) {
    const y = Number(b.periodStart.slice(0, 4))
    if (y) set.add(y)
  }
  const nowY = asOf.getFullYear()
  set.add(nowY)
  set.add(nowY - 1)
  set.add(nowY - 2)
  return [...set].sort((a, b) => b - a)
}

/** 企业结算：账单 = 应发 + 服务费；垫资 = 待企业回款（已垫付灵工） */
export function buildEnterpriseSettlementStats(
  bills: SettlementBill[],
  asOf: Date = WORKBENCH_DEMO_NOW,
) {
  const asOfDay = toYmd(asOf)
  const active = bills.filter((b) => b.status !== 'void')

  const billTotal = active.reduce((s, b) => s + b.totalPayable, 0)
  const payroll = active.reduce((s, b) => s + b.payrollTotal, 0)
  const serviceFee = active.reduce((s, b) => s + b.serviceFee, 0)
  const paid = active
    .filter((b) => b.status === 'paid')
    .reduce((s, b) => s + b.totalPayable, 0)
  const pendingPayBills = active.filter((b) => b.status === 'pending_payment')
  /** 待回款：企业尚未付款的账单总额 */
  const receivable = pendingPayBills.reduce((s, b) => s + b.totalPayable, 0)
  /** 垫资：平台已向灵工垫付、待企业回款的应发部分 */
  const advance = pendingPayBills.reduce((s, b) => s + b.payrollTotal, 0)
  const advanceFee = pendingPayBills.reduce((s, b) => s + b.serviceFee, 0)

  const balanced = Math.abs(billTotal - (payroll + serviceFee)) < 0.5

  const aging = [
    { key: '0-7', label: '0-7天', min: 0, max: 7, amount: 0, count: 0 },
    { key: '8-15', label: '8-15天', min: 8, max: 15, amount: 0, count: 0 },
    { key: '16-30', label: '16-30天', min: 16, max: 30, amount: 0, count: 0 },
    { key: '30+', label: '30天以上', min: 31, max: 99999, amount: 0, count: 0 },
  ]
  for (const b of pendingPayBills) {
    const anchor = (b.confirmedAt || b.pushedAt || b.periodEnd || b.createdAt).slice(0, 10)
    const age = daysBetween(anchor, asOfDay)
    const bucket = aging.find((x) => age >= x.min && age <= x.max) ?? aging[aging.length - 1]
    bucket.amount += b.totalPayable
    bucket.count += 1
  }

  const riskAmount = aging.filter((x) => x.min >= 16).reduce((s, x) => s + x.amount, 0)

  const byEnterprise = new Map<
    string,
    {
      enterpriseId: string
      enterpriseName: string
      billCount: number
      billTotal: number
      payroll: number
      serviceFee: number
      paid: number
      advance: number
      receivable: number
      maxAge: number
    }
  >()

  for (const b of active) {
    const row = byEnterprise.get(b.enterpriseId) ?? {
      enterpriseId: b.enterpriseId,
      enterpriseName: b.enterpriseName,
      billCount: 0,
      billTotal: 0,
      payroll: 0,
      serviceFee: 0,
      paid: 0,
      advance: 0,
      receivable: 0,
      maxAge: 0,
    }
    row.billCount += 1
    row.billTotal += b.totalPayable
    row.payroll += b.payrollTotal
    row.serviceFee += b.serviceFee
    if (b.status === 'paid') row.paid += b.totalPayable
    if (b.status === 'pending_payment') {
      row.receivable += b.totalPayable
      row.advance += b.payrollTotal
      const anchor = (b.confirmedAt || b.pushedAt || b.periodEnd || b.createdAt).slice(0, 10)
      row.maxAge = Math.max(row.maxAge, daysBetween(anchor, asOfDay))
    }
    byEnterprise.set(b.enterpriseId, row)
  }

  const enterpriseRows = [...byEnterprise.values()].sort((a, b) => b.billTotal - a.billTotal)

  return {
    summary: {
      billTotal,
      payroll,
      serviceFee,
      paid,
      receivable,
      advance,
      advanceFee,
      riskAmount,
      balanced,
      pendingBillCount: pendingPayBills.length,
    },
    aging,
    enterpriseRows,
    pendingPayBills,
  }
}

export interface WorkerSettlementAggRow {
  employeeId: string
  employeeName: string
  enterpriseId: string
  enterpriseName: string
  departmentName: string
  workHours: number
  payrollAmount: number
  serviceFee: number
  billCount: number
}

/** 灵工结算：平均工时 = 出勤工时 ÷ 结算人数 */
export function buildWorkerSettlementStats(input: {
  bills: SettlementBill[]
  slips?: SettlementSlip[]
  hourByEmployee?: Map<string, number>
}) {
  const workerMap = new Map<string, WorkerSettlementAggRow>()

  for (const bill of input.bills.filter((b) => b.status !== 'void')) {
    for (const line of bill.lines as SettlementBillLine[]) {
      const row = workerMap.get(line.employeeId) ?? {
        employeeId: line.employeeId,
        employeeName: line.employeeName,
        enterpriseId: bill.enterpriseId,
        enterpriseName: bill.enterpriseName,
        departmentName: line.departmentName || bill.departmentName || '—',
        workHours: 0,
        payrollAmount: 0,
        serviceFee: 0,
        billCount: 0,
      }
      row.payrollAmount += line.payrollAmount
      row.serviceFee += line.serviceFee
      row.billCount += 1
      const hours =
        line.workHours ??
        input.hourByEmployee?.get(line.employeeId) ??
        (line.attendanceDays ? line.attendanceDays * 8 : 0)
      row.workHours += hours
      workerMap.set(line.employeeId, row)
    }
  }

  /** 补充结算单中的已结灵工（无账单行时） */
  for (const slip of input.slips ?? []) {
    for (const line of slip.lines) {
      if (workerMap.has(line.employeeId)) continue
      workerMap.set(line.employeeId, {
        employeeId: line.employeeId,
        employeeName: line.employeeName,
        enterpriseId: line.enterpriseId,
        enterpriseName: line.enterpriseName,
        departmentName: line.departmentName || '—',
        workHours: input.hourByEmployee?.get(line.employeeId) ?? line.quantity,
        payrollAmount: line.amount,
        serviceFee: 0,
        billCount: 1,
      })
    }
  }

  const workers = [...workerMap.values()].sort((a, b) => b.payrollAmount - a.payrollAmount)
  const settledHeadcount = workers.length
  const totalHours = workers.reduce((s, w) => s + w.workHours, 0)
  const totalPayroll = workers.reduce((s, w) => s + w.payrollAmount, 0)
  const avgHours = settledHeadcount
    ? Math.round((totalHours / settledHeadcount) * 10) / 10
    : 0
  const avgPay = settledHeadcount
    ? Math.round((totalPayroll / settledHeadcount) * 100) / 100
    : 0
  /** 工时利用率：相对标准月工时 176h 的演示口径 */
  const stdMonthHours = 176
  const hourUtilRate = settledHeadcount
    ? Math.round((avgHours / stdMonthHours) * 1000) / 10
    : 0
  const outputPerHour = totalHours
    ? Math.round((totalPayroll / totalHours) * 100) / 100
    : 0

  const byEnterprise = new Map<
    string,
    { enterpriseName: string; headcount: number; hours: number; payroll: number }
  >()
  for (const w of workers) {
    const row = byEnterprise.get(w.enterpriseId) ?? {
      enterpriseName: w.enterpriseName,
      headcount: 0,
      hours: 0,
      payroll: 0,
    }
    row.headcount += 1
    row.hours += w.workHours
    row.payroll += w.payrollAmount
    byEnterprise.set(w.enterpriseId, row)
  }

  return {
    summary: {
      settledHeadcount,
      totalHours: Math.round(totalHours * 10) / 10,
      avgHours,
      totalPayroll,
      avgPay,
      hourUtilRate: Math.min(100, hourUtilRate),
      outputPerHour,
    },
    workers,
    enterpriseRows: [...byEnterprise.entries()]
      .map(([enterpriseId, r]) => ({
        enterpriseId,
        enterpriseName: r.enterpriseName,
        headcount: r.headcount,
        hours: Math.round(r.hours * 10) / 10,
        avgHours: r.headcount ? Math.round((r.hours / r.headcount) * 10) / 10 : 0,
        payroll: r.payroll,
        avgPay: r.headcount ? Math.round((r.payroll / r.headcount) * 100) / 100 : 0,
      }))
      .sort((a, b) => b.payroll - a.payroll),
  }
}
