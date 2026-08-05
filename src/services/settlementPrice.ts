import type {
  AttendanceGroup,
  AttendanceGroupSettlementOverride,
  Department,
  EnterpriseSettlementConfig,
  SettlementHourlyConfig,
  TaskType,
  TaskTypeSettlementOverride,
  VariablePriceConfig,
} from '@/types'
import {
  createDefaultVariablePrice,
  formatVariablePrice,
} from '@/constants/attendanceGroupPricing'
import { resolveEnterpriseIdByAttendanceGroup } from '@/utils/enterpriseScope'

export type SettlementPriceSource = 'enterprise' | 'custom'

export interface ResolvedHourlySettlement extends SettlementHourlyConfig {
  source: SettlementPriceSource
  sourceLabel: string
  dailySettlement: boolean
}

export interface ResolvedTaskSettlement {
  unitPrice: number
  source: SettlementPriceSource
  sourceLabel: string
  pricingNote?: string
}

export function createDefaultSettlementHourlyConfig(baseRate = 25): SettlementHourlyConfig {
  return {
    dayShiftRate: baseRate,
    nightShiftRate: Math.round(baseRate * 1.2 * 100) / 100,
    overtime: createDefaultVariablePrice('multiplier', 1.5),
    weekend: createDefaultVariablePrice('multiplier', 1.5),
    holiday: createDefaultVariablePrice('multiplier', 2),
  }
}

export function normalizeSettlementHourlyConfig(
  config: Partial<SettlementHourlyConfig> | undefined,
  baseRate = 25,
): SettlementHourlyConfig {
  const defaults = createDefaultSettlementHourlyConfig(baseRate)
  const dayShiftRate = config?.dayShiftRate ?? defaults.dayShiftRate
  return {
    dayShiftRate,
    nightShiftRate: config?.nightShiftRate ?? Math.round(dayShiftRate * 1.2 * 100) / 100,
    overtime: config?.overtime?.mode ? { ...config.overtime } : { ...defaults.overtime },
    weekend: config?.weekend?.mode ? { ...config.weekend } : { ...defaults.weekend },
    holiday: config?.holiday?.mode ? { ...config.holiday } : { ...defaults.holiday },
  }
}

export function normalizeEnterpriseSettlementConfig(
  config: Partial<EnterpriseSettlementConfig> & { enterpriseId: string },
): EnterpriseSettlementConfig {
  const hourly = normalizeSettlementHourlyConfig(config, config.dayShiftRate ?? 25)
  return {
    enterpriseId: config.enterpriseId,
    ...hourly,
    taskUnitPrice: config.taskUnitPrice ?? Math.round(hourly.dayShiftRate * 2),
    updatedAt: config.updatedAt ?? new Date().toISOString(),
  }
}

export function createDefaultEnterpriseSettlementConfig(
  enterpriseId: string,
  baseRate = 25,
): EnterpriseSettlementConfig {
  const hourly = createDefaultSettlementHourlyConfig(baseRate)
  return {
    enterpriseId,
    ...hourly,
    taskUnitPrice: Math.round(baseRate * 2),
    updatedAt: new Date().toISOString(),
  }
}

export function getAttendanceGroupsForEnterprise(
  enterpriseId: string,
  groups: AttendanceGroup[],
  departments: Department[],
): AttendanceGroup[] {
  return groups.filter(
    (g) => resolveEnterpriseIdByAttendanceGroup(g, departments) === enterpriseId,
  )
}

export function resolveHourlySettlementPrice(
  enterpriseId: string,
  attendanceGroupId: string,
  enterpriseConfigs: EnterpriseSettlementConfig[],
  overrides: AttendanceGroupSettlementOverride[],
): ResolvedHourlySettlement {
  const raw = enterpriseConfigs.find((c) => c.enterpriseId === enterpriseId)
  const fallback = normalizeEnterpriseSettlementConfig(
    raw ?? createDefaultEnterpriseSettlementConfig(enterpriseId),
  )
  const override = overrides.find(
    (o) => o.attendanceGroupId === attendanceGroupId && o.enterpriseId === enterpriseId,
  )

  if (override && !override.useEnterpriseDefault) {
    const hourly = normalizeSettlementHourlyConfig(
      {
        dayShiftRate: override.dayShiftRate ?? fallback.dayShiftRate,
        nightShiftRate: override.nightShiftRate ?? fallback.nightShiftRate,
        overtime: override.overtime ?? fallback.overtime,
        weekend: override.weekend ?? fallback.weekend,
        holiday: override.holiday ?? fallback.holiday,
      },
      override.dayShiftRate ?? fallback.dayShiftRate,
    )
    return {
      ...hourly,
      source: 'custom',
      sourceLabel: '考勤组定制',
      dailySettlement: override.dailySettlement ?? false,
    }
  }

  return {
    dayShiftRate: fallback.dayShiftRate,
    nightShiftRate: fallback.nightShiftRate,
    overtime: fallback.overtime,
    weekend: fallback.weekend,
    holiday: fallback.holiday,
    source: 'enterprise',
    sourceLabel: '企业默认',
    dailySettlement: override?.dailySettlement ?? false,
  }
}

export function resolveTaskSettlementPrice(
  enterpriseId: string,
  taskType: TaskType,
  enterpriseConfigs: EnterpriseSettlementConfig[],
  overrides: TaskTypeSettlementOverride[],
): ResolvedTaskSettlement {
  const enterprise = enterpriseConfigs.find((c) => c.enterpriseId === enterpriseId)
  const fallback = normalizeEnterpriseSettlementConfig(
    enterprise ?? createDefaultEnterpriseSettlementConfig(enterpriseId),
  )
  const override = overrides.find(
    (o) => o.taskTypeId === taskType.id && o.enterpriseId === enterpriseId,
  )

  if (override && !override.useEnterpriseDefault) {
    return {
      unitPrice: override.unitPrice ?? fallback.taskUnitPrice,
      source: 'custom',
      sourceLabel: '任务类型定制',
    }
  }

  if (taskType.pricingMode === 'fixed' && taskType.fixedPrice != null) {
    return {
      unitPrice: fallback.taskUnitPrice,
      source: 'enterprise',
      sourceLabel: '企业默认',
      pricingNote: `任务类型定价 ¥${taskType.fixedPrice}/单`,
    }
  }

  if (taskType.pricingMode === 'tiered' && taskType.tieredPrices?.length) {
    const first = taskType.tieredPrices[0]
    return {
      unitPrice: fallback.taskUnitPrice,
      source: 'enterprise',
      sourceLabel: '企业默认',
      pricingNote: `任务类型为阶梯计价（${first.minCount}-${first.maxCount === 999 ? '∞' : first.maxCount}单 ¥${first.unitPrice} 起）`,
    }
  }

  return {
    unitPrice: fallback.taskUnitPrice,
    source: 'enterprise',
    sourceLabel: '企业默认',
  }
}

export function formatVariablePriceShort(config: VariablePriceConfig): string {
  if (config.mode === 'fixed') return `¥${config.fixedAmount ?? 0}/h`
  return `${config.multiplier ?? 1}倍`
}

export function formatHourlySettlement(row: SettlementHourlyConfig) {
  return [
    `白班 ¥${row.dayShiftRate}/h`,
    `夜班 ¥${row.nightShiftRate}/h`,
    `加班 ${formatVariablePriceShort(row.overtime)}`,
    `周末 ${formatVariablePriceShort(row.weekend)}`,
    `节假日 ${formatVariablePriceShort(row.holiday)}`,
  ].join(' · ')
}

export function formatHourlySettlementDetail(row: SettlementHourlyConfig) {
  return [
    { label: '白班', value: `¥${row.dayShiftRate}/h` },
    { label: '夜班', value: `¥${row.nightShiftRate}/h` },
    { label: '加班', value: formatVariablePrice(row.overtime, row.dayShiftRate) },
    { label: '周末', value: formatVariablePrice(row.weekend, row.dayShiftRate) },
    { label: '节假日', value: formatVariablePrice(row.holiday, row.dayShiftRate) },
  ]
}

export function countCustomGroupOverrides(
  enterpriseId: string,
  overrides: AttendanceGroupSettlementOverride[],
): number {
  return overrides.filter((o) => o.enterpriseId === enterpriseId && !o.useEnterpriseDefault).length
}

export function countCustomTaskTypeOverrides(
  enterpriseId: string,
  overrides: TaskTypeSettlementOverride[],
): number {
  return overrides.filter((o) => o.enterpriseId === enterpriseId && !o.useEnterpriseDefault).length
}

export function settlementHourlyConfigFromResolved(
  resolved: ResolvedHourlySettlement,
): SettlementHourlyConfig {
  return {
    dayShiftRate: resolved.dayShiftRate,
    nightShiftRate: resolved.nightShiftRate,
    overtime: { ...resolved.overtime },
    weekend: { ...resolved.weekend },
    holiday: { ...resolved.holiday },
  }
}
