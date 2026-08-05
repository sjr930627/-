<script setup lang="ts">
import MiniNavBack from '@/components/miniapp/MiniNavBack.vue'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import { useMiniAppBack } from '@/composables/useMiniAppBack'
import { canAccessMaterial, getMaterialMinReadMinutes } from '@/services/training'

const DEMO_VIDEO_SECONDS = 30

const route = useRoute()
const store = useAppStore()
const { employeeId } = useMiniAppWorker()
const { goBack } = useMiniAppBack('/miniapp/training/materials')

const courseId = computed(() => route.params.courseId as string)
const materialId = computed(() => route.params.materialId as string)

const course = computed(() => store.trainingCourses.find((c) => c.id === courseId.value))
const material = computed(() => store.trainingMaterials.find((m) => m.id === materialId.value))
const record = computed(() =>
  store.courseLearningRecords.find(
    (r) => r.courseId === courseId.value && r.employeeId === employeeId.value,
  ),
)

const alreadyLearned = computed(() =>
  record.value?.completedMaterialIds.includes(materialId.value) ?? false,
)

const requiredReadMinutes = computed(() => {
  if (!course.value || !material.value) return 3
  return getMaterialMinReadMinutes(course.value, material.value.type)
})

const requiredReadSeconds = computed(() => requiredReadMinutes.value * 60)

const playing = ref(false)
const watchedSeconds = ref(0)
const bottomReadSeconds = ref(0)
const scrolledToBottom = ref(false)

let playTimer: ReturnType<typeof setInterval> | null = null
let readTimer: ReturnType<typeof setInterval> | null = null

const watchPercent = computed(() =>
  Math.min(100, Math.round((watchedSeconds.value / DEMO_VIDEO_SECONDS) * 100)),
)

const readPercent = computed(() =>
  Math.min(100, Math.round((bottomReadSeconds.value / requiredReadSeconds.value) * 100)),
)

const isPdf = computed(() => material.value?.type === 'pdf')
const isReadable = computed(() => material.value?.type === 'pdf' || material.value?.type === 'article')

const canComplete = computed(() => {
  if (alreadyLearned.value) return false
  if (!material.value) return false
  if (material.value.type === 'video') {
    return watchedSeconds.value >= DEMO_VIDEO_SECONDS
  }
  return scrolledToBottom.value && bottomReadSeconds.value >= requiredReadSeconds.value
})

const progressHint = computed(() => {
  if (alreadyLearned.value) return '已完成学习，可随时复习'
  if (!material.value) return ''

  if (material.value.type === 'video') {
    const left = Math.max(0, DEMO_VIDEO_SECONDS - watchedSeconds.value)
    if (left <= 0) return '观看完成，请点击下方按钮确认'
    return `请完整观看视频，不可拖拽快进（剩余约 ${left} 秒）`
  }

  const parts: string[] = []
  if (!scrolledToBottom.value) {
    parts.push(isPdf.value ? '滑动 PDF 至最底部' : '滑动至最底部')
  } else if (bottomReadSeconds.value < requiredReadSeconds.value) {
    const left = requiredReadSeconds.value - bottomReadSeconds.value
    const min = Math.floor(left / 60)
    const sec = left % 60
    const timeLeft = min > 0 ? `${min} 分 ${sec} 秒` : `${sec} 秒`
    parts.push(`在底部继续阅读 ${timeLeft}`)
  }
  if (parts.length) {
    const prefix = isPdf.value
      ? `PDF 需滑至底部并阅读满 ${requiredReadMinutes.value} 分钟：`
      : `需滑至底部并阅读满 ${requiredReadMinutes.value} 分钟：`
    return prefix + parts.join('，')
  }
  return '阅读完成，请点击下方按钮确认'
})

function stopPlayTimer() {
  if (playTimer) {
    clearInterval(playTimer)
    playTimer = null
  }
}

function stopReadTimer() {
  if (readTimer) {
    clearInterval(readTimer)
    readTimer = null
  }
}

function togglePlay() {
  if (material.value?.type !== 'video' || alreadyLearned.value) return
  if (watchedSeconds.value >= DEMO_VIDEO_SECONDS) return

  playing.value = !playing.value
  if (playing.value) {
    stopPlayTimer()
    playTimer = setInterval(() => {
      if (watchedSeconds.value >= DEMO_VIDEO_SECONDS) {
        watchedSeconds.value = DEMO_VIDEO_SECONDS
        playing.value = false
        stopPlayTimer()
        return
      }
      watchedSeconds.value += 1
    }, 1000)
  } else {
    stopPlayTimer()
  }
}

function onProgressPointerDown() {
  if (material.value?.type !== 'video' || alreadyLearned.value) return
  ElMessage.warning('视频不可拖拽快进，请完整观看')
}

function onScroll(e: Event) {
  const el = e.target as HTMLElement
  scrolledToBottom.value = el.scrollTop + el.clientHeight >= el.scrollHeight - 24
}

function startReadTimer() {
  if (readTimer || alreadyLearned.value) return
  readTimer = setInterval(() => {
    if (scrolledToBottom.value) {
      bottomReadSeconds.value += 1
    }
  }, 1000)
}

function formatVideoTime(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function formatReadTime(sec: number) {
  const m = Math.floor(sec / 60)
  const s = sec % 60
  if (m <= 0) return `${s} 秒`
  return `${m} 分 ${s} 秒`
}

function completeLearning() {
  if (!canComplete.value || !course.value || !material.value) return
  const minutes =
    material.value.type === 'video'
      ? Math.max(1, Math.ceil(watchedSeconds.value / 60))
      : Math.max(1, Math.ceil(bottomReadSeconds.value / 60))
  try {
    store.completeCourseMaterial(courseId.value, employeeId.value, materialId.value, minutes)
    ElMessage.success('学习完成')
    goBack()
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '提交失败')
  }
}

watch(
  [course, material, record],
  () => {
    if (!course.value || !material.value) {
      ElMessage.error('学习内容不存在')
      goBack()
      return
    }
    const completed = record.value?.completedMaterialIds ?? []
    if (!canAccessMaterial(course.value, materialId.value, completed)) {
      ElMessage.warning('请按顺序学习，先完成上一项资料')
      goBack()
    }
  },
  { immediate: true },
)

onMounted(() => {
  if (isReadable.value && !alreadyLearned.value) {
    startReadTimer()
  }
})

onBeforeUnmount(() => {
  stopPlayTimer()
  stopReadTimer()
})
</script>

<template>
  <div class="learn-page">
    <div class="mini-nav-bar">
      <MiniNavBack fallback="/miniapp/training/materials" />
      <div class="mini-nav-title">{{ material?.name ?? '学习' }}</div>
    </div>

    <div v-if="material && course" class="learn-body">
      <div v-if="material.type === 'video'" class="video-block">
        <div class="video-screen" @click="togglePlay">
          <div class="video-play-icon">{{ playing ? '⏸' : '▶' }}</div>
          <div class="video-screen-label">演示视频 · {{ material.name }}</div>
          <div v-if="!alreadyLearned" class="video-no-seek-tip">不可拖拽快进</div>
        </div>
        <div class="video-controls">
          <span class="video-time">{{ formatVideoTime(watchedSeconds) }}</span>
          <div
            class="video-progress no-seek"
            @pointerdown.prevent="onProgressPointerDown"
          >
            <div class="video-progress-fill" :style="{ width: `${watchPercent}%` }" />
          </div>
          <span class="video-time">{{ formatVideoTime(DEMO_VIDEO_SECONDS) }}</span>
        </div>
      </div>

      <div v-else class="read-block" @scroll="onScroll">
        <div v-if="material.type === 'pdf'" class="read-pdf-cover">📄 PDF 文档</div>
        <div class="read-content" v-html="material.description ?? '<p>暂无正文内容</p>'" />
        <div v-if="material.type === 'pdf'" class="read-pdf-footer">
          <p>{{ material.fileName }}</p>
          <p class="text-muted">— 文档底部 —</p>
        </div>
      </div>

      <div class="learn-footer">
        <div class="learn-hint">{{ progressHint }}</div>
        <div v-if="isReadable && !alreadyLearned" class="read-stats">
          <span :class="{ done: scrolledToBottom }">
            {{ scrolledToBottom ? '✓ 已滑至底部' : '○ 未滑至底部' }}
          </span>
          <span>
            底部阅读 {{ formatReadTime(bottomReadSeconds) }} / {{ requiredReadMinutes }} 分钟
          </span>
        </div>
        <div v-if="isReadable && !alreadyLearned" class="read-progress-bar">
          <div class="read-progress-fill" :style="{ width: `${readPercent}%` }" />
        </div>
        <button
          v-if="!alreadyLearned"
          class="mini-btn-primary learn-btn"
          type="button"
          :disabled="!canComplete"
          @click="completeLearning"
        >
          完成学习
        </button>
        <div v-else class="learn-done-tag">✓ 已学习</div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.learn-page {
  min-height: 100%;
  background: #f0f2f5;
  display: flex;
  flex-direction: column;
}

.learn-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding-bottom: 16px;
}

.video-block {
  background: #000;
}

.video-screen {
  aspect-ratio: 16 / 9;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: #fff;
  cursor: pointer;
  background: linear-gradient(135deg, #1a1a2e, #16213e);
  position: relative;
}

.video-play-icon {
  font-size: 36px;
  margin-bottom: 8px;
}

.video-screen-label {
  font-size: 14px;
  opacity: 0.85;
  padding: 0 16px;
  text-align: center;
}

.video-no-seek-tip {
  position: absolute;
  top: 10px;
  right: 10px;
  font-size: 11px;
  background: rgba(230, 0, 18, 0.85);
  padding: 2px 8px;
  border-radius: 4px;
}

.video-controls {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 12px;
  background: #111;
}

.video-time {
  font-size: 11px;
  color: #aaa;
  flex-shrink: 0;
  width: 32px;
}

.video-time:last-child {
  text-align: right;
}

.video-progress {
  flex: 1;
  height: 4px;
  background: #333;
  border-radius: 2px;
  overflow: hidden;
}

.video-progress.no-seek {
  cursor: not-allowed;
  pointer-events: auto;
}

.video-progress-fill {
  height: 100%;
  background: #e60012;
  border-radius: 2px;
  pointer-events: none;
  transition: width 0.3s linear;
}

.read-block {
  flex: 1;
  overflow-y: auto;
  max-height: calc(100vh - 220px);
  background: #fff;
  margin: 12px;
  border-radius: 12px;
  padding: 16px;
}

.read-pdf-cover {
  text-align: center;
  font-size: 48px;
  padding: 24px 0 8px;
}

.read-content {
  font-size: 14px;
  line-height: 1.7;
  color: #333;
}

.read-content :deep(p) {
  margin: 0 0 12px;
}

.read-pdf-footer {
  margin-top: 32px;
  padding-top: 16px;
  border-top: 1px dashed #eee;
  font-size: 12px;
  color: #666;
  text-align: center;
}

.text-muted {
  color: #999;
  margin-top: 4px;
}

.learn-footer {
  margin: 0 12px;
  padding: 12px;
  background: #fff;
  border-radius: 12px;
}

.learn-hint {
  font-size: 12px;
  color: #666;
  margin-bottom: 8px;
  text-align: center;
  line-height: 1.5;
}

.read-stats {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  font-size: 11px;
  color: #999;
  margin-bottom: 8px;
}

.read-stats .done {
  color: #52c41a;
}

.read-progress-bar {
  height: 4px;
  background: #f0f0f0;
  border-radius: 2px;
  overflow: hidden;
  margin-bottom: 12px;
}

.read-progress-fill {
  height: 100%;
  background: #e60012;
  transition: width 1s linear;
}

.learn-btn {
  width: 100%;
  padding: 12px;
}

.learn-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.learn-done-tag {
  text-align: center;
  color: #52c41a;
  font-size: 15px;
  font-weight: 600;
  padding: 10px;
}
</style>
