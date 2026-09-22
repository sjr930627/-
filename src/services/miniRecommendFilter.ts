/** 推荐页抢班筛选：chips 配置与匹配逻辑 */

import { MINIAPP_DEMO_ANCHOR_DATE } from '@/constants/miniapp'

export type RecommendFilterChipKey =
  | 'brand'
  | 'shiftReq'
  | 'latest'
  | 'noExp'
  | 'distance'
  | 'settlement'

export type RecommendFilterChipKind = 'options' | 'toggle'

export interface RecommendFilterOption {
  id: string
  label: string
}

export interface RecommendFilterChipDef {
  key: RecommendFilterChipKey
  label: string
  kind: RecommendFilterChipKind
  /** 仅抢班班次卡片适用（直面帖不受该组约束） */
  shiftOnly?: boolean
}

/** 抢班 tab chips 固定顺序 */
export const SHIFT_FILTER_CHIPS: RecommendFilterChipDef[] = [
  { key: 'brand', label: '品牌', kind: 'options' },
  { key: 'shiftReq', label: '班次要求', kind: 'options', shiftOnly: true },
  { key: 'latest', label: '最新发布', kind: 'toggle' },
  { key: 'noExp', label: '无需经验', kind: 'toggle' },
  { key: 'distance', label: '距离', kind: 'options' },
  { key: 'settlement', label: '结算方式', kind: 'options' },
]

export const DISTANCE_OPTIONS: Array<RecommendFilterOption & { maxKm: number }> = [
  { id: 'd3', label: '3km以内', maxKm: 3 },
  { id: 'd5', label: '5km以内', maxKm: 5 },
  { id: 'd10', label: '10km以内', maxKm: 10 },
]

export const SETTLEMENT_OPTIONS: RecommendFilterOption[] = [
  { id: 'daily', label: '日结' },
  { id: 'weekly', label: '周结' },
  { id: 'monthly', label: '月结' },
  { id: 'instant', label: '秒结' },
]

/** 班次要求 · 类型 */
export const SHIFT_REQ_TYPE_OPTIONS: RecommendFilterOption[] = [
  { id: 'shift', label: '抢班' },
  { id: 'interview', label: '直面' },
]

/** 班次要求 · 热门筛选 */
export const SHIFT_REQ_HOT_OPTIONS: RecommendFilterOption[] = [
  { id: 'today', label: '今天班次' },
  { id: 'tomorrow', label: '明天班次' },
  { id: 'weekend', label: '周末班次' },
]

/** 班次要求 · 班次日期（全部与周一~周日互斥） */
export const SHIFT_REQ_WEEKDAY_OPTIONS: RecommendFilterOption[] = [
  { id: 'all', label: '全部' },
  { id: '1', label: '周一' },
  { id: '2', label: '周二' },
  { id: '3', label: '周三' },
  { id: '4', label: '周四' },
  { id: '5', label: '周五' },
  { id: '6', label: '周六' },
  { id: '0', label: '周日' },
]

export type ShiftReqTypeId = 'shift' | 'interview'

export interface ShiftReqFilterState {
  /** 类型：默认全选 */
  types: ShiftReqTypeId[]
  /** 热门筛选 */
  hot: string[]
  /** 班次日期：含 all */
  weekdays: string[]
}

export function createDefaultShiftReqFilter(): ShiftReqFilterState {
  return {
    types: ['shift', 'interview'],
    hot: [],
    weekdays: ['all'],
  }
}

export interface RecommendFilterState {
  brand: string[]
  shiftReq: ShiftReqFilterState
  latest: boolean
  noExp: boolean
  distance: string[]
  settlement: string[]
}

export function createEmptyRecommendFilters(): RecommendFilterState {
  return {
    brand: [],
    shiftReq: createDefaultShiftReqFilter(),
    latest: false,
    noExp: false,
    distance: [],
    settlement: [],
  }
}

export function cloneShiftReqFilter(src: ShiftReqFilterState): ShiftReqFilterState {
  return {
    types: [...src.types],
    hot: [...src.hot],
    weekdays: [...src.weekdays],
  }
}

/** 角标：热门 + 日期(不含全部)；类型不计 */
export function countShiftReqBadge(state: ShiftReqFilterState): number {
  const weekdayCount = state.weekdays.filter((id) => id !== 'all').length
  return state.hot.length + weekdayCount
}

export function isShiftReqFilterActive(state: ShiftReqFilterState): boolean {
  return countShiftReqBadge(state) > 0
}

export function parseDistanceKm(text?: string): number | null {
  if (!text) return null
  const m = text.match(/(\d+(?:\.\d+)?)\s*km/i)
  if (!m) return null
  const n = Number(m[1])
  return Number.isFinite(n) ? n : null
}

export function resolveSettlementIds(tags: string[], payHint?: string): string[] {
  const blob = `${tags.join(' ')} ${payHint || ''}`
  const ids: string[] = []
  if (/秒结|收入秒结/.test(blob)) ids.push('instant')
  if (/日结/.test(blob)) ids.push('daily')
  if (/周结/.test(blob)) ids.push('weekly')
  if (/月结/.test(blob)) ids.push('monthly')
  if (!ids.length && /上岗后收入|按量/.test(blob)) ids.push('monthly')
  return ids
}

export function hasLatestTag(tags: string[]) {
  return tags.some((t) => t === '近期发布' || t === '最新发布' || t === '新')
}

export function isNoExperienceRequired(params: {
  tags: string[]
  requirements?: string[]
  requirementsLine?: string
}) {
  const blob = [
    ...params.tags,
    ...(params.requirements || []),
    params.requirementsLine || '',
  ].join(' ')
  if (/无需经验|经验不限|学历不限|零经验/.test(blob)) return true
  if (/经验优先|需.*经验|有.*经验/.test(blob) && !/经验不限/.test(blob)) return false
  return /学历不限/.test(blob)
}

export interface RecommendFilterSlotMeta {
  date: string
  startTime: string
  weekday: number
}

export interface RecommendFilterableCard {
  kind: 'shift' | 'interview'
  brand: string
  tags: string[]
  title: string
  orgLabel?: string
  storeName?: string
  locationHint?: string
  locationSide?: string
  payHint?: string
  shiftBuckets?: string[]
  noExperience?: boolean
  keywordText?: string
  /** 用于班次要求匹配的班次/面试时段 */
  filterSlots?: RecommendFilterSlotMeta[]
}

function matchesOptionGroup(selected: string[], values: string[]) {
  if (!selected.length) return true
  return selected.some((id) => values.includes(id))
}

function matchesDistance(selected: string[], distanceKm: number | null) {
  if (!selected.length) return true
  if (distanceKm == null) return false
  return selected.some((id) => {
    const opt = DISTANCE_OPTIONS.find((o) => o.id === id)
    return opt ? distanceKm <= opt.maxKm : false
  })
}

function addDays(dateStr: string, days: number) {
  const d = new Date(`${dateStr}T12:00:00`)
  d.setDate(d.getDate() + days)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

function weekdayOf(dateStr: string) {
  return new Date(`${dateStr}T12:00:00`).getDay()
}

function isWeekend(dateStr: string) {
  const w = weekdayOf(dateStr)
  return w === 0 || w === 6
}

function slotMatchesHot(slot: RecommendFilterSlotMeta, hot: string[], today: string) {
  if (!hot.length) return true
  const tomorrow = addDays(today, 1)
  return hot.some((id) => {
    if (id === 'today') return slot.date === today
    if (id === 'tomorrow') return slot.date === tomorrow
    if (id === 'weekend') return isWeekend(slot.date)
    return false
  })
}

function slotMatchesWeekdays(slot: RecommendFilterSlotMeta, weekdays: string[]) {
  if (!weekdays.length || weekdays.includes('all')) return true
  return weekdays.includes(String(slot.weekday))
}

function cardMatchesShiftReq(
  card: RecommendFilterableCard,
  req: ShiftReqFilterState,
  today: string,
): boolean {
  const types = req.types.length ? req.types : (['shift', 'interview'] as ShiftReqTypeId[])
  if (!types.includes(card.kind)) return false

  const needSlotFilter =
    req.hot.length > 0 || (req.weekdays.length > 0 && !req.weekdays.includes('all'))

  if (!needSlotFilter) return true

  const slots = card.filterSlots || []
  if (!slots.length) return false

  return slots.some(
    (slot) =>
      slotMatchesHot(slot, req.hot, today) && slotMatchesWeekdays(slot, req.weekdays),
  )
}

export function buildFilterSlotMeta(params: {
  date: string
  startTime: string
  durationHours?: number
}): RecommendFilterSlotMeta {
  return {
    date: params.date,
    startTime: params.startTime,
    weekday: weekdayOf(params.date),
  }
}

export function matchRecommendCard(
  card: RecommendFilterableCard,
  filters: RecommendFilterState,
  keyword: string,
  _city: string,
  today: string = MINIAPP_DEMO_ANCHOR_DATE,
): boolean {
  const kw = keyword.trim().toLowerCase()
  if (kw) {
    const hay = (
      card.keywordText ||
      `${card.title} ${card.orgLabel || ''} ${card.storeName || ''} ${card.brand}`
    ).toLowerCase()
    if (!hay.includes(kw)) return false
  }

  if (filters.brand.length && !filters.brand.includes(card.brand)) return false

  if (!cardMatchesShiftReq(card, filters.shiftReq, today)) return false

  if (filters.latest && !hasLatestTag(card.tags)) return false
  if (filters.noExp && !card.noExperience) return false

  const distanceText = card.locationHint || card.locationSide || ''
  if (!matchesDistance(filters.distance, parseDistanceKm(distanceText))) return false

  const settlements = resolveSettlementIds(card.tags, card.payHint)
  if (!matchesOptionGroup(filters.settlement, settlements)) return false

  return true
}

export function chipSelectedCount(
  key: RecommendFilterChipKey,
  filters: RecommendFilterState,
): number {
  const def = SHIFT_FILTER_CHIPS.find((c) => c.key === key)
  if (!def) return 0
  if (key === 'shiftReq') return countShiftReqBadge(filters.shiftReq)
  if (def.kind === 'toggle') return filters[key] ? 1 : 0
  const arr = filters[key]
  return Array.isArray(arr) ? arr.length : 0
}

export function chipDisplayLabel(
  def: RecommendFilterChipDef,
  filters: RecommendFilterState,
): string {
  if (def.kind === 'toggle') return def.label
  const n = chipSelectedCount(def.key, filters)
  return n > 0 ? `${def.label} · ${n}` : def.label
}

export function isChipActive(
  def: RecommendFilterChipDef,
  filters: RecommendFilterState,
): boolean {
  if (def.kind === 'toggle') return Boolean(filters[def.key])
  return chipSelectedCount(def.key, filters) > 0
}

/** 类型多选：至少保留一项 */
export function toggleShiftReqType(draft: ShiftReqFilterState, id: ShiftReqTypeId) {
  const idx = draft.types.indexOf(id)
  if (idx >= 0) {
    if (draft.types.length <= 1) return
    draft.types.splice(idx, 1)
  } else {
    draft.types.push(id)
  }
}

/** 热门多选（或） */
export function toggleShiftReqHot(draft: ShiftReqFilterState, id: string) {
  const idx = draft.hot.indexOf(id)
  if (idx >= 0) draft.hot.splice(idx, 1)
  else draft.hot.push(id)
}

/** 日期：全部与其它互斥 */
export function toggleShiftReqWeekday(draft: ShiftReqFilterState, id: string) {
  if (id === 'all') {
    draft.weekdays = ['all']
    return
  }
  const withoutAll = draft.weekdays.filter((d) => d !== 'all')
  const idx = withoutAll.indexOf(id)
  if (idx >= 0) withoutAll.splice(idx, 1)
  else withoutAll.push(id)
  draft.weekdays = withoutAll.length ? withoutAll : ['all']
}
