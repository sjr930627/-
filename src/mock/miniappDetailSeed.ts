/** 小程序岗位/抢班详情页演示数据 */

import type { JobRequirement } from '@/types'
import { DEFAULT_ATTENDANCE_CONFIG, DEFAULT_BENEFITS_CONFIG } from '@/constants/recruitment'

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

export interface MiniJobRequirementDetail {
  intro?: string
  duties: string[]
  qualifications: string[]
}

export interface MiniJobAttendanceRequirement {
  subtitle: string
  duration: string
  weeklyDays: string
  timeSlots: string
}

export interface MiniJobRuleItem {
  label: string
  value: string
}

export interface MiniJobRuleGroup {
  title: string
  items: MiniJobRuleItem[]
  note?: string
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
  subwayHint?: string
  reviewCount: number
  reviewTags: { label: string; count: number }[]
  reviews: MiniJobReview[]
  benefits: MiniJobBenefit[]
  bonusText?: string
  requirementDetail: MiniJobRequirementDetail
  attendanceRequirement: MiniJobAttendanceRequirement
  registrationRules: MiniJobRuleGroup[]
  /** 后台配置：是否展示出勤时间要求 */
  showAttendance?: boolean
  /** 后台配置：是否展示福利待遇 */
  showBenefits?: boolean
}

export interface MiniJobInterviewSlot {
  id: string
  date: string
  startTime: string
  endTime: string
  capacity: number
  enrolled: number
  incomeLabel: string
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
  requirementDetail: MiniJobRequirementDetail
  skillRequirements: string[]
  registrationTips: MiniJobRuleGroup[]
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

const defaultRegistrationRules: MiniJobRuleGroup[] = [
  {
    title: '取消班次规则',
    items: [{ label: '取消班次时限', value: '不限' }],
    note: '锁定工时后不允许申请取消班次',
  },
  {
    title: '补卡规则',
    items: [
      { label: '补卡次数', value: '每月每人可提交2次补卡' },
      { label: '补卡时间', value: '不限' },
      { label: '单班次灵工补卡次数', value: '不限' },
    ],
    note: '锁定工时后不允许申请补卡',
  },
  {
    title: '打卡规则',
    items: [
      { label: '班次开始前', value: '05小时00分钟' },
      { label: '班次开始后', value: '不限' },
      { label: '班次结束前', value: '不限' },
      { label: '班次结束后', value: '05小时00分钟' },
      { label: '打卡方式', value: '每个时段都需要打卡' },
    ],
  },
]

const defaultAttendanceRequirement: MiniJobAttendanceRequirement = {
  subtitle: '面试通过后，稳定派单出勤时间要求',
  duration: '3个月以上',
  weeklyDays: '不限',
  timeSlots: '不限',
}

const defaultRequirementDetail: MiniJobRequirementDetail = {
  intro: '招聘加油站服务兼职人员',
  duties: [
    '负责加油服务与非油产品推介，主动沟通客户需求',
    '完成收银、商品陈列及门店日常清洁维护',
    '配合站长完成高峰时段秩序维护与安全巡检',
    '及时上报设备异常，协助完成简单故障处理',
    '遵守企业安全规范，维护良好服务形象',
  ],
  qualifications: [
    '高中/中专及以上学历，有相关服务行业经验优先',
    '普通话标准，具备基础沟通能力与服务意识',
    '能适应轮班及高峰时段工作节奏',
    '时间观念强，能按时到岗并完成打卡',
    '持有相关上岗资质者优先',
  ],
}

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
    subwayHint: '地铁口 280米',
    reviewCount: 22,
    reviewTags: defaultReviewTags,
    reviews: defaultReviews,
    benefits: [
      { icon: '💰', title: '奖金奖励', desc: '满勤/绩效奖励，多劳多得' },
      { icon: '⚡', title: '日结', desc: '完工当日结算，到账快' },
      { icon: '🎁', title: '岗位奖励', desc: '570元加薪券等专属福利' },
    ],
    bonusText: '570元加薪券',
    requirementDetail: {
      intro: '招聘加油站营业员兼职',
      duties: [
        '负责加油服务流程引导，协助客户完成加油与非油选购',
        '完成收银结算、发票开具及基础账务核对',
        '维护加油岛及便利店区域整洁与安全秩序',
        '配合开展会员拉新、活动推广等现场服务',
        '按规范完成交接班记录与设备点检',
      ],
      qualifications: [
        '高中/中专及以上学历，有加油站或零售经验优先',
        '沟通表达清晰，具备基础销售与服务意识',
        '可接受轮班，能适应周末及节假日高峰',
        '责任心强，遵守安全作业规范',
        '持有相关行业上岗证者优先',
      ],
    },
    attendanceRequirement: defaultAttendanceRequirement,
    registrationRules: defaultRegistrationRules,
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
    subwayHint: '地铁口 420米',
    reviewCount: 16,
    reviewTags: defaultReviewTags,
    reviews: defaultReviews,
    benefits: [
      { icon: '💰', title: '奖金奖励', desc: '销售提成+满勤奖' },
      { icon: '🛡', title: '出勤保障', desc: '免费出勤保险' },
      { icon: '🎁', title: '岗位奖励', desc: '新人专属补贴' },
    ],
    requirementDetail: defaultRequirementDetail,
    attendanceRequirement: defaultAttendanceRequirement,
    registrationRules: defaultRegistrationRules,
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
    subwayHint: '地铁口 650米',
    reviewCount: 11,
    reviewTags: defaultReviewTags,
    reviews: defaultReviews,
    benefits: [
      { icon: '💰', title: '奖金奖励', desc: '推广提成即时结算' },
      { icon: '⚡', title: '日结', desc: '完工当日结算，到账快' },
      { icon: '📈', title: '限时补贴', desc: '旺季额外补贴' },
    ],
    requirementDetail: {
      ...defaultRequirementDetail,
      intro: '招聘非油产品推广兼职',
      duties: [
        '在加油站现场开展非油产品推介与体验引导',
        '收集客户反馈，协助优化推广话术与陈列',
        '配合完成推广活动物料布置与数据登记',
        '维护推广区域整洁，确保活动流程顺畅',
      ],
      qualifications: [
        '有零售推广或地推经验者优先',
        '表达能力强，善于与陌生客户沟通',
        '可灵活安排出勤时段，配合活动档期',
        '目标感强，能够完成基础推广指标',
      ],
    },
    attendanceRequirement: {
      ...defaultAttendanceRequirement,
      duration: '1个月以上',
    },
    registrationRules: defaultRegistrationRules,
  },
}

export function getJobDetailExtra(
  jobId: string,
  fallback: { storeName: string; location: string },
  job?: JobRequirement | null,
): MiniJobDetailExtra {
  const base = jobDetailExtras[jobId] ?? {
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
    requirementDetail: defaultRequirementDetail,
    attendanceRequirement: defaultAttendanceRequirement,
    registrationRules: defaultRegistrationRules,
  }

  if (!job) return base

  const attendanceConfig = { ...DEFAULT_ATTENDANCE_CONFIG, ...job.attendanceConfig }
  const benefitsConfig = { ...DEFAULT_BENEFITS_CONFIG, ...job.benefitsConfig }

  const attendanceRequirement = job.attendanceRequirement
    ? {
        subtitle: job.attendanceRequirement.subtitle || defaultAttendanceRequirement.subtitle,
        duration: job.attendanceRequirement.duration || defaultAttendanceRequirement.duration,
        weeklyDays: job.attendanceRequirement.weeklyDays || defaultAttendanceRequirement.weeklyDays,
        timeSlots: job.attendanceRequirement.timeSlots || defaultAttendanceRequirement.timeSlots,
      }
    : base.attendanceRequirement

  const benefits =
    job.benefitTags && job.benefitTags.length > 0
      ? job.benefitTags.map((b) => ({ icon: b.icon, title: b.title, desc: b.desc }))
      : base.benefits

  return {
    ...base,
    storeName: base.storeName || fallback.storeName,
    address: base.address || fallback.location,
    tags: job.tags?.length ? job.tags : base.tags,
    attendanceRequirement,
    benefits,
    bonusText: job.bonusText ?? base.bonusText,
    showAttendance: attendanceConfig.showInMiniapp,
    showBenefits: benefitsConfig.showInMiniapp,
  }
}

export function shouldShowJobAttendance(extra: MiniJobDetailExtra): boolean {
  return extra.showAttendance !== false
}

export function shouldShowJobBenefits(extra: MiniJobDetailExtra): boolean {
  return extra.showBenefits !== false && (extra.benefits?.length ?? 0) > 0
}

const defaultGrabShiftRequirementDetail: MiniJobRequirementDetail = {
  intro: '加油站帮工兼职',
  duties: [
    '协助完成加油引导、车辆秩序维护及现场安全提示',
    '完成收银结算、非油产品推介与基础陈列整理',
    '配合站长完成高峰时段疏导与设备点检',
    '按规范完成交接班记录，维护作业区域整洁',
  ],
  qualifications: [],
}

const defaultGrabShiftSkills = [
  '需持有中石化安全作业证或通过岗前安全培训',
  '具备基础沟通能力，普通话标准',
  '能适应站立作业及高峰时段工作节奏',
  '时间观念强，能按时打卡并完成班次任务',
]

const grabShiftPostExtrasBase = {
  reviewCount: 6,
  reviewTags: defaultReviewTags,
  reviews: defaultReviews,
  requirementDetail: defaultGrabShiftRequirementDetail,
  skillRequirements: defaultGrabShiftSkills,
  registrationTips: defaultRegistrationRules,
} as const
export const grabShiftPostExtras: Record<string, MiniGrabShiftPostExtra> = {
  team_a: {
    title: '加油站帮工',
    tags: ['收入秒结', '免审核', '兼职岗位', '平台加薪', '限时补贴'],
    storeName: '中石化朝阳加油站',
    address: '北京市朝阳区建国路88号',
    distance: '距您 3.2km',
    commute: '公交约40分钟',
    requirements: ['需持有中石化安全作业证', '学历不限', '身高不限'],
    ...grabShiftPostExtrasBase,
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
    requirementDetail: {
      intro: '加油站夜班值守兼职',
      duties: [
        '负责夜间加油岛值守与安全巡查',
        '完成夜间收银、交接班及异常情况上报',
        '配合完成设备巡检与现场秩序维护',
      ],
      qualifications: [],
    },
    skillRequirements: [
      '需持有中石化夜班资质或通过专项培训',
      '能适应夜班作息，责任心强',
      '具备基础应急处理能力',
    ],
    registrationTips: defaultRegistrationRules,
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
    requirementDetail: defaultGrabShiftRequirementDetail,
    skillRequirements: defaultGrabShiftSkills,
    registrationTips: defaultRegistrationRules,
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

const defaultJobInterviewSlots: MiniJobInterviewSlot[] = [
  {
    id: 'jis_default_1',
    date: '2026-08-05',
    startTime: '13:00',
    endTime: '16:00',
    capacity: 10,
    enrolled: 4,
    incomeLabel: '收入面议',
  },
  {
    id: 'jis_default_2',
    date: '2026-08-05',
    startTime: '16:30',
    endTime: '21:30',
    capacity: 10,
    enrolled: 1,
    incomeLabel: '收入面议',
  },
]

export const jobInterviewSlots: Record<string, MiniJobInterviewSlot[]> = {
  req_001: [
    {
      id: 'jis_001_1',
      date: '2026-08-05',
      startTime: '13:00',
      endTime: '16:00',
      capacity: 10,
      enrolled: 4,
      incomeLabel: '收入面议',
    },
    {
      id: 'jis_001_2',
      date: '2026-08-05',
      startTime: '16:30',
      endTime: '21:30',
      capacity: 10,
      enrolled: 1,
      incomeLabel: '收入面议',
    },
    {
      id: 'jis_001_3',
      date: '2026-08-06',
      startTime: '09:00',
      endTime: '12:00',
      capacity: 8,
      enrolled: 3,
      incomeLabel: '按小时结算',
    },
    {
      id: 'jis_001_4',
      date: '2026-08-07',
      startTime: '14:00',
      endTime: '18:00',
      capacity: 6,
      enrolled: 2,
      incomeLabel: '收入面议',
    },
  ],
  req_002: [
    {
      id: 'jis_002_1',
      date: '2026-08-05',
      startTime: '10:00',
      endTime: '14:00',
      capacity: 8,
      enrolled: 2,
      incomeLabel: '收入面议',
    },
    {
      id: 'jis_002_2',
      date: '2026-08-06',
      startTime: '14:00',
      endTime: '18:00',
      capacity: 8,
      enrolled: 5,
      incomeLabel: '按小时结算',
    },
    {
      id: 'jis_002_3',
      date: '2026-08-08',
      startTime: '09:00',
      endTime: '13:00',
      capacity: 5,
      enrolled: 1,
      incomeLabel: '收入面议',
    },
  ],
  req_003: [
    {
      id: 'jis_003_1',
      date: '2026-08-05',
      startTime: '13:00',
      endTime: '17:00',
      capacity: 12,
      enrolled: 6,
      incomeLabel: '收入面议',
    },
    {
      id: 'jis_003_2',
      date: '2026-08-06',
      startTime: '09:00',
      endTime: '12:00',
      capacity: 10,
      enrolled: 4,
      incomeLabel: '按小时结算',
    },
  ],
}

export function getJobInterviewSlots(jobId: string): MiniJobInterviewSlot[] {
  return jobInterviewSlots[jobId] ?? defaultJobInterviewSlots
}

export function formatJobInterviewSlot(slot: MiniJobInterviewSlot): string {
  const d = new Date(`${slot.date}T12:00:00`)
  const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${month}月${day}日 ${weekdays[d.getDay()]} ${slot.startTime}~${slot.endTime}`
}
