<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  ArrowLeft,
  ArrowDown,
  MagicStick,
  RefreshLeft,
  RefreshRight,
} from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'
import ScheduleBoardCalendar from '@/components/schedule/ScheduleBoardCalendar.vue'
import { useScheduleBoard, filterEmployees } from '@/composables/useScheduleBoard'
import { confirmStatusMap } from '@/constants/schedule'
import { generateSmartSchedule } from '@/services/smartSchedule'
import { resolveShiftIdForTemplate } from '@/services/scheduleGroup'
import {
  addDays,
  getMonthDays,
  getWeekDates,
  getWeekStart,
} from '@/utils'

const store = useAppStore()
const router = useRouter()

const selectedTeamId = ref('team_a')
const viewType = ref<'month' | 'week'>('month')
const selectedMonth = ref('2026-07')
const weekStart = ref(getWeekStart('2026-07-28'))
const keyword = ref('')

const shiftPickerVisible = ref(false)
const shiftPickerPos = ref({ x: 0, y: 0 })
const pickerTarget = ref<{ employeeId: string; date: string } | null>(null)

const detailDrawerVisible = ref(false)
const detailCell = ref<{ employeeId: string; date: string } | null>(null)
const detailNote = ref('')

const smartDialogVisible = ref(false)
const publishDialogVisible = ref(false)
const demandDrawerVisible = ref(false)
const saveTemplateName = ref('')

const demandForm = ref<{ id: string; name: string; requiredHeadcount: number }[]>([])

const smartForm = ref({
  dateRange: ['', ''] as [string, string],
  primaryShiftId: 'shift_morning',
  restShiftId: 'shift_rest',
  preferEmployeePreference: true,
  balanceHours: true,
  respectLeave: true,
})

const batchMenuVisible = ref(false)
const batchMenuPos = ref({ x: 0, y: 0 })

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

const board = useScheduleBoard({
  teamId: selectedTeamId,
  dates: displayDates,
  scheduleRule,
  memberIds,
})

const employees = computed(() => {
  const list = store.activeEmployees.filter((e) => memberIds.value.includes(e.id))
  return filterEmployees(list, keyword.value)
})

const teamTemplates = computed(() =>
  store.scheduleTemplates.filter((t) => t.teamId === selectedTeamId.value),
)

const selectedGroup = computed(() => {
  const groupId = team.value?.attendanceGroupId
  return groupId ? store.attendanceGroups.find((g) => g.id === groupId) ?? null : null
})

const shiftDemand = computed(() => {
  const templates = selectedGroup.value?.shiftTemplates ?? []
  const dates = displayDates.value
  const teamId = selectedTeamId.value
  return templates.map((tpl) => {
    const shiftId = resolveShiftIdForTemplate(tpl.name, store.shifts)
    const shift = shiftId ? store.shifts.find((s) => s.id === shiftId) ?? null : null
    const needed = tpl.requiredHeadcount ?? 0
    let totalScheduled = 0
    dates.forEach((date) => {
      totalScheduled += store.assignments.filter(
        (a) =>
          a.shiftId === shiftId &&
          a.date === date &&
          a.teamId === teamId &&
          memberIds.value.includes(a.employeeId),
      ).length
    })
    const avgScheduled = dates.length ? Math.round(totalScheduled / dates.length) : 0
    return {
      template: tpl,
      shift,
      needed,
      scheduled: avgScheduled,
      totalScheduled,
      gap: Math.max(0, needed - avgScheduled),
    }
  })
})

const demandSummary = computed(() => {
  const totalGap = shiftDemand.value.reduce((sum, d) => sum + d.gap, 0)
  const shortageShifts = shiftDemand.value.filter((d) => d.gap > 0).length
  return { totalGap, shortageShifts }
})

const pendingGrabCount = computed(() =>
  store.grabShiftApplications.filter(
    (a) =>
      a.status === 'pending' &&
      store.grabShiftSlots.some(
        (s) =>
          s.id === a.slotId &&
          s.teamId === selectedTeamId.value,
      ),
  ).length,
)

const periodLabel = computed(() => {
  if (viewType.value === 'month') {
    const [y, m] = selectedMonth.value.split('-').map(Number)
    return `${y}年${m}月`
  }
  return `${weekStart.value.slice(5)} ~ ${addDays(weekStart.value, 6).slice(5)}`
})

const statusBar = computed(() => {
  const s = board.pageStatus.value
  if (s === 'published' && board.publishRecord.value) {
    const t = new Date(board.publishRecord.value.publishedAt).toLocaleString('zh-CN')
    return {
      type: 'success' as const,
      label: '已发布',
      desc: `已于 ${t} 发布，已通知 ${board.publishRecord.value.employeeCount} 位员工`,
    }
  }
  if (s === 'editing') {
    return {
      type: 'warning' as const,
      label: '编辑中',
      desc: '改动尚未发布，仅管理员可见',
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

watch(selectedTeamId, (id) => {
  if (!store.teams.some((t) => t.id === id)) {
    selectedTeamId.value = store.teams[0]?.id ?? ''
  }
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
  const today = getWeekStart()
  weekStart.value = today
  selectedMonth.value = today.slice(0, 7)
}

function onCellClick(employeeId: string, date: string, event: MouseEvent) {
  if (event.shiftKey) {
    board.toggleSelect(employeeId, date, true)
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
  detailNote.value = board.getVisibleAssignment(employeeId, date)?.note ?? ''
  detailDrawerVisible.value = true
}

function saveDetailNote() {
  if (!detailCell.value || !detailAssignment.value) return
  store.upsertAssignment({
    ...detailAssignment.value,
    note: detailNote.value,
    published: detailAssignment.value.published,
  })
  ElMessage.success('备注已保存')
}

function onDragStart(employeeId: string, date: string) {
  if (board.editMode.value !== 'editing') return
  board.dragSource.value = { employeeId, date }
}

function onDrop(employeeId: string, date: string) {
  if (!board.dragSource.value) return
  board.swapCells(board.dragSource.value, { employeeId, date })
  board.dragSource.value = null
}

async function handleCopyLastWeek() {
  if (board.editMode.value !== 'editing') board.enterEditMode()
  const source = displayDates.value.map((d) => addDays(d, viewType.value === 'month' ? -31 : -7))
  const count = board.copyLastPeriod(source)
  ElMessage.success(`已复制 ${count} 条排班`)
}

function openSmartDialog() {
  if (board.editMode.value !== 'editing') board.enterEditMode()
  smartForm.value.dateRange = [displayDates.value[0], displayDates.value[displayDates.value.length - 1]]
  smartDialogVisible.value = true
}

async function runSmartSchedule() {
  const t = team.value
  if (!t) return
  const [startDate, endDate] = smartForm.value.dateRange
  const result = generateSmartSchedule(
    t,
    store.employees,
    store.shifts,
    store.holidays,
    store.leaveRequests,
    store.assignments,
    scheduleRule.value,
    {
      teamId: t.id,
      startDate,
      endDate,
      primaryShiftId: smartForm.value.primaryShiftId,
      restShiftId: smartForm.value.restShiftId,
      preferEmployeePreference: smartForm.value.preferEmployeePreference,
      balanceHours: smartForm.value.balanceHours,
      respectLeave: smartForm.value.respectLeave,
    },
  )
  store.applySmartSchedule(result.assignments)
  smartDialogVisible.value = false
  ElMessage.success(result.message)
}

async function applyTemplate(templateId: string) {
  if (board.editMode.value !== 'editing') board.enterEditMode()
  await ElMessageBox.confirm('套用模板将覆盖当前周期草稿排班，是否继续？', '套用模板', {
    type: 'warning',
  })
  const count = store.applyScheduleTemplate(
    templateId,
    selectedTeamId.value,
    displayDates.value,
    memberIds.value,
  )
  ElMessage.success(`已套用模板，填充 ${count} 条`)
}

function openDemandDrawer() {
  demandForm.value = (selectedGroup.value?.shiftTemplates ?? []).map((t) => ({
    id: t.id,
    name: t.name,
    requiredHeadcount: t.requiredHeadcount ?? 0,
  }))
  demandDrawerVisible.value = true
}

function saveDemand() {
  if (!selectedGroup.value) return
  const templates = selectedGroup.value.shiftTemplates.map((t) => {
    const row = demandForm.value.find((d) => d.id === t.id)
    return { ...t, requiredHeadcount: row?.requiredHeadcount ?? t.requiredHeadcount ?? 0 }
  })
  store.updateGroupShiftDemands(selectedGroup.value.id, templates)
  ElMessage.success('班次需求已保存')
  demandDrawerVisible.value = false
}

function goGrabShifts() {
  router.push('/grab-shifts')
}

async function clearDraft() {
  await ElMessageBox.confirm('将清空当前周期未发布草稿并恢复至上次发布版本', '清空草稿', {
    type: 'warning',
  })
  board.clearDraft()
  ElMessage.success('草稿已清空')
}

function openPublishDialog() {
  publishDialogVisible.value = true
}

async function confirmPublish() {
  board.publish()
  publishDialogVisible.value = false
  ElMessage.success('排班已发布')
}

async function saveAsTemplate() {
  const { value } = await ElMessageBox.prompt('请输入模板名称', '保存为模板', {
    inputValue: saveTemplateName.value || '自定义排班模板',
  })
  const pattern = displayDates.value.slice(0, 7).map((date) => {
    const asn = board.getVisibleAssignment(memberIds.value[0], date)
    return asn?.shiftId ?? store.shifts.find((s) => s.code === 'REST')?.id ?? 'shift_rest'
  })
  while (pattern.length < 7) pattern.push(pattern[pattern.length % Math.max(pattern.length, 1)] ?? 'shift_rest')
  store.saveScheduleTemplate({
    name: value,
    teamId: selectedTeamId.value,
    attendanceGroupId: team.value?.attendanceGroupId ?? '',
    pattern: pattern.slice(0, 7),
  })
  ElMessage.success('模板已保存')
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

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <div class="schedule-page">
    <header class="page-toolbar page-card">
      <div class="toolbar-left">
        <el-button :icon="ArrowLeft" link @click="router.push('/dashboard')">返回</el-button>
        <h2 class="page-title">排班管理</h2>
        <el-select v-model="selectedTeamId" style="width: 140px" size="small">
          <el-option v-for="t in store.teams" :key="t.id" :label="t.name" :value="t.id" />
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
    </header>

    <div class="status-bar" :class="statusBar.type">
      <span class="status-tag">📋 状态：[{{ statusBar.label }}]</span>
      <span class="status-desc">{{ statusBar.desc }}</span>
      <div class="status-actions">
        <template v-if="board.editMode.value === 'readonly'">
          <el-button type="primary" size="small" @click="board.enterEditMode()">编辑排班</el-button>
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
        <el-button size="small" type="primary" :icon="MagicStick" @click="openSmartDialog">智能排班</el-button>
        <el-dropdown trigger="click" @command="applyTemplate">
          <el-button size="small">
            套用模板 <el-icon><ArrowDown /></el-icon>
          </el-button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item v-for="tpl in teamTemplates" :key="tpl.id" :command="tpl.id">
                {{ tpl.name }}{{ tpl.isDefault ? '（默认）' : '' }}
              </el-dropdown-item>
              <el-dropdown-item v-if="!teamTemplates.length" disabled>暂无模板</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-button size="small" @click="saveAsTemplate">存为模板</el-button>
        <el-button size="small" @click="clearDraft">清空草稿</el-button>
        <el-button type="success" size="small" @click="openPublishDialog">发布</el-button>
      </div>
    </div>

    <div class="board-body">
      <aside class="left-panel page-card">
        <div class="panel-section">
          <div class="panel-head">
            <span>班次需求概览</span>
            <el-button link type="primary" size="small" @click="openDemandDrawer">配置需求</el-button>
          </div>
          <p v-if="selectedGroup" class="panel-sub text-muted">
            {{ selectedGroup.name }} · {{ viewType === 'month' ? '日均' : '本周日均' }}
          </p>
          <div class="demand-cards">
            <div v-for="d in shiftDemand" :key="d.template.id" class="demand-card">
              <div class="demand-head">
                <i v-if="d.shift" class="shift-dot" :style="{ background: d.shift.color }" />
                <span class="demand-name">{{ d.template.name }}</span>
              </div>
              <div class="demand-num">需 {{ d.needed }} 人/日</div>
              <div class="demand-sub">已排 {{ d.scheduled }} · 缺 {{ d.gap }}</div>
              <el-progress
                :percentage="d.needed ? Math.min(100, Math.round((d.scheduled / d.needed) * 100)) : 0"
                :stroke-width="6"
                :color="d.gap > 0 ? '#e6a23c' : '#67c23a'"
                :show-text="false"
              />
            </div>
            <el-empty v-if="!shiftDemand.length" description="请配置班次需求" :image-size="48" />
          </div>
          <div v-if="shiftDemand.length" class="demand-footer">
            <span v-if="demandSummary.shortageShifts" class="gap-hint">
              {{ demandSummary.shortageShifts }} 个班次存在缺口
            </span>
            <span v-else class="ok-hint">当前周期需求已满足</span>
          </div>
        </div>

        <div class="panel-section grab-link-box">
          <div class="panel-head">
            <span>抢班管理</span>
            <el-badge v-if="pendingGrabCount" :value="pendingGrabCount" type="warning" />
          </div>
          <p class="grab-link-desc text-muted">灵工报名抢班后在此审批，白名单人员免审批</p>
          <el-button size="small" style="width: 100%" @click="goGrabShifts">前往抢班管理</el-button>
        </div>
      </aside>

      <div class="board-main page-card">
      <ScheduleBoardCalendar
        :dates="displayDates"
        :employees="employees"
        :shifts="store.shifts"
        :edit-mode="board.editMode.value"
        :selected-cells="board.selectedCells.value"
        :conflict-map="board.conflictMap.value"
        :get-assignment="board.getVisibleAssignment"
        :daily-stats="board.dailyStats.value"
        :compact="viewType === 'month'"
        @cell-click="onCellClick"
        @cell-context="onCellContext"
        @drag-start="onDragStart"
        @drop="onDrop"
      />

      <div class="legend">
        <span class="legend-title">图例</span>
        <span v-for="s in store.shifts" :key="s.id" class="legend-item">
          <i :style="{ background: s.color }" />{{ s.name }}
        </span>
        <span v-for="(cfg, key) in confirmStatusMap" :key="key" class="legend-item">
          <i :style="{ background: cfg.bg, border: `1px solid ${cfg.color}` }" />{{ cfg.label }}
        </span>
        <span class="legend-item"><i class="dot-manual" />手动调整</span>
        <span class="legend-item"><i class="dot-conflict" />规则冲突</span>
      </div>
      </div>
    </div>

    <el-drawer v-model="demandDrawerVisible" title="班次需求配置" size="420px">
      <el-alert
        type="info"
        :closable="false"
        title="配置各班次每日所需人数，数据来源于考勤组班次模板"
        style="margin-bottom: 16px"
      />
      <el-form label-width="100px">
        <el-form-item v-for="row in demandForm" :key="row.id" :label="row.name">
          <el-input-number v-model="row.requiredHeadcount" :min="0" :max="999" /> 人/日
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="demandDrawerVisible = false">取消</el-button>
        <el-button type="primary" @click="saveDemand">保存</el-button>
      </template>
    </el-drawer>

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
              v-if="detailAssignment?.confirmStatus"
              :style="{ color: confirmStatusMap[detailAssignment.confirmStatus].color }"
            >
              {{ confirmStatusMap[detailAssignment.confirmStatus].label }}
            </span>
            <span v-else>—</span>
          </el-descriptions-item>
        </el-descriptions>
        <el-form label-width="60px" style="margin-top: 16px">
          <el-form-item label="备注">
            <el-input v-model="detailNote" type="textarea" :rows="3" :disabled="board.editMode.value !== 'editing'" />
          </el-form-item>
        </el-form>
        <div v-if="board.editMode.value === 'editing'" class="drawer-actions">
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
          <el-button type="primary" @click="saveDetailNote">保存备注</el-button>
        </div>
        <p v-else class="text-muted tip">只读模式，点击「编辑排班」后可修改</p>
      </template>
    </el-drawer>

    <el-dialog v-model="smartDialogVisible" title="智能排班" width="520px">
      <el-form label-width="100px">
        <el-form-item label="排班区间">
          <el-date-picker v-model="smartForm.dateRange" type="daterange" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="主班次">
          <el-select v-model="smartForm.primaryShiftId" style="width: 100%">
            <el-option v-for="s in store.shifts.filter((x) => x.code !== 'REST')" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="休息班次">
          <el-select v-model="smartForm.restShiftId" style="width: 100%">
            <el-option v-for="s in store.shifts.filter((x) => x.code === 'REST')" :key="s.id" :label="s.name" :value="s.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="规则">
          <el-checkbox v-model="smartForm.preferEmployeePreference">偏好匹配</el-checkbox>
          <el-checkbox v-model="smartForm.balanceHours">工时均衡</el-checkbox>
          <el-checkbox v-model="smartForm.respectLeave">避开请假</el-checkbox>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="smartDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="runSmartSchedule">开始排班</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="publishDialogVisible" title="发布排班" width="440px">
      <p>确认发布当前周期排班？发布后将通知所有涉及员工确认。</p>
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
  </div>
</template>

<style scoped>
.schedule-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
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

.grab-link-box {
  background: #f5f3ff;
}

.grab-link-desc {
  font-size: 12px;
  margin: 0 0 10px;
  line-height: 1.4;
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
</style>
