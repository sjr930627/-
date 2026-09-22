<script setup lang="ts">
import MiniNavBack from '@/components/miniapp/MiniNavBack.vue'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Cloudy, Moon, Sunny } from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import { useMiniAppNow } from '@/composables/useMiniAppNow'
import { buildDayDetail } from '@/composables/useMiniSchedule'
import { punchTypeLabel } from '@/services/miniScheduleException'
import type { PunchType } from '@/types'

const route = useRoute()
const router = useRouter()
const store = useAppStore()
const { employeeId } = useMiniAppWorker()
const { now } = useMiniAppNow()

const applyDate = computed(() => {
  const q = route.query.date
  return typeof q === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : ''
})

const dayDetail = computed(() =>
  applyDate.value ? buildDayDetail(store, employeeId.value, applyDate.value, now.value) : null,
)

const punchTypes = ref<PunchType[]>(['clock_in'])
const clockInTime = ref('08:00')
const clockOutTime = ref('16:00')
const reason = ref('')

/** 缺卡 / 缺勤可同时补签到和签退 */
const allowMultiType = computed(() => {
  const state = dayDetail.value?.state
  return state === 'missing_punch' || state === 'absent'
})

watch(
  dayDetail,
  (detail) => {
    if (!detail) return
    const start = detail.shift?.startTime?.slice(0, 5) ?? '08:00'
    const end = detail.shift?.endTime?.slice(0, 5) ?? '16:00'
    clockInTime.value = start
    clockOutTime.value = end
    const missing: PunchType[] = []
    if (!detail.clockIn) missing.push('clock_in')
    if (!detail.clockOut && !detail.freeClockInOnly) missing.push('clock_out')
    if (allowMultiType.value && missing.length) {
      punchTypes.value = missing
      return
    }
    punchTypes.value = [missing[0] ?? (!detail.clockIn ? 'clock_in' : 'clock_out')]
  },
  { immediate: true },
)

function togglePunchType(type: PunchType) {
  if (!allowMultiType.value) {
    punchTypes.value = [type]
    return
  }
  const next = new Set(punchTypes.value)
  if (next.has(type)) {
    if (next.size === 1) return
    next.delete(type)
  } else {
    next.add(type)
  }
  punchTypes.value = (['clock_in', 'clock_out'] as PunchType[]).filter((t) => next.has(t))
}

function shiftIcon(shiftId?: string) {
  if (shiftId === 'shift_afternoon') return Cloudy
  if (shiftId === 'shift_night') return Moon
  return Sunny
}

function submit() {
  if (!applyDate.value || !dayDetail.value) return
  if (!reason.value.trim()) {
    ElMessage.warning('请填写补卡原因')
    return
  }
  if (!punchTypes.value.length) {
    ElMessage.warning('请选择补卡类型')
    return
  }
  if (punchTypes.value.includes('clock_in') && !clockInTime.value) {
    ElMessage.warning('请选择签到时间')
    return
  }
  if (punchTypes.value.includes('clock_out') && !clockOutTime.value) {
    ElMessage.warning('请选择签退时间')
    return
  }
  const reasonText = reason.value.trim()
  const items = punchTypes.value.map((punchType) => ({
    employeeId: employeeId.value,
    date: applyDate.value,
    punchType,
    time: punchType === 'clock_in' ? clockInTime.value : clockOutTime.value,
    reason: reasonText,
  }))
  try {
    const created = store.submitMakeupRequestBatch(items)
    ElMessage.success(created.length > 1 ? '已提交 2 条补卡申请' : '补卡申请已提交')
    router.replace(`/miniapp/schedule/makeup/${created[0].id}`)
  } catch (e) {
    ElMessage.warning(e instanceof Error ? e.message : '提交失败')
  }
}
</script>

<template>
  <div class="apply-page">
    <div class="mini-nav-bar">
      <MiniNavBack fallback="/miniapp/schedule" />
      <div class="mini-nav-title">申请补卡</div>
    </div>

    <div v-if="dayDetail && applyDate" class="apply-body">
      <div class="apply-card">
        <div class="apply-card-title">当前班次</div>
        <div v-if="dayDetail.state === 'rest'" class="apply-rest">当日为休息日，无需补卡</div>
        <template v-else>
          <div class="shift-row">
            <div class="shift-icon">
              <el-icon :size="20"><component :is="shiftIcon(dayDetail.shift?.id)" /></el-icon>
            </div>
            <div>
              <div class="shift-name">{{ dayDetail.shift?.name }} · {{ dayDetail.teamName }}</div>
              <div class="shift-time">
                {{ applyDate }}
                {{ dayDetail.shift?.startTime?.slice(0, 5) }} - {{ dayDetail.shift?.endTime?.slice(0, 5) }}
              </div>
              <div class="shift-punch">
                已有记录：签到 {{ dayDetail.clockIn?.slice(0, 5) ?? '—' }} · 签退
                {{ dayDetail.clockOut?.slice(0, 5) ?? '—' }}
              </div>
            </div>
          </div>
        </template>
      </div>

      <div v-if="dayDetail.state !== 'rest'" class="apply-card">
        <div class="apply-card-title">补卡信息</div>

        <div class="field">
          <label class="field-label">补卡类型</label>
          <div class="type-row">
            <button
              type="button"
              class="type-btn"
              :class="{ active: punchTypes.includes('clock_in') }"
              @click="togglePunchType('clock_in')"
            >
              {{ punchTypeLabel('clock_in') }}
            </button>
            <button
              v-if="!dayDetail.freeClockInOnly"
              type="button"
              class="type-btn"
              :class="{ active: punchTypes.includes('clock_out') }"
              @click="togglePunchType('clock_out')"
            >
              {{ punchTypeLabel('clock_out') }}
            </button>
          </div>
          <p v-if="allowMultiType" class="field-hint">缺卡可同时选择签到和签退，将生成两条补卡记录</p>
        </div>

        <div v-if="punchTypes.includes('clock_in')" class="field">
          <label class="field-label">签到时间</label>
          <input v-model="clockInTime" type="time" class="field-input" />
        </div>
        <div v-if="punchTypes.includes('clock_out')" class="field">
          <label class="field-label">签退时间</label>
          <input v-model="clockOutTime" type="time" class="field-input" />
        </div>

        <div class="field">
          <label class="field-label">补卡原因 <span class="req">*</span></label>
          <textarea
            v-model="reason"
            class="field-textarea"
            rows="4"
            placeholder="请说明未打卡原因，便于企业审批"
          />
        </div>

        <button type="button" class="mini-btn-primary" @click="submit">提交补卡申请</button>
      </div>
    </div>

    <div v-else class="mini-empty">日期无效</div>
  </div>
</template>

<style scoped>
.apply-page {
  min-height: 100%;
  background: var(--mini-bg);
}

.apply-body {
  padding: 12px;
}

.apply-card {
  background: #fff;
  border-radius: var(--mini-radius-lg);
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: var(--mini-shadow);
}

.apply-card-title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 12px;
}

.apply-rest {
  font-size: 14px;
  color: var(--mini-text-muted);
}

.shift-row {
  display: flex;
  gap: 12px;
}

.shift-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: #E6FFFA;
  color: #4FD1C5;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.shift-name {
  font-size: 16px;
  font-weight: 700;
}

.shift-time,
.shift-punch {
  margin-top: 4px;
  font-size: 13px;
  color: var(--mini-text-muted);
}

.field {
  margin-bottom: 14px;
}

.field-label {
  display: block;
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 6px;
}

.field-hint {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--mini-text-muted);
}

.req {
  color: #ef4444;
}

.type-row {
  display: flex;
  gap: 8px;
}

.type-btn {
  flex: 1;
  padding: 10px;
  border: 1px solid var(--mini-border);
  border-radius: 10px;
  background: #fff;
  font-size: 14px;
  cursor: pointer;
}

.type-btn.active {
  border-color: #4FD1C5;
  background: #E6FFFA;
  color: #4FD1C5;
  font-weight: 600;
}

.field-input,
.field-textarea {
  width: 100%;
  box-sizing: border-box;
  padding: 10px 12px;
  border: 1px solid var(--mini-border);
  border-radius: 10px;
  font-size: 14px;
}

.mini-btn-primary {
  width: 100%;
}
</style>
