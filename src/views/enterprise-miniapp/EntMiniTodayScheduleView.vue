<script setup lang="ts">
import { computed } from 'vue'
import EntMiniNavBar from '@/components/enterprise-miniapp/EntMiniNavBar.vue'
import { useAppStore } from '@/stores/app'
import { useEnterpriseMiniAuth } from '@/composables/useEnterpriseMiniAuth'
import {
  buildDailyAttendanceList,
  getStatusLabel,
  getStatusTagType,
} from '@/services/attendance'

const store = useAppStore()
const { enterpriseId } = useEnterpriseMiniAuth()

const today = '2026-07-27'

const employees = computed(() =>
  store.employees.filter((e) => e.status === 'active' && e.enterpriseId === enterpriseId.value),
)

const empMap = computed(() => new Map(employees.value.map((e) => [e.id, e])))

const shiftGroups = computed(() => {
  const empIds = employees.value.map((e) => e.id)
  if (!empIds.length) return []

  const daily = buildDailyAttendanceList(
    empIds,
    [today],
    store.assignments,
    store.shifts,
    store.punches,
    store.leaveRequests,
    store.attendanceRule,
    store.manualOverrides,
  ).filter((d) => d.shiftId && d.shiftId !== 'shift_rest')

  const byShift = new Map<
    string,
    {
      shiftId: string
      shiftName: string
      period: string
      color: string
      members: {
        employeeId: string
        name: string
        position: string
        statusLabel: string
        tagType: string
        clockIn: string
        clockOut: string
      }[]
    }
  >()

  for (const row of daily) {
    const shift = store.shifts.find((s) => s.id === row.shiftId)
    if (!shift) continue
    let group = byShift.get(shift.id)
    if (!group) {
      group = {
        shiftId: shift.id,
        shiftName: shift.name,
        period: `${shift.startTime} - ${shift.endTime}`,
        color: shift.color || '#228BFF',
        members: [],
      }
      byShift.set(shift.id, group)
    }
    const emp = empMap.value.get(row.employeeId)
    group.members.push({
      employeeId: row.employeeId,
      name: emp?.name || row.employeeId,
      position: emp?.position || '—',
      statusLabel: getStatusLabel(row.status),
      tagType: getStatusTagType(row.status),
      clockIn: row.clockIn || '—',
      clockOut: row.clockOut || '—',
    })
  }

  return [...byShift.values()].sort((a, b) => a.period.localeCompare(b.period))
})

const totalCount = computed(() =>
  shiftGroups.value.reduce((s, g) => s + g.members.length, 0),
)
</script>

<template>
  <div class="mini-page">
    <EntMiniNavBar title="今日排班" back-to="/enterprise-miniapp/attendance" />

    <div class="summary">
      <div>
        <strong>{{ today }}</strong>
        <span>排班日期</span>
      </div>
      <div>
        <strong>{{ shiftGroups.length }}</strong>
        <span>班次</span>
      </div>
      <div>
        <strong>{{ totalCount }}</strong>
        <span>排班人次</span>
      </div>
    </div>

    <div class="list">
      <section v-for="group in shiftGroups" :key="group.shiftId" class="shift-card">
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
      <div v-if="!shiftGroups.length" class="empty">今日暂无排班</div>
    </div>
  </div>
</template>

<style scoped>
.summary {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
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
.shift-card {
  background: #fff;
  border-radius: 14px;
  padding: 12px 14px;
  box-shadow: var(--mini-shadow);
}
.shift-card header {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  padding-bottom: 8px;
  margin-bottom: 4px;
  border-bottom: 1px solid #f3f4f6;
}
.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-top: 5px;
  flex-shrink: 0;
}
.shift-card header strong {
  font-size: 14px;
  color: #111827;
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
