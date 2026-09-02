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
  canCorrectWorkHours,
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

type HoursRow = {
  rowKey: string
  employeeId: string
  employeeName: string
  date: string
  workHours: number
  scheduledHours: number
  workHoursCorrected?: boolean
  manualNote?: string
  canConfirm: boolean
  canCorrect: boolean
}

const correctionOpen = ref(false)
const correctionTarget = ref<HoursRow | null>(null)
const correctionHours = ref(0)
const correctionNote = ref('')

type ConfirmFlowState = {
  rowKey: string
  step: 1 | 2
  workHours: number
  note: string
}
const confirmFlow = ref<ConfirmFlowState | null>(null)

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
        canCorrect: canCorrectWorkHours(d),
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

const confirmFlowRow = computed(() => {
  if (!confirmFlow.value) return null
  return tableData.value.find((r) => r.rowKey === confirmFlow.value!.rowKey) ?? null
})

watch(date, () => {
  selectedKeys.value = []
  closeCorrection()
  closeConfirmFlow()
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

function openCorrection(row: HoursRow) {
  correctionTarget.value = row
  correctionHours.value = row.workHoursCorrected ? row.workHours : row.scheduledHours
  correctionNote.value = row.manualNote ?? ''
  correctionOpen.value = true
}

function closeCorrection() {
  correctionOpen.value = false
  correctionTarget.value = null
  correctionNote.value = ''
}

function submitCorrection() {
  if (!correctionTarget.value) return
  if (correctionHours.value < 0) {
    ElMessage.warning('工时不能为负数')
    return
  }
  const note = correctionNote.value.trim()
  if (!note) {
    ElMessage.warning('矫正原因必填')
    return
  }
  try {
    store.setWorkHoursCorrection(
      correctionTarget.value.employeeId,
      correctionTarget.value.date,
      correctionHours.value,
      note,
      operatorName.value,
      { autoConfirm: false },
    )
    ElMessage.success('工时已矫正，请继续确认工时')
    closeCorrection()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '矫正失败')
  }
}

function openConfirmFlow(row: HoursRow) {
  if (!row.canConfirm) return
  confirmFlow.value = {
    rowKey: row.rowKey,
    step: 1,
    workHours: row.workHours,
    note: row.manualNote ?? '',
  }
}

function closeConfirmFlow() {
  confirmFlow.value = null
}

function confirmFlowNext() {
  const flow = confirmFlow.value
  const row = confirmFlowRow.value
  if (!flow || !row) return

  if (flow.workHours < 0) {
    ElMessage.warning('工时不能为负数')
    return
  }

  const hoursChanged = Math.abs(flow.workHours - row.workHours) > 0.05
  const note = flow.note.trim()

  if (hoursChanged || note) {
    if (!note) {
      ElMessage.warning('调整工时必须填写矫正原因')
      return
    }
    try {
      store.setWorkHoursCorrection(
        row.employeeId,
        row.date,
        flow.workHours,
        note,
        operatorName.value,
        { autoConfirm: false },
      )
    } catch (e) {
      ElMessage.error(e instanceof Error ? e.message : '矫正失败')
      return
    }
  }

  confirmFlow.value = { ...flow, step: 2 }
}

async function confirmFlowSubmit() {
  const row = confirmFlowRow.value
  if (!row) return

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
    closeConfirmFlow()
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
      warning ||
        `将确认所选 ${rows.length} 条记录的当前工时（建议先逐条完成工时矫正），是否继续？`,
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

    <p class="flow-hint">确认流程：先完成工时矫正（如有需要），再确认工时</p>

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
              <span v-if="row.workHoursCorrected" class="corrected">已矫正</span>
              <span v-if="row.hoursConfirmed" class="ok">已确认</span>
              <span v-else-if="row.canConfirm" class="pending">待确认</span>
            </p>
            <p v-if="row.workHoursCorrected && row.manualNote" class="note">{{ row.manualNote }}</p>
          </div>
        </div>
        <div v-if="row.canConfirm" class="card-actions">
          <button
            v-if="row.canCorrect"
            type="button"
            class="action-btn correct"
            @click="openCorrection(row)"
          >
            校正工时
          </button>
          <button type="button" class="action-btn confirm" @click="openConfirmFlow(row)">
            确认工时
          </button>
        </div>
      </article>
      <div v-if="!tableData.length" class="empty">当日无可确认出勤记录</div>
    </div>

    <div v-if="correctionOpen && correctionTarget" class="sheet-mask" @click.self="closeCorrection">
      <div class="sheet">
        <header>
          <strong>校正工时</strong>
          <button type="button" class="close" @click="closeCorrection">×</button>
        </header>
        <p class="sheet-meta">
          {{ correctionTarget.employeeName }} · {{ correctionTarget.date }} · 排班
          {{ correctionTarget.scheduledHours }}h · 当前 {{ correctionTarget.workHours }}h
        </p>
        <label>矫正工时（小时）</label>
        <input v-model.number="correctionHours" type="number" min="0" max="24" step="0.5">
        <label>矫正原因（必填）</label>
        <textarea
          v-model="correctionNote"
          rows="3"
          placeholder="如：漏打卡已核实，按实际出勤矫正"
        />
        <button type="button" class="submit correct-submit" @click="submitCorrection">
          保存矫正
        </button>
      </div>
    </div>

    <div v-if="confirmFlow && confirmFlowRow" class="sheet-mask" @click.self="closeConfirmFlow">
      <div class="sheet">
        <header>
          <strong>{{ confirmFlow.step === 1 ? '第 1 步：工时矫正' : '第 2 步：确认工时' }}</strong>
          <button type="button" class="close" @click="closeConfirmFlow">×</button>
        </header>

        <p class="sheet-meta">
          {{ confirmFlowRow.employeeName }} · {{ confirmFlowRow.date }} · 排班
          {{ confirmFlowRow.scheduledHours }}h
        </p>

        <template v-if="confirmFlow.step === 1">
          <p class="step-tip">如有差异请先矫正工时；无需调整可直接下一步</p>
          <label>矫正工时（小时）</label>
          <input v-model.number="confirmFlow.workHours" type="number" min="0" max="24" step="0.5">
          <label>矫正原因（有调整时必填）</label>
          <textarea
            v-model="confirmFlow.note"
            rows="3"
            placeholder="调整工时时请填写原因"
          />
          <button type="button" class="submit" @click="confirmFlowNext">下一步：确认工时</button>
        </template>

        <template v-else>
          <div class="confirm-summary">
            <span>确认工时</span>
            <strong>{{ confirmFlowRow.workHours }}h</strong>
          </div>
          <p v-if="confirmFlowRow.workHoursCorrected" class="step-tip ok-tip">
            已完成工时矫正，确认后将通知相关流程归档
          </p>
          <p v-else class="step-tip">按当前系统工时确认，如有异议请返回上一步矫正</p>
          <div class="step-actions">
            <button type="button" class="ghost-btn" @click="confirmFlow!.step = 1">上一步</button>
            <button type="button" class="submit" @click="confirmFlowSubmit">确认工时</button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped>
.flow-hint {
  margin: 0;
  padding: 8px 16px 0;
  font-size: 12px;
  color: #6b7280;
}
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
  background: #228BFF;
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
  flex-direction: column;
  gap: 10px;
  background: #fff;
  border-radius: 12px;
  padding: 12px;
  box-shadow: var(--mini-shadow);
}
.card.muted {
  opacity: 0.72;
}
.card.highlight {
  border: 1px solid #93c5fd;
  box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.15);
}
.card-main {
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
  color: #228BFF;
}
.note {
  margin: 4px 0 0;
  font-size: 11px;
  color: #9ca3af;
  line-height: 1.4;
}
.corrected {
  margin-left: 8px;
  font-size: 11px;
  color: #d97706;
  background: #fffbeb;
  padding: 1px 6px;
  border-radius: 999px;
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
.tag.info { background: #eff6ff; color: #228BFF; }
.card-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}
.action-btn {
  height: 32px;
  padding: 0 12px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  flex-shrink: 0;
}
.action-btn.correct {
  border: 1px solid #d1d5db;
  background: #fff;
  color: #374151;
}
.action-btn.confirm {
  border: 1px solid #228BFF;
  background: #228BFF;
  color: #fff;
}
.empty {
  padding: 40px 16px;
  text-align: center;
  color: #9ca3af;
  font-size: 13px;
}
.sheet-mask {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  z-index: 80;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.sheet {
  width: min(420px, 100%);
  max-height: 86vh;
  overflow: auto;
  background: #fff;
  border-radius: 16px 16px 0 0;
  padding: 16px 16px 24px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sheet header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.sheet .close {
  border: none;
  background: none;
  font-size: 22px;
  color: #9ca3af;
}
.sheet-meta {
  margin: 0;
  font-size: 12px;
  color: #6b7280;
  line-height: 1.5;
}
.step-tip {
  margin: 0;
  font-size: 12px;
  color: #6b7280;
  line-height: 1.5;
}
.ok-tip {
  color: #059669;
}
.sheet label {
  font-size: 12px;
  color: #6b7280;
  margin-top: 4px;
}
.sheet input,
.sheet textarea {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 10px;
  font-size: 14px;
  color: #374151;
}
.sheet textarea {
  resize: vertical;
}
.confirm-summary {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  padding: 14px 12px;
  border-radius: 10px;
  background: #f5f3ff;
  color: #228BFF;
}
.confirm-summary strong {
  font-size: 22px;
}
.step-actions {
  display: flex;
  gap: 8px;
  margin-top: 4px;
}
.ghost-btn {
  flex: 1;
  height: 42px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
  color: #374151;
  font-weight: 600;
}
.submit {
  flex: 1;
  margin-top: 4px;
  height: 42px;
  border: none;
  border-radius: 10px;
  background: #228BFF;
  color: #fff;
  font-weight: 600;
}
.correct-submit {
  background: #3b82f6;
}
.step-actions .submit {
  margin-top: 0;
}
</style>
