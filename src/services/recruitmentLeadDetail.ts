import type { RecruitmentLead, RecruitmentLeadStatus } from '@/types'
import { employmentTypeMap, recruitmentLeadStatusMap } from '@/constants/recruitment'

/** 详情页跟进进度：7 步主流程 */
export const RECRUITMENT_PROGRESS_STEPS = [
  { key: 'screening', label: '待筛选' },
  { key: 'interview', label: '待面试' },
  { key: 'feedback', label: '面试待反馈' },
  { key: 'onboarding', label: '待入职' },
  { key: 'onboarded', label: '已入职' },
  { key: 'qualified', label: '已达标' },
  { key: 'closed', label: '已结束' },
] as const

const STATUS_STEP_INDEX: Record<RecruitmentLeadStatus, number> = {
  screening: 0,
  interview_pending: 1,
  interview_attended: 1,
  feedback_pending: 2,
  salary_negotiation: 2,
  background_check: 2,
  medical_check: 2,
  onboarding_pending: 3,
  onboarded: 4,
  qualified: 5,
  closed: 6,
}

export type ProgressStepVisualState = 'done' | 'active' | 'pending'

export interface RecruitmentProgressStepView {
  key: string
  label: string
  index: number
  state: ProgressStepVisualState
  date?: string
}

export interface LeadFlowRecord {
  id: string
  title: string
  at: string
  operator?: string
  details: { label: string; value: string }[]
}

export function getLeadProgressStepIndex(status: RecruitmentLeadStatus): number {
  return STATUS_STEP_INDEX[status] ?? 0
}

function formatStepDate(iso?: string): string | undefined {
  if (!iso) return undefined
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10)
  return d.toLocaleDateString('zh-CN')
}

function formatDateTime(iso?: string): string {
  if (!iso) return '-'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('zh-CN', { hour12: false })
}

/** 从流转日志推断各步骤完成日期 */
function resolveStepDates(lead: RecruitmentLead): string[] {
  const dates: string[] = new Array(RECRUITMENT_PROGRESS_STEPS.length).fill('')
  dates[0] = formatStepDate(lead.createdAt) ?? ''

  for (const log of lead.ext?.flowLog ?? []) {
    const toIdx = STATUS_STEP_INDEX[log.to as RecruitmentLeadStatus]
    if (toIdx >= 0 && !dates[toIdx]) {
      dates[toIdx] = formatStepDate(log.at) ?? ''
    }
  }

  if (lead.interviewDate && !dates[1]) {
    dates[1] = lead.interviewDate
  }

  const currentIdx = getLeadProgressStepIndex(lead.status)
  if (!dates[currentIdx]) {
    dates[currentIdx] = formatStepDate(lead.updatedAt) ?? ''
  }

  return dates
}

export function getRecruitmentProgressSteps(lead: RecruitmentLead): RecruitmentProgressStepView[] {
  const currentIdx = getLeadProgressStepIndex(lead.status)
  const stepDates = resolveStepDates(lead)

  return RECRUITMENT_PROGRESS_STEPS.map((step, index) => ({
    key: step.key,
    label: step.label,
    index,
    state: index < currentIdx ? 'done' : index === currentIdx ? 'active' : 'pending',
    date: stepDates[index] || undefined,
  }))
}

export function buildLeadFlowRecords(lead: RecruitmentLead): LeadFlowRecord[] {
  const records: LeadFlowRecord[] = []

  records.push({
    id: `${lead.id}-create`,
    title: '线索录入',
    at: lead.createdAt,
    operator: lead.assignedTo,
    details: [
      { label: '来源', value: lead.source },
      { label: '岗位', value: lead.requirementTitle },
    ],
  })

  if (lead.interviewDate) {
    records.push({
      id: `${lead.id}-interview`,
      title: '面试安排',
      at: lead.lastFollowUpAt ?? lead.updatedAt,
      operator: lead.interviewer ?? lead.assignedTo,
      details: [
        { label: '面试日期', value: lead.interviewDate },
        { label: '面试时间', value: lead.interviewTime ?? '-' },
        {
          label: '面试方式',
          value: lead.interviewMethod === 'online' ? '线上' : '线下',
        },
        ...(lead.interviewAddress
          ? [{ label: '面试地点', value: lead.interviewAddress }]
          : []),
      ],
    })
  }

  for (const [i, log] of (lead.ext?.flowLog ?? []).entries()) {
    const fromLabel = recruitmentLeadStatusMap[log.from as RecruitmentLeadStatus] ?? log.from
    const toLabel = recruitmentLeadStatusMap[log.to as RecruitmentLeadStatus] ?? log.to
    const details: { label: string; value: string }[] = [
      { label: '由', value: fromLabel },
      { label: '至', value: toLabel },
    ]
    if (log.note) details.push({ label: '备注', value: log.note })
    if (
      log.from === 'feedback_pending' &&
      (lead.ext?.interviewScore != null || lead.interviewFeedback)
    ) {
      if (lead.ext?.interviewScore != null) {
        details.push({ label: '面试评分', value: `${lead.ext.interviewScore} 分` })
      }
      if (lead.interviewFeedback) {
        details.push({ label: '面试评价', value: lead.interviewFeedback })
      }
    }
    records.push({
      id: `${lead.id}-flow-${i}`,
      title: '状态变更',
      at: log.at,
      operator: lead.assignedTo,
      details,
    })
  }

  if (lead.notes) {
    records.push({
      id: `${lead.id}-note`,
      title: '跟进备注',
      at: lead.lastFollowUpAt ?? lead.updatedAt,
      operator: lead.assignedTo,
      details: [{ label: '内容', value: lead.notes }],
    })
  }

  return records.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
}

export function formatInterviewMethod(method?: RecruitmentLead['interviewMethod']): string {
  if (method === 'online') return '线上'
  if (method === 'offline') return '线下'
  return '-'
}

export function formatGender(gender?: 'male' | 'female'): string {
  if (gender === 'male') return '男'
  if (gender === 'female') return '女'
  return '-'
}

export function getEmploymentTypeLabel(
  employmentType?: keyof typeof employmentTypeMap,
): string {
  return employmentType ? employmentTypeMap[employmentType] : '-'
}

export { formatDateTime }
