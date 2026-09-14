<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { useTrainingScope } from '@/composables/useTrainingScope'
import {
  getCourseCompletionStats,
  getCourseExamStatusItems,
  getDepartmentLearningRanking,
  resolveCourseAssignees,
} from '@/services/training'
import { resolveEnterpriseIdByEmployee } from '@/utils/enterpriseScope'
import type { CourseLearningRecord } from '@/types'

const store = useAppStore()
const route = useRoute()
const { isPlatform, enterpriseFilter, filterByTrainingType } = useTrainingScope()
const selectedCourseId = ref<string>('')

const selectableCourses = computed(() =>
  filterByTrainingType(
    store.trainingCourses.filter(
      (c) => c.status === 'published' || c.status === 'offline' || c.status === 'closed',
    ),
  ),
)

watch(
  () => route.query.course,
  (id) => {
    if (typeof id === 'string') selectedCourseId.value = id
    else if (!selectedCourseId.value && selectableCourses.value.length) {
      selectedCourseId.value = selectableCourses.value[0].id
    }
  },
  { immediate: true },
)

watch(selectableCourses, (list) => {
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

function enterpriseName(enterpriseId: string | null | undefined) {
  if (!enterpriseId) return '通用'
  return (
    store.enterprises.find((e) => e.id === enterpriseId)?.shortName ||
    store.enterprises.find((e) => e.id === enterpriseId)?.name ||
    '-'
  )
}

const courseStats = computed(() => {
  const c = selectedCourse.value
  if (!c) return null
  return getCourseCompletionStats(c, store.courseLearningRecords, store.employees, store.departments)
})

const departmentRanking = computed(() => {
  const c = selectedCourse.value
  if (!c) return []
  return getDepartmentLearningRanking(
    c,
    store.courseLearningRecords,
    store.employees,
    store.departments,
  )
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
    const examItems = getCourseExamStatusItems(
      emp.id,
      c,
      rec,
      store.trainingExams,
      store.examAttempts,
    )
    const empEnterpriseId = resolveEnterpriseIdByEmployee(emp)
    return {
      employeeId: emp.id,
      name: emp.name,
      phone: emp.phone ?? '-',
      enterprise: enterpriseName(empEnterpriseId || c.enterpriseId),
      department: dept?.name ?? '-',
      courseName: c.name,
      studyMinutes: rec.studyMinutes,
      examItems,
      completedAt: rec.completedAt?.slice(0, 16).replace('T', ' ') ?? '-',
    }
  })
})

const incompleteIds = computed(() =>
  employeeRows.value
    .filter((r) => {
      const rec = store.courseLearningRecords.find(
        (lr) => lr.courseId === selectedCourseId.value && lr.employeeId === r.employeeId,
      )
      return rec?.status !== 'completed'
    })
    .map((r) => r.employeeId),
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
      <el-select
        v-if="isPlatform"
        v-model="enterpriseFilter"
        placeholder="所属企业"
        clearable
        style="width: 200px"
      >
        <el-option v-for="e in store.enterprises" :key="e.id" :label="e.name" :value="e.id" />
      </el-select>
      <el-select v-model="selectedCourseId" placeholder="选择课程" style="width: 280px">
        <el-option
          v-for="c in selectableCourses"
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
          <div class="stat-label">总人数</div>
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

      <h3 class="section-title">部门学习进度排行</h3>
      <el-table :data="departmentRanking" border stripe style="margin-bottom: 24px; max-width: 560px">
        <el-table-column type="index" label="排名" width="70" align="center" />
        <el-table-column prop="departmentName" label="部门" min-width="160" show-overflow-tooltip />
        <el-table-column prop="studied" label="已学习人数" width="110" align="center" />
        <el-table-column label="完成率" width="100" align="center">
          <template #default="{ row }">{{ row.completionRate }}%</template>
        </el-table-column>
      </el-table>

      <h3 class="section-title">灵工学习明细</h3>
      <el-table :data="employeeRows" border stripe>
        <el-table-column prop="name" label="姓名" width="100" />
        <el-table-column prop="phone" label="手机号" width="120" />
        <el-table-column prop="enterprise" label="企业" width="120" show-overflow-tooltip />
        <el-table-column prop="department" label="部门" width="120" />
        <el-table-column prop="courseName" label="课程名称" min-width="140" show-overflow-tooltip />
        <el-table-column label="学习时长" width="100" align="center">
          <template #default="{ row }">{{ row.studyMinutes }} 分钟</template>
        </el-table-column>
        <el-table-column prop="completedAt" label="完成时间" min-width="150" />
        <el-table-column label="考核情况" min-width="220">
          <template #default="{ row }">
            <template v-if="row.examItems.length === 0">——</template>
            <div v-else class="exam-status-list">
              <div v-for="item in row.examItems" :key="item.examId" class="exam-status-item">
                <span class="exam-name">{{ item.examName }}</span>
                <span class="exam-status">{{ item.statusLabel }}</span>
              </div>
            </div>
          </template>
        </el-table-column>
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
.section-title { font-size: 15px; margin: 0 0 12px; }
.exam-status-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  line-height: 1.4;
}
.exam-status-item {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  font-size: 13px;
}
.exam-name {
  color: #303133;
  font-weight: 500;
}
.exam-name::after {
  content: '：';
}
.exam-status {
  color: #606266;
}
@media (max-width: 1200px) {
  .stats-row { grid-template-columns: repeat(2, 1fr); }
}
</style>
