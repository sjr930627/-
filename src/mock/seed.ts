import type {
  AttendanceException,
  AttendancePunch,
  AttendanceRule,
  AttendanceStatus,
  Department,
  Employee,
  Holiday,
  IntegrationLog,
  LeaveRequest,
  MakeupPunchRequest,
  Notification,
  OvertimeRequest,
  PayrollConfig,
  ScheduleAssignment,
  SchedulePublishRecord,
  ScheduleRule,
  Shift,
  SwapRequest,
  Team,
} from '@/types'

export const defaultScheduleRule: ScheduleRule = {
  maxConsecutiveDays: 6,
  maxDailyHours: 11,
  maxWeeklyHours: 44,
  maxMonthlyHours: 176,
  minRestHours: 11,
  forbidNightShiftForFemale: false,
  weekendWork: false,
}

export const seedDepartments: Department[] = [
  { id: 'dept_root', name: '总公司', parentId: null, sort: 0 },
  { id: 'dept_hr', name: '人事行政部', parentId: 'dept_root', sort: 1 },
  { id: 'dept_prod', name: '生产部', parentId: 'dept_root', sort: 2 },
  { id: 'dept_prod_a', name: '中石化朝阳加油站', parentId: 'dept_prod', sort: 1 },
  { id: 'dept_prod_b', name: '生产二车间', parentId: 'dept_prod', sort: 2 },
  { id: 'dept_logistics', name: '物流部', parentId: 'dept_root', sort: 3 },
]

export const seedTeams: Team[] = [
  {
    id: 'team_a',
    name: '中石化朝阳站早班组',
    departmentId: 'dept_prod_a',
    attendanceGroupId: 'ag_factory',
    memberIds: ['emp_001', 'emp_002', 'emp_003', 'emp_004'],
    hourlyRate: 38,
    description: '负责中石化朝阳站早班加油及便利店服务',
  },
  {
    id: 'team_b',
    name: '中石化朝阳站晚班组',
    departmentId: 'dept_prod_a',
    attendanceGroupId: 'ag_factory',
    memberIds: ['emp_005', 'emp_006', 'emp_007'],
    hourlyRate: 45,
    description: '负责中石化朝阳站晚班加油及便利店服务',
  },
  {
    id: 'team_c',
    name: '物流装卸组',
    departmentId: 'dept_logistics',
    attendanceGroupId: 'ag_logistics',
    memberIds: ['emp_008', 'emp_009', 'emp_010'],
    hourlyRate: 36,
  },
]

export const seedEmployees: Employee[] = [
  {
    id: 'emp_001',
    name: '张伟',
    employeeNo: 'E1001',
    departmentId: 'dept_prod_a',
    position: '加油站营业员',
    hireDate: '2022-03-15',
    skills: ['叉车证'],
    preferredShiftIds: ['shift_morning'],
    unavailableDates: [],
    status: 'active',
    phone: '13800001001',
  },
  {
    id: 'emp_002',
    name: '李娜',
    employeeNo: 'E1002',
    departmentId: 'dept_prod_a',
    position: '班组长',
    hireDate: '2020-06-01',
    skills: ['高级技师', '急救证'],
    preferredShiftIds: ['shift_morning'],
    unavailableDates: [],
    status: 'active',
    phone: '13800001002',
  },
  {
    id: 'emp_003',
    name: '王强',
    employeeNo: 'E1003',
    departmentId: 'dept_prod_a',
    position: '操作工',
    hireDate: '2021-08-20',
    skills: [],
    preferredShiftIds: ['shift_afternoon'],
    unavailableDates: [],
    status: 'active',
  },
  {
    id: 'emp_004',
    name: '赵敏',
    employeeNo: 'E1004',
    departmentId: 'dept_prod_a',
    position: '质检员',
    hireDate: '2023-01-10',
    skills: ['质检员证'],
    preferredShiftIds: ['shift_morning'],
    unavailableDates: [],
    status: 'active',
  },
  {
    id: 'emp_005',
    name: '刘洋',
    employeeNo: 'E1005',
    departmentId: 'dept_prod_a',
    position: '操作工',
    hireDate: '2019-11-05',
    skills: ['叉车证'],
    preferredShiftIds: ['shift_night'],
    unavailableDates: [],
    status: 'active',
  },
  {
    id: 'emp_006',
    name: '陈静',
    employeeNo: 'E1006',
    departmentId: 'dept_prod_a',
    position: '操作工',
    hireDate: '2022-07-18',
    skills: [],
    preferredShiftIds: ['shift_night'],
    unavailableDates: [],
    status: 'active',
  },
  {
    id: 'emp_007',
    name: '杨帆',
    employeeNo: 'E1007',
    departmentId: 'dept_prod_a',
    position: '设备维护',
    hireDate: '2018-04-22',
    skills: ['电工证', '高级技师'],
    preferredShiftIds: ['shift_night'],
    unavailableDates: [],
    status: 'active',
  },
  {
    id: 'emp_008',
    name: '周杰',
    employeeNo: 'E1008',
    departmentId: 'dept_logistics',
    position: '装卸工',
    hireDate: '2021-02-14',
    skills: ['叉车证'],
    preferredShiftIds: ['shift_morning'],
    unavailableDates: [],
    status: 'active',
  },
  {
    id: 'emp_009',
    name: '吴婷',
    employeeNo: 'E1009',
    departmentId: 'dept_logistics',
    position: '调度员',
    hireDate: '2020-09-30',
    skills: [],
    preferredShiftIds: ['shift_afternoon'],
    unavailableDates: [],
    status: 'active',
  },
  {
    id: 'emp_010',
    name: '郑浩',
    employeeNo: 'E1010',
    departmentId: 'dept_logistics',
    position: '装卸工',
    hireDate: '2023-05-08',
    skills: [],
    preferredShiftIds: [],
    unavailableDates: [],
    status: 'active',
  },
]

export const seedShifts: Shift[] = [
  {
    id: 'shift_morning',
    name: '早班',
    code: 'MORNING',
    startTime: '08:00',
    endTime: '16:00',
    breakMinutes: 60,
    color: '#409EFF',
    isSpecial: false,
    description: '标准早班 8:00-16:00',
  },
  {
    id: 'shift_afternoon',
    name: '中班',
    code: 'AFTERNOON',
    startTime: '14:00',
    endTime: '22:00',
    breakMinutes: 60,
    color: '#67C23A',
    isSpecial: false,
    description: '标准中班 14:00-22:00',
  },
  {
    id: 'shift_night',
    name: '晚班',
    code: 'NIGHT',
    startTime: '22:00',
    endTime: '06:00',
    breakMinutes: 60,
    color: '#909399',
    isSpecial: false,
    description: '标准晚班 22:00-06:00',
  },
  {
    id: 'shift_overtime',
    name: '加班班',
    code: 'OVERTIME',
    startTime: '18:00',
    endTime: '22:00',
    breakMinutes: 0,
    color: '#E6A23C',
    isSpecial: true,
    description: '临时加班',
  },
  {
    id: 'shift_rest',
    name: '休息',
    code: 'REST',
    startTime: '00:00',
    endTime: '00:00',
    breakMinutes: 0,
    color: '#F2F6FC',
    isSpecial: true,
    description: '休息日',
  },
]

export const seedHolidays: Holiday[] = [
  { id: 'hol_001', name: '元旦', date: '2026-01-01', type: 'legal', isWorkday: false },
  { id: 'hol_002', name: '春节', date: '2026-02-17', type: 'legal', isWorkday: false },
  { id: 'hol_003', name: '春节调休', date: '2026-02-15', type: 'legal', isWorkday: true },
  { id: 'hol_004', name: '劳动节', date: '2026-05-01', type: 'legal', isWorkday: false },
  { id: 'hol_005', name: '公司周年庆', date: '2026-07-26', type: 'custom', isWorkday: false },
]

export const seedAssignments: ScheduleAssignment[] = []
export const seedPublishRecords: SchedulePublishRecord[] = []
export const seedNotifications: Notification[] = []

// --- Phase 2 seed ---

export const defaultAttendanceRule: AttendanceRule = {
  flexMinutesBefore: 15,
  flexMinutesAfter: 10,
  requireLocation: true,
  allowedRadiusMeters: 500,
  maxMakeupPerMonth: 5,
}

function buildJulyAssignments(): ScheduleAssignment[] {
  const pattern = ['shift_morning', 'shift_morning', 'shift_morning', 'shift_morning', 'shift_morning', 'shift_rest', 'shift_rest']
  const members = ['emp_001', 'emp_002', 'emp_003', 'emp_004']
  const confirmCycle: ScheduleAssignment['confirmStatus'][] = ['confirmed', 'pending', 'confirming', 'rejected']
  const items: ScheduleAssignment[] = []
  for (let day = 1; day <= 31; day += 1) {
    const date = `2026-07-${String(day).padStart(2, '0')}`
    members.forEach((employeeId, idx) => {
      const shiftId = pattern[(day - 1 + idx) % pattern.length]
      items.push({
        id: `asn_seed_${employeeId}_${date}`,
        employeeId,
        shiftId,
        date,
        teamId: 'team_a',
        published: day <= 20,
        confirmStatus: confirmCycle[(day + idx) % confirmCycle.length],
        manualEdited: day > 18 && day <= 20,
      })
    })
  }
  return items
}

export const seedAssignmentsWithDemo: ScheduleAssignment[] = (() => {
  const items = buildJulyAssignments()
  // Demo 锚定日：emp_001 早班（工作台默认展示未打卡，便于演示打卡流程）
  const demoAsn = items.find((a) => a.employeeId === 'emp_001' && a.date === '2026-07-27')
  if (demoAsn) {
    demoAsn.shiftId = 'shift_morning'
    demoAsn.confirmStatus = 'confirmed'
    demoAsn.published = true
  }
  return items
})()

export const seedPunches: AttendancePunch[] = [
  { id: 'punch_001', employeeId: 'emp_001', date: '2026-07-24', time: '08:12', type: 'clock_in', source: 'mobile', location: '中石化朝阳加油站', inRange: true },
  { id: 'punch_002', employeeId: 'emp_001', date: '2026-07-24', time: '15:55', type: 'clock_out', source: 'mobile', location: '中石化朝阳加油站', inRange: true },
  { id: 'punch_003', employeeId: 'emp_002', date: '2026-07-24', time: '08:05', type: 'clock_in', source: 'mobile', location: '中石化朝阳加油站', inRange: true },
  { id: 'punch_004', employeeId: 'emp_002', date: '2026-07-24', time: '16:00', type: 'clock_out', source: 'mobile', location: '中石化朝阳加油站', inRange: true },
  { id: 'punch_005', employeeId: 'emp_003', date: '2026-07-24', time: '08:03', type: 'clock_in', source: 'mobile', location: '中石化朝阳加油站', inRange: true },
  { id: 'punch_006', employeeId: 'emp_004', date: '2026-07-24', time: '08:45', type: 'clock_in', source: 'mobile', location: '厂区外', inRange: false },
  { id: 'punch_007', employeeId: 'emp_004', date: '2026-07-24', time: '16:02', type: 'clock_out', source: 'mobile', location: '中石化朝阳加油站', inRange: true },
  { id: 'punch_008', employeeId: 'emp_001', date: '2026-07-25', time: '08:06', type: 'clock_in', source: 'mobile', location: '中石化朝阳加油站', inRange: true },
  { id: 'punch_009', employeeId: 'emp_002', date: '2026-07-25', time: '08:04', type: 'clock_in', source: 'access_control', location: '中石化朝阳加油站', inRange: true },
  { id: 'punch_010', employeeId: 'emp_002', date: '2026-07-25', time: '15:58', type: 'clock_out', source: 'access_control', location: '中石化朝阳加油站', inRange: true },
]

export const seedLeaveRequests: LeaveRequest[] = [
  {
    id: 'leave_001',
    employeeId: 'emp_003',
    leaveType: 'sick',
    startDate: '2026-07-26',
    endDate: '2026-07-27',
    reason: '感冒发烧，需要休息',
    status: 'pending',
    createdAt: '2026-07-25T18:30:00.000Z',
  },
  {
    id: 'leave_002',
    employeeId: 'emp_001',
    leaveType: 'annual',
    startDate: '2026-07-10',
    endDate: '2026-07-10',
    reason: '个人事务',
    status: 'approved',
    createdAt: '2026-07-08T10:00:00.000Z',
    reviewedBy: '排班员',
    reviewedAt: '2026-07-08T14:00:00.000Z',
    reviewNote: '同意',
  },
]

export const seedSwapRequests: SwapRequest[] = [
  {
    id: 'swap_001',
    applicantId: 'emp_004',
    targetEmployeeId: 'emp_002',
    date: '2026-07-28',
    reason: '28日有家庭聚会，申请与李娜换班',
    status: 'pending',
    createdAt: '2026-07-25T20:00:00.000Z',
  },
]

export const seedMakeupRequests: MakeupPunchRequest[] = [
  {
    id: 'makeup_001',
    employeeId: 'emp_003',
    date: '2026-07-23',
    punchType: 'clock_out',
    time: '16:01',
    reason: '手机没电未能打下班卡',
    status: 'pending',
    createdAt: '2026-07-24T09:00:00.000Z',
  },
]

export const seedExceptions: AttendanceException[] = []

export const seedManualOverrides: Record<string, AttendanceStatus> = {}

export const seedPublishRecordsWithDemo: SchedulePublishRecord[] = [
  {
    id: 'pub_seed_001',
    month: '2026-07',
    teamId: 'team_a',
    publishedAt: '2026-07-01T08:00:00.000Z',
    publishedBy: '排班员',
    employeeCount: 4,
    assignmentCount: 100,
  },
]

// --- Phase 3 seed ---

export const defaultPayrollConfig: PayrollConfig = {
  defaultHourlyRate: 35,
  weekdayOvertimeMultiplier: 1.5,
  weekendOvertimeMultiplier: 2,
  holidayOvertimeMultiplier: 3,
  erpSystemName: '金蝶 K/3',
  erpEndpoint: 'https://erp.example.com/api/payroll/import',
}

export const seedOvertimeRequests: OvertimeRequest[] = [
  {
    id: 'ot_001',
    employeeId: 'emp_001',
    date: '2026-07-20',
    startTime: '18:00',
    endTime: '22:00',
    overtimeType: 'weekday',
    hours: 4,
    reason: '订单加急，需完成出货',
    compensation: 'pay',
    status: 'approved',
    createdAt: '2026-07-19T16:00:00.000Z',
    reviewedBy: '排班员',
    reviewedAt: '2026-07-19T17:00:00.000Z',
    reviewNote: '同意加班',
  },
  {
    id: 'ot_002',
    employeeId: 'emp_005',
    date: '2026-07-27',
    startTime: '06:00',
    endTime: '10:00',
    overtimeType: 'weekend',
    hours: 4,
    reason: '设备检修',
    compensation: 'time_off',
    status: 'pending',
    createdAt: '2026-07-25T21:00:00.000Z',
  },
]

export const seedIntegrationLogs: IntegrationLog[] = [
  {
    id: 'log_001',
    type: 'payroll',
    action: '导出薪酬 CSV',
    status: 'success',
    recordCount: 10,
    createdAt: '2026-07-01T10:00:00.000Z',
    message: '2026-06 月度薪酬数据已导出',
  },
]
