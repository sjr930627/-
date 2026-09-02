<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import {
  Calendar,
  CreditCard,
  Document,
  EditPen,
  List,
  Reading,
  OfficeBuilding,
  SwitchButton,
  Tickets,
  User,
  Wallet,
} from '@element-plus/icons-vue'
import type { Component } from 'vue'
import { useAppStore } from '@/stores/app'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import { useMiniAppAuth } from '@/composables/useMiniAppAuth'
import { useMiniInsuranceStatus } from '@/composables/useMiniInsuranceStatus'
import { useMiniFaceVerifyStatus } from '@/composables/useMiniFaceVerifyStatus'

const router = useRouter()
const store = useAppStore()
const { employee, department, profileExt, paymentBinding } = useMiniAppWorker()
const { onboardingComplete, logout } = useMiniAppAuth()
const { statusLabel, isInsuredToday } = useMiniInsuranceStatus()
const { statusMeta: faceVerifyMeta } = useMiniFaceVerifyStatus()

const showOnboardingBanner = computed(() => !onboardingComplete.value)

const incomeSummary = computed(() => {
  const empId = employee.value?.id ?? ''
  const records = store.workerIncomeRecords.filter((r) => r.employeeId === empId)
  const pending = store.pendingSettlements.find((p) => p.employeeId === empId)
  return {
    claimable: records.filter((r) => r.status === 'claimable').reduce((s, r) => s + r.amount, 0),
    pending:
      pending?.estimatedIncome ??
      records.filter((r) => r.status === 'pending_settlement').reduce((s, r) => s + r.amount, 0),
    claimed: records
      .filter((r) => r.status === 'claimed')
      .reduce((s, r) => s + (r.netAmount ?? r.amount), 0),
  }
})

const iconItems: {
  path: string
  icon: Component
  label: string
  bg: string
  color: string
}[] = [
  { path: '/miniapp/training/materials', icon: Reading, label: '我的培训', bg: '#f0fdf4', color: '#22c55e' },
  { path: '/miniapp/training/exams', icon: EditPen, label: '我的考核', bg: '#fff7ed', color: '#f97316' },
  { path: '/miniapp/income', icon: Wallet, label: '我的收入', bg: '#fff7ed', color: '#f97316' },
  { path: '/miniapp/tasks', icon: List, label: '任务进度', bg: '#E6FFFA', color: '#4FD1C5' },
  { path: '/miniapp/applications', icon: Tickets, label: '我的报名', bg: '#E6FFFA', color: '#4FD1C5' },
  { path: '/miniapp/join-manage', icon: OfficeBuilding, label: '入驻管理', bg: '#eff6ff', color: '#3b82f6' },
  { path: '/miniapp/payment', icon: CreditCard, label: '收款绑定', bg: '#fff7ed', color: '#f97316' },
  { path: '/miniapp/agreements', icon: Document, label: '协议管理', bg: '#faf5ff', color: '#a855f7' },
  { path: '/miniapp/worker-archive', icon: User, label: '我的资料', bg: '#E6FFFA', color: '#4FD1C5' },
  { path: '/miniapp/part-time-pref', icon: Calendar, label: '兼职偏好', bg: '#f5f3ff', color: '#8b5cf6' },
]

async function handleLogout() {
  await ElMessageBox.confirm('确定退出登录？', '提示', { type: 'warning' })
  logout()
  router.replace('/miniapp/login')
}
</script>

<template>
  <div class="mini-page profile-page">
    <div
      v-if="showOnboardingBanner"
      class="onboarding-banner"
      @click="router.push('/miniapp/onboarding')"
    >
      <div class="banner-text">
        <div class="banner-title">档案尚未完善</div>
        <div class="banner-desc">完成实名认证、人脸识别与偏好设置后可正常接单</div>
      </div>
      <span class="banner-action">去完善 ›</span>
    </div>

    <div class="mini-card profile-card" @click="router.push('/miniapp/worker-archive')">
      <div class="profile-row">
        <div class="profile-avatar">{{ employee?.name?.slice(0, 1) ?? '灵' }}</div>
        <div class="profile-info">
          <div class="profile-name">{{ employee?.name ?? '-' }}</div>
          <div class="profile-sub">{{ department?.name }} · {{ employee?.employeeNo }}</div>
          <div v-if="profileExt" class="profile-tags">
            <span
              class="mini-tag insurance-status"
              :class="isInsuredToday ? 'insured' : 'uninsured'"
              @click.stop="router.push('/miniapp/insurance')"
            >
              {{ statusLabel }}
            </span>
            <span
              class="mini-tag face-verify-status"
              :style="{ background: faceVerifyMeta.bg, color: faceVerifyMeta.color }"
              @click.stop="router.push('/miniapp/face-verify')"
            >
              {{ faceVerifyMeta.label }}
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
          <div class="icon-box" :style="{ background: item.bg, color: item.color }">
            <el-icon :size="22"><component :is="item.icon" /></el-icon>
          </div>
          <span>{{ item.label }}</span>
        </div>
      </div>
    </div>

    <div v-if="paymentBinding" class="mini-card pay-tip">
      支付宝 {{ paymentBinding.alipay ?? '未绑定' }}
      · 银行卡
      {{ paymentBinding.bankName ? `${paymentBinding.bankName} *${paymentBinding.bankCardLast4}` : '未绑定' }}
    </div>

    <button class="logout-btn" type="button" @click="handleLogout">
      <el-icon :size="16"><SwitchButton /></el-icon>
      退出登录
    </button>
  </div>
</template>

<style scoped>
.profile-page {
  padding-top: 0;
}

.profile-card,
.income-card,
.menu-section {
  /* base card styles */
}

.profile-card {
  cursor: pointer;
}

.income-card {
  cursor: pointer;
}

.menu-section {
  cursor: default;
}

.profile-row {
  display: flex;
  align-items: center;
  gap: 14px;
}

.profile-avatar {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, #4FD1C5, #81E6D9);
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-size: 22px;
  font-weight: 700;
  flex-shrink: 0;
}

.profile-name {
  font-size: 18px;
  font-weight: 700;
  color: #333;
}

.profile-sub {
  font-size: 12px;
  color: #999;
  margin-top: 2px;
}

.profile-tags {
  margin-top: 6px;
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.insurance-status {
  cursor: pointer;
}

.insurance-status.insured {
  background: #E6FFFA;
  color: #4FD1C5;
}

.insurance-status.uninsured {
  background: #f5f5f5;
  color: #999;
}

.face-verify-status {
  cursor: pointer;
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
  color: #ef4444;
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
}

.pay-tip {
  font-size: 12px;
  color: #999;
  cursor: default;
}

.onboarding-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 12px;
  padding: 14px 16px;
  border-radius: 14px;
  background: linear-gradient(135deg, #E6FFFA, #CCFBF1);
  cursor: pointer;
}

.banner-title {
  font-size: 14px;
  font-weight: 700;
  color: #319795;
}

.banner-desc {
  margin-top: 4px;
  font-size: 12px;
  color: #4FD1C5;
  line-height: 1.4;
}

.banner-action {
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 600;
  color: #38B2AC;
}

.logout-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  margin-top: 12px;
  padding: 14px;
  border: none;
  border-radius: 14px;
  background: #fff;
  color: #ef4444;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}
</style>
