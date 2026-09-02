<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Location, User } from '@element-plus/icons-vue'
import EntMiniPageHeader from '@/components/enterprise-miniapp/EntMiniPageHeader.vue'
import { useAppStore } from '@/stores/app'
import { useEnterpriseMiniAuth } from '@/composables/useEnterpriseMiniAuth'

const router = useRouter()
const store = useAppStore()
const { session, displayName, enterpriseId, isAuthed, logout } = useEnterpriseMiniAuth()

const enterpriseName = computed(
  () => store.enterprises.find((e) => e.id === enterpriseId.value)?.name || '-',
)

function openLogin() {
  if (!isAuthed.value) router.push('/enterprise-miniapp/login')
}

function handleLogout() {
  logout()
  ElMessage.success('已退出')
  router.replace('/enterprise-miniapp/login')
}

function switchToWorkerMini() {
  router.push('/miniapp/workbench')
}
</script>

<template>
  <div class="page">
    <EntMiniPageHeader title="我的" />

    <button type="button" class="profile-card" @click="openLogin">
      <div class="avatar">
        <span v-if="isAuthed">{{ displayName.slice(0, 1) || '企' }}</span>
        <el-icon v-else :size="28" color="#9ca3af"><User /></el-icon>
      </div>
      <div class="info">
        <strong v-if="isAuthed">{{ displayName }}</strong>
        <strong v-else>请登录</strong>
        <p v-if="isAuthed">{{ enterpriseName }}</p>
      </div>
      <span class="chev">›</span>
    </button>

    <section v-if="isAuthed" class="card account">
      <div class="meta"><span>账号</span><strong>{{ session?.username }}</strong></div>
      <div class="meta"><span>端侧</span><strong>企业小程序</strong></div>
      <button type="button" class="logout" @click="handleLogout">退出登录</button>
    </section>

    <section class="menu card">
      <button type="button" class="row" @click="switchToWorkerMini">
        <span class="left"><el-icon><Location /></el-icon>切换到灵工小程序</span>
        <span class="chev">›</span>
      </button>
    </section>
  </div>
</template>

<style scoped>
.page {
  min-height: 100%;
  background: #fff;
}
.profile-card {
  margin: -8px 12px 0;
  width: calc(100% - 24px);
  border: none;
  background: #fff;
  border-radius: 14px;
  padding: 14px;
  display: flex;
  align-items: center;
  gap: 12px;
  box-shadow: 0 2px 12px rgba(15, 23, 42, 0.06);
  text-align: left;
}
.avatar {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: #f3f4f6;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #228BFF;
  font-size: 20px;
  font-weight: 700;
  flex-shrink: 0;
}
.info {
  flex: 1;
  min-width: 0;
}
.info strong {
  font-size: 16px;
  color: #111827;
}
.info p {
  margin: 4px 0 0;
  font-size: 12px;
  color: #9ca3af;
}
.chev {
  color: #d1d5db;
  font-size: 18px;
}
.card {
  margin: 12px;
  background: #fff;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.04);
}
.menu .row {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px;
  border: none;
  background: none;
  font-size: 14px;
  color: #111827;
  text-align: left;
}
.left {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
.left .el-icon {
  color: #6b7280;
}
.account {
  padding: 4px 14px 14px;
}
.meta {
  display: flex;
  justify-content: space-between;
  padding: 12px 0;
  font-size: 13px;
  border-bottom: 1px solid #f3f4f6;
}
.meta span {
  color: #9ca3af;
}
.logout {
  width: 100%;
  height: 40px;
  margin-top: 10px;
  border-radius: 10px;
  font-size: 14px;
  border: 1px solid #fecaca;
  background: #fff;
  color: #b91c1c;
}
</style>
