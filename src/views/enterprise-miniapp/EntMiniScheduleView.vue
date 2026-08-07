<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import dayjs from 'dayjs'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { useEnterpriseMiniAuth } from '@/composables/useEnterpriseMiniAuth'

const router = useRouter()
const store = useAppStore()
const { enterpriseId } = useEnterpriseMiniAuth()

const weekStart = ref('2026-07-27')
const mode = ref<'board' | 'line'>('board')
const selectedEmployeeId = ref('')
const selectedDate = ref('2026-07-27')
const selectedShiftId = ref(store.shifts.find((s) => s.id !== 'shift_rest')?.id || '')
const lineStartHour = ref(8)
const lineEndHour = ref(16)

const employees = computed(() =>
  store.employees.filter(
    (e) => e.status === 'active' && e.enterpriseId === enterpriseId.value,
  ),
)

const weekDays = computed(() =>
  Array.from({ length: 7 }, (_, i) => dayjs(weekStart.value).add(i, 'day').format('YYYY-MM-DD')),
)

const shifts = computed(() => store.shifts.filter((s) => s.id !== 'shift_rest'))

function shiftName(id: string) {
  return store.shifts.find((s) => s.id === id)?.name || '-'
}

function assignment(employeeId: string, date: string) {
  return store.getAssignment(employeeId, date)
}

function shiftWeek(delta: number) {
  weekStart.value = dayjs(weekStart.value).add(delta, 'week').format('YYYY-MM-DD')
}

function saveBoard() {
  if (!selectedEmployeeId.value || !selectedShiftId.value) {
    ElMessage.warning('请选择人员与班次')
    return
  }
  const emp = employees.value.find((e) => e.id === selectedEmployeeId.value)
  const team = store.teams.find((t) => t.memberIds.includes(selectedEmployeeId.value))
  store.upsertAssignment({
    employeeId: selectedEmployeeId.value,
    date: selectedDate.value,
    shiftId: selectedShiftId.value,
    teamId: team?.id,
    manualEdited: true,
    note: '企业小程序编辑排班',
  })
  ElMessage.success(`已更新 ${emp?.name || ''} ${selectedDate.value} 排班`)
}

function applyLine() {
  if (!selectedEmployeeId.value) {
    ElMessage.warning('请选择人员')
    return
  }
  if (lineEndHour.value <= lineStartHour.value) {
    ElMessage.warning('结束时间须晚于开始时间')
    return
  }
  const start = `${String(lineStartHour.value).padStart(2, '0')}:00`
  const end = `${String(lineEndHour.value).padStart(2, '0')}:00`
  const matched =
    store.shifts.find((s) => s.startTime === start && s.endTime.startsWith(String(lineEndHour.value).padStart(2, '0'))) ||
    store.shifts.find((s) => s.id === selectedShiftId.value) ||
    shifts.value[0]
  if (!matched) {
    ElMessage.warning('未找到匹配班次，请先在班次库配置')
    return
  }
  const team = store.teams.find((t) => t.memberIds.includes(selectedEmployeeId.value))
  store.upsertAssignment({
    employeeId: selectedEmployeeId.value,
    date: selectedDate.value,
    shiftId: matched.id,
    teamId: team?.id,
    manualEdited: true,
    note: `划线排班 ${start}-${end}`,
  })
  selectedShiftId.value = matched.id
  ElMessage.success(`已按划线 ${start}-${end} 写入排班（班次：${matched.name}）`)
}

const shortcuts = [
  { title: '发布抢班', path: '/enterprise-miniapp/grab' },
  { title: '考勤异常', path: '/enterprise-miniapp/exceptions' },
  { title: '工时确认', path: '/enterprise-miniapp/hours' },
]
</script>

<template>
  <div class="mini-page">
    <header class="head">
      <h1>排班管理</h1>
      <div class="modes">
        <button type="button" :class="{ active: mode === 'board' }" @click="mode = 'board'">编辑排班</button>
        <button type="button" :class="{ active: mode === 'line' }" @click="mode = 'line'">划线排班</button>
      </div>
    </header>

    <div class="shortcuts">
      <button v-for="s in shortcuts" :key="s.path" type="button" @click="router.push(s.path)">
        {{ s.title }}
      </button>
    </div>

    <div class="week-bar">
      <button type="button" @click="shiftWeek(-1)">‹</button>
      <span>{{ weekDays[0] }} ~ {{ weekDays[6] }}</span>
      <button type="button" @click="shiftWeek(1)">›</button>
    </div>

    <div class="board">
      <div v-if="!employees.length" class="empty">本企业暂无在职人员</div>
      <article v-for="emp in employees.slice(0, 12)" :key="emp.id" class="emp-card">
        <strong>{{ emp.name }}</strong>
        <div class="days">
          <button
            v-for="d in weekDays"
            :key="d"
            type="button"
            class="day"
            :class="{
              selected: selectedEmployeeId === emp.id && selectedDate === d,
            }"
            @click="selectedEmployeeId = emp.id; selectedDate = d"
          >
            <small>{{ d.slice(5) }}</small>
            <span>{{ assignment(emp.id, d) ? shiftName(assignment(emp.id, d)!.shiftId) : '休' }}</span>
          </button>
        </div>
      </article>
    </div>

    <section v-if="selectedEmployeeId" class="editor">
      <p>
        已选：{{ employees.find((e) => e.id === selectedEmployeeId)?.name }} · {{ selectedDate }}
      </p>
      <template v-if="mode === 'board'">
        <label>班次</label>
        <select v-model="selectedShiftId">
          <option v-for="s in store.shifts" :key="s.id" :value="s.id">{{ s.name }}</option>
        </select>
        <button type="button" class="mini-btn-primary" @click="saveBoard">保存排班</button>
      </template>
      <template v-else>
        <label>划线时段（小时）</label>
        <div class="inline">
          <input v-model.number="lineStartHour" type="number" min="0" max="23">
          <span>至</span>
          <input v-model.number="lineEndHour" type="number" min="1" max="24">
        </div>
        <button type="button" class="mini-btn-primary" @click="applyLine">应用划线排班</button>
      </template>
    </section>
  </div>
</template>

<style scoped>
.head {
  padding: 18px 16px 8px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 8px;
}
h1 {
  margin: 0;
  font-size: 20px;
}
.modes {
  display: flex;
  background: #f3f4f6;
  border-radius: 10px;
  padding: 3px;
}
.modes button {
  border: none;
  background: transparent;
  height: 30px;
  padding: 0 10px;
  border-radius: 8px;
  font-size: 12px;
  color: #6b7280;
}
.modes button.active {
  background: #fff;
  color: #4338ca;
  font-weight: 600;
}
.shortcuts {
  display: flex;
  gap: 8px;
  padding: 0 16px 10px;
  overflow-x: auto;
}
.shortcuts button {
  flex-shrink: 0;
  border: none;
  background: #eef2ff;
  color: #4338ca;
  border-radius: 999px;
  height: 30px;
  padding: 0 12px;
  font-size: 12px;
}
.week-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px 10px;
  font-size: 13px;
}
.week-bar button {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: #fff;
}
.board {
  padding: 0 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.emp-card {
  background: #fff;
  border-radius: 12px;
  padding: 10px;
  box-shadow: var(--mini-shadow);
}
.emp-card strong {
  font-size: 13px;
}
.days {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
  margin-top: 8px;
}
.day {
  border: 1px solid #f3f4f6;
  background: #fafafa;
  border-radius: 8px;
  padding: 6px 2px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  align-items: center;
  font-size: 10px;
  color: #6b7280;
}
.day.selected {
  border-color: #5b4fdb;
  background: #eef2ff;
  color: #4338ca;
}
.day span {
  font-size: 10px;
  font-weight: 600;
  color: #111827;
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.editor {
  margin: 12px 16px 28px;
  background: #fff;
  border-radius: 14px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-shadow: var(--mini-shadow);
}
.editor p {
  margin: 0;
  font-size: 13px;
}
label {
  font-size: 12px;
  color: #6b7280;
}
select,
input {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 10px;
  font-size: 14px;
}
.inline {
  display: flex;
  align-items: center;
  gap: 8px;
}
.inline input {
  flex: 1;
}
.mini-btn-primary {
  height: 42px;
  border: none;
  border-radius: 10px;
  background: #5b4fdb;
  color: #fff;
  font-weight: 600;
}
.empty {
  padding: 30px;
  text-align: center;
  color: #9ca3af;
}
</style>
