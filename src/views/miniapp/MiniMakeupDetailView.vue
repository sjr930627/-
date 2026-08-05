<script setup lang="ts">
import MiniNavBack from '@/components/miniapp/MiniNavBack.vue'
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { Cloudy, Moon, Sunny } from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import { useMiniAppNow } from '@/composables/useMiniAppNow'
import { buildDayDetail } from '@/composables/useMiniSchedule'
import {
  approvalStatusLabel,
  approvalStatusTone,
  punchTypeLabel,
} from '@/services/miniScheduleException'

const route = useRoute()
const store = useAppStore()
const { employeeId } = useMiniAppWorker()
const { now } = useMiniAppNow()

const request = computed(() =>
  store.makeupRequests.find(
    (r) => r.id === route.params.id && r.employeeId === employeeId.value,
  ),
)

const dayDetail = computed(() =>
  request.value
    ? buildDayDetail(store, employeeId.value, request.value.date, now.value)
    : null,
)

function shiftIcon(shiftId?: string) {
  if (shiftId === 'shift_afternoon') return Cloudy
  if (shiftId === 'shift_night') return Moon
  return Sunny
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <div class="detail-page">
    <div class="mini-nav-bar">
      <MiniNavBack fallback="/miniapp/schedule/exceptions" />
      <div class="mini-nav-title">补卡申请详情</div>
    </div>

    <div v-if="request && dayDetail" class="detail-body">
      <div class="status-banner" :class="approvalStatusTone(request.status)">
        <div class="status-title">
          {{ request.status === 'approved' ? '审批通过，打卡状态已恢复正常' : approvalStatusLabel(request.status) }}
        </div>
        <div v-if="request.status === 'pending'" class="status-desc">企业审批通过后，打卡记录将自动补录</div>
        <div v-if="request.reviewNote" class="status-desc">审批备注：{{ request.reviewNote }}</div>
      </div>

      <div class="detail-card">
        <div class="card-title">班次信息</div>
        <div class="shift-row">
          <div class="shift-icon">
            <el-icon :size="20"><component :is="shiftIcon(dayDetail.shift?.id)" /></el-icon>
          </div>
          <div>
            <div class="shift-name">{{ dayDetail.shift?.name }} · {{ dayDetail.teamName }}</div>
            <div class="shift-meta">
              {{ request.date }}
              {{ dayDetail.shift?.startTime?.slice(0, 5) }} - {{ dayDetail.shift?.endTime?.slice(0, 5) }}
            </div>
            <div class="shift-meta">{{ dayDetail.location }}</div>
          </div>
        </div>
      </div>

      <div class="detail-card">
        <div class="card-title">补卡申请</div>
        <div class="info-row">
          <span class="info-label">补卡类型</span>
          <span>{{ punchTypeLabel(request.punchType) }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">补卡时间</span>
          <span>{{ request.time.slice(0, 5) }}</span>
        </div>
        <div class="info-row">
          <span class="info-label">申请时间</span>
          <span>{{ formatTime(request.createdAt) }}</span>
        </div>
        <div v-if="request.reviewedAt" class="info-row">
          <span class="info-label">审批时间</span>
          <span>{{ formatTime(request.reviewedAt) }}</span>
        </div>
        <div class="reason-block">
          <div class="info-label">补卡原因</div>
          <p class="reason-text">{{ request.reason }}</p>
        </div>
      </div>
    </div>

    <div v-else class="mini-empty">补卡申请不存在</div>
  </div>
</template>

<style scoped>
.detail-page {
  min-height: 100%;
  background: var(--mini-bg);
}

.detail-body {
  padding: 12px;
}

.status-banner {
  padding: 14px 16px;
  border-radius: 12px;
  margin-bottom: 12px;
}

.status-banner.orange { background: #fff7ed; color: #ea580c; }
.status-banner.green { background: #f0fdf4; color: #16a34a; }
.status-banner.red { background: #fef2f2; color: #ef4444; }

.status-title {
  font-size: 15px;
  font-weight: 700;
}

.status-desc {
  margin-top: 6px;
  font-size: 13px;
  opacity: 0.85;
}

.detail-card {
  background: #fff;
  border-radius: var(--mini-radius-lg);
  padding: 16px;
  margin-bottom: 12px;
  box-shadow: var(--mini-shadow);
}

.card-title {
  font-size: 15px;
  font-weight: 600;
  margin-bottom: 12px;
}

.shift-row {
  display: flex;
  gap: 12px;
}

.shift-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: #eff6ff;
  color: #3b82f6;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.shift-name {
  font-size: 16px;
  font-weight: 700;
}

.shift-meta {
  margin-top: 4px;
  font-size: 13px;
  color: var(--mini-text-muted);
}

.info-row {
  display: flex;
  justify-content: space-between;
  padding: 10px 0;
  border-bottom: 1px solid #f3f4f6;
  font-size: 14px;
}

.info-row:last-of-type {
  border-bottom: none;
}

.info-label {
  color: var(--mini-text-muted);
}

.reason-block {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #f3f4f6;
}

.reason-text {
  margin: 8px 0 0;
  font-size: 14px;
  line-height: 1.6;
  color: var(--mini-text-secondary);
}
</style>
