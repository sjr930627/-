<script setup lang="ts">
import { ArrowLeft } from '@element-plus/icons-vue'
import { useMiniAppBack } from '@/composables/useMiniAppBack'

const props = withDefaults(
  defineProps<{
    fallback?: string
  }>(),
  {
    fallback: '/miniapp/workbench',
  },
)

const { goBack } = useMiniAppBack(props.fallback)
</script>

<template>
  <button type="button" class="mini-nav-back" aria-label="返回" @click="goBack">
    <el-icon :size="18"><ArrowLeft /></el-icon>
  </button>
</template>
