export interface EnterpriseWorkforceSnapshot {
  departmentCount: number
  /** 排班人员数（在职） */
  scheduleEmployeeCount: number
  /** 抢班池人数（在职） */
  grabPoolCount: number
  /** @deprecated 兼容旧字段，等同 scheduleEmployeeCount + grabPoolCount 近似 */
  activeCount?: number
  pendingCount: number
  resignedCount: number
  teamCount: number
  /** 今日在岗（演示快照） */
  onDutyCount: number
  /** 今日缺岗（演示快照） */
  absentCount: number
  /** 班次缺口（演示快照） */
  shiftGap: number
}

/** 企业人员统计展示用的演示日（对齐排班/打卡 seed） */
export const WORKFORCE_STATS_DEMO_DATE = '2026-07-28'

/** Demo 快照：无完整组织架构 seed 的企业展示汇总数据 */
export const seedEnterpriseWorkforceSnapshots: Record<string, EnterpriseWorkforceSnapshot> = {
  ent_stars_telecom: {
    departmentCount: 16,
    scheduleEmployeeCount: 298,
    grabPoolCount: 44,
    activeCount: 342,
    pendingCount: 14,
    resignedCount: 21,
    teamCount: 28,
    onDutyCount: 318,
    absentCount: 14,
    shiftGap: 26,
  },
  ent_china_mobile_agent: {
    departmentCount: 12,
    scheduleEmployeeCount: 241,
    grabPoolCount: 45,
    activeCount: 286,
    pendingCount: 8,
    resignedCount: 15,
    teamCount: 24,
    onDutyCount: 268,
    absentCount: 12,
    shiftGap: 18,
  },
  ent_pingan_partner: {
    departmentCount: 18,
    scheduleEmployeeCount: 360,
    grabPoolCount: 52,
    activeCount: 412,
    pendingCount: 12,
    resignedCount: 23,
    teamCount: 36,
    onDutyCount: 391,
    absentCount: 15,
    shiftGap: 31,
  },
  ent_china_telecom_agent: {
    departmentCount: 9,
    scheduleEmployeeCount: 132,
    grabPoolCount: 24,
    activeCount: 156,
    pendingCount: 5,
    resignedCount: 8,
    teamCount: 14,
    onDutyCount: 148,
    absentCount: 6,
    shiftGap: 9,
  },
  ent_unilever_partner: {
    departmentCount: 7,
    scheduleEmployeeCount: 82,
    grabPoolCount: 16,
    activeCount: 98,
    pendingCount: 3,
    resignedCount: 6,
    teamCount: 11,
    onDutyCount: 92,
    absentCount: 4,
    shiftGap: 7,
  },
  ent_huaxia_logistics: {
    departmentCount: 15,
    scheduleEmployeeCount: 456,
    grabPoolCount: 67,
    activeCount: 523,
    pendingCount: 18,
    resignedCount: 42,
    teamCount: 48,
    onDutyCount: 498,
    absentCount: 19,
    shiftGap: 38,
  },
  ent_green_energy: {
    departmentCount: 10,
    scheduleEmployeeCount: 161,
    grabPoolCount: 26,
    activeCount: 187,
    pendingCount: 6,
    resignedCount: 11,
    teamCount: 19,
    onDutyCount: 176,
    absentCount: 8,
    shiftGap: 12,
  },
  ent_jingdong_retail: {
    departmentCount: 6,
    scheduleEmployeeCount: 51,
    grabPoolCount: 13,
    activeCount: 64,
    pendingCount: 0,
    resignedCount: 28,
    teamCount: 8,
    onDutyCount: 58,
    absentCount: 3,
    shiftGap: 5,
  },
  ent_anhui_insurance: {
    departmentCount: 11,
    scheduleEmployeeCount: 198,
    grabPoolCount: 36,
    activeCount: 234,
    pendingCount: 9,
    resignedCount: 17,
    teamCount: 22,
    onDutyCount: 221,
    absentCount: 9,
    shiftGap: 14,
  },
  ent_sichuan_fmcg: {
    departmentCount: 8,
    scheduleEmployeeCount: 118,
    grabPoolCount: 24,
    activeCount: 142,
    pendingCount: 4,
    resignedCount: 9,
    teamCount: 16,
    onDutyCount: 133,
    absentCount: 5,
    shiftGap: 11,
  },
  ent_shanghai_retail: {
    departmentCount: 14,
    scheduleEmployeeCount: 275,
    grabPoolCount: 43,
    activeCount: 318,
    pendingCount: 11,
    resignedCount: 31,
    teamCount: 29,
    onDutyCount: 301,
    absentCount: 11,
    shiftGap: 22,
  },
  ent_hubei_telecom: {
    departmentCount: 13,
    scheduleEmployeeCount: 238,
    grabPoolCount: 38,
    activeCount: 276,
    pendingCount: 7,
    resignedCount: 19,
    teamCount: 25,
    onDutyCount: 262,
    absentCount: 10,
    shiftGap: 16,
  },
}

export { DEFAULT_WORKFORCE_ENTERPRISE_ID } from '@/constants/department'
