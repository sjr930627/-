<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
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
import { useScheduleBoard, filterEmployees } from '@/composables/useScheduleBoard'
import {
  confirmStatusMap,
  normalizeConfirmStatus,
  isAssignmentConfirmedLocked,
  SCHEDULE_DEMO_TODAY,
  isScheduleFutureDate,
  isScheduleShiftHistorical,
  resolveAssignmentStartTime,
} from '@/constants/schedule'
import {
  CANCEL_SHIFT_REASON_OPTIONS,
  buildCancelShiftReasonText,
  type CancelShiftReasonCode,
} from '@/constants/cancelShift'
import { getShiftDemandHeadcount } from '@/services/schedule'
import { resolveShiftIdForTemplate } from '@/services/scheduleGroup'
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
const router = useRouter()
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
/** 按班次排班：当前选中的考勤组班次 */
const selectedLineShiftId = ref<string | null>(null)
const viewType = ref<'month' | 'week'>('week')
const selectedMonth = ref('2026-07')
const weekStart = ref(getWeekStart(SCHEDULE_DEMO_TODAY))
const keyword = ref('')
const lineSelectedDate = ref(SCHEDULE_DEMO_TODAY)

const shiftPickerVisible = ref(false)
const shiftPickerPos = ref({ x: 0, y: 0 })
const pickerTarget = ref<{ employeeId: string; date: string } | null>(null)

const detailDrawerVisible = ref(false)
const detailCell = ref<{ employeeId: string; date: string } | null>(null)

const swapDialogVisible = ref(false)
const swapForm = ref({ targetEmployeeId: '', reason: '' })
const cancelDialogVisible = ref(false)
const cancelForm = ref<{
  reasonCode: CancelShiftReasonCode
  reasonOther: string
}>({
  reasonCode: 'business_change',
  reasonOther: '',
})
const cancelSubmitting = ref(false)
const publishDialogVisible = ref(false)
const publishLogVisible = ref(false)
const versionDetailVisible = ref(false)
const selectedPublishRecord = ref<SchedulePublishRecord | null>(null)

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

const boardDates = computed(() => displayDates.value)

const mutableBoardDates = computed(() =>
  boardDates.value.filter((d) => isScheduleFutureDate(d, SCHEDULE_DEMO_TODAY)),
)

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
  dates: boardDates,
  compliance: groupCompliance,
  memberIds,
})

watch(boardDates, (dates) => {
  if (!dates.length) return
  if (!dates.includes(lineSelectedDate.value)) {
    lineSelectedDate.value = dates[0]
  }
})

function countShiftScheduled(shiftId: string, date: string) {
  let count = 0
  memberIds.value.forEach((employeeId) => {
    const asn = board.getVisibleAssignment(employeeId, date)
    if (asn?.shiftId === shiftId) count += 1
  })
  return count
}

/** 考勤组班次列表（左侧选择后到右侧排班） */
const groupShifts = computed(() => {
  const templates = selectedGroup.value?.shiftTemplates ?? []
  const dates = boardDates.value
  return templates
    .map((tpl) => {
      const shiftId = resolveShiftIdForTemplate(tpl.name, store.shifts)
      const shift = shiftId ? store.shifts.find((s) => s.id === shiftId) ?? null : null
      const weekdayNeeded = tpl.requiredHeadcount ?? 0
      const weekendNeeded = tpl.weekendRequiredHeadcount ?? weekdayNeeded
      const holidayNeeded = tpl.holidayRequiredHeadcount ?? weekdayNeeded
      let scheduledPersonDays = 0
      dates.forEach((date) => {
        if (shiftId) scheduledPersonDays += countShiftScheduled(shiftId, date)
      })
      return {
        template: tpl,
        shift,
        weekdayNeeded,
        weekendNeeded,
        holidayNeeded,
        scheduledPersonDays,
      }
    })
    .filter((d) => d.shift)
})

const shiftRows = computed(() =>
  groupShifts.value.map((d) => ({
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

const selectedLineShiftContext = computed(() => {
  if (!selectedLineShiftId.value) return null
  const d = groupShifts.value.find((x) => x.shift?.id === selectedLineShiftId.value)
  if (!d?.shift) return null
  return {
    shiftId: d.shift.id,
    shiftName: d.template.name,
    startTime: d.template.startTime,
    endTime: d.template.endTime,
    color: d.shift.color,
  }
})

watch(scheduleMode, () => {
  selectedLineShiftId.value = null
})

function selectGroupShift(d: (typeof groupShifts.value)[number]) {
  if (!d.shift) return
  handleEnterEditMode()
  selectedLineShiftId.value = d.shift.id
  lineSelectedDate.value = boardDates.value[0] ?? lineSelectedDate.value
  ElMessage.info(`已选择「${d.template.name}」，可在右侧列表直接排班`)
}

function getShiftCellEmployees(shiftId: string, date: string) {
  return employees.value.filter((emp) => {
    const asn = board.getVisibleAssignment(emp.id, date)
    return asn?.shiftId === shiftId
  })
}

function getShiftCellNeeded(shiftId: string, date: string) {
  const row = groupShifts.value.find((d) => d.shift?.id === shiftId)
  if (!row) return 0
  return getShiftDemandHeadcount(row.template, date, store.holidays)
}

function getShiftCellGap(shiftId: string, date: string) {
  return Math.max(0, getShiftCellNeeded(shiftId, date) - getShiftCellEmployees(shiftId, date).length)
}

function getShiftCellClass(shiftId: string, date: string) {
  const classes: string[] = []
  const shift = store.shifts.find((s) => s.id === shiftId)
  if (isScheduleShiftHistorical(date, shift?.startTime)) classes.push('history')
  if (getShiftCellGap(shiftId, date) > 0) classes.push('shortage')
  else if (getShiftCellEmployees(shiftId, date).length > 0) classes.push('full')
  return classes
}

function onShiftCellClick(shiftId: string, date: string) {
  const shift = store.shifts.find((s) => s.id === shiftId)
  if (isScheduleShiftHistorical(date, shift?.startTime)) {
    ElMessage.warning('历史班次不可编辑')
    return
  }
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
  let skippedLocked = 0
  employees.value.forEach((emp) => {
    if (board.isCellLocked(emp.id, date)) {
      skippedLocked += 1
      return
    }
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
  ElMessage.success(
    skippedLocked
      ? `班次人员已更新（跳过 ${skippedLocked} 个已确认或已过期）`
      : '班次人员已更新',
  )
}

const showLinePanel = computed(
  () =>
    board.editMode.value === 'editing' &&
    (scheduleMode.value === 'custom' ||
      (scheduleMode.value === 'shift' && Boolean(selectedLineShiftContext.value))),
)

function ensureLineShiftSelected() {
  if (scheduleMode.value !== 'shift' || selectedLineShiftId.value) return
  const first = groupShifts.value.find((d) => d.shift)
  if (first?.shift) selectedLineShiftId.value = first.shift.id
}

function handleEnterEditMode() {
  if (!mutableBoardDates.value.length) {
    ElMessage.warning('当前周期没有可编辑的未来班次')
    return
  }
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
      desc: `已于 ${t} 发布；待确认班次可修改后重新发布通知灵工，已确认班次置灰不可改（需取消班次）`,
    }
  }
  if (s === 'editing') {
    return {
      type: 'warning' as const,
      label: '编辑中',
      desc: '待确认班次可修改；已确认班次置灰锁定。修改发布后将通知灵工重新确认',
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

const detailIsHistorical = computed(() => {
  if (!detailCell.value) return false
  return isScheduleShiftHistorical(
    detailCell.value.date,
    resolveAssignmentStartTime(detailAssignment.value, store.shifts),
  )
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

watch(selectedTeamId, () => {
  selectedLineShiftId.value = null
})

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
  weekStart.value = getWeekStart(SCHEDULE_DEMO_TODAY)
  selectedMonth.value = SCHEDULE_DEMO_TODAY.slice(0, 7)
  lineSelectedDate.value = SCHEDULE_DEMO_TODAY
}

function goCancelShiftRecords() {
  const base = route.path.startsWith('/enterprise')
    ? '/enterprise/cancel-shift-records'
    : '/cancel-shift-records'
  router.push(base)
}

function onCellClick(employeeId: string, date: string, event: MouseEvent) {
  if (event.shiftKey) {
    if (!board.isCellHistorical(employeeId, date)) board.toggleSelect(employeeId, date, true)
    return
  }
  if (board.isCellHistorical(employeeId, date)) {
    openDetail(employeeId, date)
    ElMessage.info('历史班次不可编辑')
    return
  }
  if (board.isCellLocked(employeeId, date)) {
    openDetail(employeeId, date)
    ElMessage.info('该班次已确认，不可在看板编辑，请走取消班次流程')
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

function openSwapDialog() {
  if (detailIsHistorical.value) {
    ElMessage.warning('历史班次不可换班')
    return
  }
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

function openCancelShiftDialog() {
  if (!detailCell.value || !detailAssignment.value) return
  if (detailIsHistorical.value) {
    ElMessage.warning('历史班次不可取消')
    return
  }
  cancelForm.value = { reasonCode: 'business_change', reasonOther: '' }
  cancelDialogVisible.value = true
}

async function submitCancelShift() {
  if (!detailCell.value || !detailAssignment.value) return
  try {
    const reason = buildCancelShiftReasonText(
      cancelForm.value.reasonCode,
      cancelForm.value.reasonOther,
    )
    cancelSubmitting.value = true
    const req = store.submitCancelShiftRequest({
      employeeId: detailCell.value.employeeId,
      date: detailCell.value.date,
      shiftId: detailAssignment.value.shiftId,
      teamId: detailAssignment.value.teamId ?? selectedTeamId.value,
      reason,
      reasonCode: cancelForm.value.reasonCode,
      reasonOther:
        cancelForm.value.reasonCode === 'other'
          ? cancelForm.value.reasonOther.trim()
          : undefined,
      initiatedBy: 'admin',
      source: 'schedule',
      cancelScope: 'person',
    })
    cancelDialogVisible.value = false
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
      ElMessage.success('取消班次申请已提交，可在「取消班次记录」查看')
    }
  } catch (e) {
    ElMessage.warning(e instanceof Error ? e.message : '提交失败')
  } finally {
    cancelSubmitting.value = false
  }
}

function onDragStart(employeeId: string, date: string) {
  if (board.editMode.value !== 'editing') return
  if (board.isCellLocked(employeeId, date)) return
  board.dragSource.value = { employeeId, date }
}

function onDrop(employeeId: string, date: string) {
  if (!board.dragSource.value) return
  if (board.isCellLocked(employeeId, date)) {
    board.dragSource.value = null
    ElMessage.info('目标班次已确认，不可覆盖')
    return
  }
  board.swapCells(board.dragSource.value, { employeeId, date })
  board.dragSource.value = null
}

async function handleCopyLastWeek() {
  if (board.editMode.value !== 'editing') handleEnterEditMode()
  if (!mutableBoardDates.value.length) {
    ElMessage.warning('当前周期没有可编辑的未来班次')
    return
  }
  const offset = viewType.value === 'month' ? -31 : -7
  const source = boardDates.value.map((d) => addDays(d, offset))
  const count = board.copyLastPeriod(source)
  ElMessage.success(`已复制 ${count} 条排班（已确认班次保持不变）`)
}

async function clearDraft() {
  if (!mutableBoardDates.value.length) {
    ElMessage.warning('当前周期没有可编辑的未来班次')
    return
  }
  await ElMessageBox.confirm('将清空当前周期未发布草稿并恢复至上次发布版本', '清空草稿', {
    type: 'warning',
  })
  board.clearDraft()
  ElMessage.success('草稿已清空')
}

function openPublishDialog() {
  if (!mutableBoardDates.value.length) {
    ElMessage.warning('没有可发布的未来班次')
    return
  }
  publishDialogVisible.value = true
}

async function confirmPublish() {
  board.publish()
  publishDialogVisible.value = false
  ElMessage.success('排班已发布；变更的待确认班次已通知灵工')
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
  if (!selectedTeamId.value || !memberIds.value.length || !mutableBoardDates.value.length) return
  const count = store.tryAutoGenerateCycleRules(
    selectedTeamId.value,
    memberIds.value,
    mutableBoardDates.value,
  )
  if (count > 0 && board.editMode.value !== 'editing') {
    board.enterEditMode()
    ElMessage.info(`周期规则已自动生成 ${count} 条排班草稿`)
  }
}

watch([selectedTeamId, boardDates], tryAutoGenerateForTeam, { immediate: true })

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
      <el-button size="small" @click="goCancelShiftRecords">取消班次记录</el-button>
    </header>

    <div class="mode-bar page-card">
      <el-radio-group v-model="scheduleMode" size="small">
        <el-radio-button value="shift">按班次排班</el-radio-button>
        <el-radio-button value="custom">自定义排班</el-radio-button>
      </el-radio-group>
      <span class="text-muted scope-tip">
        已过期班次只读；仅未开始的班次可取消、编辑、发布
      </span>
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
        <el-button size="small" @click="clearDraft">清空草稿</el-button>
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
            <span>考勤组班次</span>
          </div>
          <p v-if="selectedGroup" class="panel-sub text-muted">
            {{ selectedGroup.name }} · 点击班次到右侧排班
          </p>
          <p v-else class="panel-sub text-muted">当前团队未绑定考勤组</p>
          <div class="demand-cards">
            <div
              v-for="d in groupShifts"
              :key="d.template.id"
              class="demand-card"
              :class="{
                clickable: scheduleMode === 'shift',
                active: scheduleMode === 'shift' && selectedLineShiftId === d.shift?.id,
              }"
              @click="scheduleMode === 'shift' ? selectGroupShift(d) : undefined"
            >
              <div class="demand-head">
                <i v-if="d.shift" class="shift-dot" :style="{ background: d.shift.color }" />
                <span class="demand-name">{{ d.template.name }}</span>
              </div>
              <div class="demand-num">
                {{ d.template.startTime.slice(0, 5) }}-{{ d.template.endTime.slice(0, 5) }}
              </div>
              <div class="demand-sub">
                平{{ d.weekdayNeeded }} · 末{{ d.weekendNeeded }} · 节{{ d.holidayNeeded }}
                · 已排 {{ d.scheduledPersonDays }} 人·次
              </div>
            </div>
            <el-empty
              v-if="!groupShifts.length"
              description="考勤组暂无班次，请先在考勤组中配置班次"
              :image-size="48"
            />
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
      <div
        v-if="scheduleMode === 'shift' && !selectedLineShiftContext"
        class="line-select-hint"
      >
        <el-alert
          type="info"
          :closable="false"
          title="请从左侧「考勤组班次」选择班次，进入编辑后可在右侧列表直接排班"
        />
      </div>
      <ScheduleLinePanel
        v-if="scheduleMode === 'shift' && selectedLineShiftContext && board.editMode.value === 'editing'"
        v-model:selected-date="lineSelectedDate"
        :team-id="selectedTeamId"
        :member-ids="memberIds"
        :week-dates="boardDates"
        :edit-mode="board.editMode.value === 'editing'"
        :shift-context="selectedLineShiftContext"
        mode="shift"
        :conflict-map="board.conflictMap.value"
        :is-cell-locked="board.isCellLocked"
        class="inline-line-panel"
        @enter-edit="handleEnterEditMode()"
      />
      <ScheduleLinePanel
        v-if="scheduleMode === 'custom' && board.editMode.value === 'editing'"
        v-model:selected-date="lineSelectedDate"
        :team-id="selectedTeamId"
        :member-ids="memberIds"
        :week-dates="boardDates"
        :edit-mode="board.editMode.value === 'editing'"
        :shift-context="null"
        mode="custom"
        :conflict-map="board.conflictMap.value"
        :is-cell-locked="board.isCellLocked"
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
      <div class="list-section-title">
        排班列表
      </div>

      <ScheduleTeamBoard
        v-if="(scheduleMode !== 'shift' || shiftListView === 'team') && boardDates.length"
        class="schedule-list-board"
        :dates="boardDates"
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
        v-else-if="boardDates.length"
        class="schedule-list-board"
        :dates="boardDates"
        :shift-rows="shiftRows"
        :compact="viewType === 'month'"
        :get-cell-employees="getShiftCellEmployees"
        :get-cell-needed="getShiftCellNeeded"
        :get-cell-gap="getShiftCellGap"
        :get-cell-class="getShiftCellClass"
        @cell-click="onShiftCellClick"
      />
      <el-empty
        v-else
        description="当前周期没有排班日期"
        :image-size="72"
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
        <span class="legend-item"><i class="dot-locked" />已确认 / 已过期（置灰不可编辑）</span>
        <span class="text-muted tip-inline">
          {{
            board.editMode.value === 'editing'
              ? scheduleMode === 'custom'
                ? '自定义划线排班；已过期与已确认班次置灰不可操作'
                : '仅未开始班次可改，发布后通知灵工；已过期与已确认班次置灰不可操作'
              : '已过期班次只读，点击「编辑排班」可调整未来班次'
          }}
        </span>
      </div>
      </div>
    </div>

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
        <el-alert
          v-if="detailIsHistorical"
          type="info"
          :closable="false"
          title="该班次已过期，不可修改、取消或发布"
          style="margin-bottom: 12px"
        />
        <el-alert
          v-else-if="detailIsLocked"
          type="info"
          :closable="false"
          title="该班次灵工已确认，不可直接编辑，请通过换班或取消班次处理"
          style="margin-bottom: 12px"
        />
        <div v-if="!detailIsHistorical && detailIsLocked && detailAssignment" class="drawer-actions">
          <el-button type="primary" plain style="width: 100%; margin-bottom: 8px" @click="openSwapDialog">
            发起换班
          </el-button>
          <el-button type="danger" plain style="width: 100%" @click="openCancelShiftDialog">
            发起取消班次
          </el-button>
        </div>
        <div v-else-if="!detailIsHistorical && board.editMode.value === 'editing'" class="drawer-actions">
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
        </div>
        <p v-else-if="detailIsHistorical" class="text-muted tip">历史班次仅可查看</p>
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

    <el-dialog v-model="cancelDialogVisible" title="发起取消班次" width="480px">
      <el-alert
        type="warning"
        :closable="false"
        title="已确认班次取消后将进入审批/记录明细，通过后灵工排班会被移除"
        style="margin-bottom: 16px"
      />
      <el-form label-width="90px">
        <el-form-item label="取消原因" required>
          <el-radio-group v-model="cancelForm.reasonCode" class="cancel-reason-group">
            <el-radio
              v-for="opt in CANCEL_SHIFT_REASON_OPTIONS"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="cancelForm.reasonCode === 'other'" label="其他说明" required>
          <el-input
            v-model="cancelForm.reasonOther"
            type="textarea"
            :rows="3"
            maxlength="200"
            show-word-limit
            placeholder="请填写其他取消原因"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="cancelDialogVisible = false">取消</el-button>
        <el-button type="danger" :loading="cancelSubmitting" @click="submitCancelShift">
          提交申请
        </el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="publishDialogVisible" title="发布排班" width="440px">
      <p>
        确认发布当前未来排班？变更的待确认班次将通知灵工重新确认；已确认班次保持不变，不会被覆盖。
      </p>
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
  flex-wrap: wrap;
  gap: 12px 16px;
  padding: 10px 16px;
}

.scope-tip {
  font-size: 12px;
  margin-left: auto;
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

.panel-head-actions {
  display: flex;
  gap: 4px;
  align-items: center;
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
  background: #f1f5f9;
  border: 1px solid #cbd5e1 !important;
  filter: grayscale(0.35);
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

.cancel-reason-group {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}
</style>
