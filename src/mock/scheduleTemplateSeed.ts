import type { ScheduleTemplate } from '@/types'

export const seedScheduleTemplates: ScheduleTemplate[] = [
  {
    id: 'stpl_001',
    name: '旺季三班倒',
    teamId: 'team_a',
    attendanceGroupId: 'ag_factory',
    pattern: [
      'shift_morning',
      'shift_morning',
      'shift_afternoon',
      'shift_afternoon',
      'shift_night',
      'shift_rest',
      'shift_rest',
    ],
    isDefault: true,
    createdAt: '2026-06-01T08:00:00.000Z',
  },
  {
    id: 'stpl_002',
    name: '常规做五休二',
    teamId: 'team_a',
    attendanceGroupId: 'ag_factory',
    pattern: [
      'shift_morning',
      'shift_morning',
      'shift_morning',
      'shift_morning',
      'shift_morning',
      'shift_rest',
      'shift_rest',
    ],
    createdAt: '2026-06-15T08:00:00.000Z',
  },
]
