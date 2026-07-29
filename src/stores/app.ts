import { defineStore } from 'pinia'
import type {
  AttendanceException,
  AttendanceGroup,
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
  ServiceContract,
  ServiceProvider,
  Shift,
  SettlementBill,
  BillingRule,
  GrabShiftSlot,
  GrabShiftApplication,
  GrabShiftWhitelistEntry,
  SwapRequest,
  SystemRole,
  SystemAccount,
  Task,
  TaskInstance,
  TaskType,
  TaskWorkflow,
  Team,
  InsuranceProduct,
  InsurancePolicy,
  TrainingMaterial,
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
} from '@/types'
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
import { seedSystemRoles } from '@/mock/permissionSeed'
import { seedSystemAccounts } from '@/mock/accountSeed'
import { seedServiceContracts, seedServiceProviders } from '@/mock/partnershipSeed'
import {
  platformPaymentAccount,
  seedInvoiceApplications,
  seedPendingSettlements,
  seedSettlementBills,
} from '@/mock/payrollBillSeed'
import { seedBillingRules } from '@/mock/billingRuleSeed'
import { seedGrabShiftSlots } from '@/mock/grabShiftSeed'
import { seedGrabShiftApplications } from '@/mock/grabShiftApplicationSeed'
import { seedGrabShiftWhitelist } from '@/mock/grabShiftWhitelistSeed'
import { seedScheduleTemplates } from '@/mock/scheduleTemplateSeed'
import { seedInsurancePolicies, seedInsuranceProducts } from '@/mock/insuranceSeed'
import {
  seedExamAttempts,
  seedTrainingMaterials,
  loadCourseLearningRecords,
  loadExamQuestions,
  loadTrainingCoursesAndExams,
} from '@/mock/trainingSeed'
import {
  seedMiniAppMessages,
  seedMiniJobApplications,
  seedWorkerAgreements,
  seedWorkerIncomeRecords,
  seedWorkerPaymentBindings,
  seedWorkerProfileExts,
} from '@/mock/miniappSeed'
import {
  seedEnterprises,
  seedTaskInstances,
  seedTasks,
  seedTaskTypes,
  seedTaskWorkflows,
} from '@/mock/taskSeed'
import {
  generateTaskName,
  getEnterpriseReviewNode,
  getWorkerExecutingNode,
  getWorkflowEndNode,
} from '@/services/task'
import { generateId, ensureDemoBrandingVersion, loadFromStorage, saveToStorage } from '@/utils'
import { deriveExceptions, getDatesBetween, buildDailyAttendanceList, getMonthDateRange } from '@/services/attendance'
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
  generateAiRiskQuestions,
  getExamQuestions,
  gradeExamAnswers,
} from '@/services/training'

export const useAppStore = defineStore('app', {
  state: () => {
    ensureDemoBrandingVersion()
    const trainingData = loadTrainingCoursesAndExams()
    return {
    departments: loadFromStorage<Department[]>('departments', seedDepartments),
    teams: loadFromStorage<Team[]>('teams', seedTeams),
    employees: loadFromStorage<Employee[]>('employees', seedEmployees),
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
    scheduleTemplates: loadFromStorage<ScheduleTemplate[]>('scheduleTemplates', seedScheduleTemplates),
    publishRecords: loadFromStorage<SchedulePublishRecord[]>('publishRecords', seedPublishRecordsWithDemo),
    notifications: loadFromStorage<Notification[]>('notifications', seedNotifications),
    attendanceRule: loadFromStorage<AttendanceRule>('attendanceRule', defaultAttendanceRule),
    punches: loadFromStorage<AttendancePunch[]>('punches', seedPunches),
    leaveRequests: loadFromStorage<LeaveRequest[]>('leaveRequests', seedLeaveRequests),
    swapRequests: loadFromStorage<SwapRequest[]>('swapRequests', seedSwapRequests),
    makeupRequests: loadFromStorage<MakeupPunchRequest[]>('makeupRequests', seedMakeupRequests),
    exceptions: loadFromStorage<AttendanceException[]>('exceptions', seedExceptions),
    manualOverrides: loadFromStorage<Record<string, AttendanceStatus>>(
      'manualOverrides',
      seedManualOverrides,
    ),
    overtimeRequests: loadFromStorage<OvertimeRequest[]>('overtimeRequests', seedOvertimeRequests),
    payrollConfig: loadFromStorage<PayrollConfig>('payrollConfig', defaultPayrollConfig),
    integrationLogs: loadFromStorage<IntegrationLog[]>('integrationLogs', seedIntegrationLogs),
    taskWorkflows: loadFromStorage<TaskWorkflow[]>('taskWorkflows', seedTaskWorkflows),
    taskTypes: loadFromStorage<TaskType[]>('taskTypes', seedTaskTypes),
    tasks: loadFromStorage<Task[]>('tasks', seedTasks),
    taskInstances: loadFromStorage<TaskInstance[]>('taskInstances', seedTaskInstances),
    currentEnterpriseId: loadFromStorage<string>(
      'currentEnterpriseId',
      'ent_china_mobile_agent',
    ),
    jobRequirements: loadFromStorage<JobRequirement[]>('jobRequirements', seedJobRequirements),
    recruitmentLeads: loadFromStorage<RecruitmentLead[]>('recruitmentLeads', seedRecruitmentLeads),
    talents: loadFromStorage<Talent[]>('talents', seedTalents),
    attendanceGroups: loadFromStorage<AttendanceGroup[]>('attendanceGroups', seedAttendanceGroups),
    systemRoles: loadFromStorage<SystemRole[]>('systemRoles', seedSystemRoles),
    systemAccounts: loadFromStorage<SystemAccount[]>('systemAccounts', seedSystemAccounts),
    serviceProviders: loadFromStorage<ServiceProvider[]>('serviceProviders', seedServiceProviders),
    serviceContracts: loadFromStorage<ServiceContract[]>('serviceContracts', seedServiceContracts),
    settlementBills: loadFromStorage<SettlementBill[]>('settlementBills', seedSettlementBills),
    billingRules: loadFromStorage<BillingRule[]>('billingRules', seedBillingRules),
    pendingSettlements: loadFromStorage<PendingSettlementItem[]>(
      'pendingSettlements',
      seedPendingSettlements,
    ),
    invoiceApplications: loadFromStorage<InvoiceApplication[]>(
      'invoiceApplications',
      seedInvoiceApplications,
    ),
    insuranceProducts: loadFromStorage<InsuranceProduct[]>('insuranceProducts', seedInsuranceProducts),
    insurancePolicies: loadFromStorage<InsurancePolicy[]>('insurancePolicies', seedInsurancePolicies),
    trainingMaterials: loadFromStorage<TrainingMaterial[]>('trainingMaterials', seedTrainingMaterials),
    trainingCourses: trainingData.courses,
    trainingExams: trainingData.exams,
    examQuestions: loadExamQuestions(),
    courseLearningRecords: loadCourseLearningRecords(),
    examAttempts: loadFromStorage<ExamAttempt[]>('examAttempts', seedExamAttempts),
    miniAppMessages: loadFromStorage<MiniAppMessage[]>('miniAppMessages', seedMiniAppMessages),
    workerIncomeRecords: loadFromStorage<WorkerIncomeRecord[]>(
      'workerIncomeRecords',
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
      state.taskTypes.filter((t) => t.status === 'pending').length,
    openExceptionCount: (state) =>
      state.exceptions.filter((e) => e.status === 'open' || e.status === 'appealed').length,
    enterprises: () => seedEnterprises,
    currentEnterprise: (state) =>
      seedEnterprises.find((e) => e.id === state.currentEnterpriseId) ?? seedEnterprises[0],
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
    addDepartment(dept: Omit<Department, 'id'>) {
      const item: Department = { ...dept, id: generateId('dept') }
      this.departments.push(item)
      this.persist('departments')
      return item
    },
    updateDepartment(id: string, data: Partial<Department>) {
      const idx = this.departments.findIndex((d) => d.id === id)
      if (idx >= 0) {
        this.departments[idx] = { ...this.departments[idx], ...data }
        this.persist('departments')
      }
    },
    removeDepartment(id: string) {
      const hasChildren = this.departments.some((d) => d.parentId === id)
      if (hasChildren) throw new Error('请先删除子部门')
      if (this.employees.some((e) => e.departmentId === id)) throw new Error('部门下仍有员工')
      this.departments = this.departments.filter((d) => d.id !== id)
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
        preferredShiftIds: emp.preferredShiftIds ?? [],
        unavailableDates: emp.unavailableDates ?? [],
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
      const existing = this.assignments.find(
        (a) => a.employeeId === data.employeeId && a.date === data.date,
      )
      if (existing) {
        existing.shiftId = data.shiftId
        existing.teamId = data.teamId
        existing.published = data.published ?? false
        if (data.fromGrabSlotId) existing.fromGrabSlotId = data.fromGrabSlotId
        if (data.confirmStatus !== undefined) existing.confirmStatus = data.confirmStatus
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
          published: data.published ?? false,
          confirmStatus: data.confirmStatus ?? 'pending',
          note: data.note,
          manualEdited: data.manualEdited ?? false,
        })
      }
      this.persist('assignments')
    },
    removeAssignment(employeeId: string, date: string) {
      this.assignments = this.assignments.filter(
        (a) => !(a.employeeId === employeeId && a.date === date),
      )
      this.persist('assignments')
    },
    getAssignment(employeeId: string, date: string) {
      return this.assignments.find((a) => a.employeeId === employeeId && a.date === date)
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
      const periodAssignments = this.assignments.filter(
        (a) =>
          a.teamId === teamId &&
          dates.includes(a.date) &&
          team.memberIds.includes(a.employeeId),
      )
      periodAssignments.forEach((a) => {
        a.published = true
        if (!a.confirmStatus || a.confirmStatus === 'pending') a.confirmStatus = 'confirming'
      })
      const record: SchedulePublishRecord = {
        id: generateId('pub'),
        month,
        teamId,
        publishedAt: new Date().toISOString(),
        publishedBy,
        employeeCount: team.memberIds.length,
        assignmentCount: periodAssignments.length,
      }
      this.publishRecords.unshift(record)
      this.pushNotification({
        title: '排班发布通知',
        content: `${team.name} 排班已发布，已通知 ${team.memberIds.length} 位员工确认`,
        type: 'schedule',
      })
      this.persist('assignments')
      this.persist('publishRecords')
      return record
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
            confirmStatus: 'pending',
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
          const src = this.getAssignment(employeeId, srcDate)
          if (!src || src.teamId !== teamId) return
          this.upsertAssignment({
            employeeId,
            shiftId: src.shiftId,
            date: targetDates[idx],
            teamId,
            published: false,
            confirmStatus: 'pending',
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
              confirmStatus: published.confirmStatus ?? 'pending',
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
      this.manualOverrides[key] = status
      void note
      this.persist('manualOverrides')
      this.syncExceptions()
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

    submitMakeupRequest(data: Omit<MakeupPunchRequest, 'id' | 'status' | 'createdAt'>) {
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
    ) {
      const item: GrabShiftSlot = {
        ...data,
        id: generateId('gs'),
        grabbedCount: 0,
        status: 'open',
        createdAt: new Date().toISOString(),
      }
      this.grabShiftSlots.unshift(item)
      this.persist('grabShiftSlots')
      return item
    },

    cancelGrabShiftSlot(id: string) {
      const slot = this.grabShiftSlots.find((s) => s.id === id)
      if (!slot) throw new Error('抢班班次不存在')
      slot.status = 'cancelled'
      this.persist('grabShiftSlots')
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
      const slot = this.grabShiftSlots.find((s) => s.id === data.slotId)
      if (!slot) throw new Error('抢班班次不存在')
      if (slot.status === 'cancelled' || slot.status === 'full') {
        throw new Error('该班次已满或已取消')
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
        industryTags: [...source.industryTags],
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
      if (!seedEnterprises.some((e) => e.id === id)) throw new Error('企业不存在')
      this.currentEnterpriseId = id
      this.persist('currentEnterpriseId')
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
      const ent = seedEnterprises.find((e) => e.id === enterpriseId)
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
      tt.applicant = applicant ?? seedEnterprises.find((e) => e.id === tt.enterpriseId)?.contact
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
        | 'workflowId'
        | 'status'
        | 'acceptedCount'
        | 'completedCount'
        | 'approvedCount'
        | 'createdAt'
      >,
    ) {
      const ent = seedEnterprises.find((e) => e.id === enterpriseId)
      const tt = this.taskTypes.find((t) => t.id === data.taskTypeId)
      if (!ent) throw new Error('企业不存在')
      if (!tt || tt.enterpriseId !== enterpriseId) throw new Error('任务类型不存在')
      if (tt.status !== 'published') throw new Error('请选择已发布的任务类型')

      const item: Task = {
        ...data,
        id: generateId('task'),
        enterpriseId,
        enterpriseName: ent.name,
        taskTypeName: tt.name,
        workflowId: tt.workflowId,
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
      if (task.status !== 'draft') throw new Error('仅未发布任务可编辑')
      if (data.taskTypeId && data.taskTypeId !== task.taskTypeId) {
        const tt = this.taskTypes.find((t) => t.id === data.taskTypeId)
        if (!tt || tt.enterpriseId !== task.enterpriseId || tt.status !== 'published') {
          throw new Error('无效的任务类型')
        }
        task.taskTypeId = tt.id
        task.taskTypeName = tt.name
        task.workflowId = tt.workflowId
      }
      Object.assign(task, data)
      this.persist('tasks')
    },

    publishEnterpriseTask(id: string) {
      const task = this.tasks.find((t) => t.id === id)
      if (!task) throw new Error('任务不存在')
      if (task.status !== 'draft') throw new Error('任务已发布')
      task.status = 'active'
      this.persist('tasks')
      this.pushNotification({
        title: '新任务发布',
        content: `${task.enterpriseName} 发布了任务「${task.name}」`,
        type: 'system',
      })
    },

    cancelEnterpriseTask(id: string) {
      const task = this.tasks.find((t) => t.id === id)
      if (!task) throw new Error('任务不存在')
      if (task.status !== 'active') throw new Error('仅进行中的任务可取消')
      task.status = 'cancelled'
      this.persist('tasks')
    },

    reviewTaskInstance(instanceId: string, approved: boolean, reviewNote = '') {
      const instance = this.taskInstances.find((i) => i.id === instanceId)
      if (!instance) throw new Error('任务实例不存在')

      const task = this.tasks.find((t) => t.id === instance.taskId)
      const workflow = this.taskWorkflows.find((w) => w.id === task?.workflowId)
      if (!task || !workflow) throw new Error('关联任务或工作流不存在')

      const reviewNode = getEnterpriseReviewNode(workflow)
      if (!reviewNode || instance.currentNodeId !== reviewNode.id) {
        throw new Error('该实例不在企业验收节点')
      }

      const now = new Date().toISOString()
      instance.updatedAt = now

      if (approved) {
        const endNode = getWorkflowEndNode(workflow)
        if (!endNode) throw new Error('工作流缺少结束节点')
        instance.currentNodeId = endNode.id
        instance.currentNodeName = endNode.name
        task.approvedCount += 1
      } else {
        const execNode = getWorkerExecutingNode(workflow)
        if (!execNode) throw new Error('工作流缺少执行节点')
        instance.currentNodeId = execNode.id
        instance.currentNodeName = execNode.name
        task.completedCount = Math.max(0, task.completedCount - 1)
      }

      this.persist('taskInstances')
      this.persist('tasks')
      this.pushNotification({
        title: approved ? '任务验收通过' : '任务验收驳回',
        content: `「${instance.taskName}」${instance.workerName} 的提交已${approved ? '通过' : '驳回'}${reviewNote ? `：${reviewNote}` : ''}`,
        type: 'approval',
      })
    },

    suggestTaskName(taskTypeId: string) {
      const tt = this.taskTypes.find((t) => t.id === taskTypeId)
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
      req.status = 'active'
      this.persist('jobRequirements')
    },

    closeJobRequirement(id: string) {
      const req = this.jobRequirements.find((r) => r.id === id)
      if (!req) throw new Error('岗位需求不存在')
      req.status = 'closed'
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

    advanceLeadStatus(id: string, feedback?: string) {
      const lead = this.recruitmentLeads.find((l) => l.id === id)
      if (!lead) throw new Error('线索不存在')
      const idx = RECRUITMENT_STATUS_FLOW.indexOf(lead.status)
      if (idx < 0 || idx >= RECRUITMENT_STATUS_FLOW.length - 1) {
        throw new Error('已是最终状态')
      }
      lead.status = RECRUITMENT_STATUS_FLOW[idx + 1]
      if (feedback) lead.interviewFeedback = feedback
      lead.updatedAt = new Date().toISOString()

      if (lead.status === 'onboarded') {
        const req = this.jobRequirements.find((r) => r.id === lead.requirementId)
        if (req) req.filledCount += 1
        this.persist('jobRequirements')
      }
      this.persist('recruitmentLeads')
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
      if (req.status !== 'active') throw new Error('岗位未在招聘中')

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
        talentId: talent.id,
      })
      talent.status = 'in_process'
      talent.lastContactAt = new Date().toISOString()
      this.persist('talents')
      return lead
    },

    addAttendanceGroup(data: Omit<AttendanceGroup, 'id' | 'code' | 'createdAt' | 'updatedAt'>) {
      const now = new Date().toISOString()
      const seq = this.attendanceGroups.length + 1
      const item: AttendanceGroup = {
        ...data,
        id: generateId('ag'),
        code: `HQ-ATT-${String(seq).padStart(3, '0')}`,
        createdAt: now,
        updatedAt: now,
      }
      this.attendanceGroups.unshift(item)
      this.persist('attendanceGroups')
      return item
    },

    updateAttendanceGroup(id: string, data: Partial<AttendanceGroup>) {
      const group = this.attendanceGroups.find((g) => g.id === id)
      if (!group) throw new Error('考勤组不存在')
      Object.assign(group, data, { updatedAt: new Date().toISOString() })
      this.persist('attendanceGroups')
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

    createSystemRole(data: Omit<SystemRole, 'id' | 'updatedAt' | 'userCount' | 'isSystem'>) {
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
      const role = this.systemRoles.find((r) => r.id === id)
      if (!role) throw new Error('角色不存在')
      if (role.isSystem && data.code && data.code !== role.code) {
        throw new Error('系统内置角色不可修改编码')
      }
      Object.assign(role, data, { updatedAt: new Date().toISOString() })
      this.persist('systemRoles')
    },

    updateRolePermissions(
      id: string,
      permissionIds: string[],
      dataScope: SystemRole['dataScope'],
      customDepartmentIds: string[],
    ) {
      const role = this.systemRoles.find((r) => r.id === id)
      if (!role) throw new Error('角色不存在')
      role.permissionIds = permissionIds
      role.dataScope = dataScope
      role.customDepartmentIds = customDepartmentIds
      role.updatedAt = new Date().toISOString()
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
      const boundCount = this.systemAccounts.filter((a) => a.roleId === id).length
      if (boundCount > 0) throw new Error('该角色下仍有用户，无法删除')
      this.systemRoles = this.systemRoles.filter((r) => r.id !== id)
      this.persist('systemRoles')
    },

    syncRoleUserCounts() {
      this.systemRoles.forEach((role) => {
        role.userCount = this.systemAccounts.filter((a) => a.roleId === role.id).length
      })
      this.persist('systemRoles')
    },

    createSystemAccount(data: Omit<SystemAccount, 'id' | 'createdAt' | 'updatedAt' | 'lastLoginAt'>) {
      if (this.systemAccounts.some((a) => a.username === data.username)) {
        throw new Error('登录账号已存在')
      }
      const role = this.systemRoles.find((r) => r.id === data.roleId)
      if (!role) throw new Error('角色不存在')
      if (role.status === 'disabled') throw new Error('所选角色已停用')
      const now = new Date().toISOString()
      const item: SystemAccount = {
        ...data,
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
      if (data.roleId && data.roleId !== account.roleId) {
        const role = this.systemRoles.find((r) => r.id === data.roleId)
        if (!role) throw new Error('角色不存在')
        if (role.status === 'disabled') throw new Error('所选角色已停用')
      }
      const prevRoleId = account.roleId
      Object.assign(account, data, { updatedAt: new Date().toISOString() })
      this.persist('systemAccounts')
      if (data.roleId && data.roleId !== prevRoleId) {
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

    confirmSettlementBill(id: string) {
      const bill = this.settlementBills.find((b) => b.id === id)
      if (!bill) throw new Error('账单不存在')
      if (bill.status !== 'pending_confirm') throw new Error('当前状态不可确认')
      bill.status = 'pending_payment'
      bill.confirmedAt = new Date().toISOString()
      bill.updatedAt = new Date().toISOString()
      this.persist('settlementBills')
    },

    submitBillPayment(id: string, voucherFileName: string) {
      const bill = this.settlementBills.find((b) => b.id === id)
      if (!bill) throw new Error('账单不存在')
      if (bill.status !== 'pending_payment') throw new Error('当前状态不可付款')
      if (!voucherFileName.trim()) throw new Error('请上传付款凭证')
      bill.status = 'pending_verify'
      bill.paymentVoucher = voucherFileName
      bill.paymentSubmittedAt = new Date().toISOString()
      bill.updatedAt = new Date().toISOString()
      this.persist('settlementBills')
      this.pushNotification({
        title: '付款凭证已提交',
        content: `账单 ${bill.billNo} 已提交付款凭证，待运营核实`,
        type: 'approval',
      })
    },

    verifyBillPayment(id: string) {
      const bill = this.settlementBills.find((b) => b.id === id)
      if (!bill) throw new Error('账单不存在')
      if (bill.status !== 'pending_verify') throw new Error('当前状态不可核实')
      bill.status = 'paid'
      bill.paidAt = new Date().toISOString()
      bill.updatedAt = new Date().toISOString()
      this.persist('settlementBills')
      this.pushNotification({
        title: '到账已确认',
        content: `账单 ${bill.billNo} 已确认收款`,
        type: 'system',
      })
    },

    applyInvoice(
      data: Omit<
        InvoiceApplication,
        'id' | 'applicationNo' | 'status' | 'createdAt' | 'issuedAt' | 'electronicUrl' | 'expressNo'
      >,
    ) {
      const bill = this.settlementBills.find((b) => b.id === data.billId)
      if (!bill) throw new Error('关联账单不存在')
      if (bill.status !== 'paid') throw new Error('仅已支付账单可申请发票')
      const remaining = bill.totalPayable - bill.invoicedAmount
      if (data.amount <= 0 || data.amount > remaining) {
        throw new Error(`开票金额不能超过剩余可开金额 ${remaining}`)
      }
      const seq = this.invoiceApplications.length + 1
      const item: InvoiceApplication = {
        ...data,
        id: generateId('inv'),
        applicationNo: `INV-${new Date().toISOString().slice(0, 7).replace('-', '')}-${String(seq).padStart(4, '0')}`,
        status: 'pending',
        createdAt: new Date().toISOString(),
      }
      bill.invoicedAmount += data.amount
      bill.updatedAt = new Date().toISOString()
      this.invoiceApplications.unshift(item)
      this.persist('invoiceApplications')
      this.persist('settlementBills')
      return item
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
        rec.updatedAt = now
        this.persist('courseLearningRecords')
      }
      this.persist('examAttempts')
      return attempt
    },

    // ── 小程序端 ──
    applyForJob(employeeId: string, jobRequirementId: string) {
      const job = this.jobRequirements.find((j) => j.id === jobRequirementId)
      if (!job || job.status !== 'active') throw new Error('岗位不可报名')
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

    acceptTaskFromHall(taskId: string, employeeId: string) {
      const task = this.tasks.find((t) => t.id === taskId)
      if (!task || task.status !== 'active') throw new Error('任务不可领取')
      if (task.dispatchMode !== 'hall') throw new Error('该任务不支持大厅抢单')
      const emp = this.employees.find((e) => e.id === employeeId)
      if (!emp) throw new Error('人员不存在')
      const myCount = this.taskInstances.filter(
        (i) => i.taskId === taskId && i.workerId === employeeId,
      ).length
      if (task.maxPerPerson && myCount >= task.maxPerPerson) {
        throw new Error(`每人最多领取 ${task.maxPerPerson} 次`)
      }
      const workflow = this.taskWorkflows.find((w) => w.id === task.workflowId)
      if (!workflow) throw new Error('工作流不存在')
      const execNode = getWorkerExecutingNode(workflow)
      const startNode = workflow.nodes.find((n) => n.nodeType === 'start')
      const node = execNode ?? startNode
      if (!node) throw new Error('工作流节点异常')
      const now = new Date().toISOString()
      const item = {
        id: generateId('ti'),
        taskId: task.id,
        taskName: task.name,
        taskTypeName: task.taskTypeName,
        enterpriseName: task.enterpriseName,
        workerId: employeeId,
        workerName: emp.name,
        currentNodeId: node.id,
        currentNodeName: node.name,
        amount: 50,
        createdAt: now,
        updatedAt: now,
      }
      this.taskInstances.unshift(item)
      task.acceptedCount += 1
      this.persist('taskInstances')
      this.persist('tasks')
      this.addMiniAppMessage(employeeId, 'task', '任务领取成功', `您已领取「${task.name}」，请尽快执行。`)
      return item
    },

    claimWorkerIncome(ids: string[], employeeId: string) {
      const records = this.workerIncomeRecords.filter(
        (r) => ids.includes(r.id) && r.employeeId === employeeId && r.status === 'claimable',
      )
      if (records.length === 0) throw new Error('没有可领取的收入')
      const now = new Date().toISOString()
      for (const r of records) {
        r.tax = Math.round(r.amount * 0.03 * 100) / 100
        r.netAmount = Math.round((r.amount - r.tax) * 100) / 100
        r.status = 'claimed'
        r.claimedAt = now
      }
      this.persist('workerIncomeRecords')
      const total = records.reduce((s, r) => s + (r.netAmount ?? 0), 0)
      this.addMiniAppMessage(
        employeeId,
        'withdraw',
        '收入领取成功',
        `已成功领取 ¥${total.toFixed(2)}，将转入绑定账户。`,
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

    signWorkerAgreement(id: string, employeeId: string) {
      const agr = this.workerAgreements.find((a) => a.id === id && a.employeeId === employeeId)
      if (!agr) throw new Error('协议不存在')
      if (agr.signed) return agr
      agr.signed = true
      agr.signedAt = new Date().toISOString()
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
  },
})
