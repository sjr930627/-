<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import MiniNavBack from '@/components/miniapp/MiniNavBack.vue'
import MiniTimePreferencePicker from '@/components/miniapp/MiniTimePreferencePicker.vue'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import { useAppStore } from '@/stores/app'
import { MINIAPP_BRAND_OPTIONS, MINIAPP_JOB_OPTIONS } from '@/constants/miniappAuth'
import type { WorkerPartTimePreference } from '@/types'

const router = useRouter()
const store = useAppStore()
const { employeeId, profileExt } = useMiniAppWorker()

const timePrefForm = ref<Partial<WorkerPartTimePreference>>({
  timeOfDay: profileExt.value?.partTimePreference?.timeOfDay ?? 'both',
  commitment: profileExt.value?.partTimePreference?.commitment ?? 'both',
  shiftDuration: profileExt.value?.partTimePreference?.shiftDuration ?? 'both',
  workDays: profileExt.value?.partTimePreference?.workDays ?? 'both',
  favoriteJobs: profileExt.value?.partTimePreference?.favoriteJobs ?? '',
  wantedJobs: profileExt.value?.partTimePreference?.wantedJobs ?? '',
  preferredBrands: profileExt.value?.partTimePreference?.preferredBrands ?? '',
})

function save() {
  store.updateWorkerPartTimePreference(employeeId.value, { ...timePrefForm.value })
  ElMessage.success('岗位偏好已保存')
  router.back()
}
</script>

<template>
  <div class="edit-page">
    <div class="mini-nav-bar">
      <MiniNavBack fallback="/miniapp/worker-archive" />
      <div class="mini-nav-title">岗位偏好</div>
    </div>

    <div class="edit-content">
      <h2 class="section-heading">我的兼职时间偏好是：</h2>
      <MiniTimePreferencePicker v-model="timePrefForm" />

      <h2 class="section-heading section-heading--sub">岗位与品牌偏好</h2>
      <div class="form-card">
        <div class="field">
          <label>我喜欢的兼职是</label>
          <select v-model="timePrefForm.favoriteJobs">
            <option value="">请选择</option>
            <option v-for="job in MINIAPP_JOB_OPTIONS" :key="job" :value="job">{{ job }}</option>
          </select>
        </div>
        <div class="field">
          <label>我想做的兼职</label>
          <select v-model="timePrefForm.wantedJobs">
            <option value="">请选择</option>
            <option v-for="job in MINIAPP_JOB_OPTIONS" :key="`w-${job}`" :value="job">{{ job }}</option>
          </select>
        </div>
        <div class="field">
          <label>我想去的品牌</label>
          <select v-model="timePrefForm.preferredBrands">
            <option value="">请选择</option>
            <option v-for="brand in MINIAPP_BRAND_OPTIONS" :key="brand" :value="brand">{{ brand }}</option>
          </select>
        </div>
      </div>

      <button class="mini-btn-primary save-btn" type="button" @click="save">保存</button>
    </div>
  </div>
</template>

<style scoped>
.edit-page {
  min-height: 100%;
  background: var(--mini-bg, #f3f4f6);
}

.edit-content {
  padding: 12px 16px 32px;
}

.section-heading {
  margin: 0 0 16px;
  font-size: 20px;
  font-weight: 800;
  color: #111827;
  line-height: 1.35;
}

.section-heading--sub {
  margin-top: 28px;
  font-size: 17px;
  font-weight: 700;
}

.form-card {
  background: #fff;
  border-radius: 16px;
  padding: 16px;
  box-shadow: 0 2px 12px rgba(15, 23, 42, 0.05);
}

.field {
  margin-bottom: 14px;
}

.field:last-child {
  margin-bottom: 0;
}

.field label {
  display: block;
  margin-bottom: 8px;
  font-size: 13px;
  color: #64748b;
}

.field select {
  width: 100%;
  box-sizing: border-box;
  padding: 12px;
  border: 1px solid #e5e7eb;
  border-radius: 12px;
  font-size: 15px;
  background: #fff;
}

.save-btn {
  width: 100%;
  margin-top: 24px;
}
</style>
