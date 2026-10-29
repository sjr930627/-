<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import dayjs from 'dayjs'
import EntMiniNavBar from '@/components/enterprise-miniapp/EntMiniNavBar.vue'
import { useAppStore } from '@/stores/app'
import { useEnterpriseMiniAuth } from '@/composables/useEnterpriseMiniAuth'
import { FREE_PUNCH_SHIFT_ID, isRestOnlyAssignment } from '@/constants/schedule'
import { isGrabAssignment } from '@/services/attendance'
import { resolveGrabSlotShiftName } from '@/services/grabShift'
import type { AttendanceHoursAudit } from '@/types'

type HoursTab = 'confirm' | 'correct'

const store = useAppStore()
const route = useRoute()
const { enterpriseId } = useEnterpriseMiniAuth()

const tab = ref<HoursTab>(route.query.tab === 'correct' ? 'correct' : 'confirm')

const employees = computed(() =>
  store.employees.filter((e) => e.status === 'active' && e.enterpriseId === enterpriseId.value),
)

const empIdSet = computed(() => new Set(employees.value.map((e) => e.id)))

interface HoursRecordRow {
  key: string
  employeeId: string
  name: string
  phone: string
  date: string
  shiftName: string
  shiftPeriod: string
  workHours: number
  reason: string
  operator: string
  operatedAt: string
  action: AttendanceHoursAudit['action']
}

function parseOverrideKey(key: string) {
  const datePart = key.slice(-10)
  const employeeId = key.slice(0, -11)
  return { employeeId, date: datePart }
}

function resolveShiftDisplay(employeeId: string, date: string) {
  const assignment = store.getAssignment(employeeId, date)
  const shift = assignment
    ? store.shifts.find((item) => item.id === assignment.shiftId)
    : undefined
  if (!shift) return { shiftName: '—', shiftPeriod: '—' }
  if (shift.code === 'REST') {
    return { shiftName: shift.name || '休息', shiftPeriod: '—' }
  }
  if (shift.id === FREE_PUNCH_SHIFT_ID || shift.code === 'FREE') {
    return { shiftName: '自由打卡', shiftPeriod: '—' }
  }
  let name = shift.name
  let start = shift.startTime
  let end = shift.endTime
  if (isGrabAssignment(assignment) && assignment?.fromGrabSlotId) {
    const slot = store.grabShiftSlots.find((item) => item.id === assignment.fromGrabSlotId)
    if (slot) {
      name = resolveGrabSlotShiftName(slot)
      start = slot.startTime || start
      end = slot.endTime || end
    }
  }
  const startText = start.slice(0, 5)
  const endText = end.slice(0, 5)
  return {
    shiftName: name || '—',
    shiftPeriod: startText && endText ? `${startText}-${endText}` : '—',
  }
}

const allAuditRecords = computed(() => {
  const rows: HoursRecordRow[] = []
  Object.entries(store.manualOverrides).forEach(([key, adj]) => {
    const { employeeId, date: d } = parseOverrideKey(key)
    if (!empIdSet.value.has(employeeId)) return
    const assignment = store.getAssignment(employeeId, d)
    const shiftEntity = assignment
      ? store.shifts.find((item) => item.id === assignment.shiftId)
      : undefined
    if (isRestOnlyAssignment(assignment, shiftEntity)) return
    const emp = store.employees.find((e) => e.id === employeeId)
    const name = emp?.name || employeeId
    const phone = emp?.phone || '—'
    const shift = resolveShiftDisplay(employeeId, d)
    const history = adj.hoursHistory ?? []
    if (history.length) {
      history.forEach((h, idx) => {
        rows.push({
          key: `${key}_${h.action}_${h.operatedAt}_${idx}`,
          employeeId,
          name,
          phone,
          date: d,
          shiftName: shift.shiftName,
          shiftPeriod: shift.shiftPeriod,
          workHours: h.workHours,
          reason: h.reason,
          operator: h.operator,
          operatedAt: h.operatedAt,
          action: h.action,
        })
      })
      return
    }
    if (adj.hoursCorrectedAt || (adj.note && adj.workHours != null)) {
      rows.push({
        key: `${key}_correct_fallback`,
        employeeId,
        name,
        phone,
        date: d,
        shiftName: shift.shiftName,
        shiftPeriod: shift.shiftPeriod,
        workHours: adj.workHours ?? 0,
        reason: adj.note || '工时矫正',
        operator: adj.hoursCorrectedBy || adj.hoursConfirmedBy || '—',
        operatedAt: adj.hoursCorrectedAt || adj.hoursConfirmedAt || '',
        action: 'correct',
      })
    } else if (adj.hoursConfirmed) {
      rows.push({
        key: `${key}_confirm_fallback`,
        employeeId,
        name,
        phone,
        date: d,
        shiftName: shift.shiftName,
        shiftPeriod: shift.shiftPeriod,
        workHours: adj.workHours ?? store.resolveSystemWorkHours(employeeId, d),
        reason: adj.note || '确认系统工时',
        operator: adj.hoursConfirmedBy || '—',
        operatedAt: adj.hoursConfirmedAt || '',
        action: 'confirm',
      })
    }
  })
  return rows.sort((a, b) => (b.operatedAt || '').localeCompare(a.operatedAt || ''))
})

const confirmRecords = computed(() => allAuditRecords.value.filter((r) => r.action === 'confirm'))
const correctRecords = computed(() => allAuditRecords.value.filter((r) => r.action === 'correct'))

const activeRecords = computed(() =>
  tab.value === 'confirm' ? confirmRecords.value : correctRecords.value,
)

function formatTime(iso?: string) {
  if (!iso) return '—'
  return dayjs(iso).format('YYYY-MM-DD HH:mm')
}
</script>

<template>
  <div class="mini-page">
    <EntMiniNavBar title="工时确认记录" back-to="/enterprise-miniapp/attendance" />

    <p class="hint">仅展示确认 / 矫正明细，不支持在此操作</p>

    <div class="tabs">
      <button
        type="button"
        :class="{ active: tab === 'confirm' }"
        @click="tab = 'confirm'"
      >
        工时确认记录
        <i v-if="confirmRecords.length">{{ confirmRecords.length }}</i>
      </button>
      <button
        type="button"
        :class="{ active: tab === 'correct' }"
        @click="tab = 'correct'"
      >
        工时矫正记录
        <i v-if="correctRecords.length">{{ correctRecords.length }}</i>
      </button>
    </div>

    <div class="record-list">
      <article v-for="row in activeRecords" :key="row.key" class="record-card">
        <div class="row">
          <strong>{{ row.name }}</strong>
          <span class="hours">{{ row.workHours }}h</span>
        </div>
        <dl class="kv">
          <div class="kv-row">
            <dt>手机号</dt>
            <dd>{{ row.phone }}</dd>
          </div>
          <div class="kv-row">
            <dt>班次名称</dt>
            <dd>{{ row.shiftName }}</dd>
          </div>
          <div class="kv-row">
            <dt>班次时间段</dt>
            <dd>{{ row.shiftPeriod }}</dd>
          </div>
          <div class="kv-row">
            <dt>班次日期</dt>
            <dd>{{ row.date }}</dd>
          </div>
        </dl>
        <dl class="kv op">
          <div class="kv-row">
            <dt>操作人</dt>
            <dd>{{ row.operator }}</dd>
          </div>
          <div class="kv-row">
            <dt>操作时间</dt>
            <dd>{{ formatTime(row.operatedAt) }}</dd>
          </div>
        </dl>
      </article>
      <div v-if="!activeRecords.length" class="empty">
        暂无{{ tab === 'confirm' ? '确认' : '矫正' }}记录
      </div>
    </div>
  </div>
</template>

<style scoped>
.hint {
  margin: 0;
  padding: 10px 16px 0;
  font-size: 12px;
  color: #9ca3af;
}
.tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0;
  margin: 10px 16px 0;
  background: #f3f4f6;
  border-radius: 10px;
  padding: 3px;
}
.tabs button {
  position: relative;
  height: 34px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: #6b7280;
  font-size: 13px;
  font-weight: 500;
}
.tabs button.active {
  background: #fff;
  color: #228BFF;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
}
.tabs i {
  position: absolute;
  top: 2px;
  right: 6px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: #228BFF;
  color: #fff;
  font-size: 10px;
  font-style: normal;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.record-list {
  padding: 12px 16px 28px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.record-card {
  background: #fff;
  border-radius: 12px;
  padding: 12px;
  box-shadow: var(--mini-shadow);
}
.row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.row strong {
  font-size: 15px;
  color: #111827;
}
.hours {
  color: #228BFF;
  font-weight: 600;
}
.kv {
  margin: 8px 0 0;
}
.kv.op {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px dashed #e5e7eb;
}
.kv-row {
  display: grid;
  grid-template-columns: 76px 1fr;
  gap: 8px;
  align-items: baseline;
  padding: 3px 0;
}
.kv-row dt {
  margin: 0;
  font-size: 12px;
  font-weight: 400;
  color: #9ca3af;
}
.kv-row dd {
  margin: 0;
  font-size: 13px;
  color: #1f2937;
  line-height: 1.35;
}
.empty {
  padding: 40px 16px;
  text-align: center;
  color: #9ca3af;
  font-size: 13px;
  background: #fff;
  border-radius: 12px;
}
</style>
