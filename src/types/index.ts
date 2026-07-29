export type EmployeeStatus = 'active' | 'leave' | 'resigned'

export interface Department {
  id: string
  name: string
  parentId: string | null
  sort: number
}

export interface Team {
  id: string
  name: string
  departmentId: string
  memberIds: string[]
  /** 关联考勤组，排班规则按考勤组生效 */
  attendanceGroupId?: string
  /** 考勤组统一时薪（元/h），未设置则使用薪酬默认时薪 */
  hourlyRate?: number
  description?: string
}

export interface Employee {
  id: string
  name: string
  employeeNo: string
  departmentId: string
  position: string
  hireDate: string
  skills: string[]
  preferredShiftIds: string[]
  unavailableDates: string[]
  status: EmployeeStatus
  phone?: string
}

export interface Shift {
  id: string
  name: string
  code: string
  startTime: string
  endTime: string
  breakMinutes: number
  color: string
  isSpecial: boolean
  description?: string
}

export interface Holiday {
  id: string
  name: string
  date: string
  type: 'legal' | 'custom'
  isWorkday: boolean
}

export interface ScheduleRule {
  maxConsecutiveDays: number
  maxDailyHours: number
  maxWeeklyHours: number
  maxMonthlyHours: number
  minRestHours: number
  forbidNightShiftForFemale: boolean
  weekendWork: boolean
}

export type ScheduleConfirmStatus = 'pending' | 'confirming' | 'confirmed' | 'rejected'

export interface ScheduleAssignment {
  id: string
  employeeId: string
  shiftId: string
  date: string
  teamId?: string
  published: boolean
  /** 来自抢班池的排班 */
  fromGrabSlotId?: string
  /** 灵工确认状态 */
  confirmStatus?: ScheduleConfirmStatus
  /** 排班备注 */
  note?: string
  /** 手动编辑标记 */
  manualEdited?: boolean
}

/** 排班模板（按周循环模式） */
export interface ScheduleTemplate {
  id: string
  name: string
  teamId: string
  attendanceGroupId: string
  /** 7 日循环班次 ID */
  pattern: string[]
  isDefault?: boolean
  createdAt: string
}

/** 抢班独立班次状态 */
export type GrabShiftStatus = 'open' | 'partial' | 'full' | 'cancelled'

/** 抢班报名申请 */
export interface GrabShiftApplication {
  id: string
  slotId: string
  employeeId: string
  message?: string
  status: ApprovalStatus
  createdAt: string
  reviewedBy?: string
  reviewedAt?: string
  reviewNote?: string
}

/** 抢班白名单：名单内人员报名免审批 */
export interface GrabShiftWhitelistEntry {
  id: string
  attendanceGroupId: string
  employeeId: string
  remark?: string
  createdAt: string
  createdBy?: string
}

/** 灵工可抢的独立班次 */
export interface GrabShiftSlot {
  id: string
  attendanceGroupId: string
  teamId: string
  teamName: string
  shiftId: string
  shiftName: string
  date: string
  startTime: string
  endTime: string
  requiredCount: number
  grabbedCount: number
  requirements: string[]
  status: GrabShiftStatus
  createdAt: string
}

export interface SchedulePublishRecord {
  id: string
  month: string
  teamId: string
  publishedAt: string
  publishedBy: string
  employeeCount: number
  assignmentCount: number
}

export interface Notification {
  id: string
  title: string
  content: string
  type: 'schedule' | 'system' | 'attendance' | 'approval'
  createdAt: string
  read: boolean
}

export interface DepartmentTreeNode extends Department {
  children: DepartmentTreeNode[]
}

// --- Phase 2: Attendance ---

export type PunchType = 'clock_in' | 'clock_out'
export type PunchSource = 'mobile' | 'manual' | 'access_control'
export type PunchMethod = 'gps' | 'wifi' | 'field' | 'qrcode'

export interface AttendancePunch {
  id: string
  employeeId: string
  date: string
  time: string
  type: PunchType
  source: PunchSource
  location?: string
  inRange: boolean
  punchMethod?: PunchMethod
  remark?: string
}

export type InsurancePolicyStatus = 'active' | 'expired' | 'cancelled' | 'pending'

export type InsuranceProductType = 'accident' | 'employer_liability' | 'comprehensive'

/** 保险产品（按日投保方案） */
export interface InsuranceProduct {
  id: string
  name: string
  code: string
  type: InsuranceProductType
  provider: string
  /** 日保费（元） */
  dailyPremium: number
  /** 保额（万元） */
  coverageAmount: number
  description: string
  /** C 端上班打卡后自动投保 */
  autoOnPunch: boolean
  enabled: boolean
}

/** 投保保单记录 */
export interface InsurancePolicy {
  id: string
  policyNo: string
  productId: string
  employeeId: string
  /** 触发投保的打卡记录 */
  punchId?: string
  workDate: string
  effectiveTime: string
  expireTime: string
  premium: number
  status: InsurancePolicyStatus
  location?: string
  createdAt: string
}

export type AttendanceStatus =
  | 'normal'
  | 'late'
  | 'early_leave'
  | 'missing_punch'
  | 'absent'
  | 'rest'
  | 'leave'

export interface AttendanceDaily {
  employeeId: string
  date: string
  shiftId?: string
  status: AttendanceStatus
  clockIn?: string
  clockOut?: string
  workHours: number
  scheduledHours: number
  manualStatus?: AttendanceStatus
  manualNote?: string
}

export type ExceptionType =
  | 'late'
  | 'early_leave'
  | 'missing_punch'
  | 'absent'
  | 'location'
  | 'schedule_conflict'

export type ExceptionStatus = 'open' | 'appealed' | 'resolved' | 'dismissed'

export interface AttendanceException {
  id: string
  employeeId: string
  date: string
  type: ExceptionType
  status: ExceptionStatus
  message: string
  appealReason?: string
  appealAt?: string
  resolvedBy?: string
  resolvedAt?: string
  resolution?: string
}

export interface AttendanceRule {
  flexMinutesBefore: number
  flexMinutesAfter: number
  requireLocation: boolean
  allowedRadiusMeters: number
  maxMakeupPerMonth: number
}

export type AttendanceGroupType = 'shift' | 'free' | 'none'
export type AttendanceGroupStatus = 'enabled' | 'disabled'

export interface AttendanceGroupShiftTemplate {
  id: string
  name: string
  startTime: string
  endTime: string
  breakRule: string
  workHours: number
  /** 每日所需人数 */
  requiredHeadcount?: number
}

export interface PunchLocation {
  id: string
  name: string
  address?: string
}

export interface AttendanceGroupCompliance {
  maxDailyHours: number
  maxWeeklyHours: number
  minShiftIntervalHours: number
  maxMonthlyHours: number
  maxConsecutiveWorkdays: number
}

export interface AttendanceGroupPayRule {
  baseHourlyRate: number
  nightShiftSubsidy: number
  nightShiftTimeRange: string
  holidaySubsidy: number
}

export interface AttendanceGroupDeptBinding {
  departmentId: string
  departmentName: string
  headcount: number
  managerName?: string
}

export interface AttendanceGroup {
  id: string
  code: string
  name: string
  description: string
  status: AttendanceGroupStatus
  attendanceType: AttendanceGroupType
  shiftTemplates: AttendanceGroupShiftTemplate[]
  gpsEnabled: boolean
  gpsRadiusMeters: number
  punchLocations: PunchLocation[]
  wifiEnabled: boolean
  wifiName?: string
  qrcodeEnabled: boolean
  compliance: AttendanceGroupCompliance
  /** 排班规则（按考勤组独立配置） */
  scheduleRule: ScheduleRule
  departmentBindings: AttendanceGroupDeptBinding[]
  payRule: AttendanceGroupPayRule
  minMonthlyOnlineHours?: number
  attendanceArea?: string
  createdAt: string
  updatedAt: string
}

export type ApprovalStatus = 'pending' | 'approved' | 'rejected'

export interface LeaveRequest {
  id: string
  employeeId: string
  leaveType: 'annual' | 'sick' | 'personal' | 'compensatory'
  startDate: string
  endDate: string
  reason: string
  status: ApprovalStatus
  createdAt: string
  reviewedBy?: string
  reviewedAt?: string
  reviewNote?: string
}

export interface SwapRequest {
  id: string
  applicantId: string
  targetEmployeeId: string
  date: string
  reason: string
  status: ApprovalStatus
  createdAt: string
  reviewedBy?: string
  reviewedAt?: string
  reviewNote?: string
}

export interface MakeupPunchRequest {
  id: string
  employeeId: string
  date: string
  punchType: PunchType
  time: string
  reason: string
  status: ApprovalStatus
  createdAt: string
  reviewedBy?: string
  reviewedAt?: string
  reviewNote?: string
}

export interface AttendanceMonthlySummary {
  employeeId: string
  month: string
  scheduledDays: number
  actualDays: number
  lateCount: number
  earlyLeaveCount: number
  missingPunchCount: number
  absentCount: number
  leaveDays: number
  overtimeHours: number
  totalWorkHours: number
}

// --- Phase 3: Smart schedule, payroll, analytics ---

export type OvertimeType = 'weekday' | 'weekend' | 'holiday'
export type OvertimeCompensation = 'pay' | 'time_off'

export interface OvertimeRequest {
  id: string
  employeeId: string
  date: string
  startTime: string
  endTime: string
  overtimeType: OvertimeType
  hours: number
  reason: string
  compensation: OvertimeCompensation
  status: ApprovalStatus
  createdAt: string
  reviewedBy?: string
  reviewedAt?: string
  reviewNote?: string
}

export interface PayrollConfig {
  defaultHourlyRate: number
  weekdayOvertimeMultiplier: number
  weekendOvertimeMultiplier: number
  holidayOvertimeMultiplier: number
  erpSystemName: string
  erpEndpoint: string
}

export interface PayrollPreviewItem {
  employeeId: string
  month: string
  teamId?: string
  teamName?: string
  regularHours: number
  overtimeHours: number
  absentDays: number
  leaveDays: number
  hourlyRate: number
  regularPay: number
  overtimePay: number
  deductions: number
  totalPay: number
}

/** 结算账单状态 */
export type SettlementBillStatus =
  | 'pending_confirm'
  | 'pending_payment'
  | 'pending_verify'
  | 'paid'
  | 'void'

/** 账单费用汇总 */
export interface SettlementBillSummary {
  attendancePay: number
  taskPay: number
  overtimePay: number
  deductions: number
  workerCount: number
}

/** 账单灵工明细行 */
export interface SettlementBillLine {
  id: string
  employeeId: string
  employeeNo?: string
  employeeName: string
  departmentId: string
  departmentName: string
  attendanceDays: number
  workHours?: number
  taskCount: number
  pieceCount?: number
  attendancePay?: number
  taskPay?: number
  overtimePay?: number
  deductions?: number
  payrollAmount: number
  serviceFeeRate?: number
  serviceFee: number
}

/** 结算账单 */
export interface SettlementBill {
  id: string
  billNo: string
  enterpriseId: string
  enterpriseName: string
  periodStart: string
  periodEnd: string
  payrollTotal: number
  serviceFee: number
  totalPayable: number
  invoicedAmount: number
  status: SettlementBillStatus
  lines: SettlementBillLine[]
  billingRuleId?: string
  billingRuleName?: string
  serviceFeeRate?: number
  summary?: SettlementBillSummary
  pushedAt?: string
  paymentVoucher?: string
  paymentSubmittedAt?: string
  confirmedAt?: string
  paidAt?: string
  voidReason?: string
  remark?: string
  createdAt: string
  updatedAt: string
}

/** 计费公式可用字段 */
export type BillingFormulaFieldKey =
  | 'attendance_days'
  | 'work_hours'
  | 'hourly_rate'
  | 'task_count'
  | 'task_unit_price'
  | 'piece_count'
  | 'piece_unit_price'
  | 'overtime_hours'
  | 'overtime_rate'
  | 'deductions'
  | 'payroll_total'
  | 'service_fee_rate'

/** 计费规则 */
export interface BillingRule {
  id: string
  name: string
  code: string
  description?: string
  scope: 'global' | 'enterprise' | 'department'
  payrollFormula: string
  serviceFeeFormula: string
  enabled: boolean
  isDefault?: boolean
  createdAt: string
  updatedAt: string
}

/** 待结算灵工预估 */
export interface PendingSettlementItem {
  id: string
  employeeId: string
  employeeName: string
  departmentId: string
  departmentName: string
  attendanceDays: number
  taskCount: number
  estimatedIncome: number
  month: string
}

export type InvoiceType = 'special' | 'normal'
export type InvoiceStatus = 'pending' | 'issued' | 'mailed'

/** 发票申请 */
export interface InvoiceApplication {
  id: string
  applicationNo: string
  billId: string
  billNo: string
  enterpriseId: string
  enterpriseName: string
  invoiceType: InvoiceType
  title: string
  taxNo: string
  amount: number
  recipientName?: string
  recipientPhone?: string
  recipientAddress?: string
  email?: string
  status: InvoiceStatus
  expressNo?: string
  electronicUrl?: string
  createdAt: string
  issuedAt?: string
}

/** 平台收款账户 */
export interface PlatformPaymentAccount {
  bankName: string
  accountName: string
  accountNo: string
  branch: string
}

export interface IntegrationLog {
  id: string
  type: 'payroll' | 'erp' | 'hr'
  action: string
  status: 'success' | 'failed'
  recordCount: number
  createdAt: string
  message: string
}

export interface ShiftRecommendation {
  employeeId: string
  score: number
  reasons: string[]
}

export interface SmartScheduleResult {
  assignments: Omit<ScheduleAssignment, 'id' | 'published'>[]
  conflictCount: number
  balancedHours: Record<string, number>
  message: string
}

export interface DepartmentAnalytics {
  departmentId: string
  employeeCount: number
  attendanceRate: number
  lateRate: number
  absentRate: number
  totalWorkHours: number
  laborCost: number
}

export interface ShiftPatternStat {
  shiftId: string
  shiftName: string
  count: number
  percentage: number
}

export interface MonthlyTrend {
  month: string
  workHours: number
  laborCost: number
  attendanceRate: number
}

// --- Task module ---

export interface Enterprise {
  id: string
  name: string
  contact: string
}

export type IndustryTag = 'telecom' | 'insurance' | 'fmcg' | 'other'
export type WorkflowNodeType = 'start' | 'middle' | 'end'
export type WorkflowRole = 'worker' | 'enterprise' | 'operator' | 'system'
export type WorkflowAction = 'submit' | 'approve' | 'reject' | 'cancel' | 'transfer'
export type WorkflowStatus = 'enabled' | 'disabled'

export interface WorkflowActionConfig {
  action: WorkflowAction
  requireProof?: boolean
  requireSignature?: boolean
  requireTraining?: boolean
  notifySms?: boolean
  notifyMiniProgram?: boolean
}

export interface WorkflowNode {
  id: string
  name: string
  nodeType: WorkflowNodeType
  role: WorkflowRole
  actions: WorkflowActionConfig[]
  timeoutHours?: number
  timeoutTargetNodeId?: string
  triggerSettlement?: boolean
  sort: number
}

export interface TaskWorkflow {
  id: string
  name: string
  industryTags: IndustryTag[]
  nodes: WorkflowNode[]
  status: WorkflowStatus
  version: number
  boundTaskTypeCount: number
  createdAt: string
  updatedAt: string
}

export type PricingMode = 'fixed' | 'tiered'
export type TaskTypeStatus = 'draft' | 'pending' | 'published' | 'rejected' | 'disabled'

export interface TieredPrice {
  minCount: number
  maxCount: number
  unitPrice: number
}

export interface TaskType {
  id: string
  enterpriseId: string
  enterpriseName: string
  name: string
  workflowId: string
  pricingMode: PricingMode
  fixedPrice?: number
  tieredPrices?: TieredPrice[]
  incentive?: string
  description: string
  trainingCourseId?: string
  validFrom?: string
  validTo?: string
  longTerm: boolean
  status: TaskTypeStatus
  applicant?: string
  submittedAt?: string
  reviewedBy?: string
  reviewedAt?: string
  reviewNote?: string
  createdAt: string
}

export type TaskPublishStatus = 'draft' | 'active' | 'ended' | 'cancelled'
export type DispatchMode = 'assign' | 'hall'

export interface Task {
  id: string
  enterpriseId: string
  enterpriseName: string
  name: string
  taskTypeId: string
  taskTypeName: string
  workflowId: string
  plannedTotal?: number
  startTime: string
  endTime: string
  dispatchMode: DispatchMode
  assigneeIds?: string[]
  maxPerPerson?: number
  region?: string
  description: string
  status: TaskPublishStatus
  acceptedCount: number
  completedCount: number
  approvedCount: number
  createdAt: string
}

export interface TaskInstance {
  id: string
  taskId: string
  taskName: string
  taskTypeName: string
  enterpriseName: string
  workerId: string
  workerName: string
  currentNodeId: string
  currentNodeName: string
  amount: number
  createdAt: string
  updatedAt: string
}

// --- Recruitment module ---

export type JobRequirementStatus = 'draft' | 'active' | 'closed'

export type RecruitmentLeadStatus =
  | 'screening'
  | 'interview_pending'
  | 'feedback_pending'
  | 'onboarding_pending'
  | 'onboarded'
  | 'settled'
  | 'closed'

export interface JobRequirement {
  id: string
  enterpriseId: string
  enterpriseName: string
  title: string
  department: string
  headcount: number
  filledCount: number
  salaryMin: number
  salaryMax: number
  location: string
  description: string
  status: JobRequirementStatus
  createdAt: string
}

export interface RecruitmentLead {
  id: string
  requirementId: string
  requirementTitle: string
  enterpriseId: string
  enterpriseName: string
  candidateName: string
  phone: string
  idCard?: string
  position: string
  source: string
  status: RecruitmentLeadStatus
  interviewDate?: string
  interviewTime?: string
  interviewFeedback?: string
  notes?: string
  talentId?: string
  createdAt: string
  updatedAt: string
}

export type TalentStatus = 'available' | 'in_process' | 'hired' | 'archived'

export interface Talent {
  id: string
  name: string
  phone: string
  idCard?: string
  gender?: 'male' | 'female'
  age?: number
  education: string
  experience: string
  skills: string[]
  expectedSalary?: string
  source: string
  status: TalentStatus
  lastContactAt?: string
  createdAt: string
}

/** 数据权限范围 */
export type DataScopeType =
  | 'all'
  | 'department_and_sub'
  | 'department'
  | 'self'
  | 'custom'

/** 功能权限节点 */
export interface PermissionNode {
  id: string
  name: string
  code: string
  module: string
  parentId: string | null
  type: 'menu' | 'action'
}

/** 系统角色 */
export interface SystemRole {
  id: string
  name: string
  code: string
  description?: string
  permissionIds: string[]
  dataScope: DataScopeType
  customDepartmentIds: string[]
  status: 'enabled' | 'disabled'
  isSystem?: boolean
  userCount: number
  updatedAt: string
}

/** 后台登录账号 */
export interface SystemAccount {
  id: string
  username: string
  displayName: string
  phone?: string
  email?: string
  roleId: string
  departmentId: string
  employeeId?: string
  status: 'enabled' | 'disabled'
  isSystem?: boolean
  lastLoginAt?: string
  createdAt: string
  updatedAt: string
}

/** 服务费计费方式 */
export type ServiceFeeType = 'hourly' | 'piece' | 'percentage'

export type ServiceProviderStatus = 'cooperating' | 'suspended' | 'terminated'
export type ServiceContractStatus = 'active' | 'expired' | 'draft'

/** 阶梯费率档位 */
export interface FeeTier {
  id: string
  minQuantity: number
  maxQuantity?: number
  rate: number
  label?: string
}

/** 服务商 */
export interface ServiceProvider {
  id: string
  code: string
  name: string
  shortName?: string
  contact: string
  phone: string
  email?: string
  address?: string
  businessScope: string
  status: ServiceProviderStatus
  linkedEnterpriseIds: string[]
  cooperationStartDate: string
  rating?: number
  remark?: string
  createdAt: string
  updatedAt: string
}

/** 服务商合作合同 */
export interface ServiceContract {
  id: string
  providerId: string
  contractNo: string
  name: string
  feeType: ServiceFeeType
  baseRate: number
  tiers: FeeTier[]
  currency: string
  effectiveDate: string
  expiryDate?: string
  status: ServiceContractStatus
  settlementCycle: 'monthly' | 'weekly' | 'project'
  remark?: string
  createdAt: string
  updatedAt: string
}

// ── 培训考核 ──

export type TrainingMaterialType = 'video' | 'pdf' | 'article'
export type TrainingMaterialCategory =
  | 'info_security'
  | 'safety'
  | 'anti_fraud'
  | 'service'
  | 'emergency'
  | 'other'
export type TrainingMaterialStatus = 'draft' | 'approved'

/** 培训资料 */
export interface TrainingMaterial {
  id: string
  name: string
  type: TrainingMaterialType
  category: TrainingMaterialCategory
  fileUrl: string
  fileName: string
  fileSize: number
  tags: string[]
  description?: string
  status: TrainingMaterialStatus
  createdAt: string
  updatedAt: string
}

export type CourseStudyMode = 'sequential' | 'free'
export type CourseStatus = 'draft' | 'published' | 'closed'
export type CourseScopeType = 'all' | 'department' | 'tag'

/** 培训课程 */
export interface TrainingCourse {
  id: string
  name: string
  coverUrl?: string
  description?: string
  materialIds: string[]
  studyMode: CourseStudyMode
  videoNoSeek: boolean
  minStudyMinutes?: number
  examId?: string
  scopeType: CourseScopeType
  scopeDepartmentIds?: string[]
  scopeTags?: string[]
  validFrom?: string
  validTo?: string
  status: CourseStatus
  createdAt: string
  updatedAt: string
  publishedAt?: string
}

export type ExamQuestionType = 'single' | 'multiple' | 'judge'
export type ExamQuestionSource = 'manual' | 'ai'
export type AiRiskScenario = 'info_security' | 'safety' | 'service' | 'emergency'
export type AiQuestionDifficulty = 'easy' | 'medium' | 'hard'
export type ExamStatus = 'draft' | 'published'

/** 考核题目 */
export interface ExamQuestion {
  id: string
  examId: string
  type: ExamQuestionType
  content: string
  imageUrl?: string
  options: { key: string; text: string }[]
  correctAnswers: string[]
  score: number
  partialScore?: boolean
  explanation?: string
  source: ExamQuestionSource
  aiScenario?: AiRiskScenario
  createdAt: string
}

/** 考核 */
export interface TrainingExam {
  id: string
  name: string
  description?: string
  /** 关联课程（须完成学习后方可参加考核） */
  courseId?: string
  durationMinutes: number
  passScore: number
  maxRetakes: number
  retakeIntervalHours?: number
  status: ExamStatus
  createdAt: string
  updatedAt: string
  publishedAt?: string
}

export type LearningStatus = 'not_started' | 'in_progress' | 'completed'

/** 课程学习记录 */
export interface CourseLearningRecord {
  id: string
  courseId: string
  employeeId: string
  status: LearningStatus
  completedMaterialIds: string[]
  studyMinutes: number
  examPassed?: boolean
  examScore?: number
  completedAt?: string
  updatedAt: string
}

/** 考核作答记录 */
export interface ExamAttempt {
  id: string
  examId: string
  employeeId: string
  courseId?: string
  score: number
  passed: boolean
  durationMinutes: number
  answers: Record<string, string[]>
  attemptNumber: number
  submittedAt: string
}

// ── 小程序端 ──

export type MiniMessageCategory = 'income' | 'schedule' | 'task' | 'withdraw' | 'system'

export interface MiniAppMessage {
  id: string
  employeeId: string
  category: MiniMessageCategory
  title: string
  content: string
  read: boolean
  createdAt: string
}

export type WorkerIncomeStatus = 'pending_settlement' | 'claimable' | 'claimed'

export interface WorkerIncomeRecord {
  id: string
  employeeId: string
  title: string
  amount: number
  tax?: number
  netAmount?: number
  status: WorkerIncomeStatus
  source: 'task' | 'attendance' | 'bonus'
  period?: string
  createdAt: string
  claimedAt?: string
}

export type MiniJobApplicationStatus = 'pending' | 'interview' | 'approved' | 'rejected'

export interface MiniJobApplication {
  id: string
  employeeId: string
  jobRequirementId: string
  status: MiniJobApplicationStatus
  createdAt: string
  interviewDate?: string
  interviewTime?: string
  reviewNote?: string
}

export interface WorkerAgreement {
  id: string
  employeeId: string
  title: string
  content: string
  signed: boolean
  required: boolean
  signedAt?: string
}

export interface WorkerPaymentBinding {
  employeeId: string
  alipay?: string
  bankName?: string
  bankCardLast4?: string
}

export interface WorkerProfileExt {
  employeeId: string
  level: string
  levelScore: number
  creditScore: number
  creditLevel: string
  certificates: { name: string; issuer: string; expireAt?: string }[]
}
