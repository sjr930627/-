import type { Employee, WorkerUnavailablePeriod } from '@/types'
import { getDatesBetween } from '@/services/attendance'

export function expandUnavailablePeriods(periods: WorkerUnavailablePeriod[]): string[] {
  const dates = new Set<string>()
  for (const p of periods) {
    if (!p.startDate || !p.endDate || p.endDate < p.startDate) continue
    getDatesBetween(p.startDate, p.endDate).forEach((d) => dates.add(d))
  }
  return [...dates].sort()
}

export function isEmployeeUnavailableOnDate(
  employee: Pick<Employee, 'unavailableDates'> | null | undefined,
  date: string,
): boolean {
  if (!employee || !date) return false
  return (employee.unavailableDates ?? []).includes(date)
}

/** 判断区间 [start, end]（YYYY-MM-DD 或 ISO）是否与不可用日期重叠 */
export function isEmployeeUnavailableInRange(
  employee: Pick<Employee, 'unavailableDates'> | null | undefined,
  start: string,
  end?: string,
): boolean {
  if (!employee) return false
  const startDate = start.slice(0, 10)
  const endDate = (end || start).slice(0, 10)
  if (!startDate) return false
  const span = endDate >= startDate ? getDatesBetween(startDate, endDate) : [startDate]
  return span.some((d) => isEmployeeUnavailableOnDate(employee, d))
}

export function unavailablePeriodTypeLabel(type: WorkerUnavailablePeriod['type']) {
  return type === 'leave' ? '请假' : '不上岗'
}
