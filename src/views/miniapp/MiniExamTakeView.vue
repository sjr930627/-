<script setup lang="ts">
import MiniNavBack from '@/components/miniapp/MiniNavBack.vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import { examQuestionTypeMap } from '@/constants/training'
import { getExamQuestions, getLearningProgress } from '@/services/training'

const route = useRoute()
const router = useRouter()
const store = useAppStore()
const { employeeId } = useMiniAppWorker()

const courseId = computed(() => route.params.courseId as string)
const course = computed(() => store.trainingCourses.find((c) => c.id === courseId.value))
const exam = computed(() => {
  const eid = course.value?.examId
  return eid ? store.trainingExams.find((e) => e.id === eid) : null
})
const questions = computed(() =>
  exam.value ? getExamQuestions(exam.value.id, store.examQuestions) : [],
)

const currentIndex = ref(0)
const answers = ref<Record<string, string[]>>({})
const startedAt = ref(Date.now())
let timer: ReturnType<typeof setInterval> | null = null
const elapsedMinutes = ref(0)

const currentQuestion = computed(() => questions.value[currentIndex.value])
const progressPercent = computed(() =>
  questions.value.length > 0
    ? Math.round(((currentIndex.value + 1) / questions.value.length) * 100)
    : 0,
)

const currentAnswers = computed({
  get: () => answers.value[currentQuestion.value?.id ?? ''] ?? [],
  set: (val: string[]) => {
    if (!currentQuestion.value) return
    answers.value[currentQuestion.value.id] = val
  },
})

const allAnswered = computed(() =>
  questions.value.every((q) => (answers.value[q.id]?.length ?? 0) > 0),
)

onMounted(() => {
  const rec = store.courseLearningRecords.find(
    (r) => r.courseId === courseId.value && r.employeeId === employeeId.value,
  )
  if (!course.value || !exam.value) {
    ElMessage.warning('考核不存在')
    router.replace('/miniapp/training/exams')
    return
  }
  const progress = rec ? getLearningProgress(rec, course.value) : 0
  if (progress < 100) {
    ElMessage.warning('请先完成课程学习')
    router.replace('/miniapp/training/exams')
    return
  }
  timer = setInterval(() => {
    elapsedMinutes.value = Math.max(1, Math.round((Date.now() - startedAt.value) / 60000))
  }, 10000)
})

onUnmounted(() => {
  if (timer) clearInterval(timer)
})

function toggleOption(key: string) {
  const q = currentQuestion.value
  if (!q) return
  if (q.type === 'multiple') {
    const set = new Set(currentAnswers.value)
    if (set.has(key)) set.delete(key)
    else set.add(key)
    currentAnswers.value = [...set].sort()
  } else {
    currentAnswers.value = [key]
  }
}

function isSelected(key: string) {
  return currentAnswers.value.includes(key)
}

function prevQuestion() {
  if (currentIndex.value > 0) currentIndex.value -= 1
}

function nextQuestion() {
  if (!currentAnswers.value.length) {
    ElMessage.warning('请选择答案')
    return
  }
  if (currentIndex.value < questions.value.length - 1) {
    currentIndex.value += 1
  }
}

async function submitExam() {
  if (!allAnswered.value) {
    ElMessage.warning('还有题目未作答')
    return
  }
  if (!exam.value) return
  await ElMessageBox.confirm('确认提交答卷？提交后将自动判分。', '提交确认')
  try {
    const attempt = store.submitExamAttempt({
      examId: exam.value.id,
      courseId: courseId.value,
      employeeId: employeeId.value,
      answers: answers.value,
      durationMinutes: Math.max(1, Math.round((Date.now() - startedAt.value) / 60000)),
    })
    router.replace(`/miniapp/training/exam/${courseId.value}/review/${attempt.id}`)
  } catch (e) {
    ElMessage.warning(e instanceof Error ? e.message : '提交失败')
  }
}
</script>

<template>
  <div class="exam-take-page">
    <div class="mini-nav-bar exam-nav">
      <MiniNavBack fallback="/miniapp/training/exams" />
      <div class="mini-nav-title">{{ exam?.name ?? '在线考核' }}</div>
      <span class="exam-timer">{{ elapsedMinutes }} 分钟</span>
    </div>

    <div v-if="currentQuestion && exam" class="exam-body">
      <div class="exam-progress-wrap">
        <div class="exam-progress-bar">
          <div class="exam-progress-fill" :style="{ width: `${progressPercent}%` }" />
        </div>
        <div class="exam-progress-text">
          第 {{ currentIndex + 1 }}/{{ questions.length }} 题
          · {{ examQuestionTypeMap[currentQuestion.type] }}
        </div>
      </div>

      <div class="exam-card">
        <div v-if="currentQuestion.imageUrl" class="exam-image-wrap">
          <img :src="currentQuestion.imageUrl" alt="场景图" class="exam-image">
          <span class="exam-image-tip">请仔细观察图片</span>
        </div>

        <div class="exam-question">{{ currentQuestion.content }}</div>

        <div class="exam-options">
          <button
            v-for="opt in currentQuestion.options"
            :key="opt.key"
            type="button"
            class="exam-option"
            :class="{ selected: isSelected(opt.key) }"
            @click="toggleOption(opt.key)"
          >
            <span class="opt-key">{{ opt.key }}</span>
            <span class="opt-text">{{ opt.text }}</span>
            <span v-if="currentQuestion.type === 'multiple'" class="opt-check">
              {{ isSelected(opt.key) ? '☑' : '☐' }}
            </span>
          </button>
        </div>
      </div>

      <div class="exam-footer">
        <button
          type="button"
          class="exam-btn outline"
          :disabled="currentIndex === 0"
          @click="prevQuestion"
        >
          上一题
        </button>
        <button
          v-if="currentIndex < questions.length - 1"
          type="button"
          class="exam-btn primary"
          @click="nextQuestion"
        >
          下一题
        </button>
        <button
          v-else
          type="button"
          class="exam-btn primary"
          :disabled="!allAnswered"
          @click="submitExam"
        >
          交卷
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.exam-take-page {
  min-height: 100%;
  background: #f0f2f5;
  padding-bottom: 24px;
}

.exam-nav {
  position: relative;
}

.exam-timer {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  font-size: 12px;
  color: var(--mini-primary);
  font-weight: 600;
}

.exam-body {
  padding: 12px 16px 0;
}

.exam-progress-wrap {
  margin-bottom: 12px;
}

.exam-progress-bar {
  height: 4px;
  background: #e8e8e8;
  border-radius: 2px;
  overflow: hidden;
}

.exam-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--mini-primary), #81E6D9);
  transition: width 0.25s;
}

.exam-progress-text {
  margin-top: 6px;
  font-size: 12px;
  color: #999;
  text-align: center;
}

.exam-card {
  background: #fff;
  border-radius: 12px;
  padding: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
}

.exam-image-wrap {
  position: relative;
  margin-bottom: 14px;
  border-radius: 8px;
  overflow: hidden;
  background: #111;
}

.exam-image {
  width: 100%;
  display: block;
  aspect-ratio: 5 / 3;
  object-fit: cover;
}

.exam-image-tip {
  position: absolute;
  left: 8px;
  bottom: 8px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 4px;
}

.exam-question {
  font-size: 16px;
  font-weight: 700;
  color: #1a1a1a;
  line-height: 1.5;
  margin-bottom: 16px;
}

.exam-options {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.exam-option {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  width: 100%;
  text-align: left;
  padding: 12px 14px;
  border: 1.5px solid #e8e8e8;
  border-radius: 10px;
  background: #fafafa;
  cursor: pointer;
  transition: border-color 0.15s, background 0.15s;
}

.exam-option.selected {
  border-color: var(--mini-primary);
  background: var(--mini-primary-light);
}

.opt-key {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #fff;
  border: 1.5px solid #ddd;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  color: #666;
}

.exam-option.selected .opt-key {
  background: var(--mini-primary);
  border-color: var(--mini-primary);
  color: #fff;
}

.opt-text {
  flex: 1;
  font-size: 14px;
  color: #333;
  line-height: 1.45;
}

.opt-check {
  flex-shrink: 0;
  color: var(--mini-primary);
  font-size: 16px;
}

.exam-footer {
  display: flex;
  gap: 10px;
  margin-top: 16px;
}

.exam-btn {
  flex: 1;
  padding: 12px;
  border-radius: 22px;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}

.exam-btn.outline {
  border: 1px solid #ddd;
  background: #fff;
  color: #333;
}

.exam-btn.outline:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.exam-btn.primary {
  border: none;
  background: var(--mini-primary);
  color: #fff;
}

.exam-btn.primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
