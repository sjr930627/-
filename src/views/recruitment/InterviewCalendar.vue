<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { usePortal } from '@/composables/usePortal'
import {
  formatRoundHint,
  recruitmentLeadStatusMap,
  recruitmentLeadStatusType,
} from '@/constants/recruitment'

const store = useAppStore()
const router = useRouter()
const { isEnterprise, portalPath } = usePortal()

const viewMode = ref<'month' | 'week' | 'list'>('month')
const currentMonth = ref('2026-07')

const monthLabel = computed(() => {
  const [y, m] = currentMonth.value.split('-')
  return `${y}年${Number(m)}月`
})

const scopedLeads = computed(() => {
  let list = store.recruitmentLeads.filter(
    (l) => l.interviewDate && !['closed', 'qualified'].includes(l.status),
  )
  if (isEnterprise.value) {
    list = list.filter((l) => l.enterpriseId === store.currentEnterpriseId)
  }
  return list
})

type InterviewItem = {
  id: string
  candidateName: string
  time: string
  enterpriseName: string
  requirementTitle: string
  status: string
  statusType: string
  roundHint: string | null
  deviated: boolean
  currentRound: number
  totalRounds: number
  date: string
}

function buildInterviewItem(l: (typeof scopedLeads.value)[0]): InterviewItem {
  const req = store.jobRequirements.find((r) => r.id === l.requirementId)
  const totalRounds = l.totalRounds ?? req?.interviewRounds ?? 1
  return {
    id: l.id,
    candidateName: l.candidateName,
    time: l.interviewTime ?? '',
    enterpriseName: l.enterpriseName,
    requirementTitle: l.requirementTitle,
    status: recruitmentLeadStatusMap[l.status],
    statusType: recruitmentLeadStatusType[l.status],
    roundHint: formatRoundHint({ ...l, totalRounds }),
    deviated: !!l.ext?.deviated,
    currentRound: l.currentRound ?? 1,
    totalRounds,
    date: l.interviewDate!,
  }
}

const interviewsByDate = computed(() => {
  const map: Record<string, InterviewItem[]> = {}
  scopedLeads.value.forEach((l) => {
    const key = l.interviewDate!
    if (!map[key]) map[key] = []
    map[key].push(buildInterviewItem(l))
  })
  return map
})

const daysInMonth = computed(() => {
  const [y, m] = currentMonth.value.split('-').map(Number)
  const total = new Date(y, m, 0).getDate()
  const firstDay = new Date(y, m - 1, 1).getDay()
  const days: {
    date: string
    day: number
    isCurrentMonth: boolean
    interviews: InterviewItem[]
  }[] = []

  for (let i = 0; i < firstDay; i++) {
    days.push({ date: '', day: 0, isCurrentMonth: false, interviews: [] })
  }
  for (let d = 1; d <= total; d++) {
    const date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    days.push({
      date,
      day: d,
      isCurrentMonth: true,
      interviews: interviewsByDate.value[date] ?? [],
    })
  }
  return days
})

const weekGroups = computed(() => {
  const sorted = [...scopedLeads.value].sort((a, b) =>
    `${a.interviewDate}${a.interviewTime}`.localeCompare(`${b.interviewDate}${b.interviewTime}`),
  )
  const groups: { weekLabel: string; items: InterviewItem[] }[] = []
  for (const l of sorted) {
    const d = new Date(l.interviewDate!)
    const weekStart = new Date(d)
    weekStart.setDate(d.getDate() - d.getDay())
    const label = `${weekStart.getMonth() + 1}/${weekStart.getDate()} 周`
    let group = groups.find((g) => g.weekLabel === label)
    if (!group) {
      group = { weekLabel: label, items: [] }
      groups.push(group)
    }
    group.items.push(buildInterviewItem(l))
  }
  return groups
})

const listItems = computed(() =>
  scopedLeads.value
    .sort((a, b) => `${a.interviewDate}${a.interviewTime}`.localeCompare(`${b.interviewDate}${b.interviewTime}`))
    .map((l) => ({
      ...buildInterviewItem(l),
      schedule: `${l.interviewDate} ${l.interviewTime ?? ''}`,
    })),
)

function prevMonth() {
  const [y, m] = currentMonth.value.split('-').map(Number)
  const d = new Date(y, m - 2, 1)
  currentMonth.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function nextMonth() {
  const [y, m] = currentMonth.value.split('-').map(Number)
  const d = new Date(y, m, 1)
  currentMonth.value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function goProgress(leadId: string) {
  router.push(portalPath(`/recruitment/progress?lead=${leadId}`))
}

const weekDays = ['日', '一', '二', '三', '四', '五', '六']
</script>

<template>
  <div class="calendar-page">
    <div class="page-card calendar-card">
      <div class="page-header">
        <div>
          <h2 class="page-title">面试日程</h2>
          <p class="text-muted">月历 / 周 / 列表三视图，安排面试、签到与反馈</p>
        </div>
        <div class="header-right">
          <el-radio-group v-model="viewMode" size="small">
            <el-radio-button value="month">月历</el-radio-button>
            <el-radio-button value="week">周</el-radio-button>
            <el-radio-button value="list">列表</el-radio-button>
          </el-radio-group>
          <div v-if="viewMode === 'month'" class="month-nav">
            <el-button text @click="prevMonth"><el-icon><ArrowLeft /></el-icon></el-button>
            <span class="month-label">{{ monthLabel }}</span>
            <el-button text @click="nextMonth"><el-icon><ArrowRight /></el-icon></el-button>
          </div>
        </div>
      </div>

      <div v-if="viewMode === 'month'" class="calendar-grid">
        <div v-for="w in weekDays" :key="w" class="cal-header">{{ w }}</div>
        <div
          v-for="(cell, i) in daysInMonth"
          :key="i"
          class="cal-cell"
          :class="{ empty: !cell.isCurrentMonth, 'has-event': cell.interviews.length > 0 }"
        >
          <template v-if="cell.isCurrentMonth">
            <div class="cal-day">{{ cell.day }}</div>
            <div
              v-for="iv in cell.interviews.slice(0, 3)"
              :key="iv.id"
              class="cal-event"
              @click="goProgress(iv.id)"
            >
              <span class="event-time">{{ iv.time }}</span>
              {{ iv.candidateName }}
              <span v-if="iv.totalRounds > 1" class="round-badge">{{ iv.currentRound }}/{{ iv.totalRounds }}</span>
            </div>
            <div v-if="cell.interviews.length > 3" class="cal-more">+{{ cell.interviews.length - 3 }}</div>
          </template>
        </div>
      </div>

      <div v-else-if="viewMode === 'week'" class="week-view">
        <div v-for="group in weekGroups" :key="group.weekLabel" class="week-group">
          <div class="week-label">{{ group.weekLabel }}</div>
          <div
            v-for="iv in group.items"
            :key="iv.id"
            class="week-item"
            @click="goProgress(iv.id)"
          >
            <div class="week-time">{{ iv.date }} {{ iv.time }}</div>
            <div class="week-name">{{ iv.candidateName }} · {{ iv.requirementTitle }}</div>
            <div class="week-meta">
              <el-tag size="small" :type="iv.statusType as any">{{ iv.status }}</el-tag>
              <span v-if="iv.roundHint" class="round-hint">{{ iv.roundHint }}</span>
              <el-tag v-if="iv.deviated" size="small" type="warning">偏离</el-tag>
            </div>
          </div>
        </div>
        <el-empty v-if="weekGroups.length === 0" description="本周暂无面试" />
      </div>

      <div v-else class="list-view">
        <div v-for="item in listItems" :key="item.id" class="list-card" @click="goProgress(item.id)">
          <div class="list-time">{{ item.schedule }}</div>
          <div class="list-main">
            <span class="list-name">{{ item.candidateName }}</span>
            <span class="list-post">{{ item.requirementTitle }}</span>
          </div>
          <div class="list-meta">
            <el-tag size="small" :type="item.statusType as any">{{ item.status }}</el-tag>
            <span v-if="item.totalRounds > 1" class="round-badge">{{ item.currentRound }}/{{ item.totalRounds }}</span>
            <span v-if="item.roundHint" class="round-hint">{{ item.roundHint }}</span>
            <el-tag v-if="item.deviated" size="small" type="warning">偏离</el-tag>
          </div>
        </div>
        <el-empty v-if="listItems.length === 0" description="暂无面试安排" />
      </div>
    </div>
  </div>
</template>

<style scoped>
.calendar-page {
  min-height: calc(100vh - 140px);
}

.header-right {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 12px;
}

.month-nav {
  display: flex;
  align-items: center;
  gap: 8px;
}

.month-label {
  font-size: 16px;
  font-weight: 600;
  min-width: 100px;
  text-align: center;
}

.calendar-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1px;
  background: var(--app-border);
  border: 1px solid var(--app-border);
  border-radius: 8px;
  overflow: hidden;
}

.cal-header {
  background: #fafafa;
  padding: 10px;
  text-align: center;
  font-size: 13px;
  font-weight: 500;
  color: #606266;
}

.cal-cell {
  background: #fff;
  min-height: 90px;
  padding: 6px;
}

.cal-cell.empty {
  background: #fafafa;
}

.cal-cell.has-event {
  background: #faf8ff;
}

.cal-day {
  font-size: 13px;
  font-weight: 500;
  margin-bottom: 4px;
}

.cal-event {
  font-size: 11px;
  padding: 2px 6px;
  margin-bottom: 2px;
  border-radius: 4px;
  background: var(--app-primary-light);
  color: var(--app-primary);
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.event-time {
  font-weight: 600;
  margin-right: 4px;
}

.round-badge {
  margin-left: 4px;
  font-size: 10px;
  background: #e0e7ff;
  padding: 0 4px;
  border-radius: 4px;
}

.cal-more {
  font-size: 11px;
  color: #909399;
}

.week-view {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.week-label {
  font-weight: 600;
  margin-bottom: 8px;
  color: #303133;
}

.week-item {
  padding: 12px;
  border: 1px solid var(--app-border);
  border-radius: 8px;
  margin-bottom: 8px;
  cursor: pointer;
}

.week-item:hover {
  border-color: var(--app-primary);
}

.week-time {
  font-size: 13px;
  color: var(--app-primary);
  font-weight: 600;
}

.week-name {
  margin: 4px 0;
  font-weight: 500;
}

.week-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.round-hint {
  font-size: 12px;
  color: #909399;
}

.list-view {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.list-card {
  display: grid;
  grid-template-columns: 140px 1fr auto;
  gap: 12px;
  align-items: center;
  padding: 14px 16px;
  border: 1px solid var(--app-border);
  border-radius: 10px;
  cursor: pointer;
}

.list-card:hover {
  border-color: var(--app-primary);
}

.list-time {
  font-weight: 600;
  color: var(--app-primary);
  font-size: 13px;
}

.list-name {
  font-weight: 600;
  margin-right: 8px;
}

.list-post {
  color: #909399;
  font-size: 13px;
}

.list-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
</style>
