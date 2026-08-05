export interface EnterpriseWorkforceSnapshot {
  departmentCount: number
  activeCount: number
  pendingCount: number
  resignedCount: number
  teamCount: number
}

/** Demo 快照：无完整组织架构 seed 的企业展示汇总数据 */
export const seedEnterpriseWorkforceSnapshots: Record<string, EnterpriseWorkforceSnapshot> = {
  ent_china_mobile_agent: {
    departmentCount: 12,
    activeCount: 286,
    pendingCount: 8,
    resignedCount: 15,
    teamCount: 24,
  },
  ent_pingan_partner: {
    departmentCount: 18,
    activeCount: 412,
    pendingCount: 12,
    resignedCount: 23,
    teamCount: 36,
  },
  ent_china_telecom_agent: {
    departmentCount: 9,
    activeCount: 156,
    pendingCount: 5,
    resignedCount: 8,
    teamCount: 14,
  },
  ent_unilever_partner: {
    departmentCount: 7,
    activeCount: 98,
    pendingCount: 3,
    resignedCount: 6,
    teamCount: 11,
  },
  ent_huaxia_logistics: {
    departmentCount: 15,
    activeCount: 523,
    pendingCount: 18,
    resignedCount: 42,
    teamCount: 48,
  },
  ent_green_energy: {
    departmentCount: 10,
    activeCount: 187,
    pendingCount: 6,
    resignedCount: 11,
    teamCount: 19,
  },
  ent_jingdong_retail: {
    departmentCount: 6,
    activeCount: 64,
    pendingCount: 0,
    resignedCount: 28,
    teamCount: 8,
  },
  ent_anhui_insurance: {
    departmentCount: 11,
    activeCount: 234,
    pendingCount: 9,
    resignedCount: 17,
    teamCount: 22,
  },
  ent_sichuan_fmcg: {
    departmentCount: 8,
    activeCount: 142,
    pendingCount: 4,
    resignedCount: 9,
    teamCount: 16,
  },
  ent_shanghai_retail: {
    departmentCount: 14,
    activeCount: 318,
    pendingCount: 11,
    resignedCount: 31,
    teamCount: 29,
  },
  ent_hubei_telecom: {
    departmentCount: 13,
    activeCount: 276,
    pendingCount: 7,
    resignedCount: 19,
    teamCount: 25,
  },
}

export { DEFAULT_WORKFORCE_ENTERPRISE_ID } from '@/constants/department'
