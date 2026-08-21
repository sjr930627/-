import type { TeamCycleScheduleRule, WeeklyShiftDemandPlan } from '@/types'
import { getDatesBetween } from '@/services/attendance'

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

const augDates = getDatesBetween('2026-08-01', '2026-08-31')
const weekDates = getDatesBetween('2026-08-14', '2026-08-20')

const factoryShiftCounts = [
  { id: 'st_am', headcount: 6 },
  { id: 'st_pm', headcount: 5 },
  { id: 'st_night', headcount: 3 },
]

const teamAShiftCounts = [
  { id: 'st_am', headcount: 8 },
  { id: 'st_pm', headcount: 6 },
  { id: 'st_night', headcount: 4 },
]

function buildDailyPlan(
  id: string,
  teamId: string,
  dates: string[],
  counts: { id: string; headcount: number }[],
  status: WeeklyShiftDemandPlan['status'] = 'published',
): WeeklyShiftDemandPlan {
  const weekStart = dates[0]
  const weekEnd = dates[dates.length - 1]
  return {
    id,
    teamId,
    weekStart,
    weekEnd,
    status,
    commonConfig: {
      mode: 'daily_reuse',
      dailyReuse: counts.map((t) => ({
        shiftTemplateId: t.id,
        requiredHeadcount: t.headcount,
      })),
    },
    cells: dates.flatMap((date) =>
      counts.map((t) => ({
        date,
        shiftTemplateId: t.id,
        requiredHeadcount: t.headcount,
      })),
    ),
    publishedAt: '2026-08-10T10:00:00.000Z',
    publishedBy: '平台运营',
    createdAt: '2026-08-10T09:00:00.000Z',
    updatedAt: '2026-08-10T10:00:00.000Z',
  }
}

export const seedWeeklyShiftDemandPlans: WeeklyShiftDemandPlan[] = [
  {
    id: 'wdp_team_b_202608',
    teamId: 'team_b',
    weekStart: '2026-08-01',
    weekEnd: '2026-08-31',
    status: 'published',
    commonConfig: {
      mode: 'daily_reuse',
      dailyReuse: factoryShiftCounts.map((t) => ({
        shiftTemplateId: t.id,
        requiredHeadcount: t.headcount,
      })),
    },
    cells: augDates.flatMap((date) =>
      factoryShiftCounts.map((t) => ({
        date,
        shiftTemplateId: t.id,
        requiredHeadcount: t.headcount,
      })),
    ),
    publishedAt: '2026-07-28T10:00:00.000Z',
    publishedBy: '平台运营',
    createdAt: '2026-07-28T09:00:00.000Z',
    updatedAt: '2026-07-28T10:00:00.000Z',
  },
  buildDailyPlan('wdp_team_a_202608_w3', 'team_a', weekDates, teamAShiftCounts),
]
