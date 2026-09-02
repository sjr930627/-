<script setup lang="ts">
import MiniNavBack from '@/components/miniapp/MiniNavBack.vue'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import { buildWorkerExceptionRecords } from '@/services/miniScheduleException'

const router = useRouter()
const store = useAppStore()
const { employeeId } = useMiniAppWorker()

const activeTab = ref<'all' | 'makeup' | 'cancel'>('all')

const allRecords = computed(() =>
  buildWorkerExceptionRecords(employeeId.value, store.makeupRequests, store.cancelShiftRequests),
)

const displayRecords = computed(() => {
  if (activeTab.value === 'makeup') return allRecords.value.filter((r) => r.type === 'makeup')
  if (activeTab.value === 'cancel') return allRecords.value.filter((r) => r.type === 'cancel_shift')
  return allRecords.value
})

const pendingCount = computed(
  () => allRecords.value.filter((r) => r.status === 'pending').length,
)

function openRecord(record: (typeof allRecords.value)[number]) {
  if (record.type === 'makeup') {
    router.push(`/miniapp/schedule/makeup/${record.id}`)
    return
  }
  if (record.type === 'cancel_shift') {
    router.push(`/miniapp/schedule/cancel-shift/${record.id}`)
  }
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
  <div class="exc-page">
    <div class="mini-nav-bar">
      <MiniNavBack fallback="/miniapp/schedule" />
      <div class="mini-nav-title">异常申请记录</div>
    </div>

    <div class="exc-tabs">
      <button type="button" class="exc-tab" :class="{ active: activeTab === 'all' }" @click="activeTab = 'all'">
        全部
        <span v-if="pendingCount" class="exc-count">{{ pendingCount }}</span>
      </button>
      <button type="button" class="exc-tab" :class="{ active: activeTab === 'makeup' }" @click="activeTab = 'makeup'">
        补卡
      </button>
      <button type="button" class="exc-tab" :class="{ active: activeTab === 'cancel' }" @click="activeTab = 'cancel'">
        取消班次
      </button>
    </div>

    <div class="mini-page">
      <div
        v-for="record in displayRecords"
        :key="`${record.type}-${record.id}`"
        class="exc-card clickable"
        @click="openRecord(record)"
      >
        <div class="exc-head">
          <div>
            <div class="exc-type">{{ record.typeLabel }}</div>
            <div class="exc-summary">{{ record.summary }}</div>
          </div>
          <span class="mini-tag" :class="record.statusTone">{{ record.statusLabel }}</span>
        </div>
        <div class="exc-reason">{{ record.reason }}</div>
        <div class="exc-foot">
          <span>申请于 {{ formatTime(record.createdAt) }}</span>
          <span>查看详情 ›</span>
        </div>
      </div>

      <div v-if="displayRecords.length === 0" class="mini-empty">暂无异常申请记录</div>
    </div>
  </div>
</template>

<style scoped>
.exc-page {
  min-height: 100%;
  background: var(--mini-bg);
}

.exc-tabs {
  display: flex;
  gap: 8px;
  padding: 12px;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
}

.exc-tab {
  padding: 6px 14px;
  border: 1px solid var(--mini-border);
  border-radius: 999px;
  background: #fff;
  font-size: 13px;
  color: var(--mini-text-secondary);
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.exc-tab.active {
  border-color: #4FD1C5;
  background: #E6FFFA;
  color: #4FD1C5;
  font-weight: 600;
}

.exc-count {
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 8px;
  background: #4FD1C5;
  color: #fff;
  font-size: 10px;
  line-height: 16px;
}

.exc-card {
  background: #fff;
  border-radius: 14px;
  padding: 14px;
  margin-bottom: 10px;
  box-shadow: var(--mini-shadow);
}

.exc-card.clickable {
  cursor: pointer;
}

.exc-head {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: flex-start;
}

.exc-type {
  font-size: 15px;
  font-weight: 600;
}

.exc-summary {
  margin-top: 4px;
  font-size: 13px;
  color: var(--mini-text-muted);
}

.exc-reason {
  margin-top: 10px;
  padding: 10px;
  background: #f9fafb;
  border-radius: 8px;
  font-size: 13px;
  color: var(--mini-text-secondary);
  line-height: 1.5;
}

.exc-foot {
  display: flex;
  justify-content: space-between;
  margin-top: 10px;
  font-size: 12px;
  color: var(--mini-text-muted);
}

.mini-tag.orange { background: #fff7ed; color: #ea580c; }
.mini-tag.green { background: #f0fdf4; color: #16a34a; }
.mini-tag.red { background: #fef2f2; color: #ef4444; }
</style>
