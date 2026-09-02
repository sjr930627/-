<script setup lang="ts">
import EntMiniMessageEntry from '@/components/enterprise-miniapp/EntMiniMessageEntry.vue'

defineProps<{
  title: string
}>()
</script>

<template>
  <div class="ent-page-header-wrap">
    <header class="ent-page-header">
      <div class="side left">
        <EntMiniMessageEntry tone="dark" />
      </div>
      <h1>{{ title }}</h1>
      <span class="side" aria-hidden="true" />
    </header>
    <div v-if="$slots.default" class="ent-page-header-extra">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.ent-page-header-wrap {
  position: sticky;
  top: 0;
  z-index: 30;
  background: #fff;
}

.ent-page-header {
  display: grid;
  grid-template-columns: 44px 1fr 44px;
  align-items: center;
  gap: 4px;
  padding: 10px 12px;
  background: var(--ent-header-bg, #D5E9FF);
  color: #111827;
}

h1 {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  text-align: center;
  letter-spacing: 0.02em;
}

.side {
  display: flex;
  align-items: center;
  min-height: 36px;
}

.side.left {
  justify-content: flex-start;
}

.ent-page-header-extra {
  background: #fff;
  padding: 0 12px 8px;
}
</style>
