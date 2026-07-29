<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAppStore } from '@/stores/app'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import { miniMessageCategoryIcon, miniMessageCategoryMap } from '@/constants/miniapp'
import type { MiniMessageCategory } from '@/types'

const store = useAppStore()
const { employeeId } = useMiniAppWorker()
const categoryFilter = ref<MiniMessageCategory | 'all'>('all')

const categories: { key: MiniMessageCategory | 'all'; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'income', label: '收入' },
  { key: 'schedule', label: '排班' },
  { key: 'task', label: '任务' },
  { key: 'withdraw', label: '提现' },
]

const messages = computed(() =>
  store.miniAppMessages
    .filter((m) => m.employeeId === employeeId.value)
    .filter((m) => categoryFilter.value === 'all' || m.category === categoryFilter.value)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
)

function openMessage(id: string) {
  store.markMiniMessageRead(id)
}
</script>

<template>
  <div class="mini-page">
    <div class="mini-tabs" style="overflow-x: auto; flex-wrap: nowrap">
      <button
        v-for="c in categories"
        :key="c.key"
        class="mini-tab"
        :class="{ active: categoryFilter === c.key }"
        style="flex: none; min-width: 60px"
        @click="categoryFilter = c.key"
      >
        {{ c.label }}
      </button>
    </div>

    <div v-for="msg in messages" :key="msg.id" class="mini-card" @click="openMessage(msg.id)">
      <div style="display: flex; gap: 12px; align-items: flex-start">
        <span style="font-size: 28px">{{ miniMessageCategoryIcon[msg.category] }}</span>
        <div style="flex: 1; min-width: 0">
          <div style="display: flex; align-items: center; gap: 8px">
            <span style="font-size: 15px; font-weight: 600" :style="{ color: msg.read ? '#666' : '#333' }">
              {{ msg.title }}
            </span>
            <span v-if="!msg.read" style="width: 8px; height: 8px; background: #e60012; border-radius: 50%; flex-shrink: 0" />
          </div>
          <div style="font-size: 13px; color: #999; margin-top: 4px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap">
            {{ msg.content }}
          </div>
          <div style="font-size: 11px; color: #ccc; margin-top: 6px">
            {{ miniMessageCategoryMap[msg.category] }} · {{ msg.createdAt.slice(0, 16).replace('T', ' ') }}
          </div>
        </div>
      </div>
    </div>
    <div v-if="messages.length === 0" class="mini-empty">暂无消息</div>
  </div>
</template>

<style scoped>
.mini-card { cursor: pointer; }
</style>
