<script setup lang="ts">
import MiniNavBack from '@/components/miniapp/MiniNavBack.vue'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import {
  canSubmitInsuranceClaim,
  formatCoverageAmount,
  formatInsuranceDateTime,
  formatInsurancePeriod,
  getInsuranceEnrollmentDisplayLabel,
  getInsuranceEnrollmentDisplayStatus,
  getInsuranceProductTypeLabel,
  insuranceEnrolledAt,
} from '@/services/insurance'

const route = useRoute()
const router = useRouter()
const store = useAppStore()
const { employeeId } = useMiniAppWorker()

const policy = computed(() =>
  store.insurancePolicies.find(
    (item) => item.id === String(route.params.id || '') && item.employeeId === employeeId.value,
  ),
)
const product = computed(() =>
  policy.value ? store.insuranceProducts.find((item) => item.id === policy.value!.productId) : undefined,
)
const enrollmentStatus = computed(() =>
  policy.value ? getInsuranceEnrollmentDisplayStatus(policy.value) : 'ended',
)
const shiftLabel = computed(() => {
  if (!policy.value) return '—'
  const assignment = store.getAssignment(policy.value.employeeId, policy.value.workDate)
  if (!assignment) return '—'
  const shift = store.shifts.find((item) => item.id === assignment.shiftId)
  return shift ? `${shift.name} ${shift.startTime}–${shift.endTime}` : '—'
})
const coverageText = computed(() =>
  formatCoverageAmount(
    policy.value?.coverageAmount ??
      product.value?.coverageScope?.deathDisabilityAmount ??
      product.value?.coverageAmount,
  ),
)
const canApply = computed(
  () =>
    !!policy.value &&
    policy.value.status !== 'cancelled' &&
    canSubmitInsuranceClaim(store.insuranceClaimRecords, policy.value.id),
)

function applyClaim() {
  if (!policy.value || !canApply.value) return
  router.push(`/miniapp/protection/apply/${policy.value.id}`)
}
</script>

<template>
  <div>
    <div class="mini-nav-bar">
      <MiniNavBack fallback="/miniapp/protection" />
      <div class="mini-nav-title">保单详情</div>
    </div>
    <div v-if="policy" class="mini-page">
      <div class="mini-card">
        <div class="head">
          <div class="title">{{ product?.name ?? '保险产品' }}</div>
          <span class="status" :class="enrollmentStatus === 'cancelled' ? 'off' : ''">
            {{ getInsuranceEnrollmentDisplayLabel(enrollmentStatus) }}
          </span>
        </div>
        <div class="row"><span>保单号</span><b>{{ policy.policyNo }}</b></div>
        <div class="row"><span>保险类型</span><b>{{ product?.name ?? '—' }}</b></div>
        <div class="row"><span>险种分类</span><b>{{ product ? getInsuranceProductTypeLabel(product.type) : '—' }}</b></div>
        <div class="row"><span>承保公司</span><b>{{ product?.provider || '—' }}</b></div>
        <div class="row"><span>死亡伤残保额</span><b>{{ coverageText }}</b></div>
        <div class="row"><span>申报日期</span><b>{{ policy.workDate }}</b></div>
        <div class="row"><span>班次时段</span><b>{{ shiftLabel }}</b></div>
        <div class="row"><span>工作地点</span><b>{{ policy.location || '—' }}</b></div>
        <div class="row"><span>投保时间</span><b>{{ formatInsuranceDateTime(insuranceEnrolledAt(policy)) }}</b></div>
        <div class="row"><span>投保期限</span><b>{{ formatInsurancePeriod(policy.effectiveTime, policy.expireTime) }}</b></div>
      </div>
      <button v-if="canApply" class="apply-entry" type="button" @click="applyClaim">申请理赔</button>
      <p v-else-if="policy.status !== 'cancelled'" class="hint">已有进行中的理赔申请</p>
    </div>
    <div v-else class="mini-page">
      <div class="mini-empty">保单不存在</div>
    </div>
  </div>
</template>

<style scoped>
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
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

.status.off {
  background: #fef2f2;
  color: #ef4444;
}

.row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid #f5f5f5;
  font-size: 13px;
}

.row:last-child {
  border-bottom: none;
}

.row span {
  color: #999;
  flex-shrink: 0;
}

.row b {
  color: #333;
  font-weight: 500;
  text-align: right;
  word-break: break-all;
}

.apply-entry {
  width: 100%;
  height: 42px;
  margin-top: 16px;
  border: none;
  border-radius: 10px;
  background: #4fd1c5;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}

.hint {
  margin: 16px 0 0;
  text-align: center;
  font-size: 13px;
  color: #999;
}
</style>
