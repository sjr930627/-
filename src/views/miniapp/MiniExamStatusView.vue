<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useMiniAppBack } from '@/composables/useMiniAppBack'
import { useMiniWorkerTraining } from '@/composables/useMiniWorkerTraining'

const router = useRouter()
const { goBack } = useMiniAppBack('/miniapp/profile')
const { examTasks } = useMiniWorkerTraining()

const statusMap = {
  locked: { label: '未解锁', cls: 'grey' },
  ready: { label: '待考试', cls: 'orange' },
  passed: { label: '已通过', cls: 'green' },
  failed: { label: '未通过', cls: 'red' },
} as const

function takeExam(courseId: string) {
  router.push(`/miniapp/training/exam/${courseId}`)
}

function viewReview(courseId: string, attemptId: string) {
  router.push(`/miniapp/training/exam/${courseId}/review/${attemptId}`)
}

function formatDate(iso: string) {
  const d = new Date(iso)
  return `${d.getMonth() + 1}月${d.getDate()}日 ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
</script>

<template>
  <div>
    <div class="mini-nav-bar">
      <button class="mini-nav-back" type="button" @click="goBack">← 返回</button>
      <div class="mini-nav-title">我的考核</div>
    </div>
    <div class="mini-page">
      <div v-for="task in examTasks" :key="task.exam.id" class="mini-card">
        <div class="exam-head">
          <div>
            <div class="exam-name">{{ task.exam.name }}</div>
            <div class="exam-course">关联课程：{{ task.courseName }}</div>
          </div>
          <span class="mini-tag" :class="statusMap[task.status].cls">{{ statusMap[task.status].label }}</span>
        </div>
        <div class="exam-meta">
          时长 {{ task.exam.durationMinutes }} 分钟 · 及格 {{ task.exam.passScore }} 分
          · 已考 {{ task.attemptCount }}/{{ task.exam.maxRetakes < 0 ? '∞' : task.exam.maxRetakes }} 次
        </div>
        <div v-if="task.status === 'locked'" class="exam-tip">请先完成课程学习（当前 {{ task.progress }}%）</div>
        <div v-else class="exam-tip muted">图题识别 · 单选/多选 · 答完可查看解析</div>

        <div v-if="task.attempts.length" class="attempt-list">
          <div
            v-for="att in task.attempts"
            :key="att.id"
            class="attempt-row clickable"
            @click="viewReview(task.courseId, att.id)"
          >
            <div class="attempt-left">
              <span class="mini-tag" :class="att.passed ? 'green' : 'red'">
                {{ att.passed ? '通过' : '未通过' }}
              </span>
              <span class="attempt-info">第 {{ att.attemptNumber }} 次 · {{ att.durationMinutes }} 分钟</span>
            </div>
            <div class="attempt-right">
              <span class="attempt-score" :class="{ pass: att.passed }">{{ att.score }}分</span>
              <span class="attempt-time">{{ formatDate(att.submittedAt) }}</span>
              <span class="attempt-link">查看解析 ›</span>
            </div>
          </div>
        </div>

        <button
          v-if="task.canTake"
          class="mini-btn-primary"
          style="margin-top: 12px"
          type="button"
          @click="takeExam(task.courseId)"
        >
          开始考试
        </button>
      </div>
      <div v-if="examTasks.length === 0" class="mini-empty">暂无考核</div>
    </div>
  </div>
</template>

<style scoped>
.exam-head { display: flex; justify-content: space-between; gap: 10px; margin-bottom: 8px; }
.exam-name { font-size: 16px; font-weight: 600; color: #333; }
.exam-course { font-size: 12px; color: #999; margin-top: 4px; }
.exam-meta { font-size: 12px; color: #666; }
.exam-tip { font-size: 12px; color: #fa8c16; margin-top: 8px; }
.exam-tip.muted { color: #999; }
.mini-tag.grey { background: #f5f5f5; color: #999; }
.mini-tag.red { background: #fff0f0; color: #e60012; }
.attempt-list {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #f5f5f5;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.attempt-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 8px 0;
}
.attempt-row.clickable {
  cursor: pointer;
}
.attempt-row.clickable:active {
  opacity: 0.7;
}
.attempt-left { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.attempt-info { font-size: 12px; color: #999; }
.attempt-right { text-align: right; flex-shrink: 0; }
.attempt-score { font-size: 16px; font-weight: 700; color: #e60012; display: block; }
.attempt-score.pass { color: #52c41a; }
.attempt-time { font-size: 11px; color: #bbb; display: block; }
.attempt-link { font-size: 11px; color: #e60012; display: block; margin-top: 2px; }
</style>
