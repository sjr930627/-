<script setup lang="ts">
import { useRouter } from 'vue-router'
import MiniNavBack from '@/components/miniapp/MiniNavBack.vue'
import { useMiniFaceVerifyStatus } from '@/composables/useMiniFaceVerifyStatus'
import { faceVerifyIntro, faceVerifyRuleGroups, formatIncomeDateTime } from '@/constants/miniapp'

const router = useRouter()
const { status, statusMeta, isVerified, verifiedAt } = useMiniFaceVerifyStatus()

function startCapture() {
  router.push('/miniapp/face-verify/capture')
}
</script>

<template>
  <div class="face-verify-page">
    <div class="mini-nav-bar">
      <MiniNavBack fallback="/miniapp/profile" />
      <div class="mini-nav-title">真人核验</div>
    </div>

    <div class="mini-page">
      <div class="mini-card status-card">
        <div
          class="status-badge"
          :style="{ background: statusMeta.bg, color: statusMeta.color }"
        >
          {{ statusMeta.label }}
        </div>
        <p class="intro">{{ faceVerifyIntro }}</p>
        <div v-if="isVerified && verifiedAt" class="verified-at">
          最近核验通过：{{ formatIncomeDateTime(verifiedAt) }}
        </div>
        <div v-else-if="status === 'pending'" class="verified-at pending-tip">
          请在打卡时完成人脸识别，核验通过后状态将自动更新。
        </div>
        <div v-else-if="status === 'failed'" class="verified-at fail-tip">
          最近一次核验未通过，请重新打卡或前往补卡/申诉。
        </div>
        <div v-else-if="status === 'unverified'" class="verified-at pending-tip">
          首次上岗前需完成真人核验，请进行人脸识别。
        </div>
        <button
          v-if="!isVerified"
          class="mini-btn-primary capture-btn"
          type="button"
          @click="startCapture"
        >
          开始人脸识别
        </button>
        <button
          v-else
          class="mini-btn-outline capture-btn"
          type="button"
          @click="startCapture"
        >
          重新核验
        </button>
      </div>

      <div class="mini-card rules-card">
        <div class="rules-title">人脸识别打卡规则总览</div>
        <div class="rules-grid">
          <div v-for="group in faceVerifyRuleGroups" :key="group.title" class="rule-block">
            <div class="rule-block-head">
              <span class="rule-step">{{ group.step }}</span>
              <span class="rule-block-title">{{ group.title }}</span>
            </div>
            <ul class="rule-list">
              <li v-for="item in group.items" :key="item">{{ item }}</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.face-verify-page {
  min-height: 100%;
  background: var(--mini-bg);
}

.status-badge {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 999px;
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 12px;
}

.intro {
  margin: 0;
  font-size: 14px;
  line-height: 1.65;
  color: var(--mini-text-secondary, #666);
}

.verified-at {
  margin-top: 12px;
  font-size: 12px;
  color: var(--mini-text-muted, #999);
}

.pending-tip {
  color: #ea580c;
}

.fail-tip {
  color: #dc2626;
}

.capture-btn {
  width: 100%;
  margin-top: 16px;
}

.rules-title {
  font-size: 15px;
  font-weight: 700;
  color: var(--mini-text, #333);
  margin-bottom: 14px;
}

.rules-grid {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.rule-block {
  border: 1px solid var(--mini-border, #eee);
  border-radius: 12px;
  padding: 12px;
  background: #fafafa;
}

.rule-block-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.rule-step {
  font-size: 13px;
  font-weight: 700;
  color: var(--mini-primary);
}

.rule-block-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--mini-text, #333);
}

.rule-list {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  line-height: 1.8;
  color: var(--mini-text-secondary, #666);
}
</style>
