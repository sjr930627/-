<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ArrowDown,
  MagicStick,
  RefreshLeft,
  RefreshRight,
} from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'
import { useEnterpriseScope } from '@/composables/useEnterpriseScope'
import EnterpriseScopeSelect from '@/components/platform/EnterpriseScopeSelect.vue'
import { resolveEnterpriseIdByTeamDepartment } from '@/utils/enterpriseScope'
import ScheduleTeamBoard from '@/components/schedule/ScheduleTeamBoard.vue'
import ScheduleShiftGrid from '@/components/schedule/ScheduleShiftGrid.vue'
import ScheduleLinePanel from '@/components/schedule/ScheduleLinePanel.vue'
import ScheduleTemplateManager from '@/components/schedule/ScheduleTemplateManager.vue'
import ScheduleDemandConfigDrawer from '@/components/schedule/ScheduleDemandConfigDrawer.vue'
import { useScheduleBoard, filterEmployees } from '@/composables/useScheduleBoard'
import { confirmStatusMap, normalizeConfirmStatus, isAssignmentConfirmedLocked } from '@/constants/schedule'
import { generateSmartSchedule } from '@/services/smartSchedule'
import { resolveShiftIdForTemplate } from '@/services/scheduleGroup'
import {
  createShiftDemandHeadcountResolver,
  hasShiftDemandInRange,
  needsNextWeekDemandPlan,
  resolveShiftTemplateDemand,
  summarizeConfiguredShiftDemands,
  teamHasEnabledCycleRule,
} from '@/services/shiftDemandPlan'
import {
  addDays,
  getMonthDays,
  getWeekDates,
  getWeekNumber,
  getWeekStart,
} from '@/utils'
import type { SchedulePublishRecord } from '@/types'

const store = useAppStore()
const route = useRoute()
const { enterpriseFilter, activeEnterpriseId, showEnterpriseControl, matchesEnterprise } =
  useEnterpriseScope('switch')

const scopedTeams = computed(() =>
  store.teams.filter((t) =>
    matchesEnterprise(resolveEnterpriseIdByTeamDepartment(t.departmentId, store.departments)),
  ),
)

const selectedTeamId = ref('team_a')
const scheduleMode = ref<'shift' | 'custom'>('shift')
/** 排班列表视图：按人员 / 按班次 */
const shiftListView = ref<'team' | 'grid'>('team')
/** 按班次排班：当前选中的需求班次 */
const selectedLineShiftId = ref<string | null>(null)
const viewType = ref<'month' | 'week'>('week')
const selectedMonth = ref('2026-07')
const weekStart = ref(getWeekStart('2026-07-28'))
const keyword = ref('')
const lineSelectedDate = ref('2026-07-28')
const templateManagerVisible = ref(false)

const shiftPickerVisible = ref(false)
const shiftPickerPos = ref({ x: 0, y: 0 })
const pickerTarget = ref<{ employeeId: string; date: string } | null>(null)

const detailDrawerVisible = ref(false)
const detailCell = ref<{ employeeId: string; date: string } | null>(null)
const detailNote = ref('')

const smartDialogVisible = ref(false)
const swapDialogVisible = ref(false)
const swapForm = ref({ targetEmployeeId: '', reason: '' })
const publishDialogVisible = ref(false)
const publishLogVisible = ref(false)
const versionDetailVisible = ref(false)
const selectedPublishRecord = ref<SchedulePublishRecord | null>(null)
const demandDrawerVisible = ref(false)
const saveTemplateName = ref('')

const smartForm = ref({
  dateRange: ['', ''] as [string, string],
  employeeIds: [] as string[],
  preferEmployeePreference: true,
  balanceHours: true,
  respectLeave: true,
})

const batchMenuVisible = ref(false)
const batchMenuPos = ref({ x: 0, y: 0 })

const shiftAssignVisible = ref(false)
const shiftAssignTarget = ref<{ shiftId: string; date: string } | null>(null)
const shiftAssignEmployeeIds = ref<string[]>([])

const team = computed(() => store.teams.find((t) => t.id === selectedTeamId.value))
const memberIds = computed(() => team.value?.memberIds ?? [])
const scheduleRule = computed(() =>
  team.value?.attendanceGroupId
    ? store.getScheduleRuleForGroup(team.value.attendanceGroupId)
    : store.scheduleRule,
)

const monthDates = computed(() => {
  const [y, m] = selectedMonth.value.split('-').map(Number)
  return getMonthDays(y, m)
})

const weekDates = computed(() => getWeekDates(weekStart.value))

const displayDates = computed(() =>
  viewType.value === 'month' ? monthDates.value : weekDates.value,
)

const demandConfigWeekStart = computed(() =>
  getWeekStart(displayDates.value[0] ?? getWeekStart()),
)

const hasTeamCycleRule = computed(() =>
  teamHasEnabledCycleRule(store.teamCycleScheduleRules, selectedTeamId.value),
)

const needNextWeekDemand = computed(() =>
  needsNextWeekDemandPlan(
    store.teamCycleScheduleRules,
    store.weeklyShiftDemandPlans,
    selectedTeamId.value,
  ),
)

function getWeeklyPlanForDate(date: string) {
  return store.getWeeklyShiftDemandPlan(selectedTeamId.value, getWeekStart(date))
}

function resolveNeededForDate(date: string, shiftTemplateId: string) {
  const templates = selectedGroup.value?.shiftTemplates ?? []
  const tpl = templates.find((t) => t.id === shiftTemplateId)
  if (!tpl) return 0
  return resolveShiftTemplateDemand(
    date,
    shiftTemplateId,
    templates,
    store.holidays,
    getWeeklyPlanForDate(date),
  )
}

const employees = computed(() => {
  const list = store.activeEmployees.filter((e) => memberIds.value.includes(e.id))
  return filterEmployees(list, keyword.value)
})

const selectedGroup = computed(() => {
  const groupId = team.value?.attendanceGroupId
  return groupId ? store.attendanceGroups.find((g) => g.id === groupId) ?? null : null
})

const groupCompliance = computed(() => {
  if (selectedGroup.value?.compliance) return selectedGroup.value.compliance
  const rule = scheduleRule.value
  return {
    maxDailyHours: rule.maxDailyHours,
    maxWeeklyHours: rule.maxWeeklyHours,
    maxMonthlyHours: rule.maxMonthlyHours,
    maxConsecutiveWorkdays: rule.maxConsecutiveDays,
    minShiftIntervalHours: rule.minRestHours,
  }
})

const board = useScheduleBoard({
  teamId: selectedTeamId,
  dates: displayDates,
  compliance: groupCompliance,
  memberIds,
})

const teamTemplates = computed(() =>
  store.scheduleTemplates.filter((t) => t.teamId === selectedTeamId.value),
)

const smartEmployeeOptions = computed(() =>
  store.activeEmployees.filter((e) => memberIds.value.includes(e.id)),
)

const smartDemandRange = computed(() => {
  const [startDate, endDate] = smartForm.value.dateRange
  if (startDate && endDate) return { startDate, endDate }
  const dates = displayDates.value
  return {
    startDate: dates[0] ?? '',
    endDate: dates[dates.length - 1] ?? '',
  }
})

const resolveShiftIdByTemplateName = (name: string) =>
  resolveShiftIdForTemplate(name, store.shifts) ?? undefined

const smartShiftDemands = computed(() =>
  summarizeConfiguredShiftDemands(
    smartDemandRange.value.startDate,
    smartDemandRange.value.endDate,
    selectedTeamId.value,
    selectedGroup.value?.shiftTemplates ?? [],
    store.shifts,
    store.holidays,
    store.weeklyShiftDemandPlans,
    resolveShiftIdByTemplateName,
  ),
)

const smartDemandHeadcountResolver = computed(() =>
  createShiftDemandHeadcountResolver({
    teamId: selectedTeamId.value,
    templates: selectedGroup.value?.shiftTemplates ?? [],
    holidays: store.holidays,
    plans: store.weeklyShiftDemandPlans,
    resolveShiftId: resolveShiftIdByTemplateName,
  }),
)

function countShiftScheduled(shiftId: string, date: string) {
  let count = 0
  memberIds.value.forEach((employeeId) => {
    const asn = board.getVisibleAssignment(employeeId, date)
    if (asn?.shiftId === shiftId) count += 1
  })
  return count
}

function resolveSmartDateHeadcount(date: string, shiftId: string) {
  return smartDemandHeadcountResolver.value(date, shiftId)
}

function hasConfiguredShiftDemand(startDate: string, endDate: string) {
  return hasShiftDemandInRange(
    startDate,
    endDate,
    selectedTeamId.value,
    selectedGroup.value?.shiftTemplates ?? [],
    store.holidays,
    store.weeklyShiftDemandPlans,
    resolveShiftIdByTemplateName,
  )
}

const shiftDemand = computed(() => {
  const templates = selectedGroup.value?.shiftTemplates ?? []
  const dates = displayDates.value
  return templates.map((tpl) => {
    const shiftId = resolveShiftIdForTemplate(tpl.name, store.shifts)
    const shift = shiftId ? store.shifts.find((s) => s.id === shiftId) ?? null : null
    const weekdayNeeded = tpl.requiredHeadcount ?? 0
    const weekendNeeded = tpl.weekendRequiredHeadcount ?? weekdayNeeded
    const holidayNeeded = tpl.holidayRequiredHeadcount ?? weekdayNeeded
    let neededPersonDays = 0
    let scheduledPersonDays = 0
    dates.forEach((date) => {
      const needed = resolveNeededForDate(date, tpl.id)
      const scheduled = shiftId ? countShiftScheduled(shiftId, date) : 0
      neededPersonDays += needed
      scheduledPersonDays += scheduled
    })
    const gapPersonDays = Math.max(0, neededPersonDays - scheduledPersonDays)
    const fillRate = neededPersonDays
      ? Math.min(100, Math.round((scheduledPersonDays / neededPersonDays) * 100))
      : 0
    return {
      template: tpl,
      shift,
      weekdayNeeded,
      weekendNeeded,
      holidayNeeded,
      neededPersonDays,
      scheduledPersonDays,
      gapPersonDays,
      fillRate,
    }
  })
})

const shiftRows = computed(() =>
  shiftDemand.value
    .filter((d) => d.shift)
    .map((d) => ({
      shiftId: d.shift!.id,
      shiftName: d.template.name,
      color: d.shift!.color,
      weekdayNeeded: d.weekdayNeeded,
      weekendNeeded: d.weekendNeeded,
      holidayNeeded: d.holidayNeeded,
      startTime: d.template.startTime,
      endTime: d.template.endTime,
    })),
)

const smartAllSelected = computed({
  get: () =>
    smartEmployeeOptions.value.length > 0 &&
    smartEmployeeOptions.value.every((e) => smartForm.value.employeeIds.includes(e.id)),
  set: (val: boolean) => {
    smartForm.value.employeeIds = val ? smartEmployeeOptions.value.map((e) => e.id) : []
  },
})

const selectedLineShiftContext = computed(() => {
  if (!selectedLineShiftId.value) return null
  const d = shiftDemand.value.find((x) => x.shift?.id === selectedLineShiftId.value)
  if (!d?.shift) return null
  return {
    shiftId: d.shift.id,
    shiftName: d.template.name,
    startTime: d.template.startTime,
    endTime: d.template.endTime,
    color: d.shift.color,
  }
})

watch(displayDates, (dates) => {
  if (dates.length) lineSelectedDate.value = dates[0]
}, { immediate: true })

watch(scheduleMode, () => {
  selectedLineShiftId.value = null
})

function selectDemandShift(d: (typeof shiftDemand.value)[number]) {
  if (!d.shift) return
  handleEnterEditMode()
  selectedLineShiftId.value = d.shift.id
  lineSelectedDate.value = displayDates.value[0] ?? lineSelectedDate.value
  ElMessage.info(`已选择「${d.template.name}」，请按周拖拽为员工排班`)
}

function getShiftCellEmployees(shiftId: string, date: string) {
  return employees.value.filter((emp) => {
    const asn = board.getVisibleAssignment(emp.id, date)
    return asn?.shiftId === shiftId
  })
}

function getShiftCellNeeded(shiftId: string, date: string) {
  const row = shiftDemand.value.find((d) => d.shift?.id === shiftId)
  if (!row) return 0
  return resolveNeededForDate(date, row.template.id)
}

function getShiftCellGap(shiftId: string, date: string) {
  return Math.max(0, getShiftCellNeeded(shiftId, date) - getShiftCellEmployees(shiftId, date).length)
}

function getShiftCellClass(shiftId: string, date: string) {
  const classes: string[] = []
  if (getShiftCellGap(shiftId, date) > 0) classes.push('shortage')
  else if (getShiftCellEmployees(shiftId, date).length > 0) classes.push('full')
  return classes
}

function onShiftCellClick(shiftId: string, date: string) {
  if (board.editMode.value !== 'editing') {
    handleEnterEditMode()
  }
  shiftAssignTarget.value = { shiftId, date }
  shiftAssignEmployeeIds.value = getShiftCellEmployees(shiftId, date).map((e) => e.id)
  shiftAssignVisible.value = true
}

function confirmShiftAssign() {
  if (!shiftAssignTarget.value) return
  const { shiftId, date } = shiftAssignTarget.value
  employees.value.forEach((emp) => {
    const assigned = shiftAssignEmployeeIds.value.includes(emp.id)
    const current = board.getVisibleAssignment(emp.id, date)
    if (assigned) {
      if (current?.shiftId !== shiftId) {
        board.setCellShift(emp.id, date, shiftId)
      }
    } else if (current?.shiftId === shiftId) {
      board.clearCell(emp.id, date)
    }
  })
  shiftAssignVisible.value = false
  ElMessage.success('班次人员已更新')
}

const demandSummary = computed(() => {
  const totalGap = shiftDemand.value.reduce((sum, d) => sum + d.gapPersonDays, 0)
  const shortageShifts = shiftDemand.value.filter((d) => d.gapPersonDays > 0).length
  return { totalGap, shortageShifts }
})

const showLinePanel = computed(
  () =>
    board.editMode.value === 'editing' &&
    (scheduleMode.value === 'custom' ||
      (scheduleMode.value === 'shift' && Boolean(selectedLineShiftContext.value))),
)

function ensureLineShiftSelected() {
  if (scheduleMode.value !== 'shift' || selectedLineShiftId.value) return
  const first = shiftDemand.value.find((d) => d.shift)
  if (first?.shift) selectedLineShiftId.value = first.shift.id
}

function handleEnterEditMode() {
  board.enterEditMode()
  ensureLineShiftSelected()
}

const teamBoardGroups = computed(() => {
  const t = team.value
  if (!t) return []
  const list = filterEmployees(
    store.activeEmployees.filter((e) => t.memberIds.includes(e.id)),
    keyword.value,
  )
  return [{ teamId: t.id, teamName: t.name, employees: list }]
})

const publishHistory = computed(() =>
  store.getSchedulePublishHistory(selectedTeamId.value, selectedMonth.value),
)

const currentPublishVersion = computed(() => {
  const list = publishHistory.value.filter((r) => r.version)
  return list.length ? Math.max(...list.map((r) => r.version ?? 0)) : 0
})

const periodLabel = computed(() => {
  if (viewType.value === 'month') {
    const [y, m] = selectedMonth.value.split('-').map(Number)
    return `${y}年${m}月`
  }
  const y = weekStart.value.slice(0, 4)
  return `${y}年 第${getWeekNumber(weekStart.value)}周`
})

const statusBar = computed(() => {
  const s = board.pageStatus.value
  if (s === 'published' && board.publishRecord.value) {
    const t = new Date(board.publishRecord.value.publishedAt).toLocaleString('zh-CN')
    return {
      type: 'success' as const,
      label: '已发布',
      desc: `已于 ${t} 发布，已通知员工确认班次（待确认 / 已确认 / 已拒绝）`,
    }
  }
  if (s === 'editing') {
    return {
      type: 'warning' as const,
      label: '编辑中',
      desc: '改动尚未保存或发布，员工不可见；已拒绝班次可重新编辑',
    }
  }
  if (s === 'saved') {
    return {
      type: 'info' as const,
      label: '已保存',
      desc: '排班已保存为草稿，尚未发布，不会通知员工确认',
    }
  }
  return {
    type: 'warning' as const,
    label: '草稿',
    desc: '当前排班尚未发布，仅管理员可见',
  }
})

function handleSaveDraft() {
  board.saveDraft()
  ElMessage.success('排班已保存，尚未发布')
}

const publishDiff = computed(() => board.getPublishDiff())

const detailAssignment = computed(() => {
  if (!detailCell.value) return null
  return board.getVisibleAssignment(detailCell.value.employeeId, detailCell.value.date)
})

const detailEmployee = computed(() =>
  detailCell.value
    ? store.employees.find((e) => e.id === detailCell.value!.employeeId)
    : null,
)

const detailShift = computed(() =>
  detailAssignment.value
    ? store.shifts.find((s) => s.id === detailAssignment.value!.shiftId)
    : null,
)

const detailPublishedAssignment = computed(() => {
  if (!detailCell.value) return null
  return board.getPublishedAssignment(detailCell.value.employeeId, detailCell.value.date)
})

const detailIsLocked = computed(() => isAssignmentConfirmedLocked(detailPublishedAssignment.value))

const swapTargetOptions = computed(() =>
  employees.value.filter((e) => e.id !== detailCell.value?.employeeId),
)

watch([activeEnterpriseId, scopedTeams], () => {
  if (!scopedTeams.value.some((t) => t.id === selectedTeamId.value)) {
    selectedTeamId.value = scopedTeams.value[0]?.id ?? ''
  }
}, { immediate: true })

function prevPeriod() {
  if (viewType.value === 'month') {
    const [y, m] = selectedMonth.value.split('-').map(Number)
    const d = new Date(y, m - 2, 1)
    selectedMonth.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  } else {
    weekStart.value = addDays(weekStart.value, -7)
  }
}

function nextPeriod() {
  if (viewType.value === 'month') {
    const [y, m] = selectedMonth.value.split('-').map(Number)
    const d = new Date(y, m, 1)
    selectedMonth.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  } else {
    weekStart.value = addDays(weekStart.value, 7)
  }
}

function goToday() {
  const today = getWeekStart()
  weekStart.value = today
  selectedMonth.value = today.slice(0, 7)
}

function onCellClick(employeeId: string, date: string, event: MouseEvent) {
  if (event.shiftKey) {
    board.toggleSelect(employeeId, date, true)
    return
  }
  if (board.isCellLocked(employeeId, date)) {
    openDetail(employeeId, date)
    return
  }
  if (board.editMode.value !== 'editing') {
    openDetail(employeeId, date)
    return
  }
  const asn = board.getVisibleAssignment(employeeId, date)
  if (asn) {
    board.cycleShift(employeeId, date, store.shifts)
  } else {
    pickerTarget.value = { employeeId, date }
    shiftPickerPos.value = { x: event.clientX, y: event.clientY }
    shiftPickerVisible.value = true
  }
}

function onCellContext(employeeId: string, date: string, event: MouseEvent) {
  if (board.editMode.value !== 'editing') return
  board.toggleSelect(employeeId, date, event.shiftKey)
  batchMenuPos.value = { x: event.clientX, y: event.clientY }
  batchMenuVisible.value = true
}

function pickShift(shiftId: string) {
  if (!pickerTarget.value) return
  board.setCellShift(pickerTarget.value.employeeId, pickerTarget.value.date, shiftId)
  shiftPickerVisible.value = false
  pickerTarget.value = null
}

function openDetail(employeeId: string, date: string) {
  detailCell.value = { employeeId, date }
  detailNote.value = board.getVisibleAssignment(employeeId, date)?.note ?? ''
  detailDrawerVisible.value = true
}

watch(
  () => [route.query.team, route.query.date, route.query.employee] as const,
  async ([teamId, date, employeeId]) => {
    if (typeof teamId === 'string' && scopedTeams.value.some((t) => t.id === teamId)) {
      selectedTeamId.value = teamId
    }
    if (typeof date === 'string') {
      viewType.value = 'week'
      weekStart.value = getWeekStart(date)
      selectedMonth.value = date.slice(0, 7)
      lineSelectedDate.value = date
    }
    if (typeof employeeId === 'string' && typeof date === 'string') {
      await nextTick()
      openDetail(employeeId, date)
    }
  },
  { immediate: true },
)

function saveDetailNote() {
  if (!detailCell.value || !detailAssignment.value || detailIsLocked.value) return
  store.upsertAssignment({
    ...detailAssignment.value,
    note: detailNote.value,
    published: detailAssignment.value.published,
  })
  ElMessage.success('备注已保存')
}

function openSwapDialog() {
  swapForm.value = { targetEmployeeId: '', reason: '' }
  swapDialogVisible.value = true
}

async function submitSwapRequest() {
  if (!detailCell.value || !detailAssignment.value) return
  if (!swapForm.value.targetEmployeeId) {
    ElMessage.warning('请选择换班对象')
    return
  }
  const req = store.submitSwapRequest({
    applicantId: detailCell.value.employeeId,
    targetEmployeeId: swapForm.value.targetEmployeeId,
    date: detailCell.value.date,
    reason: swapForm.value.reason || '管理端发起换班',
  })
  try {
    await ElMessageBox.confirm('换班申请已创建，是否立即审批通过？', '发起换班', {
      type: 'info',
      confirmButtonText: '立即通过',
      cancelButtonText: '稍后审批',
    })
    store.reviewSwapRequest(req.id, true, '管理端审批通过')
    ElMessage.success('换班已完成')
  } catch {
    ElMessage.success('换班申请已提交，请前往审批中心处理')
  }
  swapDialogVisible.value = false
}

async function submitCancelShift() {
  if (!detailCell.value || !detailAssignment.value) return
  try {
    const { value } = await ElMessageBox.prompt('请输入取消原因', '发起取消班次', {
      inputPlaceholder: '请说明取消原因',
      inputValidator: (v) => (v?.trim() ? true : '请填写原因'),
    })
    const req = store.submitCancelShiftRequest({
      employeeId: detailCell.value.employeeId,
      date: detailCell.value.date,
      shiftId: detailAssignment.value.shiftId,
      teamId: detailAssignment.value.teamId ?? selectedTeamId.value,
      reason: value.trim(),
      initiatedBy: 'admin',
    })
    try {
      await ElMessageBox.confirm('取消班次申请已创建，是否立即审批通过？', '发起取消班次', {
        type: 'warning',
        confirmButtonText: '立即通过',
        cancelButtonText: '稍后审批',
      })
      store.reviewCancelShiftRequest(req.id, true, '管理端审批通过')
      ElMessage.success('班次已取消')
      detailDrawerVisible.value = false
    } catch {
      ElMessage.success('取消班次申请已提交，请前往审批中心处理')
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes('已有待审批')) {
      ElMessage.warning(e.message)
    }
  }
}

function onDragStart(employeeId: string, date: string) {
  if (board.editMode.value !== 'editing') return
  board.dragSource.value = { employeeId, date }
}

function onDrop(employeeId: string, date: string) {
  if (!board.dragSource.value) return
  board.swapCells(board.dragSource.value, { employeeId, date })
  board.dragSource.value = null
}

async function handleCopyLastWeek() {
  if (board.editMode.value !== 'editing') board.enterEditMode()
  const source = displayDates.value.map((d) => addDays(d, viewType.value === 'month' ? -31 : -7))
  const count = board.copyLastPeriod(source)
  ElMessage.success(`已复制 ${count} 条排班`)
}

function openSmartDialog() {
  if (board.editMode.value !== 'editing') board.enterEditMode()
  smartForm.value.dateRange = [displayDates.value[0], displayDates.value[displayDates.value.length - 1]]
  smartForm.value.employeeIds = [...memberIds.value]
  smartDialogVisible.value = true
}

async function runSmartSchedule() {
  const t = team.value
  if (!t) return
  if (!smartForm.value.employeeIds.length) {
    ElMessage.warning('请选择参与排班的人员')
    return
  }
  const [startDate, endDate] = smartForm.value.dateRange
  if (!hasConfiguredShiftDemand(startDate, endDate)) {
    ElMessage.warning('请先配置班次需求')
    return
  }
  const result = generateSmartSchedule(
    t,
    store.employees,
    store.shifts,
    store.holidays,
    store.leaveRequests,
    store.assignments,
    groupCompliance.value!,
    {
      teamId: t.id,
      startDate,
      endDate,
      employeeIds: smartForm.value.employeeIds,
      shiftDemands: smartShiftDemands.value.map((d) => ({
        shiftId: d.shiftId,
        templateName: d.templateName,
        requiredHeadcount: Math.ceil(d.avgNeeded),
      })),
      getDateHeadcount: resolveSmartDateHeadcount,
      preferEmployeePreference: smartForm.value.preferEmployeePreference,
      balanceHours: smartForm.value.balanceHours,
      respectLeave: smartForm.value.respectLeave,
    },
  )
  if (!result.assignments.length) {
    ElMessage.warning(result.message)
    return
  }
  store.applySmartSchedule(result.assignments)
  smartDialogVisible.value = false
  ElMessage.success(result.message)
}

async function applyTemplate(templateId: string) {
  if (board.editMode.value !== 'editing') board.enterEditMode()
  await ElMessageBox.confirm('套用模板将覆盖当前周期草稿排班，是否继续？', '套用模板', {
    type: 'warning',
  })
  const count = store.applyScheduleTemplate(
    templateId,
    selectedTeamId.value,
    displayDates.value,
    memberIds.value,
  )
  ElMessage.success(`已套用模板，填充 ${count} 条`)
}

async function applyTemplateFromManager(templateId: string) {
  await applyTemplate(templateId)
  templateManagerVisible.value = false
}

function openDemandDrawer() {
  demandDrawerVisible.value = true
}

function onDemandSaved() {
  /* 刷新由 store 响应式驱动 */
}

function onCycleAppliedFromDemand(count: number) {
  if (board.editMode.value !== 'editing') board.enterEditMode()
  if (count > 0) ElMessage.success('周期规则排班已写入草稿')
}

async function clearDraft() {
  await ElMessageBox.confirm('将清空当前周期未发布草稿并恢复至上次发布版本', '清空草稿', {
    type: 'warning',
  })
  board.clearDraft()
  ElMessage.success('草稿已清空')
}

function openPublishDialog() {
  publishDialogVisible.value = true
}

async function confirmPublish() {
  board.publish()
  publishDialogVisible.value = false
  ElMessage.success('排班已发布')
}

function openPublishLog() {
  publishLogVisible.value = true
}

function viewPublishVersion(record: SchedulePublishRecord) {
  selectedPublishRecord.value = record
  versionDetailVisible.value = true
}

async function restorePublishVersion(record: SchedulePublishRecord) {
  if (!record.snapshot?.length) {
    ElMessage.warning('该版本无快照数据')
    return
  }
  await ElMessageBox.confirm(
    `将 V${record.version}（${record.periodStart} ~ ${record.periodEnd}）恢复为草稿，需再次发布才生效。`,
    '恢复版本',
    { type: 'warning' },
  )
  if (board.editMode.value !== 'editing') board.enterEditMode()
  const count = store.restoreSchedulePublishVersion(record.id)
  ElMessage.success(`已恢复 ${count} 条排班为草稿`)
  publishLogVisible.value = false
}

function formatPublishTime(iso: string) {
  return new Date(iso).toLocaleString('zh-CN')
}

async function saveAsTemplate() {
  const { value } = await ElMessageBox.prompt('请输入模板名称', '保存为模板', {
    inputValue: saveTemplateName.value || '自定义排班模板',
  })
  const pattern = displayDates.value.slice(0, 7).map((date) => {
    const asn = board.getVisibleAssignment(memberIds.value[0], date)
    return asn?.shiftId ?? store.shifts.find((s) => s.code === 'REST')?.id ?? 'shift_rest'
  })
  while (pattern.length < 7) pattern.push(pattern[pattern.length % Math.max(pattern.length, 1)] ?? 'shift_rest')
  store.saveScheduleTemplate({
    name: value,
    teamId: selectedTeamId.value,
    attendanceGroupId: team.value?.attendanceGroupId ?? '',
    pattern: pattern.slice(0, 7),
  })
  ElMessage.success('模板已保存')
}

function onKeydown(e: KeyboardEvent) {
  if (!(e.target instanceof HTMLElement) || e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
    return
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
    e.preventDefault()
    if (board.undo()) ElMessage.info('已撤销')
  }
  if ((e.metaKey || e.ctrlKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
    e.preventDefault()
    if (board.redo()) ElMessage.info('已重做')
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'c' && detailCell.value) {
    board.copyFromEmployee(detailCell.value.employeeId)
    ElMessage.success('已复制排班')
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'v' && detailCell.value) {
    board.pasteToEmployee(detailCell.value.employeeId)
    ElMessage.success('已粘贴排班')
  }
}

function tryAutoGenerateForTeam() {
  if (!selectedTeamId.value || !memberIds.value.length || !displayDates.value.length) return
  const count = store.tryAutoGenerateCycleRules(
    selectedTeamId.value,
    memberIds.value,
    displayDates.value,
  )
  if (count > 0 && board.editMode.value !== 'editing') {
    board.enterEditMode()
    ElMessage.info(`周期规则已自动生成 ${count} 条排班草稿`)
  }
}

watch([selectedTeamId, displayDates], tryAutoGenerateForTeam, { immediate: true })

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="schedule-page">
    <header class="page-toolbar page-card">
      <div class="toolbar-left">
        <h2 class="page-title">排班管理</h2>
        <EnterpriseScopeSelect
          v-if="showEnterpriseControl"
          v-model="enterpriseFilter"
          mode="switch"
          size="small"
          width="200px"
        />
        <el-select v-model="selectedTeamId" style="width: 140px" size="small">
          <el-option v-for="t in scopedTeams" :key="t.id" :label="t.name" :value="t.id" />
        </el-select>
        <span class="period-label">{{ periodLabel }}</span>
        <el-button-group size="small">
          <el-button @click="prevPeriod">◀</el-button>
          <el-button @click="nextPeriod">▶</el-button>
          <el-button @click="goToday">今天</el-button>
        </el-button-group>
        <el-radio-group v-model="viewType" size="small">
          <el-radio-button value="month">月视图</el-radio-button>
          <el-radio-button value="week">周视图</el-radio-button>
        </el-radio-group>
        <el-date-picker
          v-if="viewType === 'month'"
          v-model="selectedMonth"
          type="month"
          value-format="YYYY-MM"
          size="small"
          style="width: 120px"
        />
      </div>
      <el-input
        v-model="keyword"
        placeholder="搜索员工"
        clearable
        size="small"
        style="width: 140px"
      />
    </header>

    <div class="mode-bar page-card">
      <el-radio-group v-model="scheduleMode" size="small">
        <el-radio-button value="shift">按班次排班</el-radio-button>
        <el-radio-button value="custom">自定义排班</el-radio-button>
      </el-radio-group>
      <el-button size="small" type="primary" @click="templateManagerVisible = true">排班模版管理</el-button>
    </div>

    <div class="status-bar" :class="statusBar.type">
      <span class="status-tag">📋 状态：[{{ statusBar.label }}]</span>
      <span class="status-desc">{{ statusBar.desc }}</span>
      <div class="status-actions">
        <template v-if="board.editMode.value === 'readonly'">
          <el-button type="primary" size="small" @click="handleEnterEditMode">编辑排班</el-button>
        </template>
        <template v-else>
          <el-button size="small" @click="board.exitEditMode()">退出编辑</el-button>
        </template>
        <el-button size="small" :disabled="!board.canUndo.value" :icon="RefreshLeft" @click="board.undo()">
          撤销
        </el-button>
        <el-button size="small" :disabled="!board.canRedo.value" :icon="RefreshRight" @click="board.redo()">
          重做
        </el-button>
        <el-button size="small" @click="handleCopyLastWeek">复制上{{ viewType === 'month' ? '月' : '周' }}</el-button>
        <el-button size="small" type="primary" :icon="MagicStick" @click="openSmartDialog">智能排班</el-button>
        <el-dropdown trigger="click" @command="applyTemplate">
          <el-button size="small">
            套用模板 <el-icon><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item v-for="tpl in teamTemplates" :key="tpl.id" :command="tpl.id">
                {{ tpl.name }}{{ tpl.isDefault ? '（默认）' : '' }}
              </el-dropdown-item>
              <el-dropdown-item v-if="!teamTemplates.length" disabled>暂无模板</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button size="small" @click="saveAsTemplate">存为模板</el-button>
        <el-button size="small" @click="clearDraft">清空草稿</el-button>
        <el-button size="small" type="primary" @click="handleSaveDraft">保存</el-button>
        <el-button type="success" size="small" @click="openPublishDialog">发布</el-button>
        <el-button size="small" type="primary" @click="openPublishLog">
          发布日志
          <el-tag v-if="currentPublishVersion" size="small" type="info" style="margin-left: 4px">
            V{{ currentPublishVersion }}
          </el-tag>
        </el-button>
      </div>
    </div>

    <div class="board-body">
      <aside class="left-panel page-card">
        <div class="panel-section">
          <div class="panel-head">
            <span>班次需求概览</span>
            <el-button link type="primary" size="small" @click="openDemandDrawer">配置需求</el-button>
          </div>
          <p v-if="selectedGroup" class="panel-sub text-muted">
            {{ selectedGroup.name }} · 按日需求
            <template v-if="hasTeamCycleRule"> · 已启用周期规则</template>
          </p>
          <el-alert
            v-if="!hasTeamCycleRule && needNextWeekDemand"
            type="warning"
            :closable="false"
            title="请于每周日前配置下一周各日班次需求"
            style="margin-bottom: 8px"
          />
          <div class="demand-cards">
            <div
              v-for="d in shiftDemand"
              :key="d.template.id"
              class="demand-card"
              :class="{
                clickable: scheduleMode === 'shift' && d.shift,
                active: scheduleMode === 'shift' && selectedLineShiftId === d.shift?.id,
              }"
              @click="d.shift && scheduleMode === 'shift' ? selectDemandShift(d) : undefined"
            >
              <div class="demand-head">
                <i v-if="d.shift" class="shift-dot" :style="{ background: d.shift.color }" />
                <span class="demand-name">{{ d.template.name }}</span>
              </div>
              <div class="demand-num">周期需求 {{ d.neededPersonDays }} 人·次</div>
              <div class="demand-sub">已排 {{ d.scheduledPersonDays }} · 缺 {{ d.gapPersonDays }} 人·次</div>
              <el-progress
                :percentage="d.fillRate"
                :stroke-width="6"
                :color="d.gapPersonDays > 0 ? '#e6a23c' : '#67c23a'"
                :show-text="false"
              />
            </div>
            <el-empty v-if="!shiftDemand.length" description="请配置班次需求" :image-size="48" />
          </div>
          <div v-if="shiftDemand.length" class="demand-footer">
            <span v-if="demandSummary.shortageShifts" class="gap-hint">
              {{ demandSummary.shortageShifts }} 个班次存在缺口
            </span>
            <span v-else class="ok-hint">当前周期需求已满足</span>
          </div>
        </div>
      </aside>

      <div class="board-main page-card">
      <div
        class="schedule-editor-layout"
        :class="{
          'has-line-panel': showLinePanel && board.editMode.value === 'editing',
          'line-edit-only': board.editMode.value === 'editing',
        }"
      >
      <div v-if="scheduleMode === 'shift' && !selectedLineShiftContext" class="line-select-hint">
        <el-alert
          type="info"
          :closable="false"
          title="请从左侧「班次需求概览」选择班次，进入编辑后按周拖拽为员工排班"
        />
      </div>
      <ScheduleLinePanel
        v-if="scheduleMode === 'shift' && selectedLineShiftContext && board.editMode.value === 'editing'"
        v-model:selected-date="lineSelectedDate"
        :team-id="selectedTeamId"
        :member-ids="memberIds"
        :week-dates="displayDates"
        :edit-mode="board.editMode.value === 'editing'"
        :shift-context="selectedLineShiftContext"
        mode="shift"
        :conflict-map="board.conflictMap.value"
        class="inline-line-panel"
        @enter-edit="handleEnterEditMode()"
      />
      <ScheduleLinePanel
        v-if="scheduleMode === 'custom' && board.editMode.value === 'editing'"
        v-model:selected-date="lineSelectedDate"
        :team-id="selectedTeamId"
        :member-ids="memberIds"
        :week-dates="weekDates"
        :edit-mode="board.editMode.value === 'editing'"
        :shift-context="null"
        mode="custom"
        :conflict-map="board.conflictMap.value"
        class="inline-line-panel"
        @enter-edit="handleEnterEditMode()"
      />

      <div class="schedule-list-section">
      <div v-if="scheduleMode === 'shift'" class="list-view-bar">
        <span class="list-view-label">列表视图</span>
        <el-radio-group v-model="shiftListView" size="small">
          <el-radio-button value="team">按人员</el-radio-button>
          <el-radio-button value="grid">按班次</el-radio-button>
        </el-radio-group>
      </div>
      <div class="list-section-title">排班列表</div>

      <ScheduleTeamBoard
        v-if="scheduleMode !== 'shift' || shiftListView === 'team'"
        class="schedule-list-board"
        :dates="displayDates"
        :groups="teamBoardGroups"
        :shifts="store.shifts"
        :edit-mode="board.editMode.value"
        :selected-cells="board.selectedCells.value"
        :conflict-map="board.conflictMap.value"
        :max-weekly-hours="groupCompliance.maxWeeklyHours"
        :get-assignment="board.getVisibleAssignment"
        :get-published-assignment="board.getPublishedAssignment"
        :is-cell-locked="board.isCellLocked"
        :compact="viewType === 'month'"
        @cell-click="onCellClick"
        @cell-context="onCellContext"
        @drag-start="onDragStart"
        @drop="onDrop"
      />
      <ScheduleShiftGrid
        v-else
        class="schedule-list-board"
        :dates="displayDates"
        :shift-rows="shiftRows"
        :compact="viewType === 'month'"
        :get-cell-employees="getShiftCellEmployees"
        :get-cell-needed="getShiftCellNeeded"
        :get-cell-gap="getShiftCellGap"
        :get-cell-class="getShiftCellClass"
        @cell-click="onShiftCellClick"
      />
      </div>
      </div>

      <div class="legend">
        <span class="legend-title">图例</span>
        <span v-for="s in store.shifts" :key="s.id" class="legend-item">
          <i :style="{ background: s.color }" />{{ s.name }}
        </span>
        <span v-for="(cfg, key) in confirmStatusMap" :key="key" class="legend-item">
          <i :style="{ background: cfg.bg, border: `1px solid ${cfg.color}` }" />{{ cfg.label }}
        </span>
        <span class="legend-item"><i class="dot-conflict" />工时红线冲突</span>
        <span class="legend-item"><i class="dot-locked" />已确认（不可编辑）</span>
        <span class="text-muted tip-inline">
          {{
            board.editMode.value === 'editing'
              ? scheduleMode === 'custom'
                ? '自定义划线排班，冲突会在面板内标红提醒'
                : '选择左侧班次后按周拖拽排班，冲突会在面板内标红提醒'
              : scheduleMode === 'custom'
                ? '查看排班列表，点击编辑排班进行自定义划线'
                : '查看排班列表，点击编辑排班进行按班次划线'
          }}
        </span>
      </div>
      </div>
    </div>

    <ScheduleTemplateManager
      v-model:visible="templateManagerVisible"
      :team-id="selectedTeamId"
      :attendance-group-id="team?.attendanceGroupId ?? ''"
      @apply="applyTemplateFromManager"
    />

    <el-dialog v-model="shiftAssignVisible" title="分配班次人员" width="420px" destroy-on-close>
      <p v-if="shiftAssignTarget" class="text-muted assign-hint">
        {{ shiftAssignTarget.date }}
        · {{ store.shifts.find((s) => s.id === shiftAssignTarget?.shiftId)?.name }}
      </p>
      <el-checkbox-group v-model="shiftAssignEmployeeIds">
        <el-checkbox v-for="e in employees" :key="e.id" :label="e.id" class="emp-check">
          {{ e.name }}
        </el-checkbox>
      </el-checkbox-group>
      <template #footer>
        <el-button @click="shiftAssignVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmShiftAssign">确定</el-button>
      </template>
    </el-dialog>

    <ScheduleDemandConfigDrawer
      v-model:visible="demandDrawerVisible"
      :team-id="selectedTeamId"
      :member-ids="memberIds"
      :templates="selectedGroup?.shiftTemplates ?? []"
      :default-week-start="demandConfigWeekStart"
      :display-dates="displayDates"
      @saved="onDemandSaved"
      @cycle-applied="onCycleAppliedFromDemand"
    />

    <Teleport to="body">
      <div
        v-if="shiftPickerVisible"
        class="shift-picker"
        :style="{ left: shiftPickerPos.x + 'px', top: shiftPickerPos.y + 'px' }"
      >
        <div
          v-for="s in store.shifts"
          :key="s.id"
          class="picker-item"
          :style="{ borderColor: s.color }"
          @click="pickShift(s.id)"
        >
          {{ s.name }}
        </div>
      </div>
      <div
        v-if="batchMenuVisible"
        class="batch-menu"
        :style="{ left: batchMenuPos.x + 'px', top: batchMenuPos.y + 'px' }"
        @mouseleave="batchMenuVisible = false"
      >
        <div class="batch-title">批量操作（{{ board.selectedCells.value.size }}格）</div>
        <div
          v-for="s in store.shifts"
          :key="s.id"
          class="batch-item"
          @click="board.batchSetShift(s.id); batchMenuVisible = false"
        >
          设为 {{ s.name }}
        </div>
        <div class="batch-item danger" @click="board.batchClear(); batchMenuVisible = false">批量清除</div>
      </div>
    </Teleport>

    <el-drawer v-model="detailDrawerVisible" title="排班详情" size="360px">
      <template v-if="detailCell && detailEmployee">
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="员工">{{ detailEmployee.name }}</el-descriptions-item>
          <el-descriptions-item label="日期">{{ detailCell.date }}</el-descriptions-item>
          <el-descriptions-item label="班次">{{ detailShift?.name ?? '未排班' }}</el-descriptions-item>
          <el-descriptions-item v-if="detailShift" label="时间">
            {{ detailShift.startTime }}-{{ detailShift.endTime }}
          </el-descriptions-item>
          <el-descriptions-item label="状态">
            <span
              v-if="detailPublishedAssignment && normalizeConfirmStatus(detailPublishedAssignment.confirmStatus)"
              :style="{ color: confirmStatusMap[normalizeConfirmStatus(detailPublishedAssignment.confirmStatus)!].color }"
            >
              {{ confirmStatusMap[normalizeConfirmStatus(detailPublishedAssignment.confirmStatus)!].label }}
            </span>
            <span v-else-if="detailAssignment && !detailAssignment.published">草稿（未发布）</span>
            <span v-else>—</span>
          </el-descriptions-item>
        </el-descriptions>
        <el-form label-width="60px" style="margin-top: 16px">
          <el-form-item label="备注">
            <el-input
              v-model="detailNote"
              type="textarea"
              :rows="3"
              :disabled="board.editMode.value !== 'editing' || detailIsLocked"
            />
          </el-form-item>
        </el-form>
        <el-alert
          v-if="detailIsLocked"
          type="info"
          :closable="false"
          title="该班次灵工已确认，不可直接编辑，请通过换班或取消班次处理"
          style="margin-bottom: 12px"
        />
        <div v-if="detailIsLocked && detailAssignment" class="drawer-actions">
          <el-button type="primary" plain style="width: 100%; margin-bottom: 8px" @click="openSwapDialog">
            发起换班
          </el-button>
          <el-button type="danger" plain style="width: 100%" @click="submitCancelShift">
            发起取消班次
          </el-button>
        </div>
        <div v-else-if="board.editMode.value === 'editing'" class="drawer-actions">
          <el-select
            v-if="detailAssignment"
            placeholder="更换班次"
            style="width: 100%; margin-bottom: 8px"
            @change="(id: string) => board.setCellShift(detailCell!.employeeId, detailCell!.date, id)"
          >
            <el-option v-for="s in store.shifts" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
          <el-button v-if="detailAssignment" type="danger" plain @click="board.clearCell(detailCell!.employeeId, detailCell!.date)">
            取消排班
          </el-button>
          <el-button type="primary" @click="saveDetailNote">保存备注</el-button>
        </div>
        <p v-else class="text-muted tip">只读模式，点击「编辑排班」后可修改</p>
      </template>
    </el-drawer>

    <el-dialog v-model="swapDialogVisible" title="发起换班" width="440px">
      <el-form label-width="80px">
        <el-form-item label="换班对象">
          <el-select v-model="swapForm.targetEmployeeId" placeholder="选择换班对象" style="width: 100%">
            <el-option
              v-for="emp in swapTargetOptions"
              :key="emp.id"
              :label="`${emp.name}（${emp.employeeNo}）`"
              :value="emp.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="原因">
          <el-input v-model="swapForm.reason" type="textarea" :rows="3" placeholder="选填" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="swapDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitSwapRequest">提交</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="smartDialogVisible" title="智能排班" width="560px">
      <el-form label-width="100px">
        <el-form-item label="排班区间">
          <el-date-picker v-model="smartForm.dateRange" type="daterange" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="选择人员">
          <div class="smart-emp-picker">
            <el-checkbox v-model="smartAllSelected">全选</el-checkbox>
            <el-select
              v-model="smartForm.employeeIds"
              multiple
              collapse-tags
              collapse-tags-tooltip
              placeholder="选择参与排班的人员"
              style="width: 100%"
            >
              <el-option
                v-for="emp in smartEmployeeOptions"
                :key="emp.id"
                :label="`${emp.name}（${emp.employeeNo}）`"
                :value="emp.id"
              />
            </el-select>
          </div>
        </el-form-item>
        <el-form-item label="班次需求">
          <div v-if="smartShiftDemands.some((d) => d.hasDemand)" class="smart-demand-list">
            <div v-for="d in smartShiftDemands.filter((x) => x.hasDemand)" :key="d.shiftId" class="smart-demand-item">
              <i v-if="d.shift" class="shift-dot" :style="{ background: d.shift.color }" />
              <span>{{ d.templateName }}</span>
              <span class="text-muted">{{ d.startTime }}-{{ d.endTime }}</span>
              <span class="demand-count">
                区间 {{ d.totalNeeded }} 人·次（{{ d.dayCount }} 天，均 {{ d.avgNeeded }} 人/日）
              </span>
            </div>
          </div>
          <el-empty v-else description="请先在班次需求配置中设置当前区间人数" :image-size="48" />
          <p v-if="smartShiftDemands.some((d) => d.hasDemand)" class="field-hint text-muted">
            读取当前班次需求配置（含本周按日需求），从所选人员中智能匹配排班
          </p>
        </el-form-item>
        <el-form-item label="规则">
          <el-checkbox v-model="smartForm.preferEmployeePreference">偏好匹配</el-checkbox>
          <el-checkbox v-model="smartForm.balanceHours">工时均衡</el-checkbox>
          <el-checkbox v-model="smartForm.respectLeave">避开请假</el-checkbox>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="smartDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="runSmartSchedule">开始排班</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="publishDialogVisible" title="发布排班" width="440px">
      <p>确认发布当前周期排班？发布后将通知相关员工确认班次，未发布前不会发送通知。</p>
      <ul class="diff-list">
        <li>新增 {{ publishDiff.added }} 个班次</li>
        <li>修改 {{ publishDiff.modified }} 个班次</li>
        <li>取消 {{ publishDiff.removed }} 个班次</li>
      </ul>
      <template #footer>
        <el-button @click="publishDialogVisible = false">取消</el-button>
        <el-button type="success" @click="confirmPublish">确认发布</el-button>
      </template>
    </el-dialog>

    <el-drawer v-model="publishLogVisible" title="排班发布日志" size="640px">
      <div class="publish-log-head">
        <span class="text-muted">
          {{ team?.name }} · {{ selectedMonth }} · 当前生效版本
          <el-tag v-if="currentPublishVersion" type="success" size="small">V{{ currentPublishVersion }}</el-tag>
          <el-tag v-else type="info" size="small">未发布</el-tag>
        </span>
      </div>
      <el-table :data="publishHistory" border stripe empty-text="暂无发布记录">
        <el-table-column label="版本" width="72">
          <template #default="{ row }">
            <el-tag v-if="row.version" size="small">V{{ row.version }}</el-tag>
            <span v-else>—</span>
          </template>
        </el-table-column>
        <el-table-column label="排班周期" min-width="160">
          <template #default="{ row }">
            {{ row.periodStart && row.periodEnd ? `${row.periodStart} ~ ${row.periodEnd}` : row.month }}
          </template>
        </el-table-column>
        <el-table-column prop="assignmentCount" label="排班数" width="80" />
        <el-table-column prop="publishedBy" label="发布人" width="88" />
        <el-table-column label="发布时间" min-width="160">
          <template #default="{ row }">{{ formatPublishTime(row.publishedAt) }}</template>
        </el-table-column>
        <el-table-column prop="changeNote" label="说明" min-width="100" show-overflow-tooltip />
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="viewPublishVersion(row)">查看</el-button>
            <el-button
              link
              type="warning"
              :disabled="!row.snapshot?.length"
              @click="restorePublishVersion(row)"
            >
              恢复
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-drawer>

    <el-dialog
      v-model="versionDetailVisible"
      :title="selectedPublishRecord ? `版本 V${selectedPublishRecord.version} 快照` : '版本详情'"
      width="720px"
    >
      <template v-if="selectedPublishRecord">
        <el-descriptions :column="2" border size="small" style="margin-bottom: 16px">
          <el-descriptions-item label="班组">{{ team?.name }}</el-descriptions-item>
          <el-descriptions-item label="版本">V{{ selectedPublishRecord.version }}</el-descriptions-item>
          <el-descriptions-item label="周期">
            {{ selectedPublishRecord.periodStart }} ~ {{ selectedPublishRecord.periodEnd }}
          </el-descriptions-item>
          <el-descriptions-item label="发布时间">
            {{ formatPublishTime(selectedPublishRecord.publishedAt) }}
          </el-descriptions-item>
          <el-descriptions-item label="发布人">{{ selectedPublishRecord.publishedBy }}</el-descriptions-item>
          <el-descriptions-item label="排班数">{{ selectedPublishRecord.assignmentCount }}</el-descriptions-item>
        </el-descriptions>
        <el-table
          :data="selectedPublishRecord.snapshot ?? []"
          border
          stripe
          max-height="360"
          empty-text="无快照数据"
        >
          <el-table-column label="员工" width="100">
            <template #default="{ row }">
              {{ store.employees.find((e) => e.id === row.employeeId)?.name ?? row.employeeId }}
            </template>
          </el-table-column>
          <el-table-column prop="date" label="日期" width="110" />
          <el-table-column label="班次" width="100">
            <template #default="{ row }">
              {{ store.shifts.find((s) => s.id === row.shiftId)?.name ?? row.shiftId }}
            </template>
          </el-table-column>
          <el-table-column prop="note" label="备注" min-width="120" show-overflow-tooltip />
        </el-table>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.schedule-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.mode-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
}

.person-picker {
  margin-top: 0;
}

.emp-check {
  display: flex;
  margin-bottom: 8px;
}

.assign-hint {
  margin: 0 0 12px;
}

.tip-inline {
  font-size: 12px;
  margin-left: 8px;
}

.mode-tool-section {
  margin-bottom: 0;
}

.mode-tool-section :deep(.cycle-panel),
.mode-tool-section :deep(.line-panel),
.mode-tool-section :deep(.custom-panel) {
  border-bottom-left-radius: 0;
  border-bottom-right-radius: 0;
  border-bottom: none;
}

.list-view-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 12px;
}

.list-view-label {
  font-size: 13px;
  font-weight: 600;
  color: #606266;
}

.dot-shortage {
  display: inline-block;
  width: 12px;
  height: 12px;
  border-radius: 2px;
  background: #fff7e6;
  border: 1px solid #e6a23c;
  vertical-align: middle;
  margin-right: 4px;
}

.publish-log-head {
  margin-bottom: 16px;
}

.page-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  padding: 14px 20px;
}

.toolbar-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.page-title {
  margin: 0;
  font-size: 18px;
}

.period-label {
  font-weight: 600;
  font-size: 14px;
  min-width: 80px;
}

.status-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  padding: 12px 20px;
  border-radius: 8px;
  border: 1px solid var(--app-border);
  background: #fff;
}

.status-bar.success {
  background: #f0f9eb;
  border-color: #b3e19d;
}

.status-bar.warning {
  background: #fdf6ec;
  border-color: #f5dab1;
}

.status-bar.info {
  background: #ecf5ff;
  border-color: #b3d8ff;
}

.status-tag {
  font-weight: 600;
  white-space: nowrap;
}

.status-desc {
  flex: 1;
  font-size: 13px;
  color: #606266;
  min-width: 200px;
}

.status-actions {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}

.board-body {
  display: grid;
  grid-template-columns: 260px 1fr;
  gap: 12px;
  align-items: start;
}

.left-panel {
  padding: 0;
  overflow: hidden;
  position: sticky;
  top: 12px;
}

.panel-section {
  padding: 14px 16px;
  border-bottom: 1px solid var(--app-border);
}

.panel-section:last-child {
  border-bottom: none;
}

.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 8px;
}

.panel-sub {
  font-size: 11px;
  margin: 0 0 10px;
}

.demand-cards {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.demand-card {
  background: #f5f6fa;
  border-radius: 8px;
  padding: 10px 12px;
}

.demand-card.clickable {
  cursor: pointer;
  transition: background 0.15s, box-shadow 0.15s;
}

.demand-card.clickable:hover {
  background: #eef2ff;
  box-shadow: 0 2px 8px rgba(64, 158, 255, 0.12);
}

.demand-card.active {
  background: #eef2ff;
  box-shadow: inset 0 0 0 2px var(--app-primary);
}

.line-select-hint {
  margin-bottom: 12px;
}

.inline-line-panel :deep(.line-panel) {
  padding: 12px 16px;
}

.inline-line-panel {
  margin-bottom: 0;
  flex-shrink: 0;
}

.schedule-editor-layout {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.schedule-editor-layout.has-line-panel .inline-line-panel {
  max-height: 42vh;
  overflow: auto;
}

.schedule-editor-layout.line-edit-only .inline-line-panel {
  max-height: calc(100vh - 340px);
}

.schedule-list-section {
  flex: 1;
  min-height: 280px;
  display: flex;
  flex-direction: column;
}

.schedule-list-section :deep(.team-board-wrap),
.schedule-list-section :deep(.shift-grid-wrap) {
  max-height: min(52vh, calc(100vh - 420px));
  min-height: 240px;
}

.demand-form-block {
  padding: 12px 0 4px;
  border-bottom: 1px dashed var(--app-border);
}

.demand-form-block:last-child {
  border-bottom: none;
}

.demand-form-name {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #303133;
}

.list-section-title {
  margin: 12px 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: #606266;
}

.demand-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 4px;
}

.shift-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.demand-name {
  font-weight: 600;
  font-size: 13px;
}

.smart-emp-picker {
  width: 100%;
}

.smart-emp-picker .el-checkbox {
  margin-bottom: 8px;
}

.smart-demand-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.smart-demand-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: #f8fafc;
  border-radius: 6px;
  font-size: 13px;
}

.smart-demand-item .demand-count {
  margin-left: auto;
  font-weight: 600;
  color: var(--app-primary);
}

.field-hint {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 1.4;
}

.demand-num {
  font-size: 16px;
  font-weight: 700;
  color: var(--app-primary);
  margin: 2px 0;
}

.demand-sub {
  font-size: 11px;
  color: #909399;
  margin-bottom: 6px;
}

.demand-footer {
  margin-top: 10px;
  font-size: 12px;
}

.gap-hint {
  color: #e6a23c;
}

.ok-hint {
  color: #67c23a;
}

.person-picker .person-item {
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  margin-bottom: 4px;
  border: 1px solid transparent;
  transition: background 0.15s;
}

.person-picker .person-item:hover {
  background: #f5f7fa;
}

.person-picker .person-item.active {
  background: #ecf5ff;
  border-color: #b3d8ff;
}

.person-item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.person-name {
  font-weight: 600;
  font-size: 13px;
}

.reject-tag {
  font-size: 10px;
  color: #f56c6c;
  background: #fef0f0;
  padding: 1px 6px;
  border-radius: 4px;
  flex-shrink: 0;
}

.person-meta {
  font-size: 11px;
  color: #909399;
  margin-top: 2px;
}

.board-main {
  padding: 16px;
  min-width: 0;
}

@media (max-width: 1100px) {
  .board-body {
    grid-template-columns: 1fr;
  }

  .left-panel {
    position: static;
  }
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid var(--app-border);
  align-items: center;
}

.legend-title {
  font-weight: 600;
  font-size: 12px;
  color: #606266;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
}

.legend-item i {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  display: inline-block;
}

.dot-manual {
  background: #409eff;
}

.dot-locked {
  background: #f0fdf4;
  border: 2px solid #67c23a !important;
}

.dot-conflict {
  background: #fef0f0;
  border: 2px solid #f56c6c !important;
}

.shift-picker,
.batch-menu {
  position: fixed;
  z-index: 3000;
  background: #fff;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  padding: 8px;
  min-width: 120px;
}

.picker-item,
.batch-item {
  padding: 8px 12px;
  cursor: pointer;
  border-radius: 4px;
  font-size: 13px;
  border-left: 3px solid transparent;
}

.picker-item:hover,
.batch-item:hover {
  background: #f5f3ff;
}

.batch-title {
  font-size: 12px;
  color: #909399;
  padding: 4px 8px 8px;
}

.batch-item.danger {
  color: #f56c6c;
}

.drawer-actions {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.tip {
  font-size: 12px;
  margin-top: 12px;
}

.diff-list {
  margin: 12px 0 0;
  padding-left: 20px;
  color: #606266;
}
</style>
