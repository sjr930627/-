<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { recruitmentLeadStatusMap, recruitmentLeadStatusType } from '@/constants/recruitment'

const store = useAppStore()
const router = useRouter()
const currentMonth = ref('2026-07')

const monthLabel = computed(() => {
  const [y, m] = currentMonth.value.split('-')
  return `${y}年${Number(m)}月`
})

const interviewsByDate = computed(() => {
  const map: Record<
    string,
    {
      id: string
      candidateName: string
      time: string
      enterpriseName: string
      requirementTitle: string
      status: string
      statusType: string
    }[]
  > = {}
  store.recruitmentLeads
    .filter((l) => l.interviewDate && l.status !== 'closed')
    .forEach((l) => {
      const key = l.interviewDate!
      if (!map[key]) map[key] = []
      map[key].push({
        id: l.id,
        candidateName: l.candidateName,
        time: l.interviewTime ?? '',
        enterpriseName: l.enterpriseName,
        requirementTitle: l.requirementTitle,
        status: recruitmentLeadStatusMap[l.status],
        statusType: recruitmentLeadStatusType[l.status],
      })
    })
  return map
})

const daysInMonth = computed(() => {
  const [y, m] = currentMonth.value.split('-').map(Number)
  const total = new Date(y, m, 0).getDate()
  const firstDay = new Date(y, m - 1, 1).getDay()
  const days: { date: string; day: number; isCurrentMonth: boolean; interviews: typeof interviewsByDate.value[string] }[] = []

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

const upcomingList = computed(() =>
  store.recruitmentLeads
    .filter((l) => l.interviewDate && ['interview_pending', 'feedback_pending'].includes(l.status))
    .sort((a, b) => `${a.interviewDate}${a.interviewTime}`.localeCompare(`${b.interviewDate}${b.interviewTime}`))
    .slice(0, 10)
    .map((l) => ({
      ...l,
      statusLabel: recruitmentLeadStatusMap[l.status],
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
  router.push({ path: '/recruitment/progress', query: { lead: leadId } })
}

const weekDays = ['日', '一', '二', '三', '四', '五', '六']
</script>

<template>
  <div class="calendar-layout">
    <div class="page-card calendar-card">
      <div class="page-header">
        <div>
          <h2 class="page-title">面试日程</h2>
          <p class="text-muted">查看和管理各岗位候选人面试安排</p>
        </div>
        <div class="month-nav">
          <el-button text @click="prevMonth"><el-icon><ArrowLeft /></el-icon></el-button>
          <span class="month-label">{{ monthLabel }}</span>
          <el-button text @click="nextMonth"><el-icon><ArrowRight /></el-icon></el-button>
        </div>
      </div>

      <div class="calendar-grid">
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
              v-for="iv in cell.interviews.slice(0, 2)"
              :key="iv.id"
              class="cal-event"
              @click="goProgress(iv.id)"
            >
              <span class="event-time">{{ iv.time }}</span>
              {{ iv.candidateName }}
            </div>
            <div v-if="cell.interviews.length > 2" class="cal-more">
              +{{ cell.interviews.length - 2 }} 更多
            </div>
          </template>
        </div>
      </div>
    </div>

    <div class="page-card side-card">
      <h3 class="side-title">近期面试</h3>
      <el-empty v-if="upcomingList.length === 0" description="暂无安排" />
      <div v-else class="upcoming-list">
        <div
          v-for="item in upcomingList"
          :key="item.id"
          class="upcoming-item"
          @click="goProgress(item.id)"
        >
          <div class="upcoming-time">{{ item.schedule }}</div>
          <div class="upcoming-name">{{ item.candidateName }}</div>
          <div class="upcoming-meta">{{ item.enterpriseName }} · {{ item.requirementTitle }}</div>
          <el-tag size="small">{{ item.statusLabel }}</el-tag>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.calendar-layout {
  display: grid;
  grid-template-columns: 1fr 300px;
  gap: 16px;
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

.cal-more {
  font-size: 11px;
  color: #909399;
}

.side-title {
  margin: 0 0 16px;
  font-size: 15px;
}

.upcoming-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.upcoming-item {
  padding: 12px;
  border-radius: 8px;
  border: 1px solid var(--app-border);
  cursor: pointer;
  transition: border-color 0.15s;
}

.upcoming-item:hover {
  border-color: var(--app-primary);
}

.upcoming-time {
  font-size: 13px;
  color: var(--app-primary);
  font-weight: 600;
}

.upcoming-name {
  font-weight: 600;
  margin: 4px 0;
}

.upcoming-meta {
  font-size: 12px;
  color: #909399;
  margin-bottom: 6px;
}

@media (max-width: 1100px) {
  .calendar-layout {
    grid-template-columns: 1fr;
  }
}
</style>
