<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'

const STORAGE_KEY = 'layout:nav-collapsed'

const route = useRoute()
const router = useRouter()
const store = useAppStore()
const navCollapsed = ref(localStorage.getItem(STORAGE_KEY) === '1')
const searchKeyword = ref('')
const notificationDrawer = ref(false)

interface MenuChild {
  path: string
  title: string
  icon: string
}

interface MenuGroup {
  index: string
  title: string
  icon: string
  children: MenuChild[]
}

const menuGroups: MenuGroup[] = [
  {
    index: 'recruitment',
    title: '招聘管理',
    icon: 'User',
    children: [
      { path: '/recruitment/requirements', title: '需求管理', icon: 'Document' },
      { path: '/recruitment/progress', title: '招聘进度', icon: 'DataLine' },
      { path: '/recruitment/calendar', title: '面试日程', icon: 'Calendar' },
      { path: '/recruitment/talents', title: '人才库', icon: 'Postcard' },
    ],
  },
  {
    index: 'training',
    title: '培训与考核',
    icon: 'Reading',
    children: [
      { path: '/training/materials', title: '培训资料', icon: 'FolderOpened' },
      { path: '/training/courses', title: '课程管理', icon: 'Notebook' },
      { path: '/training/exams', title: '考核管理', icon: 'EditPen' },
      { path: '/training/progress', title: '学习进度', icon: 'TrendCharts' },
      { path: '/training/exam-results', title: '考核结果', icon: 'DocumentChecked' },
    ],
  },
  {
    index: 'attendance',
    title: '人员考勤管理',
    icon: 'Avatar',
    children: [
      { path: '/employees', title: '人员管理', icon: 'UserFilled' },
      { path: '/attendance-groups', title: '考勤组管理', icon: 'Grid' },
      { path: '/schedule-manage', title: '排班管理', icon: 'Notebook' },
      { path: '/grab-shifts', title: '抢班管理', icon: 'Bell' },
      { path: '/attendance-data', title: '考勤数据', icon: 'DataBoard' },
      { path: '/attendance-exceptions', title: '考勤异常处理', icon: 'WarningFilled' },
      { path: '/insurance', title: '保险管理', icon: 'FirstAidKit' },
    ],
  },
  {
    index: 'task',
    title: '任务管理',
    icon: 'List',
    children: [
      { path: '/task-workflows', title: '任务规则配置', icon: 'SetUp' },
      { path: '/task-type-approval', title: '任务类型审批', icon: 'Stamp' },
      { path: '/task-manage', title: '任务管理', icon: 'Tickets' },
    ],
  },
  {
    index: 'partnership',
    title: '合作管理',
    icon: 'Connection',
    children: [
      { path: '/partnership', title: '服务商合作', icon: 'Link' },
    ],
  },
  {
    index: 'payroll',
    title: '薪税管理',
    icon: 'Money',
    children: [
      { path: '/payroll/bills', title: '账单管理', icon: 'DocumentCopy' },
      { path: '/payroll/billing-rules', title: '计薪规则', icon: 'Operation' },
      { path: '/payroll/settlement', title: '结算概览', icon: 'PieChart' },
      { path: '/payroll/invoices', title: '发票管理', icon: 'Ticket' },
    ],
  },
  {
    index: 'statistics',
    title: '数据统计',
    icon: 'DataAnalysis',
    children: [
      { path: '/statistics/overview', title: '概览看板', icon: 'Odometer' },
      { path: '/bi/monitor', title: '数据监控中心', icon: 'Monitor' },
      { path: '/statistics/recruitment', title: '招聘统计', icon: 'TrendCharts' },
      { path: '/statistics/attendance', title: '考勤统计', icon: 'Timer' },
      { path: '/statistics/task', title: '任务统计', icon: 'Finished' },
      { path: '/statistics/settlement', title: '结算统计', icon: 'Wallet' },
    ],
  },
]

const settingsGroup: MenuGroup = {
  index: 'settings',
  title: '系统设置',
  icon: 'Setting',
  children: [
    { path: '/system/accounts', title: '账号管理', icon: 'User' },
    { path: '/system/roles', title: '角色权限', icon: 'Key' },
  ],
}

const activeMenu = computed(() => route.path)
const asideWidth = computed(() => (navCollapsed.value ? '64px' : '260px'))

const breadcrumbs = computed(() => {
  const crumbs: string[] = ['灵工平台']
  if (route.meta.group) crumbs.push(route.meta.group as string)
  if (route.meta.title) crumbs.push(route.meta.title as string)
  return crumbs
})

const openMenus = computed(() => {
  for (const group of [...menuGroups, settingsGroup]) {
    if (group.children.some((c) => activeMenu.value === c.path || activeMenu.value.startsWith(`${c.path}/`))) {
      return [group.index]
    }
  }
  return []
})

function navigate(path: string) {
  router.push(path)
}

function handleSearch() {
  if (!searchKeyword.value.trim()) return
  router.push({ path: '/recruitment/talents', query: { q: searchKeyword.value.trim() } })
}

function toggleNav() {
  navCollapsed.value = !navCollapsed.value
  localStorage.setItem(STORAGE_KEY, navCollapsed.value ? '1' : '0')
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('zh-CN')
}
</script>

<template>
  <el-container class="layout">
    <el-header class="header">
      <div class="header-left">
        <div class="brand" @click="navigate('/dashboard')">
          <div class="brand-mark">S</div>
          <div class="brand-text">
            <span class="brand-title">灵工管理平台</span>
            <span class="brand-sub">灵活用工 · 智能管理</span>
          </div>
        </div>
        <el-divider direction="vertical" class="header-divider" />
        <el-breadcrumb separator="/" class="header-breadcrumb">
          <el-breadcrumb-item v-for="(crumb, i) in breadcrumbs" :key="i">
            {{ crumb }}
          </el-breadcrumb-item>
        </el-breadcrumb>
      </div>
      <div class="header-right">
        <el-input
          v-model="searchKeyword"
          class="header-search"
          placeholder="搜索功能、页面..."
          prefix-icon="Search"
          clearable
          @keyup.enter="handleSearch"
        />
        <el-badge :value="store.pendingApprovalCount" :hidden="store.pendingApprovalCount === 0">
          <el-button class="header-icon-btn" text @click="router.push('/approvals')">
            <el-icon size="18"><CircleCheck /></el-icon>
          </el-button>
        </el-badge>
        <el-badge :value="store.unreadNotificationCount" :hidden="store.unreadNotificationCount === 0">
          <el-button class="header-icon-btn" text @click="notificationDrawer = true">
            <el-icon size="18"><Bell /></el-icon>
          </el-button>
        </el-badge>
        <el-dropdown trigger="click">
          <div class="user-info">
            <el-avatar :size="32" class="user-avatar">张</el-avatar>
            <span class="username">张管理员</span>
            <el-icon><ArrowDown /></el-icon>
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item @click="router.push('/system/accounts')">账号管理</el-dropdown-item>
              <el-dropdown-item @click="router.push('/system/roles')">角色权限</el-dropdown-item>
              <el-dropdown-item @click="router.push('/approvals')">审批中心</el-dropdown-item>
              <el-dropdown-item @click="router.push('/enterprise/task-types')">企业B端</el-dropdown-item>
              <el-dropdown-item divided @click="router.push('/self-service')">员工自助</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </el-header>

    <el-container class="body-container">
      <el-aside :width="asideWidth" class="aside" :class="{ collapsed: navCollapsed }">
        <el-scrollbar class="menu-scroll">
          <el-menu
            :default-active="activeMenu"
            :default-openeds="openMenus"
            :collapse="navCollapsed"
            :collapse-transition="false"
            class="side-menu"
            @select="navigate"
          >
            <el-menu-item index="/dashboard">
              <el-icon><Odometer /></el-icon>
              <template #title>工作台</template>
            </el-menu-item>

            <el-sub-menu v-for="group in menuGroups" :key="group.index" :index="group.index">
              <template #title>
                <el-icon><component :is="group.icon" /></el-icon>
                <span>{{ group.title }}</span>
              </template>
              <el-menu-item
                v-for="child in group.children"
                :key="child.path"
                :index="child.path"
              >
                <el-icon><component :is="child.icon" /></el-icon>
                <template #title>{{ child.title }}</template>
              </el-menu-item>
            </el-sub-menu>

            <el-sub-menu :index="settingsGroup.index">
              <template #title>
                <el-icon><Setting /></el-icon>
                <span>{{ settingsGroup.title }}</span>
              </template>
              <el-menu-item
                v-for="child in settingsGroup.children"
                :key="child.path"
                :index="child.path"
              >
                <el-icon><component :is="child.icon" /></el-icon>
                <template #title>{{ child.title }}</template>
              </el-menu-item>
            </el-sub-menu>
          </el-menu>
        </el-scrollbar>

        <div class="aside-footer">
          <el-tooltip :content="navCollapsed ? '展开导航' : '收起导航'" placement="right">
            <button class="collapse-btn" type="button" @click="toggleNav">
              <el-icon size="18">
                <Expand v-if="navCollapsed" />
                <Fold v-else />
              </el-icon>
              <span v-show="!navCollapsed" class="collapse-label">收起导航</span>
            </button>
          </el-tooltip>
        </div>
      </el-aside>

      <el-main class="main">
        <RouterView />
      </el-main>
    </el-container>

    <el-drawer v-model="notificationDrawer" title="消息通知" size="400px">
      <div class="notification-actions">
        <el-button size="small" @click="store.markAllNotificationsRead">全部已读</el-button>
      </div>
      <el-empty v-if="store.notifications.length === 0" description="暂无通知" />
      <div v-else class="notification-list">
        <div
          v-for="n in store.notifications"
          :key="n.id"
          class="notification-item"
          :class="{ unread: !n.read }"
          @click="store.markNotificationRead(n.id)"
        >
          <div class="notification-title">{{ n.title }}</div>
          <div class="notification-content">{{ n.content }}</div>
          <div class="notification-time">{{ formatTime(n.createdAt) }}</div>
        </div>
      </div>
    </el-drawer>
  </el-container>
</template>

<style scoped>
.layout {
  height: 100vh;
  flex-direction: column;
  background: var(--app-bg);
}

.header {
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 56px;
  padding: 0 20px;
  border-bottom: 1px solid var(--app-border);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
  flex-shrink: 0;
  z-index: 10;
}

.header-left,
.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
}

.brand-mark {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, #e60012 0%, #ff4d4f 100%);
  color: #fff;
  font-weight: 800;
  font-size: 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 2px 8px rgba(230, 0, 18, 0.2);
}

.brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.2;
}

.brand-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--app-text);
  letter-spacing: 0.3px;
}

.brand-sub {
  font-size: 11px;
  color: var(--app-text-secondary);
}

.header-divider {
  border-color: var(--app-border);
  height: 24px;
  margin: 0 4px;
}

.header-breadcrumb :deep(.el-breadcrumb__inner),
.header-breadcrumb :deep(.el-breadcrumb__separator) {
  color: var(--app-text-secondary);
  font-weight: 400;
}

.header-icon-btn {
  color: var(--app-text-secondary);
}

.header-icon-btn:hover {
  background: var(--app-primary-light);
  color: var(--app-primary);
}

.header-search {
  width: 220px;
}

.header-search :deep(.el-input__wrapper) {
  border-radius: 8px;
  background: #fff;
  box-shadow: none;
  border: 1px solid var(--app-border);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 8px;
  color: var(--app-text);
}

.user-info:hover {
  background: var(--app-primary-light);
}

.user-avatar {
  background: linear-gradient(135deg, #e60012, #ff4d4f);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
}

.username {
  font-size: 14px;
}

.body-container {
  flex: 1;
  min-height: 0;
}

.aside {
  background: #fff;
  border-right: 1px solid var(--app-border);
  display: flex;
  flex-direction: column;
  transition: width 0.2s ease;
  overflow: hidden;
  flex-shrink: 0;
}

.menu-scroll {
  flex: 1;
  min-height: 0;
}

.side-menu {
  border-right: none;
  --el-menu-active-color: var(--app-primary);
  --el-menu-hover-bg-color: var(--app-primary-light);
}

.side-menu:not(.el-menu--collapse) {
  width: 260px;
}

.aside.collapsed .side-menu {
  width: 64px;
}

.side-menu :deep(.el-menu-item.is-active),
.side-menu :deep(.el-sub-menu.is-active > .el-sub-menu__title) {
  color: var(--app-primary);
  background: var(--app-primary-light);
}

.side-menu :deep(.el-menu-item.is-active) {
  border-right: 3px solid var(--app-primary);
}

.side-menu :deep(.el-sub-menu__title),
.side-menu :deep(.el-menu-item) {
  height: 44px;
  line-height: 44px;
}

.aside-footer {
  flex-shrink: 0;
  border-top: 1px solid var(--app-border);
  padding: 8px;
  background: #fff;
}

.collapse-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 8px;
  border: none;
  border-radius: 4px;
  background: transparent;
  color: #606266;
  cursor: pointer;
  font-size: 13px;
  transition: background 0.15s, color 0.15s;
}

.collapse-btn:hover {
  background: var(--app-primary-light);
  color: var(--app-primary);
}

.aside.collapsed .collapse-btn {
  padding: 8px 0;
}

.collapse-label {
  white-space: nowrap;
}

.main {
  padding: 16px 20px;
  overflow: auto;
  background: #fff;
  min-width: 0;
}

.notification-actions {
  margin-bottom: 12px;
}

.notification-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.notification-item {
  padding: 12px;
  border-radius: 4px;
  border: 1px solid var(--app-border);
  cursor: pointer;
}

.notification-item.unread {
  background: var(--app-primary-light);
  border-color: #ffccc7;
}

.notification-title {
  font-weight: 600;
  margin-bottom: 4px;
}

.notification-content {
  font-size: 13px;
  color: #606266;
  margin-bottom: 4px;
}

.notification-time {
  font-size: 12px;
  color: #909399;
}
</style>

<style>
.el-menu--popup {
  --el-menu-active-color: var(--app-primary);
  --el-menu-hover-bg-color: var(--app-primary-light);
}
</style>
