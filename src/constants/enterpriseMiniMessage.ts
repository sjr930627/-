import type { Notification } from '@/types'

/** 企业小程序消息类型：招聘 / 班次 / 系统 */
export type EntMiniMessageCategory = 'recruit' | 'shift' | 'system'

export type EntMiniMessageTab = 'all' | EntMiniMessageCategory

export const entMiniMessageTabs: { key: EntMiniMessageTab; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'recruit', label: '招聘通知' },
  { key: 'shift', label: '班次通知' },
  { key: 'system', label: '系统通知' },
]

export const entMiniMessageCategoryMap: Record<EntMiniMessageCategory, string> = {
  recruit: '招聘通知',
  shift: '班次通知',
  system: '系统通知',
}

/** 企业小程序可见消息的分类；平台工作台消息返回 null */
export function classifyEnterpriseMiniMessage(
  message: Pick<Notification, 'title' | 'content' | 'type' | 'category' | 'portal'>,
): EntMiniMessageCategory | null {
  if (message.portal === 'platform') return null
  if (message.category && message.portal !== 'enterprise') return null

  const text = `${message.title} ${message.content}`
  if (message.title.includes('系统通知')) return 'system'
  if (/面试|招聘|入驻|候选人|简历/.test(text)) return 'recruit'
  if (
    message.category === 'shift' ||
    message.type === 'schedule' ||
    message.type === 'attendance' ||
    /班次|排班|抢班|工时|出勤|打卡/.test(text)
  ) {
    return 'shift'
  }
  if (message.portal === 'enterprise' || !message.portal) return 'system'
  return null
}
