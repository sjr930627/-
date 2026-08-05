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
  countWorkbenchTodos,
  enrichFlatTodos,
} from '@/services/workbenchTodos'

export function useWorkbenchTodos() {
  const store = useAppStore()
  const { isEnterprise, isPlatform, pathPrefix } = usePortal()

  const scopedEmployees = computed(() => {
    if (!isEnterprise.value) return store.activeEmployees
    return store.activeEmployees.filter(
      (e) => !e.enterpriseId || e.enterpriseId === store.currentEnterpriseId,
    )
  })

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
  }))

  const groups = computed(() => buildWorkbenchTodoGroups(todoInput.value))
  const flatTodos = computed(() => enrichFlatTodos(groups.value))
  const totalCount = computed(() => countWorkbenchTodos(groups.value))
  const urgentCount = computed(() => flatTodos.value.filter((t) => t.level === 'urgent').length)

  const metrics = computed(() =>
    buildWorkbenchMetrics({
      employees: scopedEmployees.value,
      leads: scopedLeads.value,
      pendingApprovals: store.pendingApprovalCount,
      urgentTodoCount: urgentCount.value,
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
    isPlatform,
    isEnterprise,
  }
}
