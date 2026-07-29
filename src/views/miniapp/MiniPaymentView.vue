<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'

const router = useRouter()
const store = useAppStore()
const { employeeId, paymentBinding } = useMiniAppWorker()

const alipayForm = ref(paymentBinding.value?.alipay ?? '')
const bankForm = ref({
  bankName: paymentBinding.value?.bankName ?? '',
  last4: paymentBinding.value?.bankCardLast4 ?? '',
})

function saveAlipay() {
  if (!alipayForm.value.trim()) {
    ElMessage.warning('请输入支付宝账号')
    return
  }
  store.bindWorkerPayment(employeeId.value, { alipay: alipayForm.value.trim() })
  ElMessage.success('支付宝绑定成功')
}

function saveBank() {
  if (!bankForm.value.bankName || !bankForm.value.last4) {
    ElMessage.warning('请填写完整银行卡信息')
    return
  }
  store.bindWorkerPayment(employeeId.value, {
    bankName: bankForm.value.bankName,
    bankCardLast4: bankForm.value.last4,
  })
  ElMessage.success('银行卡绑定成功')
}
</script>

<template>
  <div>
    <div class="mini-nav-bar">
      <button class="mini-nav-back" @click="router.back()">← 返回</button>
      <div class="mini-nav-title">收款绑定</div>
    </div>
    <div class="mini-page">
      <div class="mini-card">
        <div class="mini-card-title">支付宝</div>
        <input
          v-model="alipayForm"
          placeholder="手机号/邮箱"
          style="width: 100%; padding: 10px; border: 1px solid #eee; border-radius: 8px; font-size: 14px; box-sizing: border-box"
        >
        <button class="mini-btn-primary" style="margin-top: 12px" @click="saveAlipay">绑定支付宝</button>
      </div>
      <div class="mini-card">
        <div class="mini-card-title">银行卡</div>
        <input
          v-model="bankForm.bankName"
          placeholder="开户银行"
          style="width: 100%; padding: 10px; border: 1px solid #eee; border-radius: 8px; font-size: 14px; box-sizing: border-box; margin-bottom: 8px"
        >
        <input
          v-model="bankForm.last4"
          placeholder="卡号后四位"
          maxlength="4"
          style="width: 100%; padding: 10px; border: 1px solid #eee; border-radius: 8px; font-size: 14px; box-sizing: border-box"
        >
        <button class="mini-btn-primary" style="margin-top: 12px" @click="saveBank">绑定银行卡</button>
      </div>
    </div>
  </div>
</template>
