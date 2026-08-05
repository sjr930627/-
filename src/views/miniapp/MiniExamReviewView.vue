<script setup lang="ts">
import MiniNavBack from '@/components/miniapp/MiniNavBack.vue'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAppStore } from '@/stores/app'
import { examQuestionTypeMap } from '@/constants/training'
import { getExamQuestions, gradeExamAnswers } from '@/services/training'

const route = useRoute()
const router = useRouter()
const store = useAppStore()

const courseId = computed(() => route.params.courseId as string)
const attemptId = computed(() => route.params.attemptId as string)

const attempt = computed(() => store.examAttempts.find((a) => a.id === attemptId.value))
const exam = computed(() =>
  attempt.value ? store.trainingExams.find((e) => e.id === attempt.value!.examId) : null,
)
const course = computed(() => store.trainingCourses.find((c) => c.id === courseId.value))

const questions = computed(() =>
  exam.value ? getExamQuestions(exam.value.id, store.examQuestions) : [],
)

const graded = computed(() => {
  if (!attempt.value) return []
  const result = gradeExamAnswers(questions.value, attempt.value.answers)
  return questions.value.map((q, i) => ({
    question: q,
    detail: result.details[i],
  }))
})

function optionState(
  optKey: string,
  correctAnswers: string[],
  userAnswers: string[],
  isCorrect: boolean,
) {
  const isCorrectOpt = correctAnswers.includes(optKey)
  const isUserOpt = userAnswers.includes(optKey)
  if (isCorrectOpt) return 'correct'
  if (isUserOpt && !isCorrect) return 'wrong'
  return 'normal'
}

function backToList() {
  router.push('/miniapp/training/exams')
}
</script>

<template>
  <div class="review-page">
    <div class="mini-nav-bar">
      <MiniNavBack fallback="/miniapp/training/exams" />
      <div class="mini-nav-title">答题解析</div>
    </div>

    <div v-if="attempt && exam" class="review-body">
      <div class="score-card" :class="attempt.passed ? 'pass' : 'fail'">
        <div class="score-num">{{ attempt.score }}<span class="unit">分</span></div>
        <div class="score-meta">
          <span class="score-status">{{ attempt.passed ? '考核通过' : '未通过' }}</span>
          <span class="score-sub">及格 {{ exam.passScore }} 分 · 用时 {{ attempt.durationMinutes }} 分钟</span>
        </div>
      </div>

      <div class="review-course">{{ course?.name }} · {{ exam.name }}</div>

      <div v-for="(item, idx) in graded" :key="item.question.id" class="q-card">
        <div class="q-head">
          <span class="q-index">第 {{ idx + 1 }} 题</span>
          <span class="q-type">{{ examQuestionTypeMap[item.question.type] }}</span>
          <span class="q-result" :class="item.detail.isCorrect ? 'ok' : 'bad'">
            {{ item.detail.isCorrect ? '回答正确' : '回答错误' }}
            · {{ item.detail.earned }}/{{ item.question.score }}分
          </span>
        </div>

        <div v-if="item.question.imageUrl" class="q-image-wrap">
          <img :src="item.question.imageUrl" alt="场景图" class="q-image">
        </div>

        <div class="q-content">{{ item.question.content }}</div>

        <div class="q-options">
          <div
            v-for="opt in item.question.options"
            :key="opt.key"
            class="q-option"
            :class="optionState(
              opt.key,
              item.detail.correctAnswers,
              item.detail.userAnswers,
              item.detail.isCorrect,
            )"
          >
            <span class="opt-key">{{ opt.key }}</span>
            <span class="opt-text">{{ opt.text }}</span>
            <span v-if="item.detail.correctAnswers.includes(opt.key)" class="opt-tag correct">正确答案</span>
            <span
              v-else-if="item.detail.userAnswers.includes(opt.key)"
              class="opt-tag wrong"
            >你的选择</span>
          </div>
        </div>

        <div v-if="item.question.explanation" class="q-explain">
          <span class="explain-label">解析</span>
          {{ item.question.explanation }}
        </div>
      </div>

      <button type="button" class="mini-btn-primary back-btn" @click="backToList">返回我的考核</button>
    </div>

    <div v-else class="mini-page mini-empty">未找到答题记录</div>
  </div>
</template>

<style scoped>
.review-page {
  min-height: 100%;
  background: #f0f2f5;
  padding-bottom: 24px;
}

.review-body {
  padding: 12px 16px;
}

.score-card {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px;
  border-radius: 12px;
  margin-bottom: 12px;
  color: #fff;
}

.score-card.pass {
  background: linear-gradient(135deg, #52c41a, #73d13d);
}

.score-card.fail {
  background: linear-gradient(135deg, #e60012, #ff4d4f);
}

.score-num {
  font-size: 42px;
  font-weight: 800;
  line-height: 1;
}

.score-num .unit {
  font-size: 16px;
  font-weight: 600;
}

.score-meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.score-status {
  font-size: 18px;
  font-weight: 700;
}

.score-sub {
  font-size: 12px;
  opacity: 0.9;
}

.review-course {
  font-size: 12px;
  color: #999;
  margin-bottom: 12px;
  text-align: center;
}

.q-card {
  background: #fff;
  border-radius: 12px;
  padding: 14px;
  margin-bottom: 12px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
}

.q-head {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 10px;
}

.q-index {
  font-size: 13px;
  font-weight: 700;
  color: #333;
}

.q-type {
  font-size: 11px;
  color: #999;
  background: #f5f5f5;
  padding: 2px 6px;
  border-radius: 4px;
}

.q-result {
  margin-left: auto;
  font-size: 12px;
  font-weight: 600;
}

.q-result.ok { color: #52c41a; }
.q-result.bad { color: #e60012; }

.q-image-wrap {
  border-radius: 8px;
  overflow: hidden;
  margin-bottom: 10px;
}

.q-image {
  width: 100%;
  display: block;
  aspect-ratio: 5 / 3;
  object-fit: cover;
}

.q-content {
  font-size: 15px;
  font-weight: 600;
  color: #1a1a1a;
  line-height: 1.5;
  margin-bottom: 12px;
}

.q-options {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.q-option {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 12px;
  border-radius: 8px;
  border: 1.5px solid #eee;
  background: #fafafa;
  font-size: 13px;
}

.q-option.correct {
  border-color: #52c41a;
  background: #f6ffed;
}

.q-option.wrong {
  border-color: #e60012;
  background: #fff0f0;
}

.opt-key {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: #fff;
  border: 1px solid #ddd;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 11px;
  font-weight: 700;
}

.q-option.correct .opt-key {
  background: #52c41a;
  border-color: #52c41a;
  color: #fff;
}

.q-option.wrong .opt-key {
  background: #e60012;
  border-color: #e60012;
  color: #fff;
}

.opt-text {
  flex: 1;
  color: #333;
  line-height: 1.4;
}

.opt-tag {
  flex-shrink: 0;
  font-size: 10px;
  padding: 2px 6px;
  border-radius: 4px;
  font-weight: 600;
}

.opt-tag.correct {
  background: #52c41a;
  color: #fff;
}

.opt-tag.wrong {
  background: #e60012;
  color: #fff;
}

.q-explain {
  margin-top: 10px;
  padding: 10px 12px;
  background: #fffbe6;
  border-radius: 8px;
  font-size: 12px;
  color: #666;
  line-height: 1.5;
}

.explain-label {
  color: #fa8c16;
  font-weight: 700;
  margin-right: 6px;
}

.back-btn {
  width: 100%;
  margin-top: 8px;
}
</style>
