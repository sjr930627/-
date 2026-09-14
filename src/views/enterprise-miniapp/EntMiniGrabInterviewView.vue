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
  formatSchedulePreviewText,
  grabInterviewRegStatusMap,
  normalizeDeptInterviewRule,
  profileFromTemplate,
  validateInterviewSchedule,
  deptRequiresInterview,
} from '@/constants/grabInterview'
import GrabInterviewScheduleEditor from '@/components/schedule/GrabInterviewScheduleEditor.vue'
import {
  isEnterpriseRootDepartment,
  isLeafDepartment,
  isUnassignedDepartment,
} from '@/constants/department'
import { JOB_TYPE_OPTIONS } from '@/constants/recruitment'
import { generateId, getDepartmentName, getDepartmentPath } from '@/utils'
import type {
  GrabInterviewDeptPosition,
  GrabInterviewDeptRule,
  GrabInterviewRegStatus,
  GrabInterviewRegistration,
  GrabInterviewScheduleRule,
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

const positionTemplates = computed(() => store.getEnterprisePositions(enterpriseId.value))

const scopedDepartments = computed(() =>
  store
    .getDepartmentsByEnterprise(enterpriseId.value)
    .filter(
      (d) =>
        !isUnassignedDepartment(d.id) &&
        !isEnterpriseRootDepartment(d) &&
        isLeafDepartment(d),
    )
    .map((d) => ({
      ...d,
      pathLabel: getDepartmentPath(store.departments, d.id),
    })),
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
const editSheetOpen = ref(false)
const editingPosition = ref<GrabInterviewDeptPosition | null>(null)
const editingIsNew = ref(false)

const scheduleTemplates = computed(() =>
  store.getGrabInterviewScheduleTemplates(enterpriseId.value),
)

watch(
  [selectedDeptId, () => config.value.deptRules],
  () => {
    if (!selectedDeptId.value || editSheetOpen.value) return
    const existing = config.value.deptRules.find((r) => r.departmentId === selectedDeptId.value)
    const next = normalizeDeptInterviewRule(
      existing ? JSON.parse(JSON.stringify(existing)) : emptyDeptRule(selectedDeptId.value),
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

const skillCatalog = computed(() => store.skillLibraryCatalog)

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

function schedulePreviewText(schedule?: GrabInterviewScheduleRule | null) {
  return formatSchedulePreviewText(schedule ?? emptyScheduleRule())
}

function positionSchedulePreview(pos: GrabInterviewDeptPosition) {
  return schedulePreviewText(pos.schedule)
}

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
  store.upsertGrabInterviewDeptRule(enterpriseId.value, {
    departmentId: selectedDeptId.value,
    requireInterview: ruleForm.requireInterview,
    positions: JSON.parse(JSON.stringify(ruleForm.positions)),
  })
  config.value = store.ensureGrabInterviewConfig(enterpriseId.value)
  if (message) ElMessage.success(message)
}

function onRequireInterviewChange() {
  if (!ruleForm.requireInterview) {
    persistDeptRule('已保存：本部门不需要面试')
    return
  }
  persistDeptRule('已开启本部门面试')
}

function addPosition() {
  if (!ruleForm.requireInterview) {
    ElMessage.warning('请先开启「本部门是否需要面试」')
    return
  }
  editingIsNew.value = true
  editingPosition.value = emptyPosition()
  editSheetOpen.value = true
}

function openEditPosition(pos: GrabInterviewDeptPosition) {
  editingIsNew.value = false
  const draft = clonePosition(pos)
  if (!draft.schedule) draft.schedule = emptyScheduleRule()
  editingPosition.value = draft
  editSheetOpen.value = true
}

function closeEditSheet() {
  editSheetOpen.value = false
  editingPosition.value = null
  editingIsNew.value = false
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
    if (editingPosition.value?.id === pos.id) closeEditSheet()
    persistDeptRule('岗位已删除')
  } catch {
    /* cancel */
  }
}

function toggleSkill(skill: string) {
  const pos = editingPosition.value
  if (!pos) return
  const list = pos.profile.skills ?? (pos.profile.skills = [])
  const idx = list.indexOf(skill)
  if (idx >= 0) list.splice(idx, 1)
  else list.push(skill)
}

function applyTemplate(templateId: string) {
  const pos = editingPosition.value
  const tpl = positionTemplates.value.find((t) => t.id === templateId)
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
  ElMessage.success(`已套用时间模版「${tpl.name}」`)
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
      confirmButtonText: '保存',
      cancelButtonText: '取消',
    })
    const name = (value || '').trim()
    if (!name) {
      ElMessage.warning('请填写模版名称')
      return
    }
    const saved = store.upsertGrabInterviewScheduleTemplate(enterpriseId.value, {
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
  closeEditSheet()
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

    <div class="tabs">
      <button type="button" :class="{ active: tab === 'config' }" @click="tab = 'config'">
        面试配置
      </button>
      <button type="button" :class="{ active: tab === 'regs' }" @click="tab = 'regs'">
        报名管理{{ pendingRegCount ? ` ${pendingRegCount}` : '' }}
      </button>
    </div>

    <section v-if="tab === 'config'" class="panel">
      <p class="hint">选择部门后配置「是否需要面试」与岗位；岗位卡片可编辑、保存、删除</p>

      <div class="dept-scroll">
        <button
          v-for="d in scopedDepartments"
          :key="d.id"
          type="button"
          class="dept-chip"
          :class="{ active: selectedDeptId === d.id }"
          @click="selectedDeptId = d.id"
        >
          {{ d.pathLabel }}
          <em v-if="deptNeedsInterview(d.id)">面</em>
          <em v-if="configuredPositionCount(d.id)">{{ configuredPositionCount(d.id) }}</em>
        </button>
      </div>

      <template v-if="selectedDeptId">
        <div class="section-card">
          <div class="section-head">
            <strong>本部门是否需要面试</strong>
          </div>
          <label class="switch">
            <input
              v-model="ruleForm.requireInterview"
              type="checkbox"
              @change="onRequireInterviewChange"
            />
            <span>{{ ruleForm.requireInterview ? '需要' : '不需要' }}</span>
          </label>
          <p class="preview">仅对本部门生效；关闭后该部门抢班直面不对灵工开放</p>
        </div>

        <div :class="{ dimmed: !ruleForm.requireInterview }">
        <div class="section-head row">
          <strong>岗位列表</strong>
          <div class="head-actions">
            <button type="button" class="soft-btn" @click="addPosition">新增岗位</button>
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
        <div v-if="!ruleForm.positions.length" class="empty">暂无岗位，请点击「新增岗位」</div>
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
    <div v-if="editSheetOpen && editingPosition" class="sheet-mask" @click.self="closeEditSheet">
      <div class="sheet">
        <header>
          <strong>{{ editingIsNew ? '添加岗位' : '编辑岗位' }}</strong>
          <button type="button" class="close" @click="closeEditSheet">×</button>
        </header>

        <label>岗位名称</label>
        <div class="name-row">
          <select
            :value="editingPosition.templateId || ''"
            @change="applyTemplate(($event.target as HTMLSelectElement).value)"
          >
            <option value="" disabled>从岗位管理库选择</option>
            <option v-for="t in positionTemplates" :key="t.id" :value="t.id">
              {{ t.profile.positionName || t.name }}
            </option>
          </select>
        </div>

        <label>工种</label>
        <select v-model="editingPosition.profile.jobType">
          <option value="">请选择</option>
          <option v-for="j in JOB_TYPE_OPTIONS" :key="j" :value="j">{{ j }}</option>
        </select>

        <label>技能要求</label>
        <p class="preview">从技能库选择</p>
        <div v-for="category in skillCatalog" :key="category.title" class="skill-category">
          <p class="skill-category-title">{{ category.title }}</p>
          <div class="skill-tags">
            <button
              v-for="item in category.items"
              :key="item.id"
              type="button"
              class="skill"
              :class="{ on: editingPosition.profile.skills?.includes(item.name) }"
              @click="toggleSkill(item.name)"
            >
              {{ item.name }}
            </button>
          </div>
        </div>

        <label>岗位要求</label>
        <textarea v-model="editingPosition.profile.requirements" rows="2" placeholder="任职要求" />

        <label>岗位描述 <em class="required">*</em></label>
        <textarea
          v-model="editingPosition.profile.description"
          rows="2"
          placeholder="工作内容说明（必填）"
        />

        <label>套用面试时间模版</label>
        <select
          v-if="scheduleTemplates.length"
          :value="editingPosition.scheduleTemplateId || ''"
          @change="
            ($event.target as HTMLSelectElement).value &&
              applyScheduleTemplate(($event.target as HTMLSelectElement).value)
          "
        >
          <option value="">不套用</option>
          <option v-for="t in scheduleTemplates" :key="t.id" :value="t.id">{{ t.name }}</option>
        </select>
        <p v-else class="preview">暂无时间模版，可配置后保存</p>

        <label>面试时间</label>
        <GrabInterviewScheduleEditor
          v-if="editingPosition.schedule"
          v-model="editingPosition.schedule"
          compact
        />
        <p class="preview">{{ positionSchedulePreview(editingPosition) }}</p>
        <button type="button" class="soft-btn" @click="saveCurrentAsScheduleTemplate">
          保存为面试时间模版
        </button>

        <button type="button" class="submit" @click="savePosition">保存</button>
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
.panel.dimmed,
.dimmed {
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
.preview {
  margin: 6px 0 0;
  font-size: 12px;
  color: #6b7280;
  line-height: 1.4;
}
.scope-row {
  display: flex;
  gap: 16px;
  margin-top: 8px;
}
.scope-row .radio {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  color: #111827;
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
.name-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.name-row select {
  flex: 1;
  min-width: 0;
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
.skill-category {
  margin-bottom: 8px;
}
.skill-category-title {
  margin: 0 0 6px;
  font-size: 11px;
  color: #9ca3af;
}
.sheet label .required {
  color: #ef4444;
  font-style: normal;
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
