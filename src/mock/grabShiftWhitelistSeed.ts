import type { GrabShiftWhitelistEntry } from '@/types'

export const seedGrabShiftWhitelist: GrabShiftWhitelistEntry[] = [
  {
    id: 'gsw_001',
    attendanceGroupId: 'ag_factory',
    employeeId: 'emp_001',
    remark: '资深灵工，信用分优秀，免审批',
    createdAt: '2026-07-20T09:00:00.000Z',
    createdBy: '排班员',
  },
  {
    id: 'gsw_002',
    attendanceGroupId: 'ag_factory',
    employeeId: 'emp_002',
    remark: '班组长，抢班优先',
    createdAt: '2026-07-21T10:00:00.000Z',
    createdBy: '排班员',
  },
]
