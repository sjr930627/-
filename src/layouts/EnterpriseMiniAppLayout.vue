<script setup lang="ts">
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import {
  Briefcase,
  Calendar,
  List,
  PieChart,
  User,
} from '@element-plus/icons-vue'
import '@/styles/miniapp.css'

const route = useRoute()
const router = useRouter()

const showTabBar = computed(() => route.meta.entMiniTab !== false)

const tabs = [
  { path: '/enterprise-miniapp/recruitment', label: '招聘', icon: Briefcase, match: 'recruitment' },
  { path: '/enterprise-miniapp/attendance', label: '出勤', icon: Calendar, match: 'attendance' },
  { path: '/enterprise-miniapp/tasks', label: '任务管理', icon: List, match: 'tasks' },
  { path: '/enterprise-miniapp/stats', label: '统计', icon: PieChart, match: 'stats' },
  { path: '/enterprise-miniapp/profile', label: '我的', icon: User, match: 'profile' },
]

function isActive(tab: (typeof tabs)[number]) {
  const p = route.path
  if (tab.match === 'recruitment') return p.startsWith('/enterprise-miniapp/recruitment')
  if (tab.match === 'attendance') {
    return (
      p.startsWith('/enterprise-miniapp/attendance') ||
      p.startsWith('/enterprise-miniapp/schedule') ||
      p.startsWith('/enterprise-miniapp/grab') ||
      p.startsWith('/enterprise-miniapp/shift-demand') ||
      p.startsWith('/enterprise-miniapp/personnel') ||
      p.startsWith('/enterprise-miniapp/onboard') ||
      p.startsWith('/enterprise-miniapp/exceptions') ||
      p.startsWith('/enterprise-miniapp/hours') ||
      p.startsWith('/enterprise-miniapp/hours-confirm') ||
      p.startsWith('/enterprise-miniapp/punch-records') ||
      p.startsWith('/enterprise-miniapp/today-schedule')
    )
  }
  if (tab.match === 'tasks') return p.startsWith('/enterprise-miniapp/tasks')
  if (tab.match === 'stats') return p.startsWith('/enterprise-miniapp/stats')
  return p.startsWith('/enterprise-miniapp/profile')
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
          :class="{ active: isActive(tab) }"
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
  --mini-bg: #f5f6f8;
}
.ent-mini-shell :deep(.mini-tab-item.active) {
  color: #5b4fdb;
}
</style>
