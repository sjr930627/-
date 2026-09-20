import {
  WORKBENCH_DEMO_NOW,
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
  /** 左下角小字 */
  compareLabel?: string
  /** 右下角小字（如紧急数量） */
  subLabel?: string
  /** 额外脚注（如完成率） */
  footExtra?: string
  icon: 'todo' | 'today' | 'message' | 'users' | 'hire' | 'leave' | 'approval'
  tone: 'purple' | 'green' | 'red' | 'orange' | 'blue' | 'teal'
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
  | 'pipeline'

/** 招聘进度提醒 Tab 分类 */
export type RecruitmentReminderCategory = 'urgent' | 'remind' | 'watch'

export interface RecruitmentReminderItem {
  id: string
  kind: RecruitmentReminderKind
  level: 'urgent' | 'important' | 'normal'
  /** Tab：紧急 / 提醒 / 关注 */
  category: RecruitmentReminderCategory
  title: string
  /** 主文案，如「今天入职，请跟进」 */
  alert: string
  /** 主文案颜色：info=蓝，danger=红 */
  alertTone: 'info' | 'danger'
  detail: string
  enterpriseName: string
  requirementTitle: string
  actionLabel: string
  path: string
  tag: string
  /** 标签色调 */
  tagTone: 'green' | 'blue' | 'orange' | 'purple' | 'teal' | 'gray'
  stalledDays: number
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
  /** 当前未办结待办 */
  todos: Array<{ level: string; isToday: boolean }>
  /** 今日新增且已办结条数（不含历史存量） */
  todayCompletedCount: number
  /** 今日新增且已办结中的紧急条数 */
  todayCompletedUrgentCount?: number
  unreadMessageCount: number
}): WorkbenchMetricCard[] {
  const total = input.todos.length
  const urgentOpen = input.todos.filter((t) => t.level === 'urgent').length

  const todayOpen = input.todos.filter((t) => t.isToday)
  const todayOpenUrgent = todayOpen.filter((t) => t.level === 'urgent').length
  const todayCompleted = Math.max(0, input.todayCompletedCount)
  const todayCompletedUrgent = Math.max(0, input.todayCompletedUrgentCount ?? 0)
  const todayTotal = todayOpen.length + todayCompleted
  const todayUrgent = todayOpenUrgent + todayCompletedUrgent
  const completionRate =
    todayTotal > 0 ? Math.round((todayCompleted / todayTotal) * 100) : null

  return [
    {
      key: 'todo_total',
      label: '待办总数',
      value: total,
      subLabel: `紧急 ${urgentOpen}`,
      icon: 'todo',
      tone: 'orange',
    },
    {
      key: 'todo_today',
      label: '今日新增待办',
      value: todayTotal,
      subLabel: `紧急 ${todayUrgent}`,
      footExtra:
        completionRate == null ? '今日待办完成率 —' : `今日待办完成率 ${completionRate}%`,
      icon: 'today',
      tone: 'blue',
    },
    {
      key: 'unread_messages',
      label: '未读消息',
      value: input.unreadMessageCount,
      icon: 'message',
      tone: 'teal',
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
 * 今日入职 / 今日面试 / 面试待反馈跟进 + 待筛选 + 流程中状态 + 已达标节点跟进
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

  const statusTagTone: Partial<
    Record<RecruitmentLead['status'], RecruitmentReminderItem['tagTone']>
  > = {
    onboarding_pending: 'green',
    interview_pending: 'blue',
    interview_attended: 'blue',
    feedback_pending: 'orange',
    salary_negotiation: 'orange',
    medical_check: 'teal',
    background_check: 'purple',
    screening: 'gray',
    qualified: 'blue',
  }

  function pushItem(partial: Omit<RecruitmentReminderItem, 'detail'> & { detail?: string }) {
    items.push({
      ...partial,
      detail:
        partial.detail ??
        `${partial.enterpriseName} · ${partial.requirementTitle}`,
    })
  }

  function resolveStallAlert(stalledDays: number, fallback: string): {
    alert: string
    alertTone: 'info' | 'danger'
    category: RecruitmentReminderCategory
    level: RecruitmentReminderItem['level']
  } {
    if (stalledDays >= 45) {
      return {
        alert: `已滞留 ${stalledDays} 天，严重滞后`,
        alertTone: 'danger',
        category: 'urgent',
        level: 'urgent',
      }
    }
    if (stalledDays >= 7) {
      return {
        alert: `已滞留 ${stalledDays} 天仍未推进，请跟进`,
        alertTone: 'danger',
        category: 'urgent',
        level: 'urgent',
      }
    }
    return {
      alert: fallback,
      alertTone: 'info',
      category: 'remind',
      level: stalledDays >= 3 ? 'important' : 'normal',
    }
  }

  for (const lead of input.leads) {
    if (lead.status === 'closed' || lead.status === 'onboarded') continue
    const path = `${basePath}?lead=${encodeURIComponent(lead.id)}`
    const enterpriseName = lead.enterpriseName
    const requirementTitle = lead.requirementTitle
    const stalledDays = Math.max(0, Math.floor(daysSince(lead.updatedAt, now)))
    const tag = recruitmentStatusLabel(lead.status)
    const tagTone = statusTagTone[lead.status] ?? 'gray'

    if (lead.status === 'onboarding_pending' && lead.onboardDate === today) {
      pushItem({
        id: `onboard_today_${lead.id}`,
        kind: 'onboard_today',
        level: 'urgent',
        category: 'remind',
        title: lead.candidateName,
        alert: '今天入职，请跟进',
        alertTone: 'info',
        enterpriseName,
        requirementTitle,
        actionLabel: '办理入职',
        path,
        tag: '待入职',
        tagTone: 'green',
        stalledDays,
      })
      continue
    }

    if (
      lead.interviewDate === today &&
      (lead.status === 'interview_pending' || lead.status === 'interview_attended')
    ) {
      const timeLabel = lead.interviewTime ? ` ${lead.interviewTime}` : ''
      pushItem({
        id: `interview_today_${lead.id}`,
        kind: 'interview_today',
        level: 'urgent',
        category: 'remind',
        title: lead.candidateName,
        alert: `今天面试${timeLabel}，请跟进`,
        alertTone: 'info',
        enterpriseName,
        requirementTitle,
        actionLabel: '面试跟进',
        path,
        tag: '待面试',
        tagTone: 'blue',
        stalledDays,
      })
      continue
    }

    if (lead.status === 'feedback_pending') {
      const stall = resolveStallAlert(stalledDays, '面试待反馈，请跟进')
      pushItem({
        id: `interview_followup_${lead.id}`,
        kind: 'interview_followup',
        level: stall.level,
        category: stall.category,
        title: lead.candidateName,
        alert: stall.alert,
        alertTone: stall.alertTone,
        enterpriseName,
        requirementTitle,
        actionLabel: '填写反馈',
        path,
        tag: '面试待反馈',
        tagTone: 'orange',
        stalledDays,
      })
      continue
    }

    if (lead.status === 'screening') {
      const stall = resolveStallAlert(
        stalledDays,
        stalledDays === 0 ? '今日待筛选，请跟进' : `待筛选已等待 ${stalledDays} 天，请跟进`,
      )
      pushItem({
        id: `screen_${lead.id}`,
        kind: 'screening',
        level: stall.level,
        category: stall.category,
        title: lead.candidateName,
        alert: stall.alert,
        alertTone: stall.alertTone,
        enterpriseName,
        requirementTitle,
        actionLabel: '去筛选',
        path,
        tag: '待筛选',
        tagTone: 'gray',
        stalledDays,
      })
      continue
    }

    if (lead.status === 'qualified') {
      const milestone = getDueQualifiedFollowUpDay(
        getQualifiedAt(lead),
        lead.lastFollowUpAt,
        now,
      )
      if (milestone == null) continue
      const level: RecruitmentReminderItem['level'] =
        milestone >= 10 ? 'urgent' : milestone >= 5 ? 'important' : 'normal'
      pushItem({
        id: `qualified_d${milestone}_${lead.id}`,
        kind: 'qualified_followup',
        level,
        category: milestone >= 10 ? 'urgent' : 'watch',
        title: lead.candidateName,
        alert:
          milestone >= 10
            ? `已达标第 ${milestone} 天，请重点关注`
            : `已达标第 ${milestone} 天跟进提醒`,
        alertTone: milestone >= 10 ? 'danger' : 'info',
        enterpriseName,
        requirementTitle,
        actionLabel: '跟进回访',
        path,
        tag: `${milestone}天跟进`,
        tagTone: 'blue',
        stalledDays,
      })
      continue
    }

    /** 流程中其它状态：待入职 / 待面试 / 谈薪 / 背调 / 体检 等 */
    const pipelineStatuses: RecruitmentLead['status'][] = [
      'onboarding_pending',
      'interview_pending',
      'interview_attended',
      'salary_negotiation',
      'background_check',
      'medical_check',
    ]
    if (pipelineStatuses.includes(lead.status)) {
      const fallback =
        lead.status === 'onboarding_pending'
          ? lead.onboardDate
            ? `计划 ${lead.onboardDate} 入职，请跟进`
            : '待入职，请跟进'
          : lead.status === 'interview_pending' || lead.status === 'interview_attended'
            ? '待面试，请跟进'
            : `${tag}，请跟进`
      const stall = resolveStallAlert(stalledDays, fallback)
      const category: RecruitmentReminderCategory =
        stall.category === 'urgent'
          ? 'urgent'
          : lead.status === 'salary_negotiation' ||
              lead.status === 'background_check' ||
              lead.status === 'medical_check'
            ? 'watch'
            : stall.category
      pushItem({
        id: `pipeline_${lead.id}`,
        kind: 'pipeline',
        level: stall.level,
        category,
        title: lead.candidateName,
        alert: stall.alert,
        alertTone: stall.alertTone,
        enterpriseName,
        requirementTitle,
        actionLabel: '去跟进',
        path,
        tag,
        tagTone,
        stalledDays,
      })
    }
  }

  const levelRank = { urgent: 3, important: 2, normal: 1 }
  const categoryRank = { urgent: 3, remind: 2, watch: 1 }
  const fromLeads = items.sort((a, b) => {
    const byCat = categoryRank[b.category] - categoryRank[a.category]
    if (byCat !== 0) return byCat
    return levelRank[b.level] - levelRank[a.level]
  })

  return padRecruitmentReminderDemo(fromLeads, basePath)
}

function recruitmentStatusLabel(status: RecruitmentLead['status']): string {
  return recruitmentLeadStatusMap[status] ?? '跟进中'
}

/** 演示补齐到约 114 条，便于分页与 Tab 计数展示 */
function padRecruitmentReminderDemo(
  items: RecruitmentReminderItem[],
  basePath: string,
): RecruitmentReminderItem[] {
  const target = 114
  if (items.length >= target) return items.slice(0, target)

  const names = [
    '张伟', '李娜', '王强', '赵敏', '刘洋', '陈静', '杨帆', '黄蕾', '周杰', '吴倩',
    '徐浩', '孙悦', '马超', '朱琳', '胡军', '郭婷', '何鹏', '高雪', '林峰', '罗倩',
  ]
  const enterprises = [
    '中国移动北京朝阳分公司',
    '中国移动北京海淀分公司',
    '中国移动北京西城分公司',
    '中国石化销售华北分公司',
  ]
  const jobs = [
    '移动营业厅店员',
    '终端促销员',
    '号卡销售专员',
    '客户服务专员',
    '厅店储备主管',
  ]
  const templates: Array<{
    tag: string
    tagTone: RecruitmentReminderItem['tagTone']
    category: RecruitmentReminderCategory
    alert: (i: number) => string
    alertTone: 'info' | 'danger'
  }> = [
    ...Array.from({ length: 8 }, () => ({
      tag: '面试待反馈',
      tagTone: 'orange' as const,
      category: 'urgent' as const,
      alert: (i: number) => `已滞留 ${40 + (i % 20)} 天仍未推进，请跟进`,
      alertTone: 'danger' as const,
    })),
    ...Array.from({ length: 6 }, () => ({
      tag: '谈薪中',
      tagTone: 'orange' as const,
      category: 'urgent' as const,
      alert: (i: number) => `已滞留 ${35 + (i % 25)} 天，严重滞后`,
      alertTone: 'danger' as const,
    })),
    {
      tag: '待入职',
      tagTone: 'green',
      category: 'remind',
      alert: () => '今天入职，请跟进',
      alertTone: 'info',
    },
    {
      tag: '待面试',
      tagTone: 'blue',
      category: 'remind',
      alert: () => '今天面试，请跟进',
      alertTone: 'info',
    },
    {
      tag: '体检中',
      tagTone: 'teal',
      category: 'watch',
      alert: () => '体检进行中，请关注结果',
      alertTone: 'info',
    },
    {
      tag: '背调中',
      tagTone: 'purple',
      category: 'watch',
      alert: () => '背调进行中，请关注进度',
      alertTone: 'info',
    },
  ]

  const padded = [...items]
  let i = 0
  while (padded.length < target) {
    const tpl = templates[i % templates.length]
    const name = names[i % names.length]
    const enterpriseName = enterprises[i % enterprises.length]
    const requirementTitle = jobs[i % jobs.length]
    const stalledDays = tpl.alertTone === 'danger' ? 40 + (i % 20) : i % 5
    padded.push({
      id: `demo_recruit_${i}`,
      kind: 'pipeline',
      level: tpl.category === 'urgent' ? 'urgent' : tpl.category === 'remind' ? 'important' : 'normal',
      category: tpl.category,
      title: `${name}${i >= names.length ? i : ''}`,
      alert: tpl.alert(i),
      alertTone: tpl.alertTone,
      detail: `${enterpriseName} · ${requirementTitle}`,
      enterpriseName,
      requirementTitle,
      actionLabel: '去跟进',
      path: basePath,
      tag: tpl.tag,
      tagTone: tpl.tagTone,
      stalledDays,
    })
    i++
  }
  return padded
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
