import {
  buildExactInterviewTimes,
  grabInterviewWeekdayMap,
  normalizeDeptInterviewRule,
  resolveInterviewSlotsForSchedule,
  resolvePositionSchedule,
  weekdayFromDate,
} from '@/constants/grabInterview'
import { MINIAPP_DEMO_ANCHOR_DATE } from '@/constants/miniapp'
import type {
  GrabInterviewDeptPosition,
  GrabInterviewDeptRule,
  GrabInterviewScheduleRule,
  GrabInterviewTimeSlot,
} from '@/types'

type StoreLike = {
  grabInterviewConfigs: Array<{
    id: string
    enterpriseId: string
    requireInterview: boolean
    deptRules: GrabInterviewDeptRule[]
  }>
  enterprises: Array<{ id: string; name: string }>
  departments: Array<{ id: string; name: string }>
  grabInterviewRegistrations: Array<{
    enterpriseId: string
    departmentId: string
    position: string
    interviewDate: string
    interviewExactTime?: string
    timeSlotLabel: string
    employeeId?: string
    status: string
  }>
  teams: Array<{ id: string; hourlyRate?: number; departmentId?: string }>
}

export interface MiniGrabInterviewSlotPreview {
  id: string
  date: string
  dateLabel: string
  timeRange: string
  dateTimeLabel: string
  incomeLabel: string
  capacity: string
  booked: number
  remain: number
  seats: number
  disabled: boolean
  applied: boolean
  timeSlotId: string
  timeSlotLabel: string
  interviewExactTime: string
  endTime: string
  durationHours: number
  durationLabel: string
  weekday: number
}

export interface MiniGrabInterviewPost {
  id: string
  enterpriseId: string
  departmentId: string
  positionId: string
  title: string
  positionName: string
  tags: string[]
  payMin: number
  payMax: number
  payUnit: string
  payHint: string
  storeName: string
  /** 地点主文案，如「拉环咖啡 地铁口9米」 */
  locationMain: string
  /** 右侧距离，如「滨江区 13.3km」 */
  locationSide: string
  locationHint: string
  brandLetter: string
  requirementsLine: string
  profile: GrabInterviewDeptPosition['profile']
  schedule: GrabInterviewScheduleRule
  previewSlots: MiniGrabInterviewSlotPreview[]
  slotCount: number
  hasMoreSlots: boolean
}

function addDays(dateStr: string, days: number) {
  const d = new Date(`${dateStr}T12:00:00`)
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function formatMonthDay(dateStr: string, padMonth = true) {
  const [, m, d] = dateStr.split('-')
  const month = padMonth ? m : String(Number(m))
  return `${month}月${Number(d)}日`
}

function slotEndTime(start: string, seatUnitMinutes: number) {
  const [h, m] = start.split(':').map(Number)
  const total = h * 60 + m + seatUnitMinutes
  const hh = String(Math.floor(total / 60) % 24).padStart(2, '0')
  const mm = String(total % 60).padStart(2, '0')
  return `${hh}:${mm}`
}

function countBooked(
  store: StoreLike,
  params: {
    enterpriseId: string
    departmentId: string
    positionName: string
    date: string
    exactTime: string
  },
) {
  return store.grabInterviewRegistrations.filter(
    (r) =>
      r.enterpriseId === params.enterpriseId &&
      r.departmentId === params.departmentId &&
      r.position === params.positionName &&
      r.interviewDate === params.date &&
      (r.interviewExactTime === params.exactTime ||
        (!r.interviewExactTime && r.timeSlotLabel.startsWith(params.exactTime))) &&
      r.status !== 'no_show_cancelled' &&
      r.status !== 'failed',
  ).length
}

function buildSlotsForRange(
  store: StoreLike,
  opts: {
    enterpriseId: string
    departmentId: string
    positionName: string
    schedule: GrabInterviewScheduleRule
    fromDate: string
    daysAhead: number
    limit: number
    employeeId?: string
  },
): MiniGrabInterviewSlotPreview[] {
  const result: MiniGrabInterviewSlotPreview[] = []
  const unit = opts.schedule.seatUnitMinutes === 60 ? 60 : 30
  const seatsPerUnit = Math.max(1, opts.schedule.seatsPerUnit ?? 1)

  for (let i = 0; i < opts.daysAhead && result.length < opts.limit; i += 1) {
    const date = addDays(opts.fromDate, i)
    const weekday = weekdayFromDate(date)
    const windows = resolveInterviewSlotsForSchedule(opts.schedule, weekday)
    for (const win of windows) {
      const starts = buildExactInterviewTimes(win, unit)
      for (const start of starts) {
        if (result.length >= opts.limit) break
        const end = slotEndTime(start, unit)
        const booked = countBooked(store, {
          enterpriseId: opts.enterpriseId,
          departmentId: opts.departmentId,
          positionName: opts.positionName,
          date,
          exactTime: start,
        })
        const applied = opts.employeeId
          ? store.grabInterviewRegistrations.some(
              (r) =>
                r.employeeId === opts.employeeId &&
                r.enterpriseId === opts.enterpriseId &&
                r.departmentId === opts.departmentId &&
                r.position === opts.positionName &&
                r.interviewDate === date &&
                r.interviewExactTime === start &&
                r.status === 'pending',
            )
          : false
        const remain = Math.max(0, seatsPerUnit - booked)
        const full = remain <= 0
        const durationHours = Math.round((unit / 60) * 10) / 10
        const seatsLabel = `${remain}/${seatsPerUnit}`
        result.push({
          id: `${date}_${win.id}_${start}`,
          date,
          dateLabel: `${formatMonthDay(date, false)} ${grabInterviewWeekdayMap[weekday]}`,
          timeRange: `${start}~${end}`,
          dateTimeLabel: `${formatMonthDay(date)} ${grabInterviewWeekdayMap[weekday]} ${start}~${end}`,
          incomeLabel: '收入面议',
          capacity: seatsLabel,
          booked,
          remain,
          seats: seatsPerUnit,
          disabled: full || applied,
          applied,
          timeSlotId: win.id,
          timeSlotLabel: `${win.start}-${win.end}`,
          interviewExactTime: start,
          endTime: end,
          durationHours,
          durationLabel: seatsLabel,
          weekday,
        })
      }
    }
  }
  return result
}

function resolvePayRange(store: StoreLike, departmentId: string) {
  const rates = store.teams
    .filter((t) => t.departmentId === departmentId && t.hourlyRate != null)
    .map((t) => t.hourlyRate!)
  if (rates.length) {
    return { payMin: Math.min(...rates), payMax: Math.max(...rates) }
  }
  return { payMin: 20, payMax: 23 }
}

function buildRequirementLine(profile: GrabInterviewDeptPosition['profile']) {
  const parts: string[] = []
  if (profile.skills?.length) {
    const skill = profile.skills[0]
    if (skill.includes('健康')) parts.push('需要食品类健康证')
    else if (skill.includes('证')) parts.push(`需要${skill}`)
    else parts.push(`需要${skill}`)
  }
  if (profile.experience && !['不限', '无'].includes(profile.experience)) {
    parts.push(profile.experience.includes('学历') ? profile.experience : profile.experience)
  } else {
    parts.push('高中及以上')
  }
  parts.push('身高不限')
  return parts.join(' · ')
}

function buildLocationParts(storeName: string, positionId: string) {
  const districts = ['滨江区', '朝阳区', '浦东新区', '海淀区']
  const district = districts[positionId.length % districts.length]
  const km = (3 + (positionId.length % 5) + 0.3).toFixed(1)
  const metroM = 6 + (positionId.length % 12)
  return {
    locationMain: `${storeName} 地铁口${metroM}米`,
    locationSide: `${district} ${km}km`,
    locationHint: `${district} ${km}km · 地铁口${metroM}米`,
  }
}

export function listOpenGrabInterviewPosts(
  store: StoreLike,
  employeeId?: string,
  options?: { previewLimit?: number; fromDate?: string },
): MiniGrabInterviewPost[] {
  const previewLimit = options?.previewLimit ?? 2
  const fromDate = options?.fromDate ?? MINIAPP_DEMO_ANCHOR_DATE
  const posts: MiniGrabInterviewPost[] = []

  for (const cfg of store.grabInterviewConfigs) {
    if (!cfg.requireInterview) continue
    const enterprise = store.enterprises.find((e) => e.id === cfg.enterpriseId)
    const brand = enterprise?.name?.replace(/中国移动|分公司|有限公司/g, '') || '企业'

    for (const rawDept of cfg.deptRules) {
      const dept = normalizeDeptInterviewRule(rawDept)
      const deptEntity = store.departments.find((d) => d.id === dept.departmentId)
      const storeName = deptEntity?.name || brand
      const { payMin, payMax } = resolvePayRange(store, dept.departmentId)

      for (const position of dept.positions) {
        const schedule = resolvePositionSchedule(dept, position)
        const allSlots = buildSlotsForRange(store, {
          enterpriseId: cfg.enterpriseId,
          departmentId: dept.departmentId,
          positionName: position.profile.positionName,
          schedule,
          fromDate,
          daysAhead: 21,
          limit: 12,
          employeeId,
        })
        if (!allSlots.length) continue

        const title = `${brand.slice(0, 8)} | ${position.profile.positionName}【抢班直面】`
        const loc = buildLocationParts(storeName, position.id)
        posts.push({
          id: `${cfg.enterpriseId}__${dept.departmentId}__${position.id}`,
          enterpriseId: cfg.enterpriseId,
          departmentId: dept.departmentId,
          positionId: position.id,
          title,
          positionName: position.profile.positionName,
          tags: ['抢班直面', '免审核', '星级补贴', '近期发布', '专属福利'],
          payMin,
          payMax,
          payUnit: '/小时',
          payHint: '· 上岗后收入',
          storeName,
          locationMain: loc.locationMain,
          locationSide: loc.locationSide,
          locationHint: loc.locationHint,
          brandLetter: (enterprise?.name || '企').slice(0, 1),
          requirementsLine: buildRequirementLine(position.profile),
          profile: position.profile,
          schedule,
          previewSlots: allSlots.slice(0, previewLimit),
          slotCount: allSlots.length,
          hasMoreSlots: allSlots.length > previewLimit,
        })
      }
    }
  }

  return posts
}

export function findGrabInterviewPost(
  store: StoreLike,
  postId: string,
  employeeId?: string,
): MiniGrabInterviewPost | undefined {
  return listOpenGrabInterviewPosts(store, employeeId, { previewLimit: 24 }).find(
    (p) => p.id === postId,
  )
}

export function listInterviewSlotsForPost(
  store: StoreLike,
  post: MiniGrabInterviewPost,
  employeeId?: string,
  fromDate = MINIAPP_DEMO_ANCHOR_DATE,
) {
  return buildSlotsForRange(store, {
    enterpriseId: post.enterpriseId,
    departmentId: post.departmentId,
    positionName: post.positionName,
    schedule: post.schedule,
    fromDate,
    daysAhead: 21,
    limit: 24,
    employeeId,
  })
}

export function parseGrabInterviewPostId(postId: string) {
  const [enterpriseId, departmentId, positionId] = postId.split('__')
  return { enterpriseId, departmentId, positionId }
}

export type { GrabInterviewTimeSlot }
