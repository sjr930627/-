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
const cardNumber = ref('')
const workerName = computed(() => employee.value?.name ?? '本人')
const isEdit = computed(
  () => !!(paymentBinding.value?.bankName && paymentBinding.value?.bankCardLast4),
)

const normalizedCard = computed(() => cardNumber.value.replace(/\s+/g, ''))

const canSubmit = computed(() => /^\d{12,19}$/.test(normalizedCard.value))

function formatCardInput(raw: string) {
  const digits = raw.replace(/\D/g, '').slice(0, 19)
  return digits.replace(/(\d{4})(?=\d)/g, '$1 ').trim()
}

function onCardInput(e: Event) {
  const target = e.target as HTMLInputElement
  cardNumber.value = formatCardInput(target.value)
}

function detectBankName(card: string): string {
  const prefix = card.slice(0, 6)
  const map: Record<string, string> = {
    '622202': '中国工商银行',
    '622848': '中国农业银行',
    '621700': '中国建设银行',
    '622588': '招商银行',
    '621483': '招商银行',
    '621785': '中国银行',
  }
  for (const [key, name] of Object.entries(map)) {
    if (card.startsWith(key) || prefix.startsWith(key.slice(0, 4))) return name
  }
  return '银行卡'
}

function mockScan() {
  ElMessage.info('演示环境：请手动输入卡号')
}

function submit() {
  if (!canSubmit.value) {
    ElMessage.warning('请输入有效的银行卡号')
    return
  }
  const editing = isEdit.value
  const card = normalizedCard.value
  store.bindWorkerPayment(employeeId.value, {
    bankName: detectBankName(card),
    bankCardLast4: card.slice(-4),
  })
  ElMessage.success(editing ? '银行卡修改成功' : '银行卡添加成功')
  router.replace('/miniapp/payment')
}
</script>

<template>
  <div class="bank-page">
    <div class="mini-nav-bar">
      <MiniNavBack fallback="/miniapp/payment" />
      <div class="mini-nav-title">{{ isEdit ? '修改银行卡' : '添加银行卡' }}</div>
    </div>

    <div v-if="tipVisible" class="notice-banner">
      <span class="notice-icon">📢</span>
      <p class="notice-text">
        为了您的收入安全和打款能够顺利到账，请确保添加实名信息一致的银行卡账号
      </p>
      <button type="button" class="notice-close" aria-label="关闭" @click="tipVisible = false">
        ×
      </button>
    </div>

    <div class="hint-row">
      <p class="hint-text">
        请添加 <strong>{{ workerName }}</strong> 的银行卡
      </p>
    </div>

    <div class="form-card">
      <div class="form-row">
        <span class="form-label">卡号</span>
        <input
          class="form-input"
          type="text"
          inputmode="numeric"
          :value="cardNumber"
          placeholder="请绑定持卡人本人的银行卡"
          autocomplete="off"
          @input="onCardInput"
        >
        <button type="button" class="scan-btn" aria-label="扫卡" @click="mockScan">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8">
            <path d="M4 8V6a2 2 0 0 1 2-2h2M16 4h2a2 2 0 0 1 2 2v2M20 16v2a2 2 0 0 1-2 2h-2M8 20H6a2 2 0 0 1-2-2v-2" />
            <circle cx="12" cy="12" r="3.2" />
          </svg>
        </button>
      </div>
    </div>

    <div class="action-wrap">
      <button
        type="button"
        class="submit-btn"
        :disabled="!canSubmit"
        @click="submit"
      >
        确认
      </button>
    </div>

    <div class="faq-section">
      <div class="faq-item">
        <div class="faq-q">为什么需要添加银行卡？</div>
        <div class="faq-a">平台将使用你填写的银行卡信息，用于企业结算后的收入发放。</div>
      </div>
      <div class="faq-item">
        <div class="faq-q">我们会如何使用？</div>
        <div class="faq-a">
          仅用于兼职收入发放、到账核验及必要的支付结算，不会用于贷款、营销或其他无关用途。
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.bank-page {
  min-height: 100%;
  background: #f7f7fb;
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

.hint-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 16px 10px;
  background: #fff;
}

.hint-text {
  margin: 0;
  font-size: 14px;
  color: #666;
}

.hint-text strong {
  color: #111;
  font-weight: 700;
}

.form-card {
  background: #fff;
  border-top: 1px solid #f0f0f0;
  border-bottom: 1px solid #f0f0f0;
}

.form-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 54px;
  padding: 0 16px;
}

.form-label {
  width: 40px;
  flex-shrink: 0;
  font-size: 15px;
  color: #333;
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

.scan-btn {
  flex-shrink: 0;
  border: none;
  background: none;
  color: #666;
  padding: 4px;
  cursor: pointer;
}

.action-wrap {
  padding: 20px 16px 8px;
  background: #fff;
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

.faq-section {
  padding: 20px 16px 32px;
}

.faq-item + .faq-item {
  margin-top: 18px;
}

.faq-q {
  font-size: 14px;
  font-weight: 600;
  color: #444;
  margin-bottom: 6px;
}

.faq-a {
  font-size: 13px;
  line-height: 1.6;
  color: #999;
}
</style>
