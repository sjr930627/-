import { computed } from 'vue'
import { useAppStore } from '@/stores/app'
import { usePortal } from '@/composables/usePortal'
import {
  buildAttendanceAlertItems,
  buildDepartmentOpenRoles,
  buildRecruitmentFunnel,
  buildRecruitmentReminderItems,
  buildWorkbenchMetrics,
} from '@/services/workbenchDashboard'
import {
  buildWorkbenchTodoGroups,
  countTodayCompletedPlatformTodos,
  countWorkbenchTodos,
  enrichFlatTodos,
} from '@/services/workbenchTodos'
import {
  normalizeWorkbenchMessageCategory,
  type WorkbenchMessageCategory,
} from '@/constants/workbenchMessage'
import type { Notification } from '@/types'

function inferEnterpriseMessageCategory(
  message: Pick<Notification, 'title' | 'content' | 'type'>,
): WorkbenchMessageCategory | null {
  const text = `${message.title} ${message.content}`
  if (/合同/.test(text)) return 'contract'
  if (/账单|资金|提现|发票/.test(text)) return 'fund'
  if (
    message.type === 'schedule' ||
    message.type === 'attendance' ||
    /班次|排班|抢班|工时|出勤|打卡/.test(text)
  ) {
    return 'shift'
  }
  return null
}

/** 企业工作台消息：班次 / 合同 / 资金，与运营后台同一套分类 */
function toEnterpriseWorkbenchMessage(message: Notification): Notification | null {
  if (message.portal === 'platform') return null
  const normalized = normalizeWorkbenchMessageCategory(message.category)
  if (normalized) {
    if (message.portal && message.portal !== 'enterprise') return null
    return normalized === message.category ? message : { ...message, category: normalized }
  }
  if (message.portal && message.portal !== 'enterprise') return null
  const category = inferEnterpriseMessageCategory(message)
  if (!category) return null
  return { ...message, category }
}

export function useWorkbenchTodos() {
  const store = useAppStore()
  const { isEnterprise, isPlatform, pathPrefix } = usePortal()

  const scopedLeads = computed(() => {
    if (!isEnterprise.value) return store.recruitmentLeads
    return store.recruitmentLeads.filter((l) => l.enterpriseId === store.currentEnterpriseId)
  })

  const scopedRequirements = computed(() => {
    if (!isEnterprise.value) return store.jobRequirements
    return store.jobRequirements.filter((r) => r.enterpriseId === store.currentEnterpriseId)
  })

  const todoInput = computed(() => ({
    portal: (isEnterprise.value ? 'enterprise' : 'platform') as 'platform' | 'enterprise',
    pathPrefix: pathPrefix.value,
    enterpriseId: isEnterprise.value ? store.currentEnterpriseId : undefined,
    recruitmentLeads: scopedLeads.value,
    exceptions: store.exceptions,
    grabShiftSlots: store.grabShiftSlots,
    assignments: store.assignments,
    taskInstances: store.taskInstances,
    tasks: store.tasks,
    taskWorkflows: store.taskWorkflows,
    settlementBills: store.settlementBills,
    invoiceApplications: store.invoiceApplications,
    pendingSettlements: store.pendingSettlements,
    overtimePendingCount: store.overtimeRequests.filter((r) => r.status === 'pending').length,
    serviceContracts: store.serviceContracts,
    enterprises: store.enterprises.map((e) => ({ id: e.id, name: e.name })),
  }))

  const groups = computed(() => buildWorkbenchTodoGroups(todoInput.value))
  const flatTodos = computed(() => enrichFlatTodos(groups.value))
  const totalCount = computed(() => countWorkbenchTodos(groups.value))
  const urgentCount = computed(() => flatTodos.value.filter((t) => t.level === 'urgent').length)

  const platformMessages = computed(() =>
    store.notifications
      .filter((n) => {
        if (n.portal && n.portal !== 'platform') return false
        return Boolean(normalizeWorkbenchMessageCategory(n.category))
      })
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  )

  const enterpriseMessages = computed(() =>
    store.notifications
      .map((message) => toEnterpriseWorkbenchMessage(message))
      .filter((message): message is Notification => message != null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
  )

  const workbenchMessages = computed(() =>
    isEnterprise.value ? enterpriseMessages.value : platformMessages.value,
  )

  const unreadMessageCount = computed(() =>
    workbenchMessages.value.filter((m) => !m.read).length,
  )

  const todayCompleted = computed(() => {
    if (!isPlatform.value) return { completed: 0, urgentCompleted: 0 }
    return countTodayCompletedPlatformTodos({
      grabShiftSlots: store.grabShiftSlots,
      tasks: store.tasks,
      invoiceApplications: store.invoiceApplications,
      serviceContracts: store.serviceContracts,
    })
  })

  const metrics = computed(() =>
    buildWorkbenchMetrics({
      todos: flatTodos.value,
      todayCompletedCount: todayCompleted.value.completed,
      todayCompletedUrgentCount: todayCompleted.value.urgentCompleted,
      unreadMessageCount: unreadMessageCount.value,
    }),
  )

  const recruitmentReminders = computed(() =>
    buildRecruitmentReminderItems({
      leads: scopedLeads.value,
      pathPrefix: pathPrefix.value,
    }),
  )

  const attendanceAlerts = computed(() =>
    buildAttendanceAlertItems({
      exceptions: store.exceptions,
      employees: store.activeEmployees,
      departments: store.departments,
      pathPrefix: pathPrefix.value,
    }),
  )

  const recruitmentFunnel = computed(() => buildRecruitmentFunnel(scopedLeads.value))
  const departmentOpenRoles = computed(() => buildDepartmentOpenRoles(scopedRequirements.value))

  return {
    groups,
    flatTodos,
    totalCount,
    urgentCount,
    metrics,
    recruitmentReminders,
    attendanceAlerts,
    recruitmentFunnel,
    departmentOpenRoles,
    platformMessages,
    enterpriseMessages,
    workbenchMessages,
    isPlatform,
    isEnterprise,
  }
}
