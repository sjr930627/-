import type {
  ContractBillingRuleType,
  ContractTermPreset,
  ESignPlatform,
  ProviderSignContractType,
  ServiceContract,
  ServiceContractStatus,
  ServiceFeeType,
  ServiceProviderStatus,
} from '@/types'

export const contractTermOptions: { value: ContractTermPreset; label: string }[] = [
  { value: '1y', label: '一年' },
  { value: '2y', label: '2年' },
  { value: '5y', label: '5年' },
  { value: 'long', label: '长期' },
]

export const settlementWeekdayOptions = [
  { value: 1, label: '周一' },
  { value: 2, label: '周二' },
  { value: 3, label: '周三' },
  { value: 4, label: '周四' },
  { value: 5, label: '周五' },
  { value: 6, label: '周六' },
  { value: 7, label: '周日' },
]

export const settlementQuarterMonthOptions = [
  { value: 1, label: '第1个月' },
  { value: 2, label: '第2个月' },
  { value: 3, label: '第3个月' },
]

export const billingRuleTypeMap: Record<
  ContractBillingRuleType,
  { label: string; desc: string }
> = {
  hourly: { label: '按工时计费', desc: '按实际出勤人时收取服务费' },
  task: { label: '按任务计费', desc: '按任务完成量或任务结算额收取服务费' },
}

export const serviceFeeTypeMap: Record<
  ServiceFeeType,
  { label: string; unit: string; tierUnit: string; desc: string }
> = {
  hourly: {
    label: '按人/小时',
    unit: '元/人/小时',
    tierUnit: '累计人时',
    desc: '按实际出勤人时数阶梯计价',
  },
  piece: {
    label: '按件/次',
    unit: '元/件（次）',
    tierUnit: '累计件数',
    desc: '按有效完成件数或次数固定金额计费',
  },
  percentage: {
    label: '按比例',
    unit: '%',
    tierUnit: '累计结算额（元）',
    desc: '按任务结算金额的百分比收取服务费',
  },
}

export const providerStatusMap: Record<
  ServiceProviderStatus,
  { label: string; type: 'success' | 'warning' | 'info' }
> = {
  cooperating: { label: '合作中', type: 'success' },
  suspended: { label: '已暂停', type: 'warning' },
  terminated: { label: '已终止', type: 'info' },
}

export const esignPlatformMap: Record<ESignPlatform, string> = {
  fadada: '法大大',
  tencent: '腾讯电子签',
  esign: 'e签宝',
  other: '其他平台',
}

export const providerSignContractTypeMap: Record<
  ProviderSignContractType,
  { label: string; desc: string }
> = {
  platform_cooperation: { label: '平台合作协议', desc: '服务商与灵工平台之间的主协议' },
  enterprise_service: { label: '企业服务协议', desc: '服务商代企业开展灵工业务的协议' },
  worker_dispatch: { label: '灵工派遣协议', desc: '灵工上岗前需签署的派遣/承揽协议' },
  privacy: { label: '隐私合规协议', desc: '数据安全与隐私保护相关协议' },
  other: { label: '其他协议', desc: '自定义补充协议' },
}

export const contractStatusMap: Record<
  ServiceContractStatus,
  { label: string; type: 'success' | 'warning' | 'info' | 'danger'; dot: string }
> = {
  active: { label: '生效中', type: 'success', dot: '#67c23a' },
  expiring: { label: '即将到期', type: 'warning', dot: '#e6a23c' },
  expired: { label: '已到期', type: 'info', dot: '#909399' },
  terminated: { label: '已终止', type: 'danger', dot: '#f56c6c' },
  draft: { label: '草稿', type: 'warning', dot: '#e6a23c' },
}

export const billingModeMap: Record<ServiceFeeType, { label: string; tagType: 'primary' | 'warning' | 'success' }> = {
  hourly: { label: '按工时计费', tagType: 'primary' },
  piece: { label: '按件/次计费', tagType: 'warning' },
  percentage: { label: '按比例计费', tagType: 'success' },
}

export function formatContractRate(feeType: ServiceFeeType, rate: number, chargeMethod: 'fixed' | 'percentage'): string {
  if (feeType === 'hourly') return `¥${rate.toFixed(2)} /人/工时`
  if (feeType === 'piece') return `¥${rate.toFixed(2)} /次/件`
  if (chargeMethod === 'percentage') return `${rate}% /次/件`
  return `¥${rate.toFixed(2)} /次/件`
}

export function resolveContractDisplayStatus(contract: {
  status: ServiceContractStatus
  expiryDate?: string
}): ServiceContractStatus {
  if (contract.status === 'terminated' || contract.status === 'draft') return contract.status
  if (!contract.expiryDate) return contract.status
  const today = new Date().toISOString().slice(0, 10)
  if (contract.expiryDate < today) return 'expired'
  const exp = new Date(contract.expiryDate)
  const now = new Date(today)
  const diffDays = (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  if (diffDays <= 30) return 'expiring'
  return 'active'
}

export function generateServiceProviderCode(seq: number) {
  return `SP-${String(seq).padStart(3, '0')}`
}

export function generateContractNo(seq: number) {
  const year = new Date().getFullYear()
  return `CT-${year}-${String(seq).padStart(5, '0')}`
}

export const settlementCycleMap = {
  weekly: '按周结算',
  monthly: '按月结算',
  quarterly: '按季结算',
  project: '按项目结算',
}

export function formatSettlementConfig(contract: ServiceContract): string {
  if (contract.settlementCycle === 'weekly') {
    const weekday =
      settlementWeekdayOptions.find((d) => d.value === contract.settlementWeekday)?.label ??
      '周一'
    return `按周结算 · 每${weekday}`
  }
  if (contract.settlementCycle === 'monthly') {
    return `按月结算 · 每月 ${contract.settlementDay ?? 15} 日`
  }
  if (contract.settlementCycle === 'quarterly') {
    const month =
      settlementQuarterMonthOptions.find((m) => m.value === contract.settlementQuarterMonth)
        ?.label ?? '第1个月'
    return `按季结算 · ${month} ${contract.settlementQuarterDay ?? 15} 日`
  }
  return settlementCycleMap[contract.settlementCycle]
}

export function formatContractExpiry(expiryDate: string, term?: ContractTermPreset): string {
  if (term === 'long' || expiryDate >= '2099-01-01') return '长期'
  return expiryDate
}

export function formatTierRange(
  feeType: ServiceFeeType,
  min: number,
  max?: number,
): string {
  const unit = serviceFeeTypeMap[feeType].tierUnit
  if (max === undefined) return `≥ ${formatQuantity(feeType, min)} ${unit}`
  return `${formatQuantity(feeType, min)} ~ ${formatQuantity(feeType, max)} ${unit}`
}

export function formatQuantity(feeType: ServiceFeeType, value: number): string {
  if (feeType === 'percentage') {
    if (value >= 10000) return `${(value / 10000).toFixed(value % 10000 === 0 ? 0 : 1)}万`
    return String(value)
  }
  return String(value)
}

export function formatRate(feeType: ServiceFeeType, rate: number): string {
  if (feeType === 'percentage') return `${rate}%`
  return `${rate} ${serviceFeeTypeMap[feeType].unit}`
}
