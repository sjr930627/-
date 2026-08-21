<script setup lang="ts">
import { ArrowLeft } from '@element-plus/icons-vue'
import { useRouter } from 'vue-router'
import EntMiniMessageEntry from '@/components/enterprise-miniapp/EntMiniMessageEntry.vue'

const props = withDefaults(
  defineProps<{
    title: string
    backTo?: string
    /** 消息页等可不显示右上角消息入口 */
    showMessage?: boolean
  }>(),
  {
    backTo: '/enterprise-miniapp/attendance',
    showMessage: true,
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
    <div class="right">
      <EntMiniMessageEntry v-if="showMessage" tone="dark" />
      <span v-else class="spacer" />
    </div>
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
  background: var(--mini-bg, #f5f6f8);
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
  flex-shrink: 0;
}
h1 {
  flex: 1;
  margin: 0;
  font-size: 17px;
  text-align: center;
  color: #111827;
}
.right {
  width: 36px;
  display: flex;
  justify-content: flex-end;
  flex-shrink: 0;
}
.spacer {
  width: 34px;
}
</style>
