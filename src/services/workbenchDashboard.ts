import {
  WORKBENCH_DEMO_NOW,
  WORKBENCH_THRESHOLDS,
} from '@/constants/workbenchReminder'
import { recruitmentLeadStatusMap } from '@/constants/recruitment'
import {
  getDueQualifiedFollowUpDay,
  getQualifiedAt,
} from '@/services/workbenchTodos'
import type {
  AttendanceException,
  Employee,
  JobRequirement,
  RecruitmentLead,
} from '@/types'

export interface WorkbenchMetricCard {
  key: string
  label: string
  value: string | number
  trend?: { direction: 'up' | 'down'; text: string; positive?: boolean }
  subLabel?: string
  icon: 'users' | 'hire' | 'leave' | 'approval'
  tone: 'purple' | 'green' | 'red' | 'orange'
}

export interface RecruitmentProgressItem {
  id: string
  title: string
  meta: string
  progress: number
  statusLabel: string
  urgent?: boolean
  tone: 'purple' | 'orange' | 'green' | 'blue'
  path: string
}

export type RecruitmentReminderKind =
  | 'interview_today'
  | 'interview_followup'
  | 'onboard_today'
  | 'screening'
  | 'qualified_followup'

export interface RecruitmentReminderItem {
  id: string
  kind: RecruitmentReminderKind
  level: 'urgent' | 'important' | 'normal'
  title: string
  detail: string
  actionLabel: string
  path: string
  tag: string
}

export interface AttendanceAlertItem {
  id: string
  severity: 'severe' | 'warning' | 'info' | 'pending'
  severityLabel: string
  title: string
  description: string
  timeLabel: string
  path: string
}

export interface RecruitmentFunnelStage {
  label: string
  count: number
  tone: 'purple' | 'blue' | 'orange' | 'green' | 'teal'
}

export interface RecruitmentFunnelConversion {
  label: string
  formula: string
  rate: number | null
  numerator: number
  denominator: number
}

export interface RecruitmentFunnelData {
  stages: RecruitmentFunnelStage[]
  conversions: RecruitmentFunnelConversion[]
}

export interface DepartmentOpenRole {
  department: string
  count: number
}

function daysSince(iso: string, now: Date) {
  return (now.getTime() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24)
}

function formatDaysAgo(iso: string, now: Date) {
  const d = Math.max(0, Math.floor(daysSince(iso, now)))
  if (d === 0) return '今天'
  if (d === 1) return '1天前'
  return `${d}天前`
}

export function buildWorkbenchMetrics(input: {
  employees: Employee[]
  leads: RecruitmentLead[]
  pendingApprovals: number
  urgentTodoCount: number
  now?: Date
}): WorkbenchMetricCard[] {
  const now = input.now ?? WORKBENCH_DEMO_NOW
  const monthPrefix = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const newHires = input.leads.filter(
    (l) => l.status === 'onboarded' && l.updatedAt.startsWith(monthPrefix),
  ).length
  const resignations = input.leads.filter(
    (l) => l.status === 'closed' && l.updatedAt.startsWith(monthPrefix),
  ).length

  return [
    {
      key: 'employees',
      label: '在职员工总数',
      value: input.employees.length.toLocaleString(),
      trend: { direction: 'up', text: '3.2%', positive: true },
      icon: 'users',
      tone: 'purple',
    },
    {
      key: 'hires',
      label: '本月入职',
      value: newHires || 24,
      trend: { direction: 'up', text: '12.5%', positive: true },
      icon: 'hire',
      tone: 'green',
    },
    {
      key: 'leave',
      label: '本月离职',
      value: resignations || 8,
      trend: { direction: 'down', text: '5.8%', positive: true },
      icon: 'leave',
      tone: 'red',
    },
    {
      key: 'approval',
      label: '待审批',
      value: input.pendingApprovals,
      subLabel: input.urgentTodoCount ? `${input.urgentTodoCount} 项紧急` : undefined,
      icon: 'approval',
      tone: 'orange',
    },
  ]
}

export function buildRecruitmentProgressItems(input: {
  requirements: JobRequirement[]
  leads: RecruitmentLead[]
  pathPrefix?: string
  now?: Date
}): RecruitmentProgressItem[] {
  const now = input.now ?? WORKBENCH_DEMO_NOW
  const prefix = input.pathPrefix ?? ''
  const path = prefix ? `${prefix}/recruitment/progress` : '/recruitment/progress'
  const tones: RecruitmentProgressItem['tone'][] = ['purple', 'orange', 'green', 'blue']

  return input.requirements
    .filter((r) => r.status === 'recruiting')
    .slice(0, 4)
    .map((req, idx) => {
      const relatedLeads = input.leads.filter((l) => l.requirementId === req.id)
      const advanced = relatedLeads.filter((l) =>
        ['feedback_pending', 'onboarding_pending', 'onboarded'].includes(l.status),
      ).length
      const progress =
        req.headcount > 0
          ? Math.min(100, Math.round(((req.filledCount + advanced * 0.5) / req.headcount) * 100))
          : 0
      const latestLead = relatedLeads.sort(
        (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
      )[0]
      const statusLabel = latestLead
        ? recruitmentLeadStatusMap[latestLead.status]
        : '简历筛选中'

      return {
        id: req.id,
        title: req.title,
        meta: `${req.department} · ${formatDaysAgo(req.createdAt, now)}`,
        progress,
        statusLabel,
        urgent: progress < 30 && req.headcount - req.filledCount >= 3,
        tone: tones[idx % tones.length],
        path,
      }
    })
}

function formatDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/**
 * 招聘进度提醒（每日早晨）：
 * 今日入职 / 今日面试 / 面试待反馈跟进 + 待筛选 + 已达标节点跟进
 */
export function buildRecruitmentReminderItems(input: {
  leads: RecruitmentLead[]
  pathPrefix?: string
  now?: Date
}): RecruitmentReminderItem[] {
  const now = input.now ?? WORKBENCH_DEMO_NOW
  const today = formatDateKey(now)
  const prefix = input.pathPrefix ?? ''
  const basePath = prefix ? `${prefix}/recruitment/progress` : '/recruitment/progress'
  const items: RecruitmentReminderItem[] = []
  const kindRank: Record<RecruitmentReminderKind, number> = {
    onboard_today: 5,
    interview_today: 4,
    interview_followup: 3,
    screening: 2,
    qualified_followup: 1,
  }

  for (const lead of input.leads) {
    if (lead.status === 'closed' || lead.status === 'onboarded') continue
    const path = `${basePath}?lead=${encodeURIComponent(lead.id)}`

    /** 每日早晨：今日入职 */
    if (lead.status === 'onboarding_pending' && lead.onboardDate === today) {
      items.push({
        id: `onboard_today_${lead.id}`,
        kind: 'onboard_today',
        level: 'urgent',
        title: lead.candidateName,
        detail: `${lead.requirementTitle} · 今日要入职`,
        actionLabel: '办理入职',
        path,
        tag: '今日入职',
      })
      continue
    }

    /** 每日早晨：今日面试 */
    if (
      lead.interviewDate === today &&
      (lead.status === 'interview_pending' || lead.status === 'interview_attended')
    ) {
      const timeLabel = lead.interviewTime ? ` ${lead.interviewTime}` : ''
      items.push({
        id: `interview_today_${lead.id}`,
        kind: 'interview_today',
        level: 'urgent',
        title: lead.candidateName,
        detail: `${lead.requirementTitle} · 今日面试${timeLabel}`,
        actionLabel: '面试跟进',
        path,
        tag: '今日面试',
      })
      continue
    }

    /** 每日早晨：面试待反馈，需跟进 */
    if (lead.status === 'feedback_pending') {
      const interviewHint = lead.interviewDate
        ? `面试日 ${lead.interviewDate}`
        : '面试结果待反馈'
      items.push({
        id: `interview_followup_${lead.id}`,
        kind: 'interview_followup',
        level: 'important',
        title: lead.candidateName,
        detail: `${lead.requirementTitle} · ${interviewHint}，请跟进反馈`,
        actionLabel: '填写反馈',
        path,
        tag: '面试跟进',
      })
      continue
    }

    /** 待筛选 */
    if (lead.status === 'screening') {
      const daysWaiting = Math.max(0, Math.floor(daysSince(lead.createdAt, now)))
      const level: RecruitmentReminderItem['level'] =
        daysWaiting >= WORKBENCH_THRESHOLDS.screeningUrgentDays
          ? 'urgent'
          : daysWaiting >= WORKBENCH_THRESHOLDS.screeningImportantDays
            ? 'important'
            : 'normal'
      items.push({
        id: `screen_${lead.id}`,
        kind: 'screening',
        level,
        title: lead.candidateName,
        detail:
          daysWaiting === 0
            ? `${lead.requirementTitle} · 今日待筛选`
            : `${lead.requirementTitle} · 已等待 ${daysWaiting} 天`,
        actionLabel: '去筛选',
        path,
        tag: '待筛选',
      })
      continue
    }

    /** 已达标 1/3/5/10/15 天跟进 */
    if (lead.status === 'qualified') {
      const milestone = getDueQualifiedFollowUpDay(
        getQualifiedAt(lead),
        lead.lastFollowUpAt,
        now,
      )
      if (milestone == null) continue
      const level: RecruitmentReminderItem['level'] =
        milestone >= 10 ? 'urgent' : milestone >= 5 ? 'important' : 'normal'
      items.push({
        id: `qualified_d${milestone}_${lead.id}`,
        kind: 'qualified_followup',
        level,
        title: lead.candidateName,
        detail: `${lead.requirementTitle} · 已达标第 ${milestone} 天跟进`,
        actionLabel: '跟进回访',
        path,
        tag: `${milestone}天跟进`,
      })
    }
  }

  const levelRank = { urgent: 3, important: 2, normal: 1 }
  return items
    .sort((a, b) => {
      const byKind = kindRank[b.kind] - kindRank[a.kind]
      if (byKind !== 0) return byKind
      return levelRank[b.level] - levelRank[a.level]
    })
    .slice(0, 12)
}

export function buildAttendanceAlertItems(input: {
  exceptions: AttendanceException[]
  employees: Employee[]
  departments?: { id: string; name: string }[]
  pathPrefix?: string
}): AttendanceAlertItem[] {
  const prefix = input.pathPrefix ?? ''
  const alertPath = (id: string) =>
    prefix ? `${prefix}/attendance-alerts/${id}` : `/attendance-alerts/${id}`

  return input.exceptions
    .filter((e) => e.status === 'open' || e.status === 'appealed')
    .slice(0, 6)
    .map((ex) => {
      const emp = input.employees.find((e) => e.id === ex.employeeId)
      const name = emp?.name ?? ex.message.split('·')[0]?.trim() ?? '员工'
      const dept =
        input.departments?.find((d) => d.id === emp?.departmentId)?.name ?? emp?.position ?? '未分配部门'

      if (ex.type === 'missing_punch' || ex.type === 'absent') {
        return {
          id: ex.id,
          severity: 'severe' as const,
          severityLabel: ex.type === 'absent' ? '旷工' : '缺卡',
          title: `${ex.type === 'absent' ? '旷工' : '缺卡'} · 严重`,
          description: `${name} · ${dept} · ${ex.message.includes('未打卡') ? ex.message.split('·').slice(1).join('·').trim() || '今日未打卡' : '今日未打卡'}`,
          timeLabel: '09:30',
          path: alertPath(ex.id),
        }
      }
      if (ex.type === 'late') {
        return {
          id: ex.id,
          severity: 'warning' as const,
          severityLabel: '迟到',
          title: '迟到 · 警告',
          description: `${name} · ${dept} · 迟到 23 分钟`,
          timeLabel: '09:23',
          path: alertPath(ex.id),
        }
      }
      if (ex.type === 'location') {
        return {
          id: ex.id,
          severity: 'info' as const,
          severityLabel: '早退',
          title: '早退 · 提示',
          description: `${name} · ${dept} · 提前 45 分钟签退`,
          timeLabel: '昨日 17:15',
          path: alertPath(ex.id),
        }
      }
      return {
        id: ex.id,
        severity: 'pending' as const,
        severityLabel: '加班',
        title: '加班异常 · 待确认',
        description: `${name} · ${dept} · 加班时长超过 4 小时`,
        timeLabel: '待确认',
        path: alertPath(ex.id),
      }
    })
}

function calcRate(numerator: number, denominator: number): number | null {
  if (denominator <= 0) return null
  return Math.round((numerator / denominator) * 1000) / 10
}

/** 招聘漏斗：全部 → 进面 → 到面 → 待入职 → 已入职，并计算阶段转化率 */
export function buildRecruitmentFunnel(leads: RecruitmentLead[]): RecruitmentFunnelData {
  const active = leads.filter((l) => l.status !== 'closed')

  const total = active.length
  const invitedCount = active.filter((l) =>
    ['interview_pending', 'feedback_pending', 'onboarding_pending', 'onboarded', 'qualified'].includes(
      l.status,
    ),
  ).length
  const attendedCount = active.filter((l) =>
    ['feedback_pending', 'salary_negotiation', 'onboarding_pending', 'onboarded', 'qualified'].includes(l.status),
  ).length
  const offerCount = active.filter((l) =>
    ['onboarding_pending', 'onboarded', 'qualified'].includes(l.status),
  ).length
  const onboardedCount = active.filter((l) => ['onboarded', 'qualified'].includes(l.status)).length

  const stages: RecruitmentFunnelStage[] = [
    { label: '全部线索', count: total, tone: 'purple' },
    { label: '进面', count: invitedCount, tone: 'blue' },
    { label: '到面', count: attendedCount, tone: 'orange' },
    { label: '待入职', count: offerCount, tone: 'green' },
    { label: '已入职', count: onboardedCount, tone: 'teal' },
  ]

  const conversions: RecruitmentFunnelConversion[] = [
    {
      label: '进面率',
      formula: '进面数 / 全部',
      numerator: invitedCount,
      denominator: total,
      rate: calcRate(invitedCount, total),
    },
    {
      label: '到面率',
      formula: '到面数 / 进面数',
      numerator: attendedCount,
      denominator: invitedCount,
      rate: calcRate(attendedCount, invitedCount),
    },
    {
      label: 'Offer率',
      formula: '待入职 / 到面数',
      numerator: offerCount,
      denominator: attendedCount,
      rate: calcRate(offerCount, attendedCount),
    },
    {
      label: '入职率',
      formula: '入职数 / 待入职数',
      numerator: onboardedCount,
      denominator: offerCount,
      rate: calcRate(onboardedCount, offerCount),
    },
  ]

  return { stages, conversions }
}

export function buildDepartmentOpenRoles(requirements: JobRequirement[]): DepartmentOpenRole[] {
  const map = new Map<string, number>()
  for (const req of requirements.filter((r) => r.status === 'recruiting')) {
    const open = Math.max(0, req.headcount - req.filledCount)
    if (open <= 0) continue
    map.set(req.department, (map.get(req.department) ?? 0) + open)
  }
  return [...map.entries()]
    .map(([department, count]) => ({ department, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 4)
}
