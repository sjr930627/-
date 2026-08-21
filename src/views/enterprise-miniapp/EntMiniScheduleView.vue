<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import dayjs from 'dayjs'
import isoWeek from 'dayjs/plugin/isoWeek'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ArrowLeft,
  ArrowRight,
  Delete,
  DocumentCopy,
  MagicStick,
  MoreFilled,
  Promotion,
  RefreshLeft,
  RefreshRight,
  WarningFilled,
} from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'
import { useEnterpriseMiniAuth } from '@/composables/useEnterpriseMiniAuth'
import { detectComplianceConflicts } from '@/services/scheduleCompliance'
import type { AttendanceGroupCompliance } from '@/types'
import { calcShiftHours } from '@/utils'

dayjs.extend(isoWeek)

const DRAFT_KEY = 'enterprise-mini:schedule-line-draft'

/** 与设计稿一致的画笔色 */
const BRUSH_META = [
  { id: 'shift_morning', name: '早班', short: '早', time: '08-16', color: '#3B82F6', soft: '#DBEAFE' },
  { id: 'shift_afternoon', name: '中班', short: '中', time: '16-00', color: '#F97316', soft: '#FFEDD5' },
  { id: 'shift_night', name: '夜班', short: '夜', time: '00-08', color: '#8B5CF6', soft: '#EDE9FE' },
  { id: 'shift_flex', name: '天地班', short: '天地', time: '8-12+18-22', color: '#22C55E', soft: '#DCFCE7' },
  { id: 'eraser', name: '橡皮', short: '擦', time: '清除', color: '#9CA3AF', soft: '#F3F4F6' },
] as const

const TEAM_COLORS = ['#3B82F6', '#F97316', '#8B5CF6', '#22C55E', '#EC4899', '#14B8A6']

const router = useRouter()
const store = useAppStore()
const { enterpriseId } = useEnterpriseMiniAuth()

const weekAnchor = ref('2026-07-27')
const teamId = ref('')
const brushId = ref('shift_morning')
const continuousMode = ref(true)
const moreOpen = ref(false)
const cellMenu = ref<{ employeeId: string; date: string } | null>(null)
const conflictTip = ref<{ employeeId: string; date: string; messages: string[] } | null>(null)
const landscapeTip = ref(false)
const selectedRowId = ref('')

type HistItem = { employeeId: string; date: string; prev: string | null; next: string | null }
const undoStack = ref<HistItem[][]>([])
const redoStack = ref<HistItem[][]>([])

const defaultCompliance: AttendanceGroupCompliance = {
  maxDailyHours: 12,
  maxWeeklyHours: 60,
  maxMonthlyHours: 220,
  maxConsecutiveWorkdays: 3,
  minShiftIntervalHours: 8,
}

const brushes = computed(() => [...BRUSH_META])

const longPressOptions = [
  { id: 'shift_morning', label: '早班' },
  { id: 'shift_afternoon', label: '中班' },
  { id: 'shift_night', label: '夜班' },
  { id: 'shift_flex', label: '天地班' },
  { id: 'shift_rest', label: '休息' },
  { id: 'leave', label: '请假' },
]

const enterpriseTeams = computed(() => {
  const empIds = new Set(
    store.employees.filter((e) => e.enterpriseId === enterpriseId.value).map((e) => e.id),
  )
  return store.teams.filter((t) => t.memberIds.some((id) => empIds.has(id)))
})

const employees = computed(() => {
  let list = store.employees.filter(
    (e) => e.status === 'active' && e.enterpriseId === enterpriseId.value,
  )
  if (teamId.value) {
    const team = store.teams.find((t) => t.id === teamId.value)
    const ids = new Set(team?.memberIds || [])
    list = list.filter((e) => ids.has(e.id))
  }
  return list
})

/** 按班组分组，用于矩阵左侧分组展示 */
const groupedRows = computed(() => {
  const teams = enterpriseTeams.value
  const used = new Set<string>()
  const groups: { id: string; name: string; color: string; members: typeof employees.value }[] = []

  teams.forEach((t, i) => {
    if (teamId.value && t.id !== teamId.value) return
    const members = employees.value.filter((e) => t.memberIds.includes(e.id))
    members.forEach((m) => used.add(m.id))
    if (!members.length) return
    groups.push({
      id: t.id,
      name: t.name,
      color: TEAM_COLORS[i % TEAM_COLORS.length],
      members,
    })
  })

  const orphans = employees.value.filter((e) => !used.has(e.id))
  if (orphans.length) {
    groups.push({
      id: '_other',
      name: '未分组',
      color: '#9CA3AF',
      members: orphans,
    })
  }
  return groups
})

const weekStart = computed(() => dayjs(weekAnchor.value).startOf('isoWeek').format('YYYY-MM-DD'))
const weekDays = computed(() =>
  Array.from({ length: 7 }, (_, i) => dayjs(weekStart.value).add(i, 'day').format('YYYY-MM-DD')),
)
const weekLabel = computed(() => {
  const d = dayjs(weekStart.value)
  return `${d.year()}年 第${d.isoWeek()}周`
})
const weekRange = computed(() => {
  const s = dayjs(weekStart.value)
  const e = s.add(6, 'day')
  return `${s.format('MM/DD')} - ${e.format('MM/DD')}`
})
const weekdayLabels = ['一', '二', '三', '四', '五', '六', '日']

const selectedBrush = computed(() => brushes.value.find((b) => b.id === brushId.value))

const compliance = computed(() => {
  const team = enterpriseTeams.value[0]
  const group = store.attendanceGroups.find((g) => g.id === team?.attendanceGroupId)
  return group?.compliance || defaultCompliance
})

function getAsn(employeeId: string, date: string) {
  const all = store.assignments.filter((a) => a.employeeId === employeeId && a.date === date)
  return all.find((a) => !a.published) ?? all.find((a) => a.published)
}

function avatarChar(name: string) {
  return name.slice(0, 1)
}

function conflictLabel(messages: string[]) {
  const text = messages.join(' ')
  if (/连续.*夜|夜班/.test(text)) return '×3夜'
  if (/工时|小时/.test(text)) return '超时'
  if (/间隔/.test(text)) return '间隔'
  return '冲突'
}

function cellDisplay(employeeId: string, date: string) {
  const key = `${employeeId}_${date}`
  const conflicts = conflictMap.value.get(key)
  if (conflicts?.length) {
    return {
      kind: 'conflict' as const,
      short: conflictLabel(conflicts),
      color: '#EF4444',
      soft: '#FEE2E2',
      text: '#fff',
    }
  }

  const asn = getAsn(employeeId, date)
  if (!asn) return null

  if (asn.shiftId === 'shift_rest' || asn.note?.includes('请假')) {
    if (asn.note?.includes('请假')) {
      return {
        kind: 'leave' as const,
        short: '请假',
        color: '#F59E0B',
        soft: '#FEF3C7',
        text: '#B45309',
      }
    }
    return {
      kind: 'rest' as const,
      short: '休',
      color: '#D1D5DB',
      soft: '#F3F4F6',
      text: '#9CA3AF',
    }
  }

  const brush = BRUSH_META.find((b) => b.id === asn.shiftId)
  const shift = store.shifts.find((s) => s.id === asn.shiftId)
  return {
    kind: 'shift' as const,
    short: brush?.short || shift?.name?.slice(0, 1) || '班',
    color: brush?.color || shift?.color || '#3B82F6',
    soft: brush?.soft || '#DBEAFE',
    text: '#fff',
  }
}

const conflictMap = computed(() => {
  const map = new Map<string, string[]>()
  employees.value.forEach((emp) => {
    weekDays.value.forEach((date) => {
      const asn = getAsn(emp.id, date)
      if (!asn || asn.shiftId === 'shift_rest') return
      const list = detectComplianceConflicts(
        emp.id,
        date,
        asn.shiftId,
        store.assignments,
        store.shifts,
        compliance.value,
      )
      if (list.length) map.set(`${emp.id}_${date}`, list.map((c) => c.message))
    })
  })
  return map
})

function empHasConflict(employeeId: string) {
  return weekDays.value.some((d) => conflictMap.value.has(`${employeeId}_${d}`))
}

function chipStyle(employeeId: string, date: string) {
  const d = cellDisplay(employeeId, date)
  if (!d) return {}
  if (d.kind === 'shift' || d.kind === 'conflict') {
    return { background: d.color, color: '#fff', borderColor: 'transparent' }
  }
  if (d.kind === 'leave') {
    return { background: d.soft, color: d.text, borderColor: d.color }
  }
  return { background: d.soft, color: d.text, borderColor: 'transparent' }
}

const stats = computed(() => {
  let count = 0
  let hours = 0
  employees.value.forEach((emp) => {
    weekDays.value.forEach((date) => {
      const asn = getAsn(emp.id, date)
      if (!asn || asn.shiftId === 'shift_rest') return
      count += 1
      const shift = store.shifts.find((s) => s.id === asn.shiftId)
      if (shift) hours += calcShiftHours(shift)
      else if (asn.shiftId === 'shift_flex') hours += 12
    })
  })
  return { count, hours: Math.round(hours), conflicts: conflictMap.value.size }
})

function shiftWeek(delta: number) {
  weekAnchor.value = dayjs(weekStart.value).add(delta, 'week').format('YYYY-MM-DD')
}

function resolveTeamId(employeeId: string) {
  return (
    store.teams.find((t) => t.memberIds.includes(employeeId))?.id ||
    teamId.value ||
    enterpriseTeams.value[0]?.id
  )
}

function applyCell(employeeId: string, date: string, nextShiftId: string | null, note?: string) {
  const prevAsn = getAsn(employeeId, date)
  const prev = prevAsn?.shiftId ?? null
  const prevNote = prevAsn?.note
  if (prev === nextShiftId && !note) return null
  if (nextShiftId === 'leave' && prev === 'shift_rest' && prevNote?.includes('请假') && !note) {
    return null
  }

  if (!nextShiftId || nextShiftId === 'eraser') {
    store.upsertAssignment({
      employeeId,
      date,
      shiftId: 'shift_rest',
      teamId: resolveTeamId(employeeId),
      published: false,
      manualEdited: true,
      note: '橡皮清除',
    })
    return { employeeId, date, prev, next: 'shift_rest' } as HistItem
  }

  store.upsertAssignment({
    employeeId,
    date,
    shiftId: nextShiftId === 'leave' ? 'shift_rest' : nextShiftId,
    teamId: resolveTeamId(employeeId),
    published: false,
    manualEdited: true,
    note:
      note ||
      (nextShiftId === 'leave'
        ? '请假'
        : nextShiftId === 'shift_flex'
          ? '天地班 8-12+18-22'
          : '企业小程序划线排班'),
  })
  return {
    employeeId,
    date,
    prev,
    next: nextShiftId === 'leave' ? 'shift_rest' : nextShiftId,
  } as HistItem
}

const dragBatch = ref<HistItem[]>([])

function paint(employeeId: string, date: string, overrideShiftId?: string, batching = false) {
  const target = overrideShiftId ?? brushId.value
  const item = applyCell(employeeId, date, target === 'eraser' ? 'eraser' : target)
  if (!item) return
  if (batching) {
    dragBatch.value.push(item)
  } else {
    undoStack.value.push([item])
    redoStack.value = []
  }
  persistDraft()
  try {
    navigator.vibrate?.(8)
  } catch {
    /* ignore */
  }
}

function paintBrush(employeeId: string, date: string, shiftKey: string) {
  cellMenu.value = null
  const item = applyCell(
    employeeId,
    date,
    shiftKey === 'leave' ? 'leave' : shiftKey,
    shiftKey === 'leave' ? '请假' : undefined,
  )
  if (item) {
    undoStack.value.push([item])
    redoStack.value = []
    persistDraft()
  }
}

const painting = ref(false)
const paintedKeys = ref(new Set<string>())
const pointerStart = ref<{ employeeId: string; date: string; x: number; y: number } | null>(null)
const pointerMoved = ref(false)
const matrixScale = ref(1)
let pinchStartDist = 0
let pinchStartScale = 1

function openConflict(employeeId: string, date: string) {
  const msgs = conflictMap.value.get(`${employeeId}_${date}`)
  if (!msgs?.length) return false
  conflictTip.value = { employeeId, date, messages: msgs }
  return true
}

function paintCellKey(employeeId: string, date: string) {
  const key = `${employeeId}_${date}`
  if (paintedKeys.value.has(key)) return
  paintedKeys.value.add(key)
  paint(employeeId, date, undefined, true)
}

function cellFromPoint(x: number, y: number) {
  const el = document.elementFromPoint(x, y) as HTMLElement | null
  const cell = el?.closest?.('td.cell') as HTMLElement | null
  if (!cell) return null
  const employeeId = cell.dataset.employeeId
  const date = cell.dataset.date
  if (!employeeId || !date) return null
  return { employeeId, date }
}

function onCellPointerDown(employeeId: string, date: string, e: PointerEvent) {
  pointerStart.value = { employeeId, date, x: e.clientX, y: e.clientY }
  pointerMoved.value = false
  if (continuousMode.value) {
    painting.value = true
    paintedKeys.value = new Set()
    dragBatch.value = []
  }
}

function onMatrixPointerMove(e: PointerEvent) {
  if (!painting.value || !continuousMode.value || !pointerStart.value) return
  const dx = e.clientX - pointerStart.value.x
  const dy = e.clientY - pointerStart.value.y
  if (!pointerMoved.value && Math.hypot(dx, dy) < 8) return
  if (!pointerMoved.value) {
    pointerMoved.value = true
    paintCellKey(pointerStart.value.employeeId, pointerStart.value.date)
  }
  const hit = cellFromPoint(e.clientX, e.clientY)
  if (hit) paintCellKey(hit.employeeId, hit.date)
}

function onCellPointerUp() {
  if (continuousMode.value && painting.value) {
    if (!pointerMoved.value && pointerStart.value) {
      const { employeeId, date } = pointerStart.value
      if (!openConflict(employeeId, date)) {
        paint(employeeId, date)
      }
    } else if (dragBatch.value.length) {
      undoStack.value.push([...dragBatch.value])
      redoStack.value = []
      const last = dragBatch.value[dragBatch.value.length - 1]
      const msgs = conflictMap.value.get(`${last.employeeId}_${last.date}`)
      if (msgs?.length) ElMessage.warning(msgs[0])
    }
  }
  painting.value = false
  dragBatch.value = []
  pointerStart.value = null
  pointerMoved.value = false
}

function onCellClick(employeeId: string, date: string) {
  if (continuousMode.value) return
  if (openConflict(employeeId, date)) return
  paint(employeeId, date)
}

function onPinchStart(e: TouchEvent) {
  if (e.touches.length !== 2) return
  const [a, b] = [e.touches[0], e.touches[1]]
  pinchStartDist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
  pinchStartScale = matrixScale.value
}

function onPinchMove(e: TouchEvent) {
  if (e.touches.length !== 2 || !pinchStartDist) return
  e.preventDefault()
  const [a, b] = [e.touches[0], e.touches[1]]
  const dist = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY)
  matrixScale.value = Math.min(1.6, Math.max(0.85, pinchStartScale * (dist / pinchStartDist)))
}

function coverConflictWithBrush() {
  if (!conflictTip.value) return
  const { employeeId, date } = conflictTip.value
  conflictTip.value = null
  paint(employeeId, date)
}

let longPressTimer: ReturnType<typeof setTimeout> | null = null
function onCellTouchStart(employeeId: string, date: string) {
  longPressTimer = setTimeout(() => {
    cellMenu.value = { employeeId, date }
    try {
      navigator.vibrate?.(15)
    } catch {
      /* ignore */
    }
  }, 480)
}
function onCellTouchEnd() {
  if (longPressTimer) {
    clearTimeout(longPressTimer)
    longPressTimer = null
  }
}

function undo() {
  const batch = undoStack.value.pop()
  if (!batch?.length) return
  batch
    .slice()
    .reverse()
    .forEach((item) => {
      applyCell(item.employeeId, item.date, item.prev)
    })
  redoStack.value.push(batch)
  persistDraft()
}

function redo() {
  const batch = redoStack.value.pop()
  if (!batch?.length) return
  batch.forEach((item) => applyCell(item.employeeId, item.date, item.next))
  undoStack.value.push(batch)
  persistDraft()
}

function persistDraft() {
  localStorage.setItem(
    DRAFT_KEY,
    JSON.stringify({
      weekAnchor: weekAnchor.value,
      teamId: teamId.value,
      brushId: brushId.value,
      at: Date.now(),
    }),
  )
}

function restoreDraft() {
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return
    const data = JSON.parse(raw) as { weekAnchor?: string; teamId?: string; brushId?: string }
    if (data.weekAnchor) weekAnchor.value = data.weekAnchor
    if (data.teamId !== undefined) teamId.value = data.teamId
    if (data.brushId) brushId.value = data.brushId
  } catch {
    /* ignore */
  }
}

function clearWeek() {
  const batch: HistItem[] = []
  employees.value.forEach((emp) => {
    weekDays.value.forEach((date) => {
      const item = applyCell(emp.id, date, 'eraser')
      if (item) batch.push(item)
    })
  })
  if (batch.length) {
    undoStack.value.push(batch)
    redoStack.value = []
  }
  moreOpen.value = false
  ElMessage.success('已清空本周排班')
}

function fillRow(employeeId: string) {
  const batch: HistItem[] = []
  weekDays.value.forEach((date) => {
    const item = applyCell(employeeId, date, brushId.value === 'eraser' ? 'shift_rest' : brushId.value)
    if (item) batch.push(item)
  })
  if (batch.length) {
    undoStack.value.push(batch)
    redoStack.value = []
  }
  moreOpen.value = false
  ElMessage.success('已批量填充该行')
}

function copyToOthers(sourceId: string) {
  const batch: HistItem[] = []
  employees.value.forEach((emp) => {
    if (emp.id === sourceId) return
    weekDays.value.forEach((date) => {
      const src = getAsn(sourceId, date)
      const item = applyCell(emp.id, date, src?.shiftId || 'shift_rest', src?.note)
      if (item) batch.push(item)
    })
  })
  if (batch.length) {
    undoStack.value.push(batch)
    redoStack.value = []
  }
  moreOpen.value = false
  ElMessage.success('已复制到其他人员')
}

function smartFill() {
  const pattern = [
    'shift_morning',
    'shift_morning',
    'shift_afternoon',
    'shift_afternoon',
    'shift_night',
    'shift_rest',
    'shift_rest',
  ]
  const batch: HistItem[] = []
  employees.value.forEach((emp, idx) => {
    weekDays.value.forEach((date, di) => {
      const shift = pattern[(di + idx) % pattern.length]
      const item = applyCell(emp.id, date, shift)
      if (item) batch.push(item)
    })
  })
  if (batch.length) {
    undoStack.value.push(batch)
    redoStack.value = []
  }
  moreOpen.value = false
  ElMessage.success('已智能推荐填充')
}

function saveDraft() {
  persistDraft()
  ElMessage.success('排班草稿已保存')
}

async function publishWeek() {
  const teams = teamId.value
    ? enterpriseTeams.value.filter((t) => t.id === teamId.value)
    : enterpriseTeams.value
  if (!teams.length) {
    ElMessage.warning('暂无可用班组')
    return
  }
  try {
    await ElMessageBox.confirm(
      `确认发布 ${weekLabel.value} 的排班？发布后灵工端可见。`,
      '发布排班',
      { type: 'warning', confirmButtonText: '确认发布' },
    )
    teams.forEach((t) => {
      store.publishSchedulePeriod(t.id, weekDays.value, '企业小程序')
    })
    ElMessage.success('排班已发布')
    router.replace('/enterprise-miniapp/attendance')
  } catch {
    /* cancel */
  }
}

function onOrientation() {
  landscapeTip.value =
    typeof window !== 'undefined' && window.matchMedia('(orientation: landscape)').matches
}

watch([weekAnchor, teamId, brushId], persistDraft)

onMounted(() => {
  restoreDraft()
  onOrientation()
  window.addEventListener('orientationchange', onOrientation)
  window.addEventListener('resize', onOrientation)
  window.addEventListener('pointerup', onCellPointerUp)
  window.addEventListener('pointermove', onMatrixPointerMove)
})

onUnmounted(() => {
  window.removeEventListener('orientationchange', onOrientation)
  window.removeEventListener('resize', onOrientation)
  window.removeEventListener('pointerup', onCellPointerUp)
  window.removeEventListener('pointermove', onMatrixPointerMove)
})
</script>

<template>
  <div class="page">
    <header class="nav">
      <button type="button" class="nav-btn" aria-label="返回" @click="router.back()">
        <el-icon :size="20"><ArrowLeft /></el-icon>
      </button>
      <h1>划线排班</h1>
      <button type="button" class="nav-btn" aria-label="更多" @click="moreOpen = true">
        <el-icon :size="20"><MoreFilled /></el-icon>
      </button>
    </header>

    <div class="filter-bar">
      <div class="week-card">
        <button type="button" class="week-arrow" @click="shiftWeek(-1)">
          <el-icon><ArrowLeft /></el-icon>
        </button>
        <div class="week-text">
          <strong>{{ weekLabel }}</strong>
          <span>{{ weekRange }}</span>
        </div>
        <button type="button" class="week-arrow" @click="shiftWeek(1)">
          <el-icon><ArrowRight /></el-icon>
        </button>
      </div>
      <select v-model="teamId" class="team-select">
        <option value="">全部班组</option>
        <option v-for="t in enterpriseTeams" :key="t.id" :value="t.id">{{ t.name }}</option>
      </select>
    </div>

    <p v-if="landscapeTip" class="landscape">建议竖屏使用；横屏可展示更多日期列</p>

    <div class="brushes">
      <button
        v-for="b in brushes"
        :key="b.id"
        type="button"
        class="brush"
        :class="{ active: brushId === b.id }"
        :style="{ '--brush': b.color, '--brush-soft': b.soft }"
        @click="brushId = b.id"
      >
        <span class="brush-name">{{ b.name }}</span>
        <span class="brush-time">{{ b.time }}</span>
      </button>
    </div>

    <div class="hint">
      <el-icon class="hint-icon"><WarningFilled /></el-icon>
      <span>选择画笔后，点击或滑动日期格子即可划线排班</span>
    </div>

    <div class="matrix-wrap">
      <div class="matrix-scroll" @touchstart="onPinchStart" @touchmove="onPinchMove">
        <table
          class="matrix"
          :style="{ transform: `scale(${matrixScale})`, transformOrigin: 'top left' }"
        >
          <thead>
            <tr>
              <th class="sticky head-person">人员</th>
              <th v-for="(d, i) in weekDays" :key="d" class="head-day">
                <div class="wd">{{ weekdayLabels[i] }}</div>
                <div class="md">{{ d.slice(5).replace('-', '.') }}</div>
              </th>
            </tr>
          </thead>
          <tbody>
            <template v-for="group in groupedRows" :key="group.id">
              <tr class="group-row">
                <td class="sticky group-cell" :colspan="weekDays.length + 1">
                  <span class="group-bar" :style="{ background: group.color }" />
                  <span class="group-name" :style="{ color: group.color }">{{ group.name }}</span>
                </td>
              </tr>
              <tr
                v-for="emp in group.members"
                :key="emp.id"
                :class="{ 'row-selected': selectedRowId === emp.id }"
              >
                <td
                  class="sticky name-cell"
                  :class="{ selected: selectedRowId === emp.id }"
                  @click="selectedRowId = emp.id"
                >
                  <div class="name-inner">
                    <span class="avatar" :style="{ background: group.color }">
                      {{ avatarChar(emp.name) }}
                    </span>
                    <span class="ename">{{ emp.name }}</span>
                    <span v-if="empHasConflict(emp.id)" class="warn-dot">!</span>
                  </div>
                </td>
                <td
                  v-for="d in weekDays"
                  :key="d"
                  class="cell"
                  :class="{ conflict: conflictMap.has(`${emp.id}_${d}`) }"
                  :data-employee-id="emp.id"
                  :data-date="d"
                  @click="onCellClick(emp.id, d)"
                  @pointerdown="onCellPointerDown(emp.id, d, $event)"
                  @touchstart.passive="onCellTouchStart(emp.id, d)"
                  @touchend="onCellTouchEnd"
                  @touchcancel="onCellTouchEnd"
                  @contextmenu.prevent="cellMenu = { employeeId: emp.id, date: d }"
                >
                  <span
                    v-if="cellDisplay(emp.id, d)"
                    class="chip"
                    :class="cellDisplay(emp.id, d)!.kind"
                    :style="chipStyle(emp.id, d)"
                  >
                    <template v-if="cellDisplay(emp.id, d)!.kind === 'conflict'">
                      ⚠{{ cellDisplay(emp.id, d)!.short }}
                    </template>
                    <template v-else>
                      {{ cellDisplay(emp.id, d)!.short }}
                    </template>
                  </span>
                </td>
              </tr>
            </template>
          </tbody>
        </table>
      </div>
      <div v-if="!employees.length" class="empty">本班组暂无人员</div>
    </div>

    <div class="legend">
      <span class="legend-title">图例</span>
      <span v-for="b in brushes.slice(0, 4)" :key="b.id" class="lg">
        <i :style="{ background: b.color }" />{{ b.name }}
      </span>
      <span class="lg"><i style="background: #e5e7eb" />休息</span>
      <span class="lg"><i style="background: #fde68a" />请假</span>
      <span class="lg"><i style="background: #ef4444" />冲突</span>
    </div>

    <footer class="dock">
      <div class="stats">
        <span>已划线 <b>{{ stats.count }}</b> 条</span>
        <span class="sep">|</span>
        <span>总工时 <b>{{ stats.hours }}h</b></span>
        <span class="sep">|</span>
        <span class="conflict-stat">
          <i class="c-dot" />
          <b>{{ stats.conflicts }}</b> 个
        </span>
      </div>
      <div class="actions">
        <button type="button" class="icon-btn" :disabled="!undoStack.length" @click="undo">
          <el-icon :size="18"><RefreshLeft /></el-icon>
        </button>
        <button type="button" class="icon-btn" :disabled="!redoStack.length" @click="redo">
          <el-icon :size="18"><RefreshRight /></el-icon>
        </button>
        <button type="button" class="more-btn" @click="moreOpen = true">
          <el-icon><MoreFilled /></el-icon>
          更多
        </button>
        <button type="button" class="btn save" @click="saveDraft">
          <span class="disk" />
          保存排班
        </button>
        <button type="button" class="btn publish" @click="publishWeek">
          <el-icon><Promotion /></el-icon>
          发布排班
        </button>
      </div>
    </footer>

    <div v-if="moreOpen" class="sheet-mask" @click="moreOpen = false">
      <div class="sheet" @click.stop>
        <h3>快捷操作</h3>
        <label class="sheet-row switch-row">
          <span>连续划线模式</span>
          <input v-model="continuousMode" type="checkbox">
        </label>
        <button
          type="button"
          class="sheet-row"
          :disabled="!selectedRowId"
          @click="selectedRowId && fillRow(selectedRowId)"
        >
          批量填充选中行
          <small v-if="!selectedRowId">（先点左侧人名）</small>
        </button>
        <button
          type="button"
          class="sheet-row"
          :disabled="!selectedRowId"
          @click="selectedRowId && copyToOthers(selectedRowId)"
        >
          <el-icon><DocumentCopy /></el-icon>
          复制排班到其他人员
        </button>
        <button type="button" class="sheet-row" @click="smartFill">
          <el-icon><MagicStick /></el-icon>
          智能推荐填充
        </button>
        <button type="button" class="sheet-row danger" @click="clearWeek">
          <el-icon><Delete /></el-icon>
          清空当前排班
        </button>
        <button type="button" class="sheet-cancel" @click="moreOpen = false">取消</button>
      </div>
    </div>

    <div v-if="cellMenu" class="sheet-mask" @click="cellMenu = null">
      <div class="sheet" @click.stop>
        <h3>选择班次</h3>
        <button
          v-for="opt in longPressOptions"
          :key="opt.id"
          type="button"
          class="sheet-row"
          @click="paintBrush(cellMenu!.employeeId, cellMenu!.date, opt.id)"
        >
          {{ opt.label }}
        </button>
        <button type="button" class="sheet-cancel" @click="cellMenu = null">取消</button>
      </div>
    </div>

    <div v-if="conflictTip" class="sheet-mask" @click="conflictTip = null">
      <div class="sheet" @click.stop>
        <h3>冲突详情</h3>
        <p v-for="(m, i) in conflictTip.messages" :key="i" class="conflict-msg">{{ m }}</p>
        <button type="button" class="sheet-row" @click="coverConflictWithBrush">
          用当前画笔（{{ selectedBrush?.name }}）覆盖
        </button>
        <button type="button" class="sheet-cancel" @click="conflictTip = null">知道了</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.page {
  min-height: 100%;
  background: #fff;
  padding-bottom: calc(108px + env(safe-area-inset-bottom, 0px));
  display: flex;
  flex-direction: column;
}
.nav {
  display: grid;
  grid-template-columns: 40px 1fr 40px;
  align-items: center;
  padding: 8px 8px 6px;
  background: #fff;
  position: sticky;
  top: 0;
  z-index: 40;
}
.nav-btn {
  width: 40px;
  height: 40px;
  border: none;
  background: transparent;
  color: #111827;
  display: flex;
  align-items: center;
  justify-content: center;
}
h1 {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  text-align: center;
  color: #111827;
}
.filter-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 12px 10px;
  background: #fff;
}
.week-card {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 4px;
  background: #f8fafc;
  border: 1px solid #eef2f7;
  border-radius: 12px;
  padding: 6px 4px;
}
.week-arrow {
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.week-text {
  flex: 1;
  min-width: 0;
  text-align: center;
  line-height: 1.25;
}
.week-text strong {
  display: block;
  font-size: 13px;
  color: #111827;
  font-weight: 700;
}
.week-text span {
  font-size: 11px;
  color: #94a3b8;
}
.team-select {
  width: 96px;
  flex-shrink: 0;
  height: 40px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  background: #fff;
  font-size: 12px;
  color: #334155;
  padding: 0 8px;
}
.landscape {
  margin: 0 12px 8px;
  padding: 6px 10px;
  font-size: 11px;
  color: #b45309;
  background: #fffbeb;
  border-radius: 8px;
}
.brushes {
  display: flex;
  gap: 8px;
  padding: 0 12px 8px;
  overflow-x: auto;
  scrollbar-width: none;
}
.brushes::-webkit-scrollbar {
  display: none;
}
.brush {
  flex-shrink: 0;
  min-width: 78px;
  border: 1.5px solid #e5e7eb;
  border-left: 4px solid var(--brush);
  border-radius: 12px;
  background: #fff;
  padding: 8px 10px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  transition: 0.15s ease;
}
.brush.active {
  border-color: var(--brush);
  background: var(--brush-soft);
  box-shadow: 0 0 0 1px var(--brush);
}
.brush-name {
  font-size: 13px;
  font-weight: 700;
  color: #111827;
}
.brush-time {
  font-size: 10px;
  color: #94a3b8;
  white-space: nowrap;
}
.hint {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0 12px 10px;
  padding: 8px 10px;
  background: #fffbeb;
  border-radius: 10px;
  font-size: 12px;
  color: #92400e;
}
.hint-icon {
  color: #f59e0b;
  font-size: 14px;
  flex-shrink: 0;
}
.matrix-wrap {
  flex: 1;
  min-height: 240px;
  border-top: 1px solid #f1f5f9;
}
.matrix-scroll {
  overflow: auto;
  max-height: calc(100vh - 360px);
  -webkit-overflow-scrolling: touch;
}
.matrix {
  border-collapse: separate;
  border-spacing: 0;
  min-width: 100%;
  background: #fff;
}
.matrix th,
.matrix td {
  border-bottom: 1px solid #f1f5f9;
  border-right: 1px solid #f8fafc;
  text-align: center;
  font-size: 12px;
  height: 48px;
  min-width: 54px;
  user-select: none;
  touch-action: none;
  padding: 4px;
}
.head-day {
  position: sticky;
  top: 0;
  z-index: 3;
  background: #fafafa;
  color: #64748b;
  font-weight: 600;
  padding: 8px 4px !important;
}
.head-day .wd {
  font-size: 12px;
  color: #334155;
}
.head-day .md {
  font-size: 10px;
  color: #94a3b8;
  font-weight: 400;
  margin-top: 2px;
}
.sticky {
  position: sticky;
  left: 0;
  z-index: 4;
  background: #fff;
  min-width: 88px !important;
  max-width: 96px;
  box-shadow: 2px 0 8px rgba(15, 23, 42, 0.04);
}
.head-person {
  z-index: 5;
  background: #fafafa;
  color: #64748b;
  font-weight: 600;
}
.group-row td {
  height: 30px !important;
  background: #f8fafc;
  border-right: none;
  text-align: left !important;
}
.group-cell {
  z-index: 5;
  background: #f8fafc !important;
  padding: 0 10px !important;
  position: sticky;
  left: 0;
}
.group-bar {
  width: 3px;
  height: 14px;
  border-radius: 2px;
  display: inline-block;
  vertical-align: middle;
  margin-right: 6px;
}
.group-name {
  font-size: 11px;
  font-weight: 700;
  vertical-align: middle;
  white-space: nowrap;
}
.name-cell {
  text-align: left !important;
  padding: 0 8px !important;
}
.name-inner {
  display: flex;
  align-items: center;
  gap: 6px;
}
.name-cell.selected {
  background: #eff6ff;
}
.avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.ename {
  font-size: 13px;
  font-weight: 600;
  color: #111827;
  white-space: nowrap;
}
.warn-dot {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: #ef4444;
  color: #fff;
  font-size: 10px;
  font-weight: 800;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.row-selected .cell {
  background: #f8fafc;
}
.cell {
  cursor: pointer;
  background: #fff;
}
.cell.conflict {
  animation: blink 1.1s ease infinite;
}
@keyframes blink {
  50% {
    background: #fef2f2;
  }
}
.chip {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 36px;
  height: 28px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
  padding: 0 6px;
  border: 1.5px solid transparent;
}
.chip.shift {
  color: inherit;
}
.chip.conflict {
  background: #ef4444 !important;
  color: #fff !important;
  font-size: 11px;
}
.chip.leave {
  border-style: solid;
}
.chip.rest {
  font-weight: 600;
}
.empty {
  padding: 40px;
  text-align: center;
  color: #94a3b8;
}
.legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 12px;
  padding: 10px 12px 12px;
  border-top: 1px solid #f1f5f9;
  font-size: 11px;
  color: #64748b;
}
.legend-title {
  font-weight: 700;
  color: #94a3b8;
}
.lg {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.lg i {
  width: 8px;
  height: 8px;
  border-radius: 2px;
  display: inline-block;
}
.dock {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: 0;
  width: 100%;
  max-width: 430px;
  background: #fff;
  border-top: 1px solid #e5e7eb;
  padding: 8px 10px calc(8px + env(safe-area-inset-bottom, 0px));
  z-index: 50;
  box-shadow: 0 -6px 20px rgba(15, 23, 42, 0.06);
}
.stats {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #64748b;
  margin-bottom: 8px;
  padding: 0 2px;
}
.stats b {
  color: #111827;
  font-weight: 700;
}
.stats .sep {
  color: #e2e8f0;
}
.conflict-stat {
  color: #ef4444;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.conflict-stat b {
  color: #ef4444;
}
.c-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ef4444;
  display: inline-block;
}
.actions {
  display: flex;
  align-items: center;
  gap: 6px;
}
.icon-btn {
  width: 36px;
  height: 40px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
  color: #64748b;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.icon-btn:disabled {
  opacity: 0.35;
}
.more-btn {
  height: 40px;
  padding: 0 8px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
  color: #64748b;
  font-size: 12px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0;
  line-height: 1.1;
  flex-shrink: 0;
}
.btn {
  flex: 1;
  height: 40px;
  border: none;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  min-width: 0;
}
.btn.save {
  background: #3b82f6;
  color: #fff;
}
.btn.publish {
  background: #22c55e;
  color: #fff;
}
.disk {
  width: 12px;
  height: 12px;
  border: 2px solid #fff;
  border-radius: 2px;
  position: relative;
}
.disk::after {
  content: '';
  position: absolute;
  top: 1px;
  right: 1px;
  width: 4px;
  height: 4px;
  background: #fff;
  border-radius: 1px;
}
.sheet-mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  z-index: 80;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.sheet {
  width: 100%;
  max-width: 430px;
  background: #fff;
  border-radius: 16px 16px 0 0;
  padding: 16px 12px calc(12px + env(safe-area-inset-bottom, 0px));
}
.sheet h3 {
  margin: 0 0 10px;
  font-size: 16px;
  text-align: center;
}
.sheet-row {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  border: none;
  background: #f9fafb;
  border-radius: 12px;
  padding: 14px 12px;
  margin-bottom: 8px;
  font-size: 14px;
  color: #111827;
  text-align: left;
}
.sheet-row:disabled {
  opacity: 0.5;
}
.sheet-row.danger {
  color: #dc2626;
}
.sheet-row small {
  color: #94a3b8;
  font-size: 11px;
}
.switch-row {
  justify-content: space-between;
}
.switch-row input {
  width: 44px;
  height: 24px;
}
.sheet-cancel {
  width: 100%;
  height: 44px;
  border: none;
  border-radius: 12px;
  background: #f3f4f6;
  margin-top: 4px;
  font-size: 14px;
}
.conflict-msg {
  margin: 0 0 8px;
  padding: 10px 12px;
  background: #fef2f2;
  color: #b91c1c;
  border-radius: 10px;
  font-size: 13px;
}
</style>
