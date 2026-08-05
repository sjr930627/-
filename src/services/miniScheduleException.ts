import type { ApprovalStatus, CancelShiftRequest, MakeupPunchRequest, PunchType } from '@/types'

export type ExceptionRecordType = 'makeup' | 'cancel_shift'

export interface MiniExceptionRecord {
  id: string
  type: ExceptionRecordType
  typeLabel: string
  date: string
  status: ApprovalStatus
  statusLabel: string
  statusTone: string
  summary: string
  reason: string
  createdAt: string
}

const statusLabelMap: Record<ApprovalStatus, string> = {
  pending: '审批中',
  approved: '已通过',
  rejected: '已驳回',
}

const statusToneMap: Record<ApprovalStatus, string> = {
  pending: 'orange',
  approved: 'green',
  rejected: 'red',
}

export function approvalStatusLabel(status: ApprovalStatus) {
  return statusLabelMap[status]
}

export function approvalStatusTone(status: ApprovalStatus) {
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
  return {
    id: req.id,
    type: 'cancel_shift',
    typeLabel: '取消班次',
    date: req.date,
    status: req.status,
    statusLabel: req.status === 'approved' ? '已取消' : statusLabelMap[req.status],
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
