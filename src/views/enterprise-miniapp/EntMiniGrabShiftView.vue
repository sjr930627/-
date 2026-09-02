<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import EntMiniNavBar from '@/components/enterprise-miniapp/EntMiniNavBar.vue'
import EntMiniGrabShiftCalendar, {
  type GrabShiftCalendarSlot,
} from '@/components/enterprise-miniapp/EntMiniGrabShiftCalendar.vue'
import { useAppStore } from '@/stores/app'
import { useEnterpriseMiniAuth } from '@/composables/useEnterpriseMiniAuth'
import { normalizeDeptInterviewRule } from '@/constants/grabInterview'
import {
  buildGrabShiftSlotPayload,
  calcGrabShiftEffectiveRate,
  formatGrabPositionAgeRange,
  formatGrabPositionGender,
  getGrabShiftScopeOptions,
  getGrabShiftTemplateOptions,
  grabShiftPublishStatusMap,
  resolveGrabShiftBaseHourlyRate,
  resolveGrabSlotDepartmentName,
  resolveGrabSlotPositionProfile,
  resolveGrabSlotShiftName,
} from '@/services/grabShift'
import { resolveEnterpriseIdByAttendanceGroupId } from '@/utils/enterpriseScope'

const store = useAppStore()
const router = useRouter()
const { enterpriseId, displayName } = useEnterpriseMiniAuth()
const operatorName = computed(() => displayName.value || '企业小程序')

type TabKey = 'slots' | 'apps' | 'whitelist'
const tab = ref<TabKey>('slots')
const publishOpen = ref(false)
const storeTeamFilter = ref<'all' | string>('all')
const slotDetailOpen = ref(false)
const selectedDay = ref('')
const selectedDaySlots = ref<GrabShiftCalendarSlot[]>([])
const selectedSlot = ref<GrabShiftCalendarSlot | null>(null)

const selectedGroupId = ref('')
const whitelistForm = ref({ employeeId: '', remark: '' })

const interviewConfig = computed(() =>
  store.ensureGrabInterviewConfig(enterpriseId.value || store.currentEnterpriseId),
)

const interviewDeptOptions = computed(() => {
  const cfg = interviewConfig.value
  return (cfg.deptRules ?? [])
    .map((raw) => normalizeDeptInterviewRule(raw))
    .filter((r) => r.positions.length > 0)
    .map((r) => {
      const dept = store.departments.find((d) => d.id === r.departmentId)
      return {
        departmentId: r.departmentId,
        departmentName: dept?.name || r.departmentId,
        positions: r.positions,
      }
    })
})

/** 发布范围部门：优先面试配置部门，否则企业业务部门 */
const publishDepartmentOptions = computed(() => {
  if (interviewDeptOptions.value.length) {
    return interviewDeptOptions.value.map((d) => ({
      departmentId: d.departmentId,
      departmentName: d.departmentName,
    }))
  }
  return store
    .getDepartmentsByEnterprise(enterpriseId.value)
    .filter((d) => d.orgType !== 'enterprise' && !d.id.includes('unassigned'))
    .map((d) => ({ departmentId: d.id, departmentName: d.name }))
})

const publishForm = ref({
  groupId: '',
  departmentId: '',
  positionId: '',
  date: '2026-07-28',
  shiftTemplateId: '',
  requiredCount: 2,
  hourlySubsidy: 5,
  positionName: '',
  jobType: '',
  positionRequirement: '',
  description: '',
  ageMin: undefined as number | undefined,
  ageMax: undefined as number | undefined,
  gender: 'any' as 'any' | 'male' | 'female',
  experience: '不限',
  skillsText: '',
  requirements: [] as string[],
})

const groupList = computed(() =>
  store.getAttendanceGroupsByEnterprise(enterpriseId.value).filter((g) => g.attendanceType === 'shift'),
)

const publishGroup = computed(() =>
  store.attendanceGroups.find((g) => g.id === publishForm.value.groupId),
)

const templateShiftOptions = computed(() =>
  getGrabShiftTemplateOptions(publishGroup.value, store.shifts),
)

const enterprisePositions = computed(() => store.getEnterprisePositions(enterpriseId.value))

const selectedEnterprisePosition = computed(() =>
  store.getEnterprisePosition(publishForm.value.positionId),
)

watch(
  groupList,
  (list) => {
    if (!list.some((g) => g.id === selectedGroupId.value)) {
      selectedGroupId.value = list[0]?.id ?? ''
    }
  },
  { immediate: true },
)

const enterpriseTeams = computed(() => {
  const empIds = new Set(
    store.employees.filter((e) => e.enterpriseId === enterpriseId.value).map((e) => e.id),
  )
  return store.teams.filter((t) => t.memberIds.some((id) => empIds.has(id)))
})

const storeOptions = computed(() => {
  const ent = store.enterprises.find((e) => e.id === enterpriseId.value)
  return [
    { value: 'all', label: ent?.name ? `${ent.name}（全部班组）` : '全部门店' },
    ...enterpriseTeams.value.map((t) => ({ value: t.id, label: t.name })),
  ]
})

const storeDisplayName = computed(() => {
  if (storeTeamFilter.value === 'all') {
    const ent = store.enterprises.find((e) => e.id === enterpriseId.value)
    return ent?.name ?? '全部门店'
  }
  return enterpriseTeams.value.find((t) => t.id === storeTeamFilter.value)?.name ?? '门店'
})

const grabStatusMap: Record<string, string> = {
  open: '招募中',
  partial: '部分满员',
  full: '已满员',
  cancelled: '已取消',
}

function matchesEnterpriseSlot(attendanceGroupId: string) {
  const ent = resolveEnterpriseIdByAttendanceGroupId(
    attendanceGroupId,
    store.attendanceGroups,
    store.departments,
  )
  return !enterpriseId.value || ent === enterpriseId.value
}

function matchesTeamFilter(slot: { teamId: string }) {
  if (storeTeamFilter.value === 'all') return true
  return slot.teamId === storeTeamFilter.value
}

const slots = computed(() =>
  store.grabShiftSlots
    .filter((s) => matchesEnterpriseSlot(s.attendanceGroupId))
    .filter((s) => matchesTeamFilter(s))
    .map((slot) => {
      const apps = store.grabShiftApplications.filter((a) => a.slotId === slot.id)
      const pendingApps = apps.filter((a) => a.status === 'pending')
      const approvedApps = apps.filter((a) => a.status === 'approved')
      const publishMeta = grabShiftPublishStatusMap[slot.publishStatus ?? 'published']
      return {
        ...slot,
        displayShiftName: resolveGrabSlotShiftName(slot),
        departmentDisplayName: resolveGrabSlotDepartmentName(slot, store.teams, store.departments),
        statusLabel: grabStatusMap[slot.status] ?? slot.status,
        publishLabel: publishMeta?.label ?? '已上架',
        pendingCount: pendingApps.length,
        approvedCount: approvedApps.length,
        applicants: apps
          .map((a) => ({
            ...a,
            employeeName: store.employees.find((e) => e.id === a.employeeId)?.name || a.employeeId,
            whitelisted: store.isGrabShiftWhitelisted(a.employeeId, slot.attendanceGroupId),
          }))
          .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
      }
    })
    .sort((a, b) => b.date.localeCompare(a.date) || a.startTime.localeCompare(b.startTime)),
)

const pendingApps = computed(() =>
  store.grabShiftApplications
    .filter((a) => a.status === 'pending')
    .map((a) => {
      const slot = store.grabShiftSlots.find((s) => s.id === a.slotId)
      if (!slot || !matchesEnterpriseSlot(slot.attendanceGroupId)) return null
      if (!matchesTeamFilter(slot)) return null
      const emp = store.employees.find((e) => e.id === a.employeeId)
      return {
        ...a,
        employeeName: emp?.name || a.employeeId,
        employeeNo: emp?.employeeNo || '—',
        position: emp?.position || '—',
        shiftName: resolveGrabSlotShiftName(slot),
        positionName: slot.positionName || '—',
        departmentDisplayName: resolveGrabSlotDepartmentName(slot, store.teams, store.departments),
        date: slot.date,
        teamName: slot.teamName,
        progress: `${slot.grabbedCount}/${slot.requiredCount}`,
        attendanceGroupId: slot.attendanceGroupId,
        alreadyWhitelisted: store.isGrabShiftWhitelisted(a.employeeId, slot.attendanceGroupId),
      }
    })
    .filter(Boolean)
    .sort((a, b) => (b!.createdAt || '').localeCompare(a!.createdAt || '')) as {
    id: string
    employeeId: string
    employeeName: string
    employeeNo: string
    position: string
    shiftName: string
    positionName: string
    departmentDisplayName: string
    date: string
    teamName: string
    progress: string
    createdAt: string
    attendanceGroupId: string
    alreadyWhitelisted: boolean
  }[],
)

const whitelistTableData = computed(() =>
  store.grabShiftWhitelist
    .filter((w) => {
      if (!selectedGroupId.value) return false
      if (w.attendanceGroupId !== selectedGroupId.value) return false
      return matchesEnterpriseSlot(w.attendanceGroupId)
    })
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
  store
    .getEmployeesByEnterprise(enterpriseId.value)
    .filter((e) => e.status === 'active')
    .filter(
      (e) =>
        !store.grabShiftWhitelist.some(
          (w) => w.employeeId === e.id && w.attendanceGroupId === selectedGroupId.value,
        ),
    )
    .map((e) => ({
      value: e.id,
      label: `${e.name}（${e.employeeNo}）· ${e.position || '未设岗位'}`,
    })),
)

function optionalAge(n: unknown): number | undefined {
  return typeof n === 'number' && Number.isFinite(n) && n >= 16 ? n : undefined
}

function parsePublishSkills(): string[] {
  const parsed = publishForm.value.skillsText
    .split(/[,，、]/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (parsed.length) return parsed
  if (publishForm.value.requirements.length) return publishForm.value.requirements
  return selectedEnterprisePosition.value?.profile.skills ?? []
}

function applyEnterprisePosition(positionId: string) {
  const pos = store.getEnterprisePosition(positionId)
  if (!pos) return
  const p = pos.profile
  publishForm.value.positionId = pos.id
  publishForm.value.positionName = p.positionName || pos.name
  publishForm.value.jobType = p.jobType || ''
  publishForm.value.positionRequirement = p.requirements?.trim() || ''
  publishForm.value.description = p.description?.trim() || ''
  publishForm.value.ageMin = p.ageMin
  publishForm.value.ageMax = p.ageMax
  publishForm.value.gender = p.gender || 'any'
  publishForm.value.experience = p.experience || '不限'
  publishForm.value.requirements = [...(p.skills ?? [])]
  publishForm.value.skillsText = (p.skills ?? []).join('、')
}

function syncPublishDefaults() {
  const dept =
    publishDepartmentOptions.value.find((d) =>
      groupList.value.some((g) =>
        g.departmentBindings.some((b) => b.departmentId === d.departmentId),
      ),
    ) || publishDepartmentOptions.value[0]
  const position = enterprisePositions.value[0]
  publishForm.value.departmentId = dept?.departmentId || ''
  preferGroupForDepartment(publishForm.value.departmentId)
  if (!publishForm.value.groupId) {
    publishForm.value.groupId = groupList.value[0]?.id || ''
  }
  publishForm.value.date = selectedDay.value || '2026-07-28'
  publishForm.value.requiredCount = 2
  publishForm.value.hourlySubsidy = 5
  const templates = getGrabShiftTemplateOptions(
    store.attendanceGroups.find((g) => g.id === publishForm.value.groupId),
    store.shifts,
  )
  publishForm.value.shiftTemplateId = templates[0]?.templateId || ''
  if (position) {
    applyEnterprisePosition(position.id)
  } else {
    publishForm.value.positionId = ''
    publishForm.value.positionName = ''
    publishForm.value.jobType = ''
    publishForm.value.positionRequirement = ''
    publishForm.value.description = ''
    publishForm.value.ageMin = undefined
    publishForm.value.ageMax = undefined
    publishForm.value.gender = 'any'
    publishForm.value.experience = '不限'
    publishForm.value.skillsText = ''
    publishForm.value.requirements = []
  }
}

function preferGroupForDepartment(departmentId: string) {
  const matched = groupList.value.find((g) =>
    g.departmentBindings.some((b) => b.departmentId === departmentId),
  )
  if (matched) publishForm.value.groupId = matched.id
}

watch(
  () => publishForm.value.departmentId,
  (deptId) => {
    if (!publishOpen.value) return
    preferGroupForDepartment(deptId)
  },
)

watch(
  () => publishForm.value.groupId,
  (gid) => {
    if (!publishOpen.value) return
    const templates = getGrabShiftTemplateOptions(
      store.attendanceGroups.find((g) => g.id === gid),
      store.shifts,
    )
    if (!templates.some((t) => t.templateId === publishForm.value.shiftTemplateId)) {
      publishForm.value.shiftTemplateId = templates[0]?.templateId || ''
    }
  },
)

watch(
  whitelistCandidateOptions,
  (opts) => {
    if (!opts.some((o) => o.value === whitelistForm.value.employeeId)) {
      whitelistForm.value.employeeId = opts[0]?.value ?? ''
    }
  },
  { immediate: true },
)

function onCalendarDayClick(date: string, daySlots: GrabShiftCalendarSlot[]) {
  selectedDay.value = date
  selectedDaySlots.value = daySlots
  slotDetailOpen.value = false
  selectedSlot.value = null
}

function openSlotDetail(slot: GrabShiftCalendarSlot) {
  selectedSlot.value = slot
  slotDetailOpen.value = true
}

const selectedSlotProfile = computed(() =>
  selectedSlot.value ? resolveGrabSlotPositionProfile(selectedSlot.value) : null,
)

function closeSlotDetail() {
  slotDetailOpen.value = false
  selectedSlot.value = null
}

function openPublish() {
  if (!enterprisePositions.value.length) {
    ElMessage.warning('请先在「岗位管理」中新增企业岗位')
    router.push('/enterprise-miniapp/positions')
    return
  }
  if (!groupList.value.length) {
    ElMessage.warning('当前企业暂无可用考勤组')
    return
  }
  if (!interviewDeptOptions.value.length) {
    // 无面试部门时，用考勤组绑定部门作为发布范围选项回退
    const fallbackDepts = store
      .getDepartmentsByEnterprise(enterpriseId.value)
      .filter((d) => d.orgType !== 'enterprise' && !d.id.includes('unassigned'))
    if (!fallbackDepts.length) {
      ElMessage.warning('请先配置部门或抢班面试部门')
      return
    }
  }
  syncPublishDefaults()
  publishOpen.value = true
}

function closePublish() {
  publishOpen.value = false
}

function publish() {
  const group = publishGroup.value
  if (!group) {
    ElMessage.warning('请选择考勤组')
    return
  }
  if (!publishForm.value.departmentId) {
    ElMessage.warning('请选择面试配置中的部门')
    return
  }
  if (!publishForm.value.positionId || !selectedEnterprisePosition.value) {
    ElMessage.warning('请选择企业岗位')
    return
  }
  if (!publishForm.value.shiftTemplateId) {
    ElMessage.warning('请选择班次')
    return
  }
  if (!publishForm.value.positionName.trim()) {
    ElMessage.warning('岗位名称不能为空')
    return
  }
  if (!publishForm.value.positionRequirement.trim() && !publishForm.value.description.trim()) {
    ElMessage.warning('请填写任职要求或岗位描述')
    return
  }
  if (publishForm.value.requiredCount < 1) {
    ElMessage.warning('需要人数至少为 1')
    return
  }

  const scopeOptions = getGrabShiftScopeOptions(group, store.departments)
  const scopeOption =
    scopeOptions.find((o) => o.departmentId === publishForm.value.departmentId) ||
    scopeOptions.find((o) => o.scope === 'department' && o.value === publishForm.value.departmentId)

  if (!scopeOption) {
    ElMessage.warning('所选部门未绑定到当前考勤组，请调整考勤组或面试配置')
    return
  }

  const template = templateShiftOptions.value.find(
    (t) => t.templateId === publishForm.value.shiftTemplateId,
  )
  if (!template) {
    ElMessage.warning('请选择班次')
    return
  }

  const skills = parsePublishSkills()
  const positionName = publishForm.value.positionName.trim()
  const positionRequirement =
    publishForm.value.positionRequirement.trim() || publishForm.value.description.trim()

  try {
    store.createGrabShiftSlot(
      buildGrabShiftSlotPayload({
        group,
        scopeOption,
        shiftMode: 'template',
        template,
        startTime: template.startTime.slice(0, 5),
        endTime: template.endTime.slice(0, 5),
        hasBreakTime: Boolean(template.breakRule),
        breakRule: template.breakRule,
        date: publishForm.value.date,
        requiredCount: publishForm.value.requiredCount,
        enrollFloatMode: 'absolute',
        enrollFloatValue: 0,
        hourlySubsidy: Math.max(0, publishForm.value.hourlySubsidy),
        positionName,
        positionId: publishForm.value.positionId,
        positionProfile: {
          positionName,
          jobType: publishForm.value.jobType.trim() || undefined,
          skills,
          requirements: publishForm.value.positionRequirement.trim() || undefined,
          description: publishForm.value.description.trim() || undefined,
          ageMin: optionalAge(publishForm.value.ageMin),
          ageMax: optionalAge(publishForm.value.ageMax),
          gender: publishForm.value.gender,
          experience: publishForm.value.experience.trim() || undefined,
        },
        positionRequirement,
        requirements: skills,
        teams: store.teams,
        shifts: store.shifts,
        holidays: store.holidays,
      }),
    )
    ElMessage.success('抢班需求已提交，待发布审批通过后上架')
    closePublish()
    tab.value = 'slots'
    selectedDay.value = publishForm.value.date
    selectedDaySlots.value = slots.value.filter((s) => s.date === publishForm.value.date)
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '发布失败')
  }
}

function review(id: string, approved: boolean) {
  try {
    store.reviewGrabShiftApplication(
      id,
      approved,
      approved ? '企业小程序通过' : '名额已满/不符要求',
      operatorName.value,
    )
    ElMessage.success(approved ? '已通过并写入排班' : '已驳回')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '审批失败')
  }
}

function addToWhitelist(employeeId: string, attendanceGroupId: string, silent = false) {
  try {
    store.addGrabShiftWhitelistEntry({
      attendanceGroupId,
      employeeId,
      remark: '企业小程序添加',
      createdBy: operatorName.value,
    })
    if (!silent) ElMessage.success('已加入白名单，后续抢班报名将免审批')
    return true
  } catch (e) {
    if (!silent) ElMessage.warning(e instanceof Error ? e.message : '添加失败')
    return false
  }
}

function reviewAndWhitelist(id: string, employeeId: string, attendanceGroupId: string) {
  try {
    store.reviewGrabShiftApplication(id, true, '企业小程序通过并加入白名单', operatorName.value)
    addToWhitelist(employeeId, attendanceGroupId, true)
    ElMessage.success('已通过并加入白名单')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '操作失败')
  }
}

function submitWhitelist() {
  if (!selectedGroupId.value) {
    ElMessage.warning('请选择考勤组')
    return
  }
  if (!whitelistForm.value.employeeId) {
    ElMessage.warning('请选择人员')
    return
  }
  const ok = addToWhitelist(whitelistForm.value.employeeId, selectedGroupId.value)
  if (ok) {
    whitelistForm.value = {
      employeeId: whitelistCandidateOptions.value[0]?.value ?? '',
      remark: '',
    }
  }
}

async function removeWhitelist(id: string, name: string) {
  try {
    await ElMessageBox.confirm(`确定将「${name}」移出白名单？移出后抢班需人工审批。`, '移出白名单', {
      type: 'warning',
      confirmButtonText: '移出',
      cancelButtonText: '取消',
    })
    store.removeGrabShiftWhitelistEntry(id)
    ElMessage.success('已移出白名单')
  } catch {
    /* cancelled */
  }
}

function formatTime(iso: string) {
  try {
    return new Date(iso).toLocaleString('zh-CN', {
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function appStatusLabel(status: string, reviewNote?: string) {
  if (status === 'pending') return '待审'
  if (status === 'approved') {
    return reviewNote === '白名单免审批' ? '已通过（白名单）' : '已通过'
  }
  if (status === 'rejected') return '已驳回'
  if (status === 'cancelled') return '已取消'
  return status
}

const publishPreviewRate = computed(() => {
  const group = publishGroup.value
  const tpl = templateShiftOptions.value.find(
    (t) => t.templateId === publishForm.value.shiftTemplateId,
  )
  if (!group || !tpl) return null
  const base = resolveGrabShiftBaseHourlyRate(group, {
    date: publishForm.value.date,
    startTime: tpl.startTime.slice(0, 5),
    holidays: store.holidays,
  })
  return calcGrabShiftEffectiveRate(base, publishForm.value.hourlySubsidy)
})
</script>

<template>
  <div class="mini-page">
    <EntMiniNavBar title="抢班管理" back-to="/enterprise-miniapp/attendance" />

    <div class="tabs">
      <button type="button" :class="{ active: tab === 'slots' }" @click="tab = 'slots'">
        抢班班次
      </button>
      <button type="button" :class="{ active: tab === 'apps' }" @click="tab = 'apps'">
        报名审批{{ pendingApps.length ? ` ${pendingApps.length}` : '' }}
      </button>
      <button type="button" :class="{ active: tab === 'whitelist' }" @click="tab = 'whitelist'">
        白名单{{ whitelistTableData.length ? ` ${whitelistTableData.length}` : '' }}
      </button>
    </div>

    <section v-if="tab === 'slots'" class="panel slots-panel">
      <EntMiniGrabShiftCalendar
        :slots="slots"
        :store-name="storeDisplayName"
        :store-options="storeOptions"
        :selected-date="selectedDay"
        :selected-day-slots="selectedDaySlots"
        v-model:store-id="storeTeamFilter"
        @day-click="onCalendarDayClick"
        @slot-click="openSlotDetail"
        @add-demand="openPublish"
      />
    </section>

    <section v-else-if="tab === 'apps'" class="panel">
      <p class="hint">灵工报名后进入待审批；白名单人员报名自动通过并写入排班</p>
      <div v-if="!pendingApps.length" class="empty">暂无待审批报名</div>
      <article v-for="a in pendingApps" :key="a.id" class="card">
        <strong>{{ a.employeeName }}</strong>
        <p>{{ a.date }} · {{ a.positionName }} · {{ a.shiftName }}</p>
        <p class="sub">
          {{ a.departmentDisplayName }} · {{ a.employeeNo }} · 名额 {{ a.progress }}
        </p>
        <div class="btns">
          <button type="button" class="ghost" @click="review(a.id, false)">驳回</button>
          <button
            v-if="!a.alreadyWhitelisted"
            type="button"
            class="soft"
            @click="reviewAndWhitelist(a.id, a.employeeId, a.attendanceGroupId)"
          >
            通过并加白名单
          </button>
          <button type="button" class="ok" @click="review(a.id, true)">通过</button>
        </div>
      </article>
    </section>

    <section v-else class="panel">
      <p class="hint">白名单人员报名抢班时自动通过，无需人工审批</p>
      <div class="wl-toolbar">
        <select v-model="selectedGroupId">
          <option v-for="g in groupList" :key="g.id" :value="g.id">{{ g.name }}</option>
        </select>
      </div>
      <div class="wl-add">
        <select v-model="whitelistForm.employeeId">
          <option value="" disabled>选择人员</option>
          <option v-for="opt in whitelistCandidateOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
        <input
          v-model="whitelistForm.remark"
          type="text"
          maxlength="50"
          placeholder="备注（可选）"
        >
        <button
          type="button"
          class="ok"
          :disabled="!whitelistCandidateOptions.length"
          @click="submitWhitelist"
        >
          添加
        </button>
      </div>
      <article v-for="w in whitelistTableData" :key="w.id" class="card wl-card">
        <div class="card-top">
          <div>
            <strong>{{ w.employeeName }}</strong>
            <p>{{ w.employeeNo }} · {{ w.position }}</p>
            <p class="sub">{{ w.remark || '无备注' }} · {{ formatTime(w.createdAt) }}</p>
          </div>
          <button type="button" class="ghost" @click="removeWhitelist(w.id, w.employeeName)">
            移出
          </button>
        </div>
      </article>
      <div v-if="!whitelistTableData.length" class="empty">当前考勤组暂无白名单人员</div>
    </section>

    <div v-if="slotDetailOpen && selectedSlot" class="sheet-mask slot-detail-mask" @click.self="closeSlotDetail">
      <div class="sheet slot-detail-sheet">
        <header>
          <button type="button" class="back-btn" @click="closeSlotDetail">‹ 返回</button>
          <strong>班次详情</strong>
          <button type="button" class="close" @click="closeSlotDetail">×</button>
        </header>

        <div class="detail-block">
          <h4>{{ selectedSlot.positionName || selectedSlot.displayShiftName }}</h4>
          <div class="tag-col inline-tags">
            <span class="status publish">{{ selectedSlot.publishLabel }}</span>
            <span class="status" :class="selectedSlot.status">{{ selectedSlot.statusLabel }}</span>
          </div>
        </div>

        <dl class="detail-list">
          <div><dt>日期</dt><dd>{{ selectedSlot.date }}</dd></div>
          <div><dt>班次</dt><dd>{{ selectedSlot.displayShiftName }}</dd></div>
          <div><dt>时段</dt><dd>{{ selectedSlot.startTime }} - {{ selectedSlot.endTime }}</dd></div>
          <div><dt>部门</dt><dd>{{ selectedSlot.departmentDisplayName }}</dd></div>
          <div><dt>班组</dt><dd>{{ selectedSlot.teamName || '—' }}</dd></div>
          <div><dt>名额</dt><dd>已抢 {{ selectedSlot.grabbedCount }}/{{ selectedSlot.requiredCount }}</dd></div>
          <div v-if="selectedSlot.effectiveHourlyRate != null">
            <dt>时薪</dt><dd>¥{{ selectedSlot.effectiveHourlyRate }}/h</dd>
          </div>
          <div v-if="selectedSlotProfile?.jobType">
            <dt>类型</dt><dd>{{ selectedSlotProfile.jobType }}</dd>
          </div>
          <div>
            <dt>年龄</dt>
            <dd>{{ formatGrabPositionAgeRange(selectedSlotProfile?.ageMin, selectedSlotProfile?.ageMax) }}</dd>
          </div>
          <div>
            <dt>性别</dt>
            <dd>{{ formatGrabPositionGender(selectedSlotProfile?.gender) }}</dd>
          </div>
          <div v-if="selectedSlotProfile?.experience">
            <dt>经验</dt><dd>{{ selectedSlotProfile.experience }}</dd>
          </div>
        </dl>

        <div v-if="selectedSlotProfile?.requirements || selectedSlot.positionRequirement" class="detail-section">
          <strong>任职要求</strong>
          <p>{{ selectedSlotProfile?.requirements || selectedSlot.positionRequirement }}</p>
        </div>

        <div v-if="selectedSlotProfile?.description" class="detail-section">
          <strong>岗位描述</strong>
          <p>{{ selectedSlotProfile.description }}</p>
        </div>

        <div v-if="(selectedSlotProfile?.skills || selectedSlot.requirements)?.length" class="detail-section">
          <strong>技能要求</strong>
          <div class="skill-tags">
            <span
              v-for="sk in selectedSlotProfile?.skills?.length ? selectedSlotProfile.skills : selectedSlot.requirements"
              :key="sk"
              class="skill"
            >{{ sk }}</span>
          </div>
        </div>

        <div class="detail-section">
          <strong>报名情况（{{ selectedSlot.applicants.length }}）</strong>
          <ul class="apps detail-apps">
            <li v-for="a in selectedSlot.applicants" :key="a.id">
              <span>
                {{ a.employeeName }}
                <em v-if="a.whitelisted" class="wl-tag">白名单</em>
              </span>
              <em :class="a.status">{{ appStatusLabel(a.status, a.reviewNote) }}</em>
            </li>
            <li v-if="!selectedSlot.applicants.length" class="empty-inline">暂无报名</li>
          </ul>
        </div>
      </div>
    </div>

    <div v-if="publishOpen" class="sheet-mask" @click.self="closePublish">
      <div class="sheet">
        <header>
          <strong>发布抢班需求</strong>
          <button type="button" class="close" @click="closePublish">×</button>
        </header>
        <p class="sheet-hint">岗位选自企业岗位库，部门用于发布范围；提交后进入发布审批</p>

        <label>考勤组</label>
        <select v-model="publishForm.groupId">
          <option v-for="g in groupList" :key="g.id" :value="g.id">{{ g.name }}</option>
        </select>

        <label>部门（发布范围）</label>
        <select v-model="publishForm.departmentId">
          <option
            v-for="d in publishDepartmentOptions"
            :key="d.departmentId"
            :value="d.departmentId"
          >
            {{ d.departmentName }}
          </option>
        </select>

        <label>岗位（企业岗位库）</label>
        <select
          :value="publishForm.positionId"
          @change="applyEnterprisePosition(($event.target as HTMLSelectElement).value)"
        >
          <option v-for="p in enterprisePositions" :key="p.id" :value="p.id">
            {{ p.profile.positionName || p.name }}
          </option>
        </select>
        <p class="sheet-hint">选择后带出岗位画像，可按本次发布调整</p>

        <label>日期</label>
        <input v-model="publishForm.date" type="date">

        <label>班次</label>
        <select v-model="publishForm.shiftTemplateId">
          <option v-for="t in templateShiftOptions" :key="t.templateId" :value="t.templateId">
            {{ t.templateName }}（{{ t.startTime.slice(0, 5) }}-{{ t.endTime.slice(0, 5) }}）
          </option>
        </select>

        <label>需要人数</label>
        <input v-model.number="publishForm.requiredCount" type="number" min="1">

        <label>时薪补贴</label>
        <input v-model.number="publishForm.hourlySubsidy" type="number" min="0">
        <p v-if="publishPreviewRate != null" class="rate-tip">预计时薪 ¥{{ publishPreviewRate }}/h</p>

        <label>岗位类型</label>
        <input v-model="publishForm.jobType" placeholder="如：零售服务">

        <label>技能（顿号分隔）</label>
        <input v-model="publishForm.skillsText" placeholder="健康证、业务合规证">

        <label>任职要求</label>
        <textarea v-model="publishForm.positionRequirement" rows="3" placeholder="任职要求" />

        <label>岗位描述</label>
        <textarea v-model="publishForm.description" rows="2" placeholder="岗位职责与工作内容" />

        <label>年龄范围</label>
        <div class="age-row">
          <input v-model.number="publishForm.ageMin" type="number" min="16" max="70" placeholder="最小">
          <span>—</span>
          <input v-model.number="publishForm.ageMax" type="number" min="16" max="70" placeholder="最大">
        </div>

        <label>性别要求</label>
        <select v-model="publishForm.gender">
          <option value="any">不限</option>
          <option value="male">男</option>
          <option value="female">女</option>
        </select>

        <label>经验要求</label>
        <input v-model="publishForm.experience" placeholder="如：不限 / 1年以上">

        <button type="button" class="submit" @click="publish">提交发布审批</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.wl-toolbar select,
.wl-add select,
.wl-add input,
.sheet select,
.sheet input,
.sheet textarea {
  height: 34px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 0 10px;
  font-size: 13px;
  color: #374151;
  background: #fff;
}
.tabs {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  margin: 10px 16px 0;
  background: #f3f4f6;
  border-radius: 10px;
  padding: 3px;
}
.tabs button {
  border: none;
  background: transparent;
  height: 34px;
  border-radius: 8px;
  font-size: 13px;
  color: #6b7280;
}
.tabs button.active {
  background: #fff;
  color: #228BFF;
  font-weight: 600;
}
.panel {
  padding: 12px 16px 28px;
}
.slots-panel {
  padding-top: 8px;
}
.slot-detail-mask {
  z-index: 55;
}
.slot-detail-sheet {
  max-height: 86vh;
}
.back-btn {
  border: none;
  background: none;
  color: var(--mini-primary, #228BFF);
  font-size: 14px;
  padding: 0;
}
.detail-block h4 {
  margin: 0 0 8px;
  font-size: 16px;
}
.inline-tags {
  flex-direction: row;
  align-items: center;
}
.detail-list {
  margin: 12px 0;
  display: grid;
  gap: 8px;
}
.detail-list div {
  display: flex;
  gap: 12px;
  font-size: 13px;
}
.detail-list dt {
  width: 48px;
  flex-shrink: 0;
  color: var(--mini-text-muted, #9ca3af);
}
.detail-list dd {
  margin: 0;
  color: var(--mini-text, #374151);
}
.detail-section {
  margin-top: 12px;
}
.detail-section strong {
  display: block;
  font-size: 13px;
  margin-bottom: 6px;
  color: var(--mini-text, #374151);
}
.detail-section p {
  margin: 0;
  font-size: 13px;
  color: var(--mini-text-secondary, #6b7280);
  line-height: 1.5;
}
.detail-apps {
  margin-top: 4px;
}
.hint {
  margin: 0 0 10px;
  font-size: 12px;
  color: #9ca3af;
}
.card {
  background: #fff;
  border-radius: 12px;
  padding: 12px;
  margin-bottom: 8px;
  box-shadow: var(--mini-shadow);
}
.card-top {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  align-items: flex-start;
}
.card-top p,
.card > p {
  margin: 4px 0 0;
  font-size: 12px;
  color: #6b7280;
}
.sub {
  color: #9ca3af !important;
}
.tag-col {
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: flex-end;
}
.status {
  flex-shrink: 0;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  background: #f3f4f6;
  color: #6b7280;
  height: fit-content;
}
.status.open { background: #fef2f2; color: #dc2626; }
.status.partial { background: #fffbeb; color: #d97706; }
.status.full { background: #ecfdf5; color: #059669; }
.status.publish { background: #D5E9FF; color: #228BFF; }
.apps {
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
}
.apps li {
  display: flex;
  justify-content: space-between;
  padding: 6px 0;
  border-top: 1px dashed #f3f4f6;
  font-size: 12px;
  color: #374151;
}
.apps em {
  font-style: normal;
  color: #9ca3af;
}
.apps em.pending { color: #d97706; }
.apps em.approved { color: #059669; }
.apps em.rejected { color: #dc2626; }
.wl-tag {
  margin-left: 6px;
  font-size: 10px;
  color: #228BFF !important;
  background: #D5E9FF;
  padding: 1px 6px;
  border-radius: 999px;
}
.empty-inline {
  justify-content: center !important;
  color: #9ca3af !important;
  border-top: none !important;
}
.btns {
  display: flex;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}
.ghost {
  border: 1px solid #fecaca;
  background: #fff;
  color: #b91c1c;
  border-radius: 8px;
  height: 30px;
  padding: 0 10px;
  font-size: 12px;
}
.soft {
  border: 1px solid #c7d2fe;
  background: #D5E9FF;
  color: #228BFF;
  border-radius: 8px;
  height: 30px;
  padding: 0 10px;
  font-size: 12px;
}
.ok {
  border: none;
  background: #228BFF;
  color: #fff;
  border-radius: 8px;
  height: 30px;
  padding: 0 12px;
  font-size: 12px;
}
.ok:disabled {
  opacity: 0.5;
}
.wl-toolbar {
  margin-bottom: 8px;
}
.wl-toolbar select {
  width: 100%;
}
.wl-add {
  display: grid;
  grid-template-columns: 1fr;
  gap: 8px;
  margin-bottom: 12px;
}
.wl-add .ok {
  height: 36px;
}
.wl-card .ghost {
  flex-shrink: 0;
}
.empty {
  padding: 40px 0;
  text-align: center;
  color: #9ca3af;
  font-size: 13px;
}
.sheet-mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  z-index: 40;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.sheet {
  width: min(420px, 100%);
  max-height: 86vh;
  overflow: auto;
  background: #fff;
  border-radius: 16px 16px 0 0;
  padding: 16px 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sheet header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.sheet .close {
  border: none;
  background: none;
  font-size: 22px;
  color: #9ca3af;
}
.sheet-hint {
  margin: 0;
  font-size: 12px;
  color: #9ca3af;
}
.sheet label {
  font-size: 12px;
  color: #6b7280;
  margin-top: 4px;
}
.sheet textarea {
  height: auto;
  padding: 10px;
  resize: vertical;
}
.age-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.age-row input {
  flex: 1;
}
.rate-tip {
  margin: 0;
  font-size: 12px;
  color: #228BFF;
}
.submit {
  margin-top: 8px;
  height: 42px;
  border: none;
  border-radius: 10px;
  background: #228BFF;
  color: #fff;
  font-weight: 600;
}
.skill-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-height: 28px;
  align-items: center;
}
.skill {
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 999px;
  background: #f3f4f6;
  color: #374151;
}
</style>
