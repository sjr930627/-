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
      p.startsWith('/enterprise-miniapp/attendance-groups') ||
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
/* 企业端 — 页面白底，抬头 #D5E9FF，按钮/选中态 #228BFF */
.ent-mini-shell {
  --mini-bg: #ffffff;
  --ent-header-bg: #D5E9FF;
  --mini-primary: #228BFF;
  --mini-primary-light: #D5E9FF;
  --mini-primary-dark: #1A73E6;
  --mini-primary-mid: #5AA8FF;
  --app-primary: #228BFF;
  --app-primary-light: #D5E9FF;
  --app-primary-dark: #1A73E6;
  --mini-text: #1f2937;
  --mini-text-secondary: #6b7280;
  --mini-text-muted: #9ca3af;
  --mini-card: #ffffff;
  --mini-border: #e5e7eb;

  --el-color-primary: var(--mini-primary);
  --el-color-primary-light-3: #69b8ff;
  --el-color-primary-light-5: #91caff;
  --el-color-primary-light-7: #BAE0FF;
  --el-color-primary-light-8: #D5E9FF;
  --el-color-primary-light-9: #EBF4FF;
  --el-color-primary-dark-2: var(--mini-primary-dark);
}

.ent-mini-shell :deep(.mini-app-main) {
  background: #fff;
}

.ent-mini-shell :deep(.mini-tab-item.active) {
  color: var(--mini-primary);
}

.ent-mini-shell :deep(.mini-tab.active) {
  background: var(--mini-primary);
  color: #fff;
}

.ent-mini-shell :deep(.mini-btn-primary) {
  background: var(--mini-primary);
  color: #fff;
}

.ent-mini-shell :deep(.mini-btn-primary:not(:disabled):hover) {
  background: var(--mini-primary-dark);
}

.ent-mini-shell :deep(.mini-btn-outline) {
  border-color: var(--mini-primary);
  color: var(--mini-primary);
}

.ent-mini-shell :deep(.el-button--primary) {
  --el-button-bg-color: var(--mini-primary);
  --el-button-border-color: var(--mini-primary);
  --el-button-text-color: #fff;
  --el-button-hover-bg-color: var(--mini-primary-dark);
  --el-button-hover-border-color: var(--mini-primary-dark);
  --el-button-hover-text-color: #fff;
  --el-button-active-bg-color: var(--mini-primary-dark);
  --el-button-active-border-color: var(--mini-primary-dark);
  --el-button-active-text-color: #fff;
}
</style>
