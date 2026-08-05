export type WorkbenchReminderLevel = 'urgent' | 'important' | 'normal'

export type WorkbenchReminderCategory = 'recruitment' | 'attendance' | 'schedule' | 'settlement'

export const workbenchReminderLevelMap: Record<
  WorkbenchReminderLevel,
  { label: string; emoji: string; color: string; bg: string; border: string }
> = {
  urgent: {
    label: '紧急',
    emoji: '🔴',
    color: '#cf1322',
    bg: '#fff1f0',
    border: '#ffa39e',
  },
  important: {
    label: '重要',
    emoji: '🟡',
    color: '#d46b08',
    bg: '#fff7e6',
    border: '#ffd591',
  },
  normal: {
    label: '普通',
    emoji: '🔵',
    color: '#096dd9',
    bg: '#e6f7ff',
    border: '#91d5ff',
  },
}

export const workbenchReminderCategoryMap: Record<
  WorkbenchReminderCategory,
  { title: string; defaultLevel: WorkbenchReminderLevel }
> = {
  recruitment: { title: '招聘线索跟进', defaultLevel: 'urgent' },
  attendance: { title: '考勤异常', defaultLevel: 'important' },
  schedule: { title: '任务/排班超时', defaultLevel: 'important' },
  settlement: { title: '结算/账单', defaultLevel: 'urgent' },
}

/** 演示锚定时间（与 seed 数据一致） */
export const WORKBENCH_DEMO_NOW = new Date('2026-07-28T10:00:00+08:00')

export const WORKBENCH_THRESHOLDS = {
  leadFollowUpHours: 24,
  leadChurnDays: 15,
  /** 待筛选超过该天数升为紧急 */
  screeningUrgentDays: 3,
  /** 待筛选超过该天数升为重要 */
  screeningImportantDays: 1,
  shiftFillBeforeHours: 2,
  scheduleApprovalHours: 24,
  shiftAcceptanceAfterHours: 4,
} as const

/** 已达标线索跟进提醒节点（天） */
export const QUALIFIED_FOLLOW_UP_DAYS = [1, 3, 5, 10, 15] as const
