<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'
import EntMiniNavBar from '@/components/enterprise-miniapp/EntMiniNavBar.vue'
import { useAppStore } from '@/stores/app'
import { useEnterpriseMiniAuth } from '@/composables/useEnterpriseMiniAuth'
import {
  buildDailyAttendanceList,
  canCorrectWorkHours,
  getStatusLabel,
  getStatusTagType,
} from '@/services/attendance'

const store = useAppStore()
const { enterpriseId, displayName } = useEnterpriseMiniAuth()

const date = ref('2026-07-24')

const correctionOpen = ref(false)
const correctionTarget = ref<{
  employeeId: string
  name: string
  workHours: number
  scheduledHours: number
  workHoursCorrected?: boolean
} | null>(null)
const correctionHours = ref(8)
const correctionNote = ref('')

const employees = computed(() =>
  store.employees.filter((e) => e.status === 'active' && e.enterpriseId === enterpriseId.value),
)

const empIdSet = computed(() => new Set(employees.value.map((e) => e.id)))
const operatorName = computed(() => displayName.value || '企业管理员')

const shiftGroups = computed(() => {
  const empIds = employees.value.map((e) => e.id)
  if (!empIds.length) return []

  const daily = buildDailyAttendanceList(
    empIds,
    [date.value],
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
        clockIn: string
        clockOut: string
        workHours: number
        scheduledHours: number
        workHoursCorrected?: boolean
        canCorrect: boolean
        statusLabel: string
        tagType: string
        note?: string
        punches: { time: string; typeLabel: string; location?: string; inRange: boolean }[]
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
        color: shift.color || '#5b4fdb',
        members: [],
      }
      byShift.set(shift.id, group)
    }

    const punches = store.punches
      .filter((p) => p.employeeId === row.employeeId && p.date === date.value)
      .sort((a, b) => a.time.localeCompare(b.time))
      .map((p) => ({
        time: p.time,
        typeLabel: p.type === 'clock_in' ? '上班' : '下班',
        location: p.location,
        inRange: p.inRange,
      }))

    const override = store.manualOverrides[`${row.employeeId}_${row.date}`]

    group.members.push({
      employeeId: row.employeeId,
      name: store.employees.find((e) => e.id === row.employeeId)?.name || row.employeeId,
      clockIn: row.clockIn || '—',
      clockOut: row.clockOut || '—',
      workHours: row.workHours,
      scheduledHours: row.scheduledHours,
      workHoursCorrected: row.workHoursCorrected,
      canCorrect: canCorrectWorkHours(row.status),
      statusLabel: getStatusLabel(row.status),
      tagType: getStatusTagType(row.status),
      note: override?.note,
      punches,
    })
  }

  return [...byShift.values()].sort((a, b) => a.period.localeCompare(b.period))
})

const totalMembers = computed(() =>
  shiftGroups.value.reduce((sum, g) => sum + g.members.length, 0),
)

const punchedCount = computed(() =>
  shiftGroups.value.reduce(
    (sum, g) => sum + g.members.filter((m) => m.clockIn !== '—').length,
    0,
  ),
)

function shiftDay(delta: number) {
  date.value = dayjs(date.value).add(delta, 'day').format('YYYY-MM-DD')
}

function openCorrect(member: {
  employeeId: string
  name: string
  workHours: number
  scheduledHours: number
  workHoursCorrected?: boolean
}) {
  correctionTarget.value = member
  correctionHours.value = member.workHoursCorrected ? member.workHours : member.scheduledHours
  correctionNote.value = ''
  correctionOpen.value = true
}

function closeCorrect() {
  correctionOpen.value = false
  correctionTarget.value = null
  correctionNote.value = ''
}

function submitCorrect() {
  if (!correctionTarget.value) return
  if (correctionHours.value < 0) {
    ElMessage.warning('工时不能为负数')
    return
  }
  const note = correctionNote.value.trim()
  if (!note) {
    ElMessage.warning('备注必填')
    return
  }
  try {
    store.setWorkHoursCorrection(
      correctionTarget.value.employeeId,
      date.value,
      correctionHours.value,
      note,
      operatorName.value,
    )
    ElMessage.success('工时已矫正')
    closeCorrect()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败')
  }
}
</script>

<template>
  <div class="mini-page">
    <EntMiniNavBar title="班次人员打卡记录" back-to="/enterprise-miniapp/attendance" />

    <div class="date-bar">
      <button type="button" @click="shiftDay(-1)">‹</button>
      <input v-model="date" type="date">
      <button type="button" @click="shiftDay(1)">›</button>
    </div>

    <div class="summary">
      <span>排班 {{ totalMembers }} 人</span>
      <span>已打卡 {{ punchedCount }} 人</span>
      <span>班次 {{ shiftGroups.length }} 个</span>
    </div>

    <div class="list">
      <section v-for="group in shiftGroups" :key="group.shiftId" class="shift-card">
        <header class="shift-head">
          <i class="dot" :style="{ background: group.color }" />
          <div>
            <strong>{{ group.shiftName }}</strong>
            <p>{{ group.period }} · {{ group.members.length }} 人</p>
          </div>
        </header>

        <article v-for="m in group.members" :key="m.employeeId" class="member">
          <div class="member-top">
            <strong>{{ m.name }}</strong>
            <span class="tag" :class="m.tagType">{{ m.statusLabel }}</span>
          </div>
          <div class="punch-line">
            上班 {{ m.clockIn }} · 下班 {{ m.clockOut }}
          </div>
          <div class="hours-line">
            工时 {{ m.workHours }}h
            <span v-if="m.workHoursCorrected" class="corrected">已矫正</span>
            · 排班 {{ m.scheduledHours }}h
          </div>
          <p v-if="m.note" class="note">备注：{{ m.note }}</p>
          <ul v-if="m.punches.length" class="punch-detail">
            <li v-for="(p, idx) in m.punches" :key="idx">
              <em>{{ p.typeLabel }}</em>
              <span>{{ p.time }}</span>
              <span class="loc" :class="{ out: !p.inRange }">
                {{ p.location || '—' }}{{ p.inRange ? '' : '（范围外）' }}
              </span>
            </li>
          </ul>
          <p v-else class="empty-punch">暂无打卡记录</p>
          <button
            v-if="m.canCorrect"
            type="button"
            class="correct-btn"
            @click="openCorrect(m)"
          >
            矫正工时
          </button>
        </article>
      </section>

      <div v-if="!shiftGroups.length" class="empty">
        {{ empIdSet.size ? '当日无排班人员' : '暂无企业人员' }}
      </div>
    </div>

    <div v-if="correctionOpen && correctionTarget" class="sheet-mask" @click.self="closeCorrect">
      <div class="sheet">
        <header>
          <strong>矫正工时</strong>
          <button type="button" class="close" @click="closeCorrect">×</button>
        </header>
        <p class="sheet-meta">
          {{ correctionTarget.name }} · {{ date }} · 排班 {{ correctionTarget.scheduledHours }}h · 当前
          {{ correctionTarget.workHours }}h
        </p>
        <label>矫正工时（小时）</label>
        <input v-model.number="correctionHours" type="number" min="0" max="24" step="0.5">
        <label>备注（必填）</label>
        <textarea
          v-model="correctionNote"
          rows="3"
          placeholder="请填写矫正原因，便于审计追溯"
        />
        <button type="button" class="submit" @click="submitCorrect">确认矫正</button>
      </div>
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
.summary {
  display: flex;
  gap: 12px;
  padding: 0 16px 10px;
  font-size: 12px;
  color: #6b7280;
}
.list {
  padding: 0 16px 28px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.shift-card {
  background: #fff;
  border-radius: 14px;
  padding: 12px 14px;
  box-shadow: var(--mini-shadow);
}
.shift-head {
  display: flex;
  gap: 10px;
  align-items: flex-start;
  margin-bottom: 8px;
  padding-bottom: 8px;
  border-bottom: 1px solid #f3f4f6;
}
.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  margin-top: 5px;
  flex-shrink: 0;
}
.shift-head strong {
  font-size: 14px;
  color: #111827;
}
.shift-head p {
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
.member-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.member-top strong {
  font-size: 14px;
  color: #1f2937;
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
.tag.info { background: #eff6ff; color: #2563eb; }
.punch-line,
.hours-line {
  margin-top: 4px;
  font-size: 13px;
  color: #374151;
}
.corrected {
  margin-left: 4px;
  font-size: 11px;
  color: #5b4fdb;
}
.note {
  margin: 4px 0 0;
  font-size: 11px;
  color: #4338ca;
}
.punch-detail {
  margin: 8px 0 0;
  padding: 0;
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.punch-detail li {
  display: grid;
  grid-template-columns: 36px 48px 1fr;
  gap: 6px;
  font-size: 12px;
  color: #6b7280;
}
.punch-detail em {
  font-style: normal;
  color: #5b4fdb;
  font-weight: 600;
}
.loc.out {
  color: #dc2626;
}
.empty-punch {
  margin: 6px 0 0;
  font-size: 12px;
  color: #9ca3af;
}
.correct-btn {
  margin-top: 8px;
  height: 30px;
  padding: 0 12px;
  border: 1px solid #5b4fdb;
  border-radius: 999px;
  background: #fff;
  color: #5b4fdb;
  font-size: 12px;
  font-weight: 600;
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
  z-index: 40;
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.sheet {
  width: min(420px, 100%);
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
  line-height: 1;
}
.sheet-meta {
  margin: 0;
  font-size: 12px;
  color: #6b7280;
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
}
.sheet .submit {
  margin-top: 8px;
  height: 42px;
  border: none;
  border-radius: 10px;
  background: #5b4fdb;
  color: #fff;
  font-weight: 600;
}
</style>
