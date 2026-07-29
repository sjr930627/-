<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import {
  courseScopeTypeOptions,
  courseStatusMap,
  courseStatusTagType,
  courseStudyModeOptions,
} from '@/constants/training'
import { getCourseCompletionStats } from '@/services/training'
import type { CourseScopeType, CourseStudyMode, TrainingCourse } from '@/types'

const store = useAppStore()
const router = useRouter()
const statusFilter = ref<'all' | TrainingCourse['status']>('all')
const dialogVisible = ref(false)
const editingId = ref<string | null>(null)

const form = ref({
  name: '',
  description: '',
  materialIds: [] as string[],
  studyMode: 'sequential' as CourseStudyMode,
  videoNoSeek: true,
  minStudyMinutes: undefined as number | undefined,
  examId: '' as string,
  scopeType: 'all' as CourseScopeType,
  scopeDepartmentIds: [] as string[],
  scopeTags: [] as string[],
  validRange: null as [string, string] | null,
})

const approvedMaterials = computed(() =>
  store.trainingMaterials.filter((m) => m.status === 'approved'),
)

const publishedExams = computed(() =>
  store.trainingExams.filter((e) => e.status === 'published'),
)

const tableData = computed(() =>
  store.trainingCourses
    .filter((c) => statusFilter.value === 'all' || c.status === statusFilter.value)
    .map((c) => {
      const stats = getCourseCompletionStats(
        c,
        store.courseLearningRecords,
        store.employees,
        store.departments,
      )
      const exam = c.examId ? store.trainingExams.find((e) => e.id === c.examId) : null
      return {
        ...c,
        statusLabel: courseStatusMap[c.status],
        statusTag: courseStatusTagType[c.status],
        materialCount: c.materialIds.length,
        examName: exam?.name ?? '-',
        assignCount: stats.total,
        completionRate: stats.rate,
      }
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
)

function openCreate() {
  editingId.value = null
  form.value = {
    name: '',
    description: '',
    materialIds: [],
    studyMode: 'sequential',
    videoNoSeek: true,
    minStudyMinutes: undefined,
    examId: '',
    scopeType: 'all',
    scopeDepartmentIds: [],
    scopeTags: [],
    validRange: null,
  }
  dialogVisible.value = true
}

function openEdit(row: TrainingCourse) {
  if (row.status === 'published') {
    ElMessage.warning('已发布课程不可编辑')
    return
  }
  editingId.value = row.id
  form.value = {
    name: row.name,
    description: row.description ?? '',
    materialIds: [...row.materialIds],
    studyMode: row.studyMode,
    videoNoSeek: row.videoNoSeek,
    minStudyMinutes: row.minStudyMinutes,
    examId: row.examId ?? '',
    scopeType: row.scopeType,
    scopeDepartmentIds: row.scopeDepartmentIds ?? [],
    scopeTags: row.scopeTags ?? [],
    validRange: row.validFrom && row.validTo ? [row.validFrom, row.validTo] : null,
  }
  dialogVisible.value = true
}

function submit() {
  if (!form.value.name.trim() || form.value.materialIds.length === 0) {
    ElMessage.warning('请填写课程名称并关联至少一项资料')
    return
  }
  const payload = {
    name: form.value.name.trim(),
    description: form.value.description.trim(),
    materialIds: form.value.materialIds,
    studyMode: form.value.studyMode,
    videoNoSeek: form.value.videoNoSeek,
    minStudyMinutes: form.value.minStudyMinutes,
    examId: form.value.examId || undefined,
    scopeType: form.value.scopeType,
    scopeDepartmentIds: form.value.scopeType === 'department' ? form.value.scopeDepartmentIds : undefined,
    scopeTags: form.value.scopeType === 'tag' ? form.value.scopeTags : undefined,
    validFrom: form.value.validRange?.[0],
    validTo: form.value.validRange?.[1],
    status: 'draft' as const,
  }
  try {
    if (editingId.value) {
      store.updateTrainingCourse(editingId.value, payload)
      ElMessage.success('更新成功')
    } else {
      store.addTrainingCourse(payload)
      ElMessage.success('创建成功')
    }
    dialogVisible.value = false
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '操作失败')
  }
}

async function publish(row: TrainingCourse) {
  await ElMessageBox.confirm(`发布课程「${row.name}」？发布后将不可编辑。`, '发布确认')
  try {
    store.publishTrainingCourse(row.id)
    ElMessage.success('已发布')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '发布失败')
  }
}

async function closeCourse(row: TrainingCourse) {
  await ElMessageBox.confirm(`关闭课程「${row.name}」？`, '提示', { type: 'warning' })
  store.closeTrainingCourse(row.id)
  ElMessage.success('已关闭')
}

function viewProgress(courseId: string) {
  router.push({ path: '/training/progress', query: { course: courseId } })
}
</script>

<template>
  <div class="page-card">
    <div class="page-header">
      <div>
        <h2 class="page-title">课程管理</h2>
        <p class="text-muted">将培训资料组合成课程，关联考核并下发至指定灵工群体</p>
      </div>
      <el-button type="primary" @click="openCreate">创建课程</el-button>
    </div>

    <div class="page-toolbar">
      <el-radio-group v-model="statusFilter">
        <el-radio-button value="all">全部</el-radio-button>
        <el-radio-button value="draft">草稿</el-radio-button>
        <el-radio-button value="published">已发布</el-radio-button>
        <el-radio-button value="closed">已关闭</el-radio-button>
      </el-radio-group>
    </div>

    <el-table :data="tableData" border stripe>
      <el-table-column prop="name" label="课程名称" min-width="180" />
      <el-table-column label="关联资料" width="90" align="center">
        <template #default="{ row }">{{ row.materialCount }}</template>
      </el-table-column>
      <el-table-column prop="examName" label="关联考核" min-width="140" />
      <el-table-column label="下发人数" width="90" align="center">
        <template #default="{ row }">{{ row.assignCount }}</template>
      </el-table-column>
      <el-table-column label="完成率" width="90" align="center">
        <template #default="{ row }">
          <span :style="{ color: row.completionRate >= 80 ? '#67c23a' : '#e6a23c' }">{{ row.completionRate }}%</span>
        </template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag size="small" :type="row.statusTag">{{ row.statusLabel }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="创建时间" width="170">
        <template #default="{ row }">{{ row.createdAt.slice(0, 16).replace('T', ' ') }}</template>
      </el-table-column>
      <el-table-column label="操作" width="240" fixed="right">
        <template #default="{ row }">
          <el-button v-if="row.status !== 'published'" link type="primary" @click="openEdit(row)">编辑</el-button>
          <el-button v-if="row.status === 'draft'" link type="success" @click="publish(row)">发布</el-button>
          <el-button v-if="row.status === 'published'" link type="warning" @click="closeCourse(row)">关闭</el-button>
          <el-button link @click="viewProgress(row.id)">学习详情</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>

  <el-dialog v-model="dialogVisible" :title="editingId ? '编辑课程' : '创建课程'" width="720px">
    <el-form label-width="110px">
      <el-form-item label="课程名称" required>
        <el-input v-model="form.name" placeholder="如：新入职安全合规必修课" />
      </el-form-item>
      <el-form-item label="课程简介">
        <el-input v-model="form.description" type="textarea" :rows="2" placeholder="课程目标及内容概述" />
      </el-form-item>
      <el-form-item label="关联资料" required>
        <el-select v-model="form.materialIds" multiple style="width: 100%" placeholder="按学习顺序选择">
          <el-option
            v-for="m in approvedMaterials"
            :key="m.id"
            :label="m.name"
            :value="m.id"
          />
        </el-select>
        <div class="text-muted" style="margin-top: 4px; font-size: 12px">选择顺序即为学习顺序</div>
      </el-form-item>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="学习要求">
            <el-select v-model="form.studyMode" style="width: 100%">
              <el-option v-for="o in courseStudyModeOptions" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="最低学习时长">
            <el-input-number v-model="form.minStudyMinutes" :min="0" placeholder="分钟" style="width: 100%" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-form-item label="视频禁止拖拽">
        <el-switch v-model="form.videoNoSeek" />
      </el-form-item>
      <el-form-item label="关联考核">
        <el-select v-model="form.examId" clearable style="width: 100%" placeholder="学完后自动触发考试">
          <el-option v-for="e in publishedExams" :key="e.id" :label="e.name" :value="e.id" />
        </el-select>
        <div class="text-muted" style="margin-top: 4px; font-size: 12px">须先完成课程全部资料学习，学员方可参加考核</div>
      </el-form-item>
      <el-form-item label="下发范围" required>
        <el-select v-model="form.scopeType" style="width: 100%">
          <el-option v-for="o in courseScopeTypeOptions" :key="o.value" :label="o.label" :value="o.value" />
        </el-select>
      </el-form-item>
      <el-form-item v-if="form.scopeType === 'department'" label="选择部门">
        <el-select v-model="form.scopeDepartmentIds" multiple style="width: 100%">
          <el-option v-for="d in store.departments" :key="d.id" :label="d.name" :value="d.id" />
        </el-select>
      </el-form-item>
      <el-form-item v-if="form.scopeType === 'tag'" label="选择标签">
        <el-select v-model="form.scopeTags" multiple filterable allow-create style="width: 100%" />
      </el-form-item>
      <el-form-item label="有效期">
        <el-date-picker
          v-model="form.validRange"
          type="daterange"
          value-format="YYYY-MM-DD"
          start-placeholder="开始"
          end-placeholder="结束"
          style="width: 100%"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="dialogVisible = false">取消</el-button>
      <el-button type="primary" @click="submit">保存</el-button>
    </template>
  </el-dialog>
</template>
