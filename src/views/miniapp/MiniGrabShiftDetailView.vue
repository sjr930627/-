<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import { getGrabShiftPostExtra, getGrabShiftSlotExtra } from '@/mock/miniappDetailSeed'

const route = useRoute()
const router = useRouter()
const store = useAppStore()
const { employeeId } = useMiniAppWorker()

const teamId = computed(() => route.params.teamId as string)
const subscribed = ref(false)
const selectedSlotIds = ref<string[]>([])

const slots = computed(() =>
  store.grabShiftSlots
    .filter((s) => s.teamId === teamId.value && (s.status === 'open' || s.status === 'partial'))
    .map((s) => {
      const extra = getGrabShiftSlotExtra(s.id, s.date)
      const applied = store.grabShiftApplications.some(
        (a) => a.slotId === s.id && a.employeeId === employeeId.value,
      )
      const remain = s.requiredCount - s.grabbedCount
      return {
        ...s,
        ...extra,
        applied,
        remain,
        disabled: applied || remain <= 0,
        timeLabel: `${s.startTime}~${s.endTime}`,
      }
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime)),
)

const post = computed(() => {
  const first = slots.value[0]
  if (!first) return null
  return getGrabShiftPostExtra(teamId.value, first.teamName)
})

const attendanceGroupId = computed(() => slots.value[0]?.attendanceGroupId ?? '')

const isWhitelisted = computed(() =>
  store.isGrabShiftWhitelisted(employeeId.value, attendanceGroupId.value),
)

const displayTags = computed(() => {
  if (!post.value) return []
  return post.value.tags.filter((t) => t !== '免审核' || isWhitelisted.value)
})

const selectedCount = computed(() => selectedSlotIds.value.length)

function toggleSubscribe() {
  subscribed.value = !subscribed.value
  ElMessage.success(subscribed.value ? '已订阅班次动态' : '已取消订阅')
}

function toggleSlot(slotId: string, disabled: boolean) {
  if (disabled) return
  const idx = selectedSlotIds.value.indexOf(slotId)
  if (idx >= 0) {
    selectedSlotIds.value.splice(idx, 1)
  } else {
    selectedSlotIds.value.push(slotId)
  }
}

function applySelected() {
  if (selectedSlotIds.value.length === 0) {
    ElMessage.warning('请先选择班次')
    return
  }
  let ok = 0
  let auto = 0
  for (const slotId of selectedSlotIds.value) {
    try {
      const app = store.submitGrabShiftApplication({
        slotId,
        employeeId: employeeId.value,
        message: '小程序抢班报名',
      })
      ok += 1
      if (app.status === 'approved') auto += 1
    } catch (e) {
      ElMessage.warning(e instanceof Error ? e.message : '报名失败')
    }
  }
  if (ok > 0) {
    selectedSlotIds.value = []
    if (auto === ok) {
      ElMessage.success(`报名成功，${ok} 个班次已自动通过`)
    } else if (auto > 0) {
      ElMessage.success(`报名成功，${auto}/${ok} 个班次已自动通过，其余待审核`)
    } else {
      ElMessage.success(`报名成功，${ok} 个班次待审核`)
    }
  }
}
</script>

<template>
  <div class="detail-shell">
    <div class="mini-nav-bar">
      <button class="mini-nav-back" @click="router.back()">←</button>
      <div class="mini-nav-title">抢班详情</div>
    </div>

    <div v-if="post && slots.length" class="detail-body">
      <section class="detail-hero">
        <h1 class="detail-title">{{ post.title }}</h1>
        <div class="detail-tags">
          <span v-for="tag in displayTags" :key="tag" class="detail-tag">{{ tag }}</span>
        </div>
      </section>

      <section class="detail-location">
        <div class="detail-location-main">
          <div class="detail-store">{{ post.storeName }}</div>
          <div class="detail-address">{{ post.address }}</div>
          <div class="detail-commute">{{ post.distance }}，{{ post.commute }}</div>
        </div>
        <div class="detail-map-placeholder">🗺</div>
      </section>

      <div class="detail-insurance">
        <span class="detail-insurance-badge">免费保障</span>
        <span>免费享有出勤保险，保障服务期间人身安全</span>
      </div>

      <section class="detail-section">
        <div class="detail-section-head">
          <span class="detail-section-title">共{{ slots.length }}班次</span>
          <button type="button" class="detail-section-more">全部 ›</button>
        </div>
        <div class="detail-requirements">
          <span class="detail-req-icon">✓</span>
          <span>{{ post.requirements.join(' · ') }}</span>
        </div>
        <div class="shift-grid">
          <button
            v-for="slot in slots"
            :key="slot.id"
            type="button"
            class="shift-card"
            :class="{
              selected: selectedSlotIds.includes(slot.id),
              disabled: slot.disabled,
            }"
            @click="toggleSlot(slot.id, slot.disabled)"
          >
            <div class="shift-card-top">
              <span class="shift-date">{{ slot.dateLabel }}</span>
              <span v-if="selectedSlotIds.includes(slot.id)" class="shift-check">✓</span>
              <span v-else-if="slot.applied" class="shift-applied">已报</span>
            </div>
            <div class="shift-time">{{ slot.timeLabel }}</div>
            <div class="shift-duration">班{{ slot.durationHours }}h</div>
            <div class="shift-pay">¥{{ slot.pay }}</div>
          </button>
        </div>
      </section>

      <section class="detail-section">
        <div class="detail-section-head">
          <span class="detail-section-title">灵工到岗体验</span>
          <span class="detail-section-count">{{ post.reviewCount }}</span>
          <button type="button" class="detail-section-more">全部 ›</button>
        </div>
        <div class="detail-review-tags">
          <span v-for="t in post.reviewTags" :key="t.label" class="detail-review-tag">
            {{ t.label }} {{ t.count }}
          </span>
        </div>
        <div v-for="rv in post.reviews" :key="rv.id" class="detail-review-card">
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
    </div>

    <div v-else class="mini-empty">暂无可用班次</div>

    <footer v-if="post && slots.length" class="detail-footer detail-footer-shift">
      <div class="shift-footer-top">已选{{ selectedCount }}个班次</div>
      <div class="shift-footer-actions">
        <button type="button" class="detail-footer-icon" @click="toggleSubscribe">
          <span>{{ subscribed ? '❤️' : '🤍' }}</span>
          <span>订阅</span>
        </button>
        <button
          type="button"
          class="detail-footer-primary"
          :disabled="selectedCount === 0"
          @click="applySelected"
        >
          报名
        </button>
      </div>
    </footer>
  </div>
</template>

<style scoped>
.detail-shell {
  min-height: 100%;
  background: #f5f6f8;
  padding-bottom: calc(80px + env(safe-area-inset-bottom, 0px));
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
  color: var(--app-primary);
  background: var(--app-primary-light);
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

.detail-section-count {
  font-size: 14px;
  color: #999;
}

.detail-section-more {
  margin-left: auto;
  border: none;
  background: none;
  color: var(--app-primary);
  font-size: 13px;
  cursor: pointer;
}

.detail-requirements {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-bottom: 12px;
  font-size: 12px;
  color: #666;
  line-height: 1.5;
}

.detail-req-icon {
  color: var(--app-primary);
  font-weight: 700;
}

.shift-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.shift-card {
  position: relative;
  padding: 12px;
  border: 2px solid #eee;
  border-radius: 10px;
  background: #fff;
  text-align: left;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.shift-card.selected {
  border-color: var(--app-primary);
  background: var(--app-primary-light);
}

.shift-card.disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.shift-card-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
}

.shift-date {
  font-size: 12px;
  color: #333;
  font-weight: 600;
}

.shift-check {
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: var(--app-primary);
  color: #fff;
  font-size: 11px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}

.shift-applied {
  font-size: 10px;
  color: #999;
}

.shift-time {
  margin-top: 6px;
  font-size: 13px;
  color: #333;
}

.shift-duration {
  margin-top: 4px;
  font-size: 11px;
  color: #999;
}

.shift-pay {
  margin-top: 8px;
  font-size: 18px;
  font-weight: 700;
  color: var(--app-primary);
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

.detail-footer-shift {
  flex-direction: column;
  align-items: stretch;
  gap: 8px;
}

.shift-footer-top {
  font-size: 12px;
  color: #666;
  text-align: center;
}

.shift-footer-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.detail-footer {
  position: fixed;
  left: 50%;
  transform: translateX(-50%);
  bottom: 0;
  width: 100%;
  max-width: 430px;
  padding: 10px 12px calc(10px + env(safe-area-inset-bottom, 0px));
  background: #fff;
  border-top: 1px solid #eee;
  box-sizing: border-box;
  z-index: 20;
}

.detail-footer-icon {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-width: 44px;
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
  flex: 1;
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
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
