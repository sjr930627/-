import type {
  ContractBillingRule,
  ContractBillingRuleType,
  ContractTermPreset,
  FeeTier,
  ServiceContract,
  ServiceFeeType,
} from '@/types'

export function defaultHourlyTiers(): FeeTier[] {
  return [
    { id: 't1', minQuantity: 0, maxQuantity: 2000, rate: 18, label: '基础档' },
    { id: 't2', minQuantity: 2000, maxQuantity: undefined, rate: 15, label: '规模档' },
  ]
}

export function defaultTaskTiers(chargeMethod: 'fixed' | 'percentage'): FeeTier[] {
  if (chargeMethod === 'percentage') {
    return [
      { id: 't1', minQuantity: 0, maxQuantity: 500000, rate: 10, label: '标准档' },
      { id: 't2', minQuantity: 500000, maxQuantity: undefined, rate: 8, label: '大额档' },
    ]
  }
  return [
    { id: 't1', minQuantity: 0, maxQuantity: 1000, rate: 8, label: '基础档' },
    { id: 't2', minQuantity: 1000, maxQuantity: undefined, rate: 6.5, label: '规模档' },
  ]
}

export function defaultBillingRule(type: ContractBillingRuleType): ContractBillingRule {
  if (type === 'hourly') {
    return {
      type: 'hourly',
      chargeMethod: 'fixed',
      baseRate: 18,
      tiers: defaultHourlyTiers(),
    }
  }
  return {
    type: 'task',
    chargeMethod: 'percentage',
    baseRate: 10,
    tiers: defaultTaskTiers('percentage'),
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
  if (contract.billingRules?.length) return contract.billingRules
  if (contract.feeType === 'hourly') {
    return [
      {
        type: 'hourly',
        chargeMethod: contract.chargeMethod,
        baseRate: contract.baseRate,
        tiers: [...contract.tiers],
      },
    ]
  }
  if (contract.feeType === 'piece') {
    return [
      {
        type: 'task',
        chargeMethod: 'fixed',
        baseRate: contract.baseRate,
        tiers: [...contract.tiers],
      },
    ]
  }
  return [
    {
      type: 'task',
      chargeMethod: 'percentage',
      baseRate: contract.baseRate,
      tiers: [...contract.tiers],
    },
  ]
}

export function syncLegacyBillingFields(
  rules: ContractBillingRule[],
): Pick<ServiceContract, 'feeType' | 'chargeMethod' | 'baseRate' | 'tiers'> {
  const primary = rules[0]
  if (!primary) {
    return { feeType: 'hourly', chargeMethod: 'fixed', baseRate: 0, tiers: [] }
  }
  if (primary.type === 'hourly') {
    return {
      feeType: 'hourly',
      chargeMethod: primary.chargeMethod,
      baseRate: primary.baseRate,
      tiers: [...primary.tiers],
    }
  }
  return {
    feeType: primary.chargeMethod === 'percentage' ? 'percentage' : 'piece',
    chargeMethod: primary.chargeMethod,
    baseRate: primary.baseRate,
    tiers: [...primary.tiers],
  }
}

export function contractHasBillingType(
  contract: ServiceContract,
  type: ContractBillingRuleType,
): boolean {
  return getContractBillingRules(contract).some((r) => r.type === type)
}

export function formatBillingRuleRate(rule: ContractBillingRule): string {
  if (rule.type === 'hourly') {
    return rule.chargeMethod === 'percentage'
      ? `${rule.baseRate}% /人/工时`
      : `¥${rule.baseRate.toFixed(2)} /人/工时`
  }
  return rule.chargeMethod === 'percentage'
    ? `${rule.baseRate}% /任务`
    : `¥${rule.baseRate.toFixed(2)} /任务`
}

export function formatContractBillingSummary(contract: ServiceContract): string {
  return getContractBillingRules(contract).map(formatBillingRuleRate).join('；') || '—'
}

export interface ContractBillingListItem {
  type: ContractBillingRuleType
  typeLabel: string
  rateLabel: string
  chargeMethodLabel: string
}

const billingTypeLabels: Record<ContractBillingRuleType, string> = {
  hourly: '按工时计费',
  task: '按任务计费',
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
  if (feeType === 'hourly') return '按工时计费'
  if (feeType === 'piece') return '按任务计费'
  return '按比例计费'
}
