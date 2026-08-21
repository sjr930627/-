import { defineStore } from 'pinia'
import type {
  AttendanceException,
  AttendanceGroup,
  AttendanceGroupPricingConfig,
  AttendanceGroupPricingTemplate,
  AttendanceGroupSettlementOverride,
  AttendanceManualAdjustment,
  AttendancePunch,
  AttendanceRule,
  AttendanceStatus,
  Department,
  Employee,
  Holiday,
  JobRequirement,
  RecruitmentLead,
  Talent,
  IntegrationLog,
  InvoiceApplication,
  EnterpriseInvoiceProfile,
  LeaveRequest,
  MakeupPunchRequest,
  Notification,
  OvertimeRequest,
  PayrollConfig,
  PendingSettlementItem,
  ScheduleAssignment,
  SchedulePublishRecord,
  ScheduleRule,
  ScheduleTemplate,
  ShiftDemandDayCell,
  TeamCycleScheduleRule,
  WeeklyShiftDemandPlan,
  ServiceContract,
  ServiceProvider,
  Shift,
  SettlementBill,
  SettlementBillLine,
  SettlementBillSourceType,
  SettlementBillSummary,
  SettlementManageOrder,
  SettlementManageType,
  SettlementSlip,
  SettlementSlipLine,
  TaxDeclaration,
  TaxDeclarationWorker,
  TaxWithdrawalLine,
  BillingRule,
  BillImportTemplate,
  GrabShiftSlot,
  GrabShiftApplication,
  GrabShiftWhitelistEntry,
  GrabInterviewConfig,
  GrabInterviewRegistration,
  GrabInterviewDeptRule,
  GrabInterviewPositionTemplate,
  CancelShiftRequest,
  SwapRequest,
  SystemRole,
  SystemAccount,
  SystemOperationLog,
  Task,
  TaskInstance,
  TaskInstanceLog,
  TaskType,
  TaskTypeSettlementOverride,
  TaskWorkflow,
  Enterprise,
  EnterpriseSettlementConfig,
  Team,
  InsuranceProduct,
  InsurancePolicy,
  TrainingMaterial,
  TrainingMaterialCategoryItem,
  TrainingCourse,
  TrainingExam,
  ExamQuestion,
  ExamAttempt,
  AiRiskScenario,
  AiQuestionDifficulty,
  ExamQuestionType,
  MiniAppMessage,
  WorkerIncomeRecord,
  MiniJobApplication,
  WorkerAgreement,
  WorkerPaymentBinding,
  WorkerProfileExt,
  WorkerSchedulePreference,
  WorkerUnavailablePeriod,
  WorkerPartTimePreference,
  WorkerSkillCertificate,
  ProviderFundAccount,
  FundTransaction,
  ReminderRule,
} from '@/types'
import {
  createUnassignedDepartment,
  isUnassignedDepartment,
  isEnterpriseRootDepartment,
  createEnterpriseRootDepartment,
  createEnterpriseUnassignedDepartment,
  enterpriseUnassignedDepartmentId,
  parseDepartmentJoinQrPayload,
  UNASSIGNED_POSITION,
} from '@/constants/department'
import {
  defaultAttendanceRule,
  defaultPayrollConfig,
  defaultScheduleRule,
  seedAssignmentsWithDemo,
  seedDepartments,
  seedEmployees,
  seedExceptions,
  seedHolidays,
  seedIntegrationLogs,
  seedLeaveRequests,
  seedMakeupRequests,
  seedManualOverrides,
  seedNotifications,
  seedOvertimeRequests,
  seedPublishRecordsWithDemo,
  seedPunches,
  seedShifts,
  seedCancelShiftRequests,
  seedSwapRequests,
  seedTeams,
} from '@/mock/seed'
import {
  RECRUITMENT_STATUS_FLOW,
  seedJobRequirements,
  seedRecruitmentLeads,
  seedTalents,
} from '@/mock/recruitmentSeed'
import { seedAttendanceGroups } from '@/mock/attendanceGroupSeed'
import { seedPricingTemplates } from '@/mock/pricingTemplateSeed'
import { normalizePricingConfig } from '@/constants/attendanceGroupPricing'
import {
  buildVersionRecord,
  ensureGroupVersions,
} from '@/services/attendanceGroupVersion'
import { seedEnterpriseRoleTemplates, buildEnterpriseRolesForAll, buildEnterpriseRoleId, seedSystemRoles, findEnterpriseRoleByCode } from '@/mock/permissionSeed'
import { seedSystemAccounts } from '@/mock/accountSeed'
import { seedSystemOperationLogs } from '@/mock/operationLogSeed'
import { seedServiceContracts, seedServiceProviders } from '@/mock/partnershipSeed'
import { DEFAULT_WORKFORCE_ENTERPRISE_ID } from '@/constants/department'
import { seedEnterpriseWorkforceSnapshots } from '@/mock/workforceSeed'
import { mergeWorkforceSeed } from '@/mock/enterpriseWorkforceSeed'
import { seedFundTransactions, seedProviderFundAccounts } from '@/mock/fundManagementSeed'
import {
  computeProviderPendingClaimable,
  summarizeAllProviders,
  summarizeProviderFunds,
} from '@/services/fundManagement'
import {
  platformPaymentAccount,
  seedPendingSettlements,
  seedSettlementBills,
} from '@/mock/payrollBillSeed'
import { seedInvoiceApplications, seedEnterpriseInvoiceProfiles } from '@/mock/invoiceSeed'
import { seedBillingRules } from '@/mock/billingRuleSeed'
import { seedBillImportTemplates } from '@/mock/billImportTemplateSeed'
import { seedSettlementManageOrders, seedSettlementSlips } from '@/mock/settlementManageSeed'
import { seedTaxDeclarations } from '@/mock/taxDeclarationSeed'
import { seedGrabShiftSlots } from '@/mock/grabShiftSeed'
import { seedGrabShiftApplications } from '@/mock/grabShiftApplicationSeed'
import { seedGrabShiftWhitelist } from '@/mock/grabShiftWhitelistSeed'
import {
  seedGrabInterviewConfigs,
  seedGrabInterviewRegistrations,
} from '@/mock/grabInterviewSeed'
import {
  normalizeDeptInterviewRule,
  normalizeGrabInterviewDeptRule,
} from '@/constants/grabInterview'
import { isAssignmentConfirmedLocked, normalizeConfirmStatus } from '@/constants/schedule'
import { seedScheduleTemplates } from '@/mock/scheduleTemplateSeed'
import {
  seedTeamCycleScheduleRules,
  seedWeeklyShiftDemandPlans,
} from '@/mock/shiftDemandSeed'
import { generateCycleSchedule } from '@/services/schedule'
import {
  expandUnavailablePeriods,
  isEmployeeUnavailableInRange,
  isEmployeeUnavailableOnDate,
} from '@/services/employeeAvailability'
import { seedInsurancePolicies, seedInsuranceProducts } from '@/mock/insuranceSeed'
import {
  seedExamAttempts,
  loadCourseLearningRecords,
  loadExamQuestions,
  loadTrainingCoursesAndExams,
  loadTrainingMaterialCategories,
  loadTrainingMaterials,
} from '@/mock/trainingSeed'
import {
  seedMiniAppMessages,
  seedMiniJobApplications,
  seedWorkerAgreements,
  seedWorkerIncomeRecords,
  seedWorkerPaymentBindings,
  seedWorkerProfileExts,
} from '@/mock/miniappSeed'
import { seedReminderRules } from '@/mock/reminderRuleSeed'
import {
  calcProfileCompleteness,
  inferScheduleVariant,
  maskIdCard,
} from '@/services/miniAppProfile'
import {
  seedEnterprises,
  seedTaskInstances,
  seedTasks,
  seedTaskTypes,
  seedTaskWorkflows,
} from '@/mock/taskSeed'
import {
  seedAttendanceGroupSettlementOverrides,
  seedEnterpriseSettlementConfigs,
  seedTaskTypeSettlementOverrides,
} from '@/mock/settlementPriceSeed'
import {
  getAttendanceGroupsForEnterprise,
  resolveHourlySettlementPrice,
  resolveTaskTypeSettlementPrice as resolveTaskTypePrice,
} from '@/services/settlementPrice'
import {
  advanceThroughSystemNodes,
  extractEnterpriseActionNote,
  generateTaskName,
  getWorkerExecutingNode,
  getWorkflowFieldsForNode,
  isWorkflowCompletedEndNode,
  resolveTransitionTarget,
  validateWorkflowNodeFields,
} from '@/services/task'
import {
  getCancelledEndNode,
  getNodeById,
  nodeHasAction,
  resolveActionTargetNodeId,
} from '@/utils/workflow'
import {
  getWorkerClaimedQuantity,
  pickWorkerSubmitAction,
} from '@/services/miniTask'
import { resolveTaskPricing } from '@/constants/task'
import { generateEnterpriseCode, normalizeEnterpriseModules } from '@/constants/enterprise'
import { normalizeSystemAccount, accountHasRole } from '@/constants/account'
import { unionMenuPermissions, unionPermissionIds } from '@/constants/permission'
import { generateContractNo, generateServiceProviderCode, addContractRenewPeriod, resolveContractRenewBaseDate, contractRenewPeriodOptions, type ContractRenewPeriod } from '@/constants/partnership'
import {
  applyContractConfig,
  createContractVersion,
  ensureContractVersions,
  findContractByPair,
  getEffectiveVersion,
  getWorkingVersion,
  pickContractConfig,
  restoreEffectiveConfig,
} from '@/services/contractVersion'
import { generateId, ensureDemoBrandingVersion, ensureEnterpriseInvoiceProfiles, ensureFundTransactions, ensureSettlementBills, ensureSettlementManageOrders, ensureWorkerIncomeSeed, getDepartmentDescendantIds, loadFromStorage, saveToStorage } from '@/utils'
import { resolveEnterpriseIdByDepartment } from '@/utils/enterpriseScope'
import { generateBillNo, resolveBillTaxFlagsFromContract, resolveServiceProviderForEnterprise } from '@/services/billSettlement'
import { estimateServiceFeeWaiverByQuantity } from '@/constants/payrollBill'
import { resolveWithdrawalChannel } from '@/constants/taxManage'
import { deriveExceptions, getDatesBetween, buildDailyAttendanceList, getMonthDateRange, computeDailyAttendance } from '@/services/attendance'
import {
  resolveGroupScheduleRule,
  scheduleRuleToCompliance,
  getTeamsForAttendanceGroup,
} from '@/services/scheduleGroup'
import {
  createPolicyFromPunch,
  findAutoInsuranceProduct,
  hasActivePolicyForDate,
  shouldAutoInsure,
} from '@/services/insurance'
import {
  countMaterialReferences,
  formatCourseGateBlockMessage,
  generateAiRiskQuestions,
  getBlockingCoursesForEmployee,
  getExamQuestions,
  gradeExamAnswers,
  type CourseGateKind,
} from '@/services/training'

function normalizeManualOverrides(
  raw: Record<string, AttendanceStatus | AttendanceManualAdjustment>,
): Record<string, AttendanceManualAdjustment> {
  const result: Record<string, AttendanceManualAdjustment> = {}
  Object.entries(raw).forEach(([key, value]) => {
    result[key] = typeof value === 'string' ? { status: value } : value
  })
  return result
}

function normalizeWorkforceEnterpriseId<T extends { enterpriseId?: string }>(items: T[]): T[] {
  return items.map((item) => ({
    ...item,
    enterpriseId: item.enterpriseId ?? DEFAULT_WORKFORCE_ENTERPRISE_ID,
  }))
}

function loadWorkforceSeed() {
  const merged = mergeWorkforceSeed(
    loadFromStorage<Department[]>('departments', seedDepartments),
    loadFromStorage<Employee[]>('employees', seedEmployees),
    loadFromStorage<Team[]>('teams', seedTeams),
    loadFromStorage<AttendanceGroup[]>('attendanceGroups', seedAttendanceGroups),
  )
  return {
    departments: normalizeWorkforceEnterpriseId(merged.departments),
    employees: normalizeWorkforceEnterpriseId(merged.employees),
    teams: merged.teams,
    attendanceGroups: merged.attendanceGroups,
  }
}

export const useAppStore = defineStore('app', {
  state: () => {
    ensureDemoBrandingVersion()
    const trainingData = loadTrainingCoursesAndExams()
    const workforceSeed = loadWorkforceSeed()
    return {
    departments: workforceSeed.departments,
    teams: workforceSeed.teams,
    employees: workforceSeed.employees,
    shifts: loadFromStorage<Shift[]>('shifts', seedShifts),
    holidays: loadFromStorage<Holiday[]>('holidays', seedHolidays),
    scheduleRule: loadFromStorage<ScheduleRule>('scheduleRule', defaultScheduleRule),
    assignments: loadFromStorage<ScheduleAssignment[]>('assignments', seedAssignmentsWithDemo),
    grabShiftSlots: loadFromStorage<GrabShiftSlot[]>('grabShiftSlots', seedGrabShiftSlots),
    grabShiftApplications: loadFromStorage<GrabShiftApplication[]>(
      'grabShiftApplications',
      seedGrabShiftApplications,
    ),
    grabShiftWhitelist: loadFromStorage<GrabShiftWhitelistEntry[]>(
      'grabShiftWhitelist',
      seedGrabShiftWhitelist,
    ),
    grabInterviewConfigs: loadFromStorage<GrabInterviewConfig[]>(
      'grabInterviewConfigs',
      seedGrabInterviewConfigs,
    ),
    grabInterviewRegistrations: loadFromStorage<GrabInterviewRegistration[]>(
      'grabInterviewRegistrations',
      seedGrabInterviewRegistrations,
    ),
    scheduleTemplates: loadFromStorage<ScheduleTemplate[]>('scheduleTemplates', seedScheduleTemplates),
    weeklyShiftDemandPlans: loadFromStorage<WeeklyShiftDemandPlan[]>(
      'weeklyShiftDemandPlans',
      seedWeeklyShiftDemandPlans,
    ),
    teamCycleScheduleRules: loadFromStorage<TeamCycleScheduleRule[]>(
      'teamCycleScheduleRules',
      seedTeamCycleScheduleRules,
    ),
    publishRecords: loadFromStorage<SchedulePublishRecord[]>('publishRecords', seedPublishRecordsWithDemo),
    notifications: loadFromStorage<Notification[]>('notifications', seedNotifications),
    attendanceRule: loadFromStorage<AttendanceRule>('attendanceRule', defaultAttendanceRule),
    punches: loadFromStorage<AttendancePunch[]>('punches', seedPunches),
    leaveRequests: loadFromStorage<LeaveRequest[]>('leaveRequests', seedLeaveRequests),
    swapRequests: loadFromStorage<SwapRequest[]>('swapRequests', seedSwapRequests),
    cancelShiftRequests: loadFromStorage<CancelShiftRequest[]>(
      'cancelShiftRequests',
      seedCancelShiftRequests,
    ),
    makeupRequests: loadFromStorage<MakeupPunchRequest[]>('makeupRequests', seedMakeupRequests),
    exceptions: loadFromStorage<AttendanceException[]>('exceptions', seedExceptions),
    manualOverrides: normalizeManualOverrides(
      loadFromStorage<Record<string, AttendanceStatus | AttendanceManualAdjustment>>(
        'manualOverrides',
        seedManualOverrides,
      ),
    ),
    overtimeRequests: loadFromStorage<OvertimeRequest[]>('overtimeRequests', seedOvertimeRequests),
    payrollConfig: loadFromStorage<PayrollConfig>('payrollConfig', defaultPayrollConfig),
    integrationLogs: loadFromStorage<IntegrationLog[]>('integrationLogs', seedIntegrationLogs),
    taskWorkflows: loadFromStorage<TaskWorkflow[]>('taskWorkflows', seedTaskWorkflows),
    taskTypes: loadFromStorage<TaskType[]>('taskTypes', seedTaskTypes),
    tasks: loadFromStorage<Task[]>('tasks', seedTasks),
    taskInstances: loadFromStorage<TaskInstance[]>('taskInstances', seedTaskInstances),
    enterprises: loadFromStorage<Enterprise[]>('enterprises', seedEnterprises),
    enterpriseSettlementConfigs: loadFromStorage<EnterpriseSettlementConfig[]>(
      'enterpriseSettlementConfigs',
      seedEnterpriseSettlementConfigs,
    ),
    attendanceGroupSettlementOverrides: loadFromStorage<AttendanceGroupSettlementOverride[]>(
      'attendanceGroupSettlementOverrides',
      seedAttendanceGroupSettlementOverrides,
    ),
    taskTypeSettlementOverrides: loadFromStorage<TaskTypeSettlementOverride[]>(
      'taskTypeSettlementOverrides',
      seedTaskTypeSettlementOverrides,
    ),
    currentEnterpriseId: loadFromStorage<string>(
      'currentEnterpriseId',
      'ent_china_mobile_agent',
    ),
    jobRequirements: loadFromStorage<JobRequirement[]>('jobRequirements', seedJobRequirements),
    recruitmentLeads: loadFromStorage<RecruitmentLead[]>('recruitmentLeads', seedRecruitmentLeads),
    talents: loadFromStorage<Talent[]>('talents', seedTalents),
    attendanceGroups: workforceSeed.attendanceGroups.map(
      (g): AttendanceGroup => {
        const normalized = {
          ...g,
          pricingConfig:
            g.attendanceType === 'none'
              ? undefined
              : g.pricingConfig
                ? normalizePricingConfig(g.pricingConfig)
                : undefined,
        }
        return ensureGroupVersions(normalized)
      },
    ),
    pricingTemplates: loadFromStorage<AttendanceGroupPricingTemplate[]>(
      'pricingTemplates',
      seedPricingTemplates,
    ).map((t) => ({
      ...t,
      config: normalizePricingConfig(t.config),
    })),
    systemRoles: loadFromStorage<SystemRole[]>(
      'systemRoles',
      [...seedSystemRoles, ...buildEnterpriseRolesForAll(seedEnterprises)],
    ),
    enterpriseRoleTemplates: loadFromStorage<SystemRole[]>(
      'enterpriseRoleTemplates',
      seedEnterpriseRoleTemplates,
    ),
    systemAccounts: loadFromStorage<SystemAccount[]>('systemAccounts', seedSystemAccounts).map(
      normalizeSystemAccount,
    ),
    systemOperationLogs: loadFromStorage<SystemOperationLog[]>(
      'systemOperationLogs',
      seedSystemOperationLogs,
    ),
    serviceProviders: loadFromStorage<ServiceProvider[]>('serviceProviders', seedServiceProviders),
    serviceContracts: loadFromStorage<ServiceContract[]>('serviceContracts', seedServiceContracts).map(
      (c) => ensureContractVersions({ ...c, versions: c.versions ? c.versions.map((v) => ({ ...v })) : undefined }),
    ),
    settlementBills: ensureSettlementBills(
      loadFromStorage<SettlementBill[]>('settlementBills', seedSettlementBills),
    ),
    billingRules: loadFromStorage<BillingRule[]>('billingRules', seedBillingRules),
    billImportTemplates: loadFromStorage<BillImportTemplate[]>(
      'billImportTemplates',
      seedBillImportTemplates,
    ),
    pendingSettlements: loadFromStorage<PendingSettlementItem[]>(
      'pendingSettlements',
      seedPendingSettlements,
    ),
    settlementManageOrders: ensureSettlementManageOrders(
      loadFromStorage<SettlementManageOrder[]>(
        'settlementManageOrders',
        seedSettlementManageOrders,
      ),
      seedSettlementManageOrders,
    ),
    settlementSlips: loadFromStorage<SettlementSlip[]>('settlementSlips', seedSettlementSlips),
    taxDeclarations: loadFromStorage<TaxDeclaration[]>('taxDeclarations', seedTaxDeclarations),
    invoiceApplications: loadFromStorage<InvoiceApplication[]>(
      'invoiceApplications',
      seedInvoiceApplications,
    ),
    enterpriseInvoiceProfiles: ensureEnterpriseInvoiceProfiles(
      loadFromStorage<EnterpriseInvoiceProfile[]>(
        'enterpriseInvoiceProfiles',
        seedEnterpriseInvoiceProfiles,
      ),
      seedEnterpriseInvoiceProfiles,
    ),
    insuranceProducts: loadFromStorage<InsuranceProduct[]>('insuranceProducts', seedInsuranceProducts),
    insurancePolicies: loadFromStorage<InsurancePolicy[]>('insurancePolicies', seedInsurancePolicies),
    trainingMaterials: loadTrainingMaterials(),
    trainingMaterialCategories: loadTrainingMaterialCategories(),
    trainingCourses: trainingData.courses,
    trainingExams: trainingData.exams,
    examQuestions: loadExamQuestions(),
    courseLearningRecords: loadCourseLearningRecords(),
    examAttempts: loadFromStorage<ExamAttempt[]>('examAttempts', seedExamAttempts),
    miniAppMessages: loadFromStorage<MiniAppMessage[]>('miniAppMessages', seedMiniAppMessages),
    workerIncomeRecords: ensureWorkerIncomeSeed(
      loadFromStorage<WorkerIncomeRecord[]>('workerIncomeRecords', seedWorkerIncomeRecords),
      seedWorkerIncomeRecords,
    ),
    miniJobApplications: loadFromStorage<MiniJobApplication[]>(
      'miniJobApplications',
      seedMiniJobApplications,
    ),
    workerAgreements: loadFromStorage<WorkerAgreement[]>('workerAgreements', seedWorkerAgreements),
    workerPaymentBindings: loadFromStorage<WorkerPaymentBinding[]>(
      'workerPaymentBindings',
      seedWorkerPaymentBindings,
    ),
    workerProfileExts: loadFromStorage<WorkerProfileExt[]>(
      'workerProfileExts',
      seedWorkerProfileExts,
    ),
    platformPaymentAccount,
    providerFundAccounts: loadFromStorage<ProviderFundAccount[]>(
      'providerFundAccounts',
      seedProviderFundAccounts,
    ),
    fundTransactions: ensureFundTransactions(
      loadFromStorage<FundTransaction[]>('fundTransactions', seedFundTransactions),
      seedFundTransactions,
    ),
    reminderRules: loadFromStorage<ReminderRule[]>('reminderRules', seedReminderRules),
    }
  },

  getters: {
    activeEmployees: (state) => state.employees.filter((e) => e.status === 'active'),
    unreadNotificationCount: (state) => state.notifications.filter((n) => !n.read).length,
    pendingApprovalCount: (state) =>
      state.leaveRequests.filter((r) => r.status === 'pending').length +
      state.swapRequests.filter((r) => r.status === 'pending').length +
      state.makeupRequests.filter((r) => r.status === 'pending').length +
      state.overtimeRequests.filter((r) => r.status === 'pending').length +
      state.tasks.filter((t) => t.status === 'pending').length,
    pendingAttendanceApprovalCount: (state) =>
      state.makeupRequests.filter((r) => r.status === 'pending').length +
      state.cancelShiftRequests.filter((r) => r.status === 'pending').length,
    pendingScheduleAttendanceApprovalCount: (state) => {
      const isSchedule = (employeeId: string, date: string) =>
        !state.assignments.find((a) => a.employeeId === employeeId && a.date === date)?.fromGrabSlotId
      return (
        state.makeupRequests.filter((r) => r.status === 'pending' && isSchedule(r.employeeId, r.date))
          .length +
        state.cancelShiftRequests.filter(
          (r) => r.status === 'pending' && isSchedule(r.employeeId, r.date),
        ).length
      )
    },
    pendingGrabAttendanceApprovalCount: (state) => {
      const isGrab = (employeeId: string, date: string) =>
        Boolean(
          state.assignments.find((a) => a.employeeId === employeeId && a.date === date)?.fromGrabSlotId,
        )
      return (
        state.makeupRequests.filter((r) => r.status === 'pending' && isGrab(r.employeeId, r.date))
          .length +
        state.cancelShiftRequests.filter((r) => r.status === 'pending' && isGrab(r.employeeId, r.date))
          .length
      )
    },
    openExceptionCount: (state) =>
      state.exceptions.filter((e) => e.status === 'open' || e.status === 'appealed').length,
    currentEnterprise: (state) =>
      state.enterprises.find((e) => e.id === state.currentEnterpriseId) ?? state.enterprises[0],
    enabledWorkflows: (state) => state.taskWorkflows.filter((w) => w.status === 'enabled'),
    getScheduleRuleForGroup: (state) => (groupId: string): ScheduleRule => {
      const group = state.attendanceGroups.find((g) => g.id === groupId)
      if (!group) return state.scheduleRule
      return resolveGroupScheduleRule(group)
    },
    getTeamsForGroup: (state) => (groupId: string) => {
      const group = state.attendanceGroups.find((g) => g.id === groupId)
      if (!group) return []
      return getTeamsForAttendanceGroup(group, state.teams, state.departments)
    },
    getContractsByProvider: (state) => (providerId: string) =>
      state.serviceContracts.filter((c) => c.providerId === providerId),
    getDepartmentsByEnterprise: (state) => (enterpriseId: string) =>
      state.departments.filter(
        (d) => (d.enterpriseId ?? DEFAULT_WORKFORCE_ENTERPRISE_ID) === enterpriseId,
      ),
    getEnterpriseRoles: (state) => (enterpriseId: string) =>
      state.systemRoles.filter(
        (r) => r.rolePortal === 'enterprise' && r.enterpriseId === enterpriseId,
      ),
    getAccountRoles: (state) => (account: SystemAccount) =>
      account.roleIds
        .map((id) => state.systemRoles.find((r) => r.id === id))
        .filter((r): r is SystemRole => Boolean(r)),
    resolveAccountMenuPermissions: (state) => (account: SystemAccount) => {
      const roles = account.roleIds
        .map((id) => state.systemRoles.find((r) => r.id === id))
        .filter((r): r is SystemRole => Boolean(r))
      return unionMenuPermissions(roles.map((r) => r.menuPermissions ?? []))
    },
    resolveAccountPermissionIds: (state) => (account: SystemAccount) => {
      const roles = account.roleIds
        .map((id) => state.systemRoles.find((r) => r.id === id))
        .filter((r): r is SystemRole => Boolean(r))
      return unionPermissionIds(roles.map((r) => r.permissionIds))
    },
    getEmployeesByEnterprise: (state) => (enterpriseId: string) =>
      state.employees.filter(
        (e) => (e.enterpriseId ?? DEFAULT_WORKFORCE_ENTERPRISE_ID) === enterpriseId,
      ),
    getAttendanceGroupsByEnterprise: (state) => (enterpriseId: string) =>
      getAttendanceGroupsForEnterprise(enterpriseId, state.attendanceGroups, state.departments),
    getTaskTypesByEnterprise: (state) => (enterpriseId: string) =>
      state.taskTypes.filter((t) => t.enterpriseId === enterpriseId),
    resolveGroupSettlementPrice: (state) => (enterpriseId: string, attendanceGroupId: string) => {
      const group = state.attendanceGroups.find((g) => g.id === attendanceGroupId)
      return resolveHourlySettlementPrice(
        enterpriseId,
        attendanceGroupId,
        state.attendanceGroupSettlementOverrides,
        group,
      )
    },
    resolveTaskTypeSettlementPrice: (state) => (enterpriseId: string, taskType: TaskType) =>
      resolveTaskTypePrice(enterpriseId, taskType, state.taskTypeSettlementOverrides),
    getFundAccountsByProvider: (state) => (providerId: string) =>
      state.providerFundAccounts.filter((account) => account.providerId === providerId),
    getFundTransactionsByProvider: (state) => (providerId: string) =>
      state.fundTransactions
        .filter((transaction) => transaction.providerId === providerId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    getProviderFundSummary: (state) => (providerId: string) => {
      const pendingClaimable = computeProviderPendingClaimable(
        providerId,
        state.serviceProviders,
        state.employees,
        state.departments,
        state.workerIncomeRecords,
      )
      return summarizeProviderFunds(providerId, state.providerFundAccounts, pendingClaimable)
    },
    getAllProviderFundSummaries: (state) =>
      summarizeAllProviders(
        state.serviceProviders,
        state.providerFundAccounts,
        state.employees,
        state.departments,
        state.workerIncomeRecords,
      ),
    getEnterpriseWorkforceStats: (state) => (enterpriseId: string) => {
      const depts = state.departments.filter(
        (d) => (d.enterpriseId ?? DEFAULT_WORKFORCE_ENTERPRISE_ID) === enterpriseId,
      )
      const employees = state.employees.filter(
        (e) => (e.enterpriseId ?? DEFAULT_WORKFORCE_ENTERPRISE_ID) === enterpriseId,
      )
      const deptIds = new Set(depts.map((d) => d.id))
      const teams = state.teams.filter((t) => deptIds.has(t.departmentId))
      const snapshot = seedEnterpriseWorkforceSnapshots[enterpriseId]
      const groupIds = new Set(
        state.attendanceGroups
          .filter((g) =>
            g.departmentBindings.some((b) => deptIds.has(b.departmentId)),
          )
          .map((g) => g.id),
      )

      const liveDepartmentCount = depts.filter(
        (d) => !isUnassignedDepartment(d.id) && d.orgType !== 'enterprise',
      ).length

      /** 演示快照优先，保证后台「企业人员统计」指标有稳定可读数据；需求缺口始终按招聘需求实时汇总 */
      const demandGap = state.jobRequirements
        .filter((j) => j.enterpriseId === enterpriseId && j.status !== 'completed')
        .reduce((sum, j) => sum + Math.max(0, (j.headcount ?? 0) - (j.filledCount ?? 0)), 0)

      const liveShiftGap = state.grabShiftSlots
        .filter(
          (s) =>
            groupIds.has(s.attendanceGroupId) &&
            s.status !== 'cancelled' &&
            s.status !== 'full',
        )
        .reduce((sum, s) => sum + Math.max(0, (s.requiredCount ?? 0) - (s.grabbedCount ?? 0)), 0)

      if (snapshot) {
        const scheduleEmployeeCount =
          snapshot.scheduleEmployeeCount ??
          Math.max(0, (snapshot.activeCount ?? 0) - (snapshot.grabPoolCount ?? 0))
        const grabPoolCount = snapshot.grabPoolCount ?? 0
        return {
          departmentCount: Math.max(snapshot.departmentCount, liveDepartmentCount),
          scheduleEmployeeCount,
          grabPoolCount,
          employeeCount: scheduleEmployeeCount,
          activeCount: scheduleEmployeeCount + grabPoolCount,
          pendingCount: snapshot.pendingCount,
          resignedCount: snapshot.resignedCount,
          teamCount: Math.max(snapshot.teamCount, teams.length),
          onDutyCount: snapshot.onDutyCount,
          absentCount: snapshot.absentCount,
          demandGap,
          shiftGap: snapshot.shiftGap ?? liveShiftGap,
        }
      }

      const emptyStats = {
        departmentCount: liveDepartmentCount,
        scheduleEmployeeCount: 0,
        grabPoolCount: 0,
        employeeCount: 0,
        activeCount: 0,
        pendingCount: 0,
        resignedCount: 0,
        teamCount: teams.length,
        onDutyCount: 0,
        absentCount: 0,
        demandGap,
        shiftGap: liveShiftGap,
      }

      if (!employees.length) return emptyStats

      const isGrabPersonnel = (e: (typeof employees)[number]) => e.personnelCategory === 'grab'
      const activeEmployees = employees.filter((e) => e.status === 'active')
      const scheduleActive = activeEmployees.filter((e) => !isGrabPersonnel(e))
      const grabActive = activeEmployees.filter((e) => isGrabPersonnel(e))
      const activeIds = new Set(scheduleActive.map((e) => e.id))
      const punchDates = state.punches
        .filter((p) => activeIds.has(p.employeeId))
        .map((p) => p.date)
      const assignmentDates = state.assignments
        .filter((a) => activeIds.has(a.employeeId) && !a.fromGrabSlotId)
        .map((a) => a.date)
      const candidateDates = [...punchDates, ...assignmentDates].sort()
      const today =
        candidateDates[candidateDates.length - 1] || new Date().toISOString().slice(0, 10)

      const clockedIn = new Set(
        state.punches
          .filter(
            (p) => activeIds.has(p.employeeId) && p.date === today && p.type === 'clock_in',
          )
          .map((p) => p.employeeId),
      )

      let onDutyCount = 0
      let absentCount = 0
      scheduleActive.forEach((emp) => {
        const asn = state.assignments.find(
          (a) => a.employeeId === emp.id && a.date === today && !a.fromGrabSlotId,
        )
        const shift = asn ? state.shifts.find((s) => s.id === asn.shiftId) : undefined
        const scheduled = Boolean(shift && shift.code !== 'REST')
        if (clockedIn.has(emp.id)) {
          onDutyCount += 1
        } else if (scheduled) {
          absentCount += 1
        }
      })

      if (onDutyCount === 0 && absentCount === 0 && scheduleActive.length > 0) {
        onDutyCount = Math.max(1, Math.round(scheduleActive.length * 0.88))
        absentCount = Math.max(0, scheduleActive.length - onDutyCount)
        if (absentCount === 0 && scheduleActive.length > 3) {
          absentCount = Math.max(1, Math.round(scheduleActive.length * 0.06))
          onDutyCount = Math.max(0, scheduleActive.length - absentCount)
        }
      }

      return {
        departmentCount: liveDepartmentCount,
        scheduleEmployeeCount: scheduleActive.length,
        grabPoolCount: grabActive.length,
        employeeCount: scheduleActive.length,
        activeCount: activeEmployees.length,
        pendingCount: employees.filter((e) => e.status === 'pending').length,
        resignedCount: employees.filter((e) => e.status === 'resigned').length,
        teamCount: teams.length,
        onDutyCount,
        absentCount,
        demandGap,
        shiftGap: liveShiftGap,
      }
    },
    invoiceableBills: (state) =>
      state.settlementBills.filter(
        (b) => b.status === 'paid' && b.invoicedAmount < b.totalPayable,
      ),
  },

  actions: {
    persist(key: keyof typeof this.$state) {
      saveToStorage(key as string, this[key])
    },

    // Department
    ensureEnterpriseOrgStructure(enterpriseId: string) {
      const ent = this.enterprises.find((e) => e.id === enterpriseId)
      if (!ent) return

      const rootId = createEnterpriseRootDepartment(enterpriseId, ent.name).id
      const unassignedId = createEnterpriseUnassignedDepartment(enterpriseId).id
      let changed = false

      if (!this.departments.some((d) => d.id === rootId)) {
        this.departments.push(createEnterpriseRootDepartment(enterpriseId, ent.name))
        changed = true
      } else {
        const root = this.departments.find((d) => d.id === rootId)!
        if (root.name !== ent.name) {
          root.name = ent.name
          changed = true
        }
        if (root.enterpriseId !== enterpriseId) {
          root.enterpriseId = enterpriseId
          changed = true
        }
      }

      if (!this.departments.some((d) => d.id === unassignedId)) {
        this.departments.push(createEnterpriseUnassignedDepartment(enterpriseId))
        changed = true
      } else {
        const unassigned = this.departments.find((d) => d.id === unassignedId)!
        if (unassigned.enterpriseId !== enterpriseId) {
          unassigned.enterpriseId = enterpriseId
          changed = true
        }
      }

      if (changed) this.persist('departments')
    },

    ensureAllEnterpriseOrgStructures() {
      this.enterprises.forEach((ent) => this.ensureEnterpriseOrgStructure(ent.id))
    },

    addDepartment(dept: Omit<Department, 'id'>) {
      const item: Department = { ...dept, id: generateId('dept') }
      this.departments.push(item)
      this.persist('departments')
      return item
    },
    updateDepartment(id: string, data: Partial<Department>) {
      if (isUnassignedDepartment(id)) throw new Error('待入驻人员为系统部门，不可编辑')
      const existing = this.departments.find((d) => d.id === id)
      if (existing && isEnterpriseRootDepartment(existing)) {
        throw new Error('企业根节点不可编辑')
      }
      const idx = this.departments.findIndex((d) => d.id === id)
      if (idx >= 0) {
        this.departments[idx] = { ...this.departments[idx], ...data }
        this.persist('departments')
      }
    },
    removeDepartment(id: string) {
      if (isUnassignedDepartment(id)) throw new Error('待入驻人员为系统部门，不可删除')
      const existing = this.departments.find((d) => d.id === id)
      if (existing && isEnterpriseRootDepartment(existing)) {
        throw new Error('企业根节点不可删除')
      }
      const hasChildren = this.departments.some((d) => d.parentId === id)
      if (hasChildren) throw new Error('请先删除子部门')
      if (this.employees.some((e) => e.departmentId === id)) throw new Error('部门下仍有员工')
      this.departments = this.departments.filter((d) => d.id !== id)
      this.persist('departments')
    },
    reorderDepartment(
      dragId: string,
      targetId: string,
      position: 'before' | 'after' | 'inner',
    ) {
      if (isUnassignedDepartment(dragId) || isUnassignedDepartment(targetId)) {
        throw new Error('待入驻人员为系统部门，不可调整顺序')
      }
      const drag = this.departments.find((d) => d.id === dragId)
      const target = this.departments.find((d) => d.id === targetId)
      if (!drag || !target) return
      if (isEnterpriseRootDepartment(drag) || isEnterpriseRootDepartment(target)) {
        throw new Error('企业根节点不可调整顺序')
      }

      const descendantIds = getDepartmentDescendantIds(this.departments, dragId)
      if (descendantIds.has(targetId)) throw new Error('不能移动到自身或子部门下')

      const newParentId = position === 'inner' ? targetId : target.parentId
      if (newParentId && descendantIds.has(newParentId)) {
        throw new Error('不能移动到自身或子部门下')
      }

      drag.parentId = newParentId

      const siblings = this.departments
        .filter((d) => d.parentId === newParentId && d.id !== dragId)
        .sort((a, b) => a.sort - b.sort)

      let ordered: Department[]
      if (position === 'inner') {
        ordered = [...siblings, drag]
      } else {
        const targetIndex = siblings.findIndex((s) => s.id === targetId)
        const insertAt = position === 'before' ? Math.max(targetIndex, 0) : targetIndex + 1
        ordered = [...siblings.slice(0, insertAt), drag, ...siblings.slice(insertAt)]
      }

      ordered.forEach((dept, index) => {
        dept.sort = index + 1
      })
      this.persist('departments')
    },

    // Team
    addTeam(team: Omit<Team, 'id'>) {
      const item: Team = { ...team, id: generateId('team'), memberIds: team.memberIds ?? [] }
      this.teams.push(item)
      this.persist('teams')
      return item
    },
    updateTeam(id: string, data: Partial<Team>) {
      const idx = this.teams.findIndex((t) => t.id === id)
      if (idx >= 0) {
        this.teams[idx] = { ...this.teams[idx], ...data }
        this.persist('teams')
      }
    },
    removeTeam(id: string) {
      this.teams = this.teams.filter((t) => t.id !== id)
      this.assignments = this.assignments.filter((a) => a.teamId !== id)
      this.persist('teams')
      this.persist('assignments')
    },

    // Employee
    addEmployee(emp: Omit<Employee, 'id'>) {
      const item: Employee = {
        ...emp,
        id: generateId('emp'),
        skills: emp.skills ?? [],
        skillCertificates: emp.skillCertificates ?? [],
        preferredShiftIds: emp.preferredShiftIds ?? [],
        unavailableDates: emp.unavailableDates ?? [],
        realNameVerified: emp.realNameVerified ?? false,
      }
      this.employees.push(item)
      this.persist('employees')
      return item
    },
    updateEmployee(id: string, data: Partial<Employee>) {
      const idx = this.employees.findIndex((e) => e.id === id)
      if (idx >= 0) {
        this.employees[idx] = { ...this.employees[idx], ...data }
        this.persist('employees')
      }
    },
    removeEmployee(id: string) {
      this.employees = this.employees.filter((e) => e.id !== id)
      this.teams.forEach((t) => {
        t.memberIds = t.memberIds.filter((mid) => mid !== id)
      })
      this.assignments = this.assignments.filter((a) => a.employeeId !== id)
      this.persist('employees')
      this.persist('teams')
      this.persist('assignments')
    },
    batchAssignEmployees(
      ids: string[],
      departmentId: string,
      position: string,
      options?: { employeeNo?: string },
    ) {
      if (isUnassignedDepartment(departmentId)) {
        throw new Error('请选择具体部门进行分配')
      }
      if (!position.trim()) throw new Error('请填写岗位')
      ids.forEach((id) => {
        const existing = this.employees.find((e) => e.id === id)
        const patch: Partial<Employee> = {
          departmentId,
          position: position.trim(),
          applyDepartmentId: undefined,
          onboardingStage: undefined,
          ...(existing?.status !== 'resigned' ? { status: 'active' as const } : {}),
        }
        if (options?.employeeNo?.trim()) {
          patch.employeeNo = options.employeeNo.trim()
        }
        this.updateEmployee(id, patch)
      })
    },

    /** 待申请人员：直接分配岗位与人员 ID */
    assignPendingOnboardEmployee(
      employeeId: string,
      data: { departmentId: string; position: string; employeeNo: string },
    ) {
      const emp = this.employees.find((e) => e.id === employeeId)
      if (!emp) throw new Error('人员不存在')
      if (!data.employeeNo.trim()) throw new Error('请填写人员 ID')
      this.batchAssignEmployees([employeeId], data.departmentId, data.position, {
        employeeNo: data.employeeNo,
      })
    },

    /** 已申请入驻：审批通过并分配部门、岗位、人员 ID */
    approveOnboardApplication(
      employeeId: string,
      data: { departmentId: string; position: string; employeeNo: string },
    ) {
      const emp = this.employees.find((e) => e.id === employeeId)
      if (!emp) throw new Error('人员不存在')
      if (emp.onboardingStage !== 'applied' && emp.status === 'pending') {
        // 仍允许审批待申请以外的已申请
      }
      if (!data.employeeNo.trim()) throw new Error('请填写人员 ID')
      this.batchAssignEmployees([employeeId], data.departmentId, data.position, {
        employeeNo: data.employeeNo,
      })
    },

    /** 灵工扫码申请入驻企业-部门 */
    applyJoinDepartmentByQr(
      qrPayload: string,
      applicant: { name: string; phone?: string; employeeId?: string },
    ) {
      const parsed = parseDepartmentJoinQrPayload(qrPayload)
      if (!parsed) throw new Error('无效的入驻二维码')
      const dept = this.departments.find((d) => d.id === parsed.departmentId)
      if (!dept) throw new Error('目标部门不存在')
      if (isUnassignedDepartment(dept.id) || isEnterpriseRootDepartment(dept)) {
        throw new Error('请扫描具体业务部门二维码')
      }
      const enterpriseId =
        parsed.enterpriseId ||
        resolveEnterpriseIdByDepartment(dept.id, this.departments) ||
        dept.enterpriseId
      if (!enterpriseId) throw new Error('无法识别企业')
      this.ensureEnterpriseOrgStructure(enterpriseId)
      const unassignedId = enterpriseUnassignedDepartmentId(enterpriseId)

      if (applicant.employeeId) {
        const existing = this.employees.find((e) => e.id === applicant.employeeId)
        if (existing) {
          this.updateEmployee(existing.id, {
            status: 'pending',
            onboardingStage: 'applied',
            applyDepartmentId: dept.id,
            departmentId: unassignedId,
            enterpriseId,
            position: UNASSIGNED_POSITION,
            hireDate: existing.hireDate || new Date().toISOString().slice(0, 10),
          })
          return existing
        }
      }

      const dup = this.employees.find(
        (e) =>
          e.status === 'pending' &&
          e.phone === applicant.phone &&
          e.enterpriseId === enterpriseId,
      )
      if (dup) {
        this.updateEmployee(dup.id, {
          onboardingStage: 'applied',
          applyDepartmentId: dept.id,
          departmentId: unassignedId,
        })
        return dup
      }

      return this.addEmployee({
        name: applicant.name.trim() || '新申请人员',
        employeeNo: `T${Date.now().toString().slice(-6)}`,
        departmentId: unassignedId,
        enterpriseId,
        position: UNASSIGNED_POSITION,
        hireDate: new Date().toISOString().slice(0, 10),
        skills: [],
        preferredShiftIds: [],
        unavailableDates: [],
        status: 'pending',
        onboardingStage: 'applied',
        applyDepartmentId: dept.id,
        phone: applicant.phone,
        realNameVerified: false,
      })
    },

    // Shift
    addShift(shift: Omit<Shift, 'id'>) {
      const item: Shift = { ...shift, id: generateId('shift') }
      this.shifts.push(item)
      this.persist('shifts')
      return item
    },
    updateShift(id: string, data: Partial<Shift>) {
      const idx = this.shifts.findIndex((s) => s.id === id)
      if (idx >= 0) {
        this.shifts[idx] = { ...this.shifts[idx], ...data }
        this.persist('shifts')
      }
    },
    removeShift(id: string) {
      if (this.assignments.some((a) => a.shiftId === id)) throw new Error('班次已被排班引用')
      this.shifts = this.shifts.filter((s) => s.id !== id)
      this.persist('shifts')
    },

    // Holiday
    addHoliday(holiday: Omit<Holiday, 'id'>) {
      const item: Holiday = { ...holiday, id: generateId('hol') }
      this.holidays.push(item)
      this.persist('holidays')
      return item
    },
    updateHoliday(id: string, data: Partial<Holiday>) {
      const idx = this.holidays.findIndex((h) => h.id === id)
      if (idx >= 0) {
        this.holidays[idx] = { ...this.holidays[idx], ...data }
        this.persist('holidays')
      }
    },
    removeHoliday(id: string) {
      this.holidays = this.holidays.filter((h) => h.id !== id)
      this.persist('holidays')
    },

    // Schedule Rule
    updateScheduleRule(rule: ScheduleRule) {
      this.scheduleRule = { ...rule }
      this.persist('scheduleRule')
    },

    assertCourseGateForEmployee(employeeId: string, gate: CourseGateKind) {
      const blocked = getBlockingCoursesForEmployee(
        employeeId,
        this.trainingCourses,
        this.courseLearningRecords,
        this.employees,
        this.departments,
        gate,
      )
      if (blocked.length > 0) {
        throw new Error(formatCourseGateBlockMessage(blocked, gate))
      }
    },

    // Assignment
    upsertAssignment(
      data: Omit<ScheduleAssignment, 'id' | 'published'> & {
        id?: string
        published?: boolean
        confirmStatus?: ScheduleAssignment['confirmStatus']
        note?: string
        manualEdited?: boolean
      },
    ) {
      this.assertCourseGateForEmployee(data.employeeId, 'schedule')
      const emp = this.employees.find((e) => e.id === data.employeeId)
      if (isEmployeeUnavailableOnDate(emp, data.date)) {
        throw new Error('该灵工已配置请假/不上岗，所选日期无法排班')
      }
      const published = data.published ?? false
      const existing = this.assignments.find(
        (a) =>
          a.employeeId === data.employeeId &&
          a.date === data.date &&
          a.published === published,
      )
      if (existing) {
        existing.shiftId = data.shiftId
        existing.teamId = data.teamId
        existing.published = published
        if (data.fromGrabSlotId) existing.fromGrabSlotId = data.fromGrabSlotId
        if (published) {
          if (data.confirmStatus !== undefined) existing.confirmStatus = data.confirmStatus
        } else {
          existing.confirmStatus = undefined
        }
        if (data.note !== undefined) existing.note = data.note
        if (data.manualEdited !== undefined) existing.manualEdited = data.manualEdited
      } else {
        this.assignments.push({
          id: generateId('asn'),
          employeeId: data.employeeId,
          shiftId: data.shiftId,
          date: data.date,
          teamId: data.teamId,
          fromGrabSlotId: data.fromGrabSlotId,
          published,
          confirmStatus: published ? (data.confirmStatus ?? 'pending') : undefined,
          note: data.note,
          manualEdited: data.manualEdited ?? false,
        })
      }
      this.persist('assignments')
    },
    removeAssignment(employeeId: string, date: string, published?: boolean) {
      this.assignments = this.assignments.filter((a) => {
        if (a.employeeId !== employeeId || a.date !== date) return true
        if (published === undefined) return false
        return a.published !== published
      })
      this.persist('assignments')
    },
    getAssignment(employeeId: string, date: string) {
      const all = this.assignments.filter(
        (a) => a.employeeId === employeeId && a.date === date,
      )
      return all.find((a) => a.published) ?? all[0]
    },

    publishSchedule(month: string, teamId: string, publishedBy = '排班员') {
      const team = this.teams.find((t) => t.id === teamId)
      if (!team) throw new Error('班组不存在')

      const monthAssignments = this.assignments.filter(
        (a) =>
          a.teamId === teamId &&
          a.date.startsWith(month) &&
          team.memberIds.includes(a.employeeId),
      )

      monthAssignments.forEach((a) => {
        a.published = true
      })

      const record: SchedulePublishRecord = {
        id: generateId('pub'),
        month,
        teamId,
        publishedAt: new Date().toISOString(),
        publishedBy,
        employeeCount: team.memberIds.length,
        assignmentCount: monthAssignments.length,
      }
      this.publishRecords.unshift(record)

      const notification: Notification = {
        id: generateId('ntf'),
        title: '排班发布通知',
        content: `${month} ${team.name} 排班表已发布，共 ${monthAssignments.length} 条排班记录，请相关员工查收。`,
        type: 'schedule',
        createdAt: new Date().toISOString(),
        read: false,
      }
      this.notifications.unshift(notification)

      this.persist('assignments')
      this.persist('publishRecords')
      this.persist('notifications')
      return record
    },

    publishSchedulePeriod(teamId: string, dates: string[], publishedBy = '排班员') {
      const team = this.teams.find((t) => t.id === teamId)
      if (!team) throw new Error('班组不存在')
      const month = dates[0]?.slice(0, 7) ?? ''
      const nextAssignments: ScheduleAssignment[] = []
      const notifyEmployeeIds = new Set<string>()
      let changedCount = 0

      team.memberIds.forEach((employeeId) => {
        dates.forEach((date) => {
          const cell = this.assignments.filter(
            (a) =>
              a.employeeId === employeeId &&
              a.date === date &&
              a.teamId === teamId,
          )
          const draft = cell.find((a) => !a.published)
          const published = cell.find((a) => a.published)

          // 已确认班次原样保留，不可被草稿覆盖
          if (isAssignmentConfirmedLocked(published)) {
            nextAssignments.push({ ...published! })
            return
          }

          const source = draft ?? published
          if (!source) return

          const shiftChanged =
            Boolean(draft) &&
            (!published ||
              draft!.shiftId !== published.shiftId ||
              (draft!.note ?? '') !== (published.note ?? ''))
          const isNew = Boolean(draft) && !published
          const needsConfirm = Boolean(draft) && (isNew || shiftChanged || !published)

          nextAssignments.push({
            ...source,
            id: published && !draft ? published.id : generateId('asn'),
            published: true,
            confirmStatus: needsConfirm
              ? 'pending'
              : published?.confirmStatus ?? 'pending',
            manualEdited: false,
          })

          if (needsConfirm) {
            notifyEmployeeIds.add(employeeId)
            changedCount += 1
          }
        })
      })

      this.assignments = this.assignments.filter(
        (a) =>
          !(
            a.teamId === teamId &&
            dates.includes(a.date) &&
            team.memberIds.includes(a.employeeId)
          ),
      )
      this.assignments.push(...nextAssignments)

      const prevVersion = this.publishRecords
        .filter((r) => r.teamId === teamId && r.month === month)
        .reduce((max, r) => Math.max(max, r.version ?? 0), 0)
      const version = prevVersion + 1

      const record: SchedulePublishRecord = {
        id: generateId('pub'),
        month,
        teamId,
        publishedAt: new Date().toISOString(),
        publishedBy,
        employeeCount: team.memberIds.length,
        assignmentCount: nextAssignments.length,
        version,
        periodStart: dates[0],
        periodEnd: dates[dates.length - 1],
        changeNote:
          version === 1
            ? '首次发布'
            : changedCount > 0
              ? `排班更新（通知 ${notifyEmployeeIds.size} 人）`
              : '排班更新',
        snapshot: JSON.parse(JSON.stringify(nextAssignments)) as ScheduleAssignment[],
      }
      this.publishRecords.unshift(record)

      this.pushNotification({
        title: '排班发布通知',
        content:
          changedCount > 0
            ? `${team.name} 排班已更新，已通知 ${notifyEmployeeIds.size} 位灵工确认待确认班次`
            : `${team.name} 排班已发布（无待确认变更）`,
        type: 'schedule',
      })

      // 向受影响灵工推送小程序排班确认消息
      const group = this.attendanceGroups.find((g) => g.id === team.attendanceGroupId)
      notifyEmployeeIds.forEach((employeeId) => {
        const related = nextAssignments.filter(
          (a) =>
            a.employeeId === employeeId &&
            normalizeConfirmStatus(a.confirmStatus) === 'pending',
        )
        if (!related.length) return
        const first = related[0]
        const shift = this.shifts.find((s) => s.id === first.shiftId)
        const shiftLabel = shift?.name ?? '班次'
        const shiftTime =
          shift && shift.code !== 'REST'
            ? `${shift.startTime.slice(0, 5)}-${shift.endTime.slice(0, 5)}`
            : ''
        const dateText =
          related.length === 1
            ? first.date
            : `${related.length} 个日期（含 ${first.date}）`
        this.miniAppMessages.unshift({
          id: generateId('msg'),
          employeeId,
          category: 'schedule',
          actionType: 'schedule_confirm',
          title: `排班已更新，请确认【${team.name}】${shiftLabel}`,
          content: `班次：【${team.name}】${shiftLabel}${shiftTime ? ` · ${shiftTime}` : ''} · ${dateText}，请确认是否可出勤。`,
          read: false,
          createdAt: new Date().toISOString(),
          scheduleDetail: {
            enterpriseName: group?.name ?? team.name,
            groupName: team.name,
            shiftLabel,
            shiftTime,
            date: first.date,
            hourlyRate: team.hourlyRate ?? 0,
            confirmBefore: `${first.date}T23:59:00`,
            confirmStatus: 'pending',
          },
        })
      })
      if (notifyEmployeeIds.size) this.persist('miniAppMessages')

      this.persist('assignments')
      this.persist('publishRecords')
      return record
    },

    getSchedulePublishHistory(teamId: string, month?: string) {
      return this.publishRecords
        .filter((r) => r.teamId === teamId && (!month || r.month === month))
        .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    },

    restoreSchedulePublishVersion(recordId: string) {
      const record = this.publishRecords.find((r) => r.id === recordId)
      if (!record?.snapshot?.length) throw new Error('版本快照不存在')
      const team = this.teams.find((t) => t.id === record.teamId)
      if (!team) throw new Error('班组不存在')

      record.snapshot.forEach((item) => {
        const published = this.assignments.find(
          (a) =>
            a.employeeId === item.employeeId &&
            a.date === item.date &&
            a.published &&
            (a.teamId ?? record.teamId) === record.teamId,
        )
        if (isAssignmentConfirmedLocked(published)) return
        this.removeAssignment(item.employeeId, item.date, false)
        this.upsertAssignment({
          employeeId: item.employeeId,
          shiftId: item.shiftId,
          date: item.date,
          teamId: item.teamId ?? record.teamId,
          published: false,
          note: item.note,
          manualEdited: true,
        })
      })
      this.persist('assignments')
      return record.snapshot.length
    },

    revertDraftForPeriod(teamId: string, dates: string[]) {
      const team = this.teams.find((t) => t.id === teamId)
      if (!team) return
      this.assignments = this.assignments.filter((a) => {
        if (a.teamId !== teamId || !dates.includes(a.date)) return true
        if (!team.memberIds.includes(a.employeeId)) return true
        return a.published
      })
      this.persist('assignments')
    },

    saveScheduleTemplate(data: Omit<ScheduleTemplate, 'id' | 'createdAt'>) {
      const item: ScheduleTemplate = {
        ...data,
        id: generateId('stpl'),
        createdAt: new Date().toISOString(),
      }
      if (item.isDefault) {
        this.scheduleTemplates.forEach((t) => {
          if (t.teamId === item.teamId) t.isDefault = false
        })
      }
      this.scheduleTemplates.unshift(item)
      this.persist('scheduleTemplates')
      return item
    },

    deleteScheduleTemplate(id: string) {
      this.scheduleTemplates = this.scheduleTemplates.filter((t) => t.id !== id)
      this.persist('scheduleTemplates')
    },

    applyScheduleTemplate(
      templateId: string,
      teamId: string,
      dates: string[],
      memberIds: string[],
    ) {
      const template = this.scheduleTemplates.find((t) => t.id === templateId)
      if (!template) throw new Error('模板不存在')
      let count = 0
      memberIds.forEach((employeeId, empIdx) => {
        dates.forEach((date, dayIdx) => {
          const shiftId = template.pattern[(dayIdx + empIdx) % template.pattern.length]
          this.upsertAssignment({
            employeeId,
            shiftId,
            date,
            teamId,
            published: false,
            manualEdited: false,
          })
          count += 1
        })
      })
      return count
    },

    cloneAssignmentsFromDates(
      teamId: string,
      sourceDates: string[],
      targetDates: string[],
      memberIds: string[],
    ) {
      if (sourceDates.length !== targetDates.length) {
        throw new Error('源日期与目标日期数量不一致')
      }
      let count = 0
      memberIds.forEach((employeeId) => {
        sourceDates.forEach((srcDate, idx) => {
          const targetDate = targetDates[idx]
          const published = this.assignments.find(
            (a) =>
              a.employeeId === employeeId &&
              a.date === targetDate &&
              a.teamId === teamId &&
              a.published,
          )
          if (isAssignmentConfirmedLocked(published)) return
          const src = this.getAssignment(employeeId, srcDate)
          if (!src || src.teamId !== teamId) return
          this.upsertAssignment({
            employeeId,
            shiftId: src.shiftId,
            date: targetDate,
            teamId,
            published: false,
            manualEdited: true,
          })
          count += 1
        })
      })
      return count
    },

    enterEditModeForPeriod(teamId: string, dates: string[]) {
      const team = this.teams.find((t) => t.id === teamId)
      if (!team) return
      team.memberIds.forEach((employeeId) => {
        dates.forEach((date) => {
          const published = this.assignments.find(
            (a) =>
              a.employeeId === employeeId &&
              a.date === date &&
              a.published &&
              a.teamId === teamId,
          )
          // 已确认班次不可进入草稿编辑，须走取消班次
          if (isAssignmentConfirmedLocked(published)) return
          const draft = this.assignments.find(
            (a) =>
              a.employeeId === employeeId &&
              a.date === date &&
              !a.published &&
              a.teamId === teamId,
          )
          if (published && !draft) {
            this.upsertAssignment({
              employeeId,
              shiftId: published.shiftId,
              date,
              teamId,
              published: false,
              note: published.note,
              manualEdited: false,
            })
          }
        })
      })
    },

    markNotificationRead(id: string) {
      const n = this.notifications.find((item) => item.id === id)
      if (n) {
        n.read = true
        this.persist('notifications')
      }
    },
    markAllNotificationsRead() {
      this.notifications.forEach((n) => {
        n.read = true
      })
      this.persist('notifications')
    },

    pushNotification(notification: Omit<Notification, 'id' | 'createdAt' | 'read'>) {
      this.notifications.unshift({
        ...notification,
        id: generateId('ntf'),
        createdAt: new Date().toISOString(),
        read: false,
      })
      this.persist('notifications')
    },

    updateAttendanceRule(rule: AttendanceRule) {
      this.attendanceRule = { ...rule }
      this.persist('attendanceRule')
    },

    addPunch(punch: Omit<AttendancePunch, 'id'>) {
      const item: AttendancePunch = { ...punch, id: generateId('punch') }
      this.punches.push(item)
      this.persist('punches')
      this.syncExceptions()
      const insurancePolicy = shouldAutoInsure(punch) ? this.autoInsureOnPunch(item) : undefined
      return { punch: item, insurancePolicy }
    },

    autoInsureOnPunch(punch: AttendancePunch): InsurancePolicy | undefined {
      if (hasActivePolicyForDate(this.insurancePolicies, punch.employeeId, punch.date)) {
        return undefined
      }
      const product = findAutoInsuranceProduct(this.insuranceProducts)
      if (!product) return undefined

      const seq =
        this.insurancePolicies.filter((p) => p.workDate === punch.date).length + 1
      const policy = createPolicyFromPunch(product, punch, seq)
      this.insurancePolicies.unshift(policy)
      this.persist('insurancePolicies')

      const emp = this.employees.find((e) => e.id === punch.employeeId)
      this.pushNotification({
        title: '自动投保成功',
        content: `${emp?.name ?? '员工'} 上班打卡已自动投保 ${product.name}（${policy.policyNo}）`,
        type: 'system',
      })
      return policy
    },

    getEmployeePolicies(employeeId: string) {
      return this.insurancePolicies
        .filter((p) => p.employeeId === employeeId)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    },

    cancelInsurancePolicy(id: string) {
      const policy = this.insurancePolicies.find((p) => p.id === id)
      if (!policy || policy.status !== 'active') return false
      policy.status = 'cancelled'
      this.persist('insurancePolicies')
      return true
    },

    removePunch(id: string) {
      this.punches = this.punches.filter((p) => p.id !== id)
      this.persist('punches')
      this.syncExceptions()
    },

    setManualOverride(employeeId: string, date: string, status: AttendanceStatus, note?: string) {
      const key = `${employeeId}_${date}`
      this.manualOverrides[key] = {
        ...this.manualOverrides[key],
        status,
        note: note ?? this.manualOverrides[key]?.note,
      }
      this.persist('manualOverrides')
      this.syncExceptions()
    },

    confirmWorkHours(
      employeeId: string,
      date: string,
      options?: { workHours?: number; note?: string; operator?: string },
    ) {
      const key = `${employeeId}_${date}`
      const prev = this.manualOverrides[key] ?? {}
      const now = new Date().toISOString()
      const operator = options?.operator?.trim() || '考勤管理员'
      const workHours =
        options?.workHours ??
        prev.workHours ??
        this.resolveSystemWorkHours(employeeId, date)
      const reason = options?.note?.trim() || '确认系统工时'
      const history = [...(prev.hoursHistory ?? [])]
      history.unshift({
        action: 'confirm',
        workHours,
        reason,
        operator,
        operatedAt: now,
      })
      this.manualOverrides[key] = {
        ...prev,
        workHours: prev.workHours,
        hoursConfirmed: true,
        hoursConfirmedAt: now,
        hoursConfirmedBy: operator,
        note: prev.note,
        hoursHistory: history.slice(0, 20),
      }
      this.persist('manualOverrides')
      return this.manualOverrides[key]
    },

    batchConfirmWorkHours(
      items: { employeeId: string; date: string; workHours?: number }[],
      options?: { note?: string; operator?: string },
    ) {
      let count = 0
      items.forEach((item) => {
        this.confirmWorkHours(item.employeeId, item.date, {
          workHours: item.workHours,
          note: options?.note,
          operator: options?.operator,
        })
        count += 1
      })
      return count
    },

    setWorkHoursCorrection(
      employeeId: string,
      date: string,
      workHours: number,
      note?: string,
      operator = '考勤管理员',
      options?: { autoConfirm?: boolean },
    ) {
      const reason = note?.trim()
      if (!reason) {
        throw new Error('工时矫正必须填写具体原因')
      }
      if (workHours < 0) {
        throw new Error('工时不能为负数')
      }
      const autoConfirm = options?.autoConfirm !== false
      const key = `${employeeId}_${date}`
      const prev = this.manualOverrides[key] ?? {}
      const now = new Date().toISOString()
      const history = [...(prev.hoursHistory ?? [])]
      history.unshift({
        action: 'correct',
        workHours,
        reason,
        operator,
        operatedAt: now,
      })
      this.manualOverrides[key] = {
        ...prev,
        workHours,
        note: reason,
        hoursConfirmed: autoConfirm ? true : prev.hoursConfirmed,
        hoursConfirmedAt: autoConfirm
          ? (prev.hoursConfirmedAt ?? now)
          : prev.hoursConfirmedAt,
        hoursConfirmedBy: autoConfirm
          ? (prev.hoursConfirmedBy ?? operator)
          : prev.hoursConfirmedBy,
        hoursCorrectedAt: now,
        hoursCorrectedBy: operator,
        hoursHistory: history.slice(0, 20),
      }
      this.persist('manualOverrides')
      return this.manualOverrides[key]
    },

    resolveSystemWorkHours(employeeId: string, date: string) {
      const day = computeDailyAttendance(
        employeeId,
        date,
        this.assignments,
        this.shifts,
        this.punches,
        this.leaveRequests,
        this.attendanceRule,
      )
      return day.workHours
    },

    clearManualOverride(employeeId: string, date: string) {
      const key = `${employeeId}_${date}`
      delete this.manualOverrides[key]
      this.persist('manualOverrides')
      this.syncExceptions()
    },

    syncExceptions() {
      const now = new Date()
      const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      const employeeIds = this.activeEmployees.map((e) => e.id)
      const daily = buildDailyAttendanceList(
        employeeIds,
        getMonthDateRange(month),
        this.assignments,
        this.shifts,
        this.punches,
        this.leaveRequests,
        this.attendanceRule,
        this.manualOverrides,
      )
      this.exceptions = deriveExceptions(daily, this.punches, this.exceptions)
      this.persist('exceptions')
    },

    submitLeaveRequest(data: Omit<LeaveRequest, 'id' | 'status' | 'createdAt'>) {
      const item: LeaveRequest = {
        ...data,
        id: generateId('leave'),
        status: 'pending',
        createdAt: new Date().toISOString(),
      }
      this.leaveRequests.unshift(item)
      this.persist('leaveRequests')
      this.pushNotification({
        title: '请假申请待审批',
        content: `${this.employees.find((e) => e.id === data.employeeId)?.name} 提交了请假申请（${data.startDate} ~ ${data.endDate}）`,
        type: 'approval',
      })
      return item
    },

    reviewLeaveRequest(id: string, approved: boolean, reviewNote = '', reviewedBy = '排班员') {
      const req = this.leaveRequests.find((r) => r.id === id)
      if (!req || req.status !== 'pending') throw new Error('申请不存在或已处理')

      req.status = approved ? 'approved' : 'rejected'
      req.reviewedBy = reviewedBy
      req.reviewedAt = new Date().toISOString()
      req.reviewNote = reviewNote

      if (approved) {
        const restShift = this.shifts.find((s) => s.code === 'REST')
        getDatesBetween(req.startDate, req.endDate).forEach((date) => {
          const existing = this.getAssignment(req.employeeId, date)
          if (existing && restShift) {
            this.upsertAssignment({
              employeeId: req.employeeId,
              date,
              shiftId: restShift.id,
              teamId: existing.teamId,
            })
          }
        })
      }

      this.persist('leaveRequests')
      this.syncExceptions()
      this.pushNotification({
        title: approved ? '请假已通过' : '请假已驳回',
        content: `${this.employees.find((e) => e.id === req.employeeId)?.name} 的请假申请已${approved ? '通过' : '驳回'}`,
        type: 'approval',
      })
    },

    submitSwapRequest(data: Omit<SwapRequest, 'id' | 'status' | 'createdAt'>) {
      const item: SwapRequest = {
        ...data,
        id: generateId('swap'),
        status: 'pending',
        createdAt: new Date().toISOString(),
      }
      this.swapRequests.unshift(item)
      this.persist('swapRequests')
      this.pushNotification({
        title: '换班申请待审批',
        content: `${this.employees.find((e) => e.id === data.applicantId)?.name} 申请与 ${this.employees.find((e) => e.id === data.targetEmployeeId)?.name} 换班（${data.date}）`,
        type: 'approval',
      })
      return item
    },

    reviewSwapRequest(id: string, approved: boolean, reviewNote = '', reviewedBy = '排班员') {
      const req = this.swapRequests.find((r) => r.id === id)
      if (!req || req.status !== 'pending') throw new Error('申请不存在或已处理')

      req.status = approved ? 'approved' : 'rejected'
      req.reviewedBy = reviewedBy
      req.reviewedAt = new Date().toISOString()
      req.reviewNote = reviewNote

      if (approved) {
        const aAsn = this.getAssignment(req.applicantId, req.date)
        const bAsn = this.getAssignment(req.targetEmployeeId, req.date)
        if (aAsn && bAsn) {
          const aShift = aAsn.shiftId
          this.upsertAssignment({
            employeeId: req.applicantId,
            date: req.date,
            shiftId: bAsn.shiftId,
            teamId: aAsn.teamId,
          })
          this.upsertAssignment({
            employeeId: req.targetEmployeeId,
            date: req.date,
            shiftId: aShift,
            teamId: bAsn.teamId,
          })
        }
      }

      this.persist('swapRequests')
      this.syncExceptions()
      this.pushNotification({
        title: approved ? '换班已通过' : '换班已驳回',
        content: `换班申请（${req.date}）已${approved ? '通过，排班表已更新' : '驳回'}`,
        type: approved ? 'schedule' : 'approval',
      })
    },

    submitCancelShiftRequest(
      data: Omit<CancelShiftRequest, 'id' | 'status' | 'createdAt'> & {
        status?: CancelShiftRequest['status']
      },
    ) {
      const dup = this.cancelShiftRequests.find(
        (r) =>
          r.employeeId === data.employeeId &&
          r.date === data.date &&
          r.status === 'pending' &&
          (data.grabSlotId ? r.grabSlotId === data.grabSlotId : true),
      )
      if (dup) throw new Error('该日期已有待审批的取消班次申请')

      const asn = data.employeeId ? this.getAssignment(data.employeeId, data.date) : undefined
      if (data.employeeId && !asn && data.source !== 'grab') {
        throw new Error('该日期暂无排班，无法申请取消')
      }

      const teamId = data.teamId || asn?.teamId
      if (!teamId) throw new Error('无法确定班组信息')

      const status = data.status ?? 'pending'
      const item: CancelShiftRequest = {
        ...data,
        shiftId: data.shiftId || asn?.shiftId || '',
        teamId,
        id: generateId('cancel_shift'),
        status,
        createdAt: new Date().toISOString(),
      }
      this.cancelShiftRequests.unshift(item)
      this.persist('cancelShiftRequests')
      if (status === 'pending') {
        const empName = this.employees.find((e) => e.id === data.employeeId)?.name ?? ''
        this.pushNotification({
          title: '取消班次申请待审批',
          content: `${empName || '管理端'} 申请取消 ${data.date} 排班`,
          type: 'approval',
        })
      }
      return item
    },

    reviewCancelShiftRequest(id: string, approved: boolean, reviewNote = '', reviewedBy = '排班员') {
      const req = this.cancelShiftRequests.find((r) => r.id === id)
      if (!req || req.status !== 'pending') throw new Error('申请不存在或已处理')

      req.status = approved ? 'approved' : 'rejected'
      req.reviewedBy = reviewedBy
      req.reviewedAt = new Date().toISOString()
      req.reviewNote = reviewNote

      if (approved) {
        this.removeAssignment(req.employeeId, req.date, true)
        this.removeAssignment(req.employeeId, req.date, false)
      }

      this.persist('cancelShiftRequests')
      this.syncExceptions()
      const empName = this.employees.find((e) => e.id === req.employeeId)?.name ?? ''
      this.pushNotification({
        title: approved ? '取消班次已通过' : '取消班次已驳回',
        content: `${empName} ${req.date} 取消班次申请已${approved ? '通过，排班已移除' : '驳回'}`,
        type: approved ? 'schedule' : 'approval',
      })
    },

    submitMakeupRequest(data: Omit<MakeupPunchRequest, 'id' | 'status' | 'createdAt'>) {
      const pending = this.makeupRequests.find(
        (r) =>
          r.employeeId === data.employeeId &&
          r.date === data.date &&
          r.status === 'pending',
      )
      if (pending) throw new Error('该日期已有待审批的补卡申请')

      const month = data.date.slice(0, 7)
      const count = this.makeupRequests.filter(
        (r) =>
          r.employeeId === data.employeeId &&
          r.date.startsWith(month) &&
          r.status === 'approved',
      ).length
      if (count >= this.attendanceRule.maxMakeupPerMonth) {
        throw new Error(`每月补卡不能超过 ${this.attendanceRule.maxMakeupPerMonth} 次`)
      }
      const item: MakeupPunchRequest = {
        ...data,
        id: generateId('makeup'),
        status: 'pending',
        createdAt: new Date().toISOString(),
      }
      this.makeupRequests.unshift(item)
      this.persist('makeupRequests')
      this.pushNotification({
        title: '补卡申请待审批',
        content: `${this.employees.find((e) => e.id === data.employeeId)?.name} 申请补卡（${data.date} ${data.time}）`,
        type: 'approval',
      })
      return item
    },

    reviewMakeupRequest(id: string, approved: boolean, reviewNote = '', reviewedBy = '排班员') {
      const req = this.makeupRequests.find((r) => r.id === id)
      if (!req || req.status !== 'pending') throw new Error('申请不存在或已处理')

      req.status = approved ? 'approved' : 'rejected'
      req.reviewedBy = reviewedBy
      req.reviewedAt = new Date().toISOString()
      req.reviewNote = reviewNote

      if (approved) {
        this.addPunch({
          employeeId: req.employeeId,
          date: req.date,
          time: req.time,
          type: req.punchType,
          source: 'manual',
          inRange: true,
          location: '补卡',
        })
      }

      this.persist('makeupRequests')
      this.syncExceptions()
      this.pushNotification({
        title: approved ? '补卡已通过' : '补卡已驳回',
        content: `补卡申请（${req.date}）已${approved ? '通过' : '驳回'}`,
        type: 'attendance',
      })
    },

    appealException(id: string, reason: string) {
      const exc = this.exceptions.find((e) => e.id === id)
      if (!exc) throw new Error('异常不存在')
      exc.status = 'appealed'
      exc.appealReason = reason
      exc.appealAt = new Date().toISOString()
      this.persist('exceptions')
      this.pushNotification({
        title: '考勤异常申诉',
        content: `${this.employees.find((e) => e.id === exc.employeeId)?.name} 对 ${exc.date} 的${exc.type}异常提出申诉`,
        type: 'attendance',
      })
    },

    resolveException(id: string, resolution: string, resolvedBy = '人事管理员', dismiss = false) {
      const exc = this.exceptions.find((e) => e.id === id)
      if (!exc) throw new Error('异常不存在')
      exc.status = dismiss ? 'dismissed' : 'resolved'
      exc.resolution = resolution
      exc.resolvedBy = resolvedBy
      exc.resolvedAt = new Date().toISOString()

      if (!dismiss && resolution.includes('调整为正常')) {
        this.setManualOverride(exc.employeeId, exc.date, 'normal')
      }

      this.persist('exceptions')
    },

    reviewMakeupForException(
      makeupId: string,
      exceptionId: string,
      approved: boolean,
      reviewNote = '',
    ) {
      this.reviewMakeupRequest(makeupId, approved, reviewNote, '人事管理员')
      if (approved) {
        this.resolveException(
          exceptionId,
          `补卡审批通过${reviewNote ? `：${reviewNote}` : ''}`,
          '人事管理员',
        )
      }
    },

    reviewLeaveForException(
      leaveId: string,
      exceptionId: string,
      approved: boolean,
      reviewNote = '',
    ) {
      this.reviewLeaveRequest(leaveId, approved, reviewNote, '人事管理员')
      if (approved) {
        this.resolveException(
          exceptionId,
          `请假审批通过${reviewNote ? `：${reviewNote}` : ''}`,
          '人事管理员',
        )
      }
    },

    reviewSwapForException(
      swapId: string,
      exceptionId: string,
      approved: boolean,
      reviewNote = '',
    ) {
      this.reviewSwapRequest(swapId, approved, reviewNote, '人事管理员')
      if (approved) {
        this.resolveException(
          exceptionId,
          `换班审批通过${reviewNote ? `：${reviewNote}` : ''}`,
          '人事管理员',
        )
      }
    },

    submitAndApproveMakeup(
      data: Omit<MakeupPunchRequest, 'id' | 'status' | 'createdAt'>,
      exceptionId: string,
      reviewNote = '管理员代提交并审批',
    ) {
      const req = this.submitMakeupRequest(data)
      this.reviewMakeupForException(req.id, exceptionId, true, reviewNote)
      return req
    },

    submitAndApproveLeave(
      data: Omit<LeaveRequest, 'id' | 'status' | 'createdAt'>,
      exceptionId: string,
      reviewNote = '管理员代提交并审批',
    ) {
      const req = this.submitLeaveRequest(data)
      this.reviewLeaveForException(req.id, exceptionId, true, reviewNote)
      return req
    },

    applySmartSchedule(assignments: Omit<ScheduleAssignment, 'id' | 'published'>[]) {
      assignments.forEach((item) => this.upsertAssignment(item))
      this.pushNotification({
        title: '智能排班完成',
        content: `已应用 ${assignments.length} 条智能排班，请前往排班表确认后发布`,
        type: 'schedule',
      })
    },

    createGrabShiftSlot(
      data: Omit<GrabShiftSlot, 'id' | 'createdAt' | 'grabbedCount' | 'status'>,
      options?: { publishStatus?: GrabShiftSlot['publishStatus'] },
    ) {
      const publishStatus = options?.publishStatus ?? data.publishStatus ?? 'pending'
      const item: GrabShiftSlot = {
        ...data,
        id: generateId('gs'),
        grabbedCount: 0,
        status: 'open',
        publishStatus,
        createdAt: new Date().toISOString(),
      }
      this.grabShiftSlots.unshift(item)
      this.persist('grabShiftSlots')
      if (publishStatus === 'pending') {
        this.pushNotification({
          title: '抢班班次待审批',
          content: `${item.shiftName}（${item.date}）已提交，待平台审核后上架小程序`,
          type: 'approval',
        })
      }
      return item
    },

    updateGrabShiftSlot(
      id: string,
      data: Partial<
        Pick<
          GrabShiftSlot,
          | 'date'
          | 'startTime'
          | 'endTime'
          | 'requiredCount'
          | 'hourlySubsidy'
          | 'baseHourlyRate'
          | 'effectiveHourlyRate'
          | 'positionRequirement'
          | 'requirements'
          | 'hasBreakTime'
          | 'breakRule'
          | 'breakMinutes'
          | 'workHours'
          | 'enrollFloatMode'
          | 'enrollFloatValue'
          | 'enrollCap'
          | 'customerFee'
          | 'wageBaseHourlyRate'
          | 'wageHourlySubsidy'
          | 'wageHourlyRate'
          | 'wageFee'
        >
      >,
    ) {
      const slot = this.grabShiftSlots.find((s) => s.id === id)
      if (!slot) throw new Error('抢班班次不存在')
      Object.assign(slot, data)
      if (data.hourlySubsidy != null || data.baseHourlyRate != null) {
        const base = data.baseHourlyRate ?? slot.baseHourlyRate ?? 0
        const subsidy = data.hourlySubsidy ?? slot.hourlySubsidy ?? 0
        slot.effectiveHourlyRate = Math.round((base + Math.max(0, subsidy)) * 100) / 100
      }
      if (data.wageHourlySubsidy != null || data.wageBaseHourlyRate != null) {
        const wBase = data.wageBaseHourlyRate ?? slot.wageBaseHourlyRate ?? 0
        const wSub = data.wageHourlySubsidy ?? slot.wageHourlySubsidy ?? 0
        slot.wageHourlyRate = Math.round((wBase + Math.max(0, wSub)) * 100) / 100
      }
      this.persist('grabShiftSlots')
      return slot
    },

    /** 平台审核抢班班次：可配置上浮/薪资费用等后上架小程序（日期时段人数客户费用不可改） */
    reviewGrabShiftSlot(
      id: string,
      approved: boolean,
      reviewNote = '',
      reviewedBy = '运营-李芳',
      edits?: Partial<
        Pick<
          GrabShiftSlot,
          | 'positionRequirement'
          | 'requirements'
          | 'breakMinutes'
          | 'workHours'
          | 'enrollFloatMode'
          | 'enrollFloatValue'
          | 'enrollCap'
          | 'customerFee'
          | 'wageBaseHourlyRate'
          | 'wageHourlySubsidy'
          | 'wageHourlyRate'
          | 'wageFee'
        >
      >,
    ) {
      const slot = this.grabShiftSlots.find((s) => s.id === id)
      if (!slot) throw new Error('抢班班次不存在')
      if (slot.publishStatus !== 'pending') throw new Error('班次不在待审核状态')

      if (approved && edits) {
        this.updateGrabShiftSlot(id, edits)
      }
      const now = new Date().toISOString()
      slot.reviewedBy = reviewedBy
      slot.reviewedAt = now
      slot.reviewNote = reviewNote.trim() || undefined
      if (approved) {
        slot.publishStatus = 'published'
        this.pushNotification({
          title: '抢班班次已上架',
          content: `${slot.shiftName}（${slot.date}）已通过审核，灵工可在小程序报名`,
          type: 'system',
        })
      } else {
        slot.publishStatus = 'rejected'
        this.pushNotification({
          title: '抢班班次已驳回',
          content: `${slot.shiftName}（${slot.date}）未通过审核${reviewNote ? `：${reviewNote}` : ''}`,
          type: 'system',
        })
      }
      this.persist('grabShiftSlots')
      return slot
    },

    cancelGrabShiftSlot(
      id: string,
      options?: {
        scope?: 'slot' | 'person'
        employeeId?: string
        reasonCode?: import('@/constants/cancelShift').CancelShiftReasonCode
        reasonOther?: string
        reason?: string
        operatedBy?: string
      },
    ) {
      const slot = this.grabShiftSlots.find((s) => s.id === id)
      if (!slot) throw new Error('抢班班次不存在')
      if (slot.status === 'cancelled') throw new Error('该班次已取消')

      const scope = options?.scope ?? 'slot'
      const operatedBy = options?.operatedBy ?? '排班管理员'
      const reasonMap = {
        business_change: '业务变动，班次调整/取消',
        force_majeure: '不可抗力因素取消班次',
        personnel_replace: '班次人员替换/补班',
        other: '其他',
      } as const
      const reason =
        options?.reason ||
        (options?.reasonCode === 'other'
          ? options.reasonOther?.trim() || '其他'
          : options?.reasonCode
            ? reasonMap[options.reasonCode]
            : '管理端取消班次')
      const now = new Date().toISOString()

      const pushRecord = (employeeId: string, cancelScope: 'person' | 'slot') => {
        this.cancelShiftRequests.unshift({
          id: generateId('cancel_shift'),
          employeeId,
          date: slot.date,
          shiftId: slot.shiftId,
          teamId: slot.teamId,
          reason,
          reasonCode: options?.reasonCode,
          reasonOther: options?.reasonOther,
          status: 'approved',
          initiatedBy: 'admin',
          source: 'grab',
          cancelScope,
          grabSlotId: slot.id,
          createdAt: now,
          reviewedBy: operatedBy,
          reviewedAt: now,
          reviewNote: cancelScope === 'slot' ? '整班取消' : '单人取消',
        })
      }

      if (scope === 'person') {
        const employeeId = options?.employeeId
        if (!employeeId) throw new Error('请选择要取消的人员')

        const app = this.grabShiftApplications.find(
          (a) =>
            a.slotId === slot.id &&
            a.employeeId === employeeId &&
            (a.status === 'approved' || a.status === 'pending'),
        )
        const hadApprovedSeat =
          app?.status === 'approved' ||
          this.assignments.some(
            (a) => a.fromGrabSlotId === slot.id && a.employeeId === employeeId,
          )
        if (!app && !hadApprovedSeat) {
          throw new Error('该人员未在本班次报名或已取消')
        }

        if (app) {
          app.status = 'cancelled'
          app.reviewedBy = operatedBy
          app.reviewedAt = now
          app.reviewNote = reason
        }

        this.assignments = this.assignments.filter(
          (a) =>
            !(
              a.employeeId === employeeId &&
              a.date === slot.date &&
              a.fromGrabSlotId === slot.id
            ),
        )

        if (hadApprovedSeat) {
          slot.grabbedCount = Math.max(0, (slot.grabbedCount ?? 0) - 1)
        } else {
          slot.grabbedCount = this.grabShiftApplications.filter(
            (a) => a.slotId === slot.id && a.status === 'approved',
          ).length
        }
        slot.status =
          slot.grabbedCount <= 0
            ? 'open'
            : slot.grabbedCount >= slot.requiredCount
              ? 'full'
              : 'partial'

        pushRecord(employeeId, 'person')
        this.persist('grabShiftSlots')
        this.persist('grabShiftApplications')
        this.persist('assignments')
        this.persist('cancelShiftRequests')
        this.syncExceptions()
        this.pushNotification({
          title: '抢班单人取消',
          content: `${slot.shiftName}（${slot.date}）已取消 1 人，需求名额已释放`,
          type: 'schedule',
        })
        return
      }

      this.grabShiftApplications.forEach((a) => {
        if (a.slotId !== slot.id) return
        if (a.status === 'approved' || a.status === 'pending') {
          a.status = 'cancelled'
          a.reviewedBy = operatedBy
          a.reviewedAt = now
          a.reviewNote = reason
        }
      })
      const affected = [
        ...new Set(
          this.assignments
            .filter((a) => a.fromGrabSlotId === slot.id)
            .map((a) => a.employeeId),
        ),
      ]
      this.assignments = this.assignments.filter((a) => a.fromGrabSlotId !== slot.id)
      slot.status = 'cancelled'
      slot.grabbedCount = 0
      if (affected.length) {
        affected.forEach((employeeId) => pushRecord(employeeId, 'slot'))
      } else {
        pushRecord('', 'slot')
      }
      this.persist('grabShiftSlots')
      this.persist('grabShiftApplications')
      this.persist('assignments')
      this.persist('cancelShiftRequests')
      this.syncExceptions()
      this.pushNotification({
        title: '抢班班次已取消',
        content: `${slot.shiftName}（${slot.date}）已整班取消`,
        type: 'schedule',
      })
    },

    assignGrabShift(slotId: string, employeeId: string) {
      const slot = this.grabShiftSlots.find((s) => s.id === slotId)
      if (!slot) throw new Error('抢班班次不存在')
      if (slot.status === 'cancelled' || slot.status === 'full') {
        throw new Error('该班次已满或已取消')
      }
      this.upsertAssignment({
        employeeId,
        shiftId: slot.shiftId,
        date: slot.date,
        teamId: slot.teamId,
        fromGrabSlotId: slotId,
      })
      slot.grabbedCount += 1
      slot.status = slot.grabbedCount >= slot.requiredCount ? 'full' : 'partial'
      this.persist('grabShiftSlots')
      this.persist('assignments')
    },

    submitGrabShiftApplication(
      data: Omit<GrabShiftApplication, 'id' | 'status' | 'createdAt'>,
      options?: { forceManualReview?: boolean },
    ): GrabShiftApplication {
      this.assertCourseGateForEmployee(data.employeeId, 'schedule')
      const slot = this.grabShiftSlots.find((s) => s.id === data.slotId)
      if (!slot) throw new Error('抢班班次不存在')
      if (slot.publishStatus === 'pending' || slot.publishStatus === 'rejected') {
        throw new Error('该班次尚未通过发布审批，暂不可报名')
      }
      if (slot.status === 'cancelled' || slot.status === 'full') {
        throw new Error('该班次已满或已取消')
      }
      const emp = this.employees.find((e) => e.id === data.employeeId)
      if (isEmployeeUnavailableOnDate(emp, slot.date)) {
        throw new Error('您已配置请假/不上岗，该日期无法报名抢班')
      }
      const dup = this.grabShiftApplications.find(
        (a) =>
          a.slotId === data.slotId &&
          a.employeeId === data.employeeId &&
          (a.status === 'pending' || a.status === 'approved'),
      )
      if (dup) throw new Error('已有进行中的报名申请')

      const whitelisted =
        !options?.forceManualReview &&
        this.isGrabShiftWhitelisted(data.employeeId, slot.attendanceGroupId)
      const now = new Date().toISOString()
      const item: GrabShiftApplication = {
        ...data,
        id: generateId('gsa'),
        status: whitelisted ? 'approved' : 'pending',
        createdAt: now,
        ...(whitelisted
          ? {
              reviewedBy: '系统自动',
              reviewedAt: now,
              reviewNote: '白名单免审批',
            }
          : {}),
      }
      this.grabShiftApplications.unshift(item)
      this.persist('grabShiftApplications')

      const empName = this.employees.find((e) => e.id === data.employeeId)?.name ?? '灵工'

      if (whitelisted) {
        this.upsertAssignment({
          employeeId: data.employeeId,
          shiftId: slot.shiftId,
          date: slot.date,
          teamId: slot.teamId,
          fromGrabSlotId: slot.id,
        })
        slot.grabbedCount += 1
        slot.status = slot.grabbedCount >= slot.requiredCount ? 'full' : 'partial'
        this.persist('grabShiftSlots')
        this.persist('assignments')
        this.pushNotification({
          title: '抢班报名自动通过',
          content: `${empName}（白名单）报名 ${slot.shiftName}（${slot.date}），已自动写入排班表`,
          type: 'approval',
        })
      } else {
        this.pushNotification({
          title: '抢班报名待审批',
          content: `${empName} 报名 ${slot.shiftName}（${slot.date}）`,
          type: 'approval',
        })
      }

      return item
    },

    isGrabShiftWhitelisted(employeeId: string, attendanceGroupId: string) {
      return this.grabShiftWhitelist.some(
        (w) => w.employeeId === employeeId && w.attendanceGroupId === attendanceGroupId,
      )
    },

    addGrabShiftWhitelistEntry(
      data: Omit<GrabShiftWhitelistEntry, 'id' | 'createdAt'>,
    ) {
      const emp = this.employees.find((e) => e.id === data.employeeId)
      if (!emp || emp.status !== 'active') throw new Error('请选择在职人员')
      const exists = this.grabShiftWhitelist.some(
        (w) =>
          w.employeeId === data.employeeId && w.attendanceGroupId === data.attendanceGroupId,
      )
      if (exists) throw new Error('该人员已在白名单中')
      const item: GrabShiftWhitelistEntry = {
        ...data,
        id: generateId('gsw'),
        createdAt: new Date().toISOString(),
      }
      this.grabShiftWhitelist.unshift(item)
      this.persist('grabShiftWhitelist')
      return item
    },

    removeGrabShiftWhitelistEntry(id: string) {
      const idx = this.grabShiftWhitelist.findIndex((w) => w.id === id)
      if (idx < 0) throw new Error('白名单记录不存在')
      this.grabShiftWhitelist.splice(idx, 1)
      this.persist('grabShiftWhitelist')
    },

    getGrabInterviewConfig(enterpriseId: string) {
      return this.grabInterviewConfigs.find((c) => c.enterpriseId === enterpriseId) ?? null
    },

    ensureGrabInterviewConfig(enterpriseId: string): GrabInterviewConfig {
      let cfg = this.grabInterviewConfigs.find((c) => c.enterpriseId === enterpriseId)
      let dirty = false
      if (!cfg) {
        cfg = {
          id: generateId('gic'),
          enterpriseId,
          requireInterview: false,
          deptRules: [],
          positionTemplates: [],
          updatedAt: new Date().toISOString(),
        }
        this.grabInterviewConfigs.push(cfg)
        dirty = true
      }
      if (!cfg.positionTemplates) {
        cfg.positionTemplates = []
        dirty = true
      }
      const needNorm = cfg.deptRules.some(
        (r) =>
          !Array.isArray(r.positions) ||
          !r.departmentSchedule ||
          !!r.positionName ||
          r.positions.some((p) => !p.id || !p.profile),
      )
      if (needNorm) {
        cfg.deptRules = cfg.deptRules.map((r) => normalizeDeptInterviewRule(r))
        dirty = true
      }
      if (dirty) {
        cfg.updatedAt = new Date().toISOString()
        this.persist('grabInterviewConfigs')
      }
      return cfg
    },

    updateGrabInterviewConfig(
      enterpriseId: string,
      data: Partial<
        Pick<GrabInterviewConfig, 'requireInterview' | 'deptRules' | 'positionTemplates'>
      >,
    ) {
      const cfg = this.ensureGrabInterviewConfig(enterpriseId)
      if (data.requireInterview !== undefined) cfg.requireInterview = data.requireInterview
      if (data.deptRules) cfg.deptRules = data.deptRules.map((r) => normalizeDeptInterviewRule(r))
      if (data.positionTemplates) cfg.positionTemplates = data.positionTemplates
      cfg.updatedAt = new Date().toISOString()
      this.persist('grabInterviewConfigs')
      return cfg
    },

    upsertGrabInterviewDeptRule(enterpriseId: string, rule: GrabInterviewDeptRule) {
      const cfg = this.ensureGrabInterviewConfig(enterpriseId)
      const normalized = normalizeGrabInterviewDeptRule(rule)
      const idx = cfg.deptRules.findIndex((r) => r.departmentId === normalized.departmentId)
      if (idx >= 0) cfg.deptRules[idx] = normalized
      else cfg.deptRules.push(normalized)
      cfg.updatedAt = new Date().toISOString()
      this.persist('grabInterviewConfigs')
      return cfg
    },

    removeGrabInterviewDeptRule(enterpriseId: string, departmentId: string) {
      const cfg = this.ensureGrabInterviewConfig(enterpriseId)
      cfg.deptRules = cfg.deptRules.filter((r) => r.departmentId !== departmentId)
      cfg.updatedAt = new Date().toISOString()
      this.persist('grabInterviewConfigs')
    },

    upsertGrabInterviewPositionTemplate(
      enterpriseId: string,
      template: Omit<GrabInterviewPositionTemplate, 'enterpriseId' | 'updatedAt'> & {
        enterpriseId?: string
        updatedAt?: string
      },
    ) {
      const cfg = this.ensureGrabInterviewConfig(enterpriseId)
      const next: GrabInterviewPositionTemplate = {
        ...template,
        id: template.id || generateId('gitpl'),
        enterpriseId,
        updatedAt: new Date().toISOString(),
      }
      const list = cfg.positionTemplates ?? (cfg.positionTemplates = [])
      const idx = list.findIndex((t) => t.id === next.id)
      if (idx >= 0) list[idx] = next
      else list.push(next)
      cfg.updatedAt = new Date().toISOString()
      this.persist('grabInterviewConfigs')
      return next
    },

    removeGrabInterviewPositionTemplate(enterpriseId: string, templateId: string) {
      const cfg = this.ensureGrabInterviewConfig(enterpriseId)
      cfg.positionTemplates = (cfg.positionTemplates ?? []).filter((t) => t.id !== templateId)
      cfg.updatedAt = new Date().toISOString()
      this.persist('grabInterviewConfigs')
    },

    addGrabInterviewRegistration(
      data: Omit<GrabInterviewRegistration, 'id' | 'createdAt' | 'status'> & {
        status?: GrabInterviewRegistration['status']
      },
    ) {
      const item: GrabInterviewRegistration = {
        ...data,
        status: data.status ?? 'pending',
        id: generateId('gir'),
        createdAt: new Date().toISOString(),
      }
      this.grabInterviewRegistrations.unshift(item)
      this.persist('grabInterviewRegistrations')
      return item
    },

    updateGrabInterviewRegistration(id: string, data: Partial<GrabInterviewRegistration>) {
      const idx = this.grabInterviewRegistrations.findIndex((r) => r.id === id)
      if (idx < 0) throw new Error('报名记录不存在')
      this.grabInterviewRegistrations[idx] = {
        ...this.grabInterviewRegistrations[idx],
        ...data,
      }
      this.persist('grabInterviewRegistrations')
      return this.grabInterviewRegistrations[idx]
    },

    /**
     * 面试反馈：通过则创建/入池到对应部门；不通过则记录原因
     */
    submitGrabInterviewFeedback(
      id: string,
      result: 'passed' | 'failed',
      failReason?: string,
    ) {
      const reg = this.grabInterviewRegistrations.find((r) => r.id === id)
      if (!reg) throw new Error('报名记录不存在')
      if (reg.status !== 'pending') throw new Error('仅待面试记录可反馈')
      if (result === 'failed') {
        if (!failReason?.trim()) throw new Error('请填写未通过原因')
        reg.status = 'failed'
        reg.failReason = failReason.trim()
        reg.feedbackAt = new Date().toISOString()
        this.persist('grabInterviewRegistrations')
        return reg
      }
      let emp = this.employees.find(
        (e) => e.phone === reg.phone && e.enterpriseId === reg.enterpriseId,
      )
      if (emp) {
        this.updateEmployee(emp.id, {
          departmentId: reg.departmentId,
          position: reg.position,
          status: 'active',
          onboardingStage: undefined,
          personnelCategory: 'grab',
        })
      } else {
        emp = this.addEmployee({
          name: reg.name,
          phone: reg.phone,
          employeeNo: `G${Date.now().toString().slice(-6)}`,
          departmentId: reg.departmentId,
          enterpriseId: reg.enterpriseId,
          position: reg.position,
          hireDate: new Date().toISOString().slice(0, 10),
          skills: [],
          preferredShiftIds: [],
          unavailableDates: [],
          status: 'active',
          personnelCategory: 'grab',
        })
      }
      reg.status = 'passed'
      reg.employeeId = emp.id
      reg.failReason = undefined
      reg.feedbackAt = new Date().toISOString()
      this.persist('grabInterviewRegistrations')
      return reg
    },

    reviewGrabShiftApplication(
      id: string,
      approved: boolean,
      reviewNote = '',
      reviewedBy = '排班员',
    ) {
      const app = this.grabShiftApplications.find((a) => a.id === id)
      if (!app || app.status !== 'pending') throw new Error('申请不存在或已处理')

      app.status = approved ? 'approved' : 'rejected'
      app.reviewedBy = reviewedBy
      app.reviewedAt = new Date().toISOString()
      app.reviewNote = reviewNote

      if (approved) {
        const slot = this.grabShiftSlots.find((s) => s.id === app.slotId)
        if (!slot) throw new Error('关联班次不存在')
        if (slot.status === 'cancelled' || slot.status === 'full') {
          throw new Error('该班次已满或已取消，无法通过')
        }
        this.upsertAssignment({
          employeeId: app.employeeId,
          shiftId: slot.shiftId,
          date: slot.date,
          teamId: slot.teamId,
          fromGrabSlotId: slot.id,
        })
        slot.grabbedCount += 1
        slot.status = slot.grabbedCount >= slot.requiredCount ? 'full' : 'partial'
        this.persist('grabShiftSlots')
        this.persist('assignments')
      }

      this.persist('grabShiftApplications')
      const empName = this.employees.find((e) => e.id === app.employeeId)?.name ?? '灵工'
      this.pushNotification({
        title: approved ? '抢班报名已通过' : '抢班报名已驳回',
        content: `${empName} 的抢班报名已${approved ? '通过，已写入排班表' : '驳回'}`,
        type: 'approval',
      })
    },

    updatePayrollConfig(config: PayrollConfig) {
      this.payrollConfig = { ...config }
      this.persist('payrollConfig')
    },

    addIntegrationLog(log: Omit<IntegrationLog, 'id' | 'createdAt'>) {
      const item: IntegrationLog = {
        ...log,
        id: generateId('log'),
        createdAt: new Date().toISOString(),
      }
      this.integrationLogs.unshift(item)
      this.persist('integrationLogs')
      return item
    },

    addSystemOperationLog(log: Omit<SystemOperationLog, 'id' | 'operatedAt'>) {
      const item: SystemOperationLog = {
        ...log,
        id: generateId('oplog'),
        operatedAt: new Date().toISOString(),
      }
      this.systemOperationLogs.unshift(item)
      this.persist('systemOperationLogs')
      return item
    },

    submitOvertimeRequest(data: Omit<OvertimeRequest, 'id' | 'status' | 'createdAt'>) {
      const item: OvertimeRequest = {
        ...data,
        id: generateId('ot'),
        status: 'pending',
        createdAt: new Date().toISOString(),
      }
      this.overtimeRequests.unshift(item)
      this.persist('overtimeRequests')
      this.pushNotification({
        title: '加班申请待审批',
        content: `${this.employees.find((e) => e.id === data.employeeId)?.name} 申请 ${data.date} 加班 ${data.hours}h`,
        type: 'approval',
      })
      return item
    },

    reviewOvertimeRequest(id: string, approved: boolean, reviewNote = '', reviewedBy = '排班员') {
      const req = this.overtimeRequests.find((r) => r.id === id)
      if (!req || req.status !== 'pending') throw new Error('申请不存在或已处理')

      req.status = approved ? 'approved' : 'rejected'
      req.reviewedBy = reviewedBy
      req.reviewedAt = new Date().toISOString()
      req.reviewNote = reviewNote

      if (approved) {
        const otShift = this.shifts.find((s) => s.code === 'OVERTIME')
        const existing = this.getAssignment(req.employeeId, req.date)
        if (otShift && existing) {
          this.upsertAssignment({
            employeeId: req.employeeId,
            date: req.date,
            shiftId: otShift.id,
            teamId: existing.teamId,
          })
        }
      }

      this.persist('overtimeRequests')
      this.pushNotification({
        title: approved ? '加班已通过' : '加班已驳回',
        content: `加班申请（${req.date} ${req.hours}h）已${approved ? '通过' : '驳回'}`,
        type: 'approval',
      })
    },

    // Task Workflow
    addTaskWorkflow(data: Omit<TaskWorkflow, 'id' | 'version' | 'boundTaskTypeCount' | 'createdAt' | 'updatedAt'>) {
      const now = new Date().toISOString()
      const item: TaskWorkflow = {
        ...data,
        id: generateId('wf'),
        version: 1,
        boundTaskTypeCount: 0,
        createdAt: now,
        updatedAt: now,
      }
      this.taskWorkflows.push(item)
      this.persist('taskWorkflows')
      return item
    },

    updateTaskWorkflow(id: string, data: Partial<Omit<TaskWorkflow, 'id' | 'boundTaskTypeCount'>>) {
      const wf = this.taskWorkflows.find((w) => w.id === id)
      if (!wf) throw new Error('工作流不存在')
      if (wf.boundTaskTypeCount > 0 && data.nodes) {
        throw new Error('工作流已绑定任务类型，不可修改节点，请停用后创建新版本')
      }
      Object.assign(wf, data, { updatedAt: new Date().toISOString() })
      this.persist('taskWorkflows')
    },

    copyTaskWorkflow(id: string) {
      const source = this.taskWorkflows.find((w) => w.id === id)
      if (!source) throw new Error('工作流不存在')
      return this.addTaskWorkflow({
        name: `${source.name}（副本）`,
        description: source.description,
        enterpriseScope: source.enterpriseScope,
        enterpriseIds: source.enterpriseIds ? [...source.enterpriseIds] : undefined,
        fields: source.fields?.map((f) => ({ ...f, id: generateId('field'), nodeIds: [...f.nodeIds] })),
        nodes: source.nodes.map((n) => ({ ...n, id: generateId('node') })),
        status: 'disabled',
      })
    },

    removeTaskWorkflow(id: string) {
      const wf = this.taskWorkflows.find((w) => w.id === id)
      if (!wf) throw new Error('工作流不存在')
      if (wf.status === 'enabled') throw new Error('请先停用工作流再删除')
      if (wf.boundTaskTypeCount > 0) throw new Error('工作流已被任务类型引用，无法删除')
      this.taskWorkflows = this.taskWorkflows.filter((w) => w.id !== id)
      this.persist('taskWorkflows')
    },

    toggleTaskWorkflowStatus(id: string) {
      const wf = this.taskWorkflows.find((w) => w.id === id)
      if (!wf) throw new Error('工作流不存在')
      wf.status = wf.status === 'enabled' ? 'disabled' : 'enabled'
      wf.updatedAt = new Date().toISOString()
      this.persist('taskWorkflows')
    },

    reviewTaskType(id: string, approved: boolean, reviewNote = '', reviewedBy = '运营-李芳') {
      const tt = this.taskTypes.find((t) => t.id === id)
      if (!tt || tt.status !== 'pending') throw new Error('任务类型不存在或不在审批中')

      tt.status = approved ? 'published' : 'rejected'
      tt.reviewedBy = reviewedBy
      tt.reviewedAt = new Date().toISOString()
      tt.reviewNote = reviewNote

      if (approved) {
        const wf = this.taskWorkflows.find((w) => w.id === tt.workflowId)
        if (wf) {
          wf.boundTaskTypeCount += 1
          this.persist('taskWorkflows')
        }
      }

      this.persist('taskTypes')
      this.pushNotification({
        title: approved ? '任务类型审批通过' : '任务类型审批驳回',
        content: `${tt.enterpriseName} 的「${tt.name}」已${approved ? '通过' : '驳回'}`,
        type: 'approval',
      })
    },

    endTask(id: string) {
      const task = this.tasks.find((t) => t.id === id)
      if (!task) throw new Error('任务不存在')
      task.status = 'ended'
      this.persist('tasks')
    },

    setCurrentEnterprise(id: string) {
      if (!this.enterprises.some((e) => e.id === id)) throw new Error('企业不存在')
      this.currentEnterpriseId = id
      this.persist('currentEnterpriseId')
    },

    addEnterprise(
      data: Omit<Enterprise, 'id' | 'code' | 'createdAt' | 'status' | 'contact'> & {
        status?: Enterprise['status']
      },
    ) {
      const seq = this.enterprises.length + 158
      const item: Enterprise = {
        ...data,
        id: generateId('ent'),
        code: generateEnterpriseCode(seq),
        status: data.status ?? 'active',
        createdAt: new Date().toISOString().slice(0, 10),
        contact: data.contactPerson,
      }
      this.enterprises.unshift(item)
      this.persist('enterprises')
      this.ensureEnterpriseRoles(item.id)
      return item
    },

    updateEnterprise(id: string, data: Partial<Omit<Enterprise, 'id' | 'code' | 'createdAt'>>) {
      const ent = this.enterprises.find((e) => e.id === id)
      if (!ent) throw new Error('企业不存在')
      Object.assign(ent, data)
      if (data.contactPerson) ent.contact = data.contactPerson
      this.persist('enterprises')
    },

    upsertAttendanceGroupSettlementOverride(
      data: Omit<AttendanceGroupSettlementOverride, 'updatedAt'> & { updatedAt?: string },
    ) {
      const now = new Date().toISOString()
      const idx = this.attendanceGroupSettlementOverrides.findIndex(
        (o) =>
          o.attendanceGroupId === data.attendanceGroupId && o.enterpriseId === data.enterpriseId,
      )
      const item: AttendanceGroupSettlementOverride = {
        ...data,
        useEnterpriseDefault: data.useEnterpriseDefault ?? false,
        updatedAt: now,
      }
      if (idx >= 0) {
        this.attendanceGroupSettlementOverrides[idx] = item
      } else {
        this.attendanceGroupSettlementOverrides.push(item)
      }
      this.persist('attendanceGroupSettlementOverrides')
    },

    upsertTaskTypeSettlementOverride(
      data: Omit<TaskTypeSettlementOverride, 'updatedAt'> & { updatedAt?: string },
    ) {
      const now = new Date().toISOString()
      const idx = this.taskTypeSettlementOverrides.findIndex(
        (o) => o.taskTypeId === data.taskTypeId && o.enterpriseId === data.enterpriseId,
      )
      const item: TaskTypeSettlementOverride = {
        ...data,
        useEnterpriseDefault: data.useEnterpriseDefault ?? false,
        updatedAt: now,
      }
      if (idx >= 0) {
        this.taskTypeSettlementOverrides[idx] = item
      } else {
        this.taskTypeSettlementOverrides.push(item)
      }
      this.persist('taskTypeSettlementOverrides')
    },

    upsertProviderFundAccount(
      data: Omit<ProviderFundAccount, 'id' | 'createdAt' | 'updatedAt' | 'balance'> & {
        id?: string
        balance?: number
      },
    ) {
      const now = new Date().toISOString()
      const idx = data.id
        ? this.providerFundAccounts.findIndex((account) => account.id === data.id)
        : -1
      const item: ProviderFundAccount = {
        id: data.id ?? generateId('fa'),
        providerId: data.providerId,
        name: data.name,
        accountType: data.accountType,
        balance: data.balance ?? (idx >= 0 ? this.providerFundAccounts[idx].balance : 0),
        status: data.status,
        alipayConfig: data.alipayConfig,
        cmbConfig: data.cmbConfig,
        isDefault: data.isDefault,
        remark: data.remark,
        createdAt: idx >= 0 ? this.providerFundAccounts[idx].createdAt : now,
        updatedAt: now,
      }
      if (idx >= 0) {
        this.providerFundAccounts[idx] = item
      } else {
        this.providerFundAccounts.push(item)
      }
      this.persist('providerFundAccounts')
      return item
    },

    toggleEnterpriseTenantStatus(id: string) {
      const ent = this.enterprises.find((e) => e.id === id)
      if (!ent) throw new Error('企业不存在')
      if (ent.status === 'terminated') throw new Error('已终止合作的企业不可启用')
      ent.tenantDisabled = !ent.tenantDisabled
      this.persist('enterprises')
    },

    updateEnterpriseModules(id: string, modules: Enterprise['serviceModules']) {
      const ent = this.enterprises.find((e) => e.id === id)
      if (!ent) throw new Error('企业不存在')
      ent.serviceModules = normalizeEnterpriseModules(modules)
      this.persist('enterprises')
    },

    getAccountsByEnterprise(enterpriseId: string) {
      return this.systemAccounts.filter(
        (a) => a.accountPortal === 'enterprise' && a.enterpriseId === enterpriseId,
      )
    },

    ensureEnterpriseAdminAccount(enterprise: Enterprise, password?: string) {
      const admin = enterprise.adminAccount
      if (!admin) return null
      this.ensureEnterpriseOrgStructure(enterprise.id)
      const rootDept = this.departments.find(
        (d) => d.enterpriseId === enterprise.id && d.parentId === null,
      )
      const entAdminRole = findEnterpriseRoleByCode(this.systemRoles, enterprise.id, 'ent_admin')

      const existing = this.systemAccounts.find(
        (a) =>
          a.accountPortal === 'enterprise' &&
          a.enterpriseId === enterprise.id &&
          a.phone === admin.phone,
      )

      const pwd = password ?? admin.initialPassword ?? '123456'
      const payload = {
        username: existing?.username ?? `ent_${enterprise.code.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toLowerCase() || enterprise.id.slice(-6)}`,
        displayName: admin.name,
        phone: admin.phone,
        roleIds: [entAdminRole?.id ?? `role_ent_admin_${enterprise.id}`],
        departmentId: rootDept?.id ?? 'dept_hr',
        accountPortal: 'enterprise' as const,
        enterpriseId: enterprise.id,
        status: 'enabled' as const,
      }

      if (existing) {
        this.updateSystemAccount(existing.id, {
          displayName: payload.displayName,
          phone: payload.phone,
          roleIds: payload.roleIds,
        })
        return existing
      }

      const account = this.createSystemAccount(payload)
      enterprise.adminAccount = {
        ...admin,
        initialPassword: pwd,
        passwordMode: admin.passwordMode ?? 'auto',
      }
      this.persist('enterprises')
      return account
    },

    resetEnterpriseTenantPassword(enterpriseId: string) {
      const ent = this.enterprises.find((e) => e.id === enterpriseId)
      if (!ent) throw new Error('企业不存在')
      const accounts = this.getAccountsByEnterprise(enterpriseId)
      const primary =
        accounts.find((a) => a.phone === ent.adminAccount?.phone) ?? accounts[0]
      if (!primary) throw new Error('该企业暂无登录账号')
      this.resetAccountPassword(primary.id)
      if (ent.adminAccount) {
        ent.adminAccount.initialPassword = '123456'
        this.persist('enterprises')
      }
      return primary
    },

    terminateEnterprise(id: string) {
      const ent = this.enterprises.find((e) => e.id === id)
      if (!ent) throw new Error('企业不存在')
      ent.status = 'terminated'
      this.persist('enterprises')
    },

    addServiceContract(
      data: Omit<
        ServiceContract,
        | 'id'
        | 'contractNo'
        | 'status'
        | 'createdAt'
        | 'updatedAt'
        | 'operationLogs'
        | 'attachments'
        | 'currency'
        | 'versions'
        | 'currentVersion'
      > & {
        currency?: string
        approvalStatus?: ServiceContract['approvalStatus']
        submitForApproval?: boolean
        changeNote?: string
        attachments?: ServiceContract['attachments']
      },
    ) {
      const existing = findContractByPair(this.serviceContracts, data.enterpriseId, data.providerId)
      if (existing) {
        throw new Error('该企业与服务商已存在合同，请在原合同上改版，不可重复新建')
      }
      const seq = this.serviceContracts.length + 158
      const now = new Date().toISOString()
      const { submitForApproval, changeNote, attachments, ...rest } = data
      const submit = submitForApproval === true
      const approvalStatus = submit ? 'pending' : rest.approvalStatus ?? 'draft'
      const item: ServiceContract = {
        ...rest,
        id: generateId('sc'),
        contractNo: generateContractNo(seq),
        currency: rest.currency ?? 'CNY',
        status: approvalStatus === 'approved' ? 'active' : 'draft',
        approvalStatus,
        submittedBy: submit ? '平台操作员' : undefined,
        submittedAt: submit ? now : undefined,
        attachments: attachments?.length ? [...attachments] : [],
        operationLogs: [
          {
            id: generateId('log'),
            operator: '平台操作员',
            action: submit ? '创建并提交合同审批' : '创建合同草稿',
            createdAt: new Date().toLocaleString('zh-CN'),
          },
        ],
        currentVersion: 0,
        versions: [],
        createdAt: now,
        updatedAt: now,
      }
      const versionStatus =
        approvalStatus === 'pending'
          ? 'pending'
          : approvalStatus === 'approved'
            ? 'effective'
            : 'draft'
      const version = createContractVersion(item, versionStatus, {
        changeNote: changeNote || '初始版本',
        submittedBy: item.submittedBy,
        submittedAt: item.submittedAt,
      })
      item.versions = [version]
      if (versionStatus === 'effective') {
        item.currentVersion = version.version
        item.approvedBy = item.approvedBy || '平台负责人'
        item.approvedAt = item.approvedAt || now
      }
      this.serviceContracts.unshift(item)
      this.persist('serviceContracts')
      return item
    },

    updateServiceContract(
      id: string,
      data: Partial<
        Omit<
          ServiceContract,
          | 'id'
          | 'contractNo'
          | 'createdAt'
          | 'operationLogs'
          | 'versions'
          | 'currentVersion'
          | 'enterpriseId'
          | 'providerId'
        >
      >,
      options?: { keepApproval?: boolean; operator?: string; changeNote?: string },
    ) {
      const contract = this.serviceContracts.find((c) => c.id === id)
      if (!contract) throw new Error('合约不存在')
      ensureContractVersions(contract)
      const operator = options?.operator ?? '平台操作员'
      const prevApproval = contract.approvalStatus ?? 'approved'
      const now = new Date().toISOString()
      const { attachments: nextAttachments, ...configPatch } = data

      const effective = getEffectiveVersion(contract)
      const existingWorking = (contract.versions ?? []).find(
        (v) => v.status === 'draft' || v.status === 'pending' || v.status === 'rejected',
      )
      const baseConfig = existingWorking
        ? pickContractConfig(existingWorking)
        : effective
          ? pickContractConfig(effective)
          : pickContractConfig(getWorkingVersion(contract) ?? contract)
      const nextConfig = pickContractConfig({
        ...baseConfig,
        ...configPatch,
        currency: configPatch.currency || baseConfig.currency || 'CNY',
      })

      if (nextAttachments) {
        contract.attachments = nextAttachments
      }

      if (!options?.keepApproval && contract.status !== 'terminated') {
        const wasApproved = prevApproval === 'approved'
        contract.approvalStatus = 'draft'
        contract.submittedBy = undefined
        contract.submittedAt = undefined
        contract.approvedBy = undefined
        contract.approvedAt = undefined
        contract.approvalRemark = undefined

        let working = existingWorking
        if (!working) {
          working = createContractVersion(contract, 'draft', {
            changeNote: options?.changeNote || '改版草稿',
            config: nextConfig,
          })
          contract.versions = [...(contract.versions ?? []), working]
        } else {
          Object.assign(working, nextConfig, {
            status: 'draft' as const,
            changeNote: options?.changeNote || working.changeNote || '改版草稿',
            submittedBy: undefined,
            submittedAt: undefined,
            approvedBy: undefined,
            approvedAt: undefined,
            approvalRemark: undefined,
            updatedAt: now,
          })
        }

        // 审批通过前主档仍展示原生效配置
        if (!restoreEffectiveConfig(contract)) {
          applyContractConfig(contract, working)
          contract.status = 'draft'
        }

        contract.updatedAt = now
        contract.operationLogs = [
          ...(contract.operationLogs ?? []),
          {
            id: generateId('log'),
            operator,
            action: wasApproved
              ? `修改合同配置并生成改版草稿（V${working.version}），生效配置仍为原版本，需重新提交审批`
              : `更新改版草稿（V${working.version}）`,
            createdAt: new Date().toLocaleString('zh-CN'),
          },
        ]
      } else {
        const working = (contract.versions ?? []).find(
          (v) => v.status === 'draft' || v.status === 'pending' || v.status === 'rejected',
        )
        if (working) {
          Object.assign(working, nextConfig, { updatedAt: now })
          if (!restoreEffectiveConfig(contract)) {
            applyContractConfig(contract, working)
          }
        } else if (effective) {
          Object.assign(effective, nextConfig, { updatedAt: now })
          applyContractConfig(contract, effective)
        } else {
          applyContractConfig(contract, nextConfig)
        }
        contract.updatedAt = now
        contract.operationLogs = [
          ...(contract.operationLogs ?? []),
          {
            id: generateId('log'),
            operator,
            action: '修改了合同配置',
            createdAt: new Date().toLocaleString('zh-CN'),
          },
        ]
      }
      this.persist('serviceContracts')
      return contract
    },

    submitServiceContractForApproval(id: string, operator = '平台操作员') {
      const contract = this.serviceContracts.find((c) => c.id === id)
      if (!contract) throw new Error('合同不存在')
      ensureContractVersions(contract)
      if (contract.status === 'terminated') throw new Error('已终止合同不可提交审批')
      const approval = contract.approvalStatus ?? 'approved'
      if (approval === 'pending') throw new Error('合同已在审批中')
      if (approval === 'approved') {
        const hasDraft = (contract.versions ?? []).some(
          (v) => v.status === 'draft' || v.status === 'rejected',
        )
        if (!hasDraft) {
          throw new Error('合同已生效，请先编辑或续约后再提交审批')
        }
      }
      const now = new Date().toISOString()
      contract.approvalStatus = 'pending'
      contract.submittedBy = operator
      contract.submittedAt = now
      contract.approvedBy = undefined
      contract.approvedAt = undefined
      contract.approvalRemark = undefined
      contract.updatedAt = now

      let working = (contract.versions ?? []).find(
        (v) => v.status === 'draft' || v.status === 'pending' || v.status === 'rejected',
      )
      if (!working) {
        working = createContractVersion(contract, 'pending', {
          changeNote: '提交审批版本',
          submittedBy: operator,
          submittedAt: now,
        })
        contract.versions = [...(contract.versions ?? []), working]
      } else {
        working.status = 'pending'
        working.submittedBy = operator
        working.submittedAt = now
        working.approvedBy = undefined
        working.approvedAt = undefined
        working.approvalRemark = undefined
        working.updatedAt = now
      }

      // 待审期间运行配置仍为原生效版本
      if (!restoreEffectiveConfig(contract)) {
        contract.status = 'draft'
      }

      contract.operationLogs = [
        ...(contract.operationLogs ?? []),
        {
          id: generateId('log'),
          operator,
          action: `提交合同审批（V${working.version}）；审批通过前仍沿用原生效配置`,
          createdAt: new Date().toLocaleString('zh-CN'),
        },
      ]
      this.persist('serviceContracts')
      return contract
    },

    approveServiceContract(id: string, remark?: string, operator = '平台负责人') {
      const contract = this.serviceContracts.find((c) => c.id === id)
      if (!contract) throw new Error('合同不存在')
      ensureContractVersions(contract)
      if ((contract.approvalStatus ?? 'approved') !== 'pending') {
        throw new Error('仅待审批合同可通过')
      }
      const now = new Date().toISOString()
      const timeLabel = new Date(now).toLocaleString('zh-CN')
      const working = (contract.versions ?? []).find((v) => v.status === 'pending')
      if (!working) {
        throw new Error('未找到待审批版本')
      }

      for (const v of contract.versions ?? []) {
        if (v.status === 'effective') {
          v.status = 'history'
          v.updatedAt = now
        }
      }

      working.status = 'effective'
      working.approvedBy = operator
      working.approvedAt = now
      working.approvalRemark = remark?.trim() || undefined
      working.updatedAt = now

      applyContractConfig(contract, working)
      contract.approvalStatus = 'approved'
      contract.status = 'active'
      contract.approvedBy = operator
      contract.approvedAt = now
      contract.approvalRemark = remark?.trim() || undefined
      contract.currentVersion = working.version
      contract.updatedAt = now
      contract.operationLogs = [
        ...(contract.operationLogs ?? []),
        {
          id: generateId('log'),
          operator,
          action: remark?.trim()
            ? `审批通过 V${working.version}（${operator} · ${timeLabel}）：${remark.trim()}`
            : `审批通过 V${working.version}（${operator} · ${timeLabel}）`,
          createdAt: timeLabel,
        },
      ]
      this.persist('serviceContracts')
      return contract
    },

    rejectServiceContract(id: string, remark: string, operator = '平台负责人') {
      const contract = this.serviceContracts.find((c) => c.id === id)
      if (!contract) throw new Error('合同不存在')
      ensureContractVersions(contract)
      if ((contract.approvalStatus ?? 'approved') !== 'pending') {
        throw new Error('仅待审批合同可驳回')
      }
      const reason = remark.trim()
      if (!reason) throw new Error('请填写驳回原因')
      const now = new Date().toISOString()
      const timeLabel = new Date(now).toLocaleString('zh-CN')
      const working = (contract.versions ?? []).find((v) => v.status === 'pending')
      if (working) {
        working.status = 'rejected'
        working.approvedBy = operator
        working.approvedAt = now
        working.approvalRemark = reason
        working.updatedAt = now
      }
      contract.approvalStatus = 'rejected'
      contract.approvedBy = operator
      contract.approvedAt = now
      contract.approvalRemark = reason
      contract.updatedAt = now
      // 驳回后运行配置仍为原生效版
      if (!restoreEffectiveConfig(contract)) {
        contract.status = 'draft'
      }
      contract.operationLogs = [
        ...(contract.operationLogs ?? []),
        {
          id: generateId('log'),
          operator,
          action: `审批驳回 V${working?.version ?? '-'}（${operator} · ${timeLabel}）：${reason}`,
          createdAt: timeLabel,
        },
      ]
      this.persist('serviceContracts')
      return contract
    },

    terminateServiceContract(id: string) {
      const contract = this.serviceContracts.find((c) => c.id === id)
      if (!contract) throw new Error('合约不存在')
      ensureContractVersions(contract)
      if (contract.status === 'terminated') throw new Error('合同已终止')
      if ((contract.approvalStatus ?? 'approved') !== 'approved') {
        throw new Error('仅已通过审批的合同可终止')
      }
      contract.status = 'terminated'
      contract.updatedAt = new Date().toISOString()
      for (const v of contract.versions ?? []) {
        if (v.status === 'effective') {
          v.status = 'history'
          v.updatedAt = contract.updatedAt
        }
      }
      contract.currentVersion = 0
      contract.operationLogs = [
        ...(contract.operationLogs ?? []),
        {
          id: generateId('log'),
          operator: '平台运营',
          action: '终止了合约合作',
          createdAt: new Date().toLocaleString('zh-CN'),
        },
      ]
      this.persist('serviceContracts')
    },

    /** 列表续约：按周期延长到期日（不走改版审批） */
    extendServiceContract(id: string, period: ContractRenewPeriod) {
      const contract = this.serviceContracts.find((c) => c.id === id)
      if (!contract) throw new Error('合约不存在')
      ensureContractVersions(contract)
      if (contract.status === 'terminated') throw new Error('已终止合同不可续约')
      const label = contractRenewPeriodOptions.find((item) => item.value === period)?.label ?? period
      const baseDate = resolveContractRenewBaseDate(contract.expiryDate)
      const nextExpiry = addContractRenewPeriod(baseDate, period)
      const now = new Date().toISOString()
      contract.expiryDate = nextExpiry
      contract.updatedAt = now
      if (contract.status === 'expired' || contract.status === 'expiring') {
        contract.status = 'active'
      }
      const effective = getEffectiveVersion(contract)
      if (effective) {
        effective.expiryDate = nextExpiry
        effective.updatedAt = now
      }
      contract.operationLogs = [
        ...(contract.operationLogs ?? []),
        {
          id: generateId('log'),
          operator: '平台运营',
          action: `续约延期 ${label}，到期日调整为 ${nextExpiry}`,
          createdAt: new Date().toLocaleString('zh-CN'),
        },
      ]
      this.persist('serviceContracts')
      return contract
    },

    restoreServiceContract(id: string) {
      const contract = this.serviceContracts.find((c) => c.id === id)
      if (!contract) throw new Error('合约不存在')
      ensureContractVersions(contract)
      if (contract.status !== 'terminated') throw new Error('仅已终止合同可恢复')
      const today = new Date().toISOString().slice(0, 10)
      if (!contract.expiryDate || contract.expiryDate < today) {
        throw new Error('合同已到期，无法恢复')
      }
      const versions = [...(contract.versions ?? [])].sort((a, b) => b.version - a.version)
      const restoreVersion =
        versions.find((v) => v.status === 'history') ||
        versions.find((v) => v.status !== 'pending' && v.status !== 'draft' && v.status !== 'rejected')
      if (!restoreVersion) throw new Error('未找到可恢复的历史版本')
      for (const v of contract.versions ?? []) {
        if (v.status === 'effective') {
          v.status = 'history'
          v.updatedAt = new Date().toISOString()
        }
      }
      const now = new Date().toISOString()
      restoreVersion.status = 'effective'
      restoreVersion.updatedAt = now
      applyContractConfig(contract, restoreVersion)
      contract.status = 'active'
      contract.currentVersion = restoreVersion.version
      contract.approvalStatus = contract.approvalStatus ?? 'approved'
      contract.updatedAt = now
      contract.operationLogs = [
        ...(contract.operationLogs ?? []),
        {
          id: generateId('log'),
          operator: '平台运营',
          action: `恢复合同至生效状态（V${restoreVersion.version}）`,
          createdAt: new Date().toLocaleString('zh-CN'),
        },
      ]
      this.persist('serviceContracts')
      return contract
    },

    updateEnterpriseAuthorizedDepartments(enterpriseId: string, departmentIds: string[]) {
      const ent = this.enterprises.find((e) => e.id === enterpriseId)
      if (!ent) throw new Error('企业不存在')
      ent.authorizedDepartmentIds = [...new Set(departmentIds)]
      this.persist('enterprises')
      return ent
    },

    updateDepartmentAuthorizedDepartments(departmentId: string, departmentIds: string[]) {
      const dept = this.departments.find((d) => d.id === departmentId)
      if (!dept) throw new Error('部门不存在')
      dept.authorizedDepartmentIds = [...new Set(departmentIds)]
      this.persist('departments')
      return dept
    },

    addServiceProvider(
      data: Omit<
        ServiceProvider,
        'id' | 'code' | 'status' | 'linkedEnterpriseIds' | 'createdAt' | 'updatedAt'
      > & { status?: ServiceProvider['status'] },
    ) {
      const seq = this.serviceProviders.length + 1
      const now = new Date().toISOString()
      const item: ServiceProvider = {
        ...data,
        id: generateId('sp'),
        code: generateServiceProviderCode(seq),
        status: data.status ?? 'cooperating',
        linkedEnterpriseIds: [],
        signContractTemplates: data.signContractTemplates ?? [],
        createdAt: now,
        updatedAt: now,
      }
      this.serviceProviders.unshift(item)
      this.persist('serviceProviders')
      return item
    },

    updateServiceProvider(id: string, data: Partial<ServiceProvider>) {
      const provider = this.serviceProviders.find((p) => p.id === id)
      if (!provider) throw new Error('服务商不存在')
      Object.assign(provider, data, { updatedAt: new Date().toISOString() })
      this.persist('serviceProviders')
      return provider
    },

    updateServiceProviderStatus(id: string, status: ServiceProvider['status']) {
      return this.updateServiceProvider(id, { status })
    },

    addEnterpriseTaskType(
      enterpriseId: string,
      data: Omit<
        TaskType,
        | 'id'
        | 'enterpriseId'
        | 'enterpriseName'
        | 'status'
        | 'createdAt'
        | 'submittedAt'
        | 'reviewedBy'
        | 'reviewedAt'
        | 'reviewNote'
      >,
    ) {
      const ent = this.enterprises.find((e) => e.id === enterpriseId)
      if (!ent) throw new Error('企业不存在')
      const item: TaskType = {
        ...data,
        id: generateId('tt'),
        enterpriseId,
        enterpriseName: ent.name,
        status: 'draft',
        createdAt: new Date().toISOString(),
      }
      this.taskTypes.push(item)
      this.persist('taskTypes')
      return item
    },

    updateEnterpriseTaskType(id: string, data: Partial<TaskType>) {
      const tt = this.taskTypes.find((t) => t.id === id)
      if (!tt) throw new Error('任务类型不存在')
      if (!['draft', 'rejected'].includes(tt.status)) {
        throw new Error('仅草稿或已驳回状态可编辑')
      }
      Object.assign(tt, data)
      this.persist('taskTypes')
    },

    submitEnterpriseTaskType(id: string, applicant?: string) {
      const tt = this.taskTypes.find((t) => t.id === id)
      if (!tt) throw new Error('任务类型不存在')
      if (!['draft', 'rejected'].includes(tt.status)) {
        throw new Error('当前状态不可提交审批')
      }
      tt.status = 'pending'
      tt.applicant = applicant ?? this.enterprises.find((e) => e.id === tt.enterpriseId)?.contact
      tt.submittedAt = new Date().toISOString()
      tt.reviewedBy = undefined
      tt.reviewedAt = undefined
      tt.reviewNote = undefined
      this.persist('taskTypes')
      this.pushNotification({
        title: '任务类型待审批',
        content: `${tt.enterpriseName} 提交了任务类型「${tt.name}」`,
        type: 'approval',
      })
    },

    disableEnterpriseTaskType(id: string) {
      const tt = this.taskTypes.find((t) => t.id === id)
      if (!tt) throw new Error('任务类型不存在')
      if (tt.status !== 'published') throw new Error('仅已发布类型可停用')
      tt.status = 'disabled'
      this.persist('taskTypes')
    },

    addEnterpriseTask(
      enterpriseId: string,
      data: Omit<
        Task,
        | 'id'
        | 'enterpriseId'
        | 'enterpriseName'
        | 'taskTypeName'
        | 'status'
        | 'acceptedCount'
        | 'completedCount'
        | 'approvedCount'
        | 'createdAt'
      >,
    ) {
      const ent = this.enterprises.find((e) => e.id === enterpriseId)
      if (!ent) throw new Error('企业不存在')
      const wf = this.taskWorkflows.find((w) => w.id === data.workflowId)
      if (!wf || wf.status !== 'enabled') throw new Error('请选择已启用的任务流程')
      if (
        wf.enterpriseScope === 'specific' &&
        !(wf.enterpriseIds ?? []).includes(enterpriseId)
      ) {
        throw new Error('该流程不适用于当前企业')
      }
      if (!data.pricingMode) throw new Error('请配置任务定价')

      const item: Task = {
        ...data,
        id: generateId('task'),
        enterpriseId,
        enterpriseName: ent.name,
        taskTypeName: wf.name,
        workflowId: wf.id,
        status: 'draft',
        acceptedCount: 0,
        completedCount: 0,
        approvedCount: 0,
        createdAt: new Date().toISOString(),
      }
      this.tasks.push(item)
      this.persist('tasks')
      return item
    },

    updateEnterpriseTask(id: string, data: Partial<Task>) {
      const task = this.tasks.find((t) => t.id === id)
      if (!task) throw new Error('任务不存在')
      if (task.status !== 'draft' && task.status !== 'rejected') {
        throw new Error('仅未发布或已驳回任务可编辑')
      }
      if (data.workflowId && data.workflowId !== task.workflowId) {
        const wf = this.taskWorkflows.find((w) => w.id === data.workflowId)
        if (!wf || wf.status !== 'enabled') throw new Error('无效的任务流程')
        if (
          wf.enterpriseScope === 'specific' &&
          !(wf.enterpriseIds ?? []).includes(task.enterpriseId)
        ) {
          throw new Error('该流程不适用于当前企业')
        }
        task.workflowId = wf.id
        task.taskTypeName = wf.name
      }
      Object.assign(task, data)
      if (task.status === 'rejected') task.status = 'draft'
      this.persist('tasks')
    },

    publishEnterpriseTask(id: string) {
      const task = this.tasks.find((t) => t.id === id)
      if (!task) throw new Error('任务不存在')
      if (task.status !== 'draft' && task.status !== 'rejected') {
        throw new Error('任务已提交或已上线')
      }
      task.status = 'pending'
      task.reviewNote = undefined
      task.reviewedAt = undefined
      task.reviewedBy = undefined
      this.persist('tasks')
      this.pushNotification({
        title: '任务待审批',
        content: `${task.enterpriseName} 提交了任务「${task.name}」，待平台审核`,
        type: 'approval',
      })
    },

    /** 平台审核企业发布的任务：可通过前修改发布内容与结算价，通过后进入任务大厅 */
    reviewEnterpriseTask(
      id: string,
      approved: boolean,
      reviewNote = '',
      reviewedBy = '运营-李芳',
      edits?: Partial<
        Pick<
          Task,
          | 'name'
          | 'description'
          | 'region'
          | 'plannedTotal'
          | 'unlimitedQuantity'
          | 'incentive'
          | 'trainingCourseId'
          | 'pricingMode'
          | 'fixedPrice'
          | 'tieredPrices'
          | 'settlementUnitPrice'
          | 'departmentId'
          | 'departmentName'
          | 'startTime'
          | 'endTime'
          | 'longTerm'
          | 'maxPerPerson'
          | 'dispatchMode'
          | 'assigneeIds'
          | 'workflowId'
          | 'taskTypeName'
        >
      >,
    ) {
      const task = this.tasks.find((t) => t.id === id)
      if (!task) throw new Error('任务不存在')
      if (task.status !== 'pending') throw new Error('任务不在待审核状态')
      if (approved && edits) {
        if (edits.workflowId && edits.workflowId !== task.workflowId) {
          const wf = this.taskWorkflows.find((w) => w.id === edits.workflowId)
          if (!wf || wf.status !== 'enabled') throw new Error('无效的任务流程')
          edits.taskTypeName = wf.name
        }
        Object.assign(task, edits)
        if (task.settlementUnitPrice == null) {
          const customer =
            task.pricingMode === 'tiered'
              ? task.tieredPrices?.[0]?.unitPrice
              : task.fixedPrice
          if (customer != null) task.settlementUnitPrice = customer
        }
      }
      const now = new Date().toISOString()
      task.reviewedBy = reviewedBy
      task.reviewedAt = now
      task.reviewNote = reviewNote.trim() || undefined
      if (approved) {
        task.status = 'active'
        this.pushNotification({
          title: '任务审核通过',
          content: `任务「${task.name}」已通过审核，已进入任务大厅`,
          type: 'system',
        })
      } else {
        task.status = 'rejected'
        this.pushNotification({
          title: '任务审核驳回',
          content: `任务「${task.name}」未通过审核${reviewNote ? `：${reviewNote}` : ''}`,
          type: 'system',
        })
      }
      this.persist('tasks')
      return task
    },

    cancelEnterpriseTask(id: string) {
      const task = this.tasks.find((t) => t.id === id)
      if (!task) throw new Error('任务不存在')
      if (task.status !== 'active') throw new Error('仅进行中的任务可取消')
      task.status = 'cancelled'
      this.persist('tasks')
    },

    reviewTaskInstance(instanceId: string, approved: boolean, reviewNote = '') {
      this.executeEnterpriseInstanceAction(instanceId, approved ? 'confirm' : 'reject', {
        note: reviewNote,
      })
    },

    executeEnterpriseInstanceAction(
      instanceId: string,
      action: import('@/types').WorkflowAction,
      options: {
        note?: string
        fieldValues?: Record<string, string | number | boolean>
        operator?: string
      } = {},
    ) {
      const instance = this.taskInstances.find((i) => i.id === instanceId)
      if (!instance) throw new Error('任务实例不存在')

      const task = this.tasks.find((t) => t.id === instance.taskId)
      const workflow = this.taskWorkflows.find((w) => w.id === task?.workflowId)
      if (!task || !workflow) throw new Error('关联任务或工作流不存在')

      const currentNode = getNodeById(workflow.nodes, instance.currentNodeId)
      if (!currentNode || currentNode.role !== 'enterprise') {
        throw new Error('当前节点无需企业操作')
      }
      if (!nodeHasAction(currentNode, action)) {
        throw new Error('当前节点不支持该操作')
      }

      const nodeId = instance.currentNodeId
      if (options.fieldValues) {
        instance.fieldValues = { ...(instance.fieldValues ?? {}), ...options.fieldValues }
      }
      validateWorkflowNodeFields(workflow, nodeId, instance.fieldValues ?? {})

      const nodeFields = getWorkflowFieldsForNode(workflow, nodeId)
      const note =
        options.note?.trim() ||
        extractEnterpriseActionNote(nodeFields, instance.fieldValues ?? {}, action) ||
        ''
      const operator = options.operator ?? '企业'

      if (action === 'reject' && !note) {
        throw new Error('请填写驳回原因')
      }
      if (action === 'cancel' && !note) {
        throw new Error('请填写中止原因')
      }

      const targetId = resolveActionTargetNodeId(currentNode, action, workflow.nodes)
      let target = targetId ? getNodeById(workflow.nodes, targetId) : undefined
      if (!target) throw new Error('流程流转失败')

      const now = new Date().toISOString()
      const prevName = instance.currentNodeName

      instance.currentNodeId = target.id
      instance.currentNodeName = target.name

      if (action === 'confirm' || action === 'approve') {
        target = advanceThroughSystemNodes(workflow, target)
        instance.currentNodeId = target.id
        instance.currentNodeName = target.name
      }

      instance.updatedAt = now
      instance.timeoutAt = undefined

      if (!instance.logs) instance.logs = []
      instance.logs.forEach((l) => {
        if (l.tag === '当前') l.tag = undefined
      })

      let logTitle = `企业操作：${prevName}`
      let logDesc = note

      if (action === 'confirm' || action === 'approve') {
        logTitle = '企业审核通过'
        logDesc = note || '审核通过，任务已完成'
        if (isWorkflowCompletedEndNode(target)) {
          task.completedCount += instance.claimQuantity ?? 1
        }
        this.addMiniAppMessage(
          instance.workerId,
          'task',
          '任务审核通过',
          `「${instance.taskName}」已通过企业审核${note ? `：${note}` : ''}。`,
        )
        this.pushNotification({
          title: '任务审核通过',
          content: `「${instance.taskName}」${instance.workerName} 的提交已通过${note ? `：${note}` : ''}`,
          type: 'approval',
        })
      } else if (action === 'reject') {
        logTitle = '企业审核驳回'
        logDesc = note || '已驳回，需重新提交'
        this.addMiniAppMessage(
          instance.workerId,
          'task',
          '任务被驳回',
          `「${instance.taskName}」未通过审核，请修改后重新提交${note ? `。原因：${note}` : ''}。`,
        )
        this.pushNotification({
          title: '任务审核驳回',
          content: `「${instance.taskName}」${instance.workerName} 的提交已驳回${note ? `：${note}` : ''}`,
          type: 'approval',
        })
      } else if (action === 'cancel') {
        logTitle = '企业中止任务'
        logDesc = note || '企业结束任务，认领已中止'
        this.addMiniAppMessage(
          instance.workerId,
          'task',
          '任务已中止',
          `「${instance.taskName}」已被企业中止${note ? `。原因：${note}` : ''}。`,
        )
        this.pushNotification({
          title: '任务已中止',
          content: `「${instance.taskName}」${instance.workerName} 的认领已中止${note ? `：${note}` : ''}`,
          type: 'approval',
        })
      }

      instance.logs.push({
        id: generateId('tilog'),
        title: logTitle,
        tag: '企业操作',
        operator,
        time: now,
        description: logDesc,
        kind: 'manual',
      })
      instance.logs.push({
        id: generateId('tilog'),
        title: `进入「${target.name}」节点`,
        tag: '当前',
        operator,
        time: now,
        description:
          action === 'reject'
            ? '驳回后灵工需重新执行并提交。'
            : action === 'cancel'
              ? '任务已中止。'
              : '审核通过后进入该节点。',
        kind: 'system',
      })

      this.persist('taskInstances')
      this.persist('tasks')
    },

    appendTaskInstanceLog(instanceId: string, log: Omit<TaskInstanceLog, 'id'>) {
      const instance = this.taskInstances.find((i) => i.id === instanceId)
      if (!instance) throw new Error('任务实例不存在')
      if (!instance.logs) instance.logs = []
      instance.logs.push({ ...log, id: generateId('tilog') })
      instance.updatedAt = log.time
    },

    forceTransferTaskInstance(instanceId: string, targetNodeId: string, operator = '管理员') {
      const instance = this.taskInstances.find((i) => i.id === instanceId)
      if (!instance) throw new Error('任务实例不存在')
      const task = this.tasks.find((t) => t.id === instance.taskId)
      const workflow = this.taskWorkflows.find((w) => w.id === task?.workflowId)
      if (!task || !workflow) throw new Error('关联任务或工作流不存在')
      const target = getNodeById(workflow.nodes, targetNodeId)
      if (!target) throw new Error('目标节点不存在')

      const now = new Date().toISOString()
      const prevName = instance.currentNodeName
      instance.currentNodeId = target.id
      instance.currentNodeName = target.name
      instance.updatedAt = now
      instance.timeoutAt = undefined

      if (!instance.logs) instance.logs = []
      instance.logs.forEach((l) => {
        if (l.tag === '当前') l.tag = undefined
      })
      instance.logs.push({
        id: generateId('tilog'),
        title: `人工干预：强制流转节点`,
        tag: '人工干预',
        operator,
        time: now,
        description: `从「${prevName}」强制流转至「${target.name}」。`,
        kind: 'manual',
      })
      instance.logs.push({
        id: generateId('tilog'),
        title: `进入「${target.name}」节点`,
        tag: '当前',
        operator,
        time: now,
        description: '管理员强制流转后进入该节点。',
        kind: 'system',
      })

      this.persist('taskInstances')
    },

    reassignTaskInstance(instanceId: string, newWorkerId: string, operator = '管理员') {
      const instance = this.taskInstances.find((i) => i.id === instanceId)
      if (!instance) throw new Error('任务实例不存在')
      const emp = this.employees.find((e) => e.id === newWorkerId)
      if (!emp) throw new Error('灵工不存在')
      if (emp.id === instance.workerId) throw new Error('请选择不同的灵工')
      this.assertCourseGateForEmployee(newWorkerId, 'task')
      const task = this.tasks.find((t) => t.id === instance.taskId)
      if (task && isEmployeeUnavailableInRange(emp, task.startTime, task.endTime)) {
        throw new Error('该灵工已配置请假/不上岗，任务期限内无法指派')
      }

      const now = new Date().toISOString()
      const prevWorker = instance.workerName
      instance.workerId = emp.id
      instance.workerName = emp.name
      instance.updatedAt = now

      if (!instance.logs) instance.logs = []
      instance.logs.push({
        id: generateId('tilog'),
        title: '操作日志：人工干预-转派',
        tag: '人工干预',
        operator,
        time: now,
        description: `因原灵工未及时响应，将任务从「${prevWorker}」转派至「${emp.name}」。`,
        kind: 'manual',
      })

      this.persist('taskInstances')
      this.addMiniAppMessage(
        emp.id,
        'task',
        '任务转派通知',
        `您已被转派任务「${instance.taskName}」，请尽快处理。`,
      )
    },

    forceCancelTaskInstance(instanceId: string, reason: string, operator = '管理员') {
      const instance = this.taskInstances.find((i) => i.id === instanceId)
      if (!instance) throw new Error('任务实例不存在')
      const task = this.tasks.find((t) => t.id === instance.taskId)
      const workflow = this.taskWorkflows.find((w) => w.id === task?.workflowId)
      if (!task || !workflow) throw new Error('关联任务或工作流不存在')

      const cancelNode = getCancelledEndNode(workflow.nodes)
      if (!cancelNode) throw new Error('工作流缺少取消节点')

      const now = new Date().toISOString()
      instance.currentNodeId = cancelNode.id
      instance.currentNodeName = cancelNode.name
      instance.updatedAt = now
      instance.timeoutAt = undefined
      task.acceptedCount = Math.max(0, task.acceptedCount - instance.claimQuantity)

      if (!instance.logs) instance.logs = []
      instance.logs.forEach((l) => {
        if (l.tag === '当前') l.tag = undefined
      })
      instance.logs.push({
        id: generateId('tilog'),
        title: '人工干预：强制取消任务',
        tag: '人工干预',
        operator,
        time: now,
        description: reason,
        kind: 'manual',
      })

      this.persist('taskInstances')
      this.persist('tasks')
    },

    suggestTaskName(workflowId: string) {
      const wf = this.taskWorkflows.find((w) => w.id === workflowId)
      if (wf) return generateTaskName(wf.name)
      const tt = this.taskTypes.find((t) => t.id === workflowId)
      return tt ? generateTaskName(tt.name) : ''
    },

    // Recruitment
    addJobRequirement(data: Omit<JobRequirement, 'id' | 'filledCount' | 'createdAt'>) {
      const item: JobRequirement = {
        ...data,
        id: generateId('req'),
        filledCount: 0,
        createdAt: new Date().toISOString(),
      }
      this.jobRequirements.unshift(item)
      this.persist('jobRequirements')
      return item
    },

    updateJobRequirement(id: string, data: Partial<JobRequirement>) {
      const req = this.jobRequirements.find((r) => r.id === id)
      if (!req) throw new Error('岗位需求不存在')
      Object.assign(req, data)
      this.persist('jobRequirements')
    },

    publishJobRequirement(id: string) {
      const req = this.jobRequirements.find((r) => r.id === id)
      if (!req) throw new Error('岗位需求不存在')
      req.status = 'recruiting'
      this.persist('jobRequirements')
    },

    closeJobRequirement(id: string) {
      const req = this.jobRequirements.find((r) => r.id === id)
      if (!req) throw new Error('岗位需求不存在')
      req.status = 'completed'
      this.persist('jobRequirements')
    },

    addRecruitmentLead(
      data: Omit<RecruitmentLead, 'id' | 'createdAt' | 'updatedAt'>,
    ) {
      const now = new Date().toISOString()
      const item: RecruitmentLead = {
        ...data,
        id: generateId('lead'),
        createdAt: now,
        updatedAt: now,
      }
      this.recruitmentLeads.unshift(item)
      this.persist('recruitmentLeads')
      return item
    },

    updateRecruitmentLead(id: string, data: Partial<RecruitmentLead>) {
      const lead = this.recruitmentLeads.find((l) => l.id === id)
      if (!lead) throw new Error('线索不存在')
      Object.assign(lead, data, { updatedAt: new Date().toISOString() })
      this.persist('recruitmentLeads')
    },

    transitionLeadStatus(
      id: string,
      targetStatus: RecruitmentLead['status'],
      options?: { feedback?: string; deviateReason?: string; interviewScore?: number },
    ) {
      const lead = this.recruitmentLeads.find((l) => l.id === id)
      if (!lead) throw new Error('线索不存在')
      const from = lead.status
      if (from === targetStatus) return

      if (from === 'feedback_pending' && targetStatus === 'interview_pending') {
        const cur = lead.currentRound ?? 1
        const total = lead.totalRounds ?? 1
        if (cur >= total) throw new Error('已是最后一轮面试')
        lead.currentRound = cur + 1
      }

      if (
        from === 'feedback_pending' &&
        ['salary_negotiation', 'onboarding_pending'].includes(targetStatus) &&
        (lead.currentRound ?? 1) < (lead.totalRounds ?? 1)
      ) {
        lead.ext = {
          ...lead.ext,
          deviated: true,
          deviateReason: options?.deviateReason ?? `提前通过（跳过第 ${(lead.currentRound ?? 1) + 1} 轮）`,
        }
      }

      lead.status = targetStatus
      if (options?.feedback) lead.interviewFeedback = options.feedback
      if (options?.interviewScore != null) {
        lead.ext = { ...lead.ext, interviewScore: options.interviewScore }
      }
      lead.ext = {
        ...lead.ext,
        flowLog: [
          ...(lead.ext?.flowLog ?? []),
          { at: new Date().toISOString(), from, to: targetStatus, note: options?.feedback },
        ],
      }
      lead.updatedAt = new Date().toISOString()

      if (targetStatus === 'onboarded') {
        const req = this.jobRequirements.find((r) => r.id === lead.requirementId)
        if (req) req.filledCount += 1
        this.persist('jobRequirements')
      }
      this.persist('recruitmentLeads')
    },

    advanceLeadStatus(id: string, feedback?: string) {
      const lead = this.recruitmentLeads.find((l) => l.id === id)
      if (!lead) throw new Error('线索不存在')
      const idx = RECRUITMENT_STATUS_FLOW.indexOf(lead.status)
      if (idx < 0 || idx >= RECRUITMENT_STATUS_FLOW.length - 1) {
        throw new Error('已是最终状态')
      }
      this.transitionLeadStatus(id, RECRUITMENT_STATUS_FLOW[idx + 1], { feedback })
    },

    setLeadStatus(id: string, status: RecruitmentLead['status'], note?: string) {
      const lead = this.recruitmentLeads.find((l) => l.id === id)
      if (!lead) throw new Error('线索不存在')
      lead.status = status
      if (note) lead.notes = note
      lead.updatedAt = new Date().toISOString()
      this.persist('recruitmentLeads')
    },

    addTalent(data: Omit<Talent, 'id' | 'createdAt'>) {
      const item: Talent = {
        ...data,
        id: generateId('tal'),
        skills: data.skills ?? [],
        createdAt: new Date().toISOString(),
      }
      this.talents.unshift(item)
      this.persist('talents')
      return item
    },

    updateTalent(id: string, data: Partial<Talent>) {
      const talent = this.talents.find((t) => t.id === id)
      if (!talent) throw new Error('人才不存在')
      Object.assign(talent, data)
      this.persist('talents')
    },

    createLeadFromTalent(talentId: string, requirementId: string) {
      const talent = this.talents.find((t) => t.id === talentId)
      const req = this.jobRequirements.find((r) => r.id === requirementId)
      if (!talent || !req) throw new Error('人才或岗位不存在')
      if (req.status !== 'recruiting') throw new Error('岗位未在招聘中')

      const lead = this.addRecruitmentLead({
        requirementId: req.id,
        requirementTitle: req.title,
        enterpriseId: req.enterpriseId,
        enterpriseName: req.enterpriseName,
        candidateName: talent.name,
        phone: talent.phone,
        idCard: talent.idCard,
        position: req.title,
        source: talent.source,
        status: 'screening',
        currentRound: 1,
        totalRounds: req.interviewRounds ?? 1,
        talentId: talent.id,
      })
      talent.status = 'in_process'
      talent.lastContactAt = new Date().toISOString()
      this.persist('talents')
      return lead
    },

    addAttendanceGroup(data: Omit<AttendanceGroup, 'id' | 'code' | 'createdAt' | 'updatedAt' | 'currentVersion' | 'versions'>) {
      const now = new Date().toISOString()
      const seq = this.attendanceGroups.length + 1
      const item: AttendanceGroup = {
        ...data,
        id: generateId('ag'),
        code: `HQ-ATT-${String(seq).padStart(3, '0')}`,
        currentVersion: 0,
        versions: [],
        createdAt: now,
        updatedAt: now,
      }
      if (item.attendanceType === 'none') {
        delete item.pricingConfig
      }
      this.attendanceGroups.unshift(item)
      this.persist('attendanceGroups')
      return item
    },

    updateAttendanceGroup(id: string, data: Partial<AttendanceGroup>) {
      const group = this.attendanceGroups.find((g) => g.id === id)
      if (!group) throw new Error('考勤组不存在')
      const payload = { ...data }
      if (payload.attendanceType === 'none' || group.attendanceType === 'none') {
        delete payload.pricingConfig
      }
      if (payload.attendanceType === 'none') {
        group.pricingConfig = undefined
      }
      Object.assign(group, payload, { updatedAt: new Date().toISOString() })
      this.persist('attendanceGroups')
    },

    publishAttendanceGroup(
      id: string,
      data: Partial<Omit<AttendanceGroup, 'id' | 'code' | 'createdAt' | 'currentVersion' | 'versions'>>,
      changeNote?: string,
    ) {
      const group = this.attendanceGroups.find((g) => g.id === id)
      if (!group) throw new Error('考勤组不存在')
      const payload = { ...data }
      if (payload.attendanceType === 'none' || group.attendanceType === 'none') {
        delete payload.pricingConfig
      }
      Object.assign(group, payload, {
        status: 'enabled',
        updatedAt: new Date().toISOString(),
      })
      if (group.attendanceType === 'none') {
        group.pricingConfig = undefined
      }

      const nextVersion = (group.currentVersion || 0) + 1
      group.versions.forEach((v) => {
        v.isActive = false
      })
      const record = buildVersionRecord(group, nextVersion, changeNote)
      group.versions.unshift(record)
      group.currentVersion = nextVersion
      this.persist('attendanceGroups')
      return record
    },

    publishNewAttendanceGroup(
      data: Omit<AttendanceGroup, 'id' | 'code' | 'createdAt' | 'updatedAt' | 'currentVersion' | 'versions'>,
      changeNote?: string,
    ) {
      const item = this.addAttendanceGroup({ ...data, status: 'enabled' })
      return this.publishAttendanceGroup(item.id, {}, changeNote || '首次发布')
    },

    updateGroupScheduleRule(groupId: string, rule: ScheduleRule) {
      const group = this.attendanceGroups.find((g) => g.id === groupId)
      if (!group) throw new Error('考勤组不存在')
      group.scheduleRule = { ...rule }
      group.compliance = scheduleRuleToCompliance(rule, group.compliance)
      group.updatedAt = new Date().toISOString()
      this.persist('attendanceGroups')
    },

    updateGroupShiftDemands(
      groupId: string,
      shiftTemplates: AttendanceGroup['shiftTemplates'],
    ) {
      const group = this.attendanceGroups.find((g) => g.id === groupId)
      if (!group) throw new Error('考勤组不存在')
      group.shiftTemplates = shiftTemplates.map((t) => ({ ...t }))
      group.updatedAt = new Date().toISOString()
      this.persist('attendanceGroups')
    },

    getWeeklyShiftDemandPlan(teamId: string, weekStart: string) {
      return this.weeklyShiftDemandPlans.find(
        (p) => p.teamId === teamId && p.weekStart === weekStart,
      )
    },

    getShiftDemandPlanById(id: string) {
      return this.weeklyShiftDemandPlans.find((p) => p.id === id)
    },

    saveWeeklyShiftDemandPlan(data: {
      teamId: string
      weekStart: string
      weekEnd: string
      cells: ShiftDemandDayCell[]
      status: WeeklyShiftDemandPlan['status']
      commonConfig?: WeeklyShiftDemandPlan['commonConfig']
      id?: string
    }) {
      const now = new Date().toISOString()
      const existing = data.id
        ? this.getShiftDemandPlanById(data.id)
        : this.getWeeklyShiftDemandPlan(data.teamId, data.weekStart)
      const status = data.status === 'confirmed' ? 'published' : data.status
      if (existing) {
        existing.cells = data.cells.map((c) => ({ ...c }))
        existing.status = status
        existing.weekStart = data.weekStart
        existing.weekEnd = data.weekEnd
        existing.commonConfig = data.commonConfig
          ? JSON.parse(JSON.stringify(data.commonConfig))
          : existing.commonConfig
        existing.updatedAt = now
        if (status === 'published') {
          existing.publishedAt = now
          existing.publishedBy = existing.publishedBy || '平台运营'
        }
        this.persist('weeklyShiftDemandPlans')
        return existing
      }
      const item: WeeklyShiftDemandPlan = {
        id: generateId('wdp'),
        teamId: data.teamId,
        weekStart: data.weekStart,
        weekEnd: data.weekEnd,
        cells: data.cells.map((c) => ({ ...c })),
        status,
        commonConfig: data.commonConfig
          ? JSON.parse(JSON.stringify(data.commonConfig))
          : undefined,
        publishedAt: status === 'published' ? now : undefined,
        publishedBy: status === 'published' ? '平台运营' : undefined,
        createdAt: now,
        updatedAt: now,
      }
      this.weeklyShiftDemandPlans.push(item)
      this.persist('weeklyShiftDemandPlans')
      return item
    },

    publishShiftDemandPlan(id: string, operator = '平台运营') {
      const plan = this.getShiftDemandPlanById(id)
      if (!plan) throw new Error('班次需求计划不存在')
      const now = new Date().toISOString()
      plan.status = 'published'
      plan.publishedAt = now
      plan.publishedBy = operator
      plan.updatedAt = now
      this.persist('weeklyShiftDemandPlans')
      return plan
    },

    getTeamCycleScheduleRules(teamId: string) {
      return this.teamCycleScheduleRules.filter((r) => r.teamId === teamId)
    },

    saveTeamCycleScheduleRule(
      data: Omit<TeamCycleScheduleRule, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    ) {
      const now = new Date().toISOString()
      if (data.id) {
        const rule = this.teamCycleScheduleRules.find((r) => r.id === data.id)
        if (!rule) throw new Error('周期规则不存在')
        Object.assign(rule, data, { updatedAt: now })
      } else {
        const item: TeamCycleScheduleRule = {
          ...data,
          id: generateId('csr'),
          createdAt: now,
          updatedAt: now,
        }
        this.teamCycleScheduleRules.push(item)
      }
      this.persist('teamCycleScheduleRules')
    },

    removeTeamCycleScheduleRule(id: string) {
      this.teamCycleScheduleRules = this.teamCycleScheduleRules.filter((r) => r.id !== id)
      this.persist('teamCycleScheduleRules')
    },

    applyTeamCycleScheduleRule(
      ruleId: string,
      dates: string[],
      memberIds: string[],
    ): number {
      const rule = this.teamCycleScheduleRules.find((r) => r.id === ruleId)
      if (!rule) throw new Error('周期规则不存在')
      if (!dates.length) throw new Error('请指定生成区间')
      const employeeIds = rule.employeeIds.length ? rule.employeeIds : memberIds
      const draft = generateCycleSchedule(
        employeeIds,
        rule.shiftPattern,
        dates[0],
        dates.length,
        rule.teamId,
      )
      draft.forEach((item) => {
        this.upsertAssignment({
          ...item,
          published: false,
          manualEdited: true,
        })
      })
      rule.lastGeneratedAt = new Date().toISOString()
      rule.updatedAt = rule.lastGeneratedAt
      this.persist('teamCycleScheduleRules')
      return draft.length
    },

    tryAutoGenerateCycleRules(teamId: string, memberIds: string[], dates: string[]) {
      let total = 0
      this.getTeamCycleScheduleRules(teamId)
        .filter((r) => r.enabled)
        .forEach((rule) => {
          const today = new Date().toISOString().slice(0, 10)
          const leadDate = dates[0] ?? today
          const shouldRun =
            !rule.lastGeneratedAt ||
            rule.lastGeneratedAt.slice(0, 10) < leadDate
          if (!shouldRun) return
          total += this.applyTeamCycleScheduleRule(rule.id, dates, memberIds)
        })
      return total
    },

    toggleAttendanceGroupStatus(id: string) {
      const group = this.attendanceGroups.find((g) => g.id === id)
      if (!group) throw new Error('考勤组不存在')
      group.status = group.status === 'enabled' ? 'disabled' : 'enabled'
      group.updatedAt = new Date().toISOString()
      this.persist('attendanceGroups')
    },

    removeAttendanceGroup(id: string) {
      this.attendanceGroups = this.attendanceGroups.filter((g) => g.id !== id)
      this.persist('attendanceGroups')
    },

    addPricingTemplate(name: string, config: AttendanceGroupPricingConfig) {
      const trimmed = name.trim()
      if (!trimmed) throw new Error('请填写模版名称')
      if (this.pricingTemplates.some((t) => t.name === trimmed)) {
        throw new Error('模版名称已存在')
      }
      const now = new Date().toISOString()
      const item: AttendanceGroupPricingTemplate = {
        id: generateId('ptpl'),
        name: trimmed,
        config: normalizePricingConfig(JSON.parse(JSON.stringify(config))),
        createdAt: now,
        updatedAt: now,
      }
      this.pricingTemplates.unshift(item)
      this.persist('pricingTemplates')
      return item
    },

    removePricingTemplate(id: string) {
      this.pricingTemplates = this.pricingTemplates.filter((t) => t.id !== id)
      this.persist('pricingTemplates')
    },

    createSystemRole(data: Omit<SystemRole, 'id' | 'updatedAt' | 'userCount' | 'isSystem'>) {
      if (data.rolePortal === 'enterprise' && !data.enterpriseId) {
        throw new Error('企业端角色必须指定所属企业')
      }
      const item: SystemRole = {
        ...data,
        id: generateId('role'),
        userCount: 0,
        isSystem: false,
        updatedAt: new Date().toISOString(),
      }
      this.systemRoles.unshift(item)
      this.persist('systemRoles')
      return item
    },

    updateSystemRole(id: string, data: Partial<SystemRole>) {
      const role =
        this.systemRoles.find((r) => r.id === id) ??
        this.enterpriseRoleTemplates.find((r) => r.id === id)
      if (!role) throw new Error('角色不存在')
      if (role.isSystem && data.code && data.code !== role.code) {
        throw new Error('系统内置角色不可修改编码')
      }
      Object.assign(role, data, { updatedAt: new Date().toISOString() })
      if (role.isTemplate) this.persist('enterpriseRoleTemplates')
      else this.persist('systemRoles')
    },

    updateRolePermissions(
      id: string,
      permissionIds: string[],
      dataScope: SystemRole['dataScope'],
      customDepartmentIds: string[],
      extras?: {
        menuPermissions?: SystemRole['menuPermissions']
        platformDataScope?: SystemRole['platformDataScope']
        partialEnterpriseIds?: string[]
      },
    ) {
      const role =
        this.systemRoles.find((r) => r.id === id) ??
        this.enterpriseRoleTemplates.find((r) => r.id === id)
      if (!role) throw new Error('角色不存在')
      role.permissionIds = permissionIds
      role.dataScope = dataScope
      role.customDepartmentIds = customDepartmentIds
      if (extras?.menuPermissions) role.menuPermissions = extras.menuPermissions
      if (extras?.platformDataScope) role.platformDataScope = extras.platformDataScope
      if (extras?.partialEnterpriseIds) role.partialEnterpriseIds = extras.partialEnterpriseIds
      role.updatedAt = new Date().toISOString()
      if (role.isTemplate) {
        this.persist('enterpriseRoleTemplates')
      } else {
        this.persist('systemRoles')
      }
    },

    ensureEnterpriseRoles(enterpriseId: string) {
      const existing = this.systemRoles.some(
        (r) => r.rolePortal === 'enterprise' && r.enterpriseId === enterpriseId,
      )
      if (existing) return
      const roles = buildEnterpriseRolesForAll([{ id: enterpriseId }])
      this.systemRoles.push(...roles)
      this.persist('systemRoles')
    },

    applyRoleTemplateToEnterprise(templateId: string, enterpriseId: string) {
      const template = this.enterpriseRoleTemplates.find((t) => t.id === templateId)
      if (!template) throw new Error('模板不存在')
      const roleId = buildEnterpriseRoleId(enterpriseId, template.code)
      const existing = this.systemRoles.find((r) => r.id === roleId)
      const payload = {
        name: template.name,
        description: template.description,
        permissionIds: [...template.permissionIds],
        menuPermissions: template.menuPermissions?.map((p) => ({ ...p })),
        dataScope: template.dataScope,
        customDepartmentIds: [...template.customDepartmentIds],
        templateId: template.id,
        updatedAt: new Date().toISOString(),
      }
      if (existing) {
        Object.assign(existing, payload)
      } else {
        this.systemRoles.push({
          ...payload,
          id: roleId,
          code: template.code,
          rolePortal: 'enterprise',
          enterpriseId,
          status: template.status,
          isSystem: false,
          isTemplate: false,
          userCount: 0,
        })
      }
      this.persist('systemRoles')
    },

    toggleSystemRoleStatus(id: string) {
      const role = this.systemRoles.find((r) => r.id === id)
      if (!role) throw new Error('角色不存在')
      if (role.isSystem) throw new Error('系统内置角色不可停用')
      role.status = role.status === 'enabled' ? 'disabled' : 'enabled'
      role.updatedAt = new Date().toISOString()
      this.persist('systemRoles')
    },

    removeSystemRole(id: string) {
      const role = this.systemRoles.find((r) => r.id === id)
      if (!role) throw new Error('角色不存在')
      if (role.isSystem) throw new Error('系统内置角色不可删除')
      const boundCount = this.systemAccounts.filter((a) => accountHasRole(a, id)).length
      if (boundCount > 0) throw new Error('该角色下仍有用户，无法删除')
      this.systemRoles = this.systemRoles.filter((r) => r.id !== id)
      this.persist('systemRoles')
    },

    syncRoleUserCounts() {
      this.systemRoles.forEach((role) => {
        role.userCount = this.systemAccounts.filter((a) => accountHasRole(a, role.id)).length
      })
      this.persist('systemRoles')
    },

    syncUnassignedDepartment() {
      if (this.departments.some((d) => isUnassignedDepartment(d.id))) return
      this.departments.push(createUnassignedDepartment())
      this.persist('departments')
    },

    syncEmployeeStatuses() {
      let changed = false
      this.employees.forEach((emp) => {
        const rawStatus = emp.status as string
        if (rawStatus === 'leave') {
          emp.status = 'active'
          changed = true
        }
        if (isUnassignedDepartment(emp.departmentId) && emp.status === 'active') {
          emp.status = 'pending'
          changed = true
        }
        if (isUnassignedDepartment(emp.departmentId) && emp.status === 'pending' && !emp.onboardingStage) {
          emp.onboardingStage = 'awaiting_apply'
          changed = true
        }
        const seed = seedEmployees.find((s) => s.id === emp.id)
        if (seed && seed.realNameVerified != null && emp.realNameVerified !== seed.realNameVerified) {
          emp.realNameVerified = seed.realNameVerified
          changed = true
        } else if (emp.realNameVerified === undefined) {
          emp.realNameVerified = false
          changed = true
        }
      })
      if (changed) this.persist('employees')
    },

    validateAccountRoles(roleIds: string[]) {
      if (!roleIds.length) throw new Error('请至少选择一个角色')
      for (const id of roleIds) {
        const role = this.systemRoles.find((r) => r.id === id)
        if (!role) throw new Error('角色不存在')
        if (role.status === 'disabled') throw new Error(`角色「${role.name}」已停用`)
      }
    },

    createSystemAccount(data: Omit<SystemAccount, 'id' | 'createdAt' | 'updatedAt' | 'lastLoginAt'>) {
      if (this.systemAccounts.some((a) => a.username === data.username)) {
        throw new Error('登录账号已存在')
      }
      this.validateAccountRoles(data.roleIds)
      const now = new Date().toISOString()
      const item: SystemAccount = {
        ...data,
        accountPortal: data.accountPortal ?? 'platform',
        id: generateId('acc'),
        createdAt: now,
        updatedAt: now,
      }
      this.systemAccounts.unshift(item)
      this.persist('systemAccounts')
      this.syncRoleUserCounts()
      return item
    },

    updateSystemAccount(id: string, data: Partial<SystemAccount>) {
      const account = this.systemAccounts.find((a) => a.id === id)
      if (!account) throw new Error('账号不存在')
      if (data.username && data.username !== account.username) {
        if (this.systemAccounts.some((a) => a.username === data.username && a.id !== id)) {
          throw new Error('登录账号已存在')
        }
      }
      if (data.roleIds?.length) {
        this.validateAccountRoles(data.roleIds)
      }
      const prevRoleIds = new Set(account.roleIds)
      Object.assign(account, data, { updatedAt: new Date().toISOString() })
      this.persist('systemAccounts')
      if (
        data.roleIds &&
        (data.roleIds.length !== prevRoleIds.size ||
          data.roleIds.some((id) => !prevRoleIds.has(id)))
      ) {
        this.syncRoleUserCounts()
      }
    },

    toggleSystemAccountStatus(id: string) {
      const account = this.systemAccounts.find((a) => a.id === id)
      if (!account) throw new Error('账号不存在')
      if (account.isSystem) throw new Error('系统内置账号不可停用')
      account.status = account.status === 'enabled' ? 'disabled' : 'enabled'
      account.updatedAt = new Date().toISOString()
      this.persist('systemAccounts')
    },

    removeSystemAccount(id: string) {
      const account = this.systemAccounts.find((a) => a.id === id)
      if (!account) throw new Error('账号不存在')
      if (account.isSystem) throw new Error('系统内置账号不可删除')
      this.systemAccounts = this.systemAccounts.filter((a) => a.id !== id)
      this.persist('systemAccounts')
      this.syncRoleUserCounts()
    },

    resetAccountPassword(id: string) {
      const account = this.systemAccounts.find((a) => a.id === id)
      if (!account) throw new Error('账号不存在')
      account.updatedAt = new Date().toISOString()
      this.persist('systemAccounts')
      this.pushNotification({
        title: '密码已重置',
        content: `账号 ${account.username} 的密码已重置为默认密码（演示）`,
        type: 'system',
      })
    },

    confirmSettlementBill(
      id: string,
      opts?: { payerEnterpriseName?: string; payerCreditCode?: string },
    ) {
      const bill = this.settlementBills.find((b) => b.id === id)
      if (!bill) throw new Error('账单不存在')
      if (bill.status !== 'pending_confirm') throw new Error('当前状态不可确认')
      if (opts) {
        bill.payerEnterpriseName = opts.payerEnterpriseName?.trim() || undefined
        bill.payerCreditCode = opts.payerCreditCode?.trim() || undefined
      }
      bill.status = 'pending_payment'
      bill.confirmedAt = new Date().toISOString()
      bill.updatedAt = new Date().toISOString()
      this.persist('settlementBills')
    },

    createSettlementBill(input: {
      enterpriseId: string
      departmentScope: 'all' | 'department'
      departmentId?: string
      departmentName: string
      payerEnterpriseName?: string
      payerCreditCode?: string
      periodStart: string
      periodEnd: string
      sourceType: SettlementBillSourceType
      billingRuleId?: string
      billingRuleName?: string
      excelFileName?: string
      importTemplateId?: string
      importTemplateName?: string
      lines: SettlementBillLine[]
      payrollTotal: number
      serviceFee: number
      serviceFeeRate?: number
      summary?: SettlementBillSummary
      remark?: string
      submit?: boolean
    }) {
      const enterprise = this.enterprises.find((e) => e.id === input.enterpriseId)
      if (!enterprise) throw new Error('企业不存在')
      if (!input.departmentName?.trim()) throw new Error('请选择部门')
      if (input.departmentScope === 'department' && !input.departmentId) {
        throw new Error('请选择部门')
      }
      const provider = resolveServiceProviderForEnterprise(
        input.enterpriseId,
        this.serviceProviders,
        this.serviceContracts,
      )
      const taxFlags = resolveBillTaxFlagsFromContract(
        input.enterpriseId,
        provider?.id,
        this.serviceContracts,
      )
      const now = new Date().toISOString()
      const totalPayable = Math.max(0, Math.round((input.payrollTotal + input.serviceFee) * 100) / 100)
      const bill: SettlementBill = {
        id: generateId('bill'),
        billNo: generateBillNo(this.settlementBills),
        enterpriseId: input.enterpriseId,
        enterpriseName: enterprise.name,
        departmentScope: input.departmentScope,
        departmentId: input.departmentScope === 'department' ? input.departmentId : undefined,
        departmentName: input.departmentName.trim(),
        payerEnterpriseName: input.payerEnterpriseName?.trim() || undefined,
        payerCreditCode: input.payerCreditCode?.trim() || undefined,
        serviceProviderId: provider?.id,
        serviceProviderName: provider?.name ?? '未关联服务商',
        periodStart: input.periodStart,
        periodEnd: input.periodEnd,
        payrollTotal: input.payrollTotal,
        serviceFee: input.serviceFee,
        totalPayable,
        invoicedAmount: 0,
        status: input.submit ? 'pending_confirm' : 'pending_submit',
        lines: input.lines,
        sourceType: input.sourceType,
        billingRuleId: input.billingRuleId,
        billingRuleName: input.billingRuleName,
        excelFileName: input.excelFileName,
        importTemplateId: input.importTemplateId,
        importTemplateName: input.importTemplateName,
        serviceFeeRate: input.serviceFeeRate,
        serviceFeeIncludesTax: taxFlags.serviceFeeIncludesTax,
        unitPriceIncludesTax: taxFlags.unitPriceIncludesTax,
        summary: input.summary,
        pushedAt: input.submit ? now : undefined,
        remark: input.remark,
        createdAt: now,
        updatedAt: now,
      }
      this.settlementBills.unshift(bill)
      this.persist('settlementBills')
      if (input.submit) {
        this.pushNotification({
          title: '账单已提交',
          content: `账单 ${bill.billNo} 已推送至 ${enterprise.name} 待确认`,
          type: 'approval',
        })
      }
      return bill
    },

    submitSettlementBill(id: string) {
      const bill = this.settlementBills.find((b) => b.id === id)
      if (!bill) throw new Error('账单不存在')
      if (bill.status !== 'pending_submit') throw new Error('仅待提交账单可提交')
      const now = new Date().toISOString()
      bill.status = 'pending_confirm'
      bill.pushedAt = now
      bill.updatedAt = now
      this.persist('settlementBills')
      this.pushNotification({
        title: '账单已提交',
        content: `账单 ${bill.billNo} 已推送至 ${bill.enterpriseName} 待确认`,
        type: 'approval',
      })
    },

    /** 待提交账单：减免服务费（录入总计金额，口径同服务费含税/不含税） */
    applySettlementBillServiceFeeWaiver(
      id: string,
      input: {
        mode?: 'by_quantity' | 'by_amount'
        workerCount?: number
        workHours?: number
        amount?: number
        note?: string
      },
    ) {
      const bill = this.settlementBills.find((b) => b.id === id)
      if (!bill) throw new Error('账单不存在')
      if (bill.status !== 'pending_submit') throw new Error('仅待提交账单可减免服务费')

      let amount = 0
      let unitRate: number | undefined
      const mode = input.mode === 'by_quantity' ? 'by_quantity' : 'by_amount'
      if (mode === 'by_quantity') {
        const workerCount = Math.max(0, Number(input.workerCount) || 0)
        const workHours = Math.max(0, Number(input.workHours) || 0)
        if (workerCount <= 0 || workHours <= 0) {
          throw new Error('请填写有效的减免人数与工时')
        }
        const estimated = estimateServiceFeeWaiverByQuantity(bill, workerCount, workHours)
        amount = estimated.amount
        unitRate = estimated.unitRate
        bill.serviceFeeWaiverMeta = {
          mode: 'by_quantity',
          workerCount,
          workHours,
          unitRate,
          note: input.note?.trim() || undefined,
          appliedAt: new Date().toISOString(),
        }
      } else {
        amount = Math.max(0, Math.round((Number(input.amount) || 0) * 100) / 100)
        if (amount <= 0) throw new Error('请填写有效的总计金额')
        bill.serviceFeeWaiverMeta = {
          mode: 'by_amount',
          note: input.note?.trim() || undefined,
          appliedAt: new Date().toISOString(),
        }
      }

      if (amount > bill.serviceFee) {
        throw new Error('减免金额不能超过服务费总计')
      }

      bill.serviceFeeWaiver = amount
      bill.totalPayable = Math.max(
        0,
        Math.round((bill.payrollTotal + bill.serviceFee - amount) * 100) / 100,
      )
      bill.updatedAt = new Date().toISOString()
      this.persist('settlementBills')
      return bill
    },

    clearSettlementBillServiceFeeWaiver(id: string) {
      const bill = this.settlementBills.find((b) => b.id === id)
      if (!bill) throw new Error('账单不存在')
      if (bill.status !== 'pending_submit') throw new Error('仅待提交账单可调整减免')
      bill.serviceFeeWaiver = 0
      bill.serviceFeeWaiverMeta = undefined
      bill.totalPayable = Math.max(
        0,
        Math.round((bill.payrollTotal + bill.serviceFee) * 100) / 100,
      )
      bill.updatedAt = new Date().toISOString()
      this.persist('settlementBills')
    },

    voidSettlementBill(id: string, reason?: string) {
      const bill = this.settlementBills.find((b) => b.id === id)
      if (!bill) throw new Error('账单不存在')
      if (!['pending_submit', 'pending_confirm', 'pending_payment'].includes(bill.status)) {
        throw new Error('当前状态不可作废')
      }
      bill.status = 'void'
      bill.voidReason = reason?.trim() || '运营作废'
      bill.updatedAt = new Date().toISOString()
      this.persist('settlementBills')
    },

    submitBillPayment(id: string, voucherFileName: string) {
      const bill = this.settlementBills.find((b) => b.id === id)
      if (!bill) throw new Error('账单不存在')
      if (bill.status !== 'pending_payment') throw new Error('当前状态不可付款')
      if (!voucherFileName.trim()) throw new Error('请上传付款凭证')
      const now = new Date().toISOString()
      bill.status = 'paid'
      bill.paymentVoucher = voucherFileName
      bill.paymentSubmittedAt = now
      bill.paidAt = now
      bill.updatedAt = now
      this.persist('settlementBills')
      this.pushNotification({
        title: '付款已完成',
        content: `账单 ${bill.billNo} 已确认付款`,
        type: 'approval',
      })
    },

    verifyBillPayment(id: string) {
      const bill = this.settlementBills.find((b) => b.id === id)
      if (!bill) throw new Error('账单不存在')
      if (bill.status === 'pending_payment') {
        bill.status = 'paid'
        bill.paidAt = new Date().toISOString()
        bill.updatedAt = bill.paidAt
        this.persist('settlementBills')
        return
      }
      if (bill.status !== 'paid') throw new Error('当前状态不可核实')
    },

    applyInvoice(
      data: Omit<
        InvoiceApplication,
        | 'id'
        | 'applicationNo'
        | 'status'
        | 'createdAt'
        | 'submittedAt'
        | 'reviewedAt'
        | 'issuedAt'
        | 'electronicUrl'
        | 'expressNo'
        | 'rejectReason'
        | 'invoiceFileName'
      > & { id?: string },
      options?: { asDraft?: boolean },
    ) {
      return options?.asDraft
        ? this.saveInvoiceDraft(data)
        : this.submitInvoiceApplication(data)
    },

    saveInvoiceDraft(
      data: Omit<
        InvoiceApplication,
        | 'id'
        | 'applicationNo'
        | 'status'
        | 'createdAt'
        | 'submittedAt'
        | 'reviewedAt'
        | 'issuedAt'
        | 'electronicUrl'
        | 'expressNo'
        | 'rejectReason'
        | 'invoiceFileName'
      > & { id?: string },
    ) {
      this.validateInvoiceApplication(data)

      const now = new Date().toISOString()
      if (data.id) {
        const existing = this.invoiceApplications.find((item) => item.id === data.id)
        if (!existing || existing.status !== 'draft') throw new Error('草稿不存在或不可编辑')
        Object.assign(existing, data)
        this.persist('invoiceApplications')
        return existing
      }

      const item: InvoiceApplication = {
        ...data,
        id: generateId('inv'),
        applicationNo: this.nextInvoiceApplicationNo(),
        status: 'draft',
        createdAt: now,
      }
      this.invoiceApplications.unshift(item)
      this.persist('invoiceApplications')
      return item
    },

    submitInvoiceApplication(
      data: Omit<
        InvoiceApplication,
        | 'id'
        | 'applicationNo'
        | 'status'
        | 'createdAt'
        | 'submittedAt'
        | 'reviewedAt'
        | 'issuedAt'
        | 'electronicUrl'
        | 'expressNo'
        | 'rejectReason'
        | 'invoiceFileName'
      > & { id?: string },
    ) {
      this.validateInvoiceApplication(data, data.id)

      const now = new Date().toISOString()
      let item: InvoiceApplication
      if (data.id) {
        const existing = this.invoiceApplications.find((entry) => entry.id === data.id)
        if (!existing) throw new Error('发票申请不存在')
        if (!['draft', 'rejected'].includes(existing.status)) {
          throw new Error('当前状态不可提交')
        }
        item = Object.assign(existing, data, {
          status: 'pending_review',
          submittedAt: now,
          rejectReason: undefined,
        })
      } else {
        item = {
          ...data,
          id: generateId('inv'),
          applicationNo: this.nextInvoiceApplicationNo(),
          status: 'pending_review',
          createdAt: now,
          submittedAt: now,
        }
        this.invoiceApplications.unshift(item)
      }

      this.reserveBillInvoiceAmounts(item.bills, now)
      this.persist('invoiceApplications')
      this.persist('settlementBills')
      this.pushNotification({
        title: '发票申请已提交',
        content: `${item.applicationNo} 已进入审核流程`,
        type: 'system',
      })
      return item
    },

    approveInvoiceApplication(id: string) {
      const item = this.invoiceApplications.find((entry) => entry.id === id)
      if (!item) throw new Error('发票申请不存在')
      if (!['pending_review', 'reviewing'].includes(item.status)) {
        throw new Error('当前状态不可审核通过')
      }
      item.status = 'issuing'
      item.reviewedAt = new Date().toISOString()
      this.persist('invoiceApplications')
      return item
    },

    rejectInvoiceApplication(id: string, reason: string) {
      const item = this.invoiceApplications.find((entry) => entry.id === id)
      if (!item) throw new Error('发票申请不存在')
      if (!['pending_review', 'reviewing'].includes(item.status)) {
        throw new Error('当前状态不可驳回')
      }
      this.releaseBillInvoiceAmounts(item.bills)
      item.status = 'rejected'
      item.rejectReason = reason
      item.reviewedAt = new Date().toISOString()
      this.persist('invoiceApplications')
      return item
    },

    completeInvoiceIssue(id: string, fileName: string) {
      const item = this.invoiceApplications.find((entry) => entry.id === id)
      if (!item) throw new Error('发票申请不存在')
      if (item.status !== 'issuing') throw new Error('当前状态不可上传发票')
      const now = new Date().toISOString()
      item.status = 'issued'
      item.invoiceFileName = fileName
      item.electronicUrl = `/mock/invoices/${fileName}`
      item.issuedAt = now
      this.persist('invoiceApplications')
      this.pushNotification({
        title: '发票已开具',
        content: `${item.applicationNo} 已完成开票`,
        type: 'system',
      })
      return item
    },

    saveEnterpriseInvoiceProfile(
      data: Omit<EnterpriseInvoiceProfile, 'id'> & { id?: string },
    ) {
      if (!data.enterpriseId) throw new Error('企业不能为空')
      if (!data.title.trim()) throw new Error('请填写抬头名称')
      if (!data.taxNo.trim()) throw new Error('请填写纳税人识别号')

      const nowId = data.id || generateId('eip')
      const existingIdx = this.enterpriseInvoiceProfiles.findIndex((item) => item.id === nowId)
      const scoped = this.enterpriseInvoiceProfiles.filter(
        (item) => item.enterpriseId === data.enterpriseId && item.id !== nowId,
      )
      const makeDefault = data.isDefault || scoped.length === 0
      if (makeDefault) {
        for (const item of this.enterpriseInvoiceProfiles) {
          if (item.enterpriseId === data.enterpriseId) item.isDefault = false
        }
      }

      const profile: EnterpriseInvoiceProfile = {
        id: nowId,
        enterpriseId: data.enterpriseId,
        title: data.title.trim(),
        taxNo: data.taxNo.trim(),
        address: data.address.trim(),
        phone: data.phone.trim(),
        bankName: data.bankName.trim(),
        bankAccount: data.bankAccount.trim(),
        defaultInvoiceType: data.defaultInvoiceType,
        isDefault: makeDefault,
        remark: data.remark?.trim() || undefined,
      }

      if (existingIdx >= 0) this.enterpriseInvoiceProfiles[existingIdx] = profile
      else this.enterpriseInvoiceProfiles.push(profile)
      this.persist('enterpriseInvoiceProfiles')
      return profile
    },

    deleteEnterpriseInvoiceProfile(id: string) {
      const idx = this.enterpriseInvoiceProfiles.findIndex((item) => item.id === id)
      if (idx < 0) throw new Error('抬头不存在')
      const [removed] = this.enterpriseInvoiceProfiles.splice(idx, 1)
      if (removed.isDefault) {
        const next = this.enterpriseInvoiceProfiles.find(
          (item) => item.enterpriseId === removed.enterpriseId,
        )
        if (next) next.isDefault = true
      }
      this.persist('enterpriseInvoiceProfiles')
    },

    setDefaultEnterpriseInvoiceProfile(id: string) {
      const profile = this.enterpriseInvoiceProfiles.find((item) => item.id === id)
      if (!profile) throw new Error('抬头不存在')
      for (const item of this.enterpriseInvoiceProfiles) {
        if (item.enterpriseId === profile.enterpriseId) {
          item.isDefault = item.id === id
        }
      }
      this.persist('enterpriseInvoiceProfiles')
    },

    nextInvoiceApplicationNo() {
      const now = new Date()
      const prefix = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-`
      const seq =
        this.invoiceApplications.filter((item) => item.applicationNo.startsWith(prefix)).length + 1
      return `${prefix}${String(seq).padStart(3, '0')}`
    },

    validateInvoiceApplication(
      data: Pick<InvoiceApplication, 'bills' | 'amount' | 'enterpriseId'>,
      excludeApplicationId?: string,
    ) {
      if (!data.bills.length) throw new Error('请至少选择一张账单')
      const refsTotal = Math.round(data.bills.reduce((sum, bill) => sum + bill.amount, 0) * 100) / 100
      if (Math.abs(refsTotal - data.amount) > 0.009) {
        throw new Error('账单分摊金额与开票金额不一致')
      }

      let enterpriseId = ''
      for (const ref of data.bills) {
        const bill = this.settlementBills.find((item) => item.id === ref.billId)
        if (!bill) throw new Error(`账单 ${ref.billNo} 不存在`)
        if (bill.status !== 'paid') throw new Error(`账单 ${ref.billNo} 未完成，不可申请发票`)
        if (!enterpriseId) enterpriseId = bill.enterpriseId
        if (bill.enterpriseId !== enterpriseId) throw new Error('请选择同一企业的账单')
        if (data.enterpriseId && bill.enterpriseId !== data.enterpriseId) {
          throw new Error('账单企业与申请企业不一致')
        }

        const draftReserved = this.invoiceApplications
          .filter(
            (item) =>
              item.status === 'draft' &&
              item.id !== excludeApplicationId &&
              item.bills.some((entry) => entry.billId === bill.id),
          )
          .reduce(
            (sum, item) =>
              sum + (item.bills.find((entry) => entry.billId === bill.id)?.amount ?? 0),
            0,
          )
        const remaining = bill.totalPayable - bill.invoicedAmount - draftReserved
        if (ref.amount <= 0 || ref.amount > remaining + 0.009) {
          throw new Error(`账单 ${ref.billNo} 分摊金额超过剩余可开金额 ${remaining}`)
        }
      }

      if (data.amount <= 0) throw new Error('开票金额必须大于 0')
    },

    reserveBillInvoiceAmounts(bills: InvoiceApplication['bills'], updatedAt: string) {
      for (const ref of bills) {
        const bill = this.settlementBills.find((item) => item.id === ref.billId)
        if (!bill) throw new Error(`账单 ${ref.billNo} 不存在`)
        bill.invoicedAmount = Math.round((bill.invoicedAmount + ref.amount) * 100) / 100
        bill.updatedAt = updatedAt
      }
    },

    releaseBillInvoiceAmounts(bills: InvoiceApplication['bills']) {
      const now = new Date().toISOString()
      for (const ref of bills) {
        const bill = this.settlementBills.find((item) => item.id === ref.billId)
        if (!bill) continue
        bill.invoicedAmount = Math.max(0, Math.round((bill.invoicedAmount - ref.amount) * 100) / 100)
        bill.updatedAt = now
      }
      this.persist('settlementBills')
    },

    saveBillingRule(
      data: Omit<BillingRule, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    ) {
      const now = new Date().toISOString()
      if (data.id) {
        const idx = this.billingRules.findIndex((r) => r.id === data.id)
        if (idx < 0) throw new Error('计费规则不存在')
        this.billingRules[idx] = {
          ...this.billingRules[idx],
          ...data,
          id: data.id,
          updatedAt: now,
        }
      } else {
        const item: BillingRule = {
          ...data,
          id: generateId('br'),
          createdAt: now,
          updatedAt: now,
        }
        this.billingRules.unshift(item)
      }
      if (data.isDefault) {
        this.billingRules.forEach((r) => {
          if (r.id !== data.id) r.isDefault = false
        })
      }
      this.persist('billingRules')
    },

    saveBillImportTemplate(
      data: Omit<BillImportTemplate, 'id' | 'createdAt' | 'updatedAt'> & { id?: string },
    ) {
      const now = new Date().toISOString()
      if (data.id) {
        const idx = this.billImportTemplates.findIndex((t) => t.id === data.id)
        if (idx < 0) throw new Error('导入模板不存在')
        this.billImportTemplates[idx] = {
          ...this.billImportTemplates[idx],
          ...data,
          id: data.id,
          updatedAt: now,
        }
      } else {
        const item: BillImportTemplate = {
          ...data,
          id: generateId('bit'),
          createdAt: now,
          updatedAt: now,
        }
        this.billImportTemplates.unshift(item)
      }
      this.persist('billImportTemplates')
    },

    deleteBillImportTemplate(id: string) {
      const idx = this.billImportTemplates.findIndex((t) => t.id === id)
      if (idx < 0) throw new Error('导入模板不存在')
      this.billImportTemplates.splice(idx, 1)
      this.persist('billImportTemplates')
    },

    batchSettleWorkerLines(items: { orderId: string; lineId: string }[], type: SettlementManageType) {
      if (!items.length) throw new Error('请选择待结算灵工')
      const now = new Date().toISOString()
      const slipLines: SettlementSlipLine[] = []

      for (const { orderId, lineId } of items) {
        const order = this.settlementManageOrders.find((o) => o.id === orderId)
        if (!order || order.type !== type) continue
        const line = order.workerLines.find((l) => l.id === lineId)
        if (!line || line.status !== 'pending_settlement') continue

        line.status = 'settled'
        line.settledAt = now
        order.updatedAt = now

        slipLines.push({
          orderId: order.id,
          orderNo: order.orderNo,
          orderName: order.orderName,
          lineId: line.id,
          enterpriseId: order.enterpriseId,
          enterpriseName: order.enterpriseName,
          employeeId: line.employeeId,
          employeeName: line.employeeName,
          employeeNo: line.employeeNo,
          departmentName: line.departmentName,
          quantity: line.quantity,
          unitPrice: line.unitPrice,
          amount: line.amount,
          periodStart: order.periodStart,
          periodEnd: order.periodEnd,
        })
      }

      if (!slipLines.length) throw new Error('所选灵工不可结算')

      const slipNo = `STL${now.slice(0, 10).replace(/-/g, '')}${String(this.settlementSlips.length + 1).padStart(3, '0')}`
      const slip: SettlementSlip = {
        id: generateId('sms'),
        slipNo,
        type,
        workerCount: slipLines.length,
        totalQuantity: slipLines.reduce((sum, line) => sum + line.quantity, 0),
        totalAmount: slipLines.reduce((sum, line) => sum + line.amount, 0),
        lines: slipLines,
        settledAt: now,
        createdAt: now,
      }

      for (const slipLine of slipLines) {
        const order = this.settlementManageOrders.find((o) => o.id === slipLine.orderId)
        const line = order?.workerLines.find((l) => l.id === slipLine.lineId)
        if (line) line.settlementSlipId = slip.id
      }

      this.settlementSlips.unshift(slip)
      this.persist('settlementManageOrders')
      this.persist('settlementSlips')
      this.pushNotification({
        title: '结算单已生成',
        content: `${slipNo} 已结算 ${slip.workerCount} 名灵工，合计 ¥${slip.totalAmount.toLocaleString()}`,
        type: 'system',
      })
      return slip
    },

    createImportPayrollSlip(input: {
      enterpriseId: string
      enterpriseName: string
      lines: {
        phone: string
        employeeName: string
        amount: number
        employeeId?: string
        employeeNo?: string
        departmentName?: string
      }[]
    }) {
      if (!input.enterpriseId) throw new Error('请选择企业')
      if (!input.lines.length) throw new Error('请至少添加一条发薪明细')
      for (const line of input.lines) {
        if (!line.phone?.trim()) throw new Error('明细手机号不能为空')
        if (!line.employeeName?.trim()) throw new Error('明细姓名不能为空')
        if (!Number.isFinite(line.amount) || line.amount < 0) throw new Error('发薪金额无效')
      }

      const now = new Date().toISOString()
      const day = now.slice(0, 10)
      const slipLines: SettlementSlipLine[] = input.lines.map((line, idx) => ({
        orderId: 'import',
        orderNo: 'IMPORT',
        orderName: '导入发薪',
        lineId: `imp_${idx + 1}`,
        enterpriseId: input.enterpriseId,
        enterpriseName: input.enterpriseName,
        employeeId: line.employeeId || `phone_${line.phone}`,
        employeeName: line.employeeName.trim(),
        employeeNo: line.employeeNo,
        phone: line.phone.trim(),
        departmentName: line.departmentName,
        quantity: 1,
        unitPrice: line.amount,
        amount: line.amount,
        periodStart: day,
        periodEnd: day,
      }))

      const slipNo = `STL${day.replace(/-/g, '')}${String(this.settlementSlips.length + 1).padStart(3, '0')}`
      const slip: SettlementSlip = {
        id: generateId('sms'),
        slipNo,
        type: 'import',
        workerCount: slipLines.length,
        totalQuantity: slipLines.length,
        totalAmount: slipLines.reduce((sum, line) => sum + line.amount, 0),
        lines: slipLines,
        settledAt: now,
        createdAt: now,
      }

      this.settlementSlips.unshift(slip)
      this.persist('settlementSlips')
      this.pushNotification({
        title: '导入发薪结算单已生成',
        content: `${slipNo} 已发薪 ${slip.workerCount} 人，合计 ¥${slip.totalAmount.toLocaleString()}`,
        type: 'system',
      })
      return slip
    },

    generateTaxDeclaration(serviceProviderId: string, month: string) {
      const provider = this.serviceProviders.find((item) => item.id === serviceProviderId)
      if (!provider) throw new Error('服务商不存在')
      const existing = this.taxDeclarations.find(
        (item) => item.serviceProviderId === serviceProviderId && item.month === month,
      )
      if (existing) throw new Error('该服务商本月申报表已存在')

      const workerMap = new Map<string, TaxDeclarationWorker>()
      let withdrawalSeq = 1
      for (const slip of this.settlementSlips) {
        if (slip.settledAt.slice(0, 7) !== month) continue
        for (const line of slip.lines) {
          const linkedProvider = resolveServiceProviderForEnterprise(
            line.enterpriseId,
            this.serviceProviders,
            this.serviceContracts,
          )
          if (linkedProvider?.id !== serviceProviderId) continue

          const taxAmount = Math.round(line.amount * 0.03 * 100) / 100
          const netAmount = Math.round((line.amount - taxAmount) * 100) / 100
          const withdrawalIndex = withdrawalSeq - 1
          const withdrawal: TaxWithdrawalLine = {
            id: generateId('txw'),
            withdrawalNo: `WD${month.replace('-', '')}${String(withdrawalSeq).padStart(4, '0')}`,
            channel: resolveWithdrawalChannel(
              line.employeeId,
              this.workerPaymentBindings,
              withdrawalIndex,
            ),
            settlementAmount: line.amount,
            taxAmount,
            netAmount,
            withdrawnAt: slip.settledAt,
          }
          withdrawalSeq += 1

          let worker = workerMap.get(line.employeeId)
          if (!worker) {
            const employee = this.employees.find((item) => item.id === line.employeeId)
            worker = {
              employeeId: line.employeeId,
              employeeName: line.employeeName,
              phone: employee?.phone,
              totalSettlementAmount: 0,
              totalTaxAmount: 0,
              totalNetAmount: 0,
              withdrawals: [],
            }
            workerMap.set(line.employeeId, worker)
          }
          worker.withdrawals.push(withdrawal)
          worker.totalSettlementAmount += line.amount
          worker.totalTaxAmount += taxAmount
          worker.totalNetAmount += netAmount
        }
      }

      const workers = [...workerMap.values()].sort((a, b) =>
        a.employeeName.localeCompare(b.employeeName, 'zh-CN'),
      )
      if (!workers.length) throw new Error('该月度暂无结算提现数据，无法生成申报表')

      const now = new Date().toISOString()
      const monthKey = month.replace('-', '')
      const declaration: TaxDeclaration = {
        id: generateId('taxd'),
        declarationNo: `TAX-${monthKey}-${provider.code}`,
        serviceProviderId: provider.id,
        serviceProviderName: provider.name,
        month,
        workerCount: workers.length,
        totalSettlementAmount: workers.reduce((sum, item) => sum + item.totalSettlementAmount, 0),
        totalTaxAmount: workers.reduce((sum, item) => sum + item.totalTaxAmount, 0),
        totalNetAmount: workers.reduce((sum, item) => sum + item.totalNetAmount, 0),
        workers,
        status: 'generated',
        generatedAt: now,
      }

      this.taxDeclarations.unshift(declaration)
      this.persist('taxDeclarations')
      this.pushNotification({
        title: '个税申报表已生成',
        content: `${provider.shortName ?? provider.name} ${month} 申报表已生成`,
        type: 'system',
      })
      return declaration
    },

    submitTaxDeclaration(id: string) {
      const declaration = this.taxDeclarations.find((item) => item.id === id)
      if (!declaration) throw new Error('申报表不存在')
      if (declaration.status !== 'generated') throw new Error('当前状态不可提交')
      declaration.status = 'submitted'
      this.persist('taxDeclarations')
      return declaration
    },

    toggleBillingRule(id: string, enabled: boolean) {
      const rule = this.billingRules.find((r) => r.id === id)
      if (!rule) throw new Error('计费规则不存在')
      rule.enabled = enabled
      rule.updatedAt = new Date().toISOString()
      this.persist('billingRules')
    },

    // ── 培训资料 ──
    addTrainingMaterial(data: Omit<TrainingMaterial, 'id' | 'createdAt' | 'updatedAt'>) {
      const now = new Date().toISOString()
      const item: TrainingMaterial = { ...data, id: generateId('tm'), createdAt: now, updatedAt: now }
      this.trainingMaterials.unshift(item)
      this.persist('trainingMaterials')
      return item
    },
    updateTrainingMaterial(id: string, data: Partial<TrainingMaterial>) {
      const idx = this.trainingMaterials.findIndex((m) => m.id === id)
      if (idx < 0) throw new Error('资料不存在')
      this.trainingMaterials[idx] = {
        ...this.trainingMaterials[idx],
        ...data,
        updatedAt: new Date().toISOString(),
      }
      this.persist('trainingMaterials')
    },
    removeTrainingMaterial(id: string) {
      const refs = countMaterialReferences(this.trainingCourses, id)
      if (refs > 0) throw new Error(`该资料已被 ${refs} 门课程引用，不可删除`)
      const idx = this.trainingMaterials.findIndex((m) => m.id === id)
      if (idx < 0) throw new Error('资料不存在')
      this.trainingMaterials.splice(idx, 1)
      this.persist('trainingMaterials')
    },
    approveTrainingMaterial(id: string) {
      this.updateTrainingMaterial(id, { status: 'approved' })
    },
    getMaterialReferenceCount(materialId: string) {
      return countMaterialReferences(this.trainingCourses, materialId)
    },
    addTrainingMaterialCategory(data: { name: string; enterpriseId: string | null }) {
      const name = data.name.trim()
      if (!name) throw new Error('请填写分类名称')
      const dup = this.trainingMaterialCategories.find(
        (c) => c.name === name && (c.enterpriseId ?? null) === (data.enterpriseId ?? null),
      )
      if (dup) throw new Error('同名分类已存在')
      const item: TrainingMaterialCategoryItem = {
        id: generateId('tmc'),
        name,
        enterpriseId: data.enterpriseId,
        builtin: false,
        createdAt: new Date().toISOString(),
      }
      this.trainingMaterialCategories.push(item)
      this.persist('trainingMaterialCategories')
      return item
    },
    updateTrainingMaterialCategory(id: string, name: string) {
      const item = this.trainingMaterialCategories.find((c) => c.id === id)
      if (!item) throw new Error('分类不存在')
      const next = name.trim()
      if (!next) throw new Error('请填写分类名称')
      item.name = next
      this.persist('trainingMaterialCategories')
    },
    removeTrainingMaterialCategory(id: string) {
      const item = this.trainingMaterialCategories.find((c) => c.id === id)
      if (!item) throw new Error('分类不存在')
      if (item.builtin) throw new Error('内置分类不可删除')
      const used = this.trainingMaterials.some((m) => m.category === id || m.category === item.name)
      if (used) throw new Error('仍有资料使用该分类，不可删除')
      this.trainingMaterialCategories = this.trainingMaterialCategories.filter((c) => c.id !== id)
      this.persist('trainingMaterialCategories')
    },

    // ── 课程 ──
    addTrainingCourse(data: Omit<TrainingCourse, 'id' | 'createdAt' | 'updatedAt'>) {
      const now = new Date().toISOString()
      const item: TrainingCourse = { ...data, id: generateId('tc'), createdAt: now, updatedAt: now }
      this.trainingCourses.unshift(item)
      this.persist('trainingCourses')
      return item
    },
    updateTrainingCourse(id: string, data: Partial<TrainingCourse>) {
      const course = this.trainingCourses.find((c) => c.id === id)
      if (!course) throw new Error('课程不存在')
      if (course.status === 'published') throw new Error('已发布课程不可编辑')
      // offline / draft / closed 可编辑
      const prevExamId = course.examId
      Object.assign(course, data, { updatedAt: new Date().toISOString() })
      if (data.examId !== undefined && data.examId !== prevExamId) {
        if (prevExamId) {
          const prevExam = this.trainingExams.find((e) => e.id === prevExamId)
          if (prevExam?.courseId === id) {
            prevExam.courseId = undefined
            prevExam.updatedAt = new Date().toISOString()
          }
        }
        if (course.examId) this.syncExamCourseLink(course.examId, id)
        else this.persist('trainingExams')
      }
      this.persist('trainingCourses')
    },
    publishTrainingCourse(id: string) {
      const course = this.trainingCourses.find((c) => c.id === id)
      if (!course) throw new Error('课程不存在')
      if (course.materialIds.length === 0) throw new Error('请至少关联一项培训资料')
      course.status = 'published'
      course.publishedAt = new Date().toISOString()
      course.updatedAt = course.publishedAt
      this.persist('trainingCourses')
    },
    offlineTrainingCourse(id: string) {
      const course = this.trainingCourses.find((c) => c.id === id)
      if (!course) throw new Error('课程不存在')
      if (course.status !== 'published') throw new Error('仅已发布课程可下架')
      course.status = 'offline'
      course.updatedAt = new Date().toISOString()
      this.persist('trainingCourses')
    },
    republishTrainingCourse(id: string) {
      const course = this.trainingCourses.find((c) => c.id === id)
      if (!course) throw new Error('课程不存在')
      if (course.status !== 'offline' && course.status !== 'draft') {
        throw new Error('当前状态不可上架')
      }
      if (course.materialIds.length === 0) throw new Error('请至少关联一项培训资料')
      course.status = 'published'
      course.publishedAt = new Date().toISOString()
      course.updatedAt = course.publishedAt
      this.persist('trainingCourses')
    },
    closeTrainingCourse(id: string) {
      const course = this.trainingCourses.find((c) => c.id === id)
      if (!course) throw new Error('课程不存在')
      course.status = 'closed'
      course.updatedAt = new Date().toISOString()
      this.persist('trainingCourses')
    },

    // ── 考核 ──
    syncExamCourseLink(examId: string, courseId?: string) {
      const exam = this.trainingExams.find((e) => e.id === examId)
      if (!exam) throw new Error('考核不存在')

      for (const course of this.trainingCourses) {
        if (course.examId === examId && course.id !== courseId) {
          course.examId = undefined
          course.updatedAt = new Date().toISOString()
        }
      }

      if (courseId) {
        const course = this.trainingCourses.find((c) => c.id === courseId)
        if (!course) throw new Error('关联课程不存在')
        course.examId = examId
        course.updatedAt = new Date().toISOString()
        exam.courseId = courseId
        exam.enterpriseId = course.enterpriseId
      } else {
        exam.courseId = undefined
      }

      exam.updatedAt = new Date().toISOString()
      this.persist('trainingExams')
      this.persist('trainingCourses')
    },

    addTrainingExam(data: Omit<TrainingExam, 'id' | 'createdAt' | 'updatedAt'>) {
      const { courseId, ...rest } = data
      if (!courseId) throw new Error('请选择关联课程')
      const now = new Date().toISOString()
      const item: TrainingExam = { ...rest, courseId, id: generateId('te'), createdAt: now, updatedAt: now }
      this.trainingExams.unshift(item)
      this.persist('trainingExams')
      this.syncExamCourseLink(item.id, courseId)
      return item
    },
    updateTrainingExam(id: string, data: Partial<TrainingExam>) {
      const exam = this.trainingExams.find((e) => e.id === id)
      if (!exam) throw new Error('考核不存在')
      if (exam.status === 'published') throw new Error('已发布考核不可编辑')
      const { courseId, ...rest } = data
      if (courseId !== undefined && !courseId) throw new Error('请选择关联课程')
      Object.assign(exam, rest, { updatedAt: new Date().toISOString() })
      if (courseId !== undefined) this.syncExamCourseLink(id, courseId)
      else this.persist('trainingExams')
    },
    publishTrainingExam(id: string) {
      const exam = this.trainingExams.find((e) => e.id === id)
      if (!exam) throw new Error('考核不存在')
      if (!exam.courseId) throw new Error('请先关联课程')
      const course = this.trainingCourses.find((c) => c.id === exam.courseId)
      if (!course) throw new Error('关联课程不存在')
      if (course.examId !== id) this.syncExamCourseLink(id, exam.courseId)
      const qCount = this.examQuestions.filter((q) => q.examId === id).length
      if (qCount === 0) throw new Error('请至少添加一道题目')
      exam.status = 'published'
      exam.publishedAt = new Date().toISOString()
      exam.updatedAt = exam.publishedAt
      this.persist('trainingExams')
    },
    offlineTrainingExam(id: string) {
      const exam = this.trainingExams.find((e) => e.id === id)
      if (!exam) throw new Error('考核不存在')
      if (exam.status !== 'published') throw new Error('仅已发布考核可下架')
      const now = new Date().toISOString()
      exam.status = 'offline'
      exam.offlineAt = now
      exam.updatedAt = now
      const courseId = exam.courseId
      if (courseId) {
        for (const rec of this.courseLearningRecords) {
          if (rec.courseId !== courseId) continue
          const taken = this.examAttempts.some(
            (a) => a.examId === id && a.employeeId === rec.employeeId,
          )
          if (taken || rec.examPassed != null) {
            rec.historicalExam = true
            rec.updatedAt = now
          }
        }
        this.persist('courseLearningRecords')
      }
      this.persist('trainingExams')
    },
    importExamQuestionsFromDocument(
      examId: string,
      questions: Omit<ExamQuestion, 'id' | 'createdAt' | 'examId' | 'source'>[],
    ) {
      const exam = this.trainingExams.find((e) => e.id === examId)
      if (!exam) throw new Error('考核不存在')
      if (exam.status === 'published') throw new Error('已发布考核不可导入题目')
      const createdAt = new Date().toISOString()
      const items: ExamQuestion[] = questions.map((q) => ({
        ...q,
        examId,
        source: 'manual',
        id: generateId('eq'),
        createdAt,
      }))
      this.examQuestions.push(...items)
      this.persist('examQuestions')
      return items
    },
    addExamQuestion(data: Omit<ExamQuestion, 'id' | 'createdAt'>) {
      const exam = this.trainingExams.find((e) => e.id === data.examId)
      if (!exam) throw new Error('考核不存在')
      if (exam.status === 'published') throw new Error('已发布考核不可修改题目')
      const item: ExamQuestion = { ...data, id: generateId('eq'), createdAt: new Date().toISOString() }
      this.examQuestions.push(item)
      this.persist('examQuestions')
      return item
    },
    updateExamQuestion(id: string, data: Partial<ExamQuestion>) {
      const q = this.examQuestions.find((x) => x.id === id)
      if (!q) throw new Error('题目不存在')
      const exam = this.trainingExams.find((e) => e.id === q.examId)
      if (exam?.status === 'published') throw new Error('已发布考核不可修改题目')
      Object.assign(q, data)
      this.persist('examQuestions')
    },
    removeExamQuestion(id: string) {
      const q = this.examQuestions.find((x) => x.id === id)
      if (!q) throw new Error('题目不存在')
      const exam = this.trainingExams.find((e) => e.id === q.examId)
      if (exam?.status === 'published') throw new Error('已发布考核不可修改题目')
      this.examQuestions = this.examQuestions.filter((x) => x.id !== id)
      this.persist('examQuestions')
    },
    generateAiExamQuestions(params: {
      examId: string
      scenario: AiRiskScenario
      type: ExamQuestionType
      count: number
      difficulty: AiQuestionDifficulty
    }) {
      const exam = this.trainingExams.find((e) => e.id === params.examId)
      if (!exam) throw new Error('考核不存在')
      if (exam.status === 'published') throw new Error('已发布考核不可添加题目')
      const drafts = generateAiRiskQuestions({ ...params, baseScore: undefined })
      const items = drafts.map((d) => ({
        ...d,
        id: generateId('eq'),
        createdAt: new Date().toISOString(),
      }))
      this.examQuestions.push(...items)
      this.persist('examQuestions')
      return items
    },
    sendLearningReminder(courseId: string, employeeIds: string[]) {
      const course = this.trainingCourses.find((c) => c.id === courseId)
      if (!course) throw new Error('课程不存在')
      const count = employeeIds.length
      this.notifications.unshift({
        id: generateId('ntf'),
        title: '学习提醒',
        content: `您有未完成课程「${course.name}」，请尽快完成学习。`,
        type: 'system',
        read: false,
        createdAt: new Date().toISOString(),
      })
      this.persist('notifications')
      return count
    },

    completeCourseMaterial(
      courseId: string,
      employeeId: string,
      materialId: string,
      studyMinutes: number,
    ) {
      const course = this.trainingCourses.find((c) => c.id === courseId)
      if (!course) throw new Error('课程不存在')
      if (!course.materialIds.includes(materialId)) throw new Error('资料不属于该课程')

      const now = new Date().toISOString()
      let rec = this.courseLearningRecords.find(
        (r) => r.courseId === courseId && r.employeeId === employeeId,
      )
      if (!rec) {
        rec = {
          id: generateId('clr'),
          courseId,
          employeeId,
          status: 'in_progress',
          completedMaterialIds: [],
          studyMinutes: 0,
          updatedAt: now,
        }
        this.courseLearningRecords.push(rec)
      }

      if (!rec.completedMaterialIds.includes(materialId)) {
        rec.completedMaterialIds.push(materialId)
      }
      rec.studyMinutes += Math.max(1, studyMinutes)
      rec.updatedAt = now

      const allDone = course.materialIds.every((id) => rec!.completedMaterialIds.includes(id))
      if (allDone) {
        rec.status = 'completed'
        rec.completedAt = now
      } else if (rec.status === 'not_started') {
        rec.status = 'in_progress'
      }

      this.persist('courseLearningRecords')
      return rec
    },

    /** 演示：一键完成课程全部资料学习 */
    completeCourseLearning(courseId: string, employeeId: string) {
      const course = this.trainingCourses.find((c) => c.id === courseId)
      if (!course) throw new Error('课程不存在')

      const now = new Date().toISOString()
      let rec = this.courseLearningRecords.find(
        (r) => r.courseId === courseId && r.employeeId === employeeId,
      )
      if (!rec) {
        rec = {
          id: generateId('clr'),
          courseId,
          employeeId,
          status: 'not_started',
          completedMaterialIds: [],
          studyMinutes: 0,
          updatedAt: now,
        }
        this.courseLearningRecords.push(rec)
      }

      rec.completedMaterialIds = [...course.materialIds]
      rec.status = 'completed'
      rec.studyMinutes = Math.max(
        rec.studyMinutes,
        (course.minStudyMinutes ?? 3) * course.materialIds.length,
      )
      rec.completedAt = now
      rec.updatedAt = now
      this.persist('courseLearningRecords')
      return rec
    },

    submitExamAttempt(params: {
      examId: string
      courseId: string
      employeeId: string
      answers: Record<string, string[]>
      durationMinutes: number
    }) {
      const exam = this.trainingExams.find((e) => e.id === params.examId)
      if (!exam) throw new Error('考核不存在')
      if (exam.status !== 'published') throw new Error('考核未发布')

      const course = this.trainingCourses.find((c) => c.id === params.courseId)
      if (!course) throw new Error('课程不存在')

      const rec = this.courseLearningRecords.find(
        (r) => r.courseId === params.courseId && r.employeeId === params.employeeId,
      )
      const progress =
        rec && course.materialIds.length > 0
          ? Math.round((rec.completedMaterialIds.length / course.materialIds.length) * 100)
          : 0
      if (progress < 100) throw new Error('请先完成课程全部资料学习')

      const prevAttempts = this.examAttempts.filter(
        (a) => a.examId === params.examId && a.employeeId === params.employeeId,
      )
      if (exam.maxRetakes >= 0 && prevAttempts.length >= exam.maxRetakes) {
        throw new Error('已达到最大考试次数')
      }
      if (prevAttempts.some((a) => a.passed)) throw new Error('已通过考核，无需重复考试')

      const questions = getExamQuestions(params.examId, this.examQuestions)
      if (questions.length === 0) throw new Error('考核暂无题目')

      const unanswered = questions.filter((q) => !(params.answers[q.id]?.length))
      if (unanswered.length > 0) throw new Error('请答完所有题目')

      const { score } = gradeExamAnswers(questions, params.answers)
      const passed = score >= exam.passScore
      const now = new Date().toISOString()

      const attempt: ExamAttempt = {
        id: generateId('ea'),
        examId: params.examId,
        employeeId: params.employeeId,
        courseId: params.courseId,
        score,
        passed,
        durationMinutes: params.durationMinutes,
        answers: params.answers,
        attemptNumber: prevAttempts.length + 1,
        submittedAt: now,
      }
      this.examAttempts.unshift(attempt)

      if (rec) {
        rec.examPassed = passed
        rec.examScore = score
        rec.historicalExam = false
        rec.updatedAt = now
        this.persist('courseLearningRecords')
      }
      this.persist('examAttempts')
      return attempt
    },

    // ── 小程序端 ──
    applyForJob(employeeId: string, jobRequirementId: string) {
      const job = this.jobRequirements.find((j) => j.id === jobRequirementId)
      if (!job || job.status !== 'recruiting') throw new Error('岗位不可报名')
      const dup = this.miniJobApplications.find(
        (a) => a.employeeId === employeeId && a.jobRequirementId === jobRequirementId,
      )
      if (dup) throw new Error('您已报名该岗位')
      const item: MiniJobApplication = {
        id: generateId('mja'),
        employeeId,
        jobRequirementId,
        status: 'pending',
        createdAt: new Date().toISOString(),
      }
      this.miniJobApplications.unshift(item)
      this.persist('miniJobApplications')
      this.addMiniAppMessage(employeeId, 'system', '岗位报名成功', `您已报名「${job.title}」，请等待审核。`)
      return item
    },

    acceptTaskFromHall(taskId: string, employeeId: string, quantity = 1) {
      const task = this.tasks.find((t) => t.id === taskId)
      if (!task || task.status !== 'active') throw new Error('任务不可领取')
      if (task.dispatchMode !== 'hall') throw new Error('该任务不支持大厅抢单')
      const emp = this.employees.find((e) => e.id === employeeId)
      if (!emp) throw new Error('人员不存在')
      this.assertCourseGateForEmployee(employeeId, 'task')
      if (isEmployeeUnavailableInRange(emp, task.startTime, task.endTime)) {
        throw new Error('您已配置请假/不上岗，任务期限内无法领取')
      }
      const q = Math.max(1, Math.floor(quantity))
      const myClaimed = getWorkerClaimedQuantity(this.taskInstances, taskId, employeeId)
      if (task.maxPerPerson && myClaimed + q > task.maxPerPerson) {
        throw new Error(`每人最多领取 ${task.maxPerPerson} ${task.maxPerPerson === 1 ? '次' : '次/件'}`)
      }
      if (task.plannedTotal != null && task.acceptedCount + q > task.plannedTotal) {
        throw new Error('任务名额不足')
      }
      const pricing = resolveTaskPricing(task, this.taskTypes)
      const workflow = this.taskWorkflows.find((w) => w.id === task.workflowId)
      if (!workflow) throw new Error('工作流不存在')
      const startNode = workflow.nodes.find((n) => n.nodeType === 'start')
      const execNode = getWorkerExecutingNode(workflow)
      const node = startNode ?? execNode
      if (!node) throw new Error('工作流节点异常')
      const settlementUnit =
        task.settlementUnitPrice != null
          ? task.settlementUnitPrice
          : pricing?.pricingMode === 'fixed'
            ? (pricing.fixedPrice ?? 0)
            : (pricing?.tieredPrices?.[0]?.unitPrice ?? 0)
      const amount = Math.round(settlementUnit * q * 100) / 100
      const now = new Date().toISOString()
      const item = {
        id: generateId('ti'),
        taskId: task.id,
        taskName: task.name,
        taskTypeName: task.taskTypeName,
        enterpriseId: task.enterpriseId,
        enterpriseName: task.enterpriseName,
        workerId: employeeId,
        workerName: emp.name,
        currentNodeId: node.id,
        currentNodeName: node.name,
        claimQuantity: q,
        amount,
        fieldValues: {},
        createdAt: now,
        updatedAt: now,
      }
      this.taskInstances.unshift(item)
      task.acceptedCount += q
      this.persist('taskInstances')
      this.persist('tasks')
      this.addMiniAppMessage(employeeId, 'task', '任务领取成功', `您已领取「${task.name}」${q} 件/次，请尽快执行。`)
      return item
    },

    submitTaskInstanceWorkflow(
      instanceId: string,
      fieldValues: Record<string, string | number | boolean>,
      action?: import('@/types').WorkflowAction,
    ) {
      const instance = this.taskInstances.find((i) => i.id === instanceId)
      if (!instance) throw new Error('任务实例不存在')
      const task = this.tasks.find((t) => t.id === instance.taskId)
      const workflow = this.taskWorkflows.find((w) => w.id === task?.workflowId)
      if (!task || !workflow) throw new Error('任务或工作流不存在')

      instance.fieldValues = { ...(instance.fieldValues ?? {}), ...fieldValues }
      const nodeFields = workflow.fields?.filter((f) => f.nodeIds.includes(instance.currentNodeId)) ?? []
      for (const field of nodeFields) {
        if (!field.required) continue
        const val = instance.fieldValues[field.id]
        if (val === undefined || val === null || val === '') {
          throw new Error(`请填写${field.name}`)
        }
      }

      const submitAction = action ?? pickWorkerSubmitAction(workflow, instance.currentNodeId)
      if (!submitAction) throw new Error('当前节点无可执行操作')

      const target = resolveTransitionTarget(workflow, instance.currentNodeId, submitAction)
      if (!target) throw new Error('流程流转失败')

      instance.currentNodeId = target.id
      instance.currentNodeName = target.name
      instance.updatedAt = new Date().toISOString()

      if (target.nodeType === 'end' && target.name.includes('完成')) {
        task.completedCount += instance.claimQuantity ?? 1
        this.persist('tasks')
      }

      this.persist('taskInstances')
      return instance
    },

    claimWorkerIncome(
      ids: string[],
      employeeId: string,
      channel: 'alipay' | 'bank' = 'alipay',
    ) {
      const records = this.workerIncomeRecords.filter(
        (r) => ids.includes(r.id) && r.employeeId === employeeId && r.status === 'claimable',
      )
      if (records.length === 0) throw new Error('没有可领取的收入')
      const binding = this.workerPaymentBindings.find((b) => b.employeeId === employeeId)
      if (channel === 'alipay' && !binding?.alipay) {
        throw new Error('请先绑定支付宝账号')
      }
      if (channel === 'bank' && (!binding?.bankName || !binding?.bankCardLast4)) {
        throw new Error('请先绑定银行卡')
      }
      const now = new Date().toISOString()
      const batchId = generateId('claim')
      for (const r of records) {
        r.tax = Math.round(r.amount * 0.03 * 100) / 100
        r.netAmount = Math.round((r.amount - r.tax) * 100) / 100
        r.status = 'claimed'
        r.claimedAt = now
        r.claimBatchId = batchId
      }
      this.persist('workerIncomeRecords')
      const gross = records.reduce((s, r) => s + r.amount, 0)
      const tax = records.reduce((s, r) => s + (r.tax ?? 0), 0)
      const total = records.reduce((s, r) => s + (r.netAmount ?? 0), 0)
      const dest =
        channel === 'alipay'
          ? `支付宝 ${binding!.alipay}`
          : `${binding!.bankName} 尾号${binding!.bankCardLast4}`
      this.addMiniAppMessage(
        employeeId,
        'withdraw',
        '收入领取成功',
        `已成功领取 ¥${total.toFixed(2)}（税前 ¥${gross.toFixed(2)}，个税 ¥${tax.toFixed(2)}），将转入${dest}。`,
      )
      return records
    },

    addMiniAppMessage(
      employeeId: string,
      category: MiniAppMessage['category'],
      title: string,
      content: string,
    ) {
      const item: MiniAppMessage = {
        id: generateId('msg'),
        employeeId,
        category,
        title,
        content,
        read: false,
        createdAt: new Date().toISOString(),
      }
      this.miniAppMessages.unshift(item)
      this.persist('miniAppMessages')
      return item
    },

    markMiniMessageRead(id: string) {
      const msg = this.miniAppMessages.find((m) => m.id === id)
      if (msg) {
        msg.read = true
        this.persist('miniAppMessages')
      }
    },

    markAllMiniMessagesRead(employeeId: string) {
      let changed = false
      for (const msg of this.miniAppMessages) {
        if (msg.employeeId === employeeId && !msg.read) {
          msg.read = true
          changed = true
        }
      }
      if (changed) this.persist('miniAppMessages')
    },

    confirmScheduleMessage(id: string) {
      const msg = this.miniAppMessages.find((m) => m.id === id)
      if (!msg?.scheduleDetail) throw new Error('排班消息不存在')
      msg.scheduleDetail.confirmStatus = 'accepted'
      msg.read = true
      this.persist('miniAppMessages')
      return msg
    },

    rejectScheduleMessage(id: string) {
      const msg = this.miniAppMessages.find((m) => m.id === id)
      if (!msg?.scheduleDetail) throw new Error('排班消息不存在')
      msg.scheduleDetail.confirmStatus = 'rejected'
      msg.read = true
      this.persist('miniAppMessages')
      return msg
    },

    signWorkerAgreement(id: string, employeeId: string) {
      const agr = this.workerAgreements.find((a) => a.id === id && a.employeeId === employeeId)
      if (!agr) throw new Error('协议不存在')
      if (agr.signed || agr.status === 'terminated') return agr
      agr.signed = true
      agr.signedAt = new Date().toISOString()
      agr.status = 'signed'
      if (!agr.effectiveDate) {
        agr.effectiveDate = agr.signedAt.slice(0, 10)
      }
      this.persist('workerAgreements')
      return agr
    },

    createWorkerAgreement(
      data: Omit<WorkerAgreement, 'id' | 'signed' | 'signedAt' | 'status' | 'createdAt' | 'contractNo'> & {
        contractNo?: string
      },
    ) {
      const seq = this.workerAgreements.length + 1
      const item: WorkerAgreement = {
        ...data,
        id: `agr_${Date.now()}`,
        contractNo: data.contractNo || `WA-${new Date().getFullYear()}-${String(seq).padStart(5, '0')}`,
        signed: false,
        status: 'pending',
        createdAt: new Date().toISOString(),
      }
      this.workerAgreements.unshift(item)
      this.persist('workerAgreements')
      return item
    },

    terminateWorkerAgreement(id: string) {
      const agr = this.workerAgreements.find((a) => a.id === id)
      if (!agr) throw new Error('协议不存在')
      if (agr.status === 'terminated') return agr
      agr.status = 'terminated'
      this.persist('workerAgreements')
      return agr
    },

    bindWorkerPayment(
      employeeId: string,
      data: Partial<Omit<WorkerPaymentBinding, 'employeeId'>>,
    ) {
      let binding = this.workerPaymentBindings.find((b) => b.employeeId === employeeId)
      if (!binding) {
        binding = { employeeId, ...data }
        this.workerPaymentBindings.push(binding)
      } else {
        Object.assign(binding, data)
      }
      this.persist('workerPaymentBindings')
      return binding
    },

    ensureWorkerProfileExt(employeeId: string): WorkerProfileExt {
      let profile = this.workerProfileExts.find((p) => p.employeeId === employeeId)
      if (!profile) {
        profile = {
          employeeId,
          level: '新手灵工',
          levelScore: 0,
          creditScore: 80,
          creditLevel: '良好',
          certificates: [],
          faceVerifyStatus: 'unverified',
          schedulePreferences: [],
          unavailablePeriods: [],
          partTimePreference: {},
          basicProofs: [
            { type: 'real_name', status: 'missing' },
            { type: 'health_cert', status: 'missing' },
          ],
          skillCertificates: [],
          profileCompleteness: 0,
        }
        this.workerProfileExts.push(profile)
        this.persist('workerProfileExts')
      }
      return profile
    },

    updateWorkerProfileExt(
      employeeId: string,
      data: Partial<Omit<WorkerProfileExt, 'employeeId'>>,
    ) {
      const profile = this.ensureWorkerProfileExt(employeeId)
      Object.assign(profile, data)
      profile.profileCompleteness = calcProfileCompleteness(profile)
      this.persist('workerProfileExts')
      return profile
    },

    completeWorkerRealName(employeeId: string, realName: string, idCard: string) {
      const employee = this.employees.find((e) => e.id === employeeId)
      if (employee) {
        employee.name = realName.trim()
        employee.realNameVerified = true
        this.persist('employees')
      }
      const proofs = this.ensureWorkerProfileExt(employeeId).basicProofs ?? []
      const nextProofs = [
        { type: 'real_name' as const, status: 'verified' as const },
        proofs.find((p) => p.type === 'health_cert') ?? { type: 'health_cert' as const, status: 'missing' as const },
      ]
      return this.updateWorkerProfileExt(employeeId, {
        realName: realName.trim(),
        idCardMasked: maskIdCard(idCard),
        basicProofs: nextProofs,
      })
    },

    completeWorkerFaceVerify(employeeId: string, success = true) {
      return this.updateWorkerProfileExt(employeeId, {
        faceVerifyStatus: success ? 'verified' : 'failed',
        faceVerifiedAt: success ? new Date().toISOString() : undefined,
      })
    },

    upsertWorkerSchedulePreference(employeeId: string, pref: WorkerSchedulePreference) {
      const profile = this.ensureWorkerProfileExt(employeeId)
      const list = [...(profile.schedulePreferences ?? [])]
      const idx = list.findIndex((p) => p.id === pref.id)
      const normalized: WorkerSchedulePreference = {
        ...pref,
        variant: pref.variant ?? inferScheduleVariant(pref.weekdays),
      }
      if (idx >= 0) list[idx] = normalized
      else list.push(normalized)
      return this.updateWorkerProfileExt(employeeId, { schedulePreferences: list })
    },

    removeWorkerSchedulePreference(employeeId: string, prefId: string) {
      const profile = this.ensureWorkerProfileExt(employeeId)
      const list = (profile.schedulePreferences ?? []).filter((p) => p.id !== prefId)
      return this.updateWorkerProfileExt(employeeId, { schedulePreferences: list })
    },

    syncEmployeeUnavailableDates(employeeId: string) {
      const profile = this.ensureWorkerProfileExt(employeeId)
      const dates = expandUnavailablePeriods(profile.unavailablePeriods ?? [])
      const emp = this.employees.find((e) => e.id === employeeId)
      if (!emp) return dates
      emp.unavailableDates = dates
      this.persist('employees')
      return dates
    },

    upsertWorkerUnavailablePeriod(employeeId: string, period: WorkerUnavailablePeriod) {
      if (!period.startDate || !period.endDate) throw new Error('请选择起止日期')
      if (period.endDate < period.startDate) throw new Error('结束日期不能早于开始日期')
      const profile = this.ensureWorkerProfileExt(employeeId)
      const list = [...(profile.unavailablePeriods ?? [])]
      const idx = list.findIndex((p) => p.id === period.id)
      const normalized: WorkerUnavailablePeriod = {
        id: period.id,
        type: period.type,
        startDate: period.startDate,
        endDate: period.endDate,
        reason: period.reason?.trim() || undefined,
      }
      if (idx >= 0) list[idx] = normalized
      else list.unshift(normalized)
      this.updateWorkerProfileExt(employeeId, { unavailablePeriods: list })
      this.syncEmployeeUnavailableDates(employeeId)
      return normalized
    },

    removeWorkerUnavailablePeriod(employeeId: string, periodId: string) {
      const profile = this.ensureWorkerProfileExt(employeeId)
      const list = (profile.unavailablePeriods ?? []).filter((p) => p.id !== periodId)
      this.updateWorkerProfileExt(employeeId, { unavailablePeriods: list })
      this.syncEmployeeUnavailableDates(employeeId)
    },

    updateWorkerPartTimePreference(employeeId: string, pref: Partial<WorkerPartTimePreference>) {
      const profile = this.ensureWorkerProfileExt(employeeId)
      return this.updateWorkerProfileExt(employeeId, {
        partTimePreference: { ...profile.partTimePreference, ...pref },
      })
    },

    updateWorkerSkillCertificates(employeeId: string, certs: WorkerSkillCertificate[]) {
      return this.updateWorkerProfileExt(employeeId, { skillCertificates: certs })
    },

    updateWorkerPermanentAddress(employeeId: string, address: string) {
      const employee = this.employees.find((e) => e.id === employeeId)
      if (employee) {
        employee.address = address.trim()
        this.persist('employees')
      }
      return this.updateWorkerProfileExt(employeeId, { permanentAddress: address.trim() })
    },

    registerMiniAppWorker(payload: { phone: string; password: string; name: string }) {
      const phone = payload.phone.trim()
      const existing = this.employees.find((e) => e.phone === phone)
      if (existing) throw new Error('该手机号已注册，请直接登录')

      const id = `emp_mini_${Date.now()}`
      const employee: Employee = {
        id,
        name: payload.name.trim() || '新灵工',
        employeeNo: `M${String(Date.now()).slice(-6)}`,
        departmentId: 'dept_unassigned',
        position: '待完善',
        hireDate: new Date().toISOString().slice(0, 10),
        skills: [],
        preferredShiftIds: [],
        unavailableDates: [],
        status: 'active',
        phone,
        realNameVerified: false,
      }
      this.employees.push(employee)
      this.persist('employees')
      this.ensureWorkerProfileExt(id)
      return { employeeId: id, employee }
    },

    addReminderRule(
      data: Omit<ReminderRule, 'id' | 'createdAt' | 'updatedAt' | 'status'> & {
        status?: ReminderRule['status']
      },
    ) {
      const now = new Date().toISOString()
      const item: ReminderRule = {
        ...data,
        id: `rr_${Date.now()}`,
        status: data.status ?? 'active',
        createdAt: now,
        updatedAt: now,
      }
      this.reminderRules.unshift(item)
      this.persist('reminderRules')
      return item
    },

    updateReminderRule(id: string, data: Partial<Omit<ReminderRule, 'id' | 'createdAt'>>) {
      const rule = this.reminderRules.find((r) => r.id === id)
      if (!rule) throw new Error('提醒规则不存在')
      Object.assign(rule, data, { updatedAt: new Date().toISOString() })
      this.persist('reminderRules')
      return rule
    },

    setReminderRuleStatus(id: string, status: ReminderRule['status']) {
      return this.updateReminderRule(id, { status })
    },

    batchSetReminderRuleStatus(ids: string[], status: ReminderRule['status']) {
      const now = new Date().toISOString()
      let count = 0
      for (const id of ids) {
        const rule = this.reminderRules.find((r) => r.id === id)
        if (!rule) continue
        rule.status = status
        rule.updatedAt = now
        count += 1
      }
      if (count) this.persist('reminderRules')
      return count
    },

    removeReminderRule(id: string) {
      const idx = this.reminderRules.findIndex((r) => r.id === id)
      if (idx < 0) throw new Error('提醒规则不存在')
      this.reminderRules.splice(idx, 1)
      this.persist('reminderRules')
    },
  },
})
