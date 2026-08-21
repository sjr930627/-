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
  getExamDetailStatusLabel,
  getExamLinkedCourses,
  getExamQuestions,
  getExamStats,
  getLearningProgress,
  getScoreDistribution,
  resolveCourseAssignees,
} from '@/services/training'
import { resolveEnterpriseIdByEmployee } from '@/utils/enterpriseScope'
import type { CourseLearningRecord, ExamAttempt } from '@/types'
import type { EChartsOption } from 'echarts'

const store = useAppStore()
const route = useRoute()
const { isPlatform, typeFilter, enterpriseFilter, filterByTrainingType } = useTrainingScope()
const selectedExamId = ref<string>('')
const detailVisible = ref(false)
const detailEmployeeId = ref<string>('')

const selectableExams = computed(() =>
  filterByTrainingType(
    store.trainingExams.filter((e) => e.status === 'published' || e.status === 'offline'),
  ),
)

watch(
  () => route.query.exam,
  (id) => {
    if (typeof id === 'string') selectedExamId.value = id
    else if (!selectedExamId.value && selectableExams.value.length) {
      selectedExamId.value = selectableExams.value[0].id
    }
  },
  { immediate: true },
)

watch(selectableExams, (list) => {
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

function enterpriseName(enterpriseId: string | null | undefined) {
  if (!enterpriseId) return '通用'
  return (
    store.enterprises.find((ent) => ent.id === enterpriseId)?.shortName ||
    store.enterprises.find((ent) => ent.id === enterpriseId)?.name ||
    '-'
  )
}

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
      } as CourseLearningRecord
    }
    const progress = getLearningProgress(rec, course)
    const empAttempts = (attemptMap.get(emp.id) ?? []).sort((a, b) =>
      b.submittedAt.localeCompare(a.submittedAt),
    )
    const latest = empAttempts[0]
    const canTake = canEmployeeTakeExam(emp.id, course, rec, exam, store.examAttempts)
    const examStatusLabel = getExamDetailStatusLabel({
      progress,
      canTake,
      hasAttempt: empAttempts.length > 0,
      passed: latest?.passed,
    })
    const empEnterpriseId = resolveEnterpriseIdByEmployee(emp)
    return {
      employeeId: emp.id,
      name: emp.name,
      phone: emp.phone ?? '-',
      enterprise: enterpriseName(empEnterpriseId || exam.enterpriseId),
      department: dept?.name ?? '-',
      examName: exam.name,
      examStatusLabel,
      score: latest ? latest.score : '-',
      examTime: latest ? latest.submittedAt.slice(0, 16).replace('T', ' ') : '-',
      duration: latest ? `${latest.durationMinutes} 分` : '-',
      passed: latest ? (latest.passed ? '是' : '否') : '-',
      hasAttempts: empAttempts.length > 0,
    }
  })
})

const detailAttempts = computed(() => {
  if (!detailEmployeeId.value || !selectedExamId.value) return []
  return store.examAttempts
    .filter((a) => a.examId === selectedExamId.value && a.employeeId === detailEmployeeId.value)
    .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
})

function getWrongQuestions(attempt: ExamAttempt) {
  const questions = getExamQuestions(attempt.examId, store.examQuestions)
  return questions
    .map((q) => {
      const userAns = attempt.answers[q.id] ?? []
      const correct =
        q.correctAnswers.every((a) => userAns.includes(a)) &&
        userAns.length === q.correctAnswers.length
      return {
        ...q,
        typeLabel: examQuestionTypeMap[q.type],
        userAnswers: userAns.join(', ') || '-',
        correctLabel: q.correctAnswers.join(', '),
        isCorrect: correct,
      }
    })
    .filter((q) => !q.isCorrect)
}

function openDetail(row: { employeeId: string; hasAttempts: boolean }) {
  if (!row.hasAttempts) {
    ElMessage.info('该人员尚未参加考试')
    return
  }
  detailEmployeeId.value = row.employeeId
  detailVisible.value = true
}

function exportScores() {
  ElMessage.success('成绩单导出任务已提交（模拟）')
}

const detailEmployeeName = computed(() => {
  const emp = store.employees.find((e) => e.id === detailEmployeeId.value)
  return emp?.name ?? ''
})
</script>

<template>
  <div class="page-card">
    <div class="page-header">
      <div>
        <h2 class="page-title">考核数据</h2>
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
          v-for="e in selectableExams"
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
        <el-table-column prop="name" label="姓名" width="100" />
        <el-table-column prop="phone" label="手机号" width="120" />
        <el-table-column prop="enterprise" label="企业" width="120" show-overflow-tooltip />
        <el-table-column prop="department" label="部门" width="120" />
        <el-table-column prop="examName" label="考核名称" min-width="140" show-overflow-tooltip />
        <el-table-column prop="examStatusLabel" label="考核状态" min-width="150" show-overflow-tooltip />
        <el-table-column prop="score" label="考核分数" width="90" align="center" />
        <el-table-column prop="examTime" label="考核时间(最新)" min-width="150" />
        <el-table-column prop="duration" label="用时" width="90" />
        <el-table-column prop="passed" label="考核是否通过" width="110" align="center" />
        <el-table-column label="操作" width="90" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openDetail(row)">详情</el-button>
          </template>
        </el-table-column>
      </el-table>
    </template>
  </div>

  <el-dialog v-model="detailVisible" :title="`${detailEmployeeName} · 考核记录`" width="680px">
    <template v-if="detailAttempts.length">
      <div v-for="(attempt, idx) in detailAttempts" :key="attempt.id" class="attempt-block">
        <div class="attempt-head">
          <strong>第 {{ attempt.attemptNumber }} 次考核</strong>
          <span class="text-muted">{{ attempt.submittedAt.slice(0, 16).replace('T', ' ') }}</span>
          <el-tag size="small" :type="attempt.passed ? 'success' : 'danger'">
            {{ attempt.score }} 分 · {{ attempt.passed ? '通过' : '未通过' }} ·
            用时 {{ attempt.durationMinutes }} 分钟
          </el-tag>
        </div>
        <template v-if="getWrongQuestions(attempt).length">
          <div v-for="(q, i) in getWrongQuestions(attempt)" :key="q.id" class="q-item">
            <div class="q-head">
              <span>{{ i + 1 }}. [{{ q.typeLabel }}] {{ q.content }}</span>
              <el-tag size="small" type="danger">答错</el-tag>
            </div>
            <p class="text-muted">你的答案：{{ q.userAnswers }} · 正确答案：{{ q.correctLabel }}</p>
          </div>
        </template>
        <p v-else class="text-muted attempt-all-correct">本次考核全部答对</p>
        <el-divider v-if="idx < detailAttempts.length - 1" />
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
.attempt-block { margin-bottom: 8px; }
.attempt-head {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 12px;
}
.q-item { padding: 10px 0; border-bottom: 1px solid #f0f0f0; }
.q-head { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 4px; }
.attempt-all-correct { padding: 8px 0; }
@media (max-width: 1200px) {
  .stats-row { grid-template-columns: repeat(2, 1fr); }
}
</style>
