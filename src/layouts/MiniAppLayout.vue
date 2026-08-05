<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  ChatDotRound,
  Compass,
  Grid,
  List,
  User,
} from '@element-plus/icons-vue'
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
  { path: '/miniapp/workbench', label: '工作台', icon: Grid },
  { path: '/miniapp/recommend', label: '推荐', icon: Compass },
  { path: '/miniapp/task-hall', label: '任务大厅', icon: List },
  { path: '/miniapp/messages', label: '消息', icon: ChatDotRound },
  { path: '/miniapp/profile', label: '我的', icon: User },
]

function isActive(path: string) {
  if (path === '/miniapp/recommend') {
    return route.path.startsWith('/miniapp/recommend')
  }
  if (path === '/miniapp/task-hall') {
    return route.path.startsWith('/miniapp/task-hall')
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
          <span class="mini-tab-icon">
            <el-icon :size="22"><component :is="tab.icon" /></el-icon>
          </span>
          <span>{{ tab.label }}</span>
          <span
            v-if="tab.path === '/miniapp/messages' && unreadCount > 0"
            class="mini-tab-badge"
          >{{ unreadCount > 9 ? '9+' : unreadCount }}</span>
        </button>
      </nav>
    </div>
  </div>
</template>
