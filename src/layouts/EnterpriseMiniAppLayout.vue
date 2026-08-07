<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Calendar, Grid, User, UserFilled } from '@element-plus/icons-vue'
import '@/styles/miniapp.css'

const route = useRoute()
const router = useRouter()

const showTabBar = computed(() => route.meta.entMiniTab !== false)

const tabs = [
  { path: '/enterprise-miniapp/workbench', label: '工作台', icon: Grid },
  { path: '/enterprise-miniapp/recruitment', label: '招聘', icon: UserFilled },
  { path: '/enterprise-miniapp/schedule', label: '排班', icon: Calendar },
  { path: '/enterprise-miniapp/profile', label: '我的', icon: User },
]

function isActive(path: string) {
  if (path === '/enterprise-miniapp/recruitment') {
    return route.path.startsWith('/enterprise-miniapp/recruitment')
  }
  if (path === '/enterprise-miniapp/schedule') {
    return (
      route.path.startsWith('/enterprise-miniapp/schedule') ||
      route.path.startsWith('/enterprise-miniapp/grab') ||
      route.path.startsWith('/enterprise-miniapp/exceptions') ||
      route.path.startsWith('/enterprise-miniapp/hours')
    )
  }
  return route.path === path
}
</script>

<template>
  <div class="mini-app-shell ent-mini-shell">
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
        </button>
      </nav>
    </div>
  </div>
</template>

<style scoped>
.ent-mini-shell {
  --mini-primary: #5b4fdb;
  --mini-primary-light: #eef2ff;
  --mini-primary-dark: #4338ca;
  --app-primary: #5b4fdb;
  --app-primary-light: #eef2ff;
  --app-primary-dark: #4338ca;
}
</style>
