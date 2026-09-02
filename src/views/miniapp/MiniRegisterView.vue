<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import MiniNavBack from '@/components/miniapp/MiniNavBack.vue'
import { useMiniAppAuth } from '@/composables/useMiniAppAuth'

const router = useRouter()
const { register } = useMiniAppAuth()

const name = ref('')
const phone = ref('')
const password = ref('')
const confirmPassword = ref('')
const agreed = ref(false)
const loading = ref(false)

async function handleRegister() {
  if (!name.value.trim()) {
    ElMessage.warning('请输入姓名')
    return
  }
  if (!/^1\d{10}$/.test(phone.value.trim())) {
    ElMessage.warning('请输入正确的手机号')
    return
  }
  if (password.value.length < 6) {
    ElMessage.warning('密码至少 6 位')
    return
  }
  if (password.value !== confirmPassword.value) {
    ElMessage.warning('两次密码不一致')
    return
  }
  if (!agreed.value) {
    ElMessage.warning('请先阅读并同意用户协议')
    return
  }

  loading.value = true
  try {
    register({
      phone: phone.value.trim(),
      password: password.value,
      name: name.value.trim(),
    })
    ElMessage.success('注册成功，请完善档案')
    router.replace('/miniapp/onboarding')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '注册失败')
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="auth-page">
    <div class="mini-nav-bar auth-nav">
      <MiniNavBack fallback="/miniapp/login" />
      <div class="mini-nav-title">注册账号</div>
    </div>

    <div class="auth-card">
      <div class="field">
        <label>姓名</label>
        <input v-model="name" placeholder="请输入真实姓名">
      </div>
      <div class="field">
        <label>手机号</label>
        <input v-model="phone" type="tel" maxlength="11" placeholder="用于登录和接收通知">
      </div>
      <div class="field">
        <label>设置密码</label>
        <input v-model="password" type="password" placeholder="至少 6 位">
      </div>
      <div class="field">
        <label>确认密码</label>
        <input v-model="confirmPassword" type="password" placeholder="再次输入密码">
      </div>
      <label class="agree-row">
        <input v-model="agreed" type="checkbox">
        <span>我已阅读并同意《灵工平台服务协议》和《隐私政策》</span>
      </label>
      <button class="mini-btn-primary submit-btn" type="button" :disabled="loading" @click="handleRegister">
        {{ loading ? '注册中…' : '注册并完善档案' }}
      </button>
      <div class="auth-footer">
        已有账号？
        <button type="button" class="link-btn" @click="router.push('/miniapp/login')">去登录</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.auth-page {
  min-height: 100%;
  background: #f5f6f8;
}

.auth-nav {
  background: #fff;
}

.auth-card {
  margin: 16px;
  background: #fff;
  border-radius: 16px;
  padding: 20px 16px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.04);
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

.agree-row {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  font-size: 12px;
  color: #64748b;
  line-height: 1.5;
  margin-bottom: 16px;
}

.submit-btn {
  width: 100%;
}

.auth-footer {
  margin-top: 16px;
  text-align: center;
  font-size: 14px;
  color: #64748b;
}

.link-btn {
  border: none;
  background: none;
  color: #4FD1C5;
  font-weight: 600;
  cursor: pointer;
}
</style>
