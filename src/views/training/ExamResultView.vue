<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { useTrainingScope } from '@/composables/useTrainingScope'
import { trainingTypeFilterOptions } from '@/constants/trainingOwner'
import VChart from '@/components/statistics/VChart.vue'
import { examQuestionTypeMap } from '@/constants/training'
import {
  canEmployeeTakeExam,
  getEmployeeExamStatus,
  getExamEligibilityLabel,
  getExamLinkedCourses,
  getExamQuestions,
  getExamStats,
  getLearningProgress,
  getScoreDistribution,
  resolveCourseAssignees,
} from '@/services/training'
import type { ExamAttempt } from '@/types'
import type { EChartsOption } from 'echarts'

const store = useAppStore()
const route = useRoute()
const { isPlatform, typeFilter, enterpriseFilter, filterByTrainingType } = useTrainingScope()
const selectedExamId = ref<string>('')
const detailVisible = ref(false)
const selectedAttempt = ref<ExamAttempt | null>(null)

const publishedExams = computed(() =>
  filterByTrainingType(store.trainingExams.filter((e) => e.status === 'published')),
)

watch(
  () => route.query.exam,
  (id) => {
    if (typeof id === 'string') selectedExamId.value = id
    else if (!selectedExamId.value && publishedExams.value.length) {
      selectedExamId.value = publishedExams.value[0].id
    }
  },
  { immediate: true },
)

watch(publishedExams, (list) => {
  if (list.length === 0) {
    selectedExamId.value = ''
    return
  }
  if (!list.some((e) => e.id === selectedExamId.value)) {
    selectedExamId.value = list[0].id
  }
})

const selectedExam = computed(() =>
  store.trainingExams.find((e) => e.id === selectedExamId.value),
)

const linkedCourse = computed(() => {
  const e = selectedExam.value
  if (!e) return null
  return getExamLinkedCourses(store.trainingCourses, e)[0] ?? null
})

const examStats = computed(() => {
  const e = selectedExam.value
  if (!e) return null
  return getExamStats(e, store.trainingCourses, store.examAttempts, store.employees, store.departments)
})

const scoreChartOption = computed((): EChartsOption | null => {
  const attempts = store.examAttempts.filter((a) => a.examId === selectedExamId.value)
  const buckets = getScoreDistribution(attempts)
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 48, right: 16, top: 24, bottom: 32 },
    xAxis: { type: 'category' as const, data: buckets.map((b) => b.label + '分') },
    yAxis: { type: 'value' as const, minInterval: 1 },
    series: [{ type: 'bar' as const, data: buckets.map((b) => b.count), itemStyle: { color: '#409eff' } }],
  }
})

const personalRows = computed(() => {
  const examId = selectedExamId.value
  const exam = selectedExam.value
  const course = linkedCourse.value
  if (!examId || !exam || !course) return []
  const assignees = resolveCourseAssignees(course, store.activeEmployees, store.departments)
  const attemptMap = new Map<string, ExamAttempt[]>()
  for (const a of store.examAttempts.filter((x) => x.examId === examId)) {
    const list = attemptMap.get(a.employeeId) ?? []
    list.push(a)
    attemptMap.set(a.employeeId, list)
  }
  return assignees.map((emp) => {
    const dept = store.departments.find((d) => d.id === emp.departmentId)
    let rec = store.courseLearningRecords.find(
      (r) => r.courseId === course.id && r.employeeId === emp.id,
    )
    if (!rec) {
      rec = {
        id: '',
        courseId: course.id,
        employeeId: emp.id,
        status: 'not_started',
        completedMaterialIds: [],
        studyMinutes: 0,
        updatedAt: '',
      }
    }
    const progress = getLearningProgress(rec, course)
    const status = getEmployeeExamStatus(emp.id, examId, store.examAttempts)
    const canTake = canEmployeeTakeExam(emp.id, course, rec, exam, store.examAttempts)
    return {
      employeeId: emp.id,
      name: emp.name,
      department: dept?.name ?? '-',
      learningProgress: `${progress}%`,
      examEligibility: getExamEligibilityLabel(rec, course, rec.examPassed, rec.examScore),
      canTakeLabel: canTake ? '可考试' : progress < 100 ? '待解锁' : '不可重考',
      examStatus: status.status === 'not_taken' ? '未考' : '已考',
      score: status.status !== 'not_taken' ? status.score : '-',
      passed: status.status === 'passed' ? '是' : status.status === 'failed' ? '否' : '-',
      duration: status.status !== 'not_taken' ? `${status.durationMinutes} 分` : '-',
      examTime: status.status !== 'not_taken' ? status.submittedAt?.slice(0, 16).replace('T', ' ') : '-',
      retakeCount: status.status !== 'not_taken' ? status.attemptNumber : '-',
      latestAttempt: attemptMap.get(emp.id)?.sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))[0],
    }
  })
})

function openDetail(row: { latestAttempt?: ExamAttempt }) {
  if (!row.latestAttempt) {
    ElMessage.info('该人员尚未参加考试')
    return
  }
  selectedAttempt.value = row.latestAttempt
  detailVisible.value = true
}

function exportScores() {
  ElMessage.success('成绩单导出任务已提交（模拟）')
}

const detailQuestions = computed(() => {
  if (!selectedAttempt.value) return []
  const questions = getExamQuestions(selectedAttempt.value.examId, store.examQuestions)
  return questions.map((q) => {
    const userAns = selectedAttempt.value!.answers[q.id] ?? []
    const correct = q.correctAnswers.every((a) => userAns.includes(a)) && userAns.length === q.correctAnswers.length
    return {
      ...q,
      typeLabel: examQuestionTypeMap[q.type],
      userAnswers: userAns.join(', ') || '-',
      correctLabel: q.correctAnswers.join(', '),
      isCorrect: correct,
      earned: correct ? q.score : 0,
    }
  })
})
</script>

<template>
  <div class="page-card">
    <div class="page-header">
      <div>
        <h2 class="page-title">考核结果查看</h2>
        <p class="text-muted">查看企业考核与通用考核的通过率、分数分布及个人答题详情</p>
      </div>
      <el-button @click="exportScores">导出成绩单</el-button>
    </div>

    <div class="page-toolbar">
      <el-select v-if="isPlatform" v-model="typeFilter" placeholder="类型" style="width: 120px">
        <el-option
          v-for="o in trainingTypeFilterOptions"
          :key="o.value"
          :label="o.label"
          :value="o.value"
        />
      </el-select>
      <el-select
        v-if="isPlatform && typeFilter !== 'global'"
        v-model="enterpriseFilter"
        placeholder="所属企业"
        clearable
        style="width: 200px"
      >
        <el-option v-for="e in store.enterprises" :key="e.id" :label="e.name" :value="e.id" />
      </el-select>
      <el-select v-model="selectedExamId" placeholder="选择考核" style="width: 280px">
        <el-option
          v-for="e in publishedExams"
          :key="e.id"
          :label="`${e.enterpriseId == null ? '[通用]' : '[企业]'} ${e.name}`"
          :value="e.id"
        />
      </el-select>
    </div>

    <template v-if="selectedExam && examStats">
      <el-alert
        v-if="linkedCourse"
        type="info"
        :closable="false"
        show-icon
        style="margin-bottom: 16px"
        :title="`关联课程：${linkedCourse.name} · 学员须完成课程学习（100%）后方可参加考核`"
      />
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-label">考核名称</div>
          <div class="stat-value sm">{{ selectedExam.name }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">应考人数</div>
          <div class="stat-value">{{ examStats.shouldTake }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">已考人数</div>
          <div class="stat-value">{{ examStats.taken }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">通过人数</div>
          <div class="stat-value">{{ examStats.passed }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">通过率</div>
          <div class="stat-value">{{ examStats.passRate }}%</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">平均分</div>
          <div class="stat-value">{{ examStats.avgScore }}</div>
        </div>
      </div>

      <div class="chart-section">
        <h3>分数分布</h3>
        <VChart v-if="scoreChartOption" :option="scoreChartOption" height="260px" />
      </div>

      <h3 class="section-title">个人成绩明细</h3>
      <el-table :data="personalRows" border stripe>
        <el-table-column prop="name" label="灵工姓名" width="100" />
        <el-table-column prop="department" label="所属部门" width="120" />
        <el-table-column prop="learningProgress" label="学习进度" width="90" align="center" />
        <el-table-column prop="examEligibility" label="考核状态" width="140" />
        <el-table-column prop="canTakeLabel" label="可否考试" width="90" align="center" />
        <el-table-column prop="examStatus" label="考试状态" width="90" />
        <el-table-column prop="score" label="分数" width="70" align="center" />
        <el-table-column prop="passed" label="是否通过" width="90" align="center" />
        <el-table-column prop="duration" label="用时" width="90" />
        <el-table-column prop="examTime" label="考试时间" min-width="150" />
        <el-table-column prop="retakeCount" label="重考次数" width="90" align="center" />
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row)">答题详情</el-button>
          </template>
        </el-table-column>
      </el-table>
    </template>
  </div>

  <el-dialog v-model="detailVisible" title="个人答题详情" width="640px">
    <template v-if="selectedAttempt">
      <p class="summary">
        得分 <strong>{{ selectedAttempt.score }}</strong> ·
        {{ selectedAttempt.passed ? '通过' : '未通过' }} ·
        用时 {{ selectedAttempt.durationMinutes }} 分钟
      </p>
      <div v-for="(q, i) in detailQuestions" :key="q.id" class="q-item">
        <div class="q-head">
          <span>{{ i + 1 }}. [{{ q.typeLabel }}] {{ q.content }}</span>
          <el-tag size="small" :type="q.isCorrect ? 'success' : 'danger'">{{ q.earned }}/{{ q.score }}分</el-tag>
        </div>
        <p class="text-muted">你的答案：{{ q.userAnswers }} · 正确答案：{{ q.correctLabel }}</p>
      </div>
    </template>
  </el-dialog>
</template>

<style scoped>
.stats-row {
  display: grid;
  grid-template-columns: repeat(6, 1fr);
  gap: 12px;
  margin-bottom: 20px;
}
.stat-card {
  padding: 16px;
  background: #fafafa;
  border: 1px solid #eee;
  border-radius: 8px;
}
.stat-label { font-size: 12px; color: #909399; margin-bottom: 6px; }
.stat-value { font-size: 28px; font-weight: 700; color: #303133; }
.stat-value.sm { font-size: 15px; font-weight: 600; }
.chart-section { margin-bottom: 24px; }
.chart-section h3, .section-title { font-size: 15px; margin: 0 0 12px; }
.summary { margin-bottom: 16px; }
.q-item { padding: 12px 0; border-bottom: 1px solid #eee; }
.q-head { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 4px; }
@media (max-width: 1200px) {
  .stats-row { grid-template-columns: repeat(2, 1fr); }
}
</style>
