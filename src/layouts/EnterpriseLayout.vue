<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'

const route = useRoute()
const router = useRouter()
const store = useAppStore()
const collapsed = ref(false)

const menuItems = [
  { path: '/enterprise/task-types', title: '任务类型管理', icon: 'Collection' },
  { path: '/enterprise/task-publish', title: '任务发布', icon: 'Promotion' },
  { path: '/enterprise/task-acceptance', title: '任务验收', icon: 'CircleCheck' },
  { path: '/enterprise/task-progress', title: '任务进度', icon: 'DataLine' },
]

const activeMenu = computed(() => route.path)

const pendingAcceptance = computed(() => {
  return store.taskInstances.filter((i) => {
    if (i.enterpriseName !== store.currentEnterprise?.name) return false
    const task = store.tasks.find((t) => t.id === i.taskId)
    if (!task) return false
    const wf = store.taskWorkflows.find((w) => w.id === task.workflowId)
    if (!wf) return false
    const reviewNode = wf.nodes.find(
      (n) => n.role === 'enterprise' && n.actions.some((a) => a.action === 'approve'),
    )
    return reviewNode && i.currentNodeId === reviewNode.id
  }).length
})

function navigate(path: string) {
  router.push(path)
}

function switchEnterprise(id: string) {
  store.setCurrentEnterprise(id)
}
</script>

<template>
  <el-container class="layout">
    <el-aside :width="collapsed ? '64px' : '220px'" class="aside">
      <div class="logo">
        <el-icon size="22"><OfficeBuilding /></el-icon>
        <span v-show="!collapsed">企业任务中心</span>
      </div>
      <el-menu
        :default-active="activeMenu"
        :collapse="collapsed"
        background-color="#002766"
        text-color="#ffffffa6"
        active-text-color="#fff"
        class="menu"
      >
        <el-menu-item
          v-for="item in menuItems"
          :key="item.path"
          :index="item.path"
          @click="navigate(item.path)"
        >
          <el-icon><component :is="item.icon" /></el-icon>
          <span>{{ item.title }}</span>
          <el-badge
            v-if="item.path.includes('acceptance') && pendingAcceptance > 0"
            :value="pendingAcceptance"
            class="menu-badge"
          />
        </el-menu-item>
      </el-menu>
      <div v-show="!collapsed" class="aside-footer">
        <el-button text class="switch-link" @click="router.push('/dashboard')">
          <el-icon><Back /></el-icon>
          返回运营后台
        </el-button>
      </div>
    </el-aside>

    <el-container>
      <el-header class="header">
        <div class="header-left">
          <el-button text @click="collapsed = !collapsed">
            <el-icon size="18"><Fold v-if="!collapsed" /><Expand v-else /></el-icon>
          </el-button>
          <span class="breadcrumb">{{ route.meta.title }}</span>
          <el-tag type="info" size="small">企业B端演示</el-tag>
        </div>
        <div class="header-right">
          <el-select
            :model-value="store.currentEnterpriseId"
            style="width: 220px"
            @change="switchEnterprise"
          >
            <el-option
              v-for="ent in store.enterprises"
              :key="ent.id"
              :label="ent.name"
              :value="ent.id"
            />
          </el-select>
          <el-avatar size="small">{{ store.currentEnterprise?.contact?.[0] ?? '企' }}</el-avatar>
          <span class="username">{{ store.currentEnterprise?.contact }}</span>
        </div>
      </el-header>

      <el-main class="main">
        <RouterView :key="store.currentEnterpriseId" />
      </el-main>
    </el-container>
  </el-container>
</template>

<style scoped>
.layout {
  height: 100vh;
}

.aside {
  background: #002766;
  transition: width 0.2s;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.logo {
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  border-bottom: 1px solid #ffffff14;
  flex-shrink: 0;
}

.menu {
  border-right: none;
  flex: 1;
}

.menu-badge {
  margin-left: 8px;
}

.aside-footer {
  padding: 12px;
  border-top: 1px solid #ffffff14;
}

.switch-link {
  color: #ffffffa6 !important;
  width: 100%;
  justify-content: flex-start;
}

.header {
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  height: 56px;
  padding: 0 16px;
}

.header-left,
.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
}

.breadcrumb {
  font-size: 15px;
  font-weight: 500;
}

.username {
  font-size: 14px;
  color: #606266;
}

.main {
  padding: 16px;
  overflow: auto;
  background: #f0f5ff;
}
</style>
