<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import { getJobDetailExtra } from '@/mock/miniappDetailSeed'

const route = useRoute()
const router = useRouter()
const store = useAppStore()
const { employeeId } = useMiniAppWorker()
const subscribed = ref(false)

const job = computed(() => store.jobRequirements.find((j) => j.id === route.params.id))

const extra = computed(() => {
  if (!job.value) return null
  return getJobDetailExtra(job.value.id, {
    storeName: job.value.enterpriseName,
    location: job.value.location,
  })
})

const applied = computed(() =>
  store.miniJobApplications.some(
    (a) => a.employeeId === employeeId.value && a.jobRequirementId === route.params.id,
  ),
)

const salaryLabel = computed(() => {
  if (!extra.value) return ''
  return `¥${extra.value.hourlyMin}~${extra.value.hourlyMax}/小时`
})

function toggleSubscribe() {
  subscribed.value = !subscribed.value
  ElMessage.success(subscribed.value ? '已订阅岗位动态' : '已取消订阅')
}

function showPromo() {
  ElMessage.info('活动详情（演示）')
}

function chatOnline() {
  ElMessage.info('在线沟通（演示）')
}

function apply() {
  if (!job.value) return
  try {
    store.applyForJob(employeeId.value, job.value.id)
    ElMessage.success('报名成功，请等待审核')
  } catch (e) {
    ElMessage.warning(e instanceof Error ? e.message : '报名失败')
  }
}
</script>

<template>
  <div class="detail-shell">
    <div class="mini-nav-bar">
      <button class="mini-nav-back" @click="router.back()">←</button>
      <div class="mini-nav-title">岗位详情</div>
    </div>

    <div v-if="job && extra" class="detail-body">
      <section class="detail-hero">
        <h1 class="detail-title">{{ job.title }}</h1>
        <div class="detail-tags">
          <span v-for="tag in extra.tags" :key="tag" class="detail-tag">{{ tag }}</span>
        </div>
        <div class="detail-salary">{{ salaryLabel }}</div>
      </section>

      <div v-if="extra.promoText" class="detail-promo" @click="showPromo">
        <span>{{ extra.promoText }}</span>
        <span class="detail-promo-arrow">›</span>
      </div>

      <section class="detail-location">
        <div class="detail-location-main">
          <div class="detail-store">{{ extra.storeName }}</div>
          <div class="detail-address">{{ extra.address }}</div>
          <div class="detail-commute">{{ extra.distance }}，{{ extra.commute }}</div>
        </div>
        <div class="detail-map-placeholder">🗺</div>
      </section>

      <div class="detail-insurance">
        <span class="detail-insurance-badge">免费保障</span>
        <span>免费享有出勤保险，保障服务期间人身安全</span>
      </div>

      <section class="detail-section">
        <div class="detail-section-head">
          <span class="detail-section-title">灵工到岗体验</span>
          <span class="detail-section-count">{{ extra.reviewCount }}</span>
          <button type="button" class="detail-section-more">全部 ›</button>
        </div>
        <div class="detail-review-tags">
          <span v-for="t in extra.reviewTags" :key="t.label" class="detail-review-tag">
            {{ t.label }} {{ t.count }}
          </span>
        </div>
        <div v-for="rv in extra.reviews" :key="rv.id" class="detail-review-card">
          <p class="detail-review-text">“{{ rv.text }}”</p>
          <div class="detail-review-foot">
            <div class="detail-review-user">
              <span class="detail-avatar">{{ rv.userName.slice(0, 1) }}</span>
              <span>{{ rv.userName }}</span>
              <span class="detail-review-badge">该品牌出勤{{ rv.brandCount }}次</span>
            </div>
            <span v-if="rv.imageCount" class="detail-review-img">+{{ rv.imageCount }}</span>
          </div>
        </div>
      </section>

      <section class="detail-section">
        <div class="detail-section-title solo">您将享受的福利</div>
        <div class="detail-benefits">
          <div v-for="b in extra.benefits" :key="b.title" class="detail-benefit">
            <span class="detail-benefit-icon">{{ b.icon }}</span>
            <div>
              <div class="detail-benefit-title">{{ b.title }}</div>
              <div class="detail-benefit-desc">{{ b.desc }}</div>
            </div>
          </div>
        </div>
        <div v-if="extra.bonusText" class="detail-bonus-box">
          🎁 {{ extra.bonusText }}
        </div>
      </section>

      <section class="detail-section">
        <div class="detail-section-title solo">岗位描述</div>
        <p class="detail-desc">{{ job.description }}</p>
        <div class="detail-meta-line">
          招聘 {{ job.headcount }} 人 · 已招 {{ job.filledCount }} 人 · {{ job.department }}
        </div>
      </section>
    </div>

    <div v-else class="mini-empty">岗位不存在</div>

    <footer v-if="job" class="detail-footer detail-footer-3">
      <button type="button" class="detail-footer-icon" @click="toggleSubscribe">
        <span>{{ subscribed ? '❤️' : '🤍' }}</span>
        <span>订阅</span>
      </button>
      <button type="button" class="detail-footer-icon" @click="chatOnline">
        <span>💬</span>
        <span>在线沟通</span>
      </button>
      <button
        type="button"
        class="detail-footer-primary"
        :disabled="applied"
        @click="apply"
      >
        {{ applied ? '已报名' : '立即报名' }}
      </button>
    </footer>
  </div>
</template>

<style scoped>
.detail-shell {
  min-height: 100%;
  background: #f5f6f8;
  padding-bottom: calc(72px + env(safe-area-inset-bottom, 0px));
}

.detail-body {
  padding: 0 0 12px;
}

.detail-hero {
  background: #fff;
  padding: 16px 16px 12px;
}

.detail-title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: #1a1a1a;
  line-height: 1.35;
}

.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.detail-tag {
  padding: 2px 8px;
  border-radius: 4px;
  font-size: 11px;
  color: #666;
  background: #f5f5f5;
}

.detail-salary {
  margin-top: 12px;
  font-size: 22px;
  font-weight: 700;
  color: #e60012;
}

.detail-promo {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 10px 12px 0;
  padding: 10px 12px;
  border-radius: 8px;
  background: linear-gradient(90deg, #fff5f5, #fff);
  border: 1px solid #ffe0e0;
  font-size: 12px;
  color: #e60012;
}

.detail-promo-arrow {
  font-size: 18px;
  opacity: 0.6;
}

.detail-location {
  display: flex;
  gap: 12px;
  margin: 10px 12px 0;
  padding: 14px;
  background: #fff;
  border-radius: 12px;
}

.detail-store {
  font-size: 15px;
  font-weight: 600;
  color: #333;
}

.detail-address,
.detail-commute {
  margin-top: 6px;
  font-size: 12px;
  color: #999;
  line-height: 1.5;
}

.detail-map-placeholder {
  width: 72px;
  height: 72px;
  border-radius: 8px;
  background: #f0f2f5;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  flex-shrink: 0;
}

.detail-insurance {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 10px 12px 0;
  padding: 10px 12px;
  background: var(--app-primary-light);
  border-radius: 8px;
  font-size: 12px;
  color: #333;
}

.detail-insurance-badge {
  padding: 2px 6px;
  border-radius: 4px;
  background: var(--app-primary);
  color: #fff;
  font-size: 11px;
  font-weight: 600;
  flex-shrink: 0;
}

.detail-section {
  margin: 10px 12px 0;
  padding: 14px;
  background: #fff;
  border-radius: 12px;
}

.detail-section-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
}

.detail-section-title {
  font-size: 16px;
  font-weight: 700;
  color: #1a1a1a;
}

.detail-section-title.solo {
  margin-bottom: 12px;
}

.detail-section-count {
  font-size: 14px;
  color: #999;
}

.detail-section-more {
  margin-left: auto;
  border: none;
  background: none;
  color: #999;
  font-size: 13px;
  cursor: pointer;
}

.detail-review-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 12px;
}

.detail-review-tag {
  padding: 4px 10px;
  border-radius: 999px;
  background: #f5f5f5;
  font-size: 12px;
  color: #666;
}

.detail-review-card {
  padding: 12px 0;
  border-top: 1px solid #f5f5f5;
}

.detail-review-text {
  margin: 0;
  font-size: 14px;
  color: #333;
  line-height: 1.6;
}

.detail-review-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 10px;
}

.detail-review-user {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #666;
}

.detail-avatar {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #ffe8e8;
  color: #e60012;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 600;
}

.detail-review-badge {
  padding: 1px 6px;
  border-radius: 4px;
  background: #f5f5f5;
  font-size: 10px;
}

.detail-review-img {
  padding: 4px 8px;
  border-radius: 6px;
  background: #f0f0f0;
  font-size: 11px;
  color: #999;
}

.detail-benefits {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}

.detail-benefit {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}

.detail-benefit-icon {
  font-size: 20px;
}

.detail-benefit-title {
  font-size: 13px;
  font-weight: 600;
  color: #333;
}

.detail-benefit-desc {
  margin-top: 2px;
  font-size: 11px;
  color: #999;
  line-height: 1.4;
}

.detail-bonus-box {
  margin-top: 12px;
  padding: 10px 12px;
  border-radius: 8px;
  background: #fff5f5;
  font-size: 13px;
  color: #e60012;
}

.detail-desc {
  margin: 0;
  font-size: 14px;
  color: #666;
  line-height: 1.7;
}

.detail-meta-line {
  margin-top: 10px;
  font-size: 12px;
  color: #999;
}

.detail-footer {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: 0;
  width: 100%;
  max-width: 430px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px calc(10px + env(safe-area-inset-bottom, 0px));
  background: #fff;
  border-top: 1px solid #eee;
  box-sizing: border-box;
  z-index: 20;
}

.detail-footer-3 .detail-footer-primary {
  flex: 1;
}

.detail-footer-icon {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-width: 48px;
  border: none;
  background: none;
  font-size: 10px;
  color: #666;
  cursor: pointer;
}

.detail-footer-icon span:first-child {
  font-size: 18px;
}

.detail-footer-primary {
  padding: 12px 16px;
  border: none;
  border-radius: 24px;
  background: var(--app-primary);
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
}

.detail-footer-primary:disabled {
  background: #ccc;
  cursor: not-allowed;
}
</style>
