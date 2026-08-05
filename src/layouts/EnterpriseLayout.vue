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
      { path: '/enterprise/recruitment/requirements', title: '需求管理', icon: 'Document' },
      { path: '/enterprise/recruitment/calendar', title: '面试日程', icon: 'Calendar' },
    ],
  },
  {
    index: 'training',
    title: '培训与考核',
    icon: 'Reading',
    children: [
      { path: '/enterprise/training/materials', title: '培训资料', icon: 'FolderOpened' },
      { path: '/enterprise/training/courses', title: '课程管理', icon: 'Notebook' },
      { path: '/enterprise/training/exams', title: '考核管理', icon: 'EditPen' },
      { path: '/enterprise/training/progress', title: '学习进度', icon: 'TrendCharts' },
      { path: '/enterprise/training/exam-results', title: '考核结果', icon: 'DocumentChecked' },
    ],
  },
  {
    index: 'attendance',
    title: '人员考勤管理',
    icon: 'Avatar',
    children: [
      { path: '/enterprise/employees', title: '人员管理', icon: 'UserFilled' },
      { path: '/enterprise/attendance-groups', title: '考勤组管理', icon: 'Grid' },
      { path: '/enterprise/schedule-manage', title: '排班管理', icon: 'Notebook' },
      { path: '/enterprise/grab-shifts', title: '抢班管理', icon: 'Bell' },
      { path: '/enterprise/attendance-data', title: '考勤数据', icon: 'DataBoard' },
      { path: '/enterprise/attendance-exceptions', title: '考勤审批处理', icon: 'WarningFilled' },
      { path: '/enterprise/insurance', title: '保险管理', icon: 'FirstAidKit' },
    ],
  },
  {
    index: 'task',
    title: '任务管理',
    icon: 'List',
    children: [
      { path: '/enterprise/task/types', title: '任务类型管理', icon: 'Collection' },
      { path: '/enterprise/task/publish', title: '任务发布', icon: 'Promotion' },
      { path: '/enterprise/task/progress', title: '任务进度', icon: 'DataLine' },
    ],
  },
  {
    index: 'partnership',
    title: '合作管理',
    icon: 'Connection',
    children: [
      { path: '/enterprise/partnership', title: '服务商合作', icon: 'Link' },
    ],
  },
  {
    index: 'payroll',
    title: '财税管理',
    icon: 'Money',
    children: [
      { path: '/enterprise/payroll/bills', title: '账单确认', icon: 'DocumentCopy' },
      { path: '/enterprise/payroll/invoices', title: '发票管理', icon: 'Ticket' },
      { path: '/enterprise/payroll/billing-rules', title: '计薪规则', icon: 'Operation' },
    ],
  },
]

const settingsGroup: MenuGroup = {
  index: 'settings',
  title: '系统设置',
  icon: 'Setting',
  children: [
    { path: '/enterprise/system/accounts', title: '账号管理', icon: 'User' },
    { path: '/enterprise/system/roles', title: '角色权限', icon: 'Key' },
    { path: '/enterprise/system/oplog', title: '操作日志', icon: 'Document' },
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
  <el-container class="enterprise-layout">
    <el-header class="header">
      <div class="header-left">
        <div class="brand" @click="navigate('/enterprise/dashboard')">
          <div class="brand-mark">
            <svg viewBox="0 0 24 24" fill="none">
              <rect x="3" y="3" width="8" height="8" rx="2" fill="currentColor" opacity=".9" />
              <rect x="13" y="3" width="8" height="8" rx="2" fill="currentColor" opacity=".65" />
              <rect x="3" y="13" width="8" height="8" rx="2" fill="currentColor" opacity=".65" />
              <rect x="13" y="13" width="8" height="8" rx="2" fill="currentColor" opacity=".45" />
            </svg>
          </div>
          <span class="brand-title">灵工平台</span>
          <span class="brand-badge">企业端</span>
        </div>
        <div class="header-divider" />
        <div class="header-enterprise">
          <div class="header-enterprise-name">{{ store.currentEnterprise?.name ?? '当前企业' }}</div>
          <div class="header-enterprise-code">企业号：{{ store.currentEnterprise?.code ?? '-' }}</div>
        </div>
      </div>

      <div class="header-center">
        <el-input
          v-model="searchKeyword"
          class="header-search"
          placeholder="搜索功能、页面..."
          prefix-icon="Search"
          clearable
          @keyup.enter="handleSearch"
        />
      </div>

      <div class="header-right">
        <el-select
          :model-value="store.currentEnterpriseId"
          style="width: 220px"
          @change="store.setCurrentEnterprise"
        >
          <el-option
            v-for="ent in store.enterprises"
            :key="ent.id"
            :label="ent.name"
            :value="ent.id"
          />
        </el-select>
        <el-badge :value="store.unreadNotificationCount" :hidden="store.unreadNotificationCount === 0">
          <button class="icon-btn" type="button" @click="notificationDrawer = true">
            <el-icon size="18"><Bell /></el-icon>
          </button>
        </el-badge>
        <el-dropdown trigger="click">
          <div class="user-info">
            <el-avatar :size="32" class="user-avatar">张</el-avatar>
            <span v-show="!navCollapsed" class="username">张 管理</span>
            <el-icon class="user-arrow"><ArrowDown /></el-icon>
          </div>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item @click="router.push('/enterprise/system/accounts')">账号管理</el-dropdown-item>
              <el-dropdown-item @click="router.push('/enterprise/system/roles')">角色权限</el-dropdown-item>
              <el-dropdown-item @click="router.push('/portals')">三端入口</el-dropdown-item>
              <el-dropdown-item @click="router.push('/dashboard')">运营后台</el-dropdown-item>
              <el-dropdown-item @click="router.push('/miniapp/workbench')">灵工小程序</el-dropdown-item>
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
            <el-menu-item index="/enterprise/dashboard">
              <el-icon class="menu-icon"><Odometer /></el-icon>
              <template #title>工作台</template>
            </el-menu-item>

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
                      v-if="child.path === '/enterprise/attendance-exceptions' && store.pendingAttendanceApprovalCount > 0"
                      :value="store.pendingAttendanceApprovalCount"
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

      <el-main class="main">
        <div v-if="breadcrumbs.length" class="page-breadcrumb">
          <el-breadcrumb separator="/">
            <el-breadcrumb-item v-for="(crumb, i) in breadcrumbs" :key="i">
              {{ crumb }}
            </el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        <RouterView :key="store.currentEnterpriseId" />
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
.enterprise-layout {
  --app-primary: #5b4fdb;
  --app-primary-light: #ede9fe;
  --app-primary-dark: #4f46e5;
  --app-bg: #f5f6fa;
  --app-border: #e8ebf0;
  --app-text: #1f2329;
  --app-text-secondary: #646a73;
  --el-color-primary: #5b4fdb;
  --el-color-primary-light-3: #8b83e8;
  --el-color-primary-light-5: #a9a3ef;
  --el-color-primary-light-7: #c7c3f5;
  --el-color-primary-light-8: #d9d6f8;
  --el-color-primary-light-9: #ede9fe;
  --el-color-primary-dark-2: #4f46e5;

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
  flex-shrink: 0;
  z-index: 10;
}

.header-left,
.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
}

.header-center {
  flex: 1.4;
  display: flex;
  justify-content: center;
  max-width: 420px;
}

.header-right {
  justify-content: flex-end;
}

.brand {
  display: flex;
  align-items: center;
  gap: 10px;
  cursor: pointer;
  user-select: none;
}

.brand-mark {
  width: 34px;
  height: 34px;
  border-radius: 10px;
  background: linear-gradient(135deg, #5b4fdb 0%, #7c6df0 100%);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 12px rgba(91, 79, 219, 0.28);
}

.brand-mark svg {
  width: 20px;
  height: 20px;
}

.brand-title {
  font-size: 16px;
  font-weight: 700;
  color: var(--app-text);
}

.brand-badge {
  font-size: 11px;
  font-weight: 600;
  color: #5b4fdb;
  background: #ede9fe;
  border-radius: 999px;
  padding: 2px 8px;
}

.header-divider {
  width: 1px;
  height: 28px;
  background: var(--app-border);
  flex-shrink: 0;
}

.header-enterprise {
  min-width: 0;
}

.header-enterprise-name {
  font-size: 14px;
  font-weight: 600;
  color: var(--app-text);
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 240px;
}

.header-enterprise-code {
  font-size: 12px;
  color: var(--app-text-secondary);
  margin-top: 2px;
  line-height: 1.2;
}

.header-search {
  width: 100%;
}

.header-search :deep(.el-input__wrapper) {
  border-radius: 999px;
  background: #f5f6fa;
  box-shadow: none;
  border: 1px solid transparent;
}

.header-search :deep(.el-input__wrapper.is-focus) {
  background: #fff;
  border-color: #c7c3f5;
}

.icon-btn {
  width: 36px;
  height: 36px;
  border: none;
  border-radius: 10px;
  background: #f5f6fa;
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
  padding: 4px 10px 4px 4px;
  border-radius: 999px;
  border: 1px solid var(--app-border);
  background: #fff;
}

.user-info:hover {
  border-color: #c7c3f5;
  background: #fafaff;
}

.user-avatar {
  background: linear-gradient(135deg, #5b4fdb, #7c6df0);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
}

.username {
  font-size: 14px;
  font-weight: 500;
  color: var(--app-text);
}

.user-arrow {
  color: #94a3b8;
  font-size: 12px;
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
  --el-menu-active-color: #5b4fdb;
  --el-menu-hover-bg-color: #f8fafc;
  --el-menu-bg-color: transparent;
  --el-menu-text-color: #475569;
  background: transparent;
  padding: 4px 8px;
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
  color: #5b4fdb;
  background: linear-gradient(90deg, #ede9fe 0%, #f5f3ff 100%);
  font-weight: 600;
  box-shadow: inset 3px 0 0 #5b4fdb;
}

.side-menu :deep(.el-sub-menu.is-active > .el-sub-menu__title) {
  color: #5b4fdb;
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
  color: #5b4fdb;
  background: linear-gradient(135deg, #ede9fe 0%, #e0e7ff 100%);
  box-shadow: inset 0 0 0 1px rgba(91, 79, 219, 0.12);
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
  padding: 12px 20px 20px;
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
  border-radius: 8px;
  border: 1px solid var(--app-border);
  cursor: pointer;
  background: #fff;
}

.notification-item.unread {
  background: var(--app-primary-light);
  border-color: #ddd6fe;
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
.enterprise-layout .el-menu--popup {
  --el-menu-active-color: #5b4fdb;
  --el-menu-hover-bg-color: #ede9fe;
}

.enterprise-layout .el-button--primary {
  --el-button-bg-color: #5b4fdb;
  --el-button-border-color: #5b4fdb;
  --el-button-hover-bg-color: #4f46e5;
  --el-button-hover-border-color: #4f46e5;
}

.enterprise-layout .page-card {
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
}
</style>
