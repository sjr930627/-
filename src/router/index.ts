import { createRouter, createWebHistory } from 'vue-router'
import AdminLayout from '@/layouts/AdminLayout.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      component: AdminLayout,
      redirect: '/dashboard',
      children: [
        {
          path: 'dashboard',
          name: 'Dashboard',
          component: () => import('@/views/DashboardView.vue'),
          meta: { title: '工作台' },
        },
        {
          path: 'enterprises',
          name: 'Enterprises',
          component: () => import('@/views/enterprise-mgmt/EnterpriseList.vue'),
          meta: { title: '企业管理', group: '企业管理' },
        },
        {
          path: 'partnership',
          name: 'Partnership',
          component: () => import('@/views/partnership/PartnershipManageView.vue'),
          meta: { title: '服务商合作', group: '合作管理' },
        },
        {
          path: 'contracts',
          redirect: '/partnership',
          meta: { title: '合同管理', group: '人员考勤管理' },
        },
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
          path: 'recruitment/training/materials',
          redirect: '/training/materials',
        },
        {
          path: 'recruitment/training/courses',
          redirect: '/training/courses',
        },
        {
          path: 'recruitment/training/exams',
          redirect: '/training/exams',
        },
        {
          path: 'recruitment/training/progress',
          redirect: '/training/progress',
        },
        {
          path: 'recruitment/training/exam-results',
          redirect: '/training/exam-results',
        },
        {
          path: 'departments',
          name: 'Departments',
          component: () => import('@/views/department/DepartmentList.vue'),
          meta: { title: '部门管理', group: '人员考勤管理' },
        },
        {
          path: 'teams',
          name: 'Teams',
          component: () => import('@/views/team/TeamList.vue'),
          meta: { title: '考勤组管理' },
        },
        {
          path: 'employees',
          name: 'Employees',
          component: () => import('@/views/employee/EmployeeList.vue'),
          meta: { title: '人员管理', group: '人员考勤管理' },
        },
        {
          path: 'shifts',
          name: 'Shifts',
          component: () => import('@/views/shift/ShiftList.vue'),
          meta: { title: '班次管理' },
        },
        {
          path: 'holidays',
          name: 'Holidays',
          component: () => import('@/views/holiday/HolidayList.vue'),
          meta: { title: '假日管理' },
        },
        {
          path: 'schedule-rules',
          redirect: (to) => ({
            path: '/schedule-manage',
            query: { group: to.query.group ?? 'ag_factory', tab: 'rule' },
          }),
        },
        {
          path: 'schedule-manage',
          name: 'ScheduleManage',
          component: () => import('@/views/schedule/ScheduleManageView.vue'),
          meta: { title: '排班管理', group: '人员考勤管理' },
        },
        {
          path: 'grab-shifts',
          name: 'GrabShifts',
          component: () => import('@/views/schedule/GrabShiftManageView.vue'),
          meta: { title: '抢班管理', group: '人员考勤管理' },
        },
        {
          path: 'schedule-manage/person',
          redirect: '/schedule-manage',
        },
        {
          path: 'schedule-manage/line',
          redirect: '/schedule-manage',
        },
        {
          path: 'schedule',
          redirect: (to) => ({
            path: '/schedule-manage',
            query: { group: 'ag_factory', tab: 'board', ...to.query },
          }),
        },
        {
          path: 'smart-schedule',
          redirect: (to) => ({
            path: '/schedule-manage',
            query: { group: to.query.group ?? 'ag_factory' },
          }),
        },
        {
          path: 'schedule-publish',
          name: 'SchedulePublish',
          component: () => import('@/views/schedule/SchedulePublish.vue'),
          meta: { title: '排班发布', group: '人员考勤管理' },
        },
        {
          path: 'attendance',
          name: 'AttendanceRecords',
          component: () => import('@/views/attendance/AttendanceRecords.vue'),
          meta: { title: '考勤打卡' },
        },
        {
          path: 'attendance-data',
          name: 'AttendanceData',
          component: () => import('@/views/attendance/AttendanceDataView.vue'),
          meta: { title: '考勤记录', group: '人员考勤管理' },
        },
        {
          path: 'attendance-daily',
          redirect: (to) => ({ path: '/attendance-data', query: { tab: 'daily', ...to.query } }),
        },
        {
          path: 'attendance-monthly',
          redirect: (to) => ({ path: '/attendance-data', query: { tab: 'monthly', ...to.query } }),
        },
        {
          path: 'attendance-groups',
          name: 'AttendanceGroups',
          component: () => import('@/views/attendance/AttendanceGroupList.vue'),
          meta: { title: '考勤规则', group: '人员考勤管理' },
        },
        {
          path: 'attendance-groups/create',
          name: 'AttendanceGroupCreate',
          component: () => import('@/views/attendance/AttendanceGroupForm.vue'),
          meta: { title: '新建考勤组', group: '人员考勤管理' },
        },
        {
          path: 'attendance-groups/:id/edit',
          name: 'AttendanceGroupEdit',
          component: () => import('@/views/attendance/AttendanceGroupForm.vue'),
          meta: { title: '编辑考勤组', group: '人员考勤管理' },
        },
        {
          path: 'attendance-rules',
          redirect: '/attendance-groups',
        },
        {
          path: 'attendance-exceptions',
          name: 'AttendanceExceptions',
          component: () => import('@/views/attendance/ExceptionList.vue'),
          meta: { title: '考勤异常处理', group: '人员考勤管理' },
        },
        {
          path: 'insurance',
          name: 'InsuranceManage',
          component: () => import('@/views/insurance/InsuranceManageView.vue'),
          meta: { title: '保险管理', group: '人员考勤管理' },
        },
        {
          path: 'approvals',
          name: 'Approvals',
          component: () => import('@/views/approval/ApprovalCenter.vue'),
          meta: { title: '审批中心' },
        },
        {
          path: 'attendance-report',
          redirect: '/attendance-data?tab=monthly',
        },
        {
          path: 'self-service',
          name: 'SelfService',
          component: () => import('@/views/self/SelfServiceView.vue'),
          meta: { title: '员工自助' },
        },
        {
          path: 'payroll/bills',
          name: 'PayrollBills',
          component: () => import('@/views/payroll/BillManageView.vue'),
          meta: { title: '账单管理', group: '财税管理' },
        },
        {
          path: 'payroll/bills/:id',
          name: 'PayrollBillDetail',
          component: () => import('@/views/payroll/BillDetailView.vue'),
          meta: { title: '账单详情', group: '财税管理' },
        },
        {
          path: 'payroll/billing-rules',
          name: 'PayrollBillingRules',
          component: () => import('@/views/payroll/BillingRuleView.vue'),
          meta: { title: '计薪规则', group: '财税管理' },
        },
        {
          path: 'payroll/settlement',
          name: 'PayrollSettlement',
          component: () => import('@/views/payroll/SettlementOverviewView.vue'),
          meta: { title: '结算管理', group: '财税管理' },
        },
        {
          path: 'payroll/invoices',
          name: 'PayrollInvoices',
          component: () => import('@/views/payroll/InvoiceManageView.vue'),
          meta: { title: '发票管理', group: '财税管理' },
        },
        {
          path: 'statistics/overview',
          name: 'StatsOverview',
          component: () => import('@/views/statistics/OverviewStatsView.vue'),
          meta: { title: '概览看板', group: '数据统计' },
        },
        {
          path: 'statistics/recruitment',
          name: 'StatsRecruitment',
          component: () => import('@/views/statistics/RecruitmentStatsView.vue'),
          meta: { title: '招聘统计', group: '数据统计' },
        },
        {
          path: 'statistics/attendance',
          name: 'StatsAttendance',
          component: () => import('@/views/statistics/AttendanceStatsView.vue'),
          meta: { title: '考勤统计', group: '数据统计' },
        },
        {
          path: 'statistics/task',
          name: 'StatsTask',
          component: () => import('@/views/statistics/TaskStatsView.vue'),
          meta: { title: '任务统计', group: '数据统计' },
        },
        {
          path: 'statistics/settlement',
          name: 'StatsSettlement',
          component: () => import('@/views/statistics/SettlementStatsView.vue'),
          meta: { title: '结算统计', group: '数据统计' },
        },
        {
          path: 'statistics',
          redirect: '/statistics/overview',
        },
        {
          path: 'payroll',
          redirect: '/payroll/bills',
        },
        {
          path: 'analytics',
          redirect: '/statistics/overview',
        },
        {
          path: 'task-workflows',
          name: 'TaskWorkflows',
          component: () => import('@/views/task/WorkflowList.vue'),
          meta: { title: '任务规则配置', group: '任务管理' },
        },
        {
          path: 'task-type-approval',
          name: 'TaskTypeApproval',
          component: () => import('@/views/task/TaskTypeApproval.vue'),
          meta: { title: '任务类型审批', group: '任务管理' },
        },
        {
          path: 'task-manage',
          name: 'TaskManage',
          component: () => import('@/views/task/TaskManage.vue'),
          meta: { title: '任务管理', group: '任务管理' },
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
      ],
    },
    {
      path: '/bi/monitor',
      name: 'WorkforceMonitor',
      component: () => import('@/views/statistics/WorkforceMonitorView.vue'),
      meta: { title: '灵工人员数据监控中心' },
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
          path: 'messages',
          name: 'MiniMessages',
          component: () => import('@/views/miniapp/MiniMessagesView.vue'),
          meta: { title: '消息', miniTab: true },
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
          path: 'training/progress',
          redirect: '/miniapp/training/materials',
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
          path: 'training/exam-results',
          redirect: '/miniapp/training/exams',
        },
        {
          path: 'tasks',
          name: 'MiniTaskProgress',
          component: () => import('@/views/miniapp/MiniTaskProgressView.vue'),
          meta: { title: '任务进度', miniTab: false },
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
          path: 'my-info',
          name: 'MiniMyInfo',
          component: () => import('@/views/miniapp/MiniMyInfoView.vue'),
          meta: { title: '我的资料', miniTab: false },
        },
        {
          path: 'insurance',
          name: 'MiniInsurance',
          component: () => import('@/views/miniapp/MiniInsuranceDetailView.vue'),
          meta: { title: '投保详情', miniTab: false },
        },
        {
          path: 'credit',
          name: 'MiniCredit',
          component: () => import('@/views/miniapp/MiniCreditView.vue'),
          meta: { title: '等级信用', miniTab: false },
        },
      ],
    },
    {
      path: '/enterprise',
      component: () => import('@/layouts/EnterpriseLayout.vue'),
      redirect: '/enterprise/task-types',
      children: [
        {
          path: 'task-types',
          name: 'EnterpriseTaskTypes',
          component: () => import('@/views/enterprise/TaskTypeList.vue'),
          meta: { title: '任务类型管理' },
        },
        {
          path: 'task-publish',
          name: 'EnterpriseTaskPublish',
          component: () => import('@/views/enterprise/TaskPublish.vue'),
          meta: { title: '任务发布' },
        },
        {
          path: 'task-acceptance',
          name: 'EnterpriseTaskAcceptance',
          component: () => import('@/views/enterprise/TaskAcceptance.vue'),
          meta: { title: '任务验收' },
        },
        {
          path: 'task-progress',
          name: 'EnterpriseTaskProgress',
          component: () => import('@/views/enterprise/TaskProgress.vue'),
          meta: { title: '任务进度' },
        },
      ],
    },
  ],
})

router.afterEach((to) => {
  const suffix = to.path.startsWith('/miniapp')
    ? '灵工小程序'
    : to.path.startsWith('/enterprise')
      ? '企业任务中心'
      : to.path.startsWith('/bi')
        ? '数据监控'
        : '灵工平台'
  document.title = `${to.meta.title ?? '管理后台'} - ${suffix}`
})

export default router
