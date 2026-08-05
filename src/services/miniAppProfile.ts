import type { WorkerProfileExt } from '@/types'

export function calcProfileCompleteness(profile: Partial<WorkerProfileExt>): number {
  let score = 0
  const realNameProof = profile.basicProofs?.find((p) => p.type === 'real_name')
  if (realNameProof?.status === 'verified') score += 25
  if (profile.faceVerifyStatus === 'verified') score += 20
  if (profile.permanentAddress?.trim()) score += 15
  if (profile.realName?.trim()) score += 10
  if ((profile.schedulePreferences?.length ?? 0) > 0) score += 10
  const pt = profile.partTimePreference
  if (pt?.timeOfDay || pt?.commitment || pt?.shiftDuration || pt?.workDays) score += 10
  if (pt?.favoriteJobs || pt?.wantedJobs || pt?.preferredBrands) score += 5
  if ((profile.skillCertificates?.length ?? 0) > 0) score += 10
  return Math.min(100, score)
}

export function maskIdCard(idCard: string): string {
  const trimmed = idCard.trim()
  if (trimmed.length < 8) return trimmed
  return `${trimmed.slice(0, 4)}**********${trimmed.slice(-4)}`
}

export function inferScheduleVariant(weekdays: string[]): 'weekday' | 'weekend' {
  const weekend = new Set(['周六', '周日'])
  const allWeekend = weekdays.length > 0 && weekdays.every((d) => weekend.has(d))
  return allWeekend ? 'weekend' : 'weekday'
}
