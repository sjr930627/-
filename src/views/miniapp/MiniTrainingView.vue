<script setup lang="ts">
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { useMiniAppBack } from '@/composables/useMiniAppBack'
import { useMiniWorkerTraining } from '@/composables/useMiniWorkerTraining'

const store = useAppStore()
const { goBack } = useMiniAppBack('/miniapp/profile')
const { myCourses } = useMiniWorkerTraining()

function startLearning(courseId: string) {
  ElMessage.success('进入课程学习（演示）')
  const course = store.trainingCourses.find((c) => c.id === courseId)
  if (course?.examId) {
    ElMessage.info('学完后将自动触发关联考核')
  }
}

function takeExam(courseId: string) {
  const course = store.trainingCourses.find((c) => c.id === courseId)
  if (!course?.examId) return
  ElMessage.success('进入考试（演示）')
}
</script>

<template>
  <div>
    <div class="mini-nav-bar">
      <button class="mini-nav-back" type="button" @click="goBack">← 返回</button>
      <div class="mini-nav-title">培训管理</div>
    </div>
    <div class="mini-page">
      <div v-for="c in myCourses" :key="c.course.id" class="mini-card">
        <div style="font-size: 16px; font-weight: 600">{{ c.course.name }}</div>
        <div style="font-size: 12px; color: #999; margin-top: 4px">
          {{ c.materialCount }} 项资料
          <span v-if="c.exam"> · 考核：{{ c.exam.name }}</span>
        </div>
        <div style="margin-top: 10px">
          <div style="display: flex; justify-content: space-between; font-size: 12px; margin-bottom: 4px">
            <span>{{ c.statusLabel }}</span>
            <span>{{ c.progress }}%</span>
          </div>
          <div style="height: 6px; background: #f0f0f0; border-radius: 3px; overflow: hidden">
            <div :style="{ width: `${c.progress}%`, height: '100%', background: '#e60012', borderRadius: '3px' }" />
          </div>
        </div>
        <div v-if="c.record.examPassed !== undefined" style="margin-top: 8px; font-size: 12px">
          考核：{{ c.record.examPassed ? `通过 ${c.record.examScore}分` : `未通过 ${c.record.examScore ?? 0}分` }}
        </div>
        <div style="display: flex; gap: 8px; margin-top: 12px">
          <button class="mini-btn-outline" style="flex: 1" @click="startLearning(c.course.id)">继续学习</button>
          <button
            v-if="c.exam && c.progress >= 100"
            class="mini-btn-primary"
            style="flex: 1; padding: 8px"
            @click="takeExam(c.course.id)"
          >
            参加考试
          </button>
        </div>
      </div>
      <div v-if="myCourses.length === 0" class="mini-empty">暂无培训课程</div>
    </div>
  </div>
</template>
