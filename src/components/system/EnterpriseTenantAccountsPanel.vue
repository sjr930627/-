<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '@/stores/app'
import OpsPersonnelTab from '@/components/system/OpsPersonnelTab.vue'

const props = defineProps<{
  enterpriseId: string
}>()

const emit = defineEmits<{
  back: []
}>()

const store = useAppStore()

const enterprise = computed(() => store.enterprises.find((e) => e.id === props.enterpriseId))
</script>

<template>
  <div class="tenant-accounts">
    <div class="panel-header">
      <div>
        <el-button text @click="emit('back')">
          <el-icon><ArrowLeft /></el-icon>
          返回租户列表
        </el-button>
        <h2 class="page-title">{{ enterprise?.name ?? '企业' }} · 账号管理</h2>
        <p class="text-muted">按企业组织架构管理部门账号，支持新增、编辑与重置密码</p>
      </div>
    </div>

    <OpsPersonnelTab scope="enterprise" :enterprise-id="enterpriseId" />
  </div>
</template>

<style scoped>
.panel-header {
  margin-bottom: 16px;
}

.panel-header .page-title {
  margin: 8px 0 4px;
}
</style>
