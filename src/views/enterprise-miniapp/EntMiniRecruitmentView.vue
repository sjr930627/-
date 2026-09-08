<script setup lang="ts">
import EntMiniMessageEntry from '@/components/enterprise-miniapp/EntMiniMessageEntry.vue'

withDefaults(
  defineProps<{
    title?: string
    description?: string
  }>(),
  {
    title: '招聘',
    description: '招聘模块开发中，敬请期待',
  },
)
</script>

<template>
  <div class="page">
    <div class="top">
      <span class="brand">{{ title }}</span>
      <EntMiniMessageEntry tone="dark" />
    </div>
    <div class="placeholder">
      <div class="icon">招</div>
      <h2>{{ title }}</h2>
      <p>{{ description }}</p>
    </div>
  </div>
</template>

<style scoped>
.page {
  min-height: 100%;
  background: #f5f7fb;
}

.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px 10px;
  background: var(--ent-header-bg, #d5e9ff);
}

.brand {
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
}

.placeholder {
  margin: 48px 24px;
  padding: 36px 20px;
  border-radius: 16px;
  background: #fff;
  text-align: center;
  box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
}

.icon {
  width: 56px;
  height: 56px;
  margin: 0 auto 16px;
  border-radius: 16px;
  background: #e8f3ff;
  color: #228bff;
  font-size: 22px;
  font-weight: 700;
  display: flex;
  align-items: center;
  justify-content: center;
}

h2 {
  margin: 0 0 8px;
  font-size: 17px;
  color: #111827;
}

p {
  margin: 0;
  font-size: 13px;
  color: #64748b;
  line-height: 1.5;
}
</style>
