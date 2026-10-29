<script setup lang="ts">
import { computed, ref } from 'vue'
import EntMiniNavBar from '@/components/enterprise-miniapp/EntMiniNavBar.vue'
import { useAppStore } from '@/stores/app'
import {
  classifyEnterpriseMiniMessage,
  entMiniMessageCategoryMap,
  entMiniMessageTabs,
  type EntMiniMessageTab,
} from '@/constants/enterpriseMiniMessage'

const store = useAppStore()
const categoryFilter = ref<EntMiniMessageTab>('all')

const allMessages = computed(() =>
  store.notifications
    .map((message) => {
      const category = classifyEnterpriseMiniMessage(message)
      return category ? { ...message, category } : null
    })
    .filter((message): message is NonNullable<typeof message> => message != null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
)

const messages = computed(() => {
  if (categoryFilter.value === 'all') return allMessages.value
  return allMessages.value.filter((message) => message.category === categoryFilter.value)
})

function formatTime(iso: string) {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso.slice(0, 16).replace('T', ' ')
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function openItem(id: string) {
  store.markNotificationRead(id)
}
</script>

<template>
  <div class="page">
    <EntMiniNavBar title="消息" back-to="/enterprise-miniapp/attendance" :show-message="false" />

    <div class="tabs">
      <button
        v-for="tab in entMiniMessageTabs"
        :key="tab.key"
        type="button"
        class="tab"
        :class="{ active: categoryFilter === tab.key }"
        @click="categoryFilter = tab.key"
      >
        {{ tab.label }}
      </button>
    </div>

    <div class="list">
      <article
        v-for="message in messages"
        :key="message.id"
        class="item"
        :class="{ unread: !message.read }"
        @click="openItem(message.id)"
      >
        <div v-if="!message.read" class="dot" />
        <div class="body">
          <div class="row">
            <strong>{{ message.title }}</strong>
            <span>{{ formatTime(message.createdAt) }}</span>
          </div>
          <p>{{ message.content }}</p>
          <em>{{ entMiniMessageCategoryMap[message.category] }}</em>
        </div>
      </article>
      <div v-if="!messages.length" class="empty">暂无该类消息</div>
    </div>
  </div>
</template>

<style scoped>
.tabs {
  display: flex;
  gap: 8px;
  padding: 12px 12px 0;
  overflow-x: auto;
}
.tab {
  flex: 0 0 auto;
  height: 32px;
  padding: 0 12px;
  border: none;
  border-radius: 999px;
  background: #fff;
  color: #6b7280;
  font-size: 13px;
  cursor: pointer;
}
.tab.active {
  background: #228BFF;
  color: #fff;
  font-weight: 600;
}
.list {
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.item {
  background: #fff;
  border-radius: 12px;
  padding: 12px;
  display: flex;
  gap: 10px;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.04);
  cursor: pointer;
}
.item.unread {
  background: #D5E9FF;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #ef4444;
  margin-top: 6px;
  flex-shrink: 0;
}
.body {
  flex: 1;
  min-width: 0;
}
.row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}
.row strong {
  font-size: 14px;
  color: #111827;
}
.row span {
  font-size: 11px;
  color: #9ca3af;
  flex-shrink: 0;
}
.body p {
  margin: 4px 0 0;
  font-size: 12px;
  color: #6b7280;
  line-height: 1.45;
}
.body em {
  display: inline-block;
  margin-top: 6px;
  font-style: normal;
  font-size: 11px;
  color: #228BFF;
}
.empty {
  padding: 48px 0;
  text-align: center;
  color: #9ca3af;
}
</style>
