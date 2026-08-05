<script setup lang="ts">
import MiniNavBack from '@/components/miniapp/MiniNavBack.vue'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import { useMiniAppNow } from '@/composables/useMiniAppNow'
import { buildDayDetail, buildRecentPunchRecords } from '@/composables/useMiniSchedule'
import { approvalStatusLabel, approvalStatusTone } from '@/services/miniScheduleException'

const router = useRouter()
const route = useRoute()
const store = useAppStore()
const { employeeId } = useMiniAppWorker()
const { now } = useMiniAppNow()

function localDateStr(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

const today = computed(() => localDateStr(now.value))

const records = computed(() => buildRecentPunchRecords(store, employeeId.value, now.value, 30))

function hasPendingMakeup(date: string) {
  return store.makeupRequests.some(
    (r) => r.employeeId === employeeId.value && r.date === date && r.status === 'pending',
  )
}

function makeupForDate(date: string) {
  return store.makeupRequests.find(
    (r) => r.employeeId === employeeId.value && r.date === date,
  )
}

function canApplyMakeup(date: string, statusType: string) {
  if (date >= today.value) return false
  if (hasPendingMakeup(date)) return false
  const detail = buildDayDetail(store, employeeId.value, date, now.value)
  if (detail.state === 'rest') return false
  return statusType === 'pending' || detail.state === 'absent'
}

function goApply(date: string) {
  router.push({ path: '/miniapp/schedule/makeup/apply', query: { date, from: 'history' } })
}

function goMakeupDetail(id: string) {
  router.push(`/miniapp/schedule/makeup/${id}`)
}

function openDate(date: string) {
  router.replace({ path: '/miniapp/schedule', query: { date, tab: 'punch' } })
}

const highlightDate = computed(() =>
  typeof route.query.date === 'string' ? route.query.date : '',
)
</script>

<template>
  <div class="hist-page">
    <div class="mini-nav-bar">
      <MiniNavBack fallback="/miniapp/schedule" />
      <div class="mini-nav-title">历史打卡</div>
    </div>

    <div class="mini-page">
      <div
        v-for="item in records"
        :key="item.date"
        class="hist-card"
        :class="{ highlight: item.date === highlightDate }"
        @click="openDate(item.date)"
      >
        <div class="hist-head">
          <div>
            <div class="hist-date">{{ item.relativeLabel }} · {{ item.dateLabel }}</div>
            <div class="hist-punch">
              签到 {{ item.clockIn }} · 签退 {{ item.clockOut }}
            </div>
          </div>
          <span class="mini-tag" :class="item.statusType">{{ item.statusLabel }}</span>
        </div>

        <div class="hist-actions" @click.stop>
          <button
            v-if="makeupForDate(item.date)"
            type="button"
            class="hist-link"
            @click="goMakeupDetail(makeupForDate(item.date)!.id)"
          >
            查看补卡记录
            <span
              class="mini-tag small"
              :class="approvalStatusTone(makeupForDate(item.date)!.status)"
            >
              {{ approvalStatusLabel(makeupForDate(item.date)!.status) }}
            </span>
          </button>
          <button
            v-else-if="canApplyMakeup(item.date, item.statusType)"
            type="button"
            class="hist-apply"
            @click="goApply(item.date)"
          >
            申请补卡
          </button>
        </div>
      </div>

      <div v-if="records.length === 0" class="mini-empty">暂无历史打卡记录</div>
    </div>
  </div>
</template>

<style scoped>
.hist-page {
  min-height: 100%;
  background: var(--mini-bg);
}

.hist-card {
  background: #fff;
  border-radius: 14px;
  padding: 14px;
  margin-bottom: 10px;
  box-shadow: var(--mini-shadow);
  cursor: pointer;
}

.hist-card.highlight {
  border: 2px solid #3b82f6;
}

.hist-head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: flex-start;
}

.hist-date {
  font-size: 15px;
  font-weight: 600;
  color: var(--mini-text);
}

.hist-punch {
  margin-top: 6px;
  font-size: 13px;
  color: var(--mini-text-muted);
}

.hist-actions {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #f3f4f6;
}

.hist-link,
.hist-apply {
  border: none;
  background: none;
  padding: 0;
  font-size: 13px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.hist-link {
  color: #3b82f6;
}

.hist-apply {
  color: #ea580c;
  font-weight: 600;
}

.mini-tag.small {
  font-size: 10px;
  padding: 1px 6px;
}

.mini-tag.online { background: #eff6ff; color: #3b82f6; }
.mini-tag.hours { background: #f0fdf4; color: #16a34a; }
.mini-tag.rest { background: #f3f4f6; color: #9ca3af; }
.mini-tag.pending { background: #fff7ed; color: #ea580c; }
.mini-tag.orange { background: #fff7ed; color: #ea580c; }
.mini-tag.green { background: #f0fdf4; color: #16a34a; }
.mini-tag.red { background: #fef2f2; color: #ef4444; }
</style>
