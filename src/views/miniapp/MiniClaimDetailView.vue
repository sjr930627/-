<script setup lang="ts">
import MiniNavBack from '@/components/miniapp/MiniNavBack.vue'
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import { formatInsuranceDateTime, getInsuranceClaimStatusLabel, normalizeInsuranceClaimCommunications } from '@/services/insurance'

const route = useRoute()
const store = useAppStore()
const { employeeId } = useMiniAppWorker()

const claim = computed(() =>
  store.insuranceClaimRecords.find(
    (record) => record.id === String(route.params.id || '') && record.employeeId === employeeId.value,
  ),
)
const policy = computed(() => store.insurancePolicies.find((item) => item.id === claim.value?.policyId))
const product = computed(() => store.insuranceProducts.find((item) => item.id === policy.value?.productId))
const communications = computed(() =>
  claim.value ? normalizeInsuranceClaimCommunications(claim.value) : [],
)
</script>

<template>
  <div>
    <div class="mini-nav-bar">
      <MiniNavBack fallback="/miniapp/protection" />
      <div class="mini-nav-title">理赔详情</div>
    </div>
    <div v-if="claim" class="mini-page">
      <div class="mini-card">
        <div class="head">
          <div class="title">{{ product?.name ?? '保险产品' }}</div>
          <span class="status" :class="`claim-${claim.status}`">{{ getInsuranceClaimStatusLabel(claim.status) }}</span>
        </div>
        <div class="row"><span>保单号</span><b>{{ policy?.policyNo ?? '—' }}</b></div>
        <div class="row"><span>事故时间</span><b>{{ formatInsuranceDateTime(claim.incidentTime) }}</b></div>
        <div class="row"><span>事故地点</span><b>{{ claim.incidentLocation }}</b></div>
        <div class="row"><span>受伤情况</span><b>{{ claim.injury }}</b></div>
        <div class="row"><span>事故经过</span><b>{{ claim.reason }}</b></div>
        <div class="row"><span>申请金额</span><b>{{ claim.claimAmount != null ? `¥${claim.claimAmount}` : '—' }}</b></div>
        <div class="row"><span>联系电话</span><b>{{ claim.contactPhone }}</b></div>
        <div class="row"><span>申请时间</span><b>{{ formatInsuranceDateTime(claim.recordedAt) }}</b></div>
        <div v-if="communications.length" class="logs">
          <div class="logs-title">沟通记录</div>
          <div v-for="item in communications" :key="item.id" class="log">
            <b>{{ item.content }}</b>
            <span>{{ formatInsuranceDateTime(item.updatedAt || item.createdAt) }}</span>
          </div>
        </div>
        <div v-if="claim.status === 'rejected' && (claim.rejectReason || claim.remark)" class="row">
          <span>驳回原因</span><b>{{ claim.rejectReason || claim.remark }}</b>
        </div>
        <div v-else-if="claim.remark" class="row"><span>备注</span><b>{{ claim.remark }}</b></div>
      </div>
      <div class="mini-card materials">
        <div class="title">理赔资料</div>
        <div v-for="file in claim.materials" :key="file.key" class="file">
          <span>{{ file.label }}</span>
          <b>{{ file.fileName }}</b>
        </div>
        <div v-if="!claim.materials.length" class="empty">未上传资料</div>
      </div>
    </div>
    <div v-else class="mini-page">
      <div class="mini-empty">理赔记录不存在</div>
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
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 12px;
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

.status.claim-rejected {
  background: #fef2f2;
  color: #ef4444;
}

.logs {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid #f3f4f6;
}

.logs-title {
  margin-bottom: 6px;
  font-size: 13px;
  color: #6b7280;
}

.log {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 8px;
}

.log b {
  font-weight: 500;
  color: #333;
  white-space: pre-wrap;
}

.log span {
  font-size: 12px;
  color: #9ca3af;
}

.row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid #f5f5f5;
  font-size: 13px;
}

.row span {
  color: #999;
  flex-shrink: 0;
}

.row b {
  color: #333;
  font-weight: 500;
  text-align: right;
}

.materials {
  margin-top: 12px;
}

.file {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 0;
  border-bottom: 1px solid #f5f5f5;
  font-size: 13px;
  color: #666;
}

.file b {
  color: #333;
  font-weight: 500;
}

.empty {
  margin-top: 8px;
  font-size: 13px;
  color: #999;
}
</style>
