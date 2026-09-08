import type { SkillLibraryItem } from '@/types'

/** 默认技能库（招聘 / 人员证书 / 灵工档案同源） */
export const seedSkillLibrary: SkillLibraryItem[] = [
  // 大家常选
  { id: 'driver', name: '机动车驾驶证', icon: '🚗', category: '🔥 大家常选', sortOrder: 1 },
  { id: 'barista', name: '咖啡师证', icon: '☕', category: '🔥 大家常选', sortOrder: 2 },
  { id: 'tea', name: '茶艺师', icon: '🍵', category: '🔥 大家常选', sortOrder: 3 },
  { id: 'lifeguard', name: '救生员证', icon: '🛟', category: '🔥 大家常选', sortOrder: 4 },
  // 通用能力
  { id: 'computer', name: '计算机等级证', icon: '💻', category: '通用能力类', sortOrder: 10 },
  { id: 'english', name: '英语等级证', icon: '🇺🇸', category: '通用能力类', sortOrder: 11 },
  { id: 'mandarin', name: '普通话等级', icon: '🇨🇳', category: '通用能力类', sortOrder: 12 },
  { id: 'health', name: '健康证', icon: '📋', category: '通用能力类', sortOrder: 13 },
  { id: 'first_aid', name: '急救证', icon: '🩹', category: '通用能力类', sortOrder: 14 },
  { id: 'caregiver', name: '护工证', icon: '🧑‍⚕️', category: '通用能力类', sortOrder: 15 },
  { id: 'electrician', name: '电工证', icon: '⚡', category: '通用能力类', sortOrder: 16 },
  { id: 'other', name: '其他', icon: '📌', category: '通用能力类', sortOrder: 19 },
  // 餐饮/食品
  { id: 'chef', name: '厨师证', icon: '👨‍🍳', category: '餐饮/食品类', sortOrder: 20 },
  { id: 'food_safety', name: '食品安全员', icon: '🥗', category: '餐饮/食品类', sortOrder: 21 },
  { id: 'nutrition', name: '营养师', icon: '🥦', category: '餐饮/食品类', sortOrder: 22 },
  { id: 'bar_tender', name: '调酒师', icon: '🍸', category: '餐饮/食品类', sortOrder: 23 },
  // 零售/服务
  { id: 'cashier', name: '收银上岗证', icon: '🧾', category: '零售/服务类', sortOrder: 30 },
  { id: 'beauty', name: '美容师证', icon: '💅', category: '零售/服务类', sortOrder: 31 },
  { id: 'guide', name: '导游证', icon: '🧭', category: '零售/服务类', sortOrder: 32 },
  { id: 'security', name: '保安员证', icon: '🛡️', category: '零售/服务类', sortOrder: 33 },
  // 制造/物流（运营常用）
  { id: 'forklift', name: '叉车证', icon: '🚜', category: '制造/物流类', sortOrder: 40 },
  { id: 'senior_tech', name: '高级技师', icon: '🔧', category: '制造/物流类', sortOrder: 41 },
  { id: 'cmcc_compliance', name: '中国移动业务合规证', icon: '📱', category: '零售/服务类', sortOrder: 34 },
  { id: 'store_ops', name: '营业厅业务操作证', icon: '🏪', category: '零售/服务类', sortOrder: 35 },
]

export const SKILL_LIBRARY_CATEGORIES = [
  '🔥 大家常选',
  '通用能力类',
  '餐饮/食品类',
  '零售/服务类',
  '制造/物流类',
] as const

export function sortSkillLibrary(items: SkillLibraryItem[]): SkillLibraryItem[] {
  return [...items].sort(
    (a, b) =>
      (a.sortOrder ?? 999) - (b.sortOrder ?? 999) || a.name.localeCompare(b.name, 'zh-CN'),
  )
}

export function enabledSkillLibrary(items: SkillLibraryItem[]): SkillLibraryItem[] {
  return sortSkillLibrary(items.filter((s) => s.enabled !== false))
}

export function skillLibraryNames(items: SkillLibraryItem[]): string[] {
  return enabledSkillLibrary(items).map((s) => s.name)
}

export function groupSkillLibraryByCategory(
  items: SkillLibraryItem[],
): { title: string; items: SkillLibraryItem[] }[] {
  const enabled = enabledSkillLibrary(items)
  const map = new Map<string, SkillLibraryItem[]>()
  for (const item of enabled) {
    const key = item.category || '其他'
    const list = map.get(key) ?? []
    list.push(item)
    map.set(key, list)
  }
  const titles = [
    ...SKILL_LIBRARY_CATEGORIES.filter((t) => map.has(t)),
    ...[...map.keys()].filter((t) => !(SKILL_LIBRARY_CATEGORIES as readonly string[]).includes(t)),
  ]
  return titles.map((title) => ({ title, items: map.get(title) ?? [] }))
}

export function resolveSkillLibraryItem(
  items: SkillLibraryItem[],
  skillIdOrName?: string,
): SkillLibraryItem | undefined {
  if (!skillIdOrName) return undefined
  return (
    items.find((s) => s.id === skillIdOrName) ||
    items.find((s) => s.name === skillIdOrName)
  )
}

/** @deprecated 请使用 store.skillLibraryNames；保留兼容静态引用 */
export const SKILL_OPTIONS = skillLibraryNames(seedSkillLibrary)
