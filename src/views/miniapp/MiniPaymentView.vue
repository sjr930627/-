<script setup lang="ts">
import MiniNavBack from '@/components/miniapp/MiniNavBack.vue'
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'

const router = useRouter()
const { paymentBinding } = useMiniAppWorker()

const hasAlipay = computed(() => !!paymentBinding.value?.alipay)
const hasBank = computed(
  () => !!(paymentBinding.value?.bankName && paymentBinding.value?.bankCardLast4),
)

const alipayLabel = computed(() => paymentBinding.value?.alipay ?? '')
const bankLabel = computed(() => {
  const b = paymentBinding.value
  if (!b?.bankName || !b?.bankCardLast4) return ''
  return `${b.bankName}（****${b.bankCardLast4}）`
})
</script>

<template>
  <div class="pay-hub-page">
    <div class="mini-nav-bar">
      <MiniNavBack fallback="/miniapp/profile" />
      <div class="mini-nav-title">银行卡</div>
    </div>

    <div class="pay-hub-body">
      <div v-if="hasAlipay || hasBank" class="bound-list">
        <div v-if="hasAlipay" class="bound-card alipay">
          <div class="bound-label">支付宝</div>
          <div class="bound-value">{{ alipayLabel }}</div>
        </div>
        <div v-if="hasBank" class="bound-card bank">
          <div class="bound-label">银行卡</div>
          <div class="bound-value">{{ bankLabel }}</div>
        </div>
      </div>

      <button
        type="button"
        class="hub-action alipay-action"
        @click="router.push('/miniapp/payment/alipay')"
      >
        <span class="plus-icon">⊕</span>
        {{ hasAlipay ? '修改支付宝' : '绑定支付宝' }}
      </button>

      <button
        type="button"
        class="hub-action bank-action"
        @click="router.push('/miniapp/payment/bank')"
      >
        <span class="plus-icon">⊕</span>
        {{ hasBank ? '修改银行卡' : '绑定银行卡' }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.pay-hub-page {
  min-height: 100%;
  background: #f5f5f5;
}

.pay-hub-body {
  padding: 16px;
}

.bound-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-bottom: 16px;
}

.bound-card {
  background: #fff;
  border-radius: 10px;
  padding: 14px 16px;
}

.bound-label {
  font-size: 12px;
  color: #999;
}

.bound-value {
  margin-top: 4px;
  font-size: 15px;
  font-weight: 600;
  color: #333;
}

.hub-action {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  height: 52px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 500;
  cursor: pointer;
}

.hub-action + .hub-action {
  margin-top: 12px;
}

.plus-icon {
  font-size: 18px;
  line-height: 1;
}

.alipay-action {
  background: #1677ff;
  color: #fff;
}

.bank-action {
  background: #fff;
  color: #333;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.04);
}
</style>
