<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import dayjs from 'dayjs'
import EntMiniNavBar from '@/components/enterprise-miniapp/EntMiniNavBar.vue'
import { useAppStore } from '@/stores/app'
import { useEnterpriseMiniAuth } from '@/composables/useEnterpriseMiniAuth'
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
  date: string
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

const allAuditRecords = computed(() => {
  const rows: HoursRecordRow[] = []
  Object.entries(store.manualOverrides).forEach(([key, adj]) => {
    const { employeeId, date: d } = parseOverrideKey(key)
    if (!empIdSet.value.has(employeeId)) return
    const name = store.employees.find((e) => e.id === employeeId)?.name || employeeId
    const history = adj.hoursHistory ?? []
    if (history.length) {
      history.forEach((h, idx) => {
        rows.push({
          key: `${key}_${h.action}_${h.operatedAt}_${idx}`,
          employeeId,
          name,
          date: d,
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
        date: d,
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
        date: d,
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
        <p class="meta">{{ row.date }} · {{ row.operator }} · {{ formatTime(row.operatedAt) }}</p>
        <p class="reason">{{ row.reason }}</p>
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
.hours {
  color: #228BFF;
  font-weight: 600;
}
.meta,
.reason {
  margin: 4px 0 0;
  font-size: 11px;
  color: #9ca3af;
}
.reason {
  color: #228BFF;
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
