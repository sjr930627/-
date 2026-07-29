import { computed, ref, shallowRef, watch, type Ref } from 'vue'
import { useAppStore } from '@/stores/app'
import { detectConflicts } from '@/services/schedule'
import { cellKey, parseCellKey } from '@/constants/schedule'
import type { Employee, ScheduleAssignment, ScheduleRule, Shift } from '@/types'
import { addDays } from '@/utils'

export type EditMode = 'readonly' | 'editing'

type Snapshot = ScheduleAssignment[]

export function useScheduleBoard(options: {
  teamId: Ref<string>
  dates: Ref<string[]>
  scheduleRule: Ref<ScheduleRule>
  memberIds: Ref<string[]>
}) {
  const store = useAppStore()
  const editMode = ref<EditMode>('readonly')
  const undoStack = ref<Snapshot[]>([])
  const redoStack = ref<Snapshot[]>([])
  const selectedCells = ref<Set<string>>(new Set())
  const selectionAnchor = ref<{ employeeId: string; date: string } | null>(null)
  const copyBuffer = shallowRef<{ employeeId: string; dates: string[]; shiftIds: string[] } | null>(null)
  const dragSource = ref<{ employeeId: string; date: string } | null>(null)

  function snapshot(): Snapshot {
    return JSON.parse(JSON.stringify(store.assignments)) as ScheduleAssignment[]
  }

  function pushUndo() {
    undoStack.value.push(snapshot())
    if (undoStack.value.length > 50) undoStack.value.shift()
    redoStack.value = []
  }

  function undo() {
    if (!undoStack.value.length) return false
    redoStack.value.push(snapshot())
    store.assignments = undoStack.value.pop()!
    store.persist('assignments')
    return true
  }

  function redo() {
    if (!redoStack.value.length) return false
    undoStack.value.push(snapshot())
    store.assignments = redoStack.value.pop()!
    store.persist('assignments')
    return true
  }

  function getVisibleAssignment(employeeId: string, date: string): ScheduleAssignment | undefined {
    const teamId = options.teamId.value
    const all = store.assignments.filter(
      (a) => a.employeeId === employeeId && a.date === date && a.teamId === teamId,
    )
    if (editMode.value === 'editing') {
      return all.find((a) => !a.published) ?? all.find((a) => a.published)
    }
    return all.find((a) => a.published) ?? all[0]
  }

  const periodAssignments = computed(() => {
    const dates = new Set(options.dates.value)
    const members = new Set(options.memberIds.value)
    return store.assignments.filter(
      (a) =>
        a.teamId === options.teamId.value &&
        dates.has(a.date) &&
        members.has(a.employeeId),
    )
  })

  const hasDraft = computed(() => periodAssignments.value.some((a) => !a.published))

  const publishRecord = computed(() => {
    const month = options.dates.value[0]?.slice(0, 7)
    return store.publishRecords.find(
      (r) => r.teamId === options.teamId.value && r.month === month,
    )
  })

  const pageStatus = computed(() => {
    if (editMode.value === 'editing') return 'editing' as const
    if (hasDraft.value) return 'draft' as const
    if (publishRecord.value) return 'published' as const
    return 'draft' as const
  })

  const conflictMap = computed(() => {
    const map = new Map<string, string[]>()
    const rule = options.scheduleRule.value
    options.memberIds.value.forEach((employeeId) => {
      options.dates.value.forEach((date) => {
        const asn = getVisibleAssignment(employeeId, date)
        if (!asn) return
        const list = detectConflicts(
          employeeId,
          date,
          asn.shiftId,
          store.assignments,
          store.employees,
          store.shifts,
          store.holidays,
          rule,
        )
        if (list.length) map.set(cellKey(employeeId, date), list.map((c) => c.message))
      })
    })
    return map
  })

  const dailyStats = computed(() =>
    options.dates.value.map((date) => {
      const shiftCounts: Record<string, number> = {}
      let confirmed = 0
      let total = 0
      options.memberIds.value.forEach((employeeId) => {
        const asn = getVisibleAssignment(employeeId, date)
        if (!asn) return
        const shift = store.shifts.find((s) => s.id === asn.shiftId)
        if (!shift || shift.code === 'REST') return
        total += 1
        shiftCounts[shift.name] = (shiftCounts[shift.name] ?? 0) + 1
        if (asn.confirmStatus === 'confirmed') confirmed += 1
      })
      const shiftSummary = Object.entries(shiftCounts)
        .map(([name, count]) => `${name.slice(0, 1)}:${count}`)
        .join(' ')
      return { date, shiftSummary, confirmed, total }
    }),
  )

  function enterEditMode() {
    store.enterEditModeForPeriod(options.teamId.value, options.dates.value)
    editMode.value = 'editing'
  }

  function exitEditMode() {
    editMode.value = 'readonly'
  }

  function setCellShift(
    employeeId: string,
    date: string,
    shiftId: string,
    opts?: { note?: string; manual?: boolean },
  ) {
    if (editMode.value !== 'editing') return
    pushUndo()
    store.upsertAssignment({
      employeeId,
      date,
      shiftId,
      teamId: options.teamId.value,
      published: false,
      confirmStatus: 'pending',
      manualEdited: opts?.manual ?? true,
      note: opts?.note,
    })
  }

  function clearCell(employeeId: string, date: string) {
    if (editMode.value !== 'editing') return
    pushUndo()
    store.removeAssignment(employeeId, date)
  }

  function cycleShift(employeeId: string, date: string, shifts: Shift[]) {
    const current = getVisibleAssignment(employeeId, date)
    const workShifts = shifts.filter((s) => s.code !== 'REST')
    if (!workShifts.length) return
    if (!current) {
      setCellShift(employeeId, date, workShifts[0].id)
      return
    }
    const idx = workShifts.findIndex((s) => s.id === current.shiftId)
    const next = workShifts[(idx + 1) % workShifts.length]
    setCellShift(employeeId, date, next.id)
  }

  function batchSetShift(shiftId: string) {
    if (editMode.value !== 'editing' || !selectedCells.value.size) return
    pushUndo()
    selectedCells.value.forEach((key) => {
      const { employeeId, date } = parseCellKey(key)
      store.upsertAssignment({
        employeeId,
        date,
        shiftId,
        teamId: options.teamId.value,
        published: false,
        confirmStatus: 'pending',
        manualEdited: true,
      })
    })
    selectedCells.value = new Set()
  }

  function batchClear() {
    if (editMode.value !== 'editing' || !selectedCells.value.size) return
    pushUndo()
    selectedCells.value.forEach((key) => {
      const { employeeId, date } = parseCellKey(key)
      store.removeAssignment(employeeId, date)
    })
    selectedCells.value = new Set()
  }

  function swapCells(
    from: { employeeId: string; date: string },
    to: { employeeId: string; date: string },
  ) {
    if (editMode.value !== 'editing') return
    if (from.employeeId === to.employeeId && from.date === to.date) return
    const fromAsn = getVisibleAssignment(from.employeeId, from.date)
    const toAsn = getVisibleAssignment(to.employeeId, to.date)
    if (!fromAsn) return
    pushUndo()
    if (toAsn) {
      store.upsertAssignment({
        employeeId: to.employeeId,
        date: to.date,
        shiftId: fromAsn.shiftId,
        teamId: options.teamId.value,
        published: false,
        confirmStatus: 'pending',
        manualEdited: true,
      })
      store.upsertAssignment({
        employeeId: from.employeeId,
        date: from.date,
        shiftId: toAsn.shiftId,
        teamId: options.teamId.value,
        published: false,
        confirmStatus: 'pending',
        manualEdited: true,
      })
    } else {
      store.upsertAssignment({
        employeeId: to.employeeId,
        date: to.date,
        shiftId: fromAsn.shiftId,
        teamId: options.teamId.value,
        published: false,
        confirmStatus: 'pending',
        manualEdited: true,
      })
      store.removeAssignment(from.employeeId, from.date)
    }
  }

  function copyFromEmployee(employeeId: string) {
    const shiftIds = options.dates.value.map((date) => {
      const asn = getVisibleAssignment(employeeId, date)
      return asn?.shiftId ?? ''
    })
    copyBuffer.value = { employeeId, dates: [...options.dates.value], shiftIds }
  }

  function pasteToEmployee(employeeId: string) {
    if (!copyBuffer.value || editMode.value !== 'editing') return
    pushUndo()
    copyBuffer.value.dates.forEach((date, idx) => {
      const shiftId = copyBuffer.value!.shiftIds[idx]
      if (!shiftId) {
        store.removeAssignment(employeeId, date)
        return
      }
      const conflicts = detectConflicts(
        employeeId,
        date,
        shiftId,
        store.assignments,
        store.employees,
        store.shifts,
        store.holidays,
        options.scheduleRule.value,
      )
      if (conflicts.length) return
      store.upsertAssignment({
        employeeId,
        date,
        shiftId,
        teamId: options.teamId.value,
        published: false,
        confirmStatus: 'pending',
        manualEdited: true,
      })
    })
  }

  function copyLastPeriod(sourceDates: string[]) {
    pushUndo()
    return store.cloneAssignmentsFromDates(
      options.teamId.value,
      sourceDates,
      options.dates.value,
      options.memberIds.value,
    )
  }

  function clearDraft() {
    pushUndo()
    store.revertDraftForPeriod(options.teamId.value, options.dates.value)
    exitEditMode()
  }

  function getPublishDiff() {
    let added = 0
    let modified = 0
    let removed = 0
    options.memberIds.value.forEach((employeeId) => {
      options.dates.value.forEach((date) => {
        const pub = store.assignments.find(
          (a) =>
            a.employeeId === employeeId &&
            a.date === date &&
            a.teamId === options.teamId.value &&
            a.published,
        )
        const draft = store.assignments.find(
          (a) =>
            a.employeeId === employeeId &&
            a.date === date &&
            a.teamId === options.teamId.value &&
            !a.published,
        )
        if (draft && !pub) added += 1
        else if (draft && pub && draft.shiftId !== pub.shiftId) modified += 1
        else if (!draft && pub) removed += 1
      })
    })
    return { added, modified, removed }
  }

  function publish() {
    store.publishSchedulePeriod(options.teamId.value, options.dates.value)
    store.assignments = store.assignments.filter((a) => {
      if (a.teamId !== options.teamId.value) return true
      if (!options.dates.value.includes(a.date)) return true
      return a.published
    })
    store.persist('assignments')
    exitEditMode()
  }

  function toggleSelect(employeeId: string, date: string, extend = false) {
    const key = cellKey(employeeId, date)
    if (extend && selectionAnchor.value) {
      const newSet = new Set<string>()
      const empIds = options.memberIds.value
      const dates = options.dates.value
      const r1 = empIds.indexOf(selectionAnchor.value.employeeId)
      const r2 = empIds.indexOf(employeeId)
      const c1 = dates.indexOf(selectionAnchor.value.date)
      const c2 = dates.indexOf(date)
      const rMin = Math.min(r1, r2)
      const rMax = Math.max(r1, r2)
      const cMin = Math.min(c1, c2)
      const cMax = Math.max(c1, c2)
      for (let r = rMin; r <= rMax; r += 1) {
        for (let c = cMin; c <= cMax; c += 1) {
          if (empIds[r] && dates[c]) newSet.add(cellKey(empIds[r], dates[c]))
        }
      }
      selectedCells.value = newSet
    } else if (selectedCells.value.has(key)) {
      selectedCells.value.delete(key)
    } else {
      selectedCells.value.add(key)
      selectionAnchor.value = { employeeId, date }
    }
  }

  function ensureBaseline() {
    const teamId = options.teamId.value
    const dates = options.dates.value
    const members = options.memberIds.value
    const hasAny = store.assignments.some(
      (a) => a.teamId === teamId && dates.includes(a.date) && members.includes(a.employeeId),
    )
    if (hasAny) return
    const defaultTpl = store.scheduleTemplates.find(
      (t) => t.teamId === teamId && t.isDefault,
    )
    if (defaultTpl) {
      store.applyScheduleTemplate(defaultTpl.id, teamId, dates, members)
      return
    }
    if (dates.length >= 7) {
      const prevDates = dates.map((d) => addDays(d, -7))
      store.cloneAssignmentsFromDates(teamId, prevDates, dates, members)
    }
  }

  watch(
    [options.teamId, options.dates],
    () => {
      selectedCells.value = new Set()
      exitEditMode()
      ensureBaseline()
    },
    { immediate: true, deep: true },
  )

  return {
    editMode,
    pageStatus,
    publishRecord,
    hasDraft,
    conflictMap,
    dailyStats,
    selectedCells,
    dragSource,
    copyBuffer,
    getVisibleAssignment,
    enterEditMode,
    exitEditMode,
    setCellShift,
    clearCell,
    cycleShift,
    batchSetShift,
    batchClear,
    swapCells,
    copyFromEmployee,
    pasteToEmployee,
    copyLastPeriod,
    clearDraft,
    getPublishDiff,
    publish,
    toggleSelect,
    undo,
    redo,
    canUndo: computed(() => undoStack.value.length > 0),
    canRedo: computed(() => redoStack.value.length > 0),
  }
}

export function filterEmployees(employees: Employee[], keyword: string) {
  const q = keyword.trim()
  if (!q) return employees
  return employees.filter((e) => e.name.includes(q) || e.employeeNo.includes(q))
}
