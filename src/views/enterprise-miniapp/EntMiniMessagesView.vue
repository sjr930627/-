<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import EntMiniNavBar from '@/components/enterprise-miniapp/EntMiniNavBar.vue'
import { useAppStore } from '@/stores/app'

const router = useRouter()
const store = useAppStore()

const messages = computed(() => {
  const fromStore = store.notifications.slice(0, 30).map((n) => ({
    id: n.id,
    title: n.title,
    content: n.content,
    time: n.createdAt?.slice(0, 16).replace('T', ' ') || '',
    unread: !n.read,
  }))
  if (fromStore.length) return fromStore
  return [
    {
      id: 'm1',
      title: '待确认工时提醒',
      content: '今日有班次待确认工时，请及时处理',
      time: '2026-07-27 09:00',
      unread: true,
    },
    {
      id: 'm2',
      title: '面试安排通知',
      content: '候选人面试将于今日进行，请关注进度',
      time: '2026-07-27 08:30',
      unread: true,
    },
    {
      id: 'm3',
      title: '抢班报名待审批',
      content: '有新的抢班报名等待审批',
      time: '2026-07-26 18:20',
      unread: false,
    },
  ]
})

onMounted(() => {
  store.markAllNotificationsRead()
})

function openItem(id: string) {
  store.markNotificationRead(id)
  router.push('/enterprise-miniapp/attendance')
}
</script>

<template>
  <div class="page">
    <EntMiniNavBar title="消息" back-to="/enterprise-miniapp/attendance" :show-message="false" />
    <div class="list">
      <article
        v-for="m in messages"
        :key="m.id"
        class="item"
        :class="{ unread: m.unread }"
        @click="openItem(m.id)"
      >
        <div v-if="m.unread" class="dot" />
        <div class="body">
          <div class="row">
            <strong>{{ m.title }}</strong>
            <span>{{ m.time }}</span>
          </div>
          <p>{{ m.content }}</p>
        </div>
      </article>
      <div v-if="!messages.length" class="empty">暂无消息</div>
    </div>
  </div>
</template>

<style scoped>
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
.empty {
  padding: 48px 0;
  text-align: center;
  color: #9ca3af;
}
</style>
