<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { Phone } from '@element-plus/icons-vue'
import { ElMessage } from 'element-plus'
import EntMiniMessageEntry from '@/components/enterprise-miniapp/EntMiniMessageEntry.vue'
import EntMiniJobStatsCard from '@/components/enterprise-miniapp/EntMiniJobStatsCard.vue'
import { useAppStore } from '@/stores/app'
import { useEnterpriseMiniAuth } from '@/composables/useEnterpriseMiniAuth'

const router = useRouter()
const store = useAppStore()
const { enterpriseId } = useEnterpriseMiniAuth()

const selectedJobId = ref('all')

const requirements = computed(() =>
  store.jobRequirements
    .filter((r) => r.enterpriseId === enterpriseId.value)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
)

const leads = computed(() =>
  store.recruitmentLeads.filter((l) => l.enterpriseId === enterpriseId.value),
)

const scopedLeads = computed(() =>
  leads.value.filter((l) =>
    selectedJobId.value === 'all' ? true : l.requirementId === selectedJobId.value,
  ),
)

const waitScheduleCount = computed(
  () =>
    scopedLeads.value.filter((l) => l.status === 'screening' || !l.interviewDate).length,
)

const demoDates = ['2026-07-28', '2026-07-27']

const todayInterviews = computed(() =>
  scopedLeads.value
    .filter(
      (l) =>
        Boolean(l.interviewDate) &&
        demoDates.includes(l.interviewDate!) &&
        (l.status === 'interview_pending' || l.status === 'interview_attended'),
    )
    .sort((a, b) => (a.interviewTime || '').localeCompare(b.interviewTime || ''))
    .slice(0, 8),
)

const feedbackList = computed(() =>
  scopedLeads.value
    .filter((l) => l.status === 'feedback_pending' || l.status === 'interview_attended')
    .slice(0, 8),
)

function maskPhone(phone: string) {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 7) return phone
  return `${digits.slice(0, 3)}****${digits.slice(-4)}`
}

function callPhone(phone: string) {
  ElMessage.success(`拨打 ${phone}（演示）`)
}

function goPublish() {
  router.push('/enterprise-miniapp/recruitment/publish')
}

function goProgress() {
  const q =
    selectedJobId.value === 'all' ? undefined : { req: selectedJobId.value }
  router.push({ path: '/enterprise-miniapp/recruitment/progress', query: q })
}

function goInterview() {
  const q =
    selectedJobId.value === 'all' ? undefined : { req: selectedJobId.value }
  router.push({ path: '/enterprise-miniapp/recruitment/interview', query: q })
}

function goFeedback() {
  goProgress()
}
</script>

<template>
  <div class="page">
    <div class="recruit-top">
      <span class="brand">招聘</span>
      <EntMiniMessageEntry tone="dark" />
    </div>

    <div class="hero">
      <EntMiniJobStatsCard
        v-model="selectedJobId"
        :jobs="requirements"
        :leads="leads"
        @publish="goPublish"
      />
    </div>

    <div class="content">
      <button type="button" class="entry-row" @click="goInterview">
        <span>待约面</span>
        <span class="right">
          <em v-if="waitScheduleCount > 0" class="badge">
            {{ waitScheduleCount > 99 ? '99+' : waitScheduleCount }}
          </em>
          <i>›</i>
        </span>
      </button>

      <section class="block">
        <div class="block-head" @click="goInterview">
          <h2><span class="title-bar">今日待面试</span></h2>
          <span class="right">
            <em v-if="todayInterviews.length" class="badge">{{ todayInterviews.length }}</em>
            <i>›</i>
          </span>
        </div>
        <div v-if="!todayInterviews.length" class="empty">今日暂无待面试</div>
        <div v-else class="timeline">
          <article v-for="l in todayInterviews" :key="l.id" class="tl-item">
            <div class="tl-left">
              <strong>{{ l.interviewTime || '待定' }}</strong>
              <em :class="l.interviewMethod === 'online' ? 'tag-online' : 'tag-offline'">
                {{ l.interviewMethod === 'online' ? '线上面试' : '线下面试' }}
              </em>
            </div>
            <div class="tl-right">
              <div class="name-row">
                <strong>{{ l.candidateName }}</strong>
                <span>({{ maskPhone(l.phone) }})</span>
                <button type="button" class="phone" @click.stop="callPhone(l.phone)">
                  <el-icon :size="16"><Phone /></el-icon>
                </button>
              </div>
              <p>
                {{ l.requirementTitle || l.position }}{{ l.interviewAddress ? `-${l.interviewAddress}` : '' }}
              </p>
            </div>
          </article>
        </div>
      </section>

      <section class="block">
        <div class="block-head" @click="goFeedback">
          <h2><span class="title-bar">面试反馈</span></h2>
          <span class="right">
            <em v-if="feedbackList.length" class="badge">{{ feedbackList.length }}</em>
            <i>›</i>
          </span>
        </div>
        <div v-if="!feedbackList.length" class="empty">暂无待反馈面试</div>
        <article v-for="l in feedbackList" :key="l.id" class="fb-item">
          <div class="fb-main">
            <div class="name-row">
              <strong>{{ l.candidateName }}</strong>
              <span>({{ maskPhone(l.phone) }})</span>
              <button type="button" class="phone" @click.stop="callPhone(l.phone)">
                <el-icon :size="16"><Phone /></el-icon>
              </button>
            </div>
            <p>{{ l.requirementTitle || l.position }}</p>
          </div>
          <button type="button" class="feedback-btn" @click="goFeedback">去反馈</button>
        </article>
      </section>
    </div>
  </div>
</template>

<style scoped>
.page {
  min-height: 100%;
  background: #fff;
  padding-bottom: 16px;
}
.recruit-top {
  position: sticky;
  top: 0;
  z-index: 30;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  background: #D5E9FF;
}
.recruit-top .brand {
  font-size: 17px;
  font-weight: 700;
  color: #111827;
}
.hero {
  background: #fff;
  padding: 4px 12px 12px;
}
.content {
  padding: 0 12px 16px;
}
.entry-row {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: #fff;
  border: none;
  border-radius: 12px;
  padding: 14px;
  margin-bottom: 8px;
  font-size: 14px;
  color: #111827;
  box-shadow: 0 1px 6px rgba(15, 23, 42, 0.03);
}
.right {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: #9ca3af;
}
.right i {
  font-style: normal;
  font-size: 16px;
  color: #d1d5db;
}
.badge {
  font-style: normal;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: 999px;
  background: #ef4444;
  color: #fff;
  font-size: 11px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
}
.block {
  background: #fff;
  border-radius: 14px;
  padding: 12px 14px 6px;
  margin-bottom: 10px;
  box-shadow: 0 1px 6px rgba(15, 23, 42, 0.03);
}
.block-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
  cursor: pointer;
}
.block-head h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
}
.title-bar {
  position: relative;
  display: inline-block;
}
.title-bar::after {
  content: '';
  position: absolute;
  left: 0;
  bottom: -3px;
  width: 2em;
  height: 3px;
  background: #228BFF;
  border-radius: 2px;
}
.timeline {
  position: relative;
  padding: 4px 0 8px;
}
.timeline::before {
  content: '';
  position: absolute;
  left: 22px;
  top: 12px;
  bottom: 12px;
  width: 1px;
  background: #e5e7eb;
}
.tl-item {
  display: flex;
  gap: 12px;
  padding: 12px 0;
  position: relative;
}
.tl-left {
  width: 56px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  z-index: 1;
}
.tl-left strong {
  font-size: 15px;
  color: #111827;
  background: #fff;
  padding: 0 2px;
}
.tag-offline,
.tag-online {
  font-style: normal;
  font-size: 10px;
  border-radius: 4px;
  padding: 2px 5px;
  white-space: nowrap;
}
.tag-offline {
  background: #EBF4FF;
  color: #228BFF;
}
.tag-online {
  background: #eff6ff;
  color: #228BFF;
}
.tl-right {
  flex: 1;
  min-width: 0;
}
.name-row {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
}
.name-row strong {
  font-size: 14px;
  color: #111827;
}
.name-row span {
  font-size: 12px;
  color: #9ca3af;
}
.phone {
  border: none;
  background: none;
  color: #228BFF;
  padding: 0 2px;
  display: inline-flex;
  align-items: center;
}
.tl-right p,
.fb-main p {
  margin: 4px 0 0;
  font-size: 12px;
  color: #9ca3af;
  line-height: 1.4;
}
.fb-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 0;
  border-top: 1px solid #f3f4f6;
}
.fb-main {
  flex: 1;
  min-width: 0;
}
.feedback-btn {
  flex-shrink: 0;
  height: 30px;
  padding: 0 12px;
  border-radius: 8px;
  border: 1px solid #c7c3f5;
  background: #EBF4FF;
  color: #228BFF;
  font-size: 12px;
  font-weight: 600;
}
.empty {
  padding: 20px 0;
  text-align: center;
  color: #9ca3af;
  font-size: 12px;
}
</style>
