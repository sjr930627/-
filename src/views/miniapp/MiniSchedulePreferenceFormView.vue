<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import MiniNavBack from '@/components/miniapp/MiniNavBack.vue'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import { useAppStore } from '@/stores/app'
import { MINIAPP_WEEKDAY_OPTIONS } from '@/constants/miniappAuth'
import type { WorkerSchedulePreference } from '@/types'

const route = useRoute()
const router = useRouter()
const store = useAppStore()
const { employeeId, profileExt } = useMiniAppWorker()

const editingId = computed(() =>
  typeof route.params.id === 'string' && route.params.id !== 'new' ? route.params.id : null,
)

const isNew = computed(() => route.params.id === 'new')

const existing = computed(() =>
  profileExt.value?.schedulePreferences?.find((p) => p.id === editingId.value),
)

const form = ref({
  weekdays: [...(existing.value?.weekdays ?? [])] as string[],
  startTime: existing.value?.startTime ?? '09:00',
  endTime: existing.value?.endTime ?? '18:00',
})

function toggleWeekday(day: string) {
  const set = new Set(form.value.weekdays)
  if (set.has(day)) set.delete(day)
  else set.add(day)
  form.value.weekdays = MINIAPP_WEEKDAY_OPTIONS.filter((d) => set.has(d))
}

function save() {
  if (!form.value.weekdays.length) {
    ElMessage.warning('请至少选择一天')
    return
  }
  const pref: WorkerSchedulePreference = {
    id: editingId.value ?? `sp_${Date.now()}`,
    weekdays: [...form.value.weekdays],
    startTime: form.value.startTime,
    endTime: form.value.endTime,
  }
  store.upsertWorkerSchedulePreference(employeeId.value, pref)
  ElMessage.success('排班偏好已保存')
  router.replace('/miniapp/worker-archive/schedule-pref')
}

async function remove() {
  if (!editingId.value) return
  await ElMessageBox.confirm('确定删除这条排班偏好？', '提示', { type: 'warning' })
  store.removeWorkerSchedulePreference(employeeId.value, editingId.value)
  ElMessage.success('已删除')
  router.replace('/miniapp/worker-archive/schedule-pref')
}
</script>

<template>
  <div class="edit-page">
    <div class="mini-nav-bar">
      <MiniNavBack fallback="/miniapp/worker-archive/schedule-pref" />
      <div class="mini-nav-title">{{ isNew ? '添加排班偏好' : '编辑排班偏好' }}</div>
    </div>
    <div class="mini-page">
      <div class="mini-card">
        <div class="field">
          <label>可工作日期</label>
          <div class="chip-row">
            <button
              v-for="day in MINIAPP_WEEKDAY_OPTIONS"
              :key="day"
              type="button"
              class="chip"
              :class="{ active: form.weekdays.includes(day) }"
              @click="toggleWeekday(day)"
            >
              {{ day }}
            </button>
          </div>
        </div>
        <div class="time-row">
          <div class="field">
            <label>开始</label>
            <input v-model="form.startTime" type="time">
          </div>
          <div class="field">
            <label>结束</label>
            <input v-model="form.endTime" type="time">
          </div>
        </div>
        <button class="mini-btn-primary save-btn" type="button" @click="save">保存</button>
        <button
          v-if="editingId"
          type="button"
          class="delete-btn"
          @click="remove"
        >
          删除此偏好
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.edit-page {
  min-height: 100%;
  background: var(--mini-bg);
}

.field {
  margin-bottom: 16px;
}

.field label {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  color: #64748b;
}

.field input {
  width: 100%;
  box-sizing: border-box;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
}

.chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.chip {
  padding: 8px 14px;
  border-radius: 999px;
  border: 1px solid #e5e7eb;
  background: #fff;
  font-size: 13px;
  cursor: pointer;
}

.chip.active {
  border-color: #3b82f6;
  background: #eff6ff;
  color: #3b82f6;
  font-weight: 600;
}

.time-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.save-btn {
  width: 100%;
}

.delete-btn {
  width: 100%;
  margin-top: 12px;
  padding: 12px;
  border: none;
  background: none;
  color: #ef4444;
  font-size: 14px;
  cursor: pointer;
}
</style>
