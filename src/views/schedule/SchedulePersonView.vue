<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'
import ScheduleMonthGrid from '@/components/schedule/ScheduleMonthGrid.vue'
import { detectAllConflicts, getHolidayForDate } from '@/services/schedule'
import { calcShiftHours, getMonthDays, isWeekend } from '@/utils'

const store = useAppStore()
const route = useRoute()
const router = useRouter()

const selectedGroupId = ref('ag_factory')
const selectedMonth = ref('2026-07')
const selectedEmployeeId = ref('')
const keyword = ref('')

const batchForm = ref({
  startDate: '',
  endDate: '',
  shiftId: 'shift_morning',
  skipWeekend: true,
})

const monthDates = computed(() => {
  const [y, m] = selectedMonth.value.split('-').map(Number)
  return getMonthDays(y, m)
})

const availableTeams = computed(() => store.getTeamsForGroup(selectedGroupId.value))
const memberIds = computed(() => new Set(availableTeams.value.flatMap((t) => t.memberIds)))

const employees = computed(() =>
  store.activeEmployees
    .filter((e) => memberIds.value.has(e.id))
    .filter((e) => !keyword.value.trim() || e.name.includes(keyword.value.trim())),
)

const selectedEmployee = computed(() =>
  store.employees.find((e) => e.id === selectedEmployeeId.value),
)

const activeScheduleRule = computed(() => store.getScheduleRuleForGroup(selectedGroupId.value))

const teamSections = computed(() => {
  const emp = selectedEmployee.value
  if (!emp) return []
  const team = availableTeams.value.find((t) => t.memberIds.includes(emp.id))
  return team ? [{ team, members: [emp] }] : [{ team: { id: '_', name: '未分组', memberIds: [], departmentId: '' }, members: [emp] }]
})

const conflicts = computed(() =>
  detectAllConflicts(
    store.assignments,
    store.employees,
    store.shifts,
    store.holidays,
    activeScheduleRule.value,
    { month: selectedMonth.value },
  ).filter((c) => c.employeeId === selectedEmployeeId.value),
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

watch(employees, (list) => {
  if (!list.some((e) => e.id === selectedEmployeeId.value)) {
    selectedEmployeeId.value = list[0]?.id ?? ''
  }
}, { immediate: true })

watch(selectedMonth, (m) => {
  batchForm.value.startDate = `${m}-01`
  const [y, mo] = m.split('-').map(Number)
  batchForm.value.endDate = getMonthDays(y, mo)[getMonthDays(y, mo).length - 1] ?? `${m}-28`
}, { immediate: true })

function syncRoute() {
  const group = route.query.group
  if (typeof group === 'string') selectedGroupId.value = group
}

watch(() => route.query, syncRoute, { immediate: true })

function getShift(employeeId: string, date: string) {
  const asn = store.getAssignment(employeeId, date)
  if (!asn) return null
  return store.shifts.find((s) => s.id === asn.shiftId) ?? null
}

function getCellClass(employeeId: string, date: string) {
  const classes = ['grid-cell']
  if (conflictMap.value.has(`${employeeId}_${date}`)) classes.push('conflict')
  if (getHolidayForDate(store.holidays, date)) classes.push('holiday')
  else if (isWeekend(date) && !activeScheduleRule.value.weekendWork) classes.push('weekend')
  const asn = store.getAssignment(employeeId, date)
  if (asn && !asn.published) classes.push('draft')
  return classes
}

function getCellStyle(employeeId: string, date: string) {
  const shift = getShift(employeeId, date)
  if (!shift || shift.code === 'REST') return {}
  return { '--cell-color': shift.color }
}

function getShiftLabel(employeeId: string, date: string) {
  const shift = getShift(employeeId, date)
  if (!shift) return ''
  if (shift.code === 'REST') return '休'
  return shift.name.slice(0, 2)
}

function calcPeriodHours(employeeId: string) {
  return monthDates.value.reduce((sum, date) => {
    const shift = getShift(employeeId, date)
    return shift && shift.code !== 'REST' ? sum + calcShiftHours(shift) : sum
  }, 0)
}

function openCell(employeeId: string, date: string) {
  const team = availableTeams.value.find((t) => t.memberIds.includes(employeeId))
  const current = store.getAssignment(employeeId, date)
  const next = store.shifts.find((s) => s.id !== current?.shiftId && s.code !== 'REST') ?? store.shifts[0]
  if (current) {
    store.removeAssignment(employeeId, date)
    ElMessage.success('已清除')
  } else if (next) {
    store.upsertAssignment({ employeeId, date, shiftId: next.id, teamId: team?.id })
    ElMessage.success(`已设为 ${next.name}`)
  }
}

function applyBatch() {
  if (!selectedEmployeeId.value || !batchForm.value.shiftId) return
  const team = availableTeams.value.find((t) => t.memberIds.includes(selectedEmployeeId.value))
  let count = 0
  for (const date of monthDates.value) {
    if (date < batchForm.value.startDate || date > batchForm.value.endDate) continue
    if (batchForm.value.skipWeekend && isWeekend(date)) continue
    store.upsertAssignment({
      employeeId: selectedEmployeeId.value,
      date,
      shiftId: batchForm.value.shiftId,
      teamId: team?.id,
    })
    count += 1
  }
  ElMessage.success(`已为 ${selectedEmployee.value?.name} 批量排班 ${count} 天`)
}

const monthStats = computed(() => {
  if (!selectedEmployeeId.value) return { work: 0, rest: 0, conflict: 0 }
  let work = 0
  let rest = 0
  for (const date of monthDates.value) {
    const shift = getShift(selectedEmployeeId.value, date)
    if (!shift) continue
    if (shift.code === 'REST') rest += 1
    else work += 1
  }
  return { work, rest, conflict: conflicts.value.length }
})
</script>

<template>
  <div class="person-schedule-page">
    <header class="page-card sub-header">
      <el-button :icon="ArrowLeft" link @click="router.push({ path: '/schedule-manage', query: { group: selectedGroupId } })">
        返回排班管理
      </el-button>
      <h2 class="page-title">按人员排班</h2>
      <el-date-picker v-model="selectedMonth" type="month" value-format="YYYY-MM" style="width: 130px" />
    </header>

    <div class="person-body">
      <aside class="person-list page-card">
        <el-input v-model="keyword" placeholder="搜索人员" clearable prefix-icon="Search" style="margin-bottom: 12px" />
        <div
          v-for="emp in employees"
          :key="emp.id"
          class="person-item"
          :class="{ active: selectedEmployeeId === emp.id }"
          @click="selectedEmployeeId = emp.id"
        >
          <div class="person-name">{{ emp.name }}</div>
          <div class="text-muted">{{ emp.employeeNo }} · {{ emp.position }}</div>
          <div v-if="emp.preferredShiftIds.length" class="pref-tags">
            <el-tag v-for="sid in emp.preferredShiftIds.slice(0, 2)" :key="sid" size="small" effect="plain">
              {{ store.shifts.find((s) => s.id === sid)?.name ?? sid }}
            </el-tag>
          </div>
        </div>
      </aside>

      <main class="person-main">
        <div v-if="selectedEmployee" class="page-card person-summary">
          <div>
            <h3>{{ selectedEmployee.name }} · {{ selectedMonth }}</h3>
            <p class="text-muted">
              偏好：
              <template v-if="selectedEmployee.preferredShiftIds.length">
                {{ selectedEmployee.preferredShiftIds.map((id) => store.shifts.find((s) => s.id === id)?.name).join('、') }}
              </template>
              <template v-else>未设置</template>
            </p>
          </div>
          <el-row :gutter="12">
            <el-col :span="8"><el-statistic title="出勤天" :value="monthStats.work" /></el-col>
            <el-col :span="8"><el-statistic title="休息天" :value="monthStats.rest" /></el-col>
            <el-col :span="8"><el-statistic title="冲突" :value="monthStats.conflict" /></el-col>
          </el-row>
        </div>

        <div class="page-card batch-panel">
          <h4 class="panel-title">批量排班</h4>
          <el-form inline>
            <el-form-item label="起始">
              <el-date-picker v-model="batchForm.startDate" type="date" value-format="YYYY-MM-DD" />
            </el-form-item>
            <el-form-item label="结束">
              <el-date-picker v-model="batchForm.endDate" type="date" value-format="YYYY-MM-DD" />
            </el-form-item>
            <el-form-item label="班次">
              <el-select v-model="batchForm.shiftId" style="width: 120px">
                <el-option v-for="s in store.shifts" :key="s.id" :label="s.name" :value="s.id" />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-checkbox v-model="batchForm.skipWeekend">跳过周末</el-checkbox>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="applyBatch">应用到区间</el-button>
            </el-form-item>
          </el-form>
          <p class="text-muted tip">单击日历格子可快速切换/清除单日班次</p>
        </div>

        <div class="page-card grid-card">
          <ScheduleMonthGrid
            :dates="monthDates"
            :team-sections="teamSections"
            :conflict-map="conflictMap"
            compact
            :get-shift-label="getShiftLabel"
            :get-cell-class="getCellClass"
            :get-cell-style="getCellStyle"
            :calc-period-hours="calcPeriodHours"
            @cell-click="openCell"
          />
        </div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.person-schedule-page {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.sub-header {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 20px;
}

.sub-header .page-title {
  margin: 0;
  flex: 1;
}

.person-body {
  display: grid;
  grid-template-columns: 240px 1fr;
  gap: 12px;
  align-items: start;
}

.person-list {
  padding: 12px;
  max-height: calc(100vh - 160px);
  overflow-y: auto;
}

.person-item {
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  margin-bottom: 6px;
  border: 1px solid transparent;
}

.person-item:hover {
  background: #f5f3ff;
}

.person-item.active {
  background: #ede9fe;
  border-color: #c4b5fd;
}

.person-name {
  font-weight: 600;
  font-size: 14px;
}

.pref-tags {
  display: flex;
  gap: 4px;
  margin-top: 6px;
  flex-wrap: wrap;
}

.person-main {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.person-summary {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
}

.person-summary h3 {
  margin: 0 0 6px;
}

.panel-title {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
}

.batch-panel .tip {
  margin: 8px 0 0;
  font-size: 12px;
}

.grid-card {
  padding: 0;
  overflow: hidden;
}

@media (max-width: 900px) {
  .person-body {
    grid-template-columns: 1fr;
  }
}
</style>
