<script setup lang="ts">
import MiniNavBack from '@/components/miniapp/MiniNavBack.vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { getMaterialCategoryLabel } from '@/constants/training'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import { useMiniWorkerTraining } from '@/composables/useMiniWorkerTraining'
import { useAppStore } from '@/stores/app'

const router = useRouter()
const store = useAppStore()
const { employeeId } = useMiniAppWorker()
const { myCourses, materialTypeIcon } = useMiniWorkerTraining()

function categoryLabel(cat?: string) {
  if (!cat) return '未分类'
  return getMaterialCategoryLabel(cat, store.trainingMaterialCategories)
}

function openMaterial(courseId: string, materialId: string, accessible: boolean) {
  if (!accessible) {
    ElMessage.warning('请按顺序学习，先完成上一项资料')
    return
  }
  router.push(`/miniapp/training/learn/${courseId}/${materialId}`)
}

function completeCourse(courseId: string) {
  try {
    store.completeCourseLearning(courseId, employeeId.value)
    ElMessage.success('课程学习已完成，可前往「我的考核」')
  } catch (e) {
    ElMessage.warning(e instanceof Error ? e.message : '操作失败')
  }
}
</script>

<template>
  <div>
    <div class="mini-nav-bar">
      <MiniNavBack fallback="/miniapp/profile" />
      <div class="mini-nav-title">我的培训</div>
    </div>
    <div class="mini-page">
      <div v-for="item in myCourses" :key="item.course.id" class="mini-card course-card">
        <div class="course-head">
          <span class="course-name">{{ item.course.name }}</span>
          <span class="mini-tag" :class="item.record.status === 'completed' ? 'green' : 'orange'">
            {{ item.statusLabel }}
          </span>
        </div>
        <div class="course-meta">
          {{ item.record.completedMaterialIds.length }}/{{ item.materialCount }} 资料
          · 已学 {{ item.record.studyMinutes }} 分钟
        </div>
        <div class="progress-wrap">
          <div class="progress-labels">
            <span>学习进度</span>
            <span>{{ item.progress }}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: `${item.progress}%` }" />
          </div>
        </div>

        <button
          v-if="item.progress < 100"
          type="button"
          class="complete-btn"
          @click.stop="completeCourse(item.course.id)"
        >
          一键完成学习（演示）
        </button>

        <div v-if="item.materials.length" class="material-list">
          <div
            v-for="mat in item.materials"
            :key="mat.material.id"
            class="mat-row"
            :class="{ locked: !mat.accessible, learned: mat.learned }"
            @click="openMaterial(item.course.id, mat.material.id, mat.accessible)"
          >
            <div class="mat-icon">{{ materialTypeIcon(mat.material) }}</div>
            <div class="mat-body">
              <div class="mat-name">{{ mat.material.name }}</div>
              <div class="mat-meta">
                <span class="mini-tag">{{ categoryLabel(mat.material.category) }}</span>
                <span v-if="!mat.accessible" class="mini-tag grey">待解锁</span>
                <span v-else class="mini-tag" :class="mat.learned ? 'green' : 'orange'">
                  {{ mat.learned ? '已学习' : '去学习 →' }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div v-if="myCourses.length === 0" class="mini-empty">暂无培训课程</div>
    </div>
  </div>
</template>

<style scoped>
.course-head { display: flex; justify-content: space-between; align-items: center; gap: 8px; margin-bottom: 6px; }
.course-name { font-size: 16px; font-weight: 600; color: #333; }
.course-meta { font-size: 12px; color: #999; margin-bottom: 10px; }
.progress-labels { display: flex; justify-content: space-between; font-size: 12px; color: #666; margin-bottom: 4px; }
.progress-bar { height: 6px; background: #f0f0f0; border-radius: 3px; overflow: hidden; }
.progress-fill { height: 100%; background: var(--mini-primary); border-radius: 3px; }
.complete-btn {
  width: 100%;
  margin-top: 10px;
  padding: 8px;
  border: 1px dashed var(--mini-primary);
  border-radius: 8px;
  background: var(--mini-primary-light);
  color: var(--mini-primary);
  font-size: 12px;
  cursor: pointer;
}
.material-list {
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid #f5f5f5;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.mat-row {
  display: flex;
  gap: 12px;
  align-items: center;
  cursor: pointer;
  padding: 4px;
  margin: -4px;
  border-radius: 8px;
  transition: background 0.15s;
}
.mat-row:not(.locked):active { background: #fafafa; }
.mat-row.locked { opacity: 0.55; cursor: not-allowed; }
.mat-icon {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: #fff5f5;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 20px;
  flex-shrink: 0;
}
.mat-row.learned .mat-icon { background: #f6ffed; }
.mat-name { font-size: 14px; font-weight: 600; color: #333; margin-bottom: 4px; }
.mat-meta { display: flex; gap: 6px; flex-wrap: wrap; }
.mini-tag.grey { background: #f5f5f5; color: #999; }
</style>
