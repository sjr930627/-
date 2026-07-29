<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import '@/styles/miniapp.css'

const route = useRoute()
const router = useRouter()
const store = useAppStore()
const { employeeId } = useMiniAppWorker()

const showTabBar = computed(() => route.meta.miniTab !== false)

const unreadCount = computed(
  () =>
    store.miniAppMessages.filter((m) => m.employeeId === employeeId.value && !m.read).length,
)

const tabs = [
  { path: '/miniapp/workbench', label: '工作台', icon: '🏠' },
  { path: '/miniapp/recommend', label: '推荐', icon: '✨' },
  { path: '/miniapp/messages', label: '消息', icon: '💬' },
  { path: '/miniapp/profile', label: '我的', icon: '👤' },
]

function isActive(path: string) {
  if (path === '/miniapp/recommend') {
    return route.path.startsWith('/miniapp/recommend')
  }
  return route.path === path
}
</script>

<template>
  <div class="mini-app-shell">
    <div class="mini-app-frame">
      <main class="mini-app-main" :class="{ 'no-tab': !showTabBar, 'has-tab': showTabBar }">
        <RouterView />
      </main>
      <nav v-if="showTabBar" class="mini-tabbar">
        <button
          v-for="tab in tabs"
          :key="tab.path"
          class="mini-tab-item"
          :class="{ active: isActive(tab.path) }"
          @click="router.push(tab.path)"
        >
          <span class="mini-tab-icon">{{ tab.icon }}</span>
          <span>{{ tab.label }}</span>
          <span
            v-if="tab.path === '/miniapp/messages' && unreadCount > 0"
            style="position:absolute;margin-top:-18px;margin-left:20px;background:#e60012;color:#fff;font-size:10px;min-width:16px;height:16px;border-radius:8px;line-height:16px;text-align:center;padding:0 4px"
          >{{ unreadCount > 9 ? '9+' : unreadCount }}</span>
        </button>
      </nav>
    </div>
  </div>
</template>

<style scoped>
.mini-tab-item { position: relative; }
</style>
