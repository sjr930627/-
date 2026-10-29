import { SCHEDULE_DEMO_NOW } from '@/constants/schedule'
import type { AttendancePunch, InsurancePolicy, InsurancePolicyStatus, InsuranceProduct } from '@/types'

/** 后台退保窗口：投保当日内、投保时间起 2 小时 */
export const INSURANCE_ADMIN_CANCEL_WINDOW_MS = 2 * 60 * 60 * 1000

const productTypeLabel: Record<InsuranceProduct['type'], string> = {
  accident: '意外伤害',
  employer_liability: '雇主责任',
  comprehensive: '综合保障',
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

function insuranceDateKey(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}

/** 后台退保：状态为保障中，且仍处于投保当天的 2 小时内 */
export function canAdminCancelInsurancePolicy(
  policy: Pick<InsurancePolicy, 'status' | 'createdAt' | 'effectiveTime'>,
  nowIso = SCHEDULE_DEMO_NOW,
) {
  if (policy.status !== 'active') return false
  const enrolled = parseInsuranceTime(insuranceEnrolledAt(policy))
  const now = parseInsuranceTime(nowIso)
  if (!enrolled || !now) return false
  if (insuranceDateKey(enrolled) !== insuranceDateKey(now)) return false
  const elapsed = now.getTime() - enrolled.getTime()
  return elapsed >= 0 && elapsed <= INSURANCE_ADMIN_CANCEL_WINDOW_MS
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

export function formatCoverageAmount(amount?: number | null) {
  if (amount == null || Number.isNaN(amount)) return '—'
  return `${amount}万`
}

/** 已保存的产品补上方案 ID；不把用户删掉的种子产品加回来 */
export function ensureInsuranceProducts(products: InsuranceProduct[]) {
  return products.map((product) => ({
    ...product,
    planId: product.planId?.trim() || product.code,
  }))
}

/** 补齐演示投保记录（已存在的保单不覆盖，避免冲掉退保结果） */
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
