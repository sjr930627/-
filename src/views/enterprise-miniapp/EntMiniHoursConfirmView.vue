<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import dayjs from 'dayjs'
import EntMiniNavBar from '@/components/enterprise-miniapp/EntMiniNavBar.vue'
import { useAppStore } from '@/stores/app'
import { useEnterpriseMiniAuth } from '@/composables/useEnterpriseMiniAuth'
import {
  buildConfirmHoursWarning,
  buildDailyAttendanceList,
  canConfirmWorkHours,
  getStatusLabel,
  getStatusTagType,
  isDailyAttendanceVisible,
} from '@/services/attendance'

const route = useRoute()
const store = useAppStore()
const { enterpriseId, displayName } = useEnterpriseMiniAuth()

const date = ref(
  typeof route.query.date === 'string' ? route.query.date : '2026-07-27',
)
const highlightEmployee = ref(
  typeof route.query.employee === 'string' ? route.query.employee : '',
)
const selectedKeys = ref<string[]>([])

const employees = computed(() =>
  store.employees.filter((e) => e.status === 'active' && e.enterpriseId === enterpriseId.value),
)

const operatorName = computed(() => displayName.value || '企业管理员')

const tableData = computed(() => {
  const empIds = employees.value.map((e) => e.id)
  if (!empIds.length) return []
  return buildDailyAttendanceList(
    empIds,
    [date.value],
    store.assignments,
    store.shifts,
    store.punches,
    store.leaveRequests,
    store.attendanceRule,
    store.manualOverrides,
  )
    .filter(isDailyAttendanceVisible)
    .map((d) => {
      const emp = store.employees.find((e) => e.id === d.employeeId)
      const shift = d.shiftId ? store.shifts.find((s) => s.id === d.shiftId) : undefined
      return {
        ...d,
        rowKey: `${d.employeeId}_${d.date}`,
        employeeName: emp?.name ?? d.employeeId,
        shiftName: shift?.name ?? '—',
        statusLabel: getStatusLabel(d.status),
        tagType: getStatusTagType(d.status),
        canConfirm: canConfirmWorkHours(d),
      }
    })
})

const pendingRows = computed(() => tableData.value.filter((r) => r.canConfirm))

const selectedConfirmable = computed(() =>
  pendingRows.value.filter((r) => selectedKeys.value.includes(r.rowKey)),
)

const allPendingSelected = computed(
  () =>
    pendingRows.value.length > 0 &&
    pendingRows.value.every((r) => selectedKeys.value.includes(r.rowKey)),
)

watch(date, () => {
  selectedKeys.value = []
})

function shiftDay(delta: number) {
  date.value = dayjs(date.value).add(delta, 'day').format('YYYY-MM-DD')
}

function toggleOne(rowKey: string, canConfirm: boolean) {
  if (!canConfirm) return
  if (selectedKeys.value.includes(rowKey)) {
    selectedKeys.value = selectedKeys.value.filter((k) => k !== rowKey)
  } else {
    selectedKeys.value = [...selectedKeys.value, rowKey]
  }
}

function toggleAll() {
  if (allPendingSelected.value) {
    selectedKeys.value = []
    return
  }
  selectedKeys.value = pendingRows.value.map((r) => r.rowKey)
}

async function confirmOne(row: (typeof tableData.value)[0]) {
  if (!row.canConfirm) return
  const warning = buildConfirmHoursWarning([
    {
      name: row.employeeName,
      workHours: row.workHours,
      scheduledHours: row.scheduledHours,
    },
  ])
  if (warning) {
    try {
      await ElMessageBox.confirm(warning, '工时异常提醒', {
        type: 'warning',
        confirmButtonText: '仍按现工时确认',
        cancelButtonText: '取消',
      })
    } catch {
      return
    }
  }
  try {
    store.confirmWorkHours(row.employeeId, row.date, {
      workHours: row.workHours,
      operator: operatorName.value,
    })
    ElMessage.success(`已确认 ${row.employeeName} 工时 ${row.workHours}h`)
    selectedKeys.value = selectedKeys.value.filter((k) => k !== row.rowKey)
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '确认失败')
  }
}

async function batchConfirm() {
  const rows = selectedConfirmable.value
  if (!rows.length) {
    ElMessage.warning('请先勾选待确认工时的记录')
    return
  }
  const warning = buildConfirmHoursWarning(
    rows.map((r) => ({
      name: r.employeeName,
      workHours: r.workHours,
      scheduledHours: r.scheduledHours,
    })),
  )
  try {
    await ElMessageBox.confirm(
      warning || `将确认所选 ${rows.length} 条记录的当前工时，是否继续？`,
      warning ? '工时异常提醒' : '批量确认工时',
      {
        type: 'warning',
        confirmButtonText: warning ? '仍按现工时确认' : '确定',
        cancelButtonText: '取消',
      },
    )
  } catch {
    return
  }
  const count = store.batchConfirmWorkHours(
    rows.map((r) => ({
      employeeId: r.employeeId,
      date: r.date,
      workHours: r.workHours,
    })),
    { operator: operatorName.value },
  )
  selectedKeys.value = []
  ElMessage.success(`已批量确认 ${count} 条工时`)
}
</script>

<template>
  <div class="mini-page">
    <EntMiniNavBar title="工时确认" back-to="/enterprise-miniapp/attendance" />

    <div class="date-bar">
      <button type="button" @click="shiftDay(-1)">‹</button>
      <input v-model="date" type="date">
      <button type="button" @click="shiftDay(1)">›</button>
    </div>

    <div class="toolbar">
      <label class="check-all">
        <input
          type="checkbox"
          :checked="allPendingSelected"
          :disabled="!pendingRows.length"
          @change="toggleAll"
        >
        全选待确认（{{ pendingRows.length }}）
      </label>
      <button
        type="button"
        class="batch-btn"
        :disabled="!selectedConfirmable.length"
        @click="batchConfirm"
      >
        批量确认{{ selectedConfirmable.length ? `(${selectedConfirmable.length})` : '' }}
      </button>
    </div>

    <div class="list">
      <article
        v-for="row in tableData"
        :key="row.rowKey"
        class="card"
        :class="{ muted: !row.canConfirm, highlight: highlightEmployee === row.employeeId }"
      >
        <div class="card-main" @click="toggleOne(row.rowKey, row.canConfirm)">
          <input
            type="checkbox"
            :checked="selectedKeys.includes(row.rowKey)"
            :disabled="!row.canConfirm"
            @click.stop
            @change="toggleOne(row.rowKey, row.canConfirm)"
          >
          <div class="info">
            <div class="row">
              <strong>{{ row.employeeName }}</strong>
              <span class="tag" :class="row.tagType">{{ row.statusLabel }}</span>
            </div>
            <p class="meta">{{ row.shiftName }} · 排班 {{ row.scheduledHours }}h</p>
            <p class="hours">
              工时 <em>{{ row.workHours }}h</em>
              <span v-if="row.hoursConfirmed" class="ok">已确认</span>
              <span v-else class="pending">待确认</span>
            </p>
          </div>
        </div>
        <button
          v-if="row.canConfirm"
          type="button"
          class="confirm-btn"
          @click="confirmOne(row)"
        >
          确认
        </button>
      </article>
      <div v-if="!tableData.length" class="empty">当日无可确认出勤记录</div>
    </div>
  </div>
</template>

<style scoped>
.date-bar {
  display: flex;
  gap: 8px;
  align-items: center;
  padding: 10px 16px 6px;
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
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 4px 16px 10px;
}
.check-all {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #6b7280;
}
.batch-btn {
  height: 32px;
  padding: 0 12px;
  border: none;
  border-radius: 999px;
  background: #5b4fdb;
  color: #fff;
  font-size: 13px;
  font-weight: 600;
}
.batch-btn:disabled {
  opacity: 0.45;
}
.list {
  padding: 0 16px 28px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.card {
  display: flex;
  align-items: stretch;
  gap: 8px;
  background: #fff;
  border-radius: 12px;
  padding: 12px;
  box-shadow: var(--mini-shadow);
}
.card.muted {
  opacity: 0.72;
}
.card.highlight {
  border-color: #93c5fd;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
}
.card-main {
  flex: 1;
  display: flex;
  gap: 10px;
  align-items: flex-start;
  min-width: 0;
}
.info {
  flex: 1;
  min-width: 0;
}
.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.meta {
  margin: 4px 0 0;
  font-size: 12px;
  color: #9ca3af;
}
.hours {
  margin: 6px 0 0;
  font-size: 13px;
  color: #374151;
}
.hours em {
  font-style: normal;
  font-weight: 700;
  color: #5b4fdb;
}
.ok {
  margin-left: 8px;
  font-size: 11px;
  color: #059669;
}
.pending {
  margin-left: 8px;
  font-size: 11px;
  color: #d97706;
}
.tag {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 999px;
  background: #f3f4f6;
  color: #6b7280;
  flex-shrink: 0;
}
.tag.success { background: #ecfdf5; color: #059669; }
.tag.warning { background: #fffbeb; color: #d97706; }
.tag.danger { background: #fef2f2; color: #dc2626; }
.tag.info { background: #eff6ff; color: #2563eb; }
.confirm-btn {
  align-self: center;
  height: 32px;
  padding: 0 12px;
  border: 1px solid #5b4fdb;
  border-radius: 999px;
  background: #fff;
  color: #5b4fdb;
  font-size: 13px;
  font-weight: 600;
  flex-shrink: 0;
}
.empty {
  padding: 40px 16px;
  text-align: center;
  color: #9ca3af;
  font-size: 13px;
}
</style>
