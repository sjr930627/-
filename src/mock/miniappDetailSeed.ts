/** 小程序岗位/抢班详情页演示数据 */

export interface MiniJobReview {
  id: string
  text: string
  userName: string
  brandCount: number
  tag?: string
  imageCount?: number
}

export interface MiniJobBenefit {
  icon: string
  title: string
  desc: string
}

export interface MiniJobDetailExtra {
  tags: string[]
  hourlyMin: number
  hourlyMax: number
  promoText?: string
  storeName: string
  address: string
  distance: string
  commute: string
  reviewCount: number
  reviewTags: { label: string; count: number }[]
  reviews: MiniJobReview[]
  benefits: MiniJobBenefit[]
  bonusText?: string
}

export interface MiniGrabShiftPostExtra {
  title: string
  tags: string[]
  storeName: string
  address: string
  distance: string
  commute: string
  requirements: string[]
  reviewCount: number
  reviewTags: { label: string; count: number }[]
  reviews: MiniJobReview[]
}

export interface MiniGrabShiftSlotExtra {
  pay: number
  durationHours: number
  weekdayLabel: string
}

const defaultReviews: MiniJobReview[] = [
  {
    id: 'rv_1',
    text: '站长很负责，会提前说明操作流程，适合兼职过渡。',
    userName: '灵工小王',
    brandCount: 12,
    tag: '兼职好评',
    imageCount: 3,
  },
  {
    id: 'rv_2',
    text: '高峰期节奏较快，建议熟悉收银后再上岗，整体环境规范。',
    userName: '阿杰',
    brandCount: 8,
    tag: '强度节奏较忙',
    imageCount: 2,
  },
]

const defaultReviewTags = [
  { label: '强度节奏较忙', count: 3 },
  { label: '兼职好评', count: 3 },
  { label: '站长负责', count: 2 },
]

export const jobDetailExtras: Record<string, MiniJobDetailExtra> = {
  req_001: {
    tags: ['近期发布', '日结', '奖金奖励', '兼职岗位'],
    hourlyMin: 19,
    hourlyMax: 23.5,
    promoText: '服务满60小时即奖励50元，最高奖励570元',
    storeName: '中石化朝阳加油站',
    address: '北京市朝阳区建国路88号',
    distance: '距您 3.2km',
    commute: '公交约40分钟',
    reviewCount: 22,
    reviewTags: defaultReviewTags,
    reviews: defaultReviews,
    benefits: [
      { icon: '💰', title: '奖金奖励', desc: '满勤/绩效奖励，多劳多得' },
      { icon: '⚡', title: '日结', desc: '完工当日结算，到账快' },
      { icon: '🎁', title: '岗位奖励', desc: '570元加薪券等专属福利' },
    ],
    bonusText: '570元加薪券',
  },
  req_002: {
    tags: ['近期发布', '日结', '兼职岗位', '平台加薪'],
    hourlyMin: 18,
    hourlyMax: 22,
    promoText: '首月出勤满20天额外奖励100元',
    storeName: '中石化海淀便利店',
    address: '北京市海淀区中关村大街1号',
    distance: '距您 5.1km',
    commute: '地铁约35分钟',
    reviewCount: 16,
    reviewTags: defaultReviewTags,
    reviews: defaultReviews,
    benefits: [
      { icon: '💰', title: '奖金奖励', desc: '销售提成+满勤奖' },
      { icon: '🛡', title: '出勤保障', desc: '免费出勤保险' },
      { icon: '🎁', title: '岗位奖励', desc: '新人专属补贴' },
    ],
  },
  req_003: {
    tags: ['日结', '奖金奖励', '限时补贴', '兼职岗位'],
    hourlyMin: 22,
    hourlyMax: 28,
    promoText: '推广达标享阶梯奖金，最高800元/月',
    storeName: '中石化浦东加油站',
    address: '上海市浦东新区世纪大道100号',
    distance: '距您 8.6km',
    commute: '公交约55分钟',
    reviewCount: 11,
    reviewTags: defaultReviewTags,
    reviews: defaultReviews,
    benefits: [
      { icon: '💰', title: '奖金奖励', desc: '推广提成即时结算' },
      { icon: '⚡', title: '日结', desc: '完工当日结算，到账快' },
      { icon: '📈', title: '限时补贴', desc: '旺季额外补贴' },
    ],
  },
}

export function getJobDetailExtra(jobId: string, fallback: { storeName: string; location: string }): MiniJobDetailExtra {
  const extra = jobDetailExtras[jobId]
  if (extra) return extra
  return {
    tags: ['日结', '兼职岗位'],
    hourlyMin: 18,
    hourlyMax: 24,
    storeName: fallback.storeName,
    address: fallback.location,
    distance: '距您 —',
    commute: '—',
    reviewCount: 6,
    reviewTags: defaultReviewTags.slice(0, 2),
    reviews: defaultReviews.slice(0, 1),
    benefits: [
      { icon: '⚡', title: '日结', desc: '完工当日结算' },
      { icon: '🛡', title: '出勤保障', desc: '免费出勤保险' },
    ],
  }
}

export const grabShiftPostExtras: Record<string, MiniGrabShiftPostExtra> = {
  team_a: {
    title: '加油站帮工',
    tags: ['收入秒结', '免审核', '兼职岗位', '平台加薪', '限时补贴'],
    storeName: '中石化朝阳加油站',
    address: '北京市朝阳区建国路88号',
    distance: '距您 3.2km',
    commute: '公交约40分钟',
    requirements: ['需持有中石化安全作业证', '学历不限', '身高不限'],
    reviewCount: 6,
    reviewTags: defaultReviewTags,
    reviews: defaultReviews,
  },
  team_b: {
    title: '夜班值守',
    tags: ['收入秒结', '兼职岗位', '夜班补贴'],
    storeName: '中石化朝阳加油站',
    address: '北京市朝阳区建国路88号',
    distance: '距您 3.2km',
    commute: '公交约40分钟',
    requirements: ['需持有中石化夜班资质', '学历不限'],
    reviewCount: 4,
    reviewTags: [{ label: '夜班补贴高', count: 2 }, { label: '兼职好评', count: 2 }],
    reviews: defaultReviews.slice(0, 1),
  },
}

export function getGrabShiftPostExtra(teamId: string, fallbackTeamName: string): MiniGrabShiftPostExtra {
  const extra = grabShiftPostExtras[teamId]
  if (extra) return extra
  return {
    title: fallbackTeamName,
    tags: ['兼职岗位', '收入秒结'],
    storeName: fallbackTeamName,
    address: '详见排班说明',
    distance: '距您 —',
    commute: '—',
    requirements: ['以站点要求为准'],
    reviewCount: 3,
    reviewTags: [{ label: '兼职好评', count: 2 }],
    reviews: defaultReviews.slice(0, 1),
  }
}

/** 班次展示扩展（薪酬、时长） */
export const grabShiftSlotExtras: Record<string, MiniGrabShiftSlotExtra> = {
  gs_001: { pay: 128, durationHours: 8, weekdayLabel: '周四' },
  gs_004: { pay: 99, durationHours: 5.5, weekdayLabel: '周四' },
  gs_005: { pay: 110, durationHours: 6, weekdayLabel: '周五' },
  gs_006: { pay: 105, durationHours: 5.5, weekdayLabel: '周五' },
  gs_002: { pay: 96, durationHours: 8, weekdayLabel: '周五' },
  gs_003: { pay: 140, durationHours: 12, weekdayLabel: '周六' },
}

export function getGrabShiftSlotExtra(slotId: string, date: string) {
  const extra = grabShiftSlotExtras[slotId]
  const d = new Date(date)
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const weekdayLabel = extra?.weekdayLabel ?? weekdays[d.getDay()]
  return {
    pay: extra?.pay ?? 100,
    durationHours: extra?.durationHours ?? 8,
    weekdayLabel,
    dateLabel: `${d.getMonth() + 1}月${d.getDate()}日 ${weekdayLabel}`,
  }
}

/** 按 teamId 聚合的可抢班次组 */
export const grabShiftTeamOrder = ['team_a', 'team_b', 'team_c']
