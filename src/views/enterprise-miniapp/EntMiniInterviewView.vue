<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'
import dayjs from 'dayjs'
import { ElMessage } from 'element-plus'
import EntMiniNavBar from '@/components/enterprise-miniapp/EntMiniNavBar.vue'
import { useAppStore } from '@/stores/app'
import { useEnterpriseMiniAuth } from '@/composables/useEnterpriseMiniAuth'
import {
  formatRoundHint,
  recruitmentLeadStatusMap,
} from '@/constants/recruitment'
import type { RecruitmentLead } from '@/types'

/** 演示「今天」，与招聘页约定一致 */
const TODAY = '2026-07-27'

type BoardTab = 'upcoming' | 'history'

const route = useRoute()
const store = useAppStore()
const { enterpriseId } = useEnterpriseMiniAuth()

const tab = ref<BoardTab>('upcoming')
const currentMonth = ref('2026-07')
const selectedDate = ref(TODAY)

const detailOpen = ref(false)
const detailLead = ref<RecruitmentLead | null>(null)

const rescheduleOpen = ref(false)
const editDate = ref('')
const editTime = ref('')

const reqFilter = computed(() =>
  typeof route.query.req === 'string' ? route.query.req : '',
)

const monthLabel = computed(() => {
  const [y, m] = currentMonth.value.split('-')
  return `${y}年${Number(m)}月`
})

const allInterviewLeads = computed(() => {
  let list = store.recruitmentLeads.filter(
    (l) => l.enterpriseId === enterpriseId.value && Boolean(l.interviewDate),
  )
  if (reqFilter.value) list = list.filter((l) => l.requirementId === reqFilter.value)
  return list
})

function isUpcoming(l: RecruitmentLead) {
  if (!l.interviewDate) return false
  if (l.interviewDate > TODAY) return true
  if (l.interviewDate === TODAY) {
    return ['interview_pending', 'interview_attended', 'feedback_pending'].includes(l.status)
  }
  return false
}

function isHistory(l: RecruitmentLead) {
  if (!l.interviewDate) return Boolean(l.interviewFeedback)
  if (l.interviewDate < TODAY) return true
  return !isUpcoming(l)
}

const upcomingLeads = computed(() =>
  allInterviewLeads.value
    .filter(isUpcoming)
    .sort((a, b) =>
      `${a.interviewDate}${a.interviewTime}`.localeCompare(
        `${b.interviewDate}${b.interviewTime}`,
      ),
    ),
)

const historyLeads = computed(() =>
  allInterviewLeads.value
    .filter(isHistory)
    .sort((a, b) =>
      `${b.interviewDate}${b.interviewTime}`.localeCompare(
        `${a.interviewDate}${a.interviewTime}`,
      ),
    ),
)

const boardLeads = computed(() =>
  tab.value === 'upcoming' ? upcomingLeads.value : historyLeads.value,
)

const interviewsByDate = computed(() => {
  const map = new Map<string, RecruitmentLead[]>()
  for (const l of boardLeads.value) {
    const key = l.interviewDate!
    const arr = map.get(key) ?? []
    arr.push(l)
    map.set(key, arr)
  }
  return map
})

const daysInMonth = computed(() => {
  const start = dayjs(`${currentMonth.value}-01`)
  const total = start.daysInMonth()
  const firstWeekday = start.day()
  const cells: { date: string | null; count: number; past: boolean }[] = []
  for (let i = 0; i < firstWeekday; i++) cells.push({ date: null, count: 0, past: false })
  for (let d = 1; d <= total; d++) {
    const date = start.date(d).format('YYYY-MM-DD')
    cells.push({
      date,
      count: interviewsByDate.value.get(date)?.length ?? 0,
      past: date < TODAY,
    })
  }
  return cells
})

const dayList = computed(() => {
  const list = interviewsByDate.value.get(selectedDate.value) ?? []
  return [...list].sort((a, b) => (a.interviewTime || '').localeCompare(b.interviewTime || ''))
})

const listTitle = computed(() =>
  tab.value === 'upcoming'
    ? `${selectedDate.value} 面试安排`
    : `${selectedDate.value} 历史面试`,
)

function canReschedule(l: RecruitmentLead) {
  return Boolean(l.interviewDate && l.interviewDate >= TODAY && l.status === 'interview_pending')
}

function shiftMonth(delta: number) {
  currentMonth.value = dayjs(`${currentMonth.value}-01`)
    .add(delta, 'month')
    .format('YYYY-MM')
}

function selectDay(date: string | null) {
  if (!date) return
  selectedDate.value = date
}

function switchTab(next: BoardTab) {
  tab.value = next
  const dates = [...interviewsByDate.value.keys()].sort()
  if (next === 'upcoming') {
    const first = dates.find((d) => d >= TODAY) ?? dates[0]
    if (first) {
      selectedDate.value = first
      currentMonth.value = first.slice(0, 7)
    } else {
      selectedDate.value = TODAY
      currentMonth.value = TODAY.slice(0, 7)
    }
  } else {
    const last = [...dates].reverse().find((d) => d < TODAY) ?? dates[dates.length - 1]
    if (last) {
      selectedDate.value = last
      currentMonth.value = last.slice(0, 7)
    }
  }
}

function openDetail(l: RecruitmentLead) {
  detailLead.value = l
  detailOpen.value = true
}

function closeDetail() {
  detailOpen.value = false
  detailLead.value = null
}

function openReschedule(l: RecruitmentLead) {
  editDate.value = l.interviewDate || TODAY
  editTime.value = l.interviewTime || '10:00'
  rescheduleOpen.value = true
}

function closeReschedule() {
  rescheduleOpen.value = false
}

function saveReschedule() {
  const lead = detailLead.value
  if (!lead) return
  const date = editDate.value.trim()
  const time = editTime.value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    ElMessage.warning('请填写正确日期 YYYY-MM-DD')
    return
  }
  if (date < TODAY) {
    ElMessage.warning('只能改到今天或之后')
    return
  }
  if (time && !/^\d{1,2}:\d{2}$/.test(time)) {
    ElMessage.warning('请填写正确时间 HH:mm')
    return
  }
  try {
    store.updateRecruitmentLead(lead.id, {
      interviewDate: date,
      interviewTime: time || undefined,
    })
    selectedDate.value = date
    currentMonth.value = date.slice(0, 7)
    detailLead.value = store.recruitmentLeads.find((x) => x.id === lead.id) ?? lead
    rescheduleOpen.value = false
    ElMessage.success('面试时间已更新')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '更新失败')
  }
}
</script>

<template>
  <div class="mini-page">
    <EntMiniNavBar title="面试看板" back-to="/enterprise-miniapp/recruitment" />

    <div class="tabs">
      <button
        type="button"
        :class="{ active: tab === 'upcoming' }"
        @click="switchTab('upcoming')"
      >
        面试安排
        <em>{{ upcomingLeads.length }}</em>
      </button>
      <button
        type="button"
        :class="{ active: tab === 'history' }"
        @click="switchTab('history')"
      >
        历史记录
        <em>{{ historyLeads.length }}</em>
      </button>
    </div>

    <section class="board">
      <div class="month-bar">
        <button type="button" @click="shiftMonth(-1)">‹</button>
        <strong>{{ monthLabel }}</strong>
        <button type="button" @click="shiftMonth(1)">›</button>
      </div>

      <div class="weekdays">
        <span v-for="w in ['日', '一', '二', '三', '四', '五', '六']" :key="w">{{ w }}</span>
      </div>
      <div class="grid">
        <button
          v-for="(cell, idx) in daysInMonth"
          :key="idx"
          type="button"
          class="day"
          :class="{
            empty: !cell.date,
            active: cell.date === selectedDate,
            has: cell.count > 0,
            past: cell.past && cell.count > 0,
          }"
          :disabled="!cell.date"
          @click="selectDay(cell.date)"
        >
          <em v-if="cell.date">{{ Number(cell.date.slice(8)) }}</em>
          <i v-if="cell.count">{{ cell.count }}</i>
        </button>
      </div>
    </section>

    <section class="list-card">
      <div class="list-head">
        <h3>{{ listTitle }}</h3>
        <span>{{ dayList.length }} 场</span>
      </div>
      <div v-if="!dayList.length" class="empty">
        {{ tab === 'upcoming' ? '当日暂无面试安排' : '当日暂无历史面试' }}
      </div>
      <article
        v-for="l in dayList"
        :key="l.id"
        class="item"
        @click="openDetail(l)"
      >
        <div class="time">
          <strong>{{ l.interviewTime || '待定' }}</strong>
          <em>{{ l.interviewMethod === 'online' ? '线上' : '线下' }}</em>
        </div>
        <div class="body">
          <div class="row">
            <strong>{{ l.candidateName }}</strong>
            <span class="status">{{ recruitmentLeadStatusMap[l.status] }}</span>
          </div>
          <p>{{ l.requirementTitle || l.position }}</p>
          <p class="meta">
            <template v-if="formatRoundHint(l)">{{ formatRoundHint(l) }} · </template>
            {{ l.interviewer ? `面试官 ${l.interviewer}` : '面试官待定' }}
          </p>
          <p v-if="l.interviewAddress" class="meta">{{ l.interviewAddress }}</p>
          <p v-if="tab === 'history' && l.interviewFeedback" class="feedback-preview">
            反馈：{{ l.interviewFeedback }}
          </p>
        </div>
        <span class="chev">›</span>
      </article>
    </section>

    <!-- 面试详情 -->
    <div v-if="detailOpen && detailLead" class="sheet-mask" @click.self="closeDetail">
      <div class="sheet">
        <div class="sheet-head">
          <h3>面试详情</h3>
          <button type="button" class="ghost" @click="closeDetail">关闭</button>
        </div>

        <div class="detail">
          <div class="detail-hero">
            <strong>{{ detailLead.candidateName }}</strong>
            <span>{{ recruitmentLeadStatusMap[detailLead.status] }}</span>
          </div>
          <p class="detail-job">{{ detailLead.requirementTitle || detailLead.position }}</p>

          <dl class="kv">
            <div>
              <dt>面试时间</dt>
              <dd>
                {{ detailLead.interviewDate }}
                {{ detailLead.interviewTime || '待定' }}
              </dd>
            </div>
            <div>
              <dt>面试方式</dt>
              <dd>{{ detailLead.interviewMethod === 'online' ? '线上' : '线下' }}</dd>
            </div>
            <div v-if="detailLead.interviewAddress">
              <dt>面试地点</dt>
              <dd>{{ detailLead.interviewAddress }}</dd>
            </div>
            <div>
              <dt>面试官</dt>
              <dd>{{ detailLead.interviewer || '待定' }}</dd>
            </div>
            <div v-if="formatRoundHint(detailLead)">
              <dt>轮次</dt>
              <dd>{{ formatRoundHint(detailLead) }}</dd>
            </div>
            <div>
              <dt>联系电话</dt>
              <dd>{{ detailLead.phone }}</dd>
            </div>
          </dl>

          <div v-if="detailLead.interviewFeedback || detailLead.ext?.interviewScore != null" class="feedback-box">
            <h4>面试反馈</h4>
            <p v-if="detailLead.ext?.interviewScore != null" class="score">
              评分 <b>{{ detailLead.ext.interviewScore }}</b>
            </p>
            <p v-if="detailLead.interviewFeedback">{{ detailLead.interviewFeedback }}</p>
            <p v-else class="muted">暂无文字反馈</p>
          </div>
          <div v-else-if="isHistory(detailLead)" class="feedback-box empty-fb">
            <h4>面试反馈</h4>
            <p class="muted">暂无反馈记录</p>
          </div>
        </div>

        <div class="sheet-actions">
          <button
            v-if="canReschedule(detailLead)"
            type="button"
            class="primary"
            @click="openReschedule(detailLead)"
          >
            修改面试时间
          </button>
          <button type="button" class="outline" @click="closeDetail">知道了</button>
        </div>
      </div>
    </div>

    <!-- 修改时间 -->
    <div v-if="rescheduleOpen && detailLead" class="sheet-mask" @click.self="closeReschedule">
      <div class="sheet">
        <div class="sheet-head">
          <h3>修改面试时间</h3>
          <button type="button" class="ghost" @click="closeReschedule">取消</button>
        </div>
        <p class="hint">仅可调整未来（含今天）待面试安排。</p>
        <label class="field">
          <span>日期</span>
          <input v-model="editDate" type="date" :min="TODAY">
        </label>
        <label class="field">
          <span>时间</span>
          <input v-model="editTime" type="time">
        </label>
        <div class="sheet-actions">
          <button type="button" class="primary" @click="saveReschedule">保存</button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tabs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
  margin: 0 12px 10px;
}
.tabs button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  height: 36px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  background: #fff;
  color: #6b7280;
  font-size: 13px;
}
.tabs button.active {
  border-color: #5b4fdb;
  background: #eef2ff;
  color: #5b4fdb;
  font-weight: 600;
}
.tabs em {
  font-style: normal;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 999px;
  background: #f3f4f6;
  color: #6b7280;
  font-size: 11px;
  line-height: 18px;
}
.tabs button.active em {
  background: #5b4fdb;
  color: #fff;
}
.board {
  margin: 0 12px 10px;
  background: #fff;
  border-radius: 14px;
  padding: 12px;
  box-shadow: 0 1px 6px rgba(15, 23, 42, 0.04);
}
.month-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.month-bar strong {
  font-size: 15px;
  color: #111827;
}
.month-bar button {
  width: 32px;
  height: 32px;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  background: #fff;
  color: #5b4fdb;
  font-size: 18px;
}
.weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  text-align: center;
  font-size: 11px;
  color: #9ca3af;
  margin-bottom: 6px;
}
.grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}
.day {
  position: relative;
  height: 40px;
  border: none;
  border-radius: 8px;
  background: #f8fafc;
  color: #374151;
  padding: 0;
}
.day.empty {
  background: transparent;
}
.day em {
  font-style: normal;
  font-size: 13px;
  font-weight: 600;
}
.day i {
  position: absolute;
  right: 4px;
  top: 4px;
  min-width: 14px;
  height: 14px;
  padding: 0 3px;
  border-radius: 999px;
  background: #5b4fdb;
  color: #fff;
  font-size: 9px;
  font-style: normal;
  display: inline-flex;
  align-items: center;
  justify-content: center;
}
.day.has {
  background: #eef2ff;
  color: #5b4fdb;
}
.day.past.has {
  background: #f3f4f6;
  color: #6b7280;
}
.day.past.has i {
  background: #9ca3af;
}
.day.active {
  background: #5b4fdb;
  color: #fff;
}
.day.active i {
  background: #fff;
  color: #5b4fdb;
}
.list-card {
  margin: 0 12px 24px;
  background: #fff;
  border-radius: 14px;
  padding: 12px 14px;
  box-shadow: 0 1px 6px rgba(15, 23, 42, 0.04);
}
.list-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8px;
}
.list-head h3 {
  margin: 0;
  font-size: 14px;
  color: #111827;
}
.list-head span {
  font-size: 12px;
  color: #9ca3af;
}
.item {
  display: flex;
  gap: 12px;
  align-items: flex-start;
  padding: 12px 0;
  border-top: 1px solid #f3f4f6;
  cursor: pointer;
}
.time {
  width: 56px;
  flex-shrink: 0;
  text-align: center;
}
.time strong {
  display: block;
  font-size: 14px;
  color: #5b4fdb;
}
.time em {
  display: inline-block;
  margin-top: 4px;
  font-style: normal;
  font-size: 10px;
  color: #5b4fdb;
  background: #eef2ff;
  padding: 1px 6px;
  border-radius: 4px;
}
.body {
  flex: 1;
  min-width: 0;
}
.row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.body strong {
  font-size: 14px;
  color: #111827;
}
.status {
  font-size: 11px;
  color: #5b4fdb;
  background: #eef2ff;
  padding: 1px 6px;
  border-radius: 4px;
  white-space: nowrap;
}
.body p {
  margin: 4px 0 0;
  font-size: 12px;
  color: #6b7280;
}
.meta {
  color: #9ca3af !important;
}
.feedback-preview {
  color: #4b5563 !important;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.chev {
  color: #d1d5db;
  font-size: 18px;
  line-height: 1.2;
  margin-top: 2px;
}
.empty {
  padding: 24px 0;
  text-align: center;
  color: #9ca3af;
  font-size: 13px;
}
.sheet-mask {
  position: fixed;
  inset: 0;
  z-index: 200;
  background: rgba(15, 23, 42, 0.45);
  display: flex;
  align-items: flex-end;
  justify-content: center;
}
.sheet {
  width: 100%;
  max-width: 430px;
  max-height: 85vh;
  overflow: auto;
  background: #fff;
  border-radius: 16px 16px 0 0;
  padding: 16px 16px calc(16px + env(safe-area-inset-bottom, 0px));
  box-sizing: border-box;
}
.sheet-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
}
.sheet-head h3 {
  margin: 0;
  font-size: 16px;
  color: #111827;
}
.ghost {
  border: none;
  background: transparent;
  color: #6b7280;
  font-size: 13px;
}
.detail-hero {
  display: flex;
  align-items: center;
  gap: 8px;
}
.detail-hero strong {
  font-size: 18px;
  color: #111827;
}
.detail-hero span {
  font-size: 12px;
  color: #5b4fdb;
  background: #eef2ff;
  padding: 2px 8px;
  border-radius: 999px;
}
.detail-job {
  margin: 6px 0 14px;
  font-size: 13px;
  color: #6b7280;
}
.kv {
  margin: 0;
  display: grid;
  gap: 10px;
}
.kv > div {
  display: grid;
  grid-template-columns: 72px 1fr;
  gap: 8px;
  font-size: 13px;
}
.kv dt {
  margin: 0;
  color: #9ca3af;
}
.kv dd {
  margin: 0;
  color: #111827;
}
.feedback-box {
  margin-top: 14px;
  padding: 12px;
  border-radius: 12px;
  background: #f8fafc;
  border: 1px solid #eef2f7;
}
.feedback-box h4 {
  margin: 0 0 8px;
  font-size: 13px;
  color: #111827;
}
.feedback-box p {
  margin: 0;
  font-size: 13px;
  color: #374151;
  line-height: 1.5;
}
.score {
  margin-bottom: 6px !important;
}
.score b {
  color: #5b4fdb;
  font-size: 16px;
}
.muted {
  color: #9ca3af !important;
}
.sheet-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 16px;
}
.primary,
.outline {
  height: 42px;
  border-radius: 10px;
  font-size: 14px;
  font-weight: 600;
}
.primary {
  border: none;
  background: #5b4fdb;
  color: #fff;
}
.outline {
  border: 1px solid #e5e7eb;
  background: #fff;
  color: #374151;
}
.hint {
  margin: 0 0 12px;
  font-size: 12px;
  color: #9ca3af;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 12px;
  font-size: 13px;
  color: #6b7280;
}
.field input {
  height: 40px;
  border: 1px solid #e5e7eb;
  border-radius: 10px;
  padding: 0 12px;
  font-size: 14px;
  color: #111827;
}
</style>
