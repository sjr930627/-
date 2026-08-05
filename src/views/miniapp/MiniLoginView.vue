<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useMiniAppAuth } from '@/composables/useMiniAppAuth'
import { MINIAPP_DEMO_PASSWORD } from '@/constants/miniappAuth'

const router = useRouter()
const route = useRoute()
const { login } = useMiniAppAuth()

const phone = ref('13800001001')
const password = ref(MINIAPP_DEMO_PASSWORD)
const loading = ref(false)

async function handleLogin() {
  loading.value = true
  try {
    const session = login(phone.value, password.value)
    ElMessage.success('登录成功')
    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : ''
    if (!session.onboardingComplete) {
      router.replace('/miniapp/onboarding')
      return
    }
    router.replace(redirect && redirect.startsWith('/miniapp') ? redirect : '/miniapp/workbench')
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
      <div class="auth-logo">灵</div>
      <h1 class="auth-title">灵工平台</h1>
      <p class="auth-subtitle">灵活用工 · 随时上岗</p>
    </div>

    <div class="auth-card">
      <h2 class="card-title">登录</h2>
      <div class="field">
        <label>手机号</label>
        <input v-model="phone" type="tel" maxlength="11" placeholder="请输入手机号">
      </div>
      <div class="field">
        <label>密码</label>
        <input v-model="password" type="password" placeholder="请输入密码">
      </div>
      <button class="mini-btn-primary submit-btn" type="button" :disabled="loading" @click="handleLogin">
        {{ loading ? '登录中…' : '登录' }}
      </button>
      <div class="auth-footer">
        还没有账号？
        <button type="button" class="link-btn" @click="router.push('/miniapp/register')">立即注册</button>
      </div>
      <div class="demo-tip">
        演示账号：13800001001 / {{ MINIAPP_DEMO_PASSWORD }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  min-height: 100%;
  background: linear-gradient(180deg, #3b82f6 0%, #eff6ff 42%, #f5f6f8 100%);
  padding: 48px 20px 24px;
}

.auth-hero {
  text-align: center;
  color: #fff;
  margin-bottom: 28px;
}

.auth-logo {
  width: 64px;
  height: 64px;
  margin: 0 auto 12px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  font-weight: 800;
}

.auth-title {
  margin: 0;
  font-size: 26px;
  font-weight: 800;
}

.auth-subtitle {
  margin: 8px 0 0;
  font-size: 14px;
  opacity: 0.9;
}

.auth-card {
  background: #fff;
  border-radius: 20px;
  padding: 24px 20px;
  box-shadow: 0 8px 32px rgba(59, 130, 246, 0.12);
}

.card-title {
  margin: 0 0 20px;
  font-size: 20px;
  font-weight: 700;
  color: #1f2937;
}

.field {
  margin-bottom: 16px;
}

.field label {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  color: #64748b;
}

.field input {
  width: 100%;
  box-sizing: border-box;
  padding: 12px 14px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  font-size: 15px;
}

.submit-btn {
  width: 100%;
  margin-top: 8px;
}

.auth-footer {
  margin-top: 18px;
  text-align: center;
  font-size: 14px;
  color: #64748b;
}

.link-btn {
  border: none;
  background: none;
  color: #3b82f6;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
}

.demo-tip {
  margin-top: 16px;
  padding: 10px 12px;
  border-radius: 10px;
  background: #f8fafc;
  font-size: 12px;
  color: #64748b;
  text-align: center;
}
</style>
