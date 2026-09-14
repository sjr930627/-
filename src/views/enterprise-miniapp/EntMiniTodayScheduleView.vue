<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import EntMiniNavBar from '@/components/enterprise-miniapp/EntMiniNavBar.vue'
import { useAppStore } from '@/stores/app'
import { useEnterpriseMiniAuth } from '@/composables/useEnterpriseMiniAuth'
import {
  buildDailyAttendanceList,
  getStatusLabel,
  getStatusTagType,
  isGrabAssignment,
} from '@/services/attendance'
import { resolveGrabSlotShiftName } from '@/services/grabShift'
import { getDepartmentDescendantIds } from '@/utils'

const route = useRoute()
const store = useAppStore()
const { enterpriseId } = useEnterpriseMiniAuth()

const today = '2026-07-27'

const deptFilterId = computed(() =>
  typeof route.query.dept === 'string' ? route.query.dept : '',
)

const scopedDeptIds = computed(() => {
  if (!deptFilterId.value) return null
  return getDepartmentDescendantIds(
    store.getDepartmentsByEnterprise(enterpriseId.value),
    deptFilterId.value,
  )
})

const employees = computed(() =>
  store.employees.filter((e) => {
    if (e.status !== 'active' || e.enterpriseId !== enterpriseId.value) return false
    if (!scopedDeptIds.value) return true
    return Boolean(e.departmentId && scopedDeptIds.value.has(e.departmentId))
  }),
)

const empMap = computed(() => new Map(employees.value.map((e) => [e.id, e])))

const dailyRows = computed(() => {
  const empIds = employees.value.map((e) => e.id)
  if (!empIds.length) return []
  return buildDailyAttendanceList(
    empIds,
    [today],
    store.assignments,
    store.shifts,
    store.punches,
    store.leaveRequests,
    store.attendanceRule,
    store.manualOverrides,
  ).filter((d) => d.shiftId)
})

type MemberRow = {
  employeeId: string
  name: string
  position: string
  statusLabel: string
  tagType: string
  clockIn: string
  clockOut: string
}

type ShiftGroup = {
  key: string
  shiftName: string
  period: string
  color: string
  isRest: boolean
  isGrab: boolean
  isFreePunch: boolean
  members: MemberRow[]
}

function memberFromDaily(row: (typeof dailyRows.value)[number]): MemberRow {
  const emp = empMap.value.get(row.employeeId)
  return {
    employeeId: row.employeeId,
    name: emp?.name || row.employeeId,
    position: emp?.position || '—',
    statusLabel: getStatusLabel(row.status),
    tagType: getStatusTagType(row.status),
    clockIn: row.clockIn || '—',
    clockOut: row.clockOut || '—',
  }
}

const scheduleGroups = computed(() => {
  const byShift = new Map<string, ShiftGroup>()

  for (const row of dailyRows.value) {
    const assignment = store.assignments.find(
      (a) => a.employeeId === row.employeeId && a.date === today && a.shiftId === row.shiftId,
    )
    if (isGrabAssignment(assignment)) continue

    const shift = store.shifts.find((s) => s.id === row.shiftId)
    if (!shift) continue
    let group = byShift.get(shift.id)
    if (!group) {
      const isRest = shift.code === 'REST' || shift.id === 'shift_rest'
      const isFreePunch = shift.id === 'shift_free_punch'
      group = {
        key: shift.id,
        shiftName: shift.name,
        period: isRest ? '休息日' : `${shift.startTime} - ${shift.endTime}`,
        color: shift.color || '#228BFF',
        isRest,
        isGrab: false,
        isFreePunch,
        members: [],
      }
      byShift.set(shift.id, group)
    }
    group.members.push(memberFromDaily(row))
  }

  return [...byShift.values()].sort((a, b) => {
    if (a.isRest !== b.isRest) return a.isRest ? 1 : -1
    if (a.isFreePunch !== b.isFreePunch) return a.isFreePunch ? 1 : -1
    return a.period.localeCompare(b.period)
  })
})

const grabGroups = computed(() => {
  const bySlot = new Map<string, ShiftGroup>()

  for (const row of dailyRows.value) {
    const assignment = store.assignments.find(
      (a) => a.employeeId === row.employeeId && a.date === today && a.shiftId === row.shiftId,
    )
    if (!isGrabAssignment(assignment) || !assignment?.fromGrabSlotId) continue

    const slot = store.grabShiftSlots.find((s) => s.id === assignment.fromGrabSlotId)
    const shift = store.shifts.find((s) => s.id === row.shiftId)
    const key = assignment.fromGrabSlotId
    let group = bySlot.get(key)
    if (!group) {
      const shiftName = slot ? resolveGrabSlotShiftName(slot) : shift?.name || '抢班班次'
      const start = (slot?.startTime ?? shift?.startTime ?? '').slice(0, 5)
      const end = (slot?.endTime ?? shift?.endTime ?? '').slice(0, 5)
      group = {
        key,
        shiftName,
        period: start && end ? `${start} - ${end}` : '—',
        color: shift?.color || '#10B981',
        isRest: false,
        isGrab: true,
        isFreePunch: false,
        members: [],
      }
      bySlot.set(key, group)
    }
    group.members.push(memberFromDaily(row))
  }

  return [...bySlot.values()].sort((a, b) => a.period.localeCompare(b.period))
})

const workGroups = computed(() =>
  scheduleGroups.value.filter((g) => !g.isRest && !g.isFreePunch),
)
const freePunchGroup = computed(
  () => scheduleGroups.value.find((g) => g.isFreePunch) ?? null,
)

const workCount = computed(() => workGroups.value.reduce((s, g) => s + g.members.length, 0))
const grabCount = computed(() => grabGroups.value.reduce((s, g) => s + g.members.length, 0))
const presentCount = computed(() => {
  const empIds = new Set(employees.value.map((e) => e.id))
  return new Set(
    store.punches
      .filter((p) => p.date === today && empIds.has(p.employeeId))
      .map((p) => p.employeeId),
  ).size
})

const hasAny =
  computed(() => workGroups.value.length > 0 || grabGroups.value.length > 0 || !!freePunchGroup.value)
</script>

<template>
  <div class="mini-page">
    <EntMiniNavBar title="当日出勤管理" back-to="/enterprise-miniapp/attendance" />

    <div class="summary">
      <div>
        <strong>{{ today }}</strong>
        <span>出勤日期</span>
      </div>
      <div>
        <strong>{{ workCount }}</strong>
        <span>排班人次</span>
      </div>
      <div>
        <strong>{{ grabCount }}</strong>
        <span>抢班人次</span>
      </div>
      <div>
        <strong>{{ presentCount }}</strong>
        <span>已出勤</span>
      </div>
    </div>

    <div class="list">
      <template v-if="workGroups.length">
        <div class="section-label">排班班次</div>
        <section v-for="group in workGroups" :key="group.key" class="shift-card">
          <header>
            <i class="dot" :style="{ background: group.color }" />
            <div>
              <strong>{{ group.shiftName }}</strong>
              <p>{{ group.period }} · {{ group.members.length }} 人</p>
            </div>
          </header>
          <article v-for="m in group.members" :key="m.employeeId" class="member">
            <div class="row">
              <strong>{{ m.name }}</strong>
              <span class="tag" :class="m.tagType">{{ m.statusLabel }}</span>
            </div>
            <p>{{ m.position }} · 上班 {{ m.clockIn }} · 下班 {{ m.clockOut }}</p>
          </article>
        </section>
      </template>

      <template v-if="grabGroups.length">
        <div class="section-label">抢班班次</div>
        <section v-for="group in grabGroups" :key="group.key" class="shift-card grab">
          <header>
            <i class="dot" :style="{ background: group.color }" />
            <div>
              <div class="title-row">
                <strong>{{ group.shiftName }}</strong>
                <span class="grab-badge">抢班</span>
              </div>
              <p>{{ group.period }} · {{ group.members.length }} 人</p>
            </div>
          </header>
          <article v-for="m in group.members" :key="m.employeeId" class="member">
            <div class="row">
              <strong>{{ m.name }}</strong>
              <span class="tag" :class="m.tagType">{{ m.statusLabel }}</span>
            </div>
            <p>{{ m.position }} · 上班 {{ m.clockIn }} · 下班 {{ m.clockOut }}</p>
          </article>
        </section>
      </template>

      <section v-if="freePunchGroup" class="shift-card">
        <header>
          <i class="dot" :style="{ background: freePunchGroup.color }" />
          <div>
            <strong>{{ freePunchGroup.shiftName }}</strong>
            <p>打卡即出勤 · {{ freePunchGroup.members.length }} 人</p>
          </div>
        </header>
        <article v-for="m in freePunchGroup.members" :key="m.employeeId" class="member">
          <div class="row">
            <strong>{{ m.name }}</strong>
            <span class="tag" :class="m.tagType">{{ m.statusLabel }}</span>
          </div>
          <p>{{ m.position }} · 上班 {{ m.clockIn }} · 下班 {{ m.clockOut }}</p>
        </article>
      </section>

      <div v-if="!hasAny" class="empty">当日暂无出勤数据</div>
    </div>
  </div>
</template>

<style scoped>
.summary {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  padding: 12px 16px 8px;
}
.summary div {
  background: #fff;
  border-radius: 12px;
  padding: 10px 8px;
  text-align: center;
  box-shadow: var(--mini-shadow);
}
.summary strong {
  display: block;
  font-size: 15px;
  color: #111827;
}
.summary span {
  font-size: 11px;
  color: #9ca3af;
}
.list {
  padding: 4px 16px 28px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.section-label {
  margin: 4px 0 -2px;
  font-size: 13px;
  font-weight: 600;
  color: #6b7280;
}
.shift-card {
  background: #fff;
  border-radius: 14px;
  padding: 12px 14px;
  box-shadow: var(--mini-shadow);
}
.shift-card.grab {
  border: 1px solid #d1fae5;
  background: #f0fdf4;
}
.shift-card header {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding-bottom: 8px;
  margin-bottom: 4px;
  border-bottom: 1px solid #f3f4f6;
}
.shift-card.grab header {
  border-bottom-color: #d1fae5;
}
.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-top: 5px;
  flex-shrink: 0;
}
.title-row {
  display: flex;
  align-items: center;
  gap: 6px;
}
.shift-card header strong {
  font-size: 14px;
  color: #111827;
}
.grab-badge {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 999px;
  background: #10b981;
  color: #fff;
}
.shift-card header p {
  margin: 2px 0 0;
  font-size: 12px;
  color: #9ca3af;
}
.member {
  padding: 10px 0;
  border-bottom: 1px dashed #f3f4f6;
}
.member:last-child {
  border-bottom: none;
  padding-bottom: 2px;
}
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.row strong {
  font-size: 14px;
  color: #1f2937;
}
.member p {
  margin: 4px 0 0;
  font-size: 12px;
  color: #6b7280;
}
.tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  background: #f3f4f6;
  color: #6b7280;
}
.tag.success { background: #ecfdf5; color: #059669; }
.tag.warning { background: #fffbeb; color: #d97706; }
.tag.danger { background: #fef2f2; color: #dc2626; }
.tag.info { background: #eff6ff; color: #228BFF; }
.empty {
  padding: 48px 16px;
  text-align: center;
  color: #9ca3af;
  font-size: 13px;
}
</style>
