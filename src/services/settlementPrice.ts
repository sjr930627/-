import type {
  AttendanceGroup,
  AttendanceGroupSettlementOverride,
  Department,
  SettlementHourlyConfig,
  TaskType,
  TaskTypeSettlementOverride,
  VariablePriceConfig,
} from '@/types'
import {
  createDefaultVariablePrice,
  formatVariablePrice,
  getGroupPricingConfig,
} from '@/constants/attendanceGroupPricing'
import { formatTaskTypePrice } from '@/constants/task'
import { resolveEnterpriseIdByAttendanceGroup } from '@/utils/enterpriseScope'

export type SettlementPriceSource = 'worker' | 'unset'

export interface ResolvedHourlySettlement extends SettlementHourlyConfig {
  source: SettlementPriceSource
  sourceLabel: string
  dailySettlement: boolean
  /** 日结且开启自动结算时，无需人工确认工时 */
  autoSettlement: boolean
  /** 是否已在结算价管理中单独配置灵工结算价 */
  configured: boolean
}

export interface ResolvedTaskSettlement {
  unitPrice: number
  source: SettlementPriceSource
  sourceLabel: string
  configured: boolean
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

/** 考勤组自身配置的结算价（各考勤组可能不同） */
export function getAttendanceGroupBaseHourly(group: AttendanceGroup): SettlementHourlyConfig {
  const pricing = getGroupPricingConfig(group)
  return {
    dayShiftRate: pricing.dayShiftRate,
    nightShiftRate: pricing.nightShiftRate,
    overtime: { ...pricing.overtime },
    weekend: { ...pricing.weekend },
    holiday: { ...pricing.holiday },
  }
}

/** 任务类型自身定价文案 */
export function getTaskTypeBasePriceLabel(taskType: TaskType): string {
  return formatTaskTypePrice(taskType)
}

/** 任务类型参考单价（用于预填灵工结算价） */
export function getTaskTypeBaseUnitPrice(taskType: TaskType): number {
  if (taskType.pricingMode === 'fixed' && taskType.fixedPrice != null) {
    return taskType.fixedPrice
  }
  if (taskType.tieredPrices?.length) {
    return taskType.tieredPrices[0].unitPrice
  }
  return 0
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

function findGroupConfig(
  enterpriseId: string,
  attendanceGroupId: string,
  configs: AttendanceGroupSettlementOverride[],
): AttendanceGroupSettlementOverride | undefined {
  return configs.find(
    (o) => o.attendanceGroupId === attendanceGroupId && o.enterpriseId === enterpriseId,
  )
}

function findTaskTypeConfig(
  enterpriseId: string,
  taskTypeId: string,
  configs: TaskTypeSettlementOverride[],
): TaskTypeSettlementOverride | undefined {
  return configs.find((o) => o.taskTypeId === taskTypeId && o.enterpriseId === enterpriseId)
}

/** 是否已单独配置灵工工时结算价 */
export function isGroupHourlyConfigured(config?: AttendanceGroupSettlementOverride): boolean {
  if (!config || config.useEnterpriseDefault) return false
  return config.dayShiftRate != null && config.dayShiftRate >= 0
}

/** 是否已单独配置任务类型灵工结算价 */
export function isTaskTypeWorkerConfigured(config?: TaskTypeSettlementOverride): boolean {
  if (!config || config.useEnterpriseDefault) return false
  return config.unitPrice != null && config.unitPrice >= 0
}

/**
 * 解析灵工工时结算价：仅后台单独配置后才有真实灵工结算价；
 * 未配置时 configured=false，数值仅作占位（展示应以考勤组定价为准）。
 */
export function resolveHourlySettlementPrice(
  enterpriseId: string,
  attendanceGroupId: string,
  configs: AttendanceGroupSettlementOverride[],
  group?: AttendanceGroup,
): ResolvedHourlySettlement {
  const config = findGroupConfig(enterpriseId, attendanceGroupId, configs)
  if (isGroupHourlyConfigured(config)) {
    const hourly = normalizeSettlementHourlyConfig(
      {
        dayShiftRate: config!.dayShiftRate,
        nightShiftRate: config!.nightShiftRate,
        overtime: config!.overtime,
        weekend: config!.weekend,
        holiday: config!.holiday,
      },
      config!.dayShiftRate,
    )
    return {
      ...hourly,
      source: 'worker',
      sourceLabel: '灵工结算价',
      dailySettlement: config!.dailySettlement ?? false,
      autoSettlement: !!(config!.dailySettlement && config!.autoSettlement),
      configured: true,
    }
  }

  const fallback = group
    ? getAttendanceGroupBaseHourly(group)
    : createDefaultSettlementHourlyConfig()
  return {
    ...fallback,
    source: 'unset',
    sourceLabel: '未配置灵工价',
    dailySettlement: config?.dailySettlement ?? false,
    autoSettlement: !!(config?.dailySettlement && config?.autoSettlement),
    configured: false,
  }
}

export function resolveTaskTypeSettlementPrice(
  enterpriseId: string,
  taskType: TaskType,
  configs: TaskTypeSettlementOverride[],
): ResolvedTaskSettlement {
  const config = findTaskTypeConfig(enterpriseId, taskType.id, configs)
  if (isTaskTypeWorkerConfigured(config)) {
    return {
      unitPrice: config!.unitPrice!,
      source: 'worker',
      sourceLabel: '灵工结算价',
      configured: true,
    }
  }
  return {
    unitPrice: getTaskTypeBaseUnitPrice(taskType),
    source: 'unset',
    sourceLabel: '未配置灵工价',
    configured: false,
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

export function countConfiguredGroupSettlements(
  enterpriseId: string,
  configs: AttendanceGroupSettlementOverride[],
): number {
  return configs.filter((o) => o.enterpriseId === enterpriseId && isGroupHourlyConfigured(o)).length
}

export function countConfiguredTaskTypeSettlements(
  enterpriseId: string,
  configs: TaskTypeSettlementOverride[],
): number {
  return configs.filter((o) => o.enterpriseId === enterpriseId && isTaskTypeWorkerConfigured(o))
    .length
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
