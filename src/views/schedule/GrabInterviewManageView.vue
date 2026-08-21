<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { useEnterpriseScope } from '@/composables/useEnterpriseScope'
import EnterpriseScopeSelect from '@/components/platform/EnterpriseScopeSelect.vue'
import {
  buildExactInterviewTimes,
  cloneSchedule,
  emptyPositionProfile,
  emptyScheduleRule,
  findDeptPosition,
  formatInterviewScheduleDisplay,
  formatRegistrationTime,
  formatSeatRuleLabel,
  grabInterviewRegStatusMap,
  grabInterviewScheduleModeOptions,
  grabInterviewSeatUnitOptions,
  grabInterviewWeekdayMap,
  grabInterviewWeekdayOptions,
  normalizeDeptInterviewRule,
  normalizeGrabInterviewScheduleRule,
  profileFromTemplate,
  resolveInterviewSlotsForSchedule,
  resolvePositionSchedule,
  weekdayFromDate,
} from '@/constants/grabInterview'
import { JOB_TYPE_OPTIONS, SKILL_OPTIONS } from '@/constants/recruitment'
import { grabShiftPositionOptions } from '@/services/grabShift'
import { generateId, getDepartmentName } from '@/utils'
import { isEnterpriseRootDepartment, isUnassignedDepartment } from '@/constants/department'
import type {
  GrabInterviewDeptPosition,
  GrabInterviewDeptRule,
  GrabInterviewPositionProfile,
  GrabInterviewPositionTemplate,
  GrabInterviewRegStatus,
  GrabInterviewRegistration,
  GrabInterviewScheduleMode,
  GrabInterviewScheduleRule,
  GrabInterviewSeatUnitMinutes,
  GrabInterviewTimeSlot,
  GrabInterviewWeekday,
} from '@/types'

const store = useAppStore()
const route = useRoute()
const { enterpriseFilter, activeEnterpriseId, showEnterpriseControl } =
  useEnterpriseScope('switch')

const activeTab = ref<'config' | 'regs'>('config')
const isEnterprisePortal = computed(() => route.path.startsWith('/enterprise'))

const resolvedEnterpriseId = computed(() => {
  if (isEnterprisePortal.value) return store.currentEnterpriseId
  return activeEnterpriseId.value || store.currentEnterpriseId
})

const currentEnterprise = computed(
  () =>
    store.enterprises.find((e) => e.id === resolvedEnterpriseId.value) ?? store.currentEnterprise,
)

const scopedDepartments = computed(() =>
  store.getDepartmentsByEnterprise(resolvedEnterpriseId.value).filter(
    (d) => !isUnassignedDepartment(d.id) && !isEnterpriseRootDepartment(d),
  ),
)

const config = ref(store.ensureGrabInterviewConfig(resolvedEnterpriseId.value))

watch(
  resolvedEnterpriseId,
  (id) => {
    config.value = store.ensureGrabInterviewConfig(id)
  },
  { immediate: true },
)

const requireInterview = computed({
  get: () => config.value.requireInterview,
  set: (v: boolean) => {
    store.updateGrabInterviewConfig(resolvedEnterpriseId.value, { requireInterview: v })
    config.value = store.ensureGrabInterviewConfig(resolvedEnterpriseId.value)
  },
})

watch(
  () => store.grabInterviewConfigs,
  () => {
    config.value = store.ensureGrabInterviewConfig(resolvedEnterpriseId.value)
  },
  { deep: true },
)

const positionTemplates = computed(() => config.value.positionTemplates ?? [])

const selectedDeptId = ref('')
watch(
  scopedDepartments,
  (depts) => {
    if (!depts.length) {
      selectedDeptId.value = ''
      return
    }
    if (!depts.some((d) => d.id === selectedDeptId.value)) {
      selectedDeptId.value = depts[0].id
    }
  },
  { immediate: true },
)

function emptyPosition(): GrabInterviewDeptPosition {
  return {
    id: generateId('gip'),
    templateId: null,
    profile: emptyPositionProfile(),
    ruleScope: 'position',
    schedule: emptyScheduleRule(),
  }
}

function emptyDeptRule(departmentId: string): GrabInterviewDeptRule {
  return {
    departmentId,
    positions: [],
    departmentSchedule: emptyScheduleRule(),
  }
}

const ruleForm = reactive<GrabInterviewDeptRule>(emptyDeptRule(''))
const selectedPositionId = ref('')
const activeDayTab = ref<GrabInterviewWeekday>(1)
/** 当前编辑的时间规则：部门统一 / 当前岗位独立 */
const scheduleEditTarget = ref<'department' | 'position'>('department')

const activePosition = computed(() =>
  ruleForm.positions.find((p) => p.id === selectedPositionId.value) ?? null,
)

const editingSchedule = computed(() => {
  if (scheduleEditTarget.value === 'department') {
    if (!ruleForm.departmentSchedule) ruleForm.departmentSchedule = emptyScheduleRule()
    return ruleForm.departmentSchedule
  }
  const pos = activePosition.value
  if (!pos) return ruleForm.departmentSchedule ?? emptyScheduleRule()
  if (!pos.schedule) pos.schedule = emptyScheduleRule()
  return pos.schedule
})

watch(
  [selectedDeptId, () => config.value.deptRules],
  () => {
    const existing = config.value.deptRules.find((r) => r.departmentId === selectedDeptId.value)
    const next = normalizeDeptInterviewRule(
      existing
        ? JSON.parse(JSON.stringify(existing))
        : emptyDeptRule(selectedDeptId.value),
    )
    Object.assign(ruleForm, {
      departmentId: next.departmentId,
      positions: next.positions,
      departmentSchedule: next.departmentSchedule ?? emptyScheduleRule(),
    })
    selectedPositionId.value = ruleForm.positions[0]?.id ?? ''
    scheduleEditTarget.value = 'department'
    syncActiveDayTab()
  },
  { immediate: true },
)

watch(selectedPositionId, () => {
  const pos = activePosition.value
  if (pos?.ruleScope === 'position') scheduleEditTarget.value = 'position'
  else scheduleEditTarget.value = 'department'
  syncActiveDayTab()
})

function syncActiveDayTab() {
  const schedule = editingSchedule.value
  activeDayTab.value = (schedule.weekdays[0] as GrabInterviewWeekday) || 1
}

function onScheduleModeChange(mode: string | number | boolean) {
  const schedule = editingSchedule.value
  const next = (mode === 'by_day' ? 'by_day' : 'unified') as GrabInterviewScheduleMode
  schedule.scheduleMode = next
  if (next === 'by_day') {
    if (!schedule.dayTimeSlots) schedule.dayTimeSlots = {}
    schedule.weekdays.forEach((d) => {
      if (!schedule.dayTimeSlots![d]?.length) {
        schedule.dayTimeSlots![d] = schedule.timeSlots.length
          ? schedule.timeSlots.map((s) => ({ ...s, id: generateId('slot') }))
          : [{ id: generateId('slot'), start: '09:00', end: '10:00' }]
      }
    })
    activeDayTab.value = (schedule.weekdays[0] as GrabInterviewWeekday) || 1
  } else if (!schedule.timeSlots.length) {
    const firstDay = schedule.weekdays[0] as GrabInterviewWeekday | undefined
    const fromDay = firstDay ? schedule.dayTimeSlots?.[firstDay] : undefined
    schedule.timeSlots = fromDay?.length
      ? fromDay.map((s) => ({ ...s, id: generateId('slot') }))
      : [{ id: generateId('slot'), start: '09:00', end: '10:00' }]
  }
}

function onWeekdaysChange(days: GrabInterviewWeekday[] | string | number | boolean) {
  const schedule = editingSchedule.value
  const list = (Array.isArray(days) ? days : []) as GrabInterviewWeekday[]
  schedule.weekdays = list
  if (schedule.scheduleMode !== 'by_day') return
  if (!schedule.dayTimeSlots) schedule.dayTimeSlots = {}
  list.forEach((d) => {
    if (!schedule.dayTimeSlots![d]?.length) {
      schedule.dayTimeSlots![d] = [{ id: generateId('slot'), start: '09:00', end: '10:00' }]
    }
  })
  Object.keys(schedule.dayTimeSlots).forEach((key) => {
    const d = Number(key) as GrabInterviewWeekday
    if (!list.includes(d)) delete schedule.dayTimeSlots![d]
  })
  if (!list.includes(activeDayTab.value)) {
    activeDayTab.value = list[0] || 1
  }
}

function slotsOfDay(day: GrabInterviewWeekday) {
  const schedule = editingSchedule.value
  if (!schedule.dayTimeSlots) schedule.dayTimeSlots = {}
  if (!schedule.dayTimeSlots[day]) schedule.dayTimeSlots[day] = []
  return schedule.dayTimeSlots[day]!
}

function addTimeSlot(day?: GrabInterviewWeekday) {
  const schedule = editingSchedule.value
  const slot: GrabInterviewTimeSlot = {
    id: generateId('slot'),
    start: '14:00',
    end: '15:00',
  }
  if (schedule.scheduleMode === 'by_day' && day != null) {
    slotsOfDay(day).push(slot)
  } else {
    schedule.timeSlots.push(slot)
  }
}

function removeTimeSlot(idx: number, day?: GrabInterviewWeekday) {
  const schedule = editingSchedule.value
  if (schedule.scheduleMode === 'by_day' && day != null) {
    const list = slotsOfDay(day)
    if (list.length <= 1) {
      ElMessage.warning('该日至少保留一个时间段')
      return
    }
    list.splice(idx, 1)
    return
  }
  if (schedule.timeSlots.length <= 1) {
    ElMessage.warning('至少保留一个时间段')
    return
  }
  schedule.timeSlots.splice(idx, 1)
}

function validateSchedule(schedule: GrabInterviewScheduleRule, label: string) {
  const normalized = normalizeGrabInterviewScheduleRule(schedule)
  if (!normalized.weekdays.length) {
    ElMessage.warning(`${label}：请选择可面试的星期`)
    return false
  }
  const mode = normalized.scheduleMode ?? 'unified'
  if (mode === 'unified') {
    if (!normalized.timeSlots.length || !normalized.timeSlots.every((s) => s.start && s.end && s.start < s.end)) {
      ElMessage.warning(`${label}：请完善统一时间段（开始须早于结束）`)
      return false
    }
  } else {
    for (const d of normalized.weekdays) {
      const list = normalized.dayTimeSlots?.[d] ?? []
      if (!list.length || !list.every((s) => s.start && s.end && s.start < s.end)) {
        ElMessage.warning(`${label}：请完善${grabInterviewWeekdayMap[d]}的时间段`)
        return false
      }
    }
  }
  if (!normalized.seatsPerUnit || normalized.seatsPerUnit < 1) {
    ElMessage.warning(`${label}：请填写面试席位人数`)
    return false
  }
  return true
}

function addPosition() {
  const pos = emptyPosition()
  ruleForm.positions.push(pos)
  selectedPositionId.value = pos.id
  scheduleEditTarget.value = 'position'
  ElMessage.success('已添加岗位，请完善信息后保存')
}

function removePosition(pos: GrabInterviewDeptPosition) {
  const idx = ruleForm.positions.findIndex((p) => p.id === pos.id)
  if (idx < 0) return
  ruleForm.positions.splice(idx, 1)
  if (selectedPositionId.value === pos.id) {
    selectedPositionId.value = ruleForm.positions[0]?.id ?? ''
  }
}

function onRuleScopeChange(scope: 'position' | 'department') {
  const pos = activePosition.value
  if (!pos) return
  pos.ruleScope = scope
  if (scope === 'position') {
    if (!pos.schedule) pos.schedule = cloneSchedule(ruleForm.departmentSchedule ?? emptyScheduleRule())
    scheduleEditTarget.value = 'position'
  } else {
    scheduleEditTarget.value = 'department'
  }
  syncActiveDayTab()
}

function applyTemplateToPosition(templateId: string) {
  const pos = activePosition.value
  const tpl = positionTemplates.value.find((t) => t.id === templateId)
  if (!pos || !tpl) return
  pos.templateId = tpl.id
  pos.profile = profileFromTemplate(tpl)
  if (tpl.schedule && pos.ruleScope === 'position') {
    pos.schedule = cloneSchedule(tpl.schedule)
  }
  ElMessage.success(`已应用模板「${tpl.name}」`)
}

function saveDeptRule() {
  if (!selectedDeptId.value) return
  if (!ruleForm.positions.length) {
    ElMessage.warning('请至少添加一个岗位')
    return
  }
  if (!validateSchedule(ruleForm.departmentSchedule ?? emptyScheduleRule(), '部门统一面试规则')) {
    return
  }
  for (const pos of ruleForm.positions) {
    if (!pos.profile.positionName?.trim()) {
      ElMessage.warning('请填写每个岗位的名称')
      return
    }
    if (pos.ruleScope === 'position') {
      if (!validateSchedule(pos.schedule ?? emptyScheduleRule(), `岗位「${pos.profile.positionName}」`)) {
        return
      }
    }
  }
  const names = ruleForm.positions.map((p) => p.profile.positionName.trim())
  if (new Set(names).size !== names.length) {
    ElMessage.warning('同一部门下岗位名称不可重复')
    return
  }
  store.upsertGrabInterviewDeptRule(resolvedEnterpriseId.value, {
    departmentId: selectedDeptId.value,
    positions: JSON.parse(JSON.stringify(ruleForm.positions)),
    departmentSchedule: JSON.parse(
      JSON.stringify(ruleForm.departmentSchedule ?? emptyScheduleRule()),
    ),
  })
  ElMessage.success('部门面试配置已保存')
}

async function clearDeptRule() {
  if (!selectedDeptId.value) return
  try {
    await ElMessageBox.confirm('确定清除该部门的全部岗位与面试规则？', '提示', { type: 'warning' })
    store.removeGrabInterviewDeptRule(resolvedEnterpriseId.value, selectedDeptId.value)
    Object.assign(ruleForm, emptyDeptRule(selectedDeptId.value))
    selectedPositionId.value = ''
    ElMessage.success('已清除')
  } catch {
    /* cancel */
  }
}

function weekdayLabels(days: GrabInterviewWeekday[]) {
  return days.map((d) => grabInterviewWeekdayMap[d]).join('、') || '—'
}

function schedulePreviewText(schedule: GrabInterviewScheduleRule) {
  const normalized = normalizeGrabInterviewScheduleRule(schedule)
  const mode = normalized.scheduleMode ?? 'unified'
  const seat = formatSeatRuleLabel(
    (normalized.seatUnitMinutes ?? 30) as GrabInterviewSeatUnitMinutes,
    normalized.seatsPerUnit ?? 1,
  )
  if (mode === 'unified') {
    const slots = normalized.timeSlots.map((s) => `${s.start}-${s.end}`).join('、') || '—'
    return `${weekdayLabels(normalized.weekdays)} · ${slots} · ${seat}`
  }
  const parts = normalized.weekdays.map((d) => {
    const slots = (normalized.dayTimeSlots?.[d] ?? [])
      .map((s) => `${s.start}-${s.end}`)
      .join('/')
    return `${grabInterviewWeekdayMap[d]} ${slots || '—'}`
  })
  return `${parts.join('；')} · ${seat}`
}

const departmentSchedulePreview = computed(() =>
  schedulePreviewText(ruleForm.departmentSchedule ?? emptyScheduleRule()),
)

const positionSchedulePreview = computed(() => {
  const pos = activePosition.value
  if (!pos) return '—'
  if (pos.ruleScope === 'department') {
    return `应用全部门 · ${departmentSchedulePreview.value}`
  }
  return schedulePreviewText(pos.schedule ?? emptyScheduleRule())
})

/* —— 岗位模板库 —— */
const templateDialogVisible = ref(false)
const templateFormVisible = ref(false)
const templateForm = reactive({
  id: '',
  name: '',
  profile: emptyPositionProfile() as GrabInterviewPositionProfile,
  includeSchedule: false,
  schedule: emptyScheduleRule() as GrabInterviewScheduleRule,
})
const templateScheduleDayTab = ref<GrabInterviewWeekday>(1)

function openTemplateLibrary() {
  templateDialogVisible.value = true
}

function openCreateTemplate() {
  templateForm.id = ''
  templateForm.name = ''
  templateForm.profile = emptyPositionProfile()
  templateForm.includeSchedule = false
  templateForm.schedule = emptyScheduleRule()
  templateScheduleDayTab.value = 1
  templateFormVisible.value = true
}

function openEditTemplate(tpl: GrabInterviewPositionTemplate) {
  templateForm.id = tpl.id
  templateForm.name = tpl.name
  templateForm.profile = JSON.parse(JSON.stringify(tpl.profile))
  templateForm.includeSchedule = !!tpl.schedule
  templateForm.schedule = tpl.schedule
    ? cloneSchedule(tpl.schedule)
    : emptyScheduleRule()
  templateScheduleDayTab.value = (templateForm.schedule.weekdays[0] as GrabInterviewWeekday) || 1
  templateFormVisible.value = true
}

function saveTemplate() {
  if (!templateForm.name.trim()) {
    ElMessage.warning('请填写模板名称')
    return
  }
  if (!templateForm.profile.positionName?.trim()) {
    ElMessage.warning('请填写岗位名称')
    return
  }
  if (templateForm.includeSchedule) {
    if (!validateSchedule(templateForm.schedule, '模板面试规则')) return
  }
  store.upsertGrabInterviewPositionTemplate(resolvedEnterpriseId.value, {
    id: templateForm.id || generateId('gitpl'),
    name: templateForm.name.trim(),
    profile: JSON.parse(JSON.stringify(templateForm.profile)),
    schedule: templateForm.includeSchedule
      ? JSON.parse(JSON.stringify(templateForm.schedule))
      : undefined,
  })
  ElMessage.success(templateForm.id ? '模板已更新' : '模板已创建')
  templateFormVisible.value = false
}

async function removeTemplate(tpl: GrabInterviewPositionTemplate) {
  try {
    await ElMessageBox.confirm(`确定删除模板「${tpl.name}」？`, '提示', { type: 'warning' })
    store.removeGrabInterviewPositionTemplate(resolvedEnterpriseId.value, tpl.id)
    ElMessage.success('已删除')
  } catch {
    /* cancel */
  }
}

/* 模板表单内简易时段编辑（复用同一套逻辑结构） */
function tplSlotsOfDay(day: GrabInterviewWeekday) {
  if (!templateForm.schedule.dayTimeSlots) templateForm.schedule.dayTimeSlots = {}
  if (!templateForm.schedule.dayTimeSlots[day]) templateForm.schedule.dayTimeSlots[day] = []
  return templateForm.schedule.dayTimeSlots[day]!
}

function onTplScheduleModeChange(mode: string | number | boolean) {
  const schedule = templateForm.schedule
  const next = (mode === 'by_day' ? 'by_day' : 'unified') as GrabInterviewScheduleMode
  schedule.scheduleMode = next
  if (next === 'by_day') {
    if (!schedule.dayTimeSlots) schedule.dayTimeSlots = {}
    schedule.weekdays.forEach((d) => {
      if (!schedule.dayTimeSlots![d]?.length) {
        schedule.dayTimeSlots![d] = [{ id: generateId('slot'), start: '09:00', end: '10:00' }]
      }
    })
  }
}

function addTplTimeSlot(day?: GrabInterviewWeekday) {
  const slot: GrabInterviewTimeSlot = { id: generateId('slot'), start: '14:00', end: '15:00' }
  if (templateForm.schedule.scheduleMode === 'by_day' && day != null) {
    tplSlotsOfDay(day).push(slot)
  } else {
    templateForm.schedule.timeSlots.push(slot)
  }
}

function removeTplTimeSlot(idx: number, day?: GrabInterviewWeekday) {
  if (templateForm.schedule.scheduleMode === 'by_day' && day != null) {
    const list = tplSlotsOfDay(day)
    if (list.length <= 1) return
    list.splice(idx, 1)
    return
  }
  if (templateForm.schedule.timeSlots.length <= 1) return
  templateForm.schedule.timeSlots.splice(idx, 1)
}

/* —— 报名管理 —— */
const regKeyword = ref('')
const regStatusFilter = ref<GrabInterviewRegStatus | ''>('')
const regDeptFilter = ref('')

const registrations = computed(() => {
  const kw = regKeyword.value.trim().toLowerCase()
  return store.grabInterviewRegistrations
    .filter((r) => r.enterpriseId === resolvedEnterpriseId.value)
    .filter((r) => (regStatusFilter.value ? r.status === regStatusFilter.value : true))
    .filter((r) => (regDeptFilter.value ? r.departmentId === regDeptFilter.value : true))
    .filter((r) => {
      if (!kw) return true
      return (
        r.name.toLowerCase().includes(kw) ||
        r.phone.includes(kw) ||
        r.position.toLowerCase().includes(kw)
      )
    })
    .map((r) => ({
      ...r,
      departmentName: getDepartmentName(
        store.getDepartmentsByEnterprise(resolvedEnterpriseId.value),
        r.departmentId,
      ),
    }))
})

const timeDialogVisible = ref(false)
const feedbackDialogVisible = ref(false)
const editingReg = ref<GrabInterviewRegistration | null>(null)
const timeForm = reactive({
  interviewDate: '',
  timeSlotId: '',
  timeSlotLabel: '',
  interviewExactTime: '',
})
const feedbackForm = reactive({
  result: 'passed' as 'passed' | 'failed',
  failReason: '',
})

function openChangeTime(row: GrabInterviewRegistration) {
  editingReg.value = row
  timeForm.interviewDate = row.interviewDate
  timeForm.timeSlotId = row.timeSlotId ?? ''
  timeForm.timeSlotLabel = row.timeSlotLabel
  timeForm.interviewExactTime = row.interviewExactTime ?? ''
  timeDialogVisible.value = true
}

const editingDeptRule = computed(() => {
  if (!editingReg.value) return null
  const raw = config.value.deptRules.find(
    (r) => r.departmentId === editingReg.value!.departmentId,
  )
  return raw ? normalizeDeptInterviewRule(raw) : null
})

const editingPosition = computed(() => {
  if (!editingReg.value || !editingDeptRule.value) return null
  return findDeptPosition(editingDeptRule.value, editingReg.value.position) ?? null
})

const editingResolvedSchedule = computed(() => {
  if (!editingDeptRule.value) return emptyScheduleRule()
  return resolvePositionSchedule(editingDeptRule.value, editingPosition.value)
})

const editingRuleSlots = computed((): GrabInterviewTimeSlot[] => {
  if (!editingReg.value || !timeForm.interviewDate) return []
  return resolveInterviewSlotsForSchedule(
    editingResolvedSchedule.value,
    weekdayFromDate(timeForm.interviewDate),
  )
})

const exactTimeOptions = computed(() => {
  const slot =
    editingRuleSlots.value.find((s) => s.id === timeForm.timeSlotId) ??
    editingRuleSlots.value[0]
  if (!slot) return []
  const unit = (editingResolvedSchedule.value.seatUnitMinutes ?? 30) as GrabInterviewSeatUnitMinutes
  return buildExactInterviewTimes(slot, unit)
})

watch(
  () => timeForm.interviewDate,
  () => {
    if (!timeDialogVisible.value) return
    if (
      timeForm.timeSlotId &&
      !editingRuleSlots.value.some((s) => s.id === timeForm.timeSlotId)
    ) {
      timeForm.timeSlotId = editingRuleSlots.value[0]?.id ?? ''
      const first = editingRuleSlots.value[0]
      timeForm.timeSlotLabel = first ? `${first.start}-${first.end}` : ''
      timeForm.interviewExactTime = ''
    }
  },
)

watch(exactTimeOptions, (opts) => {
  if (!timeDialogVisible.value) return
  if (opts.length && !opts.includes(timeForm.interviewExactTime)) {
    timeForm.interviewExactTime = opts[0]
  }
})

function onPickSlot(slotId: string) {
  const slot = editingRuleSlots.value.find((s) => s.id === slotId)
  if (slot) {
    timeForm.timeSlotLabel = `${slot.start}-${slot.end}`
    const unit = (editingResolvedSchedule.value.seatUnitMinutes ?? 30) as GrabInterviewSeatUnitMinutes
    const opts = buildExactInterviewTimes(slot, unit)
    timeForm.interviewExactTime = opts[0] ?? slot.start
  }
}

function saveInterviewTime() {
  if (!editingReg.value) return
  if (!timeForm.interviewDate || !timeForm.timeSlotLabel) {
    ElMessage.warning('请选择面试日期与时段窗口')
    return
  }
  if (!timeForm.interviewExactTime) {
    ElMessage.warning('请选择准确面试时间')
    return
  }
  store.updateGrabInterviewRegistration(editingReg.value.id, {
    interviewDate: timeForm.interviewDate,
    timeSlotId: timeForm.timeSlotId || undefined,
    timeSlotLabel: timeForm.timeSlotLabel,
    interviewExactTime: timeForm.interviewExactTime,
    weekday: weekdayFromDate(timeForm.interviewDate),
  })
  ElMessage.success('面试时间已更新')
  timeDialogVisible.value = false
}

function openFeedback(row: GrabInterviewRegistration) {
  if (row.status !== 'pending') {
    ElMessage.warning('仅待面试可反馈')
    return
  }
  editingReg.value = row
  feedbackForm.result = 'passed'
  feedbackForm.failReason = ''
  feedbackDialogVisible.value = true
}

function submitFeedback() {
  if (!editingReg.value) return
  try {
    store.submitGrabInterviewFeedback(
      editingReg.value.id,
      feedbackForm.result,
      feedbackForm.failReason,
    )
    ElMessage.success(
      feedbackForm.result === 'passed' ? '已通过并进入部门人员池' : '已标记为未通过',
    )
    feedbackDialogVisible.value = false
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '提交失败')
  }
}

function markNoShow(row: GrabInterviewRegistration) {
  if (row.status !== 'pending') return
  store.updateGrabInterviewRegistration(row.id, { status: 'no_show_cancelled' })
  ElMessage.success('已标记为未到面/取消面试')
}

function configuredPositionCount(departmentId: string) {
  const rule = config.value.deptRules.find((r) => r.departmentId === departmentId)
  if (!rule) return 0
  return normalizeDeptInterviewRule(rule).positions.length
}
</script>

<template>
  <div class="interview-page">
    <header class="page-card page-header">
      <div>
        <h2 class="page-title">抢班面试管理</h2>
        <p class="text-muted">
          按部门配置多岗位与面试规则，管理报名与反馈 · {{ currentEnterprise?.name ?? '—' }}
        </p>
      </div>
      <EnterpriseScopeSelect
        v-if="showEnterpriseControl && !isEnterprisePortal"
        v-model="enterpriseFilter"
        mode="switch"
        width="200px"
      />
    </header>

    <el-tabs v-model="activeTab" class="page-card tabs-card">
      <el-tab-pane label="面试配置" name="config">
        <div class="config-top">
          <div class="switch-row">
            <span class="switch-label">抢班是否需要面试</span>
            <el-switch v-model="requireInterview" active-text="需要" inactive-text="不需要" />
            <el-button class="tpl-btn" @click="openTemplateLibrary">岗位模板库</el-button>
          </div>
          <p class="text-muted tip">
            每个部门可配置多个岗位；岗位可套用模板，面试规则可按岗位独立配置，或应用全部门统一规则。
          </p>
        </div>

        <div class="config-layout" :class="{ disabled: !requireInterview }">
          <div class="dept-list">
            <div class="list-title">选择部门</div>
            <button
              v-for="d in scopedDepartments"
              :key="d.id"
              type="button"
              class="dept-item"
              :class="{ active: selectedDeptId === d.id }"
              @click="selectedDeptId = d.id"
            >
              <span>{{ d.name }}</span>
              <el-tag
                v-if="configuredPositionCount(d.id)"
                size="small"
                type="success"
              >
                {{ configuredPositionCount(d.id) }} 岗
              </el-tag>
            </button>
            <el-empty v-if="!scopedDepartments.length" description="暂无部门" :image-size="56" />
          </div>

          <div v-if="selectedDeptId" class="rule-form">
            <div class="rule-head">
              <h3>
                {{
                  getDepartmentName(
                    store.getDepartmentsByEnterprise(resolvedEnterpriseId),
                    selectedDeptId,
                  )
                }}
                · 面试配置
              </h3>
              <div class="rule-actions">
                <el-button @click="clearDeptRule">清除配置</el-button>
                <el-button type="primary" @click="saveDeptRule">保存配置</el-button>
              </div>
            </div>

            <!-- 部门统一规则 -->
            <section class="section-block">
              <div class="section-head">
                <h4>部门统一面试规则</h4>
                <el-button
                  size="small"
                  :type="scheduleEditTarget === 'department' ? 'primary' : 'default'"
                  @click="scheduleEditTarget = 'department'; syncActiveDayTab()"
                >
                  编辑时段
                </el-button>
              </div>
              <p class="text-muted section-desc">
                岗位选择「应用全部门」时使用此规则。预览：{{ departmentSchedulePreview }}
              </p>
              <div v-if="scheduleEditTarget === 'department'" class="schedule-editor">
                <el-form label-width="100px">
                  <el-form-item label="配置方式" required>
                    <el-radio-group
                      v-model="editingSchedule.scheduleMode"
                      @change="onScheduleModeChange"
                    >
                      <el-radio
                        v-for="opt in grabInterviewScheduleModeOptions"
                        :key="opt.value"
                        :value="opt.value"
                      >
                        {{ opt.label }}
                      </el-radio>
                    </el-radio-group>
                  </el-form-item>
                  <el-form-item label="星期" required>
                    <el-checkbox-group
                      v-model="editingSchedule.weekdays"
                      @change="onWeekdaysChange"
                    >
                      <el-checkbox
                        v-for="opt in grabInterviewWeekdayOptions"
                        :key="opt.value"
                        :label="opt.value"
                        :value="opt.value"
                      >
                        {{ opt.label }}
                      </el-checkbox>
                    </el-checkbox-group>
                  </el-form-item>
                  <el-form-item
                    v-if="(editingSchedule.scheduleMode ?? 'unified') === 'unified'"
                    label="时间段"
                    required
                  >
                    <div class="slots">
                      <div
                        v-for="(slot, idx) in editingSchedule.timeSlots"
                        :key="slot.id"
                        class="slot-row"
                      >
                        <el-time-select
                          v-model="slot.start"
                          start="06:00"
                          step="00:30"
                          end="22:00"
                          placeholder="开始"
                        />
                        <span class="range-sep">—</span>
                        <el-time-select
                          v-model="slot.end"
                          start="06:00"
                          step="00:30"
                          end="23:00"
                          placeholder="结束"
                        />
                        <el-button link type="danger" @click="removeTimeSlot(idx)">删除</el-button>
                      </div>
                      <el-button @click="addTimeSlot()">+ 添加时间段</el-button>
                    </div>
                  </el-form-item>
                  <el-form-item v-else label="按日时段" required>
                    <div class="day-slots">
                      <el-radio-group v-model="activeDayTab" size="small" class="day-tabs">
                        <el-radio-button
                          v-for="d in editingSchedule.weekdays"
                          :key="d"
                          :value="d"
                        >
                          {{ grabInterviewWeekdayMap[d] }}
                        </el-radio-button>
                      </el-radio-group>
                      <div v-if="editingSchedule.weekdays.includes(activeDayTab)" class="slots">
                        <div
                          v-for="(slot, idx) in slotsOfDay(activeDayTab)"
                          :key="slot.id"
                          class="slot-row"
                        >
                          <el-time-select
                            v-model="slot.start"
                            start="06:00"
                            step="00:30"
                            end="22:00"
                            placeholder="开始"
                          />
                          <span class="range-sep">—</span>
                          <el-time-select
                            v-model="slot.end"
                            start="06:00"
                            step="00:30"
                            end="23:00"
                            placeholder="结束"
                          />
                          <el-button
                            link
                            type="danger"
                            @click="removeTimeSlot(idx, activeDayTab)"
                          >
                            删除
                          </el-button>
                        </div>
                        <el-button @click="addTimeSlot(activeDayTab)">+ 添加时间段</el-button>
                      </div>
                    </div>
                  </el-form-item>
                  <el-form-item label="席位规则" required>
                    <div class="seat-row">
                      <el-select v-model="editingSchedule.seatUnitMinutes" style="width: 140px">
                        <el-option
                          v-for="opt in grabInterviewSeatUnitOptions"
                          :key="opt.value"
                          :label="opt.label"
                          :value="opt.value"
                        />
                      </el-select>
                      <span>可面试</span>
                      <el-input-number
                        v-model="editingSchedule.seatsPerUnit"
                        :min="1"
                        :max="50"
                        controls-position="right"
                      />
                      <span>人</span>
                    </div>
                  </el-form-item>
                </el-form>
              </div>
            </section>

            <!-- 岗位列表 -->
            <section class="section-block">
              <div class="section-head">
                <h4>岗位配置（{{ ruleForm.positions.length }}）</h4>
                <el-button type="primary" size="small" @click="addPosition">+ 添加岗位</el-button>
              </div>

              <div v-if="ruleForm.positions.length" class="pos-layout">
                <div class="pos-list">
                  <button
                    v-for="p in ruleForm.positions"
                    :key="p.id"
                    type="button"
                    class="pos-item"
                    :class="{ active: selectedPositionId === p.id }"
                    @click="selectedPositionId = p.id"
                  >
                    <span class="pos-name">{{ p.profile.positionName || '未命名岗位' }}</span>
                    <el-tag size="small" :type="p.ruleScope === 'department' ? 'info' : 'warning'">
                      {{ p.ruleScope === 'department' ? '全部门' : '独立规则' }}
                    </el-tag>
                  </button>
                </div>

                <div v-if="activePosition" class="pos-detail">
                  <div class="pos-detail-head">
                    <el-select
                      :model-value="activePosition.templateId || ''"
                      clearable
                      placeholder="从模板填充"
                      style="width: 220px"
                      @change="(v: string) => v && applyTemplateToPosition(v)"
                      @clear="activePosition.templateId = null"
                    >
                      <el-option
                        v-for="t in positionTemplates"
                        :key="t.id"
                        :label="t.name"
                        :value="t.id"
                      />
                    </el-select>
                    <el-button link type="danger" @click="removePosition(activePosition)">
                      删除岗位
                    </el-button>
                  </div>

                  <el-form label-width="100px" class="rule-fields">
                    <el-divider content-position="left">岗位要求</el-divider>
                    <el-form-item label="岗位名称" required>
                      <el-select
                        v-model="activePosition.profile.positionName"
                        filterable
                        allow-create
                        placeholder="选择或输入岗位"
                        style="width: 280px"
                      >
                        <el-option
                          v-for="p in grabShiftPositionOptions"
                          :key="p"
                          :label="p"
                          :value="p"
                        />
                      </el-select>
                    </el-form-item>
                    <el-form-item label="岗位类型">
                      <el-select
                        v-model="activePosition.profile.jobType"
                        clearable
                        placeholder="选择类型"
                        style="width: 200px"
                      >
                        <el-option
                          v-for="t in JOB_TYPE_OPTIONS"
                          :key="t"
                          :label="t"
                          :value="t"
                        />
                      </el-select>
                    </el-form-item>
                    <el-form-item label="技能要求">
                      <el-checkbox-group v-model="activePosition.profile.skills">
                        <el-checkbox
                          v-for="s in SKILL_OPTIONS"
                          :key="s"
                          :label="s"
                          :value="s"
                        >
                          {{ s }}
                        </el-checkbox>
                      </el-checkbox-group>
                    </el-form-item>
                    <el-form-item label="年龄">
                      <el-input-number
                        v-model="activePosition.profile.ageMin"
                        :min="16"
                        :max="70"
                        controls-position="right"
                      />
                      <span class="range-sep">—</span>
                      <el-input-number
                        v-model="activePosition.profile.ageMax"
                        :min="16"
                        :max="70"
                        controls-position="right"
                      />
                    </el-form-item>
                    <el-form-item label="性别">
                      <el-radio-group v-model="activePosition.profile.gender">
                        <el-radio value="any">不限</el-radio>
                        <el-radio value="male">男</el-radio>
                        <el-radio value="female">女</el-radio>
                      </el-radio-group>
                    </el-form-item>
                    <el-form-item label="经验要求">
                      <el-input
                        v-model="activePosition.profile.experience"
                        placeholder="如：不限 / 1年以上"
                        style="width: 280px"
                      />
                    </el-form-item>
                    <el-form-item label="岗位描述">
                      <el-input
                        v-model="activePosition.profile.description"
                        type="textarea"
                        :rows="2"
                        maxlength="300"
                        show-word-limit
                      />
                    </el-form-item>
                    <el-form-item label="任职要求">
                      <el-input
                        v-model="activePosition.profile.requirements"
                        type="textarea"
                        :rows="2"
                        maxlength="500"
                        show-word-limit
                      />
                    </el-form-item>

                    <el-divider content-position="left">面试规则</el-divider>
                    <el-form-item label="规则来源" required>
                      <el-radio-group
                        :model-value="activePosition.ruleScope"
                        @change="(v: string | number | boolean | undefined) => onRuleScopeChange(v === 'department' ? 'department' : 'position')"
                      >
                        <el-radio value="position">配置本岗位面试规则</el-radio>
                        <el-radio value="department">应用全部门面试规则</el-radio>
                      </el-radio-group>
                    </el-form-item>

                    <template v-if="activePosition.ruleScope === 'position'">
                      <el-form-item>
                        <el-button
                          size="small"
                          :type="scheduleEditTarget === 'position' ? 'primary' : 'default'"
                          @click="scheduleEditTarget = 'position'; syncActiveDayTab()"
                        >
                          编辑本岗位时段
                        </el-button>
                      </el-form-item>
                      <div v-if="scheduleEditTarget === 'position'" class="schedule-editor nested">
                        <el-form-item label="配置方式" required>
                          <el-radio-group
                            v-model="editingSchedule.scheduleMode"
                            @change="onScheduleModeChange"
                          >
                            <el-radio
                              v-for="opt in grabInterviewScheduleModeOptions"
                              :key="opt.value"
                              :value="opt.value"
                            >
                              {{ opt.label }}
                            </el-radio>
                          </el-radio-group>
                        </el-form-item>
                        <el-form-item label="星期" required>
                          <el-checkbox-group
                            v-model="editingSchedule.weekdays"
                            @change="onWeekdaysChange"
                          >
                            <el-checkbox
                              v-for="opt in grabInterviewWeekdayOptions"
                              :key="opt.value"
                              :label="opt.value"
                              :value="opt.value"
                            >
                              {{ opt.label }}
                            </el-checkbox>
                          </el-checkbox-group>
                        </el-form-item>
                        <el-form-item
                          v-if="(editingSchedule.scheduleMode ?? 'unified') === 'unified'"
                          label="时间段"
                          required
                        >
                          <div class="slots">
                            <div
                              v-for="(slot, idx) in editingSchedule.timeSlots"
                              :key="slot.id"
                              class="slot-row"
                            >
                              <el-time-select
                                v-model="slot.start"
                                start="06:00"
                                step="00:30"
                                end="22:00"
                                placeholder="开始"
                              />
                              <span class="range-sep">—</span>
                              <el-time-select
                                v-model="slot.end"
                                start="06:00"
                                step="00:30"
                                end="23:00"
                                placeholder="结束"
                              />
                              <el-button link type="danger" @click="removeTimeSlot(idx)">
                                删除
                              </el-button>
                            </div>
                            <el-button @click="addTimeSlot()">+ 添加时间段</el-button>
                          </div>
                        </el-form-item>
                        <el-form-item v-else label="按日时段" required>
                          <div class="day-slots">
                            <el-radio-group v-model="activeDayTab" size="small" class="day-tabs">
                              <el-radio-button
                                v-for="d in editingSchedule.weekdays"
                                :key="d"
                                :value="d"
                              >
                                {{ grabInterviewWeekdayMap[d] }}
                              </el-radio-button>
                            </el-radio-group>
                            <div
                              v-if="editingSchedule.weekdays.includes(activeDayTab)"
                              class="slots"
                            >
                              <div
                                v-for="(slot, idx) in slotsOfDay(activeDayTab)"
                                :key="slot.id"
                                class="slot-row"
                              >
                                <el-time-select
                                  v-model="slot.start"
                                  start="06:00"
                                  step="00:30"
                                  end="22:00"
                                  placeholder="开始"
                                />
                                <span class="range-sep">—</span>
                                <el-time-select
                                  v-model="slot.end"
                                  start="06:00"
                                  step="00:30"
                                  end="23:00"
                                  placeholder="结束"
                                />
                                <el-button
                                  link
                                  type="danger"
                                  @click="removeTimeSlot(idx, activeDayTab)"
                                >
                                  删除
                                </el-button>
                              </div>
                              <el-button @click="addTimeSlot(activeDayTab)">+ 添加时间段</el-button>
                            </div>
                          </div>
                        </el-form-item>
                        <el-form-item label="席位规则" required>
                          <div class="seat-row">
                            <el-select
                              v-model="editingSchedule.seatUnitMinutes"
                              style="width: 140px"
                            >
                              <el-option
                                v-for="opt in grabInterviewSeatUnitOptions"
                                :key="opt.value"
                                :label="opt.label"
                                :value="opt.value"
                              />
                            </el-select>
                            <span>可面试</span>
                            <el-input-number
                              v-model="editingSchedule.seatsPerUnit"
                              :min="1"
                              :max="50"
                              controls-position="right"
                            />
                            <span>人</span>
                          </div>
                        </el-form-item>
                      </div>
                    </template>
                    <p v-else class="preview text-muted">
                      本岗位将使用部门统一面试规则。
                    </p>
                    <p class="preview text-muted">预览：{{ positionSchedulePreview }}</p>
                  </el-form>
                </div>
              </div>
              <el-empty v-else description="暂无岗位，请点击「添加岗位」" :image-size="64" />
            </section>
          </div>
        </div>
      </el-tab-pane>

      <el-tab-pane label="面试报名管理" name="regs">
        <div class="reg-toolbar">
          <el-input
            v-model="regKeyword"
            clearable
            placeholder="搜索姓名/手机号/岗位"
            style="width: 220px"
          />
          <el-select v-model="regDeptFilter" clearable placeholder="部门" style="width: 160px">
            <el-option
              v-for="d in scopedDepartments"
              :key="d.id"
              :label="d.name"
              :value="d.id"
            />
          </el-select>
          <el-select v-model="regStatusFilter" clearable placeholder="状态" style="width: 160px">
            <el-option
              v-for="(meta, key) in grabInterviewRegStatusMap"
              :key="key"
              :label="meta.label"
              :value="key"
            />
          </el-select>
        </div>

        <el-table :data="registrations" border stripe>
          <el-table-column prop="name" label="姓名" width="100" />
          <el-table-column prop="phone" label="手机号" width="130" />
          <el-table-column prop="departmentName" label="部门" min-width="120" show-overflow-tooltip />
          <el-table-column prop="position" label="岗位" min-width="110" show-overflow-tooltip />
          <el-table-column label="报名时间" width="160">
            <template #default="{ row }">
              {{ formatRegistrationTime(row.createdAt) }}
            </template>
          </el-table-column>
          <el-table-column label="面试时间" min-width="220">
            <template #default="{ row }">
              {{ formatInterviewScheduleDisplay(row) }}
            </template>
          </el-table-column>
          <el-table-column label="状态" width="130">
            <template #default="{ row }">
              <el-tag
                size="small"
                :type="grabInterviewRegStatusMap[row.status as GrabInterviewRegStatus].type"
              >
                {{ grabInterviewRegStatusMap[row.status as GrabInterviewRegStatus].label }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="280" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="openChangeTime(row)">配置面试时间</el-button>
              <el-button
                link
                type="success"
                :disabled="row.status !== 'pending'"
                @click="openFeedback(row)"
              >
                面试反馈
              </el-button>
              <el-button
                link
                type="info"
                :disabled="row.status !== 'pending'"
                @click="markNoShow(row)"
              >
                未到面/取消
              </el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!registrations.length" description="暂无报名记录" />
      </el-tab-pane>
    </el-tabs>

    <!-- 模板库 -->
    <el-dialog v-model="templateDialogVisible" title="岗位模板库" width="720px" destroy-on-close>
      <div class="tpl-toolbar">
        <el-button type="primary" @click="openCreateTemplate">新建模板</el-button>
      </div>
      <el-table :data="positionTemplates" border>
        <el-table-column prop="name" label="模板名称" min-width="140" />
        <el-table-column label="岗位" min-width="120">
          <template #default="{ row }">{{ row.profile.positionName }}</template>
        </el-table-column>
        <el-table-column label="类型" width="100">
          <template #default="{ row }">{{ row.profile.jobType || '—' }}</template>
        </el-table-column>
        <el-table-column label="默认面试规则" width="120">
          <template #default="{ row }">
            <el-tag size="small" :type="row.schedule ? 'success' : 'info'">
              {{ row.schedule ? '含规则' : '仅岗位' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEditTemplate(row)">编辑</el-button>
            <el-button link type="danger" @click="removeTemplate(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!positionTemplates.length" description="暂无模板，可新建后应用到各部门岗位" />
    </el-dialog>

    <el-dialog
      v-model="templateFormVisible"
      :title="templateForm.id ? '编辑岗位模板' : '新建岗位模板'"
      width="640px"
      destroy-on-close
      append-to-body
    >
      <el-form label-width="100px">
        <el-form-item label="模板名称" required>
          <el-input v-model="templateForm.name" placeholder="如：加油站营业员模板" />
        </el-form-item>
        <el-form-item label="岗位名称" required>
          <el-select
            v-model="templateForm.profile.positionName"
            filterable
            allow-create
            placeholder="选择或输入岗位"
            style="width: 100%"
          >
            <el-option v-for="p in grabShiftPositionOptions" :key="p" :label="p" :value="p" />
          </el-select>
        </el-form-item>
        <el-form-item label="岗位类型">
          <el-select v-model="templateForm.profile.jobType" clearable style="width: 200px">
            <el-option v-for="t in JOB_TYPE_OPTIONS" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
        <el-form-item label="技能要求">
          <el-checkbox-group v-model="templateForm.profile.skills">
            <el-checkbox v-for="s in SKILL_OPTIONS" :key="s" :label="s" :value="s">
              {{ s }}
            </el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="任职要求">
          <el-input v-model="templateForm.profile.requirements" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="岗位描述">
          <el-input v-model="templateForm.profile.description" type="textarea" :rows="2" />
        </el-form-item>
        <el-form-item label="附带面试规则">
          <el-switch v-model="templateForm.includeSchedule" />
          <span class="field-tip text-muted">开启后，应用到岗位时可一并填充独立面试规则</span>
        </el-form-item>
        <template v-if="templateForm.includeSchedule">
          <el-form-item label="配置方式">
            <el-radio-group
              v-model="templateForm.schedule.scheduleMode"
              @change="onTplScheduleModeChange"
            >
              <el-radio
                v-for="opt in grabInterviewScheduleModeOptions"
                :key="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </el-radio>
            </el-radio-group>
          </el-form-item>
          <el-form-item label="星期">
            <el-checkbox-group v-model="templateForm.schedule.weekdays">
              <el-checkbox
                v-for="opt in grabInterviewWeekdayOptions"
                :key="opt.value"
                :label="opt.value"
                :value="opt.value"
              >
                {{ opt.label }}
              </el-checkbox>
            </el-checkbox-group>
          </el-form-item>
          <el-form-item
            v-if="(templateForm.schedule.scheduleMode ?? 'unified') === 'unified'"
            label="时间段"
          >
            <div class="slots">
              <div
                v-for="(slot, idx) in templateForm.schedule.timeSlots"
                :key="slot.id"
                class="slot-row"
              >
                <el-time-select
                  v-model="slot.start"
                  start="06:00"
                  step="00:30"
                  end="22:00"
                />
                <span class="range-sep">—</span>
                <el-time-select v-model="slot.end" start="06:00" step="00:30" end="23:00" />
                <el-button link type="danger" @click="removeTplTimeSlot(idx)">删除</el-button>
              </div>
              <el-button @click="addTplTimeSlot()">+ 添加</el-button>
            </div>
          </el-form-item>
          <el-form-item v-else label="按日时段">
            <el-radio-group v-model="templateScheduleDayTab" size="small">
              <el-radio-button
                v-for="d in templateForm.schedule.weekdays"
                :key="d"
                :value="d"
              >
                {{ grabInterviewWeekdayMap[d] }}
              </el-radio-button>
            </el-radio-group>
            <div class="slots" style="margin-top: 8px">
              <div
                v-for="(slot, idx) in tplSlotsOfDay(templateScheduleDayTab)"
                :key="slot.id"
                class="slot-row"
              >
                <el-time-select
                  v-model="slot.start"
                  start="06:00"
                  step="00:30"
                  end="22:00"
                />
                <span class="range-sep">—</span>
                <el-time-select v-model="slot.end" start="06:00" step="00:30" end="23:00" />
                <el-button
                  link
                  type="danger"
                  @click="removeTplTimeSlot(idx, templateScheduleDayTab)"
                >
                  删除
                </el-button>
              </div>
              <el-button @click="addTplTimeSlot(templateScheduleDayTab)">+ 添加</el-button>
            </div>
          </el-form-item>
          <el-form-item label="席位">
            <div class="seat-row">
              <el-select v-model="templateForm.schedule.seatUnitMinutes" style="width: 140px">
                <el-option
                  v-for="opt in grabInterviewSeatUnitOptions"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                />
              </el-select>
              <span>可面试</span>
              <el-input-number
                v-model="templateForm.schedule.seatsPerUnit"
                :min="1"
                :max="50"
                controls-position="right"
              />
              <span>人</span>
            </div>
          </el-form-item>
        </template>
      </el-form>
      <template #footer>
        <el-button @click="templateFormVisible = false">取消</el-button>
        <el-button type="primary" @click="saveTemplate">保存模板</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="timeDialogVisible" title="配置准确面试时间" width="480px" destroy-on-close>
      <el-form label-width="110px">
        <el-form-item label="面试日期" required>
          <el-date-picker
            v-model="timeForm.interviewDate"
            type="date"
            value-format="YYYY-MM-DD"
            style="width: 100%"
          />
        </el-form-item>
        <el-form-item label="时段窗口" required>
          <el-select
            v-if="editingRuleSlots.length"
            v-model="timeForm.timeSlotId"
            placeholder="选择时段窗口"
            style="width: 100%"
            @change="onPickSlot"
          >
            <el-option
              v-for="s in editingRuleSlots"
              :key="s.id"
              :label="`${s.start}-${s.end}`"
              :value="s.id"
            />
          </el-select>
          <el-input v-else v-model="timeForm.timeSlotLabel" placeholder="如 09:00-10:00" />
        </el-form-item>
        <el-form-item label="准确面试时间" required>
          <el-select
            v-if="exactTimeOptions.length"
            v-model="timeForm.interviewExactTime"
            placeholder="选择准确开始时间"
            style="width: 100%"
          >
            <el-option v-for="t in exactTimeOptions" :key="t" :label="t" :value="t" />
          </el-select>
          <el-time-select
            v-else
            v-model="timeForm.interviewExactTime"
            start="06:00"
            step="00:30"
            end="22:00"
            placeholder="选择准确时间"
            style="width: 100%"
          />
          <p class="field-tip text-muted">
            按岗位面试规则生成（{{
              formatSeatRuleLabel(
                (editingResolvedSchedule.seatUnitMinutes ?? 30) as GrabInterviewSeatUnitMinutes,
                editingResolvedSchedule.seatsPerUnit ?? 1,
              )
            }}{{
              editingPosition?.ruleScope === 'department'
                ? ' · 应用全部门'
                : editingPosition
                  ? ' · 岗位独立'
                  : ''
            }}）
          </p>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="timeDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveInterviewTime">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="feedbackDialogVisible" title="面试反馈" width="480px" destroy-on-close>
      <el-form label-width="100px">
        <el-form-item label="面试结果" required>
          <el-radio-group v-model="feedbackForm.result">
            <el-radio value="passed">面试通过（进入部门人员池）</el-radio>
            <el-radio value="failed">面试不通过</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="feedbackForm.result === 'failed'" label="未通过原因" required>
          <el-input
            v-model="feedbackForm.failReason"
            type="textarea"
            :rows="3"
            maxlength="200"
            show-word-limit
            placeholder="请填写未通过原因"
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="feedbackDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="submitFeedback">提交</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.interview-page {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
}

.page-title {
  margin: 0 0 4px;
  font-size: 20px;
}

.text-muted {
  color: var(--el-text-color-secondary);
  font-size: 13px;
  margin: 0;
}

.tabs-card {
  padding: 8px 16px 16px;
}

.config-top {
  margin-bottom: 16px;
}

.switch-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.switch-label {
  font-weight: 600;
  font-size: 14px;
}

.tpl-btn {
  margin-left: auto;
}

.tip {
  margin-top: 8px;
}

.config-layout {
  display: grid;
  grid-template-columns: 220px minmax(0, 1fr);
  gap: 16px;
  align-items: start;
}

.config-layout.disabled {
  opacity: 0.55;
  pointer-events: none;
}

.dept-list {
  border: 1px solid #e8edf5;
  border-radius: 10px;
  padding: 10px;
  max-height: 720px;
  overflow: auto;
}

.list-title {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 8px;
  color: #334155;
}

.dept-item {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  border: none;
  background: transparent;
  padding: 10px 8px;
  border-radius: 8px;
  cursor: pointer;
  text-align: left;
  font-size: 13px;
}

.dept-item:hover {
  background: #f8fafc;
}

.dept-item.active {
  background: #eff6ff;
  color: #2563eb;
  font-weight: 600;
}

.rule-form {
  border: 1px solid #e8edf5;
  border-radius: 10px;
  padding: 16px;
}

.rule-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
}

.rule-head h3 {
  margin: 0;
  font-size: 15px;
}

.rule-actions {
  display: flex;
  gap: 8px;
}

.section-block {
  margin-bottom: 20px;
  padding-bottom: 12px;
  border-bottom: 1px dashed #e8edf5;
}

.section-block:last-child {
  border-bottom: none;
  margin-bottom: 0;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 6px;
}

.section-head h4 {
  margin: 0;
  font-size: 14px;
}

.section-desc {
  margin-bottom: 10px;
}

.schedule-editor {
  background: #f8fafc;
  border-radius: 8px;
  padding: 12px 12px 4px;
}

.schedule-editor.nested {
  margin-top: 4px;
}

.pos-layout {
  display: grid;
  grid-template-columns: 180px minmax(0, 1fr);
  gap: 12px;
  margin-top: 8px;
}

.pos-list {
  border: 1px solid #e8edf5;
  border-radius: 8px;
  padding: 6px;
  max-height: 480px;
  overflow: auto;
}

.pos-item {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 4px;
  border: none;
  background: transparent;
  padding: 8px;
  border-radius: 6px;
  cursor: pointer;
  text-align: left;
  font-size: 13px;
}

.pos-item:hover {
  background: #f8fafc;
}

.pos-item.active {
  background: #eff6ff;
}

.pos-name {
  font-weight: 600;
  color: #1e293b;
}

.pos-detail {
  border: 1px solid #e8edf5;
  border-radius: 8px;
  padding: 12px;
}

.pos-detail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.range-sep {
  margin: 0 8px;
  color: #94a3b8;
}

.slots {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}

.day-slots {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
}

.day-tabs {
  flex-wrap: wrap;
}

.seat-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.field-tip {
  margin: 6px 0 0;
  line-height: 1.4;
}

.slot-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.preview {
  margin-top: 8px;
}

.reg-toolbar,
.tpl-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 12px;
}

@media (max-width: 960px) {
  .config-layout,
  .pos-layout {
    grid-template-columns: 1fr;
  }
}
</style>
