import type { WorkflowNode, WorkflowNodeType, WorkflowRole } from '@/types'

export type WorkflowPaletteCategory = 'trigger' | 'task' | 'logic' | 'event' | 'system'

/** 面板项表示「节点类型」，拖入后名称由用户在右侧/画布自定义 */
export interface WorkflowPaletteItem {
  key: string
  category: WorkflowPaletteCategory
  /** 面板展示名（类型名，非业务节点名） */
  name: string
  icon: string
  description: string
  disabled?: boolean
  nodeType: WorkflowNodeType
  /** 创建时的默认执行角色，可在配置面板修改 */
  defaultRole: WorkflowRole
  triggerSettlement?: boolean
}

export const workflowPaletteCategoryMap: Record<WorkflowPaletteCategory, string> = {
  trigger: '触发器',
  task: '任务节点',
  logic: '逻辑节点',
  event: '外部事件',
  system: '系统节点',
}

/** 左侧节点面板展示的分类（不含逻辑、外部、系统） */
export const workflowPaletteVisibleCategories: WorkflowPaletteCategory[] = ['trigger', 'task']

export function isPaletteItemVisible(item: WorkflowPaletteItem): boolean {
  if (!workflowPaletteVisibleCategories.includes(item.category)) return false
  if (item.disabled) return false
  return true
}

export const workflowPaletteItems: WorkflowPaletteItem[] = [
  {
    key: 'trigger_start',
    category: 'trigger',
    name: '开始',
    icon: '🟢',
    description: '灵工领取任务（固定配置）',
    nodeType: 'start',
    defaultRole: 'worker',
  },
  {
    key: 'trigger_timer',
    category: 'trigger',
    name: '定时触发',
    icon: '⏰',
    description: '按时间自动启动',
    nodeType: 'middle',
    defaultRole: 'system',
    disabled: true,
  },
  {
    key: 'trigger_webhook',
    category: 'trigger',
    name: 'Webhook',
    icon: '🔗',
    description: '外部系统调用',
    nodeType: 'middle',
    defaultRole: 'system',
    disabled: true,
  },

  {
    key: 'node_middle',
    category: 'task',
    name: '普通节点',
    icon: '📌',
    description: '自定义名称与操作',
    nodeType: 'middle',
    defaultRole: 'worker',
  },
  {
    key: 'node_end',
    category: 'task',
    name: '终止节点',
    icon: '🎯',
    description: '流程结束并触发结算',
    nodeType: 'end',
    defaultRole: 'system',
  },

  {
    key: 'logic_if',
    category: 'logic',
    name: '条件分支',
    icon: '🔀',
    description: 'If-Else',
    nodeType: 'middle',
    defaultRole: 'system',
    disabled: true,
  },
  {
    key: 'logic_parallel',
    category: 'logic',
    name: '并行分支',
    icon: '📊',
    description: '多路径并行',
    nodeType: 'middle',
    defaultRole: 'system',
    disabled: true,
  },
  {
    key: 'logic_loop',
    category: 'logic',
    name: '循环',
    icon: '🔁',
    description: '重复执行',
    nodeType: 'middle',
    defaultRole: 'system',
    disabled: true,
  },

  {
    key: 'cond_punch',
    category: 'event',
    name: '打卡条件',
    icon: '📋',
    description: '挂到节点：需先打卡',
    nodeType: 'middle',
    defaultRole: 'worker',
  },
  {
    key: 'cond_exam',
    category: 'event',
    name: '考试条件',
    icon: '📝',
    description: '需培训考试通过',
    nodeType: 'middle',
    defaultRole: 'worker',
    disabled: true,
  },
  {
    key: 'cond_realname',
    category: 'event',
    name: '实名条件',
    icon: '🪪',
    description: '需完成实名',
    nodeType: 'middle',
    defaultRole: 'worker',
    disabled: true,
  },

  {
    key: 'sys_notify',
    category: 'system',
    name: '通知',
    icon: '📨',
    description: '发送消息',
    nodeType: 'middle',
    defaultRole: 'system',
    disabled: true,
  },
  {
    key: 'sys_wait',
    category: 'system',
    name: '等待',
    icon: '⏳',
    description: '等待时间/事件',
    nodeType: 'middle',
    defaultRole: 'system',
    disabled: true,
  },
]

export function getPaletteItem(key: string) {
  return workflowPaletteItems.find((i) => i.key === key)
}

/** 根据已有节点生成不重复的名称 */
export function suggestPaletteNodeName(
  item: WorkflowPaletteItem,
  existingNodes: WorkflowNode[],
): string {
  const names = new Set(existingNodes.map((n) => n.name.trim()).filter(Boolean))

  if (item.nodeType === 'start') {
    return '领取任务'
  }

  if (item.nodeType === 'end') {
    let i = existingNodes.filter((n) => n.nodeType === 'end').length + 1
    let name = i === 1 ? '结束' : `结束${i}`
    while (names.has(name)) {
      i += 1
      name = `结束${i}`
    }
    return name
  }

  let i = existingNodes.filter((n) => n.nodeType === 'middle').length + 1
  let name = `节点${i}`
  while (names.has(name)) {
    i += 1
    name = `节点${i}`
  }
  return name
}

export function buildNodeFromPalette(
  item: WorkflowPaletteItem,
  id: string,
  position: { x: number; y: number },
  sort: number,
  existingNodes: WorkflowNode[] = [],
): Partial<WorkflowNode> {
  const name = suggestPaletteNodeName(item, existingNodes)
  const base: Partial<WorkflowNode> = {
    id,
    name,
    stageLabel: '',
    nodeType: item.nodeType,
    role: item.defaultRole,
    actions: [],
    sort,
    position,
    paletteKey: item.key,
    triggerSettlement: item.nodeType === 'end' ? true : item.triggerSettlement,
  }

  if (item.key === 'cond_punch') {
    base.entryConditionGroups = [
      {
        id: `entry_${id}`,
        type: 'punch_record',
        generatePunchRecord: true,
        punchNavigateMode: 'jump_to_punch_page',
        listenTarget: 'task_executor',
        incompletePrompt: '请先完成打卡',
        punchCountMode: 'clock_in_out',
        allowedPunchMethods: ['gps'],
        locationSource: 'task_region',
        serviceTimeSource: 'task_schedule',
        requireWithinServiceWindow: true,
      },
    ]
  }

  return base
}

export function validatePaletteDrop(
  item: WorkflowPaletteItem,
  existingNodes: WorkflowNode[],
): string | null {
  if (item.nodeType === 'start' && existingNodes.some((n) => n.nodeType === 'start')) {
    return '每个流程只能有一个开始节点'
  }
  return null
}
