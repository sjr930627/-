import type {
  GrabInterviewRegistration,
  GrabInterviewRegStatus,
  GrabShiftApplication,
  GrabShiftSlot,
  MiniJobApplication,
  JobRequirement,
  Department,
  Enterprise,
  AttendanceGroup,
} from '@/types'
import { MINIAPP_DEMO_ANCHOR_DATE, jobApplicationStatusMap } from '@/constants/miniapp'
import { grabInterviewRegStatusMap, grabInterviewWeekdayMap } from '@/constants/grabInterview'
import { getGrabShiftSlotExtra, getJobDetailExtra } from '@/mock/miniappDetailSeed'
import { resolveEnterpriseIdByAttendanceGroupId } from '@/utils/enterpriseScope'

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
  positionName: string
  orgLabel: string
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

export interface GrabInterviewApplicationDisplay {
  id: string
  positionName: string
  enterpriseName: string
  departmentName: string
  orgLabel: string
  interviewDate: string
  timeSlotLabel: string
  interviewExactTime?: string
  scheduleLabel: string
  weekdayLabel: string
  status: GrabInterviewRegStatus
  statusLabel: string
  detailHint: string
  failReason?: string
  feedbackAt?: string
  createdAt: string
  phone: string
  name: string
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
  ctx?: {
    today?: string
    enterprises?: Enterprise[]
    departments?: Department[]
    attendanceGroups?: AttendanceGroup[]
  },
): GrabShiftApplicationDisplay {
  const today = ctx?.today ?? MINIAPP_DEMO_ANCHOR_DATE
  const extra = slot ? getGrabShiftSlotExtra(slot.id, slot.date) : null
  const positionName = slot?.positionName?.trim() || slot?.shiftName || '—'
  const postTitle = slot?.teamName ?? '—'
  const title = slot?.shiftName ?? '—'
  const date = slot?.date ?? '—'
  const timeRange = slot ? `${slot.startTime}-${slot.endTime}` : '—'
  const pay = extra?.pay ?? 0
  const durationHours = extra?.durationHours ?? 8
  const payLabel = formatGrabShiftDailyPay(pay)

  let enterpriseName = ''
  let departmentName = slot?.departmentName?.trim() || ''
  if (slot && ctx?.attendanceGroups && ctx.departments && ctx.enterprises) {
    const enterpriseId = resolveEnterpriseIdByAttendanceGroupId(
      slot.attendanceGroupId,
      ctx.attendanceGroups,
      ctx.departments,
    )
    enterpriseName =
      ctx.enterprises.find((e) => e.id === enterpriseId)?.name?.trim() || ''
    if (!departmentName && slot.departmentId) {
      departmentName =
        ctx.departments.find((d) => d.id === slot.departmentId)?.name?.trim() || ''
    }
  }
  const orgLabel = [enterpriseName, departmentName || postTitle].filter(Boolean).join(' · ') || postTitle

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
    positionName,
    orgLabel,
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

export function buildGrabInterviewApplicationDisplay(
  reg: GrabInterviewRegistration,
  ctx?: {
    enterprises?: Enterprise[]
    departments?: Department[]
    today?: string
  },
): GrabInterviewApplicationDisplay {
  const today = ctx?.today ?? MINIAPP_DEMO_ANCHOR_DATE
  const enterpriseName =
    ctx?.enterprises?.find((e) => e.id === reg.enterpriseId)?.name?.trim() || '企业'
  const departmentName =
    ctx?.departments?.find((d) => d.id === reg.departmentId)?.name?.trim() || '部门'
  const weekdayLabel =
    reg.weekday != null ? grabInterviewWeekdayMap[reg.weekday] ?? '' : ''
  const exact = reg.interviewExactTime?.trim()
  const scheduleLabel = exact
    ? `${reg.interviewDate} ${weekdayLabel} ${exact}（${reg.timeSlotLabel}）`.replace(/\s+/g, ' ').trim()
    : `${reg.interviewDate} ${weekdayLabel} ${reg.timeSlotLabel}`.replace(/\s+/g, ' ').trim()

  const statusLabel = grabInterviewRegStatusMap[reg.status]?.label ?? reg.status
  let detailHint = ''
  switch (reg.status) {
    case 'pending':
      if (reg.interviewDate > today) {
        detailHint = `已锁定面试名额，请于 ${scheduleLabel} 准时参加面试`
      } else if (reg.interviewDate === today) {
        detailHint = `今日面试：${scheduleLabel}，请提前到达面试地点`
      } else {
        detailHint = '面试日已过，等待企业反馈结果'
      }
      break
    case 'passed':
      detailHint = '面试已通过，可优先参与该企业抢班报名'
      break
    case 'failed':
      detailHint = reg.failReason?.trim()
        ? `面试未通过：${reg.failReason}`
        : '很遗憾，本次面试未通过'
      break
    case 'no_show_cancelled':
      detailHint = '未按时到面或面试已取消，可重新选择时段报名'
      break
  }

  return {
    id: reg.id,
    positionName: reg.position,
    enterpriseName,
    departmentName,
    orgLabel: `${enterpriseName} · ${departmentName}`,
    interviewDate: reg.interviewDate,
    timeSlotLabel: reg.timeSlotLabel,
    interviewExactTime: reg.interviewExactTime,
    scheduleLabel,
    weekdayLabel,
    status: reg.status,
    statusLabel,
    detailHint,
    failReason: reg.failReason,
    feedbackAt: reg.feedbackAt,
    createdAt: reg.createdAt,
    phone: reg.phone,
    name: reg.name,
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

export function grabInterviewStatusTagClass(status: GrabInterviewRegStatus) {
  if (status === 'passed') return 'green'
  if (status === 'failed') return 'red'
  if (status === 'no_show_cancelled') return 'grey'
  return 'orange'
}

/** 是否为当前灵工的面试报名（兼容仅填手机号的旧数据） */
export function isGrabInterviewRegForWorker(
  reg: GrabInterviewRegistration,
  worker: { id: string; phone?: string; name?: string } | null | undefined,
) {
  if (!worker) return false
  if (reg.employeeId && reg.employeeId === worker.id) return true
  if (reg.employeeId) return false
  const phone = worker.phone?.trim()
  if (phone && reg.phone === phone) return true
  return false
}
