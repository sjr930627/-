<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import EntMiniPageHeader from '@/components/enterprise-miniapp/EntMiniPageHeader.vue'
import VChart from '@/components/statistics/VChart.vue'
import { useAppStore } from '@/stores/app'
import { useEnterpriseMiniAuth } from '@/composables/useEnterpriseMiniAuth'
import {
  buildDailyAttendanceList,
  getDatesBetween,
  isDailyAttendanceVisible,
} from '@/services/attendance'
import { buildShiftDemandManageRows } from '@/services/shiftDemandPlan'
import { resolveInstanceWorkflowStatus } from '@/services/task'
import {
  dualMetricLineChartOption,
  lineChartOption,
  valueLineChartOption,
} from '@/services/statisticsCharts'
import { resolveEnterpriseIdByAttendanceGroupId } from '@/utils/enterpriseScope'
import type { AttendanceDaily, RecruitmentLeadStatus, Task, TaskInstance } from '@/types'

dayjs.extend(isoWeek)

type StatsTab = 'recruitment' | 'hours' | 'attendance' | 'schedule' | 'tasks'
type PeriodMode = 'month' | 'week' | 'day'
type HoursPeriodMode = 'day' | 'month'

const store = useAppStore()
const { enterpriseId } = useEnterpriseMiniAuth()

const topTab = ref<StatsTab>('attendance')

/** 考勤看板 */
const attendanceDate = ref('2026-07-27')
const ATTENDANCE_TARGET = 90

/** 班次看板 */
const shiftBoardDate = ref('2026-07-27')
const SHIFT_TARGET = 80

/** 招聘筛选 */
const recruitPeriod = ref<PeriodMode>('month')
const recruitAnchor = ref('2026-07-27')
const recruitJobId = ref('all')
/** 转化漏斗独立岗位筛选 */
const funnelJobId = ref('all')
/** 入职趋势：近一月按天 / 近一年按月 */
type OnboardTrendMode = 'month' | 'year'
const onboardTrendMode = ref<OnboardTrendMode>('month')
const onboardTrendAnchor = ref('2026-07-27')

/** 工时筛选 */
const hoursPeriod = ref<HoursPeriodMode>('day')
const hoursYear = ref(2026)
const hoursDayStart = ref('2026-07-21')
const hoursDayEnd = ref('2026-07-27')

watch([hoursDayStart, hoursDayEnd], () => {
  if (hoursDayEnd.value < hoursDayStart.value) {
    hoursDayEnd.value = hoursDayStart.value
  }
})

/** 任务统计筛选 */
const rangeMode = ref<'day' | 'custom'>('custom')
const dayDate = ref('2026-07-27')
const customStart = ref('2026-07-01')
const customEnd = ref('2026-07-27')
const taskBoardTaskId = ref('all')

function periodRange(mode: PeriodMode, anchor: string) {
  const base = dayjs(anchor)
  if (mode === 'day') {
    const d = base.format('YYYY-MM-DD')
    return { start: d, end: d, label: '本日' }
  }
  if (mode === 'week') {
    const start = base.startOf('isoWeek')
    const end = start.add(6, 'day')
    return {
      start: start.format('YYYY-MM-DD'),
      end: end.format('YYYY-MM-DD'),
      label: '本周',
    }
  }
  const start = base.startOf('month')
  return {
    start: start.format('YYYY-MM-DD'),
    end: start.endOf('month').format('YYYY-MM-DD'),
    label: '本月',
  }
}

function prevPeriodRange(mode: PeriodMode, anchor: string) {
  const base = dayjs(anchor)
  if (mode === 'day') {
    const d = base.subtract(1, 'day').format('YYYY-MM-DD')
    return { start: d, end: d, label: '昨日' }
  }
  if (mode === 'week') {
    const start = base.startOf('isoWeek').subtract(1, 'week')
    const end = start.add(6, 'day')
    return {
      start: start.format('YYYY-MM-DD'),
      end: end.format('YYYY-MM-DD'),
      label: '上周',
    }
  }
  const start = base.startOf('month').subtract(1, 'month')
  return {
    start: start.format('YYYY-MM-DD'),
    end: start.endOf('month').format('YYYY-MM-DD'),
    label: '上月',
  }
}

const recruitRange = computed(() => periodRange(recruitPeriod.value, recruitAnchor.value))
const recruitPrevRange = computed(() => prevPeriodRange(recruitPeriod.value, recruitAnchor.value))
const recruitPrevLabel = computed(() =>
  recruitPeriod.value === 'month' ? '上月' : recruitPeriod.value === 'week' ? '上周' : '昨日',
)
const hoursRange = computed(() => {
  if (hoursPeriod.value === 'day') {
    const start = hoursDayStart.value
    const end = hoursDayEnd.value >= hoursDayStart.value ? hoursDayEnd.value : hoursDayStart.value
    return {
      start,
      end,
      label: start === end ? start : `${dayjs(start).format('M/D')} - ${dayjs(end).format('M/D')}`,
    }
  }
  const y = hoursYear.value
  return {
    start: `${y}-01-01`,
    end: `${y}-12-31`,
    label: `${y}年`,
  }
})
const hoursPrevRange = computed(() => {
  if (hoursPeriod.value === 'day') {
    const { start, end } = hoursRange.value
    const len = dayjs(end).diff(dayjs(start), 'day')
    const prevEnd = dayjs(start).subtract(1, 'day')
    const prevStart = prevEnd.subtract(len, 'day')
    return {
      start: prevStart.format('YYYY-MM-DD'),
      end: prevEnd.format('YYYY-MM-DD'),
      label:
        prevStart.format('YYYY-MM-DD') === prevEnd.format('YYYY-MM-DD')
          ? prevStart.format('M/D')
          : `${prevStart.format('M/D')} - ${prevEnd.format('M/D')}`,
    }
  }
  const y = hoursYear.value - 1
  return {
    start: `${y}-01-01`,
    end: `${y}-12-31`,
    label: `${y}年`,
  }
})
const hoursCompareLabel = computed(() =>
  hoursPeriod.value === 'day' ? `环比上期 ${hoursPrevRange.value.label}` : `同比${hoursYear.value - 1}年`,
)

const dateRange = computed(() => {
  if (rangeMode.value === 'day') return { start: dayDate.value, end: dayDate.value }
  const start = customStart.value
  const end = customEnd.value >= customStart.value ? customEnd.value : customStart.value
  return { start, end }
})

watch(rangeMode, () => {
  if (rangeMode.value === 'custom' && customEnd.value < customStart.value) {
    customEnd.value = customStart.value
  }
})

function inRange(iso: string | undefined, start: string, end: string) {
  if (!iso) return false
  const d = iso.slice(0, 10)
  return d >= start && d <= end
}

function pct(num: number, den: number) {
  if (!den) return 0
  return Math.round((num / den) * 1000) / 10
}

function deltaPct(curr: number, prev: number) {
  if (!prev) return curr ? 100 : 0
  return Math.round(((curr - prev) / prev) * 1000) / 10
}

function daysBetween(a?: string, b?: string) {
  if (!a || !b) return null
  const d1 = dayjs(a.slice(0, 10))
  const d2 = dayjs(b.slice(0, 10))
  if (!d1.isValid() || !d2.isValid()) return null
  return Math.max(0, d2.diff(d1, 'day'))
}

const enterpriseJobs = computed(() =>
  store.jobRequirements.filter((j) => j.enterpriseId === enterpriseId.value),
)

const jobOptions = computed(() => [
  { id: 'all', title: '全部岗位' },
  ...enterpriseJobs.value.map((j) => ({ id: j.id, title: j.title })),
])

const enterpriseLeads = computed(() =>
  store.recruitmentLeads.filter((l) => l.enterpriseId === enterpriseId.value),
)

const scopedEmployees = computed(() =>
  store.employees.filter(
    (e) => e.enterpriseId === enterpriseId.value && (e.status === 'active' || e.status === 'pending'),
  ),
)

// ── 招聘漏斗阶段（对齐示意：需求发布→简历筛选→面试邀约→面试通过→已入职）──
const SCREENING: RecruitmentLeadStatus[] = ['screening']
const INVITE: RecruitmentLeadStatus[] = ['interview_pending']
const PASSED: RecruitmentLeadStatus[] = [
  'interview_attended',
  'feedback_pending',
  'salary_negotiation',
  'background_check',
  'medical_check',
  'onboarding_pending',
]
const ONBOARDED: RecruitmentLeadStatus[] = ['onboarded', 'qualified']

function stageIndex(status: RecruitmentLeadStatus): number {
  if (ONBOARDED.includes(status)) return 4
  if (PASSED.includes(status)) return 3
  if (INVITE.includes(status)) return 2
  if (SCREENING.includes(status)) return 1
  return -1
}

const recruitLeads = computed(() => {
  const { start, end } = recruitRange.value
  return enterpriseLeads.value.filter((l) => {
    if (l.status === 'closed') return false
    if (!inRange(l.createdAt, start, end)) return false
    if (recruitJobId.value !== 'all' && l.requirementId !== recruitJobId.value) return false
    return true
  })
})

const INTERVIEWING: RecruitmentLeadStatus[] = [
  'interview_pending',
  'interview_attended',
  'feedback_pending',
]
const HIRED: RecruitmentLeadStatus[] = [
  'salary_negotiation',
  'background_check',
  'medical_check',
  'onboarding_pending',
  'onboarded',
  'qualified',
]

function filterLeadsByRange(start: string, end: string) {
  return enterpriseLeads.value.filter((l) => {
    if (l.status === 'closed') return false
    if (!inRange(l.createdAt, start, end)) return false
    if (recruitJobId.value !== 'all' && l.requirementId !== recruitJobId.value) return false
    return true
  })
}

function filterJobsByRange(start: string, end: string, leads: typeof enterpriseLeads.value) {
  return enterpriseJobs.value.filter((j) => {
    if (recruitJobId.value !== 'all' && j.id !== recruitJobId.value) return false
    const created = inRange(j.createdAt, start, end)
    const hasLead = leads.some((l) => l.requirementId === j.id)
    const active = j.status === 'recruiting' || j.status === 'pending'
    return created || hasLead || active
  })
}

function calcRecruitOverview(start: string, end: string) {
  const leads = filterLeadsByRange(start, end)
  const jobs = filterJobsByRange(start, end, leads)
  const demand = jobs.reduce((s, j) => s + (j.headcount || 0), 0)
  const hired = leads.filter((l) => HIRED.includes(l.status)).length
  const interviewing = leads.filter((l) => INTERVIEWING.includes(l.status)).length
  const filled = jobs.reduce((s, j) => s + Math.min(j.filledCount || 0, j.headcount || 0), 0)
  const completion = pct(filled || hired, demand || 1)
  return { demand, hired, interviewing, completion, apply: leads.length }
}

const recruitOverview = computed(() => {
  const curr = calcRecruitOverview(recruitRange.value.start, recruitRange.value.end)
  const prev = calcRecruitOverview(recruitPrevRange.value.start, recruitPrevRange.value.end)
  return {
    ...curr,
    demandDelta: deltaPct(curr.demand, prev.demand),
    hiredDelta: deltaPct(curr.hired, prev.hired),
    interviewDelta: deltaPct(curr.interviewing, prev.interviewing),
    completionDelta: deltaPct(curr.completion, prev.completion),
  }
})

const recruitTrendChart = computed(() => {
  const { start, end } = recruitRange.value
  const dates = getDatesBetween(start, end)
  // 过长区间抽样到最多 12 个点
  const step = Math.max(1, Math.ceil(dates.length / 12))
  const sampled = dates.filter((_, i) => i % step === 0 || i === dates.length - 1)
  const labels = sampled.map((d) => dayjs(d).format('M/D'))
  const apply = sampled.map((d) =>
    enterpriseLeads.value.filter((l) => {
      if (recruitJobId.value !== 'all' && l.requirementId !== recruitJobId.value) return false
      return (l.createdAt || '').slice(0, 10) === d && l.status !== 'closed'
    }).length,
  )
  const hired = sampled.map((d) =>
    enterpriseLeads.value.filter((l) => {
      if (recruitJobId.value !== 'all' && l.requirementId !== recruitJobId.value) return false
      if (!HIRED.includes(l.status) && !ONBOARDED.includes(l.status)) return false
      const day = (l.onboardDate || l.updatedAt || l.createdAt || '').slice(0, 10)
      return day === d
    }).length,
  )
  return valueLineChartOption(
    labels,
    [
      { name: '投递', data: apply, color: '#228BFF' },
      { name: '录用', data: hired, color: '#A5B4FC' },
    ],
    '人',
  )
})

const hireRateWow = computed(() => {
  const curr = recruitOverview.value
  const prev = calcRecruitOverview(recruitPrevRange.value.start, recruitPrevRange.value.end)
  const currRate = pct(curr.hired, curr.apply || 1)
  const prevRate = pct(prev.hired, prev.apply || 1)
  return deltaPct(currRate, prevRate)
})

const FUNNEL_COLORS = [
  { bg: '#E8F3FF', fg: '#3B82F6', width: 100 },
  { bg: '#F3E8FF', fg: '#A855F7', width: 88 },
  { bg: '#FFF4E5', fg: '#F59E0B', width: 76 },
  { bg: '#E8F8EF', fg: '#22C55E', width: 64 },
  { bg: '#E8F1FF', fg: '#60A5FA', width: 52 },
]

const funnelLeads = computed(() => {
  const { start, end } = recruitRange.value
  return enterpriseLeads.value.filter((l) => {
    if (l.status === 'closed') return false
    if (!inRange(l.createdAt, start, end)) return false
    if (funnelJobId.value !== 'all' && l.requirementId !== funnelJobId.value) return false
    return true
  })
})

const funnelJobs = computed(() => {
  const { start, end } = recruitRange.value
  return enterpriseJobs.value.filter((j) => {
    if (funnelJobId.value !== 'all' && j.id !== funnelJobId.value) return false
    const created = inRange(j.createdAt, start, end)
    const hasLead = funnelLeads.value.some((l) => l.requirementId === j.id)
    return created || hasLead || (funnelJobId.value !== 'all' && j.id === funnelJobId.value)
  })
})

const funnelRows = computed(() => {
  const leads = funnelLeads.value
  const published = Math.max(
    funnelJobs.value.length,
    leads.length ? Math.ceil(leads.length * 0.9) : 0,
  )
  const screening = leads.filter((l) => stageIndex(l.status) >= 1).length || leads.length
  const invite = leads.filter((l) => stageIndex(l.status) >= 2).length
  const passed = leads.filter((l) => stageIndex(l.status) >= 3).length
  const onboarded = leads.filter((l) => stageIndex(l.status) >= 4).length

  const values = [published, screening, invite, passed, onboarded]
  const names = ['需求发布', '简历筛选', '面试邀约', '面试通过', '已入职']
  const max = Math.max(...values, 1)

  return names.map((name, i) => {
    const value = values[i]
    const prev = i === 0 ? null : values[i - 1]
    const rate = prev == null ? null : pct(value, prev)
    return {
      name,
      value,
      rate,
      bg: FUNNEL_COLORS[i].bg,
      fg: FUNNEL_COLORS[i].fg,
      widthPct: Math.max(42, Math.round((value / max) * 100)),
    }
  })
})

/** 线索投递 → 入职的天数 */
function leadApplyToOnboardDays(l: {
  status: RecruitmentLeadStatus
  createdAt: string
  onboardDate?: string
  updatedAt: string
}) {
  if (!ONBOARDED.includes(l.status)) return null
  const end = l.onboardDate || l.updatedAt
  return daysBetween(l.createdAt, end)
}

const recruitmentCore = computed(() => {
  const cycleDays = enterpriseLeads.value
    .filter((l) => {
      if (recruitJobId.value !== 'all' && l.requirementId !== recruitJobId.value) return false
      return ONBOARDED.includes(l.status)
    })
    .map(leadApplyToOnboardDays)
    .filter((d): d is number => d != null)
  const avgFillDays = cycleDays.length
    ? Math.round((cycleDays.reduce((s, d) => s + d, 0) / cycleDays.length) * 10) / 10
    : 0

  const total = recruitLeads.value.length
  const invite = recruitLeads.value.filter((l) => stageIndex(l.status) >= 2).length
  const onboarded = recruitLeads.value.filter((l) => stageIndex(l.status) >= 4).length
  return {
    avgFillDays,
    resumeConversion: pct(invite, total),
    interviewToOnboard: pct(onboarded, invite),
  }
})

/** 投递→入职周期阈值：≤5 正常，≤7 偏长，>7 过长 */
const FILL_NORMAL_MAX = 5
const FILL_WARN_MAX = 7

function fillLevel(days: number): 'good' | 'warn' | 'bad' {
  if (days <= FILL_NORMAL_MAX) return 'good'
  if (days <= FILL_WARN_MAX) return 'warn'
  return 'bad'
}

const FILL_LEVEL_LABEL: Record<'good' | 'warn' | 'bad', string> = {
  good: '正常',
  warn: '偏长',
  bad: '过长',
}

const jobCycleRows = computed(() => {
  // 按岗位聚合：线索投递到入职的平均天数
  const buckets = new Map<string, number[]>()
  for (const l of enterpriseLeads.value) {
    if (recruitJobId.value !== 'all' && l.requirementId !== recruitJobId.value) continue
    const days = leadApplyToOnboardDays(l)
    if (days == null) continue
    const name = l.requirementTitle || l.position || '未命名岗位'
    const list = buckets.get(name) ?? []
    list.push(days)
    buckets.set(name, list)
  }
  const rows = [...buckets.entries()].map(([name, list]) => {
    const days = Math.round((list.reduce((s, d) => s + d, 0) / list.length) * 10) / 10
    const level = fillLevel(days)
    return { name, days, level, label: FILL_LEVEL_LABEL[level], samples: list.length }
  })
  const maxDays = Math.max(...rows.map((r) => r.days), 1)
  return rows
    .map((r) => ({
      ...r,
      width: Math.max(12, Math.round((r.days / maxDays) * 100)),
    }))
    .sort((a, b) => a.days - b.days)
    .slice(0, 8)
})

const onboardTrendLabel = computed(() =>
  onboardTrendMode.value === 'month' ? '近一个月' : '近一年',
)

const onboardTrend = computed(() => {
  const end = dayjs(onboardTrendAnchor.value)
  const labels: string[] = []
  const counts: number[] = []

  const matchOnboard = (predicate: (day: string) => boolean) =>
    enterpriseLeads.value.filter((l) => {
      if (recruitJobId.value !== 'all' && l.requirementId !== recruitJobId.value) return false
      if (!ONBOARDED.includes(l.status)) return false
      const onboardDay = (l.onboardDate || l.updatedAt || l.createdAt || '').slice(0, 10)
      return predicate(onboardDay)
    }).length

  if (onboardTrendMode.value === 'month') {
    for (let i = 29; i >= 0; i--) {
      const d = end.subtract(i, 'day').format('YYYY-MM-DD')
      labels.push(dayjs(d).format('M/D'))
      counts.push(matchOnboard((day) => day === d))
    }
  } else {
    for (let i = 11; i >= 0; i--) {
      const m = end.subtract(i, 'month')
      const key = m.format('YYYY-MM')
      labels.push(m.format('YY/M'))
      counts.push(matchOnboard((day) => day.startsWith(key)))
    }
  }
  return { labels, counts }
})

const onboardTrendChart = computed(() =>
  valueLineChartOption(
    onboardTrend.value.labels,
    [{ name: '入职人数', data: onboardTrend.value.counts, color: '#228BFF' }],
    '人',
  ),
)

// ── 工时统计 ──
function buildDailyForRange(start: string, end: string) {
  const ids = scopedEmployees.value.map((e) => e.id)
  const dates = getDatesBetween(start, end)
  if (!ids.length || !dates.length) return []
  return buildDailyAttendanceList(
    ids,
    dates,
    store.assignments,
    store.shifts,
    store.punches,
    store.leaveRequests,
    store.attendanceRule,
    store.manualOverrides,
  ).filter(isDailyAttendanceVisible)
}

const hoursDaily = computed(() =>
  buildDailyForRange(hoursRange.value.start, hoursRange.value.end),
)
const hoursPrevDaily = computed(() =>
  buildDailyForRange(hoursPrevRange.value.start, hoursPrevRange.value.end),
)

/** 按日：自定义区间每日汇总 */
function aggregateCustomByDay(rows: ReturnType<typeof buildDailyForRange>, start: string, end: string) {
  const labels: string[] = []
  const hours: number[] = []
  const people: number[] = []
  const dates = getDatesBetween(start, end)
  for (const d of dates) {
    const dayRows = rows.filter((r) => r.date === d && r.scheduledHours > 0)
    labels.push(dayjs(d).format('MM/DD'))
    hours.push(Math.round(dayRows.reduce((s, r) => s + r.workHours, 0) * 10) / 10)
    people.push(
      new Set(dayRows.filter((r) => r.workHours > 0 || r.clockIn).map((r) => r.employeeId)).size,
    )
  }
  return { labels, hours, people }
}

/** 按月：当年 1–12 月汇总 */
function aggregateYearByMonth(rows: ReturnType<typeof buildDailyForRange>, year: number) {
  const labels: string[] = []
  const hours: number[] = []
  const people: number[] = []
  for (let m = 1; m <= 12; m++) {
    const prefix = `${year}-${String(m).padStart(2, '0')}`
    const monthRows = rows.filter((r) => r.date.startsWith(prefix) && r.scheduledHours > 0)
    labels.push(`${m}月`)
    hours.push(Math.round(monthRows.reduce((s, r) => s + r.workHours, 0) * 10) / 10)
    people.push(
      new Set(monthRows.filter((r) => r.workHours > 0 || r.clockIn).map((r) => r.employeeId)).size,
    )
  }
  return { labels, hours, people }
}

const hoursBuckets = computed(() => {
  if (hoursPeriod.value === 'day') {
    return aggregateCustomByDay(hoursDaily.value, hoursRange.value.start, hoursRange.value.end)
  }
  return aggregateYearByMonth(hoursDaily.value, hoursYear.value)
})

const hoursPrevBuckets = computed(() => {
  if (hoursPeriod.value === 'day') {
    return aggregateCustomByDay(
      hoursPrevDaily.value,
      hoursPrevRange.value.start,
      hoursPrevRange.value.end,
    )
  }
  return aggregateYearByMonth(hoursPrevDaily.value, hoursYear.value - 1)
})

const hoursSummary = computed(() => {
  const currHours = Math.round(hoursDaily.value.reduce((s, r) => s + r.workHours, 0) * 10) / 10
  const prevHours = Math.round(hoursPrevDaily.value.reduce((s, r) => s + r.workHours, 0) * 10) / 10
  const currPeople = new Set(
    hoursDaily.value.filter((r) => r.workHours > 0 || r.clockIn).map((r) => r.employeeId),
  ).size
  const prevPeople = new Set(
    hoursPrevDaily.value.filter((r) => r.workHours > 0 || r.clockIn).map((r) => r.employeeId),
  ).size
  const scheduled = hoursDaily.value.filter((r) => r.scheduledHours > 0).length
  const signedIn = hoursDaily.value.filter((r) => !!r.clockIn).length
  const signedOut = hoursDaily.value.filter((r) => !!r.clockOut).length
  return {
    currHours,
    prevHours,
    hoursDelta: deltaPct(currHours, prevHours),
    currPeople,
    prevPeople,
    peopleDelta: deltaPct(currPeople, prevPeople),
    signInRate: pct(signedIn, scheduled),
    signOutRate: pct(signedOut, scheduled),
    signedIn,
    signedOut,
  }
})

const hoursChart = computed(() => {
  const labels = hoursBuckets.value.labels
  const prevHours = labels.map((_, i) => hoursPrevBuckets.value.hours[i] ?? 0)
  const prevPeople = labels.map((_, i) => hoursPrevBuckets.value.people[i] ?? 0)
  if (hoursPeriod.value === 'day') {
    return dualMetricLineChartOption(
      labels,
      [
        { name: '本期工时', data: hoursBuckets.value.hours, color: '#228BFF', unit: '小时' },
        { name: '上期工时', data: prevHours, color: '#A5B4FC', dashed: true, unit: '小时' },
      ],
      [
        { name: '本期人数', data: hoursBuckets.value.people, color: '#F59E0B', unit: '人' },
        { name: '上期人数', data: prevPeople, color: '#FCD34D', dashed: true, unit: '人' },
      ],
    )
  }
  const y = hoursYear.value
  return dualMetricLineChartOption(
    labels,
    [
      { name: `${y}年工时`, data: hoursBuckets.value.hours, color: '#228BFF', unit: '小时' },
      { name: `${y - 1}年工时`, data: prevHours, color: '#A5B4FC', dashed: true, unit: '小时' },
    ],
    [
      { name: `${y}年人数`, data: hoursBuckets.value.people, color: '#F59E0B', unit: '人' },
      { name: `${y - 1}年人数`, data: prevPeople, color: '#FCD34D', dashed: true, unit: '人' },
    ],
  )
})

// ── 班次看板 ──
const shiftBoardRange = computed(() => {
  const end = shiftBoardDate.value
  const start = dayjs(end).subtract(6, 'day').format('YYYY-MM-DD')
  return { start, end }
})

const demandRows = computed(() =>
  buildShiftDemandManageRows({
    startDate: shiftBoardRange.value.start,
    endDate: dayjs(shiftBoardDate.value).add(1, 'day').format('YYYY-MM-DD'),
    teams: store.teams,
    departments: store.departments,
    enterprises: store.enterprises,
    attendanceGroups: store.attendanceGroups,
    holidays: store.holidays,
    plans: store.weeklyShiftDemandPlans,
    shifts: store.shifts,
    assignments: store.assignments,
    employees: store.employees,
    enterpriseIdFilter: enterpriseId.value || undefined,
    preferPublished: true,
  }),
)

const shiftTodayRows = computed(() =>
  demandRows.value.filter((r) => r.date === shiftBoardDate.value),
)

const shiftBoard = computed(() => {
  const shifts = shiftTodayRows.value.flatMap((r) =>
    r.shifts.filter((s) => s.requiredHeadcount > 0).map((s) => ({ row: r, shift: s })),
  )
  const total = shifts.length
  const full = shifts.filter((x) => x.shift.gapCount <= 0).length
  const required = shifts.reduce((s, x) => s + x.shift.requiredHeadcount, 0)
  const scheduled = shifts.reduce((s, x) => s + x.shift.scheduledCount, 0)
  const fulfillRate = pct(Math.min(scheduled, required), required || 1)
  return { total, full, fulfillRate, required, scheduled }
})

const shiftFulfillTrend = computed(() => {
  const labels: string[] = []
  const rates: number[] = []
  for (let i = 6; i >= 0; i--) {
    const d = dayjs(shiftBoardDate.value).subtract(i, 'day').format('YYYY-MM-DD')
    const dayRows = demandRows.value.filter((r) => r.date === d)
    const required = dayRows.reduce((s, r) => s + r.requiredHeadcount, 0)
    const scheduled = dayRows.reduce((s, r) => s + r.scheduledCount, 0)
    labels.push(dayjs(d).format('M/D'))
    rates.push(required ? pct(Math.min(scheduled, required), required) : 0)
  }
  return { labels, rates }
})

const shiftFulfillTrendChart = computed(() =>
  lineChartOption(
    shiftFulfillTrend.value.labels,
    [
      { name: '排班满足率', data: shiftFulfillTrend.value.rates, color: '#228BFF' },
      {
        name: `目标 ${SHIFT_TARGET}%`,
        data: shiftFulfillTrend.value.labels.map(() => SHIFT_TARGET),
        color: '#F59E0B',
        dashed: true,
      },
    ],
    100,
  ),
)

const shiftGroupRank = computed(() => {
  const buckets = new Map<string, { name: string; required: number; scheduled: number }>()
  for (const row of shiftTodayRows.value) {
    const key = row.attendanceGroupId || row.teamId
    const cur = buckets.get(key) ?? {
      name: row.attendanceGroupName || row.teamName,
      required: 0,
      scheduled: 0,
    }
    cur.required += row.requiredHeadcount
    cur.scheduled += row.scheduledCount
    buckets.set(key, cur)
  }
  return [...buckets.values()]
    .map((b) => {
      const rate = pct(Math.min(b.scheduled, b.required), b.required || 1)
      return {
        name: b.name,
        rate,
        level: (rate >= 85 ? 'good' : rate >= 75 ? 'warn' : 'bad') as 'good' | 'warn' | 'bad',
      }
    })
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 8)
})

const enterpriseGrabSlots = computed(() =>
  store.grabShiftSlots.filter((s) => {
    if (s.publishStatus && s.publishStatus !== 'published') return false
    const eid = resolveEnterpriseIdByAttendanceGroupId(
      s.attendanceGroupId,
      store.attendanceGroups,
      store.departments,
    )
    return eid === enterpriseId.value
  }),
)

const grabTodaySlots = computed(() =>
  enterpriseGrabSlots.value
    .filter((s) => s.date === shiftBoardDate.value)
    .sort((a, b) => a.startTime.localeCompare(b.startTime) || a.teamName.localeCompare(b.teamName)),
)

const grabBoard = computed(() => {
  const slots = grabTodaySlots.value
  const published = slots.length
  const full = slots.filter((s) => s.grabbedCount >= s.requiredCount).length
  const required = slots.reduce((sum, s) => sum + s.requiredCount, 0)
  const grabbed = slots.reduce((sum, s) => sum + Math.min(s.grabbedCount, s.requiredCount), 0)
  const grabRate = pct(grabbed, required || 1)
  return { published, full, required, grabbed, grabRate }
})

const grabSlotItems = computed(() =>
  grabTodaySlots.value.slice(0, 10).map((s) => ({
    id: s.id,
    teamName: s.teamName || s.departmentName || '班组',
    shiftName: s.positionName?.trim() || s.shiftName,
    timeLabel: `${s.startTime.slice(0, 5)}~${s.endTime.slice(0, 5)}`,
    grabbed: s.grabbedCount,
    required: s.requiredCount,
    rate: pct(Math.min(s.grabbedCount, s.requiredCount), s.requiredCount || 1),
    full: s.grabbedCount >= s.requiredCount,
  })),
)

const grabRateTrend = computed(() => {
  const labels: string[] = []
  const rates: number[] = []
  for (let i = 6; i >= 0; i--) {
    const d = dayjs(shiftBoardDate.value).subtract(i, 'day').format('YYYY-MM-DD')
    const daySlots = enterpriseGrabSlots.value.filter((s) => s.date === d)
    const required = daySlots.reduce((sum, s) => sum + s.requiredCount, 0)
    const grabbed = daySlots.reduce(
      (sum, s) => sum + Math.min(s.grabbedCount, s.requiredCount),
      0,
    )
    labels.push(dayjs(d).format('M/D'))
    rates.push(required ? pct(grabbed, required) : 0)
  }
  return { labels, rates }
})

const grabRateTrendChart = computed(() =>
  lineChartOption(
    grabRateTrend.value.labels,
    [{ name: '抢班率', data: grabRateTrend.value.rates, color: '#10B981' }],
    100,
  ),
)

function resolveTaskWorkflow(task: Task | undefined) {
  if (!task) return undefined
  return store.taskWorkflows.find((w) => w.id === task.workflowId)
}

function resolveInstanceWf(inst: TaskInstance) {
  const task = store.tasks.find((t) => t.id === inst.taskId)
  return resolveTaskWorkflow(task)
}

function isInstanceOverdue(inst: TaskInstance, nowIso: string) {
  if (!inst.timeoutAt) return false
  const status = resolveInstanceWorkflowStatus(inst, resolveInstanceWf(inst))
  if (status === 'cancelled') return false
  if (status === 'completed') return inst.updatedAt > inst.timeoutAt
  return nowIso > inst.timeoutAt
}

function hoursBetween(a?: string, b?: string) {
  if (!a || !b) return null
  const h = dayjs(b).diff(dayjs(a), 'hour', true)
  if (Number.isNaN(h) || h < 0) return null
  return Math.round(h * 10) / 10
}

function groupNameByEmployee(employeeId: string) {
  const gid = resolveEmployeeGroupId(employeeId)
  if (!gid) return '未分考勤组'
  return store.attendanceGroups.find((g) => g.id === gid)?.name || '未分考勤组'
}

const scopedTasks = computed(() =>
  store.tasks.filter((t) => {
    if (t.enterpriseId !== enterpriseId.value) return false
    if (t.status === 'draft' || t.status === 'rejected' || t.status === 'pending') return false
    // 任务区间与筛选期有交集，或创建于期内
    const start = (t.startTime || t.createdAt || '').slice(0, 10)
    const end = (t.endTime || t.createdAt || '').slice(0, 10)
    const { start: rs, end: re } = dateRange.value
    if (start && end && end >= rs && start <= re) return true
    return inRange(t.createdAt, rs, re)
  }),
)

const scopedInstances = computed(() =>
  store.taskInstances.filter((ti) => {
    if (ti.enterpriseId !== enterpriseId.value) return false
    const { start, end } = dateRange.value
    return inRange(ti.createdAt, start, end) || inRange(ti.updatedAt, start, end)
  }),
)

const taskBoardOptions = computed(() => [
  { id: 'all', name: '全部任务' },
  ...scopedTasks.value.map((t) => ({ id: t.id, name: t.name })),
])

const taskBoard = computed(() => {
  const tasks = scopedTasks.value
  const instances = scopedInstances.value
  const nowIso = `${dateRange.value.end}T23:59:59.000Z`

  let published = 0
  let claimed = 0
  let completed = 0
  let pendingClaim = 0

  for (const t of tasks) {
    const plan = t.unlimitedQuantity ? Math.max(t.acceptedCount, t.completedCount, 1) : (t.plannedTotal ?? 0)
    const accept = t.acceptedCount || 0
    const done = t.completedCount || 0
    published += plan || accept
    claimed += accept
    completed += done
    if (!t.unlimitedQuantity && plan > accept) pendingClaim += plan - accept
  }

  let runningQty = 0
  let completedQty = 0
  let overdueQty = 0
  const completeHours: number[] = []
  let onTimeDone = 0
  let doneInst = 0

  for (const inst of instances) {
    const qty = inst.claimQuantity || 1
    const wf = resolveInstanceWf(inst)
    const status = resolveInstanceWorkflowStatus(inst, wf)
    const overdue = isInstanceOverdue(inst, nowIso)
    if (status === 'cancelled') continue
    if (status === 'completed') {
      completedQty += qty
      doneInst += 1
      if (!overdue) onTimeDone += 1
      else overdueQty += qty
      const h = hoursBetween(inst.createdAt, inst.updatedAt)
      if (h != null) completeHours.push(h)
    } else if (overdue) {
      overdueQty += qty
    } else {
      runningQty += qty
    }
  }

  // 若实例样本不足，回落到任务汇总
  if (!instances.length) {
    runningQty = Math.max(0, claimed - completed)
    completedQty = completed
  }

  const statusTotal = Math.max(pendingClaim + runningQty + completedQty + overdueQty, 1)
  const statusRows = [
    { key: 'pending', name: '待认领', value: pendingClaim, color: '#94A3B8' },
    { key: 'running', name: '进行中', value: runningQty, color: '#228BFF' },
    { key: 'done', name: '已完成', value: completedQty, color: '#22C55E' },
    { key: 'overdue', name: '已逾期', value: overdueQty, color: '#F59E0B' },
  ].map((r) => ({
    ...r,
    pct: pct(r.value, statusTotal),
    width: Math.max(r.value ? 8 : 0, Math.round((r.value / statusTotal) * 100)),
  }))

  const avgHours = completeHours.length
    ? Math.round((completeHours.reduce((s, h) => s + h, 0) / completeHours.length) * 10) / 10
    : 0

  return {
    published,
    claimRate: pct(claimed, published || 1),
    completeRate: pct(completed, claimed || 1),
    overdueCount: overdueQty,
    statusRows,
    avgHours,
    onTimeRate: pct(onTimeDone, doneInst || 1),
  }
})

const taskClaimRank = computed(() => {
  const buckets = new Map<string, { name: string; claim: number; done: number }>()
  for (const inst of scopedInstances.value) {
    const qty = inst.claimQuantity || 1
    const row = buckets.get(inst.workerId) ?? {
      name: inst.workerName,
      claim: 0,
      done: 0,
    }
    row.claim += qty
    const status = resolveInstanceWorkflowStatus(inst, resolveInstanceWf(inst))
    if (status === 'completed') row.done += qty
    buckets.set(inst.workerId, row)
  }
  return [...buckets.values()]
    .sort((a, b) => b.claim - a.claim || b.done - a.done)
    .slice(0, 8)
    .map((r, i) => ({ ...r, rank: i + 1 }))
})

/** 按任务 × 考勤组：认领数 / 完成率 */
const taskGroupStats = computed(() => {
  const taskIds =
    taskBoardTaskId.value === 'all'
      ? scopedTasks.value.map((t) => t.id)
      : [taskBoardTaskId.value]
  const taskMap = new Map(scopedTasks.value.map((t) => [t.id, t]))

  return taskIds
    .map((tid) => {
      const task = taskMap.get(tid)
      if (!task) return null
      const insts = scopedInstances.value.filter((i) => i.taskId === tid)
      const groups = new Map<string, { name: string; claim: number; done: number }>()
      for (const inst of insts) {
        const gname = groupNameByEmployee(inst.workerId)
        const row = groups.get(gname) ?? { name: gname, claim: 0, done: 0 }
        const qty = inst.claimQuantity || 1
        row.claim += qty
        if (resolveInstanceWorkflowStatus(inst, resolveInstanceWf(inst)) === 'completed') {
          row.done += qty
        }
        groups.set(gname, row)
      }
      const rows = [...groups.values()]
        .map((g) => ({
          ...g,
          rate: pct(g.done, g.claim || 1),
        }))
        .sort((a, b) => b.claim - a.claim)

      const claimTotal = rows.length
        ? rows.reduce((s, r) => s + r.claim, 0)
        : task.acceptedCount
      const doneTotal = rows.length
        ? rows.reduce((s, r) => s + r.done, 0)
        : task.completedCount
      return {
        id: task.id,
        name: task.name,
        claimTotal,
        doneTotal,
        rate: pct(doneTotal, claimTotal || 1),
        groups: rows,
      }
    })
    .filter((x): x is NonNullable<typeof x> => Boolean(x))
})

function formatDelta(v: number) {
  if (v === 0) return '无变动'
  return `${v > 0 ? '+' : ''}${v}%`
}

function isArrived(row: AttendanceDaily) {
  return !!row.clockIn || ['normal', 'late', 'early_leave'].includes(row.status)
}

function isException(row: AttendanceDaily) {
  return ['late', 'early_leave', 'missing_punch', 'absent'].includes(row.status)
}

function resolveEmployeeGroupId(employeeId: string): string | null {
  const team = store.teams.find((t) => t.memberIds.includes(employeeId) && t.attendanceGroupId)
  if (team?.attendanceGroupId) return team.attendanceGroupId
  const emp = store.employees.find((e) => e.id === employeeId)
  if (!emp) return null
  const byDept = store.attendanceGroups.find((g) =>
    g.departmentBindings?.some((b) => b.departmentId === emp.departmentId),
  )
  return byDept?.id ?? null
}

const attendanceBoardDays = computed(() => {
  const end = attendanceDate.value
  const start = dayjs(end).subtract(6, 'day').format('YYYY-MM-DD')
  return buildDailyForRange(start, end)
})

const attendanceTodayRows = computed(() =>
  attendanceBoardDays.value.filter((r) => r.date === attendanceDate.value && r.scheduledHours > 0),
)

const attendanceBoard = computed(() => {
  const rows = attendanceTodayRows.value
  const expected = rows.length
  const actual = rows.filter(isArrived).length
  const anomalies = rows.filter(isException).length
  const rate = pct(actual, expected || 1)
  return { expected, actual, anomalies, rate }
})

const attendanceTrend = computed(() => {
  const labels: string[] = []
  const rates: number[] = []
  for (let i = 6; i >= 0; i--) {
    const d = dayjs(attendanceDate.value).subtract(i, 'day').format('YYYY-MM-DD')
    const rows = attendanceBoardDays.value.filter((r) => r.date === d && r.scheduledHours > 0)
    const expected = rows.length
    const actual = rows.filter(isArrived).length
    labels.push(dayjs(d).format('M/D'))
    rates.push(expected ? pct(actual, expected) : 0)
  }
  return { labels, rates }
})

const attendanceTrendChart = computed(() => {
  const option = lineChartOption(
    attendanceTrend.value.labels,
    [
      { name: '到岗率', data: attendanceTrend.value.rates, color: '#228BFF' },
      {
        name: `目标 ${ATTENDANCE_TARGET}%`,
        data: attendanceTrend.value.labels.map(() => ATTENDANCE_TARGET),
        color: '#F59E0B',
        dashed: true,
      },
    ],
    100,
  )
  return {
    ...option,
    legend: {
      right: 0,
      top: 0,
      icon: 'circle',
      itemWidth: 8,
      itemHeight: 8,
      textStyle: { fontSize: 11, color: '#909399' },
    },
    grid: { left: 40, right: 12, top: 36, bottom: 28 },
  }
})

const attendanceExceptions = computed(() => {
  const rows = attendanceTodayRows.value.filter(isException)
  const late = rows.filter((r) => r.status === 'late').length
  const noPunch = rows.filter((r) => r.status === 'missing_punch' || r.status === 'absent').length
  const early = rows.filter((r) => r.status === 'early_leave').length
  const total = late + noPunch + early || 1
  const items = [
    { name: '迟到', count: late, color: '#F59E0B' },
    { name: '未打卡', count: noPunch, color: '#EF4444' },
    { name: '早退', count: early, color: '#8B5CF6' },
  ]
  return {
    total: late + noPunch + early,
    items: items.map((i) => ({
      ...i,
      rate: pct(i.count, total),
      width: pct(i.count, Math.max(...items.map((x) => x.count), 1)),
    })),
  }
})

const attendanceGroupRank = computed(() => {
  const buckets = new Map<string, { name: string; expected: number; actual: number }>()
  for (const row of attendanceTodayRows.value) {
    const gid = resolveEmployeeGroupId(row.employeeId) || 'unknown'
    const gname =
      store.attendanceGroups.find((g) => g.id === gid)?.name ||
      store.teams.find((t) => t.memberIds.includes(row.employeeId))?.name ||
      '未分组'
    const cur = buckets.get(gid) ?? { name: gname, expected: 0, actual: 0 }
    cur.expected += 1
    if (isArrived(row)) cur.actual += 1
    buckets.set(gid, cur)
  }
  return [...buckets.values()]
    .map((b) => {
      const rate = pct(b.actual, b.expected || 1)
      return {
        name: b.name,
        rate,
        expected: b.expected,
        actual: b.actual,
        level: rate >= ATTENDANCE_TARGET ? 'good' : rate >= ATTENDANCE_TARGET - 5 ? 'warn' : 'bad',
      }
    })
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 8)
})

</script>

<template>
  <div class="page">
    <EntMiniPageHeader title="统计">
      <div class="tabs">
        <button type="button" :class="{ active: topTab === 'recruitment' }" @click="topTab = 'recruitment'">
          招聘统计
        </button>
        <button type="button" :class="{ active: topTab === 'hours' }" @click="topTab = 'hours'">
          工时统计
        </button>
        <button type="button" :class="{ active: topTab === 'attendance' }" @click="topTab = 'attendance'">
          考勤看板
        </button>
        <button type="button" :class="{ active: topTab === 'schedule' }" @click="topTab = 'schedule'">
          班次看板
        </button>
        <button type="button" :class="{ active: topTab === 'tasks' }" @click="topTab = 'tasks'">
          任务统计
        </button>
      </div>
    </EntMiniPageHeader>

    <div class="body">
      <!-- 招聘统计 -->
      <template v-if="topTab === 'recruitment'">
        <section class="card overview-card">
          <div class="card-title">
            <h3>招聘概览</h3>
            <div class="trend-tools">
              <button type="button" :class="{ active: recruitPeriod === 'month' }" @click="recruitPeriod = 'month'">本月</button>
              <button type="button" :class="{ active: recruitPeriod === 'week' }" @click="recruitPeriod = 'week'">本周</button>
              <button type="button" :class="{ active: recruitPeriod === 'day' }" @click="recruitPeriod = 'day'">本日</button>
            </div>
          </div>
          <div class="overview-tools">
            <input v-model="recruitAnchor" type="date">
            <select v-model="recruitJobId">
              <option v-for="j in jobOptions" :key="j.id" :value="j.id">{{ j.title }}</option>
            </select>
          </div>
          <div class="ov-kpi">
            <div class="ov-item">
              <div class="ov-top">
                <span>总需求人数</span>
                <i class="kpi-ico" />
              </div>
              <strong>{{ recruitOverview.demand }}</strong>
              <em :class="recruitOverview.demandDelta >= 0 ? 'up-pill' : 'down-pill'">
                {{ recruitOverview.demandDelta >= 0 ? '↑' : '↓' }} {{ Math.abs(recruitOverview.demandDelta) }}%
              </em>
            </div>
            <div class="ov-item">
              <div class="ov-top">
                <span>已录用人数</span>
                <i class="kpi-ico" />
              </div>
              <strong>{{ recruitOverview.hired }}</strong>
              <em :class="recruitOverview.hiredDelta >= 0 ? 'up-pill' : 'down-pill'">
                {{ recruitOverview.hiredDelta >= 0 ? '↑' : '↓' }} {{ Math.abs(recruitOverview.hiredDelta) }}%
              </em>
            </div>
            <div class="ov-item">
              <div class="ov-top">
                <span>面试中人数</span>
                <i class="kpi-ico" />
              </div>
              <strong>{{ recruitOverview.interviewing }}</strong>
              <em :class="recruitOverview.interviewDelta >= 0 ? 'up-pill' : 'down-pill'">
                {{ recruitOverview.interviewDelta >= 0 ? '↑' : '↓' }} {{ Math.abs(recruitOverview.interviewDelta) }}%
              </em>
            </div>
            <div class="ov-item">
              <div class="ov-top">
                <span>招聘完成率</span>
                <i class="kpi-ico" />
              </div>
              <strong>{{ recruitOverview.completion }}%</strong>
              <em :class="recruitOverview.completionDelta >= 0 ? 'up-pill' : 'down-pill'">
                {{ recruitOverview.completionDelta >= 0 ? '↑' : '↓' }} {{ Math.abs(recruitOverview.completionDelta) }}%
              </em>
            </div>
          </div>
        </section>

        <section class="card">
          <div class="card-title">
            <h3>招聘趋势</h3>
            <span class="period-tag">录用率较{{ recruitPrevLabel }}
              <b :class="hireRateWow >= 0 ? 'up' : 'down'">{{ hireRateWow >= 0 ? '+' : '' }}{{ hireRateWow }}%</b>
            </span>
          </div>
          <VChart :option="recruitTrendChart" height="200px" />
        </section>

        <section class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-top">
              <span>入职周期</span>
              <i class="kpi-ico ico-clock" />
            </div>
            <strong>{{ recruitmentCore.avgFillDays }}<small>天</small></strong>
            <em>投递→入职均值</em>
          </div>
          <div class="kpi-card">
            <div class="kpi-top">
              <span>简历转化</span>
              <i class="kpi-ico ico-doc" />
            </div>
            <strong>{{ recruitmentCore.resumeConversion }}%</strong>
            <em>筛选→面试</em>
          </div>
          <div class="kpi-card">
            <div class="kpi-top">
              <span>到岗转化</span>
              <i class="kpi-ico ico-user" />
            </div>
            <strong>{{ recruitmentCore.interviewToOnboard }}%</strong>
            <em>面试→入职</em>
          </div>
        </section>

        <section class="card">
          <div class="card-title">
            <h3>招聘转化漏斗</h3>
            <span class="period-tag">{{ recruitRange.label }}</span>
          </div>
          <div class="overview-tools funnel-tools">
            <select v-model="funnelJobId">
              <option v-for="j in jobOptions" :key="j.id" :value="j.id">{{ j.title }}</option>
            </select>
          </div>
          <div class="funnel">
            <div v-for="(row, idx) in funnelRows" :key="row.name" class="funnel-item">
              <div
                class="funnel-bar"
                :style="{ width: `${row.widthPct}%`, background: row.bg, color: row.fg }"
              >
                <span>{{ row.name }}</span>
                <b>{{ row.value }}</b>
              </div>
              <div v-if="idx > 0" class="funnel-rate">
                转化率 {{ row.rate ?? 0 }}%
              </div>
            </div>
          </div>
        </section>

        <section class="card">
          <div class="card-title">
            <h3>岗位招聘周期</h3>
            <span class="period-tag">投递→入职</span>
          </div>
          <div v-if="!jobCycleRows.length" class="empty-tip">暂无入职线索，无法计算周期</div>
          <div v-else class="cycle-list">
            <div v-for="row in jobCycleRows" :key="row.name" class="cycle-row">
              <span class="cycle-name">{{ row.name }}</span>
              <div class="cycle-track">
                <i :class="row.level" :style="{ width: `${row.width}%` }" />
              </div>
              <strong>{{ row.days }}天</strong>
              <span class="cycle-status" :class="row.level">
                <i class="cycle-dot" />
                {{ row.label }}
              </span>
            </div>
          </div>
        </section>

        <section class="card">
          <div class="card-title">
            <h3>入职趋势</h3>
            <div class="trend-tools">
              <button
                type="button"
                :class="{ active: onboardTrendMode === 'month' }"
                @click="onboardTrendMode = 'month'"
              >
                近一个月
              </button>
              <button
                type="button"
                :class="{ active: onboardTrendMode === 'year' }"
                @click="onboardTrendMode = 'year'"
              >
                近一年
              </button>
            </div>
          </div>
          <div class="overview-tools">
            <input v-model="onboardTrendAnchor" type="date">
            <span class="period-tag">{{ onboardTrendLabel }} · {{ onboardTrendMode === 'month' ? '按天' : '按月' }}</span>
          </div>
          <VChart :option="onboardTrendChart" height="200px" />
        </section>
      </template>

      <!-- 工时统计 -->
      <template v-else-if="topTab === 'hours'">
        <section class="kpi-grid hours">
          <div class="kpi-card">
            <div class="kpi-top">
              <span>总人数</span>
              <i class="kpi-ico ico-user" />
            </div>
            <strong>{{ hoursSummary.currPeople }}<small>人</small></strong>
            <em :class="hoursSummary.peopleDelta >= 0 ? 'up' : 'down'">
              较{{ hoursPeriod === 'day' ? '上期' : '去年' }}
              {{ formatDelta(hoursSummary.peopleDelta) }}
            </em>
          </div>
          <div class="kpi-card">
            <div class="kpi-top">
              <span>总工时</span>
              <i class="kpi-ico ico-clock" />
            </div>
            <strong>{{ hoursSummary.currHours }}<small>h</small></strong>
            <em :class="hoursSummary.hoursDelta >= 0 ? 'up' : 'down'">
              较{{ hoursPeriod === 'day' ? '上期' : '去年' }}
              {{ formatDelta(hoursSummary.hoursDelta) }}
            </em>
          </div>
          <div class="kpi-card">
            <div class="kpi-top">
              <span>已签到</span>
              <i class="kpi-ico ico-check" />
            </div>
            <strong>{{ hoursSummary.signedIn }}<small>次</small></strong>
            <em class="up">签到率 {{ hoursSummary.signInRate }}%</em>
          </div>
        </section>

        <section class="card">
          <div class="card-title">
            <h3>用工趋势</h3>
            <div class="trend-tools">
              <button type="button" :class="{ active: hoursPeriod === 'day' }" @click="hoursPeriod = 'day'">按日</button>
              <button type="button" :class="{ active: hoursPeriod === 'month' }" @click="hoursPeriod = 'month'">按月</button>
            </div>
          </div>
          <div class="trend-filter">
            <template v-if="hoursPeriod === 'month'">
              <input
                v-model.number="hoursYear"
                type="number"
                min="2020"
                max="2030"
                step="1"
              >
            </template>
            <template v-else>
              <input v-model="hoursDayStart" type="date">
              <span class="trend-sep">至</span>
              <input v-model="hoursDayEnd" type="date">
            </template>
            <span class="scope inline">{{ hoursRange.label }} · {{ hoursCompareLabel }}</span>
          </div>
          <VChart :option="hoursChart" height="260px" />
        </section>
      </template>

      <!-- 考勤看板 -->
      <template v-else-if="topTab === 'attendance'">
        <section class="card board-card">
          <div class="card-title">
            <h3>考勤看板</h3>
            <input v-model="attendanceDate" class="board-date" type="date">
          </div>

          <div class="att-kpi">
            <div class="att-kpi-item">
              <span>应到</span>
              <strong>{{ attendanceBoard.expected }}</strong>
            </div>
            <div class="att-kpi-item">
              <span>实到</span>
              <strong>{{ attendanceBoard.actual }}</strong>
            </div>
            <div class="att-kpi-item">
              <span>到岗率</span>
              <strong>{{ attendanceBoard.rate }}%</strong>
            </div>
            <div class="att-kpi-item warn">
              <span>异常</span>
              <strong>{{ attendanceBoard.anomalies }}</strong>
            </div>
          </div>

          <div class="arrive-panel">
            <div class="arrive-legend">
              <span class="leg-expected">应到 {{ attendanceBoard.expected }}人</span>
              <span class="leg-actual">实到 {{ attendanceBoard.actual }}人</span>
              <span :class="attendanceBoard.rate >= ATTENDANCE_TARGET ? 'leg-ok' : 'leg-bad'">
                到岗率 {{ attendanceBoard.rate }}%
                {{ attendanceBoard.rate >= ATTENDANCE_TARGET ? '≥90%达标' : '<90%未达标' }}
              </span>
            </div>
            <div class="arrive-track">
              <div class="arrive-expected" title="应到" />
              <div
                class="arrive-actual"
                :style="{ width: `${Math.min(attendanceBoard.rate, 100)}%` }"
                title="实到"
              />
            </div>
          </div>
        </section>

        <section class="card">
          <div class="card-title">
            <h3>近7日到岗率趋势</h3>
            <span class="period-tag">目标 {{ ATTENDANCE_TARGET }}%</span>
          </div>
          <VChart :option="attendanceTrendChart" height="200px" />
        </section>

        <section class="card">
          <div class="card-title">
            <h3>异常分布</h3>
            <span class="period-tag">共{{ attendanceExceptions.total }}人</span>
          </div>
          <div v-if="attendanceExceptions.total === 0" class="empty-tip">当日暂无考勤异常</div>
          <div v-else class="ex-list">
            <div v-for="item in attendanceExceptions.items" :key="item.name" class="ex-row">
              <span class="ex-name">{{ item.name }}</span>
              <div class="ex-track">
                <i :style="{ width: `${Math.max(item.width, item.count ? 8 : 0)}%`, background: item.color }" />
              </div>
              <span class="ex-count">{{ item.count }}人</span>
              <span class="ex-rate">{{ item.rate }}%</span>
            </div>
          </div>
        </section>

        <section class="card">
          <div class="card-title">
            <h3>考勤组到岗率排行</h3>
          </div>
          <div v-if="!attendanceGroupRank.length" class="empty-tip">暂无考勤组数据</div>
          <div v-else class="rank-list">
            <div v-for="row in attendanceGroupRank" :key="row.name" class="rank-row">
              <span class="rank-name">{{ row.name }}</span>
              <div class="rank-track">
                <i
                  :class="row.level"
                  :style="{ width: `${Math.max(row.rate, 8)}%` }"
                />
              </div>
              <strong>{{ row.rate }}%</strong>
              <span class="rank-dot" :class="row.level" />
            </div>
          </div>
        </section>
      </template>

      <!-- 班次看板：排班情况 + 抢班情况 -->
      <template v-else-if="topTab === 'schedule'">
        <section class="card board-card">
          <div class="card-title">
            <h3>排班情况</h3>
            <input v-model="shiftBoardDate" class="board-date" type="date">
          </div>
          <div class="att-kpi">
            <div class="att-kpi-item">
              <span>总班次</span>
              <strong>{{ shiftBoard.total }}</strong>
            </div>
            <div class="att-kpi-item">
              <span>已满班次</span>
              <strong>{{ shiftBoard.full }}</strong>
            </div>
            <div class="att-kpi-item">
              <span>已排/需求</span>
              <strong>{{ shiftBoard.scheduled }}/{{ shiftBoard.required }}</strong>
            </div>
            <div class="att-kpi-item">
              <span>排班满足率</span>
              <strong>{{ shiftBoard.fulfillRate }}%</strong>
            </div>
          </div>
        </section>

        <section class="card">
          <div class="card-title">
            <h3>近7日排班满足率</h3>
            <span class="period-tag">目标 {{ SHIFT_TARGET }}%</span>
          </div>
          <VChart :option="shiftFulfillTrendChart" height="200px" />
        </section>

        <section class="card">
          <div class="card-title">
            <h3>考勤组排班满足率</h3>
          </div>
          <div v-if="!shiftGroupRank.length" class="empty-tip">暂无排班数据</div>
          <div v-else class="rank-list">
            <div v-for="row in shiftGroupRank" :key="row.name" class="rank-row">
              <span class="rank-name">{{ row.name }}</span>
              <div class="rank-track">
                <i :class="row.level" :style="{ width: `${Math.max(row.rate, 8)}%` }" />
              </div>
              <strong>{{ row.rate }}%</strong>
              <span class="rank-dot" :class="row.level" />
            </div>
          </div>
        </section>

        <section class="card board-card">
          <div class="card-title">
            <h3>抢班情况</h3>
            <span class="period-tag">{{ shiftBoardDate }}</span>
          </div>
          <div class="att-kpi">
            <div class="att-kpi-item">
              <span>发布班次</span>
              <strong>{{ grabBoard.published }}</strong>
            </div>
            <div class="att-kpi-item">
              <span>已抢满</span>
              <strong>{{ grabBoard.full }}</strong>
            </div>
            <div class="att-kpi-item">
              <span>已抢/需求</span>
              <strong>{{ grabBoard.grabbed }}/{{ grabBoard.required }}</strong>
            </div>
            <div class="att-kpi-item">
              <span>抢班率</span>
              <strong>{{ grabBoard.grabRate }}%</strong>
            </div>
          </div>
        </section>

        <section class="card">
          <div class="card-title">
            <h3>当日抢班班次</h3>
          </div>
          <div v-if="!grabSlotItems.length" class="empty-tip">当日暂无已发布抢班班次</div>
          <div v-else class="grab-list">
            <div v-for="item in grabSlotItems" :key="item.id" class="grab-row">
              <div class="grab-main">
                <div class="grab-title">{{ item.teamName }} · {{ item.shiftName }}</div>
                <div class="grab-meta">{{ item.timeLabel }}</div>
              </div>
              <div class="grab-side">
                <strong :class="{ full: item.full }">{{ item.grabbed }}/{{ item.required }}</strong>
                <span>{{ item.rate }}%</span>
              </div>
            </div>
          </div>
        </section>

        <section class="card">
          <div class="card-title">
            <h3>近7日抢班率</h3>
          </div>
          <VChart :option="grabRateTrendChart" height="200px" />
        </section>
      </template>

      <!-- 任务统计 -->
      <template v-else>
        <section class="card">
          <div class="card-title">
            <h3>任务看板</h3>
            <span class="period-tag">{{ dateRange.start === dateRange.end ? dateRange.start : `${dateRange.start} ~ ${dateRange.end}` }}</span>
          </div>
          <div class="mode-row compact">
            <button type="button" :class="{ active: rangeMode === 'day' }" @click="rangeMode = 'day'">按日</button>
            <button type="button" :class="{ active: rangeMode === 'custom' }" @click="rangeMode = 'custom'">
              自定义
            </button>
          </div>
          <div v-if="rangeMode === 'day'" class="date-row">
            <input v-model="dayDate" type="date">
          </div>
          <div v-else class="date-row dual">
            <input v-model="customStart" type="date">
            <span>至</span>
            <input v-model="customEnd" type="date">
          </div>

          <div class="task-kpi">
            <div class="task-kpi-item">
              <span>发布</span>
              <strong>{{ taskBoard.published }}</strong>
            </div>
            <div class="task-kpi-item">
              <span>认领率</span>
              <strong>{{ taskBoard.claimRate }}%</strong>
            </div>
            <div class="task-kpi-item">
              <span>完成率</span>
              <strong>{{ taskBoard.completeRate }}%</strong>
            </div>
            <div class="task-kpi-item warn">
              <span>超时</span>
              <strong>{{ taskBoard.overdueCount }}</strong>
            </div>
          </div>
        </section>

        <section class="card">
          <div class="card-title">
            <h3>任务状态分布</h3>
            <span class="period-tag">平均完成 {{ taskBoard.avgHours }}h</span>
          </div>
          <div class="status-dist">
            <div class="status-bars">
              <div v-for="row in taskBoard.statusRows" :key="row.key" class="st-row">
                <span class="st-name">{{ row.name }}</span>
                <div class="st-track">
                  <i :style="{ width: `${row.width}%`, background: row.color }" />
                </div>
                <strong>{{ row.pct }}%</strong>
              </div>
            </div>
            <div class="status-side">
              <p>按时完成率 <b>{{ taskBoard.onTimeRate }}%</b></p>
              <p class="overdue-tip">
                超时任务 <b>{{ taskBoard.overdueCount }}</b> 个
              </p>
            </div>
          </div>
        </section>

        <section class="card">
          <div class="card-title">
            <h3>认领 / 完成排行</h3>
          </div>
          <div v-if="!taskClaimRank.length" class="empty-tip">暂无认领数据</div>
          <div v-else class="claim-rank">
            <div v-for="row in taskClaimRank" :key="row.rank" class="cr-row">
              <em :class="{ top: row.rank <= 3 }">{{ row.rank }}</em>
              <strong>{{ row.name }}</strong>
              <span>认领 {{ row.claim }}</span>
              <span>完成 {{ row.done }}</span>
            </div>
          </div>
        </section>

        <section class="card">
          <div class="card-title">
            <h3>按任务 · 考勤组认领</h3>
          </div>
          <div class="overview-tools">
            <select v-model="taskBoardTaskId">
              <option v-for="t in taskBoardOptions" :key="t.id" :value="t.id">{{ t.name }}</option>
            </select>
          </div>
          <div v-if="!taskGroupStats.length" class="empty-tip">所选期内暂无任务</div>
          <div v-else class="task-group-list">
            <article v-for="task in taskGroupStats" :key="task.id" class="tg-card">
              <div class="tg-head">
                <strong>{{ task.name }}</strong>
                <span>认领 {{ task.claimTotal }} · 完成率 {{ task.rate }}%</span>
              </div>
              <div v-if="!task.groups.length" class="tg-empty">暂无认领实例，无法按考勤组拆分</div>
              <div v-else class="tg-rows">
                <div v-for="g in task.groups" :key="g.name" class="tg-row">
                  <span class="tg-name">{{ g.name }}</span>
                  <span>认领 {{ g.claim }}</span>
                  <div class="tg-track">
                    <i :style="{ width: `${Math.max(g.rate, 6)}%` }" />
                  </div>
                  <strong>{{ g.rate }}%</strong>
                </div>
              </div>
            </article>
          </div>
        </section>
      </template>
    </div>
  </div>
</template>

<style scoped>
.page {
  min-height: 100%;
  background: #fff;
}
.body {
  padding: 12px 12px 28px;
}
.tabs {
  display: flex;
  gap: 14px;
  overflow-x: auto;
}
.tabs button {
  border: none;
  background: none;
  color: #6b7280;
  font-size: 14px;
  padding: 0 0 8px;
  white-space: nowrap;
  border-bottom: 2px solid transparent;
}
.tabs button.active {
  color: #228BFF;
  font-weight: 700;
  border-bottom-color: #228BFF;
}
.filter-card,
.card {
  background: #fff;
  border-radius: 14px;
  padding: 14px;
  margin-bottom: 10px;
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.04);
}
.mode-row {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}
.mode-row button {
  flex: 1;
  height: 32px;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  background: #fff;
  color: #6b7280;
  font-size: 13px;
}
.mode-row button.active {
  border-color: #228BFF;
  background: #228BFF;
  color: #fff;
  font-weight: 600;
}
.filter-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.filter-grid label {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: #9ca3af;
}
.filter-grid select,
.filter-grid input,
.date-row input {
  box-sizing: border-box;
  width: 100%;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
  color: #374151;
  background: #fff;
}
.date-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.date-row.dual input {
  flex: 1;
}
.scope {
  margin: 10px 0 0;
  font-size: 12px;
  color: #9ca3af;
  line-height: 1.4;
}
.kpi-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  margin-bottom: 10px;
}
.kpi-grid.hours {
  grid-template-columns: repeat(3, 1fr);
}
.kpi-card {
  background: #fff;
  border-radius: 12px;
  padding: 12px 10px;
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.04);
}
.kpi-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.kpi-top span {
  font-size: 12px;
  color: #9ca3af;
}
.kpi-ico {
  width: 22px;
  height: 22px;
  border-radius: 6px;
  background: #D5E9FF;
  position: relative;
}
.kpi-ico::after {
  content: '';
  position: absolute;
  inset: 6px;
  border-radius: 2px;
  background: #D5E9FF;
  opacity: 0.55;
}
.kpi-card strong {
  display: block;
  font-size: 20px;
  color: #111827;
  line-height: 1.2;
}
.kpi-card strong small {
  margin-left: 2px;
  font-size: 12px;
  font-weight: 500;
  color: #6b7280;
}
.kpi-card em {
  display: block;
  margin-top: 6px;
  font-style: normal;
  font-size: 11px;
  color: #9ca3af;
}
.kpi-card em.up {
  color: #16a34a;
}
.kpi-card em.down {
  color: #ef4444;
}
.card h3,
.card-title h3 {
  margin: 0;
  font-size: 14px;
  color: #374151;
}
.card-title {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 14px;
}
.period-tag {
  font-size: 12px;
  color: #9ca3af;
}
.funnel {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  padding: 4px 0 8px;
}
.funnel-item {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}
.funnel-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 40px;
  padding: 0 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  box-sizing: border-box;
  transition: width 0.25s ease;
}
.funnel-bar b {
  font-size: 15px;
}
.funnel-rate {
  font-size: 11px;
  color: #94a3b8;
}
.card-head {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 8px;
}
.dim-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.dim-tabs button {
  height: 28px;
  padding: 0 10px;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  background: #fff;
  color: #6b7280;
  font-size: 12px;
}
.dim-tabs button.active {
  border-color: #228BFF;
  background: #228BFF;
  color: #fff;
  font-weight: 600;
}
.metrics {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  text-align: center;
  margin-bottom: 8px;
}
.metrics.three {
  grid-template-columns: repeat(3, 1fr);
}
.metrics strong {
  display: block;
  font-size: 18px;
  color: #111827;
}
.metrics span {
  display: block;
  margin-top: 4px;
  font-size: 11px;
  color: #9ca3af;
}
.board-date {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 4px 8px;
  font-size: 12px;
  color: #6b7280;
  background: #fff;
}
.att-kpi {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-bottom: 12px;
}
.att-kpi-item {
  background: #f8fafc;
  border-radius: 10px;
  padding: 10px 6px;
  text-align: center;
}
.att-kpi-item span {
  display: block;
  font-size: 11px;
  color: #94a3b8;
}
.att-kpi-item strong {
  display: block;
  margin-top: 4px;
  font-size: 18px;
  color: #111827;
}
.att-kpi-item.warn strong {
  color: #ef4444;
}
.rate-bar-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
}
.rate-bar {
  flex: 1;
  height: 10px;
  border-radius: 999px;
  background: #D5E9FF;
  overflow: hidden;
}
.rate-bar i {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: linear-gradient(90deg, #5AA8FF, #228BFF);
}
.rate-bar-wrap em {
  font-style: normal;
  font-size: 13px;
  font-weight: 700;
  color: #228BFF;
  min-width: 48px;
  text-align: right;
}
.empty-tip {
  padding: 16px 0;
  text-align: center;
  font-size: 13px;
  color: #9ca3af;
}
.ex-list,
.rank-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.ex-row,
.rank-row {
  display: grid;
  align-items: center;
  gap: 8px;
}
.ex-row {
  grid-template-columns: 48px 1fr 36px 42px;
}
.rank-row {
  grid-template-columns: 72px 1fr 48px 12px;
}
.ex-name,
.rank-name {
  font-size: 12px;
  color: #64748b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ex-track,
.rank-track {
  height: 10px;
  border-radius: 999px;
  background: #f1f5f9;
  overflow: hidden;
}
.ex-track i,
.rank-track i {
  display: block;
  height: 100%;
  border-radius: 999px;
}
.rank-track i.good {
  background: #22c55e;
}
.rank-track i.warn {
  background: #f59e0b;
}
.rank-track i.bad {
  background: #ef4444;
}
.ex-count,
.ex-rate {
  font-size: 12px;
  color: #64748b;
  text-align: right;
}
.rank-row strong {
  font-size: 13px;
  color: #111827;
  text-align: right;
}
.rank-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
}
.rank-dot.good {
  background: #22c55e;
}
.rank-dot.warn {
  background: #f59e0b;
}
.rank-dot.bad {
  background: #ef4444;
}
.cycle-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.cycle-row {
  display: grid;
  grid-template-columns: 72px 1fr 48px 56px;
  align-items: center;
  gap: 8px;
}
.cycle-name {
  font-size: 12px;
  color: #64748b;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.cycle-track {
  height: 10px;
  border-radius: 999px;
  background: #f1f5f9;
  overflow: hidden;
}
.cycle-track i {
  display: block;
  height: 100%;
  border-radius: 999px;
}
.cycle-track i.good {
  background: #22c55e;
}
.cycle-track i.warn {
  background: #f59e0b;
}
.cycle-track i.bad {
  background: #ef4444;
}
.cycle-row strong {
  font-size: 12px;
  color: #111827;
  text-align: right;
}
.cycle-status {
  display: inline-flex;
  align-items: center;
  justify-content: flex-end;
  gap: 4px;
  font-size: 11px;
}
.cycle-status.good {
  color: #16a34a;
}
.cycle-status.warn {
  color: #d97706;
}
.cycle-status.bad {
  color: #dc2626;
}
.cycle-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: currentColor;
}

.trend-tools {
  display: flex;
  gap: 6px;
}
.trend-tools button {
  height: 28px;
  padding: 0 12px;
  border: 1px solid #e5e7eb;
  border-radius: 999px;
  background: #fff;
  color: #6b7280;
  font-size: 12px;
}
.trend-tools button.active {
  border-color: #228BFF;
  background: #228BFF;
  color: #fff;
  font-weight: 600;
}
.trend-filter {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.trend-filter input {
  width: 140px;
  box-sizing: border-box;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 6px 8px;
  font-size: 12px;
}
.scope.inline {
  margin: 0;
}
.arrive-panel {
  margin-top: 4px;
}
.arrive-legend {
  display: flex;
  flex-wrap: wrap;
  gap: 8px 12px;
  margin-bottom: 8px;
  font-size: 12px;
}
.leg-expected {
  color: #3b82f6;
}
.leg-actual {
  color: #d97706;
}
.leg-ok {
  color: #16a34a;
  font-weight: 600;
}
.leg-bad {
  color: #dc2626;
  font-weight: 600;
}
.arrive-track {
  position: relative;
  height: 14px;
  border-radius: 999px;
  overflow: hidden;
  background: #e5e7eb;
}
.arrive-expected {
  position: absolute;
  inset: 0;
  background: #3b82f6;
  opacity: 0.35;
}
.arrive-actual {
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  background: #f59e0b;
  border-radius: 999px;
}
.grab-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.grab-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid #f3f4f6;
}
.grab-row:last-child {
  border-bottom: none;
  padding-bottom: 0;
}
.grab-main {
  flex: 1;
  min-width: 0;
}
.grab-title {
  font-size: 13px;
  font-weight: 600;
  color: #374151;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.grab-meta {
  margin-top: 4px;
  font-size: 12px;
  color: #9ca3af;
}
.grab-side {
  flex-shrink: 0;
  text-align: right;
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.grab-side strong {
  font-size: 14px;
  color: #228BFF;
}
.grab-side strong.full {
  color: #10b981;
}
.grab-side span {
  font-size: 11px;
  color: #9ca3af;
}

.overview-tools {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin-bottom: 12px;
}
.overview-tools input,
.overview-tools select {
  box-sizing: border-box;
  width: 100%;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 8px 10px;
  font-size: 13px;
  color: #374151;
  background: #fff;
}
.ov-kpi {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}
.ov-item {
  background: #f8fafc;
  border-radius: 12px;
  padding: 12px;
}
.ov-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.ov-top span {
  font-size: 12px;
  color: #94a3b8;
}
.ov-item strong {
  display: block;
  font-size: 22px;
  color: #111827;
  line-height: 1.2;
}
.ov-item em {
  display: inline-block;
  margin-top: 8px;
  font-style: normal;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 999px;
}
.up-pill {
  color: #ea580c;
  background: #ffedd5;
}
.down-pill {
  color: #16a34a;
  background: #dcfce7;
}
.period-tag b.up {
  color: #ea580c;
}
.period-tag b.down {
  color: #16a34a;
}
.funnel-tools {
  margin-bottom: 10px;
}
.mode-row.compact {
  margin-bottom: 8px;
}
.task-kpi {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  margin-top: 12px;
}
.task-kpi-item {
  background: #f8fafc;
  border-radius: 12px;
  padding: 10px 8px;
  text-align: center;
}
.task-kpi-item span {
  display: block;
  font-size: 11px;
  color: #94a3b8;
  margin-bottom: 4px;
}
.task-kpi-item strong {
  font-size: 18px;
  color: #111827;
}
.task-kpi-item.warn strong {
  color: #ea580c;
}
.status-dist {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 12px;
  align-items: start;
}
.status-bars {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.st-row {
  display: grid;
  grid-template-columns: 52px 1fr 40px;
  gap: 8px;
  align-items: center;
}
.st-name {
  font-size: 12px;
  color: #64748b;
}
.st-track {
  height: 10px;
  border-radius: 999px;
  background: #f1f5f9;
  overflow: hidden;
}
.st-track i {
  display: block;
  height: 100%;
  border-radius: 999px;
}
.st-row strong {
  font-size: 12px;
  color: #111827;
  text-align: right;
}
.status-side {
  background: #f8fafc;
  border-radius: 12px;
  padding: 12px;
  font-size: 12px;
  color: #64748b;
}
.status-side p {
  margin: 0 0 8px;
}
.status-side b {
  color: #111827;
}
.overdue-tip b {
  color: #ea580c;
}
.claim-rank {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.cr-row {
  display: grid;
  grid-template-columns: 28px 1fr auto auto;
  gap: 8px;
  align-items: center;
  font-size: 13px;
  color: #4b5563;
}
.cr-row em {
  width: 22px;
  height: 22px;
  border-radius: 999px;
  background: #f1f5f9;
  color: #64748b;
  font-style: normal;
  font-size: 12px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.cr-row em.top {
  background: #228BFF;
  color: #fff;
}
.cr-row strong {
  color: #111827;
  font-size: 13px;
}
.task-group-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.tg-card {
  border: 1px solid #eef2f7;
  border-radius: 12px;
  padding: 12px;
  background: #fafbfc;
}
.tg-head {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-bottom: 10px;
}
.tg-head strong {
  font-size: 13px;
  color: #111827;
}
.tg-head span {
  font-size: 12px;
  color: #94a3b8;
}
.tg-empty {
  font-size: 12px;
  color: #9ca3af;
}
.tg-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.tg-row {
  display: grid;
  grid-template-columns: 72px 56px 1fr 42px;
  gap: 6px;
  align-items: center;
  font-size: 12px;
  color: #64748b;
}
.tg-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: #334155;
}
.tg-track {
  height: 8px;
  border-radius: 999px;
  background: #e2e8f0;
  overflow: hidden;
}
.tg-track i {
  display: block;
  height: 100%;
  border-radius: 999px;
  background: #228BFF;
}
.tg-row strong {
  text-align: right;
  color: #111827;
}
</style>
