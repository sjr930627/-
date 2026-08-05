import type {
  AttendanceGroupSettlementOverride,
  EnterpriseSettlementConfig,
  TaskTypeSettlementOverride,
} from '@/types'
import { createDefaultEnterpriseSettlementConfig } from '@/services/settlementPrice'
import { createDefaultVariablePrice } from '@/constants/attendanceGroupPricing'

export const seedEnterpriseSettlementConfigs: EnterpriseSettlementConfig[] = [
  {
    ...createDefaultEnterpriseSettlementConfig('ent_stars_telecom', 28),
    taskUnitPrice: 55,
    updatedAt: '2026-07-01T08:00:00.000Z',
  },
  {
    ...createDefaultEnterpriseSettlementConfig('ent_china_mobile_agent', 38),
    taskUnitPrice: 50,
    updatedAt: '2026-07-10T09:00:00.000Z',
  },
  {
    ...createDefaultEnterpriseSettlementConfig('ent_pingan_partner', 32),
    taskUnitPrice: 120,
    updatedAt: '2026-06-20T10:00:00.000Z',
  },
  {
    ...createDefaultEnterpriseSettlementConfig('ent_china_telecom_agent', 30),
    taskUnitPrice: 40,
    updatedAt: '2026-07-05T11:00:00.000Z',
  },
  {
    ...createDefaultEnterpriseSettlementConfig('ent_unilever_partner', 26),
    taskUnitPrice: 35,
    updatedAt: '2026-07-15T08:00:00.000Z',
  },
  {
    ...createDefaultEnterpriseSettlementConfig('ent_huaxia_logistics', 24),
    taskUnitPrice: 30,
    updatedAt: '2026-06-28T08:00:00.000Z',
  },
]

export const seedAttendanceGroupSettlementOverrides: AttendanceGroupSettlementOverride[] = [
  {
    attendanceGroupId: 'ag_factory',
    enterpriseId: 'ent_stars_telecom',
    useEnterpriseDefault: false,
    dailySettlement: true,
    dayShiftRate: 38,
    nightShiftRate: 45,
    overtime: createDefaultVariablePrice('multiplier', 2),
    weekend: createDefaultVariablePrice('fixed', 55),
    updatedAt: '2026-07-18T14:00:00.000Z',
  },
  {
    attendanceGroupId: 'ag_logistics',
    enterpriseId: 'ent_stars_telecom',
    useEnterpriseDefault: false,
    dailySettlement: false,
    dayShiftRate: 32,
    nightShiftRate: 38,
    updatedAt: '2026-07-16T10:00:00.000Z',
  },
]

export const seedTaskTypeSettlementOverrides: TaskTypeSettlementOverride[] = [
  {
    taskTypeId: 'tt_insurance_dual',
    enterpriseId: 'ent_pingan_partner',
    useEnterpriseDefault: false,
    unitPrice: 135,
    updatedAt: '2026-07-12T10:00:00.000Z',
  },
]
