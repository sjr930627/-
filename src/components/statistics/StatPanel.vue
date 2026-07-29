<script setup lang="ts">
defineProps<{
  title: string
  subtitle?: string
}>()
</script>

<template>
  <div class="stat-panel">
    <div class="panel-header">
      <div>
        <h3 class="panel-title">{{ title }}</h3>
        <p v-if="subtitle" class="panel-subtitle">{{ subtitle }}</p>
      </div>
      <slot name="extra" />
    </div>
    <div class="panel-body">
      <slot />
    </div>
  </div>
</template>

<style scoped>
.stat-panel {
  background: #fff;
  border-radius: 12px;
  padding: 20px 24px;
  border: 1px solid var(--app-border);
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  height: 100%;
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.panel-title {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #1a1a2e;
}

.panel-subtitle {
  margin: 4px 0 0;
  font-size: 12px;
  color: #909399;
}

.panel-body {
  min-height: 0;
}
</style>
