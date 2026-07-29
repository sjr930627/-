<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import { useMiniInsuranceStatus } from '@/composables/useMiniInsuranceStatus'
import { workerLevelColors } from '@/constants/miniapp'

const router = useRouter()
const store = useAppStore()
const { employee, department, profileExt, paymentBinding } = useMiniAppWorker()
const { statusLabel, isInsuredToday } = useMiniInsuranceStatus()

const incomeSummary = computed(() => {
  const empId = employee.value?.id ?? ''
  const records = store.workerIncomeRecords.filter((r) => r.employeeId === empId)
  const pending = store.pendingSettlements.find((p) => p.employeeId === empId)
  return {
    claimable: records.filter((r) => r.status === 'claimable').reduce((s, r) => s + r.amount, 0),
    pending: pending?.estimatedIncome ?? records.filter((r) => r.status === 'pending_settlement').reduce((s, r) => s + r.amount, 0),
    claimed: records.filter((r) => r.status === 'claimed').reduce((s, r) => s + (r.netAmount ?? r.amount), 0),
  }
})

/** 培训与考核标题下的全部入口（统一宫格） */
const iconItems = [
  { path: '/miniapp/training/materials', icon: '📚', label: '我的培训', bg: '#fff5f5' },
  { path: '/miniapp/training/exams', icon: '📝', label: '我的考核', bg: '#fff7e6' },
  { path: '/miniapp/income', icon: '💰', label: '我的收入', bg: '#fff7e6' },
  { path: '/miniapp/tasks', icon: '📋', label: '任务进度', bg: '#f0f7ff' },
  { path: '/miniapp/applications', icon: '📝', label: '我的报名', bg: '#fff1f0' },
  { path: '/miniapp/payment', icon: '💳', label: '收款绑定', bg: '#f9f0ff' },
  { path: '/miniapp/agreements', icon: '📄', label: '协议管理', bg: '#fafafa' },
  { path: '/miniapp/my-info', icon: '👤', label: '我的资料', bg: '#f0f7ff' },
  { path: '/miniapp/credit', icon: '⭐', label: '等级信用', bg: '#fffbe6' },
]
</script>

<template>
  <div class="mini-page profile-page">
    <div class="mini-card profile-card">
      <div class="profile-row">
        <div class="profile-avatar">{{ employee?.name?.slice(0, 1) ?? '灵' }}</div>
        <div class="profile-info">
          <div class="profile-name">{{ employee?.name ?? '-' }}</div>
          <div class="profile-sub">{{ department?.name }} · {{ employee?.employeeNo }}</div>
          <div v-if="profileExt" class="profile-tags">
            <span
              class="mini-tag"
              :style="{ background: (workerLevelColors[profileExt.level] ?? '#999') + '22', color: workerLevelColors[profileExt.level] }"
            >
              {{ profileExt.level }}
            </span>
            <span class="mini-tag green">信用 {{ profileExt.creditScore }}</span>
            <span
              class="mini-tag insurance-status"
              :class="isInsuredToday ? 'insured' : 'uninsured'"
              @click.stop="router.push('/miniapp/insurance')"
            >
              {{ statusLabel }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <div class="mini-card income-card" @click="router.push('/miniapp/income')">
      <div class="income-brief">
        <div class="brief-item">
          <span class="brief-value">¥{{ incomeSummary.pending.toLocaleString() }}</span>
          <span class="brief-label">待结算</span>
        </div>
        <div class="brief-item">
          <span class="brief-value highlight">¥{{ incomeSummary.claimable.toLocaleString() }}</span>
          <span class="brief-label">待领取</span>
        </div>
        <div class="brief-item">
          <span class="brief-value">¥{{ incomeSummary.claimed.toLocaleString() }}</span>
          <span class="brief-label">已领取</span>
        </div>
      </div>
    </div>

    <div class="mini-card menu-section">
      <div class="icon-grid">
        <div
          v-for="item in iconItems"
          :key="item.path"
          class="icon-item"
          @click="router.push(item.path)"
        >
          <div class="icon-box" :style="{ background: item.bg }">{{ item.icon }}</div>
          <span>{{ item.label }}</span>
        </div>
      </div>
    </div>

    <div v-if="paymentBinding" class="mini-card pay-tip">
      支付宝 {{ paymentBinding.alipay ?? '未绑定' }}
      · 银行卡 {{ paymentBinding.bankName ? `${paymentBinding.bankName} *${paymentBinding.bankCardLast4}` : '未绑定' }}
    </div>
  </div>
</template>

<style scoped>
.profile-page { padding-top: 0; }
.profile-card, .income-card, .menu-section { cursor: default; }
.income-card { cursor: pointer; }

.profile-row { display: flex; align-items: center; gap: 14px; }
.profile-avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, #e60012, #ff8a80);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 22px;
  font-weight: 700;
  flex-shrink: 0;
}
.profile-name { font-size: 18px; font-weight: 700; color: #333; }
.profile-sub { font-size: 12px; color: #999; margin-top: 2px; }
.profile-tags { margin-top: 6px; display: flex; gap: 4px; flex-wrap: wrap; }

.insurance-status {
  cursor: pointer;
}

.insurance-status.insured {
  background: #fff0f0;
  color: #e60012;
}

.insurance-status.uninsured {
  background: #f5f5f5;
  color: #999;
}

.income-brief {
  display: flex;
  justify-content: space-around;
}

.brief-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.brief-value {
  font-size: 16px;
  font-weight: 700;
  color: #333;
}

.brief-value.highlight {
  color: #e60012;
}

.brief-label {
  font-size: 11px;
  color: #999;
}

.icon-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px 8px;
}

.icon-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #333;
  cursor: pointer;
}

.icon-box {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 22px;
}

.pay-tip { font-size: 12px; color: #999; cursor: default; }
</style>
