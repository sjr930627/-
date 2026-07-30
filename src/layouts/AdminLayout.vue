<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import EnterpriseNavIcon from '@/components/layout/EnterpriseNavIcon.vue'

const STORAGE_KEY = 'layout:nav-collapsed'

const route = useRoute()
const router = useRouter()
const store = useAppStore()
const navCollapsed = ref(localStorage.getItem(STORAGE_KEY) === '1')
const searchKeyword = ref('')
const notificationDrawer = ref(false)

interface NavItem {
  path: string
  title: string
  icon: string
}

interface NavGroup {
  title: string
  items: NavItem[]
}

const navGroups: NavGroup[] = [
  {
    title: '招聘管理',
    items: [
      { path: '/recruitment/requirements', title: '需求管理', icon: 'requirements' },
      { path: '/recruitment/progress', title: '招聘进度看板', icon: 'progress' },
    ],
  },
  {
    title: '人员考勤管理',
    items: [
      { path: '/employees', title: '人员管理', icon: 'personnel' },
      { path: '/contracts', title: '合同管理', icon: 'contract' },
      { path: '/attendance-groups', title: '考勤规则', icon: 'attendance-rule' },
      { path: '/schedule-manage', title: '排班管理', icon: 'schedule' },
      { path: '/attendance-data', title: '考勤记录', icon: 'attendance-record' },
      { path: '/insurance', title: '保险管理', icon: 'insurance' },
    ],
  },
  {
    title: '任务管理',
    items: [
      { path: '/task-manage', title: '任务管理', icon: 'task' },
      { path: '/task-workflows', title: '任务模板', icon: 'task-template' },
    ],
  },
  {
    title: '财税管理',
    items: [
      { path: '/payroll/bills', title: '账单管理', icon: 'bill' },
      { path: '/payroll/settlement', title: '结算管理', icon: 'settlement' },
      { path: '/payroll/billing-rules', title: '计薪规则', icon: 'payroll-rule' },
      { path: '/payroll/invoices', title: '发票管理', icon: 'invoice' },
    ],
  },
]


const activeMenu = computed(() => route.path)
const asideWidth = computed(() => (navCollapsed.value ? '72px' : '248px'))

const breadcrumbs = computed(() => {
  const crumbs: string[] = []
  if (route.meta.group) crumbs.push(route.meta.group as string)
  if (route.meta.title) crumbs.push(route.meta.title as string)
  return crumbs
})

function isActive(path: string) {
  return activeMenu.value === path || activeMenu.value.startsWith(`${path}/`)
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
  <el-container class="enterprise-layout">
    <el-header class="header">
      <div class="header-left">
        <div class="brand" @click="navigate('/dashboard')">
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
              <el-dropdown-item @click="router.push('/dashboard')">工作台</el-dropdown-item>
              <el-dropdown-item @click="router.push('/training/courses')">培训考核</el-dropdown-item>
              <el-dropdown-item @click="router.push('/statistics/overview')">数据统计</el-dropdown-item>
              <el-dropdown-item @click="router.push('/partnership')">服务商合作</el-dropdown-item>
              <el-dropdown-item divided @click="router.push('/system/accounts')">账号管理</el-dropdown-item>
              <el-dropdown-item @click="router.push('/system/roles')">角色权限</el-dropdown-item>
              <el-dropdown-item @click="router.push('/approvals')">审批中心</el-dropdown-item>
              <el-dropdown-item divided @click="router.push('/miniapp/workbench')">灵工小程序</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
      </div>
    </el-header>

    <el-container class="body-container">
      <el-aside :width="asideWidth" class="aside" :class="{ collapsed: navCollapsed }">
        <div v-show="!navCollapsed" class="enterprise-card">
          <div class="enterprise-icon">
            <svg viewBox="0 0 24 24" fill="none">
              <path d="M4 20V8l8-4 8 4v12" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
              <path d="M9 20v-6h6v6" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
            </svg>
          </div>
          <div class="enterprise-meta">
            <div class="enterprise-name">星辰通信集团</div>
            <div class="enterprise-id">企业ID：ENT-20260315-001</div>
          </div>
        </div>

        <el-scrollbar class="menu-scroll">
          <nav class="side-nav">
            <section v-for="group in navGroups" :key="group.title" class="nav-group">
              <div v-show="!navCollapsed" class="nav-group-title">{{ group.title }}</div>
              <el-tooltip
                v-for="item in group.items"
                :key="item.path"
                :content="item.title"
                placement="right"
                :disabled="!navCollapsed"
              >
                <button
                  type="button"
                  class="nav-item"
                  :class="{ active: isActive(item.path) }"
                  @click="navigate(item.path)"
                >
                  <EnterpriseNavIcon :name="item.icon" :active="isActive(item.path)" />
                  <span v-show="!navCollapsed" class="nav-label">{{ item.title }}</span>
                </button>
              </el-tooltip>
            </section>
          </nav>
        </el-scrollbar>

        <div class="aside-footer">
          <el-tooltip content="帮助中心" placement="right" :disabled="!navCollapsed">
            <button type="button" class="nav-item help-item" @click="navigate('/dashboard')">
              <EnterpriseNavIcon name="help" />
              <span v-show="!navCollapsed" class="nav-label">帮助中心</span>
            </button>
          </el-tooltip>
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

.enterprise-card {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 14px 12px 8px;
  padding: 12px;
  border-radius: 12px;
  background: linear-gradient(135deg, #fafaff 0%, #f3f0ff 100%);
  border: 1px solid #ebe8ff;
}

.enterprise-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  background: linear-gradient(135deg, #5b4fdb, #7c6df0);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.enterprise-icon svg {
  width: 18px;
  height: 18px;
}

.enterprise-name {
  font-size: 13px;
  font-weight: 700;
  color: var(--app-text);
  line-height: 1.3;
}

.enterprise-id {
  font-size: 11px;
  color: var(--app-text-secondary);
  margin-top: 2px;
}

.menu-scroll {
  flex: 1;
  min-height: 0;
}

.side-nav {
  padding: 4px 10px 12px;
}

.nav-group + .nav-group {
  margin-top: 8px;
}

.nav-group-title {
  padding: 8px 10px 6px;
  font-size: 11px;
  font-weight: 600;
  color: #94a3b8;
  letter-spacing: 0.02em;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 10px;
  margin-bottom: 2px;
  border: none;
  border-radius: 10px;
  background: transparent;
  color: #475569;
  font-size: 13px;
  cursor: pointer;
  text-align: left;
  transition: all 0.15s ease;
}

.nav-item:hover {
  background: #f8fafc;
  color: #334155;
}

.nav-item.active {
  background: linear-gradient(90deg, #ede9fe 0%, #f5f3ff 100%);
  color: #5b4fdb;
  font-weight: 600;
  box-shadow: inset 3px 0 0 #5b4fdb;
}

.nav-label {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.aside.collapsed .nav-item {
  justify-content: center;
  padding: 8px;
}

.aside.collapsed .enterprise-card {
  display: none;
}

.aside-footer {
  flex-shrink: 0;
  border-top: 1px solid var(--app-border);
  padding: 8px 10px 10px;
  background: #fff;
}

.help-item {
  margin-bottom: 6px;
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
