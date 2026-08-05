<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import {
  ArrowRight,
  Document,
  Location,
  Medal,
  Operation,
  Postcard,
  Star,
  Switch,
  VideoCamera,
} from '@element-plus/icons-vue'
import MiniNavBack from '@/components/miniapp/MiniNavBack.vue'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import { MINIAPP_TIME_PREF_LABELS } from '@/constants/miniappAuth'
import type { WorkerBasicProof, WorkerPartTimePreference, WorkerSchedulePreference } from '@/types'

const router = useRouter()
const { profileExt } = useMiniAppWorker()

const schedulePreferences = computed(
  () => profileExt.value?.schedulePreferences ?? [],
)

const partTimePreference = computed(
  () => profileExt.value?.partTimePreference ?? {},
)

const basicProofs = computed(() => {
  const defaults: WorkerBasicProof[] = [
    { type: 'real_name', status: 'missing' },
    { type: 'health_cert', status: 'missing' },
  ]
  const fromProfile = profileExt.value?.basicProofs
  if (!fromProfile?.length) return defaults
  return defaults.map((item) => fromProfile.find((p) => p.type === item.type) ?? item)
})

const skillCertificates = computed(() => profileExt.value?.skillCertificates ?? [])

const completeness = computed(() => profileExt.value?.profileCompleteness ?? 20)

const addressText = computed(
  () => profileExt.value?.permanentAddress?.trim() || '暂未设置',
)

const partTimeRows = computed(() => {
  const pt = partTimePreference.value
  const rows: { key: string; label: string; value?: string }[] = []

  const timeKeys = ['timeOfDay', 'commitment', 'shiftDuration', 'workDays'] as const
  for (const key of timeKeys) {
    const choice = pt[key as keyof WorkerPartTimePreference]
    if (choice && typeof choice === 'string' && choice in MINIAPP_TIME_PREF_LABELS[key]) {
      rows.push({
        key,
        label: {
          timeOfDay: '时段偏好',
          commitment: '用工方式',
          shiftDuration: '班次时长',
          workDays: '工作日偏好',
        }[key],
        value: MINIAPP_TIME_PREF_LABELS[key][choice as 'left' | 'both' | 'right'],
      })
    }
  }

  rows.push(
    { key: 'favoriteJobs', label: '我喜欢的兼职是', value: pt.favoriteJobs },
    { key: 'wantedJobs', label: '我想做的兼职', value: pt.wantedJobs },
    { key: 'preferredBrands', label: '我想去的品牌', value: pt.preferredBrands },
  )

  return rows
})

function formatWeekdays(pref: WorkerSchedulePreference) {
  return pref.weekdays.join('、')
}

function calcHours(start: string, end: string) {
  const [sh, sm] = start.split(':').map(Number)
  const [eh, em] = end.split(':').map(Number)
  const minutes = eh * 60 + em - (sh * 60 + sm)
  return Math.max(0, Math.round(minutes / 60))
}

function formatTimeRange(pref: WorkerSchedulePreference) {
  const hours = calcHours(pref.startTime, pref.endTime)
  return `${pref.startTime} - ${pref.endTime} (${hours}小时)`
}

function proofLabel(type: WorkerBasicProof['type']) {
  return type === 'real_name' ? '实名认证' : '健康证'
}

function proofStatusText(proof: WorkerBasicProof) {
  if (proof.status === 'verified') return '已认证'
  if (proof.status === 'pending') return '审核中'
  return '+ 添加'
}

function goBasic() {
  router.push('/miniapp/worker-archive/basic')
}

function goScheduleList() {
  router.push('/miniapp/worker-archive/schedule-pref')
}

function addSchedulePref() {
  router.push('/miniapp/worker-archive/schedule-pref/new')
}

function editSchedulePref(id: string) {
  router.push(`/miniapp/worker-archive/schedule-pref/${id}`)
}

function goJobPref() {
  router.push('/miniapp/worker-archive/job-pref')
}

function goRealName() {
  router.push({ path: '/miniapp/onboarding', query: { step: 'realname' } })
}

function goFaceVerify() {
  router.push('/miniapp/face-verify')
}

function handleProofClick(proof: WorkerBasicProof) {
  if (proof.type === 'real_name') {
    if (proof.status === 'verified') goFaceVerify()
    else goRealName()
  }
}

function goSkillCerts() {
  router.push('/miniapp/worker-archive/skill-certs')
}
</script>

<template>
  <div class="archive-page">
    <div class="mini-nav-bar">
      <MiniNavBack fallback="/miniapp/profile" />
      <div class="mini-nav-title">灵工档案</div>
    </div>

    <div class="archive-content">
      <!-- 基本信息 -->
      <section class="archive-section">
        <div class="section-head">
          <h3 class="section-title">基本信息</h3>
          <button type="button" class="section-link" @click="goBasic">
            更多
            <el-icon :size="12"><ArrowRight /></el-icon>
          </button>
        </div>
        <div class="address-card" @click="goBasic">
          <div class="address-main">
            <div class="address-label">
              常住地址
              <el-icon :size="12"><ArrowRight /></el-icon>
            </div>
            <div class="address-value">{{ addressText }}</div>
          </div>
          <div class="address-pin">
            <el-icon :size="28" color="#ef4444"><Location /></el-icon>
          </div>
        </div>
      </section>

      <!-- 排班倾向 -->
      <section class="archive-section">
        <div class="section-head">
          <h3 class="section-title">排班倾向</h3>
          <button type="button" class="section-action green" @click="addSchedulePref">+ 添加</button>
        </div>
        <div v-if="schedulePreferences.length" class="schedule-list">
          <div
            v-for="pref in schedulePreferences"
            :key="pref.id"
            class="schedule-item"
          >
            <div
              class="schedule-icon"
              :class="pref.variant === 'weekend' ? 'weekend' : 'weekday'"
            >
              <el-icon :size="18" color="#fff">
                <component :is="pref.variant === 'weekend' ? VideoCamera : Switch" />
              </el-icon>
            </div>
            <div class="schedule-body">
              <div class="schedule-days">{{ formatWeekdays(pref) }}</div>
              <div class="schedule-time">{{ formatTimeRange(pref) }}</div>
            </div>
            <button type="button" class="schedule-edit" @click="editSchedulePref(pref.id)">编辑</button>
          </div>
        </div>
        <div v-else class="empty-inline">
          暂未添加排班倾向
          <button type="button" class="empty-link" @click="goScheduleList">去设置 ›</button>
        </div>
      </section>

      <!-- 兼职偏好 -->
      <section class="archive-section">
        <div class="section-head">
          <h3 class="section-title">兼职偏好</h3>
          <button type="button" class="section-action green" @click="goJobPref">+ 编辑</button>
        </div>
        <div class="pref-list">
          <div
            v-for="row in partTimeRows"
            :key="row.key"
            class="pref-item"
            @click="goJobPref"
          >
            <span class="pref-label">{{ row.label }}</span>
            <span class="pref-value">{{ row.value || '' }}</span>
            <el-icon class="pref-arrow" :size="14" color="#c0c4cc"><ArrowRight /></el-icon>
          </div>
        </div>
      </section>

      <!-- 我的证件 -->
      <section class="archive-section">
        <div class="section-head">
          <h3 class="section-title">我的证件</h3>
          <button type="button" class="section-action grey">
            <el-icon :size="14"><Operation /></el-icon>
            管理
          </button>
        </div>
        <div class="subsection-label">基础证明</div>
        <div class="proof-grid">
          <div
            v-for="proof in basicProofs"
            :key="proof.type"
            class="proof-card"
            :class="{ verified: proof.status === 'verified', clickable: proof.type === 'real_name' }"
            @click="handleProofClick(proof)"
          >
            <div class="proof-head">
              <span class="proof-name">{{ proofLabel(proof.type) }}</span>
              <span
                class="proof-action"
                :class="{ done: proof.status === 'verified' }"
              >
                {{ proofStatusText(proof) }}
              </span>
            </div>
            <div class="proof-icon-wrap">
              <el-icon v-if="proof.type === 'real_name'" :size="32" color="#f59e0b">
                <Postcard />
              </el-icon>
              <el-icon v-else :size="32" color="#22c55e"><Document /></el-icon>
            </div>
          </div>
        </div>
      </section>

      <!-- 技能证书 -->
      <section class="archive-section">
        <div class="section-head">
          <h3 class="section-title">技能证书</h3>
          <button type="button" class="section-action grey" @click="goSkillCerts">+ 添加</button>
        </div>
        <div class="subsection-label">职业技能</div>
        <div v-if="skillCertificates.length" class="skill-list">
          <div
            v-for="cert in skillCertificates"
            :key="cert.id"
            class="skill-item"
          >
            <div class="skill-name">{{ cert.name }}</div>
            <div v-if="cert.issuer || cert.expireAt" class="skill-meta">
              {{ cert.issuer }}
              <template v-if="cert.expireAt"> · 有效期至 {{ cert.expireAt }}</template>
            </div>
          </div>
        </div>
        <div v-else class="skill-empty">
          <el-icon :size="36" color="#d1d5db"><Medal /></el-icon>
          <div class="skill-empty-title">暂无技能证书</div>
          <div class="skill-empty-desc">上传证书可获得更多优质岗位推荐</div>
        </div>
      </section>

      <!-- 完善档案 -->
      <div class="completeness-card">
        <div class="completeness-left">
          <div class="completeness-title">
            <el-icon :size="16" color="#22c55e"><Star /></el-icon>
            完善档案
          </div>
          <div class="completeness-desc">档案完整度越高，推荐越精准</div>
        </div>
        <div class="completeness-right">
          <div class="completeness-pct">{{ completeness }}%</div>
          <div class="completeness-label">完整度</div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.archive-page {
  min-height: 100%;
  background: #f5f6f8;
}

.archive-content {
  padding: 12px 12px 24px;
}

.archive-section {
  margin-bottom: 20px;
}

.section-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.section-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #1f2937;
}

.section-link {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  border: none;
  background: none;
  font-size: 13px;
  color: #9ca3af;
  cursor: pointer;
  padding: 0;
}

.section-action {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: none;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  padding: 0;
}

.section-action.green {
  color: #22c55e;
}

.section-action.grey {
  color: #9ca3af;
}

.subsection-label {
  font-size: 12px;
  color: #9ca3af;
  margin-bottom: 8px;
}

/* 常住地址 */
.address-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px;
  border-radius: 14px;
  background: linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 50%, #fafafa 100%);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  cursor: pointer;
}

.address-label {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  font-size: 12px;
  color: #9ca3af;
}

.address-value {
  margin-top: 8px;
  font-size: 18px;
  font-weight: 700;
  color: #1f2937;
}

.address-pin {
  flex-shrink: 0;
  opacity: 0.9;
}

/* 排班倾向 */
.schedule-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.schedule-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.schedule-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.schedule-icon.weekday {
  background: linear-gradient(135deg, #3b82f6, #60a5fa);
}

.schedule-icon.weekend {
  background: linear-gradient(135deg, #f97316, #fb923c);
}

.schedule-body {
  flex: 1;
  min-width: 0;
}

.schedule-days {
  font-size: 15px;
  font-weight: 600;
  color: #1f2937;
}

.schedule-time {
  margin-top: 4px;
  font-size: 12px;
  color: #9ca3af;
}

.schedule-edit {
  border: none;
  background: none;
  font-size: 13px;
  color: #9ca3af;
  cursor: pointer;
  flex-shrink: 0;
}

.empty-inline {
  padding: 20px;
  text-align: center;
  font-size: 13px;
  color: #9ca3af;
  background: #fff;
  border-radius: 14px;
}

.empty-link {
  display: block;
  margin-top: 8px;
  border: none;
  background: none;
  color: #3b82f6;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

/* 兼职偏好 */
.pref-list {
  background: #fff;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.pref-item {
  display: flex;
  align-items: center;
  padding: 16px 14px;
  border-bottom: 1px solid #f3f4f6;
  cursor: pointer;
}

.pref-item:last-child {
  border-bottom: none;
}

.pref-label {
  font-size: 14px;
  color: #374151;
  flex-shrink: 0;
}

.pref-value {
  flex: 1;
  text-align: right;
  font-size: 13px;
  color: #9ca3af;
  margin-right: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pref-arrow {
  flex-shrink: 0;
}

/* 证件 */
.proof-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px;
}

.proof-card {
  position: relative;
  padding: 14px;
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  min-height: 100px;
  overflow: hidden;
}

.proof-card.clickable {
  cursor: pointer;
}

.proof-card:last-child::after {
  content: '';
  position: absolute;
  right: -20px;
  bottom: -20px;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  background: rgba(34, 197, 94, 0.08);
}

.proof-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}

.proof-name {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.proof-action {
  font-size: 12px;
  color: #22c55e;
}

.proof-action.done {
  color: #9ca3af;
}

.proof-icon-wrap {
  display: flex;
  align-items: center;
}

/* 技能证书 */
.skill-list {
  background: #fff;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.skill-item {
  padding: 14px;
  border-bottom: 1px solid #f3f4f6;
}

.skill-item:last-child {
  border-bottom: none;
}

.skill-name {
  font-size: 14px;
  font-weight: 500;
  color: #374151;
}

.skill-meta {
  margin-top: 4px;
  font-size: 12px;
  color: #9ca3af;
}

.skill-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 32px 20px;
  background: #fff;
  border: 1px dashed #e5e7eb;
  border-radius: 14px;
}

.skill-empty-title {
  margin-top: 12px;
  font-size: 14px;
  color: #6b7280;
}

.skill-empty-desc {
  margin-top: 6px;
  font-size: 12px;
  color: #9ca3af;
  text-align: center;
}

/* 完善档案 */
.completeness-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 18px;
  border-radius: 14px;
  background: linear-gradient(135deg, #ecfdf5 0%, #f0fdf4 100%);
  box-shadow: 0 2px 8px rgba(34, 197, 94, 0.12);
}

.completeness-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 15px;
  font-weight: 700;
  color: #166534;
}

.completeness-desc {
  margin-top: 6px;
  font-size: 12px;
  color: #22c55e;
}

.completeness-right {
  text-align: center;
}

.completeness-pct {
  font-size: 28px;
  font-weight: 800;
  color: #22c55e;
  line-height: 1;
}

.completeness-label {
  margin-top: 4px;
  font-size: 11px;
  color: #22c55e;
}
</style>
