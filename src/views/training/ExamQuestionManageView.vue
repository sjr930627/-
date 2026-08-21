<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { CheckboxValueType } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { useTrainingScope } from '@/composables/useTrainingScope'
import { examQuestionTypeMap, examStatusMap, examStatusTagType } from '@/constants/training'
import { getExamQuestions, getExamTotalScore } from '@/services/training'
import type { ExamQuestion, ExamQuestionType } from '@/types'

const store = useAppStore()
const route = useRoute()
const router = useRouter()
const { isEnterprise } = useTrainingScope()

const examId = computed(() => route.params.examId as string)

const exam = computed(() => store.trainingExams.find((e) => e.id === examId.value))

const isPublished = computed(() => exam.value?.status === 'published')

const examListPath = computed(() =>
  isEnterprise.value ? '/enterprise/training/exams' : '/training/exams',
)

const questionDialogVisible = ref(false)
const importDialogVisible = ref(false)
const previewVisible = ref(false)
const editingQuestionId = ref<string | null>(null)
const previewQuestion = ref<ExamQuestion | null>(null)

const importText = ref('')
const importFileName = ref('')

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

const questions = computed(() => {
  if (!examId.value) return []
  return getExamQuestions(examId.value, store.examQuestions).map((q) => ({
    ...q,
    typeLabel: examQuestionTypeMap[q.type],
    sourceLabel: q.source === 'ai' ? 'AI生成' : '手动',
  }))
})

const totalScore = computed(() => getExamTotalScore(questions.value))

function goBack() {
  router.push(examListPath.value)
}

function openCreateQuestion() {
  if (isPublished.value) return
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
    type: q.type === 'judge' ? 'single' : q.type,
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
  if (!examId.value || !questionForm.value.content.trim()) {
    ElMessage.warning('请填写题目内容')
    return
  }
  if (questionForm.value.correctAnswers.length === 0) {
    ElMessage.warning('请设置正确答案')
    return
  }
  const payload = {
    examId: examId.value,
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

function previewQuestionFn(q: ExamQuestion) {
  previewQuestion.value = q
  previewVisible.value = true
}

function toggleCorrectAnswer(optKey: string, checked: boolean) {
  if (questionForm.value.type === 'single') {
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

function openImportDialog() {
  importText.value = ''
  importFileName.value = ''
  importDialogVisible.value = true
}

function onImportFileChange(uploadFile: { name?: string }) {
  importFileName.value = uploadFile.name ?? ''
}

function mockParseDocument(text: string, fileName: string) {
  const hint = (text.trim() || fileName || '培训文档').slice(0, 30)
  const includeMultiple = text.includes('多选') || fileName.includes('多选') || hint.length > 10
  type ImportQuestion = Omit<ExamQuestion, 'id' | 'createdAt' | 'examId' | 'source'>
  const base: ImportQuestion[] = [
    {
      type: 'single' as const,
      content: `【导入】${hint}：以下哪项描述最符合规范要求？`,
      options: [
        { key: 'A', text: '严格执行标准操作流程' },
        { key: 'B', text: '可凭经验简化步骤' },
        { key: 'C', text: '发现问题后自行处理即可' },
        { key: 'D', text: '无需记录异常情况' },
      ],
      correctAnswers: ['A'],
      score: 10,
      explanation: '导入示例：规范操作是首要原则。',
    },
    {
      type: 'single' as const,
      content: `【导入】${hint}：遇到不确定情况时应如何处理？`,
      options: [
        { key: 'A', text: '立即上报主管并暂停操作' },
        { key: 'B', text: '继续完成当前任务' },
        { key: 'C', text: '自行修改流程' },
        { key: 'D', text: '忽略并继续' },
      ],
      correctAnswers: ['A'],
      score: 10,
      explanation: '导入示例：不确定时应及时上报。',
    },
  ]
  if (includeMultiple) {
    base.push({
      type: 'multiple',
      content: `【导入】${hint}：以下哪些属于合规做法？（多选）`,
      options: [
        { key: 'A', text: '佩戴必要防护装备' },
        { key: 'B', text: '按流程完成检查记录' },
        { key: 'C', text: '跳过未明确的步骤' },
        { key: 'D', text: '发现隐患及时上报' },
      ],
      correctAnswers: ['A', 'B', 'D'],
      score: 15,
      partialScore: true,
      explanation: '导入示例：合规做法包括防护、记录与上报。',
    })
  }
  return base
}

function submitImport() {
  if (!examId.value) return
  if (!importText.value.trim() && !importFileName.value) {
    ElMessage.warning('请粘贴文档内容或选择文件')
    return
  }
  try {
    const parsed = mockParseDocument(importText.value, importFileName.value)
    const items = store.importExamQuestionsFromDocument(examId.value, parsed)
    ElMessage.success(`已从文档导入 ${items.length} 道题目`)
    importDialogVisible.value = false
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '导入失败')
  }
}

onMounted(() => {
  if (!exam.value) {
    ElMessage.warning('考核不存在')
    router.replace(examListPath.value)
  }
})
</script>

<template>
  <div v-if="exam" class="page-card">
    <div class="page-header">
      <div class="header-left">
        <el-button :icon="ArrowLeft" @click="goBack">返回考核列表</el-button>
        <div>
          <h2 class="page-title">题目管理 · {{ exam.name }}</h2>
          <p class="text-muted">
            共 {{ questions.length }} 题，总分 {{ totalScore }} 分
            <el-tag
              size="small"
              :type="examStatusTagType[exam.status]"
              style="margin-left: 8px"
            >
              {{ examStatusMap[exam.status] }}
            </el-tag>
          </p>
        </div>
      </div>
      <div v-if="!isPublished" class="header-actions">
        <el-button @click="openImportDialog">导入题目文档</el-button>
        <el-button type="primary" @click="openCreateQuestion">创建题目</el-button>
      </div>
    </div>

    <el-table :data="questions" border stripe>
      <el-table-column label="题目" min-width="240">
        <template #default="{ row }">
          <div class="q-preview">
            <img v-if="row.imageUrl" :src="row.imageUrl" class="q-thumb" alt="">
            <span>{{ row.content.slice(0, 60) }}{{ row.content.length > 60 ? '…' : '' }}</span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="typeLabel" label="题型" width="90" />
      <el-table-column label="分值" width="70" align="center">
        <template #default="{ row }">{{ row.score }}</template>
      </el-table-column>
      <el-table-column prop="sourceLabel" label="来源" width="80" />
      <el-table-column label="创建时间" width="120">
        <template #default="{ row }">{{ row.createdAt.slice(0, 10) }}</template>
      </el-table-column>
      <el-table-column label="操作" width="180" fixed="right">
        <template #default="{ row }">
          <el-button link @click="previewQuestionFn(row)">预览</el-button>
          <template v-if="!isPublished">
            <el-button link type="primary" @click="openEditQuestion(row)">编辑</el-button>
            <el-button link type="danger" @click="removeQuestion(row.id)">删除</el-button>
          </template>
        </template>
      </el-table-column>
    </el-table>
  </div>

  <el-dialog v-model="questionDialogVisible" :title="editingQuestionId ? '编辑题目' : '创建题目'" width="640px">
    <el-form label-width="90px">
      <el-form-item label="题型">
        <el-radio-group v-model="questionForm.type">
          <el-radio value="single">单选题</el-radio>
          <el-radio value="multiple">多选题</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="题目" required>
        <el-input v-model="questionForm.content" type="textarea" :rows="2" />
      </el-form-item>
      <el-form-item label="选项">
        <div v-for="opt in questionForm.options" :key="opt.key" class="opt-row">
          <span class="opt-key">{{ opt.key }}</span>
          <el-input v-model="opt.text" placeholder="选项内容" />
          <el-checkbox
            :model-value="questionForm.correctAnswers.includes(opt.key)"
            @change="onOptionCorrectChange(opt.key, $event)"
          >正确</el-checkbox>
        </div>
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

  <el-dialog v-model="importDialogVisible" title="导入题目文档" width="560px">
    <p class="text-muted import-hint">粘贴文档内容或选择文件（Mock：将自动生成 2–3 道示例单选/多选题）</p>
    <el-form label-width="90px">
      <el-form-item label="文档内容">
        <el-input
          v-model="importText"
          type="textarea"
          :rows="6"
          placeholder="粘贴 Word/TXT 题目文本，或留空仅上传文件"
        />
      </el-form-item>
      <el-form-item label="选择文件">
        <el-upload
          :auto-upload="false"
          :limit="1"
          accept=".doc,.docx,.txt,.pdf"
          :on-change="onImportFileChange"
        >
          <el-button>选择文档</el-button>
          <template #tip>
            <div class="text-muted">支持 .doc / .docx / .txt / .pdf，当前为 Mock 解析</div>
          </template>
        </el-upload>
        <span v-if="importFileName" class="file-name">{{ importFileName }}</span>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="importDialogVisible = false">取消</el-button>
      <el-button type="primary" @click="submitImport">导入</el-button>
    </template>
  </el-dialog>

  <el-dialog v-model="previewVisible" title="题目预览" width="560px">
    <template v-if="previewQuestion">
      <img
        v-if="previewQuestion.imageUrl"
        :src="previewQuestion.imageUrl"
        style="width: 100%; border-radius: 8px; margin-bottom: 12px"
        alt=""
      >
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
.header-left {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}
.header-actions {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
}
.q-preview {
  display: flex;
  align-items: center;
  gap: 8px;
}
.q-thumb {
  width: 48px;
  height: 32px;
  object-fit: cover;
  border-radius: 4px;
}
.opt-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}
.opt-key {
  width: 24px;
  font-weight: 600;
}
.import-hint {
  margin: 0 0 16px;
  font-size: 13px;
}
.file-name {
  margin-left: 8px;
  font-size: 13px;
  color: #606266;
}
</style>
