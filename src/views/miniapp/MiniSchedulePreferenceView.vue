<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { Switch, VideoCamera } from '@element-plus/icons-vue'
import MiniNavBack from '@/components/miniapp/MiniNavBack.vue'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import type { WorkerSchedulePreference } from '@/types'

const router = useRouter()
const { profileExt } = useMiniAppWorker()

const schedulePreferences = computed(
  () => profileExt.value?.schedulePreferences ?? [],
)

function formatWeekdays(pref: WorkerSchedulePreference) {
  return pref.weekdays.join('、')
}

function calcHours(start: string, end: string) {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  return Math.max(0, Math.round((eh * 60 + em - (sh * 60 + sm)) / 60))
}
</script>

<template>
  <div class="list-page">
    <div class="mini-nav-bar">
      <MiniNavBack fallback="/miniapp/part-time-pref" />
      <div class="mini-nav-title">兼职时间段</div>
      <button
        type="button"
        class="nav-action"
        @click="router.push('/miniapp/worker-archive/schedule-pref/new')"
      >
        + 添加
      </button>
    </div>

    <div class="list-content">
      <p class="tip">设置您方便兼职的工作日与时段，系统将优先推荐匹配的排班。</p>
      <div v-if="schedulePreferences.length" class="pref-list">
        <div
          v-for="pref in schedulePreferences"
          :key="pref.id"
          class="pref-item"
          @click="router.push(`/miniapp/worker-archive/schedule-pref/${pref.id}`)"
        >
          <div
            class="pref-icon"
            :class="pref.variant === 'weekend' ? 'weekend' : 'weekday'"
          >
            <el-icon :size="18" color="#fff">
              <component :is="pref.variant === 'weekend' ? VideoCamera : Switch" />
            </el-icon>
          </div>
          <div class="pref-body">
            <div class="pref-days">{{ formatWeekdays(pref) }}</div>
            <div class="pref-time">
              {{ pref.startTime }} - {{ pref.endTime }}（{{ calcHours(pref.startTime, pref.endTime) }}小时）
            </div>
          </div>
        </div>
      </div>
      <div v-else class="empty">
        <p>暂未设置兼职时间段</p>
        <button
          class="mini-btn-primary"
          type="button"
          @click="router.push('/miniapp/worker-archive/schedule-pref/new')"
        >
          添加第一条时间段
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.list-page {
  min-height: 100%;
  background: #f5f6f8;
}

.mini-nav-bar {
  position: relative;
}

.nav-action {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  border: none;
  background: none;
  color: #22c55e;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.list-content {
  padding: 12px;
}

.tip {
  margin: 0 0 12px;
  font-size: 13px;
  color: #94a3b8;
  line-height: 1.5;
}

.pref-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.pref-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  background: #fff;
  border-radius: 14px;
  cursor: pointer;
}

.pref-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.pref-icon.weekday {
  background: linear-gradient(135deg, #4FD1C5, #81E6D9);
}

.pref-icon.weekend {
  background: linear-gradient(135deg, #f97316, #fb923c);
}

.pref-days {
  font-size: 15px;
  font-weight: 600;
  color: #1f2937;
}

.pref-time {
  margin-top: 4px;
  font-size: 12px;
  color: #9ca3af;
}

.empty {
  text-align: center;
  padding: 48px 20px;
  background: #fff;
  border-radius: 14px;
}

.empty p {
  margin: 0 0 16px;
  color: #9ca3af;
}
</style>
