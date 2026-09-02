import type { EnterprisePosition } from '@/types'
import {
  DEFAULT_WORKFORCE_ENTERPRISE_ID,
  EMPLOYEE_POSITION_OPTIONS,
} from '@/constants/department'
import { seedGrabInterviewConfigs } from '@/mock/grabInterviewSeed'

const GRAB_SHIFT_POSITION_NAMES = [
  '营业厅营业员',
  '终端销售员',
  '营业厅导购',
  '收银员',
  '班组长',
  '安全员',
  '理货员',
]

/** 中国移动演示企业常用岗位完整画像 */
const RICH_POSITIONS: Omit<EnterprisePosition, 'id' | 'enterpriseId' | 'updatedAt'>[] = [
  {
    name: '营业厅营业员',
    profile: {
      positionName: '营业厅营业员',
      jobType: '零售服务',
      skills: ['健康证'],
      requirements: '熟悉营业厅基础业务，形象端正，能接受早晚班',
      description: '负责业务引导、营业厅收银与客户服务',
      ageMin: 18,
      ageMax: 45,
      gender: 'any',
      experience: '不限',
    },
    schedule: {
      scheduleMode: 'unified',
      weekdays: [1, 2, 3, 4, 5],
      timeSlots: [
        { id: 'slot_tpl_am', start: '09:00', end: '10:00' },
        { id: 'slot_tpl_pm', start: '14:00', end: '15:00' },
      ],
      dayTimeSlots: {},
      seatUnitMinutes: 30,
      seatsPerUnit: 2,
    },
  },
  {
    name: '营业厅导购',
    profile: {
      positionName: '营业厅导购',
      jobType: '零售服务',
      skills: ['健康证'],
      requirements: '具备终端推介与套餐讲解能力，沟通表达清晰',
      description: '负责厅内客户接待、号卡与终端推介',
      ageMin: 18,
      ageMax: 40,
      gender: 'any',
      experience: '有销售经验优先',
    },
  },
  {
    name: '终端销售员',
    profile: {
      positionName: '终端销售员',
      jobType: '零售销售',
      skills: ['健康证'],
      requirements: '熟悉智能手机与配件卖点，能完成体验引导与成交',
      description: '负责终端专区销售与库存陈列',
      ageMin: 18,
      ageMax: 45,
      gender: 'any',
      experience: '不限',
    },
  },
  {
    name: '收银员',
    profile: {
      positionName: '收银员',
      jobType: '零售服务',
      skills: ['健康证'],
      requirements: '细心负责，熟悉收银与开票基础流程',
      description: '负责营业厅收银结算与单据核对',
      ageMin: 18,
      ageMax: 50,
      gender: 'any',
      experience: '不限',
    },
  },
  {
    name: '班组长',
    profile: {
      positionName: '班组长',
      jobType: '管理',
      skills: [],
      requirements: '具备班组管理经验，能协调排班与现场秩序',
      description: '负责班组现场管理、交接班与异常上报',
      ageMin: 22,
      ageMax: 50,
      gender: 'any',
      experience: '1年以上相关经验',
    },
  },
  {
    name: '安全员',
    profile: {
      positionName: '安全员',
      jobType: '安全',
      skills: ['安全员证'],
      requirements: '熟悉营业厅安全生产规范，责任心强',
      description: '负责现场安全巡查与隐患整改跟进',
      ageMin: 20,
      ageMax: 55,
      gender: 'any',
      experience: '不限',
    },
  },
  {
    name: '理货员',
    profile: {
      positionName: '理货员',
      jobType: '仓储',
      skills: ['叉车证'],
      requirements: '能吃苦耐劳，有仓储经验优先',
      description: '负责仓库理货、上下架与盘点协助',
      ageMin: 18,
      ageMax: 50,
      gender: 'any',
      experience: '有仓储经验优先',
    },
  },
  {
    name: '营销专员',
    profile: {
      positionName: '营销专员',
      jobType: '市场',
      skills: [],
      requirements: '具备地推或厅外营销经验，抗压能力强',
      description: '负责外呼/地推获客与活动执行',
      ageMin: 18,
      ageMax: 40,
      gender: 'any',
      experience: '不限',
    },
  },
]

function slugify(name: string) {
  return name.replace(/\s+/g, '_').slice(0, 24)
}

function buildPosition(
  enterpriseId: string,
  id: string,
  data: Omit<EnterprisePosition, 'id' | 'enterpriseId' | 'updatedAt'>,
  updatedAt = '2026-08-10T09:00:00.000Z',
): EnterprisePosition {
  return {
    id,
    enterpriseId,
    name: data.name,
    profile: {
      ...data.profile,
      positionName: data.profile.positionName || data.name,
    },
    schedule: data.schedule,
    updatedAt,
  }
}

/** 合并面试模版 seed + 常用岗位名称，生成企业岗位库 */
export function buildSeedEnterprisePositions(
  enterpriseIds: string[] = [DEFAULT_WORKFORCE_ENTERPRISE_ID],
): EnterprisePosition[] {
  const result: EnterprisePosition[] = []
  const nameSetByEnt = new Map<string, Set<string>>()

  function ensureNameSet(enterpriseId: string) {
    let set = nameSetByEnt.get(enterpriseId)
    if (!set) {
      set = new Set()
      nameSetByEnt.set(enterpriseId, set)
    }
    return set
  }

  function pushUnique(enterpriseId: string, pos: EnterprisePosition) {
    const set = ensureNameSet(enterpriseId)
    const key = pos.profile.positionName.trim() || pos.name.trim()
    if (!key || set.has(key)) return
    set.add(key)
    result.push(pos)
  }

  for (const enterpriseId of enterpriseIds) {
    // 1) 面试配置里的岗位模版
    for (const cfg of seedGrabInterviewConfigs) {
      if (cfg.enterpriseId !== enterpriseId) continue
      for (const tpl of cfg.positionTemplates ?? []) {
        pushUnique(
          enterpriseId,
          buildPosition(
            enterpriseId,
            tpl.id,
            { name: tpl.name, profile: tpl.profile, schedule: tpl.schedule },
            tpl.updatedAt,
          ),
        )
      }
    }

    // 2) 完整画像预设
    RICH_POSITIONS.forEach((item, index) => {
      const id =
        enterpriseId === DEFAULT_WORKFORCE_ENTERPRISE_ID
          ? `epos_${slugify(item.profile.positionName)}_${index}`
          : `epos_${enterpriseId}_${slugify(item.profile.positionName)}_${index}`
      pushUnique(enterpriseId, buildPosition(enterpriseId, id, item))
    })

    // 3) 常量列表补齐（仅名称）
    const names = [...new Set([...EMPLOYEE_POSITION_OPTIONS, ...GRAB_SHIFT_POSITION_NAMES])]
    names.forEach((name, index) => {
      const id =
        enterpriseId === DEFAULT_WORKFORCE_ENTERPRISE_ID
          ? `epos_opt_${index}`
          : `epos_${enterpriseId}_opt_${index}`
      pushUnique(
        enterpriseId,
        buildPosition(enterpriseId, id, {
          name,
          profile: {
            positionName: name,
            jobType: '',
            skills: [],
            requirements: '',
            description: '',
            gender: 'any',
            experience: '不限',
          },
        }),
      )
    })
  }

  return result
}

export const seedEnterprisePositions: EnterprisePosition[] = buildSeedEnterprisePositions([
  DEFAULT_WORKFORCE_ENTERPRISE_ID,
  'ent_china_mobile_agent',
])

/** 按岗位名称查找 seed 岗位 ID（用于员工 seed 对齐） */
export function findSeedPositionId(
  positionName: string,
  enterpriseId = DEFAULT_WORKFORCE_ENTERPRISE_ID,
): string | undefined {
  const name = positionName.trim()
  if (!name || name === '待入驻' || name === '待完善') return undefined
  return seedEnterprisePositions.find(
    (p) =>
      p.enterpriseId === enterpriseId &&
      (p.profile.positionName === name || p.name === name),
  )?.id
}
