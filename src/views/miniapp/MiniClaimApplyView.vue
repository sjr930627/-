<script setup lang="ts">
import MiniNavBack from '@/components/miniapp/MiniNavBack.vue'
import { computed, reactive, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import {
  canSubmitInsuranceClaim,
  formatCoverageAmount,
  getInsuranceEnrollmentDisplayLabel,
  getInsuranceEnrollmentDisplayStatus,
  insuranceClaimMaterialFields,
} from '@/services/insurance'
import type { InsuranceClaimMaterial } from '@/types'

const route = useRoute()
const router = useRouter()
const store = useAppStore()
const { employee, employeeId } = useMiniAppWorker()

const routePolicy = store.insurancePolicies.find(
  (item) => item.id === String(route.params.policyId || '') && item.employeeId === employeeId.value,
)
const workDate = ref(routePolicy?.workDate ?? '')
const selectedId = ref('')

function policyCanApply(policyId: string, status: string) {
  return status !== 'cancelled' && canSubmitInsuranceClaim(store.insuranceClaimRecords, policyId)
}

const dayPolicies = computed(() => {
  if (!workDate.value) return []
  return store.insurancePolicies
    .filter((policy) => policy.employeeId === employeeId.value && policy.workDate === workDate.value)
    .filter((policy) => policy.status !== 'cancelled')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((policy) => {
      const product = store.insuranceProducts.find((item) => item.id === policy.productId)
      const enrollmentStatus = getInsuranceEnrollmentDisplayStatus(policy)
      return {
        ...policy,
        productName: product?.name ?? '保险产品',
        coverageText: formatCoverageAmount(
          policy.coverageAmount ?? product?.coverageScope?.deathDisabilityAmount ?? product?.coverageAmount,
        ),
        enrollmentLabel: getInsuranceEnrollmentDisplayLabel(enrollmentStatus),
        canApply: policyCanApply(policy.id, policy.status),
      }
    })
})

const policy = computed(() => dayPolicies.value.find((item) => item.id === selectedId.value))
const canApply = computed(() => !!policy.value?.canApply)

const form = reactive({
  incidentTime: '',
  incidentLocation: '',
  injury: '',
  reason: '',
  claimAmount: '',
  contactPhone: employee.value?.phone ?? '',
})

watch(
  dayPolicies,
  (list) => {
    if (list.some((item) => item.id === selectedId.value && item.canApply)) return
    const claimable = list.filter((item) => item.canApply)
    const fromRoute = claimable.find((item) => item.id === routePolicy?.id)
    selectedId.value = fromRoute?.id ?? (claimable.length === 1 ? claimable[0].id : '')
  },
  { immediate: true },
)

watch(policy, (next, prev) => {
  if (!next) return
  if (!form.incidentLocation || form.incidentLocation === (prev?.location ?? '')) {
    form.incidentLocation = next.location ?? ''
  }
})
const fileNames = reactive<Record<string, string>>({})

function onFile(key: string, event: Event) {
  const input = event.target as HTMLInputElement
  fileNames[key] = input.files?.[0]?.name ?? ''
}

function submit() {
  if (!policy.value || !canApply.value) {
    ElMessage.warning('当前保单不可申请理赔')
    return
  }
  const materials: InsuranceClaimMaterial[] = insuranceClaimMaterialFields
    .filter((field) => fileNames[field.key])
    .map((field) => ({ key: field.key, label: field.label, fileName: fileNames[field.key] }))
  const amount = Number(form.claimAmount)
  try {
    const record = store.submitInsuranceClaim({
      policyId: policy.value.id,
      reason: form.reason,
      incidentTime: form.incidentTime,
      incidentLocation: form.incidentLocation,
      injury: form.injury,
      claimAmount: Number.isFinite(amount) ? amount : undefined,
      contactPhone: form.contactPhone,
      materials,
    })
    ElMessage.success('理赔申请已提交，等待审核')
    router.replace(`/miniapp/protection/claims/${record.id}`)
  } catch (error) {
    ElMessage.warning(error instanceof Error ? error.message : '提交失败')
  }
}
</script>

<template>
  <div class="apply-page">
    <div class="mini-nav-bar">
      <MiniNavBack fallback="/miniapp/protection" />
      <div class="mini-nav-title">申请理赔</div>
    </div>
    <div class="mini-page">
      <div class="mini-card form-card picker">
        <label class="field">
          <span>投保日期</span>
          <input v-model="workDate" type="date" />
        </label>
      </div>
      <template v-if="workDate">
        <div v-if="!dayPolicies.length" class="mini-empty">该日没有保单</div>
        <button
          v-for="item in dayPolicies"
          :key="item.id"
          type="button"
          class="mini-card policy-pick"
          :class="{ selected: item.id === selectedId, blocked: !item.canApply }"
          :disabled="!item.canApply"
          @click="selectedId = item.id"
        >
          <div class="pick-head">
            <b>{{ item.productName }}</b>
            <span>{{ item.enrollmentLabel }}</span>
          </div>
          <div class="meta">保单号 {{ item.policyNo }} · 额度 {{ item.coverageText }}</div>
          <div v-if="!item.canApply" class="hint">已有进行中的理赔申请</div>
        </button>
      </template>
      <template v-if="policy && canApply">
      <div class="mini-card summary">
        <div class="product">{{ policy.productName }}</div>
        <div class="meta">保单号 {{ policy.policyNo }}</div>
      </div>
      <div class="mini-card form-card">
        <label class="field">
          <span>事故时间</span>
          <input v-model="form.incidentTime" type="datetime-local" />
        </label>
        <label class="field">
          <span>事故地点</span>
          <input v-model="form.incidentLocation" maxlength="40" placeholder="请填写事故地点" />
        </label>
        <label class="field">
          <span>受伤情况</span>
          <input v-model="form.injury" maxlength="40" placeholder="请填写受伤情况" />
        </label>
        <label class="field">
          <span>事故经过</span>
          <textarea v-model="form.reason" maxlength="200" rows="3" placeholder="请描述事故经过" />
        </label>
        <label class="field">
          <span>申请金额（元）</span>
          <input v-model="form.claimAmount" inputmode="decimal" placeholder="选填" />
        </label>
        <label class="field">
          <span>联系电话</span>
          <input v-model="form.contactPhone" maxlength="11" placeholder="请填写联系电话" />
        </label>
        <div v-for="field in insuranceClaimMaterialFields" :key="field.key" class="field">
          <span>{{ field.label }}{{ field.required ? '' : '（选填）' }}</span>
          <label class="upload">
            <input type="file" accept="image/*,.pdf" @change="onFile(field.key, $event)" />
            <em>{{ fileNames[field.key] || '上传资料' }}</em>
          </label>
        </div>
      </div>
      <button class="submit" type="button" @click="submit">提交申请</button>
      <p class="tip">提交后状态为待审核，由运营后台审批。</p>
      </template>
    </div>
  </div>
</template>

<style scoped>
.apply-page {
  min-height: 100%;
  background: #f5f6f8;
}

.picker,
.summary,
.policy-pick {
  margin-bottom: 12px;
}

.policy-pick {
  display: block;
  width: 100%;
  text-align: left;
  border: 1px solid transparent;
  cursor: pointer;
}

.policy-pick.selected {
  border-color: #4fd1c5;
}

.policy-pick.blocked {
  cursor: not-allowed;
  opacity: 0.72;
}

.pick-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.pick-head b {
  font-size: 15px;
  color: #333;
}

.pick-head span,
.hint {
  font-size: 12px;
  color: #999;
}

.product {
  font-size: 15px;
  font-weight: 600;
  color: #333;
}

.meta,
.tip {
  margin-top: 6px;
  font-size: 12px;
  color: #999;
}

.form-card {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  font-size: 13px;
  color: #666;
}

.field input,
.field textarea {
  width: 100%;
  box-sizing: border-box;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 10px 12px;
  font-size: 14px;
  color: #333;
  background: #fff;
}

.upload {
  display: flex;
  align-items: center;
  min-height: 40px;
  padding: 8px 12px;
  border: 1px dashed #99f6e4;
  border-radius: 8px;
  background: #f0fdfa;
  color: #0f766e;
}

.upload input {
  display: none;
}

.upload em {
  font-style: normal;
  font-size: 13px;
  word-break: break-all;
}

.submit {
  width: 100%;
  height: 42px;
  margin-top: 16px;
  border: none;
  border-radius: 10px;
  background: #4fd1c5;
  color: #fff;
  font-size: 15px;
  font-weight: 600;
}

.tip {
  text-align: center;
}
</style>
