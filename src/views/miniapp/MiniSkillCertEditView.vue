<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import MiniNavBack from '@/components/miniapp/MiniNavBack.vue'
import MiniSkillCertPicker from '@/components/miniapp/MiniSkillCertPicker.vue'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'
import { useAppStore } from '@/stores/app'
import {
  MINIAPP_SKILL_CERT_CATALOG,
  MINIAPP_SKILL_CERT_MAX,
} from '@/constants/miniappAuth'
import type { WorkerSkillCertificate } from '@/types'

const router = useRouter()
const store = useAppStore()
const { employeeId, profileExt } = useMiniAppWorker()

const selectedCertIds = ref<string[]>(
  profileExt.value?.skillCertificates?.map((c) => c.id) ?? [],
)

function certIdsToRecords(ids: string[]): WorkerSkillCertificate[] {
  const all = MINIAPP_SKILL_CERT_CATALOG.flatMap((c) => c.items)
  return ids.map((id) => {
    const item = all.find((i) => i.id === id)
    return { id, name: item?.name ?? id }
  })
}

function save() {
  store.updateWorkerSkillCertificates(employeeId.value, certIdsToRecords(selectedCertIds.value))
  ElMessage.success('技能证书已保存')
  router.back()
}
</script>

<template>
  <div class="edit-page">
    <div class="mini-nav-bar">
      <MiniNavBack fallback="/miniapp/worker-archive" />
      <div class="mini-nav-title">技能证书</div>
    </div>

    <div class="edit-content has-footer">
      <h2 class="page-heading">我有哪些职业技能证书？</h2>
      <MiniSkillCertPicker v-model="selectedCertIds" />
    </div>

    <div class="mini-footer-bar cert-footer">
      <button type="button" class="mini-footer-secondary" @click="router.back()">取消</button>
      <button type="button" class="mini-footer-primary" @click="save">
        保存
        <span class="footer-count">({{ selectedCertIds.length }}/{{ MINIAPP_SKILL_CERT_MAX }})</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.edit-page {
  min-height: 100%;
  background: var(--mini-bg, #f3f4f6);
}

.edit-content {
  padding: 12px 16px 24px;
}

.edit-content.has-footer {
  padding-bottom: 88px;
}

.page-heading {
  margin: 0 0 16px;
  font-size: 20px;
  font-weight: 800;
  color: #111827;
  line-height: 1.35;
}

.footer-count {
  margin-left: 4px;
  font-weight: 600;
  opacity: 0.85;
}
</style>
