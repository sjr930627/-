<script setup lang="ts">
import MiniNavBack from '@/components/miniapp/MiniNavBack.vue'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import {
  CircleCheckFilled,
  Document,
  Lock,
  Monitor,
  VideoPlay,
} from '@element-plus/icons-vue'
import { useAppStore } from '@/stores/app'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import { useMiniAppBack } from '@/composables/useMiniAppBack'
import { getMaterialCategoryLabel } from '@/constants/training'
import { canAccessMaterial, getMaterialMinReadMinutes } from '@/services/training'
import type { TrainingMaterial } from '@/types'

const DEMO_VIDEO_SECONDS = 30

const route = useRoute()
const router = useRouter()
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
const previewing = ref(false)
const watchedSeconds = ref(0)
const bottomReadSeconds = ref(0)
const scrolledToBottom = ref(false)

let playTimer: ReturnType<typeof setInterval> | null = null
let readTimer: ReturnType<typeof setInterval> | null = null

const watchPercent = computed(() =>
  Math.min(100, Math.round((watchedSeconds.value / DEMO_VIDEO_SECONDS) * 100)),
)

const isPdf = computed(() => material.value?.type === 'pdf')
const isReadable = computed(() => material.value?.type === 'pdf' || material.value?.type === 'article')
const isVideo = computed(() => material.value?.type === 'video')

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
    if (left <= 0) return '观看完成，请点击「我想学习」确认'
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
  return '阅读完成，请点击「我想学习」确认'
})

const navTitle = computed(() => {
  const cat = getMaterialCategoryLabel(material.value?.category, store.trainingMaterialCategories)
  const name = course.value?.name || '课程学习'
  return cat && cat !== '—' ? `${cat} > ${name}` : name
})

const catalog = computed(() => {
  if (!course.value) return []
  const completed = record.value?.completedMaterialIds ?? []
  return course.value.materialIds
    .map((id, index) => {
      const m = store.trainingMaterials.find((item) => item.id === id && item.status === 'approved')
      if (!m) return null
      return {
        indexLabel: String(index + 1).padStart(2, '0'),
        material: m,
        learned: completed.includes(m.id),
        accessible: canAccessMaterial(course.value!, m.id, completed),
        current: m.id === materialId.value,
      }
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
})

const playerDurationLabel = computed(() => {
  if (isVideo.value) {
    const left = alreadyLearned.value
      ? DEMO_VIDEO_SECONDS
      : Math.max(0, DEMO_VIDEO_SECONDS - watchedSeconds.value)
    return formatVideoTime(playing.value || watchedSeconds.value > 0 ? left : DEMO_VIDEO_SECONDS)
  }
  return `${String(requiredReadMinutes.value).padStart(2, '0')}:00`
})

const primaryActionLabel = computed(() => {
  if (alreadyLearned.value) return '已学习'
  if (canComplete.value) return '完成学习'
  return '我想学习'
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

function resetLessonState() {
  playing.value = false
  previewing.value = false
  watchedSeconds.value = 0
  bottomReadSeconds.value = 0
  scrolledToBottom.value = false
  stopPlayTimer()
}

function togglePlay() {
  if (!isVideo.value) {
    previewing.value = true
    return
  }
  if (alreadyLearned.value) {
    playing.value = !playing.value
    return
  }
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

function onPreview() {
  if (isVideo.value) {
    if (!playing.value) togglePlay()
    return
  }
  previewing.value = true
}

function onProgressPointerDown() {
  if (!isVideo.value || alreadyLearned.value) return
  if (course.value?.videoNoSeek !== false) {
    ElMessage.warning('视频不可拖拽快进，请完整观看')
  }
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
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
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
    const completed = [...(record.value?.completedMaterialIds ?? []), materialId.value]
    const nextId = course.value.materialIds.find(
      (id) => id !== materialId.value && canAccessMaterial(course.value!, id, completed) && !completed.includes(id),
    )
    if (nextId) {
      router.replace(`/miniapp/training/learn/${courseId.value}/${nextId}`)
    }
  } catch (e) {
    ElMessage.error(e instanceof Error ? e.message : '提交失败')
  }
}

function onWantLearn() {
  if (alreadyLearned.value) {
    ElMessage.success('本课已学完，可继续复习')
    return
  }
  if (canComplete.value) {
    completeLearning()
    return
  }
  if (isVideo.value) {
    if (!playing.value) togglePlay()
  } else {
    previewing.value = true
  }
  ElMessage.info(progressHint.value)
}

function openLesson(item: (typeof catalog.value)[number]) {
  if (!item.accessible) {
    ElMessage.warning('请按顺序学习，先完成上一项资料')
    return
  }
  if (item.current) {
    onPreview()
    return
  }
  router.replace(`/miniapp/training/learn/${courseId.value}/${item.material.id}`)
}

function materialTypeClass(type: TrainingMaterial['type']) {
  if (type === 'video') return 'type-video'
  if (type === 'pdf') return 'type-pdf'
  return 'type-article'
}

watch(
  [course, material],
  () => {
    if (!course.value || !material.value) {
      ElMessage.error('学习内容不存在')
      goBack()
    }
  },
  { immediate: true },
)

watch(materialId, () => {
  resetLessonState()
  const completed = record.value?.completedMaterialIds ?? []
  if (course.value && material.value && !canAccessMaterial(course.value, materialId.value, completed)) {
    ElMessage.warning('请按顺序学习，先完成上一项资料')
    goBack()
  }
})

watch(
  [isReadable, alreadyLearned, materialId],
  () => {
    stopReadTimer()
    if (isReadable.value && !alreadyLearned.value) startReadTimer()
  },
  { immediate: true },
)

onMounted(() => {
  if (isReadable.value && !alreadyLearned.value) startReadTimer()
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
      <div class="mini-nav-title learn-nav-title">{{ navTitle }}</div>
    </div>

    <div v-if="material && course" class="learn-body">
      <section class="player" :class="{ reading: isReadable && previewing }">
        <template v-if="isVideo">
          <button type="button" class="player-screen" @click="togglePlay">
            <span v-if="!playing" class="player-play" aria-hidden="true">
              <el-icon :size="42"><VideoPlay /></el-icon>
            </span>
            <span v-else class="player-playing">播放中 {{ formatVideoTime(watchedSeconds) }}</span>
            <span class="player-duration">{{ playerDurationLabel }}</span>
          </button>
          <div
            v-if="!alreadyLearned && course.videoNoSeek !== false"
            class="player-progress"
            @pointerdown.prevent="onProgressPointerDown"
          >
            <div class="player-progress-fill" :style="{ width: `${watchPercent}%` }" />
          </div>
        </template>
        <template v-else>
          <div
            v-if="!previewing"
            class="player-screen doc-cover"
            @click="onPreview"
          >
            <el-icon :size="40"><Document /></el-icon>
            <span class="doc-cover-name">{{ isPdf ? 'PDF 文档' : '图文资料' }}</span>
            <span class="player-duration">{{ playerDurationLabel }}</span>
          </div>
          <div v-else class="read-panel" @scroll="onScroll">
            <div v-if="isPdf" class="read-pdf-cover">📄 PDF 文档</div>
            <div class="read-content" v-html="material.description ?? '<p>暂无正文内容</p>'" />
            <div v-if="isPdf" class="read-pdf-footer">
              <p>{{ material.fileName }}</p>
              <p class="text-muted">— 文档底部 —</p>
            </div>
          </div>
        </template>
      </section>

      <section class="info-block">
        <div class="info-row">
          <div class="info-main">
            <h1 class="info-title">
              <span class="info-dot" />
              {{ material.name }}
            </h1>
            <p class="info-hint">{{ progressHint }}</p>
          </div>
          <div class="info-actions">
            <button type="button" class="btn-preview" @click="onPreview">试看</button>
            <button
              type="button"
              class="btn-learn"
              :class="{ done: alreadyLearned }"
              @click="onWantLearn"
            >
              {{ primaryActionLabel }}
            </button>
          </div>
        </div>
      </section>

      <div class="catalog-tabs">
        <span class="catalog-tab active">目录</span>
      </div>

      <div class="catalog-list">
        <button
          v-for="item in catalog"
          :key="item.material.id"
          type="button"
          class="catalog-item"
          :class="{
            current: item.current,
            locked: !item.accessible,
            learned: item.learned && !item.current,
          }"
          @click="openLesson(item)"
        >
          <el-icon v-if="item.current" class="catalog-tv" :size="16"><Monitor /></el-icon>
          <span v-else class="catalog-index">{{ item.indexLabel }}</span>
          <span class="catalog-name">{{ item.material.name }}</span>
          <el-icon v-if="item.learned" class="catalog-status ok" :size="16"><CircleCheckFilled /></el-icon>
          <el-icon v-else-if="!item.accessible" class="catalog-status lock" :size="14"><Lock /></el-icon>
          <span
            v-else
            class="catalog-type"
            :class="materialTypeClass(item.material.type)"
          />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.learn-page {
  min-height: 100%;
  background: #fff;
  display: flex;
  flex-direction: column;
}

.learn-nav-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.learn-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.player {
  background: #cfcfcf;
  position: relative;
}

.player-screen {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  aspect-ratio: 16 / 9;
  border: none;
  background: #c8c8c8;
  color: #fff;
  cursor: pointer;
  position: relative;
}

.player-play {
  width: 56px;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  filter: drop-shadow(0 2px 6px rgba(0, 0, 0, 0.2));
}

.player-playing {
  font-size: 14px;
  font-weight: 600;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.35);
}

.player-duration {
  position: absolute;
  right: 12px;
  bottom: 10px;
  font-size: 12px;
  font-weight: 600;
  color: #fff;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.45);
}

.player-progress {
  height: 3px;
  background: rgba(0, 0, 0, 0.15);
  cursor: not-allowed;
}

.player-progress-fill {
  height: 100%;
  background: var(--mini-primary, #4FD1C5);
  transition: width 0.3s linear;
}

.doc-cover {
  gap: 8px;
  color: #fff;
}

.doc-cover-name {
  font-size: 13px;
  font-weight: 600;
}

.player.reading {
  background: #fff;
}

.read-panel {
  max-height: min(52vh, 420px);
  min-height: 180px;
  overflow-y: auto;
  padding: 16px;
  background: #fff;
}

.read-pdf-cover {
  text-align: center;
  font-size: 36px;
  padding: 8px 0 12px;
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
  margin-top: 24px;
  padding-top: 12px;
  border-top: 1px dashed #eee;
  font-size: 12px;
  color: #666;
  text-align: center;
}

.text-muted {
  color: #999;
  margin-top: 4px;
}

.info-block {
  padding: 14px 16px 10px;
}

.info-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.info-main {
  flex: 1;
  min-width: 0;
}

.info-title {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #1a1a1a;
  line-height: 1.4;
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.info-dot {
  width: 8px;
  height: 8px;
  margin-top: 7px;
  border-radius: 50%;
  background: var(--mini-primary, #4FD1C5);
  flex-shrink: 0;
}

.info-hint {
  margin: 8px 0 0;
  font-size: 12px;
  color: #999;
  line-height: 1.45;
}

.info-actions {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8px;
  flex-shrink: 0;
}

.btn-preview {
  padding: 3px 12px;
  border: 1px solid var(--mini-primary, #4FD1C5);
  border-radius: 999px;
  background: #fff;
  color: var(--mini-primary, #4FD1C5);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.btn-learn {
  padding: 7px 14px;
  border: none;
  border-radius: 4px;
  background: var(--mini-primary, #4FD1C5);
  color: #fff;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}

.btn-learn.done {
  background: #22c55e;
}

.catalog-tabs {
  display: flex;
  padding: 0 16px;
  border-bottom: 1px solid #f0f0f0;
}

.catalog-tab {
  padding: 10px 4px 8px;
  margin-right: 20px;
  font-size: 14px;
  font-weight: 700;
  color: #1a1a1a;
  border-bottom: 3px solid var(--mini-primary, #4FD1C5);
}

.catalog-list {
  flex: 1;
  overflow-y: auto;
}

.catalog-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 14px 16px;
  border: none;
  border-bottom: 1px solid #f3f4f6;
  background: #fff;
  text-align: left;
  cursor: pointer;
}

.catalog-item.current .catalog-name {
  color: var(--mini-primary, #4FD1C5);
  font-weight: 700;
}

.catalog-item.locked {
  opacity: 0.55;
}

.catalog-tv {
  color: var(--mini-primary, #4FD1C5);
  flex-shrink: 0;
}

.catalog-index {
  width: 22px;
  flex-shrink: 0;
  font-size: 13px;
  font-weight: 600;
  color: #333;
}

.catalog-name {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: #1a1a1a;
  line-height: 1.45;
}

.catalog-status.ok {
  color: #22c55e;
  flex-shrink: 0;
}

.catalog-status.lock {
  color: #bbb;
  flex-shrink: 0;
}

.catalog-type {
  width: 14px;
  height: 14px;
  border-radius: 3px;
  flex-shrink: 0;
}

.catalog-type.type-video {
  background: var(--mini-primary, #4FD1C5);
}

.catalog-type.type-pdf {
  background: #fb923c;
}

.catalog-type.type-article {
  background: #60a5fa;
}
</style>
