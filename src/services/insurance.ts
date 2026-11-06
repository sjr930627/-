import { SCHEDULE_DEMO_NOW } from '@/constants/schedule'
import type {
  AttendancePunch,
  InsuranceClaimCommunication,
  InsuranceClaimProgress,
  InsuranceClaimRecord,
  InsuranceClaimStatus,
  InsuranceCoverageScope,
  InsurancePolicy,
  InsurancePolicyStatus,
  InsuranceProduct,
  InsuranceProductType,
} from '@/types'

const productTypeLabel: Record<InsuranceProduct['type'], string> = {
  team_accident: '团队意外',
  employer_liability: '雇主责任',
}

const statusLabel: Record<InsurancePolicyStatus, string> = {
  active: '保障中',
  expired: '已过期',
  cancelled: '已退保',
  pending: '待生效',
}

export function getInsuranceProductTypeLabel(type: InsuranceProduct['type']) {
  return productTypeLabel[type]
}

export const insuranceProductTypeOptions: { value: InsuranceProductType; label: string }[] = [
  { value: 'team_accident', label: '团队意外' },
  { value: 'employer_liability', label: '雇主责任' },
]

export function isInsuranceProductType(value: string): value is InsuranceProductType {
  return value === 'team_accident' || value === 'employer_liability'
}

/** 旧数据里的意外伤害、综合保障并入团队意外 */
export function normalizeInsuranceProductType(type?: string): InsuranceProductType {
  return type === 'employer_liability' ? 'employer_liability' : 'team_accident'
}

export function normalizeInsuranceCoverageScope(
  scope?: Partial<InsuranceCoverageScope> | null,
): InsuranceCoverageScope | undefined {
  if (!scope) return undefined
  return {
    deathDisabilityAmount: Number(scope.deathDisabilityAmount),
    medicalExpenseAmount: Number(scope.medicalExpenseAmount),
    lostWageDailyAmount: Number(scope.lostWageDailyAmount),
    suddenDeathAmount: Number(scope.suddenDeathAmount),
  }
}

export function insuranceCoverageScopeError(scope?: Partial<InsuranceCoverageScope> | null) {
  const value = normalizeInsuranceCoverageScope(scope)
  if (!value || !(value.deathDisabilityAmount > 0)) return '请填写工伤身故残疾额度'
  if (!(value.medicalExpenseAmount > 0)) return '请填写工伤医疗费用'
  if (!(value.lostWageDailyAmount > 0)) return '请填写工伤误工补偿'
  if (!(value.suddenDeathAmount > 0)) return '请填写工伤猝死额度'
  return ''
}

export function formatInsuranceCoverageScope(scope?: Partial<InsuranceCoverageScope> | null) {
  const value = normalizeInsuranceCoverageScope(scope)
  if (!value || insuranceCoverageScopeError(value)) return '—'
  return `身故残疾${value.deathDisabilityAmount}万、医疗${value.medicalExpenseAmount}万、误工${value.lostWageDailyAmount}元/天、猝死${value.suddenDeathAmount}万`
}

export function getInsurancePolicyStatusLabel(status: InsurancePolicyStatus) {
  return statusLabel[status]
}

export function getInsurancePolicyStatusTagType(
  status: InsurancePolicyStatus,
): 'success' | 'info' | 'warning' | 'danger' {
  if (status === 'active') return 'success'
  if (status === 'pending') return 'warning'
  if (status === 'cancelled') return 'danger'
  return 'info'
}

export type InsuranceEnrollmentDisplayStatus = 'active' | 'ended' | 'cancelled'

const enrollmentDisplayLabel: Record<InsuranceEnrollmentDisplayStatus, string> = {
  active: '投保中',
  ended: '已结束',
  cancelled: '已退保',
}

/** 列表展示：已退保优先；超过失效时间或已过期为已结束；其余为投保中 */
export function getInsuranceEnrollmentDisplayStatus(
  policy: Pick<InsurancePolicy, 'status' | 'expireTime'>,
  nowIso = SCHEDULE_DEMO_NOW,
): InsuranceEnrollmentDisplayStatus {
  if (policy.status === 'cancelled') return 'cancelled'
  const expire = parseInsuranceTime(policy.expireTime)
  const now = parseInsuranceTime(nowIso)
  if (policy.status === 'expired' || (expire && now && now.getTime() > expire.getTime())) {
    return 'ended'
  }
  return 'active'
}

export function getInsuranceEnrollmentDisplayLabel(status: InsuranceEnrollmentDisplayStatus) {
  return enrollmentDisplayLabel[status]
}

export function getInsuranceEnrollmentDisplayTagType(
  status: InsuranceEnrollmentDisplayStatus,
): 'success' | 'info' | 'danger' {
  if (status === 'active') return 'success'
  if (status === 'cancelled') return 'danger'
  return 'info'
}

export function buildPolicyNo(workDate: string, seq: number) {
  const d = workDate.replace(/-/g, '')
  return `INS${d}${String(seq).padStart(4, '0')}`
}

export function createPolicyFromPunch(
  product: InsuranceProduct,
  punch: AttendancePunch,
  seq: number,
): InsurancePolicy {
  const effectiveTime = `${punch.date}T${punch.time.length === 5 ? punch.time : punch.time.slice(0, 5)}:00`
  return {
    id: `ins_pol_${Date.now()}`,
    policyNo: buildPolicyNo(punch.date, seq),
    productId: product.id,
    employeeId: punch.employeeId,
    punchId: punch.id,
    workDate: punch.date,
    effectiveTime,
    expireTime: `${punch.date}T23:59:59`,
    premium: product.dailyPremium,
    coverageAmount: product.coverageAmount,
    status: 'active',
    location: punch.location,
    createdAt: effectiveTime,
  }
}

export function insurancePlanId(product?: Pick<InsuranceProduct, 'planId' | 'code'> | null) {
  return product?.planId?.trim() || product?.code || '—'
}

export function insuranceEnrolledAt(policy: Pick<InsurancePolicy, 'createdAt' | 'effectiveTime'>) {
  return policy.createdAt || policy.effectiveTime
}

function parseInsuranceTime(iso: string) {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? null : date
}

export function formatInsuranceDateTime(iso?: string) {
  if (!iso) return '—'
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(iso) && !iso.endsWith('Z')) {
    return iso.replace('T', ' ').slice(0, 16)
  }
  const date = parseInsuranceTime(iso)
  if (!date) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function formatInsurancePeriod(effectiveTime: string, expireTime: string) {
  return `${formatInsuranceDateTime(effectiveTime)} 至 ${formatInsuranceDateTime(expireTime)}`
}

export const insuranceClaimMaterialFields = [
  { key: 'identity', label: '身份证明', required: true },
  { key: 'medical', label: '医疗证明', required: true },
  { key: 'invoice', label: '费用票据', required: true },
  { key: 'scene', label: '事故照片', required: false },
] as const

export const insuranceClaimProgressOptions: { value: InsuranceClaimProgress; label: string }[] = [
  { value: 'reported', label: '已提报' },
  { value: 'accepted', label: '已受理' },
  { value: 'closed', label: '已办结' },
]

export const insuranceClaimStatusOptions: { value: InsuranceClaimStatus; label: string }[] = [
  { value: 'pending', label: '待审核' },
  { value: 'reported', label: '已提报' },
  { value: 'accepted', label: '已受理' },
  { value: 'closed', label: '已办结' },
  { value: 'rejected', label: '已驳回' },
]

const claimStatusLabel: Record<InsuranceClaimStatus, string> = {
  pending: '待审核',
  rejected: '已驳回',
  reported: '已提报',
  accepted: '已受理',
  closed: '已办结',
}

export function getInsuranceClaimStatusLabel(status: InsuranceClaimStatus) {
  return claimStatusLabel[status]
}

export function getInsuranceClaimStatusTagType(
  status: InsuranceClaimStatus,
): 'warning' | 'primary' | 'success' | 'danger' | 'info' {
  if (status === 'pending') return 'warning'
  if (status === 'rejected') return 'danger'
  if (status === 'reported') return 'primary'
  if (status === 'accepted') return 'warning'
  return 'success'
}

export function isInsuranceClaimProgress(status: InsuranceClaimStatus): status is InsuranceClaimProgress {
  return status === 'reported' || status === 'accepted' || status === 'closed'
}

/** 已受理、已提报可编辑；已办结锁定 */
export function canEditInsuranceClaim(status: InsuranceClaimStatus) {
  return status === 'accepted' || status === 'reported'
}

/** 把旧的单条沟通记录并入列表，并丢掉空内容 */
export function normalizeInsuranceClaimCommunications(
  record: Pick<InsuranceClaimRecord, 'id' | 'communications' | 'communicationLog' | 'recordedAt' | 'updatedAt'>,
): InsuranceClaimCommunication[] {
  if (Array.isArray(record.communications)) {
    return record.communications
      .map((item) => ({
        id: item.id,
        content: String(item.content ?? '').trim(),
        createdAt: item.createdAt || record.updatedAt || record.recordedAt,
        updatedAt: item.updatedAt,
      }))
      .filter((item) => item.id && item.content)
  }
  const legacy = record.communicationLog?.trim()
  if (!legacy) return []
  return [
    {
      id: `${record.id}_log`,
      content: legacy,
      createdAt: record.updatedAt || record.recordedAt,
    },
  ]
}

/** 同一保单存在待审核或进行中的申请时，不能再次提交 */
export function canSubmitInsuranceClaim(records: InsuranceClaimRecord[], policyId: string) {
  return !records.some(
    (record) =>
      record.policyId === policyId &&
      (record.status === 'pending' || record.status === 'reported' || record.status === 'accepted'),
  )
}

export function ensureInsuranceClaimRecords(
  records: InsuranceClaimRecord[],
  seed: InsuranceClaimRecord[],
) {
  const seedById = new Map(seed.map((record) => [record.id, record]))
  const normalized = records.map((record) => {
    const seeded = seedById.get(record.id)
    if (seeded && !Array.isArray(record.materials)) return { ...seeded }
    const next = {
      ...record,
      materials: record.materials ?? [],
      employeeId: record.employeeId || seeded?.employeeId || '',
      communications: normalizeInsuranceClaimCommunications(record),
    }
    delete next.communicationLog
    return next
  })
  const ids = new Set(normalized.map((record) => record.id))
  const missing = seed.filter((record) => !ids.has(record.id))
  if (!missing.length) return normalized
  return [...missing, ...normalized]
}

export function formatCoverageAmount(amount?: number | null) {
  if (amount == null || Number.isNaN(amount)) return '—'
  return `${amount}万`
}

export function normalizeInsuranceEnterpriseIds(ids?: string[]) {
  return [...new Set((ids ?? []).map((id) => id.trim()).filter(Boolean))]
}

/** 一家企业只能挂在一个保险方案上，返回已被其他方案占用的企业 */
export function findEnterpriseInsuranceConflicts(
  products: InsuranceProduct[],
  enterpriseIds: string[],
  excludeProductId?: string,
) {
  const conflicts: { enterpriseId: string; productId: string; productName: string }[] = []
  for (const enterpriseId of normalizeInsuranceEnterpriseIds(enterpriseIds)) {
    const owner = products.find(
      (product) =>
        product.id !== excludeProductId && (product.enterpriseIds ?? []).includes(enterpriseId),
    )
    if (owner) {
      conflicts.push({ enterpriseId, productId: owner.id, productName: owner.name })
    }
  }
  return conflicts
}

/** 按企业取已启用的唯一方案。未关联企业时不出单 */
export function findInsuranceProductForEnterprise(
  products: InsuranceProduct[],
  enterpriseId?: string,
) {
  if (!enterpriseId) return undefined
  return products.find(
    (product) => product.enabled && (product.enterpriseIds ?? []).includes(enterpriseId),
  )
}

/** 已保存的产品补上方案 ID 和关联企业；不把用户删掉的种子产品加回来 */
export function ensureInsuranceProducts(products: InsuranceProduct[], seed: InsuranceProduct[] = []) {
  const seedById = new Map(seed.map((product) => [product.id, product]))
  return products.map((product) => {
    const seeded = seedById.get(product.id)
    return {
      ...product,
      type: normalizeInsuranceProductType(product.type),
      planId: product.planId?.trim() || product.code,
      enterpriseIds: Array.isArray(product.enterpriseIds)
        ? normalizeInsuranceEnterpriseIds(product.enterpriseIds)
        : normalizeInsuranceEnterpriseIds(seeded?.enterpriseIds),
      coverageScope:
        normalizeInsuranceCoverageScope(product.coverageScope) ??
        normalizeInsuranceCoverageScope(seeded?.coverageScope),
    }
  })
}

/** 补齐演示投保记录（已存在的保单不覆盖） */
export function ensureInsurancePolicies(policies: InsurancePolicy[], seed: InsurancePolicy[]) {
  const ids = new Set(policies.map((policy) => policy.id))
  const missing = seed.filter((policy) => !ids.has(policy.id))
  if (!missing.length) return policies
  return [...missing, ...policies]
}

export function shouldAutoInsure(punch: Pick<AttendancePunch, 'type' | 'source'>) {
  return punch.type === 'clock_in' && punch.source === 'mobile'
}

export function findAutoInsuranceProduct(products: InsuranceProduct[]) {
  return products.find((p) => p.enabled && p.autoOnPunch) ?? products.find((p) => p.enabled)
}

export function hasActivePolicyForDate(
  policies: InsurancePolicy[],
  employeeId: string,
  workDate: string,
) {
  return policies.some(
    (p) =>
      p.employeeId === employeeId &&
      p.workDate === workDate &&
      (p.status === 'active' || p.status === 'pending'),
  )
}

export function summarizeEmployeeInsurance(
  policies: InsurancePolicy[],
  employeeId: string,
) {
  const list = policies.filter((p) => p.employeeId === employeeId)
  const active = list.filter((p) => p.status === 'active').length
  const total = list.length
  const totalPremium = Math.round(list.reduce((s, p) => s + p.premium, 0) * 100) / 100
  const latest = [...list].sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0]
  return { total, active, totalPremium, latest }
}
