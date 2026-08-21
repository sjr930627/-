<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Bell } from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'

withDefaults(
  defineProps<{
    /** 浅色顶栏用深色图标，紫色顶栏用浅色 */
    tone?: 'light' | 'dark'
  }>(),
  { tone: 'light' },
)

const route = useRoute()
const router = useRouter()
const store = useAppStore()

const unreadCount = computed(() => store.unreadNotificationCount)

const hidden = computed(
  () =>
    route.path === '/enterprise-miniapp/login' ||
    route.path.startsWith('/enterprise-miniapp/login'),
)

function openMessages() {
  router.push('/enterprise-miniapp/messages')
}
</script>

<template>
  <button
    v-if="!hidden"
    type="button"
    class="msg-entry"
    :class="tone"
    aria-label="消息"
    @click="openMessages"
  >
    <el-icon :size="18"><Bell /></el-icon>
    <i v-if="unreadCount > 0" class="badge">{{ unreadCount > 99 ? '99+' : unreadCount }}</i>
  </button>
</template>

<style scoped>
.msg-entry {
  position: relative;
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  cursor: pointer;
}
.msg-entry.light {
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
}
.msg-entry.dark {
  background: #fff;
  color: #374151;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.08);
}
.badge {
  position: absolute;
  top: -4px;
  right: -4px;
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: #ef4444;
  color: #fff;
  font-size: 10px;
  font-style: normal;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  box-sizing: border-box;
}
</style>
