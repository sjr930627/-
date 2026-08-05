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

    <div class="cert-footer">
      <button type="button" class="footer-cancel" @click="router.back()">取消</button>
      <button type="button" class="footer-save" @click="save">
        保存
        <span class="footer-count">({{ selectedCertIds.length }}/{{ MINIAPP_SKILL_CERT_MAX }})</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.edit-page {
  min-height: 100%;
  background: #f3f0ff;
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

.cert-footer {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 30;
  display: flex;
  gap: 12px;
  padding: 12px 16px calc(12px + env(safe-area-inset-bottom));
  background: #fff;
  box-shadow: 0 -4px 20px rgba(15, 23, 42, 0.08);
}

.footer-cancel {
  flex: 0 0 88px;
  padding: 14px 0;
  border: none;
  border-radius: 999px;
  background: #f3f4f6;
  color: #64748b;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}

.footer-save {
  flex: 1;
  padding: 14px 0;
  border: none;
  border-radius: 999px;
  background: #86efac;
  color: #14532d;
  font-size: 16px;
  font-weight: 700;
  cursor: pointer;
}

.footer-count {
  margin-left: 4px;
  font-weight: 600;
  opacity: 0.85;
}
</style>
