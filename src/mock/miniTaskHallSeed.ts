/** 小程序任务大厅演示扩展数据 */

export type MiniTaskCategory = 'main' | 'personal' | 'family' | 'gov' | 'converged'

export interface MiniTaskHallExtra {
  tags: string[]
  remain?: number
  /** 任务类型分类（移动业务场景） */
  category?: MiniTaskCategory
  participants?: number
  cardTone?: 'blue' | 'green' | 'purple' | 'orange' | 'pink'
  highlightTag?: string
  priceRange?: string
  /** 是否为中国移动示例任务 */
  isMobile?: boolean
}

export interface MiniTaskDetailExtra {
  bullets: string[]
  processSteps: string[]
  enterpriseMeta?: string
  rewardNote?: string
  location?: string
  address?: string
}

export const miniTaskCategoryConfig: {
  key: MiniTaskCategory
  label: string
  icon: string
  color: string
}[] = [
  { key: 'main', label: '主推场景', icon: 'main', color: '#3b82f6' },
  { key: 'personal', label: '个人业务', icon: 'personal', color: '#22c55e' },
  { key: 'family', label: '家庭业务', icon: 'family', color: '#a855f7' },
  { key: 'gov', label: '政企业务', icon: 'gov', color: '#f97316' },
  { key: 'converged', label: '融合业务', icon: 'converged', color: '#ec4899' },
]

export const taskHallEnterpriseOptions = [
  { id: 'ent_china_mobile_agent', label: '中国移动', mobileOnly: true },
  { id: 'all', label: '全部企业', mobileOnly: false },
]

export const taskHallExtras: Record<string, MiniTaskHallExtra> = {
  task_5g_july: { tags: ['高佣金', '长期'], remain: 114, category: 'main' },
  task_hall_recruit: { tags: ['高佣金', '急'], remain: 12, category: 'main', participants: 86 },
  task_hall_kitchen: { tags: ['新'], remain: 8, category: 'main', participants: 42 },
  task_hall_share: { tags: ['限时'], remain: 30, category: 'personal', participants: 55 },
  task_hall_weekend: { tags: ['长期'], category: 'family', participants: 18 },
  task_hall_member: { tags: ['高佣金'], remain: 45, category: 'personal', participants: 67 },
  task_insurance_july: { tags: ['高佣金', '急'], remain: 28, category: 'main', participants: 22 },
  task_hall_display: { tags: ['新', '限时'], remain: 20, category: 'gov', participants: 20 },
  // 中国移动示例
  task_cm_sim: {
    tags: ['热门'],
    remain: 120,
    category: 'main',
    participants: 126,
    cardTone: 'blue',
    highlightTag: '热门',
    priceRange: '¥50-200/人',
    isMobile: true,
  },
  task_cm_sub: {
    tags: ['新品'],
    remain: 80,
    category: 'main',
    participants: 89,
    cardTone: 'green',
    highlightTag: '新品',
    priceRange: '¥30-80/人',
    isMobile: true,
  },
  task_cm_port: {
    tags: ['高佣'],
    remain: 45,
    category: 'main',
    participants: 64,
    cardTone: 'purple',
    highlightTag: '高佣',
    priceRange: '¥80-150/人',
    isMobile: true,
  },
  task_cm_5g: {
    tags: ['高佣'],
    remain: 60,
    category: 'personal',
    participants: 52,
    cardTone: 'green',
    highlightTag: '高佣',
    priceRange: '¥40-100/次',
    isMobile: true,
  },
  task_cm_flow: {
    tags: ['长期'],
    remain: undefined,
    category: 'personal',
    participants: 38,
    cardTone: 'blue',
    priceRange: '¥20-50/次',
    isMobile: true,
  },
  task_cm_broad: {
    tags: ['热门'],
    remain: 35,
    category: 'family',
    participants: 41,
    cardTone: 'purple',
    highlightTag: '热门',
    priceRange: '¥100-300/单',
    isMobile: true,
  },
  task_cm_iptv: {
    tags: ['新'],
    remain: 28,
    category: 'family',
    participants: 29,
    cardTone: 'pink',
    highlightTag: '新',
    priceRange: '¥60-120/单',
    isMobile: true,
  },
  task_cm_line: {
    tags: ['高佣'],
    remain: 15,
    category: 'gov',
    participants: 12,
    cardTone: 'orange',
    highlightTag: '高佣',
    priceRange: '¥200-500/单',
    isMobile: true,
  },
  task_cm_cloud: {
    tags: ['长期'],
    remain: 20,
    category: 'gov',
    participants: 8,
    cardTone: 'orange',
    priceRange: '¥150-400/单',
    isMobile: true,
  },
  task_cm_bundle: {
    tags: ['热门'],
    remain: 50,
    category: 'converged',
    participants: 73,
    cardTone: 'pink',
    highlightTag: '热门',
    priceRange: '¥80-180/次',
    isMobile: true,
  },
  task_cm_smart: {
    tags: ['新'],
    remain: 32,
    category: 'converged',
    participants: 24,
    cardTone: 'pink',
    highlightTag: '新',
    priceRange: '¥50-120/次',
    isMobile: true,
  },
}

const defaultDetailBullets = [
  '按要求完成推广并上传有效凭证',
  '信息须真实有效，虚假推广将取消资格',
  '奖励在审核通过后自动发放',
]

const defaultProcessSteps = [
  '领取任务：点击下方「领取任务」按钮',
  '执行任务：按任务要求完成推广并提交信息',
  '企业审核：等待企业审核确认',
  '获得奖励：审核通过后奖励到账',
]

export const taskDetailExtras: Record<string, MiniTaskDetailExtra> = {
  task_hall_recruit: {
    enterpriseMeta: '餐饮 · 连锁品牌 · 杭州市西湖区',
    rewardNote: '完成推荐并按规则结算',
    bullets: [
      '候选人年龄 18-45 周岁，身体健康',
      '具备基本服务意识和沟通能力',
      '每人最多推荐 12 人',
      '信息须真实有效，虚假推荐将取消资格',
    ],
    processSteps: [
      '领取任务：点击页面下方「领取任务」',
      '推荐候选人：通过平台提交候选人姓名、联系方式等信息',
      '企业审核面试：企业 HR 审核并安排面试',
      '入职确认：候选人通过面试并工作满 7 天',
      '获得奖励：奖励自动发放至账户',
    ],
  },
  task_cm_sim: {
    enterpriseMeta: '运营商 · 全国连锁 · 本地营业厅',
    location: '中国移动营业厅（朝阳店）',
    address: '北京市朝阳区建国路88号',
    rewardNote: '按办理成功单量阶梯结算',
    bullets: [
      '支持主卡、营销案、副卡等组合办理',
      '需在指定营业厅或授权渠道完成',
      '办理成功后 24 小时内上传凭证',
      '虚假信息将永久取消推广资格',
    ],
    processSteps: defaultProcessSteps,
  },
}

export function getTaskHallExtra(taskId: string): MiniTaskHallExtra {
  return taskHallExtras[taskId] ?? { tags: [], category: 'main' }
}

export function getTaskDetailExtra(taskId: string): MiniTaskDetailExtra {
  return (
    taskDetailExtras[taskId] ?? {
      bullets: defaultDetailBullets,
      processSteps: defaultProcessSteps,
    }
  )
}

export function getTaskLocationLabel(
  task: { region?: string; enterpriseName: string; taskTypeName: string },
  detail: MiniTaskDetailExtra,
): { title: string; address: string } {
  if (detail.location || detail.address) {
    return {
      title: detail.location ?? task.enterpriseName,
      address: detail.address ?? task.region ?? '详见任务说明',
    }
  }
  return {
    title: task.enterpriseName,
    address: task.region ? `${task.region} · ${task.taskTypeName}` : task.taskTypeName,
  }
}

export function getEnterpriseHallLabel(enterpriseId: string): string {
  const map: Record<string, string> = {
    ent_china_mobile_agent: '运营商 · 全国连锁',
    ent_pingan_partner: '零售 · 连锁品牌',
    ent_china_telecom_agent: '餐饮 · 区域品牌',
    ent_unilever_partner: '快消 · 品牌方',
  }
  return map[enterpriseId] ?? '企业服务'
}

export function getCategoryLabel(key: MiniTaskCategory) {
  return miniTaskCategoryConfig.find((c) => c.key === key)?.label ?? key
}
