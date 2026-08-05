<script setup lang="ts">
import MiniNavBack from '@/components/miniapp/MiniNavBack.vue'
import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import { useAppStore } from '@/stores/app'
import { useMiniAppWorker } from '@/composables/useMiniAppWorker'

const store = useAppStore()
const { employeeId } = useMiniAppWorker()

const agreements = computed(() =>
  store.workerAgreements.filter((a) => a.employeeId === employeeId.value),
)

function sign(id: string) {
  try {
    store.signWorkerAgreement(id, employeeId.value)
    ElMessage.success('签署成功')
  } catch (e) {
    ElMessage.warning(e instanceof Error ? e.message : '签署失败')
  }
}
</script>

<template>
  <div>
    <div class="mini-nav-bar">
      <MiniNavBack fallback="/miniapp/profile" />
      <div class="mini-nav-title">协议管理</div>
    </div>
    <div class="mini-page">
      <div v-for="agr in agreements" :key="agr.id" class="mini-card">
        <div style="display: flex; justify-content: space-between; align-items: center">
          <div style="font-size: 15px; font-weight: 600">{{ agr.title }}</div>
          <span class="mini-tag" :class="agr.signed ? 'green' : 'red'">
            {{ agr.signed ? '已签署' : '待签署' }}
          </span>
        </div>
        <p style="font-size: 13px; color: #666; margin: 10px 0 0; line-height: 1.6">{{ agr.content }}</p>
        <div v-if="agr.signedAt" style="font-size: 11px; color: #ccc; margin-top: 8px">
          签署时间：{{ agr.signedAt.slice(0, 10) }}
        </div>
        <button
          v-if="!agr.signed"
          class="mini-btn-primary"
          style="margin-top: 12px"
          @click="sign(agr.id)"
        >
          阅读并签署
        </button>
      </div>
      <div v-if="agreements.length === 0" class="mini-empty">暂无协议</div>
    </div>
  </div>
</template>
