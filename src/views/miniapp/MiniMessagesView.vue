<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Select } from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import {
  formatMiniMessageTime,
  getMiniMessageAction,
  isScheduleConfirmPending,
  miniMessageCategoryMap,
  miniMessageCategoryTone,
  parseMiniMessageTab,
  type MiniMessageTabKey,
} from '@/constants/miniapp'
import type { MiniAppMessage } from '@/types'

const store = useAppStore()
const route = useRoute()
const router = useRouter()
const { employeeId } = useMiniAppWorker()
const categoryFilter = ref<MiniMessageTabKey>(parseMiniMessageTab(route.query.tab))

function syncTabFromRoute() {
  categoryFilter.value = parseMiniMessageTab(route.query.tab)
}

watch(() => route.query.tab, syncTabFromRoute)

function setCategoryFilter(tab: MiniMessageTabKey) {
  categoryFilter.value = tab
  router.replace({
    path: '/miniapp/messages',
    query: tab === 'all' ? {} : { tab },
  })
}
const tabs: { key: MiniMessageTabKey; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'schedule', label: '排班通知' },
  { key: 'system', label: '系统通知' },
  { key: 'income', label: '收入通知' },
]

const allMessages = computed(() =>
  store.miniAppMessages
    .filter((m) => m.employeeId === employeeId.value)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
)

const messages = computed(() => {
  if (categoryFilter.value === 'all') return allMessages.value
  return allMessages.value.filter(
    (m) => miniMessageCategoryTone[m.category].tab === categoryFilter.value,
  )
})

const unreadCount = computed(() => allMessages.value.filter((m) => !m.read).length)

function openMessage(msg: MiniAppMessage) {
  if (isScheduleConfirmPending(msg) || msg.scheduleDetail) {
    router.push(`/miniapp/messages/${msg.id}`)
    return
  }
  store.markMiniMessageRead(msg.id)
}

function handleAction(msg: MiniAppMessage) {
  const action = getMiniMessageAction(msg)
  if (!action) return
  if (!isScheduleConfirmPending(msg)) {
    store.markMiniMessageRead(msg.id)
  }
  router.push(action.path)
}

function markAllRead() {
  store.markAllMiniMessagesRead(employeeId.value)
  ElMessage.success('已全部标为已读')
}
</script>

<template>
  <div class="msg-page">
    <header class="msg-header">
      <h1 class="msg-title">消息</h1>
    </header>

    <div class="msg-tabs">
      <button
        v-for="tab in tabs"
        :key="tab.key"
        type="button"
        class="msg-tab"
        :class="{ active: categoryFilter === tab.key }"
        @click="setCategoryFilter(tab.key)"
      >
        {{ tab.label }}
      </button>
    </div>

    <div class="msg-top-bar">
      <div v-if="unreadCount > 0" class="msg-unread-tip">
        <span class="unread-dot" />
        您有 {{ unreadCount }} 条未读消息
      </div>
      <div v-else class="msg-count-inline">共 {{ allMessages.length }} 条消息</div>
      <button
        v-if="unreadCount > 0"
        type="button"
        class="mark-all-btn"
        @click="markAllRead"
      >
        <el-icon :size="14"><Select /></el-icon>
        全部已读
      </button>
    </div>

    <div class="msg-list">
      <article
        v-for="msg in messages"
        :key="msg.id"
        class="msg-item"
        :class="{ read: msg.read }"
        @click="openMessage(msg)"
      >
        <span v-if="!msg.read" class="msg-item-dot" />
        <div class="msg-item-body">
          <div class="msg-meta">
            <span
              class="msg-tag"
              :style="{
                background: miniMessageCategoryTone[msg.category].bg,
                color: miniMessageCategoryTone[msg.category].color,
              }"
            >
              {{ miniMessageCategoryMap[msg.category] }}
            </span>
            <span class="msg-time">{{ formatMiniMessageTime(msg.createdAt) }}</span>
          </div>
          <div class="msg-content-row">
            <div class="msg-text">
              <div class="msg-item-title">{{ msg.title }}</div>
              <div class="msg-item-desc">{{ msg.content }}</div>
            </div>
            <button
              v-if="getMiniMessageAction(msg)"
              type="button"
              class="msg-action"
              :class="{ primary: getMiniMessageAction(msg)?.primary }"
              @click.stop="handleAction(msg)"
            >
              {{ getMiniMessageAction(msg)!.label }}
            </button>
          </div>
        </div>
      </article>

      <div v-if="messages.length === 0" class="mini-empty">暂无消息</div>
    </div>

    <footer v-if="allMessages.length && unreadCount > 0" class="msg-footer">
      <span class="msg-count">共 {{ allMessages.length }} 条消息</span>
    </footer>
  </div>
</template>

<style scoped>
.msg-page {
  min-height: 100%;
  background: var(--mini-bg, #f3f4f6);
  padding-bottom: 12px;
}

.msg-header {
  display: flex;
  align-items: center;
  padding: 16px 16px 12px;
  background: #fff;
}

.msg-title {
  margin: 0;
  font-size: 22px;
  font-weight: 800;
  color: #111827;
}

.msg-tabs {
  display: flex;
  gap: 8px;
  padding: 0 16px 12px;
  background: #fff;
  border-bottom: 1px solid #f3f4f6;
  overflow-x: auto;
}

.msg-tab {
  flex-shrink: 0;
  padding: 8px 14px;
  border: none;
  border-radius: 999px;
  background: #f3f4f6;
  color: #6b7280;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.msg-tab.active {
  background: var(--mini-primary, #3b82f6);
  color: #fff;
  font-weight: 600;
}

.msg-top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 16px;
  background: #fff;
}

.msg-unread-tip {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #ef4444;
}

.msg-count-inline {
  font-size: 13px;
  color: #9ca3af;
}

.unread-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #ef4444;
  flex-shrink: 0;
}

.mark-all-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: none;
  color: var(--mini-primary, #3b82f6);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  flex-shrink: 0;
}

.msg-list {
  background: #fff;
  margin-top: 8px;
}

.msg-item {
  position: relative;
  display: flex;
  gap: 8px;
  padding: 14px 16px 14px 24px;
  border-bottom: 1px solid #f3f4f6;
  cursor: pointer;
  transition: background 0.15s;
}

.msg-item:active {
  background: #f9fafb;
}

.msg-item.read {
  padding-left: 16px;
}

.msg-item-dot {
  position: absolute;
  left: 10px;
  top: 18px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--mini-primary, #3b82f6);
}

.msg-item-body {
  flex: 1;
  min-width: 0;
}

.msg-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.msg-tag {
  padding: 2px 8px;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
}

.msg-time {
  font-size: 12px;
  color: #9ca3af;
}

.msg-content-row {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.msg-text {
  flex: 1;
  min-width: 0;
}

.msg-item-title {
  font-size: 15px;
  font-weight: 700;
  color: #111827;
  line-height: 1.4;
}

.msg-item.read .msg-item-title {
  color: #6b7280;
  font-weight: 600;
}

.msg-item-desc {
  margin-top: 4px;
  font-size: 13px;
  color: #9ca3af;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.msg-action {
  flex-shrink: 0;
  padding: 6px 12px;
  border-radius: 999px;
  border: 1px solid #e5e7eb;
  background: #fff;
  color: #6b7280;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  white-space: nowrap;
}

.msg-action.primary {
  border-color: var(--mini-primary, #3b82f6);
  background: var(--mini-primary, #3b82f6);
  color: #fff;
}

.msg-footer {
  padding: 14px 16px;
  background: #fff;
  margin-top: 8px;
}

.msg-count {
  font-size: 13px;
  color: #9ca3af;
}
</style>
