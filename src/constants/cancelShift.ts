import { SCHEDULE_DEMO_TODAY } from '@/constants/schedule'

/** 管理端取消班次原因（排班 / 抢班共用） */
export type CancelShiftReasonCode =
  | 'business_change'
  | 'force_majeure'
  | 'personnel_replace'
  | 'other'

export const CANCEL_SHIFT_REASON_OPTIONS: {
  value: CancelShiftReasonCode
  label: string
}[] = [
  { value: 'business_change', label: '业务变动，班次调整/取消' },
  { value: 'force_majeure', label: '不可抗力因素取消班次' },
  { value: 'personnel_replace', label: '班次人员替换/补班' },
  { value: 'other', label: '其他' },
]

export const cancelShiftReasonMap = Object.fromEntries(
  CANCEL_SHIFT_REASON_OPTIONS.map((o) => [o.value, o.label]),
) as Record<CancelShiftReasonCode, string>

export function formatCancelShiftReason(input: {
  reasonCode?: CancelShiftReasonCode
  reasonOther?: string
  reason?: string
}) {
  if (input.reasonCode === 'other') {
    return input.reasonOther?.trim() || input.reason?.trim() || '其他'
  }
  if (input.reasonCode && cancelShiftReasonMap[input.reasonCode]) {
    return cancelShiftReasonMap[input.reasonCode]
  }
  return input.reason?.trim() || '—'
}

export function buildCancelShiftReasonText(
  reasonCode: CancelShiftReasonCode,
  reasonOther = '',
) {
  if (reasonCode === 'other') {
    const text = reasonOther.trim()
    if (!text) throw new Error('请填写其他取消原因')
    return text
  }
  return cancelShiftReasonMap[reasonCode]
}

/** 演示「当前时间」：用于判断抢班班次是否尚未开始 */
export const CANCEL_SHIFT_DEMO_NOW = `${SCHEDULE_DEMO_TODAY}T07:00:00`

export function isGrabSlotNotStarted(
  slot: { date: string; startTime?: string },
  nowIso = CANCEL_SHIFT_DEMO_NOW,
) {
  const start = (slot.startTime || '00:00').slice(0, 5)
  const startMs = new Date(`${slot.date}T${start}:00`).getTime()
  return startMs > new Date(nowIso).getTime()
}
