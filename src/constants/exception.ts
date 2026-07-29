import type { ExceptionType } from '@/types'

export type ExceptionHandleType = 'makeup' | 'leave' | 'swap' | 'manual'

export const exceptionHandleMap: Record<
  ExceptionType,
  { label: string; handle: ExceptionHandleType; desc: string }[]
> = {
  missing_punch: [{ label: '补卡审批', handle: 'makeup', desc: '审批通过后自动补录打卡' }],
  absent: [
    { label: '请假审批', handle: 'leave', desc: '确认为请假并更新排班' },
    { label: '直接结案', handle: 'manual', desc: '管理员核实后手动调整' },
  ],
  late: [
    { label: '请假审批', handle: 'leave', desc: '如有正当理由可按请假处理' },
    { label: '直接结案', handle: 'manual', desc: '确认迟到记录或调整为正常' },
  ],
  early_leave: [
    { label: '请假审批', handle: 'leave', desc: '如有正当理由可按请假处理' },
    { label: '直接结案', handle: 'manual', desc: '确认早退记录或调整为正常' },
  ],
  schedule_conflict: [{ label: '换班审批', handle: 'swap', desc: '审批通过后自动更新排班' }],
  location: [{ label: '直接结案', handle: 'manual', desc: '核实定位偏差原因' }],
}

export function getDefaultHandleType(type: ExceptionType): ExceptionHandleType {
  return exceptionHandleMap[type][0]?.handle ?? 'manual'
}
