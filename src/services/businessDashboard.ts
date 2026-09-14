import { WORKBENCH_DEMO_NOW } from '@/constants/workbenchReminder'
import { getDatesBetween } from '@/services/attendance'
import type {
  AttendanceException,
  Employee,
  GrabShiftApplication,
  MakeupPunchRequest,
  RecruitmentLead,
  SettlementBill,
  Task,
  WorkerJoinApplication,
} from '@/types'

export type DashboardPeriod = 'month' | '30d'

export interface DateWindow {
  start: string
  end: string
  label: string
  prevStart: string
  prevEnd: string
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function toYmd(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function addDays(base: Date, days: number) {
  const d = new Date(base)
  d.setDate(d.getDate() + days)
  return d
}

/** 以演示日为「今天」解析本月 / 近30天及环比窗口 */
export function resolveDashboardWindow(
  period: DashboardPeriod,
  now: Date = WORKBENCH_DEMO_NOW,
): DateWindow {
  const end = toYmd(now)
  if (period === 'month') {
    const start = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`
    const prevMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const prevEndDate = new Date(now.getFullYear(), now.getMonth(), 0)
    return {
      start,
      end,
      label: '本月',
      prevStart: toYmd(prevMonthDate),
      prevEnd: toYmd(prevEndDate),
    }
  }
  const startDate = addDays(now, -29)
  const prevEndDate = addDays(startDate, -1)
  const prevStartDate = addDays(prevEndDate, -29)
  return {
    start: toYmd(startDate),
    end,
    label: '近30天',
    prevStart: toYmd(prevStartDate),
    prevEnd: toYmd(prevEndDate),
  }
}

function inRange(isoDate: string | undefined, start: string, end: string) {
  if (!isoDate) return false
  const day = isoDate.slice(0, 10)
  return day >= start && day <= end
}

export function formatMomPercent(current: number, previous: number): {
  text: string
  up: boolean
  positive: boolean
} | null {
  if (previous === 0 && current === 0) return null
  if (previous === 0) {
    return { text: '新增', up: true, positive: true }
  }
  const pct = Math.round(((current - previous) / previous) * 1000) / 10
  const up = pct >= 0
  return {
    text: `${Math.abs(pct)}%`,
    up,
    positive: up,
  }
}

/** 离职环比：下降为正向 */
export function formatResignMom(current: number, previous: number) {
  const mom = formatMomPercent(current, previous)
  if (!mom) return null
  return { ...mom, positive: !mom.up }
}

export function countActiveEmployees(employees: Employee[]) {
  return employees.filter((e) => e.status === 'active').length
}

export function countHiresInRange(employees: Employee[], start: string, end: string) {
  return employees.filter((e) => e.hireDate && inRange(e.hireDate, start, end)).length
}

/** 离职：优先 resignDate；无日期则不计入口径（避免把库存离职当本期） */
export function countResignsInRange(employees: Employee[], start: string, end: string) {
  return employees.filter(
    (e) => e.status === 'resigned' && e.resignDate && inRange(e.resignDate, start, end),
  ).length
}

export function countPendingApprovals(input: {
  makeupRequests: MakeupPunchRequest[]
  grabApplications: GrabShiftApplication[]
  tasks: Task[]
  joinApplications: WorkerJoinApplication[]
  leavePending?: number
  overtimePending?: number
  swapPending?: number
}) {
  const makeup = input.makeupRequests.filter((r) => r.status === 'pending').length
  const grab = input.grabApplications.filter((a) => a.status === 'pending').length
  const tasks = input.tasks.filter((t) => t.status === 'pending').length
  const joins = input.joinApplications.filter((a) => a.status === 'pending').length
  const leave = input.leavePending ?? 0
  const overtime = input.overtimePending ?? 0
  const swap = input.swapPending ?? 0
  return {
    total: makeup + grab + tasks + joins + leave + overtime + swap,
    urgent: makeup + grab + joins,
    breakdown: { makeup, grab, tasks, joins, leave, overtime, swap },
  }
}

export function sumPendingPaymentAmount(bills: SettlementBill[], enterpriseIds?: string[]) {
  return bills
    .filter((b) => b.status === 'pending_payment')
    .filter((b) => !enterpriseIds?.length || enterpriseIds.includes(b.enterpriseId))
    .reduce((s, b) => s + b.totalPayable, 0)
}

export function listExceptionsInRange(
  exceptions: AttendanceException[],
  start: string,
  end: string,
) {
  return exceptions.filter((e) => inRange(e.date, start, end))
}

export function listOpenExceptionsOnDay(exceptions: AttendanceException[], day: string) {
  return exceptions.filter(
    (e) => e.date === day && (e.status === 'open' || e.status === 'appealed'),
  )
}

export interface DashboardAlertItem {
  id: string
  level: 'urgent' | 'important' | 'normal'
  title: string
  detail: string
  path: string
}

/** 预警条：由现有待办/异常聚合，按紧急度排序（配置化入口，非硬编码文案业务） */
export function buildDashboardAlerts(input: {
  exceptions: AttendanceException[]
  bills: SettlementBill[]
  joinApplications: WorkerJoinApplication[]
  makeupRequests: MakeupPunchRequest[]
  pathPrefix: string
  nowDay: string
}): DashboardAlertItem[] {
  const p = input.pathPrefix
  const items: DashboardAlertItem[] = []

  const openToday = listOpenExceptionsOnDay(input.exceptions, input.nowDay)
  if (openToday.length) {
    const sample = openToday[0]
    items.push({
      id: `alert_att_${sample.id}`,
      level: openToday.length >= 3 ? 'urgent' : 'important',
      title: `当日考勤异常 ${openToday.length} 条`,
      detail: sample.message || '存在待处理考勤异常',
      path: `${p}/attendance-exceptions`,
    })
  }

  const pendingPay = input.bills.filter((b) => b.status === 'pending_payment')
  if (pendingPay.length) {
    const amount = pendingPay.reduce((s, b) => s + b.totalPayable, 0)
    items.push({
      id: 'alert_bill_pay',
      level: 'urgent',
      title: `结算待付 ${pendingPay.length} 笔`,
      detail: `待付合计 ¥${amount.toLocaleString('zh-CN', { maximumFractionDigits: 0 })}`,
      path: `${p}/statistics/settlement/enterprise`,
    })
  }

  const pendingJoin = input.joinApplications.filter((a) => a.status === 'pending').length
  if (pendingJoin) {
    items.push({
      id: 'alert_join',
      level: 'important',
      title: `入驻待审 ${pendingJoin} 人`,
      detail: '存在待审批的扫码入驻申请',
      path: `${p}/employees`,
    })
  }

  const pendingMakeup = input.makeupRequests.filter((r) => r.status === 'pending').length
  if (pendingMakeup) {
    items.push({
      id: 'alert_makeup',
      level: 'normal',
      title: `补卡待审 ${pendingMakeup} 条`,
      detail: '请及时处理补卡申请',
      path: `${p}/attendance-exceptions`,
    })
  }

  const order = { urgent: 0, important: 1, normal: 2 }
  return items.sort((a, b) => order[a.level] - order[b.level])
}

export function windowDates(window: DateWindow) {
  return getDatesBetween(window.start, window.end)
}

/** 招聘漏斗：按线索状态聚合（可按创建时间窗口过滤） */
export function buildRecruitmentAnalysisFunnel(
  leads: RecruitmentLead[],
  start?: string,
  end?: string,
) {
  const scoped =
    start && end
      ? leads.filter((l) => inRange(l.createdAt, start, end) || inRange(l.updatedAt, start, end))
      : leads

  const resumeStatuses = new Set([
    'screening',
    'interview_pending',
    'interview_attended',
    'feedback_pending',
    'salary_negotiation',
    'background_check',
    'medical_check',
    'onboarding_pending',
    'onboarded',
    'qualified',
  ])
  const interviewStatuses = new Set([
    'interview_pending',
    'interview_attended',
    'feedback_pending',
    'salary_negotiation',
    'background_check',
    'medical_check',
    'onboarding_pending',
    'onboarded',
    'qualified',
  ])
  const attendedStatuses = new Set([
    'interview_attended',
    'feedback_pending',
    'salary_negotiation',
    'background_check',
    'medical_check',
    'onboarding_pending',
    'onboarded',
    'qualified',
  ])
  const offerStatuses = new Set([
    'salary_negotiation',
    'background_check',
    'medical_check',
    'onboarding_pending',
    'onboarded',
    'qualified',
  ])
  const onboardedStatuses = new Set(['onboarded', 'qualified'])

  const clue = scoped.length
  const resume = scoped.filter((l) => resumeStatuses.has(l.status)).length
  const interview = scoped.filter((l) => interviewStatuses.has(l.status)).length
  const attended = scoped.filter((l) => attendedStatuses.has(l.status)).length
  const offer = scoped.filter((l) => offerStatuses.has(l.status)).length
  const onboarded = scoped.filter((l) => onboardedStatuses.has(l.status)).length

  const rate = (n: number, d: number) => (d ? Math.round((n / d) * 1000) / 10 : null)

  return {
    stages: [
      { key: 'clue', label: '线索', count: clue },
      { key: 'resume', label: '简历', count: resume },
      { key: 'interview', label: '进面', count: interview },
      { key: 'attended', label: '到面', count: attended },
      { key: 'offer', label: 'Offer', count: offer },
      { key: 'onboarded', label: '入职', count: onboarded },
    ],
    rates: [
      { key: 'interviewRate', label: '进面率', value: rate(interview, clue), formula: '进面/线索' },
      { key: 'attendRate', label: '到面率', value: rate(attended, interview), formula: '到面/进面' },
      { key: 'offerRate', label: 'Offer率', value: rate(offer, attended), formula: 'Offer/到面' },
      { key: 'onboardRate', label: '入职率', value: rate(onboarded, offer), formula: '入职/Offer' },
    ],
    leads: scoped,
  }
}

export function retentionRate(
  employees: Employee[],
  days: 30 | 90,
  asOf: Date = WORKBENCH_DEMO_NOW,
) {
  const asOfDay = toYmd(asOf)
  const cutoff = toYmd(addDays(asOf, -days))
  const cohort = employees.filter(
    (e) => e.hireDate && e.hireDate <= cutoff && e.hireDate <= asOfDay,
  )
  if (!cohort.length) return null
  const retained = cohort.filter((e) => {
    if (e.status === 'active') return true
    if (e.status === 'resigned' && e.resignDate) return e.resignDate > asOfDay
    return e.status !== 'resigned'
  }).length
  return Math.round((retained / cohort.length) * 1000) / 10
}
