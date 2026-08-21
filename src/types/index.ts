export type EmployeeStatus = 'pending' | 'active' | 'resigned'

/** 待入驻人员阶段：待申请 / 已申请 */
export type EmployeeOnboardingStage = 'awaiting_apply' | 'applied'

/** 人员归属：排班人员 / 抢班人员 */
export type EmployeePersonnelCategory = 'schedule' | 'grab'

export type DepartmentOrgType = 'department' | 'enterprise'
export type DepartmentNodeType = 'branch' | 'leaf'

export interface Department {
  id: string
  name: string
  parentId: string | null
  sort: number
  /** 组织编码（可选） */
  code?: string
  enterpriseId?: string
  orgType?: DepartmentOrgType
  nodeType?: DepartmentNodeType
  description?: string
  managerEmployeeId?: string | null
  attendanceGroupId?: string | null
  /** 部门图片（可选） */
  imageUrl?: string
  /**
   * 部门数据授权的组织部门 ID 列表。
   * 被授权部门下的平台账号可访问本部门相关数据（同企业授权）。
   */
  authorizedDepartmentIds?: string[]
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

export type EmployeeGender = 'male' | 'female'

export interface EmployeeSkillCertificate {
  id: string
  name: string
  certificateNo?: string
  issueDate?: string
  expiryDate?: string
  photoName?: string
  photoUrl?: string
}

export interface Employee {
  id: string
  name: string
  /** 人员 ID（原工号，可编辑） */
  employeeNo: string
  departmentId: string
  enterpriseId?: string
  position: string
  /** 入驻日期 */
  hireDate: string
  skills: string[]
  preferredShiftIds: string[]
  unavailableDates: string[]
  status: EmployeeStatus
  /** 待入驻阶段（status=pending 时有效） */
  onboardingStage?: EmployeeOnboardingStage
  /** 扫码申请入驻的目标部门 */
  applyDepartmentId?: string
  /** 是否在岗 */
  onDuty?: boolean
  phone?: string
  /** 身份证号 */
  idCardNo?: string
  /**
   * 人员类别：排班人员 / 抢班人员（默认排班）
   */
  personnelCategory?: EmployeePersonnelCategory
  gender?: EmployeeGender
  age?: number
  email?: string
  address?: string
  remark?: string
  skillCertificates?: EmployeeSkillCertificate[]
  /** 是否已完成实名认证 */
  realNameVerified?: boolean
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

/** 抢班独立班次状态（容量/招募） */
export type GrabShiftStatus = 'open' | 'partial' | 'full' | 'cancelled'

/** 抢班班次发布审批状态（上架小程序前） */
export type GrabShiftPublishStatus = 'pending' | 'published' | 'rejected'

/** 抢班报名申请 */
export interface GrabShiftApplication {
  id: string
  slotId: string
  employeeId: string
  message?: string
  status: ApprovalStatus | 'cancelled'
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

/** 抢班面试：周一=1 … 周日=7 */
export type GrabInterviewWeekday = 1 | 2 | 3 | 4 | 5 | 6 | 7

/** 可面试时间配置方式 */
export type GrabInterviewScheduleMode = 'unified' | 'by_day'

/** 面试席位计量单位（分钟）：每半小时 / 每 1 小时 */
export type GrabInterviewSeatUnitMinutes = 30 | 60

export interface GrabInterviewTimeSlot {
  id: string
  start: string
  end: string
}

/** 岗位要求画像（对齐发布需求 / 可存模板） */
export interface GrabInterviewPositionProfile {
  positionName: string
  jobType?: string
  skills?: string[]
  /** 任职要求 */
  requirements?: string
  description?: string
  ageMin?: number
  ageMax?: number
  gender?: 'any' | 'male' | 'female'
  experience?: string
}

/** 面试时间与席位规则 */
export interface GrabInterviewScheduleRule {
  /**
   * - unified：各选中星期共用 timeSlots
   * - by_day：按日在 dayTimeSlots 分别配置
   */
  scheduleMode?: GrabInterviewScheduleMode
  weekdays: GrabInterviewWeekday[]
  timeSlots: GrabInterviewTimeSlot[]
  dayTimeSlots?: Partial<Record<GrabInterviewWeekday, GrabInterviewTimeSlot[]>>
  /** 席位计量单位：30=每半小时，60=每 1 小时 */
  seatUnitMinutes?: GrabInterviewSeatUnitMinutes
  /** 每个计量单位可面试人数 */
  seatsPerUnit?: number
}

/** 企业级岗位模板 */
export interface GrabInterviewPositionTemplate {
  id: string
  enterpriseId: string
  /** 模板名称 */
  name: string
  profile: GrabInterviewPositionProfile
  /** 模板可选附带默认面试规则 */
  schedule?: GrabInterviewScheduleRule
  updatedAt: string
}

/** 部门下的岗位配置 */
export interface GrabInterviewDeptPosition {
  id: string
  /** 来源模板 */
  templateId?: string | null
  profile: GrabInterviewPositionProfile
  /**
   * - position：使用本岗位独立面试规则
   * - department：应用部门统一面试规则
   */
  ruleScope: 'position' | 'department'
  /** 岗位独立规则（ruleScope=position） */
  schedule?: GrabInterviewScheduleRule
}

/**
 * 部门维度面试配置（多岗位）。
 * 兼容旧版单岗位扁平字段（迁移时写入 positions[0]）。
 */
export interface GrabInterviewDeptRule {
  departmentId: string
  /** 部门下多岗位 */
  positions: GrabInterviewDeptPosition[]
  /** 部门统一面试规则（岗位选择「应用全部门」时使用） */
  departmentSchedule?: GrabInterviewScheduleRule
  /** @deprecated 旧版单岗位字段，仅兼容读取 */
  positionName?: string
  jobType?: string
  skills?: string[]
  requirements?: string
  description?: string
  ageMin?: number
  ageMax?: number
  gender?: 'any' | 'male' | 'female'
  experience?: string
  scheduleMode?: GrabInterviewScheduleMode
  weekdays?: GrabInterviewWeekday[]
  timeSlots?: GrabInterviewTimeSlot[]
  dayTimeSlots?: Partial<Record<GrabInterviewWeekday, GrabInterviewTimeSlot[]>>
  seatUnitMinutes?: GrabInterviewSeatUnitMinutes
  seatsPerUnit?: number
}

/** 企业抢班面试总配置 */
export interface GrabInterviewConfig {
  id: string
  enterpriseId: string
  /** 抢班是否需要面试 */
  requireInterview: boolean
  deptRules: GrabInterviewDeptRule[]
  /** 企业岗位模板库 */
  positionTemplates?: GrabInterviewPositionTemplate[]
  updatedAt: string
}

export type GrabInterviewRegStatus =
  | 'pending'
  | 'passed'
  | 'failed'
  | 'no_show_cancelled'

/** 抢班面试报名 */
export interface GrabInterviewRegistration {
  id: string
  enterpriseId: string
  departmentId: string
  name: string
  phone: string
  position: string
  /** 面试日期 YYYY-MM-DD */
  interviewDate: string
  timeSlotId?: string
  /** 展示用时段窗口，如 09:00-10:00 */
  timeSlotLabel: string
  /** 准确面试开始时间 HH:mm（落在时段窗口内） */
  interviewExactTime?: string
  weekday?: GrabInterviewWeekday
  status: GrabInterviewRegStatus
  failReason?: string
  feedbackAt?: string
  /** 通过后进入人员池的员工 ID */
  employeeId?: string
  /** 报名时间 */
  createdAt: string
}

/** 灵工可抢的独立班次 */
export type GrabShiftScope = 'global' | 'department'
export type GrabShiftShiftSource = 'template' | 'custom'

/** 灵工可抢的独立班次 */
export interface GrabShiftSlot {
  id: string
  attendanceGroupId: string
  /** 发布范围：全局或指定部门 */
  scope?: GrabShiftScope
  departmentId?: string
  departmentName?: string
  teamId: string
  teamName: string
  /** 班次来源：考勤组模板或自定义 */
  shiftSource?: GrabShiftShiftSource
  shiftTemplateId?: string
  customShiftName?: string
  shiftId: string
  shiftName: string
  date: string
  startTime: string
  endTime: string
  hasBreakTime?: boolean
  breakRule?: string
  /** 休息分钟数（用于工时计算） */
  breakMinutes?: number
  /** 本次班次工时（时段 − 休息） */
  workHours?: number
  requiredCount: number
  grabbedCount: number
  /** 报名上浮方式 */
  enrollFloatMode?: 'absolute' | 'percent'
  /** 报名上浮人数或比例数值 */
  enrollFloatValue?: number
  /** 可报名上限（需求 + 上浮） */
  enrollCap?: number
  /** 客户基础时薪（审核时不可改） */
  hourlySubsidy?: number
  /** 发布时快照的客户基础时薪 */
  baseHourlyRate?: number
  /** 客户时薪 = 基础 + 补贴 */
  effectiveHourlyRate?: number
  /** 客户费用 = 客户时薪 × 工时 */
  customerFee?: number
  /** 薪资基础时薪（结算价） */
  wageBaseHourlyRate?: number
  /** 薪资补贴上浮（审核时可改） */
  wageHourlySubsidy?: number
  /** 薪资时薪 = 结算价 + 补贴 */
  wageHourlyRate?: number
  /** 薪资费用 = 薪资时薪 × 工时 */
  wageFee?: number
  /** 岗位名称（发布时必填） */
  positionName?: string
  /** 岗位要求说明（发布时必填） */
  positionRequirement?: string
  /** 技能要求 */
  requirements: string[]
  status: GrabShiftStatus
  /**
   * 发布审批状态：pending 待平台审核 → published 上架小程序
   * 缺省视为已发布（兼容旧种子/本地缓存）
   */
  publishStatus?: GrabShiftPublishStatus
  reviewedBy?: string
  reviewedAt?: string
  reviewNote?: string
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
  /** 发布版本号，同班组同月递增 */
  version?: number
  periodStart?: string
  periodEnd?: string
  changeNote?: string
  /** 发布时的排班快照，用于版本查看与恢复 */
  snapshot?: ScheduleAssignment[]
}

/** 按日按班次的人数需求单元格 */
export interface ShiftDemandDayCell {
  date: string
  shiftTemplateId: string
  requiredHeadcount: number
}

/** 班次需求通用配置方式 */
export type ShiftDemandCommonMode = 'daily_reuse' | 'batch_by_kind' | 'custom'

export interface ShiftDemandShiftCount {
  shiftTemplateId: string
  requiredHeadcount: number
}

/** 通用配置：每日复用 / 按日类型批量 / 每天单独配置 */
export interface ShiftDemandCommonConfig {
  mode: ShiftDemandCommonMode
  /** 每天复用同一套班次人数 */
  dailyReuse?: ShiftDemandShiftCount[]
  /** 按平日 / 周末 / 节假日批量配置 */
  batchByKind?: {
    weekday: ShiftDemandShiftCount[]
    weekend: ShiftDemandShiftCount[]
    holiday: ShiftDemandShiftCount[]
  }
  /** 每天单独配置时的单元格快照 */
  customDays?: ShiftDemandDayCell[]
}

/**
 * 班组班次需求计划（支持周 / 月 / 更长周期）。
 * weekStart/weekEnd 表示计划起止日期（兼容旧字段名）。
 * status: draft 草稿；published 已发布（confirmed 为历史兼容，等同已发布）
 */
export interface WeeklyShiftDemandPlan {
  id: string
  teamId: string
  weekStart: string
  weekEnd: string
  status: 'draft' | 'confirmed' | 'published'
  cells: ShiftDemandDayCell[]
  commonConfig?: ShiftDemandCommonConfig
  publishedAt?: string
  publishedBy?: string
  createdAt: string
  updatedAt: string
}

/** 班组周期性排班规则 */
export interface TeamCycleScheduleRule {
  id: string
  teamId: string
  name: string
  enabled: boolean
  /** 参与人员，空表示班组全员 */
  employeeIds: string[]
  /** N 日循环班次 ID 模式 */
  shiftPattern: string[]
  anchorStartDate: string
  cycleDays: number
  /** 提前多少天在节点自动生成排班 */
  autoGenerateLeadDays: number
  lastGeneratedAt?: string
  createdAt: string
  updatedAt: string
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
  /** 是否已人工矫正工时 */
  workHoursCorrected?: boolean
  /** 工时是否已确认 */
  hoursConfirmed?: boolean
  hoursConfirmedAt?: string
  hoursConfirmedBy?: string
  hoursCorrectedAt?: string
  hoursCorrectedBy?: string
}

/** 工时确认 / 矫正操作记录 */
export interface AttendanceHoursAudit {
  action: 'confirm' | 'correct'
  workHours: number
  reason: string
  operator: string
  operatedAt: string
}

/** 日考勤人工调整（状态 / 工时） */
export interface AttendanceManualAdjustment {
  status?: AttendanceStatus
  workHours?: number
  note?: string
  hoursConfirmed?: boolean
  hoursConfirmedAt?: string
  hoursConfirmedBy?: string
  hoursCorrectedAt?: string
  hoursCorrectedBy?: string
  hoursHistory?: AttendanceHoursAudit[]
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
export type FreePunchCountMode = 'clock_in_only' | 'clock_in_out'
export type PricingValueMode = 'fixed' | 'multiplier'

export interface AttendanceGroupShiftTemplate {
  id: string
  name: string
  startTime: string
  endTime: string
  breakRule: string
  workHours: number
  /** 平日（工作日）所需人数 */
  requiredHeadcount?: number
  /** 周末所需人数（未配置则沿用平日） */
  weekendRequiredHeadcount?: number
  /** 节假日所需人数（未配置则沿用平日） */
  holidayRequiredHeadcount?: number
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

export interface FreePunchConfig {
  startTime: string
  endTime: string
  punchCountMode: FreePunchCountMode
  /** 仅上班打卡时必填，用于计薪默认工时（小时） */
  defaultWorkHours?: number
}

export interface VariablePriceConfig {
  mode: PricingValueMode
  fixedAmount?: number
  multiplier?: number
}

export interface TimePeriod {
  startTime: string
  endTime: string
}

export interface AttendanceGroupPricingConfig {
  dayShiftPeriod: TimePeriod
  /** @deprecated 兼容旧数据，加载时迁移为 dayShiftPeriod */
  dayShiftHours?: number
  nightShiftPeriod: TimePeriod
  /** @deprecated 兼容旧数据，加载时迁移为 nightShiftPeriod */
  nightShiftHours?: number
  overtimeDefinition: string
  dayShiftRate: number
  nightShiftRate: number
  weekend: VariablePriceConfig
  holiday: VariablePriceConfig
  overtime: VariablePriceConfig
}

export interface AttendanceGroupPricingTemplate {
  id: string
  name: string
  config: AttendanceGroupPricingConfig
  createdAt: string
  updatedAt: string
}

export interface AttendanceGroupDeptBinding {
  departmentId: string
  departmentName: string
  headcount: number
  managerName?: string
}

/** 考勤组某一版本的配置快照 */
export type AttendanceGroupVersionSnapshot = Omit<
  AttendanceGroup,
  'id' | 'code' | 'createdAt' | 'updatedAt' | 'currentVersion' | 'versions'
>

export interface AttendanceGroupVersion {
  id: string
  version: number
  isActive: boolean
  publishedAt: string
  changeNote?: string
  snapshot: AttendanceGroupVersionSnapshot
}

export interface AttendanceGroup {
  id: string
  code: string
  name: string
  description: string
  status: AttendanceGroupStatus
  attendanceType: AttendanceGroupType
  shiftTemplates: AttendanceGroupShiftTemplate[]
  freePunchConfig?: FreePunchConfig
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
  pricingConfig?: AttendanceGroupPricingConfig
  minMonthlyOnlineHours?: number
  attendanceArea?: string
  /** 当前生效的版本号，0 表示尚未发布 */
  currentVersion: number
  /** 历史版本列表，按版本号降序 */
  versions: AttendanceGroupVersion[]
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

export interface CancelShiftRequest {
  id: string
  employeeId: string
  date: string
  shiftId: string
  teamId: string
  reason: string
  status: ApprovalStatus
  /** 员工端申请 / 管理端发起 */
  initiatedBy: 'employee' | 'admin'
  createdAt: string
  reviewedBy?: string
  reviewedAt?: string
  reviewNote?: string
  /** 原因编码（管理端弹窗） */
  reasonCode?: import('@/constants/cancelShift').CancelShiftReasonCode
  /** 选择「其他」时的补充说明 */
  reasonOther?: string
  /** 来源：排班 / 抢班 */
  source?: 'schedule' | 'grab'
  /** 抢班取消范围 */
  cancelScope?: 'person' | 'slot'
  /** 关联抢班班次 */
  grabSlotId?: string
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
  | 'pending_submit'
  | 'pending_confirm'
  | 'pending_payment'
  | 'paid'
  | 'void'

export type SettlementBillSourceType = 'rule' | 'excel'

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
  /** 账单适用部门范围：全公司或指定部门 */
  departmentScope: 'all' | 'department'
  departmentId?: string
  departmentName: string
  /** 付款企业（可选，企业确认时可改） */
  payerEnterpriseName?: string
  /** 付款企业统一社会信用代码（可选，企业确认时可改） */
  payerCreditCode?: string
  serviceProviderId?: string
  serviceProviderName?: string
  periodStart: string
  periodEnd: string
  payrollTotal: number
  serviceFee: number
  totalPayable: number
  invoicedAmount: number
  status: SettlementBillStatus
  lines: SettlementBillLine[]
  sourceType?: SettlementBillSourceType
  billingRuleId?: string
  billingRuleName?: string
  excelFileName?: string
  serviceFeeRate?: number
  /** 服务费是否含税（来自合同服务费配置） */
  serviceFeeIncludesTax?: boolean
  /** 工时/任务单价是否含税（来自合同服务费配置） */
  unitPriceIncludesTax?: boolean
  /** 减免服务费金额（与服务费同口径：含税/不含税） */
  serviceFeeWaiver?: number
  /** 减免服务费录入信息 */
  serviceFeeWaiverMeta?: {
    /** by_amount=减免服务费（录入总计金额）；by_quantity 仅兼容旧数据 */
    mode: 'by_quantity' | 'by_amount'
    workerCount?: number
    workHours?: number
    unitRate?: number
    note?: string
    appliedAt?: string
  }
  summary?: SettlementBillSummary
  pushedAt?: string
  paymentVoucher?: string
  paymentSubmittedAt?: string
  confirmedAt?: string
  paidAt?: string
  voidReason?: string
  remark?: string
  /** 打款失败标记（银行返回失败需重试） */
  paymentFailed?: boolean
  importTemplateId?: string
  importTemplateName?: string
  createdAt: string
  updatedAt: string
}

export type BillImportFieldType = 'text' | 'number' | 'date'

/** Excel 导入模板字段配置 */
export interface BillImportFieldConfig {
  id: string
  key: string
  label: string
  columnHeader: string
  dataType: BillImportFieldType
  required: boolean
  min?: number
  max?: number
  pattern?: string
}

/** Excel 导入模板（仅字段映射，公式在计薪规则中配置） */
export interface BillImportTemplate {
  id: string
  name: string
  enterpriseScope: 'all' | 'specific'
  enterpriseIds?: string[]
  fields: BillImportFieldConfig[]
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
  | 'upload_settlement_amount'
  | 'upload_service_fee_rate'
  | 'settlement_person_count'
  | 'fixed_unit_amount'
  | 'payroll_total'
  | 'service_fee_rate'

/** 计费规则 */
export interface BillingRule {
  id: string
  name: string
  code: string
  description?: string
  /** @deprecated 保留兼容，新规则统一为 global */
  scope?: 'global' | 'enterprise' | 'department'
  /** 适配企业：全部或特定企业 */
  enterpriseScope: 'all' | 'specific'
  enterpriseIds?: string[]
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

export type SettlementManageType = 'hourly' | 'task' | 'import'

export type SettlementManageStatus = 'pending_settlement' | 'settled'

/** 结算管理灵工明细行 */
export interface SettlementManageWorkerLine {
  id: string
  employeeId: string
  employeeName: string
  employeeNo?: string
  departmentName?: string
  quantity: number
  unitPrice: number
  amount: number
  status: SettlementManageStatus
  settledAt?: string
  /** 关联结算单（已结算时） */
  settlementSlipId?: string
}

/** 结算管理单据（班次/任务单） */
export interface SettlementManageOrder {
  id: string
  enterpriseId: string
  enterpriseName: string
  type: SettlementManageType
  orderNo: string
  orderName: string
  periodStart: string
  periodEnd: string
  workerLines: SettlementManageWorkerLine[]
  createdAt: string
  updatedAt: string
}

/** 结算单明细行（每次批量结算快照） */
export interface SettlementSlipLine {
  orderId: string
  orderNo: string
  orderName: string
  lineId: string
  enterpriseId: string
  enterpriseName: string
  employeeId: string
  employeeName: string
  employeeNo?: string
  /** 导入发薪必填手机号 */
  phone?: string
  departmentName?: string
  quantity: number
  unitPrice: number
  amount: number
  periodStart: string
  periodEnd: string
}

/** 结算单（每次批量结算操作生成） */
export interface SettlementSlip {
  id: string
  slipNo: string
  type: SettlementManageType
  workerCount: number
  totalQuantity: number
  totalAmount: number
  lines: SettlementSlipLine[]
  settledAt: string
  createdAt: string
}

export type TaxDeclarationStatus = 'generated' | 'submitted' | 'filed'

export type TaxWithdrawalChannel = 'alipay' | 'bank_card'

/** 灵工提现明细（个税申报展开行） */
export interface TaxWithdrawalLine {
  id: string
  withdrawalNo: string
  channel: TaxWithdrawalChannel
  settlementAmount: number
  taxAmount: number
  netAmount: number
  withdrawnAt: string
}

/** 个税申报灵工行 */
export interface TaxDeclarationWorker {
  employeeId: string
  employeeName: string
  phone?: string
  idCardNo?: string
  totalSettlementAmount: number
  totalTaxAmount: number
  totalNetAmount: number
  withdrawals: TaxWithdrawalLine[]
}

/** 月度个税申报表（按服务商） */
export interface TaxDeclaration {
  id: string
  declarationNo: string
  serviceProviderId: string
  serviceProviderName: string
  month: string
  workerCount: number
  totalSettlementAmount: number
  totalTaxAmount: number
  totalNetAmount: number
  workers: TaxDeclarationWorker[]
  status: TaxDeclarationStatus
  generatedAt: string
}

export type InvoiceType = 'electronic_special' | 'electronic_normal'

/** 企业可开票类目（类目与开票类型 1:1） */
export interface EnterpriseInvoiceCategoryItem {
  /** 类目名称，如「生活服务*现代服务」 */
  name: string
  /** 电子专票 / 电子普票 */
  invoiceType: InvoiceType
}

export type InvoiceDeliveryMethod = 'sf' | 'ems' | 'other'

export type InvoiceStatus =
  | 'draft'
  | 'pending_review'
  | 'reviewing'
  | 'rejected'
  | 'issuing'
  | 'issued'

/** 企业开票抬头（可多家，对应付款主体） */
export interface EnterpriseInvoiceProfile {
  id: string
  enterpriseId: string
  /** 抬头名称 / 付款主体 */
  title: string
  /** 纳税人识别号 / 统一社会信用代码 */
  taxNo: string
  address: string
  phone: string
  bankName: string
  bankAccount: string
  defaultInvoiceType: InvoiceType
  /** 是否默认抬头 */
  isDefault?: boolean
  remark?: string
}

/** 发票申请关联账单 */
export interface InvoiceApplicationBillRef {
  billId: string
  billNo: string
  amount: number
}

/** 发票申请 */
export interface InvoiceApplication {
  id: string
  applicationNo: string
  bills: InvoiceApplicationBillRef[]
  enterpriseId: string
  enterpriseName: string
  /** 选用的开票抬头 / 付款主体 */
  invoiceProfileId?: string
  invoiceType: InvoiceType
  invoiceContent: string
  invoiceCategory?: string
  title: string
  taxNo: string
  amount: number
  remark?: string
  recipientName?: string
  recipientPhone?: string
  recipientAddress?: string
  deliveryMethod?: InvoiceDeliveryMethod
  email?: string
  status: InvoiceStatus
  rejectReason?: string
  expressNo?: string
  electronicUrl?: string
  invoiceFileName?: string
  createdAt: string
  submittedAt?: string
  reviewedAt?: string
  issuedAt?: string
}

/** 平台收款账户 */
export interface PlatformPaymentAccount {
  bankName: string
  accountName: string
  accountNo: string
  branch: string
}

/** 资金账户类型 */
export type FundAccountType = 'alipay' | 'cmb'

export type FundAccountStatus = 'active' | 'frozen' | 'disabled'

/** 支付宝账户参数 */
export interface AlipayFundConfig {
  appId: string
  partnerId: string
  merchantName: string
  alipayAccount: string
}

/** 招商银行开户参数 */
export interface CmbFundConfig {
  accountName: string
  accountNo: string
  branchName: string
  branchCode: string
  bankCode: string
}

/** 服务商资金账户 */
export interface ProviderFundAccount {
  id: string
  providerId: string
  name: string
  accountType: FundAccountType
  balance: number
  status: FundAccountStatus
  alipayConfig?: AlipayFundConfig
  cmbConfig?: CmbFundConfig
  isDefault?: boolean
  remark?: string
  createdAt: string
  updatedAt: string
}

export type FundTransactionType = 'income' | 'payout' | 'transfer'

export type FundTransactionStatus = 'success' | 'pending' | 'failed'

export type FundTransactionDirection = 'in' | 'out'

/** 资金流水（每笔动账） */
export interface FundTransaction {
  id: string
  accountId: string
  providerId: string
  /** 收入 / 代发 / 转账 */
  type: FundTransactionType
  /** 资金方向：收入为 in，代发为 out，转账按实际方向 */
  direction: FundTransactionDirection
  amount: number
  balanceAfter: number
  counterparty?: string
  /** 对手方账号 */
  counterpartyAccount?: string
  relatedOrderNo?: string
  remark: string
  status: FundTransactionStatus
  /** 失败原因（status=failed 时） */
  failReason?: string
  createdAt: string
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

export type EnterpriseStatus = 'active' | 'expiring' | 'terminated'
export type EnterpriseServiceModule =
  | 'recruitment'
  | 'attendance'
  | 'task'
  | 'payroll'
  | 'training'

export interface EnterpriseAdminAccount {
  name: string
  phone: string
  role: string
  passwordMode: 'auto' | 'manual'
  initialPassword?: string
}

/** 工时结算价（白班/夜班 + 加班/周末/节假日） */
export interface SettlementHourlyConfig {
  dayShiftRate: number
  nightShiftRate: number
  overtime: VariablePriceConfig
  weekend: VariablePriceConfig
  holiday: VariablePriceConfig
}

/** @deprecated 已改为按考勤组配置，保留兼容旧本地数据 */
export interface EnterpriseSettlementConfig extends SettlementHourlyConfig {
  enterpriseId: string
  taskUnitPrice: number
  updatedAt: string
}

/** 考勤组工时结算价（灵工价单独配置） */
export interface AttendanceGroupSettlementOverride {
  attendanceGroupId: string
  enterpriseId: string
  /** @deprecated 企业默认已移除，忽略该字段 */
  useEnterpriseDefault?: boolean
  /** 是否日结（按考勤组独立配置） */
  dailySettlement?: boolean
  /**
   * 是否自动结算：开启后无需人工确认工时。
   * 仅在 dailySettlement 为 true 时生效。
   */
  autoSettlement?: boolean
  dayShiftRate?: number
  nightShiftRate?: number
  overtime?: VariablePriceConfig
  weekend?: VariablePriceConfig
  holiday?: VariablePriceConfig
  /** @deprecated 任务价已改为按任务类型配置 */
  taskUnitPrice?: number
  updatedAt?: string
}

/** 任务类型灵工结算价（单独配置后才生效） */
export interface TaskTypeSettlementOverride {
  taskTypeId: string
  enterpriseId: string
  /** true / 未配置单价 = 未设置灵工结算价 */
  useEnterpriseDefault?: boolean
  unitPrice?: number
  updatedAt?: string
}

export interface Enterprise {
  id: string
  code: string
  name: string
  shortName: string
  /** @deprecated 兼容旧字段，等同 contactPerson */
  contact: string
  contactPerson: string
  contactPhone: string
  creditCode: string
  address?: string
  status: EnterpriseStatus
  serviceModules: EnterpriseServiceModule[]
  /**
   * 可开发票类目（每项含类目名称与开票类型，1:1）
   * 兼容旧数据：可能为 string[]，读取时需 normalizeEnterpriseInvoiceCategories
   */
  invoiceCategories?: EnterpriseInvoiceCategoryItem[] | string[]
  /** 企业负责人（平台操作员账号） */
  enterpriseOwnerIds?: string[]
  /**
   * 企业数据授权的组织部门 ID 列表。
   * 被授权部门及其下级可访问该企业数据。
   */
  authorizedDepartmentIds?: string[]
  /** 企业 Logo（必填） */
  logoUrl: string
  /** 场景图（可多张，非必填） */
  sceneImageUrls?: string[]
  createdAt: string
  adminAccount?: EnterpriseAdminAccount
  /** 租户停用（不可登录企业端，区别于合作终止） */
  tenantDisabled?: boolean
}

export type IndustryTag = 'telecom' | 'insurance' | 'fmcg' | 'other'
export type WorkflowNodeType = 'start' | 'middle' | 'end'
export type WorkflowRole = 'worker' | 'enterprise' | 'operator' | 'system'
export type WorkflowAction =
  | 'submit'
  | 'confirm'
  | 'approve'
  | 'reject'
  | 'accept'
  | 'cancel'
  | 'punch'
  | 'transfer'
export type WorkflowStatus = 'enabled' | 'disabled'
export type WorkflowPrerequisite =
  | 'upload_file'
  | 'customer_signature'
  | 'related_training'
  | 'time_condition'
  | 'punch'
export type WorkflowFieldType = 'text' | 'select' | 'date' | 'amount' | 'attachment' | 'textarea' | 'switch'

export interface WorkflowActionConfig {
  action: WorkflowAction
  /** 执行该动作后流转的目标节点（分叉/结束节点） */
  targetNodeId?: string
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
  /** 无动作时的默认下一节点（如系统自动节点） */
  defaultNextNodeId?: string
  prerequisites?: WorkflowPrerequisite[]
  timeConditionNote?: string
  notifySms?: boolean
  notifyMiniProgram?: boolean
  notifyRoles?: WorkflowRole[]
  timeoutEnabled?: boolean
  timeoutHours?: number
  timeoutTargetNodeId?: string
  triggerSettlement?: boolean
  sort: number
}

export interface WorkflowFieldConfig {
  id: string
  name: string
  fieldType: WorkflowFieldType
  required: boolean
  nodeIds: string[]
  options?: string[]
}

export type WorkflowEnterpriseScope = 'all' | 'specific'

export interface TaskWorkflow {
  id: string
  name: string
  description?: string
  /** 适用企业范围：全部或特定企业 */
  enterpriseScope: WorkflowEnterpriseScope
  enterpriseIds?: string[]
  linkedTaskTypeId?: string
  nodes: WorkflowNode[]
  fields?: WorkflowFieldConfig[]
  status: WorkflowStatus
  version: number
  boundTaskTypeCount: number
  createdAt: string
  updatedAt: string
}

export type PricingMode = 'fixed' | 'tiered'
export type TaskPricingUnit = 'piece' | 'time'
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
  /** 计价单位：按件 / 按次 */
  pricingUnit?: TaskPricingUnit
  fixedPrice?: number
  tieredPrices?: TieredPrice[]
  incentive?: string
  description: string
  trainingCourseId?: string
  validFrom?: string
  validTo?: string
  longTerm: boolean
  /** 任务数量无上限 */
  unlimitedQuantity: boolean
  /** 默认任务数量（unlimitedQuantity 为 false 时必填） */
  defaultQuantity?: number
  status: TaskTypeStatus
  applicant?: string
  submittedAt?: string
  reviewedBy?: string
  reviewedAt?: string
  reviewNote?: string
  createdAt: string
}

export type TaskPublishStatus = 'draft' | 'pending' | 'active' | 'ended' | 'cancelled' | 'rejected'
export type DispatchMode = 'assign' | 'hall'

export interface Task {
  id: string
  enterpriseId: string
  enterpriseName: string
  name: string
  /** @deprecated 兼容旧数据；新任务以 workflowId + 任务内定价为准 */
  taskTypeId?: string
  /** 展示用：多为关联流程名称 */
  taskTypeName: string
  workflowId: string
  /** 发布归属部门/公司 */
  departmentId?: string
  departmentName?: string
  pricingMode?: PricingMode
  pricingUnit?: TaskPricingUnit
  fixedPrice?: number
  tieredPrices?: TieredPrice[]
  /**
   * 灵工结算单价（平台审批时可改，默认代入客户单价）
   * 未设置时认领金额回退客户定价
   */
  settlementUnitPrice?: number
  incentive?: string
  trainingCourseId?: string
  plannedTotal?: number
  /** 任务数量无上限（plannedTotal 为空且为 true） */
  unlimitedQuantity?: boolean
  /** 任务期限长期有效 */
  longTerm?: boolean
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
  reviewedBy?: string
  reviewedAt?: string
  reviewNote?: string
  createdAt: string
}

export interface TaskInstance {
  id: string
  taskId: string
  taskName: string
  taskTypeName: string
  enterpriseId: string
  enterpriseName: string
  workerId: string
  workerName: string
  currentNodeId: string
  currentNodeName: string
  /** 领取数量（次/件） */
  claimQuantity: number
  amount: number
  fieldValues?: Record<string, string | number | boolean>
  /** 进度流转日志（含人工干预与操作日志） */
  logs?: TaskInstanceLog[]
  /** 当前节点超时截止时间 */
  timeoutAt?: string
  createdAt: string
  updatedAt: string
}

export interface TaskInstanceLog {
  id: string
  title: string
  tag?: string
  operator?: string
  time: string
  description?: string
  /** system=流程节点, manual=人工干预, operation=操作日志 */
  kind: 'system' | 'manual' | 'operation'
}

// --- Recruitment module ---

export type JobRequirementStatus = 'pending' | 'recruiting' | 'completed'

export type EmploymentType = 'full_time' | 'part_time' | 'intern' | 'dispatch' | 'outsource'

export type UrgencyLevel = 'normal' | 'urgent' | 'critical'

export type RecruitmentLeadStatus =
  | 'screening'
  | 'interview_pending'
  | 'interview_attended'
  | 'feedback_pending'
  | 'salary_negotiation'
  | 'background_check'
  | 'medical_check'
  | 'onboarding_pending'
  | 'onboarded'
  | 'qualified'
  | 'closed'

export type BackgroundCheckStatus = 'not_started' | 'in_progress' | 'completed'
export type MedicalCheckStatus = 'not_started' | 'in_progress' | 'completed'

/** 招聘资质审核（无犯罪证明 / 健康证） */
export type RecruitmentQualStatus = 'pending' | 'approved' | 'rejected' | 'missing'

export interface RecruitmentLeadExt {
  deviated?: boolean
  deviateReason?: string
  interviewScore?: number
  expectedSalary?: string
  offerSalary?: string
  flowLog?: { at: string; from: string; to: string; note?: string }[]
  /** 无犯罪证明审核 */
  criminalRecordStatus?: RecruitmentQualStatus
  criminalRecordNote?: string
  /** 健康证审核 */
  healthCertStatus?: RecruitmentQualStatus
  healthCertNote?: string
}

/** 岗位出勤时间要求（对齐小程序岗位详情） */
export interface JobAttendanceRequirement {
  /** 说明文案，如：面试通过后，稳定派单出勤时间要求 */
  subtitle?: string
  /** 期望兼职时长，如：3个月以上 */
  duration?: string
  /** 每周出勤天数，如：不限 / 每周3天以上 */
  weeklyDays?: string
  /** 具体出勤时段，如：不限 / 早班 08:00-16:00 */
  timeSlots?: string
}

/** 福利待遇标签（对齐小程序「您将享受的福利」） */
export interface JobBenefitTag {
  icon: string
  title: string
  desc: string
}

/** 模块展示配置：勾选展示则后台对应内容必填 */
export interface JobModuleFieldConfig {
  /** 是否在小程序岗位详情展示（展示则必填） */
  showInMiniapp: boolean
}

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
  city?: string
  jobType?: string
  description: string
  requirements?: string
  remarks?: string
  employmentType?: EmploymentType
  workDuration?: string
  ageMin?: number
  ageMax?: number
  gender?: 'any' | 'male' | 'female'
  experience?: string
  skills?: string[]
  /** @deprecated 请使用 benefitTags；保留兼容旧数据 */
  benefits?: string
  /** 福利待遇标签（小程序展示） */
  benefitTags?: JobBenefitTag[]
  /** 福利额外说明，如加薪券文案 */
  bonusText?: string
  /** 出勤时间要求（小程序展示） */
  attendanceRequirement?: JobAttendanceRequirement
  /** 出勤时间模块：是否必填 / 是否展示 */
  attendanceConfig?: JobModuleFieldConfig
  /** 福利待遇模块：是否必填 / 是否展示 */
  benefitsConfig?: JobModuleFieldConfig
  tags?: string[]
  urgency?: UrgencyLevel
  interviewRounds?: number
  projectManager?: string
  positionId?: string
  viewerAccountIds?: string[]
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
  currentRound?: number
  totalRounds?: number
  interviewDate?: string
  interviewTime?: string
  interviewMethod?: 'offline' | 'online'
  interviewAddress?: string
  interviewer?: string
  interviewFeedback?: string
  /** 计划入职日期 YYYY-MM-DD */
  onboardDate?: string
  bgStatus?: BackgroundCheckStatus
  medStatus?: MedicalCheckStatus
  ext?: RecruitmentLeadExt
  notes?: string
  talentId?: string
  /** 分配至客户经理时间 */
  assignedAt?: string
  assignedTo?: string
  /** 最近一次跟进时间 */
  lastFollowUpAt?: string
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

export type RolePortal = 'platform' | 'enterprise' | 'enterprise_template'

export type PlatformDataScope = 'all' | 'partial'

/** 菜单级查看/编辑权限 */
export interface MenuPermissionEntry {
  code: string
  name: string
  module: string
  view: boolean
  edit: boolean
}

/** 系统角色 */
export interface SystemRole {
  id: string
  name: string
  code: string
  description?: string
  permissionIds: string[]
  menuPermissions?: MenuPermissionEntry[]
  rolePortal?: RolePortal
  platformDataScope?: PlatformDataScope
  partialEnterpriseIds?: string[]
  dataScope: DataScopeType
  customDepartmentIds: string[]
  status: 'enabled' | 'disabled'
  isSystem?: boolean
  isTemplate?: boolean
  /** 企业端角色所属租户 */
  enterpriseId?: string
  /** 来源模板 ID（从模板库初始化时关联） */
  templateId?: string
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
  /** 可多选，操作权限取各角色并集 */
  roleIds: string[]
  departmentId: string
  employeeId?: string
  /** platform=运营后台 enterprise=企业端 */
  accountPortal?: 'platform' | 'enterprise'
  /** 企业端账号所属租户 */
  enterpriseId?: string
  status: 'enabled' | 'disabled'
  isSystem?: boolean
  lastLoginAt?: string
  createdAt: string
  updatedAt: string
}

/** 操作日志类型 */
export type SystemOperationLogType =
  | 'enterprise_account_change'
  | 'module_auth'
  | 'login_logout'
  | 'role_permission'
  | 'account_manage'
  | 'data_export'
  | 'tenant_manage'
  | 'ops_role_config'
  | 'enterprise_role_library'
  | 'other'

/** 系统操作日志（后台 / 企业端） */
export interface SystemOperationLog {
  id: string
  operatedAt: string
  /** 为空表示平台级操作 */
  enterpriseId?: string | null
  enterpriseName: string
  operatorAccountId?: string
  operatorName: string
  operatorUsername?: string
  operatorRoleLabel?: string
  operationType: SystemOperationLogType
  targetObject: string
  detail: string
  result: 'success' | 'failed'
  ip: string
  portal: 'platform' | 'enterprise'
  userAgent?: string
  failReason?: string
  extra?: Record<string, string>
}

/** 服务费计费方式（兼容旧数据） */
export type ServiceFeeType = 'hourly' | 'piece' | 'percentage'

export type ContractTermPreset = '1y' | '2y' | '5y' | 'long'

export type ContractBillingRuleType = 'hourly' | 'task'

/** 服务费分项：工时含招聘/管理/抢班；任务含招聘/管理 */
export type ContractServiceFeeCategory = 'recruitment' | 'management' | 'grab'

export interface ContractServiceFeeItem {
  category: ContractServiceFeeCategory
  /** 费率或单价，与所属计费规则的 chargeMethod 一致 */
  rate: number
}

export interface ContractBillingRule {
  type: ContractBillingRuleType
  chargeMethod: 'fixed' | 'percentage'
  /**
   * 兼容旧数据与列表汇总；有 serviceFees 时等于各分项 rate 之和
   * @deprecated 请优先使用 serviceFees
   */
  baseRate: number
  /** @deprecated 已取消阶梯费率，保留兼容旧数据 */
  tiers: FeeTier[]
  /** 服务费是否含税，默认不含税 */
  serviceFeeIncludesTax?: boolean
  /** 工时/任务单价是否含税，默认不含税 */
  unitPriceIncludesTax?: boolean
  /** 分项服务费 */
  serviceFees?: ContractServiceFeeItem[]
}

/** 结算周期：用于提醒生成账单 */
export type SettlementCycle = 'weekly' | 'monthly' | 'quarterly'

export type ServiceProviderStatus = 'cooperating' | 'suspended' | 'terminated'
export type ServiceContractStatus = 'active' | 'expiring' | 'expired' | 'terminated' | 'draft'

/** 合同审批状态：操作员提交 → 负责人审批 */
export type ContractApprovalStatus = 'draft' | 'pending' | 'approved' | 'rejected'

/** 合同版本状态 */
export type ServiceContractVersionStatus =
  | 'effective'
  | 'history'
  | 'pending'
  | 'rejected'
  | 'draft'

export interface ContractAttachment {
  id: string
  name: string
  size: string
  uploadedAt: string
}

export interface ContractOperationLog {
  id: string
  operator: string
  action: string
  createdAt: string
}

/** 合同历史版本（配置快照） */
export interface ServiceContractVersion {
  id: string
  /** 版本号，从 1 递增 */
  version: number
  status: ServiceContractVersionStatus
  name: string
  feeType: ServiceFeeType
  chargeMethod: 'fixed' | 'percentage'
  baseRate: number
  tiers: FeeTier[]
  billingRules?: ContractBillingRule[]
  contractTerm?: ContractTermPreset
  currency: string
  signingDate: string
  effectiveDate: string
  expiryDate: string
  settlementCycle: SettlementCycle
  settlementDay?: number
  settlementWeekday?: number
  settlementQuarterMonth?: number
  settlementQuarterDay?: number
  ourSigningEntity?: string
  remark?: string
  /** 本版变更说明 */
  changeNote?: string
  submittedBy?: string
  submittedAt?: string
  approvedBy?: string
  approvedAt?: string
  approvalRemark?: string
  createdAt: string
  updatedAt: string
}

/** 阶梯费率档位 */
export interface FeeTier {
  id: string
  minQuantity: number
  maxQuantity?: number
  rate: number
  label?: string
}

/** 服务商需配置的签署合同类型 */
export type ProviderSignContractType =
  | 'platform_cooperation'
  | 'enterprise_service'
  | 'worker_dispatch'
  | 'privacy'
  | 'other'

/** 服务商签署合同模板配置（关联电子签平台模板 ID） */
export interface ProviderSignContractTemplate {
  id: string
  name: string
  contractType: ProviderSignContractType
  /** 电子签平台合同模板 ID */
  templateId: string
  /** 是否必须签署 */
  required: boolean
  description?: string
  updatedAt: string
}

/** 电子签平台 */
export type ESignPlatform = 'fadada' | 'tencent' | 'esign' | 'other'

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
  /** 电子签平台 */
  esignPlatform?: ESignPlatform
  /** 电子签应用 ID（可选） */
  esignAppId?: string
  /** 需签署的合同模板配置 */
  signContractTemplates?: ProviderSignContractTemplate[]
  createdAt: string
  updatedAt: string
}

/** 平台与企业之间的服务合同 */
export interface ServiceContract {
  id: string
  enterpriseId: string
  providerId: string
  contractNo: string
  name: string
  /** @deprecated 兼容列表筛选，保存时由 billingRules 同步 */
  feeType: ServiceFeeType
  /** @deprecated 兼容旧数据 */
  chargeMethod: 'fixed' | 'percentage'
  /** @deprecated 兼容旧数据 */
  baseRate: number
  /** @deprecated 兼容旧数据 */
  tiers: FeeTier[]
  /** 工时/任务计费规则，可同时启用 */
  billingRules?: ContractBillingRule[]
  contractTerm?: ContractTermPreset
  currency: string
  signingDate: string
  effectiveDate: string
  expiryDate: string
  status: ServiceContractStatus
  /** 审批状态，缺省视为已通过（兼容旧数据） */
  approvalStatus?: ContractApprovalStatus
  submittedBy?: string
  submittedAt?: string
  approvedBy?: string
  approvedAt?: string
  approvalRemark?: string
  settlementCycle: SettlementCycle
  /** 按月：每月几号 */
  settlementDay?: number
  /** 按周：每周几（1=周一 … 7=周日） */
  settlementWeekday?: number
  /** 按季：季度内第几个月（1~3） */
  settlementQuarterMonth?: number
  /** 按季：该月几号 */
  settlementQuarterDay?: number
  /** @deprecated 已从合同表单移除，兼容旧数据 */
  ourSigningEntity?: string
  remark?: string
  attachments?: ContractAttachment[]
  operationLogs?: ContractOperationLog[]
  /** 当前生效版本号；0 表示尚无生效版本 */
  currentVersion?: number
  /** 版本记录（含历史 / 草稿 / 待审批） */
  versions?: ServiceContractVersion[]
  createdAt: string
  updatedAt: string
}

/** @deprecated 使用 ServiceContractVersionStatus */
export type ContractVersionRecordStatus = ServiceContractVersionStatus

// ── 培训考核 ──

export type TrainingMaterialType = 'video' | 'pdf' | 'article'
/** @deprecated 使用自定义分类 id / 名称，保留兼容旧枚举值 */
export type TrainingMaterialCategory =
  | 'info_security'
  | 'safety'
  | 'anti_fraud'
  | 'service'
  | 'emergency'
  | 'other'
export type TrainingMaterialStatus = 'draft' | 'approved'

/** 培训资料分类（可自定义增删改） */
export interface TrainingMaterialCategoryItem {
  id: string
  name: string
  /** null 表示平台通用分类 */
  enterpriseId: string | null
  builtin?: boolean
  createdAt: string
}

/** 培训资料 */
export interface TrainingMaterial {
  id: string
  name: string
  /**
   * 所属企业；`null` 表示平台通用培训资料（不挂企业）
   */
  enterpriseId: string | null
  type: TrainingMaterialType
  /** 资料分类（可选） */
  category?: string
  fileUrl: string
  fileName: string
  fileSize: number
  /** @deprecated 已移除标签录入 */
  tags?: string[]
  description?: string
  /** 部门范围：全部部门 / 指定部门 */
  departmentScope?: 'all' | 'department'
  departmentIds?: string[]
  status: TrainingMaterialStatus
  createdAt: string
  updatedAt: string
}

export type CourseStudyMode = 'sequential' | 'free'
export type CourseStatus = 'draft' | 'published' | 'offline' | 'closed'
export type CourseScopeType = 'all' | 'department' | 'tag'

/** 培训课程 */
export interface TrainingCourse {
  id: string
  name: string
  /**
   * 所属企业；`null` 表示平台通用课程（面向全体灵工）
   */
  enterpriseId: string | null
  coverUrl?: string
  description?: string
  materialIds: string[]
  studyMode: CourseStudyMode
  videoNoSeek: boolean
  minStudyMinutes?: number
  examId?: string
  /**
   * 下发范围：
   * - all：企业全体 / 通用课程则为全体灵工
   * - department：关联企业部门（仅企业课程）
   * - tag：按技能标签
   */
  scopeType: CourseScopeType
  /** 关联企业部门（scopeType=department） */
  scopeDepartmentIds?: string[]
  scopeTags?: string[]
  /** 考核通过后才可排班 / 抢班 */
  requireExamPassForSchedule?: boolean
  /** 考核通过后才可接任务 */
  requireExamPassForTask?: boolean
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
export type ExamStatus = 'draft' | 'published' | 'offline'

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
  /**
   * 所属企业；`null` 表示平台通用考核
   */
  enterpriseId: string | null
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
  offlineAt?: string
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
  /**
   * 历史考核打标：考核下架前已考过；重新考核后清除
   */
  historicalExam?: boolean
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

export type MiniMessageActionType =
  | 'schedule_confirm'
  | 'schedule_info'
  | 'income'
  | 'agreement'
  | 'info'

export interface MiniAppMessageScheduleDetail {
  enterpriseName: string
  groupName: string
  shiftLabel: string
  shiftTime: string
  date: string
  hourlyRate: number
  confirmBefore: string
  confirmStatus?: 'pending' | 'accepted' | 'rejected'
}

export interface MiniAppMessage {
  id: string
  employeeId: string
  category: MiniMessageCategory
  title: string
  content: string
  read: boolean
  createdAt: string
  actionType?: MiniMessageActionType
  scheduleDetail?: MiniAppMessageScheduleDetail
  agreementId?: string
}

export type WorkerIncomeStatus = 'pending_settlement' | 'claimable' | 'claimed'

/** hourly: 工时×单价；task: 任务×数量 */
export type WorkerIncomeCalcType = 'hourly' | 'task'

export interface WorkerIncomeDetailItem {
  id: string
  title: string
  date?: string
  unitPrice: number
  /** 工时（hourly）或任务数量（task） */
  quantity?: number
  calcType: WorkerIncomeCalcType
  amount: number
}

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
  claimBatchId?: string
  items?: WorkerIncomeDetailItem[]
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

/** 灵工与服务商签署的协议类型 */
export type WorkerAgreementType =
  | 'service'
  | 'dispatch'
  | 'privacy'
  | 'safety'
  | 'other'

export type WorkerAgreementStatus = 'pending' | 'signed' | 'expired' | 'terminated'

/** 灵工人员与服务商签署的协议 */
export interface WorkerAgreement {
  id: string
  employeeId: string
  /** 签署服务商；缺失时视为平台通用协议 */
  providerId?: string
  contractNo?: string
  title: string
  content: string
  agreementType?: WorkerAgreementType
  signed: boolean
  required: boolean
  signedAt?: string
  effectiveDate?: string
  expiryDate?: string
  status?: WorkerAgreementStatus
  createdAt?: string
}

export interface WorkerPaymentBinding {
  employeeId: string
  alipay?: string
  bankName?: string
  bankCardLast4?: string
}

export type WorkerFaceVerifyStatus = 'verified' | 'pending' | 'failed' | 'unverified'

export interface WorkerSchedulePreference {
  id: string
  weekdays: string[]
  startTime: string
  endTime: string
  variant?: 'weekday' | 'weekend'
}

/** 请假 / 不上岗：特定日期区间不可排班、不可指派任务 */
export interface WorkerUnavailablePeriod {
  id: string
  /** leave=请假 off=不上岗 */
  type: 'leave' | 'off'
  startDate: string
  endDate: string
  reason?: string
}

export interface WorkerPartTimePreference {
  favoriteJobs?: string
  wantedJobs?: string
  preferredBrands?: string
  /** 时段：night/both/day */
  timeOfDay?: 'left' | 'both' | 'right'
  /** 用工方式：flexible/both/fixed */
  commitment?: 'left' | 'both' | 'right'
  /** 班次时长：short/both/long */
  shiftDuration?: 'left' | 'both' | 'right'
  /** 工作日：holiday/both/weekday */
  workDays?: 'left' | 'both' | 'right'
}

export type WorkerBasicProofType = 'real_name' | 'health_cert'
export type WorkerBasicProofStatus = 'verified' | 'pending' | 'missing'

export interface WorkerBasicProof {
  type: WorkerBasicProofType
  status: WorkerBasicProofStatus
  expireAt?: string
}

export interface WorkerSkillCertificate {
  id: string
  name: string
  issuer?: string
  expireAt?: string
}

export interface WorkerProfileExt {
  employeeId: string
  level: string
  levelScore: number
  creditScore: number
  creditLevel: string
  certificates: { name: string; issuer: string; expireAt?: string }[]
  faceVerifyStatus?: WorkerFaceVerifyStatus
  faceVerifiedAt?: string
  permanentAddress?: string
  realName?: string
  idCardMasked?: string
  schedulePreferences?: WorkerSchedulePreference[]
  /** 请假/不上岗日期段 */
  unavailablePeriods?: WorkerUnavailablePeriod[]
  partTimePreference?: WorkerPartTimePreference
  basicProofs?: WorkerBasicProof[]
  skillCertificates?: WorkerSkillCertificate[]
  profileCompleteness?: number
}

/** 小程序登录账号（Demo 本地存储） */
export interface MiniAppAccount {
  phone: string
  password: string
  employeeId: string
}

/** 小程序登录会话 */
export interface MiniAppSession {
  employeeId: string
  phone: string
  onboardingComplete: boolean
  loggedInAt: string
}

// ── 提醒规则配置 ──

export type ReminderSceneCategory =
  | 'recruitment'
  | 'attendance'
  | 'schedule'
  | 'settlement'
  | 'insurance'
  | 'ops'

export type ReminderRuleStatus = 'active' | 'disabled'

export type ReminderLevel = 'urgent' | 'important' | 'normal'

export type ReminderChannel = 'todo' | 'inbox' | 'push' | 'sms'

export type ReminderTriggerMode = 'realtime' | 'scheduled' | 'delayed'

export type ReminderReceiverMode = 'role' | 'person' | 'dynamic'

export type ReminderConditionOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'contains'

/** 与上一条条件的逻辑连接（首条条件忽略） */
export type ReminderConditionLogic = 'and' | 'or'

export interface ReminderCondition {
  id: string
  field: string
  operator: ReminderConditionOperator
  value: string
  unit?: string
  /** 与上一条条件的关系：且 / 或，默认且 */
  logic?: ReminderConditionLogic
}

export interface ReminderRule {
  id: string
  name: string
  scene: ReminderSceneCategory
  description?: string
  status: ReminderRuleStatus
  /** 触发对象，如排班实例 */
  triggerTarget: string
  /** 数据来源，如考勤打卡记录 */
  dataSource: string
  conditions: ReminderCondition[]
  titleTemplate: string
  contentTemplate: string
  level: ReminderLevel
  channels: ReminderChannel[]
  receiverMode: ReminderReceiverMode
  receiverRole?: string
  ccRole?: string
  dynamicMatchHint?: string
  triggerMode: ReminderTriggerMode
  /** 定时触发：HH:mm */
  scheduleTime?: string
  /** 延时触发：分钟 */
  delayMinutes?: number
  quietStart?: string
  quietEnd?: string
  /** 频控窗口小时数 */
  rateLimitHours: number
  /** 窗口内最多触发次数 */
  rateLimitCount: number
  /** 空数组 / 含 all 表示全部企业 */
  enterpriseIds: string[]
  /** 空数组表示全部考勤组 */
  attendanceGroupIds: string[]
  effectiveFrom?: string
  effectiveTo?: string
  createdAt: string
  updatedAt: string
}
