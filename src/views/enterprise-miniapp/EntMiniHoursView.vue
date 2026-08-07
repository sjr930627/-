<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'
import EntMiniNavBar from '@/components/enterprise-miniapp/EntMiniNavBar.vue'
import { useAppStore } from '@/stores/app'
import { useEnterpriseMiniAuth } from '@/composables/useEnterpriseMiniAuth'
import { buildDailyAttendanceList } from '@/services/attendance'

const store = useAppStore()
const { enterpriseId } = useEnterpriseMiniAuth()

const date = ref('2026-07-27')
const selectedEmployeeId = ref('')
const hours = ref(8)
const reason = ref('')

const employees = computed(() =>
  store.employees.filter(
    (e) => e.status === 'active' && e.enterpriseId === enterpriseId.value,
  ),
)

const dailyRows = computed(() => {
  const empIds = employees.value.map((e) => e.id)
  if (!empIds.length) return []
  const list = buildDailyAttendanceList(
    empIds,
    [date.value],
    store.assignments,
    store.shifts,
    store.punches,
    store.leaveRequests,
    store.attendanceRule,
    store.manualOverrides,
  )
  return list.map((row) => ({
    ...row,
    name: store.employees.find((e) => e.id === row.employeeId)?.name || row.employeeId,
    corrected: store.manualOverrides[`${row.employeeId}_${row.date}`]?.workHours,
    note: store.manualOverrides[`${row.employeeId}_${row.date}`]?.note,
  }))
})

function pick(row: { employeeId: string; workHours?: number }) {
  selectedEmployeeId.value = row.employeeId
  hours.value = row.workHours || 8
  reason.value = ''
}

function confirmHours() {
  if (!selectedEmployeeId.value) {
    ElMessage.warning('请先选择人员')
    return
  }
  const note = reason.value.trim()
  if (!note) {
    ElMessage.warning('工时确认/矫正必须填写具体原因')
    return
  }
  try {
    store.setWorkHoursCorrection(selectedEmployeeId.value, date.value, hours.value, note)
    ElMessage.success('工时已确认并记录原因')
    reason.value = ''
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败')
  }
}

function shiftDay(delta: number) {
  date.value = dayjs(date.value).add(delta, 'day').format('YYYY-MM-DD')
}
</script>

<template>
  <div class="mini-page">
    <EntMiniNavBar title="工时确认与矫正" back-to="/enterprise-miniapp/schedule" />
    <p class="hint">确认或矫正工时须写明具体原因，便于审计追溯</p>

    <div class="date-bar">
      <button type="button" @click="shiftDay(-1)">‹</button>
      <input v-model="date" type="date">
      <button type="button" @click="shiftDay(1)">›</button>
    </div>

    <div class="list">
      <article
        v-for="row in dailyRows"
        :key="row.employeeId"
        class="card"
        :class="{ active: selectedEmployeeId === row.employeeId }"
        @click="pick(row)"
      >
        <div class="row">
          <strong>{{ row.name }}</strong>
          <span>{{ row.corrected ?? row.workHours ?? '-' }}h</span>
        </div>
        <p v-if="row.note" class="note">原因：{{ row.note }}</p>
        <p v-else class="meta">系统工时 {{ row.workHours ?? '-' }}h · 点击进行确认/矫正</p>
      </article>
      <div v-if="!dailyRows.length" class="empty">当日无可确认人员</div>
    </div>

    <div v-if="selectedEmployeeId" class="editor">
      <label>矫正工时（小时）</label>
      <input v-model.number="hours" type="number" min="0" max="24" step="0.5">
      <label>具体原因（必填）</label>
      <textarea
        v-model="reason"
        rows="3"
        placeholder="如：漏打卡已补卡，按实际出勤矫正为 7.5 小时"
      />
      <button type="button" class="mini-btn-primary" @click="confirmHours">确认工时</button>
    </div>
  </div>
</template>

<style scoped>
.hint {
  margin: 0;
  padding: 10px 16px;
  font-size: 12px;
  color: #9ca3af;
}
.date-bar {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 0 16px 10px;
}
.date-bar button {
  width: 32px;
  height: 32px;
  border: none;
  border-radius: 8px;
  background: #f3f4f6;
}
.date-bar input {
  flex: 1;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 8px;
}
.list {
  padding: 0 16px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.card {
  background: #fff;
  border-radius: 12px;
  padding: 12px;
  box-shadow: var(--mini-shadow);
  cursor: pointer;
  border: 1px solid transparent;
}
.card.active {
  border-color: #5b4fdb;
  background: #fafaff;
}
.row {
  display: flex;
  justify-content: space-between;
}
.meta,
.note {
  margin: 4px 0 0;
  font-size: 11px;
  color: #9ca3af;
}
.note {
  color: #4338ca;
}
.editor {
  margin: 14px 16px 28px;
  background: #fff;
  border-radius: 14px;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-shadow: var(--mini-shadow);
}
label {
  font-size: 12px;
  color: #6b7280;
}
input,
textarea {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 10px;
  font-size: 14px;
}
.mini-btn-primary {
  height: 42px;
  margin-top: 4px;
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
  font-size: 13px;
}
</style>
