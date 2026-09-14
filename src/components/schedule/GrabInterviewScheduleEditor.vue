<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import {
  grabInterviewScheduleModeOptions,
  grabInterviewSeatUnitOptions,
  grabInterviewWeekdayMap,
  grabInterviewWeekdayOptions,
  normalizeGrabInterviewScheduleRule,
} from '@/constants/grabInterview'
import { generateId } from '@/utils'
import type {
  GrabInterviewScheduleMode,
  GrabInterviewScheduleRule,
  GrabInterviewTimeSlot,
  GrabInterviewWeekday,
} from '@/types'

const props = defineProps<{
  modelValue: GrabInterviewScheduleRule
  /** 紧凑布局（小程序侧） */
  compact?: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: GrabInterviewScheduleRule]
}>()

const schedule = computed({
  get: () => props.modelValue,
  set: (v) => emit('update:modelValue', v),
})

const activeDayTab = ref<GrabInterviewWeekday>(1)

watch(
  () => schedule.value.weekdays,
  (days) => {
    if (!days.includes(activeDayTab.value)) {
      activeDayTab.value = (days[0] as GrabInterviewWeekday) || 1
    }
  },
  { immediate: true, deep: true },
)

function patch(partial: Partial<GrabInterviewScheduleRule>) {
  emit('update:modelValue', {
    ...normalizeGrabInterviewScheduleRule(schedule.value),
    ...partial,
  })
}

function onScheduleModeChange(mode: string | number | boolean) {
  const current = normalizeGrabInterviewScheduleRule(schedule.value)
  const next = (mode === 'by_day' ? 'by_day' : 'unified') as GrabInterviewScheduleMode
  const dayTimeSlots = { ...(current.dayTimeSlots ?? {}) }
  let timeSlots = [...current.timeSlots]

  if (next === 'by_day') {
    current.weekdays.forEach((d) => {
      if (!dayTimeSlots[d]?.length) {
        dayTimeSlots[d] = timeSlots.length
          ? timeSlots.map((s) => ({ ...s, id: generateId('slot') }))
          : [{ id: generateId('slot'), start: '09:00', end: '10:00' }]
      }
    })
    activeDayTab.value = (current.weekdays[0] as GrabInterviewWeekday) || 1
  } else if (!timeSlots.length) {
    const firstDay = current.weekdays[0] as GrabInterviewWeekday | undefined
    const fromDay = firstDay ? dayTimeSlots[firstDay] : undefined
    timeSlots = fromDay?.length
      ? fromDay.map((s) => ({ ...s, id: generateId('slot') }))
      : [{ id: generateId('slot'), start: '09:00', end: '10:00' }]
  }

  patch({ scheduleMode: next, dayTimeSlots, timeSlots })
}

function onWeekdaysChange(days: GrabInterviewWeekday[] | string | number | boolean) {
  const current = normalizeGrabInterviewScheduleRule(schedule.value)
  const list = (Array.isArray(days) ? days : []) as GrabInterviewWeekday[]
  const dayTimeSlots = { ...(current.dayTimeSlots ?? {}) }
  if (current.scheduleMode === 'by_day') {
    list.forEach((d) => {
      if (!dayTimeSlots[d]?.length) {
        dayTimeSlots[d] = [{ id: generateId('slot'), start: '09:00', end: '10:00' }]
      }
    })
    Object.keys(dayTimeSlots).forEach((key) => {
      const d = Number(key) as GrabInterviewWeekday
      if (!list.includes(d)) delete dayTimeSlots[d]
    })
  }
  patch({ weekdays: list, dayTimeSlots })
}

function slotsOfDay(day: GrabInterviewWeekday) {
  if (!schedule.value.dayTimeSlots) schedule.value.dayTimeSlots = {}
  if (!schedule.value.dayTimeSlots[day]) schedule.value.dayTimeSlots[day] = []
  return schedule.value.dayTimeSlots[day]!
}

function addTimeSlot(day?: GrabInterviewWeekday) {
  const slot: GrabInterviewTimeSlot = {
    id: generateId('slot'),
    start: '14:00',
    end: '15:00',
  }
  if ((schedule.value.scheduleMode ?? 'unified') === 'by_day' && day != null) {
    slotsOfDay(day).push(slot)
    return
  }
  schedule.value.timeSlots.push(slot)
}

function removeTimeSlot(idx: number, day?: GrabInterviewWeekday) {
  if ((schedule.value.scheduleMode ?? 'unified') === 'by_day' && day != null) {
    const list = slotsOfDay(day)
    if (list.length <= 1) {
      ElMessage.warning('该日至少保留一个时间段')
      return
    }
    list.splice(idx, 1)
    return
  }
  if (schedule.value.timeSlots.length <= 1) {
    ElMessage.warning('至少保留一个时间段')
    return
  }
  schedule.value.timeSlots.splice(idx, 1)
}

function copyCurrentDayToOthers() {
  const days = schedule.value.weekdays
  if (days.length <= 1) {
    ElMessage.info('请先选择多个日期')
    return
  }
  const source = slotsOfDay(activeDayTab.value).map((s) => ({
    ...s,
    id: generateId('slot'),
  }))
  if (!schedule.value.dayTimeSlots) schedule.value.dayTimeSlots = {}
  days.forEach((d) => {
    if (d === activeDayTab.value) return
    schedule.value.dayTimeSlots![d] = source.map((s) => ({
      ...s,
      id: generateId('slot'),
    }))
  })
  ElMessage.success(`已将${grabInterviewWeekdayMap[activeDayTab.value]}时段复制到其他日期`)
}
</script>

<template>
  <div class="schedule-editor" :class="{ compact }">
    <el-form :label-width="compact ? '88px' : '110px'" label-position="top">
      <el-form-item label="时间配置方式" required>
        <el-radio-group
          :model-value="schedule.scheduleMode ?? 'unified'"
          class="mode-group"
          @change="onScheduleModeChange"
        >
          <el-radio
            v-for="opt in grabInterviewScheduleModeOptions"
            :key="opt.value"
            :value="opt.value"
            border
          >
            <span class="mode-label">{{ opt.label }}</span>
            <span class="mode-desc">{{ opt.desc }}</span>
          </el-radio>
        </el-radio-group>
      </el-form-item>

      <el-form-item label="可选面试日期" required>
        <el-checkbox-group :model-value="schedule.weekdays" @change="onWeekdaysChange">
          <el-checkbox
            v-for="opt in grabInterviewWeekdayOptions"
            :key="opt.value"
            :label="opt.value"
            :value="opt.value"
          >
            {{ opt.label }}
          </el-checkbox>
        </el-checkbox-group>
      </el-form-item>

      <el-form-item
        v-if="(schedule.scheduleMode ?? 'unified') === 'unified'"
        label="统一面试时间段"
        required
      >
        <div class="slots">
          <div v-for="(slot, idx) in schedule.timeSlots" :key="slot.id" class="slot-row">
            <el-time-select
              v-model="slot.start"
              start="06:00"
              step="00:30"
              end="22:00"
              placeholder="开始"
            />
            <span class="range-sep">—</span>
            <el-time-select
              v-model="slot.end"
              start="06:00"
              step="00:30"
              end="23:00"
              placeholder="结束"
            />
            <el-button link type="danger" @click="removeTimeSlot(idx)">删除</el-button>
          </div>
          <el-button @click="addTimeSlot()">+ 添加时间段</el-button>
        </div>
      </el-form-item>

      <el-form-item v-else label="分日面试时间段" required>
        <div class="day-slots">
          <div class="day-tabs-row">
            <el-radio-group v-model="activeDayTab" size="small" class="day-tabs">
              <el-radio-button v-for="d in schedule.weekdays" :key="d" :value="d">
                {{ grabInterviewWeekdayMap[d] }}
              </el-radio-button>
            </el-radio-group>
            <el-button
              v-if="schedule.weekdays.length > 1"
              link
              type="primary"
              @click="copyCurrentDayToOthers"
            >
              复制到其他日期
            </el-button>
          </div>
          <div v-if="schedule.weekdays.includes(activeDayTab)" class="slots">
            <div
              v-for="(slot, idx) in slotsOfDay(activeDayTab)"
              :key="slot.id"
              class="slot-row"
            >
              <el-time-select
                v-model="slot.start"
                start="06:00"
                step="00:30"
                end="22:00"
                placeholder="开始"
              />
              <span class="range-sep">—</span>
              <el-time-select
                v-model="slot.end"
                start="06:00"
                step="00:30"
                end="23:00"
                placeholder="结束"
              />
              <el-button link type="danger" @click="removeTimeSlot(idx, activeDayTab)">
                删除
              </el-button>
            </div>
            <el-button @click="addTimeSlot(activeDayTab)">+ 添加时间段</el-button>
          </div>
        </div>
      </el-form-item>

      <el-form-item label="席位规则" required>
        <div class="seat-row">
          <el-select v-model="schedule.seatUnitMinutes" style="width: 140px">
            <el-option
              v-for="opt in grabInterviewSeatUnitOptions"
              :key="opt.value"
              :label="opt.label"
              :value="opt.value"
            />
          </el-select>
          <span>可面试</span>
          <el-input-number
            v-model="schedule.seatsPerUnit"
            :min="1"
            :max="50"
            controls-position="right"
          />
          <span>人</span>
        </div>
      </el-form-item>
    </el-form>
  </div>
</template>

<style scoped>
.mode-group {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
.mode-group :deep(.el-radio) {
  margin-right: 0;
  height: auto;
  padding: 10px 12px;
  align-items: flex-start;
}
.mode-label {
  display: block;
  font-weight: 600;
  line-height: 1.3;
}
.mode-desc {
  display: block;
  margin-top: 2px;
  font-size: 12px;
  color: #94a3b8;
  font-weight: 400;
}
.slots {
  display: flex;
  flex-direction: column;
  gap: 8px;
  width: 100%;
}
.slot-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.range-sep {
  color: #94a3b8;
}
.day-slots {
  width: 100%;
}
.day-tabs-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 10px;
}
.seat-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.compact .mode-group :deep(.el-radio) {
  width: 100%;
}
</style>
