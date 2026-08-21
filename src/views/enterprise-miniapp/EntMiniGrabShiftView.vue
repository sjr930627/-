<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import EntMiniNavBar from '@/components/enterprise-miniapp/EntMiniNavBar.vue'
import { useAppStore } from '@/stores/app'
import { useEnterpriseMiniAuth } from '@/composables/useEnterpriseMiniAuth'
import { normalizeDeptInterviewRule } from '@/constants/grabInterview'
import {
  buildGrabShiftSlotPayload,
  calcGrabShiftEffectiveRate,
  getGrabShiftScopeOptions,
  getGrabShiftTemplateOptions,
  grabShiftPublishStatusMap,
  resolveGrabShiftBaseHourlyRate,
  resolveGrabSlotDepartmentId,
  resolveGrabSlotDepartmentName,
  resolveGrabSlotShiftName,
} from '@/services/grabShift'
import {
  resolveEnterpriseIdByAttendanceGroupId,
  resolveEnterpriseIdByDepartment,
} from '@/utils/enterpriseScope'

const store = useAppStore()
const router = useRouter()
const { enterpriseId, displayName } = useEnterpriseMiniAuth()
const operatorName = computed(() => displayName.value || '企业小程序')

type TabKey = 'slots' | 'apps' | 'whitelist'
const tab = ref<TabKey>('slots')
const publishOpen = ref(false)
const listDeptFilter = ref<'all' | string>('all')
const listPositionFilter = ref<'all' | string>('all')
const expandedSlotId = ref('')

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

const publishForm = ref({
  groupId: '',
  departmentId: '',
  positionId: '',
  date: '2026-07-28',
  shiftTemplateId: '',
  requiredCount: 2,
  hourlySubsidy: 5,
  positionName: '',
  positionRequirement: '',
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

const publishDeptPositions = computed(() => {
  const dept = interviewDeptOptions.value.find((d) => d.departmentId === publishForm.value.departmentId)
  return dept?.positions ?? []
})

const selectedInterviewPosition = computed(() =>
  publishDeptPositions.value.find((p) => p.id === publishForm.value.positionId),
)

const enterpriseDepartments = computed(() =>
  store.departments.filter((d) => {
    if (d.orgType === 'enterprise') return false
    return resolveEnterpriseIdByDepartment(d.id, store.departments) === enterpriseId.value
  }),
)

const departmentFilterOptions = computed(() => [
  { value: 'all', label: '全部部门' },
  ...enterpriseDepartments.value.map((d) => ({ value: d.id, label: d.name })),
])

const positionFilterOptions = computed(() => {
  const names = new Set<string>()
  interviewDeptOptions.value.forEach((d) => {
    d.positions.forEach((p) => {
      if (p.profile.positionName?.trim()) names.add(p.profile.positionName.trim())
    })
  })
  store.grabShiftSlots.forEach((s) => {
    if (s.positionName?.trim() && matchesEnterpriseSlot(s.attendanceGroupId)) {
      names.add(s.positionName.trim())
    }
  })
  return [
    { value: 'all', label: '全部岗位' },
    ...[...names].sort().map((name) => ({ value: name, label: name })),
  ]
})

watch(
  groupList,
  (list) => {
    if (!list.some((g) => g.id === selectedGroupId.value)) {
      selectedGroupId.value = list[0]?.id ?? ''
    }
  },
  { immediate: true },
)

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

function matchesDeptFilter(slot: { departmentId?: string; teamId: string }) {
  if (listDeptFilter.value === 'all') return true
  return resolveGrabSlotDepartmentId(slot, store.teams) === listDeptFilter.value
}

function matchesPositionFilter(slot: { positionName?: string }) {
  if (listPositionFilter.value === 'all') return true
  return (slot.positionName ?? '') === listPositionFilter.value
}

const slots = computed(() =>
  store.grabShiftSlots
    .filter((s) => matchesEnterpriseSlot(s.attendanceGroupId))
    .filter((s) => matchesDeptFilter(s))
    .filter((s) => matchesPositionFilter(s))
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
      if (!matchesDeptFilter(slot) || !matchesPositionFilter(slot)) return null
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

function applyInterviewPosition(positionId: string) {
  const pos = publishDeptPositions.value.find((p) => p.id === positionId)
  if (!pos) return
  publishForm.value.positionId = pos.id
  publishForm.value.positionName = pos.profile.positionName
  publishForm.value.positionRequirement =
    [pos.profile.requirements, pos.profile.description].filter(Boolean).join('\n') || ''
  publishForm.value.requirements = [...(pos.profile.skills ?? [])]
}

function syncPublishDefaults() {
  const dept =
    interviewDeptOptions.value.find((d) =>
      groupList.value.some((g) =>
        g.departmentBindings.some((b) => b.departmentId === d.departmentId),
      ),
    ) || interviewDeptOptions.value[0]
  const position = dept?.positions[0]
  publishForm.value.departmentId = dept?.departmentId || ''
  preferGroupForDepartment(publishForm.value.departmentId)
  if (!publishForm.value.groupId) {
    publishForm.value.groupId = groupList.value[0]?.id || ''
  }
  publishForm.value.date = '2026-07-28'
  publishForm.value.requiredCount = 2
  publishForm.value.hourlySubsidy = 5
  const templates = getGrabShiftTemplateOptions(
    store.attendanceGroups.find((g) => g.id === publishForm.value.groupId),
    store.shifts,
  )
  publishForm.value.shiftTemplateId = templates[0]?.templateId || ''
  if (position) {
    applyInterviewPosition(position.id)
  } else {
    publishForm.value.positionId = ''
    publishForm.value.positionName = ''
    publishForm.value.positionRequirement = ''
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
    const first = interviewDeptOptions.value.find((d) => d.departmentId === deptId)?.positions[0]
    if (first) applyInterviewPosition(first.id)
    else {
      publishForm.value.positionId = ''
      publishForm.value.positionName = ''
      publishForm.value.positionRequirement = ''
      publishForm.value.requirements = []
    }
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

function toggleExpand(id: string) {
  expandedSlotId.value = expandedSlotId.value === id ? '' : id
}

function openPublish() {
  if (!interviewDeptOptions.value.length) {
    ElMessage.warning('请先在「抢班面试配置」中配置部门岗位')
    router.push('/enterprise-miniapp/grab-interview')
    return
  }
  if (!groupList.value.length) {
    ElMessage.warning('当前企业暂无可用考勤组')
    return
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
  if (!publishForm.value.positionId || !selectedInterviewPosition.value) {
    ElMessage.warning('请选择面试配置中的岗位')
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
  if (!publishForm.value.positionRequirement.trim()) {
    ElMessage.warning('请填写岗位要求')
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

  const skills = publishForm.value.requirements.length
    ? publishForm.value.requirements
    : selectedInterviewPosition.value.profile.skills?.length
      ? selectedInterviewPosition.value.profile.skills
      : ['健康证']

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
        positionName: publishForm.value.positionName.trim(),
        positionRequirement: publishForm.value.positionRequirement.trim(),
        requirements: skills,
        teams: store.teams,
        shifts: store.shifts,
        holidays: store.holidays,
      }),
    )
    ElMessage.success('抢班需求已提交，待发布审批通过后上架')
    closePublish()
    tab.value = 'slots'
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

function appStatusLabel(status: string, reviewNote?: string) {
  if (status === 'pending') return '待审'
  if (status === 'approved') {
    return reviewNote === '白名单免审批' ? '已通过（白名单）' : '已通过'
  }
  if (status === 'rejected') return '已驳回'
  if (status === 'cancelled') return '已取消'
  return status
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

    <div class="header-actions">
      <button type="button" class="ghost-btn" @click="router.push('/enterprise-miniapp/grab-interview')">
        面试配置
      </button>
      <button type="button" class="ghost-btn" @click="tab = 'whitelist'">白名单</button>
      <button type="button" class="primary-btn" @click="openPublish">发布抢班</button>
    </div>

    <button type="button" class="interview-banner" @click="router.push('/enterprise-miniapp/grab-interview')">
      <strong>岗位来源：抢班面试配置</strong>
      <p>
        {{ interviewConfig.requireInterview ? '当前开启抢班面试' : '当前未强制面试' }}
        · 已配置 {{ interviewDeptOptions.length }} 个部门岗位 · 点击去配置
      </p>
    </button>

    <div class="filters">
      <select v-model="listDeptFilter">
        <option v-for="opt in departmentFilterOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
      <select v-model="listPositionFilter">
        <option v-for="opt in positionFilterOptions" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
    </div>

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

    <section v-if="tab === 'slots'" class="panel">
      <p class="hint">按面试配置岗位发布抢班需求；可展开查看报名明细</p>
      <article v-for="s in slots" :key="s.id" class="card">
        <div class="card-top">
          <div>
            <strong>{{ s.positionName || s.displayShiftName }}</strong>
            <p>{{ s.date }} · {{ s.displayShiftName }} · {{ s.startTime }}-{{ s.endTime }}</p>
            <p>{{ s.departmentDisplayName }} · {{ s.teamName }}</p>
          </div>
          <div class="tag-col">
            <span class="status publish">{{ s.publishLabel }}</span>
            <span class="status" :class="s.status">{{ s.statusLabel }}</span>
          </div>
        </div>
        <div class="progress">
          <span>已抢 {{ s.grabbedCount }}/{{ s.requiredCount }}</span>
          <span>待审 {{ s.pendingCount }}</span>
          <span>通过 {{ s.approvedCount }}</span>
        </div>
        <button type="button" class="link" @click="toggleExpand(s.id)">
          {{ expandedSlotId === s.id ? '收起报名' : '查看报名情况' }}
        </button>
        <ul v-if="expandedSlotId === s.id" class="apps">
          <li v-for="a in s.applicants" :key="a.id">
            <span>
              {{ a.employeeName }}
              <em v-if="a.whitelisted" class="wl-tag">白名单</em>
            </span>
            <em :class="a.status">{{ appStatusLabel(a.status, a.reviewNote) }}</em>
          </li>
          <li v-if="!s.applicants.length" class="empty-inline">暂无报名</li>
        </ul>
      </article>
      <div v-if="!slots.length" class="empty">暂无抢班班次</div>
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

    <div v-if="publishOpen" class="sheet-mask" @click.self="closePublish">
      <div class="sheet">
        <header>
          <strong>发布抢班需求</strong>
          <button type="button" class="close" @click="closePublish">×</button>
        </header>
        <p class="sheet-hint">岗位与要求同步自 PC 端「抢班面试管理」配置，提交后进入发布审批</p>

        <label>考勤组</label>
        <select v-model="publishForm.groupId">
          <option v-for="g in groupList" :key="g.id" :value="g.id">{{ g.name }}</option>
        </select>

        <label>部门（面试配置）</label>
        <select v-model="publishForm.departmentId">
          <option
            v-for="d in interviewDeptOptions"
            :key="d.departmentId"
            :value="d.departmentId"
          >
            {{ d.departmentName }}
          </option>
        </select>

        <label>岗位（面试配置）</label>
        <select
          :value="publishForm.positionId"
          @change="applyInterviewPosition(($event.target as HTMLSelectElement).value)"
        >
          <option v-for="p in publishDeptPositions" :key="p.id" :value="p.id">
            {{ p.profile.positionName }}
          </option>
        </select>

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

        <label>岗位要求</label>
        <textarea v-model="publishForm.positionRequirement" rows="3" />

        <label>技能要求</label>
        <div class="skill-tags">
          <span v-for="sk in publishForm.requirements" :key="sk" class="skill">{{ sk }}</span>
          <span v-if="!publishForm.requirements.length" class="sub">未配置技能，将默认健康证</span>
        </div>

        <button type="button" class="submit" @click="publish">提交发布审批</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.header-actions {
  padding: 10px 16px 0;
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.primary-btn,
.ghost-btn {
  height: 34px;
  padding: 0 14px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
}
.primary-btn {
  border: none;
  background: #5b4fdb;
  color: #fff;
}
.ghost-btn {
  border: 1px solid #ddd6fe;
  background: #fff;
  color: #5b4fdb;
}
.interview-banner {
  margin: 10px 16px 0;
  padding: 10px 12px;
  border-radius: 10px;
  background: linear-gradient(135deg, #f5f3ff, #eef2ff);
  border: 1px solid #e9e5ff;
  width: calc(100% - 32px);
  text-align: left;
  cursor: pointer;
}
.interview-banner strong {
  font-size: 13px;
  color: #4338ca;
}
.interview-banner p {
  margin: 4px 0 0;
  font-size: 12px;
  color: #6b7280;
}
.filters {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin: 10px 16px 0;
}
.filters select,
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
  color: #5b4fdb;
  font-weight: 600;
}
.panel {
  padding: 12px 16px 28px;
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
.status.publish { background: #eef2ff; color: #4338ca; }
.progress {
  display: flex;
  gap: 12px;
  margin-top: 8px;
  font-size: 12px;
  color: #374151;
}
.link {
  margin-top: 8px;
  border: none;
  background: none;
  color: #5b4fdb;
  font-size: 12px;
  padding: 0;
}
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
  color: #5b4fdb !important;
  background: #eef2ff;
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
  background: #eef2ff;
  color: #4338ca;
  border-radius: 8px;
  height: 30px;
  padding: 0 10px;
  font-size: 12px;
}
.ok {
  border: none;
  background: #5b4fdb;
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
.rate-tip {
  margin: 0;
  font-size: 12px;
  color: #5b4fdb;
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
.submit {
  margin-top: 8px;
  height: 42px;
  border: none;
  border-radius: 10px;
  background: #5b4fdb;
  color: #fff;
  font-weight: 600;
}
</style>
