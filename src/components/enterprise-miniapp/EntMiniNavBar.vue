<script setup lang="ts">
import { ArrowLeft } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'

const props = withDefaults(
  defineProps<{
    title: string
    backTo?: string
  }>(),
  {
    backTo: '/enterprise-miniapp/workbench',
  },
)

const router = useRouter()

function goBack() {
  if (window.history.length > 1) {
    router.back()
    return
  }
  router.replace(props.backTo)
}
</script>

<template>
  <header class="ent-nav">
    <button type="button" class="back" aria-label="返回" @click="goBack">
      <el-icon :size="18"><ArrowLeft /></el-icon>
    </button>
    <h1>{{ title }}</h1>
    <span class="spacer" />
  </header>
</template>

<style scoped>
.ent-nav {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 12px 8px;
  position: sticky;
  top: 0;
  z-index: 20;
  background: var(--mini-bg, #f3f4f6);
}
.back {
  width: 34px;
  height: 34px;
  border: none;
  border-radius: 10px;
  background: #fff;
  color: #374151;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: var(--mini-shadow);
}
h1 {
  flex: 1;
  margin: 0;
  font-size: 17px;
  text-align: center;
  color: #111827;
}
.spacer {
  width: 34px;
}
</style>
