<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import EntMiniNavBar from '@/components/enterprise-miniapp/EntMiniNavBar.vue'
import { useAppStore } from '@/stores/app'
import { useEnterpriseMiniAuth } from '@/composables/useEnterpriseMiniAuth'
import {
  cloneSchedule,
  emptyPositionProfile,
  emptyScheduleRule,
  formatSeatRuleLabel,
  grabInterviewRegStatusMap,
  grabInterviewSeatUnitOptions,
  grabInterviewWeekdayMap,
  grabInterviewWeekdayOptions,
  normalizeDeptInterviewRule,
  normalizeGrabInterviewScheduleRule,
  profileFromTemplate,
} from '@/constants/grabInterview'
import {
  isEnterpriseRootDepartment,
  isUnassignedDepartment,
} from '@/constants/department'
import { JOB_TYPE_OPTIONS, SKILL_OPTIONS } from '@/constants/recruitment'
import { grabShiftPositionOptions } from '@/services/grabShift'
import { generateId, getDepartmentName } from '@/utils'
import type {
  GrabInterviewDeptPosition,
  GrabInterviewDeptRule,
  GrabInterviewRegStatus,
  GrabInterviewRegistration,
  GrabInterviewScheduleRule,
  GrabInterviewSeatUnitMinutes,
  GrabInterviewTimeSlot,
  GrabInterviewWeekday,
} from '@/types'

const store = useAppStore()
const { enterpriseId, displayName } = useEnterpriseMiniAuth()
const operatorName = computed(() => displayName.value || '企业小程序')

type TabKey = 'config' | 'regs'
const tab = ref<TabKey>('config')

const config = ref(store.ensureGrabInterviewConfig(enterpriseId.value))

watch(
  enterpriseId,
  (id) => {
    config.value = store.ensureGrabInterviewConfig(id)
  },
  { immediate: true },
)

watch(
  () => store.grabInterviewConfigs,
  () => {
    config.value = store.ensureGrabInterviewConfig(enterpriseId.value)
  },
  { deep: true },
)

const requireInterview = computed({
  get: () => config.value.requireInterview,
  set: (v: boolean) => {
    store.updateGrabInterviewConfig(enterpriseId.value, { requireInterview: v })
    config.value = store.ensureGrabInterviewConfig(enterpriseId.value)
  },
})

const positionTemplates = computed(() => store.getEnterprisePositions(enterpriseId.value))

const scopedDepartments = computed(() =>
  store
    .getDepartmentsByEnterprise(enterpriseId.value)
    .filter((d) => !isUnassignedDepartment(d.id) && !isEnterpriseRootDepartment(d)),
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
    profile: emptyPositionProfile(grabShiftPositionOptions[0] || ''),
    ruleScope: 'department',
    schedule: undefined,
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
const editSheetOpen = ref(false)
const scheduleSheetOpen = ref(false)

const activePosition = computed(
  () => ruleForm.positions.find((p) => p.id === selectedPositionId.value) ?? null,
)

watch(
  [selectedDeptId, () => config.value.deptRules],
  () => {
    if (!selectedDeptId.value) return
    const existing = config.value.deptRules.find((r) => r.departmentId === selectedDeptId.value)
    const next = normalizeDeptInterviewRule(
      existing ? JSON.parse(JSON.stringify(existing)) : emptyDeptRule(selectedDeptId.value),
    )
    Object.assign(ruleForm, {
      departmentId: next.departmentId,
      positions: next.positions,
      departmentSchedule: next.departmentSchedule ?? emptyScheduleRule(),
    })
    selectedPositionId.value = ruleForm.positions[0]?.id ?? ''
  },
  { immediate: true },
)

const skillOptions = computed(() => {
  const set = new Set([...SKILL_OPTIONS, '中国移动业务合规证', '叉车证'])
  return [...set]
})

function configuredPositionCount(departmentId: string) {
  const rule = config.value.deptRules.find((r) => r.departmentId === departmentId)
  if (!rule) return 0
  return normalizeDeptInterviewRule(rule).positions.length
}

function weekdayLabels(days: GrabInterviewWeekday[]) {
  return days.map((d) => grabInterviewWeekdayMap[d]).join('、') || '—'
}

function schedulePreviewText(schedule?: GrabInterviewScheduleRule | null) {
  const normalized = normalizeGrabInterviewScheduleRule(schedule)
  const seat = formatSeatRuleLabel(
    (normalized.seatUnitMinutes ?? 30) as GrabInterviewSeatUnitMinutes,
    normalized.seatsPerUnit ?? 1,
  )
  const slots = normalized.timeSlots.map((s) => `${s.start}-${s.end}`).join('、') || '—'
  return `${weekdayLabels(normalized.weekdays)} · ${slots} · ${seat}`
}

function positionSchedulePreview(pos: GrabInterviewDeptPosition) {
  if (pos.ruleScope === 'department') {
    return `沿用部门统一 · ${schedulePreviewText(ruleForm.departmentSchedule)}`
  }
  return schedulePreviewText(pos.schedule)
}

function validateSchedule(schedule: GrabInterviewScheduleRule, label: string) {
  const normalized = normalizeGrabInterviewScheduleRule(schedule)
  if (!normalized.weekdays.length) {
    ElMessage.warning(`${label}：请选择可面试的星期`)
    return false
  }
  if (
    !normalized.timeSlots.length ||
    !normalized.timeSlots.every((s) => s.start && s.end && s.start < s.end)
  ) {
    ElMessage.warning(`${label}：请完善时间段（开始须早于结束）`)
    return false
  }
  if (!normalized.seatsPerUnit || normalized.seatsPerUnit < 1) {
    ElMessage.warning(`${label}：请填写面试席位人数`)
    return false
  }
  return true
}

function addPosition(fromTemplateId?: string) {
  const pos = emptyPosition()
  if (fromTemplateId) {
    const tpl = positionTemplates.value.find((t) => t.id === fromTemplateId)
    if (tpl) {
      pos.templateId = tpl.id
      pos.profile = profileFromTemplate(tpl)
      if (tpl.schedule) {
        pos.ruleScope = 'position'
        pos.schedule = cloneSchedule(tpl.schedule)
      }
    }
  }
  ruleForm.positions.push(pos)
  selectedPositionId.value = pos.id
  editSheetOpen.value = true
}

function openEditPosition(pos: GrabInterviewDeptPosition) {
  selectedPositionId.value = pos.id
  editSheetOpen.value = true
}

function removePosition(pos: GrabInterviewDeptPosition) {
  const idx = ruleForm.positions.findIndex((p) => p.id === pos.id)
  if (idx < 0) return
  ruleForm.positions.splice(idx, 1)
  if (selectedPositionId.value === pos.id) {
    selectedPositionId.value = ruleForm.positions[0]?.id ?? ''
  }
}

function toggleSkill(skill: string) {
  const pos = activePosition.value
  if (!pos) return
  const list = pos.profile.skills ?? (pos.profile.skills = [])
  const idx = list.indexOf(skill)
  if (idx >= 0) list.splice(idx, 1)
  else list.push(skill)
}

function applyTemplate(templateId: string) {
  const pos = activePosition.value
  const tpl = positionTemplates.value.find((t) => t.id === templateId)
  if (!pos || !tpl) return
  pos.templateId = tpl.id
  pos.profile = profileFromTemplate(tpl)
  if (tpl.schedule) {
    pos.ruleScope = 'position'
    pos.schedule = cloneSchedule(tpl.schedule)
  }
  ElMessage.success(`已应用「${tpl.name}」`)
}

function onRuleScopeChange(scope: 'position' | 'department') {
  const pos = activePosition.value
  if (!pos) return
  pos.ruleScope = scope
  if (scope === 'position') {
    if (!pos.schedule) {
      pos.schedule = cloneSchedule(ruleForm.departmentSchedule ?? emptyScheduleRule())
    }
  } else {
    pos.schedule = undefined
  }
}

const editingSchedule = computed(() => {
  if (!ruleForm.departmentSchedule) ruleForm.departmentSchedule = emptyScheduleRule()
  return ruleForm.departmentSchedule
})

function openDeptSchedule() {
  if (!ruleForm.departmentSchedule) ruleForm.departmentSchedule = emptyScheduleRule()
  // force unified for mini simplicity
  ruleForm.departmentSchedule.scheduleMode = 'unified'
  scheduleSheetOpen.value = true
}

function toggleWeekday(day: GrabInterviewWeekday) {
  const schedule = editingSchedule.value
  const idx = schedule.weekdays.indexOf(day)
  if (idx >= 0) schedule.weekdays.splice(idx, 1)
  else schedule.weekdays.push(day)
  schedule.weekdays.sort((a, b) => a - b)
}

function addTimeSlot() {
  const schedule = editingSchedule.value
  const slot: GrabInterviewTimeSlot = {
    id: generateId('slot'),
    start: '14:00',
    end: '15:00',
  }
  schedule.timeSlots.push(slot)
}

function removeTimeSlot(idx: number) {
  const schedule = editingSchedule.value
  if (schedule.timeSlots.length <= 1) {
    ElMessage.warning('至少保留一个时间段')
    return
  }
  schedule.timeSlots.splice(idx, 1)
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
  store.upsertGrabInterviewDeptRule(enterpriseId.value, {
    departmentId: selectedDeptId.value,
    positions: JSON.parse(JSON.stringify(ruleForm.positions)),
    departmentSchedule: JSON.parse(
      JSON.stringify(ruleForm.departmentSchedule ?? emptyScheduleRule()),
    ),
  })
  config.value = store.ensureGrabInterviewConfig(enterpriseId.value)
  editSheetOpen.value = false
  scheduleSheetOpen.value = false
  ElMessage.success('部门面试配置已保存')
}

async function clearDeptRule() {
  if (!selectedDeptId.value) return
  try {
    await ElMessageBox.confirm('确定清除该部门的全部岗位与面试规则？', '提示', { type: 'warning' })
    store.removeGrabInterviewDeptRule(enterpriseId.value, selectedDeptId.value)
    Object.assign(ruleForm, emptyDeptRule(selectedDeptId.value))
    selectedPositionId.value = ''
    config.value = store.ensureGrabInterviewConfig(enterpriseId.value)
    ElMessage.success('已清除')
  } catch {
    /* cancel */
  }
}

function closeEditSheet() {
  editSheetOpen.value = false
}

function closeScheduleSheet() {
  scheduleSheetOpen.value = false
}

/** —— 报名管理 —— */
const regStatusFilter = ref<'all' | GrabInterviewRegStatus>('pending')

const registrations = computed(() =>
  store.grabInterviewRegistrations
    .filter((r) => r.enterpriseId === enterpriseId.value)
    .filter((r) => (regStatusFilter.value === 'all' ? true : r.status === regStatusFilter.value))
    .map((r) => ({
      ...r,
      departmentName: getDepartmentName(
        store.getDepartmentsByEnterprise(enterpriseId.value),
        r.departmentId,
      ),
      statusLabel: grabInterviewRegStatusMap[r.status]?.label ?? r.status,
      statusClass: r.status,
    }))
    .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || '')),
)

const pendingRegCount = computed(
  () =>
    store.grabInterviewRegistrations.filter(
      (r) => r.enterpriseId === enterpriseId.value && r.status === 'pending',
    ).length,
)

const feedbackOpen = ref(false)
const feedbackTarget = ref<GrabInterviewRegistration | null>(null)
const feedbackForm = ref<{ result: 'passed' | 'failed'; failReason: string }>({
  result: 'passed',
  failReason: '',
})

function openFeedback(row: GrabInterviewRegistration) {
  if (row.status !== 'pending') {
    ElMessage.warning('仅待面试可反馈')
    return
  }
  feedbackTarget.value = row
  feedbackForm.value = { result: 'passed', failReason: '' }
  feedbackOpen.value = true
}

function submitFeedback() {
  if (!feedbackTarget.value) return
  try {
    store.submitGrabInterviewFeedback(
      feedbackTarget.value.id,
      feedbackForm.value.result,
      feedbackForm.value.failReason,
    )
    ElMessage.success(
      feedbackForm.value.result === 'passed' ? '已通过并进入人员池' : '已标记为未通过',
    )
    feedbackOpen.value = false
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '提交失败')
  }
}

function markNoShow(row: GrabInterviewRegistration) {
  if (row.status !== 'pending') return
  store.updateGrabInterviewRegistration(row.id, { status: 'no_show_cancelled' })
  ElMessage.success('已标记为未到面/取消面试')
}
</script>

<template>
  <div class="mini-page">
    <EntMiniNavBar title="抢班面试配置" back-to="/enterprise-miniapp/attendance" />

    <div class="switch-card">
      <div>
        <strong>抢班是否需要面试</strong>
        <p>开启后按部门配置岗位与面试时段，发布抢班将引用这些岗位</p>
      </div>
      <label class="switch">
        <input v-model="requireInterview" type="checkbox">
        <span>{{ requireInterview ? '需要' : '不需要' }}</span>
      </label>
    </div>

    <div class="tabs">
      <button type="button" :class="{ active: tab === 'config' }" @click="tab = 'config'">
        面试配置
      </button>
      <button type="button" :class="{ active: tab === 'regs' }" @click="tab = 'regs'">
        报名管理{{ pendingRegCount ? ` ${pendingRegCount}` : '' }}
      </button>
    </div>

    <section v-if="tab === 'config'" class="panel" :class="{ dimmed: !requireInterview }">
      <p class="hint">选择部门后配置岗位；保存后可在「抢班管理」发布对应抢班需求</p>

      <div class="dept-scroll">
        <button
          v-for="d in scopedDepartments"
          :key="d.id"
          type="button"
          class="dept-chip"
          :class="{ active: selectedDeptId === d.id }"
          @click="selectedDeptId = d.id"
        >
          {{ d.name }}
          <em v-if="configuredPositionCount(d.id)">{{ configuredPositionCount(d.id) }}</em>
        </button>
      </div>

      <template v-if="selectedDeptId">
        <div class="section-card">
          <div class="section-head">
            <strong>部门统一面试规则</strong>
            <button type="button" class="link" @click="openDeptSchedule">编辑时段</button>
          </div>
          <p class="preview">{{ schedulePreviewText(ruleForm.departmentSchedule) }}</p>
        </div>

        <div class="section-head row">
          <strong>岗位列表</strong>
          <div class="head-actions">
            <select
              v-if="positionTemplates.length"
              class="tpl-select"
              @change="
                addPosition(($event.target as HTMLSelectElement).value);
                ($event.target as HTMLSelectElement).value = ''
              "
            >
              <option value="">从模板添加</option>
              <option v-for="t in positionTemplates" :key="t.id" :value="t.id">
                {{ t.name }}
              </option>
            </select>
            <button type="button" class="soft-btn" @click="addPosition()">新增岗位</button>
          </div>
        </div>

        <article v-for="pos in ruleForm.positions" :key="pos.id" class="card">
          <div class="card-top">
            <div>
              <strong>{{ pos.profile.positionName || '未命名岗位' }}</strong>
              <p>{{ pos.profile.jobType || '未设工种' }} · {{ pos.profile.skills?.join('、') || '无技能要求' }}</p>
              <p class="sub">{{ positionSchedulePreview(pos) }}</p>
            </div>
            <div class="card-actions">
              <button type="button" class="link" @click="openEditPosition(pos)">编辑</button>
              <button type="button" class="danger-link" @click="removePosition(pos)">删除</button>
            </div>
          </div>
        </article>
        <div v-if="!ruleForm.positions.length" class="empty">暂无岗位，请新增或从模板添加</div>

        <div class="footer-actions">
          <button type="button" class="ghost" @click="clearDeptRule">清除配置</button>
          <button type="button" class="primary" @click="saveDeptRule">保存配置</button>
        </div>
      </template>
      <div v-else class="empty">请先选择部门</div>
    </section>

    <section v-else class="panel">
      <div class="filters">
        <select v-model="regStatusFilter">
          <option value="all">全部状态</option>
          <option value="pending">待面试</option>
          <option value="passed">面试通过</option>
          <option value="failed">面试未通过</option>
          <option value="no_show_cancelled">未到面/取消</option>
        </select>
      </div>
      <div v-if="!registrations.length" class="empty">暂无面试报名</div>
      <article v-for="r in registrations" :key="r.id" class="card">
        <div class="card-top">
          <div>
            <strong>{{ r.name }}</strong>
            <p>{{ r.phone }} · {{ r.position }}</p>
            <p class="sub">
              {{ r.departmentName }} · {{ r.interviewDate }} {{ r.timeSlotLabel || '' }}
              <template v-if="r.interviewExactTime"> · {{ r.interviewExactTime }}</template>
            </p>
          </div>
          <span class="status" :class="r.statusClass">{{ r.statusLabel }}</span>
        </div>
        <div v-if="r.status === 'pending'" class="btns">
          <button type="button" class="ghost" @click="markNoShow(r)">未到面</button>
          <button type="button" class="soft-btn" @click="openFeedback(r)">面试反馈</button>
        </div>
      </article>
    </section>

    <!-- 编辑岗位 -->
    <div v-if="editSheetOpen && activePosition" class="sheet-mask" @click.self="closeEditSheet">
      <div class="sheet">
        <header>
          <strong>编辑岗位</strong>
          <button type="button" class="close" @click="closeEditSheet">×</button>
        </header>

        <label v-if="positionTemplates.length">套用模板</label>
        <select
          v-if="positionTemplates.length"
          :value="activePosition.templateId || ''"
          @change="applyTemplate(($event.target as HTMLSelectElement).value)"
        >
          <option value="">不套用</option>
          <option v-for="t in positionTemplates" :key="t.id" :value="t.id">{{ t.name }}</option>
        </select>

        <label>岗位名称</label>
        <input
          v-model="activePosition.profile.positionName"
          type="text"
          list="grab-interview-positions"
          maxlength="30"
          placeholder="选择或输入岗位名称"
        >
        <datalist id="grab-interview-positions">
          <option v-for="p in grabShiftPositionOptions" :key="p" :value="p" />
        </datalist>

        <label>工种</label>
        <select v-model="activePosition.profile.jobType">
          <option value="">请选择</option>
          <option v-for="j in JOB_TYPE_OPTIONS" :key="j" :value="j">{{ j }}</option>
        </select>

        <label>技能要求</label>
        <div class="skill-tags">
          <button
            v-for="sk in skillOptions"
            :key="sk"
            type="button"
            class="skill"
            :class="{ on: activePosition.profile.skills?.includes(sk) }"
            @click="toggleSkill(sk)"
          >
            {{ sk }}
          </button>
        </div>

        <label>岗位要求</label>
        <textarea v-model="activePosition.profile.requirements" rows="2" placeholder="任职要求" />

        <label>岗位说明</label>
        <textarea v-model="activePosition.profile.description" rows="2" placeholder="工作内容说明" />

        <label>面试规则</label>
        <div class="scope-row">
          <button
            type="button"
            :class="{ on: activePosition.ruleScope === 'department' }"
            @click="onRuleScopeChange('department')"
          >
            应用部门统一
          </button>
          <button
            type="button"
            :class="{ on: activePosition.ruleScope === 'position' }"
            @click="onRuleScopeChange('position')"
          >
            岗位独立规则
          </button>
        </div>
        <p class="preview">{{ positionSchedulePreview(activePosition) }}</p>

        <button type="button" class="submit" @click="saveDeptRule">保存到部门配置</button>
      </div>
    </div>

    <!-- 编辑部门时段 -->
    <div v-if="scheduleSheetOpen" class="sheet-mask" @click.self="closeScheduleSheet">
      <div class="sheet">
        <header>
          <strong>部门统一面试时段</strong>
          <button type="button" class="close" @click="closeScheduleSheet">×</button>
        </header>

        <label>可面试星期</label>
        <div class="weekday-row">
          <button
            v-for="opt in grabInterviewWeekdayOptions"
            :key="opt.value"
            type="button"
            class="weekday"
            :class="{ on: editingSchedule.weekdays.includes(opt.value) }"
            @click="toggleWeekday(opt.value)"
          >
            {{ opt.label }}
          </button>
        </div>

        <label>时间段</label>
        <div v-for="(slot, idx) in editingSchedule.timeSlots" :key="slot.id" class="slot-row">
          <input v-model="slot.start" type="time">
          <span>—</span>
          <input v-model="slot.end" type="time">
          <button type="button" class="danger-link" @click="removeTimeSlot(idx)">删</button>
        </div>
        <button type="button" class="soft-btn" @click="addTimeSlot">添加时间段</button>

        <label>席位规则</label>
        <div class="seat-row">
          <select v-model.number="editingSchedule.seatUnitMinutes">
            <option
              v-for="opt in grabInterviewSeatUnitOptions"
              :key="opt.value"
              :value="opt.value"
            >
              {{ opt.label }}
            </option>
          </select>
          <input
            v-model.number="editingSchedule.seatsPerUnit"
            type="number"
            min="1"
            placeholder="人数"
          >
          <span class="seat-unit">人</span>
        </div>

        <button type="button" class="submit" @click="saveDeptRule">保存配置</button>
      </div>
    </div>

    <!-- 面试反馈 -->
    <div v-if="feedbackOpen" class="sheet-mask" @click.self="feedbackOpen = false">
      <div class="sheet">
        <header>
          <strong>面试反馈 · {{ feedbackTarget?.name }}</strong>
          <button type="button" class="close" @click="feedbackOpen = false">×</button>
        </header>
        <label>结果</label>
        <div class="scope-row">
          <button
            type="button"
            :class="{ on: feedbackForm.result === 'passed' }"
            @click="feedbackForm.result = 'passed'"
          >
            通过（进人员池）
          </button>
          <button
            type="button"
            :class="{ on: feedbackForm.result === 'failed' }"
            @click="feedbackForm.result = 'failed'"
          >
            不通过
          </button>
        </div>
        <label v-if="feedbackForm.result === 'failed'">原因</label>
        <textarea
          v-if="feedbackForm.result === 'failed'"
          v-model="feedbackForm.failReason"
          rows="2"
          placeholder="可选"
        />
        <button type="button" class="submit" @click="submitFeedback">确认提交</button>
        <p class="sub tip">操作人：{{ operatorName }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.switch-card {
  margin: 10px 16px 0;
  padding: 12px;
  border-radius: 12px;
  background: #fff;
  box-shadow: var(--mini-shadow);
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
}
.switch-card strong {
  font-size: 14px;
  color: #111827;
}
.switch-card p {
  margin: 4px 0 0;
  font-size: 12px;
  color: #9ca3af;
}
.switch {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #228BFF;
  font-weight: 600;
  flex-shrink: 0;
}
.switch input {
  width: 18px;
  height: 18px;
  accent-color: #228BFF;
}
.tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
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
.panel.dimmed {
  opacity: 0.55;
  pointer-events: none;
}
.hint {
  margin: 0 0 10px;
  font-size: 12px;
  color: #9ca3af;
}
.dept-scroll {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
  margin-bottom: 10px;
}
.dept-chip {
  flex-shrink: 0;
  border: 1px solid #e5e7eb;
  background: #fff;
  border-radius: 999px;
  height: 32px;
  padding: 0 12px;
  font-size: 12px;
  color: #374151;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.dept-chip.active {
  border-color: #228BFF;
  color: #fff;
  background: #228BFF;
}
.dept-chip em {
  font-style: normal;
  font-size: 10px;
  background: #228BFF;
  color: #fff;
  border-radius: 999px;
  min-width: 16px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
}
.section-card {
  background: #f8fafc;
  border-radius: 10px;
  padding: 10px 12px;
  margin-bottom: 10px;
}
.section-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
.section-head.row {
  margin: 4px 0 8px;
}
.head-actions {
  display: flex;
  gap: 6px;
  align-items: center;
}
.tpl-select {
  max-width: 120px;
  height: 30px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  font-size: 12px;
  padding: 0 6px;
}
.preview {
  margin: 6px 0 0;
  font-size: 12px;
  color: #6b7280;
  line-height: 1.4;
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
}
.card-top p {
  margin: 4px 0 0;
  font-size: 12px;
  color: #6b7280;
}
.sub {
  color: #9ca3af !important;
}
.card-actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  align-items: flex-end;
}
.link,
.danger-link {
  border: none;
  background: none;
  font-size: 12px;
  padding: 0;
}
.link {
  color: #228BFF;
}
.danger-link {
  color: #dc2626;
}
.footer-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}
.primary,
.ghost,
.soft-btn,
.submit {
  border-radius: 8px;
  font-size: 13px;
}
.primary,
.submit {
  flex: 1;
  height: 40px;
  border: none;
  background: #228BFF;
  color: #fff;
  font-weight: 600;
}
.ghost {
  height: 40px;
  padding: 0 14px;
  border: 1px solid #fecaca;
  background: #fff;
  color: #b91c1c;
}
.soft-btn {
  height: 30px;
  padding: 0 10px;
  border: 1px solid #c7d2fe;
  background: #D5E9FF;
  color: #228BFF;
}
.filters {
  margin-bottom: 10px;
}
.filters select {
  width: 100%;
  height: 34px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 0 10px;
  font-size: 13px;
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
.status.pending { background: #fffbeb; color: #d97706; }
.status.passed { background: #ecfdf5; color: #059669; }
.status.failed { background: #fef2f2; color: #dc2626; }
.status.no_show_cancelled { background: #f3f4f6; color: #6b7280; }
.btns {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 8px;
}
.empty {
  padding: 36px 0;
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
.sheet label {
  font-size: 12px;
  color: #6b7280;
  margin-top: 4px;
}
.sheet input,
.sheet select,
.sheet textarea {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 10px;
  font-size: 14px;
}
.skill-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.skill {
  border: 1px solid #e5e7eb;
  background: #fff;
  border-radius: 999px;
  height: 28px;
  padding: 0 10px;
  font-size: 12px;
  color: #6b7280;
}
.skill.on {
  border-color: #228BFF;
  background: #228BFF;
  color: #fff;
}
.scope-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.scope-row button {
  height: 34px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  font-size: 12px;
  color: #6b7280;
}
.scope-row button.on {
  border-color: #228BFF;
  background: #228BFF;
  color: #fff;
  font-weight: 600;
}
.weekday-row {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
.weekday {
  width: 40px;
  height: 32px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  font-size: 12px;
  color: #6b7280;
}
.weekday.on {
  border-color: #228BFF;
  background: #228BFF;
  color: #fff;
  font-weight: 600;
}
.slot-row {
  display: grid;
  grid-template-columns: 1fr auto 1fr auto;
  gap: 6px;
  align-items: center;
}
.seat-row {
  display: grid;
  grid-template-columns: 1.4fr 1fr auto;
  gap: 8px;
  align-items: center;
}
.seat-unit {
  font-size: 13px;
  color: #6b7280;
}
.tip {
  margin: 0;
  text-align: center;
}
</style>
