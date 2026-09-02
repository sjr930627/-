<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import type { JobRequirement, RecruitmentLead } from '@/types'

const props = withDefaults(
  defineProps<{
    jobs: JobRequirement[]
    leads: RecruitmentLead[]
    /** 是否显示底部发布按钮 */
    showPublish?: boolean
    modelValue?: string
  }>(),
  { showPublish: true, modelValue: 'all' },
)

const emit = defineEmits<{
  publish: []
  'update:modelValue': [id: string]
}>()

const router = useRouter()
const selectedJobId = ref(props.modelValue || 'all')

watch(
  () => props.modelValue,
  (v) => {
    if (v && v !== selectedJobId.value) selectedJobId.value = v
  },
)

watch(selectedJobId, (v) => emit('update:modelValue', v))

const jobTabs = computed(() => {
  const items = props.jobs.map((j) => ({
    id: j.id,
    label: j.location ? `${j.title}（${j.location}）` : j.title,
  }))
  return [{ id: 'all', label: '全部' }, ...items]
})

watch(
  () => props.jobs,
  (list) => {
    if (selectedJobId.value !== 'all' && !list.some((j) => j.id === selectedJobId.value)) {
      selectedJobId.value = 'all'
    }
  },
  { immediate: true },
)

const activeJob = computed(() =>
  selectedJobId.value === 'all'
    ? null
    : props.jobs.find((j) => j.id === selectedJobId.value) ?? null,
)

const title = computed(() =>
  activeJob.value
    ? activeJob.value.location
      ? `${activeJob.value.title}（${activeJob.value.location}）`
      : activeJob.value.title
    : '全部岗位',
)

const scopedLeads = computed(() =>
  props.leads.filter((l) =>
    selectedJobId.value === 'all' ? true : l.requirementId === selectedJobId.value,
  ),
)

const scopedJobs = computed(() =>
  selectedJobId.value === 'all'
    ? props.jobs
    : props.jobs.filter((j) => j.id === selectedJobId.value),
)

const stats = computed(() => {
  const demand = scopedJobs.value.reduce((s, j) => s + (j.headcount || 0), 0)
  const pending = scopedLeads.value.filter((l) => l.status === 'screening').length
  const interview = scopedLeads.value.filter((l) =>
    ['interview_pending', 'interview_attended', 'feedback_pending'].includes(l.status),
  ).length
  const offer = scopedLeads.value.filter((l) =>
    [
      'salary_negotiation',
      'background_check',
      'medical_check',
      'onboarding_pending',
    ].includes(l.status),
  ).length
  const hired = scopedLeads.value.filter((l) =>
    ['onboarded', 'qualified'].includes(l.status),
  ).length
  return { demand, pending, interview, offer, hired }
})

const reqQuery = computed(() =>
  selectedJobId.value === 'all' ? {} : { req: selectedJobId.value },
)

function selectJob(id: string) {
  selectedJobId.value = id
}

function goDemand() {
  router.push({ path: '/enterprise-miniapp/recruitment/jobs', query: reqQuery.value })
}

function goPending() {
  router.push({
    path: '/enterprise-miniapp/recruitment/leads',
    query: { ...reqQuery.value, type: 'pending' },
  })
}

function goInterview() {
  router.push({
    path: '/enterprise-miniapp/recruitment/interview',
    query: reqQuery.value,
  })
}

function goOffer() {
  router.push({
    path: '/enterprise-miniapp/recruitment/leads',
    query: { ...reqQuery.value, type: 'offer' },
  })
}

function goHired() {
  router.push({
    path: '/enterprise-miniapp/recruitment/leads',
    query: { ...reqQuery.value, type: 'hired' },
  })
}
</script>

<template>
  <div class="job-stats">
    <div class="chips-row">
      <div class="chips">
        <button
          v-for="tab in jobTabs"
          :key="tab.id"
          type="button"
          class="chip"
          :class="{ active: selectedJobId === tab.id }"
          @click="selectJob(tab.id)"
        >
          {{ tab.label }}
        </button>
      </div>
    </div>

    <section class="card">
      <h3>{{ title }}</h3>
      <div class="metrics">
        <button type="button" class="metric" @click="goDemand">
          <span>需求人数</span>
          <strong>{{ stats.demand }}</strong>
        </button>
        <button type="button" class="metric" @click="goPending">
          <span>待处理</span>
          <strong>{{ stats.pending }}</strong>
        </button>
        <button type="button" class="metric" @click="goInterview">
          <span>面试</span>
          <strong>{{ stats.interview }}</strong>
        </button>
        <button type="button" class="metric" @click="goOffer">
          <span>Offer</span>
          <strong>{{ stats.offer }}</strong>
        </button>
        <button type="button" class="metric hired" @click="goHired">
          <span>录用</span>
          <strong>{{ stats.hired }}</strong>
        </button>
      </div>
    </section>

    <button v-if="showPublish" type="button" class="publish-btn" @click="emit('publish')">
      + 发布岗位
    </button>
  </div>
</template>

<style scoped>
.job-stats {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.chips-row {
  overflow: hidden;
}
.chips {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding: 2px 0 4px;
  -webkit-overflow-scrolling: touch;
}
.chip {
  flex-shrink: 0;
  height: 32px;
  padding: 0 14px;
  border-radius: 999px;
  border: 1.5px solid rgba(91, 79, 219, 0.35);
  background: rgba(255, 255, 255, 0.72);
  color: #228BFF;
  font-size: 13px;
  font-weight: 600;
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.chip.active {
  background: #fff;
  border-color: #fff;
  color: #228BFF;
  box-shadow: 0 2px 8px rgba(91, 79, 219, 0.2);
}
.card {
  background: #fff;
  border-radius: 16px;
  padding: 14px;
  box-shadow: 0 4px 16px rgba(91, 79, 219, 0.08);
}
.card h3 {
  margin: 0 0 12px;
  font-size: 16px;
  font-weight: 700;
  color: #111827;
}
.metrics {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 4px;
  background: #f5f3ff;
  border-radius: 12px;
  padding: 12px 6px;
}
.metric {
  border: none;
  background: none;
  padding: 0;
  text-align: center;
  cursor: pointer;
}
.metric span {
  display: block;
  font-size: 11px;
  color: #9ca3af;
}
.metric strong {
  display: block;
  margin-top: 6px;
  font-size: 18px;
  color: #111827;
  font-weight: 700;
  line-height: 1.1;
}
.metric.hired strong {
  color: #228BFF;
}
.publish-btn {
  width: 100%;
  height: 46px;
  border: none;
  border-radius: 12px;
  background: linear-gradient(90deg, #5AA8FF, #228BFF);
  color: #fff;
  font-size: 16px;
  font-weight: 700;
  box-shadow: 0 6px 16px rgba(91, 79, 219, 0.28);
}
</style>
