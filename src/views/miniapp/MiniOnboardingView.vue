<script setup lang="ts">
import { computed, onActivated, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import { useMiniAppAuth } from '@/composables/useMiniAppAuth'
import MiniTimePreferencePicker from '@/components/miniapp/MiniTimePreferencePicker.vue'
import MiniSkillCertPicker from '@/components/miniapp/MiniSkillCertPicker.vue'
import {
  MINIAPP_BRAND_OPTIONS,
  MINIAPP_JOB_OPTIONS,
  MINIAPP_ONBOARDING_STEPS,
  MINIAPP_SKILL_CERT_CATALOG,
  MINIAPP_SKILL_CERT_MAX,
} from '@/constants/miniappAuth'
import type { WorkerPartTimePreference, WorkerSkillCertificate } from '@/types'

const router = useRouter()
const route = useRoute()
const store = useAppStore()
const { employeeId, employee, profileExt } = useMiniAppWorker()
const { completeOnboarding, refreshOnboardingStatus } = useMiniAppAuth()

onActivated(() => {
  refreshOnboardingStatus()
})

const stepKeys = MINIAPP_ONBOARDING_STEPS.map((s) => s.key)
const currentStep = ref(0)

watch(
  () => route.query.step,
  (step) => {
    if (typeof step === 'string') {
      const idx = stepKeys.indexOf(step as (typeof stepKeys)[number])
      if (idx >= 0) currentStep.value = idx
    }
  },
  { immediate: true },
)

const stepMeta = computed(() => MINIAPP_ONBOARDING_STEPS[currentStep.value])

const pageTitle = computed(() => {
  switch (stepMeta.value.key) {
    case 'timePref':
      return '我的兼职时间偏好是：'
    case 'certificates':
      return '我有哪些职业技能证书？'
    default:
      return stepMeta.value.title
  }
})

const realNameForm = ref({
  name: employee.value?.name ?? '',
  idCard: '',
})

const addressForm = ref(profileExt.value?.permanentAddress ?? employee.value?.address ?? '')

const timePrefForm = ref<Partial<WorkerPartTimePreference>>({
  timeOfDay: profileExt.value?.partTimePreference?.timeOfDay ?? 'both',
  commitment: profileExt.value?.partTimePreference?.commitment ?? 'both',
  shiftDuration: profileExt.value?.partTimePreference?.shiftDuration ?? 'both',
  workDays: profileExt.value?.partTimePreference?.workDays ?? 'both',
})

const selectedCertIds = ref<string[]>(
  profileExt.value?.skillCertificates?.map((c) => c.id) ?? [],
)

const jobForm = ref({
  favoriteJobs: profileExt.value?.partTimePreference?.favoriteJobs ?? '',
  wantedJobs: profileExt.value?.partTimePreference?.wantedJobs ?? '',
  preferredBrands: profileExt.value?.partTimePreference?.preferredBrands ?? '',
})

function goStep(index: number) {
  currentStep.value = index
  router.replace({ path: '/miniapp/onboarding', query: { step: stepKeys[index] } })
}

function submitRealName() {
  if (!realNameForm.value.name.trim()) {
    ElMessage.warning('请输入真实姓名')
    return
  }
  if (!/^\d{17}[\dXx]$/.test(realNameForm.value.idCard.trim())) {
    ElMessage.warning('请输入正确的身份证号')
    return
  }
  store.completeWorkerRealName(
    employeeId.value,
    realNameForm.value.name,
    realNameForm.value.idCard,
  )
  refreshOnboardingStatus()
  ElMessage.success('实名信息已提交')
  goStep(1)
}

function goFaceVerify() {
  router.push({ path: '/miniapp/face-verify/capture', query: { from: 'onboarding' } })
}

function submitProfile() {
  if (!addressForm.value.trim()) {
    ElMessage.warning('请填写常住地址')
    return
  }
  store.updateWorkerPermanentAddress(employeeId.value, addressForm.value)
  refreshOnboardingStatus()
  goStep(3)
}

function submitTimePref() {
  store.updateWorkerPartTimePreference(employeeId.value, { ...timePrefForm.value })
  refreshOnboardingStatus()
  goStep(4)
}

function skipTimePref() {
  goStep(4)
}

function certIdsToRecords(ids: string[]): WorkerSkillCertificate[] {
  const all = MINIAPP_SKILL_CERT_CATALOG.flatMap((c) => c.items)
  return ids.map((id) => {
    const item = all.find((i) => i.id === id)
    return { id, name: item?.name ?? id }
  })
}

function submitCertificates() {
  store.updateWorkerSkillCertificates(employeeId.value, certIdsToRecords(selectedCertIds.value))
  refreshOnboardingStatus()
  goStep(5)
}

function skipCertificates() {
  goStep(5)
}

function submitJobPref() {
  store.updateWorkerPartTimePreference(employeeId.value, { ...jobForm.value })
  finishOnboarding()
}

function skipJobPref() {
  finishOnboarding()
}

function finishOnboarding() {
  refreshOnboardingStatus()
  completeOnboarding()
  ElMessage.success('档案完善完成，欢迎使用灵工平台')
  router.replace('/miniapp/workbench')
}

const faceVerified = computed(() => profileExt.value?.faceVerifyStatus === 'verified')
const certCount = computed(() => selectedCertIds.value.length)
</script>

<template>
  <div class="onboarding-page" :class="{ 'has-footer': stepMeta.key === 'certificates' }">
    <div class="onboarding-header">
      <div class="step-dots">
        <span
          v-for="(item, idx) in MINIAPP_ONBOARDING_STEPS"
          :key="item.key"
          class="step-dot"
          :class="{ active: idx === currentStep, done: idx < currentStep }"
        />
      </div>
      <h2 class="page-title">{{ pageTitle }}</h2>
      <p v-if="stepMeta.key !== 'timePref' && stepMeta.key !== 'certificates'" class="step-desc">
        步骤 {{ currentStep + 1 }} / {{ MINIAPP_ONBOARDING_STEPS.length }}
      </p>
    </div>

    <div class="onboarding-body">
      <!-- 实名认证 -->
      <template v-if="stepMeta.key === 'realname'">
        <div class="form-card">
          <div class="field">
            <label>真实姓名</label>
            <input v-model="realNameForm.name" placeholder="与身份证一致">
          </div>
          <div class="field">
            <label>身份证号</label>
            <input v-model="realNameForm.idCard" maxlength="18" placeholder="18 位身份证号码">
          </div>
          <p class="hint">实名信息仅用于税务合规与合同签署，平台严格保密。</p>
          <button class="mini-btn-primary block-btn" type="button" @click="submitRealName">下一步</button>
        </div>
      </template>

      <!-- 人脸识别 -->
      <template v-else-if="stepMeta.key === 'face'">
        <div class="form-card face-step">
          <div class="face-status" :class="{ ok: faceVerified }">
            {{ faceVerified ? '已完成人脸识别' : '尚未完成人脸识别' }}
          </div>
          <p class="hint">需完成真人核验以确保上岗身份真实有效。</p>
          <button
            v-if="!faceVerified"
            class="mini-btn-primary block-btn"
            type="button"
            @click="goFaceVerify"
          >
            开始人脸识别
          </button>
          <button
            v-else
            class="mini-btn-primary block-btn"
            type="button"
            @click="goStep(2)"
          >
            下一步
          </button>
        </div>
      </template>

      <!-- 个人档案 -->
      <template v-else-if="stepMeta.key === 'profile'">
        <div class="form-card">
          <div class="field">
            <label>常住地址</label>
            <textarea
              v-model="addressForm"
              rows="3"
              placeholder="便于推荐附近岗位和排班"
            />
          </div>
          <button class="mini-btn-primary block-btn" type="button" @click="submitProfile">下一步</button>
        </div>
      </template>

      <!-- 兼职时间偏好 -->
      <template v-else-if="stepMeta.key === 'timePref'">
        <MiniTimePreferencePicker v-model="timePrefForm" />
        <div class="inline-actions">
          <button class="mini-btn-primary block-btn" type="button" @click="submitTimePref">下一步</button>
          <button type="button" class="text-skip" @click="skipTimePref">跳过</button>
        </div>
      </template>

      <!-- 技能证书 -->
      <template v-else-if="stepMeta.key === 'certificates'">
        <MiniSkillCertPicker v-model="selectedCertIds" />
      </template>

      <!-- 岗位偏好 -->
      <template v-else>
        <div class="form-card">
          <div class="field">
            <label>我喜欢的兼职</label>
            <select v-model="jobForm.favoriteJobs">
              <option value="">请选择</option>
              <option v-for="job in MINIAPP_JOB_OPTIONS" :key="job" :value="job">{{ job }}</option>
            </select>
          </div>
          <div class="field">
            <label>我想做的兼职</label>
            <select v-model="jobForm.wantedJobs">
              <option value="">请选择</option>
              <option v-for="job in MINIAPP_JOB_OPTIONS" :key="`w-${job}`" :value="job">{{ job }}</option>
            </select>
          </div>
          <div class="field">
            <label>偏好的品牌/企业</label>
            <select v-model="jobForm.preferredBrands">
              <option value="">请选择</option>
              <option v-for="brand in MINIAPP_BRAND_OPTIONS" :key="brand" :value="brand">{{ brand }}</option>
            </select>
          </div>
          <button class="mini-btn-primary block-btn" type="button" @click="submitJobPref">完成并进入工作台</button>
          <button type="button" class="text-skip" @click="skipJobPref">跳过</button>
        </div>
      </template>
    </div>

    <!-- 技能证书底部操作栏 -->
    <div v-if="stepMeta.key === 'certificates'" class="mini-footer-bar cert-footer">
      <button type="button" class="mini-footer-secondary" @click="skipCertificates">跳过</button>
      <button type="button" class="mini-footer-primary" @click="submitCertificates">
        下一步
        <span class="footer-count">({{ certCount }}/{{ MINIAPP_SKILL_CERT_MAX }})</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.onboarding-page {
  min-height: 100%;
  background: var(--mini-bg, #f3f4f6);
  display: flex;
  flex-direction: column;
}

.onboarding-page.has-footer {
  padding-bottom: 80px;
}

.onboarding-header {
  padding: 16px 20px 12px;
  background: transparent;
}

.step-dots {
  display: flex;
  justify-content: center;
  gap: 6px;
  margin-bottom: 20px;
}

.step-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #d1d5db;
  transition: background 0.2s, transform 0.2s;
}

.step-dot.active {
  background: var(--mini-primary);
  transform: scale(1.15);
}

.step-dot.done {
  background: var(--mini-primary-light);
}

.page-title {
  margin: 0;
  font-size: 22px;
  font-weight: 800;
  color: #111827;
  line-height: 1.35;
}

.step-desc {
  margin: 8px 0 0;
  font-size: 13px;
  color: #94a3b8;
}

.onboarding-body {
  flex: 1;
  padding: 8px 16px 24px;
}

.form-card {
  background: #fff;
  border-radius: 16px;
  padding: 20px 16px;
  box-shadow: 0 2px 12px rgba(15, 23, 42, 0.05);
}

.field {
  margin-bottom: 16px;
}

.field label {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  color: #64748b;
}

.field input,
.field textarea,
.field select {
  width: 100%;
  box-sizing: border-box;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  font-size: 15px;
  background: #fff;
}

.hint {
  margin: 0 0 16px;
  font-size: 12px;
  color: #94a3b8;
  line-height: 1.6;
}

.block-btn {
  width: 100%;
}

.inline-actions {
  margin-top: 20px;
}

.text-skip {
  display: block;
  width: 100%;
  margin-top: 14px;
  border: none;
  background: none;
  color: #94a3b8;
  font-size: 15px;
  cursor: pointer;
  padding: 8px;
}

.face-step {
  text-align: center;
}

.face-status {
  padding: 16px;
  border-radius: 12px;
  background: #fef3c7;
  color: #b45309;
  font-weight: 600;
  margin-bottom: 12px;
}

.face-status.ok {
  background: var(--mini-primary-light);
  color: var(--mini-primary-dark);
}

.footer-count {
  margin-left: 4px;
  font-weight: 600;
  opacity: 0.85;
}
</style>
