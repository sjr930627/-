import type {
  ContractBillingRule,
  ContractTermPreset,
  FeeTier,
  ServiceContract,
  ServiceContractVersion,
  ServiceFeeType,
  SettlementCycle,
} from '@/types'
import { generateId } from '@/utils'
import { getContractBillingRules, syncLegacyBillingFields } from '@/services/contractBilling'

export type ContractConfigSnapshot = {
  name: string
  feeType: ServiceFeeType
  chargeMethod: 'fixed' | 'percentage'
  baseRate: number
  tiers: FeeTier[]
  billingRules?: ContractBillingRule[]
  contractTerm?: ContractTermPreset
  currency: string
  signingDate: string
  effectiveDate: string
  expiryDate: string
  settlementCycle: SettlementCycle
  settlementDay?: number
  settlementWeekday?: number
  settlementQuarterMonth?: number
  settlementQuarterDay?: number
  ourSigningEntity?: string
  remark?: string
}

export function pickContractConfig(source: ContractConfigSnapshot): ContractConfigSnapshot {
  const billingRules = getContractBillingRules(source as ServiceContract)
  const legacy = syncLegacyBillingFields(billingRules)
  return {
    name: source.name,
    ...legacy,
    billingRules,
    contractTerm: source.contractTerm,
    currency: source.currency || 'CNY',
    signingDate: source.signingDate,
    effectiveDate: source.effectiveDate,
    expiryDate: source.expiryDate,
    settlementCycle: source.settlementCycle,
    settlementDay: source.settlementDay,
    settlementWeekday: source.settlementWeekday,
    settlementQuarterMonth: source.settlementQuarterMonth,
    settlementQuarterDay: source.settlementQuarterDay,
    ourSigningEntity: source.ourSigningEntity || undefined,
    remark: source.remark,
  }
}

export function applyContractConfig(
  contract: ServiceContract,
  config: ContractConfigSnapshot,
): void {
  Object.assign(contract, pickContractConfig(config))
}

export function createContractVersion(
  contract: ServiceContract,
  status: ServiceContractVersion['status'],
  extras?: Partial<
    Pick<
      ServiceContractVersion,
      | 'changeNote'
      | 'submittedBy'
      | 'submittedAt'
      | 'approvedBy'
      | 'approvedAt'
      | 'approvalRemark'
    >
  > & { config?: ContractConfigSnapshot },
): ServiceContractVersion {
  const versions = contract.versions ?? []
  const nextVersion =
    versions.reduce((max, v) => Math.max(max, v.version), 0) + 1 || 1
  const now = new Date().toISOString()
  const config = extras?.config ?? pickContractConfig(contract)
  return {
    id: generateId('scv'),
    version: nextVersion,
    status,
    ...pickContractConfig(config),
    submittedBy: extras?.submittedBy ?? contract.submittedBy,
    submittedAt: extras?.submittedAt ?? contract.submittedAt,
    approvedBy: extras?.approvedBy ?? contract.approvedBy,
    approvedAt: extras?.approvedAt ?? contract.approvedAt,
    approvalRemark: extras?.approvalRemark ?? contract.approvalRemark,
    changeNote: extras?.changeNote,
    createdAt: now,
    updatedAt: now,
  }
}

/** 有生效版本时，主档配置始终回写为生效版（改版/续约待审期间不替换运行配置） */
export function restoreEffectiveConfig(contract: ServiceContract): boolean {
  const effective = getEffectiveVersion(contract)
  if (!effective) return false
  applyContractConfig(contract, effective)
  if (contract.status !== 'terminated') {
    contract.status = 'active'
  }
  return true
}

/** 编辑/续约表单应加载的配置：优先草稿/待审/驳回版，否则生效版 */
export function getFormSourceConfig(contract: ServiceContract): ContractConfigSnapshot {
  ensureContractVersions(contract)
  const working = (contract.versions ?? []).find(
    (v) => v.status === 'draft' || v.status === 'pending' || v.status === 'rejected',
  )
  if (working) return pickContractConfig(working)
  const effective = getEffectiveVersion(contract)
  if (effective) return pickContractConfig(effective)
  return pickContractConfig(contract)
}

/** 兼容旧数据：补齐 versions / currentVersion */
export function ensureContractVersions(contract: ServiceContract): ServiceContract {
  if (contract.versions?.length) {
    if (!contract.currentVersion) {
      const effective = contract.versions.find((v) => v.status === 'effective')
      contract.currentVersion = effective?.version ?? 0
    }
    return contract
  }

  const approval = contract.approvalStatus ?? 'approved'
  let status: ServiceContractVersion['status'] = 'history'
  if (contract.status === 'terminated') status = 'history'
  else if (approval === 'pending') status = 'pending'
  else if (approval === 'rejected' || approval === 'draft') status = approval === 'rejected' ? 'rejected' : 'draft'
  else if (approval === 'approved') status = 'effective'

  const now = contract.updatedAt || contract.createdAt || new Date().toISOString()
  const version: ServiceContractVersion = {
    id: generateId('scv'),
    version: 1,
    status,
    ...pickContractConfig(contract),
    submittedBy: contract.submittedBy,
    submittedAt: contract.submittedAt,
    approvedBy: contract.approvedBy,
    approvedAt: contract.approvedAt,
    approvalRemark: contract.approvalRemark,
    changeNote: status === 'effective' ? '初始生效版本' : '初始版本',
    createdAt: contract.createdAt || now,
    updatedAt: now,
  }
  contract.versions = [version]
  contract.currentVersion = status === 'effective' ? 1 : 0
  return contract
}

export function getWorkingVersion(contract: ServiceContract): ServiceContractVersion | undefined {
  ensureContractVersions(contract)
  const versions = contract.versions ?? []
  return (
    versions.find((v) => v.status === 'draft' || v.status === 'pending' || v.status === 'rejected') ||
    versions.find((v) => v.status === 'effective') ||
    versions[versions.length - 1]
  )
}

export function getEffectiveVersion(contract: ServiceContract): ServiceContractVersion | undefined {
  ensureContractVersions(contract)
  return (contract.versions ?? []).find((v) => v.status === 'effective')
}

export function findContractByPair(
  contracts: ServiceContract[],
  enterpriseId: string,
  providerId: string,
): ServiceContract | undefined {
  return contracts.find(
    (c) =>
      c.enterpriseId === enterpriseId &&
      c.providerId === providerId &&
      c.status !== 'terminated',
  )
}
