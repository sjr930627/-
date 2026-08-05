<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { useTrainingScope } from '@/composables/useTrainingScope'
import { trainingTypeFilterOptions } from '@/constants/trainingOwner'
import VChart from '@/components/statistics/VChart.vue'
import {
  learningStatusMap,
  learningStatusTagType,
} from '@/constants/training'
import {
  getCourseCompletionStats,
  getDepartmentCompletionRates,
  getExamEligibilityLabel,
  getLearningProgress,
  resolveCourseAssignees,
} from '@/services/training'
import type { CourseLearningRecord } from '@/types'
import type { EChartsOption } from 'echarts'

const store = useAppStore()
const route = useRoute()
const { isPlatform, typeFilter, enterpriseFilter, filterByTrainingType } = useTrainingScope()
const selectedCourseId = ref<string>('')

const publishedCourses = computed(() =>
  filterByTrainingType(
    store.trainingCourses.filter((c) => c.status === 'published' || c.status === 'closed'),
  ),
)

watch(
  () => route.query.course,
  (id) => {
    if (typeof id === 'string') selectedCourseId.value = id
    else if (!selectedCourseId.value && publishedCourses.value.length) {
      selectedCourseId.value = publishedCourses.value[0].id
    }
  },
  { immediate: true },
)

watch(publishedCourses, (list) => {
  if (list.length === 0) {
    selectedCourseId.value = ''
    return
  }
  if (!list.some((c) => c.id === selectedCourseId.value)) {
    selectedCourseId.value = list[0].id
  }
})

const selectedCourse = computed(() =>
  store.trainingCourses.find((c) => c.id === selectedCourseId.value),
)

const courseStats = computed(() => {
  const c = selectedCourse.value
  if (!c) return null
  return getCourseCompletionStats(c, store.courseLearningRecords, store.employees, store.departments)
})

const deptChartOption = computed((): EChartsOption | null => {
  const c = selectedCourse.value
  if (!c) return null
  const rates = getDepartmentCompletionRates(c, store.courseLearningRecords, store.employees, store.departments)
  return {
    tooltip: { trigger: 'axis' },
    grid: { left: 48, right: 16, top: 24, bottom: 48 },
    xAxis: { type: 'category' as const, data: rates.map((d) => d.name), axisLabel: { rotate: 30 } },
    yAxis: { type: 'value' as const, max: 100, axisLabel: { formatter: '{value}%' } },
    series: [{ type: 'bar' as const, data: rates.map((d) => d.rate), itemStyle: { color: '#e60012' } }],
  }
})

const employeeRows = computed(() => {
  const c = selectedCourse.value
  if (!c) return []
  const assignees = resolveCourseAssignees(c, store.employees, store.departments)
  return assignees.map((emp) => {
    const dept = store.departments.find((d) => d.id === emp.departmentId)
    let rec = store.courseLearningRecords.find(
      (r) => r.courseId === c.id && r.employeeId === emp.id,
    )
    if (!rec) {
      rec = {
        id: '',
        courseId: c.id,
        employeeId: emp.id,
        status: 'not_started',
        completedMaterialIds: [],
        studyMinutes: 0,
        updatedAt: '',
      } as CourseLearningRecord
    }
    const progress = getLearningProgress(rec, c)
    const exam = c.examId ? store.trainingExams.find((e) => e.id === c.examId) : null
    const examLabel = exam
      ? getExamEligibilityLabel(rec, c, rec.examPassed, rec.examScore)
      : '-'
    return {
      employeeId: emp.id,
      name: emp.name,
      department: dept?.name ?? '-',
      status: rec.status,
      statusLabel: learningStatusMap[rec.status],
      statusTag: learningStatusTagType[rec.status],
      progress,
      studyMinutes: rec.studyMinutes,
      examLabel,
      completedAt: rec.completedAt?.slice(0, 16).replace('T', ' ') ?? '-',
    }
  })
})

const incompleteIds = computed(() =>
  employeeRows.value.filter((r) => r.status !== 'completed').map((r) => r.employeeId),
)

async function sendReminder() {
  if (!selectedCourseId.value || incompleteIds.value.length === 0) {
    ElMessage.info('暂无未完成人员')
    return
  }
  await ElMessageBox.confirm(
    `向 ${incompleteIds.value.length} 名未完成人员发送学习提醒？`,
    '一键提醒',
  )
  const count = store.sendLearningReminder(selectedCourseId.value, incompleteIds.value)
  ElMessage.success(`已通过小程序消息向 ${count} 人发送提醒`)
}

function exportDetail() {
  ElMessage.success('学习明细表导出任务已提交（模拟）')
}
</script>

<template>
  <div class="page-card">
    <div class="page-header">
      <div>
        <h2 class="page-title">学习进度监控</h2>
        <p class="text-muted">查看企业课程与通用课程的学习完成情况和灵工学习详情</p>
      </div>
      <div class="header-actions">
        <el-button @click="exportDetail">导出明细</el-button>
        <el-button type="primary" @click="sendReminder">一键提醒未完成</el-button>
      </div>
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
      <el-select v-model="selectedCourseId" placeholder="选择课程" style="width: 280px">
        <el-option
          v-for="c in publishedCourses"
          :key="c.id"
          :label="`${c.enterpriseId == null ? '[通用]' : '[企业]'} ${c.name}`"
          :value="c.id"
        />
      </el-select>
    </div>

    <template v-if="selectedCourse && courseStats">
      <div class="stats-row">
        <div class="stat-card">
          <div class="stat-label">课程名称</div>
          <div class="stat-value sm">{{ selectedCourse.name }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">下发总人数</div>
          <div class="stat-value">{{ courseStats.total }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">已完成</div>
          <div class="stat-value">{{ courseStats.completed }}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">完成率</div>
          <div class="stat-value">{{ courseStats.rate }}%</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">平均学习时长</div>
          <div class="stat-value">{{ courseStats.avgMinutes }}<span class="unit">分</span></div>
        </div>
      </div>

      <div class="chart-section">
        <h3>部门完成率排行</h3>
        <VChart v-if="deptChartOption" :option="deptChartOption" height="260px" />
      </div>

      <h3 class="section-title">灵工学习明细</h3>
      <el-table :data="employeeRows" border stripe>
        <el-table-column prop="name" label="灵工姓名" width="100" />
        <el-table-column prop="department" label="所属部门" width="120" />
        <el-table-column label="学习状态" width="100">
          <template #default="{ row }">
            <el-tag size="small" :type="row.statusTag">{{ row.statusLabel }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="学习进度" width="120">
          <template #default="{ row }">
            <el-progress :percentage="row.progress" :stroke-width="8" />
          </template>
        </el-table-column>
        <el-table-column label="学习时长" width="100" align="center">
          <template #default="{ row }">{{ row.studyMinutes }} 分钟</template>
        </el-table-column>
        <el-table-column prop="examLabel" label="考核情况" width="160" />
        <el-table-column prop="completedAt" label="完成时间" min-width="150" />
      </el-table>
    </template>
  </div>
</template>

<style scoped>
.header-actions { display: flex; gap: 8px; }
.stats-row {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
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
.unit { font-size: 14px; font-weight: 400; margin-left: 2px; }
.chart-section { margin-bottom: 24px; }
.chart-section h3, .section-title { font-size: 15px; margin: 0 0 12px; }
@media (max-width: 1200px) {
  .stats-row { grid-template-columns: repeat(2, 1fr); }
}
</style>
