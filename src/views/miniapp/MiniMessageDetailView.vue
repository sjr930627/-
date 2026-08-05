<script setup lang="ts">
import MiniNavBack from '@/components/miniapp/MiniNavBack.vue'
import { computed, watchEffect } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Bell, Check, Clock, WarningFilled } from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import {
  formatMiniMessageDateTime,
  isScheduleConfirmPending,
  miniMessageCategoryMap,
  miniMessageCategoryTone,
} from '@/constants/miniapp'

const route = useRoute()
const router = useRouter()
const store = useAppStore()
const { employeeId } = useMiniAppWorker()

const msg = computed(() =>
  store.miniAppMessages.find(
    (m) => m.id === route.params.id && m.employeeId === employeeId.value,
  ),
)

const pendingConfirm = computed(() => (msg.value ? isScheduleConfirmPending(msg.value) : false))

const confirmStatusLabel = computed(() => {
  const status = msg.value?.scheduleDetail?.confirmStatus
  if (status === 'accepted') return '已确认接受'
  if (status === 'rejected') return '已拒绝'
  return ''
})

watchEffect(() => {
  if (msg.value) store.markMiniMessageRead(msg.value.id)
})

function confirmAccept() {
  if (!msg.value) return
  try {
    store.confirmScheduleMessage(msg.value.id)
    ElMessage.success('已确认接受该班次')
    router.back()
  } catch {
    ElMessage.error('操作失败')
  }
}

async function rejectShift() {
  if (!msg.value) return
  try {
    await ElMessageBox.confirm('拒绝后该班次席位将被释放，确定拒绝吗？', '拒绝排班', {
      confirmButtonText: '确定拒绝',
      cancelButtonText: '取消',
      type: 'warning',
    })
    store.rejectScheduleMessage(msg.value.id)
    ElMessage.info('已拒绝该班次')
    router.back()
  } catch {
    /* cancelled */
  }
}
</script>

<template>
  <div class="detail-page">
    <div class="mini-nav-bar">
      <MiniNavBack fallback="/miniapp/messages" />
      <div class="mini-nav-title">消息详情</div>
    </div>

    <div v-if="msg" class="msg-detail">
      <h1 class="detail-title">{{ msg.title }}</h1>

      <div class="detail-meta">
        <span
          class="detail-tag"
          :style="{
            background: miniMessageCategoryTone[msg.category].bg,
            color: miniMessageCategoryTone[msg.category].color,
          }"
        >
          <el-icon :size="12"><Bell /></el-icon>
          {{ miniMessageCategoryMap[msg.category] }}
        </span>
        <span class="detail-time">
          <el-icon :size="13"><Clock /></el-icon>
          {{ formatMiniMessageDateTime(msg.createdAt) }}
        </span>
      </div>

      <template v-if="msg.scheduleDetail">
        <p class="detail-greeting">尊敬的用户您好：</p>
        <p class="detail-intro">
          您已被企业【{{ msg.scheduleDetail.enterpriseName }}】定向指派至以下班次：
        </p>

        <div class="detail-info-card">
          <div class="info-row">
            <span class="info-label">考勤组</span>
            <span class="info-value">{{ msg.scheduleDetail.groupName }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">班次</span>
            <span class="info-value">
              {{ msg.scheduleDetail.shiftLabel }} {{ msg.scheduleDetail.shiftTime }}
            </span>
          </div>
          <div class="info-row">
            <span class="info-label">日期</span>
            <span class="info-value">{{ msg.scheduleDetail.date }}</span>
          </div>
          <div class="info-row">
            <span class="info-label">时薪</span>
            <span class="info-value wage">¥{{ msg.scheduleDetail.hourlyRate }}/h</span>
          </div>
        </div>

        <div v-if="pendingConfirm" class="detail-alert">
          <el-icon class="alert-icon" :size="16"><WarningFilled /></el-icon>
          <div>
            <div class="alert-main">
              请您于【{{ formatMiniMessageDateTime(msg.scheduleDetail.confirmBefore).slice(0, 16) }}】前确认是否接受该班次。
            </div>
            <div class="alert-sub">如逾期未确认，系统将自动释放该班次席位。</div>
          </div>
        </div>

        <div v-else-if="confirmStatusLabel" class="detail-status">
          {{ confirmStatusLabel }}
        </div>

        <div v-if="pendingConfirm" class="detail-actions">
          <button type="button" class="btn-reject" @click="rejectShift">拒绝</button>
          <button type="button" class="btn-confirm" @click="confirmAccept">
            <el-icon :size="16"><Check /></el-icon>
            确认接受
          </button>
        </div>
      </template>

      <template v-else>
        <div class="detail-body-card">
          <p class="detail-content">{{ msg.content }}</p>
        </div>
      </template>
    </div>

    <div v-else class="mini-empty">消息不存在</div>
  </div>
</template>

<style scoped>
.detail-page {
  min-height: 100%;
  background: #fff;
}

.msg-detail {
  padding: 16px;
}

.detail-title {
  margin: 0 0 12px;
  font-size: 20px;
  font-weight: 800;
  color: #111827;
  line-height: 1.45;
}

.detail-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  margin-bottom: 20px;
}

.detail-tag {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
}

.detail-time {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #9ca3af;
}

.detail-greeting {
  margin: 0 0 8px;
  font-size: 14px;
  color: #374151;
}

.detail-intro {
  margin: 0 0 14px;
  font-size: 14px;
  color: #6b7280;
  line-height: 1.6;
}

.detail-info-card {
  background: #f9fafb;
  border-radius: 12px;
  padding: 4px 14px;
  margin-bottom: 14px;
}

.info-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 0;
  border-bottom: 1px solid #f3f4f6;
  font-size: 14px;
}

.info-row:last-child {
  border-bottom: none;
}

.info-label {
  color: #9ca3af;
}

.info-value {
  color: #111827;
  font-weight: 500;
}

.info-value.wage {
  color: #ef4444;
  font-weight: 700;
}

.detail-alert {
  display: flex;
  gap: 8px;
  padding: 12px 14px;
  background: #fffbeb;
  border-radius: 10px;
  margin-bottom: 20px;
}

.alert-icon {
  color: #f59e0b;
  flex-shrink: 0;
  margin-top: 2px;
}

.alert-main {
  font-size: 13px;
  color: #92400e;
  line-height: 1.5;
}

.alert-sub {
  margin-top: 4px;
  font-size: 12px;
  color: #b45309;
}

.detail-status {
  padding: 12px 14px;
  background: #f3f4f6;
  border-radius: 10px;
  font-size: 14px;
  color: #6b7280;
  text-align: center;
}

.detail-body-card {
  background: #f9fafb;
  border-radius: 12px;
  padding: 14px;
}

.detail-content {
  margin: 0;
  font-size: 14px;
  color: #374151;
  line-height: 1.7;
  white-space: pre-wrap;
}

.detail-actions {
  display: flex;
  gap: 12px;
  margin-top: 24px;
}

.btn-reject,
.btn-confirm {
  flex: 1;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 46px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}

.btn-reject {
  border: 1px solid #fecaca;
  background: #fff;
  color: #ef4444;
}

.btn-confirm {
  border: none;
  background: var(--mini-primary, #3b82f6);
  color: #fff;
}
</style>
