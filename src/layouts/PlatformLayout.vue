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
  badgeKey?: 'scheduleAttendance' | 'grabAttendance'
}

interface MenuGroup {
  index: string
  title: string
  icon: string
  children: MenuChild[]
}

const menuGroups: MenuGroup[] = [
  {
    index: 'enterprise-mgmt',
    title: '企业管理',
    icon: 'OfficeBuilding',
    children: [
      { path: '/enterprises', title: '企业列表', icon: 'School' },
      { path: '/contracts', title: '合同管理', icon: 'Document' },
      { path: '/settlement-prices', title: '结算价管理', icon: 'Coin' },
    ],
  },
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
    index: 'personnel',
    title: '人员管理',
    icon: 'Avatar',
    children: [
      { path: '/employees', title: '人员管理', icon: 'Avatar' },
      { path: '/attendance-groups', title: '考勤组管理', icon: 'Grid' },
      { path: '/worker-agreements', title: '合同管理', icon: 'Document' },
      { path: '/insurance', title: '保险管理', icon: 'FirstAidKit' },
    ],
  },
  {
    index: 'schedule',
    title: '排班管理',
    icon: 'Calendar',
    children: [
      { path: '/schedule-manage', title: '排班管理', icon: 'Notebook' },
      { path: '/attendance-data', title: '考勤数据', icon: 'DataBoard' },
      {
        path: '/attendance-exceptions',
        title: '考勤审批',
        icon: 'WarningFilled',
        badgeKey: 'scheduleAttendance',
      },
    ],
  },
  {
    index: 'grab',
    title: '抢班管理',
    icon: 'Bell',
    children: [
      { path: '/grab-interview', title: '抢班面试管理', icon: 'ChatDotRound' },
      { path: '/grab-shifts', title: '抢班管理', icon: 'Bell' },
      { path: '/grab-attendance-data', title: '考勤数据', icon: 'DataBoard' },
      {
        path: '/grab-attendance-exceptions',
        title: '考勤审批记录',
        icon: 'WarningFilled',
        badgeKey: 'grabAttendance',
      },
    ],
  },
  {
    index: 'task',
    title: '任务管理',
    icon: 'List',
    children: [
      { path: '/task-workflows', title: '任务流程配置', icon: 'SetUp' },
      { path: '/task-approval', title: '任务审批', icon: 'Stamp' },
      { path: '/task-manage', title: '任务管理', icon: 'Tickets' },
    ],
  },
  {
    index: 'provider-mgmt',
    title: '服务商管理',
    icon: 'Connection',
    children: [
      { path: '/service-providers', title: '服务商列表', icon: 'Link' },
    ],
  },
  {
    index: 'payroll',
    title: '财税管理',
    icon: 'Money',
    children: [
      { path: '/payroll/bills', title: '账单管理', icon: 'DocumentCopy' },
      { path: '/payroll/import-templates', title: '账单导入模板', icon: 'Upload' },
      { path: '/payroll/billing-rules', title: '计薪规则', icon: 'Operation' },
      { path: '/payroll/settlement', title: '发薪管理', icon: 'PieChart' },
      { path: '/payroll/funds', title: '资金管理', icon: 'Wallet' },
      { path: '/payroll/tax', title: '个税管理', icon: 'Coin' },
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
    { path: '/system/reminder-rules', title: '提醒规则配置', icon: 'Bell' },
    { path: '/system/oplog', title: '操作日志', icon: 'Document' },
  ],
}

const activeMenu = computed(() => route.path)
const asideWidth = computed(() => (navCollapsed.value ? '72px' : '248px'))

const breadcrumbs = computed(() => {
  const crumbs: string[] = []
  if (route.meta.group) crumbs.push(route.meta.group as string)
  if (route.meta.title) crumbs.push(route.meta.title as string)
  return crumbs
})

const openMenus = computed(() => {
  const opened = ['home']
  for (const group of [...menuGroups, settingsGroup]) {
    if (group.children.some((c) => activeMenu.value === c.path || activeMenu.value.startsWith(`${c.path}/`))) {
      opened.push(group.index)
    }
  }
  return opened
})

function menuBadgeValue(child: MenuChild) {
  if (child.badgeKey === 'scheduleAttendance') return store.pendingScheduleAttendanceApprovalCount
  if (child.badgeKey === 'grabAttendance') return store.pendingGrabAttendanceApprovalCount
  return 0
}

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
  <el-container class="platform-layout">
    <el-container class="body-container">
      <el-aside :width="asideWidth" class="aside" :class="{ collapsed: navCollapsed }">
        <div class="aside-brand" @click="navigate('/dashboard')">
          <div class="brand-mark">
            <svg viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="8" height="8" rx="2" fill="currentColor" opacity=".9" />
              <rect x="13" y="3" width="8" height="8" rx="2" fill="currentColor" opacity=".65" />
              <rect x="3" y="13" width="8" height="8" rx="2" fill="currentColor" opacity=".65" />
              <rect x="13" y="13" width="8" height="8" rx="2" fill="currentColor" opacity=".45" />
            </svg>
          </div>
          <div v-show="!navCollapsed" class="brand-text">
            <div class="brand-title">灵工平台</div>
            <div class="brand-sub">运营后台系统</div>
          </div>
        </div>

        <el-scrollbar class="menu-scroll">
          <el-menu
            :default-active="activeMenu"
            :default-openeds="openMenus"
            :collapse="navCollapsed"
            :collapse-transition="false"
            class="side-menu"
            @select="navigate"
          >
            <el-sub-menu index="home">
              <template #title>
                <el-icon class="menu-icon"><HomeFilled /></el-icon>
                <span>首页</span>
              </template>
              <el-menu-item index="/dashboard">
                <el-icon class="menu-icon menu-icon--sub"><Odometer /></el-icon>
                <template #title>工作台</template>
              </el-menu-item>
            </el-sub-menu>

            <el-sub-menu v-for="group in menuGroups" :key="group.index" :index="group.index">
              <template #title>
                <el-icon class="menu-icon"><component :is="group.icon" /></el-icon>
                <span>{{ group.title }}</span>
              </template>
              <el-menu-item
                v-for="child in group.children"
                :key="child.path"
                :index="child.path"
              >
                <el-icon class="menu-icon menu-icon--sub"><component :is="child.icon" /></el-icon>
                <template #title>
                  <span class="menu-item-title">
                    {{ child.title }}
                    <el-badge
                      v-if="menuBadgeValue(child) > 0"
                      :value="menuBadgeValue(child)"
                      class="menu-badge"
                    />
                  </span>
                </template>
              </el-menu-item>
            </el-sub-menu>

            <el-sub-menu :index="settingsGroup.index">
              <template #title>
                <el-icon class="menu-icon"><Setting /></el-icon>
                <span>{{ settingsGroup.title }}</span>
              </template>
              <el-menu-item
                v-for="child in settingsGroup.children"
                :key="child.path"
                :index="child.path"
              >
                <el-icon class="menu-icon menu-icon--sub"><component :is="child.icon" /></el-icon>
                <template #title>{{ child.title }}</template>
              </el-menu-item>
            </el-sub-menu>
          </el-menu>
        </el-scrollbar>

        <div class="aside-footer">
          <el-tooltip :content="navCollapsed ? '展开导航' : '收起导航'" placement="right">
            <button class="collapse-btn" type="button" @click="toggleNav">
              <el-icon size="16">
                <Expand v-if="navCollapsed" />
                <Fold v-else />
              </el-icon>
              <span v-show="!navCollapsed">收起导航</span>
            </button>
          </el-tooltip>
        </div>
      </el-aside>

      <el-container class="content-shell" direction="vertical">
        <el-header class="header">
          <div class="header-spacer" />
          <div class="header-right">
            <el-input
              v-model="searchKeyword"
              class="header-search"
              placeholder="搜索功能、页面"
              prefix-icon="Search"
              clearable
              @keyup.enter="handleSearch"
            />
            <el-badge :value="store.unreadNotificationCount" :hidden="store.unreadNotificationCount === 0" is-dot>
              <button class="icon-btn" type="button" @click="notificationDrawer = true">
                <el-icon size="18"><Bell /></el-icon>
              </button>
            </el-badge>
            <button class="icon-btn" type="button" @click="router.push('/system/roles')">
              <el-icon size="18"><Setting /></el-icon>
            </button>
            <el-dropdown trigger="click">
              <div class="user-info">
                <el-avatar :size="32" class="user-avatar">张</el-avatar>
                <span class="username">张斌</span>
                <span class="user-role">超级管理员</span>
                <el-icon class="user-arrow"><ArrowDown /></el-icon>
              </div>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item @click="router.push('/system/accounts')">账号管理</el-dropdown-item>
                  <el-dropdown-item @click="router.push('/system/roles')">角色权限</el-dropdown-item>
                  <el-dropdown-item @click="router.push('/portals')">三端入口</el-dropdown-item>
                  <el-dropdown-item @click="router.push('/enterprise/dashboard')">企业端</el-dropdown-item>
                  <el-dropdown-item @click="router.push('/miniapp/workbench')">灵工小程序</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
        </el-header>

        <el-main class="main">
          <div v-if="breadcrumbs.length && route.path !== '/dashboard'" class="page-breadcrumb">
            <el-breadcrumb separator="/">
              <el-breadcrumb-item v-for="(crumb, i) in breadcrumbs" :key="i">
                {{ crumb }}
              </el-breadcrumb-item>
            </el-breadcrumb>
          </div>
          <RouterView />
        </el-main>
      </el-container>
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
.platform-layout {
  --app-primary: #2563eb;
  --app-primary-light: #eff6ff;
  --app-primary-dark: #1d4ed8;
  --app-bg: #f5f6fa;
  --app-border: #e8ebf0;
  --app-text: #1f2329;
  --app-text-secondary: #646a73;
  --el-color-primary: #2563eb;
  --el-color-primary-light-3: #6b9aef;
  --el-color-primary-light-5: #93b4f5;
  --el-color-primary-light-7: #b9cefa;
  --el-color-primary-light-8: #d1e0fc;
  --el-color-primary-light-9: #eff6ff;
  --el-color-primary-dark-2: #1d4ed8;

  height: 100vh;
  background: var(--app-bg);
}

.body-container {
  flex: 1;
  min-height: 0;
  height: 100%;
}

.content-shell {
  flex: 1;
  min-width: 0;
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

.aside-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 64px;
  padding: 0 16px;
  border-bottom: 1px solid var(--app-border);
  cursor: pointer;
  flex-shrink: 0;
}

.aside.collapsed .aside-brand {
  justify-content: center;
  padding: 0;
}

.brand-mark {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: linear-gradient(135deg, #2563eb 0%, #3b82f6 100%);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.28);
}

.brand-mark svg {
  width: 18px;
  height: 18px;
}

.brand-text {
  min-width: 0;
}

.brand-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--app-text);
  line-height: 1.2;
}

.brand-sub {
  margin-top: 2px;
  font-size: 12px;
  color: #94a3b8;
}

.header {
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  height: 64px;
  padding: 0 24px;
  border-bottom: 1px solid var(--app-border);
  flex-shrink: 0;
}

.header-spacer {
  flex: 1;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.header-search {
  width: 260px;
}

.header-search :deep(.el-input__wrapper) {
  border-radius: 999px;
  background: #f5f6fa;
  box-shadow: none;
  border: 1px solid transparent;
}

.header-search :deep(.el-input__wrapper.is-focus) {
  background: #fff;
  border-color: #bfdbfe;
}

.icon-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: #64748b;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}

.icon-btn:hover {
  background: var(--app-primary-light);
  color: var(--app-primary);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  padding: 4px 8px 4px 4px;
  border-radius: 999px;
}

.user-info:hover {
  background: #f8fbff;
}

.user-avatar {
  background: linear-gradient(135deg, #2563eb, #3b82f6);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
}

.username {
  font-size: 14px;
  font-weight: 600;
  color: var(--app-text);
}

.user-role {
  font-size: 11px;
  font-weight: 600;
  color: #16a34a;
  background: #ecfdf5;
  border-radius: 999px;
  padding: 2px 8px;
}

.user-arrow {
  color: #94a3b8;
  font-size: 12px;
}

.menu-scroll {
  flex: 1;
  min-height: 0;
}

.side-menu {
  border-right: none;
  --el-menu-active-color: #2563eb;
  --el-menu-hover-bg-color: #f8fafc;
  --el-menu-bg-color: transparent;
  --el-menu-text-color: #475569;
  background: transparent;
  padding: 8px;
}

.side-menu:not(.el-menu--collapse) {
  width: 248px;
}

.aside.collapsed .side-menu {
  width: 72px;
}

.side-menu :deep(.el-menu-item),
.side-menu :deep(.el-sub-menu__title) {
  height: 42px;
  line-height: 42px;
  border-radius: 10px;
  margin-bottom: 2px;
}

.side-menu :deep(.el-menu-item.is-active) {
  color: #2563eb;
  background: linear-gradient(90deg, #eff6ff 0%, #f8fbff 100%);
  font-weight: 600;
  box-shadow: inset 3px 0 0 #2563eb;
}

.side-menu :deep(.el-sub-menu.is-active > .el-sub-menu__title) {
  color: #2563eb;
}

.side-menu :deep(.el-menu-item .menu-icon),
.side-menu :deep(.el-sub-menu__title .menu-icon) {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: #f1f5f9;
  color: #64748b;
  margin-right: 10px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 15px;
  transition: all 0.15s ease;
}

.side-menu :deep(.el-menu-item.is-active .menu-icon) {
  color: #2563eb;
  background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
  box-shadow: inset 0 0 0 1px rgba(37, 99, 235, 0.12);
}

.side-menu :deep(.menu-icon--sub) {
  width: 24px;
  height: 24px;
  font-size: 14px;
  margin-right: 8px;
}

.side-menu :deep(.el-sub-menu .el-menu-item) {
  padding-left: 44px !important;
}

.menu-item-title {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}

.menu-badge :deep(.el-badge__content) {
  border: none;
}

.aside-footer {
  flex-shrink: 0;
  border-top: 1px solid var(--app-border);
  padding: 8px 10px 10px;
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
  border-radius: 8px;
  background: #f8fafc;
  color: #64748b;
  cursor: pointer;
  font-size: 12px;
  transition: background 0.15s, color 0.15s;
}

.collapse-btn:hover {
  background: var(--app-primary-light);
  color: var(--app-primary);
}

.main {
  padding: 16px 24px 24px;
  overflow: auto;
  background: var(--app-bg);
  min-width: 0;
}

.page-breadcrumb {
  margin-bottom: 12px;
}

.page-breadcrumb :deep(.el-breadcrumb__inner),
.page-breadcrumb :deep(.el-breadcrumb__separator) {
  color: var(--app-text-secondary);
  font-weight: 400;
  font-size: 13px;
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
  border-radius: 10px;
  background: #f8fafc;
  cursor: pointer;
}

.notification-item.unread {
  background: #eff6ff;
}

.notification-title {
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
}

.notification-content {
  margin-top: 4px;
  font-size: 13px;
  color: #64748b;
}

.notification-time {
  margin-top: 6px;
  font-size: 12px;
  color: #94a3b8;
}
</style>

<style>
.platform-layout .el-menu--popup {
  --el-menu-active-color: #2563eb;
  --el-menu-hover-bg-color: #eff6ff;
}

.platform-layout .el-button--primary {
  --el-button-bg-color: #2563eb;
  --el-button-border-color: #2563eb;
  --el-button-hover-bg-color: #1d4ed8;
  --el-button-hover-border-color: #1d4ed8;
}

.platform-layout .page-card {
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
}
</style>
