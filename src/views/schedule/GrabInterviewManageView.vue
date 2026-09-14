<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { useEnterpriseScope } from '@/composables/useEnterpriseScope'
import EnterpriseScopeSelect from '@/components/platform/EnterpriseScopeSelect.vue'
import PositionManageDialog from '@/components/employee/PositionManageDialog.vue'
import SkillLibraryManageDialog from '@/components/skill/SkillLibraryManageDialog.vue'
import {
  buildExactInterviewTimes,
  cloneSchedule,
  emptyPositionProfile,
  emptyScheduleRule,
  findDeptPosition,
  formatInterviewScheduleDisplay,
  formatRegistrationTime,
  formatSchedulePreviewText,
  formatSeatRuleLabel,
  grabInterviewRegStatusMap,
  normalizeDeptInterviewRule,
  profileFromTemplate,
  resolveInterviewSlotsForSchedule,
  resolvePositionSchedule,
  validateInterviewSchedule,
  weekdayFromDate,
  deptRequiresInterview,
} from '@/constants/grabInterview'
import GrabInterviewScheduleEditor from '@/components/schedule/GrabInterviewScheduleEditor.vue'
import { JOB_TYPE_OPTIONS } from '@/constants/recruitment'
import { generateId, getDepartmentName } from '@/utils'
import { isEnterpriseRootDepartment, isUnassignedDepartment } from '@/constants/department'
import type {
  GrabInterviewDeptPosition,
  GrabInterviewDeptRule,
  GrabInterviewRegStatus,
  GrabInterviewRegistration,
  GrabInterviewScheduleRule,
  GrabInterviewSeatUnitMinutes,
  GrabInterviewTimeSlot,
} from '@/types'

const store = useAppStore()
const route = useRoute()
const skillOptions = computed(() => store.skillLibraryOptions)
const skillLibVisible = ref(false)
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

watch(
  () => store.grabInterviewConfigs,
  () => {
    config.value = store.ensureGrabInterviewConfig(resolvedEnterpriseId.value)
  },
  { deep: true },
)

const positionCatalog = computed(() =>
  store.getEnterprisePositions(resolvedEnterpriseId.value),
)

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
    scheduleTemplateId: null,
    profile: emptyPositionProfile(),
    ruleScope: 'position',
    schedule: emptyScheduleRule(),
  }
}

function emptyDeptRule(departmentId: string): GrabInterviewDeptRule {
  return {
    departmentId,
    requireInterview: false,
    positions: [],
  }
}

const ruleForm = reactive<GrabInterviewDeptRule>(emptyDeptRule(''))
const editDialogVisible = ref(false)
const editingPosition = ref<GrabInterviewDeptPosition | null>(null)
const editingIsNew = ref(false)

const scheduleTemplates = computed(() =>
  store.getGrabInterviewScheduleTemplates(resolvedEnterpriseId.value),
)

watch(
  [selectedDeptId, () => config.value.deptRules],
  () => {
    if (editDialogVisible.value) return
    const existing = config.value.deptRules.find((r) => r.departmentId === selectedDeptId.value)
    const next = normalizeDeptInterviewRule(
      existing
        ? JSON.parse(JSON.stringify(existing))
        : emptyDeptRule(selectedDeptId.value),
      { fallbackRequireInterview: config.value.requireInterview },
    )
    Object.assign(ruleForm, {
      departmentId: next.departmentId,
      requireInterview: next.requireInterview ?? false,
      positions: next.positions,
    })
  },
  { immediate: true },
)

function validateSchedule(schedule: GrabInterviewScheduleRule, label: string) {
  const result = validateInterviewSchedule(schedule)
  if (!result.ok) {
    ElMessage.warning(`${label}：${result.message}`)
    return false
  }
  return true
}

function clonePosition(pos: GrabInterviewDeptPosition): GrabInterviewDeptPosition {
  return JSON.parse(JSON.stringify(pos))
}

function persistDeptRule(message?: string) {
  if (!selectedDeptId.value) return
  store.upsertGrabInterviewDeptRule(resolvedEnterpriseId.value, {
    departmentId: selectedDeptId.value,
    requireInterview: ruleForm.requireInterview,
    positions: JSON.parse(JSON.stringify(ruleForm.positions)),
  })
  if (message) ElMessage.success(message)
}

function onRequireInterviewChange(val: boolean) {
  if (!val) {
    persistDeptRule('已保存：本部门不需要面试')
    return
  }
  persistDeptRule('已开启本部门面试')
}

function openAddPosition() {
  if (!ruleForm.requireInterview) {
    ElMessage.warning('请先开启「本部门是否需要面试」')
    return
  }
  editingIsNew.value = true
  editingPosition.value = emptyPosition()
  editDialogVisible.value = true
}

function openEditPosition(pos: GrabInterviewDeptPosition) {
  editingIsNew.value = false
  const draft = clonePosition(pos)
  if (!draft.schedule) draft.schedule = emptyScheduleRule()
  editingPosition.value = draft
  editDialogVisible.value = true
}

function closeEditDialog() {
  editDialogVisible.value = false
  editingPosition.value = null
  editingIsNew.value = false
}

function applyTemplateToPosition(templateId: string) {
  const pos = editingPosition.value
  const tpl = positionCatalog.value.find((t) => t.id === templateId)
  if (!pos || !tpl) return
  pos.templateId = tpl.id
  pos.profile = profileFromTemplate(tpl)
  if (tpl.schedule) {
    pos.schedule = cloneSchedule(tpl.schedule)
    pos.scheduleTemplateId = null
  }
}

function applyScheduleTemplate(templateId: string) {
  const pos = editingPosition.value
  const tpl = scheduleTemplates.value.find((t) => t.id === templateId)
  if (!pos || !tpl) return
  pos.schedule = cloneSchedule(tpl.schedule)
  pos.scheduleTemplateId = tpl.id
  ElMessage.success(`已套用面试时间模版「${tpl.name}」`)
}

async function saveCurrentAsScheduleTemplate() {
  const pos = editingPosition.value
  if (!pos?.schedule) {
    ElMessage.warning('请先配置面试时间')
    return
  }
  if (!validateSchedule(pos.schedule, '当前面试时间')) return
  try {
    const { value } = await ElMessageBox.prompt('请输入模版名称', '保存为面试时间模版', {
      inputValue: `${pos.profile.positionName || '面试'}时间`,
      inputPlaceholder: '例如：工作日上午场',
      confirmButtonText: '保存',
      cancelButtonText: '取消',
    })
    const name = (value || '').trim()
    if (!name) {
      ElMessage.warning('请填写模版名称')
      return
    }
    const saved = store.upsertGrabInterviewScheduleTemplate(resolvedEnterpriseId.value, {
      id: generateId('gist'),
      name,
      schedule: cloneSchedule(pos.schedule),
    })
    pos.scheduleTemplateId = saved.id
    ElMessage.success('面试时间模版已保存')
  } catch {
    /* cancel */
  }
}

function validatePosition(pos: GrabInterviewDeptPosition) {
  if (!pos.templateId || !pos.profile.positionName?.trim()) {
    ElMessage.warning('请从岗位管理库选择岗位')
    return false
  }
  if (!pos.profile.description?.trim()) {
    ElMessage.warning('请填写岗位描述')
    return false
  }
  if (!pos.schedule) pos.schedule = emptyScheduleRule()
  if (!validateSchedule(pos.schedule, `岗位「${pos.profile.positionName}」面试时间`)) {
    return false
  }
  return true
}

function savePosition() {
  const pos = editingPosition.value
  if (!pos || !selectedDeptId.value) return
  if (!ruleForm.requireInterview) {
    ElMessage.warning('请先开启「本部门是否需要面试」')
    return
  }
  if (!validatePosition(pos)) return

  const name = pos.profile.positionName.trim()
  const duplicated = ruleForm.positions.some(
    (p) => p.id !== pos.id && p.profile.positionName.trim() === name,
  )
  if (duplicated) {
    ElMessage.warning('同一部门下岗位名称不可重复')
    return
  }

  const saved = clonePosition(pos)
  const idx = ruleForm.positions.findIndex((p) => p.id === saved.id)
  if (idx >= 0) ruleForm.positions[idx] = saved
  else ruleForm.positions.push(saved)

  persistDeptRule(editingIsNew.value ? '岗位已添加' : '岗位已保存')
  closeEditDialog()
}

async function removePosition(pos: GrabInterviewDeptPosition) {
  try {
    await ElMessageBox.confirm(
      `确定删除岗位「${pos.profile.positionName || '未命名岗位'}」？`,
      '提示',
      { type: 'warning' },
    )
    const idx = ruleForm.positions.findIndex((p) => p.id === pos.id)
    if (idx < 0) return
    ruleForm.positions.splice(idx, 1)
    if (editingPosition.value?.id === pos.id) closeEditDialog()
    persistDeptRule('岗位已删除')
  } catch {
    /* cancel */
  }
}

function schedulePreviewText(schedule?: GrabInterviewScheduleRule | null) {
  if (!schedule) return '—'
  return formatSchedulePreviewText(schedule)
}

function positionCardPreview(pos: GrabInterviewDeptPosition) {
  return schedulePreviewText(pos.schedule)
}

/* —— 企业岗位库（与人员管理共用） —— */
const positionManageVisible = ref(false)

function openPositionManage() {
  positionManageVisible.value = true
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

const editingRegPosition = computed(() => {
  if (!editingReg.value || !editingDeptRule.value) return null
  return findDeptPosition(editingDeptRule.value, editingReg.value.position) ?? null
})

const editingResolvedSchedule = computed(() => {
  if (!editingDeptRule.value) return emptyScheduleRule()
  return resolvePositionSchedule(editingDeptRule.value, editingRegPosition.value)
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
  return normalizeDeptInterviewRule(rule, {
    fallbackRequireInterview: config.value.requireInterview,
  }).positions.length
}

function deptNeedsInterview(departmentId: string) {
  const rule = config.value.deptRules.find((r) => r.departmentId === departmentId)
  return deptRequiresInterview(rule, config.value.requireInterview)
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
            <span class="switch-label">按部门配置是否需要面试与岗位面试时间</span>
            <el-button class="tpl-btn" @click="openPositionManage">岗位管理</el-button>
          </div>
          <p class="text-muted tip">
            选择部门后开启「是否需要面试」；岗位以卡片管理，可分别编辑、保存、删除。
          </p>
        </div>

        <div class="config-layout">
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
              <span class="dept-tags">
                <el-tag
                  size="small"
                  :type="deptNeedsInterview(d.id) ? 'warning' : 'info'"
                >
                  {{ deptNeedsInterview(d.id) ? '需面试' : '免面试' }}
                </el-tag>
                <el-tag
                  v-if="configuredPositionCount(d.id)"
                  size="small"
                  type="success"
                >
                  {{ configuredPositionCount(d.id) }} 岗
                </el-tag>
              </span>
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
            </div>

            <section class="section-block">
              <div class="section-head">
                <h4>本部门是否需要面试</h4>
                <el-switch
                  v-model="ruleForm.requireInterview"
                  active-text="需要"
                  inactive-text="不需要"
                  @change="onRequireInterviewChange"
                />
              </div>
              <p class="text-muted section-desc">
                仅对本部门生效；关闭后该部门抢班直面不会对灵工开放
              </p>
            </section>

            <div :class="{ disabled: !ruleForm.requireInterview }">
            <!-- 岗位列表 -->
            <section class="section-block">
              <div class="section-head">
                <h4>岗位配置（{{ ruleForm.positions.length }}）</h4>
                <el-button type="primary" size="small" @click="openAddPosition">+ 添加岗位</el-button>
              </div>

              <div v-if="ruleForm.positions.length" class="pos-card-grid">
                <article v-for="p in ruleForm.positions" :key="p.id" class="pos-card">
                  <div class="pos-card-body">
                    <strong class="pos-card-name">{{ p.profile.positionName || '未命名岗位' }}</strong>
                    <p class="pos-card-meta">
                      {{ p.profile.jobType || '未设类型' }}
                      ·
                      {{ p.profile.skills?.length ? p.profile.skills.join('、') : '无技能要求' }}
                    </p>
                    <p class="pos-card-desc text-muted">
                      {{ p.profile.description || '暂无岗位描述' }}
                    </p>
                    <p class="pos-card-schedule text-muted">{{ positionCardPreview(p) }}</p>
                  </div>
                  <div class="pos-card-actions">
                    <el-button link type="primary" @click="openEditPosition(p)">编辑</el-button>
                    <el-button link type="danger" @click="removePosition(p)">删除</el-button>
                  </div>
                </article>
              </div>
              <el-empty v-else description="暂无岗位，请点击「添加岗位」" :image-size="64" />
            </section>
            </div>
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

    <el-dialog
      v-model="editDialogVisible"
      :title="editingIsNew ? '添加岗位' : '编辑岗位'"
      width="720px"
      destroy-on-close
      @closed="closeEditDialog"
    >
      <el-form v-if="editingPosition" label-width="100px" class="rule-fields">
        <el-divider content-position="left">岗位要求</el-divider>
        <el-form-item label="岗位名称" required>
          <el-select
            :model-value="editingPosition.templateId || ''"
            filterable
            placeholder="从岗位管理库选择"
            style="width: 100%"
            @change="(v: string) => v && applyTemplateToPosition(v)"
          >
            <el-option
              v-for="t in positionCatalog"
              :key="t.id"
              :label="t.profile.positionName || t.name"
              :value="t.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="岗位类型">
          <el-select
            v-model="editingPosition.profile.jobType"
            clearable
            placeholder="选择类型"
            style="width: 200px"
          >
            <el-option v-for="t in JOB_TYPE_OPTIONS" :key="t" :label="t" :value="t" />
          </el-select>
        </el-form-item>
        <el-form-item label="技能要求">
          <div class="skill-field">
            <el-select
              v-model="editingPosition.profile.skills"
              multiple
              filterable
              collapse-tags
              collapse-tags-tooltip
              placeholder="请从技能库选择"
              style="flex: 1"
            >
              <el-option
                v-for="s in skillOptions"
                :key="s.id"
                :label="s.name"
                :value="s.name"
              />
            </el-select>
            <el-button link type="primary" @click="skillLibVisible = true">维护技能库</el-button>
          </div>
        </el-form-item>
        <el-form-item label="岗位描述" required>
          <el-input
            v-model="editingPosition.profile.description"
            type="textarea"
            :rows="2"
            placeholder="岗位说明"
          />
        </el-form-item>
        <el-form-item label="年龄范围">
          <div class="inline-age">
            <el-input-number
              v-model="editingPosition.profile.ageMin"
              :min="16"
              :max="70"
              controls-position="right"
            />
            <span>—</span>
            <el-input-number
              v-model="editingPosition.profile.ageMax"
              :min="16"
              :max="70"
              controls-position="right"
            />
          </div>
        </el-form-item>
        <el-form-item label="性别要求">
          <el-radio-group v-model="editingPosition.profile.gender">
            <el-radio value="any">不限</el-radio>
            <el-radio value="male">男</el-radio>
            <el-radio value="female">女</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="经验要求">
          <el-input
            v-model="editingPosition.profile.experience"
            placeholder="如：不限 / 1年以上"
          />
        </el-form-item>

        <el-divider content-position="left">面试时间</el-divider>
        <el-form-item label="时间模版">
          <div class="schedule-tpl-row">
            <el-select
              :model-value="editingPosition.scheduleTemplateId || ''"
              clearable
              placeholder="套用面试时间模版"
              style="width: 240px"
              @change="(v: string) => v && applyScheduleTemplate(v)"
              @clear="editingPosition.scheduleTemplateId = null"
            >
              <el-option
                v-for="t in scheduleTemplates"
                :key="t.id"
                :label="t.name"
                :value="t.id"
              />
            </el-select>
            <el-button @click="saveCurrentAsScheduleTemplate">保存为模版</el-button>
          </div>
        </el-form-item>
        <div class="schedule-editor nested">
          <GrabInterviewScheduleEditor
            v-if="editingPosition.schedule"
            v-model="editingPosition.schedule"
          />
        </div>
        <p class="preview text-muted">预览：{{ schedulePreviewText(editingPosition.schedule) }}</p>
      </el-form>
      <template #footer>
        <el-button @click="closeEditDialog">取消</el-button>
        <el-button type="primary" @click="savePosition">保存</el-button>
      </template>
    </el-dialog>

    <PositionManageDialog
      v-model:visible="positionManageVisible"
      :enterprise-id="resolvedEnterpriseId"
    />

    <SkillLibraryManageDialog v-model:visible="skillLibVisible" />

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
              editingRegPosition ? ' · 岗位面试时间' : ''
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

.config-layout.disabled,
.rule-form .disabled {
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

.dept-tags {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
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
  padding: 12px;
  border: 1px solid #e8edf5;
  border-radius: 10px;
  background: #f8fafc;
}

.schedule-tpl-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.inline-age {
  display: flex;
  align-items: center;
  gap: 8px;
}

.skill-field {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.pos-card-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 12px;
  margin-top: 10px;
}

.pos-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
  border: 1px solid #e8edf5;
  border-radius: 10px;
  padding: 14px;
  background: #fff;
}

.pos-card-body {
  min-width: 0;
}

.pos-card-name {
  display: block;
  font-size: 14px;
  color: #0f172a;
}

.pos-card-meta,
.pos-card-desc,
.pos-card-schedule {
  margin: 6px 0 0;
  font-size: 12px;
  line-height: 1.5;
  color: #64748b;
}

.pos-card-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  border-top: 1px dashed #e8edf5;
  padding-top: 8px;
}

.name-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
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
  .config-layout {
    grid-template-columns: 1fr;
  }
}
</style>
