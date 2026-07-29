import type { GrabShiftApplication, GrabShiftSlot, MiniJobApplication, JobRequirement } from '@/types'
import { MINIAPP_DEMO_ANCHOR_DATE, jobApplicationStatusMap } from '@/constants/miniapp'
import { getGrabShiftSlotExtra, getJobDetailExtra } from '@/mock/miniappDetailSeed'

export type JobApplicationPhase = 'pending' | 'interview' | 'approved' | 'rejected'

export interface JobApplicationDisplay {
  id: string
  title: string
  enterprise: string
  location: string
  status: JobApplicationPhase
  statusLabel: string
  detailHint: string
  createdAt: string
  interviewDate?: string
  interviewTime?: string
  reviewNote?: string
  salaryLabel: string
}

export type GrabShiftApplicationPhase =
  | 'pending'
  | 'approved_upcoming'
  | 'approved_today'
  | 'approved_done'
  | 'rejected'

export interface GrabShiftApplicationDisplay {
  id: string
  title: string
  postTitle: string
  date: string
  timeRange: string
  pay: number
  status: GrabShiftApplication['status']
  phase: GrabShiftApplicationPhase
  statusLabel: string
  detailHint: string
  createdAt: string
  reviewNote?: string
  reviewedAt?: string
  slotId: string
  payLabel: string
  durationHours: number
}

const grabStatusLabel: Record<string, string> = {
  pending: '待审核',
  approved: '已通过',
  rejected: '已拒绝',
}

export function formatJobHourlySalary(job: JobRequirement | undefined) {
  if (!job) return '—'
  const extra = getJobDetailExtra(job.id, {
    storeName: job.enterpriseName,
    location: job.location,
  })
  if (extra.hourlyMin === extra.hourlyMax) {
    return `时薪 ¥${extra.hourlyMin}/小时`
  }
  return `时薪 ¥${extra.hourlyMin}~${extra.hourlyMax}/小时`
}

export function formatGrabShiftDailyPay(pay: number) {
  return `日薪 ¥${pay}`
}

export function buildJobApplicationDisplay(
  app: MiniJobApplication,
  job: JobRequirement | undefined,
): JobApplicationDisplay {
  const status = app.status
  let detailHint = ''
  switch (status) {
    case 'pending':
      detailHint = '平台审核中，请耐心等待'
      break
    case 'interview':
      detailHint = app.interviewDate
        ? `请于 ${app.interviewDate} ${app.interviewTime ?? ''} 参加面试`
        : '请留意面试通知'
      break
    case 'approved':
      detailHint = '审核已通过，请等待排班或上岗通知'
      break
    case 'rejected':
      detailHint = app.reviewNote ?? '很遗憾，本次报名未通过'
      break
  }
  return {
    id: app.id,
    title: job?.title ?? '—',
    enterprise: job?.enterpriseName ?? '—',
    location: job?.location ?? '—',
    status,
    statusLabel: jobApplicationStatusMap[status],
    detailHint,
    createdAt: app.createdAt,
    interviewDate: app.interviewDate,
    interviewTime: app.interviewTime,
    reviewNote: app.reviewNote,
    salaryLabel: formatJobHourlySalary(job),
  }
}

export function buildGrabShiftApplicationDisplay(
  app: GrabShiftApplication,
  slot: GrabShiftSlot | undefined,
  today = MINIAPP_DEMO_ANCHOR_DATE,
): GrabShiftApplicationDisplay {
  const extra = slot ? getGrabShiftSlotExtra(slot.id, slot.date) : null
  const postTitle = slot?.teamName ?? '—'
  const title = slot ? `${slot.shiftName}` : '—'
  const date = slot?.date ?? '—'
  const timeRange = slot ? `${slot.startTime}-${slot.endTime}` : '—'
  const pay = extra?.pay ?? 0
  const durationHours = extra?.durationHours ?? 8
  const payLabel = formatGrabShiftDailyPay(pay)

  let phase: GrabShiftApplicationPhase = 'pending'
  let statusLabel = grabStatusLabel[app.status] ?? app.status
  let detailHint = ''

  if (app.status === 'pending') {
    detailHint = '报名审核中，通过后将写入排班'
  } else if (app.status === 'rejected') {
    detailHint = app.reviewNote ?? '审核未通过，可重新选择班次报名'
  } else if (app.status === 'approved' && slot) {
    if (slot.date > today) {
      phase = 'approved_upcoming'
      statusLabel = '即将打卡上班'
      detailHint = `${extra?.dateLabel ?? date} ${timeRange}，请提前到达站点`
    } else if (slot.date === today) {
      phase = 'approved_today'
      statusLabel = '今日上班'
      detailHint = `今日 ${timeRange}，请按时打卡`
    } else {
      phase = 'approved_done'
      statusLabel = '已完成'
      detailHint = '该班次已结束'
    }
    if (app.reviewNote === '白名单免审批') {
      detailHint = `${detailHint}（白名单免审）`
    }
  }

  return {
    id: app.id,
    title,
    postTitle,
    date,
    timeRange,
    pay,
    status: app.status,
    phase,
    statusLabel,
    detailHint,
    createdAt: app.createdAt,
    reviewNote: app.reviewNote,
    reviewedAt: app.reviewedAt,
    slotId: app.slotId,
    payLabel,
    durationHours,
  }
}

export function jobStatusTagClass(status: JobApplicationPhase) {
  if (status === 'approved') return 'green'
  if (status === 'rejected') return 'red'
  if (status === 'interview') return 'blue'
  return 'orange'
}

export function grabStatusTagClass(phase: GrabShiftApplicationPhase, status: string) {
  if (status === 'rejected') return 'red'
  if (status === 'pending') return 'orange'
  if (phase === 'approved_upcoming' || phase === 'approved_today') return 'green'
  return 'blue'
}
