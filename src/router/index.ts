import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import PlatformLayout from '@/layouts/PlatformLayout.vue'
import EnterpriseLayout from '@/layouts/EnterpriseLayout.vue'
import { isMiniAppAuthed } from '@/composables/useMiniAppAuth'
import { isEnterpriseMiniAuthed } from '@/composables/useEnterpriseMiniAuth'

const sharedOpsRoutes: RouteRecordRaw[] = [
  {
    path: 'recruitment/requirements',
    name: 'RecruitmentRequirements',
    component: () => import('@/views/recruitment/RequirementList.vue'),
    meta: { title: '需求管理', group: '招聘管理' },
  },
  {
    path: 'recruitment/progress',
    name: 'RecruitmentProgress',
    component: () => import('@/views/recruitment/RecruitmentProgress.vue'),
    meta: { title: '招聘进度看板', group: '招聘管理' },
  },
  {
    path: 'recruitment/calendar',
    name: 'InterviewCalendar',
    component: () => import('@/views/recruitment/InterviewCalendar.vue'),
    meta: { title: '面试日程', group: '招聘管理' },
  },
  {
    path: 'recruitment/talents',
    name: 'TalentPool',
    component: () => import('@/views/recruitment/TalentPool.vue'),
    meta: { title: '人才库', group: '招聘管理' },
  },
  {
    path: 'training/materials',
    name: 'TrainingMaterials',
    component: () => import('@/views/training/TrainingMaterialManageView.vue'),
    meta: { title: '培训资料', group: '培训与考核' },
  },
  {
    path: 'training/courses',
    name: 'TrainingCourses',
    component: () => import('@/views/training/CourseManageView.vue'),
    meta: { title: '课程管理', group: '培训与考核' },
  },
  {
    path: 'training/exams',
    name: 'TrainingExams',
    component: () => import('@/views/training/ExamManageView.vue'),
    meta: { title: '考核管理', group: '培训与考核' },
  },
  {
    path: 'training/exams/:examId/questions',
    name: 'TrainingExamQuestions',
    component: () => import('@/views/training/ExamQuestionManageView.vue'),
    meta: { title: '题目管理', group: '培训与考核', hidden: true },
  },
  {
    path: 'training/progress',
    name: 'TrainingProgress',
    component: () => import('@/views/training/LearningProgressView.vue'),
    meta: { title: '学习进度', group: '培训与考核' },
  },
  {
    path: 'training/exam-results',
    name: 'TrainingExamResults',
    component: () => import('@/views/training/ExamResultView.vue'),
    meta: { title: '考核结果', group: '培训与考核' },
  },

  {
    path: 'departments',
    name: 'Departments',
    component: () => import('@/views/department/DepartmentList.vue'),
    meta: { title: '部门管理', group: '排班管理' },
  },
  {
    path: 'employees',
    name: 'Employees',
    component: () => import('@/views/employee/EmployeeList.vue'),
    meta: { title: '人员管理', group: '人员管理' },
  },
  {
    path: 'employees/:id',
    name: 'EmployeeDetail',
    component: () => import('@/views/employee/EmployeeDetailView.vue'),
    meta: { title: '查看详情', group: '人员管理' },
  },
  {
    path: 'attendance-groups',
    name: 'AttendanceGroups',
    component: () => import('@/views/attendance/AttendanceGroupList.vue'),
    meta: { title: '考勤组管理', group: '人员管理' },
  },
  {
    path: 'attendance-groups/create',
    name: 'AttendanceGroupCreate',
    component: () => import('@/views/attendance/AttendanceGroupForm.vue'),
    meta: { title: '新建考勤组', group: '人员管理' },
  },
  {
    path: 'attendance-groups/:id/edit',
    name: 'AttendanceGroupEdit',
    component: () => import('@/views/attendance/AttendanceGroupForm.vue'),
    meta: { title: '编辑考勤组', group: '人员管理' },
  },
  {
    path: 'shift-demand-manage',
    name: 'ShiftDemandManage',
    component: () => import('@/views/schedule/ShiftDemandManageView.vue'),
    meta: { title: '需求总览', group: '排班管理' },
  },
  {
    path: 'schedule-manage',
    name: 'ScheduleManage',
    component: () => import('@/views/schedule/ScheduleManageView.vue'),
    meta: { title: '排班管理', group: '排班管理' },
  },
  {
    path: 'grab-personnel-pool',
    name: 'GrabPersonnelPool',
    component: () => import('@/views/schedule/GrabPersonnelPoolView.vue'),
    meta: { title: '人员池', group: '抢班管理' },
  },
  {
    path: 'grab-interview',
    name: 'GrabInterview',
    component: () => import('@/views/schedule/GrabInterviewManageView.vue'),
    meta: { title: '抢班面试管理', group: '抢班管理' },
  },
  {
    path: 'grab-shifts',
    name: 'GrabShifts',
    component: () => import('@/views/schedule/GrabShiftManageView.vue'),
    meta: { title: '抢班管理', group: '抢班管理' },
  },
  {
    path: 'grab-shift-history',
    name: 'GrabShiftHistory',
    component: () => import('@/views/schedule/GrabShiftHistoryView.vue'),
    meta: { title: '历史抢班记录', group: '抢班管理' },
  },
  {
    path: 'attendance-data',
    name: 'AttendanceData',
    component: () => import('@/views/attendance/AttendanceDataView.vue'),
    meta: { title: '考勤数据', group: '排班管理', assignmentSource: 'schedule' },
  },
  {
    path: 'attendance-exceptions',
    name: 'AttendanceExceptions',
    component: () => import('@/views/attendance/ExceptionList.vue'),
    meta: { title: '考勤审批', group: '排班管理', assignmentSource: 'schedule' },
  },
  {
    path: 'cancel-shift-records',
    name: 'CancelShiftRecords',
    component: () => import('@/views/attendance/CancelShiftRecordsView.vue'),
    meta: {
      title: '取消班次记录',
      group: '排班管理',
      assignmentSource: 'schedule',
      hidden: true,
    },
  },
  {
    path: 'grab-attendance-data',
    name: 'GrabAttendanceData',
    component: () => import('@/views/attendance/AttendanceDataView.vue'),
    meta: { title: '考勤数据', group: '抢班管理', assignmentSource: 'grab' },
  },
  {
    path: 'grab-attendance-exceptions',
    name: 'GrabAttendanceExceptions',
    component: () => import('@/views/attendance/ExceptionList.vue'),
    meta: { title: '考勤审批记录', group: '抢班管理', assignmentSource: 'grab' },
  },
  {
    path: 'grab-cancel-shift-records',
    name: 'GrabCancelShiftRecords',
    component: () => import('@/views/attendance/CancelShiftRecordsView.vue'),
    meta: {
      title: '取消班次记录',
      group: '抢班管理',
      assignmentSource: 'grab',
      hidden: true,
    },
  },
  {
    path: 'attendance-alerts/:id',
    name: 'AttendanceAlertHandle',
    component: () => import('@/views/attendance/AttendanceExceptionHandleView.vue'),
    meta: { title: '考勤异常处理', group: '排班管理', hidden: true },
  },
  {
    path: 'insurance',
    name: 'InsuranceManage',
    component: () => import('@/views/insurance/InsuranceManageView.vue'),
    meta: { title: '保险管理', group: '人员管理' },
  },
  {
    path: 'approvals',
    name: 'Approvals',
    component: () => import('@/views/approval/ApprovalCenter.vue'),
    meta: { title: '审批中心' },
  },
  {
    path: 'payroll/billing-rules',
    name: 'PayrollBillingRules',
    component: () => import('@/views/payroll/BillingRuleView.vue'),
    meta: { title: '计薪规则', group: '财税管理' },
  },
  {
    path: 'system/accounts',
    name: 'SystemAccounts',
    component: () => import('@/views/system/AccountListView.vue'),
    meta: { title: '账号管理', group: '系统设置' },
  },
  {
    path: 'system/roles',
    name: 'SystemRoles',
    component: () => import('@/views/system/RolePermissionView.vue'),
    meta: { title: '角色权限', group: '系统设置' },
  },
  {
    path: 'system/oplog',
    name: 'SystemOpLog',
    component: () => import('@/views/system/OperationLogView.vue'),
    meta: { title: '操作日志', group: '系统设置' },
  },
]

function cloneEnterpriseRoutes(routes: RouteRecordRaw[]): RouteRecordRaw[] {
  return routes.map((route) => ({
    ...route,
    name: route.name ? `Enterprise${String(route.name)}` : undefined,
    meta: { ...route.meta, portal: 'enterprise' },
  }))
}

/** 旧「通用培训」独立路由 → 合并后的培训模块 */
const platformCommonTrainingRedirects: RouteRecordRaw[] = [
  { path: 'training/common/materials', redirect: '/training/materials' },
  { path: 'training/common/courses', redirect: '/training/courses' },
  { path: 'training/common/exams', redirect: '/training/exams' },
  { path: 'training/common/progress', redirect: '/training/progress' },
  { path: 'training/common/exam-results', redirect: '/training/exam-results' },
]

const platformSharedOpsRoutes = sharedOpsRoutes.filter(
  (route) => route.path !== 'employees' && route.path !== 'employees/:id',
)

const platformChildren: RouteRecordRaw[] = [
  {
    path: 'dashboard',
    name: 'Dashboard',
    component: () => import('@/views/DashboardView.vue'),
    meta: { title: '工作台', portal: 'platform' },
  },
  {
    path: 'enterprises',
    name: 'Enterprises',
    component: () => import('@/views/enterprise-mgmt/EnterpriseList.vue'),
    meta: { title: '企业列表', group: '企业管理', portal: 'platform' },
  },
  {
    path: 'enterprises/create',
    name: 'EnterpriseCreate',
    component: () => import('@/views/enterprise-mgmt/EnterpriseFormView.vue'),
    meta: { title: '新增企业', group: '企业管理', hidden: true, portal: 'platform' },
  },
  {
    path: 'enterprises/:id/edit',
    name: 'EnterpriseEdit',
    component: () => import('@/views/enterprise-mgmt/EnterpriseFormView.vue'),
    meta: { title: '编辑企业', group: '企业管理', hidden: true, portal: 'platform' },
  },
  {
    path: 'enterprises/:id/authorize',
    name: 'EnterpriseAuthorize',
    component: () => import('@/views/enterprise-mgmt/EnterpriseAuthorizeView.vue'),
    meta: { title: '企业授权', group: '企业管理', hidden: true, portal: 'platform' },
  },
  {
    path: 'enterprises/:id',
    name: 'EnterpriseDetail',
    component: () => import('@/views/enterprise-mgmt/EnterpriseDetailView.vue'),
    meta: { title: '企业详情', group: '企业管理', hidden: true, portal: 'platform' },
  },
  {
    path: 'settlement-prices',
    name: 'SettlementPrices',
    component: () => import('@/views/platform/SettlementPriceListView.vue'),
    meta: { title: '结算价管理', group: '企业管理', portal: 'platform' },
  },
  {
    path: 'settlement-prices/:enterpriseId',
    name: 'SettlementPriceDetail',
    component: () => import('@/views/platform/SettlementPriceDetailView.vue'),
    meta: { title: '结算价配置', group: '企业管理', hidden: true, portal: 'platform' },
  },
  {
    path: 'contracts',
    name: 'Contracts',
    component: () => import('@/views/platform/ContractListView.vue'),
    meta: { title: '合同管理', group: '企业管理', portal: 'platform' },
  },
  {
    path: 'contracts/create',
    name: 'ContractCreate',
    component: () => import('@/views/platform/ContractFormView.vue'),
    meta: { title: '新增合同', group: '企业管理', hidden: true, portal: 'platform' },
  },
  {
    path: 'contracts/:id/edit',
    name: 'ContractEdit',
    component: () => import('@/views/platform/ContractFormView.vue'),
    meta: { title: '编辑合同', group: '企业管理', hidden: true, portal: 'platform' },
  },
  {
    path: 'contracts/:id/renew',
    name: 'ContractRenew',
    component: () => import('@/views/platform/ContractFormView.vue'),
    meta: { title: '续约合同', group: '企业管理', hidden: true, portal: 'platform' },
  },
  {
    path: 'contracts/:id',
    name: 'ContractDetail',
    component: () => import('@/views/platform/ContractDetailView.vue'),
    meta: { title: '合同详情', group: '企业管理', hidden: true, portal: 'platform' },
  },
  {
    path: 'worker-agreements',
    name: 'WorkerAgreements',
    component: () => import('@/views/personnel/WorkerAgreementManageView.vue'),
    meta: { title: '合同管理', group: '人员管理', portal: 'platform' },
  },
  {
    path: 'task-workflows',
    name: 'TaskWorkflows',
    component: () => import('@/views/task/WorkflowList.vue'),
    meta: { title: '任务流程配置', group: '任务管理', portal: 'platform' },
  },
  {
    path: 'task-workflows/create',
    name: 'TaskWorkflowCreate',
    component: () => import('@/views/task/WorkflowFormView.vue'),
    meta: { title: '新增工作流', group: '任务管理', hidden: true, portal: 'platform' },
  },
  {
    path: 'task-workflows/:id/edit',
    name: 'TaskWorkflowEdit',
    component: () => import('@/views/task/WorkflowFormView.vue'),
    meta: { title: '编辑工作流', group: '任务管理', hidden: true, portal: 'platform' },
  },
  {
    path: 'task-approval',
    name: 'TaskApproval',
    component: () => import('@/views/task/TaskApproval.vue'),
    meta: { title: '任务审批', group: '任务管理', portal: 'platform' },
  },
  {
    path: 'task-type-approval',
    redirect: '/task-approval',
  },
  {
    path: 'task-types/:id',
    name: 'TaskTypeDetail',
    component: () => import('@/views/task/TaskTypeDetailView.vue'),
    meta: { title: '任务类型详情', group: '任务管理', hidden: true, portal: 'platform' },
  },
  {
    path: 'task-manage',
    name: 'TaskManage',
    component: () => import('@/views/task/TaskManage.vue'),
    meta: { title: '任务管理', group: '任务管理', portal: 'platform' },
  },
  {
    path: 'task-instances/:id',
    name: 'TaskInstanceDetail',
    component: () => import('@/views/task/TaskInstanceDetailView.vue'),
    meta: { title: '认领详情', group: '任务管理', hidden: true, portal: 'platform' },
  },
  {
    path: 'service-providers',
    name: 'ServiceProviders',
    component: () => import('@/views/platform/ServiceProviderListView.vue'),
    meta: { title: '服务商列表', group: '服务商管理', portal: 'platform' },
  },
  {
    path: 'service-providers/create',
    name: 'ServiceProviderCreate',
    component: () => import('@/views/platform/ServiceProviderFormView.vue'),
    meta: { title: '新增服务商', group: '服务商管理', hidden: true, portal: 'platform' },
  },
  {
    path: 'service-providers/:id/edit',
    name: 'ServiceProviderEdit',
    component: () => import('@/views/platform/ServiceProviderFormView.vue'),
    meta: { title: '编辑服务商', group: '服务商管理', hidden: true, portal: 'platform' },
  },
  {
    path: 'service-providers/:id',
    name: 'ServiceProviderDetail',
    component: () => import('@/views/platform/ServiceProviderFormView.vue'),
    meta: { title: '服务商详情', group: '服务商管理', hidden: true, portal: 'platform' },
  },
  {
    path: 'employees',
    name: 'PlatformEmployees',
    component: () => import('@/views/platform/EnterpriseWorkforceListView.vue'),
    meta: { title: '人员管理', group: '人员管理', portal: 'platform' },
  },
  {
    path: 'employees/org/:enterpriseId',
    name: 'PlatformEnterpriseOrg',
    component: () => import('@/views/employee/EmployeeList.vue'),
    meta: { title: '组织架构', group: '人员管理', hidden: true, portal: 'platform' },
  },
  {
    path: 'employees/org/:enterpriseId/:id',
    name: 'PlatformEmployeeDetail',
    component: () => import('@/views/employee/EmployeeDetailView.vue'),
    meta: { title: '查看详情', group: '人员管理', hidden: true, portal: 'platform' },
  },
  ...platformSharedOpsRoutes.map((r) => ({ ...r, meta: { ...r.meta, portal: 'platform' } })),
  {
    path: 'system/reminder-rules',
    name: 'ReminderRules',
    component: () => import('@/views/system/ReminderRuleListView.vue'),
    meta: { title: '提醒规则配置', group: '系统设置', portal: 'platform' },
  },
  {
    path: 'system/reminder-rules/create',
    name: 'ReminderRuleCreate',
    component: () => import('@/views/system/ReminderRuleFormView.vue'),
    meta: { title: '新建提醒规则', group: '系统设置', hidden: true, portal: 'platform' },
  },
  {
    path: 'system/reminder-rules/:id/edit',
    name: 'ReminderRuleEdit',
    component: () => import('@/views/system/ReminderRuleFormView.vue'),
    meta: { title: '编辑提醒规则', group: '系统设置', hidden: true, portal: 'platform' },
  },
  ...platformCommonTrainingRedirects,
  {
    path: 'payroll/bills',
    name: 'PayrollBills',
    component: () => import('@/views/payroll/BillManageView.vue'),
    meta: { title: '账单管理', group: '财税管理', portal: 'platform' },
  },
  {
    path: 'payroll/import-templates',
    name: 'PayrollBillImportTemplatesPlatform',
    component: () => import('@/views/payroll/BillImportTemplateListView.vue'),
    meta: { title: '账单导入模板', group: '财税管理', portal: 'platform' },
  },
  {
    path: 'payroll/bills/:id',
    name: 'PayrollBillDetail',
    component: () => import('@/views/payroll/BillDetailView.vue'),
    meta: { title: '账单详情', group: '财税管理', portal: 'platform' },
  },
  {
    path: 'payroll/settlement',
    name: 'PayrollSettlement',
    component: () => import('@/views/payroll/SettlementOverviewView.vue'),
    meta: { title: '发薪管理', group: '财税管理', portal: 'platform' },
  },
  {
    path: 'payroll/settlement/import',
    name: 'PayrollImport',
    component: () => import('@/views/payroll/PayrollImportView.vue'),
    meta: { title: '导入发薪', group: '财税管理', hidden: true, portal: 'platform' },
  },
  {
    path: 'payroll/settlement/import/confirm',
    name: 'PayrollImportConfirm',
    component: () => import('@/views/payroll/PayrollImportConfirmView.vue'),
    meta: { title: '确认导入发薪', group: '财税管理', hidden: true, portal: 'platform' },
  },
  {
    path: 'payroll/settlement/slip/:id',
    name: 'PayrollSettlementSlipDetail',
    component: () => import('@/views/payroll/SettlementManageDetailView.vue'),
    meta: { title: '结算单详情', group: '财税管理', hidden: true, portal: 'platform' },
  },
  {
    path: 'payroll/funds',
    name: 'PayrollFunds',
    component: () => import('@/views/payroll/FundManageView.vue'),
    meta: { title: '资金管理', group: '财税管理', portal: 'platform' },
  },
  {
    path: 'payroll/tax',
    name: 'PayrollTax',
    component: () => import('@/views/payroll/TaxManageView.vue'),
    meta: { title: '个税管理', group: '财税管理', portal: 'platform' },
  },
  {
    path: 'payroll/invoices',
    name: 'PayrollInvoices',
    component: () => import('@/views/payroll/InvoiceManageView.vue'),
    meta: { title: '发票管理', group: '财税管理', portal: 'platform' },
  },
  {
    path: 'payroll/invoices/apply',
    name: 'PayrollInvoiceApply',
    component: () => import('@/views/payroll/InvoiceApplyView.vue'),
    meta: { title: '申请开票', group: '财税管理', hidden: true, portal: 'platform' },
  },
  {
    path: 'payroll/invoices/:id',
    name: 'PayrollInvoiceDetail',
    component: () => import('@/views/payroll/InvoiceApplyView.vue'),
    meta: { title: '发票详情', group: '财税管理', hidden: true, portal: 'platform' },
  },
  {
    path: 'statistics/overview',
    name: 'StatsOverview',
    component: () => import('@/views/statistics/OverviewStatsView.vue'),
    meta: { title: '概览看板', group: '数据统计', portal: 'platform' },
  },
  {
    path: 'statistics/recruitment',
    name: 'StatsRecruitment',
    component: () => import('@/views/statistics/RecruitmentStatsView.vue'),
    meta: { title: '招聘统计', group: '数据统计', portal: 'platform' },
  },
  {
    path: 'statistics/attendance',
    name: 'StatsAttendance',
    component: () => import('@/views/statistics/AttendanceStatsView.vue'),
    meta: { title: '考勤统计', group: '数据统计', portal: 'platform' },
  },
  {
    path: 'statistics/task',
    name: 'StatsTask',
    component: () => import('@/views/statistics/TaskStatsView.vue'),
    meta: { title: '任务统计', group: '数据统计', portal: 'platform' },
  },
  {
    path: 'statistics/settlement',
    name: 'StatsSettlement',
    component: () => import('@/views/statistics/SettlementStatsView.vue'),
    meta: { title: '结算统计', group: '数据统计', portal: 'platform' },
  },
]

const enterpriseChildren: RouteRecordRaw[] = [
  {
    path: 'dashboard',
    name: 'EnterpriseDashboard',
    component: () => import('@/views/DashboardView.vue'),
    meta: { title: '工作台', portal: 'enterprise' },
  },
  {
    path: 'task/types',
    redirect: '/enterprise/task/publish',
  },
  {
    path: 'task/publish',
    name: 'EnterpriseTaskPublish',
    component: () => import('@/views/enterprise/TaskPublish.vue'),
    meta: { title: '任务发布', group: '任务管理', portal: 'enterprise' },
  },
    {
      path: 'task/progress',
      name: 'EnterpriseTaskProgress',
      component: () => import('@/views/enterprise/TaskProgress.vue'),
      meta: { title: '任务进度', group: '任务管理', portal: 'enterprise' },
    },
    {
      path: 'task/acceptance',
      redirect: '/enterprise/task/progress',
    },
  {
    path: 'task/instances/:id',
    name: 'EnterpriseTaskInstanceDetail',
    component: () => import('@/views/task/TaskInstanceDetailView.vue'),
    meta: { title: '认领详情', group: '任务管理', hidden: true, portal: 'enterprise' },
  },
  {
    path: 'contracts',
    name: 'EnterpriseContracts',
    component: () => import('@/views/enterprise-mgmt/ContractList.vue'),
    meta: { title: '合同管理', group: '人员管理', portal: 'enterprise' },
  },
  {
    path: 'partnership',
    name: 'EnterprisePartnership',
    component: () => import('@/views/partnership/PartnershipManageView.vue'),
    meta: { title: '服务商合作', group: '合作管理', portal: 'enterprise' },
  },
  ...cloneEnterpriseRoutes(sharedOpsRoutes),
  {
    path: 'payroll/bills',
    name: 'EnterprisePayrollBills',
    component: () => import('@/views/payroll/BillManageView.vue'),
    meta: { title: '账单确认', group: '财税管理', portal: 'enterprise' },
  },
  {
    path: 'payroll/bills/:id',
    name: 'EnterprisePayrollBillDetail',
    component: () => import('@/views/payroll/BillDetailView.vue'),
    meta: { title: '账单详情', group: '财税管理', portal: 'enterprise' },
  },
  {
    path: 'payroll/invoices',
    name: 'EnterprisePayrollInvoices',
    component: () => import('@/views/payroll/InvoiceManageView.vue'),
    meta: { title: '发票管理', group: '财税管理', portal: 'enterprise' },
  },
  {
    path: 'payroll/invoices/apply',
    name: 'EnterprisePayrollInvoiceApply',
    component: () => import('@/views/payroll/InvoiceApplyView.vue'),
    meta: { title: '申请开票', group: '财税管理', hidden: true, portal: 'enterprise' },
  },
  {
    path: 'payroll/invoices/:id',
    name: 'EnterprisePayrollInvoiceDetail',
    component: () => import('@/views/payroll/InvoiceApplyView.vue'),
    meta: { title: '发票详情', group: '财税管理', hidden: true, portal: 'enterprise' },
  },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/portals',
      name: 'Portals',
      component: () => import('@/views/portal/PortalHomeView.vue'),
      meta: { title: '三端入口' },
    },
    {
      path: '/',
      component: PlatformLayout,
      redirect: '/dashboard',
      children: platformChildren,
    },
    {
      path: '/enterprise',
      component: EnterpriseLayout,
      redirect: '/enterprise/dashboard',
      children: enterpriseChildren,
    },
    {
      path: '/bi/monitor',
      name: 'WorkforceMonitor',
      component: () => import('@/views/statistics/WorkforceMonitorView.vue'),
      meta: { title: '灵工人员数据监控中心', portal: 'platform' },
    },
    {
      path: '/punch',
      name: 'WebPunch',
      component: () => import('@/views/attendance/PunchView.vue'),
      meta: { title: '网页打卡' },
    },
    {
      path: '/miniapp',
      component: () => import('@/layouts/MiniAppLayout.vue'),
      redirect: '/miniapp/workbench',
      children: [
        {
          path: 'login',
          name: 'MiniLogin',
          component: () => import('@/views/miniapp/MiniLoginView.vue'),
          meta: { title: '登录', miniTab: false, miniPublic: true },
        },
        {
          path: 'register',
          name: 'MiniRegister',
          component: () => import('@/views/miniapp/MiniRegisterView.vue'),
          meta: { title: '注册', miniTab: false, miniPublic: true },
        },
        {
          path: 'onboarding',
          name: 'MiniOnboarding',
          component: () => import('@/views/miniapp/MiniOnboardingView.vue'),
          meta: { title: '完善档案', miniTab: false, miniOnboarding: true },
        },
        {
          path: 'workbench',
          name: 'MiniWorkbench',
          component: () => import('@/views/miniapp/MiniWorkbenchView.vue'),
          meta: { title: '工作台', miniTab: true },
        },
        {
          path: 'schedule',
          name: 'MiniSchedule',
          component: () => import('@/views/miniapp/MiniScheduleCalendarView.vue'),
          meta: { title: '排班日历', miniTab: false },
        },
        {
          path: 'schedule/history',
          name: 'MiniPunchHistory',
          component: () => import('@/views/miniapp/MiniPunchHistoryView.vue'),
          meta: { title: '历史打卡', miniTab: false },
        },
        {
          path: 'schedule/exceptions',
          name: 'MiniExceptionRecords',
          component: () => import('@/views/miniapp/MiniExceptionRecordsView.vue'),
          meta: { title: '异常申请记录', miniTab: false },
        },
        {
          path: 'schedule/makeup/apply',
          name: 'MiniMakeupApply',
          component: () => import('@/views/miniapp/MiniMakeupApplyView.vue'),
          meta: { title: '申请补卡', miniTab: false },
        },
        {
          path: 'schedule/makeup/:id',
          name: 'MiniMakeupDetail',
          component: () => import('@/views/miniapp/MiniMakeupDetailView.vue'),
          meta: { title: '补卡申请详情', miniTab: false },
        },
        {
          path: 'punch',
          name: 'MiniPunch',
          component: () => import('@/views/miniapp/MiniPunchView.vue'),
          meta: { title: '打卡', miniTab: false },
        },
        {
          path: 'recommend',
          name: 'MiniRecommend',
          component: () => import('@/views/miniapp/MiniRecommendView.vue'),
          meta: { title: '推荐', miniTab: true },
        },
        {
          path: 'task-hall',
          name: 'MiniTaskHall',
          component: () => import('@/views/miniapp/MiniTaskHallView.vue'),
          meta: { title: '任务大厅', miniTab: true },
        },
        {
          path: 'recommend/job/:id',
          name: 'MiniJobDetail',
          component: () => import('@/views/miniapp/MiniJobDetailView.vue'),
          meta: { title: '岗位详情', miniTab: false },
        },
        {
          path: 'recommend/shift/:teamId',
          name: 'MiniGrabShiftDetail',
          component: () => import('@/views/miniapp/MiniGrabShiftDetailView.vue'),
          meta: { title: '抢班详情', miniTab: false },
        },
        {
          path: 'task-hall/enterprise/:enterpriseId/tasks',
          name: 'MiniTaskEnterprise',
          component: () => import('@/views/miniapp/MiniTaskEnterpriseView.vue'),
          meta: { title: '企业任务', miniTab: false },
        },
        {
          path: 'task-hall/task/:taskId/claim',
          name: 'MiniTaskClaim',
          component: () => import('@/views/miniapp/MiniTaskClaimView.vue'),
          meta: { title: '领取任务', miniTab: false },
        },
        {
          path: 'task-hall/task/:taskId',
          name: 'MiniTaskDetail',
          component: () => import('@/views/miniapp/MiniTaskDetailView.vue'),
          meta: { title: '任务详情', miniTab: false },
        },
        {
          path: 'recommend/enterprise/:enterpriseId/tasks',
          redirect: (to) => ({
            path: `/miniapp/task-hall/enterprise/${String(to.params.enterpriseId)}/tasks`,
            query: to.query,
          }),
        },
        {
          path: 'recommend/task/:taskId/claim',
          redirect: (to) => `/miniapp/task-hall/task/${String(to.params.taskId)}/claim`,
        },
        {
          path: 'recommend/task/:taskId',
          redirect: (to) => `/miniapp/task-hall/task/${String(to.params.taskId)}`,
        },
        {
          path: 'messages',
          name: 'MiniMessages',
          component: () => import('@/views/miniapp/MiniMessagesView.vue'),
          meta: { title: '消息', miniTab: true },
        },
        {
          path: 'messages/:id',
          name: 'MiniMessageDetail',
          component: () => import('@/views/miniapp/MiniMessageDetailView.vue'),
          meta: { title: '消息详情', miniTab: false },
        },
        {
          path: 'profile',
          name: 'MiniProfile',
          component: () => import('@/views/miniapp/MiniProfileView.vue'),
          meta: { title: '我的', miniTab: true },
        },
        {
          path: 'income',
          name: 'MiniIncome',
          component: () => import('@/views/miniapp/MiniIncomeView.vue'),
          meta: { title: '我的收入', miniTab: false },
        },
        {
          path: 'applications',
          name: 'MiniApplications',
          component: () => import('@/views/miniapp/MiniApplicationsView.vue'),
          meta: { title: '我的报名', miniTab: false },
        },
        {
          path: 'applications/job/:id',
          name: 'MiniJobApplicationDetail',
          component: () => import('@/views/miniapp/MiniJobApplicationDetailView.vue'),
          meta: { title: '岗位报名详情', miniTab: false },
        },
        {
          path: 'applications/shift/:id',
          name: 'MiniGrabShiftApplicationDetail',
          component: () => import('@/views/miniapp/MiniGrabShiftApplicationDetailView.vue'),
          meta: { title: '抢班报名详情', miniTab: false },
        },
        {
          path: 'training',
          name: 'MiniTraining',
          component: () => import('@/views/miniapp/MiniTrainingView.vue'),
          meta: { title: '培训管理', miniTab: false },
        },
        {
          path: 'training/materials',
          name: 'MiniTrainingMaterials',
          component: () => import('@/views/miniapp/MiniTrainingMaterialsView.vue'),
          meta: { title: '我的培训', miniTab: false },
        },
        {
          path: 'training/learn/:courseId/:materialId',
          name: 'MiniTrainingLearn',
          component: () => import('@/views/miniapp/MiniTrainingLearnView.vue'),
          meta: { title: '学习', miniTab: false },
        },
        {
          path: 'training/exams',
          name: 'MiniExamStatus',
          component: () => import('@/views/miniapp/MiniExamStatusView.vue'),
          meta: { title: '我的考核', miniTab: false },
        },
        {
          path: 'training/exam/:courseId',
          name: 'MiniExamTake',
          component: () => import('@/views/miniapp/MiniExamTakeView.vue'),
          meta: { title: '在线考核', miniTab: false },
        },
        {
          path: 'training/exam/:courseId/review/:attemptId',
          name: 'MiniExamReview',
          component: () => import('@/views/miniapp/MiniExamReviewView.vue'),
          meta: { title: '答题解析', miniTab: false },
        },
        {
          path: 'tasks',
          name: 'MiniTaskProgress',
          component: () => import('@/views/miniapp/MiniTaskProgressView.vue'),
          meta: { title: '任务进度', miniTab: false },
        },
        {
          path: 'tasks/:instanceId',
          name: 'MiniTaskInstance',
          component: () => import('@/views/miniapp/MiniTaskInstanceView.vue'),
          meta: { title: '任务详情', miniTab: false },
        },
        {
          path: 'payment',
          name: 'MiniPayment',
          component: () => import('@/views/miniapp/MiniPaymentView.vue'),
          meta: { title: '收款绑定', miniTab: false },
        },
        {
          path: 'agreements',
          name: 'MiniAgreements',
          component: () => import('@/views/miniapp/MiniAgreementsView.vue'),
          meta: { title: '协议管理', miniTab: false },
        },
        {
          path: 'worker-archive',
          name: 'MiniWorkerArchive',
          component: () => import('@/views/miniapp/MiniWorkerArchiveView.vue'),
          meta: { title: '灵工档案', miniTab: false },
        },
        {
          path: 'worker-archive/basic',
          name: 'MiniArchiveBasic',
          component: () => import('@/views/miniapp/MiniArchiveBasicView.vue'),
          meta: { title: '基本信息', miniTab: false },
        },
        {
          path: 'worker-archive/schedule-pref',
          name: 'MiniSchedulePreference',
          component: () => import('@/views/miniapp/MiniSchedulePreferenceView.vue'),
          meta: { title: '排班偏好', miniTab: false },
        },
        {
          path: 'worker-archive/schedule-pref/:id',
          name: 'MiniSchedulePreferenceForm',
          component: () => import('@/views/miniapp/MiniSchedulePreferenceFormView.vue'),
          meta: { title: '排班偏好', miniTab: false },
        },
        {
          path: 'worker-archive/job-pref',
          name: 'MiniJobPreference',
          component: () => import('@/views/miniapp/MiniJobPreferenceView.vue'),
          meta: { title: '岗位偏好', miniTab: false },
        },
        {
          path: 'worker-archive/skill-certs',
          name: 'MiniSkillCertEdit',
          component: () => import('@/views/miniapp/MiniSkillCertEditView.vue'),
          meta: { title: '技能证书', miniTab: false },
        },
        {
          path: 'my-info',
          name: 'MiniMyInfo',
          redirect: '/miniapp/worker-archive',
        },
        {
          path: 'insurance',
          name: 'MiniInsurance',
          component: () => import('@/views/miniapp/MiniInsuranceDetailView.vue'),
          meta: { title: '投保详情', miniTab: false },
        },
        {
          path: 'face-verify',
          name: 'MiniFaceVerify',
          component: () => import('@/views/miniapp/MiniFaceVerifyView.vue'),
          meta: { title: '真人核验', miniTab: false },
        },
        {
          path: 'face-verify/capture',
          name: 'MiniFaceCapture',
          component: () => import('@/views/miniapp/MiniFaceCaptureView.vue'),
          meta: { title: '人脸识别', miniTab: false, miniOnboarding: true },
        },
        {
          path: 'part-time-pref',
          name: 'MiniPartTimePreference',
          component: () => import('@/views/miniapp/MiniPartTimePreferenceView.vue'),
          meta: { title: '兼职偏好', miniTab: false },
        },
        {
          path: 'credit',
          name: 'MiniCredit',
          component: () => import('@/views/miniapp/MiniCreditView.vue'),
          meta: { title: '等级信用', miniTab: false, hidden: true },
        },
      ],
    },
    {
      path: '/enterprise-miniapp',
      component: () => import('@/layouts/EnterpriseMiniAppLayout.vue'),
      redirect: '/enterprise-miniapp/recruitment',
      children: [
        {
          path: 'login',
          name: 'EntMiniLogin',
          component: () => import('@/views/enterprise-miniapp/EntMiniLoginView.vue'),
          meta: { title: '登录', entMiniTab: false, entMiniPublic: true },
        },
        {
          path: 'workbench',
          redirect: '/enterprise-miniapp/recruitment',
        },
        {
          path: 'recruitment',
          name: 'EntMiniRecruitment',
          component: () => import('@/views/enterprise-miniapp/EntMiniRecruitmentView.vue'),
          meta: { title: '招聘', entMiniTab: true },
        },
        {
          path: 'recruitment/publish',
          name: 'EntMiniPublish',
          component: () => import('@/views/enterprise-miniapp/EntMiniPublishView.vue'),
          meta: { title: '发布招聘', entMiniTab: false },
        },
        {
          path: 'recruitment/jobs',
          name: 'EntMiniJobRequirements',
          component: () => import('@/views/enterprise-miniapp/EntMiniJobRequirementsView.vue'),
          meta: { title: '岗位需求', entMiniTab: false },
        },
        {
          path: 'recruitment/leads',
          name: 'EntMiniRecruitLeads',
          component: () => import('@/views/enterprise-miniapp/EntMiniRecruitLeadsView.vue'),
          meta: { title: '招聘线索', entMiniTab: false },
        },
        {
          path: 'recruitment/progress',
          name: 'EntMiniProgress',
          component: () => import('@/views/enterprise-miniapp/EntMiniProgressView.vue'),
          meta: { title: '招聘进度', entMiniTab: false },
        },
        {
          path: 'recruitment/interview',
          name: 'EntMiniInterview',
          component: () => import('@/views/enterprise-miniapp/EntMiniInterviewView.vue'),
          meta: { title: '面试进度', entMiniTab: false },
        },
        {
          path: 'recruitment/qual',
          name: 'EntMiniQual',
          component: () => import('@/views/enterprise-miniapp/EntMiniQualView.vue'),
          meta: { title: '资质审核', entMiniTab: false },
        },
        {
          path: 'attendance',
          name: 'EntMiniAttendance',
          component: () => import('@/views/enterprise-miniapp/EntMiniAttendanceView.vue'),
          meta: { title: '出勤', entMiniTab: true },
        },
        {
          path: 'today-schedule',
          name: 'EntMiniTodaySchedule',
          component: () => import('@/views/enterprise-miniapp/EntMiniTodayScheduleView.vue'),
          meta: { title: '今日排班', entMiniTab: false },
        },
        {
          path: 'tasks',
          name: 'EntMiniTasks',
          component: () => import('@/views/enterprise-miniapp/EntMiniTasksView.vue'),
          meta: { title: '任务管理', entMiniTab: true },
        },
        {
          path: 'stats',
          name: 'EntMiniStats',
          component: () => import('@/views/enterprise-miniapp/EntMiniStatsView.vue'),
          meta: { title: '统计', entMiniTab: true },
        },
        {
          path: 'messages',
          name: 'EntMiniMessages',
          component: () => import('@/views/enterprise-miniapp/EntMiniMessagesView.vue'),
          meta: { title: '消息', entMiniTab: false },
        },
        {
          path: 'schedule',
          name: 'EntMiniSchedule',
          component: () => import('@/views/enterprise-miniapp/EntMiniScheduleView.vue'),
          meta: { title: '划线排班', entMiniTab: false },
        },
        {
          path: 'exceptions',
          name: 'EntMiniExceptions',
          component: () => import('@/views/enterprise-miniapp/EntMiniExceptionView.vue'),
          meta: { title: '考勤审批', entMiniTab: false },
        },
        {
          path: 'punch-records',
          name: 'EntMiniPunchRecords',
          component: () => import('@/views/enterprise-miniapp/EntMiniPunchRecordsView.vue'),
          meta: { title: '班次人员打卡记录', entMiniTab: false },
        },
        {
          path: 'hours-confirm',
          name: 'EntMiniHoursConfirm',
          component: () => import('@/views/enterprise-miniapp/EntMiniHoursConfirmView.vue'),
          meta: { title: '工时确认', entMiniTab: false },
        },
        {
          path: 'hours',
          name: 'EntMiniHours',
          component: () => import('@/views/enterprise-miniapp/EntMiniHoursView.vue'),
          meta: { title: '工时确认记录', entMiniTab: false },
        },
        {
          path: 'personnel',
          name: 'EntMiniPersonnel',
          component: () => import('@/views/enterprise-miniapp/EntMiniPersonnelView.vue'),
          meta: { title: '人员管理', entMiniTab: false },
        },
        {
          path: 'onboard',
          name: 'EntMiniOnboard',
          component: () => import('@/views/enterprise-miniapp/EntMiniOnboardView.vue'),
          meta: { title: '入驻管理', entMiniTab: false },
        },
        {
          path: 'shift-demand',
          name: 'EntMiniShiftDemand',
          component: () => import('@/views/enterprise-miniapp/EntMiniShiftDemandView.vue'),
          meta: { title: '需求总览', entMiniTab: false },
        },
        {
          path: 'grab-manage',
          name: 'EntMiniGrabManage',
          component: () => import('@/views/enterprise-miniapp/EntMiniGrabShiftView.vue'),
          meta: { title: '抢班管理', entMiniTab: false },
        },
        {
          path: 'grab-interview',
          name: 'EntMiniGrabInterview',
          component: () => import('@/views/enterprise-miniapp/EntMiniGrabInterviewView.vue'),
          meta: { title: '抢班面试配置', entMiniTab: false },
        },
        {
          path: 'grab',
          redirect: '/enterprise-miniapp/grab-manage',
        },
        {
          path: 'profile',
          name: 'EntMiniProfile',
          component: () => import('@/views/enterprise-miniapp/EntMiniProfileView.vue'),
          meta: { title: '我的', entMiniTab: true },
        },
      ],
    },
    // legacy redirects
    { path: '/partnership', redirect: '/enterprise/partnership' },
    { path: '/enterprise/task-types', redirect: '/enterprise/task/publish' },
    { path: '/enterprise/task-publish', redirect: '/enterprise/task/publish' },
    { path: '/enterprise/task-acceptance', redirect: '/enterprise/task/progress' },
    { path: '/enterprise/task-progress', redirect: '/enterprise/task/progress' },
    { path: '/statistics', redirect: '/statistics/overview' },
    { path: '/payroll', redirect: '/payroll/bills' },
  ],
})

router.beforeEach((to) => {
  if (to.path.startsWith('/enterprise-miniapp')) {
    const isPublic = to.meta.entMiniPublic === true
    if (isPublic) {
      if (isEnterpriseMiniAuthed() && to.path === '/enterprise-miniapp/login') {
        return '/enterprise-miniapp/recruitment'
      }
      return true
    }
    if (!isEnterpriseMiniAuthed()) {
      return { path: '/enterprise-miniapp/login', query: { redirect: to.fullPath } }
    }
    return true
  }

  if (!to.path.startsWith('/miniapp')) return true

  const isPublic = to.meta.miniPublic === true

  if (isPublic) {
    if (isMiniAppAuthed() && (to.path === '/miniapp/login' || to.path === '/miniapp/register')) {
      return '/miniapp/workbench'
    }
    return true
  }

  if (!isMiniAppAuthed()) {
    return { path: '/miniapp/login', query: { redirect: to.fullPath } }
  }

  // 已登录即可浏览全部数据；实名/人脸在报名、打卡、领任务等动作时拦截
  return true
})

router.afterEach((to) => {
  const suffix = to.path.startsWith('/enterprise-miniapp')
    ? '企业小程序'
    : to.path.startsWith('/miniapp')
      ? '灵工小程序'
      : to.path.startsWith('/enterprise')
        ? '企业端'
        : to.path.startsWith('/portals')
          ? '多端入口'
          : to.path.startsWith('/bi')
            ? '数据监控'
            : '运营后台'
  document.title = `${to.meta.title ?? '管理后台'} - ${suffix}`
})

export default router
