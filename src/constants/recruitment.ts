import type {
  JobRequirementStatus,
  RecruitmentLeadStatus,
  TalentStatus,
} from '@/types'

export const jobRequirementStatusMap: Record<JobRequirementStatus, string> = {
  draft: '草稿',
  active: '招聘中',
  closed: '已关闭',
}

export const recruitmentLeadStatusMap: Record<RecruitmentLeadStatus, string> = {
  screening: '待筛选',
  interview_pending: '待面试',
  feedback_pending: '面试待反馈',
  onboarding_pending: '待入职',
  onboarded: '已入职',
  settled: '已结算',
  closed: '已结束',
}

export const recruitmentLeadStatusType: Record<
  RecruitmentLeadStatus,
  'info' | 'primary' | 'warning' | 'success' | 'danger'
> = {
  screening: 'info',
  interview_pending: 'primary',
  feedback_pending: 'warning',
  onboarding_pending: 'warning',
  onboarded: 'success',
  settled: 'success',
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

export function formatSalaryRange(min: number, max: number): string {
  return `${(min / 1000).toFixed(0)}K-${(max / 1000).toFixed(0)}K`
}

export function getNextLeadStatus(
  current: RecruitmentLeadStatus,
): RecruitmentLeadStatus | null {
  const order = [
    'screening',
    'interview_pending',
    'feedback_pending',
    'onboarding_pending',
    'onboarded',
    'settled',
    'closed',
  ] as RecruitmentLeadStatus[]
  const idx = order.indexOf(current)
  return idx >= 0 && idx < order.length - 1 ? order[idx + 1] : null
}

export function getPrevLeadStatus(
  current: RecruitmentLeadStatus,
): RecruitmentLeadStatus | null {
  const order = [
    'screening',
    'interview_pending',
    'feedback_pending',
    'onboarding_pending',
    'onboarded',
    'settled',
    'closed',
  ] as RecruitmentLeadStatus[]
  const idx = order.indexOf(current)
  return idx > 0 ? order[idx - 1] : null
}
