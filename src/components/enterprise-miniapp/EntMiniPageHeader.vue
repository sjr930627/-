<script setup lang="ts">
import EntMiniMessageEntry from '@/components/enterprise-miniapp/EntMiniMessageEntry.vue'

defineProps<{
  title: string
}>()
</script>

<template>
  <header class="ent-page-header">
    <div class="title-row">
      <span class="side" />
      <h1>{{ title }}</h1>
      <div class="side right">
        <EntMiniMessageEntry tone="light" />
      </div>
    </div>
    <div v-if="$slots.default" class="extra">
      <slot />
    </div>
  </header>
</template>

<style scoped>
.ent-page-header {
  background: linear-gradient(180deg, #5b4fdb 0%, #7c6df0 100%);
  color: #fff;
  padding: 14px 12px 14px;
  position: sticky;
  top: 0;
  z-index: 30;
}
.title-row {
  display: grid;
  grid-template-columns: 44px 1fr 44px;
  align-items: center;
  gap: 4px;
}
h1 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  text-align: center;
  letter-spacing: 0.02em;
}
.side {
  display: flex;
  align-items: center;
  min-height: 36px;
}
.side.right {
  justify-content: flex-end;
}
.extra {
  margin-top: 10px;
}
</style>
