import type { WorkerAgreement, WorkerAgreementStatus, WorkerAgreementType } from '@/types'

export const workerAgreementTypeMap: Record<WorkerAgreementType, string> = {
  service: '灵工服务协议',
  dispatch: '承揽/派遣协议',
  privacy: '个人信息授权',
  safety: '安全承诺书',
  other: '其他协议',
}

export const workerAgreementStatusMap: Record<
  WorkerAgreementStatus,
  { label: string; tag: 'success' | 'warning' | 'info' | 'danger' }
> = {
  pending: { label: '待签署', tag: 'warning' },
  signed: { label: '已签署', tag: 'success' },
  expired: { label: '已过期', tag: 'info' },
  terminated: { label: '已终止', tag: 'danger' },
}

export function resolveWorkerAgreementStatus(
  agr: Pick<WorkerAgreement, 'signed' | 'status' | 'expiryDate'>,
): WorkerAgreementStatus {
  if (agr.status === 'terminated') return 'terminated'
  if (agr.status === 'expired') return 'expired'
  if (agr.expiryDate) {
    const today = new Date().toISOString().slice(0, 10)
    if (agr.expiryDate < today) return 'expired'
  }
  if (agr.status === 'signed' || agr.signed) return 'signed'
  if (agr.status === 'pending') return 'pending'
  return agr.signed ? 'signed' : 'pending'
}
