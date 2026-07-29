<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { buildDailyAttendanceList, getStatusLabel, getStatusTagType } from '@/services/attendance'
import { calcOvertimeHours, getOvertimeTypeForDate } from '@/services/smartSchedule'

const store = useAppStore()
const currentEmployeeId = ref(store.activeEmployees[0]?.id ?? '')
const activePanel = ref('schedule')

const employee = computed(() => store.employees.find((e) => e.id === currentEmployeeId.value))

const myAssignments = computed(() =>
  store.assignments
    .filter((a) => a.employeeId === currentEmployeeId.value && a.date >= '2026-07-01')
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 14)
    .map((a) => {
      const shift = store.shifts.find((s) => s.id === a.shiftId)
      return { ...a, shiftName: shift?.name ?? '-', shiftColor: shift?.color ?? '#eee' }
    }),
)

const myAttendance = computed(() => {
  const dates = myAssignments.value.map((a) => a.date)
  return buildDailyAttendanceList(
    [currentEmployeeId.value],
    dates,
    store.assignments,
    store.shifts,
    store.punches,
    store.leaveRequests,
    store.attendanceRule,
    store.manualOverrides,
  ).map((d) => ({
    ...d,
    statusLabel: getStatusLabel(d.status),
    tagType: getStatusTagType(d.status),
  }))
})

const leaveForm = ref({
  leaveType: 'personal' as 'annual' | 'sick' | 'personal' | 'compensatory',
  startDate: '',
  endDate: '',
  reason: '',
})

const swapForm = ref({
  targetEmployeeId: '',
  date: '',
  reason: '',
})

const makeupForm = ref({
  date: '',
  punchType: 'clock_out' as 'clock_in' | 'clock_out',
  time: '16:00',
  reason: '',
})

const overtimeForm = ref({
  date: '',
  startTime: '18:00',
  endTime: '22:00',
  reason: '',
  compensation: 'pay' as 'pay' | 'time_off',
})

function submitLeave() {
  if (!leaveForm.value.startDate || !leaveForm.value.reason) {
    ElMessage.warning('请填写完整信息')
    return
  }
  store.submitLeaveRequest({
    employeeId: currentEmployeeId.value,
    leaveType: leaveForm.value.leaveType,
    startDate: leaveForm.value.startDate,
    endDate: leaveForm.value.endDate || leaveForm.value.startDate,
    reason: leaveForm.value.reason,
  })
  ElMessage.success('请假申请已提交')
  leaveForm.value = { leaveType: 'personal', startDate: '', endDate: '', reason: '' }
}

function submitSwap() {
  if (!swapForm.value.targetEmployeeId || !swapForm.value.date) {
    ElMessage.warning('请填写完整信息')
    return
  }
  store.submitSwapRequest({
    applicantId: currentEmployeeId.value,
    targetEmployeeId: swapForm.value.targetEmployeeId,
    date: swapForm.value.date,
    reason: swapForm.value.reason,
  })
  ElMessage.success('换班申请已提交')
}

function submitMakeup() {
  try {
    store.submitMakeupRequest({
      employeeId: currentEmployeeId.value,
      date: makeupForm.value.date,
      punchType: makeupForm.value.punchType,
      time: makeupForm.value.time,
      reason: makeupForm.value.reason,
    })
    ElMessage.success('补卡申请已提交')
  } catch (e) {
    ElMessage.error((e as Error).message)
  }
}

function submitOvertime() {
  if (!overtimeForm.value.date || !overtimeForm.value.reason) {
    ElMessage.warning('请填写完整信息')
    return
  }
  const hours = calcOvertimeHours(overtimeForm.value.startTime, overtimeForm.value.endTime)
  store.submitOvertimeRequest({
    employeeId: currentEmployeeId.value,
    date: overtimeForm.value.date,
    startTime: overtimeForm.value.startTime,
    endTime: overtimeForm.value.endTime,
    overtimeType: getOvertimeTypeForDate(overtimeForm.value.date, store.holidays),
    hours,
    reason: overtimeForm.value.reason,
    compensation: overtimeForm.value.compensation,
  })
  ElMessage.success('加班申请已提交')
}

const swapTargets = computed(() =>
  store.activeEmployees.filter((e) => e.id !== currentEmployeeId.value),
)
</script>

<template>
  <div>
    <div class="page-card">
      <div class="page-header">
        <div>
          <h2 class="page-title">员工自助端（演示）</h2>
          <p class="text-muted">模拟一线员工查看班表、提交申请</p>
        </div>
        <el-select v-model="currentEmployeeId" filterable style="width: 200px">
          <el-option
            v-for="e in store.activeEmployees"
            :key="e.id"
            :label="`${e.name} (${e.employeeNo})`"
            :value="e.id"
          />
        </el-select>
      </div>

      <el-alert
        :title="`当前身份：${employee?.name} · ${employee?.position}`"
        type="info"
        :closable="false"
        style="margin-bottom: 16px"
      />

      <el-tabs v-model="activePanel">
        <el-tab-pane label="我的班表" name="schedule">
          <el-table :data="myAssignments" border stripe size="small">
            <el-table-column prop="date" label="日期" width="120" />
            <el-table-column label="班次" width="100">
              <template #default="{ row }">
                <span class="shift-tag" :style="{ background: row.shiftColor }">{{ row.shiftName }}</span>
              </template>
            </el-table-column>
            <el-table-column label="发布" width="80">
              <template #default="{ row }">
                <el-tag :type="row.published ? 'success' : 'info'" size="small">
                  {{ row.published ? '已发布' : '未发布' }}
                </el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="我的考勤" name="attendance">
          <el-table :data="myAttendance" border stripe size="small">
            <el-table-column prop="date" label="日期" width="120" />
            <el-table-column prop="clockIn" label="上班" width="80">
              <template #default="{ row }">{{ row.clockIn ?? '—' }}</template>
            </el-table-column>
            <el-table-column prop="clockOut" label="下班" width="80">
              <template #default="{ row }">{{ row.clockOut ?? '—' }}</template>
            </el-table-column>
            <el-table-column label="状态" width="100">
              <template #default="{ row }">
                <el-tag :type="row.tagType" size="small">{{ row.statusLabel }}</el-tag>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane label="请假" name="leave">
          <el-form label-width="90px" style="max-width: 480px">
            <el-form-item label="类型">
              <el-select v-model="leaveForm.leaveType" style="width: 100%">
                <el-option label="年假" value="annual" />
                <el-option label="病假" value="sick" />
                <el-option label="事假" value="personal" />
                <el-option label="调休" value="compensatory" />
              </el-select>
            </el-form-item>
            <el-form-item label="开始日期">
              <el-date-picker v-model="leaveForm.startDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
            </el-form-item>
            <el-form-item label="结束日期">
              <el-date-picker v-model="leaveForm.endDate" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
            </el-form-item>
            <el-form-item label="原因">
              <el-input v-model="leaveForm.reason" type="textarea" :rows="2" />
            </el-form-item>
            <el-button type="primary" @click="submitLeave">提交申请</el-button>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="换班" name="swap">
          <el-form label-width="90px" style="max-width: 480px">
            <el-form-item label="换班对象">
              <el-select v-model="swapForm.targetEmployeeId" style="width: 100%">
                <el-option v-for="e in swapTargets" :key="e.id" :label="e.name" :value="e.id" />
              </el-select>
            </el-form-item>
            <el-form-item label="换班日期">
              <el-date-picker v-model="swapForm.date" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
            </el-form-item>
            <el-form-item label="原因">
              <el-input v-model="swapForm.reason" type="textarea" :rows="2" />
            </el-form-item>
            <el-button type="primary" @click="submitSwap">提交申请</el-button>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="补卡" name="makeup">
          <el-form label-width="90px" style="max-width: 480px">
            <el-form-item label="日期">
              <el-date-picker v-model="makeupForm.date" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
            </el-form-item>
            <el-form-item label="卡类型">
              <el-radio-group v-model="makeupForm.punchType">
                <el-radio value="clock_in">上班</el-radio>
                <el-radio value="clock_out">下班</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="时间">
              <el-time-select v-model="makeupForm.time" start="00:00" step="00:01" end="23:59" style="width: 100%" />
            </el-form-item>
            <el-form-item label="原因">
              <el-input v-model="makeupForm.reason" type="textarea" :rows="2" />
            </el-form-item>
            <el-button type="primary" @click="submitMakeup">提交补卡</el-button>
          </el-form>
        </el-tab-pane>

        <el-tab-pane label="加班" name="overtime">
          <el-form label-width="90px" style="max-width: 480px">
            <el-form-item label="日期">
              <el-date-picker v-model="overtimeForm.date" type="date" value-format="YYYY-MM-DD" style="width: 100%" />
            </el-form-item>
            <el-form-item label="开始">
              <el-time-select v-model="overtimeForm.startTime" start="00:00" step="00:30" end="23:30" style="width: 100%" />
            </el-form-item>
            <el-form-item label="结束">
              <el-time-select v-model="overtimeForm.endTime" start="00:00" step="00:30" end="23:30" style="width: 100%" />
            </el-form-item>
            <el-form-item label="补偿方式">
              <el-radio-group v-model="overtimeForm.compensation">
                <el-radio value="pay">加班费</el-radio>
                <el-radio value="time_off">调休</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item label="原因">
              <el-input v-model="overtimeForm.reason" type="textarea" :rows="2" />
            </el-form-item>
            <el-button type="primary" @click="submitOvertime">提交加班</el-button>
          </el-form>
        </el-tab-pane>
      </el-tabs>
    </div>
  </div>
</template>
