import {
  QUALIFIED_FOLLOW_UP_DAYS,
  WORKBENCH_DEMO_NOW,
  WORKBENCH_THRESHOLDS,
  workbenchReminderCategoryMap,
  type WorkbenchReminderCategory,
  type WorkbenchReminderLevel,
} from '@/constants/workbenchReminder'
import { DEFAULT_WORKFORCE_ENTERPRISE_ID } from '@/constants/department'
import { resolveContractApprovalStatus } from '@/constants/partnership'
import { isInstanceAtEnterpriseNode } from '@/services/task'
import type {
  AttendanceException,
  GrabShiftSlot,
  InvoiceApplication,
  PendingSettlementItem,
  RecruitmentLead,
  ScheduleAssignment,
  ServiceContract,
  SettlementBill,
  Task,
  TaskInstance,
  TaskWorkflow,
} from '@/types'

export type PlatformTodoKind =
  | 'contract_audit'
  | 'grab_publish'
  | 'task_publish'
  | 'invoice'

export interface WorkbenchTodoItem {
  id: string
  category: WorkbenchReminderCategory
  level: WorkbenchReminderLevel
  icon: string
  title: string
  detail: string
  actionLabel: string
  /** 空字符串表示不可跳转（如招聘模块下线） */
  path: string
  kind?: PlatformTodoKind
  disabledReason?: string
  /** 待办生成时间（用于「今日」判定） */
  generatedAt?: string
}

export interface WorkbenchTodoGroup {
  id: WorkbenchReminderCategory
  title: string
  level: WorkbenchReminderLevel
  items: WorkbenchTodoItem[]
}

export interface BuildWorkbenchTodosInput {
  portal: 'platform' | 'enterprise'
  pathPrefix?: string
  enterpriseId?: string
  now?: Date
  recruitmentLeads: RecruitmentLead[]
  exceptions: AttendanceException[]
  grabShiftSlots: GrabShiftSlot[]
  assignments: ScheduleAssignment[]
  taskInstances: TaskInstance[]
  tasks: Task[]
  taskWorkflows: TaskWorkflow[]
  settlementBills: SettlementBill[]
  invoiceApplications: InvoiceApplication[]
  pendingSettlements: PendingSettlementItem[]
  overtimePendingCount?: number
  serviceContracts?: ServiceContract[]
  /** 平台待办解析企业名称 */
  enterprises?: Array<{ id: string; name: string }>
}

const LEVEL_RANK: Record<WorkbenchReminderLevel, number> = {
  urgent: 3,
  important: 2,
  normal: 1,
}

function hoursSince(iso: string, now: Date) {
  return (now.getTime() - new Date(iso).getTime()) / (1000 * 60 * 60)
}

function daysSince(iso: string, now: Date) {
  return hoursSince(iso, now) / 24
}

function portalPath(prefix: string, path: string) {
  if (!prefix) return path
  return path.startsWith(prefix) ? path : `${prefix}${path}`
}

function todoPath(prefix: string, path: string, query?: Record<string, string>) {
  const base = portalPath(prefix, path)
  if (!query || !Object.keys(query).length) return base
  const qs = new URLSearchParams(query).toString()
  return `${base}?${qs}`
}

function taskInstanceDetailPath(
  prefix: string,
  portal: 'platform' | 'enterprise',
  instanceId: string,
) {
  const segment =
    portal === 'enterprise' ? `/task/instances/${instanceId}` : `/task-instances/${instanceId}`
  return portalPath(prefix, segment)
}

function matchEnterprise(enterpriseId: string | undefined, itemEnterpriseId: string) {
  if (!enterpriseId) return true
  return itemEnterpriseId === enterpriseId
}

/** 线索进入「已达标」的锚点时间 */
export function getQualifiedAt(lead: RecruitmentLead): string {
  const log = [...(lead.ext?.flowLog ?? [])]
    .reverse()
    .find((item) => item.to === 'qualified')
  return log?.at ?? lead.updatedAt
}

/**
 * 已达标跟进：取已到期且尚未跟进过的最大节点（1/3/5/10/15 天）
 */
export function getDueQualifiedFollowUpDay(
  qualifiedAt: string,
  lastFollowUpAt: string | undefined,
  now: Date,
): number | null {
  const days = Math.floor(daysSince(qualifiedAt, now))
  const qualifiedTs = new Date(qualifiedAt).getTime()
  const followTs = lastFollowUpAt ? new Date(lastFollowUpAt).getTime() : 0

  let due: number | null = null
  for (const milestone of QUALIFIED_FOLLOW_UP_DAYS) {
    if (days < milestone) break
    const milestoneTs = qualifiedTs + milestone * 24 * 60 * 60 * 1000
    if (followTs < milestoneTs) due = milestone
  }
  return due
}

function qualifiedFollowUpLevel(day: number): WorkbenchReminderLevel {
  if (day >= 10) return 'urgent'
  if (day >= 5) return 'important'
  return 'normal'
}

function screeningReminderLevel(daysWaiting: number): WorkbenchReminderLevel {
  if (daysWaiting >= WORKBENCH_THRESHOLDS.screeningUrgentDays) return 'urgent'
  if (daysWaiting >= WORKBENCH_THRESHOLDS.screeningImportantDays) return 'important'
  return 'normal'
}

function formatDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function dateKeyFromIso(iso: string): string {
  return iso.slice(0, 10)
}

function isGeneratedToday(iso: string | undefined, now: Date): boolean {
  if (!iso) return false
  return dateKeyFromIso(iso) === formatDateKey(now)
}

/** 【年月日】展示：2026年7月30日 */
function formatChineseYmd(isoOrDate: string): string {
  const key = dateKeyFromIso(isoOrDate)
  const [y, m, d] = key.split('-')
  return `${y}年${Number(m)}月${Number(d)}日`
}

function resolveEnterpriseName(
  enterpriseId: string | undefined,
  enterprises: Array<{ id: string; name: string }> | undefined,
  fallback?: string,
) {
  if (enterpriseId && enterprises?.length) {
    const hit = enterprises.find((e) => e.id === enterpriseId)
    if (hit?.name) return hit.name
  }
  return fallback || '企业'
}

export function listTaskTimeoutInstances(input: {
  taskInstances: TaskInstance[]
  tasks: Task[]
  taskWorkflows: TaskWorkflow[]
  enterpriseId?: string
  now?: Date
}): TaskInstance[] {
  const { taskInstances, tasks, taskWorkflows, enterpriseId, now = WORKBENCH_DEMO_NOW } = input
  const result: TaskInstance[] = []
  for (const instance of taskInstances) {
    const task = tasks.find((t) => t.id === instance.taskId)
    if (!task || !matchEnterprise(enterpriseId, task.enterpriseId)) continue
    const workflow = taskWorkflows.find((w) => w.id === task.workflowId)
    if (!isInstanceAtEnterpriseNode(instance, workflow as never)) continue
    const hoursWaiting = hoursSince(instance.updatedAt, now)
    if (hoursWaiting >= WORKBENCH_THRESHOLDS.shiftAcceptanceAfterHours) {
      result.push(instance)
    }
  }
  return result
}

/** 平台工作台：4 类待办（按业务单据逐条生成） */
function buildPlatformTodos(input: BuildWorkbenchTodosInput): WorkbenchTodoItem[] {
  const {
    grabShiftSlots,
    tasks,
    invoiceApplications,
    serviceContracts = [],
    enterprises = [],
    pathPrefix = '',
  } = input
  const items: WorkbenchTodoItem[] = []

  for (const contract of serviceContracts) {
    if (resolveContractApprovalStatus(contract) !== 'pending') continue
    const enterpriseName = resolveEnterpriseName(contract.enterpriseId, enterprises, contract.name)
    const generatedAt = contract.submittedAt || contract.updatedAt || contract.createdAt
    items.push({
      id: `platform_contract_${contract.id}`,
      kind: 'contract_audit',
      category: 'settlement',
      level: 'urgent',
      icon: '📄',
      title: '企业合同审批',
      detail: `【${enterpriseName}】有份合同处于待审审批状态`,
      actionLabel: '去审批',
      path: todoPath(pathPrefix, `/contracts/${contract.id}`),
      generatedAt,
    })
  }

  for (const slot of grabShiftSlots) {
    if (slot.publishStatus !== 'pending') continue
    const enterpriseName = resolveEnterpriseName(
      DEFAULT_WORKFORCE_ENTERPRISE_ID,
      enterprises,
      slot.departmentName || '企业',
    )
    const position = slot.positionName || slot.shiftName || '岗位'
    const ymd = formatChineseYmd(slot.date)
    items.push({
      id: `platform_grab_${slot.id}`,
      kind: 'grab_publish',
      category: 'schedule',
      level: 'urgent',
      icon: '📤',
      title: '抢班上架审批',
      detail: `【${enterpriseName}】发起【${ymd}】-【${position}】的抢班班次上架审批`,
      actionLabel: '去审批',
      path: todoPath(pathPrefix, '/grab-shifts', { tab: 'publish' }),
      generatedAt: slot.createdAt,
    })
  }

  for (const task of tasks) {
    if (task.status !== 'pending') continue
    items.push({
      id: `platform_task_${task.id}`,
      kind: 'task_publish',
      category: 'schedule',
      level: 'urgent',
      icon: '✅',
      title: '任务上架审批',
      detail: `【${task.enterpriseName}】发起【${task.name}】的上架审批`,
      actionLabel: '去审批',
      path: todoPath(pathPrefix, '/task-approval', { status: 'pending' }),
      generatedAt: task.createdAt,
    })
  }

  for (const inv of invoiceApplications) {
    if (inv.status !== 'pending_review') continue
    items.push({
      id: `platform_invoice_${inv.id}`,
      kind: 'invoice',
      category: 'settlement',
      level: 'normal',
      icon: '🧾',
      title: '待开发票',
      detail: `【${inv.enterpriseName}】有张发票待开具`,
      actionLabel: '去处理',
      path: todoPath(pathPrefix, `/payroll/invoices/${inv.id}`),
      generatedAt: inv.submittedAt || inv.createdAt,
    })
  }

  return items
}

/**
 * 今日新增且已办结的平台待办（创建时间在今日，当前已不在待办池中）。
 * 用于「今日待办完成率」，不含历史存量。
 */
export function countTodayCompletedPlatformTodos(input: {
  grabShiftSlots: GrabShiftSlot[]
  tasks: Task[]
  invoiceApplications: InvoiceApplication[]
  serviceContracts?: ServiceContract[]
  now?: Date
}): { completed: number; urgentCompleted: number } {
  const {
    grabShiftSlots,
    tasks,
    invoiceApplications,
    serviceContracts = [],
    now = WORKBENCH_DEMO_NOW,
  } = input
  let completed = 0
  let urgentCompleted = 0

  for (const contract of serviceContracts) {
    const generatedAt = contract.submittedAt || contract.updatedAt || contract.createdAt
    if (!isGeneratedToday(generatedAt, now)) continue
    if (resolveContractApprovalStatus(contract) === 'pending') continue
    if (resolveContractApprovalStatus(contract) === 'draft') continue
    completed += 1
    urgentCompleted += 1
  }

  for (const slot of grabShiftSlots) {
    if (!isGeneratedToday(slot.createdAt, now)) continue
    const publishStatus = slot.publishStatus ?? 'published'
    if (publishStatus === 'pending') continue
    if (publishStatus === 'published' || publishStatus === 'rejected') {
      completed += 1
      urgentCompleted += 1
    }
  }

  for (const task of tasks) {
    if (!isGeneratedToday(task.createdAt, now)) continue
    if (task.status === 'pending') continue
    completed += 1
    urgentCompleted += 1
  }

  for (const inv of invoiceApplications) {
    const generatedAt = inv.submittedAt || inv.createdAt
    if (!isGeneratedToday(generatedAt, now)) continue
    if (inv.status === 'pending_review' || inv.status === 'draft') continue
    completed += 1
  }

  return { completed, urgentCompleted }
}

function buildRecruitmentTodos(input: BuildWorkbenchTodosInput): WorkbenchTodoItem[] {
  const { recruitmentLeads, enterpriseId, now = WORKBENCH_DEMO_NOW, pathPrefix = '' } = input
  const items: WorkbenchTodoItem[] = []
  const today = formatDateKey(now)

  for (const lead of recruitmentLeads) {
    if (!matchEnterprise(enterpriseId, lead.enterpriseId)) continue
    if (lead.status === 'closed' || lead.status === 'onboarded') continue

    const progressPath = todoPath(pathPrefix, '/recruitment/progress', { lead: lead.id })

    if (lead.status === 'onboarding_pending' && lead.onboardDate === today) {
      items.push({
        id: `lead_onboard_today_${lead.id}`,
        category: 'recruitment',
        level: 'urgent',
        icon: '🎉',
        title: `${lead.candidateName} · ${lead.enterpriseName}`,
        detail: `今日要入职 · ${lead.requirementTitle}`,
        actionLabel: '办理入职',
        path: progressPath,
      })
      continue
    }

    if (
      lead.interviewDate === today &&
      (lead.status === 'interview_pending' || lead.status === 'interview_attended')
    ) {
      items.push({
        id: `lead_interview_today_${lead.id}`,
        category: 'recruitment',
        level: 'urgent',
        icon: '🗓️',
        title: `${lead.candidateName} · ${lead.enterpriseName}`,
        detail: `今日面试${lead.interviewTime ? ` ${lead.interviewTime}` : ''} · ${lead.requirementTitle}`,
        actionLabel: '面试跟进',
        path: progressPath,
      })
      continue
    }

    if (lead.status === 'feedback_pending') {
      items.push({
        id: `lead_interview_followup_${lead.id}`,
        category: 'recruitment',
        level: 'important',
        icon: '📝',
        title: `${lead.candidateName} · ${lead.enterpriseName}`,
        detail: `面试待反馈，请跟进 · ${lead.requirementTitle}`,
        actionLabel: '填写反馈',
        path: progressPath,
      })
      continue
    }

    if (lead.status === 'screening') {
      const daysWaiting = Math.max(0, Math.floor(daysSince(lead.createdAt, now)))
      items.push({
        id: `lead_screening_${lead.id}`,
        category: 'recruitment',
        level: screeningReminderLevel(daysWaiting),
        icon: '📋',
        title: `${lead.candidateName} · ${lead.enterpriseName}`,
        detail:
          daysWaiting === 0
            ? `待筛选 · ${lead.requirementTitle}`
            : `待筛选已等待 ${daysWaiting} 天 · ${lead.requirementTitle}`,
        actionLabel: '去筛选',
        path: progressPath,
      })
      continue
    }

    if (lead.status === 'qualified') {
      const qualifiedAt = getQualifiedAt(lead)
      const milestone = getDueQualifiedFollowUpDay(qualifiedAt, lead.lastFollowUpAt, now)
      if (milestone != null) {
        items.push({
          id: `lead_qualified_d${milestone}_${lead.id}`,
          category: 'recruitment',
          level: qualifiedFollowUpLevel(milestone),
          icon: '🎯',
          title: `${lead.candidateName} · ${lead.enterpriseName}`,
          detail: `已达标第 ${milestone} 天跟进提醒 · ${lead.requirementTitle}`,
          actionLabel: '跟进回访',
          path: progressPath,
        })
      }
      continue
    }

    const assignedAt = lead.assignedAt ?? lead.updatedAt
    const hoursFromAssign = hoursSince(assignedAt, now)
    const daysFromCreate = daysSince(lead.createdAt, now)
    const followedRecently =
      lead.lastFollowUpAt && hoursSince(lead.lastFollowUpAt, now) < WORKBENCH_THRESHOLDS.leadFollowUpHours

    if (lead.assignedAt && !followedRecently && hoursFromAssign >= WORKBENCH_THRESHOLDS.leadFollowUpHours) {
      items.push({
        id: `lead_timeout_${lead.id}`,
        category: 'recruitment',
        level: 'urgent',
        icon: '⚠️',
        title: lead.enterpriseName,
        detail: `超${Math.floor(hoursFromAssign)}h未跟进`,
        actionLabel: '立即联系',
        path: progressPath,
      })
      continue
    }

    if (lead.assignedAt && !followedRecently && hoursFromAssign < WORKBENCH_THRESHOLDS.leadFollowUpHours) {
      items.push({
        id: `lead_new_${lead.id}`,
        category: 'recruitment',
        level: hoursFromAssign >= 2 ? 'urgent' : 'important',
        icon: '⚠️',
        title: lead.enterpriseName,
        detail: `分配${Math.max(1, Math.floor(hoursFromAssign))}h未跟进`,
        actionLabel: '立即联系',
        path: progressPath,
      })
      continue
    }

    if (lead.status === 'onboarding_pending') {
      items.push({
        id: `lead_convert_${lead.id}`,
        category: 'recruitment',
        level: 'important',
        icon: '⏰',
        title: lead.enterpriseName,
        detail: lead.onboardDate
          ? `计划入职 ${lead.onboardDate}`
          : '待入职，请推进办理',
        actionLabel: '推进入职',
        path: progressPath,
      })
      continue
    }

    if (
      daysFromCreate >= WORKBENCH_THRESHOLDS.leadChurnDays &&
      lead.status === 'interview_pending'
    ) {
      items.push({
        id: `lead_churn_${lead.id}`,
        category: 'recruitment',
        level: 'urgent',
        icon: '💡',
        title: lead.enterpriseName,
        detail: `${Math.floor(daysFromCreate)}天未转化 · 即将流失`,
        actionLabel: '挽回客户',
        path: progressPath,
      })
    }
  }

  return items
}

function buildAttendanceTodos(input: BuildWorkbenchTodosInput): WorkbenchTodoItem[] {
  const { exceptions, pathPrefix = '' } = input
  const items: WorkbenchTodoItem[] = []
  const open = exceptions.filter((e) => e.status === 'open' || e.status === 'appealed')

  for (const ex of open) {
    if (ex.type === 'missing_punch' || ex.type === 'late') {
      items.push({
        id: `att_miss_${ex.id}`,
        category: 'attendance',
        level: ex.type === 'missing_punch' ? 'urgent' : 'important',
        icon: '⚠️',
        title: ex.message.split('·')[0]?.trim() || '考勤异常',
        detail: ex.type === 'missing_punch' ? '上班未打卡' : '打卡时间晚于排班',
        actionLabel: '处理异常',
        path: todoPath(pathPrefix, `/attendance-alerts/${ex.id}`),
      })
    } else if (ex.type === 'location') {
      items.push({
        id: `att_loc_${ex.id}`,
        category: 'attendance',
        level: 'important',
        icon: '📍',
        title: ex.message.split('·')[0]?.trim() || '打卡地点偏离',
        detail: 'GPS偏离超500m',
        actionLabel: '核实位置',
        path: todoPath(pathPrefix, `/attendance-alerts/${ex.id}`),
      })
    } else if (ex.type === 'absent') {
      items.push({
        id: `att_absent_${ex.id}`,
        category: 'attendance',
        level: 'urgent',
        icon: '🚨',
        title: ex.message.split('·')[0]?.trim() || '连续旷工预警',
        detail: '连续3天未打卡',
        actionLabel: '立即处理',
        path: todoPath(pathPrefix, `/attendance-alerts/${ex.id}`),
      })
    } else {
      items.push({
        id: `att_other_${ex.id}`,
        category: 'attendance',
        level: 'important',
        icon: '✏️',
        title: ex.message.split('·')[0]?.trim() || '异常工时',
        detail: '异常工时需修正',
        actionLabel: '修正工时',
        path: todoPath(pathPrefix, `/attendance-alerts/${ex.id}`),
      })
    }
  }

  return items.slice(0, 6)
}

function buildScheduleTodos(input: BuildWorkbenchTodosInput): WorkbenchTodoItem[] {
  const {
    grabShiftSlots,
    assignments,
    taskInstances,
    tasks,
    taskWorkflows,
    enterpriseId,
    now = WORKBENCH_DEMO_NOW,
    pathPrefix = '',
  } = input
  const items: WorkbenchTodoItem[] = []

  for (const slot of grabShiftSlots) {
    if (slot.status === 'full' || slot.status === 'cancelled') continue
    const slotStart = new Date(`${slot.date}T${slot.startTime}:00+08:00`)
    const hoursToStart = (slotStart.getTime() - now.getTime()) / (1000 * 60 * 60)
    if (
      hoursToStart > 0 &&
      hoursToStart <= WORKBENCH_THRESHOLDS.shiftFillBeforeHours &&
      slot.grabbedCount < slot.requiredCount
    ) {
      items.push({
        id: `shift_fill_${slot.id}`,
        category: 'schedule',
        level: 'urgent',
        icon: '👥',
        title: `${slot.teamName} · ${slot.shiftName}`,
        detail: `班次开始前${Math.ceil(hoursToStart)}h仍缺编 ${slot.requiredCount - slot.grabbedCount} 人`,
        actionLabel: '抢班管理',
        path: todoPath(pathPrefix, '/grab-shifts', {
          slot: slot.id,
          group: slot.attendanceGroupId,
        }),
      })
    }
  }

  const pendingConfirm = assignments.filter(
    (a) => a.published && a.confirmStatus === 'pending',
  )
  for (const asn of pendingConfirm.slice(0, 2)) {
    items.push({
      id: `sched_confirm_${asn.id}`,
      category: 'schedule',
      level: 'important',
      icon: '📅',
      title: '排班待确认',
      detail: `${asn.date} 排班提交待灵工确认`,
      actionLabel: '查看排班',
      path: todoPath(pathPrefix, '/schedule-manage', {
        team: asn.teamId ?? '',
        date: asn.date,
        employee: asn.employeeId,
      }),
    })
  }

  for (const instance of listTaskTimeoutInstances({
    taskInstances,
    tasks,
    taskWorkflows,
    enterpriseId,
    now,
  })) {
    items.push({
      id: `task_accept_${instance.id}`,
      category: 'schedule',
      level: 'important',
      icon: '⏱',
      title: instance.taskName,
      detail: `验收超时 ${Math.floor(hoursSince(instance.updatedAt, now))}h · ${instance.workerName}`,
      actionLabel: '立即验收',
      path: taskInstanceDetailPath(pathPrefix, input.portal, instance.id),
    })
  }

  if ((input.overtimePendingCount ?? 0) > 0) {
    items.push({
      id: 'sched_ot_pending',
      category: 'schedule',
      level: 'normal',
      icon: '📝',
      title: '加班审批',
      detail: `${input.overtimePendingCount} 条排班相关审批待处理`,
      actionLabel: '去审批',
      path: todoPath(pathPrefix, '/approvals', { tab: 'overtime' }),
    })
  }

  return items.slice(0, 6)
}

function buildSettlementTodos(input: BuildWorkbenchTodosInput): WorkbenchTodoItem[] {
  const {
    settlementBills,
    invoiceApplications,
    pendingSettlements,
    enterpriseId,
    portal,
    pathPrefix = '',
  } = input
  const items: WorkbenchTodoItem[] = []

  if (pendingSettlements.length > 0) {
    for (const item of pendingSettlements.slice(0, 4)) {
      items.push({
        id: `settle_daily_${item.id}`,
        category: 'settlement',
        level: 'important',
        icon: '💰',
        title: item.employeeName,
        detail: `${item.month} 工时待确认 · 预估 ${item.estimatedIncome} 元`,
        actionLabel: '确认工时',
        path: todoPath(
          pathPrefix,
          portal === 'enterprise' ? '/payroll/bills' : '/payroll/settlement',
          { keyword: item.employeeName },
        ),
      })
    }
  }

  for (const bill of settlementBills) {
    if (!matchEnterprise(enterpriseId, bill.enterpriseId)) continue

    if (bill.paymentFailed) {
      items.push({
        id: `bill_fail_${bill.id}`,
        category: 'settlement',
        level: 'urgent',
        icon: '❌',
        title: bill.enterpriseName,
        detail: `打款失败 · ${bill.billNo}`,
        actionLabel: '重新打款',
        path: portalPath(pathPrefix, `/payroll/bills/${bill.id}`),
      })
      continue
    }

    if (bill.status === 'pending_confirm' && portal === 'enterprise') {
      items.push({
        id: `bill_confirm_${bill.id}`,
        category: 'settlement',
        level: 'important',
        icon: '📋',
        title: bill.enterpriseName,
        detail: `账单待确认 · ${bill.billNo}`,
        actionLabel: '确认账单',
        path: portalPath(pathPrefix, `/payroll/bills/${bill.id}`),
      })
    }

    if (bill.status === 'pending_payment' && portal === 'platform') {
      items.push({
        id: `bill_pay_${bill.id}`,
        category: 'settlement',
        level: 'important',
        icon: '🏦',
        title: bill.enterpriseName,
        detail: `账单待审核打款 · ${bill.billNo}`,
        actionLabel: '审核打款',
        path: portalPath(pathPrefix, `/payroll/bills/${bill.id}`),
      })
    }
  }

  for (const inv of invoiceApplications) {
    if (!matchEnterprise(enterpriseId, inv.enterpriseId)) continue
    if (inv.status === 'draft' || inv.status === 'pending_review' || inv.status === 'reviewing') {
      items.push({
        id: `inv_${inv.id}`,
        category: 'settlement',
        level: inv.status === 'draft' ? 'normal' : 'important',
        icon: '🧾',
        title: inv.enterpriseName,
        detail:
          inv.status === 'draft'
            ? '月度发票待开具'
            : `发票待审核 · ${inv.applicationNo}`,
        actionLabel: inv.status === 'draft' ? '开具发票' : '审核发票',
        path:
          inv.status === 'draft'
            ? todoPath(pathPrefix, '/payroll/invoices/apply')
            : todoPath(pathPrefix, `/payroll/invoices/${inv.id}`),
      })
    }
  }

  return items.slice(0, 6)
}

function groupLevel(items: WorkbenchTodoItem[]): WorkbenchReminderLevel {
  if (!items.length) return 'normal'
  return items.reduce<WorkbenchReminderLevel>(
    (max, item) => (LEVEL_RANK[item.level] > LEVEL_RANK[max] ? item.level : max),
    'normal',
  )
}

export function buildWorkbenchTodoGroups(input: BuildWorkbenchTodosInput): WorkbenchTodoGroup[] {
  if (input.portal === 'platform') {
    const items = buildPlatformTodos(input)
    if (!items.length) return []
    return [
      {
        id: 'settlement',
        title: '待办事项',
        level: groupLevel(items),
        items,
      },
    ]
  }

  const categoryBuilders: Record<WorkbenchReminderCategory, () => WorkbenchTodoItem[]> = {
    recruitment: () => buildRecruitmentTodos(input),
    attendance: () => buildAttendanceTodos(input),
    schedule: () => buildScheduleTodos(input),
    settlement: () => buildSettlementTodos(input),
  }

  return (Object.keys(categoryBuilders) as WorkbenchReminderCategory[])
    .map((id) => {
      const items = categoryBuilders[id]()
      if (!items.length) return null
      const meta = workbenchReminderCategoryMap[id]
      return {
        id,
        title: meta.title,
        level: groupLevel(items),
        items,
      }
    })
    .filter((g): g is WorkbenchTodoGroup => g !== null)
}

export function countWorkbenchTodos(groups: WorkbenchTodoGroup[]) {
  return groups.reduce((sum, g) => sum + g.items.length, 0)
}

export function flattenWorkbenchTodos(groups: WorkbenchTodoGroup[]): WorkbenchTodoItem[] {
  return groups.flatMap((g) => g.items)
}

export interface WorkbenchFlatTodo extends WorkbenchTodoItem {
  groupTitle: string
  subtitle: string
  deadlineLabel: string
  isToday: boolean
}

export function enrichFlatTodos(
  groups: WorkbenchTodoGroup[],
  now: Date = WORKBENCH_DEMO_NOW,
): WorkbenchFlatTodo[] {
  return groups.flatMap((group) =>
    group.items.map((item) => ({
      ...item,
      groupTitle: group.title,
      subtitle: item.detail,
      deadlineLabel:
        item.level === 'urgent' ? '紧急' : item.level === 'important' ? '重要' : '普通',
      // 有 generatedAt 时按「当日生成」判定；否则兼容企业端（紧急≈今日）
      isToday:
        item.generatedAt != null
          ? isGeneratedToday(item.generatedAt, now)
          : item.level === 'urgent',
    })),
  )
}
