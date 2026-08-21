<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { useTrainingScope } from '@/composables/useTrainingScope'
import { trainingOwnerTypeOptions, trainingTypeFilterOptions } from '@/constants/trainingOwner'
import { examStatusMap, examStatusTagType } from '@/constants/training'
import {
  countCoursesUsingExam,
  getExamLinkedCourseLabel,
  getExamQuestions,
  getExamTotalScore,
  isGlobalTrainingOwner,
  type TrainingOwnerScope,
} from '@/services/training'
import type { TrainingExam } from '@/types'

const store = useAppStore()
const router = useRouter()
const {
  isPlatform,
  isEnterprise,
  typeFilter,
  enterpriseFilter,
  defaultEnterpriseId,
  filterByTrainingType,
  filterPeersForOwner,
  ownerTypeLabel,
  examResultPath,
  examQuestionsPath,
} = useTrainingScope()

const examDialogVisible = ref(false)
const editingExamId = ref<string | null>(null)

const examForm = ref({
  ownerType: 'enterprise' as TrainingOwnerScope,
  enterpriseId: defaultEnterpriseId.value as string | null,
  name: '',
  description: '',
  courseId: '' as string,
  durationMinutes: 30,
  passScore: 80,
  maxRetakes: 2,
  retakeIntervalHours: 24,
})

const formOwnerEnterpriseId = computed(() =>
  examForm.value.ownerType === 'global' ? null : examForm.value.enterpriseId,
)

const courseOptions = computed(() =>
  filterPeersForOwner(store.trainingCourses, formOwnerEnterpriseId.value).map((c) => ({
    id: c.id,
    label: `${c.name}${c.status === 'published' ? '' : '（草稿）'}`,
    disabled: !!c.examId && (!editingExamId.value || c.examId !== editingExamId.value),
  })),
)

watch(
  () => [examForm.value.ownerType, examForm.value.enterpriseId] as const,
  () => {
    if (examForm.value.ownerType === 'global') examForm.value.enterpriseId = null
    else if (!examForm.value.enterpriseId) examForm.value.enterpriseId = defaultEnterpriseId.value
    if (examForm.value.courseId && !courseOptions.value.some((c) => c.id === examForm.value.courseId)) {
      examForm.value.courseId = ''
    }
  },
)

const examList = computed(() =>
  filterByTrainingType(store.trainingExams)
    .map((e) => {
      const questions = getExamQuestions(e.id, store.examQuestions)
      return {
        ...e,
        ownerTypeLabel: ownerTypeLabel(e.enterpriseId),
        statusLabel: examStatusMap[e.status],
        statusTagType: examStatusTagType[e.status],
        questionCount: questions.length,
        totalScore: getExamTotalScore(questions),
        linkedCourses: countCoursesUsingExam(store.trainingCourses, e.id),
        courseName: getExamLinkedCourseLabel(store.trainingCourses, e),
        enterpriseName: isGlobalTrainingOwner(e.enterpriseId)
          ? '-'
          : store.enterprises.find((x) => x.id === e.enterpriseId)?.shortName ||
            store.enterprises.find((x) => x.id === e.enterpriseId)?.name ||
            '-',
      }
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
)

function openCreateExam() {
  editingExamId.value = null
  examForm.value = {
    ownerType: 'enterprise',
    enterpriseId: defaultEnterpriseId.value,
    name: '',
    description: '',
    courseId: '',
    durationMinutes: 30,
    passScore: 80,
    maxRetakes: 2,
    retakeIntervalHours: 24,
  }
  examDialogVisible.value = true
}

function openEditExam(row: TrainingExam) {
  if (row.status === 'published') {
    ElMessage.warning('已发布考核不可编辑，请先下架')
    return
  }
  editingExamId.value = row.id
  examForm.value = {
    ownerType: isGlobalTrainingOwner(row.enterpriseId) ? 'global' : 'enterprise',
    enterpriseId: row.enterpriseId ?? defaultEnterpriseId.value,
    name: row.name,
    description: row.description ?? '',
    courseId: row.courseId ?? store.trainingCourses.find((c) => c.examId === row.id)?.id ?? '',
    durationMinutes: row.durationMinutes,
    passScore: row.passScore,
    maxRetakes: row.maxRetakes,
    retakeIntervalHours: row.retakeIntervalHours ?? 24,
  }
  examDialogVisible.value = true
}

function submitExam() {
  const isGlobal = examForm.value.ownerType === 'global'
  if (!isGlobal && !examForm.value.enterpriseId) {
    ElMessage.warning('请选择所属企业')
    return
  }
  if (!examForm.value.name.trim()) {
    ElMessage.warning('请填写考核名称')
    return
  }
  if (!examForm.value.courseId) {
    ElMessage.warning('请选择关联课程')
    return
  }
  const payload = {
    enterpriseId: isGlobal ? null : examForm.value.enterpriseId,
    name: examForm.value.name.trim(),
    description: examForm.value.description.trim(),
    courseId: examForm.value.courseId,
    durationMinutes: examForm.value.durationMinutes,
    passScore: examForm.value.passScore,
    maxRetakes: examForm.value.maxRetakes,
    retakeIntervalHours: examForm.value.retakeIntervalHours,
    status: 'draft' as const,
  }
  try {
    if (editingExamId.value) {
      store.updateTrainingExam(editingExamId.value, payload)
      ElMessage.success('更新成功')
    } else {
      store.addTrainingExam(payload)
      ElMessage.success('创建成功')
    }
    examDialogVisible.value = false
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '操作失败')
  }
}

async function publishExam(row: TrainingExam & { questionCount: number }) {
  if (row.questionCount === 0) {
    ElMessage.warning('请至少添加一道题目')
    return
  }
  const actionLabel = row.status === 'offline' ? '重新发布' : '发布'
  await ElMessageBox.confirm(`${actionLabel}考核「${row.name}」？`, `${actionLabel}确认`)
  try {
    store.publishTrainingExam(row.id)
    ElMessage.success(row.status === 'offline' ? '已重新发布' : '已发布')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '发布失败')
  }
}

async function offlineExam(row: TrainingExam) {
  await ElMessageBox.confirm(
    `下架考核「${row.name}」？下架后新学员将无法参加，已考学员保留历史记录。`,
    '下架确认',
    { type: 'warning' },
  )
  try {
    store.offlineTrainingExam(row.id)
    ElMessage.success('已下架')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '下架失败')
  }
}

function manageQuestions(examId: string) {
  router.push(examQuestionsPath(examId))
}

function viewResults(examId: string) {
  router.push(examResultPath(examId))
}
</script>

<template>
  <div class="page-card">
    <div class="page-header">
      <div>
        <h2 class="page-title">考核管理</h2>
        <p class="text-muted">按类型区分企业考核与通用考核；学员须完成关联课程学习后方可参加</p>
      </div>
      <el-button type="primary" @click="openCreateExam">创建考核</el-button>
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
    </div>

    <el-table :data="examList" border stripe>
      <el-table-column v-if="isPlatform" label="类型" width="80">
        <template #default="{ row }">
          <el-tag size="small" :type="row.enterpriseId == null ? 'warning' : 'primary'">
            {{ row.ownerTypeLabel }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column
        v-if="isPlatform"
        prop="enterpriseName"
        label="所属企业"
        width="120"
        show-overflow-tooltip
      />
      <el-table-column prop="name" label="考核名称" min-width="160" />
      <el-table-column label="题目数" width="80" align="center">
        <template #default="{ row }">{{ row.questionCount }}</template>
      </el-table-column>
      <el-table-column label="总分" width="70" align="center">
        <template #default="{ row }">{{ row.totalScore }}</template>
      </el-table-column>
      <el-table-column label="通过分" width="80" align="center">
        <template #default="{ row }">{{ row.passScore }}</template>
      </el-table-column>
      <el-table-column label="时长" width="80" align="center">
        <template #default="{ row }">{{ row.durationMinutes }}分</template>
      </el-table-column>
      <el-table-column prop="courseName" label="关联课程" min-width="180" show-overflow-tooltip />
      <el-table-column label="前置条件" width="120" align="center">
        <template #default>学完课程</template>
      </el-table-column>
      <el-table-column label="状态" width="90">
        <template #default="{ row }">
          <el-tag size="small" :type="row.statusTagType">{{ row.statusLabel }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="300" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="manageQuestions(row.id)">题目管理</el-button>
          <el-button v-if="row.status !== 'published'" link type="primary" @click="openEditExam(row)">编辑</el-button>
          <el-button
            v-if="row.status === 'draft' || row.status === 'offline'"
            link
            type="success"
            @click="publishExam(row)"
          >
            {{ row.status === 'offline' ? '重新发布' : '发布' }}
          </el-button>
          <el-button v-if="row.status === 'published'" link type="warning" @click="offlineExam(row)">下架</el-button>
          <el-button link @click="viewResults(row.id)">查看成绩</el-button>
        </template>
      </el-table-column>
    </el-table>
  </div>

  <el-dialog v-model="examDialogVisible" :title="editingExamId ? '编辑考核' : '创建考核'" width="560px">
    <el-form label-width="100px">
      <el-form-item v-if="isPlatform" label="类型" required>
        <el-radio-group v-model="examForm.ownerType">
          <el-radio
            v-for="o in trainingOwnerTypeOptions"
            :key="o.value"
            :value="o.value"
          >
            {{ o.label }}
          </el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item v-if="examForm.ownerType === 'enterprise'" label="所属企业" required>
        <el-select
          v-model="examForm.enterpriseId"
          style="width: 100%"
          :disabled="isEnterprise"
          placeholder="选择企业"
        >
          <el-option v-for="e in store.enterprises" :key="e.id" :label="e.name" :value="e.id" />
        </el-select>
      </el-form-item>
      <el-form-item label="考核名称" required>
        <el-input v-model="examForm.name" placeholder="如：安全生产规范考核" />
      </el-form-item>
      <el-form-item label="关联课程" required>
        <el-select v-model="examForm.courseId" style="width: 100%" placeholder="选择须先完成的课程">
          <el-option
            v-for="c in courseOptions"
            :key="c.id"
            :label="c.label"
            :value="c.id"
            :disabled="c.disabled"
          />
        </el-select>
        <div class="text-muted" style="margin-top: 4px; font-size: 12px">
          学员完成该课程全部资料学习后，考核才会在小程序中解锁
        </div>
      </el-form-item>
      <el-form-item label="考核说明">
        <el-input v-model="examForm.description" type="textarea" :rows="2" />
      </el-form-item>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="考试时长">
            <el-input-number v-model="examForm.durationMinutes" :min="5" :max="180" style="width: 100%" /> 分钟
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="通过分数">
            <el-input-number v-model="examForm.passScore" :min="0" :max="100" style="width: 100%" />
          </el-form-item>
        </el-col>
      </el-row>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="重考次数">
            <el-input-number v-model="examForm.maxRetakes" :min="-1" style="width: 100%" />
            <div class="text-muted" style="font-size: 11px">0不可重考，-1无限</div>
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="重考间隔">
            <el-input-number v-model="examForm.retakeIntervalHours" :min="0" style="width: 100%" /> 小时
          </el-form-item>
        </el-col>
      </el-row>
    </el-form>
    <template #footer>
      <el-button @click="examDialogVisible = false">取消</el-button>
      <el-button type="primary" @click="submitExam">保存</el-button>
    </template>
  </el-dialog>
</template>
