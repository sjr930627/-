import type { ApprovalStatus, CancelShiftRequest, MakeupPunchRequest, PunchType } from '@/types'

export type ExceptionRecordType = 'makeup' | 'cancel_shift'

/** 异常申请展示状态（取消班次含审批前撤销） */
export type ExceptionDisplayStatus = ApprovalStatus | 'cancelled'

export interface MiniExceptionRecord {
  id: string
  type: ExceptionRecordType
  typeLabel: string
  date: string
  status: ExceptionDisplayStatus
  statusLabel: string
  statusTone: string
  summary: string
  reason: string
  createdAt: string
}

const statusLabelMap: Record<ExceptionDisplayStatus, string> = {
  pending: '审批中',
  approved: '已通过',
  rejected: '已驳回',
  cancelled: '已撤销',
}

const statusToneMap: Record<ExceptionDisplayStatus, string> = {
  pending: 'orange',
  approved: 'green',
  rejected: 'red',
  cancelled: 'gray',
}

export function approvalStatusLabel(status: ExceptionDisplayStatus) {
  return statusLabelMap[status]
}

export function approvalStatusTone(status: ExceptionDisplayStatus) {
  return statusToneMap[status]
}

export function punchTypeLabel(type: PunchType) {
  return type === 'clock_in' ? '签到' : '签退'
}

export function buildMakeupExceptionRecord(req: MakeupPunchRequest): MiniExceptionRecord {
  return {
    id: req.id,
    type: 'makeup',
    typeLabel: '补卡申请',
    date: req.date,
    status: req.status,
    statusLabel: req.status === 'approved' ? '正常' : statusLabelMap[req.status],
    statusTone: statusToneMap[req.status],
    summary: `${req.date} ${punchTypeLabel(req.punchType)} ${req.time.slice(0, 5)}`,
    reason: req.reason,
    createdAt: req.createdAt,
  }
}

export function buildCancelExceptionRecord(req: CancelShiftRequest): MiniExceptionRecord {
  const statusLabel =
    req.status === 'approved'
      ? '已取消'
      : req.status === 'cancelled'
        ? '已撤销'
        : statusLabelMap[req.status]
  return {
    id: req.id,
    type: 'cancel_shift',
    typeLabel: '取消班次',
    date: req.date,
    status: req.status,
    statusLabel,
    statusTone: statusToneMap[req.status],
    summary: `${req.date} 排班取消申请`,
    reason: req.reason,
    createdAt: req.createdAt,
  }
}

export function buildWorkerExceptionRecords(
  employeeId: string,
  makeupRequests: MakeupPunchRequest[],
  cancelRequests: CancelShiftRequest[],
): MiniExceptionRecord[] {
  const items = [
    ...makeupRequests.filter((r) => r.employeeId === employeeId).map(buildMakeupExceptionRecord),
    ...cancelRequests.filter((r) => r.employeeId === employeeId).map(buildCancelExceptionRecord),
  ]
  return items.sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}
