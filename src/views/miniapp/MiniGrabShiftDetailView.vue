<script setup lang="ts">
import MiniNavBack from '@/components/miniapp/MiniNavBack.vue'
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import { useMiniAppActionGate } from '@/composables/useMiniAppActionGate'
import { getGrabShiftPostExtra, getGrabShiftSlotExtra } from '@/mock/miniappDetailSeed'
import { seedDepartments } from '@/mock/seed'
import {
  formatGrabPositionAgeRange,
  formatGrabPositionGender,
  isGrabSlotVisibleToWorker,
  resolveGrabSlotPositionProfile,
} from '@/services/grabShift'
import { resolveEnterpriseIdByAttendanceGroupId } from '@/utils/enterpriseScope'

const route = useRoute()
const router = useRouter()
const store = useAppStore()
const { employeeId } = useMiniAppWorker()
const { ensureActionAllowed } = useMiniAppActionGate()

const teamId = computed(() => route.params.teamId as string)
const subscribed = ref(false)
const selectedSlotIds = ref<string[]>([])

const worker = computed(() => store.employees.find((e) => e.id === employeeId.value))

const slots = computed(() =>
  store.grabShiftSlots
    .filter(
      (s) =>
        s.teamId === teamId.value &&
        isGrabSlotVisibleToWorker(s, worker.value, store.teams, store.departments),
    )
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

watch(
  slots,
  (list) => {
    const fromQuery = typeof route.query.slot === 'string' ? route.query.slot : ''
    if (
      fromQuery &&
      list.some((s) => s.id === fromQuery && !s.disabled) &&
      !selectedSlotIds.value.includes(fromQuery)
    ) {
      selectedSlotIds.value = [fromQuery]
    }
  },
  { immediate: true },
)

const post = computed(() => {
  const first = slots.value[0]
  if (!first) return null
  const extra = getGrabShiftPostExtra(teamId.value, first.teamName)
  const enterpriseId = resolveEnterpriseIdByAttendanceGroupId(
    first.attendanceGroupId,
    store.attendanceGroups,
    store.departments,
  )
  const enterpriseName =
    store.enterprises.find((e) => e.id === enterpriseId)?.name?.trim() ||
    extra.storeName
  const positionName = first.positionName?.trim() || extra.title

  const team = store.teams.find((t) => t.id === first.teamId)
  const departmentId = first.departmentId || team?.departmentId
  const department = departmentId
    ? store.departments.find((d) => d.id === departmentId)
    : undefined
  const seedDept = departmentId
    ? seedDepartments.find((d) => d.id === departmentId)
    : undefined

  return {
    ...extra,
    title: positionName,
    enterpriseName,
    orgLabel: `${enterpriseName} · ${first.departmentName || department?.name || extra.storeName}`,
    departmentImageUrl:
      department?.imageUrl?.trim() || seedDept?.imageUrl?.trim() || '',
    departmentName: first.departmentName || department?.name || extra.storeName,
  }
})

const attendanceGroupId = computed(() => slots.value[0]?.attendanceGroupId ?? '')

const isWhitelisted = computed(() =>
  store.isGrabShiftWhitelisted(employeeId.value, attendanceGroupId.value),
)

const displayTags = computed(() => {
  if (!post.value) return []
  return post.value.tags.filter((t) => t !== '免审核' || isWhitelisted.value)
})

const skillRequirements = computed(() => {
  const slot = slots.value[0]
  const profile = slot ? resolveGrabSlotPositionProfile(slot) : null
  if (profile?.skills?.length) return profile.skills
  if (slot?.requirements?.length) return slot.requirements
  return post.value?.skillRequirements ?? []
})

const positionProfile = computed(() => {
  const slot = slots.value[0]
  return slot ? resolveGrabSlotPositionProfile(slot) : null
})

const registrationTips: Array<{
  title: string
  body?: string
  items?: Array<{ label: string; value: string }>
}> = [
  {
    title: '1. 取消班次规则',
    body: '班次开始前可取消班次，但需要企业审批。',
  },
  {
    title: '2. 补卡规则',
    items: [
      { label: '补卡次数', value: '不限' },
      { label: '补卡时间', value: '工时确认前' },
    ],
  },
]

const selectedCount = computed(() => selectedSlotIds.value.length)

function toggleSubscribe() {
  subscribed.value = !subscribed.value
  ElMessage.success(subscribed.value ? '已订阅班次动态' : '已取消订阅')
}

const myApplication = computed(() => {
  const slotIds = new Set(slots.value.map((s) => s.id))
  return (
    store.grabShiftApplications
      .filter((a) => a.employeeId === employeeId.value && slotIds.has(a.slotId))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null
  )
})

function openMyApplication() {
  if (!myApplication.value) {
    ElMessage.info('暂无该岗位的报名记录')
    return
  }
  router.push(`/miniapp/applications/shift/${myApplication.value.id}`)
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

async function applySelected() {
  if (selectedSlotIds.value.length === 0) {
    ElMessage.warning('请先选择班次')
    return
  }
  const firstSlot = store.grabShiftSlots.find((s) => s.id === selectedSlotIds.value[0])
  const enterpriseId = firstSlot
    ? resolveEnterpriseIdByAttendanceGroupId(
        firstSlot.attendanceGroupId,
        store.attendanceGroups,
        store.departments,
      )
    : undefined
  const allowed = await ensureActionAllowed({
    requireDepartment: true,
    enterpriseId,
    from: 'grab',
  })
  if (!allowed) return

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
      <MiniNavBack fallback="/miniapp/recommend" />
      <div class="mini-nav-title">抢班详情</div>
    </div>

    <div v-if="post && slots.length" class="detail-body">
      <section class="detail-cover" aria-label="部门图片">
        <img
          v-if="post.departmentImageUrl"
          :src="post.departmentImageUrl"
          :alt="post.departmentName"
          class="detail-cover-img"
        >
        <div v-else class="detail-cover-placeholder">
          <span>{{ post.departmentName }}</span>
        </div>
      </section>

      <section
        class="detail-hero"
        :class="{ clickable: !!myApplication }"
        @click="openMyApplication"
      >
        <h1 class="detail-title">{{ post.title }}</h1>
        <div class="detail-tags">
          <span v-for="tag in displayTags" :key="tag" class="detail-tag">{{ tag }}</span>
        </div>
        <div v-if="myApplication" class="hero-app-hint">查看报名详情 ›</div>
      </section>

      <section class="detail-location">
        <div class="detail-store">{{ post.departmentName }}</div>
        <div class="detail-address">{{ post.address }}</div>
        <div class="detail-commute">
          <span>{{ post.distance }}</span>
          <span class="detail-commute-sep">·</span>
          <span>{{ post.commute }}</span>
        </div>
      </section>

      <div class="detail-insurance">
        <span class="detail-insurance-badge">免费保障</span>
        <span>免费享有出勤保险，保障服务期间人身安全</span>
      </div>

      <section class="detail-section">
        <div class="detail-section-head">
          <span class="detail-section-title">共{{ slots.length }}班次</span>
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
        <div class="detail-section-title solo">岗位信息</div>
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

      <section v-if="positionProfile?.description" class="detail-section">
        <div class="detail-section-title solo">岗位描述</div>
        <p class="req-intro">{{ positionProfile.description }}</p>
      </section>

      <section class="detail-section">
        <div class="detail-section-title solo">技能要求</div>
        <ol v-if="skillRequirements.length" class="req-list skill-list">
          <li v-for="(item, idx) in skillRequirements" :key="`s-${idx}`">
            {{ item }}
          </li>
        </ol>
        <p v-else class="text-muted-mini">暂无技能要求</p>
      </section>

      <section class="detail-section">
        <div class="detail-section-title solo">报名贴士</div>
        <div
          v-for="(group, gIdx) in registrationTips"
          :key="group.title"
          class="rule-group"
          :class="{ 'rule-group-divider': gIdx > 0 }"
        >
          <div class="rule-group-title">{{ group.title }}</div>
          <p v-if="group.body" class="rule-body">{{ group.body }}</p>
          <div v-for="item in group.items || []" :key="item.label" class="rule-row">
            <span class="rule-label">{{ item.label }}</span>
            <span class="rule-value">{{ item.value }}</span>
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

.detail-hero.clickable {
  cursor: pointer;
}

.detail-title {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: #1a1a1a;
  line-height: 1.35;
}

.hero-app-hint {
  margin-top: 8px;
  font-size: 12px;
  color: var(--mini-primary, #4fd1c5);
  font-weight: 500;
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

.detail-address {
  margin-top: 6px;
  font-size: 12px;
  color: #666;
  line-height: 1.5;
}

.detail-commute {
  margin-top: 6px;
  font-size: 12px;
  color: #999;
  line-height: 1.5;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
}

.detail-commute-sep {
  color: #ddd;
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
  color: var(--app-primary);
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

.rule-body {
  margin: 0;
  font-size: 13px;
  color: #666;
  line-height: 1.6;
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
  color: #ef4444;
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
