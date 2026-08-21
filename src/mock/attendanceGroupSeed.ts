import type { AttendanceGroup, AttendanceGroupVersionSnapshot } from '@/types'
import { createDefaultFreePunchConfig, createDefaultPricingConfig } from '@/constants/attendanceGroupPricing'
import { getDefaultScheduleRuleForSeed } from '@/services/scheduleGroup'
import { ensureGroupVersions } from '@/services/attendanceGroupVersion'

const defaultCompliance = {
  maxDailyHours: 12,
  maxWeeklyHours: 60,
  minShiftIntervalHours: 12,
  maxMonthlyHours: 260,
  maxConsecutiveWorkdays: 3,
}

type AttendanceGroupSeed = Omit<AttendanceGroup, 'currentVersion' | 'versions'>

const rawAttendanceGroups: AttendanceGroupSeed[] = [
  {
    id: 'ag_hq',
    code: 'HQ-ATT-001',
    name: '县区考勤组',
    description: '总部及县区办公人员排班考勤',
    status: 'enabled',
    attendanceType: 'shift',
    shiftTemplates: [
      {
        id: 'st_morning',
        name: '早班',
        startTime: '09:00',
        endTime: '18:00',
        breakRule: '上下午各休15分钟',
        workHours: 9,
        requiredHeadcount: 12,
        weekendRequiredHeadcount: 8,
        holidayRequiredHeadcount: 6,
      },
    ],
    gpsEnabled: true,
    gpsRadiusMeters: 500,
    punchLocations: [
      { id: 'loc_hq', name: '总部大楼', address: '北京市朝阳区' },
      { id: 'loc_rd', name: '研发中心', address: '北京市海淀区' },
    ],
    wifiEnabled: true,
    wifiName: 'HQ-Office-WiFi',
    qrcodeEnabled: true,
    compliance: { ...defaultCompliance },
    scheduleRule: getDefaultScheduleRuleForSeed({
      maxConsecutiveDays: 5,
      maxDailyHours: 9,
      maxWeeklyHours: 45,
      maxMonthlyHours: 176,
      minRestHours: 12,
      weekendWork: false,
    }),
    departmentBindings: [
      { departmentId: 'dept_hr', departmentName: '人事行政部', headcount: 12, managerName: '李娜' },
      { departmentId: 'dept_prod', departmentName: '生产部', headcount: 67, managerName: '张伟' },
    ],
    payRule: {
      baseHourlyRate: 25,
      nightShiftSubsidy: 5,
      nightShiftTimeRange: '22:00-06:00',
      holidaySubsidy: 50,
    },
    pricingConfig: createDefaultPricingConfig(25),
    minMonthlyOnlineHours: 176,
    attendanceArea: '总部大楼',
    createdAt: '2026-06-01T08:00:00.000Z',
    updatedAt: '2026-07-20T10:00:00.000Z',
  },
  {
    id: 'ag_factory',
    code: 'HQ-ATT-002',
    name: '中石化朝阳站考勤组',
    description: '中石化朝阳加油站三班倒考勤',
    status: 'enabled',
    attendanceType: 'shift',
    shiftTemplates: [
      { id: 'st_am', name: '早班', startTime: '08:00', endTime: '17:00', breakRule: '上下午各休15分钟', workHours: 9, requiredHeadcount: 31, weekendRequiredHeadcount: 24, holidayRequiredHeadcount: 18 },
      { id: 'st_pm', name: '中班', startTime: '14:00', endTime: '23:00', breakRule: '晚餐休30分钟', workHours: 9, requiredHeadcount: 24, weekendRequiredHeadcount: 20, holidayRequiredHeadcount: 15 },
      { id: 'st_night', name: '大晚班', startTime: '22:00', endTime: '07:00', breakRule: '夜宵休30分钟', workHours: 9, requiredHeadcount: 12, weekendRequiredHeadcount: 10, holidayRequiredHeadcount: 8 },
    ],
    gpsEnabled: true,
    gpsRadiusMeters: 300,
    punchLocations: [
      { id: 'loc_factory', name: '中石化朝阳加油站', address: '北京 · 朝阳区 · 望京西路88号' },
      { id: 'loc_hz_store', name: '中石化西湖加油站', address: '杭州 · 西湖区 · 文三路188号' },
    ],
    wifiEnabled: true,
    wifiName: 'ShiftStore-5G',
    qrcodeEnabled: true,
    compliance: { ...defaultCompliance, maxConsecutiveWorkdays: 6 },
    scheduleRule: getDefaultScheduleRuleForSeed({
      maxConsecutiveDays: 6,
      maxDailyHours: 11,
      maxWeeklyHours: 60,
      maxMonthlyHours: 260,
      minRestHours: 11,
      weekendWork: true,
      forbidNightShiftForFemale: true,
    }),
    departmentBindings: [
      { departmentId: 'dept_prod_a', departmentName: '中石化朝阳加油站', headcount: 20, managerName: '李娜' },
    ],
    payRule: {
      baseHourlyRate: 38,
      nightShiftSubsidy: 8,
      nightShiftTimeRange: '22:00-06:00',
      holidaySubsidy: 80,
    },
    pricingConfig: createDefaultPricingConfig(38),
    minMonthlyOnlineHours: 176,
    attendanceArea: '中石化朝阳加油站',
    createdAt: '2026-06-05T08:00:00.000Z',
    updatedAt: '2026-07-15T14:00:00.000Z',
  },
  {
    id: 'ag_logistics',
    code: 'HQ-ATT-003',
    name: '物流装卸组',
    description: '物流部弹性打卡',
    status: 'enabled',
    attendanceType: 'free',
    shiftTemplates: [],
    freePunchConfig: {
      ...createDefaultFreePunchConfig(),
      startTime: '07:00',
      endTime: '22:00',
      punchCountMode: 'clock_in_out',
    },
    gpsEnabled: true,
    gpsRadiusMeters: 800,
    punchLocations: [{ id: 'loc_log', name: '物流仓储中心', address: '物流部' }],
    wifiEnabled: true,
    wifiName: 'Logistics-WiFi',
    qrcodeEnabled: false,
    compliance: { ...defaultCompliance, maxDailyHours: 11 },
    scheduleRule: getDefaultScheduleRuleForSeed({
      maxConsecutiveDays: 4,
      maxDailyHours: 11,
      maxWeeklyHours: 55,
      maxMonthlyHours: 220,
      minRestHours: 10,
      weekendWork: true,
    }),
    departmentBindings: [
      { departmentId: 'dept_logistics', departmentName: '物流部', headcount: 3, managerName: '王强' },
    ],
    payRule: {
      baseHourlyRate: 36,
      nightShiftSubsidy: 6,
      nightShiftTimeRange: '22:00-06:00',
      holidaySubsidy: 60,
    },
    pricingConfig: createDefaultPricingConfig(36),
    attendanceArea: '不限区域',
    createdAt: '2026-06-10T08:00:00.000Z',
    updatedAt: '2026-07-10T09:00:00.000Z',
  },
  {
    id: 'ag_sales',
    code: 'HQ-ATT-004',
    name: '外勤推广组',
    description: '外勤灵工自由打卡，不计排班',
    status: 'enabled',
    attendanceType: 'free',
    shiftTemplates: [],
    freePunchConfig: {
      ...createDefaultFreePunchConfig(),
      startTime: '07:00',
      endTime: '22:00',
      punchCountMode: 'clock_in_only',
      defaultWorkHours: 8,
    },
    gpsEnabled: true,
    gpsRadiusMeters: 1000,
    punchLocations: [],
    wifiEnabled: false,
    qrcodeEnabled: true,
    compliance: { ...defaultCompliance, maxMonthlyHours: 200 },
    scheduleRule: getDefaultScheduleRuleForSeed({
      maxConsecutiveDays: 7,
      maxDailyHours: 10,
      maxWeeklyHours: 50,
      maxMonthlyHours: 200,
      minRestHours: 8,
      weekendWork: true,
    }),
    departmentBindings: [],
    payRule: {
      baseHourlyRate: 30,
      nightShiftSubsidy: 0,
      nightShiftTimeRange: '22:00-06:00',
      holidaySubsidy: 40,
    },
    pricingConfig: createDefaultPricingConfig(30),
    attendanceArea: '不限区域',
    createdAt: '2026-07-01T08:00:00.000Z',
    updatedAt: '2026-07-01T08:00:00.000Z',
  },
  {
    id: 'ag_admin',
    code: 'HQ-ATT-005',
    name: '管理岗考勤组',
    description: '管理层无需打卡，仅记录在线时长',
    status: 'disabled',
    attendanceType: 'none',
    shiftTemplates: [],
    gpsEnabled: false,
    gpsRadiusMeters: 500,
    punchLocations: [],
    wifiEnabled: false,
    qrcodeEnabled: false,
    compliance: { ...defaultCompliance },
    scheduleRule: getDefaultScheduleRuleForSeed(),
    departmentBindings: [
      { departmentId: 'dept_root', departmentName: '总公司', headcount: 5, managerName: '张管理员' },
    ],
    payRule: {
      baseHourlyRate: 50,
      nightShiftSubsidy: 0,
      nightShiftTimeRange: '22:00-06:00',
      holidaySubsidy: 0,
    },
    createdAt: '2026-05-01T08:00:00.000Z',
    updatedAt: '2026-07-05T11:00:00.000Z',
  },
]

function cloneSnapshot(snapshot: AttendanceGroupVersionSnapshot): AttendanceGroupVersionSnapshot {
  return JSON.parse(JSON.stringify(snapshot))
}

function enrichVersionHistory(group: AttendanceGroup): AttendanceGroup {
  if (group.id === 'ag_hq') {
    const current = group.versions[0]
    current.version = 3
    current.changeNote = '调整定价与白班时段'
    current.isActive = true
    group.currentVersion = 3

    const v2Snapshot = cloneSnapshot(current.snapshot)
    if (v2Snapshot.pricingConfig) {
      v2Snapshot.pricingConfig.dayShiftRate = 23
      v2Snapshot.pricingConfig.dayShiftPeriod = { startTime: '08:00', endTime: '17:00' }
      v2Snapshot.pricingConfig.nightShiftPeriod = { startTime: '17:00', endTime: '08:00' }
    }

    const v1Snapshot = cloneSnapshot(v2Snapshot)
    if (v1Snapshot.pricingConfig) {
      v1Snapshot.pricingConfig.dayShiftRate = 20
    }

    group.versions = [
      current,
      {
        id: 'agv_hq_2',
        version: 2,
        isActive: false,
        publishedAt: '2026-07-01T08:00:00.000Z',
        changeNote: '优化夜班单价',
        snapshot: v2Snapshot,
      },
      {
        id: 'agv_hq_1',
        version: 1,
        isActive: false,
        publishedAt: '2026-06-01T08:00:00.000Z',
        changeNote: '初始发布',
        snapshot: v1Snapshot,
      },
    ]
  }

  if (group.id === 'ag_factory') {
    const current = group.versions[0]
    current.version = 2
    current.changeNote = '新增大晚班配置'
    current.isActive = true
    group.currentVersion = 2

    const v1Snapshot = cloneSnapshot(current.snapshot)
    v1Snapshot.shiftTemplates = v1Snapshot.shiftTemplates.filter((s) => s.name !== '大晚班')

    group.versions = [
      current,
      {
        id: 'agv_factory_1',
        version: 1,
        isActive: false,
        publishedAt: '2026-06-05T08:00:00.000Z',
        changeNote: '初始发布',
        snapshot: v1Snapshot,
      },
    ]
  }

  return group
}

export const seedAttendanceGroups: AttendanceGroup[] = rawAttendanceGroups.map((item) => {
  const base = ensureGroupVersions(item as AttendanceGroup)
  if (item.attendanceType === 'none') {
    base.pricingConfig = undefined
  }
  return enrichVersionHistory(base)
})
