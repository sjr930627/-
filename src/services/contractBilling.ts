import type {
  ContractBillingRule,
  ContractBillingRuleType,
  ContractServiceFeeCategory,
  ContractServiceFeeItem,
  ContractTermPreset,
  FeeTier,
  ServiceContract,
  ServiceFeeType,
} from '@/types'
import { contractServiceFeeCategoryMap } from '@/constants/partnership'

export function defaultHourlyTiers(): FeeTier[] {
  return []
}

export function defaultTaskTiers(_chargeMethod: 'fixed' | 'percentage'): FeeTier[] {
  return []
}

export function serviceFeeCategoriesForType(
  type: ContractBillingRuleType,
): ContractServiceFeeCategory[] {
  return type === 'hourly' ? ['recruitment', 'management', 'grab'] : ['recruitment', 'management']
}

export function defaultServiceFees(
  type: ContractBillingRuleType,
  chargeMethod: 'fixed' | 'percentage' = type === 'hourly' ? 'fixed' : 'percentage',
): ContractServiceFeeItem[] {
  if (type === 'hourly') {
    const rates =
      chargeMethod === 'percentage'
        ? { recruitment: 3, management: 4, grab: 2 }
        : { recruitment: 6, management: 8, grab: 4 }
    return serviceFeeCategoriesForType('hourly').map((category) => ({
      category,
      rate: rates[category],
    }))
  }
  const rates =
    chargeMethod === 'percentage'
      ? { recruitment: 4, management: 6 }
      : { recruitment: 3, management: 5 }
  return serviceFeeCategoriesForType('task').map((category) => ({
    category,
    rate: rates[category as 'recruitment' | 'management'],
  }))
}

export function sumServiceFeeRates(fees: ContractServiceFeeItem[] | undefined): number {
  return (fees ?? []).reduce((sum, item) => sum + (Number(item.rate) || 0), 0)
}

/** 补齐分项；旧数据仅有 baseRate 时归入管理服务 */
export function ensureServiceFees(rule: ContractBillingRule): ContractServiceFeeItem[] {
  const categories = serviceFeeCategoriesForType(rule.type)
  if (rule.serviceFees?.length) {
    return categories.map((category) => {
      const found = rule.serviceFees!.find((f) => f.category === category)
      return { category, rate: Math.max(0, Number(found?.rate) || 0) }
    })
  }
  const legacy = Math.max(0, Number(rule.baseRate) || 0)
  return categories.map((category) => ({
    category,
    rate: category === 'management' ? legacy : 0,
  }))
}

export function withSyncedServiceFees(rule: ContractBillingRule): ContractBillingRule {
  const serviceFees = ensureServiceFees(rule)
  return {
    ...rule,
    serviceFees,
    baseRate: sumServiceFeeRates(serviceFees),
    tiers: [],
    serviceFeeIncludesTax: rule.serviceFeeIncludesTax ?? false,
    unitPriceIncludesTax: rule.unitPriceIncludesTax ?? false,
  }
}

export function defaultBillingRule(type: ContractBillingRuleType): ContractBillingRule {
  if (type === 'hourly') {
    const serviceFees = defaultServiceFees('hourly', 'fixed')
    return {
      type: 'hourly',
      chargeMethod: 'fixed',
      baseRate: sumServiceFeeRates(serviceFees),
      tiers: [],
      serviceFeeIncludesTax: false,
      unitPriceIncludesTax: false,
      serviceFees,
    }
  }
  const serviceFees = defaultServiceFees('task', 'percentage')
  return {
    type: 'task',
    chargeMethod: 'percentage',
    baseRate: sumServiceFeeRates(serviceFees),
    tiers: [],
    serviceFeeIncludesTax: false,
    unitPriceIncludesTax: false,
    serviceFees,
  }
}

export function calcExpiryFromTerm(effectiveDate: string, term: ContractTermPreset): string {
  if (term === 'long') return '2099-12-31'
  const d = new Date(`${effectiveDate}T00:00:00`)
  const years = term === '1y' ? 1 : term === '2y' ? 2 : 5
  d.setFullYear(d.getFullYear() + years)
  d.setDate(d.getDate() - 1)
  return d.toISOString().slice(0, 10)
}

export function inferContractTerm(
  effectiveDate: string,
  expiryDate?: string,
): ContractTermPreset {
  if (!expiryDate || expiryDate >= '2099-01-01') return 'long'
  const start = new Date(`${effectiveDate}T00:00:00`)
  const end = new Date(`${expiryDate}T00:00:00`)
  const diffYears = (end.getTime() - start.getTime()) / (365.25 * 24 * 3600 * 1000)
  if (diffYears >= 4.5) return '5y'
  if (diffYears >= 1.5) return '2y'
  return '1y'
}

export function getContractBillingRules(contract: ServiceContract): ContractBillingRule[] {
  if (contract.billingRules?.length) {
    return contract.billingRules.map((rule) => withSyncedServiceFees(rule))
  }
  if (contract.feeType === 'hourly') {
    return [
      withSyncedServiceFees({
        type: 'hourly',
        chargeMethod: contract.chargeMethod,
        baseRate: contract.baseRate,
        tiers: [],
      }),
    ]
  }
  if (contract.feeType === 'piece') {
    return [
      withSyncedServiceFees({
        type: 'task',
        chargeMethod: 'fixed',
        baseRate: contract.baseRate,
        tiers: [],
      }),
    ]
  }
  return [
    withSyncedServiceFees({
      type: 'task',
      chargeMethod: 'percentage',
      baseRate: contract.baseRate,
      tiers: [],
    }),
  ]
}

export function syncLegacyBillingFields(
  rules: ContractBillingRule[],
): Pick<ServiceContract, 'feeType' | 'chargeMethod' | 'baseRate' | 'tiers'> {
  const primary = rules[0]
  if (!primary) {
    return { feeType: 'hourly', chargeMethod: 'fixed', baseRate: 0, tiers: [] }
  }
  const synced = withSyncedServiceFees(primary)
  if (synced.type === 'hourly') {
    return {
      feeType: 'hourly',
      chargeMethod: synced.chargeMethod,
      baseRate: synced.baseRate,
      tiers: [],
    }
  }
  return {
    feeType: synced.chargeMethod === 'percentage' ? 'percentage' : 'piece',
    chargeMethod: synced.chargeMethod,
    baseRate: synced.baseRate,
    tiers: [],
  }
}

export function contractHasBillingType(
  contract: ServiceContract,
  type: ContractBillingRuleType,
): boolean {
  return getContractBillingRules(contract).some((r) => r.type === type)
}

function formatFeeRateValue(
  rate: number,
  chargeMethod: 'fixed' | 'percentage',
  type: ContractBillingRuleType,
): string {
  if (chargeMethod === 'percentage') return `${rate}%`
  return type === 'hourly' ? `¥${rate.toFixed(2)}/人/工时` : `¥${rate.toFixed(2)}/任务`
}

export function formatServiceFeeRateValue(
  rate: number,
  chargeMethod: 'fixed' | 'percentage',
  type: ContractBillingRuleType,
): string {
  return formatFeeRateValue(rate, chargeMethod, type)
}

export function formatServiceFeeItem(
  item: ContractServiceFeeItem,
  chargeMethod: 'fixed' | 'percentage',
  type: ContractBillingRuleType,
): string {
  const label = contractServiceFeeCategoryMap[item.category].shortLabel
  return `${label} ${formatFeeRateValue(item.rate, chargeMethod, type)}`
}

export function formatBillingRuleRate(rule: ContractBillingRule): string {
  const synced = withSyncedServiceFees(rule)
  const parts = synced.serviceFees!
    .filter((f) => f.rate > 0)
    .map((f) => formatServiceFeeItem(f, synced.chargeMethod, synced.type))
  if (parts.length) return parts.join(' · ')
  return synced.chargeMethod === 'percentage'
    ? `0% /${synced.type === 'hourly' ? '人/工时' : '任务'}`
    : `¥0.00 /${synced.type === 'hourly' ? '人/工时' : '任务'}`
}

export function formatTaxIncludedLabel(includesTax?: boolean): string {
  return includesTax ? '含税' : '不含税'
}

export function unitPriceTaxFieldLabel(type: ContractBillingRuleType): string {
  return type === 'hourly' ? '工时单价是否含税' : '任务单价是否含税'
}

export function formatContractBillingSummary(contract: ServiceContract): string {
  return getContractBillingRules(contract)
    .map((rule) => {
      const typeLabel = rule.type === 'hourly' ? '工时' : '任务'
      return `${typeLabel}：${formatBillingRuleRate(rule)}`
    })
    .join('；') || '—'
}

export interface ContractBillingListItem {
  type: ContractBillingRuleType
  typeLabel: string
  rateLabel: string
  chargeMethodLabel: string
}

const billingTypeLabels: Record<ContractBillingRuleType, string> = {
  hourly: '服务费工时',
  task: '任务服务费',
}

export function getContractBillingListItems(contract: ServiceContract): ContractBillingListItem[] {
  return getContractBillingRules(contract).map((rule) => ({
    type: rule.type,
    typeLabel: billingTypeLabels[rule.type],
    rateLabel: formatBillingRuleRate(rule),
    chargeMethodLabel: rule.chargeMethod === 'fixed' ? '固定金额' : '比率',
  }))
}

export function contractHasBothBillingTypes(contract: ServiceContract): boolean {
  return contractHasBillingType(contract, 'hourly') && contractHasBillingType(contract, 'task')
}

export function getContractBillingRule(
  contract: ServiceContract,
  type: ContractBillingRuleType,
): ContractBillingRule | undefined {
  return getContractBillingRules(contract).find((r) => r.type === type)
}

export function billingRuleTierUnit(type: ContractBillingRuleType): string {
  return type === 'hourly' ? '元/人/工时' : '元/任务'
}

export function billingRuleTierRateUnit(
  type: ContractBillingRuleType,
  chargeMethod: 'fixed' | 'percentage',
): string {
  if (chargeMethod === 'percentage') return '%'
  return billingRuleTierUnit(type)
}

export function formatBillingRuleTierRange(
  rule: ContractBillingRule,
  min: number,
  max?: number,
): string {
  const unit = rule.type === 'hourly' ? '累计人时' : '累计任务量'
  if (max === undefined) return `≥ ${min} ${unit}`
  return `${min} ~ ${max} ${unit}`
}

export function legacyFeeTypeLabel(feeType: ServiceFeeType): string {
  if (feeType === 'hourly') return '服务费工时'
  if (feeType === 'piece') return '任务服务费'
  return '按比例计费'
}

export function getServiceFeeItem(
  rule: ContractBillingRule,
  category: ContractServiceFeeCategory,
): ContractServiceFeeItem {
  return (
    ensureServiceFees(rule).find((f) => f.category === category) ?? {
      category,
      rate: 0,
    }
  )
}
