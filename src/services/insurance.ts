import type { AttendancePunch, InsurancePolicy, InsurancePolicyStatus, InsuranceProduct } from '@/types'

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

export function buildPolicyNo(workDate: string, seq: number) {
  const d = workDate.replace(/-/g, '')
  return `INS${d}${String(seq).padStart(4, '0')}`
}

export function createPolicyFromPunch(
  product: InsuranceProduct,
  punch: AttendancePunch,
  seq: number,
): InsurancePolicy {
  const effectiveTime = `${punch.date}T${punch.time}:00`
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
    status: 'active',
    location: punch.location,
    createdAt: new Date().toISOString(),
  }
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
