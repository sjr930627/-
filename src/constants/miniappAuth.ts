export const MINIAPP_DEMO_PASSWORD = '123456'

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
  '加油站营业员',
  '便利店店员',
  '促销导购',
  '地推专员',
  '仓库分拣',
  '客服专员',
  '活动礼仪',
  '配送骑手',
] as const

export const MINIAPP_BRAND_OPTIONS = [
  '中石化',
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

export const MINIAPP_SKILL_CERT_CATALOG: MiniAppSkillCertCategory[] = [
  {
    title: '🔥 大家常选',
    items: [
      { id: 'driver', name: '机动车驾驶证', icon: '🚗' },
      { id: 'barista', name: '咖啡师证', icon: '☕' },
      { id: 'tea', name: '茶艺师', icon: '🍵' },
      { id: 'lifeguard', name: '救生员证', icon: '🛟' },
    ],
  },
  {
    title: '通用能力类',
    items: [
      { id: 'computer', name: '计算机等级证', icon: '💻' },
      { id: 'english', name: '英语等级证', icon: '🇺🇸' },
      { id: 'mandarin', name: '普通话等级', icon: '🇨🇳' },
      { id: 'health', name: '健康证', icon: '📋' },
    ],
  },
  {
    title: '餐饮/食品类',
    items: [
      { id: 'chef', name: '厨师证', icon: '👨‍🍳' },
      { id: 'food_safety', name: '食品安全员', icon: '🥗' },
      { id: 'nutrition', name: '营养师', icon: '🥦' },
      { id: 'bar_tender', name: '调酒师', icon: '🍸' },
    ],
  },
  {
    title: '零售/服务类',
    items: [
      { id: 'cashier', name: '收银上岗证', icon: '🧾' },
      { id: 'beauty', name: '美容师证', icon: '💅' },
      { id: 'guide', name: '导游证', icon: '🧭' },
      { id: 'security', name: '保安员证', icon: '🛡️' },
    ],
  },
]

export const MINIAPP_TIME_PREF_LABELS: Record<
  'timeOfDay' | 'commitment' | 'shiftDuration' | 'workDays',
  Record<PartTimeTriChoice, string>
> = {
  timeOfDay: { left: '晚上为主', both: '都可以', right: '白天为主' },
  commitment: { left: '临时灵活', both: '都可以', right: '固定长期' },
  shiftDuration: { left: '几小时班次', both: '都可以', right: '半天或全天' },
  workDays: { left: '节假日可做', both: '都可以', right: '只做平时' },
}
