import type { TeamCycleScheduleRule, WeeklyShiftDemandPlan } from '@/types'

/** team_a 演示：三班倒周期规则 */
export const seedTeamCycleScheduleRules: TeamCycleScheduleRule[] = [
  {
    id: 'csr_factory',
    teamId: 'team_a',
    name: '三班倒做五休二',
    enabled: true,
    employeeIds: [],
    shiftPattern: [
      'shift_morning',
      'shift_morning',
      'shift_morning',
      'shift_morning',
      'shift_morning',
      'shift_rest',
      'shift_rest',
    ],
    anchorStartDate: '2026-07-28',
    cycleDays: 7,
    autoGenerateLeadDays: 3,
    lastGeneratedAt: '2026-07-25T08:00:00.000Z',
    createdAt: '2026-07-01T08:00:00.000Z',
    updatedAt: '2026-07-25T08:00:00.000Z',
  },
]

export const seedWeeklyShiftDemandPlans: WeeklyShiftDemandPlan[] = []
