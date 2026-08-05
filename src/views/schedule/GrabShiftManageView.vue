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
} from '@/utils/enterpriseScope'
import {
  buildGrabShiftSlotPayload,
  calcGrabShiftEffectiveRate,
  getGrabShiftScopeOptions,
  getGrabShiftTemplateOptions,
  GRAB_SHIFT_GLOBAL_TEAM_ID,
  resolveGrabShiftBaseHourlyRateDetail,
  resolveGrabSlotShiftName,
} from '@/services/grabShift'
import type { GrabShiftSlot } from '@/types'
import GrabShiftCalendar from '@/components/schedule/GrabShiftCalendar.vue'

const store = useAppStore()
const route = useRoute()
const router = useRouter()
const { enterpriseFilter, matchesEnterprise, enterpriseName, showEnterpriseControl } =
  useEnterpriseScope('filter')

const selectedGroupId = ref('ag_factory')
const listGroupFilter = ref<'all' | 'global' | string>('all')
const activeTab = ref<'calendar' | 'slots' | 'approval'>('calendar')
const slotStatusFilter = ref<'all' | 'open' | 'partial' | 'full' | 'cancelled'>('all')
const publishVisible = ref(false)
const detailVisible = ref(false)
const whitelistVisible = ref(false)
const currentSlot = ref<GrabShiftSlot | null>(null)
const whitelistForm = ref({ employeeId: '', remark: '' })

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
  hourlySubsidy: 0,
  positionRequirement: '',
  requirements: [] as string[],
})

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

const listGroupFilterOptions = computed(() => [
  { value: 'all', label: '全部考勤组及全局' },
  { value: 'global', label: '全局' },
  ...groupList.value.map((g) => ({ value: g.id, label: g.name })),
])

function isGlobalGrabSlot(slot: GrabShiftSlot) {
  return slot.scope === 'global' || slot.teamId === GRAB_SHIFT_GLOBAL_TEAM_ID
}

function isShiftGroupSlot(slot: GrabShiftSlot) {
  const group = store.attendanceGroups.find((g) => g.id === slot.attendanceGroupId)
  return Boolean(group && group.attendanceType === 'shift')
}

function matchesListGroupFilter(slot: GrabShiftSlot) {
  if (!isShiftGroupSlot(slot)) return false
  if (listGroupFilter.value === 'all') return true
  if (listGroupFilter.value === 'global') return isGlobalGrabSlot(slot)
  return slot.attendanceGroupId === listGroupFilter.value
}

function resolveSlotGroupName(slot: GrabShiftSlot) {
  return store.attendanceGroups.find((g) => g.id === slot.attendanceGroupId)?.name ?? '—'
}

const slotTableData = computed(() =>
  store.grabShiftSlots
    .filter((s) => matchesListGroupFilter(s))
    .filter((s) => {
      const enterpriseId = resolveEnterpriseIdByAttendanceGroupId(
        s.attendanceGroupId,
        store.attendanceGroups,
        store.departments,
      )
      return matchesEnterprise(enterpriseId)
    })
    .filter((s) => slotStatusFilter.value === 'all' || s.status === slotStatusFilter.value)
    .map((slot) => {
      const pendingApps = store.grabShiftApplications.filter(
        (a) => a.slotId === slot.id && a.status === 'pending',
      ).length
      const globalScope = isGlobalGrabSlot(slot)
      const enterpriseId = resolveEnterpriseIdByAttendanceGroupId(
        slot.attendanceGroupId,
        store.attendanceGroups,
        store.departments,
      )
      return {
        ...slot,
        enterpriseName: enterpriseName(enterpriseId),
        groupName: resolveSlotGroupName(slot),
        displayShiftName: resolveGrabSlotShiftName(slot),
        scopeLabel: globalScope
          ? '全局'
          : slot.departmentName ?? slot.teamName,
        pendingApps,
        gap: Math.max(0, slot.requiredCount - slot.grabbedCount),
        statusLabel: grabStatusMap[slot.status]?.label ?? slot.status,
        statusType: grabStatusMap[slot.status]?.type ?? 'info',
      }
    })
    .sort((a, b) => b.date.localeCompare(a.date) || a.startTime.localeCompare(b.startTime)),
)

const pendingApplications = computed(() =>
  store.grabShiftApplications
    .filter((a) => a.status === 'pending')
    .filter((a) => {
      const slot = store.grabShiftSlots.find((s) => s.id === a.slotId)
      if (!slot) return false
      if (!matchesListGroupFilter(slot)) return false
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
        employeeNo: emp?.employeeNo ?? '—',
        shiftName: slot ? resolveGrabSlotShiftName(slot) : '—',
        groupName: slot ? resolveSlotGroupName(slot) : '—',
        date: slot?.date ?? '—',
        teamName: slot?.teamName ?? '—',
        slotStatus: slot?.status ?? 'cancelled',
      }
    }),
)

const pendingCount = computed(() => pendingApplications.value.length)

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
      statusLabel:
        app.status === 'pending'
          ? '待审批'
          : app.status === 'approved'
            ? app.reviewNote === '白名单免审批'
              ? '已通过（白名单）'
              : '已通过'
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
    hourlySubsidy: 0,
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
      hourlySubsidy: publishForm.value.hourlySubsidy,
      positionRequirement: publishForm.value.positionRequirement,
      requirements: publishForm.value.requirements,
      teams: store.teams,
      shifts: store.shifts,
      holidays: store.holidays,
    }),
  )
  publishVisible.value = false
  ElMessage.success('抢班班次已发布，灵工可在自助端报名')
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

async function cancelSlot(id: string) {
  await ElMessageBox.confirm('取消后该班次将不再接受报名，是否继续？', '取消抢班班次', {
    type: 'warning',
  })
  store.cancelGrabShiftSlot(id)
  ElMessage.success('已取消')
}

function showSlotDetail(slot: GrabShiftSlot) {
  currentSlot.value = slot
  detailVisible.value = true
}

function onCalendarSlotClick(slot: GrabShiftSlot) {
  showSlotDetail(slot)
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
    activeTab.value = 'slots'
    showSlotDetail(slot)
  },
  { immediate: true },
)
</script>

<template>
  <div class="grab-shift-page">
    <header class="page-card page-header">
      <div>
        <h2 class="page-title">抢班管理</h2>
        <p class="text-muted">发布抢班班次，管理灵工报名与审批 · 列表展示全部考勤组及全局 · 待审批 {{ pendingCount }} 条</p>
      </div>
      <div class="header-actions">
        <EnterpriseScopeSelect
          v-if="showEnterpriseControl"
          v-model="enterpriseFilter"
          mode="filter"
          width="180px"
        />
        <span class="header-label text-muted">发布/白名单考勤组</span>
        <el-select v-model="selectedGroupId" style="width: 200px">
          <el-option v-for="g in groupList" :key="g.id" :label="g.name" :value="g.id" />
        </el-select>
        <el-button @click="goScheduleManage">返回排班管理</el-button>
        <el-button :icon="UserFilled" @click="openWhitelist">白名单管理</el-button>
        <el-button type="primary" :icon="Plus" @click="openPublish">发布抢班</el-button>
      </div>
    </header>

    <div class="page-card">
      <el-tabs v-model="activeTab">
        <el-tab-pane label="班次日历" name="calendar">
          <div class="filter-bar">
            <el-select v-model="listGroupFilter" style="width: 200px" size="small">
              <el-option
                v-for="opt in listGroupFilterOptions"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
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
            <el-select v-model="listGroupFilter" style="width: 200px" size="small">
              <el-option
                v-for="opt in listGroupFilterOptions"
                :key="opt.value"
                :label="opt.label"
                :value="opt.value"
              />
            </el-select>
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
            <el-table-column prop="groupName" label="考勤组" min-width="140" show-overflow-tooltip />
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
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.statusType" size="small">{{ row.statusLabel }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="160" fixed="right">
              <template #default="{ row }">
                <el-button link type="primary" @click="showSlotDetail(row)">详情</el-button>
                <el-button
                  v-if="row.status !== 'cancelled' && row.status !== 'full'"
                  link
                  type="danger"
                  @click="cancelSlot(row.id)"
                >
                  取消
                </el-button>
              </template>
            </el-table-column>
          </el-table>
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
            <el-table-column prop="groupName" label="考勤组" min-width="130" show-overflow-tooltip />
            <el-table-column prop="employeeName" label="报名人" width="100" />
            <el-table-column prop="employeeNo" label="工号" width="100" />
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
      <el-alert type="info" :closable="false" title="发布后灵工可在自助端查看并报名；白名单人员免审批" style="margin-bottom: 16px" />
      <el-form label-width="108px">
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
        <el-button type="primary" @click="submitPublish">发布</el-button>
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
          <el-descriptions-item label="班次">{{ resolveGrabSlotShiftName(currentSlot) }}</el-descriptions-item>
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
          <el-table-column prop="employeeName" label="报名人" />
          <el-table-column prop="statusLabel" label="状态" width="80" />
          <el-table-column prop="message" label="说明" show-overflow-tooltip />
        </el-table>
      </template>
    </el-drawer>
  </div>
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
</style>
