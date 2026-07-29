import type {
  AttendanceDaily,
  AttendanceMonthlySummary,
  Employee,
  OvertimeRequest,
  PayrollConfig,
  PayrollPreviewItem,
  ScheduleAssignment,
  Team,
} from '@/types'

export function resolveEmployeeTeam(
  employeeId: string,
  teams: Team[],
  assignments: ScheduleAssignment[],
  month: string,
): Team | undefined {
  const teamIdFromSchedule = assignments.find(
    (a) => a.employeeId === employeeId && a.date.startsWith(month) && a.teamId,
  )?.teamId
  if (teamIdFromSchedule) {
    return teams.find((t) => t.id === teamIdFromSchedule)
  }
  return teams.find((t) => t.memberIds.includes(employeeId))
}

export function getEmployeeHourlyRate(
  config: PayrollConfig,
  employeeId: string,
  teams: Team[],
  assignments: ScheduleAssignment[] = [],
  month = '',
): number {
  const team = month ? resolveEmployeeTeam(employeeId, teams, assignments, month) : teams.find((t) => t.memberIds.includes(employeeId))
  if (team?.hourlyRate != null) return team.hourlyRate
  return config.defaultHourlyRate
}

export function buildPayrollPreview(
  employees: Employee[],
  summaries: AttendanceMonthlySummary[],
  dailyList: AttendanceDaily[],
  overtimeRequests: OvertimeRequest[],
  config: PayrollConfig,
  teams: Team[],
  assignments: ScheduleAssignment[],
  month: string,
): PayrollPreviewItem[] {
  return employees
    .filter((e) => e.status === 'active')
    .map((emp) => {
      const summary = summaries.find((s) => s.employeeId === emp.id && s.month === month)
      const team = resolveEmployeeTeam(emp.id, teams, assignments, month)
      const hourlyRate = getEmployeeHourlyRate(config, emp.id, teams, assignments, month)
      const regularHours = summary?.totalWorkHours ?? 0
      const approvedOvertime = overtimeRequests
        .filter((r) => r.employeeId === emp.id && r.date.startsWith(month) && r.status === 'approved')
        .reduce((sum, r) => sum + r.hours, 0)
      const overtimeHours = Math.max(summary?.overtimeHours ?? 0, approvedOvertime)

      const absentDays = summary?.absentCount ?? 0
      const leaveDays = summary?.leaveDays ?? 0

      const regularPay = Math.round(regularHours * hourlyRate * 100) / 100
      let overtimePay = 0
      overtimeRequests
        .filter((r) => r.employeeId === emp.id && r.date.startsWith(month) && r.status === 'approved')
        .forEach((r) => {
          const multiplier =
            r.overtimeType === 'holiday'
              ? config.holidayOvertimeMultiplier
              : r.overtimeType === 'weekend'
                ? config.weekendOvertimeMultiplier
                : config.weekdayOvertimeMultiplier
          overtimePay += r.hours * hourlyRate * multiplier
        })
      overtimePay = Math.round(overtimePay * 100) / 100

      const empDaily = dailyList.filter((d) => d.employeeId === emp.id && d.date.startsWith(month))
      const lateCount = empDaily.filter((d) => d.status === 'late').length
      const deductions = Math.round((absentDays * 8 * hourlyRate + lateCount * 50) * 100) / 100

      const totalPay = Math.max(0, Math.round((regularPay + overtimePay - deductions) * 100) / 100)

      return {
        employeeId: emp.id,
        month,
        teamId: team?.id,
        teamName: team?.name,
        regularHours,
        overtimeHours,
        absentDays,
        leaveDays,
        hourlyRate,
        regularPay,
        overtimePay,
        deductions,
        totalPay,
      }
    })
}

export function exportPayrollCsv(
  items: PayrollPreviewItem[],
  employees: Employee[],
): string {
  const headers = [
    '工号',
    '姓名',
    '考勤组',
    '月份',
    '正常工时',
    '加班工时',
    '旷工天数',
    '请假天数',
    '时薪',
    '基本薪酬',
    '加班薪酬',
    '扣款',
    '应发合计',
  ]
  const rows = items.map((item) => {
    const emp = employees.find((e) => e.id === item.employeeId)
    return [
      emp?.employeeNo ?? '',
      emp?.name ?? '',
      item.teamName ?? '',
      item.month,
      item.regularHours,
      item.overtimeHours,
      item.absentDays,
      item.leaveDays,
      item.hourlyRate,
      item.regularPay,
      item.overtimePay,
      item.deductions,
      item.totalPay,
    ].join(',')
  })
  return `\uFEFF${headers.join(',')}\n${rows.join('\n')}`
}

export function exportErpJson(
  items: PayrollPreviewItem[],
  employees: Employee[],
  config: PayrollConfig,
  month: string,
): string {
  const payload = {
    source: 'shift-attendance-admin',
    target: config.erpSystemName,
    endpoint: config.erpEndpoint,
    month,
    exportedAt: new Date().toISOString(),
    records: items.map((item) => {
      const emp = employees.find((e) => e.id === item.employeeId)
      return {
        employeeNo: emp?.employeeNo,
        employeeName: emp?.name,
        departmentId: emp?.departmentId,
        attendanceGroup: item.teamName,
        ...item,
      }
    }),
  }
  return JSON.stringify(payload, null, 2)
}

export function downloadTextFile(content: string, filename: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
