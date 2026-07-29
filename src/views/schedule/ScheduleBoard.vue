<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import {
  detectAllConflicts,
  generateCycleSchedule,
  getHolidayForDate,
  isRestDay,
} from '@/services/schedule'
import { getMonthDays, getWeekday, isWeekend } from '@/utils'

const props = withDefaults(
  defineProps<{
    groupId?: string
    embedded?: boolean
  }>(),
  {},
)

const store = useAppStore()

const now = new Date()
const selectedMonth = ref(`${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)

const availableTeams = computed(() =>
  props.groupId ? store.getTeamsForGroup(props.groupId) : store.teams,
)

const selectedTeamId = ref('')

watch(
  availableTeams,
  (teams) => {
    if (!teams.some((t) => t.id === selectedTeamId.value)) {
      selectedTeamId.value = teams[0]?.id ?? ''
    }
  },
  { immediate: true },
)

const activeScheduleRule = computed(() =>
  props.groupId ? store.getScheduleRuleForGroup(props.groupId) : store.scheduleRule,
)

const selectedGroup = computed(() =>
  props.groupId ? store.attendanceGroups.find((g) => g.id === props.groupId) : null,
)
const cellDialogVisible = ref(false)
const cycleDialogVisible = ref(false)

const editingCell = ref<{ employeeId: string; date: string } | null>(null)
const selectedShiftId = ref('')

const cycleForm = ref({
  pattern: ['shift_morning', 'shift_morning', 'shift_morning', 'shift_morning', 'shift_morning', 'shift_rest', 'shift_rest'],
  startDate: '',
})

const team = computed(() => availableTeams.value.find((t) => t.id === selectedTeamId.value))
const teamMembers = computed(() => {
  const ids = team.value?.memberIds ?? []
  return store.activeEmployees.filter((e) => ids.includes(e.id))
})

const monthDays = computed(() => {
  const [y, m] = selectedMonth.value.split('-').map(Number)
  return getMonthDays(y, m)
})

const conflicts = computed(() =>
  detectAllConflicts(
    store.assignments,
    store.employees,
    store.shifts,
    store.holidays,
    activeScheduleRule.value,
    { teamId: selectedTeamId.value, month: selectedMonth.value },
  ),
)

const conflictMap = computed(() => {
  const map = new Map<string, string[]>()
  conflicts.value.forEach((c) => {
    const key = `${c.employeeId}_${c.date}`
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(c.message)
  })
  return map
})

function getShift(employeeId: string, date: string) {
  const asn = store.getAssignment(employeeId, date)
  if (!asn) return null
  return store.shifts.find((s) => s.id === asn.shiftId) ?? null
}

function getCellClass(employeeId: string, date: string) {
  const classes: string[] = ['schedule-cell']
  const key = `${employeeId}_${date}`
  if (conflictMap.value.has(key)) classes.push('conflict-cell')
  if (getHolidayForDate(store.holidays, date)) classes.push('holiday-cell')
  else if (isWeekend(date) && !activeScheduleRule.value.weekendWork) classes.push('weekend-cell')
  const asn = store.getAssignment(employeeId, date)
  if (asn && !asn.published) classes.push('unpublished')
  return classes
}

function getCellStyle(employeeId: string, date: string) {
  const shift = getShift(employeeId, date)
  if (!shift) return {}
  return { background: shift.color, color: shift.code === 'REST' ? '#909399' : '#fff' }
}

function openCell(employeeId: string, date: string) {
  editingCell.value = { employeeId, date }
  const asn = store.getAssignment(employeeId, date)
  selectedShiftId.value = asn?.shiftId ?? ''
  cellDialogVisible.value = true
}

function saveCell() {
  if (!editingCell.value) return
  const { employeeId, date } = editingCell.value
  if (!selectedShiftId.value) {
    store.removeAssignment(employeeId, date)
    ElMessage.success('已清除排班')
  } else {
    store.upsertAssignment({
      employeeId,
      date,
      shiftId: selectedShiftId.value,
      teamId: selectedTeamId.value,
    })
    const key = `${employeeId}_${date}`
    const msgs = conflictMap.value.get(key)
    if (msgs?.length) {
      ElMessage.warning(`排班已保存，但存在冲突：${msgs[0]}`)
    } else {
      ElMessage.success('排班已保存')
    }
  }
  cellDialogVisible.value = false
}

function openCycleDialog() {
  cycleForm.value.startDate = monthDays.value[0] ?? `${selectedMonth.value}-01`
  cycleDialogVisible.value = true
}

function applyCycleSchedule() {
  if (!team.value) return
  const memberIds = team.value.memberIds
  if (memberIds.length === 0) {
    ElMessage.warning('班组暂无成员')
    return
  }
  const items = generateCycleSchedule(
    memberIds,
    cycleForm.value.pattern,
    cycleForm.value.startDate,
    monthDays.value.length,
    selectedTeamId.value,
  )
  items.forEach((item) => store.upsertAssignment(item))
  ElMessage.success(`已按周期生成 ${items.length} 条排班`)
  cycleDialogVisible.value = false
}

async function clearMonthSchedule() {
  await ElMessageBox.confirm(`确定清空 ${selectedMonth.value} 当前班组的所有排班？`, '提示', {
    type: 'warning',
  })
  const memberIds = new Set(team.value?.memberIds ?? [])
  store.assignments = store.assignments.filter(
    (a) =>
      !(
        a.date.startsWith(selectedMonth.value) &&
        a.teamId === selectedTeamId.value &&
        memberIds.has(a.employeeId)
      ),
  )
  store.persist('assignments')
  ElMessage.success('已清空')
}

function copyRow(employeeId: string) {
  const firstDay = monthDays.value[0]
  const firstShift = store.getAssignment(employeeId, firstDay)?.shiftId
  if (!firstShift) {
    ElMessage.warning('请先设置该员工第一天的班次')
    return
  }
  monthDays.value.forEach((date) => {
    if (isRestDay(store.holidays, date, activeScheduleRule.value.weekendWork)) {
      const rest = store.shifts.find((s) => s.code === 'REST')
      if (rest) {
        store.upsertAssignment({
          employeeId,
          date,
          shiftId: rest.id,
          teamId: selectedTeamId.value,
        })
      }
    } else {
      store.upsertAssignment({
        employeeId,
        date,
        shiftId: firstShift,
        teamId: selectedTeamId.value,
      })
    }
  })
  ElMessage.success('已复制首班至全月（休息日自动设为休息）')
}

const editingEmployeeName = computed(() => {
  if (!editingCell.value) return ''
  return store.employees.find((e) => e.id === editingCell.value!.employeeId)?.name ?? ''
})
</script>

<template>
  <div :class="{ 'embedded-board': embedded }">
    <div class="page-card toolbar" :class="{ 'embedded-toolbar': embedded }">
      <el-form inline>
        <el-form-item v-if="selectedGroup" label="考勤组">
          <el-tag type="primary">{{ selectedGroup.name }}</el-tag>
        </el-form-item>
        <el-form-item label="月份">
          <el-date-picker
            v-model="selectedMonth"
            type="month"
            value-format="YYYY-MM"
            :clearable="false"
            style="width: 140px"
          />
        </el-form-item>
        <el-form-item label="班组">
          <el-select v-model="selectedTeamId" style="width: 180px" :disabled="!availableTeams.length">
            <el-option v-for="t in availableTeams" :key="t.id" :label="t.name" :value="t.id" />
          </el-select>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="openCycleDialog">周期排班</el-button>
          <el-button @click="clearMonthSchedule">清空本月</el-button>
          <el-button type="success" @click="$router.push('/schedule-publish')">去发布</el-button>
        </el-form-item>
      </el-form>

      <div class="legend">
        <span v-for="s in store.shifts" :key="s.id" class="legend-item">
          <i :style="{ background: s.color }" />
          {{ s.name }}
        </span>
        <span class="legend-item conflict"><i class="conflict-icon" />冲突</span>
      </div>
    </div>

    <el-alert
      v-if="conflicts.length > 0"
      :title="`检测到 ${conflicts.length} 处排班冲突，已标红显示`"
      type="error"
      :closable="false"
      style="margin: 12px 0"
    />

    <div class="page-card" style="padding: 0; overflow: hidden">
      <div class="schedule-grid-wrapper">
        <table class="schedule-grid">
          <thead>
            <tr>
              <th class="sticky-col">员工</th>
              <th v-for="date in monthDays" :key="date" :class="{ 'weekend-cell': isWeekend(date) }">
                <div>{{ date.slice(8) }}</div>
                <div class="text-muted">{{ getWeekday(date) }}</div>
              </th>
              <th style="min-width: 60px">操作</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="emp in teamMembers" :key="emp.id">
              <td class="sticky-col">
                <div>{{ emp.name }}</div>
                <div class="text-muted">{{ emp.employeeNo }}</div>
              </td>
              <td
                v-for="date in monthDays"
                :key="date"
                :class="getCellClass(emp.id, date)"
                :style="getCellStyle(emp.id, date)"
                :title="conflictMap.get(`${emp.id}_${date}`)?.join('；')"
                @click="openCell(emp.id, date)"
              >
                {{ getShift(emp.id, date)?.name?.slice(0, 2) ?? '' }}
              </td>
              <td>
                <el-button link type="primary" size="small" @click.stop="copyRow(emp.id)">
                  复制
                </el-button>
              </td>
            </tr>
            <tr v-if="teamMembers.length === 0">
              <td :colspan="monthDays.length + 2" style="padding: 40px; color: #909399">
                {{
                  availableTeams.length
                    ? '当前班组暂无成员，请先在「班组管理」中添加'
                    : '该考勤组暂无关联班组'
                }}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <el-dialog v-model="cellDialogVisible" title="设置排班" width="400px">
      <p>{{ editingEmployeeName }} · {{ editingCell?.date }}</p>
      <el-select v-model="selectedShiftId" clearable placeholder="清除排班" style="width: 100%">
        <el-option v-for="s in store.shifts" :key="s.id" :label="`${s.name} (${s.startTime}-${s.endTime})`" :value="s.id" />
      </el-select>
      <template #footer>
        <el-button @click="cellDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveCell">确定</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="cycleDialogVisible" title="按周期排班" width="520px">
      <el-form label-width="100px">
        <el-form-item label="起始日期">
          <el-date-picker v-model="cycleForm.startDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
        </el-form-item>
        <el-form-item label="循环模式">
          <div class="pattern-row">
            <el-select
              v-for="(_, idx) in cycleForm.pattern"
              :key="idx"
              v-model="cycleForm.pattern[idx]"
              style="width: 90px"
            >
              <el-option v-for="s in store.shifts" :key="s.id" :label="s.name" :value="s.id" />
            </el-select>
          </div>
          <p class="text-muted">默认做五休二，可逐日调整循环班次</p>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="cycleDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="applyCycleSchedule">生成排班</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.embedded-board .embedded-toolbar {
  margin-bottom: 0;
  box-shadow: none;
  border: none;
  padding: 0 0 12px;
}

.toolbar {
  margin-bottom: 0;
}

.legend {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 8px;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
}

.legend-item i {
  display: inline-block;
  width: 14px;
  height: 14px;
  border-radius: 2px;
}

.conflict-icon {
  background: #fef0f0 !important;
  border: 2px solid #f56c6c;
}

.pattern-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
