import type {
  EmploymentType,
  JobRequirementStatus,
  RecruitmentLeadStatus,
  TalentStatus,
  UrgencyLevel,
} from '@/types'

export const jobRequirementStatusMap: Record<JobRequirementStatus, string> = {
  pending: '待开始',
  recruiting: '招聘中',
  completed: '已完成',
}

export const jobRequirementStatusType: Record<
  JobRequirementStatus,
  'info' | 'primary' | 'success'
> = {
  pending: 'info',
  recruiting: 'success',
  completed: 'primary',
}

export const employmentTypeMap: Record<EmploymentType, string> = {
  full_time: '全职',
  part_time: '兼职',
  intern: '实习',
  dispatch: '劳务派遣',
  outsource: '外包',
}

export const urgencyLevelMap: Record<UrgencyLevel, string> = {
  normal: '普通',
  urgent: '紧急',
  critical: '特急',
}

export const recruitmentLeadStatusMap: Record<RecruitmentLeadStatus, string> = {
  screening: '待筛选',
  interview_pending: '待面试',
  interview_attended: '已到面',
  feedback_pending: '面试待反馈',
  salary_negotiation: '谈薪中',
  background_check: '背调中',
  medical_check: '体检中',
  onboarding_pending: '待入职',
  onboarded: '已入职',
  qualified: '已达标',
  closed: '已结束',
}

export const recruitmentLeadStatusType: Record<
  RecruitmentLeadStatus,
  'info' | 'primary' | 'warning' | 'success' | 'danger'
> = {
  screening: 'info',
  interview_pending: 'primary',
  interview_attended: 'primary',
  feedback_pending: 'warning',
  salary_negotiation: 'warning',
  background_check: 'warning',
  medical_check: 'warning',
  onboarding_pending: 'warning',
  onboarded: 'success',
  qualified: 'success',
  closed: 'info',
}

export const talentStatusMap: Record<TalentStatus, string> = {
  available: '可联系',
  in_process: '跟进中',
  hired: '已录用',
  archived: '已归档',
}

export const recruitmentStatusOptions = Object.entries(recruitmentLeadStatusMap).map(
  ([value, label]) => ({ value, label }),
)

/** PRD 10 态状态机：当前状态 → 可流转目标 */
export const LEAD_STATUS_TRANSITIONS: Record<
  RecruitmentLeadStatus,
  RecruitmentLeadStatus[]
> = {
  screening: ['interview_pending', 'closed'],
  interview_pending: ['interview_attended', 'closed'],
  interview_attended: ['feedback_pending', 'closed'],
  feedback_pending: [
    'salary_negotiation',
    'onboarding_pending',
    'interview_pending',
    'closed',
  ],
  salary_negotiation: ['background_check', 'medical_check', 'onboarding_pending', 'closed'],
  background_check: ['onboarding_pending', 'medical_check', 'closed'],
  medical_check: ['onboarding_pending', 'background_check', 'closed'],
  onboarding_pending: ['onboarded', 'closed'],
  onboarded: ['qualified', 'closed'],
  qualified: [],
  closed: [],
}

export const TERMINAL_LEAD_STATUSES: RecruitmentLeadStatus[] = ['qualified', 'closed']

export const SKILL_OPTIONS = ['健康证', '护工证', '驾驶证', '电工证', '其他']

export const BENEFIT_PRESETS = [
  '餐补',
  '交通补',
  '住房补',
  '通讯补',
  '高温补',
  '夜班补',
  '节日福利',
  '带薪年假',
  '五险一金',
  '商业保险',
]

/** 小程序福利标签预设（含图标与描述） */
export const JOB_BENEFIT_TAG_PRESETS: { icon: string; title: string; desc: string }[] = [
  { icon: '💰', title: '奖金奖励', desc: '满勤/绩效奖励，多劳多得' },
  { icon: '⚡', title: '日结', desc: '完工当日结算，到账快' },
  { icon: '🎁', title: '岗位奖励', desc: '专属加薪券/新人补贴' },
  { icon: '🛡', title: '出勤保障', desc: '免费出勤保险' },
  { icon: '🍽', title: '餐补', desc: '提供餐补或工作餐' },
  { icon: '🚌', title: '交通补', desc: '提供交通补贴' },
  { icon: '🌙', title: '夜班补', desc: '夜班额外补贴' },
  { icon: '📈', title: '限时补贴', desc: '旺季/活动额外补贴' },
]

export const ATTENDANCE_DURATION_OPTIONS = [
  '不限',
  '1个月以上',
  '3个月以上',
  '6个月以上',
  '长期稳定',
]

export const ATTENDANCE_WEEKLY_DAYS_OPTIONS = [
  '不限',
  '每周1-2天',
  '每周3天以上',
  '每周4天以上',
  '每周5天以上',
]

export const ATTENDANCE_TIME_SLOT_OPTIONS = [
  '不限',
  '早班为主',
  '晚班为主',
  '周末优先',
  '可接受轮班',
]

export const DEFAULT_ATTENDANCE_CONFIG = { showInMiniapp: true }
export const DEFAULT_BENEFITS_CONFIG = { showInMiniapp: true }

export const MARKETING_TAG_PRESETS = [
  '高薪急招',
  '包吃住',
  '就近分配',
  '弹性工时',
  '新人友好',
  '晋升快',
  '大厂背景',
  '日结可选',
  '零经验可',
]

export const JOB_TYPE_OPTIONS = ['零售服务', '推广', '仓储', '配送']

export function formatSalaryRange(min: number, max: number): string {
  return `${(min / 1000).toFixed(0)}K-${(max / 1000).toFixed(0)}K`
}

export function getAvailableTransitions(
  status: RecruitmentLeadStatus,
  lead?: { currentRound?: number; totalRounds?: number },
): RecruitmentLeadStatus[] {
  const base = LEAD_STATUS_TRANSITIONS[status] ?? []
  if (status === 'feedback_pending' && lead) {
    const cur = lead.currentRound ?? 1
    const total = lead.totalRounds ?? 1
    if (cur >= total) {
      return base.filter((s) => s !== 'interview_pending')
    }
  }
  return base
}

export function getTransitionLabel(
  from: RecruitmentLeadStatus,
  to: RecruitmentLeadStatus,
): string {
  if (from === 'feedback_pending' && to === 'interview_pending') return '下一轮面试'
  return recruitmentLeadStatusMap[to]
}

export function formatRoundHint(lead: {
  status: RecruitmentLeadStatus
  currentRound?: number
  totalRounds?: number
}): string | null {
  if (lead.status !== 'interview_pending') return null
  const total = lead.totalRounds ?? 1
  if (total <= 1) return null
  const cur = lead.currentRound ?? 1
  return `当前为第 ${cur} 轮面试（共 ${total} 轮）`
}

export function isLeadTerminal(status: RecruitmentLeadStatus): boolean {
  return TERMINAL_LEAD_STATUSES.includes(status)
}

/** 面试待反馈 → 目标状态卡片文案 */
export const FEEDBACK_TRANSITION_CARD_META: Partial<
  Record<RecruitmentLeadStatus, { title: string; desc: string }>
> = {
  salary_negotiation: { title: '谈薪中', desc: '面试通过，进入谈薪' },
  interview_pending: { title: '下一轮面试', desc: '进入下一轮面试' },
  onboarding_pending: { title: '待入职', desc: '面试通过，直接待入职' },
  closed: { title: '未通过', desc: '面试不通过' },
}

export function getFeedbackTransitionDesc(
  target: RecruitmentLeadStatus,
  lead?: { currentRound?: number; totalRounds?: number },
): string {
  if (target === 'interview_pending' && lead) {
    const next = (lead.currentRound ?? 1) + 1
    return `进入第 ${next} 轮面试`
  }
  return FEEDBACK_TRANSITION_CARD_META[target]?.desc ?? getTransitionLabel('feedback_pending', target)
}

export function getFeedbackPendingHint(lead: { currentRound?: number; totalRounds?: number }): string {
  const cur = lead.currentRound ?? 1
  const total = lead.totalRounds ?? 1
  if (cur >= total) {
    return '请选择谈薪、待入职或未通过'
  }
  return '可「下一轮面试」继续，或提前「谈薪中 / 待入职 / 未通过」（将记为特例偏离）'
}
