<script setup lang="ts">
import MiniNavBack from '@/components/miniapp/MiniNavBack.vue'
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import {
  getJobDetailExtra,
  shouldShowJobAttendance,
  shouldShowJobBenefits,
} from '@/mock/miniappDetailSeed'

const route = useRoute()
const store = useAppStore()
const { employeeId } = useMiniAppWorker()
const subscribed = ref(false)
const reqExpanded = ref(true)

const job = computed(() => store.jobRequirements.find((j) => j.id === route.params.id))

const extra = computed(() => {
  if (!job.value) return null
  return getJobDetailExtra(
    job.value.id,
    {
      storeName: job.value.enterpriseName,
      location: job.value.location,
    },
    job.value,
  )
})

const showAttendance = computed(() => (extra.value ? shouldShowJobAttendance(extra.value) : false))
const showBenefits = computed(() => (extra.value ? shouldShowJobBenefits(extra.value) : false))

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
      <MiniNavBack fallback="/miniapp/recommend" />
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
        <div class="detail-section-title solo">岗位要求</div>
        <p v-if="extra.requirementDetail.intro" class="req-intro">
          {{ extra.requirementDetail.intro }}
        </p>
        <template v-if="reqExpanded">
          <div class="req-block">
            <div class="req-block-title">工作职责</div>
            <ol class="req-list">
              <li v-for="(item, idx) in extra.requirementDetail.duties" :key="`d-${idx}`">
                {{ item }}
              </li>
            </ol>
          </div>
          <div class="req-block">
            <div class="req-block-title">任职资格</div>
            <ol class="req-list">
              <li
                v-for="(item, idx) in extra.requirementDetail.qualifications"
                :key="`q-${idx}`"
              >
                {{ item }}
              </li>
            </ol>
          </div>
        </template>
        <button type="button" class="req-toggle" @click="reqExpanded = !reqExpanded">
          {{ reqExpanded ? '收起' : '展开' }}
          <span class="req-toggle-icon">{{ reqExpanded ? '∧' : '∨' }}</span>
        </button>
      </section>

      <section v-if="showAttendance" class="detail-section">
        <div class="detail-section-title solo">出勤时间要求</div>
        <p class="section-sub">{{ extra.attendanceRequirement.subtitle }}</p>
        <div class="attendance-grid">
          <div class="attendance-item">
            <div class="attendance-icon orange">📅</div>
            <div class="attendance-label">期望兼职时长</div>
            <div class="attendance-value">{{ extra.attendanceRequirement.duration }}</div>
          </div>
          <div class="attendance-item">
            <div class="attendance-icon purple">7</div>
            <div class="attendance-label">每周出勤天数</div>
            <div class="attendance-value">{{ extra.attendanceRequirement.weeklyDays }}</div>
          </div>
          <div class="attendance-item">
            <div class="attendance-icon green">⏰</div>
            <div class="attendance-label">具体出勤时段</div>
            <div class="attendance-value">{{ extra.attendanceRequirement.timeSlots }}</div>
          </div>
        </div>
      </section>

      <section v-if="showBenefits" class="detail-section">
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
        <div class="detail-section-title solo">报名要求</div>
        <div
          v-for="(group, gIdx) in extra.registrationRules"
          :key="group.title"
          class="rule-group"
          :class="{ 'rule-group-divider': gIdx > 0 }"
        >
          <div class="rule-group-title">{{ group.title }}</div>
          <div v-for="item in group.items" :key="item.label" class="rule-row">
            <span class="rule-label">{{ item.label }}</span>
            <span class="rule-value">{{ item.value }}</span>
          </div>
          <p v-if="group.note" class="rule-note">注：{{ group.note }}</p>
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
  color: #ef4444;
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
  color: #ef4444;
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

.req-intro {
  margin: 0 0 12px;
  font-size: 14px;
  font-weight: 600;
  color: #333;
  line-height: 1.6;
}

.req-block {
  margin-bottom: 12px;
}

.req-block-title {
  font-size: 14px;
  font-weight: 600;
  color: #333;
  margin-bottom: 8px;
}

.req-list {
  margin: 0;
  padding-left: 18px;
  font-size: 13px;
  color: #666;
  line-height: 1.7;
}

.req-list li + li {
  margin-top: 6px;
}

.req-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  border: none;
  background: none;
  color: var(--app-primary);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  padding: 0;
}

.req-toggle-icon {
  font-size: 12px;
}

.section-sub {
  margin: -4px 0 14px;
  font-size: 12px;
  color: #999;
  line-height: 1.5;
}

.attendance-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.attendance-item {
  text-align: center;
}

.attendance-icon {
  width: 44px;
  height: 44px;
  margin: 0 auto 8px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 18px;
  font-weight: 700;
  color: #fff;
}

.attendance-icon.orange {
  background: linear-gradient(135deg, #fdba74, #fb923c);
}

.attendance-icon.purple {
  background: linear-gradient(135deg, #c4b5fd, #8b5cf6);
}

.attendance-icon.green {
  background: linear-gradient(135deg, #86efac, #22c55e);
}

.attendance-label {
  font-size: 11px;
  color: #999;
  line-height: 1.4;
}

.attendance-value {
  margin-top: 4px;
  font-size: 13px;
  font-weight: 700;
  color: #1a1a1a;
}

.rule-group-divider {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid #f0f0f0;
}

.rule-group-title {
  font-size: 14px;
  font-weight: 700;
  color: #1a1a1a;
  margin-bottom: 10px;
}

.rule-row {
  display: flex;
  justify-content: space-between;
  gap: 12px;
  padding: 6px 0;
  font-size: 13px;
  line-height: 1.5;
}

.rule-label {
  color: #666;
  flex-shrink: 0;
}

.rule-value {
  color: #999;
  text-align: right;
}

.rule-note {
  margin: 8px 0 0;
  font-size: 12px;
  color: #999;
  line-height: 1.5;
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
  color: #ef4444;
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
