<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Calendar, Clock, Switch, VideoCamera } from '@element-plus/icons-vue'
import MiniNavBack from '@/components/miniapp/MiniNavBack.vue'
import { useAppStore } from '@/stores/app'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import { unavailablePeriodTypeLabel } from '@/services/employeeAvailability'
import type { WorkerSchedulePreference, WorkerUnavailablePeriod } from '@/types'

const router = useRouter()
const store = useAppStore()
const { employeeId, profileExt } = useMiniAppWorker()

const schedulePreferences = computed(
  () => profileExt.value?.schedulePreferences ?? [],
)

const unavailablePeriods = computed(
  () => profileExt.value?.unavailablePeriods ?? [],
)

const periodOpen = ref(false)
const editingPeriodId = ref<string | null>(null)
const periodForm = ref({
  type: 'leave' as WorkerUnavailablePeriod['type'],
  startDate: '',
  endDate: '',
  reason: '',
})

function formatWeekdays(pref: WorkerSchedulePreference) {
  return pref.weekdays.join('、')
}

function calcHours(start: string, end: string) {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return Math.max(0, Math.round((eh * 60 + em - (sh * 60 + sm)) / 60))
}

function openNewPeriod() {
  const today = new Date().toISOString().slice(0, 10)
  editingPeriodId.value = null
  periodForm.value = {
    type: 'leave',
    startDate: today,
    endDate: today,
    reason: '',
  }
  periodOpen.value = true
}

function openEditPeriod(period: WorkerUnavailablePeriod) {
  editingPeriodId.value = period.id
  periodForm.value = {
    type: period.type,
    startDate: period.startDate,
    endDate: period.endDate,
    reason: period.reason ?? '',
  }
  periodOpen.value = true
}

function closePeriod() {
  periodOpen.value = false
  editingPeriodId.value = null
}

function savePeriod() {
  if (!periodForm.value.startDate || !periodForm.value.endDate) {
    ElMessage.warning('请选择起止日期')
    return
  }
  if (periodForm.value.endDate < periodForm.value.startDate) {
    ElMessage.warning('结束日期不能早于开始日期')
    return
  }
  try {
    store.upsertWorkerUnavailablePeriod(employeeId.value, {
      id: editingPeriodId.value ?? `uap_${Date.now()}`,
      type: periodForm.value.type,
      startDate: periodForm.value.startDate,
      endDate: periodForm.value.endDate,
      reason: periodForm.value.reason.trim() || undefined,
    })
    ElMessage.success('已保存，该日期段将无法排班及指派任务')
    closePeriod()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '保存失败')
  }
}

async function removePeriod(period: WorkerUnavailablePeriod) {
  await ElMessageBox.confirm(
    `确定删除「${unavailablePeriodTypeLabel(period.type)} ${period.startDate} ~ ${period.endDate}」？`,
    '提示',
    { type: 'warning' },
  )
  store.removeWorkerUnavailablePeriod(employeeId.value, period.id)
  ElMessage.success('已删除')
}
</script>

<template>
  <div class="pref-page">
    <div class="mini-nav-bar">
      <MiniNavBack fallback="/miniapp/profile" />
      <div class="mini-nav-title">兼职偏好</div>
    </div>

    <div class="content">
      <section class="block">
        <div class="block-head">
          <div>
            <h3>兼职时间段</h3>
            <p>设置方便上岗的工作日与时段，系统优先匹配排班</p>
          </div>
          <button
            type="button"
            class="add"
            @click="router.push('/miniapp/worker-archive/schedule-pref/new')"
          >
            + 添加
          </button>
        </div>

        <div v-if="schedulePreferences.length" class="list">
          <button
            v-for="pref in schedulePreferences"
            :key="pref.id"
            type="button"
            class="item"
            @click="router.push(`/miniapp/worker-archive/schedule-pref/${pref.id}`)"
          >
            <div
              class="icon"
              :class="pref.variant === 'weekend' ? 'weekend' : 'weekday'"
            >
              <el-icon :size="18" color="#fff">
                <component :is="pref.variant === 'weekend' ? VideoCamera : Switch" />
              </el-icon>
            </div>
            <div class="body">
              <strong>{{ formatWeekdays(pref) }}</strong>
              <span>
                {{ pref.startTime }} - {{ pref.endTime }}（{{
                  calcHours(pref.startTime, pref.endTime)
                }}小时）
              </span>
            </div>
            <el-icon color="#cbd5e1"><Clock /></el-icon>
          </button>
        </div>
        <div v-else class="empty-card">
          <p>暂未配置兼职时间段</p>
          <button
            type="button"
            class="mini-btn-primary"
            @click="router.push('/miniapp/worker-archive/schedule-pref/new')"
          >
            添加时间段
          </button>
        </div>
      </section>

      <section class="block">
        <div class="block-head">
          <div>
            <h3>请假 / 不上岗</h3>
            <p>配置特定日期后，该段日期无法被排班及指派任务</p>
          </div>
          <button type="button" class="add" @click="openNewPeriod">+ 添加</button>
        </div>

        <div v-if="unavailablePeriods.length" class="list">
          <article v-for="period in unavailablePeriods" :key="period.id" class="period-card">
            <div class="period-top" @click="openEditPeriod(period)">
              <div class="icon leave">
                <el-icon :size="18" color="#fff"><Calendar /></el-icon>
              </div>
              <div class="body">
                <strong>
                  {{ unavailablePeriodTypeLabel(period.type) }}
                  · {{ period.startDate }}
                  <template v-if="period.endDate !== period.startDate">
                    ~ {{ period.endDate }}
                  </template>
                </strong>
                <span>{{ period.reason || '未填写原因' }}</span>
              </div>
            </div>
            <div class="period-actions">
              <button type="button" @click="openEditPeriod(period)">编辑</button>
              <button type="button" class="danger" @click="removePeriod(period)">删除</button>
            </div>
          </article>
        </div>
        <div v-else class="empty-card">
          <p>暂无请假或不上岗安排</p>
          <button type="button" class="mini-btn-primary" @click="openNewPeriod">
            添加日期段
          </button>
        </div>
      </section>
    </div>

    <div v-if="periodOpen" class="sheet-mask" @click.self="closePeriod">
      <div class="sheet">
        <header>
          <strong>{{ editingPeriodId ? '编辑请假/不上岗' : '添加请假/不上岗' }}</strong>
          <button type="button" class="close" @click="closePeriod">×</button>
        </header>
        <label>类型</label>
        <div class="type-row">
          <button
            type="button"
            :class="{ active: periodForm.type === 'leave' }"
            @click="periodForm.type = 'leave'"
          >
            请假
          </button>
          <button
            type="button"
            :class="{ active: periodForm.type === 'off' }"
            @click="periodForm.type = 'off'"
          >
            不上岗
          </button>
        </div>
        <label>开始日期</label>
        <input v-model="periodForm.startDate" type="date">
        <label>结束日期</label>
        <input v-model="periodForm.endDate" type="date">
        <label>备注（可选）</label>
        <textarea
          v-model="periodForm.reason"
          rows="2"
          placeholder="如：回乡探亲、考试、个人事务"
        />
        <button type="button" class="mini-sheet-submit" @click="savePeriod">保存</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pref-page {
  min-height: 100%;
  background: #f5f6f8;
}
.content {
  padding: 12px 16px 28px;
}
.block {
  margin-bottom: 16px;
}
.block-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 10px;
}
.block-head h3 {
  margin: 0;
  font-size: 16px;
  color: #111827;
}
.block-head p {
  margin: 4px 0 0;
  font-size: 12px;
  color: #9ca3af;
  line-height: 1.4;
}
.add {
  border: none;
  background: none;
  color: #22c55e;
  font-size: 14px;
  font-weight: 600;
  flex-shrink: 0;
  padding-top: 2px;
}
.list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.item,
.period-card {
  background: #fff;
  border-radius: 14px;
  padding: 12px;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.04);
}
.item {
  width: 100%;
  border: none;
  display: flex;
  align-items: center;
  gap: 12px;
  text-align: left;
  cursor: pointer;
}
.icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.icon.weekday {
  background: linear-gradient(135deg, #4FD1C5, #81E6D9);
}
.icon.weekend {
  background: linear-gradient(135deg, #f97316, #fb923c);
}
.icon.leave {
  background: linear-gradient(135deg, #8b5cf6, #a78bfa);
}
.body {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.body strong {
  font-size: 14px;
  color: #1f2937;
}
.body span {
  font-size: 12px;
  color: #9ca3af;
}
.period-top {
  display: flex;
  align-items: center;
  gap: 12px;
  cursor: pointer;
}
.period-actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 10px;
}
.period-actions button {
  height: 28px;
  padding: 0 12px;
  border-radius: 999px;
  border: 1px solid #e5e7eb;
  background: #fff;
  color: #6b7280;
  font-size: 12px;
}
.period-actions .danger {
  border-color: #fecaca;
  color: #dc2626;
}
.empty-card {
  background: #fff;
  border-radius: 14px;
  padding: 28px 16px;
  text-align: center;
}
.empty-card p {
  margin: 0 0 14px;
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
.type-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.type-row button {
  height: 36px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
  color: #6b7280;
}
.type-row button.active {
  border-color: var(--mini-primary);
  background: var(--mini-primary-light);
  color: var(--mini-primary-dark);
  font-weight: 600;
}
</style>
