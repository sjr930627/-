<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { useEnterpriseMiniAuth } from '@/composables/useEnterpriseMiniAuth'

const router = useRouter()
const store = useAppStore()
const { session, displayName, enterpriseId, logout } = useEnterpriseMiniAuth()

const enterpriseName = computed(
  () => store.enterprises.find((e) => e.id === enterpriseId.value)?.name || '-',
)

function handleLogout() {
  logout()
  ElMessage.success('已退出')
  router.replace('/enterprise-miniapp/login')
}
</script>

<template>
  <div class="mini-page">
    <header class="hero">
      <div class="avatar">{{ displayName.slice(0, 1) || '企' }}</div>
      <div>
        <h1>{{ displayName || '企业管理员' }}</h1>
        <p>{{ session?.username }}</p>
      </div>
    </header>

    <section class="card">
      <div class="row"><span>所属企业</span><strong>{{ enterpriseName }}</strong></div>
      <div class="row"><span>端侧</span><strong>企业小程序</strong></div>
    </section>

    <section class="card links">
      <button type="button" @click="router.push('/enterprise-miniapp/recruitment')">招聘管理</button>
      <button type="button" @click="router.push('/enterprise-miniapp/schedule')">排班管理</button>
      <button type="button" @click="router.push('/enterprise/dashboard')">打开企业 PC 端</button>
      <button type="button" @click="router.push('/portals')">返回门户</button>
    </section>

    <button type="button" class="logout" @click="handleLogout">退出登录</button>
  </div>
</template>

<style scoped>
.hero {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 24px 16px 12px;
}
.avatar {
  width: 52px;
  height: 52px;
  border-radius: 16px;
  background: #5b4fdb;
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  font-weight: 700;
}
h1 {
  margin: 0;
  font-size: 18px;
}
.hero p {
  margin: 4px 0 0;
  font-size: 12px;
  color: #9ca3af;
}
.card {
  margin: 0 16px 12px;
  background: #fff;
  border-radius: 14px;
  padding: 4px 14px;
  box-shadow: var(--mini-shadow);
}
.row {
  display: flex;
  justify-content: space-between;
  padding: 12px 0;
  font-size: 13px;
  border-bottom: 1px solid #f3f4f6;
}
.row:last-child {
  border-bottom: none;
}
.row span {
  color: #9ca3af;
}
.links button {
  display: block;
  width: 100%;
  text-align: left;
  border: none;
  background: none;
  padding: 14px 0;
  font-size: 14px;
  color: #1f2937;
  border-bottom: 1px solid #f3f4f6;
  cursor: pointer;
}
.links button:last-child {
  border-bottom: none;
}
.logout {
  margin: 20px 16px 40px;
  width: calc(100% - 32px);
  height: 44px;
  border: 1px solid #fecaca;
  background: #fff;
  color: #b91c1c;
  border-radius: 12px;
}
</style>
