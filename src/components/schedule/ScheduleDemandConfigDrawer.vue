<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import {
  buildWeeklyPlanCells,
  demandCellKey,
  getDateDemandKindLabel,
  getNextWeekStart,
  getWeekDatesFromStart,
  needsNextWeekDemandPlan,
  teamHasEnabledCycleRule,
} from '@/services/shiftDemandPlan'
import { addDays, getWeekStart } from '@/utils'
import type { AttendanceGroupShiftTemplate, TeamCycleScheduleRule } from '@/types'

const props = defineProps<{
  visible: boolean
  teamId: string
  memberIds: string[]
  templates: AttendanceGroupShiftTemplate[]
  defaultWeekStart: string
  displayDates: string[]
}>()

const emit = defineEmits<{
  'update:visible': [boolean]
  saved: []
  cycleApplied: [count: number]
}>()

const store = useAppStore()
const activeTab = ref<'weekly' | 'cycle'>('weekly')
const weekStart = ref('')
const weekCells = ref<{ date: string; shiftTemplateId: string; requiredHeadcount: number }[]>([])

const weekDates = computed(() => getWeekDatesFromStart(weekStart.value))
const weekEnd = computed(() => weekDates.value[weekDates.value.length - 1] ?? weekStart.value)

const teamCycleRules = computed(() => store.getTeamCycleScheduleRules(props.teamId))
const hasCycleRule = computed(() => teamHasEnabledCycleRule(store.teamCycleScheduleRules, props.teamId))
const needNextWeekPlan = computed(() =>
  needsNextWeekDemandPlan(store.teamCycleScheduleRules, store.weeklyShiftDemandPlans, props.teamId),
)

const cycleFormVisible = ref(false)
const editingCycleId = ref<string | null>(null)
const cycleForm = ref({
  name: '',
  enabled: true,
  employeeIds: [] as string[],
  shiftPattern: [
    'shift_morning',
    'shift_morning',
    'shift_morning',
    'shift_morning',
    'shift_morning',
    'shift_rest',
    'shift_rest',
  ] as string[],
  anchorStartDate: '',
  cycleDays: 7,
  autoGenerateLeadDays: 3,
})

const weekLabels = ['周一', '周二', '周三', '周四', '周五', '周六', '周日']

function loadWeekCells() {
  const existing = store.getWeeklyShiftDemandPlan(props.teamId, weekStart.value)
  weekCells.value = buildWeeklyPlanCells(
    props.templates,
    weekDates.value,
    store.holidays,
    existing?.cells ?? [],
  )
}

function getCellValue(date: string, shiftTemplateId: string) {
  return weekCells.value.find(
    (c) => c.date === date && c.shiftTemplateId === shiftTemplateId,
  )?.requiredHeadcount ?? 0
}

function setCellValue(date: string, shiftTemplateId: string, val: number) {
  const key = demandCellKey(date, shiftTemplateId)
  const idx = weekCells.value.findIndex(
    (c) => demandCellKey(c.date, c.shiftTemplateId) === key,
  )
  if (idx >= 0) weekCells.value[idx].requiredHeadcount = val
  else weekCells.value.push({ date, shiftTemplateId, requiredHeadcount: val })
}

function resetForm() {
  weekStart.value = props.defaultWeekStart || getWeekStart()
  activeTab.value = hasCycleRule.value ? 'cycle' : 'weekly'
  loadWeekCells()
}

watch(
  () => props.visible,
  (v) => {
    if (v) resetForm()
  },
)

watch(weekStart, () => {
  if (props.visible) loadWeekCells()
})

function close() {
  emit('update:visible', false)
}

function saveWeeklyPlan(status: 'draft' | 'confirmed') {
  if (!props.templates.length) {
    ElMessage.warning('请先在考勤组配置班次模板')
    return
  }
  store.saveWeeklyShiftDemandPlan({
    teamId: props.teamId,
    weekStart: weekStart.value,
    weekEnd: weekEnd.value,
    cells: weekCells.value.map((c) => ({ ...c })),
    status,
  })
  ElMessage.success(status === 'confirmed' ? '本周班次需求已发布' : '本周班次需求已保存草稿')
  emit('saved')
  if (status === 'confirmed') close()
}

function fillFromTemplateDefaults() {
  weekCells.value = buildWeeklyPlanCells(props.templates, weekDates.value, store.holidays)
  ElMessage.info('已按模板默认（平/末/节）填充')
}

function openCycleForm(rule?: TeamCycleScheduleRule) {
  editingCycleId.value = rule?.id ?? null
  if (rule) {
    cycleForm.value = {
      name: rule.name,
      enabled: rule.enabled,
      employeeIds: [...rule.employeeIds],
      shiftPattern: [...rule.shiftPattern],
      anchorStartDate: rule.anchorStartDate,
      cycleDays: rule.cycleDays,
      autoGenerateLeadDays: rule.autoGenerateLeadDays,
    }
  } else {
    cycleForm.value = {
      name: '新周期规则',
      enabled: true,
      employeeIds: [...props.memberIds],
      shiftPattern: [
        'shift_morning',
        'shift_morning',
        'shift_morning',
        'shift_morning',
        'shift_morning',
        'shift_rest',
        'shift_rest',
      ],
      anchorStartDate: props.displayDates[0] ?? getWeekStart(),
      cycleDays: 7,
      autoGenerateLeadDays: 3,
    }
  }
  cycleFormVisible.value = true
}

function saveCycleRule() {
  if (!cycleForm.value.name.trim()) {
    ElMessage.warning('请填写规则名称')
    return
  }
  store.saveTeamCycleScheduleRule({
    id: editingCycleId.value ?? undefined,
    teamId: props.teamId,
    name: cycleForm.value.name.trim(),
    enabled: cycleForm.value.enabled,
    employeeIds: cycleForm.value.employeeIds,
    shiftPattern: [...cycleForm.value.shiftPattern],
    anchorStartDate: cycleForm.value.anchorStartDate,
    cycleDays: cycleForm.value.cycleDays,
    autoGenerateLeadDays: cycleForm.value.autoGenerateLeadDays,
  })
  cycleFormVisible.value = false
  ElMessage.success('周期规则已保存')
}

async function removeCycleRule(rule: TeamCycleScheduleRule) {
  await ElMessageBox.confirm(`确定删除规则「${rule.name}」？`, '删除规则', { type: 'warning' })
  store.removeTeamCycleScheduleRule(rule.id)
  ElMessage.success('已删除')
}

async function manualGenerateFromRule(rule: TeamCycleScheduleRule) {
  const dates = props.displayDates.length ? props.displayDates : weekDates.value
  await ElMessageBox.confirm(
    `将依据「${rule.name}」为当前周期（${dates[0]} ~ ${dates[dates.length - 1]}）生成人员排班草稿，是否继续？`,
    '手动生成排班',
    { type: 'info' },
  )
  const count = store.applyTeamCycleScheduleRule(rule.id, dates, props.memberIds)
  emit('cycleApplied', count)
  ElMessage.success(`已生成 ${count} 条排班`)
}

function goNextWeek() {
  weekStart.value = getNextWeekStart(weekStart.value)
}

function goPrevWeek() {
  weekStart.value = addDays(weekStart.value, -7)
}
</script>

<template>
  <el-drawer
    :model-value="visible"
    title="班次需求配置"
    size="880px"
    destroy-on-close
    @update:model-value="emit('update:visible', $event)"
  >
    <el-tabs v-model="activeTab">
      <el-tab-pane label="本周班次需求" name="weekly">
        <el-alert
          v-if="!hasCycleRule && needNextWeekPlan"
          type="warning"
          :closable="false"
          show-icon
          title="未配置周期性排班规则：请在每周日前完成下一周各日班次人员需求配置"
          style="margin-bottom: 12px"
        />
        <el-alert
          v-else-if="hasCycleRule"
          type="info"
          :closable="false"
          show-icon
          title="已启用周期性排班规则，系统将在节点时间依据规则自动生成排班；也可在「周期性规则」页手动生成"
          style="margin-bottom: 12px"
        />
        <div class="week-toolbar">
          <el-button size="small" @click="goPrevWeek">上一周</el-button>
          <span class="week-range">{{ weekStart }} ~ {{ weekEnd }}</span>
          <el-button size="small" @click="goNextWeek">下一周</el-button>
          <el-button size="small" @click="fillFromTemplateDefaults">按模板默认填充</el-button>
        </div>
        <p class="text-muted table-hint">按日期配置各班次所需人数（平日 / 周末 / 节假日可不同）</p>
        <div class="demand-grid-wrap">
          <table class="demand-grid">
            <thead>
              <tr>
                <th class="shift-col">班次</th>
                <th v-for="(date, idx) in weekDates" :key="date">
                  <div>{{ weekLabels[idx] }}</div>
                  <div class="date-sub">{{ date.slice(5) }}</div>
                  <el-tag size="small" type="info">{{ getDateDemandKindLabel(date, store.holidays) }}</el-tag>
                </th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="tpl in templates" :key="tpl.id">
                <td class="shift-col">
                  <div class="tpl-name">{{ tpl.name }}</div>
                  <div class="text-muted">{{ tpl.startTime.slice(0, 5) }}-{{ tpl.endTime.slice(0, 5) }}</div>
                </td>
                <td v-for="date in weekDates" :key="date">
                  <el-input-number
                    :model-value="getCellValue(date, tpl.id)"
                    :min="0"
                    :max="999"
                    size="small"
                    controls-position="right"
                    @update:model-value="setCellValue(date, tpl.id, Number($event) || 0)"
                  />
                </td>
              </tr>
              <tr v-if="!templates.length">
                <td :colspan="weekDates.length + 1" class="empty-cell">请先在考勤组配置班次模板</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="drawer-footer-inline">
          <el-button @click="close">取消</el-button>
          <el-button @click="saveWeeklyPlan('draft')">保存草稿</el-button>
          <el-button type="primary" @click="saveWeeklyPlan('confirmed')">确认本周需求</el-button>
        </div>
      </el-tab-pane>

      <el-tab-pane label="周期性排班规则" name="cycle">
        <el-alert
          type="info"
          :closable="false"
          show-icon
          title="配置后可在时间节点自动生成排班，也可选择规则手动生成；无规则时需每周手动配置班次需求"
          style="margin-bottom: 12px"
        />
        <el-button type="primary" size="small" @click="openCycleForm()">新增周期规则</el-button>
        <div v-if="teamCycleRules.length" class="cycle-rule-list">
          <div v-for="rule in teamCycleRules" :key="rule.id" class="cycle-rule-card">
            <div class="cycle-rule-head">
              <span class="rule-name">{{ rule.name }}</span>
              <el-tag size="small" :type="rule.enabled ? 'success' : 'info'">
                {{ rule.enabled ? '已启用' : '已停用' }}
              </el-tag>
            </div>
            <div class="text-muted rule-meta">
              循环 {{ rule.cycleDays }} 天 · 锚点 {{ rule.anchorStartDate }}
              · 提前 {{ rule.autoGenerateLeadDays }} 天自动生成
            </div>
            <div class="text-muted rule-meta">
              模式：
              {{
                rule.shiftPattern
                  .map((id) => store.shifts.find((s) => s.id === id)?.name ?? id)
                  .join(' / ')
              }}
            </div>
            <div v-if="rule.lastGeneratedAt" class="text-muted rule-meta">
              上次生成：{{ new Date(rule.lastGeneratedAt).toLocaleString('zh-CN') }}
            </div>
            <div class="rule-actions">
              <el-button size="small" type="primary" @click="manualGenerateFromRule(rule)">
                手动生成排班
              </el-button>
              <el-button size="small" @click="openCycleForm(rule)">编辑</el-button>
              <el-button size="small" type="danger" link @click="removeCycleRule(rule)">删除</el-button>
            </div>
          </div>
        </div>
        <el-empty v-else description="暂无周期规则，无规则时需每周配置班次需求" :image-size="64" />
      </el-tab-pane>
    </el-tabs>

    <el-dialog v-model="cycleFormVisible" :title="editingCycleId ? '编辑周期规则' : '新增周期规则'" width="560px" append-to-body>
      <el-form label-width="110px">
        <el-form-item label="规则名称">
          <el-input v-model="cycleForm.name" />
        </el-form-item>
        <el-form-item label="启用">
          <el-switch v-model="cycleForm.enabled" />
        </el-form-item>
        <el-form-item label="适用人员">
          <el-select v-model="cycleForm.employeeIds" multiple filterable style="width: 100%">
            <el-option
              v-for="id in memberIds"
              :key="id"
              :label="store.employees.find((e) => e.id === id)?.name ?? id"
              :value="id"
            />
          </el-select>
          <p class="text-muted field-hint">不选则默认班组全员</p>
        </el-form-item>
        <el-form-item label="锚点起始日">
          <el-date-picker v-model="cycleForm.anchorStartDate" type="date" value-format="YYYY-MM-DD" />
        </el-form-item>
        <el-form-item label="循环天数">
          <el-input-number v-model="cycleForm.cycleDays" :min="1" :max="62" />
        </el-form-item>
        <el-form-item label="提前生成">
          <el-input-number v-model="cycleForm.autoGenerateLeadDays" :min="0" :max="14" /> 天
        </el-form-item>
        <el-form-item label="循环模式">
          <div class="pattern-grid">
            <div v-for="(label, idx) in weekLabels" :key="idx" class="pattern-row">
              <span>{{ label }}</span>
              <el-select v-model="cycleForm.shiftPattern[idx]" style="width: 140px">
                <el-option v-for="s in store.shifts" :key="s.id" :label="s.name" :value="s.id" />
              </el-select>
            </div>
          </div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="cycleFormVisible = false">取消</el-button>
        <el-button type="primary" @click="saveCycleRule">保存</el-button>
      </template>
    </el-dialog>
  </el-drawer>
</template>

<style scoped>
.week-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
  flex-wrap: wrap;
}

.week-range {
  font-weight: 600;
  font-size: 13px;
}

.table-hint {
  font-size: 12px;
  margin: 0 0 10px;
}

.demand-grid-wrap {
  overflow: auto;
  max-height: 52vh;
  border: 1px solid var(--app-border);
  border-radius: 8px;
}

.demand-grid {
  width: 100%;
  border-collapse: collapse;
  font-size: 12px;
}

.demand-grid th,
.demand-grid td {
  border: 1px solid var(--app-border);
  padding: 8px 6px;
  text-align: center;
  vertical-align: middle;
}

.shift-col {
  min-width: 100px;
  text-align: left;
  background: #fafafa;
  position: sticky;
  left: 0;
  z-index: 1;
}

.tpl-name {
  font-weight: 600;
}

.date-sub {
  font-size: 11px;
  color: #909399;
}

.empty-cell {
  padding: 32px;
  color: #909399;
}

.drawer-footer-inline {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 16px;
  padding-top: 12px;
  border-top: 1px solid var(--app-border);
}

.cycle-rule-list {
  margin-top: 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.cycle-rule-card {
  border: 1px solid var(--app-border);
  border-radius: 8px;
  padding: 12px 14px;
  background: #fafafa;
}

.cycle-rule-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.rule-name {
  font-weight: 600;
  font-size: 14px;
}

.rule-meta {
  font-size: 12px;
  margin-bottom: 4px;
}

.rule-actions {
  display: flex;
  gap: 8px;
  margin-top: 10px;
  flex-wrap: wrap;
}

.pattern-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.pattern-row {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: #64748b;
}

.field-hint {
  margin: 4px 0 0;
  font-size: 11px;
}
</style>
