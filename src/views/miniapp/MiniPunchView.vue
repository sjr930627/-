<script setup lang="ts">
import MiniNavBack from '@/components/miniapp/MiniNavBack.vue'
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import { useMiniAppActionGate } from '@/composables/useMiniAppActionGate'
import MiniInsuranceSuccessDialog, {
  type InsuranceSuccessInfo,
} from '@/components/miniapp/MiniInsuranceSuccessDialog.vue'
import type { AttendancePunch, InsurancePolicy } from '@/types'
import {
  buildPunchLocationLabel,
  buildPunchTargets,
  calcNearestTarget,
  freePunchWindowLabel,
  getEmployeePunchModes,
  getFreePunchDepartmentOptions,
  isFreeClockInOnly,
  isNoPunchGroup,
  localDateStr,
  pickDefaultFreePunchDepartmentId,
  resolveAttendanceGroupByMode,
  resolveAvailableMethods,
  useMiniPunchClock,
  useMiniPunchLocation,
  useMiniPunchWifi,
  type MiniPunchMode,
} from '@/composables/useMiniPunch'
import {
  miniPunchMethodIcon,
  miniPunchMethodMap,
  type MiniPunchMethod,
} from '@/constants/miniapp'
import type { PunchMethod } from '@/types'

const router = useRouter()
const route = useRoute()
const store = useAppStore()
const { employeeId } = useMiniAppWorker()
const { ensureActionAllowed } = useMiniAppActionGate()
const { now } = useMiniPunchClock()
const { locating, lat, lng, address, locateError, refreshLocation } = useMiniPunchLocation()

const punchMethod = ref<MiniPunchMethod>('gps')
const qrScanned = ref(false)
const qrScanning = ref(false)
const selectedTargetId = ref<string | null>(null)
const insuranceDialogVisible = ref(false)
const insuranceDialogInfo = ref<InsuranceSuccessInfo | null>(null)

const fromTaskInstanceId = computed(() => route.query.fromTask as string | undefined)
const fromTaskInstance = computed(() =>
  fromTaskInstanceId.value
    ? store.taskInstances.find((i) => i.id === fromTaskInstanceId.value)
    : undefined,
)

const punchModes = computed(() => getEmployeePunchModes(store, employeeId.value))

/** 以工作台带入的 mode 为准；无参数时回退默认模式 */
const activePunchMode = computed<MiniPunchMode | null>(() => {
  const q = route.query.mode
  if ((q === 'free' || q === 'shift') && punchModes.value.modes.includes(q)) {
    return q
  }
  return punchModes.value.defaultMode
})

const attendanceGroup = computed(() =>
  resolveAttendanceGroupByMode(store, employeeId.value, activePunchMode.value),
)
const punchTargets = computed(() => buildPunchTargets(attendanceGroup.value))
const availableMethods = computed(() => resolveAvailableMethods(attendanceGroup.value))
const { connectedSsid, wifiMatched, rescanWifi } = useMiniPunchWifi(() => attendanceGroup.value)

const freeDeptOptions = computed(() =>
  activePunchMode.value === 'free'
    ? getFreePunchDepartmentOptions(store, employeeId.value, attendanceGroup.value)
    : [],
)

/** 详情页只读：沿用工作台带入的 dept，不可切换 */
const freeDeptId = computed(() => {
  if (activePunchMode.value !== 'free') return null
  const opts = freeDeptOptions.value
  if (!opts.length) return null
  const q = typeof route.query.dept === 'string' ? route.query.dept : null
  if (q && opts.some((o) => o.id === q)) return q
  return pickDefaultFreePunchDepartmentId(store, employeeId.value, opts)
})

const freeDeptLabel = computed(
  () => freeDeptOptions.value.find((o) => o.id === freeDeptId.value)?.name ?? '',
)

const radiusMeters = computed(() => attendanceGroup.value?.gpsRadiusMeters ?? 300)

const locationStatus = computed(() =>
  calcNearestTarget(punchTargets.value, lat.value, lng.value, radiusMeters.value),
)

const activeTarget = computed(() => {
  if (selectedTargetId.value) {
    const t = punchTargets.value.find((p) => p.id === selectedTargetId.value)
    if (t) {
      const distance = Math.round(
        Math.sqrt((t.lat - lat.value) ** 2 + (t.lng - lng.value) ** 2) * 111000,
      )
      return { ...t, distance }
    }
  }
  return locationStatus.value.nearest
})

const today = computed(() => localDateStr(now.value))
const clockText = computed(() =>
  now.value.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }),
)

const todayAssignment = computed(() => store.getAssignment(employeeId.value, today.value))
const todayShift = computed(() => {
  const asn = todayAssignment.value
  if (!asn) return null
  return store.shifts.find((s) => s.id === asn.shiftId) ?? null
})
const isFreePunch = computed(() => activePunchMode.value === 'free')
const isNoPunch = computed(() => isNoPunchGroup(attendanceGroup.value))
const freeClockInOnly = computed(
  () => isFreePunch.value && isFreeClockInOnly(attendanceGroup.value),
)
const hasScheduledWork = computed(
  () => Boolean(todayShift.value && todayShift.value.id !== 'shift_rest'),
)
/** 休息日：班次模式下无有效班次；自由打卡模式仍可打卡 */
const isRestToday = computed(() => {
  if (isFreePunch.value) return false
  if (isNoPunch.value) return true
  return !hasScheduledWork.value
})
const freePunchTip = computed(() => freePunchWindowLabel(attendanceGroup.value))

const todayPunches = computed(() =>
  store.punches
    .filter((p) => p.employeeId === employeeId.value && p.date === today.value)
    .sort((a, b) => a.time.localeCompare(b.time)),
)
const hasClockIn = computed(() => todayPunches.value.some((p) => p.type === 'clock_in'))
const hasClockOut = computed(() => todayPunches.value.some((p) => p.type === 'clock_out'))
const nextPunchType = computed<'clock_in' | 'clock_out' | null>(() => {
  if (freeClockInOnly.value) {
    if (hasClockIn.value) return null
    return 'clock_in'
  }
  if (hasClockOut.value) return null
  if (hasClockIn.value) return 'clock_out'
  return 'clock_in'
})

const canPunch = computed(() => {
  if (isRestToday.value || isNoPunch.value || !nextPunchType.value) return false
  if (punchMethod.value === 'wifi') return wifiMatched.value
  if (punchMethod.value === 'qrcode') return qrScanned.value
  return locationStatus.value.inRange
})

const rangeHint = computed(() => {
  if (punchMethod.value === 'wifi') {
    return wifiMatched.value
      ? `已连接考勤 WiFi：${connectedSsid.value}`
      : `请连接 ${attendanceGroup.value?.wifiName ?? '考勤 WiFi'}`
  }
  if (punchMethod.value === 'qrcode') {
    return qrScanned.value ? '扫码成功，可以打卡' : '扫描门店考勤二维码后打卡'
  }
  if (locating.value) return '正在定位…'
  if (locationStatus.value.inRange) {
    return `已进入「${activeTarget.value?.name}」考勤范围（${activeTarget.value?.distance ?? 0}m）`
  }
  const dist = activeTarget.value?.distance ?? 0
  return `距「${activeTarget.value?.name}」${dist}m，超出 ${radiusMeters.value}m 范围`
})

const punchModeTitle = computed(() =>
  activePunchMode.value === 'free' ? '自由打卡' : '班次打卡',
)

const punchBtnLabel = computed(() => {
  if (!nextPunchType.value) return '今日已完成'
  return nextPunchType.value === 'clock_in' ? '签到' : '签退'
})

function selectMethod(m: MiniPunchMethod) {
  punchMethod.value = m
  if (m === 'qrcode') {
    qrScanned.value = false
  }
}

function scanQrCode() {
  qrScanning.value = true
  setTimeout(() => {
    qrScanning.value = false
    qrScanned.value = true
    ElMessage.success('扫码成功')
  }, 900)
}

function buildInsuranceDialogInfo(
  policy: InsurancePolicy,
  punch: AttendancePunch,
): InsuranceSuccessInfo {
  const product = store.insuranceProducts.find((p) => p.id === policy.productId)
  const shift = todayShift.value
  const shiftLabel =
    isFreePunch.value
      ? freePunchTip.value
      : shift
        ? `${shift.name} ${shift.startTime}–${shift.endTime}`
        : '—'
  return {
    productName: product?.name ?? '工伤保险',
    workDate: policy.workDate,
    shiftLabel,
    location: punch.location ?? policy.location ?? '—',
    premium: policy.premium,
    policyNo: policy.policyNo,
  }
}

function returnToTaskIfNeeded() {
  const taskId = fromTaskInstanceId.value
  if (!taskId) return false
  ElMessage.success('打卡成功，请继续完成任务')
  router.push(`/miniapp/tasks/${taskId}`)
  return true
}

async function submitPunch() {
  if (!canPunch.value || !nextPunchType.value) return
  const allowed = await ensureActionAllowed({ from: 'punch' })
  if (!allowed) return
  const punchType = nextPunchType.value
  const method = punchMethod.value as PunchMethod
  const target = activeTarget.value
  let locationLabel = buildPunchLocationLabel(
    method,
    target?.name,
    target?.address ?? address.value,
  )
  if (isFreePunch.value && freeDeptLabel.value) {
    locationLabel = `${locationLabel} · ${freeDeptLabel.value}`
  }
  const inRange =
    method === 'wifi'
      ? !!wifiMatched.value
      : locationStatus.value.inRange

  try {
    const { punch, insurancePolicy } = store.addPunch({
      employeeId: employeeId.value,
      date: today.value,
      time: now.value.toTimeString().slice(0, 8),
      type: punchType,
      source: 'mobile',
      location: locationLabel,
      inRange,
      punchMethod: method,
    })
    const action = punchType === 'clock_in' ? '上班' : '下班'
    if (punchType === 'clock_in' && insurancePolicy) {
      insuranceDialogInfo.value = buildInsuranceDialogInfo(insurancePolicy, punch)
      insuranceDialogVisible.value = true
    } else {
      ElMessage.success(`${action}打卡成功`)
      returnToTaskIfNeeded()
    }
    if (method === 'qrcode') qrScanned.value = false
  } catch (e) {
    ElMessage.warning(e instanceof Error ? e.message : '打卡失败')
  }
}

function closeInsuranceDialog() {
  insuranceDialogVisible.value = false
  returnToTaskIfNeeded()
}

function openInsuranceDetail() {
  insuranceDialogVisible.value = false
  router.push('/miniapp/insurance')
}

function methodPunchLabel(method?: PunchMethod) {
  if (!method) return ''
  return miniPunchMethodMap[method as MiniPunchMethod] ?? method
}
</script>

<template>
  <div class="mp-page">
    <div class="mini-nav-bar mp-nav">
      <MiniNavBack :fallback="fromTaskInstance ? `/miniapp/tasks/${fromTaskInstance.id}` : '/miniapp/workbench'" />
      <div class="mini-nav-title">打卡</div>
      <button class="mp-refresh" type="button" :disabled="locating" @click="refreshLocation">
        {{ locating ? '…' : '重新定位' }}
      </button>
    </div>

    <div v-if="fromTaskInstance" class="mp-from-task">
      <div>
        <div class="mp-from-task-label">来自任务</div>
        <div class="mp-from-task-name">{{ fromTaskInstance.taskName }}</div>
      </div>
      <button type="button" class="mp-from-task-back" @click="router.push(`/miniapp/tasks/${fromTaskInstance.id}`)">
        返回任务
      </button>
    </div>

    <!-- 地图定位区 -->
    <div class="mp-map-wrap">
      <div class="mp-map">
        <div class="mp-map-grid" />
        <div class="mp-map-pin">📍</div>
        <div v-for="t in punchTargets" :key="t.id" class="mp-map-target" :class="{ active: t.id === activeTarget?.id }">
          <span class="mp-target-dot" />
          <span class="mp-target-name">{{ t.name }}</span>
        </div>
      </div>
      <div class="mp-address-card">
        <div class="mp-address-main">{{ address }}</div>
        <div class="mp-address-sub" :class="{ ok: punchMethod === 'gps' && locationStatus.inRange, warn: punchMethod === 'gps' && !locationStatus.inRange && !locating }">
          {{ rangeHint }}
        </div>
        <div v-if="locateError" class="mp-locate-tip">{{ locateError }}</div>
      </div>
    </div>

    <!-- 打卡方式 -->
    <div class="mp-methods">
      <button
        v-for="m in availableMethods"
        :key="m"
        class="mp-method-btn"
        :class="{ active: punchMethod === m }"
        type="button"
        @click="selectMethod(m)"
      >
        <span class="mp-method-icon">{{ miniPunchMethodIcon[m] }}</span>
        <span>{{ miniPunchMethodMap[m] }}</span>
      </button>
    </div>

    <!-- 方式详情 -->
    <div class="mp-panel">
      <template v-if="punchMethod === 'gps'">
        <div class="mp-panel-title">选择考勤地点</div>
        <div class="mp-target-list">
          <button
            v-for="t in punchTargets"
            :key="t.id"
            class="mp-target-item"
            :class="{ active: (selectedTargetId ?? activeTarget?.id) === t.id }"
            type="button"
            @click="selectedTargetId = t.id"
          >
            <div>
              <div class="mp-target-item-name">{{ t.name }}</div>
              <div class="mp-target-item-addr">{{ t.address }}</div>
            </div>
            <span class="mp-target-range">≤{{ radiusMeters }}m</span>
          </button>
        </div>
      </template>

      <template v-else-if="punchMethod === 'wifi'">
        <div class="mp-panel-title">WiFi 考勤</div>
        <div class="mp-wifi-current" :class="{ ok: wifiMatched }">
          <span>📶</span>
          <div>
            <div class="mp-wifi-ssid">{{ connectedSsid }}</div>
            <div class="mp-wifi-status">{{ wifiMatched ? '与考勤组 WiFi 匹配' : '未匹配考勤 WiFi' }}</div>
          </div>
        </div>
        <button class="mp-link-btn" type="button" @click="rescanWifi">重新扫描 WiFi</button>
        <div class="mp-wifi-hint">需连接考勤组配置的「{{ attendanceGroup?.wifiName }}」方可打卡</div>
      </template>

      <template v-else-if="punchMethod === 'qrcode'">
        <div class="mp-panel-title">扫码打卡</div>
        <div class="mp-qr-box">
          <div class="mp-qr-frame">
            <span v-if="qrScanning" class="mp-qr-scanning">扫描中…</span>
            <span v-else-if="qrScanned" class="mp-qr-done">✓ 已验证</span>
            <span v-else class="mp-qr-placeholder">对准门店二维码</span>
          </div>
          <button class="mp-qr-btn" type="button" :disabled="qrScanning" @click="scanQrCode">
            {{ qrScanning ? '扫描中…' : '扫一扫' }}
          </button>
        </div>
      </template>
    </div>

    <!-- 班次 / 自由打卡信息 -->
    <div v-if="isFreePunch" class="mp-shift-bar free">
      <div class="mp-free-bar-main">
        <span>今日考勤</span>
        <span>{{ freePunchTip }}</span>
      </div>
      <div v-if="freeDeptLabel" class="mp-free-dept-fixed">部门 · {{ freeDeptLabel }}</div>
    </div>
    <div v-else-if="!isRestToday && hasScheduledWork && todayShift" class="mp-shift-bar">
      <span>今日班次</span>
      <span>{{ todayShift.name }} {{ todayShift.startTime.slice(0, 5) }}-{{ todayShift.endTime.slice(0, 5) }}</span>
    </div>
    <div v-else-if="isNoPunch" class="mp-shift-bar rest">今日无需打卡</div>
    <div v-else class="mp-shift-bar rest">今日休息</div>

    <!-- 大打卡按钮 -->
    <div class="mp-punch-area">
      <button
        class="mp-punch-circle"
        :class="{
          out: nextPunchType === 'clock_out',
          disabled: !canPunch,
          free: isFreePunch,
        }"
        type="button"
        :disabled="!canPunch"
        @click="submitPunch"
      >
        <span class="mp-punch-mode">{{ punchModeTitle }}</span>
        <span class="mp-punch-time">{{ clockText }}</span>
        <span class="mp-punch-label">{{ punchBtnLabel }}</span>
        <span class="mp-punch-method">{{ miniPunchMethodMap[punchMethod] }}</span>
      </button>
    </div>

    <!-- 今日记录 -->
    <div class="mp-records">
      <div class="mp-records-title">今日打卡记录</div>
      <div v-if="todayPunches.length === 0" class="mp-records-empty">暂无记录</div>
      <div v-for="p in todayPunches" :key="p.id" class="mp-record-row">
        <span class="mp-record-type" :class="p.type">{{ p.type === 'clock_in' ? '签到' : '签退' }}</span>
        <span class="mp-record-time">{{ p.time.slice(0, 5) }}</span>
        <span class="mp-record-meta">
          {{ methodPunchLabel(p.punchMethod) }}
          <span v-if="!p.inRange" class="out-range">范围外</span>
        </span>
      </div>
    </div>

    <MiniInsuranceSuccessDialog
      v-model:visible="insuranceDialogVisible"
      :info="insuranceDialogInfo"
      @close="closeInsuranceDialog"
      @detail="openInsuranceDetail"
    />
  </div>
</template>

<style scoped>
.mp-page {
  min-height: 100%;
  background: #f0f2f5;
  padding-bottom: 24px;
}

.mp-nav .mini-nav-title {
  margin-right: 0;
}

.mp-refresh {
  border: none;
  background: none;
  font-size: 13px;
  color: #4FD1C5;
  cursor: pointer;
  padding: 8px;
}

.mp-from-task {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin: 0 12px 8px;
  padding: 10px 12px;
  background: #fff7ed;
  border: 1px solid #fed7aa;
  border-radius: 10px;
}

.mp-from-task-label {
  font-size: 11px;
  color: #9a3412;
}

.mp-from-task-name {
  font-size: 14px;
  font-weight: 600;
  color: #c2410c;
}

.mp-from-task-back {
  border: none;
  background: #fff;
  color: #ea580c;
  border-radius: 8px;
  padding: 6px 12px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  white-space: nowrap;
}

.mp-map-wrap {
  background: #fff;
  margin-bottom: 8px;
}

.mp-map {
  height: 180px;
  background: linear-gradient(160deg, #CCFBF1 0%, #E6FFFA 50%, #f0fdf4 100%);
  position: relative;
  overflow: hidden;
}

.mp-map-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(79, 209, 197, 0.06) 1px, transparent 1px),
    linear-gradient(90deg, rgba(79, 209, 197, 0.06) 1px, transparent 1px);
  background-size: 24px 24px;
}

.mp-map-pin {
  position: absolute;
  left: 50%;
  top: 46%;
  transform: translate(-50%, -100%);
  font-size: 36px;
  filter: drop-shadow(0 4px 8px rgba(0, 0, 0, 0.15));
  z-index: 2;
}

.mp-map-target {
  position: absolute;
  right: 16px;
  bottom: 16px;
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(255, 255, 255, 0.9);
  padding: 6px 10px;
  border-radius: 20px;
  font-size: 11px;
  color: #666;
}

.mp-map-target.active {
  background: #4FD1C5;
  color: #fff;
}

.mp-target-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #52c41a;
}

.mp-map-target.active .mp-target-dot {
  background: #fff;
}

.mp-address-card {
  padding: 12px 16px 14px;
  border-top: 1px solid #f0f0f0;
}

.mp-address-main {
  font-size: 15px;
  font-weight: 600;
  color: #1a1a1a;
  margin-bottom: 4px;
}

.mp-address-sub {
  font-size: 12px;
  color: #999;
}

.mp-address-sub.ok { color: #52c41a; }
.mp-address-sub.warn { color: #fa8c16; }

.mp-locate-tip {
  font-size: 11px;
  color: #fa8c16;
  margin-top: 4px;
}

.mp-methods {
  display: flex;
  gap: 8px;
  padding: 12px 14px;
  overflow-x: auto;
  background: #fff;
  margin-bottom: 8px;
}

.mp-method-btn {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 14px;
  border-radius: 20px;
  border: 1.5px solid #e8e8e8;
  background: #fafafa;
  font-size: 13px;
  color: #666;
  cursor: pointer;
}

.mp-method-btn.active {
  border-color: #4FD1C5;
  background: #E6FFFA;
  color: #4FD1C5;
  font-weight: 600;
}

.mp-method-icon { font-size: 15px; }

.mp-panel {
  margin: 0 14px 12px;
  background: #fff;
  border-radius: 14px;
  padding: 14px;
}

.mp-panel-title {
  font-size: 14px;
  font-weight: 700;
  color: #333;
  margin-bottom: 10px;
}

.mp-target-list { display: flex; flex-direction: column; gap: 8px; }

.mp-target-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 10px 12px;
  border: 1.5px solid #eee;
  border-radius: 10px;
  background: #fafafa;
  cursor: pointer;
  text-align: left;
}

.mp-target-item.active {
  border-color: #4FD1C5;
  background: #E6FFFA;
}

.mp-target-item-name {
  font-size: 14px;
  font-weight: 600;
  color: #333;
}

.mp-target-item-addr {
  font-size: 11px;
  color: #999;
  margin-top: 2px;
}

.mp-target-range {
  font-size: 11px;
  color: #4FD1C5;
  flex-shrink: 0;
}

.mp-wifi-current {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  background: #fff7e6;
  border-radius: 10px;
  margin-bottom: 10px;
}

.mp-wifi-current.ok {
  background: #f6ffed;
}

.mp-wifi-ssid {
  font-size: 15px;
  font-weight: 700;
  color: #333;
}

.mp-wifi-status {
  font-size: 12px;
  color: #999;
  margin-top: 2px;
}

.mp-wifi-current.ok .mp-wifi-status { color: #52c41a; }

.mp-link-btn {
  border: none;
  background: none;
  color: #4FD1C5;
  font-size: 13px;
  cursor: pointer;
  padding: 0;
}

.mp-wifi-hint {
  font-size: 11px;
  color: #bbb;
  margin-top: 8px;
}

.mp-qr-box {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.mp-qr-frame {
  width: 160px;
  height: 160px;
  border: 2px dashed #4FD1C5;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f8fbff;
  color: #999;
  font-size: 13px;
}

.mp-qr-done { color: #52c41a; font-weight: 700; font-size: 18px; }
.mp-qr-scanning { color: #4FD1C5; }

.mp-qr-btn {
  padding: 10px 32px;
  border: none;
  border-radius: 22px;
  background: #4FD1C5;
  color: #fff;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.mp-shift-bar {
  display: flex;
  justify-content: space-between;
  margin: 0 14px 12px;
  padding: 10px 14px;
  background: #fff;
  border-radius: 10px;
  font-size: 13px;
  color: #666;
}

.mp-shift-bar.rest { color: #999; justify-content: center; }

.mp-shift-bar.free {
  color: #409EFF;
  background: #ECF5FF;
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
}

.mp-free-bar-main {
  display: flex;
  justify-content: space-between;
  gap: 12px;
}

.mp-free-dept-fixed {
  font-size: 12px;
  color: #79bbff;
  font-weight: 600;
}

.mp-punch-area {
  display: flex;
  justify-content: center;
  padding: 8px 0 16px;
}

.mp-punch-circle {
  width: 168px;
  height: 168px;
  border-radius: 50%;
  border: none;
  background: linear-gradient(145deg, #4FD1C5, #38B2AC);
  color: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  cursor: pointer;
  box-shadow: 0 12px 32px rgba(79, 209, 197, 0.45);
}

.mp-punch-circle.free {
  background: linear-gradient(145deg, #409EFF, #66b1ff);
  box-shadow: 0 12px 32px rgba(64, 158, 255, 0.4);
}

.mp-punch-circle.out {
  background: linear-gradient(145deg, #64748b, #475569);
  box-shadow: 0 12px 32px rgba(71, 85, 105, 0.35);
}

.mp-punch-circle.out.free {
  background: linear-gradient(145deg, #337ecc, #409EFF);
  box-shadow: 0 12px 32px rgba(64, 158, 255, 0.35);
}

.mp-punch-circle.disabled {
  background: #e8e8e8;
  box-shadow: none;
  cursor: not-allowed;
  color: #aaa;
}

.mp-punch-mode {
  font-size: 12px;
  font-weight: 600;
  opacity: 0.92;
  letter-spacing: 0.5px;
}

.mp-punch-time {
  font-size: 22px;
  font-weight: 300;
  font-variant-numeric: tabular-nums;
  letter-spacing: 1px;
}

.mp-punch-label {
  font-size: 18px;
  font-weight: 700;
  margin-top: 2px;
}

.mp-punch-method {
  font-size: 11px;
  opacity: 0.85;
  margin-top: 2px;
}

.mp-records {
  margin: 0 14px;
  background: #fff;
  border-radius: 14px;
  padding: 14px;
}

.mp-records-title {
  font-size: 14px;
  font-weight: 700;
  margin-bottom: 10px;
}

.mp-records-empty {
  text-align: center;
  color: #ccc;
  font-size: 13px;
  padding: 8px;
}

.mp-record-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
  border-bottom: 1px solid #f5f5f5;
  font-size: 13px;
}

.mp-record-row:last-child { border-bottom: none; }

.mp-record-type {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
  font-weight: 500;
}

.mp-record-type.clock_in { background: #E6FFFA; color: #4FD1C5; }
.mp-record-type.clock_out { background: #e8f8ef; color: #52c41a; }

.mp-record-time {
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  min-width: 42px;
}

.mp-record-meta {
  flex: 1;
  text-align: right;
  font-size: 11px;
  color: #999;
}

.out-range {
  color: #fa8c16;
  margin-left: 4px;
}
</style>
