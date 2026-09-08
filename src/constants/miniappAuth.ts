import { groupSkillLibraryByCategory, seedSkillLibrary } from '@/constants/skillLibrary'

export const MINIAPP_DEMO_PASSWORD = '123456'

/** 不定时人脸复核间隔（小时）：2 或 4 */
export const FACE_REVERIFY_INTERVAL_OPTIONS_HOURS = [2, 4] as const

export const MINIAPP_WEEKDAY_OPTIONS = [
  '周一',
  '周二',
  '周三',
  '周四',
  '周五',
  '周六',
  '周日',
] as const

export const MINIAPP_JOB_OPTIONS = [
  '营业厅营业员',
  '终端销售员',
  '促销导购',
  '地推专员',
  '仓库分拣',
  '客服专员',
  '活动礼仪',
  '配送骑手',
] as const

export const MINIAPP_BRAND_OPTIONS = [
  '中国移动',
  '中石油',
  '星辰通信',
  '华信通信',
  '安联保险',
  '翼联渠道',
] as const

export const MINIAPP_ONBOARDING_STEPS = [
  { key: 'realname', title: '实名认证' },
  { key: 'face', title: '人脸识别' },
  { key: 'profile', title: '个人档案' },
  { key: 'timePref', title: '时间偏好' },
  { key: 'certificates', title: '技能证书' },
  { key: 'job', title: '岗位偏好' },
] as const

export type PartTimeTriChoice = 'left' | 'both' | 'right'

export const MINIAPP_TIME_PREF_ROWS: {
  key: 'timeOfDay' | 'commitment' | 'shiftDuration' | 'workDays'
  left: { icon: string; label: string }
  both: { icon: string; label: string }
  right: { icon: string; label: string }
}[] = [
  {
    key: 'timeOfDay',
    left: { icon: '🌙', label: '晚上为主' },
    both: { icon: '⚖️', label: '都可以' },
    right: { icon: '☀️', label: '白天为主' },
  },
  {
    key: 'commitment',
    left: { icon: '🕐', label: '临时灵活' },
    both: { icon: '⚖️', label: '都可以' },
    right: { icon: '⏳', label: '固定长期' },
  },
  {
    key: 'shiftDuration',
    left: { icon: '⚡', label: '几小时班次' },
    both: { icon: '⚖️', label: '都可以' },
    right: { icon: '🧃', label: '半天或全天' },
  },
  {
    key: 'workDays',
    left: { icon: '✨', label: '节假日可做' },
    both: { icon: '⚖️', label: '都可以' },
    right: { icon: '🌤️', label: '只做平时' },
  },
]

export const MINIAPP_SKILL_CERT_MAX = 10

export interface MiniAppSkillCertOption {
  id: string
  name: string
  icon: string
}

export interface MiniAppSkillCertCategory {
  title: string
  items: MiniAppSkillCertOption[]
}

/** @deprecated 请优先使用 store 技能库；保留静态目录兼容旧引用 */
export const MINIAPP_SKILL_CERT_CATALOG: MiniAppSkillCertCategory[] =
  groupSkillLibraryByCategory(seedSkillLibrary).map((g) => ({
    title: g.title,
    items: g.items.map((i) => ({ id: i.id, name: i.name, icon: i.icon || '📌' })),
  }))

export const MINIAPP_TIME_PREF_LABELS: Record<
  'timeOfDay' | 'commitment' | 'shiftDuration' | 'workDays',
  Record<PartTimeTriChoice, string>
> = {
  timeOfDay: { left: '晚上为主', both: '都可以', right: '白天为主' },
  commitment: { left: '临时灵活', both: '都可以', right: '固定长期' },
  shiftDuration: { left: '几小时班次', both: '都可以', right: '半天或全天' },
  workDays: { left: '节假日可做', both: '都可以', right: '只做平时' },
}
