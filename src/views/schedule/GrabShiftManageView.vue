<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, UserFilled } from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'
import { useEnterpriseScope } from '@/composables/useEnterpriseScope'
import EnterpriseScopeSelect from '@/components/platform/EnterpriseScopeSelect.vue'
import {
  resolveEnterpriseIdByAttendanceGroup,
  resolveEnterpriseIdByAttendanceGroupId,
  resolveEnterpriseIdByDepartment,
} from '@/utils/enterpriseScope'
import {
  buildGrabShiftSlotPayload,
  calcGrabEnrollCap,
  calcGrabShiftEffectiveRate,
  calcGrabShiftSessionFee,
  calcGrabShiftWorkHours,
  getGrabShiftScopeOptions,
  getGrabShiftTemplateOptions,
  GRAB_SHIFT_GLOBAL_TEAM_ID,
  grabShiftPositionOptions,
  grabShiftPublishStatusMap,
  isGrabShiftPublished,
  isGrabShiftUrgent,
  parseBreakMinutes,
  resolveGrabShiftBaseHourlyRateDetail,
  resolveGrabSlotDepartmentId,
  resolveGrabSlotDepartmentName,
  resolveGrabSlotShiftName,
} from '@/services/grabShift'
import type { GrabShiftSlot } from '@/types'
import GrabShiftCalendar from '@/components/schedule/GrabShiftCalendar.vue'
import {
  CANCEL_SHIFT_REASON_OPTIONS,
  buildCancelShiftReasonText,
  isGrabSlotNotStarted,
  type CancelShiftReasonCode,
} from '@/constants/cancelShift'

const store = useAppStore()
const route = useRoute()
const router = useRouter()
const { enterpriseFilter, matchesEnterprise, enterpriseName, showEnterpriseControl } =
  useEnterpriseScope('filter')

const selectedGroupId = ref('ag_factory')
const listDeptFilter = ref<'all' | string>('all')
const listPositionFilter = ref<'all' | string>('all')
const activeTab = ref<'calendar' | 'slots' | 'publish' | 'approval'>('calendar')
const slotStatusFilter = ref<'all' | 'open' | 'partial' | 'full' | 'cancelled'>('all')
const publishVisible = ref(false)
const detailVisible = ref(false)
const reviewVisible = ref(false)
const whitelistVisible = ref(false)
const currentSlot = ref<GrabShiftSlot | null>(null)
const reviewNote = ref('')
const reviewForm = ref({
  breakMinutes: 0,
  enrollFloatMode: 'absolute' as 'absolute' | 'percent',
  enrollFloatValue: 0,
  wageBaseHourlyRate: 0,
  wageHourlySubsidy: 0,
  positionRequirement: '',
  requirementsText: '',
})
const whitelistForm = ref({ employeeId: '', remark: '' })
const cancelDialogVisible = ref(false)
const cancelSubmitting = ref(false)
const cancelForm = ref<{
  slotId: string
  scope: 'slot' | 'person'
  employeeId: string
  reasonCode: CancelShiftReasonCode
  reasonOther: string
}>({
  slotId: '',
  scope: 'slot',
  employeeId: '',
  reasonCode: 'business_change',
  reasonOther: '',
})
const cancelTargetSlot = computed(() =>
  store.grabShiftSlots.find((s) => s.id === cancelForm.value.slotId) ?? null,
)
const cancelPersonOptions = computed(() => {
  const slot = cancelTargetSlot.value
  if (!slot) return [] as { value: string; label: string }[]
  const ids = new Set<string>()
  store.grabShiftApplications.forEach((a) => {
    if (a.slotId === slot.id && (a.status === 'approved' || a.status === 'pending')) {
      ids.add(a.employeeId)
    }
  })
  store.assignments.forEach((a) => {
    if (a.fromGrabSlotId === slot.id) ids.add(a.employeeId)
  })
  return [...ids].map((id) => {
    const emp = store.employees.find((e) => e.id === id)
    return { value: id, label: emp ? `${emp.name}（${emp.phone || '无手机'}）` : id }
  })
})

function canCancelGrabSlot(slot: GrabShiftSlot) {
  return isGrabShiftPublished(slot) && slot.status !== 'cancelled' && isGrabSlotNotStarted(slot)
}

const groupList = computed(() =>
  store.attendanceGroups.filter((g) => {
    if (g.attendanceType !== 'shift') return false
    const enterpriseId = resolveEnterpriseIdByAttendanceGroup(g, store.departments)
    return matchesEnterprise(enterpriseId)
  }),
)

const selectedGroup = computed(() =>
  store.attendanceGroups.find((g) => g.id === selectedGroupId.value),
)

const scopeOptions = computed(() =>
  getGrabShiftScopeOptions(selectedGroup.value, store.departments),
)

const templateShiftOptions = computed(() =>
  getGrabShiftTemplateOptions(selectedGroup.value, store.shifts),
)

const publishShiftStartTime = computed(() => {
  if (publishForm.value.shiftMode === 'template') {
    return selectedTemplateOption.value?.startTime.slice(0, 5) ?? publishForm.value.startTime
  }
  return publishForm.value.startTime
})

const baseRateDetail = computed(() =>
  resolveGrabShiftBaseHourlyRateDetail(selectedGroup.value, {
    date: publishForm.value.date,
    startTime: publishShiftStartTime.value,
    holidays: store.holidays,
  }),
)

const baseHourlyRate = computed(() => baseRateDetail.value.rate)

const effectiveHourlyRate = computed(() =>
  calcGrabShiftEffectiveRate(baseHourlyRate.value, publishForm.value.hourlySubsidy),
)

const publishForm = ref({
  scopeKey: GRAB_SHIFT_GLOBAL_TEAM_ID,
  shiftMode: 'template' as 'template' | 'custom',
  shiftTemplateId: '',
  customShiftName: '自定义班次',
  startTime: '08:00',
  endTime: '16:00',
  hasBreakTime: true,
  breakRule: '',
  date: '2026-07-28',
  requiredCount: 1,
  enrollFloatMode: 'absolute' as 'absolute' | 'percent',
  enrollFloatValue: 0,
  hourlySubsidy: 0,
  positionName: '',
  positionRequirement: '',
  requirements: [] as string[],
})

const publishEnrollCap = computed(() =>
  calcGrabEnrollCap(
    publishForm.value.requiredCount,
    publishForm.value.enrollFloatMode,
    publishForm.value.enrollFloatValue,
  ),
)

const selectedTemplateOption = computed(() =>
  templateShiftOptions.value.find((t) => t.templateId === publishForm.value.shiftTemplateId),
)

watch(selectedTemplateOption, (tpl) => {
  if (!tpl || publishForm.value.shiftMode !== 'template') return
  publishForm.value.startTime = tpl.startTime.slice(0, 5)
  publishForm.value.endTime = tpl.endTime.slice(0, 5)
  publishForm.value.breakRule = tpl.breakRule ?? ''
  publishForm.value.hasBreakTime = Boolean(tpl.breakRule)
})

watch(
  templateShiftOptions,
  (options) => {
    if (!options.length) return
    if (!options.some((o) => o.templateId === publishForm.value.shiftTemplateId)) {
      publishForm.value.shiftTemplateId = options[0].templateId
    }
  },
  { immediate: true },
)

watch(
  scopeOptions,
  (options) => {
    if (!options.length) return
    if (!options.some((o) => o.value === publishForm.value.scopeKey)) {
      publishForm.value.scopeKey = options[0].value
    }
  },
  { immediate: true },
)

const skillOptions = ['普通话二级', '客服证', '夜班资质', '叉车证', '电工证', '中石化安全作业证', '加油操作证', '健康证']

const positionRequirementPresets = [
  '协助完成加油引导、车辆秩序维护及现场安全提示',
  '完成收银结算、非油产品推介与基础陈列整理',
  '配合站长完成高峰时段疏导与设备点检',
  '按规范完成交接班记录，维护作业区域整洁',
]

const grabStatusMap: Record<string, { label: string; type: 'success' | 'warning' | 'danger' | 'info' }> = {
  open: { label: '招募中', type: 'danger' },
  partial: { label: '部分满员', type: 'warning' },
  full: { label: '已满员', type: 'success' },
  cancelled: { label: '已取消', type: 'info' },
}

const departmentFilterOptions = computed(() => {
  const depts = store.departments.filter((d) => {
    if (d.orgType === 'enterprise') return false
    const enterpriseId = resolveEnterpriseIdByDepartment(d.id, store.departments)
    return matchesEnterprise(enterpriseId)
  })
  return [
    { value: 'all', label: '全部部门' },
    ...depts.map((d) => ({ value: d.id, label: d.name })),
  ]
})

const positionFilterOptions = computed(() => {
  const names = new Set<string>(grabShiftPositionOptions)
  store.grabShiftSlots.forEach((s) => {
    if (s.positionName?.trim()) names.add(s.positionName.trim())
  })
  return [
    { value: 'all', label: '全部岗位' },
    ...[...names].sort().map((name) => ({ value: name, label: name })),
  ]
})

function isGlobalGrabSlot(slot: GrabShiftSlot) {
  return slot.scope === 'global' || slot.teamId === GRAB_SHIFT_GLOBAL_TEAM_ID
}

function isShiftGroupSlot(slot: GrabShiftSlot) {
  const group = store.attendanceGroups.find((g) => g.id === slot.attendanceGroupId)
  return Boolean(group && group.attendanceType === 'shift')
}

function matchesListDeptFilter(slot: GrabShiftSlot) {
  if (listDeptFilter.value === 'all') return true
  const deptId = resolveGrabSlotDepartmentId(slot, store.teams)
  if (listDeptFilter.value === 'global') return isGlobalGrabSlot(slot) && !deptId
  return deptId === listDeptFilter.value
}

function matchesListPositionFilter(slot: GrabShiftSlot) {
  if (listPositionFilter.value === 'all') return true
  return (slot.positionName ?? '') === listPositionFilter.value
}

function resolveSlotDepartmentName(slot: GrabShiftSlot) {
  return resolveGrabSlotDepartmentName(slot, store.teams, store.departments)
}

function enrichSlotRow(slot: GrabShiftSlot) {
  const apps = store.grabShiftApplications.filter((a) => a.slotId === slot.id)
  const pendingApps = apps.filter((a) => a.status === 'pending').length
  const globalScope = isGlobalGrabSlot(slot)
  const enterpriseId = resolveEnterpriseIdByAttendanceGroupId(
    slot.attendanceGroupId,
    store.attendanceGroups,
    store.departments,
  )
  return {
    ...slot,
    enterpriseName: enterpriseName(enterpriseId),
    departmentDisplayName: resolveSlotDepartmentName(slot),
    groupName: resolveSlotDepartmentName(slot),
    displayShiftName: resolveGrabSlotShiftName(slot),
    scopeLabel: globalScope ? '全局' : slot.departmentName ?? slot.teamName,
    pendingApps,
    gap: Math.max(0, slot.requiredCount - slot.grabbedCount),
    urgent: isGrabShiftUrgent(slot),
    statusLabel: grabStatusMap[slot.status]?.label ?? slot.status,
    statusType: grabStatusMap[slot.status]?.type ?? 'info',
    publishStatus: slot.publishStatus ?? 'published',
    publishLabel: grabShiftPublishStatusMap[slot.publishStatus ?? 'published'].label,
    publishType: grabShiftPublishStatusMap[slot.publishStatus ?? 'published'].type,
  }
}

function matchesSlotBaseFilters(s: GrabShiftSlot) {
  if (!isShiftGroupSlot(s)) return false
  if (!matchesListDeptFilter(s)) return false
  if (!matchesListPositionFilter(s)) return false
  const enterpriseId = resolveEnterpriseIdByAttendanceGroupId(
    s.attendanceGroupId,
    store.attendanceGroups,
    store.departments,
  )
  return matchesEnterprise(enterpriseId)
}

/** 抢班班次列表（日历 / 抢班班次） */
const slotTableData = computed(() =>
  store.grabShiftSlots
    .filter((s) => matchesSlotBaseFilters(s))
    .filter((s) => slotStatusFilter.value === 'all' || s.status === slotStatusFilter.value)
    .map(enrichSlotRow)
    .sort((a, b) => b.date.localeCompare(a.date) || a.startTime.localeCompare(b.startTime)),
)

const pendingApplications = computed(() =>
  store.grabShiftApplications
    .filter((a) => a.status === 'pending')
    .filter((a) => {
      const slot = store.grabShiftSlots.find((s) => s.id === a.slotId)
      if (!slot) return false
      if (!isShiftGroupSlot(slot)) return false
      if (!matchesListDeptFilter(slot)) return false
      if (!matchesListPositionFilter(slot)) return false
      const enterpriseId = resolveEnterpriseIdByAttendanceGroupId(
        slot.attendanceGroupId,
        store.attendanceGroups,
        store.departments,
      )
      return matchesEnterprise(enterpriseId)
    })
    .map((app) => {
      const slot = store.grabShiftSlots.find((s) => s.id === app.slotId)
      const emp = store.employees.find((e) => e.id === app.employeeId)
      const enterpriseId = slot
        ? resolveEnterpriseIdByAttendanceGroupId(
            slot.attendanceGroupId,
            store.attendanceGroups,
            store.departments,
          )
        : undefined
      return {
        ...app,
        enterpriseName: enterpriseName(enterpriseId),
        employeeName: emp?.name ?? '—',
        phone: emp?.phone || '—',
        shiftName: slot ? resolveGrabSlotShiftName(slot) : '—',
        departmentDisplayName: slot ? resolveSlotDepartmentName(slot) : '—',
        positionName: slot?.positionName ?? '—',
        date: slot?.date ?? '—',
        teamName: slot?.teamName ?? '—',
        slotStatus: slot?.status ?? 'cancelled',
      }
    }),
)

const pendingCount = computed(() => pendingApplications.value.length)

const pendingPublishSlots = computed(() =>
  slotTableData.value.filter((s) => s.publishStatus === 'pending'),
)
const pendingPublishCount = computed(() => pendingPublishSlots.value.length)

const reviewEffectiveRate = computed(() => {
  const slot = currentSlot.value
  if (!slot) return 0
  return calcGrabShiftEffectiveRate(slot.baseHourlyRate ?? 0, slot.hourlySubsidy ?? 0)
})

const reviewWorkHours = computed(() => {
  const slot = currentSlot.value
  if (!slot) return 0
  return calcGrabShiftWorkHours(slot.startTime, slot.endTime, reviewForm.value.breakMinutes)
})

const reviewCustomerFee = computed(() => {
  const slot = currentSlot.value
  if (!slot) return 0
  return calcGrabShiftSessionFee(
    slot.baseHourlyRate ?? 0,
    slot.hourlySubsidy ?? 0,
    reviewWorkHours.value,
  )
})

const reviewWageHourly = computed(() =>
  calcGrabShiftEffectiveRate(
    reviewForm.value.wageBaseHourlyRate,
    reviewForm.value.wageHourlySubsidy,
  ),
)

const reviewWageFee = computed(() =>
  calcGrabShiftSessionFee(
    reviewForm.value.wageBaseHourlyRate,
    reviewForm.value.wageHourlySubsidy,
    reviewWorkHours.value,
  ),
)

const reviewEnrollCap = computed(() => {
  const slot = currentSlot.value
  if (!slot) return 0
  return calcGrabEnrollCap(
    slot.requiredCount,
    reviewForm.value.enrollFloatMode,
    reviewForm.value.enrollFloatValue,
  )
})

const whitelistTableData = computed(() =>
  store.grabShiftWhitelist
    .filter((w) => w.attendanceGroupId === selectedGroupId.value)
    .map((entry) => {
      const emp = store.employees.find((e) => e.id === entry.employeeId)
      return {
        ...entry,
        employeeName: emp?.name ?? '—',
        employeeNo: emp?.employeeNo ?? '—',
        position: emp?.position ?? '—',
      }
    }),
)

const whitelistCandidateOptions = computed(() =>
  store.employees
    .filter((e) => e.status === 'active')
    .filter(
      (e) =>
        !store.grabShiftWhitelist.some(
          (w) => w.employeeId === e.id && w.attendanceGroupId === selectedGroupId.value,
        ),
    )
    .map((e) => ({
      value: e.id,
      label: `${e.name}（${e.employeeNo}）`,
    })),
)

const slotApplications = computed(() => {
  if (!currentSlot.value) return []
  return store.grabShiftApplications
    .filter((a) => a.slotId === currentSlot.value!.id)
    .map((app) => ({
      ...app,
      employeeName: store.employees.find((e) => e.id === app.employeeId)?.name ?? '—',
      phone: store.employees.find((e) => e.id === app.employeeId)?.phone || '—',
      statusLabel:
        app.status === 'pending'
          ? '待审批'
          : app.status === 'approved'
            ? app.reviewNote === '白名单免审批'
              ? '已通过（白名单）'
              : '已通过'
            : app.status === 'cancelled'
              ? '已取消'
              : '已驳回',
    }))
})

function openPublish() {
  const firstTemplate = templateShiftOptions.value[0]
  publishForm.value = {
    scopeKey: scopeOptions.value[0]?.value ?? GRAB_SHIFT_GLOBAL_TEAM_ID,
    shiftMode: 'template',
    shiftTemplateId: firstTemplate?.templateId ?? '',
    customShiftName: '自定义班次',
    startTime: firstTemplate?.startTime.slice(0, 5) ?? '08:00',
    endTime: firstTemplate?.endTime.slice(0, 5) ?? '16:00',
    hasBreakTime: Boolean(firstTemplate?.breakRule),
    breakRule: firstTemplate?.breakRule ?? '',
    date: '2026-07-28',
    requiredCount: 1,
    enrollFloatMode: 'absolute',
    enrollFloatValue: 0,
    hourlySubsidy: 0,
    positionName: '加油站营业员',
    positionRequirement: positionRequirementPresets.join('\n'),
    requirements: ['中石化安全作业证'],
  }
  publishVisible.value = true
}

function submitPublish() {
  const group = selectedGroup.value
  const scopeOption = scopeOptions.value.find((o) => o.value === publishForm.value.scopeKey)
  if (!group || !scopeOption) {
    ElMessage.warning('请选择发布范围')
    return
  }
  if (publishForm.value.shiftMode === 'template' && !publishForm.value.shiftTemplateId) {
    ElMessage.warning('请选择考勤组班次')
    return
  }
  if (publishForm.value.shiftMode === 'custom') {
    if (!publishForm.value.customShiftName.trim()) {
      ElMessage.warning('请填写自定义班次名称')
      return
    }
    if (!publishForm.value.startTime || !publishForm.value.endTime) {
      ElMessage.warning('请填写班次起止时间')
      return
    }
  }
  if (!publishForm.value.positionName.trim()) {
    ElMessage.warning('请填写岗位名称')
    return
  }
  if (!publishForm.value.positionRequirement.trim()) {
    ElMessage.warning('请填写岗位要求')
    return
  }
  if (!publishForm.value.requirements.length) {
    ElMessage.warning('请至少选择一项技能要求')
    return
  }

  const template =
    publishForm.value.shiftMode === 'template'
      ? selectedTemplateOption.value
      : undefined

  store.createGrabShiftSlot(
    buildGrabShiftSlotPayload({
      group,
      scopeOption,
      shiftMode: publishForm.value.shiftMode,
      template,
      customShiftName: publishForm.value.customShiftName,
      startTime: publishShiftStartTime.value,
      endTime: publishForm.value.endTime,
      hasBreakTime: publishForm.value.hasBreakTime,
      breakRule: publishForm.value.breakRule,
      date: publishForm.value.date,
      requiredCount: publishForm.value.requiredCount,
      enrollFloatMode: publishForm.value.enrollFloatMode,
      enrollFloatValue: publishForm.value.enrollFloatValue,
      hourlySubsidy: publishForm.value.hourlySubsidy,
      positionName: publishForm.value.positionName,
      positionRequirement: publishForm.value.positionRequirement,
      requirements: publishForm.value.requirements,
      teams: store.teams,
      shifts: store.shifts,
      holidays: store.holidays,
    }),
  )
  publishVisible.value = false
  ElMessage.success('已提交发布审批，通过后将上架小程序')
}

function openWhitelist() {
  whitelistForm.value = { employeeId: whitelistCandidateOptions.value[0]?.value ?? '', remark: '' }
  whitelistVisible.value = true
}

function submitWhitelist() {
  if (!whitelistForm.value.employeeId) {
    ElMessage.warning('请选择人员')
    return
  }
  try {
    store.addGrabShiftWhitelistEntry({
      attendanceGroupId: selectedGroupId.value,
      employeeId: whitelistForm.value.employeeId,
      remark: whitelistForm.value.remark.trim() || undefined,
      createdBy: '排班员',
    })
    whitelistForm.value = { employeeId: '', remark: '' }
    ElMessage.success('已加入白名单，该人员抢班报名将免审批')
  } catch (e) {
    ElMessage.warning(e instanceof Error ? e.message : '添加失败')
  }
}

async function removeWhitelist(id: string, name: string) {
  await ElMessageBox.confirm(`确定将「${name}」移出白名单？移出后抢班需人工审批。`, '移出白名单', {
    type: 'warning',
  })
  store.removeGrabShiftWhitelistEntry(id)
  ElMessage.success('已移出白名单')
}

function openCancelSlot(id: string) {
  const slot = store.grabShiftSlots.find((s) => s.id === id)
  if (!slot) return
  if (!canCancelGrabSlot(slot)) {
    ElMessage.warning('仅未开始的已上架班次可取消')
    return
  }
  cancelForm.value = {
    slotId: id,
    scope: 'slot',
    employeeId: '',
    reasonCode: 'business_change',
    reasonOther: '',
  }
  cancelDialogVisible.value = true
}

async function submitGrabCancel() {
  try {
    const reason = buildCancelShiftReasonText(
      cancelForm.value.reasonCode,
      cancelForm.value.reasonOther,
    )
    if (cancelForm.value.scope === 'person' && !cancelForm.value.employeeId) {
      ElMessage.warning('请选择要取消的人员')
      return
    }
    cancelSubmitting.value = true
    store.cancelGrabShiftSlot(cancelForm.value.slotId, {
      scope: cancelForm.value.scope,
      employeeId: cancelForm.value.employeeId || undefined,
      reasonCode: cancelForm.value.reasonCode,
      reasonOther:
        cancelForm.value.reasonCode === 'other'
          ? cancelForm.value.reasonOther.trim()
          : undefined,
      reason,
      operatedBy: '排班管理员',
    })
    cancelDialogVisible.value = false
    ElMessage.success(
      cancelForm.value.scope === 'person'
        ? '已取消该人员抢班，需求名额已释放'
        : '班次已整班取消，相关抢班状态已更新',
    )
    if (currentSlot.value?.id === cancelForm.value.slotId) {
      currentSlot.value =
        store.grabShiftSlots.find((s) => s.id === cancelForm.value.slotId) ?? null
    }
  } catch (e) {
    ElMessage.warning(e instanceof Error ? e.message : '取消失败')
  } finally {
    cancelSubmitting.value = false
  }
}

function showSlotDetail(slot: GrabShiftSlot) {
  currentSlot.value = slot
  detailVisible.value = true
}

function openPublishReview(slot: GrabShiftSlot) {
  currentSlot.value = slot
  const breakMinutes =
    slot.breakMinutes ??
    parseBreakMinutes(slot.breakRule, slot.hasBreakTime)
  const customerBase = slot.baseHourlyRate ?? 0
  const customerSubsidy = slot.hourlySubsidy ?? 0
  reviewForm.value = {
    breakMinutes,
    enrollFloatMode: slot.enrollFloatMode ?? 'absolute',
    enrollFloatValue: slot.enrollFloatValue ?? 0,
    wageBaseHourlyRate: slot.wageBaseHourlyRate ?? customerBase,
    wageHourlySubsidy: slot.wageHourlySubsidy ?? customerSubsidy,
    positionRequirement: slot.positionRequirement ?? '',
    requirementsText: (slot.requirements ?? []).join('、'),
  }
  reviewNote.value = ''
  reviewVisible.value = true
}

function onCalendarSlotClick(slot: GrabShiftSlot) {
  if (slot.publishStatus === 'pending') {
    openPublishReview(slot)
    return
  }
  showSlotDetail(slot)
}

async function approvePublishSlot() {
  const slot = currentSlot.value
  if (!slot) return
  if (!reviewForm.value.positionRequirement.trim()) {
    ElMessage.warning('请填写岗位要求')
    return
  }
  if (reviewForm.value.wageBaseHourlyRate < 0 || reviewForm.value.wageHourlySubsidy < 0) {
    ElMessage.warning('薪资费用不能为负数')
    return
  }
  const requirements = reviewForm.value.requirementsText
    .split(/[,，、\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
  try {
    const { value } = await ElMessageBox.prompt(
      '审批意见（可选）',
      '通过并发布到抢班大厅',
      {
        inputValue: reviewNote.value || '符合规范，予以发布',
        inputPlaceholder: '请输入',
      },
    )
    store.reviewGrabShiftSlot(slot.id, true, String(value || '').trim(), '排班管理员', {
      breakMinutes: reviewForm.value.breakMinutes,
      workHours: reviewWorkHours.value,
      enrollFloatMode: reviewForm.value.enrollFloatMode,
      enrollFloatValue: reviewForm.value.enrollFloatValue,
      enrollCap: reviewEnrollCap.value,
      customerFee: reviewCustomerFee.value,
      wageBaseHourlyRate: reviewForm.value.wageBaseHourlyRate,
      wageHourlySubsidy: Math.max(0, reviewForm.value.wageHourlySubsidy),
      wageHourlyRate: reviewWageHourly.value,
      wageFee: reviewWageFee.value,
      positionRequirement: reviewForm.value.positionRequirement.trim(),
      requirements: requirements.length ? requirements : slot.requirements,
    })
    reviewVisible.value = false
    ElMessage.success('已发布到抢班大厅，灵工可报名')
  } catch {
    // cancelled
  }
}

async function rejectPublishSlot() {
  const slot = currentSlot.value
  if (!slot) return
  const note = reviewNote.value.trim()
  if (!note) {
    ElMessage.warning('驳回须填写原因')
    return
  }
  try {
    store.reviewGrabShiftSlot(slot.id, false, note, '排班管理员')
    reviewVisible.value = false
    ElMessage.success('已驳回该抢班班次')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '驳回失败')
  }
}

async function reviewApplication(id: string, approved: boolean) {
  try {
    const { value } = await ElMessageBox.prompt(
      approved ? '审批意见（可选）' : '驳回原因（必填）',
      approved ? '通过报名' : '驳回报名',
      {
        inputValue: approved ? '符合要求，予以通过' : '',
        inputPlaceholder: '请输入',
        inputValidator: (v) => {
          if (!approved && !v?.trim()) return '请填写驳回原因'
          return true
        },
      },
    )
    store.reviewGrabShiftApplication(id, approved, value)
    ElMessage.success(approved ? '已通过，排班表已更新' : '已驳回')
  } catch (e) {
    if (e instanceof Error && e.message) ElMessage.error(e.message)
  }
}

function goScheduleManage() {
  router.push({ path: '/schedule-manage', query: { group: selectedGroupId.value } })
}

function goCancelShiftRecords() {
  const base = route.path.startsWith('/enterprise')
    ? '/enterprise/grab-cancel-shift-records'
    : '/grab-cancel-shift-records'
  router.push(base)
}

watch(groupList, (list) => {
  if (!list.some((g) => g.id === selectedGroupId.value)) {
    selectedGroupId.value = list[0]?.id ?? ''
  }
})

watch(
  () => route.query.group,
  (group) => {
    if (typeof group === 'string' && store.attendanceGroups.some((g) => g.id === group)) {
      selectedGroupId.value = group
    }
  },
  { immediate: true },
)

watch(
  () => route.query.slot,
  (slotId) => {
    if (typeof slotId !== 'string') return
    const slot = store.grabShiftSlots.find((s) => s.id === slotId)
    if (!slot) return
    if (store.attendanceGroups.some((g) => g.id === slot.attendanceGroupId)) {
      selectedGroupId.value = slot.attendanceGroupId
    }
    activeTab.value = slot.publishStatus === 'pending' ? 'publish' : 'slots'
    if (slot.publishStatus === 'pending') openPublishReview(slot)
    else showSlotDetail(slot)
  },
  { immediate: true },
)
</script>

<template>
  <div class="grab-shift-page">
    <header class="page-card page-header">
      <div>
        <h2 class="page-title">抢班管理</h2>
        <p class="text-muted">
          待审班次可改内容与费用后发布到大厅 · 发布待审 {{ pendingPublishCount }} · 报名待审
          {{ pendingCount }}
        </p>
      </div>
      <div class="header-actions">
        <EnterpriseScopeSelect
          v-if="showEnterpriseControl"
          v-model="enterpriseFilter"
          mode="filter"
          width="180px"
        />
        <el-select v-model="listDeptFilter" style="width: 180px" placeholder="部门筛选">
          <el-option
            v-for="opt in departmentFilterOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
        <el-select v-model="listPositionFilter" style="width: 160px" placeholder="岗位筛选">
          <el-option
            v-for="opt in positionFilterOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
        <el-button @click="goScheduleManage">返回排班管理</el-button>
        <el-button @click="goCancelShiftRecords">取消班次记录</el-button>
        <el-button :icon="UserFilled" @click="openWhitelist">白名单管理</el-button>
        <el-button type="primary" :icon="Plus" @click="openPublish">发布抢班</el-button>
      </div>
    </header>

    <div class="page-card">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="班次日历" name="calendar">
          <div class="filter-bar">
            <el-radio-group v-model="slotStatusFilter" size="small">
              <el-radio-button value="all">全部</el-radio-button>
              <el-radio-button value="open">招募中</el-radio-button>
              <el-radio-button value="partial">部分满员</el-radio-button>
              <el-radio-button value="full">已满员</el-radio-button>
              <el-radio-button value="cancelled">已取消</el-radio-button>
            </el-radio-group>
          </div>
          <GrabShiftCalendar :slots="slotTableData" @slot-click="onCalendarSlotClick" />
        </el-tab-pane>

        <el-tab-pane label="抢班班次" name="slots">
          <div class="filter-bar">
            <el-radio-group v-model="slotStatusFilter" size="small">
              <el-radio-button value="all">全部</el-radio-button>
              <el-radio-button value="open">招募中</el-radio-button>
              <el-radio-button value="partial">部分满员</el-radio-button>
              <el-radio-button value="full">已满员</el-radio-button>
              <el-radio-button value="cancelled">已取消</el-radio-button>
            </el-radio-group>
          </div>

          <el-table :data="slotTableData" border stripe>
            <el-table-column prop="enterpriseName" label="企业" min-width="150" show-overflow-tooltip />
            <el-table-column prop="departmentDisplayName" label="部门" min-width="140" show-overflow-tooltip />
            <el-table-column prop="positionName" label="岗位名称" min-width="120" show-overflow-tooltip>
              <template #default="{ row }">{{ row.positionName || '—' }}</template>
            </el-table-column>
            <el-table-column prop="displayShiftName" label="班次" width="110" />
            <el-table-column label="日期时段" min-width="160">
              <template #default="{ row }">
                {{ row.date }} · {{ row.startTime }}-{{ row.endTime }}
              </template>
            </el-table-column>
            <el-table-column prop="scopeLabel" label="范围" width="120" />
            <el-table-column label="时薪" width="110">
              <template #default="{ row }">
                <span v-if="row.effectiveHourlyRate">¥{{ row.effectiveHourlyRate }}/h</span>
                <span v-else class="text-muted">—</span>
              </template>
            </el-table-column>
            <el-table-column label="需求/已抢" width="100">
              <template #default="{ row }">
                {{ row.grabbedCount }}/{{ row.requiredCount }}
                <span v-if="row.gap > 0" class="gap-text">（缺{{ row.gap }}）</span>
              </template>
            </el-table-column>
            <el-table-column label="创建时间" width="160">
              <template #default="{ row }">
                {{ row.createdAt ? new Date(row.createdAt).toLocaleString('zh-CN') : '—' }}
              </template>
            </el-table-column>
            <el-table-column label="技能要求" min-width="140">
              <template #default="{ row }">
                <el-tag v-for="r in row.requirements" :key="r" size="small" effect="plain" style="margin-right: 4px">
                  {{ r }}
                </el-tag>
                <span v-if="!row.requirements.length" class="text-muted">无</span>
              </template>
            </el-table-column>
            <el-table-column label="待审报名" width="90">
              <template #default="{ row }">
                <el-badge v-if="row.pendingApps" :value="row.pendingApps" type="warning">
                  <span>{{ row.pendingApps }} 条</span>
                </el-badge>
                <span v-else class="text-muted">0</span>
              </template>
            </el-table-column>
            <el-table-column label="发布状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.publishType" size="small">{{ row.publishLabel }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="状态" width="140">
              <template #default="{ row }">
                <el-tag :type="row.statusType" size="small">{{ row.statusLabel }}</el-tag>
                <el-tag v-if="row.urgent" type="danger" size="small" effect="dark" style="margin-left: 4px">
                  紧急
                </el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="200" fixed="right">
              <template #default="{ row }">
                <el-button
                  v-if="row.publishStatus === 'pending'"
                  link
                  type="warning"
                  @click="openPublishReview(row)"
                >
                  审核发布
                </el-button>
                <el-button link type="primary" @click="showSlotDetail(row)">详情</el-button>
                <el-button
                  v-if="canCancelGrabSlot(row)"
                  link
                  type="danger"
                  @click="openCancelSlot(row.id)"
                >
                  取消班次
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane :label="`发布审批 (${pendingPublishCount})`" name="publish">
          <el-alert
            type="info"
            :closable="false"
            title="审核状态可配置工时、报名上浮与薪资费用；日期/时段/需求人数/客户费用不可改，通过后发布到抢班大厅"
            style="margin-bottom: 16px"
          />
          <el-table :data="pendingPublishSlots" border stripe>
            <el-table-column prop="enterpriseName" label="企业" min-width="140" show-overflow-tooltip />
            <el-table-column prop="departmentDisplayName" label="部门" min-width="130" show-overflow-tooltip />
            <el-table-column prop="positionName" label="岗位名称" min-width="110" show-overflow-tooltip>
              <template #default="{ row }">{{ row.positionName || '—' }}</template>
            </el-table-column>
            <el-table-column prop="displayShiftName" label="班次" width="100" />
            <el-table-column label="日期时段" min-width="160">
              <template #default="{ row }">
                {{ row.date }} {{ row.startTime }}-{{ row.endTime }}
              </template>
            </el-table-column>
            <el-table-column label="费用" width="140">
              <template #default="{ row }">
                ¥{{ row.effectiveHourlyRate ?? row.baseHourlyRate ?? '—' }}/h
                <div v-if="row.hourlySubsidy" class="gap-text">补贴 +{{ row.hourlySubsidy }}</div>
              </template>
            </el-table-column>
            <el-table-column label="需求" width="80">
              <template #default="{ row }">{{ row.requiredCount }} 人</template>
            </el-table-column>
            <el-table-column prop="positionRequirement" label="岗位要求" min-width="160" show-overflow-tooltip />
            <el-table-column label="操作" width="120" fixed="right">
              <template #default="{ row }">
                <el-button link type="warning" @click="openPublishReview(row)">审核</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="!pendingPublishSlots.length" description="暂无待发布审批的班次" />
        </el-tab-pane>

        <el-tab-pane :label="`报名审批 (${pendingCount})`" name="approval">
          <el-alert
            type="info"
            :closable="false"
            title="灵工在自助端提交报名后进入待审批；白名单人员报名自动通过并写入排班表"
            style="margin-bottom: 16px"
          />

          <el-table :data="pendingApplications" border stripe>
            <el-table-column prop="enterpriseName" label="企业" min-width="150" show-overflow-tooltip />
            <el-table-column prop="departmentDisplayName" label="部门" min-width="130" show-overflow-tooltip />
            <el-table-column prop="positionName" label="岗位名称" min-width="110" show-overflow-tooltip />
            <el-table-column prop="employeeName" label="报名人" width="100" />
            <el-table-column prop="phone" label="手机号" width="130" />
            <el-table-column prop="shiftName" label="班次" width="90" />
            <el-table-column prop="date" label="日期" width="110" />
            <el-table-column prop="teamName" label="班组" width="120" />
            <el-table-column prop="message" label="报名说明" min-width="160" show-overflow-tooltip />
            <el-table-column label="提交时间" width="160">
              <template #default="{ row }">
                {{ new Date(row.createdAt).toLocaleString('zh-CN') }}
              </template>
            </el-table-column>
            <el-table-column label="操作" width="160" fixed="right">
              <template #default="{ row }">
                <el-button
                  link
                  type="success"
                  :disabled="row.slotStatus === 'full' || row.slotStatus === 'cancelled'"
                  @click="reviewApplication(row.id, true)"
                >
                  通过
                </el-button>
                <el-button link type="danger" @click="reviewApplication(row.id, false)">驳回</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="!pendingApplications.length" description="暂无待审批报名" />
        </el-tab-pane>
      </el-tabs>
    </div>

    <el-dialog v-model="publishVisible" title="发布抢班" width="620px">
      <el-alert type="info" :closable="false" title="提交后进入「抢班管理 · 发布审批」；发布时可配置报名上浮（人数/百分比），审核通过后上架小程序" style="margin-bottom: 16px" />
      <el-form label-width="108px">
        <el-form-item label="考勤组" required>
          <el-select v-model="selectedGroupId" style="width: 100%">
            <el-option v-for="g in groupList" :key="g.id" :label="g.name" :value="g.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="发布范围" required>
          <el-select v-model="publishForm.scopeKey" style="width: 100%">
            <el-option v-for="opt in scopeOptions" :key="opt.value" :label="opt.label" :value="opt.value" />
          </el-select>
          <p class="field-hint text-muted">可选择全局（考勤组）或组织架构下的部门</p>
        </el-form-item>
        <el-form-item label="班次类型" required>
          <el-radio-group v-model="publishForm.shiftMode">
            <el-radio-button value="template">考勤组班次</el-radio-button>
            <el-radio-button value="custom">自定义班次</el-radio-button>
          </el-radio-group>
        </el-form-item>
        <el-form-item v-if="publishForm.shiftMode === 'template'" label="班次" required>
          <el-select v-model="publishForm.shiftTemplateId" style="width: 100%">
            <el-option
              v-for="tpl in templateShiftOptions"
              :key="tpl.templateId"
              :label="`${tpl.templateName}（${tpl.startTime.slice(0, 5)}-${tpl.endTime.slice(0, 5)}）`"
              :value="tpl.templateId"
            />
          </el-select>
        </el-form-item>
        <template v-else>
          <el-form-item label="班次名称" required>
            <el-input v-model="publishForm.customShiftName" maxlength="20" show-word-limit />
          </el-form-item>
          <el-form-item label="起止时间" required>
            <div class="time-range">
              <el-time-picker v-model="publishForm.startTime" format="HH:mm" value-format="HH:mm" placeholder="开始" />
              <span class="time-sep">至</span>
              <el-time-picker v-model="publishForm.endTime" format="HH:mm" value-format="HH:mm" placeholder="结束" />
            </div>
          </el-form-item>
          <el-form-item label="休息时间">
            <el-switch v-model="publishForm.hasBreakTime" />
            <el-input
              v-if="publishForm.hasBreakTime"
              v-model="publishForm.breakRule"
              placeholder="如：午餐休30分钟"
              style="width: 100%; margin-top: 8px"
            />
          </el-form-item>
        </template>
        <el-form-item label="日期" required>
          <el-date-picker v-model="publishForm.date" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="需求人数" required>
          <el-input-number v-model="publishForm.requiredCount" :min="1" :max="50" />
        </el-form-item>
        <el-form-item label="报名上浮" required>
          <div class="subsidy-row">
            <el-radio-group v-model="publishForm.enrollFloatMode" size="small">
              <el-radio-button value="absolute">上浮人数</el-radio-button>
              <el-radio-button value="percent">上浮百分比</el-radio-button>
            </el-radio-group>
            <el-input-number
              v-model="publishForm.enrollFloatValue"
              :min="0"
              :max="publishForm.enrollFloatMode === 'percent' ? 500 : 100"
              :step="1"
            />
            <span>{{ publishForm.enrollFloatMode === 'percent' ? '%' : '人' }}</span>
          </div>
          <p class="field-hint text-muted">
            需求 {{ publishForm.requiredCount }} → 可报名
            <strong>{{ publishEnrollCap }}</strong> 人
          </p>
        </el-form-item>
        <el-form-item label="时薪补贴">
          <div class="subsidy-row">
            <span class="text-muted">
              基础 ¥{{ baseHourlyRate }}/h（{{ baseRateDetail.label }}）+ 上浮
            </span>
            <el-input-number v-model="publishForm.hourlySubsidy" :min="0" :max="999" :step="1" />
            <span>元/h</span>
          </div>
          <p class="field-hint text-muted">
            基础时薪按考勤组白班/夜班时段及日期（平日/周末/节假日）自动匹配 · 实际时薪 ¥{{ effectiveHourlyRate }}/h
          </p>
        </el-form-item>
        <el-form-item label="岗位名称" required>
          <el-select
            v-model="publishForm.positionName"
            filterable
            allow-create
            default-first-option
            placeholder="选择或输入岗位名称"
            style="width: 100%"
          >
            <el-option v-for="p in grabShiftPositionOptions" :key="p" :label="p" :value="p" />
          </el-select>
        </el-form-item>
        <el-form-item label="岗位要求" required>
          <el-input
            v-model="publishForm.positionRequirement"
            type="textarea"
            :rows="4"
            placeholder="描述岗位职责与工作内容，建议每行一条"
            maxlength="500"
            show-word-limit
          />
          <p class="field-hint text-muted">灵工端抢班详情页展示，请明确工作内容与职责</p>
        </el-form-item>
        <el-form-item label="技能要求" required>
          <el-select v-model="publishForm.requirements" multiple filterable allow-create style="width: 100%">
            <el-option v-for="s in skillOptions" :key="s" :label="s" :value="s" />
          </el-select>
          <p class="field-hint text-muted">至少选择一项，可输入自定义技能/证书要求</p>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="publishVisible = false">取消</el-button>
        <el-button type="primary" @click="submitPublish">提交审批</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="whitelistVisible" title="白名单管理" width="680px">
      <el-alert
        type="info"
        :closable="false"
        title="白名单人员报名抢班时自动通过，无需人工审批，并直接写入排班表"
        style="margin-bottom: 16px"
      />

      <div class="whitelist-add-bar">
        <el-select v-model="selectedGroupId" style="width: 180px" placeholder="考勤组">
          <el-option v-for="g in groupList" :key="g.id" :label="g.name" :value="g.id" />
        </el-select>
        <el-select
          v-model="whitelistForm.employeeId"
          filterable
          placeholder="选择人员"
          style="width: 220px"
        >
          <el-option
            v-for="opt in whitelistCandidateOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
        <el-input
          v-model="whitelistForm.remark"
          placeholder="备注（可选）"
          style="width: 200px"
          maxlength="50"
          show-word-limit
        />
        <el-button type="primary" :disabled="!whitelistCandidateOptions.length" @click="submitWhitelist">
          添加
        </el-button>
      </div>

      <el-table :data="whitelistTableData" border stripe style="margin-top: 16px">
        <el-table-column prop="employeeName" label="姓名" width="100" />
        <el-table-column prop="employeeNo" label="工号" width="100" />
        <el-table-column prop="position" label="岗位" min-width="120" />
        <el-table-column prop="remark" label="备注" min-width="160" show-overflow-tooltip>
          <template #default="{ row }">
            {{ row.remark || '—' }}
          </template>
        </el-table-column>
        <el-table-column label="加入时间" width="160">
          <template #default="{ row }">
            {{ new Date(row.createdAt).toLocaleString('zh-CN') }}
          </template>
        </el-table-column>
        <el-table-column label="操作" width="90" fixed="right">
          <template #default="{ row }">
            <el-button link type="danger" @click="removeWhitelist(row.id, row.employeeName)">
              移除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!whitelistTableData.length" description="当前考勤组暂无白名单人员" />
    </el-dialog>

    <el-drawer v-model="detailVisible" title="班次详情与报名记录" size="480px">
      <template v-if="currentSlot">
        <el-descriptions :column="1" border size="small">
          <el-descriptions-item label="岗位名称">{{ currentSlot.positionName || '—' }}</el-descriptions-item>
          <el-descriptions-item label="班次">{{ resolveGrabSlotShiftName(currentSlot) }}</el-descriptions-item>
          <el-descriptions-item label="部门">{{ resolveSlotDepartmentName(currentSlot) }}</el-descriptions-item>
          <el-descriptions-item label="日期">{{ currentSlot.date }}</el-descriptions-item>
          <el-descriptions-item label="时段">
            {{ currentSlot.startTime }}-{{ currentSlot.endTime }}
            <template v-if="currentSlot.hasBreakTime && currentSlot.breakRule">
              （{{ currentSlot.breakRule }}）
            </template>
          </el-descriptions-item>
          <el-descriptions-item label="范围">
            {{
              currentSlot.scope === 'global' || currentSlot.teamId === GRAB_SHIFT_GLOBAL_TEAM_ID
                ? '全局'
                : currentSlot.departmentName ?? currentSlot.teamName
            }}
          </el-descriptions-item>
          <el-descriptions-item v-if="currentSlot.effectiveHourlyRate" label="时薪">
            ¥{{ currentSlot.effectiveHourlyRate }}/h
            <span v-if="currentSlot.hourlySubsidy" class="text-muted">
              （基础 ¥{{ currentSlot.baseHourlyRate }} + 补贴 ¥{{ currentSlot.hourlySubsidy }}）
            </span>
          </el-descriptions-item>
          <el-descriptions-item label="进度">
            {{ currentSlot.grabbedCount }}/{{ currentSlot.requiredCount }} 人
          </el-descriptions-item>
          <el-descriptions-item label="岗位要求">
            <div class="req-text">{{ currentSlot.positionRequirement || '—' }}</div>
          </el-descriptions-item>
          <el-descriptions-item label="技能要求">
            <el-tag
              v-for="r in currentSlot.requirements"
              :key="r"
              size="small"
              effect="plain"
              style="margin-right: 4px; margin-bottom: 4px"
            >
              {{ r }}
            </el-tag>
            <span v-if="!currentSlot.requirements.length" class="text-muted">—</span>
          </el-descriptions-item>
        </el-descriptions>

        <h4 class="drawer-subtitle">报名记录</h4>
        <el-table :data="slotApplications" size="small" border>
          <el-table-column prop="employeeName" label="报名人" width="90" />
          <el-table-column prop="phone" label="手机号" width="120" />
          <el-table-column prop="statusLabel" label="状态" width="90" />
          <el-table-column prop="message" label="说明" show-overflow-tooltip />
        </el-table>
        <el-button
          v-if="canCancelGrabSlot(currentSlot)"
          type="danger"
          plain
          style="width: 100%; margin-top: 16px"
          @click="openCancelSlot(currentSlot.id)"
        >
          取消班次
        </el-button>
      </template>
    </el-drawer>

    <el-drawer
      v-model="reviewVisible"
      :title="currentSlot ? `审核发布 · ${resolveGrabSlotShiftName(currentSlot)}` : '审核发布'"
      size="580px"
    >
      <template v-if="currentSlot">
        <el-alert
          type="info"
          :closable="false"
          title="日期/时段/需求人数/客户费用不可改；可配置休息工时、报名上浮与薪资费用后发布到大厅"
          style="margin-bottom: 16px"
        />
        <el-form label-position="top">
          <el-form-item label="日期">
            <el-input :model-value="currentSlot.date" disabled />
          </el-form-item>
          <el-form-item label="时段">
            <el-input
              :model-value="`${currentSlot.startTime} — ${currentSlot.endTime}`"
              disabled
            />
          </el-form-item>
          <el-form-item label="休息">
            <el-input
              :model-value="
                currentSlot.hasBreakTime
                  ? currentSlot.breakRule || '有休息'
                  : '无休息'
              "
              disabled
            />
            <div v-if="currentSlot.hasBreakTime" class="subsidy-row" style="margin-top: 8px">
              <span>休息分钟</span>
              <el-input-number v-model="reviewForm.breakMinutes" :min="0" :max="240" :step="5" />
              <span class="field-hint">用于计算工时</span>
            </div>
          </el-form-item>
          <el-form-item label="本次班次工时">
            <strong class="fee-total">{{ reviewWorkHours }} 小时</strong>
            <p class="field-hint">按时段扣除休息后自动计算</p>
          </el-form-item>
          <el-form-item label="需求人数">
            <el-input :model-value="`${currentSlot.requiredCount} 人`" disabled />
          </el-form-item>
          <el-form-item label="报名上浮" required>
            <div class="subsidy-row">
              <el-radio-group v-model="reviewForm.enrollFloatMode" size="small">
              <el-radio-button value="absolute">上浮人数</el-radio-button>
              <el-radio-button value="percent">上浮百分比</el-radio-button>
              </el-radio-group>
              <el-input-number
                v-model="reviewForm.enrollFloatValue"
                :min="0"
                :max="reviewForm.enrollFloatMode === 'percent' ? 500 : 100"
                :step="1"
              />
              <span>{{ reviewForm.enrollFloatMode === 'percent' ? '%' : '人' }}</span>
            </div>
            <p class="field-hint">
              需求 {{ currentSlot.requiredCount }} → 可报名
              <strong>{{ reviewEnrollCap }}</strong> 人
            </p>
          </el-form-item>

          <el-divider content-position="left">客户费用（不可改）</el-divider>
          <el-form-item label="客户费用">
            <div class="fee-box">
              <p>
                （基础时薪 ¥{{ currentSlot.baseHourlyRate ?? 0 }} + 补贴上浮 ¥{{
                  currentSlot.hourlySubsidy ?? 0
                }}）× 工时 {{ reviewWorkHours }}h
              </p>
              <p>
                = 时薪 ¥{{ reviewEffectiveRate }}/h × {{ reviewWorkHours }}h =
                <strong>¥{{ reviewCustomerFee }}</strong>
              </p>
            </div>
          </el-form-item>

          <el-divider content-position="left">薪资费用（默认代入客户费用）</el-divider>
          <el-form-item label="薪资费用">
            <div class="subsidy-row">
              <span>基础时薪（结算价）</span>
              <el-input-number
                v-model="reviewForm.wageBaseHourlyRate"
                :min="0"
                :max="999"
                :step="1"
                disabled
              />
              <span>补贴上浮</span>
              <el-input-number
                v-model="reviewForm.wageHourlySubsidy"
                :min="0"
                :max="999"
                :step="1"
              />
            </div>
            <div class="fee-box" style="margin-top: 8px">
              <p>
                （结算价 ¥{{ reviewForm.wageBaseHourlyRate }} + 补贴 ¥{{
                  reviewForm.wageHourlySubsidy
                }}）× 工时 {{ reviewWorkHours }}h
              </p>
              <p>
                = 时薪 ¥{{ reviewWageHourly }}/h × {{ reviewWorkHours }}h =
                <strong>¥{{ reviewWageFee }}</strong>
              </p>
            </div>
          </el-form-item>

          <el-form-item label="岗位要求" required>
            <el-input
              v-model="reviewForm.positionRequirement"
              type="textarea"
              :rows="3"
              maxlength="500"
              show-word-limit
            />
          </el-form-item>
          <el-form-item label="技能要求（顿号/逗号分隔）">
            <el-input v-model="reviewForm.requirementsText" placeholder="如：安全作业证、健康证" />
          </el-form-item>
          <el-form-item label="审批意见 / 驳回原因">
            <el-input
              v-model="reviewNote"
              type="textarea"
              :rows="2"
              placeholder="驳回时必填"
            />
          </el-form-item>
        </el-form>
        <div class="review-actions">
          <el-button type="success" @click="approvePublishSlot">通过并发布到大厅</el-button>
          <el-button type="danger" @click="rejectPublishSlot">驳回</el-button>
        </div>
      </template>
    </el-drawer>
  </div>

  <el-dialog v-model="cancelDialogVisible" title="取消抢班班次" width="520px">
    <el-alert
      v-if="cancelTargetSlot"
      type="info"
      :closable="false"
      :title="`${cancelTargetSlot.shiftName} · ${cancelTargetSlot.date} ${cancelTargetSlot.startTime}-${cancelTargetSlot.endTime}`"
      style="margin-bottom: 16px"
    />
    <el-form label-width="100px">
      <el-form-item label="取消范围" required>
        <el-radio-group v-model="cancelForm.scope">
          <el-radio value="slot">整班取消</el-radio>
          <el-radio value="person">单人取消</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item v-if="cancelForm.scope === 'person'" label="取消人员" required>
        <el-select
          v-model="cancelForm.employeeId"
          placeholder="选择已报名/已通过人员"
          style="width: 100%"
          filterable
        >
          <el-option
            v-for="opt in cancelPersonOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value"
          />
        </el-select>
        <p class="text-muted" style="margin: 6px 0 0; font-size: 12px">
          单人取消后释放需求名额，其他人仍可继续抢班
        </p>
      </el-form-item>
      <el-form-item v-else label="说明">
        <p class="text-muted" style="margin: 0; font-size: 12px">
          整班取消后，班次状态变为「已取消」，相关人员抢班状态均改为「已取消」
        </p>
      </el-form-item>
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
      <el-button @click="cancelDialogVisible = false">返回</el-button>
      <el-button type="danger" :loading="cancelSubmitting" @click="submitGrabCancel">
        确认取消
      </el-button>
    </template>
  </el-dialog>
</template>

<style scoped>
.grab-shift-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
  padding: 20px;
}

.page-header .page-title {
  margin: 0 0 6px;
}

.header-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}

.filter-bar {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.header-label {
  font-size: 13px;
  white-space: nowrap;
}

.gap-text {
  color: #e6a23c;
  font-size: 12px;
}

.drawer-subtitle {
  margin: 20px 0 12px;
  font-size: 14px;
  font-weight: 600;
}

.req-text {
  white-space: pre-wrap;
  line-height: 1.6;
  color: #606266;
}

.whitelist-add-bar {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  align-items: center;
}

.field-hint {
  margin: 6px 0 0;
  font-size: 12px;
}

.time-range {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.time-sep {
  color: #909399;
}

.subsidy-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.review-actions {
  margin-top: 20px;
  display: flex;
  gap: 12px;
}

.fee-box {
  width: 100%;
  padding: 10px 12px;
  border-radius: 8px;
  background: #f8fafc;
  border: 1px solid #eef2f7;
  font-size: 13px;
  color: #475569;
  line-height: 1.6;
}

.fee-box p {
  margin: 0;
}

.fee-box strong,
.fee-total {
  color: #111827;
  font-size: 16px;
}

.cancel-reason-group {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
}
</style>
