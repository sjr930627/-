<script setup lang="ts">
import MiniNavBack from '@/components/miniapp/MiniNavBack.vue'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'

const router = useRouter()
const store = useAppStore()
const { employeeId, employee, paymentBinding } = useMiniAppWorker()

const tipVisible = ref(true)
const alipay = ref(paymentBinding.value?.alipay ?? '')
const workerName = computed(() => employee.value?.name ?? '本人')
const isEdit = computed(() => !!paymentBinding.value?.alipay)

const canSubmit = computed(() => alipay.value.trim().length > 0)

function submit() {
  if (!canSubmit.value) {
    ElMessage.warning('请输入支付宝账号')
    return
  }
  const editing = isEdit.value
  store.bindWorkerPayment(employeeId.value, { alipay: alipay.value.trim() })
  ElMessage.success(editing ? '支付宝修改成功' : '支付宝添加成功')
  router.replace('/miniapp/payment')
}
</script>

<template>
  <div class="alipay-page">
    <div class="mini-nav-bar">
      <MiniNavBack fallback="/miniapp/payment" />
      <div class="mini-nav-title">{{ isEdit ? '修改支付宝' : '添加支付宝' }}</div>
    </div>

    <div v-if="tipVisible" class="notice-banner">
      <span class="notice-icon">📢</span>
      <p class="notice-text">
        为了您的收入安全和打款能够顺利到账，请确保添加实名信息一致的支付宝账号
      </p>
      <button type="button" class="notice-close" aria-label="关闭" @click="tipVisible = false">
        ×
      </button>
    </div>

    <div class="form-card">
      <div class="form-row">
        <span class="form-label">姓名</span>
        <span class="form-value">{{ workerName }}</span>
      </div>
      <div class="form-row">
        <span class="form-label">支付宝</span>
        <input
          v-model="alipay"
          class="form-input"
          type="text"
          placeholder="请输入支付宝账号"
          autocomplete="off"
        >
      </div>
    </div>

    <div class="guide-section">
      <div class="guide-title">如何查看支付宝账号？</div>

      <div class="guide-step">
        <p class="guide-text">
          1. 打开【支付宝APP】在【我的】页面中点击“个人信息”区域
        </p>
        <div class="guide-mock mock-profile" aria-hidden="true">
          <div class="mock-avatar" />
          <div class="mock-lines">
            <span class="mock-line long" />
            <span class="mock-line short" />
          </div>
          <span class="mock-finger">👆</span>
        </div>
      </div>

      <div class="guide-step reverse">
        <div class="guide-mock mock-list" aria-hidden="true">
          <div class="mock-list-row">
            <span>支付宝账号</span>
            <span class="mock-muted">138****8821 ›</span>
          </div>
          <div class="mock-list-row muted">
            <span>手机号</span>
            <span>已绑定 ›</span>
          </div>
          <span class="mock-finger">👆</span>
        </div>
        <p class="guide-text">
          2. 在【个人信息】页面中点击“支付宝账号”查看即可
        </p>
      </div>
    </div>

    <div class="footer-bar">
      <button
        type="button"
        class="submit-btn"
        :disabled="!canSubmit"
        @click="submit"
      >
        确认
      </button>
    </div>
  </div>
</template>

<style scoped>
.alipay-page {
  min-height: 100%;
  background: #fff;
  padding-bottom: calc(88px + env(safe-area-inset-bottom, 0px));
}

.notice-banner {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  margin: 0;
  padding: 12px 14px;
  background: #fff7ed;
  color: #9a3412;
}

.notice-icon {
  flex-shrink: 0;
  font-size: 14px;
  line-height: 1.5;
}

.notice-text {
  flex: 1;
  margin: 0;
  font-size: 13px;
  line-height: 1.5;
}

.notice-close {
  border: none;
  background: none;
  color: #c2410c;
  font-size: 20px;
  line-height: 1;
  padding: 0 2px;
  cursor: pointer;
}

.form-card {
  background: #fff;
  border-bottom: 8px solid #f5f5f5;
}

.form-row {
  display: flex;
  align-items: center;
  gap: 16px;
  min-height: 52px;
  padding: 0 16px;
  border-bottom: 1px solid #f0f0f0;
}

.form-row:last-child {
  border-bottom: none;
}

.form-label {
  width: 56px;
  flex-shrink: 0;
  font-size: 15px;
  color: #333;
}

.form-value {
  flex: 1;
  font-size: 15px;
  color: #666;
}

.form-input {
  flex: 1;
  border: none;
  outline: none;
  background: transparent;
  font-size: 15px;
  color: #333;
  min-width: 0;
}

.form-input::placeholder {
  color: #c0c4cc;
}

.guide-section {
  padding: 20px 16px 8px;
}

.guide-title {
  font-size: 14px;
  color: #999;
  margin-bottom: 16px;
}

.guide-step {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 20px;
}

.guide-step.reverse {
  flex-direction: row;
}

.guide-text {
  flex: 1;
  margin: 0;
  font-size: 13px;
  line-height: 1.55;
  color: #666;
}

.guide-mock {
  position: relative;
  flex-shrink: 0;
  width: 112px;
  border-radius: 10px;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  overflow: hidden;
}

.mock-profile {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 14px 10px;
  min-height: 72px;
}

.mock-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: linear-gradient(135deg, #93c5fd, #60a5fa);
}

.mock-lines {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.mock-line {
  display: block;
  height: 6px;
  border-radius: 3px;
  background: #d1d5db;
}

.mock-line.long {
  width: 48px;
}

.mock-line.short {
  width: 28px;
}

.mock-list {
  padding: 8px 0;
  min-height: 72px;
}

.mock-list-row {
  display: flex;
  justify-content: space-between;
  gap: 4px;
  padding: 8px 10px;
  font-size: 10px;
  color: #333;
  background: #fff;
}

.mock-list-row.muted {
  color: #9ca3af;
  background: transparent;
}

.mock-muted {
  color: #9ca3af;
}

.mock-finger {
  position: absolute;
  right: 6px;
  bottom: 4px;
  font-size: 14px;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.15));
}

.footer-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom, 0px));
  background: #fff;
  box-shadow: 0 -1px 0 #f0f0f0;
}

.submit-btn {
  width: 100%;
  height: 48px;
  border: none;
  border-radius: 10px;
  background: var(--mini-primary, #4fd1c5);
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
}

.submit-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
