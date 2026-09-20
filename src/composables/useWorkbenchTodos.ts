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
import { normalizeWorkbenchMessageCategory } from '@/constants/workbenchMessage'

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

  const unreadMessageCount = computed(() =>
    platformMessages.value.filter((m) => !m.read).length,
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
    isPlatform,
    isEnterprise,
  }
}
