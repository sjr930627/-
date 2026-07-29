import type { ServiceContractStatus, ServiceFeeType, ServiceProviderStatus } from '@/types'

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

export const contractStatusMap: Record<
  ServiceContractStatus,
  { label: string; type: 'success' | 'warning' | 'info' }
> = {
  active: { label: '生效中', type: 'success' },
  expired: { label: '已到期', type: 'info' },
  draft: { label: '草稿', type: 'warning' },
}

export const settlementCycleMap = {
  monthly: '按月结算',
  weekly: '按周结算',
  project: '按项目结算',
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
