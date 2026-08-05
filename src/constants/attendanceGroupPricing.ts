import type {
  AttendanceGroup,
  AttendanceGroupPayRule,
  AttendanceGroupPricingConfig,
  AttendanceGroupPricingTemplate,
  FreePunchConfig,
  Holiday,
  TimePeriod,
  VariablePriceConfig,
} from '@/types'
import { getDateDemandKind } from '@/services/schedule'

export const DEFAULT_DAY_SHIFT_PERIOD: TimePeriod = {
  startTime: '08:00',
  endTime: '18:00',
}

function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + m
}

function minutesToTime(totalMinutes: number): string {
  const normalized = ((totalMinutes % (24 * 60)) + 24 * 60) % (24 * 60)
  const h = Math.floor(normalized / 60)
  const m = normalized % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

function isValidPeriod(period?: Partial<TimePeriod> | null): period is TimePeriod {
  return Boolean(period?.startTime && period?.endTime)
}

/** 24 小时内与白班/夜班时段互补的时段 */
export function getComplementPeriod(period: TimePeriod): TimePeriod {
  return {
    startTime: period.endTime,
    endTime: period.startTime,
  }
}

export function getPeriodDurationHours(period: TimePeriod): number {
  if (!isValidPeriod(period)) return 0
  const start = timeToMinutes(period.startTime)
  const end = timeToMinutes(period.endTime)
  let diff = end - start
  if (diff <= 0) diff += 24 * 60
  return Math.round((diff / 60) * 10) / 10
}

export function createDefaultFreePunchConfig(): FreePunchConfig {
  return {
    startTime: '08:00',
    endTime: '20:00',
    punchCountMode: 'clock_in_out',
  }
}

export function normalizeFreePunchConfig(config: FreePunchConfig): FreePunchConfig {
  const punchCountMode = config.punchCountMode ?? 'clock_in_out'
  return {
    startTime: config.startTime || '08:00',
    endTime: config.endTime || '20:00',
    punchCountMode,
    defaultWorkHours:
      punchCountMode === 'clock_in_only' ? config.defaultWorkHours ?? 8 : undefined,
  }
}

export function createDefaultVariablePrice(
  mode: VariablePriceConfig['mode'] = 'multiplier',
  value = 1.5,
): VariablePriceConfig {
  if (mode === 'fixed') {
    return { mode: 'fixed', fixedAmount: value }
  }
  return { mode: 'multiplier', multiplier: value }
}

export function createDefaultPricingConfig(baseRate = 25): AttendanceGroupPricingConfig {
  const dayShiftPeriod = { ...DEFAULT_DAY_SHIFT_PERIOD }
  return {
    dayShiftPeriod,
    nightShiftPeriod: getComplementPeriod(dayShiftPeriod),
    overtimeDefinition: '超出标准白班/夜班工时部分视为加班',
    dayShiftRate: baseRate,
    nightShiftRate: Math.round(baseRate * 1.2 * 100) / 100,
    weekend: createDefaultVariablePrice('multiplier', 1.5),
    holiday: createDefaultVariablePrice('multiplier', 2),
    overtime: createDefaultVariablePrice('multiplier', 1.5),
  }
}

export function normalizePricingConfig(
  config: AttendanceGroupPricingConfig,
): AttendanceGroupPricingConfig {
  const baseRate = config.dayShiftRate ?? 25
  const normalized: AttendanceGroupPricingConfig = {
    ...createDefaultPricingConfig(baseRate),
    ...config,
  }

  if (!isValidPeriod(normalized.dayShiftPeriod)) {
    if (normalized.dayShiftHours) {
      const startTime = DEFAULT_DAY_SHIFT_PERIOD.startTime
      normalized.dayShiftPeriod = {
        startTime,
        endTime: minutesToTime(timeToMinutes(startTime) + normalized.dayShiftHours * 60),
      }
    } else {
      normalized.dayShiftPeriod = { ...DEFAULT_DAY_SHIFT_PERIOD }
    }
  } else {
    normalized.dayShiftPeriod = { ...normalized.dayShiftPeriod }
  }

  normalized.nightShiftPeriod = getComplementPeriod(normalized.dayShiftPeriod)

  normalized.weekend = normalized.weekend?.mode
    ? { ...normalized.weekend }
    : createDefaultVariablePrice('multiplier', 1.5)
  normalized.holiday = normalized.holiday?.mode
    ? { ...normalized.holiday }
    : createDefaultVariablePrice('multiplier', 2)
  normalized.overtime = normalized.overtime?.mode
    ? { ...normalized.overtime }
    : createDefaultVariablePrice('multiplier', 1.5)

  if (!normalized.overtimeDefinition) {
    normalized.overtimeDefinition = '超出标准白班/夜班工时部分视为加班'
  }

  delete normalized.dayShiftHours
  delete normalized.nightShiftHours
  return normalized
}

export function clonePricingConfig(config: AttendanceGroupPricingConfig): AttendanceGroupPricingConfig {
  return normalizePricingConfig(JSON.parse(JSON.stringify(config)))
}

export function pricingConfigFromPayRule(payRule: AttendanceGroupPayRule): AttendanceGroupPricingConfig {
  return createDefaultPricingConfig(payRule.baseHourlyRate)
}

export const freePunchCountModeOptions = [
  { label: '仅上班打卡', value: 'clock_in_only' as const },
  { label: '上下班打卡', value: 'clock_in_out' as const },
]

export const pricingValueModeOptions = [
  { label: '固定金额', value: 'fixed' as const },
  { label: '倍数', value: 'multiplier' as const },
]

export function formatDayShiftPeriod(period: TimePeriod): string {
  return `${period.startTime} - ${period.endTime}`
}

export function formatNightShiftPeriod(period: TimePeriod): string {
  return `${period.startTime} - ${period.endTime}`
}

export function formatVariablePrice(
  config: VariablePriceConfig,
  baseRate: number,
  unit = '元/小时',
): string {
  if (config.mode === 'fixed') {
    return `${config.fixedAmount ?? 0} ${unit.replace('/小时', '')}`
  }
  return `${config.multiplier ?? 1} 倍（基准 ${baseRate} ${unit}）`
}

export function formatPricingTemplateSummary(template: AttendanceGroupPricingTemplate): string {
  const { config } = template
  return `白班 ${formatDayShiftPeriod(config.dayShiftPeriod)} · 夜班 ${formatNightShiftPeriod(config.nightShiftPeriod)} · ${config.dayShiftRate} 元/h`
}

export type ShiftPeriodKind = 'day' | 'night'

export interface ResolvedShiftHourlyRate {
  rate: number
  periodKind: ShiftPeriodKind
  dateKind: 'weekday' | 'weekend' | 'holiday'
  periodRate: number
  label: string
}

function normalizeTimeValue(time: string) {
  return time.slice(0, 5)
}

export function isMinuteInPeriod(minute: number, period: TimePeriod): boolean {
  const start = timeToMinutes(normalizeTimeValue(period.startTime))
  const end = timeToMinutes(normalizeTimeValue(period.endTime))
  if (start === end) return true
  if (start < end) return minute >= start && minute < end
  return minute >= start || minute < end
}

export function resolveShiftPeriodKind(
  startTime: string,
  config: AttendanceGroupPricingConfig,
): ShiftPeriodKind {
  const normalized = normalizePricingConfig(config)
  const minute = timeToMinutes(normalizeTimeValue(startTime))
  return isMinuteInPeriod(minute, normalized.dayShiftPeriod) ? 'day' : 'night'
}

export function applyVariablePrice(
  periodRate: number,
  variable: VariablePriceConfig,
  dayShiftRate: number,
): number {
  if (variable.mode === 'fixed') {
    return Math.round((variable.fixedAmount ?? periodRate) * 100) / 100
  }
  return Math.round(dayShiftRate * (variable.multiplier ?? 1) * 100) / 100
}

export function getGroupPricingConfig(group: AttendanceGroup): AttendanceGroupPricingConfig {
  if (group.pricingConfig) return normalizePricingConfig(group.pricingConfig)
  return createDefaultPricingConfig(group.payRule.baseHourlyRate)
}

export function resolveHourlyRateForShiftSlot(options: {
  group: AttendanceGroup
  date: string
  startTime: string
  holidays?: Holiday[]
}): ResolvedShiftHourlyRate {
  const { group, date, startTime, holidays = [] } = options
  const config = getGroupPricingConfig(group)
  const dateKind = getDateDemandKind(date, holidays)
  const periodKind = resolveShiftPeriodKind(startTime, config)
  const periodRate = periodKind === 'day' ? config.dayShiftRate : config.nightShiftRate

  let rate = periodRate
  if (dateKind === 'holiday') {
    rate = applyVariablePrice(periodRate, config.holiday, config.dayShiftRate)
  } else if (dateKind === 'weekend') {
    rate = applyVariablePrice(periodRate, config.weekend, config.dayShiftRate)
  }

  const periodLabel = periodKind === 'day' ? '白班' : '夜班'
  const dateLabel =
    dateKind === 'holiday' ? '节假日' : dateKind === 'weekend' ? '周末' : '平日'

  return {
    rate,
    periodKind,
    dateKind,
    periodRate,
    label: `${dateLabel}${periodLabel}`,
  }
}
