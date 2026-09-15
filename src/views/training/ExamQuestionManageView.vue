<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ArrowLeft, Plus } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import type { CheckboxValueType, UploadFile, UploadProps } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { useTrainingScope } from '@/composables/useTrainingScope'
import {
  examQuestionTypeMap,
  examStatusMap,
  examStatusTagType,
  getExamQuestionImageUrls,
} from '@/constants/training'
import { getExamQuestions, getExamTotalScore } from '@/services/training'
import type { ExamQuestion, ExamQuestionOption, ExamQuestionType } from '@/types'

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

function emptyOptions(): ExamQuestionOption[] {
  return [
    { key: 'A', text: '', imageUrl: '' },
    { key: 'B', text: '', imageUrl: '' },
    { key: 'C', text: '', imageUrl: '' },
    { key: 'D', text: '', imageUrl: '' },
  ]
}

const questionForm = ref({
  type: 'single' as ExamQuestionType,
  content: '',
  imageUrls: [] as string[],
  options: emptyOptions(),
  correctAnswers: [] as string[],
  score: 10,
  partialScore: false,
  explanation: '',
})

const questionImageFileList = ref<UploadFile[]>([])

function syncQuestionImageFileList(urls: string[]) {
  questionImageFileList.value = urls.map((url, index) => ({
    name: `题目图片${index + 1}`,
    url,
    uid: Date.now() + index,
    status: 'success' as const,
  }))
}

const questions = computed(() => {
  if (!examId.value) return []
  return getExamQuestions(examId.value, store.examQuestions).map((q) => ({
    ...q,
    typeLabel: examQuestionTypeMap[q.type],
    previewImages: getExamQuestionImageUrls(q),
  }))
})

const totalScore = computed(() => getExamTotalScore(questions.value))

function goBack() {
  router.push(examListPath.value)
}

function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('请上传图片文件'))
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      reject(new Error('单张图片不能超过 5MB'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('图片读取失败'))
    reader.readAsDataURL(file)
  })
}

const onQuestionImageChange: UploadProps['onChange'] = async (uploadFile) => {
  if (!uploadFile.raw || uploadFile.url) return
  try {
    uploadFile.url = await readImageAsDataUrl(uploadFile.raw)
    uploadFile.status = 'success'
    questionForm.value.imageUrls = questionImageFileList.value
      .map((f) => f.url)
      .filter((u): u is string => !!u)
  } catch (e) {
    ElMessage.warning(e instanceof Error ? e.message : '图片上传失败')
    questionImageFileList.value = questionImageFileList.value.filter((f) => f.uid !== uploadFile.uid)
  }
}

const onQuestionImageRemove: UploadProps['onRemove'] = () => {
  questionForm.value.imageUrls = questionImageFileList.value
    .map((f) => f.url)
    .filter((u): u is string => !!u)
}

async function onOptionImageChange(opt: ExamQuestionOption, uploadFile: UploadFile) {
  if (!uploadFile.raw) return
  try {
    opt.imageUrl = await readImageAsDataUrl(uploadFile.raw)
  } catch (e) {
    ElMessage.warning(e instanceof Error ? e.message : '图片上传失败')
  }
}

function clearOptionImage(opt: ExamQuestionOption) {
  opt.imageUrl = ''
}

function openCreateQuestion() {
  if (isPublished.value) return
  editingQuestionId.value = null
  questionForm.value = {
    type: 'single',
    content: '',
    imageUrls: [],
    options: emptyOptions(),
    correctAnswers: [],
    score: 10,
    partialScore: false,
    explanation: '',
  }
  syncQuestionImageFileList([])
  questionDialogVisible.value = true
}

function openEditQuestion(q: ExamQuestion) {
  editingQuestionId.value = q.id
  const opts = emptyOptions().map((blank) => {
    const found = q.options.find((o) => o.key === blank.key)
    return found
      ? { key: found.key, text: found.text, imageUrl: found.imageUrl ?? '' }
      : blank
  })
  // 保留超出 A-D 的选项
  for (const o of q.options) {
    if (!opts.some((x) => x.key === o.key)) {
      opts.push({ key: o.key, text: o.text, imageUrl: o.imageUrl ?? '' })
    }
  }
  questionForm.value = {
    type: q.type === 'judge' ? 'single' : q.type,
    content: q.content,
    imageUrls: [...getExamQuestionImageUrls(q)],
    options: opts,
    correctAnswers: [...q.correctAnswers],
    score: q.score,
    partialScore: q.partialScore ?? false,
    explanation: q.explanation ?? '',
  }
  syncQuestionImageFileList(questionForm.value.imageUrls)
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
  const options = questionForm.value.options
    .map((o) => ({
      key: o.key,
      text: o.text.trim(),
      imageUrl: o.imageUrl?.trim() || undefined,
    }))
    .filter((o) => o.text || o.imageUrl)
  if (options.length < 2) {
    ElMessage.warning('请至少填写两个选项（文字或图片）')
    return
  }
  const imageUrls = [...questionForm.value.imageUrls]
  const payload = {
    examId: examId.value,
    type: questionForm.value.type,
    content: questionForm.value.content.trim(),
    imageUrls,
    imageUrl: imageUrls[0],
    options,
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

const previewImages = computed(() =>
  previewQuestion.value ? getExamQuestionImageUrls(previewQuestion.value) : [],
)

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
            <img
              v-if="row.previewImages[0]"
              :src="row.previewImages[0]"
              class="q-thumb"
              alt=""
            >
            <span>
              {{ row.content.slice(0, 60) }}{{ row.content.length > 60 ? '…' : '' }}
              <el-tag v-if="row.previewImages.length > 1" size="small" type="info" style="margin-left: 6px">
                {{ row.previewImages.length }} 图
              </el-tag>
            </span>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="typeLabel" label="题型" width="90" />
      <el-table-column label="分值" width="70" align="center">
        <template #default="{ row }">{{ row.score }}</template>
      </el-table-column>
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

  <el-dialog v-model="questionDialogVisible" :title="editingQuestionId ? '编辑题目' : '创建题目'" width="720px">
    <el-form label-width="90px">
      <el-form-item label="题型">
        <el-radio-group v-model="questionForm.type">
          <el-radio value="single">单选题</el-radio>
          <el-radio value="multiple">多选题</el-radio>
        </el-radio-group>
      </el-form-item>
      <el-form-item label="题目" required>
        <el-input
          v-model="questionForm.content"
          type="textarea"
          :rows="3"
          placeholder="请输入题目内容"
        />
        <div class="image-upload-block">
          <div class="field-hint">可上传多张配图（单张 ≤5MB）</div>
          <el-upload
            v-model:file-list="questionImageFileList"
            list-type="picture-card"
            :auto-upload="false"
            accept="image/*"
            multiple
            :on-change="onQuestionImageChange"
            :on-remove="onQuestionImageRemove"
          >
            <el-icon><Plus /></el-icon>
          </el-upload>
        </div>
      </el-form-item>
      <el-form-item label="选项">
        <div v-for="opt in questionForm.options" :key="opt.key" class="opt-block">
          <div class="opt-row">
            <span class="opt-key">{{ opt.key }}</span>
            <el-input v-model="opt.text" placeholder="选项内容" />
            <el-checkbox
              :model-value="questionForm.correctAnswers.includes(opt.key)"
              @change="onOptionCorrectChange(opt.key, $event)"
            >
              正确
            </el-checkbox>
          </div>
          <div class="opt-image-row">
            <el-upload
              v-if="!opt.imageUrl"
              :auto-upload="false"
              :show-file-list="false"
              accept="image/*"
              :on-change="(file: UploadFile) => onOptionImageChange(opt, file)"
            >
              <el-button size="small">上传图片</el-button>
            </el-upload>
            <div v-else class="opt-image-preview">
              <img :src="opt.imageUrl" alt="">
              <el-button link type="danger" size="small" @click="clearOptionImage(opt)">移除</el-button>
            </div>
          </div>
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
      <div v-if="previewImages.length" class="preview-images">
        <img
          v-for="(url, idx) in previewImages"
          :key="idx"
          :src="url"
          class="preview-image"
          alt=""
        >
      </div>
      <p><strong>{{ previewQuestion.content }}</strong></p>
      <ul class="preview-options">
        <li v-for="opt in previewQuestion.options" :key="opt.key">
          <div class="preview-opt-main">
            {{ opt.key }}. {{ opt.text }}
            <el-tag
              v-if="previewQuestion.correctAnswers.includes(opt.key)"
              size="small"
              type="success"
            >
              正确
            </el-tag>
          </div>
          <img v-if="opt.imageUrl" :src="opt.imageUrl" class="preview-opt-image" alt="">
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
.field-hint {
  margin: 8px 0 6px;
  font-size: 12px;
  color: #909399;
}
.image-upload-block {
  width: 100%;
}
.opt-block {
  width: 100%;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px dashed #ebeef5;
}
.opt-block:last-child {
  border-bottom: none;
  margin-bottom: 0;
}
.opt-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.opt-key {
  width: 24px;
  font-weight: 600;
  flex-shrink: 0;
}
.opt-image-row {
  margin: 8px 0 0 32px;
}
.opt-image-preview {
  display: flex;
  align-items: center;
  gap: 8px;
}
.opt-image-preview img {
  width: 72px;
  height: 54px;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid #ebeef5;
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
.preview-images {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 12px;
}
.preview-image {
  width: 100%;
  border-radius: 8px;
}
.preview-options {
  padding-left: 18px;
}
.preview-opt-main {
  display: flex;
  align-items: center;
  gap: 8px;
}
.preview-opt-image {
  display: block;
  margin-top: 6px;
  max-width: 160px;
  border-radius: 6px;
}
</style>
