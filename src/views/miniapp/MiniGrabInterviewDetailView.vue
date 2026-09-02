<script setup lang="ts">
import MiniNavBack from '@/components/miniapp/MiniNavBack.vue'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  ArrowRight,
  Clock,
  Document,
  Lock,
  OfficeBuilding,
  Top,
} from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import { useMiniAppActionGate } from '@/composables/useMiniAppActionGate'
import { seedDepartments } from '@/mock/seed'
import {
  formatGrabPositionAgeRange,
  formatGrabPositionGender,
} from '@/services/grabShift'
import {
  findGrabInterviewPost,
  listInterviewSlotsForPost,
  type MiniGrabInterviewSlotPreview,
} from '@/services/miniGrabInterview'
import type { GrabInterviewWeekday } from '@/types'

const route = useRoute()
const router = useRouter()
const store = useAppStore()
const { employeeId, employee } = useMiniAppWorker()
const { ensureActionAllowed } = useMiniAppActionGate()

const postId = computed(() => decodeURIComponent(String(route.params.postId || '')))
const showAllSlots = ref(false)
const selectedSlotId = ref<string | null>(null)
const reqExpanded = ref(true)

const post = computed(() => findGrabInterviewPost(store, postId.value, employeeId.value))

const department = computed(() =>
  post.value
    ? store.departments.find((d) => d.id === post.value!.departmentId)
    : undefined,
)

const departmentImageUrl = computed(() => {
  if (!post.value) return ''
  const seedDept = seedDepartments.find((d) => d.id === post.value!.departmentId)
  return department.value?.imageUrl?.trim() || seedDept?.imageUrl?.trim() || ''
})

const departmentName = computed(
  () => department.value?.name || post.value?.storeName || '',
)

const positionProfile = computed(() => post.value?.profile ?? null)

function parsePositionRequirement(text?: string) {
  if (!text?.trim()) return null
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  if (!lines.length) return null
  return {
    intro: lines[0],
    duties: lines.length > 1 ? lines.slice(1) : [],
  }
}

const requirementDetail = computed(() => {
  const fromProfile = parsePositionRequirement(positionProfile.value?.requirements)
  if (fromProfile) return fromProfile
  return { intro: '', duties: [] as string[] }
})

const skillRequirements = computed(() => positionProfile.value?.skills ?? [])

const slots = computed(() => {
  if (!post.value) return [] as MiniGrabInterviewSlotPreview[]
  return listInterviewSlotsForPost(store, post.value, employeeId.value)
})

const visibleSlots = computed(() =>
  showAllSlots.value ? slots.value : slots.value.slice(0, 6),
)

const processSteps = [
  {
    title: '选择时间',
    desc: '免筛简历，锁定名额',
    icon: Clock,
  },
  {
    title: '线下面试',
    desc: '奖励秒结，等待评估',
    icon: Document,
  },
  {
    title: '日常抢班',
    desc: '通过后，优先报名',
    icon: Top,
  },
]

watch(
  slots,
  (list) => {
    const fromQuery = typeof route.query.slot === 'string' ? route.query.slot : ''
    if (fromQuery && list.some((s) => s.id === fromQuery && !s.disabled)) {
      selectedSlotId.value = fromQuery
      return
    }
    if (selectedSlotId.value && list.some((s) => s.id === selectedSlotId.value && !s.disabled)) {
      return
    }
    const first = list.find((s) => !s.disabled)
    selectedSlotId.value = first?.id ?? null
  },
  { immediate: true },
)

const selectedSlot = computed(() =>
  slots.value.find((s) => s.id === selectedSlotId.value) ?? null,
)

function selectSlot(slot: MiniGrabInterviewSlotPreview) {
  if (slot.disabled) return
  selectedSlotId.value = slot.id
}

function openInsurance() {
  ElMessage.info('出勤保险说明（演示）')
}

function openProcessDetail() {
  ElMessage.info('抢班直面流程说明：选时锁定名额 → 线下面试评估 → 通过后优先抢班')
}

function openStarBenefit() {
  ElMessage.info('企业星级灵工权益：面试通过后可享受优先抢班等星级福利（演示）')
}

async function submitRegistration() {
  if (!post.value) return
  if (!selectedSlot.value) {
    ElMessage.warning('请先选择面试时间')
    return
  }
  if (selectedSlot.value.disabled) {
    ElMessage.warning(selectedSlot.value.applied ? '该时段已报名' : '该时段名额已满')
    return
  }

  const allowed = await ensureActionAllowed({
    requireDepartment: false,
    enterpriseId: post.value.enterpriseId,
    from: 'grab',
  })
  if (!allowed) return

  const name = employee.value?.name?.trim() || '灵工用户'
  const phone = employee.value?.phone?.trim() || '13800000000'

  try {
    store.addGrabInterviewRegistration({
      enterpriseId: post.value.enterpriseId,
      departmentId: post.value.departmentId,
      name,
      phone,
      position: post.value.positionName,
      interviewDate: selectedSlot.value.date,
      timeSlotId: selectedSlot.value.timeSlotId,
      timeSlotLabel: selectedSlot.value.timeSlotLabel,
      interviewExactTime: selectedSlot.value.interviewExactTime,
      weekday: selectedSlot.value.weekday as GrabInterviewWeekday,
      employeeId: employeeId.value,
      status: 'pending',
    })
    ElMessage.success('报名成功，请按时参加面试')
    router.replace({
      path: `/miniapp/recommend/interview/${encodeURIComponent(postId.value)}`,
    })
  } catch (e) {
    ElMessage.warning(e instanceof Error ? e.message : '报名失败')
  }
}
</script>

<template>
  <div class="detail-shell">
    <div class="mini-nav-bar">
      <MiniNavBack fallback="/miniapp/recommend?tab=shifts" />
      <div class="mini-nav-title">抢班直面</div>
    </div>

    <div v-if="post" class="detail-body">
      <section class="detail-cover" aria-label="部门图片">
        <img
          v-if="departmentImageUrl"
          :src="departmentImageUrl"
          :alt="departmentName"
          class="detail-cover-img"
        >
        <div v-else class="detail-cover-placeholder">
          <span>{{ departmentName }}</span>
        </div>
      </section>

      <section class="detail-hero">
        <h1 class="hero-title">{{ post.title }}</h1>
        <div class="hero-tags">
          <span
            v-for="tag in post.tags"
            :key="tag"
            class="mini-tag"
            :class="{
              blue: tag === '抢班直面' || tag === '直面',
              green: tag === '免审核',
            }"
          >
            {{ tag }}
          </span>
        </div>
        <div class="hero-pay">
          ¥{{ post.payMin }}~{{ post.payMax }}
          <span class="hero-pay-unit">{{ post.payUnit }}</span>
          <span class="hero-pay-hint">{{ post.payHint }}</span>
        </div>
      </section>

      <section class="detail-location">
        <div class="detail-location-main">
          <div class="detail-store">{{ post.storeName }}</div>
          <div class="detail-address">{{ post.locationMain }}</div>
          <div class="detail-commute">{{ post.locationSide }}</div>
        </div>
        <div class="detail-map-placeholder">🗺</div>
      </section>

      <section class="panel">
        <div class="panel-head">
          <span class="panel-title">报名抢班直面流程</span>
          <button type="button" class="panel-link" @click="openProcessDetail">
            详情
            <el-icon :size="12"><ArrowRight /></el-icon>
          </button>
        </div>
        <div class="process-row">
          <div
            v-for="(step, idx) in processSteps"
            :key="step.title"
            class="process-step"
          >
            <div class="process-icon">
              <el-icon :size="18"><component :is="step.icon" /></el-icon>
            </div>
            <div class="process-title">{{ step.title }}</div>
            <div class="process-desc">{{ step.desc }}</div>
            <div v-if="idx < processSteps.length - 1" class="process-arrow">›</div>
          </div>
        </div>
      </section>

      <button type="button" class="insurance-bar" @click="openInsurance">
        <span class="insurance-badge">免费保险</span>
        <span class="insurance-text">免费享受出勤保险，保障服务期间人身安全</span>
        <el-icon :size="14" class="insurance-chevron"><ArrowRight /></el-icon>
      </button>

      <section class="panel">
        <div class="panel-head">
          <span class="panel-title">选择面试时间</span>
          <button
            type="button"
            class="panel-link"
            @click="showAllSlots = !showAllSlots"
          >
            {{ showAllSlots ? '收起' : '全部' }}
            <el-icon :size="12"><ArrowRight /></el-icon>
          </button>
        </div>
        <div class="req-line">
          <span class="req-dot" />
          {{ post.requirementsLine }}
        </div>
        <div class="slot-scroll">
          <button
            v-for="slot in visibleSlots"
            :key="slot.id"
            type="button"
            class="slot-card"
            :class="{
              selected: selectedSlotId === slot.id,
              disabled: slot.disabled,
              applied: slot.applied,
            }"
            @click="selectSlot(slot)"
          >
            <div class="slot-date">{{ slot.dateLabel }}</div>
            <div class="slot-time">{{ slot.timeRange }}</div>
            <div class="slot-duration">{{ slot.remain }}/{{ slot.seats }}</div>
            <div class="slot-income">
              {{ slot.applied ? '已报名' : slot.disabled ? '已满' : slot.incomeLabel }}
              <el-icon v-if="!slot.disabled" :size="12"><ArrowRight /></el-icon>
            </div>
          </button>
        </div>
      </section>

      <section class="panel">
        <div class="panel-title solo">此岗位开放星级权益</div>
        <button type="button" class="star-card" @click="openStarBenefit">
          <div class="star-left">
            <div class="star-icon">
              <el-icon :size="18"><OfficeBuilding /></el-icon>
            </div>
            <span>企业星级灵工</span>
          </div>
          <div class="star-right">
            <el-icon :size="12" class="star-lock"><Lock /></el-icon>
            <span>1项权益</span>
            <el-icon :size="12"><ArrowRight /></el-icon>
          </div>
        </button>
      </section>

      <section class="panel">
        <div class="panel-title solo">岗位信息</div>
        <div class="profile-rows">
          <div class="rule-row">
            <span class="rule-label">岗位类型</span>
            <span class="rule-value">{{ positionProfile?.jobType || '—' }}</span>
          </div>
          <div class="rule-row">
            <span class="rule-label">年龄</span>
            <span class="rule-value">{{ formatGrabPositionAgeRange(positionProfile?.ageMin, positionProfile?.ageMax) }}</span>
          </div>
          <div class="rule-row">
            <span class="rule-label">性别</span>
            <span class="rule-value">{{ formatGrabPositionGender(positionProfile?.gender) }}</span>
          </div>
          <div class="rule-row">
            <span class="rule-label">经验</span>
            <span class="rule-value">{{ positionProfile?.experience || '不限' }}</span>
          </div>
        </div>
      </section>

      <section class="panel">
        <div class="panel-title solo">任职要求</div>
        <p v-if="requirementDetail.intro" class="req-intro">
          {{ requirementDetail.intro }}
        </p>
        <template v-if="reqExpanded && requirementDetail.duties.length">
          <div class="req-block">
            <div class="req-block-title">工作职责</div>
            <ol class="req-list">
              <li v-for="(item, idx) in requirementDetail.duties" :key="`d-${idx}`">
                {{ item }}
              </li>
            </ol>
          </div>
        </template>
        <button
          v-if="requirementDetail.duties.length"
          type="button"
          class="req-toggle"
          @click="reqExpanded = !reqExpanded"
        >
          {{ reqExpanded ? '收起' : '展开' }}
          <span class="req-toggle-icon">{{ reqExpanded ? '∧' : '∨' }}</span>
        </button>
        <p v-else-if="!requirementDetail.intro" class="text-muted-mini">暂无任职要求</p>
      </section>

      <section v-if="positionProfile?.description" class="panel">
        <div class="panel-title solo">岗位描述</div>
        <p class="req-intro">{{ positionProfile.description }}</p>
      </section>

      <section class="panel">
        <div class="panel-title solo">技能要求</div>
        <ol v-if="skillRequirements.length" class="req-list skill-list">
          <li v-for="(item, idx) in skillRequirements" :key="`s-${idx}`">
            {{ item }}
          </li>
        </ol>
        <p v-else class="text-muted-mini">暂无技能要求</p>
      </section>
    </div>

    <div v-else class="mini-empty">抢班直面岗位不存在或暂无可约时段</div>

    <footer v-if="post" class="detail-footer">
      <button
        type="button"
        class="detail-footer-primary"
        :disabled="!selectedSlot || selectedSlot.disabled"
        @click="submitRegistration"
      >
        {{ selectedSlot?.applied ? '已报名该时段' : '立即报名' }}
      </button>
    </footer>
  </div>
</template>

<style scoped>
.detail-shell {
  min-height: 100%;
  background: #f5f6f8;
  padding-bottom: calc(88px + env(safe-area-inset-bottom, 0px));
}

.detail-body {
  padding: 0 0 12px;
}

.detail-cover {
  width: 100%;
  aspect-ratio: 16 / 9;
  background: #e8eef5;
  overflow: hidden;
}

.detail-cover-img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: cover;
  object-position: center;
}

.detail-cover-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  box-sizing: border-box;
  background: linear-gradient(135deg, #E6FFFA 0%, #D5E9FF 100%);
  color: #64748b;
  font-size: 14px;
  font-weight: 600;
  text-align: center;
}

.detail-hero {
  background: #fff;
  padding: 16px 16px 12px;
}

.detail-location {
  display: flex;
  gap: 12px;
  margin: 10px 12px 0;
  padding: 14px;
  background: #fff;
  border-radius: 12px;
}

.detail-location-main {
  flex: 1;
  min-width: 0;
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

.hero-card,
.panel {
  margin: 10px 12px 0;
  padding: 14px;
  background: #fff;
  border-radius: 12px;
}

.hero-title {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #1a1a1a;
  line-height: 1.35;
}

.hero-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;
}

.hero-pay {
  margin-top: 12px;
  font-size: 20px;
  font-weight: 800;
  color: #ef4444;
  line-height: 1.2;
}

.hero-pay-unit {
  font-size: 13px;
  font-weight: 600;
}

.hero-pay-hint {
  margin-left: 2px;
  font-size: 12px;
  font-weight: 500;
  color: #999;
}

.hero-loc {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  margin-top: 10px;
  font-size: 12px;
  color: #999;
  line-height: 1.4;
}

.panel-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.panel-title {
  font-size: 16px;
  font-weight: 700;
  color: #1a1a1a;
}

.panel-title.solo {
  margin-bottom: 12px;
}

.panel-link {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  border: none;
  background: none;
  color: #999;
  font-size: 13px;
  cursor: pointer;
}

.process-row {
  display: flex;
  align-items: flex-start;
  gap: 4px;
}

.process-step {
  position: relative;
  flex: 1;
  min-width: 0;
  text-align: center;
  padding: 0 4px;
}

.process-icon {
  width: 36px;
  height: 36px;
  margin: 0 auto 8px;
  border-radius: 50%;
  background: #ecfdf5;
  color: #16a34a;
  display: flex;
  align-items: center;
  justify-content: center;
}

.process-title {
  font-size: 13px;
  font-weight: 700;
  color: #1a1a1a;
}

.process-desc {
  margin-top: 4px;
  font-size: 11px;
  color: #999;
  line-height: 1.35;
}

.process-arrow {
  position: absolute;
  top: 8px;
  right: -8px;
  color: #d1d5db;
  font-size: 18px;
  line-height: 1;
  pointer-events: none;
}

.insurance-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  width: calc(100% - 24px);
  margin: 10px 12px 0;
  padding: 10px 12px;
  border: none;
  border-radius: 8px;
  background: #ecfeff;
  text-align: left;
  cursor: pointer;
}

.insurance-badge {
  flex-shrink: 0;
  padding: 2px 6px;
  border-radius: 4px;
  background: #16a34a;
  color: #fff;
  font-size: 11px;
  font-weight: 700;
}

.insurance-text {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: #334155;
  line-height: 1.4;
}

.insurance-chevron {
  color: #94a3b8;
  flex-shrink: 0;
}

.req-line {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  margin-bottom: 12px;
  font-size: 12px;
  color: #666;
  line-height: 1.45;
}

.req-dot {
  width: 14px;
  height: 14px;
  margin-top: 1px;
  border-radius: 50%;
  background: #16a34a;
  flex-shrink: 0;
  position: relative;
}

.req-dot::after {
  content: '';
  position: absolute;
  inset: 3px;
  border-radius: 50%;
  border: 1.5px solid #fff;
}

.slot-scroll {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 2px;
  scrollbar-width: none;
}

.slot-scroll::-webkit-scrollbar {
  display: none;
}

.slot-card {
  flex: 0 0 132px;
  padding: 12px;
  border: 1px solid #f0f0f0;
  border-radius: 12px;
  background: #fff;
  box-shadow: 0 1px 4px rgba(15, 23, 42, 0.04);
  text-align: left;
  cursor: pointer;
}

.slot-card.selected {
  border-color: #16a34a;
  background: #f0fdf4;
}

.slot-card.disabled,
.slot-card.applied {
  opacity: 0.55;
  cursor: not-allowed;
}

.slot-date {
  font-size: 14px;
  font-weight: 700;
  color: #1a1a1a;
}

.slot-time {
  margin-top: 6px;
  font-size: 14px;
  font-weight: 700;
  color: #1a1a1a;
}

.slot-duration {
  margin-top: 4px;
  font-size: 12px;
  color: #999;
}

.slot-income {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  margin-top: 10px;
  font-size: 13px;
  font-weight: 700;
  color: #f97316;
}

.star-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  padding: 12px;
  border: 1px solid #f0f0f0;
  border-radius: 10px;
  background: #fafafa;
  cursor: pointer;
}

.star-left {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 14px;
  font-weight: 600;
  color: #1a1a1a;
}

.star-icon {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: #E6FFFA;
  color: #4FD1C5;
  display: flex;
  align-items: center;
  justify-content: center;
}

.star-right {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #999;
}

.star-lock {
  margin-right: 2px;
}

.profile-rows {
  display: flex;
  flex-direction: column;
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

.skill-list {
  padding-left: 18px;
}

.text-muted-mini {
  margin: 0;
  font-size: 13px;
  color: #999;
}

.req-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-top: 4px;
  border: none;
  background: none;
  color: var(--app-primary, #4FD1C5);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  padding: 0;
}

.req-toggle-icon {
  font-size: 12px;
}

.detail-footer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  padding: 10px 16px calc(10px + env(safe-area-inset-bottom, 0px));
  background: #fff;
  border-top: 1px solid #f0f0f0;
  z-index: 20;
}

.detail-footer-primary {
  width: 100%;
  height: 44px;
  border: none;
  border-radius: 999px;
  background: var(--mini-primary, #4FD1C5);
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
}

.detail-footer-primary:disabled {
  background: #e5e7eb;
  color: #9ca3af;
  cursor: not-allowed;
}
</style>
