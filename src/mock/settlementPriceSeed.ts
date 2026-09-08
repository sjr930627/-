import type {
  AttendanceGroupSettlementOverride,
  DepartmentSettlementOverride,
  TaskTypeSettlementOverride,
} from '@/types'
import { createDefaultVariablePrice } from '@/constants/attendanceGroupPricing'

/** 按考勤组配置工时结算价（部门未单独配置时回退） */
export const seedAttendanceGroupSettlementOverrides: AttendanceGroupSettlementOverride[] = [
  {
    attendanceGroupId: 'ag_factory',
    enterpriseId: 'ent_stars_telecom',
    dailySettlement: true,
    autoSettlement: true,
    dayShiftRate: 38,
    nightShiftRate: 45,
    overtime: createDefaultVariablePrice('multiplier', 2),
    weekend: createDefaultVariablePrice('fixed', 55),
    holiday: createDefaultVariablePrice('multiplier', 2),
    updatedAt: '2026-07-18T14:00:00.000Z',
  },
  {
    attendanceGroupId: 'ag_logistics',
    enterpriseId: 'ent_stars_telecom',
    dailySettlement: false,
    dayShiftRate: 32,
    nightShiftRate: 38,
    overtime: createDefaultVariablePrice('multiplier', 1.5),
    weekend: createDefaultVariablePrice('multiplier', 1.5),
    holiday: createDefaultVariablePrice('multiplier', 2),
    updatedAt: '2026-07-16T10:00:00.000Z',
  },
  {
    attendanceGroupId: 'ag_hq',
    enterpriseId: 'ent_stars_telecom',
    dailySettlement: false,
    dayShiftRate: 28,
    nightShiftRate: 34,
    overtime: createDefaultVariablePrice('multiplier', 1.5),
    weekend: createDefaultVariablePrice('multiplier', 1.5),
    holiday: createDefaultVariablePrice('multiplier', 2),
    updatedAt: '2026-07-20T09:00:00.000Z',
  },
]

/** 按部门配置工时结算价（优先于考勤组） */
export const seedDepartmentSettlementOverrides: DepartmentSettlementOverride[] = [
  {
    departmentId: 'dept_prod_a',
    enterpriseId: 'ent_stars_telecom',
    dailySettlement: true,
    autoSettlement: true,
    dayShiftRate: 40,
    nightShiftRate: 48,
    overtime: createDefaultVariablePrice('multiplier', 2),
    weekend: createDefaultVariablePrice('fixed', 60),
    holiday: createDefaultVariablePrice('multiplier', 2),
    updatedAt: '2026-08-01T10:00:00.000Z',
  },
  {
    departmentId: 'dept_hr',
    enterpriseId: 'ent_stars_telecom',
    dailySettlement: false,
    dayShiftRate: 30,
    nightShiftRate: 36,
    overtime: createDefaultVariablePrice('multiplier', 1.5),
    weekend: createDefaultVariablePrice('multiplier', 1.5),
    holiday: createDefaultVariablePrice('multiplier', 2),
    updatedAt: '2026-08-02T09:00:00.000Z',
  },
]

/** 按任务类型配置灵工任务结算价 */
export const seedTaskTypeSettlementOverrides: TaskTypeSettlementOverride[] = [
  {
    taskTypeId: 'tt_5g_promo',
    enterpriseId: 'ent_china_mobile_agent',
    unitPrice: 48,
    updatedAt: '2026-07-12T10:00:00.000Z',
  },
  {
    taskTypeId: 'tt_insurance_dual',
    enterpriseId: 'ent_pingan_partner',
    unitPrice: 135,
    updatedAt: '2026-07-12T10:00:00.000Z',
  },
]

/** @deprecated 兼容旧本地缓存键 */
export const seedEnterpriseSettlementConfigs: import('@/types').EnterpriseSettlementConfig[] = []
