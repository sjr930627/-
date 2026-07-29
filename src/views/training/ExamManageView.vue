<script setup lang="ts">
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { CheckboxValueType } from 'element-plus'
import { useAppStore } from '@/stores/app'
import {
  aiDifficultyOptions,
  aiScenarioOptions,
  examQuestionTypeMap,
  examStatusMap,
} from '@/constants/training'
import {
  countCoursesUsingExam,
  getExamLinkedCourseLabel,
  getExamQuestions,
  getExamTotalScore,
} from '@/services/training'
import type {
  AiQuestionDifficulty,
  AiRiskScenario,
  ExamQuestion,
  ExamQuestionType,
  TrainingExam,
} from '@/types'

const store = useAppStore()
const router = useRouter()
const activeExamId = ref<string | null>(null)
const examDialogVisible = ref(false)
const questionDialogVisible = ref(false)
const aiDialogVisible = ref(false)
const previewVisible = ref(false)
const editingExamId = ref<string | null>(null)
const editingQuestionId = ref<string | null>(null)
const previewQuestion = ref<ExamQuestion | null>(null)

const examForm = ref({
  name: '',
  description: '',
  courseId: '' as string,
  durationMinutes: 30,
  passScore: 80,
  maxRetakes: 2,
  retakeIntervalHours: 24,
})

const questionForm = ref({
  type: 'single' as ExamQuestionType,
  content: '',
  options: [
    { key: 'A', text: '' },
    { key: 'B', text: '' },
    { key: 'C', text: '' },
    { key: 'D', text: '' },
  ],
  correctAnswers: [] as string[],
  score: 10,
  partialScore: false,
  explanation: '',
})

const aiForm = ref({
  scenario: 'info_security' as AiRiskScenario,
  type: 'single' as ExamQuestionType,
  count: 3,
  difficulty: 'medium' as AiQuestionDifficulty,
})

const courseOptions = computed(() =>
  store.trainingCourses.map((c) => ({
    id: c.id,
    label: `${c.name}${c.status === 'published' ? '' : '（草稿）'}`,
    disabled: !!c.examId && (!editingExamId.value || c.examId !== editingExamId.value),
  })),
)

const examList = computed(() =>
  store.trainingExams.map((e) => {
    const questions = getExamQuestions(e.id, store.examQuestions)
    return {
      ...e,
      statusLabel: examStatusMap[e.status],
      questionCount: questions.length,
      totalScore: getExamTotalScore(questions),
      linkedCourses: countCoursesUsingExam(store.trainingCourses, e.id),
      courseName: getExamLinkedCourseLabel(store.trainingCourses, e),
    }
  }).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
)

const currentQuestions = computed(() => {
  if (!activeExamId.value) return []
  return getExamQuestions(activeExamId.value, store.examQuestions).map((q) => ({
    ...q,
    typeLabel: examQuestionTypeMap[q.type],
    sourceLabel: q.source === 'ai' ? 'AI生成' : '手动',
  }))
})

const activeExam = computed(() =>
  activeExamId.value ? store.trainingExams.find((e) => e.id === activeExamId.value) : null,
)

function openCreateExam() {
  editingExamId.value = null
  examForm.value = {
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
    ElMessage.warning('已发布考核不可编辑')
    return
  }
  editingExamId.value = row.id
  examForm.value = {
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
  if (!examForm.value.name.trim()) {
    ElMessage.warning('请填写考核名称')
    return
  }
  if (!examForm.value.courseId) {
    ElMessage.warning('请选择关联课程')
    return
  }
  const payload = {
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
      const item = store.addTrainingExam(payload)
      activeExamId.value = item.id
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
  await ElMessageBox.confirm(`发布考核「${row.name}」？`, '发布确认')
  try {
    store.publishTrainingExam(row.id)
    ElMessage.success('已发布')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '发布失败')
  }
}

function manageQuestions(examId: string) {
  activeExamId.value = examId
}

function openAddQuestion() {
  if (!activeExamId.value || activeExam.value?.status === 'published') return
  editingQuestionId.value = null
  questionForm.value = {
    type: 'single',
    content: '',
    options: [
      { key: 'A', text: '' },
      { key: 'B', text: '' },
      { key: 'C', text: '' },
      { key: 'D', text: '' },
    ],
    correctAnswers: [],
    score: 10,
    partialScore: false,
    explanation: '',
  }
  questionDialogVisible.value = true
}

function openEditQuestion(q: ExamQuestion) {
  editingQuestionId.value = q.id
  questionForm.value = {
    type: q.type,
    content: q.content,
    options: [...q.options],
    correctAnswers: [...q.correctAnswers],
    score: q.score,
    partialScore: q.partialScore ?? false,
    explanation: q.explanation ?? '',
  }
  questionDialogVisible.value = true
}

function submitQuestion() {
  if (!activeExamId.value || !questionForm.value.content.trim()) {
    ElMessage.warning('请填写题目内容')
    return
  }
  const payload = {
    examId: activeExamId.value,
    type: questionForm.value.type,
    content: questionForm.value.content.trim(),
    options: questionForm.value.options.filter((o) => o.text.trim()),
    correctAnswers: questionForm.value.correctAnswers,
    score: questionForm.value.score,
    partialScore: questionForm.value.partialScore,
    explanation: questionForm.value.explanation,
    source: 'manual' as const,
  }
  try {
    if (editingQuestionId.value) {
      store.updateExamQuestion(editingQuestionId.value, payload)
      ElMessage.success('题目已更新')
    } else {
      store.addExamQuestion(payload)
      ElMessage.success('题目已添加')
    }
    questionDialogVisible.value = false
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '操作失败')
  }
}

async function removeQuestion(id: string) {
  await ElMessageBox.confirm('确定删除该题目？', '提示', { type: 'warning' })
  try {
    store.removeExamQuestion(id)
    ElMessage.success('已删除')
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '删除失败')
  }
}

function openAiDialog() {
  if (!activeExamId.value) return
  aiDialogVisible.value = true
}

function generateAi() {
  if (!activeExamId.value) return
  try {
    const items = store.generateAiExamQuestions({
      examId: activeExamId.value,
      ...aiForm.value,
    })
    ElMessage.success(`已生成 ${items.length} 道 AI 风险识别题，请审核确认`)
    aiDialogVisible.value = false
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '生成失败')
  }
}

function previewQuestionFn(q: ExamQuestion) {
  previewQuestion.value = q
  previewVisible.value = true
}

function toggleCorrectAnswer(optKey: string, checked: boolean) {
  if (questionForm.value.type === 'single' || questionForm.value.type === 'judge') {
    questionForm.value.correctAnswers = checked ? [optKey] : []
  } else if (checked) {
    if (!questionForm.value.correctAnswers.includes(optKey)) {
      questionForm.value.correctAnswers.push(optKey)
    }
  } else {
    questionForm.value.correctAnswers = questionForm.value.correctAnswers.filter((k) => k !== optKey)
  }
}

function onOptionCorrectChange(optKey: string, checked: CheckboxValueType) {
  toggleCorrectAnswer(optKey, checked === true)
}

function viewResults(examId: string) {
  router.push({ path: '/training/exam-results', query: { exam: examId } })
}
</script>

<template>
  <div class="page-card">
    <div class="page-header">
      <div>
        <h2 class="page-title">考核管理</h2>
        <p class="text-muted">创建考试并关联课程；学员须完成课程全部资料学习后，方可参加考核</p>
      </div>
      <el-button type="primary" @click="openCreateExam">创建考核</el-button>
    </div>

    <el-table :data="examList" border stripe>
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
          <el-tag size="small" :type="row.status === 'published' ? 'success' : 'info'">{{ row.statusLabel }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="260" fixed="right">
        <template #default="{ row }">
          <el-button link type="primary" @click="manageQuestions(row.id)">题目管理</el-button>
          <el-button v-if="row.status !== 'published'" link type="primary" @click="openEditExam(row)">编辑</el-button>
          <el-button v-if="row.status === 'draft'" link type="success" @click="publishExam(row)">发布</el-button>
          <el-button link @click="viewResults(row.id)">查看成绩</el-button>
        </template>
      </el-table-column>
    </el-table>

    <div v-if="activeExamId" class="question-panel">
      <div class="panel-header">
        <h3>题目管理 · {{ activeExam?.name }}</h3>
        <div>
          <el-button v-if="activeExam?.status !== 'published'" @click="openAiDialog">添加 AI 风险识别题</el-button>
          <el-button v-if="activeExam?.status !== 'published'" type="primary" @click="openAddQuestion">手动出题</el-button>
        </div>
      </div>
      <el-table :data="currentQuestions" border stripe size="small">
        <el-table-column label="题目" min-width="200">
          <template #default="{ row }">
            <div class="q-preview">
              <img v-if="row.imageUrl" :src="row.imageUrl" class="q-thumb" alt="">
              <span>{{ row.content.slice(0, 40) }}{{ row.content.length > 40 ? '…' : '' }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column prop="typeLabel" label="题型" width="80" />
        <el-table-column label="分值" width="60" align="center">
          <template #default="{ row }">{{ row.score }}</template>
        </el-table-column>
        <el-table-column prop="sourceLabel" label="来源" width="80" />
        <el-table-column label="创建时间" width="150">
          <template #default="{ row }">{{ row.createdAt.slice(0, 10) }}</template>
        </el-table-column>
        <el-table-column label="操作" width="160">
          <template #default="{ row }">
            <el-button link @click="previewQuestionFn(row)">预览</el-button>
            <el-button v-if="activeExam?.status !== 'published'" link type="primary" @click="openEditQuestion(row)">编辑</el-button>
            <el-button v-if="activeExam?.status !== 'published'" link type="danger" @click="removeQuestion(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>

  <el-dialog v-model="examDialogVisible" :title="editingExamId ? '编辑考核' : '创建考核'" width="560px">
    <el-form label-width="100px">
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

  <el-dialog v-model="questionDialogVisible" :title="editingQuestionId ? '编辑题目' : '手动出题'" width="640px">
    <el-form label-width="90px">
      <el-form-item label="题型">
        <el-radio-group v-model="questionForm.type">
          <el-radio value="single">单选题</el-radio>
          <el-radio value="multiple">多选题</el-radio>
          <el-radio value="judge">判断题</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="题目" required>
        <el-input v-model="questionForm.content" type="textarea" :rows="2" />
      </el-form-item>
      <el-form-item v-if="questionForm.type !== 'judge'" label="选项">
        <div v-for="opt in questionForm.options" :key="opt.key" class="opt-row">
          <span class="opt-key">{{ opt.key }}</span>
          <el-input v-model="opt.text" placeholder="选项内容" />
          <el-checkbox
            :model-value="questionForm.correctAnswers.includes(opt.key)"
            @change="onOptionCorrectChange(opt.key, $event)"
          >正确</el-checkbox>
        </div>
      </el-form-item>
      <el-form-item v-else label="正确答案">
        <el-radio-group v-model="questionForm.correctAnswers[0]">
          <el-radio value="A">正确</el-radio>
          <el-radio value="B">错误</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="分值">
        <el-input-number v-model="questionForm.score" :min="1" :max="100" />
      </el-form-item>
      <el-form-item v-if="questionForm.type === 'multiple'" label="部分得分">
        <el-switch v-model="questionForm.partialScore" />
      </el-form-item>
      <el-form-item label="解析">
        <el-input v-model="questionForm.explanation" type="textarea" :rows="2" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="questionDialogVisible = false">取消</el-button>
      <el-button type="primary" @click="submitQuestion">保存</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="aiDialogVisible" title="AI 生成安全风险识别题" width="560px">
    <el-form label-width="100px">
      <el-form-item label="场景主题">
        <el-select v-model="aiForm.scenario" style="width: 100%">
          <el-option v-for="o in aiScenarioOptions" :key="o.value" :label="o.label" :value="o.value">
            <span>{{ o.label }}</span>
            <span class="text-muted" style="margin-left: 8px; font-size: 12px">{{ o.desc }}</span>
          </el-option>
        </el-select>
      </el-form-item>
      <el-form-item label="题目类型">
        <el-radio-group v-model="aiForm.type">
          <el-radio value="single">单选</el-radio>
          <el-radio value="multiple">多选</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-row :gutter="16">
        <el-col :span="12">
          <el-form-item label="生成数量">
            <el-input-number v-model="aiForm.count" :min="1" :max="10" style="width: 100%" />
          </el-form-item>
        </el-col>
        <el-col :span="12">
          <el-form-item label="难度">
            <el-select v-model="aiForm.difficulty" style="width: 100%">
              <el-option v-for="o in aiDifficultyOptions" :key="o.value" :label="o.label" :value="o.value" />
            </el-select>
          </el-form-item>
        </el-col>
      </el-row>
    </el-form>
    <template #footer>
      <el-button @click="aiDialogVisible = false">取消</el-button>
      <el-button type="primary" @click="generateAi">生成</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="previewVisible" title="题目预览" width="560px">
    <template v-if="previewQuestion">
      <img v-if="previewQuestion.imageUrl" :src="previewQuestion.imageUrl" style="width: 100%; border-radius: 8px; margin-bottom: 12px" alt="">
      <p><strong>{{ previewQuestion.content }}</strong></p>
      <ul>
        <li v-for="opt in previewQuestion.options" :key="opt.key">
          {{ opt.key }}. {{ opt.text }}
          <el-tag v-if="previewQuestion.correctAnswers.includes(opt.key)" size="small" type="success">正确</el-tag>
        </li>
      </ul>
      <p v-if="previewQuestion.explanation" class="text-muted">解析：{{ previewQuestion.explanation }}</p>
    </template>
  </el-dialog>
</template>

<style scoped>
.question-panel {
  margin-top: 24px;
  padding-top: 16px;
  border-top: 1px solid #ebeef5;
}
.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
}
.panel-header h3 { margin: 0; font-size: 16px; }
.q-preview { display: flex; align-items: center; gap: 8px; }
.q-thumb { width: 48px; height: 32px; object-fit: cover; border-radius: 4px; }
.opt-row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; }
.opt-key { width: 24px; font-weight: 600; }
</style>
