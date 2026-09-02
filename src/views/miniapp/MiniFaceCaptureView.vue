<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { UserFilled } from '@element-plus/icons-vue'
import MiniNavBack from '@/components/miniapp/MiniNavBack.vue'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import { useMiniAppAuth } from '@/composables/useMiniAppAuth'
import { useAppStore } from '@/stores/app'

const router = useRouter()
const route = useRoute()
const store = useAppStore()
const { employeeId } = useMiniAppWorker()
const { refreshOnboardingStatus } = useMiniAppAuth()

const phase = ref<'intro' | 'scanning' | 'success' | 'failed'>('intro')
const progress = ref(0)
let timer: ReturnType<typeof setInterval> | undefined

const fromOnboarding = computed(() => route.query.from === 'onboarding')
const redirectAfter = computed(() => {
  const raw = route.query.redirect
  return typeof raw === 'string' && raw.startsWith('/miniapp') ? raw : ''
})
const backPath = computed(() => {
  if (fromOnboarding.value) return '/miniapp/onboarding?step=face'
  if (redirectAfter.value) return redirectAfter.value
  return '/miniapp/face-verify'
})

function startScan() {
  phase.value = 'scanning'
  progress.value = 0
  timer = setInterval(() => {
    progress.value = Math.min(100, progress.value + 8)
    if (progress.value >= 100) {
      clearInterval(timer)
      timer = undefined
      store.completeWorkerFaceVerify(employeeId.value, true)
      refreshOnboardingStatus()
      phase.value = 'success'
      ElMessage.success('人脸识别通过')
    }
  }, 180)
}

function simulateFail() {
  if (timer) clearInterval(timer)
  store.completeWorkerFaceVerify(employeeId.value, false)
  phase.value = 'failed'
  ElMessage.error('识别未通过，请重试')
}

function handleDone() {
  if (fromOnboarding.value) {
    router.replace('/miniapp/onboarding?step=profile')
    return
  }
  if (redirectAfter.value) {
    router.replace(redirectAfter.value)
    return
  }
  router.replace('/miniapp/face-verify')
}

onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div class="capture-page">
    <div class="mini-nav-bar">
      <MiniNavBack :fallback="backPath" />
      <div class="mini-nav-title">人脸识别</div>
    </div>

    <div class="capture-body">
      <div v-if="phase === 'intro'" class="intro-block">
        <div class="face-ring">
          <el-icon :size="48" color="#4FD1C5"><UserFilled /></el-icon>
        </div>
        <h3>请进行真人核验</h3>
        <p>请将面部置于框内，保持光线充足、正对屏幕</p>
        <ul class="tips">
          <li>请勿佩戴帽子、口罩遮挡面部</li>
          <li>核验通过后可正常接单上岗</li>
        </ul>
        <button class="mini-btn-primary start-btn" type="button" @click="startScan">开始识别</button>
      </div>

      <div v-else-if="phase === 'scanning'" class="scan-block">
        <div class="face-ring scanning">
          <div class="scan-line" />
          <el-icon :size="48" color="#fff"><UserFilled /></el-icon>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" :style="{ width: `${progress}%` }" />
        </div>
        <p class="scan-text">识别中… {{ progress }}%</p>
        <button type="button" class="fail-demo" @click="simulateFail">模拟识别失败</button>
      </div>

      <div v-else-if="phase === 'success'" class="result-block success">
        <div class="result-icon">✓</div>
        <h3>核验通过</h3>
        <p>您的真人身份已确认，可进行后续操作</p>
        <button class="mini-btn-primary start-btn" type="button" @click="handleDone">继续</button>
      </div>

      <div v-else class="result-block failed">
        <div class="result-icon fail">!</div>
        <h3>核验未通过</h3>
        <p>请调整光线和角度后重新识别</p>
        <button class="mini-btn-primary start-btn" type="button" @click="phase = 'intro'">重新识别</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.capture-page {
  min-height: 100%;
  background: #0f172a;
  color: #fff;
}

.capture-page :deep(.mini-nav-bar) {
  background: transparent;
  color: #fff;
}

.capture-page :deep(.mini-nav-back) {
  color: #fff;
}

.capture-body {
  padding: 24px 20px 40px;
  text-align: center;
}

.face-ring {
  width: 200px;
  height: 200px;
  margin: 0 auto 24px;
  border-radius: 50%;
  border: 3px solid rgba(79, 209, 197, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(79, 209, 197, 0.12);
  position: relative;
  overflow: hidden;
}

.face-ring.scanning {
  border-color: var(--mini-primary);
  background: rgba(34, 197, 94, 0.15);
}

.scan-line {
  position: absolute;
  left: 0;
  right: 0;
  height: 3px;
  background: linear-gradient(90deg, transparent, var(--mini-primary), transparent);
  animation: scan 1.6s linear infinite;
}

@keyframes scan {
  0% { top: 10%; }
  100% { top: 90%; }
}

.intro-block h3,
.result-block h3 {
  margin: 0 0 8px;
  font-size: 20px;
}

.intro-block p,
.result-block p {
  margin: 0;
  font-size: 14px;
  color: rgba(255, 255, 255, 0.75);
  line-height: 1.6;
}

.tips {
  margin: 20px 0 28px;
  padding-left: 18px;
  text-align: left;
  font-size: 13px;
  color: rgba(255, 255, 255, 0.65);
  line-height: 1.8;
}

.start-btn {
  width: 100%;
  max-width: 280px;
}

.progress-bar {
  height: 6px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.15);
  overflow: hidden;
  margin: 0 auto 12px;
  max-width: 240px;
}

.progress-fill {
  height: 100%;
  background: var(--mini-primary);
  transition: width 0.15s linear;
}

.scan-text {
  font-size: 14px;
  color: rgba(255, 255, 255, 0.8);
}

.fail-demo {
  margin-top: 20px;
  border: none;
  background: none;
  color: rgba(255, 255, 255, 0.45);
  font-size: 12px;
  cursor: pointer;
}

.result-icon {
  width: 72px;
  height: 72px;
  margin: 40px auto 16px;
  border-radius: 50%;
  background: var(--mini-primary);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36px;
  font-weight: 700;
}

.result-icon.fail {
  background: #ef4444;
}

.result-block .start-btn {
  margin-top: 28px;
}
</style>
