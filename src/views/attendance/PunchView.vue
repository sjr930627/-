<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { Location, Clock, CircleCheck } from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'
import { getStatusLabel, getStatusTagType, buildDailyAttendanceList } from '@/services/attendance'

const store = useAppStore()
const STORAGE_KEY = 'punch:employeeId'

const employeeId = ref(localStorage.getItem(STORAGE_KEY) ?? store.activeEmployees[0]?.id ?? '')
const locating = ref(false)
const locationText = ref('等待定位…')
const inRange = ref(true)
const now = ref(new Date())
let clockTimer: ReturnType<typeof setInterval> | null = null

const today = computed(() => now.value.toISOString().slice(0, 10))
const currentTime = computed(() =>
  now.value.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
)

const employee = computed(() => store.employees.find((e) => e.id === employeeId.value))

const todayAssignment = computed(() => store.getAssignment(employeeId.value, today.value))

const todayShift = computed(() => {
  const asn = todayAssignment.value
  if (!asn) return null
  return store.shifts.find((s) => s.id === asn.shiftId) ?? null
})

const todayPunches = computed(() =>
  store.punches
    .filter((p) => p.employeeId === employeeId.value && p.date === today.value)
    .sort((a, b) => a.time.localeCompare(b.time)),
)

const hasClockIn = computed(() => todayPunches.value.some((p) => p.type === 'clock_in'))
const hasClockOut = computed(() => todayPunches.value.some((p) => p.type === 'clock_out'))

const todayInsurance = computed(() =>
  store.insurancePolicies.find(
    (p) =>
      p.employeeId === employeeId.value &&
      p.workDate === today.value &&
      (p.status === 'active' || p.status === 'pending'),
  ),
)

const todayStatus = computed(() => {
  const list = buildDailyAttendanceList(
    [employeeId.value],
    [today.value],
    store.assignments,
    store.shifts,
    store.punches,
    store.leaveRequests,
    store.attendanceRule,
    store.manualOverrides,
  )
  const row = list[0]
  if (!row) return null
  return { label: getStatusLabel(row.status), type: getStatusTagType(row.status) }
})

function persistEmployee() {
  if (employeeId.value) localStorage.setItem(STORAGE_KEY, employeeId.value)
}

function refreshLocation() {
  if (!navigator.geolocation) {
    locationText.value = '浏览器不支持定位，将按演示模式打卡'
    inRange.value = true
    return
  }
  locating.value = true
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      locating.value = false
      const { latitude, longitude } = pos.coords
      locationText.value = `已定位 (${latitude.toFixed(4)}, ${longitude.toFixed(4)})`
      inRange.value = true
    },
    () => {
      locating.value = false
      locationText.value = '定位失败，可在考勤范围内手动打卡（演示）'
      inRange.value = true
    },
    { enableHighAccuracy: true, timeout: 8000 },
  )
}

function punch(type: 'clock_in' | 'clock_out') {
  if (!employeeId.value) {
    ElMessage.warning('请先选择员工')
    return
  }
  const shift = todayShift.value
  if (!shift || shift.code === 'REST') {
    ElMessage.warning('今日无工作班次，无法打卡')
    return
  }
  if (type === 'clock_in' && hasClockIn.value) {
    ElMessage.warning('今日已打过上班卡')
    return
  }
  if (type === 'clock_out' && !hasClockIn.value) {
    ElMessage.warning('请先打上班卡')
    return
  }
  if (type === 'clock_out' && hasClockOut.value) {
    ElMessage.warning('今日已打过下班卡')
    return
  }

  const time = now.value.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })
  const { insurancePolicy } = store.addPunch({
    employeeId: employeeId.value,
    date: today.value,
    time,
    type,
    source: 'mobile',
    location: locationText.value,
    inRange: inRange.value,
  })
  if (type === 'clock_in') {
    ElMessage.success(
      insurancePolicy
        ? `上班打卡成功 ${time}，已自动投保（${insurancePolicy.policyNo}）`
        : `上班打卡成功 ${time}`,
    )
  } else {
    ElMessage.success(`下班打卡成功 ${time}`)
  }
}

onMounted(() => {
  store.syncExceptions()
  refreshLocation()
  clockTimer = setInterval(() => {
    now.value = new Date()
  }, 1000)
})

onUnmounted(() => {
  if (clockTimer) clearInterval(clockTimer)
})

watch(employeeId, persistEmployee)
</script>

<template>
  <div class="punch-page">
    <header class="punch-header">
      <h1>网页打卡</h1>
      <p class="sub">灵工考勤 · 浏览器端</p>
    </header>

    <div class="punch-card clock-card">
      <div class="clock-time">{{ currentTime }}</div>
      <div class="clock-date">{{ today }}</div>
    </div>

    <div class="punch-card">
      <label class="field-label">当前员工</label>
      <el-select
        v-model="employeeId"
        filterable
        size="large"
        style="width: 100%"
        placeholder="选择员工"
      >
        <el-option
          v-for="e in store.activeEmployees"
          :key="e.id"
          :label="`${e.name}（${e.employeeNo}）`"
          :value="e.id"
        />
      </el-select>
      <p v-if="employee" class="emp-meta">{{ employee.position }}</p>
    </div>

    <div class="punch-card shift-card">
      <div class="shift-row">
        <span class="label">今日班次</span>
        <span v-if="todayShift && todayShift.code !== 'REST'" class="shift-tag" :style="{ background: todayShift.color }">
          {{ todayShift.name }} {{ todayShift.startTime.slice(0, 5) }}-{{ todayShift.endTime.slice(0, 5) }}
        </span>
        <span v-else class="text-muted">休息 / 未排班</span>
      </div>
      <div v-if="todayStatus" class="shift-row">
        <span class="label">考勤状态</span>
        <el-tag :type="todayStatus.type" size="small">{{ todayStatus.label }}</el-tag>
      </div>
      <div v-if="todayInsurance" class="shift-row">
        <span class="label">今日保险</span>
        <el-tag type="success" size="small">{{ todayInsurance.policyNo }} 保障中</el-tag>
      </div>
    </div>

    <div class="punch-card location-card">
      <div class="loc-head">
        <el-icon><Location /></el-icon>
        <span>定位</span>
        <el-button link type="primary" size="small" :loading="locating" @click="refreshLocation">刷新</el-button>
      </div>
      <p class="loc-text">{{ locationText }}</p>
      <el-tag :type="inRange ? 'success' : 'danger'" size="small">
        {{ inRange ? '考勤范围内' : '范围外' }}
      </el-tag>
    </div>

    <div class="punch-actions">
      <button
        class="punch-btn clock-in"
        :disabled="!todayShift || todayShift.code === 'REST' || hasClockIn"
        @click="punch('clock_in')"
      >
        <el-icon :size="28"><Clock /></el-icon>
        <span>上班打卡</span>
        <small v-if="hasClockIn">已完成</small>
      </button>
      <button
        class="punch-btn clock-out"
        :disabled="!todayShift || todayShift.code === 'REST' || !hasClockIn || hasClockOut"
        @click="punch('clock_out')"
      >
        <el-icon :size="28"><CircleCheck /></el-icon>
        <span>下班打卡</span>
        <small v-if="hasClockOut">已完成</small>
      </button>
    </div>

    <div v-if="todayPunches.length" class="punch-card records">
      <h3>今日记录</h3>
      <div v-for="p in todayPunches" :key="p.id" class="record-row">
        <el-tag :type="p.type === 'clock_in' ? 'primary' : 'success'" size="small">
          {{ p.type === 'clock_in' ? '上班' : '下班' }}
        </el-tag>
        <span class="record-time">{{ p.time }}</span>
        <el-tag :type="p.inRange ? 'success' : 'danger'" size="small" effect="plain">
          {{ p.inRange ? '正常' : '异常' }}
        </el-tag>
      </div>
    </div>

    <footer class="punch-footer">
      <router-link to="/dashboard">进入管理后台</router-link>
    </footer>
  </div>
</template>

<style scoped>
.punch-page {
  min-height: 100vh;
  background: linear-gradient(160deg, #f5f3ff 0%, #eef2ff 45%, #f8fafc 100%);
  padding: 24px 16px 40px;
  max-width: 480px;
  margin: 0 auto;
  box-sizing: border-box;
}

.punch-header {
  text-align: center;
  margin-bottom: 20px;
}

.punch-header h1 {
  margin: 0;
  font-size: 24px;
  color: #1f2937;
}

.sub {
  margin: 6px 0 0;
  color: #6b7280;
  font-size: 13px;
}

.punch-card {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.06);
}

.clock-card {
  text-align: center;
  padding: 24px 16px;
}

.clock-time {
  font-size: 40px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--app-primary, #7c3aed);
  letter-spacing: 1px;
}

.clock-date {
  margin-top: 4px;
  color: #909399;
  font-size: 14px;
}

.field-label {
  display: block;
  font-size: 13px;
  color: #606266;
  margin-bottom: 8px;
}

.emp-meta {
  margin: 8px 0 0;
  font-size: 12px;
  color: #909399;
}

.shift-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
}

.shift-row:last-child {
  margin-bottom: 0;
}

.shift-row .label {
  font-size: 13px;
  color: #606266;
}

.shift-tag {
  color: #fff;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
}

.loc-head {
  display: flex;
  align-items: center;
  gap: 6px;
  font-weight: 600;
  font-size: 14px;
  margin-bottom: 8px;
}

.loc-head .el-button {
  margin-left: auto;
}

.loc-text {
  margin: 0 0 8px;
  font-size: 12px;
  color: #606266;
  line-height: 1.5;
  word-break: break-all;
}

.punch-actions {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin: 16px 0;
}

.punch-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  min-height: 120px;
  border: none;
  border-radius: 16px;
  font-size: 16px;
  font-weight: 600;
  color: #fff;
  cursor: pointer;
  transition: transform 0.15s, opacity 0.15s;
  box-shadow: 0 8px 20px rgba(0, 0, 0, 0.12);
}

.punch-btn small {
  font-size: 11px;
  font-weight: 400;
  opacity: 0.9;
}

.punch-btn:active:not(:disabled) {
  transform: scale(0.97);
}

.punch-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  box-shadow: none;
}

.clock-in {
  background: linear-gradient(145deg, #7c3aed, #6d28d9);
}

.clock-out {
  background: linear-gradient(145deg, #10b981, #059669);
}

.records h3 {
  margin: 0 0 12px;
  font-size: 14px;
}

.record-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid #f0f0f0;
}

.record-row:last-child {
  border-bottom: none;
}

.record-time {
  flex: 1;
  font-size: 18px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
}

.punch-footer {
  text-align: center;
  margin-top: 24px;
  font-size: 13px;
}

.punch-footer a {
  color: var(--app-primary, #7c3aed);
  text-decoration: none;
}
</style>
