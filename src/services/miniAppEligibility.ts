import {
  isEnterpriseRootDepartment,
  isUnassignedDepartment,
} from '@/constants/department'
import {
  FACE_REVERIFY_INTERVAL_OPTIONS_HOURS,
} from '@/constants/miniappAuth'
import { resolveEnterpriseIdByDepartment } from '@/utils/enterpriseScope'
import type {
  Department,
  Employee,
  JobRequirement,
  WorkerProfileExt,
} from '@/types'

export function isRealNameVerified(
  employee?: Pick<Employee, 'realNameVerified'> | null,
  profileExt?: Pick<WorkerProfileExt, 'basicProofs'> | null,
): boolean {
  if (employee?.realNameVerified) return true
  return profileExt?.basicProofs?.some((p) => p.type === 'real_name' && p.status === 'verified') === true
}

/** 不定时 2/4 小时：按上次核验时间戳稳定取间隔，避免每次判断跳动 */
export function resolveFaceReverifyIntervalHours(
  profileExt?: Pick<WorkerProfileExt, 'faceVerifiedAt'> | null,
): number {
  const options = FACE_REVERIFY_INTERVAL_OPTIONS_HOURS
  if (!profileExt?.faceVerifiedAt) return options[1]
  const t = new Date(profileExt.faceVerifiedAt).getTime()
  if (Number.isNaN(t)) return options[1]
  return options[Math.abs(t) % options.length]
}

export function isFaceVerificationFresh(
  profileExt?: Pick<WorkerProfileExt, 'faceVerifyStatus' | 'faceVerifiedAt'> | null,
  now: Date = new Date(),
): boolean {
  if (!profileExt || profileExt.faceVerifyStatus !== 'verified') return false
  if (!profileExt.faceVerifiedAt) return false
  const verifiedAt = new Date(profileExt.faceVerifiedAt).getTime()
  if (Number.isNaN(verifiedAt)) return false
  const intervalHours = resolveFaceReverifyIntervalHours(profileExt)
  return now.getTime() - verifiedAt < intervalHours * 3600_000
}

export function needsFaceReverify(
  profileExt?: Pick<WorkerProfileExt, 'faceVerifyStatus' | 'faceVerifiedAt'> | null,
  now: Date = new Date(),
): boolean {
  return !isFaceVerificationFresh(profileExt, now)
}

/** 是否已入驻企业业务部门（非待入驻/企业根节点） */
export function isWorkerInEnterpriseDepartment(
  employee: Employee | undefined | null,
  departments: Department[],
  enterpriseId?: string,
): boolean {
  if (!employee || employee.status !== 'active') return false
  if (isUnassignedDepartment(employee.departmentId)) return false
  const dept = departments.find((d) => d.id === employee.departmentId)
  if (!dept || isEnterpriseRootDepartment(dept)) return false
  if (enterpriseId) {
    const empEnterpriseId =
      resolveEnterpriseIdByDepartment(employee.departmentId, departments) ?? employee.enterpriseId
    if (empEnterpriseId !== enterpriseId) return false
  }
  return true
}

export function findRecruitingJobForEnterprise(
  enterpriseId: string,
  jobs: JobRequirement[],
): JobRequirement | null {
  return (
    jobs.find((j) => j.enterpriseId === enterpriseId && j.status === 'recruiting') ?? null
  )
}

export type MiniAppGateBlock =
  | { ok: true }
  | { ok: false; reason: 'real_name' }
  | { ok: false; reason: 'face_expired'; intervalHours: number }
  | {
      ok: false
      reason: 'not_in_department'
      enterpriseId: string
      jobId?: string
    }

export function evaluateSensitiveActionGate(options: {
  employee?: Employee | null
  profileExt?: WorkerProfileExt | null
  departments: Department[]
  jobs: JobRequirement[]
  requireDepartment?: boolean
  enterpriseId?: string
  now?: Date
}): MiniAppGateBlock {
  const {
    employee,
    profileExt,
    departments,
    jobs,
    requireDepartment = false,
    enterpriseId,
    now = new Date(),
  } = options

  if (!isRealNameVerified(employee, profileExt)) {
    return { ok: false, reason: 'real_name' }
  }
  if (needsFaceReverify(profileExt, now)) {
    return {
      ok: false,
      reason: 'face_expired',
      intervalHours: resolveFaceReverifyIntervalHours(profileExt),
    }
  }
  if (requireDepartment && enterpriseId) {
    if (!isWorkerInEnterpriseDepartment(employee, departments, enterpriseId)) {
      const job = findRecruitingJobForEnterprise(enterpriseId, jobs)
      return {
        ok: false,
        reason: 'not_in_department',
        enterpriseId,
        jobId: job?.id,
      }
    }
  }
  return { ok: true }
}
