import type { MiniMessageCategory, MiniJobApplicationStatus, WorkerIncomeStatus } from '@/types'

export const miniMessageCategoryMap: Record<MiniMessageCategory, string> = {
  income: '收入',
  schedule: '排班',
  task: '任务',
  withdraw: '提现',
  system: '系统',
}

export const miniMessageCategoryIcon: Record<MiniMessageCategory, string> = {
  income: '💰',
  schedule: '📅',
  task: '📋',
  withdraw: '💳',
  system: '🔔',
}

export const jobApplicationStatusMap: Record<MiniJobApplicationStatus, string> = {
  pending: '待审核',
  interview: '待面试',
  approved: '已通过',
  rejected: '未通过',
}

export const incomeStatusMap: Record<WorkerIncomeStatus, string> = {
  pending_settlement: '待结算',
  claimable: '待领取',
  claimed: '已领取',
}

export const workerLevelColors: Record<string, string> = {
  铜牌灵工: '#cd7f32',
  银牌灵工: '#a8a8a8',
  金牌灵工: '#ffb800',
  钻石灵工: '#6eb5ff',
}

/** 小程序 Demo 锚定日期，与 seed 打卡/排班数据一致 */
export const MINIAPP_DEMO_ANCHOR_DATE = '2026-07-27'

export type MiniPunchMethod = 'gps' | 'wifi' | 'field' | 'qrcode'

export const miniPunchMethodMap: Record<MiniPunchMethod, string> = {
  gps: '定位打卡',
  wifi: 'WiFi打卡',
  field: '外勤打卡',
  qrcode: '扫码打卡',
}

export const miniPunchMethodIcon: Record<MiniPunchMethod, string> = {
  gps: '📍',
  wifi: '📶',
  field: '🚗',
  qrcode: '📷',
}
