import type { MiniAppMessage, MiniMessageCategory, MiniJobApplicationStatus, WorkerIncomeStatus } from '@/types'

export const miniMessageCategoryMap: Record<MiniMessageCategory, string> = {
  income: '收入通知',
  schedule: '排班通知',
  task: '系统通知',
  withdraw: '收入通知',
  system: '系统通知',
}

export const miniMessageCategoryTone: Record<
  MiniMessageCategory,
  { bg: string; color: string; tab: 'schedule' | 'system' | 'income' }
> = {
  income: { bg: '#f0fdf4', color: '#22c55e', tab: 'income' },
  schedule: { bg: '#eff6ff', color: '#3b82f6', tab: 'schedule' },
  task: { bg: '#faf5ff', color: '#a855f7', tab: 'system' },
  withdraw: { bg: '#f0fdf4', color: '#22c55e', tab: 'income' },
  system: { bg: '#faf5ff', color: '#a855f7', tab: 'system' },
}

export function formatMiniMessageTime(iso: string, now = new Date()) {
  const date = new Date(iso.replace(' ', 'T'))
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate())
  const diffDays = Math.round((today.getTime() - msgDay.getTime()) / 86400000)
  const hm = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  if (diffDays === 0) return hm
  if (diffDays === 1) return `昨天 ${hm}`
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${mm}-${dd} ${hm}`
}

export function formatMiniMessageDateTime(iso: string) {
  const date = new Date(iso.replace(' ', 'T'))
  const y = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hm = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  const ss = String(date.getSeconds()).padStart(2, '0')
  return `${y}-${mm}-${dd} ${hm}:${ss}`
}

export function getMiniMessageAction(msg: MiniAppMessage) {
  if (
    msg.actionType === 'schedule_confirm' &&
    msg.scheduleDetail?.confirmStatus !== 'accepted' &&
    msg.scheduleDetail?.confirmStatus !== 'rejected'
  ) {
    return { label: '去确认', primary: true, path: `/miniapp/messages/${msg.id}` }
  }
  if (msg.actionType === 'income' || msg.category === 'income' || msg.category === 'withdraw') {
    return { label: '查看明细', primary: false, path: '/miniapp/income' }
  }
  if (msg.actionType === 'agreement') {
    return { label: '查看协议', primary: false, path: '/miniapp/agreements' }
  }
  return null
}

export function isScheduleConfirmPending(msg: MiniAppMessage) {
  return (
    msg.actionType === 'schedule_confirm' &&
    msg.scheduleDetail?.confirmStatus !== 'accepted' &&
    msg.scheduleDetail?.confirmStatus !== 'rejected'
  )
}

export function countPendingScheduleConfirms(messages: MiniAppMessage[], employeeId: string) {
  return messages.filter((m) => m.employeeId === employeeId && isScheduleConfirmPending(m)).length
}

export type MiniMessageTabKey = 'all' | 'schedule' | 'system' | 'income'

export function parseMiniMessageTab(tab: unknown): MiniMessageTabKey {
  if (tab === 'schedule' || tab === 'system' || tab === 'income') return tab
  return 'all'
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

/** 灵工收入领取个税测算（演示：3%） */
export function calcWorkerIncomeTax(amount: number) {
  const tax = Math.round(amount * 0.03 * 100) / 100
  const netAmount = Math.round((amount - tax) * 100) / 100
  return { tax, netAmount }
}

export function formatIncomeDateTime(iso: string) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatIncomeDate(date: string) {
  const d = new Date(date.includes('T') ? date : `${date}T00:00:00`)
  if (Number.isNaN(d.getTime())) return date
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(d.getMonth() + 1)}月${pad(d.getDate())}日`
}

export function formatIncomeDetailRule(item: import('@/types').WorkerIncomeDetailItem) {
  const qty = item.quantity ?? 1
  if (item.calcType === 'hourly') return `${qty}h × ¥${item.unitPrice}`
  return `${qty} × ¥${item.unitPrice}`
}

export const workerLevelColors: Record<string, string> = {
  铜牌灵工: '#cd7f32',
  银牌灵工: '#a8a8a8',
  金牌灵工: '#ffb800',
  钻石灵工: '#6eb5ff',
}

export const faceVerifyStatusMap: Record<
  import('@/types').WorkerFaceVerifyStatus,
  { label: string; color: string; bg: string }
> = {
  verified: { label: '真人已核验', color: '#16a34a', bg: '#f0fdf4' },
  pending: { label: '核验中', color: '#ea580c', bg: '#fff7ed' },
  failed: { label: '核验失败', color: '#dc2626', bg: '#fef2f2' },
  unverified: { label: '未核验', color: '#6b7280', bg: '#f3f4f6' },
}

export const faceVerifyIntro =
  '通过人脸识别打卡机制，确保灵工「本人打卡、本人上岗」，杜绝代打卡、身份冒用等作弊行为，保障考勤数据真实可信，为薪资结算和保险理赔提供可靠依据。'

export const faceVerifyRuleGroups = [
  {
    step: '①',
    title: '触发规则',
    items: ['上班打卡触发', '不定时复核（约 2/4 小时）', '换班/续班触发', '报名与领任务触发'],
  },
  {
    step: '②',
    title: '执行规范',
    items: ['活体检测', '着装规范', '环境要求', '时限要求'],
  },
  {
    step: '③',
    title: '结果处理',
    items: ['通过 → 打卡成功', '失败 → 重试', '超时 → 补卡', '多次失败 → 申诉'],
  },
] as const

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
