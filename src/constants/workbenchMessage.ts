import type { Notification } from '@/types'

/** 工作台消息提醒分类：仅班次 / 合同 / 资金 */
export type WorkbenchMessageCategory = 'shift' | 'contract' | 'fund'

export const workbenchMessageCategoryMap: Record<
  WorkbenchMessageCategory,
  { label: string }
> = {
  shift: { label: '班次通知' },
  contract: { label: '合同通知' },
  fund: { label: '资金通知' },
}

export const workbenchMessageCategories = Object.keys(
  workbenchMessageCategoryMap,
) as WorkbenchMessageCategory[]

/** 旧细分分类 → 三类（兼容本地缓存）；人员类已废弃，不映射 */
const LEGACY_CATEGORY_MAP: Record<string, WorkbenchMessageCategory> = {
  schedule_shift: 'shift',
  no_schedule: 'shift',
  cancel_shift: 'shift',
  shift_gap: 'shift',
  contract_expiry: 'contract',
  bill_generated: 'fund',
  fund_balance: 'fund',
  shift: 'shift',
  contract: 'contract',
  fund: 'fund',
}

export function normalizeWorkbenchMessageCategory(
  category: string | undefined,
): WorkbenchMessageCategory | undefined {
  if (!category) return undefined
  return LEGACY_CATEGORY_MAP[category]
}

/** 旧 Notification.type 兼容映射 */
export function messageCategoryToLegacyType(
  category: WorkbenchMessageCategory,
): Notification['type'] {
  if (category === 'contract') return 'system'
  if (category === 'fund') return 'approval'
  return 'schedule'
}
