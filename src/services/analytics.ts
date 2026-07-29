import type {
  AttendanceDaily,
  Department,
  DepartmentAnalytics,
  Employee,
  MonthlyTrend,
  PayrollConfig,
  PayrollPreviewItem,
  ScheduleAssignment,
  Shift,
  ShiftPatternStat,
  Team,
} from '@/types'
import { getDepartmentName } from '@/utils'
import { getEmployeeHourlyRate } from './payroll'

export function buildDepartmentAnalytics(
  departments: Department[],
  employees: Employee[],
  dailyList: AttendanceDaily[],
  payrollItems: PayrollPreviewItem[],
  month: string,
): DepartmentAnalytics[] {
  return departments
    .filter((d) => d.parentId !== null || departments.filter((x) => x.parentId === d.id).length === 0)
    .filter((d) => employees.some((e) => e.departmentId === d.id))
    .map((dept) => {
      const deptEmployees = employees.filter((e) => e.departmentId === dept.id && e.status === 'active')
      const deptDaily = dailyList.filter(
        (d) => deptEmployees.some((e) => e.id === d.employeeId) && d.date.startsWith(month),
      )
      const workDays = deptDaily.filter((d) => d.scheduledHours > 0)
      const normal = workDays.filter((d) => d.status === 'normal').length
      const late = workDays.filter((d) => d.status === 'late').length
      const absent = workDays.filter((d) => d.status === 'absent').length
      const totalWorkHours = Math.round(deptDaily.reduce((s, d) => s + d.workHours, 0) * 10) / 10
      const laborCost = payrollItems
        .filter((p) => deptEmployees.some((e) => e.id === p.employeeId))
        .reduce((s, p) => s + p.totalPay, 0)

      return {
        departmentId: dept.id,
        employeeCount: deptEmployees.length,
        attendanceRate: workDays.length ? Math.round((normal / workDays.length) * 1000) / 10 : 100,
        lateRate: workDays.length ? Math.round((late / workDays.length) * 1000) / 10 : 0,
        absentRate: workDays.length ? Math.round((absent / workDays.length) * 1000) / 10 : 0,
        totalWorkHours,
        laborCost: Math.round(laborCost * 100) / 100,
      }
    })
}

export function buildShiftPatternStats(
  assignments: ScheduleAssignment[],
  shifts: Shift[],
  month: string,
): ShiftPatternStat[] {
  const monthAssignments = assignments.filter((a) => a.date.startsWith(month))
  const total = monthAssignments.length || 1
  return shifts
    .filter((s) => s.code !== 'REST')
    .map((shift) => {
      const count = monthAssignments.filter((a) => a.shiftId === shift.id).length
      return {
        shiftId: shift.id,
        shiftName: shift.name,
        count,
        percentage: Math.round((count / total) * 1000) / 10,
      }
    })
    .sort((a, b) => b.count - a.count)
}

export function buildMonthlyTrends(
  months: string[],
  employees: Employee[],
  teams: Team[],
  assignments: ScheduleAssignment[],
  getDailyForMonth: (month: string) => AttendanceDaily[],
  config: PayrollConfig,
): MonthlyTrend[] {
  return months.map((month) => {
    const daily = getDailyForMonth(month)
    const workDays = daily.filter((d) => d.scheduledHours > 0)
    const normal = workDays.filter((d) => d.status === 'normal').length
    const workHours = Math.round(daily.reduce((s, d) => s + d.workHours, 0) * 10) / 10
    const laborCost = employees
      .filter((e) => e.status === 'active')
      .reduce((sum, emp) => {
        const hours = daily.filter((d) => d.employeeId === emp.id).reduce((s, d) => s + d.workHours, 0)
        return sum + hours * getEmployeeHourlyRate(config, emp.id, teams, assignments, month)
      }, 0)
    return {
      month,
      workHours,
      laborCost: Math.round(laborCost * 100) / 100,
      attendanceRate: workDays.length ? Math.round((normal / workDays.length) * 1000) / 10 : 100,
    }
  })
}

export function formatDepartmentLabel(departments: Department[], id: string): string {
  return getDepartmentName(departments, id)
}

export function getRecentMonths(count: number, baseMonth = '2026-07'): string[] {
  const [y, m] = baseMonth.split('-').map(Number)
  const months: string[] = []
  for (let i = count - 1; i >= 0; i -= 1) {
    const date = new Date(y, m - 1 - i, 1)
    months.push(`${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`)
  }
  return months
}
