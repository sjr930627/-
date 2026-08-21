<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  Bell,
  OfficeBuilding,
  Grid,
  Location,
  QuestionFilled,
  User,
} from '@element-plus/icons-vue'
import EntMiniPageHeader from '@/components/enterprise-miniapp/EntMiniPageHeader.vue'
import { useAppStore } from '@/stores/app'
import { useEnterpriseMiniAuth } from '@/composables/useEnterpriseMiniAuth'

const router = useRouter()
const store = useAppStore()
const { session, displayName, enterpriseId, isAuthed, logout } = useEnterpriseMiniAuth()

const wechatNotify = ref(false)

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

function tip(msg: string) {
  ElMessage.info(msg)
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

    <section class="menu card">
      <button type="button" class="row" @click="tip('问题反馈（演示）')">
        <span class="left"><el-icon><QuestionFilled /></el-icon>问题反馈</span>
        <span class="chev">›</span>
      </button>
      <div class="row">
        <span class="left">
          <el-icon><Bell /></el-icon>微信通知
          <el-icon class="info-ico" :size="14" color="#93c5fd"><QuestionFilled /></el-icon>
        </span>
        <label class="switch">
          <input v-model="wechatNotify" type="checkbox">
          <i />
        </label>
      </div>
      <button type="button" class="row" @click="tip(`组织：${enterpriseName}`)">
        <span class="left"><el-icon><OfficeBuilding /></el-icon>组织与账号</span>
        <span class="chev">›</span>
      </button>
      <button type="button" class="row" @click="tip('设置（演示）')">
        <span class="left"><el-icon><Grid /></el-icon>设置</span>
        <span class="chev">›</span>
      </button>
      <button type="button" class="row" @click="router.push('/miniapp/workbench')">
        <span class="left"><el-icon><Location /></el-icon>切换到灵工打卡</span>
        <span class="chev">›</span>
      </button>
    </section>

    <section v-if="isAuthed" class="card links">
      <div class="meta"><span>账号</span><strong>{{ session?.username }}</strong></div>
      <div class="meta"><span>端侧</span><strong>企业小程序</strong></div>
      <button type="button" class="pc" @click="router.push('/enterprise/dashboard')">打开企业 PC 端</button>
      <button type="button" class="logout" @click="handleLogout">退出登录</button>
    </section>
  </div>
</template>

<style scoped>
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
  color: #5b4fdb;
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
  padding: 14px 14px;
  border: none;
  background: none;
  border-bottom: 1px solid #f3f4f6;
  font-size: 14px;
  color: #111827;
  text-align: left;
}
.menu .row:last-child {
  border-bottom: none;
}
.left {
  display: inline-flex;
  align-items: center;
  gap: 10px;
}
.left .el-icon {
  color: #6b7280;
}
.info-ico {
  margin-left: 2px;
}
.switch {
  position: relative;
  width: 44px;
  height: 26px;
}
.switch input {
  opacity: 0;
  width: 0;
  height: 0;
}
.switch i {
  position: absolute;
  inset: 0;
  background: #e5e7eb;
  border-radius: 999px;
  transition: 0.2s;
  font-style: normal;
}
.switch i::after {
  content: '';
  position: absolute;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #fff;
  top: 2px;
  left: 2px;
  transition: 0.2s;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.15);
}
.switch input:checked + i {
  background: #5b4fdb;
}
.switch input:checked + i::after {
  left: 20px;
}
.links {
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
.pc,
.logout {
  width: 100%;
  height: 40px;
  margin-top: 10px;
  border-radius: 10px;
  font-size: 14px;
}
.pc {
  border: 1px solid #5b4fdb;
  background: #fff;
  color: #5b4fdb;
}
.logout {
  border: 1px solid #fecaca;
  background: #fff;
  color: #b91c1c;
}
</style>
