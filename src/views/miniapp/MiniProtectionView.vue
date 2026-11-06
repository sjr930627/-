<script setup lang="ts">
import MiniNavBack from '@/components/miniapp/MiniNavBack.vue'
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import {
  formatCoverageAmount,
  formatInsuranceDateTime,
  getInsuranceClaimStatusLabel,
  getInsuranceEnrollmentDisplayLabel,
  getInsuranceEnrollmentDisplayStatus,
} from '@/services/insurance'

const router = useRouter()
const store = useAppStore()
const { employeeId } = useMiniAppWorker()
const activeTab = ref<'policies' | 'claims'>('policies')

const policies = computed(() =>
  store.insurancePolicies
    .filter((policy) => policy.employeeId === employeeId.value)
    .sort((a, b) => b.workDate.localeCompare(a.workDate) || b.createdAt.localeCompare(a.createdAt))
    .map((policy) => {
      const product = store.insuranceProducts.find((item) => item.id === policy.productId)
      const enrollmentStatus = getInsuranceEnrollmentDisplayStatus(policy)
      return {
        ...policy,
        productName: product?.name ?? '保险产品',
        coverageText: formatCoverageAmount(policy.coverageAmount ?? product?.coverageAmount),
        enrolledAtText: formatInsuranceDateTime(policy.createdAt),
        enrollmentStatus,
        enrollmentLabel: getInsuranceEnrollmentDisplayLabel(enrollmentStatus),
      }
    }),
)

const claims = computed(() =>
  store.insuranceClaimRecords
    .filter((record) => record.employeeId === employeeId.value)
    .sort((a, b) => b.recordedAt.localeCompare(a.recordedAt))
    .map((record) => {
      const policy = store.insurancePolicies.find((item) => item.id === record.policyId)
      const product = store.insuranceProducts.find((item) => item.id === policy?.productId)
      return {
        ...record,
        policyNo: policy?.policyNo ?? '—',
        productName: product?.name ?? '保险产品',
        recordedAtText: formatInsuranceDateTime(record.recordedAt),
        statusLabel: getInsuranceClaimStatusLabel(record.status),
      }
    }),
)

function openPolicy(id: string) {
  router.push(`/miniapp/protection/policies/${id}`)
}

function startApply() {
  router.push('/miniapp/protection/apply')
}

function openClaim(id: string) {
  router.push(`/miniapp/protection/claims/${id}`)
}
</script>

<template>
  <div class="protection-page">
    <div class="mini-nav-bar">
      <MiniNavBack fallback="/miniapp/profile" />
      <div class="mini-nav-title">我的保障</div>
    </div>
    <div class="tabs">
      <button type="button" class="tab" :class="{ active: activeTab === 'policies' }" @click="activeTab = 'policies'">
        我的保单
      </button>
      <button type="button" class="tab" :class="{ active: activeTab === 'claims' }" @click="activeTab = 'claims'">
        理赔记录
      </button>
    </div>
    <div class="mini-page">
      <template v-if="activeTab === 'policies'">
        <button class="apply-entry" type="button" @click="startApply">申请理赔</button>
        <div
          v-for="policy in policies"
          :key="policy.id"
          class="mini-card policy-card clickable"
          @click="openPolicy(policy.id)"
        >
          <div class="card-head">
            <div class="title">{{ policy.productName }}</div>
            <span class="status" :class="policy.enrollmentStatus === 'cancelled' ? 'off' : ''">
              {{ policy.enrollmentLabel }}
            </span>
          </div>
          <div class="meta">保单号 {{ policy.policyNo }}</div>
          <div class="meta">投保时间 {{ policy.enrolledAtText }} · 额度 {{ policy.coverageText }}</div>
        </div>
        <div v-if="!policies.length" class="mini-empty">暂无保单</div>
      </template>
      <template v-else>
        <div v-for="claim in claims" :key="claim.id" class="mini-card policy-card" @click="openClaim(claim.id)">
          <div class="card-head">
            <div class="title">{{ claim.productName }}</div>
            <span class="status" :class="`claim-${claim.status}`">{{ claim.statusLabel }}</span>
          </div>
          <div class="meta">保单号 {{ claim.policyNo }}</div>
          <div class="reason">{{ claim.reason }}</div>
          <div class="meta">申请时间 {{ claim.recordedAtText }}</div>
        </div>
        <div v-if="!claims.length" class="mini-empty">暂无理赔记录</div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.protection-page {
  min-height: 100%;
  background: #f5f6f8;
}

.tabs {
  display: flex;
  background: #fff;
  border-bottom: 1px solid #f0f0f0;
}

.tab {
  flex: 1;
  padding: 12px 0;
  border: none;
  border-bottom: 2px solid transparent;
  background: none;
  font-size: 14px;
  color: #666;
}

.tab.active {
  color: #0f766e;
  font-weight: 600;
  border-bottom-color: #4fd1c5;
}

.policy-card {
  margin-bottom: 12px;
}

.policy-card.clickable {
  cursor: pointer;
}

.apply-entry {
  width: 100%;
  height: 42px;
  margin-bottom: 12px;
  border: none;
  border-radius: 10px;
  background: #4fd1c5;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}

.card-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.title {
  font-size: 15px;
  font-weight: 600;
  color: #333;
}

.status {
  flex-shrink: 0;
  padding: 2px 8px;
  border-radius: 999px;
  background: #e6fffa;
  color: #0f766e;
  font-size: 12px;
}

.status.off,
.status.claim-rejected {
  background: #fef2f2;
  color: #ef4444;
}

.status.claim-pending,
.status.claim-accepted {
  background: #fff7ed;
  color: #ea580c;
}

.status.claim-reported {
  background: #eff6ff;
  color: #2563eb;
}

.status.claim-closed {
  background: #f0fdf4;
  color: #16a34a;
}

.meta,
.hint {
  margin-top: 6px;
  font-size: 12px;
  color: #999;
}

.reason {
  margin-top: 8px;
  font-size: 13px;
  color: #333;
  line-height: 1.5;
}

</style>
