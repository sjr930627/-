import type { AttendanceGroupPricingTemplate } from '@/types'
import { createDefaultPricingConfig } from '@/constants/attendanceGroupPricing'

export const seedPricingTemplates: AttendanceGroupPricingTemplate[] = [
  {
    id: 'ptpl_standard',
    name: '标准白班定价',
    config: {
      ...createDefaultPricingConfig(25),
      dayShiftPeriod: { startTime: '08:00', endTime: '18:00' },
      overtimeDefinition: '超出 8 小时标准工时部分视为加班',
    },
    createdAt: '2026-06-01T08:00:00.000Z',
    updatedAt: '2026-06-01T08:00:00.000Z',
  },
  {
    id: 'ptpl_station',
    name: '加油站三班定价',
    config: {
      ...createDefaultPricingConfig(38),
      dayShiftPeriod: { startTime: '08:00', endTime: '17:00' },
      nightShiftPeriod: { startTime: '17:00', endTime: '08:00' },
      nightShiftRate: 46,
      overtimeDefinition: '超出排班时段标准工时部分视为加班',
      weekend: { mode: 'multiplier', multiplier: 1.5 },
      holiday: { mode: 'multiplier', multiplier: 2 },
      overtime: { mode: 'multiplier', multiplier: 1.5 },
    },
    createdAt: '2026-06-05T08:00:00.000Z',
    updatedAt: '2026-06-05T08:00:00.000Z',
  },
  {
    id: 'ptpl_logistics',
    name: '物流弹性定价',
    config: {
      ...createDefaultPricingConfig(36),
      dayShiftPeriod: { startTime: '07:00', endTime: '19:00' },
      nightShiftPeriod: { startTime: '19:00', endTime: '07:00' },
      overtimeDefinition: '日累计超过 11 小时部分视为加班',
      weekend: { mode: 'fixed', fixedAmount: 54 },
      holiday: { mode: 'fixed', fixedAmount: 72 },
      overtime: { mode: 'multiplier', multiplier: 1.5 },
    },
    createdAt: '2026-06-10T08:00:00.000Z',
    updatedAt: '2026-06-10T08:00:00.000Z',
  },
]
