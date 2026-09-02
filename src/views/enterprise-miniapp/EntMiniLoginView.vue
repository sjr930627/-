<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useEnterpriseMiniAuth } from '@/composables/useEnterpriseMiniAuth'
import { ENTERPRISE_MINI_DEMO_PASSWORD } from '@/constants/enterpriseMiniAuth'

const router = useRouter()
const route = useRoute()
const { login } = useEnterpriseMiniAuth()

const username = ref('sinopec_cy_admin')
const password = ref(ENTERPRISE_MINI_DEMO_PASSWORD)
const loading = ref(false)

async function handleLogin() {
  loading.value = true
  try {
    login(username.value, password.value)
    ElMessage.success('登录成功')
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : ''
    router.replace(
      redirect && redirect.startsWith('/enterprise-miniapp')
        ? redirect
        : '/enterprise-miniapp/recruitment',
    )
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '登录失败')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="auth-hero">
      <div class="auth-logo">企</div>
      <h1 class="auth-title">企业小程序</h1>
      <p class="auth-subtitle">招聘 · 排班 · 考勤管理</p>
    </div>

    <div class="auth-card">
      <h2 class="card-title">企业管理员登录</h2>
      <div class="field">
        <label>账号</label>
        <input v-model="username" type="text" placeholder="企业管理员账号">
      </div>
      <div class="field">
        <label>密码</label>
        <input v-model="password" type="password" placeholder="请输入密码">
      </div>
      <button class="mini-btn-primary submit-btn" type="button" :disabled="loading" @click="handleLogin">
        {{ loading ? '登录中…' : '登录' }}
      </button>
      <div class="demo-tip">
        演示：sinopec_cy_admin / {{ ENTERPRISE_MINI_DEMO_PASSWORD }}
        <br>
        或 jd_hb_admin / {{ ENTERPRISE_MINI_DEMO_PASSWORD }}
      </div>
      <button type="button" class="link-btn" @click="router.push('/portals')">返回门户</button>
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  min-height: 100%;
  background: #fff;
  padding: 48px 20px 24px;
}
.auth-hero {
  text-align: center;
  color: #111827;
  margin: -48px -20px 28px;
  padding: 48px 20px 28px;
  background: #D5E9FF;
}
.auth-logo {
  width: 64px;
  height: 64px;
  margin: 0 auto 12px;
  border-radius: 18px;
  background: #fff;
  color: #228BFF;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: 800;
  box-shadow: 0 2px 8px rgba(15, 23, 42, 0.06);
}
.auth-title {
  margin: 0;
  font-size: 26px;
  font-weight: 800;
}
.auth-subtitle {
  margin: 8px 0 0;
  opacity: 0.9;
  font-size: 13px;
}
.auth-card {
  background: #fff;
  border-radius: 18px;
  padding: 22px 18px;
  box-shadow: 0 8px 28px rgba(15, 23, 42, 0.08);
}
.card-title {
  margin: 0 0 16px;
  font-size: 18px;
}
.field {
  margin-bottom: 12px;
}
.field label {
  display: block;
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 6px;
}
.field input {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 12px;
  font-size: 15px;
}
.submit-btn {
  width: 100%;
  height: 44px;
  margin-top: 8px;
  border: none;
  border-radius: 12px;
  background: #228BFF;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
}
.demo-tip {
  margin-top: 14px;
  font-size: 12px;
  color: #9ca3af;
  line-height: 1.6;
}
.link-btn {
  margin-top: 12px;
  width: 100%;
  border: none;
  background: none;
  color: #228BFF;
  font-size: 13px;
}
</style>
