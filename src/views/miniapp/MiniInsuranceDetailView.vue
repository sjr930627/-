<script setup lang="ts">
import MiniNavBack from '@/components/miniapp/MiniNavBack.vue'
import { computed } from 'vue'
import { useAppStore } from '@/stores/app'
import { useMiniInsuranceStatus } from '@/composables/useMiniInsuranceStatus'
import { getInsuranceProductTypeLabel } from '@/services/insurance'

const store = useAppStore()
const { todayPolicy, isInsuredToday } = useMiniInsuranceStatus()

const product = computed(() =>
  todayPolicy.value
    ? store.insuranceProducts.find((p) => p.id === todayPolicy.value!.productId)
    : null,
)

const shiftLabel = computed(() => {
  if (!todayPolicy.value) return '—'
  const asn = store.getAssignment(todayPolicy.value.employeeId, todayPolicy.value.workDate)
  if (!asn) return '—'
  const shift = store.shifts.find((s) => s.id === asn.shiftId)
  return shift ? `${shift.name} ${shift.startTime}–${shift.endTime}` : '—'
})
</script>

<template>
  <div>
    <div class="mini-nav-bar">
      <MiniNavBack fallback="/miniapp/profile" />
      <div class="mini-nav-title">投保详情</div>
    </div>
    <div class="mini-page">
      <div v-if="isInsuredToday && todayPolicy" class="mini-card">
        <div class="status-badge active">投保中</div>
        <div class="detail-row">
          <span class="label">保单号</span>
          <span class="value">{{ todayPolicy.policyNo }}</span>
        </div>
        <div class="detail-row">
          <span class="label">保险类型</span>
          <span class="value">{{ product?.name ?? '—' }}</span>
        </div>
        <div class="detail-row">
          <span class="label">险种分类</span>
          <span class="value">{{ product ? getInsuranceProductTypeLabel(product.type) : '—' }}</span>
        </div>
        <div class="detail-row">
          <span class="label">承保公司</span>
          <span class="value">{{ product?.provider ?? '—' }}</span>
        </div>
        <div class="detail-row">
          <span class="label">申报日期</span>
          <span class="value">{{ todayPolicy.workDate }}</span>
        </div>
        <div class="detail-row">
          <span class="label">班次时段</span>
          <span class="value">{{ shiftLabel }}</span>
        </div>
        <div class="detail-row">
          <span class="label">工作地点</span>
          <span class="value">{{ todayPolicy.location ?? '—' }}</span>
        </div>
        <div class="detail-row">
          <span class="label">生效时间</span>
          <span class="value">{{ todayPolicy.effectiveTime.replace('T', ' ') }}</span>
        </div>
        <div class="detail-row">
          <span class="label">今日保费</span>
          <span class="value premium">¥ {{ todayPolicy.premium.toFixed(2) }}/天</span>
        </div>
      </div>
      <div v-else class="mini-card empty-card">
        <div class="status-badge inactive">当日未投保</div>
        <p class="empty-tip">今日尚未完成上岗打卡或未触发自动投保，请先完成上班打卡。</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.status-badge {
  display: inline-block;
  padding: 4px 10px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 14px;
}

.status-badge.active {
  background: #fff0f0;
  color: #e60012;
}

.status-badge.inactive {
  background: #f5f5f5;
  color: #999;
}

.detail-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid #f5f5f5;
  font-size: 13px;
}

.detail-row:last-child {
  border-bottom: none;
}

.label {
  color: #999;
  flex-shrink: 0;
}

.value {
  color: #333;
  text-align: right;
  word-break: break-all;
}

.value.premium {
  color: #ef4444;
  font-weight: 700;
}

.empty-tip {
  font-size: 13px;
  color: #999;
  line-height: 1.6;
  margin: 0;
}
</style>
